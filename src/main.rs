use esp_idf_sys as _;
use esp_idf_hal::prelude::*;
use esp_idf_hal::gpio::*;
use esp_idf_hal::adc::*;
use esp_idf_svc::mqtt::client::*;
use esp_idf_svc::wifi::*;
use esp_idf_svc::netif::*;
use esp_idf_svc::sysloop::*;
use esp_idf_svc::nvs::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::{thread, time::Duration, str};
use serde_json::json;

// กำหนด GPIO สำหรับรีเลย์ 6 ตัว
const RELAY_PINS: [u32; 6] = [23, 22, 21, 19, 18, 5]; // ปรับ GPIO ตามบอร์ดของคุณ

// กำหนด GPIO สำหรับเซ็นเซอร์ต่างๆ
const WATER_FLOW_SENSOR_PIN: u32 = 26; // เซ็นเซอร์วัดการไหลของน้ำ
const SOIL_MOISTURE_SENSOR_PIN: u32 = 32; // เซ็นเซอร์วัดความชื้นในดิน
const TEMPERATURE_SENSOR_PIN: u32 = 33; // เซ็นเซอร์วัดอุณหภูมิ
const WATER_LEVEL_SENSOR_PIN: u32 = 34; // เซ็นเซอร์วัดระดับน้ำ
const LIGHT_SENSOR_PIN: u32 = 35; // เซ็นเซอร์วัดแสง

// กำหนด Device ID สำหรับ ESP32 นี้
const DEVICE_ID: u32 = 1; // เปลี่ยนเป็น 1, 2, หรือ 3 ตามที่ต้องการ

// ช่วงเวลาในการอ่านค่าเซ็นเซอร์ (มิลลิวินาที)
const SENSOR_READ_INTERVAL: u64 = 5000; // อ่านค่าทุก 5 วินาที

// โครงสร้างข้อมูลสำหรับเก็บค่าเซ็นเซอร์
struct SensorData {
    water_flow_rate: f32,      // อัตราการไหลของน้ำ (ลิตร/นาที)
    soil_moisture: u16,        // ความชื้นในดิน (0-4095)
    temperature: f32,          // อุณหภูมิ (องศาเซลเซียส)
    water_level: u16,          // ระดับน้ำ (0-4095)
    light_level: u16,          // ระดับแสง (0-4095)
    last_update: std::time::Instant, // เวลาที่อัปเดตล่าสุด
}

impl SensorData {
    fn new() -> Self {
        SensorData {
            water_flow_rate: 0.0,
            soil_moisture: 0,
            temperature: 0.0,
            water_level: 0,
            light_level: 0,
            last_update: std::time::Instant::now(),
        }
    }
}

