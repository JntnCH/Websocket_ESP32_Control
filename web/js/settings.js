// ตัวแปรสำหรับเก็บการตั้งค่า
let currentSettings = {
  // ข้อมูล ESP32
  espDevices: [
    { id: 1, name: "ESP32 ตัวที่ 1", sensors: [] },
    { id: 2, name: "ESP32 ตัวที่ 2", sensors: [] },
    { id: 3, name: "ESP32 ตัวที่ 3", sensors: [] }
  ],
  // ข้อมูลเซ็นเซอร์เริ่มต้น
  defaultSensors: {
    1: [
      { id: 1, name: "อัตราการไหลของน้ำ", type: "water_flow", pin: 26, unit: "ลิตร/นาที" },
      { id: 2, name: "ความชื้นในดิน", type: "soil_moisture", pin: 32, unit: "%" },
      { id: 3, name: "อุณหภูมิ", type: "temperature", pin: 33, unit: "°C" },
      { id: 4, name: "ระดับน้ำ", type: "water_level", pin: 34, unit: "%" },
      { id: 5, name: "ระดับแสง", type: "light_level", pin: 35, unit: "%" }
    ],
    2: [
      { id: 1, name: "อัตราการไหลของน้ำ", type: "water_flow", pin: 26, unit: "ลิตร/นาที" },
      { id: 2, name: "ความชื้นในดิน", type: "soil_moisture", pin: 32, unit: "%" },
      { id: 3, name: "อุณหภูมิ", type: "temperature", pin: 33, unit: "°C" }
    ],
    3: [
      { id: 1, name: "ความชื้นในดิน", type: "soil_moisture", pin: 32, unit: "%" },
      { id: 2, name: "อุณหภูมิ", type: "temperature", pin: 33, unit: "°C" }
    ]
  },
  // ตั้งค่าการรดน้ำอัตโนมัติ
  irrigation: {
    1: { moistureThreshold: 30, wateringDuration: 5, wateringRelay: 1 },
    2: { moistureThreshold: 30, wateringDuration: 5, wateringRelay: 1 },
    3: { moistureThreshold: 30, wateringDuration: 5, wateringRelay: 1 }
  },
  // ตั้งค่าการให้ปุ๋ยอัตโนมัติ
  fertilizer: {
    1: { schedule: "weekly", time: "08:00", duration: 2, relay: 2 },
    2: { schedule: "weekly", time: "08:00", duration: 2, relay: 2 },
    3: { schedule: "weekly", time: "08:00", duration: 2, relay: 2 }
  },
  // ตั้งค่า Telegram
  telegram: {
    token: "",
    chatId: "",
    notifications: {
      watering: true,
      fertilizing: true,
      lowMoisture: true,
      lowWater: true,
      lowFertilizer: true
    }
  }
};

// ตัวแปรสำหรับเก็บ ESP32 ที่กำลังแก้ไข
let currentEspId = 1;

// ฟังก์ชันสำหรับโหลดการตั้งค่าจาก localStorage
function loadSettings() {
  const savedSettings = localStorage.getItem('esp32_settings');
  if (savedSettings) {
    try {
      currentSettings = JSON.parse(savedSettings);
      console.log("โหลดการตั้งค่าสำเร็จ:", currentSettings);
    } catch (e) {
      console.error("เกิดข้อผิดพลาดในการโหลดการตั้งค่า:", e);
    }
  } else {
    // ถ้าไม่มีการตั้งค่าที่บันทึกไว้ ให้ใช้ค่าเริ่มต้น
    // และคัดลอกเซ็นเซอร์เริ่มต้นไปยัง espDevices
    currentSettings.espDevices.forEach(device => {
      device.sensors = [...currentSettings.defaultSensors[device.id]];
    });
    console.log("ไม่พบการตั้งค่าที่บันทึกไว้ ใช้ค่าเริ่มต้น");
  }
}

