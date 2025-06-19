// ตัวแปรสำหรับเก็บข้อมูล ESP32 และรีเลย์
const ESP32_DEVICES = [
  { id: 1, name: "ESP32 ตัวที่ 1", relays: 6, online: false },
  { id: 2, name: "ESP32 ตัวที่ 2", relays: 6, online: false },
  { id: 3, name: "ESP32 ตัวที่ 3", relays: 6, online: false }
];

// ตัวแปรสำหรับเก็บข้อมูลการตั้งเวลา
const timers = {};
const schedules = {}; // เก็บข้อมูลตารางการตั้งเวลา

// ตัวแปรสำหรับเก็บข้อมูลเซ็นเซอร์
const sensorData = {
  1: {
    water_flow_rate: 0,
    soil_moisture: 0,
    temperature: 0,
    water_level: 0,
    light_level: 0,
    last_update: null
  },
  2: {
    water_flow_rate: 0,
    soil_moisture: 0,
    temperature: 0,
    water_level: 0,
    light_level: 0,
    last_update: null
  },
  3: {
    water_flow_rate: 0,
    soil_moisture: 0,
    temperature: 0,
    water_level: 0,
    light_level: 0,
    last_update: null
  }
};

// ฟังก์ชันควบคุมรีเลย์
function controlRelay(deviceId, relayId, action) {
  const statusElement = document.getElementById(`status-${deviceId}-${relayId}`);
  
  // อัปเดต UI
  if (action === 'on') {
    statusElement.textContent = 'เปิด';
    statusElement.classList.add('status-on');
    statusElement.classList.remove('status-off');
  } else if (action === 'off') {
    statusElement.textContent = 'ปิด';
    statusElement.classList.add('status-off');
    statusElement.classList.remove('status-on');
  }
  
  // ส่งคำสั่งผ่าน MQTT
  if (typeof client !== 'undefined') {
    const topic = `esp32/${deviceId}/relay/${relayId}/control`;
    client.publish(topic, action, { qos: 0 }, (err) => {
      if (err) {
        statusElement.textContent = "ส่งคำสั่งไม่ได้";
        console.error(`ไม่สามารถส่งคำสั่งไปยัง ESP32 ${deviceId} รีเลย์ ${relayId}: ${err}`);
      } else {
        console.log(`ควบคุม ESP32 ${deviceId} รีเลย์ ${relayId}: ${action}`);
      }
    });
  } else {
    console.log(`MQTT client ยังไม่พร้อม, ควบคุม ESP32 ${deviceId} รีเลย์ ${relayId}: ${action}`);
  }
}

// ฟังก์ชันตั้งเวลาสำหรับรีเลย์ (ใหม่ - รองรับหน่วยเวลา)
function setTimerWithUnit(deviceId, relayId, action) {
  const inputElement = document.getElementById(`timer-input-${deviceId}-${relayId}`);
  const unitElement = document.getElementById(`timer-unit-${deviceId}-${relayId}`);
  
  // ตรวจสอบว่า duration เป็นตัวเลขหรือไม่
  let duration = parseInt(inputElement.value);
  if (isNaN(duration) || duration <= 0) {
    alert("กรุณาระบุระยะเวลาเป็นตัวเลขที่มากกว่า 0");
    return;
  }
  
  // คำนวณระยะเวลาตามหน่วย (วินาที, นาที, ชั่วโมง)
  const unitMultiplier = parseInt(unitElement.value);
  duration = duration * unitMultiplier;
  
  // เรียกใช้ฟังก์ชันตั้งเวลาเดิม
  setTimer(deviceId, relayId, action, duration);
}

