use esp_idf_svc::mqtt::client::*;
use esp_idf_svc::mqtt::client::utils::MqttConfiguration;
use esp_idf_svc::wifi::{BlockingWifi, EspWifi};
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::netif::{EspNetifStack, NetifStack};
use esp_idf_svc::sysloop::EspSysLoopStack;
use esp_idf_svc::wifi::{AuthMethod, ClientConfiguration, Configuration};
use esp_idf_hal::peripherals::Peripherals;
use esp_idf_hal::gpio::*;
use esp_idf_hal::adc::*;
use esp_idf_hal::delay::FreeRtos;
use std::time::Duration;
use std::sync::{Arc, Mutex};
use std::thread;
use serde::{Serialize, Deserialize};
use serde_json::{json, Value};
use chrono::{DateTime, Utc, TimeZone, NaiveDateTime};
use embedded_svc::mqtt::client::QoS;
use embedded_svc::wifi::ClientConfiguration as EmbeddedClientConfiguration;
use embedded_svc::wifi::Configuration as EmbeddedConfiguration;
use log::*;

// ตัวแปรสำหรับเก็บค่า Device ID
const DEVICE_ID: u8 = 1;

// ตัวแปรสำหรับเก็บค่า MQTT Broker
const MQTT_BROKER: &str = "mqtt://broker.hivemq.com:1883";
const MQTT_CLIENT_ID: &str = "esp32_device_1";

// ตัวแปรสำหรับเก็บค่า WiFi
const WIFI_SSID: &str = "your_wifi_ssid";
const WIFI_PASSWORD: &str = "your_wifi_password";

// ตัวแปรสำหรับเก็บค่า GPIO ของรีเลย์
const RELAY_PINS: [u8; 6] = [4, 5, 12, 13, 14, 15];

// ตัวแปรสำหรับเก็บค่า GPIO ของเซ็นเซอร์
const SOIL_MOISTURE_PIN: u8 = 32;
const WATER_FLOW_PIN: u8 = 33;
const WATER_LEVEL_PIN: u8 = 34;
const LIGHT_LEVEL_PIN: u8 = 35;
const TEMPERATURE_PIN: u8 = 36;

// โครงสร้างข้อมูลสำหรับเก็บค่าเซ็นเซอร์
#[derive(Serialize, Deserialize, Debug, Clone)]
struct SensorData {
    soil_moisture: u8,
    water_flow: f32,
    water_level: u8,
    light_level: u8,
    temperature: f32,
}

// โครงสร้างข้อมูลสำหรับเก็บสถานะรีเลย์
#[derive(Serialize, Deserialize, Debug, Clone)]
struct RelayStatus {
    relay_1: bool,
    relay_2: bool,
    relay_3: bool,
    relay_4: bool,
    relay_5: bool,
    relay_6: bool,
}

// โครงสร้างข้อมูลสำหรับเก็บการตั้งเวลา
#[derive(Serialize, Deserialize, Debug, Clone)]
struct TimerData {
    relay_id: u8,
    action: String,
    duration: u32,
    start_time: String,
    end_time: String,
}

// โครงสร้างข้อมูลสำหรับเก็บการตั้งค่าระบบรดน้ำอัตโนมัติ
#[derive(Serialize, Deserialize, Debug, Clone)]
struct AutoWateringConfig {
    active: bool,
    moisture_threshold: u8,
    watering_duration: u32,
    watering_relay: u8,
}

// โครงสร้างข้อมูลสำหรับเก็บการตั้งค่าระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติ
#[derive(Serialize, Deserialize, Debug, Clone)]
struct AutoFertilizerConfig {
    active: bool,
    schedule: String,
    time: String,
    duration: u32,
    relay: u8,
}

// โครงสร้างข้อมูลสำหรับเก็บการตั้งค่าระบบอัตโนมัติทั้งหมด
#[derive(Serialize, Deserialize, Debug, Clone)]
struct AutoSystemConfig {
    watering: AutoWateringConfig,
    fertilizer: AutoFertilizerConfig,
}