// ฟังก์ชันสำหรับบันทึกการตั้งค่าลงใน localStorage
function saveSettings() {
  try {
    // อัปเดตการตั้งค่าการรดน้ำอัตโนมัติ
    currentSettings.irrigation[currentEspId] = {
      moistureThreshold: parseInt(document.getElementById('moisture-threshold').value),
      wateringDuration: parseInt(document.getElementById('watering-duration').value),
      wateringRelay: parseInt(document.getElementById('watering-relay').value)
    };

    // อัปเดตการตั้งค่าการให้ปุ๋ยอัตโนมัติ
    currentSettings.fertilizer[currentEspId] = {
      schedule: document.getElementById('fertilizer-schedule').value,
      time: document.getElementById('fertilizer-time').value,
      duration: parseInt(document.getElementById('fertilizer-duration').value),
      relay: parseInt(document.getElementById('fertilizer-relay').value)
    };

    // อัปเดตการตั้งค่า Telegram
    currentSettings.telegram = {
      token: document.getElementById('telegram-token').value,
      chatId: document.getElementById('telegram-chat-id').value,
      notifications: {
        watering: document.getElementById('notify-watering').checked,
        fertilizing: document.getElementById('notify-fertilizing').checked,
        lowMoisture: document.getElementById('notify-low-moisture').checked,
        lowWater: document.getElementById('notify-low-water').checked,
        lowFertilizer: document.getElementById('notify-low-fertilizer').checked
      }
    };

    // บันทึกลงใน localStorage
    localStorage.setItem('esp32_settings', JSON.stringify(currentSettings));
    alert("บันทึกการตั้งค่าเรียบร้อยแล้ว");
    console.log("บันทึกการตั้งค่าสำเร็จ:", currentSettings);
  } catch (e) {
    console.error("เกิดข้อผิดพลาดในการบันทึกการตั้งค่า:", e);
    alert("เกิดข้อผิดพลาดในการบันทึกการตั้งค่า: " + e.message);
  }
}

// ฟังก์ชันสำหรับรีเซ็ตการตั้งค่า
function resetSettings() {
  if (confirm("คุณแน่ใจหรือไม่ที่จะรีเซ็ตการตั้งค่าทั้งหมด?")) {
    localStorage.removeItem('esp32_settings');
    location.reload();
  }
}

// ฟังก์ชันสำหรับแสดงเซ็นเซอร์ที่ใช้งาน
function displayActiveSensors() {
  const sensorListElement = document.getElementById('active-sensors');
  sensorListElement.innerHTML = '';

  const espDevice = currentSettings.espDevices.find(device => device.id === currentEspId);
  if (!espDevice) return;

  if (espDevice.sensors.length === 0) {
    sensorListElement.innerHTML = '<div class="no-sensors">ไม่มีเซ็นเซอร์ที่ใช้งาน</div>';
    return;
  }

  espDevice.sensors.forEach(sensor => {
    const sensorItem = document.createElement('div');
    sensorItem.className = 'sensor-item';
    sensorItem.innerHTML = `
      <div class="sensor-info">
        <div class="sensor-name">${sensor.name}</div>
        <div class="sensor-type">ประเภท: ${getSensorTypeName(sensor.type)}</div>
        <div class="sensor-pin">พิน: ${sensor.pin}, หน่วย: ${sensor.unit}</div>
      </div>
      <div class="sensor-actions">
        <button class="edit-sensor" data-id="${sensor.id}">แก้ไข</button>
        <button class="remove-sensor" data-id="${sensor.id}">ลบ</button>
      </div>
    `;
    sensorListElement.appendChild(sensorItem);
  });

  // เพิ่ม event listener สำหรับปุ่มแก้ไขและลบ
  document.querySelectorAll('.edit-sensor').forEach(button => {
    button.addEventListener('click', function() {
      const sensorId = parseInt(this.getAttribute('data-id'));
      editSensor(sensorId);
    });
  });

  document.querySelectorAll('.remove-sensor').forEach(button => {
    button.addEventListener('click', function() {
      const sensorId = parseInt(this.getAttribute('data-id'));
      removeSensor(sensorId);
    });
  });
}

// ฟังก์ชันสำหรับแปลงประเภทเซ็นเซอร์เป็นชื่อภาษาไทย
function getSensorTypeName(type) {
  const typeMap = {
    'water_flow': 'อัตราการไหลของน้ำ',
    'soil_moisture': 'ความชื้นในดิน',
    'temperature': 'อุณหภูมิ',
    'water_level': 'ระดับน้ำ',
    'light_level': 'ระดับแสง',
    'ph': 'ค่า pH',
    'ec': 'ค่า EC (ความนำไฟฟ้า)',
    'nutrient_level': 'ระดับปุ๋ย'
  };
  return typeMap[type] || type;
}