// ฟังก์ชันตั้งเวลาสำหรับรีเลย์
function setTimer(deviceId, relayId, action, duration) {
  // ตรวจสอบว่า duration เป็นตัวเลขหรือไม่
  duration = parseInt(duration);
  if (isNaN(duration) || duration <= 0) {
    alert("กรุณาระบุระยะเวลาเป็นตัวเลขที่มากกว่า 0");
    return;
  }
  
  // สร้าง timer key
  const timerKey = `${deviceId}-${relayId}-${Date.now()}`;
  const scheduleKey = `${deviceId}-${relayId}`;
  
  // อัปเดต UI
  const timerElement = document.getElementById(`timer-${deviceId}-${relayId}`);
  const endTime = new Date(Date.now() + duration * 1000);
  
  // สร้างข้อมูลตารางเวลา
  if (!schedules[scheduleKey]) {
    schedules[scheduleKey] = [];
  }
  
  // เพิ่มรายการตั้งเวลาใหม่
  const scheduleItem = {
    id: timerKey,
    action: action,
    endTime: endTime,
    duration: duration
  };
  
  schedules[scheduleKey].push(scheduleItem);
  
  // อัปเดตตารางการตั้งเวลา
  updateScheduleTable(deviceId, relayId);
  
  // เริ่มการนับถอยหลัง
  timers[timerKey] = {
    deviceId: deviceId,
    relayId: relayId,
    action: action,
    endTime: endTime,
    interval: setInterval(() => {
      const now = new Date();
      const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
      
      if (timeLeft <= 0) {
        // เมื่อหมดเวลา
        clearInterval(timers[timerKey].interval);
        
        // ลบรายการตั้งเวลาออกจากตาราง
        removeScheduleItem(deviceId, relayId, timerKey);
        
        // ส่งคำสั่งควบคุมรีเลย์
        controlRelay(deviceId, relayId, action);
        
        // ลบ timer
        delete timers[timerKey];
        
        // อัปเดต UI ถ้าไม่มีการตั้งเวลาเหลืออยู่
        if (schedules[scheduleKey].length === 0) {
          timerElement.textContent = "ไม่มีการตั้งเวลา";
        }
      } else {
        // อัปเดต UI แสดงเวลาที่เหลือ
        updateTimerDisplay(deviceId, relayId);
      }
    }, 1000)
  };
  
  // ส่งคำสั่งตั้งเวลาผ่าน MQTT (สำหรับ ESP32 ที่รองรับการตั้งเวลาในตัว)
  if (typeof client !== 'undefined') {
    const topic = `esp32/${deviceId}/relay/${relayId}/timer/set`;
    const payload = JSON.stringify({ action: action, duration: duration });
    
    client.publish(topic, payload, { qos: 0 }, (err) => {
      if (err) {
        console.error(`ไม่สามารถส่งคำสั่งตั้งเวลาไปยัง ESP32 ${deviceId} รีเลย์ ${relayId}: ${err}`);
      } else {
        console.log(`ตั้งเวลา ESP32 ${deviceId} รีเลย์ ${relayId}: ${action} ใน ${duration} วินาที`);
      }
    });
  }
}

// ฟังก์ชันยกเลิกการตั้งเวลาเฉพาะรายการ
function cancelTimerItem(deviceId, relayId, timerId) {
  if (timers[timerId]) {
    clearInterval(timers[timerId].interval);
    delete timers[timerId];
    
    // ลบรายการตั้งเวลาออกจากตาราง
    removeScheduleItem(deviceId, relayId, timerId);
    
    // อัปเดต UI
    updateTimerDisplay(deviceId, relayId);
    
    // ส่งคำสั่งยกเลิกการตั้งเวลาผ่าน MQTT
    if (typeof client !== 'undefined') {
      const topic = `esp32/${deviceId}/relay/${relayId}/timer/cancel`;
      client.publish(topic, "", { qos: 0 });
    }
  }
}

// ฟังก์ชันยกเลิกการตั้งเวลาทั้งหมดของรีเลย์
function cancelTimer(deviceId, relayId) {
  const scheduleKey = `${deviceId}-${relayId}`;
  
  if (schedules[scheduleKey] && schedules[scheduleKey].length > 0) {
    // ยกเลิกทุก timer
    schedules[scheduleKey].forEach(item => {
      if (timers[item.id]) {
        clearInterval(timers[item.id].interval);
        delete timers[item.id];
      }
    });
    
    // ล้างรายการตั้งเวลา
    schedules[scheduleKey] = [];
    
    // อัปเดตตารางการตั้งเวลา
    updateScheduleTable(deviceId, relayId);
    
    // อัปเดต UI
    const timerElement = document.getElementById(`timer-${deviceId}-${relayId}`);
    timerElement.textContent = "ไม่มีการตั้งเวลา";
    
    // ส่งคำสั่งยกเลิกการตั้งเวลาผ่าน MQTT
    if (typeof client !== 'undefined') {
      const topic = `esp32/${deviceId}/relay/${relayId}/timer/cancel`;
      client.publish(topic, "", { qos: 0 });
    }
  }
}