fn main() -> anyhow::Result<()> {
    esp_idf_sys::link_patches();

    let peripherals = Peripherals::take().unwrap();

    // สร้าง HashMap เพื่อเก็บสถานะรีเลย์ (thread-safe)
    let relay_states = Arc::new(Mutex::new(HashMap::new()));

    // สร้างตัวแปรเก็บข้อมูลเซ็นเซอร์ (thread-safe)
    let sensor_data = Arc::new(Mutex::new(SensorData::new()));

    // ตั้งค่า PinDriver สำหรับรีเลย์ 6 ตัว
    let mut relays = Vec::new();
    for (i, &pin) in RELAY_PINS.iter().enumerate() {
        let relay = PinDriver::output(peripherals.pins.gpio(pin))?;
        relay.set_low()?; // เริ่มต้นรีเลย์ในสถานะปิด
        relay_states.lock().unwrap().insert(i + 1, false); // false = ปิด
        relays.push(relay);
    }

    // ตั้งค่า PinDriver สำหรับเซ็นเซอร์
    let water_flow_sensor = PinDriver::input(peripherals.pins.gpio(WATER_FLOW_SENSOR_PIN))?;
    
    // ตั้งค่า ADC สำหรับเซ็นเซอร์แบบอนาล็อก
    let mut adc1 = AdcDriver::new(peripherals.adc1, &AdcConfig::new())?;
    
    let soil_moisture_pin = AdcChannelDriver::<_, Atten11dB<_>>::new(peripherals.pins.gpio(SOIL_MOISTURE_SENSOR_PIN))?;
    let temperature_pin = AdcChannelDriver::<_, Atten11dB<_>>::new(peripherals.pins.gpio(TEMPERATURE_SENSOR_PIN))?;
    let water_level_pin = AdcChannelDriver::<_, Atten11dB<_>>::new(peripherals.pins.gpio(WATER_LEVEL_SENSOR_PIN))?;
    let light_pin = AdcChannelDriver::<_, Atten11dB<_>>::new(peripherals.pins.gpio(LIGHT_SENSOR_PIN))?;

    // ตั้งค่า Wi-Fi
    setup_wifi()?;

    // ตั้งค่า MQTT
    let mqtt_url = "mqtt://broker.hivemq.com"; // เปลี่ยนเป็น MQTT broker ของคุณ
    let (mut client, mut conn) = EspMqttClient::new_with_conn(mqtt_url, &MqttClientConfiguration {
        client_id: Some(&format!("esp32-device-{}", DEVICE_ID)),
        keep_alive_interval: Some(Duration::from_secs(60)),
        ..Default::default()
    })?;

    // ส่งสถานะการเชื่อมต่อเมื่อเริ่มต้น
    client.publish(
        &format!("esp32/{}/connection", DEVICE_ID),
        QoS::AtMostOnce,
        false,
        "online"
    )?;

    // Subscribe to topics for all 6 relays
    for relay_id in 1..=6 {
        // Subscribe ตาม format ใหม่: esp32/{device_id}/relay/{relay_id}/control
        let control_topic = format!("esp32/{}/relay/{}/control", DEVICE_ID, relay_id);
        client.subscribe(&control_topic, QoS::AtMostOnce)?;
        
        // Subscribe สำหรับการตั้งเวลา
        let timer_set_topic = format!("esp32/{}/relay/{}/timer/set", DEVICE_ID, relay_id);
        client.subscribe(&timer_set_topic, QoS::AtMostOnce)?;
        
        let timer_cancel_topic = format!("esp32/{}/relay/{}/timer/cancel", DEVICE_ID, relay_id);
        client.subscribe(&timer_cancel_topic, QoS::AtMostOnce)?;
        
        // ส่งสถานะเริ่มต้นของรีเลย์
        let status_topic = format!("esp32/{}/relay/{}/status", DEVICE_ID, relay_id);
        client.publish(&status_topic, QoS::AtMostOnce, false, "off")?;
    }

    // แชร์สถานะรีเลย์และ PinDriver ระหว่าง thread
    let relay_states_clone = Arc::clone(&relay_states);
    let mut relays_clone = relays.clone();

    // HashMap สำหรับเก็บ timer
    let timers = Arc::new(Mutex::new(HashMap::<String, std::time::Instant>::new()));
    let timers_clone = Arc::clone(&timers);

    // Thread สำหรับจัดการ timer
    let timer_client = client.clone();
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_millis(500));
            
            let mut expired_timers = Vec::new();
            
            // ตรวจสอบ timer ที่หมดเวลา
            {
                let timer_map = timers_clone.lock().unwrap();
                for (key, end_time) in timer_map.iter() {
                    if std::time::Instant::now() >= *end_time {
                        expired_timers.push(key.clone());
                    }
                }
            }
            
            // ทำงานกับ timer ที่หมดเวลา
            for timer_key in expired_timers {
                let parts: Vec<&str> = timer_key.split(':').collect();
                if parts.len() == 3 {
                    let relay_id = parts[0].parse::<usize>().unwrap_or(0);
                    let action = parts[1];
                    
                    if relay_id >= 1 && relay_id <= 6 {
                        // ทำการควบคุมรีเลย์
                        let mut states = relay_states_clone.lock().unwrap();
                        match action {
                            "on" => {
                                relays_clone[relay_id - 1].set_high().unwrap();
                                states.insert(relay_id, true);
                                // ส่งสถานะอัปเดต
                                let status_topic = format!("esp32/{}/relay/{}/status", DEVICE_ID, relay_id);
                                timer_client.publish(&status_topic, QoS::AtMostOnce, false, "on").unwrap();
                            }
                            "off" => {
                                relays_clone[relay_id - 1].set_low().unwrap();
                                states.insert(relay_id, false);
                                // ส่งสถานะอัปเดต
                                let status_topic = format!("esp32/{}/relay/{}/status", DEVICE_ID, relay_id);
                                timer_client.publish(&status_topic, QoS::AtMostOnce, false, "off").unwrap();
                            }
                            _ => {}
                        }
                    }
                }
                
                // ลบ timer ที่หมดเวลาแล้ว
                {
                    let mut timer_map = timers_clone.lock().unwrap();
                    timer_map.remove(&timer_key);
                }
            }
        }
    });

    // Thread สำหรับอ่านค่าเซ็นเซอร์และส่งข้อมูล
    let sensor_client = client.clone();
    let sensor_data_clone = Arc::clone(&sensor_data);
    thread::spawn(move || {
        // ตัวแปรสำหรับนับพัลส์ของเซ็นเซอร์วัดการไหลของน้ำ
        let mut last_flow_state = false;
        let mut pulse_count = 0;
        let mut last_pulse_time = std::time::Instant::now();
        
        loop {
            // อ่านค่าเซ็นเซอร์วัดการไหลของน้ำ (นับจำนวนพัลส์)
            let current_flow_state = water_flow_sensor.is_high().unwrap_or(false);
            if current_flow_state && !last_flow_state {
                pulse_count += 1;
            }
            last_flow_state = current_flow_state;
            
            // อ่านค่าเซ็นเซอร์อื่นๆ ทุก SENSOR_READ_INTERVAL
            if last_pulse_time.elapsed() >= Duration::from_millis(SENSOR_READ_INTERVAL) {
                // คำนวณอัตราการไหลของน้ำ (สมมติว่า 1 พัลส์ = 2.25 มิลลิลิตร)
                let flow_rate = (pulse_count as f32 * 2.25) / (SENSOR_READ_INTERVAL as f32 / 1000.0 / 60.0) / 1000.0;
                pulse_count = 0;
                last_pulse_time = std::time::Instant::now();
                
                // อ่านค่าเซ็นเซอร์อื่นๆ
                let soil_moisture_value = adc1.read(&soil_moisture_pin).unwrap_or(0);
                let temperature_raw = adc1.read(&temperature_pin).unwrap_or(0);
                let water_level_value = adc1.read(&water_level_pin).unwrap_or(0);
                let light_value = adc1.read(&light_pin).unwrap_or(0);
                
                // แปลงค่า ADC เป็นอุณหภูมิ (สมมติว่าใช้ LM35: 10mV/°C)
                let temperature_value = (temperature_raw as f32 * 3300.0 / 4095.0) / 10.0;
                
                // บันทึกค่าเซ็นเซอร์
                {
                    let mut data = sensor_data_clone.lock().unwrap();
                    data.water_flow_rate = flow_rate;
                    data.soil_moisture = soil_moisture_value;
                    data.temperature = temperature_value;
                    data.water_level = water_level_value;
                    data.light_level = light_value;
                    data.last_update = std::time::Instant::now();
                }
                
                // สร้าง JSON สำหรับส่งข้อมูลเซ็นเซอร์
                let sensor_json = json!({
                    "water_flow_rate": flow_rate,
                    "soil_moisture": soil_moisture_value,
                    "temperature": temperature_value,
                    "water_level": water_level_value,
                    "light_level": light_value,
                    "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()
                });
                
                // ส่งข้อมูลเซ็นเซอร์ผ่าน MQTT
                let sensor_topic = format!("esp32/{}/sensors", DEVICE_ID);
                if let Err(e) = sensor_client.publish(
                    &sensor_topic,
                    QoS::AtMostOnce,
                    false,
                    sensor_json.to_string()
                ) {
                    println!("ไม่สามารถส่งข้อมูลเซ็นเซอร์: {:?}", e);
                }
                
                // ส่งข้อมูลแต่ละเซ็นเซอร์แยกกัน (สำหรับการแสดงผลแบบเรียลไทม์)
                let flow_topic = format!("esp32/{}/sensor/water_flow", DEVICE_ID);
                sensor_client.publish(&flow_topic, QoS::AtMostOnce, false, flow_rate.to_string()).unwrap_or(());
                
                let moisture_topic = format!("esp32/{}/sensor/soil_moisture", DEVICE_ID);
                sensor_client.publish(&moisture_topic, QoS::AtMostOnce, false, soil_moisture_value.to_string()).unwrap_or(());
                
                let temp_topic = format!("esp32/{}/sensor/temperature", DEVICE_ID);
                sensor_client.publish(&temp_topic, QoS::AtMostOnce, false, temperature_value.to_string()).unwrap_or(());
                
                let water_level_topic = format!("esp32/{}/sensor/water_level", DEVICE_ID);
                sensor_client.publish(&water_level_topic, QoS::AtMostOnce, false, water_level_value.to_string()).unwrap_or(());
                
                let light_topic = format!("esp32/{}/sensor/light", DEVICE_ID);
                sensor_client.publish(&light_topic, QoS::AtMostOnce, false, light_value.to_string()).unwrap_or(());
            }
            
            thread::sleep(Duration::from_millis(10)); // ตรวจสอบทุก 10ms เพื่อจับพัลส์ได้แม่นยำ
        }
    });

    // Spawn MQTT listener
    let mqtt_client = client.clone();
    thread::spawn(move || {
        while let Some(msg) = conn.next() {
            if let Ok(Event::Received(msg)) = msg {
                let topic = msg.topic().unwrap_or("");
                let data = str::from_utf8(msg.data()).unwrap_or("");
                
                // แยกส่วนของ topic
                let topic_parts: Vec<&str> = topic.split('/').collect();
                
                // ตรวจสอบว่าเป็น topic ที่เกี่ยวข้องกับ ESP32 นี้หรือไม่
                if topic_parts.len() >= 5 && topic_parts[0] == "esp32" && topic_parts[1] == DEVICE_ID.to_string() && topic_parts[2] == "relay" {
                    if let Ok(relay_id) = topic_parts[3].parse::<usize>() {
                        if relay_id >= 1 && relay_id <= 6 {
                            // ควบคุมรีเลย์
                            if topic_parts[4] == "control" {
                                let mut states = relay_states_clone.lock().unwrap();
                                match data {
                                    "on" => {
                                        relays_clone[relay_id - 1].set_high().unwrap();
                                        states.insert(relay_id, true);
                                        // ส่งสถานะอัปเดต
                                        let status_topic = format!("esp32/{}/relay/{}/status", DEVICE_ID, relay_id);
                                        mqtt_client.publish(&status_topic, QoS::AtMostOnce, false, "on").unwrap();
                                    }
                                    "off" => {
                                        relays_clone[relay_id - 1].set_low().unwrap();
                                        states.insert(relay_id, false);
                                        // ส่งสถานะอัปเดต
                                        let status_topic = format!("esp32/{}/relay/{}/status", DEVICE_ID, relay_id);
                                        mqtt_client.publish(&status_topic, QoS::AtMostOnce, false, "off").unwrap();
                                    }
                                    _ => {}
                                }
                            }
                            // ตั้งเวลา
                            else if topic_parts[4] == "timer" && topic_parts.len() >= 6 {
                                if topic_parts[5] == "set" {
                                    // พยายามแปลง JSON
                                    if let Ok(timer_data) = serde_json::from_str::<serde_json::Value>(data) {
                                        if let (Some(action), Some(duration)) = (
                                            timer_data.get("action").and_then(|v| v.as_str()),
                                            timer_data.get("duration").and_then(|v| v.as_u64())
                                        ) {
                                            // สร้าง timer key
                                            let timer_key = format!("{}:{}:{}", relay_id, action, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs());
                                            
                                            // คำนวณเวลาสิ้นสุด
                                            let end_time = std::time::Instant::now() + Duration::from_secs(duration);
                                            
                                            // บันทึก timer
                                            let mut timer_map = timers.lock().unwrap();
                                            timer_map.insert(timer_key, end_time);
                                            
                                            // ส่งข้อมูลการตั้งเวลากลับไปยัง frontend
                                            let timer_status_topic = format!("esp32/{}/relay/{}/timer/status", DEVICE_ID, relay_id);
                                            let timer_status = json!({
                                                "action": action,
                                                "duration": duration,
                                                "end_time": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() + duration
                                            });
                                            mqtt_client.publish(&timer_status_topic, QoS::AtMostOnce, false, timer_status.to_string()).unwrap();
                                        }
                                    }
                                }
                                else if topic_parts[5] == "cancel" {
                                    // ยกเลิก timer ทั้งหมดของรีเลย์นี้
                                    let mut timer_map = timers.lock().unwrap();
                                    let keys_to_remove: Vec<String> = timer_map.keys()
                                        .filter(|k| k.starts_with(&format!("{}:", relay_id)))
                                        .cloned()
                                        .collect();
                                    
                                    for key in keys_to_remove {
                                        timer_map.remove(&key);
                                    }
                                    
                                    // ส่งข้อมูลการยกเลิกการตั้งเวลากลับไปยัง frontend
                                    let timer_status_topic = format!("esp32/{}/relay/{}/timer/status", DEVICE_ID, relay_id);
                                    let timer_status = json!({
                                        "canceled": true
                                    });
                                    mqtt_client.publish(&timer_status_topic, QoS::AtMostOnce, false, timer_status.to_string()).unwrap();
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // รักษาโปรแกรมให้ทำงานต่อไป
    loop {
        // ส่งสถานะการเชื่อมต่อเป็นระยะ
        client.publish(
            &format!("esp32/{}/connection", DEVICE_ID),
            QoS::AtMostOnce,
            false,
            "online"
        )?;
        
        thread::sleep(Duration::from_secs(60));
    }
}

// ฟังก์ชันตั้งค่า Wi-Fi
fn setup_wifi() -> anyhow::Result<()> {
    let netif_stack = Arc::new(EspNetif::new(NetworkNamespace::Station)?);
    let sysloop = Arc::new(EspSysLoop::new()?);
    let nvs = Arc::new(EspDefaultNvs::new()?);

    let mut wifi = Wifi::new(netif_stack, sysloop, nvs)?;
    wifi.set_configuration(&Configuration::Client(ClientConfiguration {
        ssid: "YOUR_SSID".into(),
        password: "YOUR_PASSWORD".into(),
        ..Default::default()
    }))?;
    wifi.start()?;
    wifi.connect()?;
    wifi.wait_netif_up()?;

    println!("WiFi connected, IP: {:?}", wifi.sta_netif().get_ip_info()?);
    Ok(())
}