// ฟังก์ชันหลัก
fn main() -> anyhow::Result<()> {
    // ตั้งค่า logger
    esp_idf_svc::log::EspLogger::initialize_default();

    // ดึง peripherals
    let peripherals = Peripherals::take().unwrap();
    
    // ตั้งค่า GPIO สำหรับรีเลย์
    let mut relay_pins = Vec::new();
    for pin in RELAY_PINS.iter() {
        let pin = peripherals.pins.gpio(*pin).into_output()?;
        relay_pins.push(pin);
    }
    
    // สร้าง shared state สำหรับรีเลย์
    let relay_status = Arc::new(Mutex::new(RelayStatus {
        relay_1: false,
        relay_2: false,
        relay_3: false,
        relay_4: false,
        relay_5: false,
        relay_6: false,
    }));
    
    // สร้าง shared state สำหรับเซ็นเซอร์
    let sensor_data = Arc::new(Mutex::new(SensorData {
        soil_moisture: 0,
        water_flow: 0.0,
        water_level: 0,
        light_level: 0,
        temperature: 0.0,
    }));
    
    // สร้าง shared state สำหรับการตั้งค่าระบบอัตโนมัติ
    let auto_system_config = Arc::new(Mutex::new(AutoSystemConfig {
        watering: AutoWateringConfig {
            active: false,
            moisture_threshold: 30,
            watering_duration: 300, // 5 นาที
            watering_relay: 1,
        },
        fertilizer: AutoFertilizerConfig {
            active: false,
            schedule: "weekly".to_string(),
            time: "08:00".to_string(),
            duration: 120, // 2 นาที
            relay: 2,
        },
    }));
    
    // สร้าง shared state สำหรับการตั้งเวลา
    let timers = Arc::new(Mutex::new(Vec::<TimerData>::new()));
    
    // ตั้งค่า WiFi
    let netif_stack = Arc::new(EspNetifStack::new()?);
    let sys_loop_stack = Arc::new(EspSysLoopStack::new()?);
    let nvs = Arc::new(EspDefaultNvsPartition::take()?);
    
    let mut wifi = BlockingWifi::wrap(
        EspWifi::new(netif_stack, sys_loop_stack, nvs)?,
        )?;
    
    let wifi_configuration = Configuration::Client(ClientConfiguration {
        ssid: WIFI_SSID.into(),
        password: WIFI_PASSWORD.into(),
        auth_method: AuthMethod::WPA2Personal,
        ..Default::default()
    });
    
    wifi.set_configuration(&wifi_configuration)?;
    wifi.start()?;
    info!("WiFi started, connecting...");
    
    wifi.connect()?;
    info!("WiFi connected, waiting for IP...");
    
    wifi.wait_netif_up()?;
    let ip_info = wifi.wifi().sta_netif().get_ip_info()?;
    info!("WiFi connected, IP: {:?}", ip_info);
    
    // ตั้งค่า MQTT
    let mqtt_config = MqttConfiguration {
        client_id: Some(MQTT_CLIENT_ID),
        ..Default::default()
    };
    
    let (mut client, mut connection) = EspMqttClient::new(MQTT_BROKER, &mqtt_config)?;
    
    // สร้าง clone ของ shared state สำหรับใช้ใน MQTT callback
    let relay_status_clone = relay_status.clone();
    let timers_clone = timers.clone();
    let auto_system_config_clone = auto_system_config.clone();
    
    // ตั้งค่า MQTT callback
    client.subscribe(&format!("esp32/{}/relay/#", DEVICE_ID), QoS::AtMostOnce)?;
    client.subscribe(&format!("esp32/{}/timer/#", DEVICE_ID), QoS::AtMostOnce)?;
    client.subscribe(&format!("esp32/{}/auto_system", DEVICE_ID), QoS::AtMostOnce)?;
    
    // สร้าง thread สำหรับอ่านค่าจากเซ็นเซอร์
    let sensor_data_clone = sensor_data.clone();
    thread::spawn(move || {
        let mut adc1 = AdcDriver::new(
            peripherals.adc1,
            &adc::config::Config::new().calibration(true),
        ).unwrap();
        
        let soil_moisture_pin = adc::AdcChannelDriver::<_, adc::Atten11dB<adc::ADC1>>::new(peripherals.pins.gpio(SOIL_MOISTURE_PIN)).unwrap();
        let water_flow_pin = adc::AdcChannelDriver::<_, adc::Atten11dB<adc::ADC1>>::new(peripherals.pins.gpio(WATER_FLOW_PIN)).unwrap();
        let water_level_pin = adc::AdcChannelDriver::<_, adc::Atten11dB<adc::ADC1>>::new(peripherals.pins.gpio(WATER_LEVEL_PIN)).unwrap();
        let light_level_pin = adc::AdcChannelDriver::<_, adc::Atten11dB<adc::ADC1>>::new(peripherals.pins.gpio(LIGHT_LEVEL_PIN)).unwrap();
        let temperature_pin = adc::AdcChannelDriver::<_, adc::Atten11dB<adc::ADC1>>::new(peripherals.pins.gpio(TEMPERATURE_PIN)).unwrap();
        
        loop {
            // อ่านค่าจากเซ็นเซอร์
            let soil_moisture_raw = adc1.read(&soil_moisture_pin).unwrap();
            let water_flow_raw = adc1.read(&water_flow_pin).unwrap();
            let water_level_raw = adc1.read(&water_level_pin).unwrap();
            let light_level_raw = adc1.read(&light_level_pin).unwrap();
            let temperature_raw = adc1.read(&temperature_pin).unwrap();
            
            // แปลงค่าจากเซ็นเซอร์
            let soil_moisture = map_value(soil_moisture_raw, 0, 4095, 0, 100);
            let water_flow = map_value_f32(water_flow_raw as f32, 0.0, 4095.0, 0.0, 10.0);
            let water_level = map_value(water_level_raw, 0, 4095, 0, 100);
            let light_level = map_value(light_level_raw, 0, 4095, 0, 100);
            let temperature = map_value_f32(temperature_raw as f32, 0.0, 4095.0, 0.0, 50.0);
            
            // อัปเดตค่าเซ็นเซอร์
            let mut data = sensor_data_clone.lock().unwrap();
            data.soil_moisture = soil_moisture;
            data.water_flow = water_flow;
            data.water_level = water_level;
            data.light_level = light_level;
            data.temperature = temperature;
            
            // รอ 1 วินาที
            FreeRtos::delay_ms(1000);
        }
    });
    
    // สร้าง thread สำหรับส่งค่าเซ็นเซอร์ไปยัง MQTT
    let sensor_data_clone = sensor_data.clone();
    let client_clone = client.clone();
    thread::spawn(move || {
        loop {
            // อ่านค่าเซ็นเซอร์
            let data = sensor_data_clone.lock().unwrap().clone();
            
            // สร้าง JSON
            let json = json!({
                "soil_moisture": data.soil_moisture,
                "water_flow": data.water_flow,
                "water_level": data.water_level,
                "light_level": data.light_level,
                "temperature": data.temperature,
            });
            
            // ส่งค่าเซ็นเซอร์ไปยัง MQTT
            let _ = client_clone.publish(
                &format!("esp32/{}/sensor", DEVICE_ID),
                QoS::AtMostOnce,
                false,
                json.to_string().as_bytes(),
            );
            
            // รอ 5 วินาที
            FreeRtos::delay_ms(5000);
        }
    });
    
    // สร้าง thread สำหรับตรวจสอบการตั้งเวลา
    let timers_clone2 = timers.clone();
    let relay_status_clone2 = relay_status.clone();
    let client_clone2 = client.clone();
    thread::spawn(move || {
        loop {
            // ตรวจสอบการตั้งเวลา
            let mut timers_to_remove = Vec::new();
            
            {
                let mut timers_data = timers_clone2.lock().unwrap();
                let now = Utc::now();
                
                for (i, timer) in timers_data.iter().enumerate() {
                    // แปลง end_time เป็น DateTime
                    if let Ok(end_time) = parse_datetime(&timer.end_time) {
                        // ถ้าถึงเวลาสิ้นสุด
                        if now >= end_time {
                            // ทำการเปิด/ปิดรีเลย์
                            let relay_id = timer.relay_id as usize - 1;
                            let action = timer.action == "on";
                            
                            // อัปเดตสถานะรีเลย์
                            let mut relay_status = relay_status_clone2.lock().unwrap();
                            match relay_id {
                                0 => relay_status.relay_1 = action,
                                1 => relay_status.relay_2 = action,
                                2 => relay_status.relay_3 = action,
                                3 => relay_status.relay_4 = action,
                                4 => relay_status.relay_5 = action,
                                5 => relay_status.relay_6 = action,
                                _ => {}
                            }
                            
                            // ส่งสถานะรีเลย์ไปยัง MQTT
                            let json = json!({
                                "relay_id": timer.relay_id,
                                "action": timer.action,
                            });
                            
                            let _ = client_clone2.publish(
                                &format!("esp32/{}/relay/status", DEVICE_ID),
                                QoS::AtMostOnce,
                                false,
                                json.to_string().as_bytes(),
                            );
                            
                            // เพิ่มเข้าไปในรายการที่จะลบ
                            timers_to_remove.push(i);
                        }
                    }
                }
                
                // ลบการตั้งเวลาที่หมดอายุ
                for i in timers_to_remove.iter().rev() {
                    timers_data.remove(*i);
                }
            }
            
            // รอ 1 วินาที
            FreeRtos::delay_ms(1000);
        }
    });
    
    // สร้าง thread สำหรับระบบรดน้ำอัตโนมัติ
    let auto_system_config_clone2 = auto_system_config.clone();
    let sensor_data_clone2 = sensor_data.clone();
    let relay_status_clone3 = relay_status.clone();
    let client_clone3 = client.clone();
    thread::spawn(move || {
        let mut watering_active = false;
        let mut watering_start_time = Utc::now();
        
        loop {
            // ตรวจสอบระบบรดน้ำอัตโนมัติ
            let config = auto_system_config_clone2.lock().unwrap().clone();
            
            if config.watering.active {
                let sensor_data = sensor_data_clone2.lock().unwrap().clone();
                
                // ถ้าความชื้นในดินต่ำกว่าค่าที่กำหนดและไม่ได้กำลังรดน้ำอยู่
                if sensor_data.soil_moisture < config.watering.moisture_threshold && !watering_active {
                    // เริ่มรดน้ำ
                    watering_active = true;
                    watering_start_time = Utc::now();
                    
                    // เปิดรีเลย์
                    let relay_id = config.watering.watering_relay as usize - 1;
                    let mut relay_status = relay_status_clone3.lock().unwrap();
                    match relay_id {
                        0 => relay_status.relay_1 = true,
                        1 => relay_status.relay_2 = true,
                        2 => relay_status.relay_3 = true,
                        3 => relay_status.relay_4 = true,
                        4 => relay_status.relay_5 = true,
                        5 => relay_status.relay_6 = true,
                        _ => {}
                    }
                    
                    // ส่งสถานะรีเลย์ไปยัง MQTT
                    let json = json!({
                        "relay_id": config.watering.watering_relay,
                        "action": "on",
                    });
                    
                    let _ = client_clone3.publish(
                        &format!("esp32/{}/relay/status", DEVICE_ID),
                        QoS::AtMostOnce,
                        false,
                        json.to_string().as_bytes(),
                    );
                    
                    // ส่งสถานะระบบรดน้ำอัตโนมัติไปยัง MQTT
                    let json = json!({
                        "watering": {
                            "active": true,
                            "running": true,
                        }
                    });
                    
                    let _ = client_clone3.publish(
                        &format!("esp32/{}/auto_system", DEVICE_ID),
                        QoS::AtMostOnce,
                        false,
                        json.to_string().as_bytes(),
                    );
                }
                
                // ถ้ากำลังรดน้ำอยู่และครบเวลาที่กำหนด
                if watering_active {
                    let now = Utc::now();
                    let duration = now.signed_duration_since(watering_start_time).num_seconds() as u32;
                    
                    if duration >= config.watering.watering_duration {
                        // หยุดรดน้ำ
                        watering_active = false;
                        
                        // ปิดรีเลย์
                        let relay_id = config.watering.watering_relay as usize - 1;
                        let mut relay_status = relay_status_clone3.lock().unwrap();
                        match relay_id {
                            0 => relay_status.relay_1 = false,
                            1 => relay_status.relay_2 = false,
                            2 => relay_status.relay_3 = false,
                            3 => relay_status.relay_4 = false,
                            4 => relay_status.relay_5 = false,
                            5 => relay_status.relay_6 = false,
                            _ => {}
                        }
                        
                        // ส่งสถานะรีเลย์ไปยัง MQTT
                        let json = json!({
                            "relay_id": config.watering.watering_relay,
                            "action": "off",
                        });
                        
                        let _ = client_clone3.publish(
                            &format!("esp32/{}/relay/status", DEVICE_ID),
                            QoS::AtMostOnce,
                            false,
                            json.to_string().as_bytes(),
                        );
                        
                        // ส่งสถานะระบบรดน้ำอัตโนมัติไปยัง MQTT
                        let json = json!({
                            "watering": {
                                "active": true,
                                "running": false,
                            }
                        });
                        
                        let _ = client_clone3.publish(
                            &format!("esp32/{}/auto_system", DEVICE_ID),
                            QoS::AtMostOnce,
                            false,
                            json.to_string().as_bytes(),
                        );
                    }
                }
            }
            
            // รอ 1 วินาที
            FreeRtos::delay_ms(1000);
        }
    });
    
    // สร้าง thread สำหรับระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติ
    let auto_system_config_clone3 = auto_system_config.clone();
    let relay_status_clone4 = relay_status.clone();
    let client_clone4 = client.clone();
    thread::spawn(move || {
        let mut next_fertilizer_time = Utc::now();
        let mut fertilizing_active = false;
        let mut fertilizing_start_time = Utc::now();
        
        loop {
            // ตรวจสอบระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติ
            let config = auto_system_config_clone3.lock().unwrap().clone();
            
            if config.fertilizer.active {
                let now = Utc::now();
                
                // ถ้าถึงเวลาให้ปุ๋ยและไม่ได้กำลังให้ปุ๋ยอยู่
                if now >= next_fertilizer_time && !fertilizing_active {
                    // เริ่มให้ปุ๋ย
                    fertilizing_active = true;
                    fertilizing_start_time = now;
                    
                    // เปิดรีเลย์
                    let relay_id = config.fertilizer.relay as usize - 1;
                    let mut relay_status = relay_status_clone4.lock().unwrap();
                    match relay_id {
                        0 => relay_status.relay_1 = true,
                        1 => relay_status.relay_2 = true,
                        2 => relay_status.relay_3 = true,
                        3 => relay_status.relay_4 = true,
                        4 => relay_status.relay_5 = true,
                        5 => relay_status.relay_6 = true,
                        _ => {}
                    }
                    
                    // ส่งสถานะรีเลย์ไปยัง MQTT
                    let json = json!({
                        "relay_id": config.fertilizer.relay,
                        "action": "on",
                    });
                    
                    let _ = client_clone4.publish(
                        &format!("esp32/{}/relay/status", DEVICE_ID),
                        QoS::AtMostOnce,
                        false,
                        json.to_string().as_bytes(),
                    );
                    
                    // ส่งสถานะระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติไปยัง MQTT
                    let json = json!({
                        "fertilizer": {
                            "active": true,
                            "running": true,
                        }
                    });
                    
                    let _ = client_clone4.publish(
                        &format!("esp32/{}/auto_system", DEVICE_ID),
                        QoS::AtMostOnce,
                        false,
                        json.to_string().as_bytes(),
                    );
                }
                
                // ถ้ากำลังให้ปุ๋ยอยู่และครบเวลาที่กำหนด
                if fertilizing_active {
                    let now = Utc::now();
                    let duration = now.signed_duration_since(fertilizing_start_time).num_seconds() as u32;
                    
                    if duration >= config.fertilizer.duration {
                        // หยุดให้ปุ๋ย
                        fertilizing_active = false;
                        
                        // ปิดรีเลย์
                        let relay_id = config.fertilizer.relay as usize - 1;
                        let mut relay_status = relay_status_clone4.lock().unwrap();
                        match relay_id {
                            0 => relay_status.relay_1 = false,
                            1 => relay_status.relay_2 = false,
                            2 => relay_status.relay_3 = false,
                            3 => relay_status.relay_4 = false,
                            4 => relay_status.relay_5 = false,
                            5 => relay_status.relay_6 = false,
                            _ => {}
                        }
                        
                        // ส่งสถานะรีเลย์ไปยัง MQTT
                        let json = json!({
                            "relay_id": config.fertilizer.relay,
                            "action": "off",
                        });
                        
                        let _ = client_clone4.publish(
                            &format!("esp32/{}/relay/status", DEVICE_ID),
                            QoS::AtMostOnce,
                            false,
                            json.to_string().as_bytes(),
                        );
                        
                        // คำนวณเวลาให้ปุ๋ยครั้งถัดไป
                        next_fertilizer_time = calculate_next_fertilizer_time(&config.fertilizer.time, &config.fertilizer.schedule);
                        
                        // ส่งสถานะระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติไปยัง MQTT
                        let json = json!({
                            "fertilizer": {
                                "active": true,
                                "running": false,
                                "nextTime": next_fertilizer_time.to_rfc3339(),
                            }
                        });
                        
                        let _ = client_clone4.publish(
                            &format!("esp32/{}/auto_system", DEVICE_ID),
                            QoS::AtMostOnce,
                            false,
                            json.to_string().as_bytes(),
                        );
                    }
                }
            }
            
            // รอ 1 วินาที
            FreeRtos::delay_ms(1000);
        }
    });
    
    // รับข้อมูลจาก MQTT
    loop {
        if let Some(msg) = connection.next() {
            match msg {
                Ok(message) => {
                    let topic = message.topic();
                    let payload = message.payload();
                    let payload_str = std::str::from_utf8(payload).unwrap_or("");
                    
                    info!("Received message: topic={}, payload={}", topic, payload_str);
                    
                    // ตรวจสอบ topic
                    if topic.starts_with(&format!("esp32/{}/relay/control", DEVICE_ID)) {
                        // ควบคุมรีเลย์
                        if let Ok(json) = serde_json::from_str::<Value>(payload_str) {
                            if let (Some(relay_id), Some(action)) = (json["relay_id"].as_u64(), json["action"].as_str()) {
                                let relay_id = relay_id as usize - 1;
                                let action = action == "on";
                                
                                // อัปเดตสถานะรีเลย์
                                let mut relay_status = relay_status_clone.lock().unwrap();
                                match relay_id {
                                    0 => relay_status.relay_1 = action,
                                    1 => relay_status.relay_2 = action,
                                    2 => relay_status.relay_3 = action,
                                    3 => relay_status.relay_4 = action,
                                    4 => relay_status.relay_5 = action,
                                    5 => relay_status.relay_6 = action,
                                    _ => {}
                                }
                                
                                // ส่งสถานะรีเลย์กลับไปยัง MQTT
                                let _ = client.publish(
                                    &format!("esp32/{}/relay/status", DEVICE_ID),
                                    QoS::AtMostOnce,
                                    false,
                                    payload,
                                );
                            }
                        }
                    } else if topic.starts_with(&format!("esp32/{}/timer/set", DEVICE_ID)) {
                        // ตั้งเวลา
                        if let Ok(json) = serde_json::from_str::<Value>(payload_str) {
                            if let (Some(relay_id), Some(action), Some(duration)) = (
                                json["relay_id"].as_u64(),
                                json["action"].as_str(),
                                json["duration"].as_u64(),
                            ) {
                                let relay_id = relay_id as u8;
                                let action = action.to_string();
                                let duration = duration as u32;
                                
                                // คำนวณเวลาเริ่มต้นและสิ้นสุด
                                let now = Utc::now();
                                let end_time = now + chrono::Duration::seconds(duration as i64);
                                
                                // สร้างข้อมูลการตั้งเวลา
                                let timer_data = TimerData {
                                    relay_id,
                                    action: action.clone(),
                                    duration,
                                    start_time: now.to_rfc3339(),
                                    end_time: end_time.to_rfc3339(),
                                };
                                
                                // เพิ่มการตั้งเวลา
                                timers_clone.lock().unwrap().push(timer_data);
                                
                                // ส่งสถานะการตั้งเวลากลับไปยัง MQTT
                                let _ = client.publish(
                                    &format!("esp32/{}/timer/status", DEVICE_ID),
                                    QoS::AtMostOnce,
                                    false,
                                    payload,
                                );
                            }
                        }
                    } else if topic.starts_with(&format!("esp32/{}/timer/cancel", DEVICE_ID)) {
                        // ยกเลิกการตั้งเวลา
                        if let Ok(json) = serde_json::from_str::<Value>(payload_str) {
                            if let Some(relay_id) = json["relay_id"].as_u64() {
                                let relay_id = relay_id as u8;
                                
                                // ลบการตั้งเวลาของรีเลย์นี้
                                let mut timers = timers_clone.lock().unwrap();
                                timers.retain(|timer| timer.relay_id != relay_id);
                                
                                // ส่งสถานะการยกเลิกการตั้งเวลากลับไปยัง MQTT
                                let _ = client.publish(
                                    &format!("esp32/{}/timer/status", DEVICE_ID),
                                    QoS::AtMostOnce,
                                    false,
                                    payload,
                                );
                            }
                        }
                    } else if topic.starts_with(&format!("esp32/{}/auto_system", DEVICE_ID)) {
                        // อัปเดตการตั้งค่าระบบอัตโนมัติ
                        if let Ok(json) = serde_json::from_str::<Value>(payload_str) {
                            let mut config = auto_system_config_clone.lock().unwrap();
                            
                            // อัปเดตการตั้งค่าระบบรดน้ำอัตโนมัติ
                            if let Some(watering) = json["watering"].as_object() {
                                if let Some(active) = watering.get("active").and_then(|v| v.as_bool()) {
                                    config.watering.active = active;
                                }
                                if let Some(threshold) = watering.get("moistureThreshold").and_then(|v| v.as_u64()) {
                                    config.watering.moisture_threshold = threshold as u8;
                                }
                                if let Some(duration) = watering.get("wateringDuration").and_then(|v| v.as_u64()) {
                                    config.watering.watering_duration = duration as u32;
                                }
                                if let Some(relay) = watering.get("wateringRelay").and_then(|v| v.as_u64()) {
                                    config.watering.watering_relay = relay as u8;
                                }
                            }
                            
                            // อัปเดตการตั้งค่าระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติ
                            if let Some(fertilizer) = json["fertilizer"].as_object() {
                                if let Some(active) = fertilizer.get("active").and_then(|v| v.as_bool()) {
                                    config.fertilizer.active = active;
                                }
                                if let Some(schedule) = fertilizer.get("schedule").and_then(|v| v.as_str()) {
                                    config.fertilizer.schedule = schedule.to_string();
                                }
                                if let Some(time) = fertilizer.get("time").and_then(|v| v.as_str()) {
                                    config.fertilizer.time = time.to_string();
                                }
                                if let Some(duration) = fertilizer.get("duration").and_then(|v| v.as_u64()) {
                                    config.fertilizer.duration = duration as u32;
                                }
                                if let Some(relay) = fertilizer.get("relay").and_then(|v| v.as_u64()) {
                                    config.fertilizer.relay = relay as u8;
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Error receiving message: {:?}", e);
                }
            }
        }
        
        // รอ 10 มิลลิวินาที
        FreeRtos::delay_ms(10);
    }
}

// ฟังก์ชันสำหรับแปลงค่า
fn map_value(value: u16, from_low: u16, from_high: u16, to_low: u8, to_high: u8) -> u8 {
    let from_range = from_high as f32 - from_low as f32;
    let to_range = to_high as f32 - to_low as f32;
    let scale = to_range / from_range;
    
    let mapped = (value as f32 - from_low as f32) * scale + to_low as f32;
    mapped.clamp(to_low as f32, to_high as f32) as u8
}

// ฟังก์ชันสำหรับแปลงค่า (float)
fn map_value_f32(value: f32, from_low: f32, from_high: f32, to_low: f32, to_high: f32) -> f32 {
    let from_range = from_high - from_low;
    let to_range = to_high - to_low;
    let scale = to_range / from_range;
    
    let mapped = (value - from_low) * scale + to_low;
    mapped.clamp(to_low, to_high)
}

// ฟังก์ชันสำหรับแปลง string เป็น DateTime
fn parse_datetime(datetime_str: &str) -> Result<DateTime<Utc>, chrono::ParseError> {
    DateTime::parse_from_rfc3339(datetime_str)
        .map(|dt| dt.with_timezone(&Utc))
}

// ฟังก์ชันสำหรับคำนวณเวลาให้ปุ๋ยครั้งถัดไป
fn calculate_next_fertilizer_time(time_str: &str, schedule: &str) -> DateTime<Utc> {
    // แยกชั่วโมงและนาทีจากเวลาที่ตั้งไว้
    let parts: Vec<&str> = time_str.split(':').collect();
    let hours = parts[0].parse::<u32>().unwrap_or(8);
    let minutes = parts[1].parse::<u32>().unwrap_or(0);
    
    // สร้างวันที่ปัจจุบัน
    let now = Utc::now();
    
    // สร้างวันที่สำหรับเวลาให้ปุ๋ยวันนี้
    let mut next_time = Utc::now()
        .with_hour(hours).unwrap()
        .with_minute(minutes).unwrap()
        .with_second(0).unwrap()
        .with_nanosecond(0).unwrap();
    
    // ถ้าเวลาให้ปุ๋ยวันนี้ผ่านไปแล้ว ให้เลื่อนไปวันถัดไปตามตารางที่กำหนด
    if next_time <= now {
        match schedule {
            "daily" => {
                // ทุกวัน - เลื่อนไป 1 วัน
                next_time = next_time + chrono::Duration::days(1);
            }
            "weekly" => {
                // ทุกสัปดาห์ - เลื่อนไป 7 วัน
                next_time = next_time + chrono::Duration::days(7);
            }
            "biweekly" => {
                // ทุก 2 สัปดาห์ - เลื่อนไป 14 วัน
                next_time = next_time + chrono::Duration::days(14);
            }
            "monthly" => {
                // ทุกเดือน - เลื่อนไป 1 เดือน
                let mut year = next_time.year();
                let mut month = next_time.month() + 1;
                
                if month > 12 {
                    month = 1;
                    year += 1;
                }
                
                let day = next_time.day();
                
                // สร้างวันที่ใหม่
                next_time = Utc.with_ymd_and_hms(year, month, day, hours, minutes, 0).unwrap();
            }
            _ => {
                // ค่าเริ่มต้น - ทุกวัน
                next_time = next_time + chrono::Duration::days(1);
            }
        }
    }
    
    next_time
}