// ฟังก์ชันสำหรับเพิ่มเซ็นเซอร์
function addSensor() {
  const sensorType = document.getElementById('sensor-type').value;
  const sensorName = document.getElementById('sensor-name').value;
  const sensorPin = parseInt(document.getElementById('sensor-pin').value);
  const sensorUnit = document.getElementById('sensor-unit').value;

  if (!sensorName || isNaN(sensorPin)) {
    alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  const espDevice = currentSettings.espDevices.find(device => device.id === currentEspId);
  if (!espDevice) return;

  // สร้าง ID ใหม่
  const newId = espDevice.sensors.length > 0 ? 
    Math.max(...espDevice.sensors.map(s => s.id)) + 1 : 1;

  // เพิ่มเซ็นเซอร์ใหม่
  const newSensor = {
    id: newId,
    name: sensorName,
    type: sensorType,
    pin: sensorPin,
    unit: sensorUnit || getDefaultUnit(sensorType)
  };

  espDevice.sensors.push(newSensor);
  
  // อัปเดตการแสดงผล
  displayActiveSensors();
  
  // รีเซ็ตฟอร์ม
  document.getElementById('sensor-name').value = '';
  document.getElementById('sensor-pin').value = '';
  document.getElementById('sensor-unit').value = '';
}

// ฟังก์ชันสำหรับแก้ไขเซ็นเซอร์
function editSensor(sensorId) {
  const espDevice = currentSettings.espDevices.find(device => device.id === currentEspId);
  if (!espDevice) return;

  const sensor = espDevice.sensors.find(s => s.id === sensorId);
  if (!sensor) return;

  // แสดงข้อมูลเซ็นเซอร์ในฟอร์ม
  document.getElementById('sensor-type').value = sensor.type;
  document.getElementById('sensor-name').value = sensor.name;
  document.getElementById('sensor-pin').value = sensor.pin;
  document.getElementById('sensor-unit').value = sensor.unit;

  // เปลี่ยนปุ่มเพิ่มเซ็นเซอร์เป็นปุ่มอัปเดต
  const addButton = document.getElementById('add-sensor');
  addButton.textContent = 'อัปเดตเซ็นเซอร์';
  addButton.onclick = function() {
    updateSensor(sensorId);
  };
}

// ฟังก์ชันสำหรับอัปเดตเซ็นเซอร์
function updateSensor(sensorId) {
  const sensorType = document.getElementById('sensor-type').value;
  const sensorName = document.getElementById('sensor-name').value;
  const sensorPin = parseInt(document.getElementById('sensor-pin').value);
  const sensorUnit = document.getElementById('sensor-unit').value;

  if (!sensorName || isNaN(sensorPin)) {
    alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  const espDevice = currentSettings.espDevices.find(device => device.id === currentEspId);
  if (!espDevice) return;

  const sensorIndex = espDevice.sensors.findIndex(s => s.id === sensorId);
  if (sensorIndex === -1) return;

  // อัปเดตข้อมูลเซ็นเซอร์
  espDevice.sensors[sensorIndex] = {
    id: sensorId,
    name: sensorName,
    type: sensorType,
    pin: sensorPin,
    unit: sensorUnit || getDefaultUnit(sensorType)
  };

  // อัปเดตการแสดงผล
  displayActiveSensors();

  // รีเซ็ตฟอร์มและปุ่ม
  document.getElementById('sensor-name').value = '';
  document.getElementById('sensor-pin').value = '';
  document.getElementById('sensor-unit').value = '';
  
  const addButton = document.getElementById('add-sensor');
  addButton.textContent = 'เพิ่มเซ็นเซอร์';
  addButton.onclick = addSensor;
}

// ฟังก์ชันสำหรับลบเซ็นเซอร์
function removeSensor(sensorId) {
  if (!confirm("คุณแน่ใจหรือไม่ที่จะลบเซ็นเซอร์นี้?")) return;

  const espDevice = currentSettings.espDevices.find(device => device.id === currentEspId);
  if (!espDevice) return;

  espDevice.sensors = espDevice.sensors.filter(s => s.id !== sensorId);
  
  // อัปเดตการแสดงผล
  displayActiveSensors();
}

// ฟังก์ชันสำหรับเปลี่ยน ESP32 ที่กำลังแก้ไข
function changeEsp() {
  currentEspId = parseInt(document.getElementById('esp-select').value);
  
  // อัปเดตการแสดงผลเซ็นเซอร์
  displayActiveSensors();
  
  // อัปเดตการแสดงผลการตั้งค่าการรดน้ำอัตโนมัติ
  const irrigation = currentSettings.irrigation[currentEspId];
  if (irrigation) {
    document.getElementById('moisture-threshold').value = irrigation.moistureThreshold;
    document.getElementById('watering-duration').value = irrigation.wateringDuration;
    document.getElementById('watering-relay').value = irrigation.wateringRelay;
  }
  
  // อัปเดตการแสดงผลการตั้งค่าการให้ปุ๋ยอัตโนมัติ
  const fertilizer = currentSettings.fertilizer[currentEspId];
  if (fertilizer) {
    document.getElementById('fertilizer-schedule').value = fertilizer.schedule;
    document.getElementById('fertilizer-time').value = fertilizer.time;
    document.getElementById('fertilizer-duration').value = fertilizer.duration;
    document.getElementById('fertilizer-relay').value = fertilizer.relay;
  }
}

// ฟังก์ชันสำหรับเพิ่ม ESP32 ใหม่
function addEsp() {
  const newId = currentSettings.espDevices.length > 0 ? 
    Math.max(...currentSettings.espDevices.map(d => d.id)) + 1 : 1;
  
  const newName = `ESP32 ตัวที่ ${newId}`;
  
  // เพิ่ม ESP32 ใหม่
  currentSettings.espDevices.push({
    id: newId,
    name: newName,
    sensors: []
  });
  
  // เพิ่มการตั้งค่าเริ่มต้นสำหรับการรดน้ำและให้ปุ๋ย
  currentSettings.irrigation[newId] = {
    moistureThreshold: 30,
    wateringDuration: 5,
    wateringRelay: 1
  };
  
  currentSettings.fertilizer[newId] = {
    schedule: "weekly",
    time: "08:00",
    duration: 2,
    relay: 2
  };
  
  // อัปเดตตัวเลือก ESP32
  updateEspSelect();
  
  // เลือก ESP32 ใหม่
  document.getElementById('esp-select').value = newId;
  changeEsp();
}

// ฟังก์ชันสำหรับอัปเดตตัวเลือก ESP32
function updateEspSelect() {
  const espSelect = document.getElementById('esp-select');
  espSelect.innerHTML = '';
  
  currentSettings.espDevices.forEach(device => {
    const option = document.createElement('option');
    option.value = device.id;
    option.textContent = device.name;
    espSelect.appendChild(option);
  });
}

// ฟังก์ชันสำหรับรับหน่วยเริ่มต้นตามประเภทเซ็นเซอร์
function getDefaultUnit(type) {
  const unitMap = {
    'water_flow': 'ลิตร/นาที',
    'soil_moisture': '%',
    'temperature': '°C',
    'water_level': '%',
    'light_level': '%',
    'ph': 'pH',
    'ec': 'mS/cm',
    'nutrient_level': 'ppm'
  };
  return unitMap[type] || '';
}

// เมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', function() {
  // โหลดการตั้งค่า
  loadSettings();
  
  // อัปเดตตัวเลือก ESP32
  updateEspSelect();
  
  // แสดงเซ็นเซอร์ที่ใช้งาน
  displayActiveSensors();
  
  // อัปเดตการแสดงผลการตั้งค่าการรดน้ำอัตโนมัติ
  const irrigation = currentSettings.irrigation[currentEspId];
  if (irrigation) {
    document.getElementById('moisture-threshold').value = irrigation.moistureThreshold;
    document.getElementById('watering-duration').value = irrigation.wateringDuration;
    document.getElementById('watering-relay').value = irrigation.wateringRelay;
  }
  
  // อัปเดตการแสดงผลการตั้งค่าการให้ปุ๋ยอัตโนมัติ
  const fertilizer = currentSettings.fertilizer[currentEspId];
  if (fertilizer) {
    document.getElementById('fertilizer-schedule').value = fertilizer.schedule;
    document.getElementById('fertilizer-time').value = fertilizer.time;
    document.getElementById('fertilizer-duration').value = fertilizer.duration;
    document.getElementById('fertilizer-relay').value = fertilizer.relay;
  }
  
  // อัปเดตการแสดงผลการตั้งค่า Telegram
  document.getElementById('telegram-token').value = currentSettings.telegram.token;
  document.getElementById('telegram-chat-id').value = currentSettings.telegram.chatId;
  document.getElementById('notify-watering').checked = currentSettings.telegram.notifications.watering;
  document.getElementById('notify-fertilizing').checked = currentSettings.telegram.notifications.fertilizing;
  document.getElementById('notify-low-moisture').checked = currentSettings.telegram.notifications.lowMoisture;
  document.getElementById('notify-low-water').checked = currentSettings.telegram.notifications.lowWater;
  document.getElementById('notify-low-fertilizer').checked = currentSettings.telegram.notifications.lowFertilizer;
  
  // เพิ่ม event listener
  document.getElementById('esp-select').addEventListener('change', changeEsp);
  document.getElementById('add-esp').addEventListener('click', addEsp);
  document.getElementById('add-sensor').addEventListener('click', addSensor);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('reset-settings').addEventListener('click', resetSettings);
});