// ฟังก์ชันลบรายการตั้งเวลาออกจากตาราง
function removeScheduleItem(deviceId, relayId, timerId) {
  const scheduleKey = `${deviceId}-${relayId}`;
  
  if (schedules[scheduleKey]) {
    schedules[scheduleKey] = schedules[scheduleKey].filter(item => item.id !== timerId);
    updateScheduleTable(deviceId, relayId);
  }
}

// ฟังก์ชันอัปเดตการแสดงผลเวลาที่เหลือ
function updateTimerDisplay(deviceId, relayId) {
  const scheduleKey = `${deviceId}-${relayId}`;
  const timerElement = document.getElementById(`timer-${deviceId}-${relayId}`);
  
  if (schedules[scheduleKey] && schedules[scheduleKey].length > 0) {
    // หาเวลาที่ใกล้จะถึงที่สุด
    let nextTimer = schedules[scheduleKey].reduce((closest, current) => {
      const now = new Date();
      const currentTimeLeft = Math.max(0, Math.floor((current.endTime - now) / 1000));
      const closestTimeLeft = closest ? Math.max(0, Math.floor((closest.endTime - now) / 1000)) : Infinity;
      
      return currentTimeLeft < closestTimeLeft ? current : closest;
    }, null);
    
    if (nextTimer) {
      const now = new Date();
      const timeLeft = Math.max(0, Math.floor((nextTimer.endTime - now) / 1000));
      
      // แสดงเวลาในรูปแบบ ชั่วโมง:นาที:วินาที
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      const seconds = timeLeft % 60;
      
      let timeString = '';
      if (hours > 0) {
        timeString += `${hours}:`;
      }
      timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      timerElement.textContent = `${nextTimer.action === 'on' ? 'เปิด' : 'ปิด'} ใน ${timeString}`;
    } else {
      timerElement.textContent = "ไม่มีการตั้งเวลา";
    }
  } else {
    timerElement.textContent = "ไม่มีการตั้งเวลา";
  }
}

// ฟังก์ชันอัปเดตตารางการตั้งเวลา
function updateScheduleTable(deviceId, relayId) {
  const scheduleKey = `${deviceId}-${relayId}`;
  const tableBody = document.querySelector(`#schedule-table-${deviceId}-${relayId} tbody`);
  
  if (!tableBody) return;
  
  // ล้างข้อมูลเดิม
  tableBody.innerHTML = '';
  
  // ถ้าไม่มีรายการตั้งเวลา
  if (!schedules[scheduleKey] || schedules[scheduleKey].length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="3">ไม่มีการตั้งเวลา</td>`;
    tableBody.appendChild(row);
    return;
  }
  
  // เรียงลำดับตามเวลาที่เหลือ (น้อยไปมาก)
  const sortedSchedules = [...schedules[scheduleKey]].sort((a, b) => {
    const now = new Date();
    const timeLeftA = Math.max(0, Math.floor((a.endTime - now) / 1000));
    const timeLeftB = Math.max(0, Math.floor((b.endTime - now) / 1000));
    return timeLeftA - timeLeftB;
  });
  
  // เพิ่มข้อมูลใหม่
  sortedSchedules.forEach(item => {
    const now = new Date();
    const timeLeft = Math.max(0, Math.floor((item.endTime - now) / 1000));
    
    // แสดงเวลาในรูปแบบ ชั่วโมง:นาที:วินาที
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;
    
    let timeString = '';
    if (hours > 0) {
      timeString += `${hours}:`;
    }
    timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.action === 'on' ? 'เปิด' : 'ปิด'}</td>
      <td>${timeString}</td>
      <td><button class="btn-cancel" onclick="cancelTimerItem(${deviceId}, ${relayId}, '${item.id}')">ยกเลิก</button></td>
    `;
    tableBody.appendChild(row);
  });
}

// ฟังก์ชันอัปเดตข้อมูลเซ็นเซอร์
function updateSensorData(deviceId, sensorType, value) {
  if (!sensorData[deviceId]) return;
  
  // อัปเดตข้อมูลในตัวแปร
  switch (sensorType) {
    case 'water_flow':
      sensorData[deviceId].water_flow_rate = parseFloat(value);
      break;
    case 'soil_moisture':
      // แปลงค่า ADC (0-4095) เป็นเปอร์เซ็นต์ (0-100)
      sensorData[deviceId].soil_moisture = Math.round((1 - (parseInt(value) / 4095)) * 100);
      break;
    case 'temperature':
      sensorData[deviceId].temperature = parseFloat(value);
      break;
    case 'water_level':
      // แปลงค่า ADC (0-4095) เป็นเปอร์เซ็นต์ (0-100)
      sensorData[deviceId].water_level = Math.round((parseInt(value) / 4095) * 100);
      break;
    case 'light':
      // แปลงค่า ADC (0-4095) เป็นเปอร์เซ็นต์ (0-100)
      sensorData[deviceId].light_level = Math.round((parseInt(value) / 4095) * 100);
      break;
  }
  
  sensorData[deviceId].last_update = new Date();
  
  // อัปเดต UI
  updateSensorUI(deviceId);
}

// ฟังก์ชันอัปเดต UI ของเซ็นเซอร์
function updateSensorUI(deviceId) {
  const data = sensorData[deviceId];
  if (!data) return;
  
  // อัปเดตค่าในแต่ละเซ็นเซอร์
  const waterFlowElement = document.getElementById(`water-flow-${deviceId}`);
  if (waterFlowElement) {
    waterFlowElement.textContent = data.water_flow_rate.toFixed(2);
  }
  
  const soilMoistureElement = document.getElementById(`soil-moisture-${deviceId}`);
  if (soilMoistureElement) {
    soilMoistureElement.textContent = data.soil_moisture;
  }
  
  const temperatureElement = document.getElementById(`temperature-${deviceId}`);
  if (temperatureElement) {
    temperatureElement.textContent = data.temperature.toFixed(1);
  }
  
  const waterLevelElement = document.getElementById(`water-level-${deviceId}`);
  if (waterLevelElement) {
    waterLevelElement.textContent = data.water_level;
  }
  
  const lightLevelElement = document.getElementById(`light-level-${deviceId}`);
  if (lightLevelElement) {
    lightLevelElement.textContent = data.light_level;
  }
}

// ฟังก์ชันอัปเดตสถานะการเชื่อมต่อของ ESP32
function updateDeviceConnectionStatus(deviceId, isOnline) {
  const statusElement = document.getElementById(`connection-status-${deviceId}`);
  if (!statusElement) return;
  
  if (isOnline) {
    statusElement.textContent = "ออนไลน์";
    statusElement.classList.add("status-online");
    statusElement.classList.remove("status-offline");
  } else {
    statusElement.textContent = "ออฟไลน์";
    statusElement.classList.add("status-offline");
    statusElement.classList.remove("status-online");
  }
  
  // อัปเดตสถานะในตัวแปร
  const deviceIndex = ESP32_DEVICES.findIndex(device => device.id === deviceId);
  if (deviceIndex !== -1) {
    ESP32_DEVICES[deviceIndex].online = isOnline;
  }
}

// ฟังก์ชันอัปเดตสถานะรีเลย์
function updateRelayStatus(deviceId, relayId, status) {
  const statusElement = document.getElementById(`status-${deviceId}-${relayId}`);
  if (!statusElement) return;
  
  if (status === 'on') {
    statusElement.textContent = "เปิด";
    statusElement.classList.add("status-on");
    statusElement.classList.remove("status-off");
  } else if (status === 'off') {
    statusElement.textContent = "ปิด";
    statusElement.classList.add("status-off");
    statusElement.classList.remove("status-on");
  }
}

// ตัวแปรสำหรับตรวจจับการ scroll
let isScrolling = false;
let scrollTimeout;

// รอให้ DOM โหลดเสร็จก่อนทำงาน
document.addEventListener('DOMContentLoaded', function() {
  // เพิ่มการทำงานของปุ่มแสดง/ซ่อนส่วนตั้งเวลา
  document.querySelectorAll('.toggle-timer').forEach(button => {
    button.addEventListener('click', function() {
      const deviceId = this.getAttribute('data-device');
      const relayId = this.getAttribute('data-relay');
      const timerControls = document.getElementById(`timer-controls-${deviceId}-${relayId}`);
      
      if (timerControls) {
        timerControls.classList.toggle('hidden');
      }
    });
  });
  
  // เชื่อมต่อ MQTT broker
  try {
    const MQTT_BROKER = "ws://broker.hivemq.com:8000/mqtt"; // ใช้ WebSocket สำหรับ browser
    window.client = mqtt.connect(MQTT_BROKER);

    // เมื่อเชื่อมต่อสำเร็จ
    client.on("connect", () => {
      console.log("Connected to MQTT broker");
      
      // Subscribe เพื่อรับสถานะจาก ESP32 ทุกตัว
      ESP32_DEVICES.forEach(device => {
        // Subscribe สถานะการเชื่อมต่อ
        client.subscribe(`esp32/${device.id}/connection`);
        
        // Subscribe สถานะรีเลย์ทุกตัว
        for (let relayId = 1; relayId <= device.relays; relayId++) {
          client.subscribe(`esp32/${device.id}/relay/${relayId}/status`);
          client.subscribe(`esp32/${device.id}/relay/${relayId}/timer/status`);
        }
        
        // Subscribe สถานะเซ็นเซอร์
        client.subscribe(`esp32/${device.id}/sensors`);
        client.subscribe(`esp32/${device.id}/sensor/water_flow`);
        client.subscribe(`esp32/${device.id}/sensor/soil_moisture`);
        client.subscribe(`esp32/${device.id}/sensor/temperature`);
        client.subscribe(`esp32/${device.id}/sensor/water_level`);
        client.subscribe(`esp32/${device.id}/sensor/light`);
      });
    });

    // รับข้อมูลจาก MQTT
    client.on("message", (topic, message) => {
      const topicParts = topic.split('/');
      
      // ตรวจสอบรูปแบบ topic
      if (topicParts[0] === 'esp32') {
        const deviceId = parseInt(topicParts[1]);
        
        // สถานะการเชื่อมต่อ
        if (topicParts[2] === 'connection') {
          const status = message.toString();
          updateDeviceConnectionStatus(deviceId, status === 'online');
        }
        // สถานะรีเลย์
        else if (topicParts[2] === 'relay' && topicParts[4] === 'status') {
          const relayId = parseInt(topicParts[3]);
          const status = message.toString();
          updateRelayStatus(deviceId, relayId, status);
        }
        // สถานะการตั้งเวลา
        else if (topicParts[2] === 'relay' && topicParts[4] === 'timer' && topicParts[5] === 'status') {
          const relayId = parseInt(topicParts[3]);
          try {
            const timerStatus = JSON.parse(message.toString());
            // อัปเดตสถานะการตั้งเวลา (ถ้าต้องการ)
          } catch (e) {
            console.error("ไม่สามารถแปลงข้อมูลการตั้งเวลา:", e);
          }
        }
        // ข้อมูลเซ็นเซอร์ (รวม)
        else if (topicParts[2] === 'sensors') {
          try {
            const sensorData = JSON.parse(message.toString());
            // อัปเดตข้อมูลเซ็นเซอร์ทั้งหมด
            updateSensorData(deviceId, 'water_flow', sensorData.water_flow_rate);
            updateSensorData(deviceId, 'soil_moisture', sensorData.soil_moisture);
            updateSensorData(deviceId, 'temperature', sensorData.temperature);
            updateSensorData(deviceId, 'water_level', sensorData.water_level);
            updateSensorData(deviceId, 'light', sensorData.light_level);
          } catch (e) {
            console.error("ไม่สามารถแปลงข้อมูลเซ็นเซอร์:", e);
          }
        }
        // ข้อมูลเซ็นเซอร์ (แยก)
        else if (topicParts[2] === 'sensor') {
          const sensorType = topicParts[3];
          const value = message.toString();
          updateSensorData(deviceId, sensorType, value);
        }
      }
    });
  } catch (e) {
    console.error("ไม่สามารถเชื่อมต่อ MQTT broker:", e);
  }
  
  // ตรวจจับการ scroll เพื่อซ่อน/แสดง nav
  window.addEventListener('scroll', function() {
    if (!isScrolling) {
      const nav = document.querySelector('nav');
      nav.classList.add('hide');
    }
    
    isScrolling = true;
    
    // ล้าง timeout เดิม
    clearTimeout(scrollTimeout);
    
    // ตั้ง timeout ใหม่
    scrollTimeout = setTimeout(function() {
      isScrolling = false;
      const nav = document.querySelector('nav');
      nav.classList.remove('hide');
    }, 1000);
  });
});

