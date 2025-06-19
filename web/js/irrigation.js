// ฟังก์ชันสำหรับระบบรดน้ำ-ผสมปุ๋ย-ใส่ปุ๋ยอัตโนมัติ

// ตัวแปรสำหรับเก็บสถานะระบบอัตโนมัติ
let autoSystems = {
  1: {
    watering: {
      active: false,
      running: false,
      moistureThreshold: 30,
      wateringDuration: 5,
      wateringRelay: 1
    },
    fertilizer: {
      active: false,
      running: false,
      schedule: "weekly",
      time: "08:00",
      duration: 2,
      relay: 2,
      nextTime: null
    }
  },
  2: {
    watering: {
      active: false,
      running: false,
      moistureThreshold: 30,
      wateringDuration: 5,
      wateringRelay: 1
    },
    fertilizer: {
      active: false,
      running: false,
      schedule: "weekly",
      time: "08:00",
      duration: 2,
      relay: 2,
      nextTime: null
    }
  },
  3: {
    watering: {
      active: false,
      running: false,
      moistureThreshold: 30,
      wateringDuration: 5,
      wateringRelay: 1
    },
    fertilizer: {
      active: false,
      running: false,
      schedule: "weekly",
      time: "08:00",
      duration: 2,
      relay: 2,
      nextTime: null
    }
  }
};

// ตัวแปรสำหรับเก็บประวัติการทำงาน
let systemHistory = {
  1: [],
  2: [],
  3: []
};

// ฟังก์ชันสำหรับโหลดการตั้งค่าจาก localStorage
function loadAutoSystemSettings() {
  const savedSettings = localStorage.getItem('esp32_settings');
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      
      // โหลดการตั้งค่าระบบรดน้ำอัตโนมัติ
      for (const deviceId in settings.irrigation) {
        if (autoSystems[deviceId]) {
          autoSystems[deviceId].watering.moistureThreshold = settings.irrigation[deviceId].moistureThreshold;
          autoSystems[deviceId].watering.wateringDuration = settings.irrigation[deviceId].wateringDuration;
          autoSystems[deviceId].watering.wateringRelay = settings.irrigation[deviceId].wateringRelay;
        }
      }
      
      // โหลดการตั้งค่าระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติ
      for (const deviceId in settings.fertilizer) {
        if (autoSystems[deviceId]) {
          autoSystems[deviceId].fertilizer.schedule = settings.fertilizer[deviceId].schedule;
          autoSystems[deviceId].fertilizer.time = settings.fertilizer[deviceId].time;
          autoSystems[deviceId].fertilizer.duration = settings.fertilizer[deviceId].duration;
          autoSystems[deviceId].fertilizer.relay = settings.fertilizer[deviceId].relay;
          
          // คำนวณเวลาให้ปุ๋ยครั้งถัดไป
          calculateNextFertilizerTime(deviceId);
        }
      }
      
      // อัปเดตการแสดงผล
      updateAutoSystemDisplay();
      
      console.log("โหลดการตั้งค่าระบบอัตโนมัติสำเร็จ");
    } catch (e) {
      console.error("เกิดข้อผิดพลาดในการโหลดการตั้งค่าระบบอัตโนมัติ:", e);
    }
  }
}

// ฟังก์ชันสำหรับอัปเดตการแสดงผลระบบอัตโนมัติ
function updateAutoSystemDisplay() {
  for (const deviceId in autoSystems) {
    // อัปเดตการแสดงผลระบบรดน้ำอัตโนมัติ
    const watering = autoSystems[deviceId].watering;
    const wateringStatusElement = document.getElementById(`auto-watering-status-${deviceId}`);
    const minMoistureElement = document.getElementById(`min-soil-moisture-${deviceId}`);
    const wateringDurationElement = document.getElementById(`watering-duration-${deviceId}`);
    const autoWateringToggleElement = document.getElementById(`auto-watering-toggle-${deviceId}`);
    
    if (wateringStatusElement) {
      wateringStatusElement.textContent = watering.active ? (watering.running ? "กำลังรดน้ำ" : "เปิด") : "ปิด";
      wateringStatusElement.className = `status-value ${watering.active ? "status-on" : "status-off"}`;
    }
    
    if (minMoistureElement) {
      minMoistureElement.textContent = `${watering.moistureThreshold}%`;
    }
    
    if (wateringDurationElement) {
      wateringDurationElement.textContent = `${watering.wateringDuration} นาที`;
    }
    
    if (autoWateringToggleElement) {
      autoWateringToggleElement.textContent = watering.active ? "ปิดระบบอัตโนมัติ" : "เปิดระบบอัตโนมัติ";
      autoWateringToggleElement.className = watering.active ? "btn-auto active" : "btn-auto";
    }
    
    // อัปเดตการแสดงผลระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติ
    const fertilizer = autoSystems[deviceId].fertilizer;
    const fertilizerStatusElement = document.getElementById(`auto-fertilizer-status-${deviceId}`);
    const fertilizerScheduleElement = document.getElementById(`fertilizer-schedule-${deviceId}`);
    const fertilizerTimeElement = document.getElementById(`fertilizer-time-${deviceId}`);
    const nextFertilizerTimeElement = document.getElementById(`next-fertilizer-time-${deviceId}`);
    const autoFertilizerToggleElement = document.getElementById(`auto-fertilizer-toggle-${deviceId}`);
    
    if (fertilizerStatusElement) {
      fertilizerStatusElement.textContent = fertilizer.active ? (fertilizer.running ? "กำลังให้ปุ๋ย" : "เปิด") : "ปิด";
      fertilizerStatusElement.className = `status-value ${fertilizer.active ? "status-on" : "status-off"}`;
    }
    
    if (fertilizerScheduleElement) {
      fertilizerScheduleElement.textContent = getScheduleText(fertilizer.schedule);
    }
    
    if (fertilizerTimeElement) {
      fertilizerTimeElement.textContent = fertilizer.time;
    }
    
    if (nextFertilizerTimeElement && fertilizer.nextTime) {
      nextFertilizerTimeElement.textContent = formatDate(fertilizer.nextTime);
    }
    
    if (autoFertilizerToggleElement) {
      autoFertilizerToggleElement.textContent = fertilizer.active ? "ปิดระบบอัตโนมัติ" : "เปิดระบบอัตโนมัติ";
      autoFertilizerToggleElement.className = fertilizer.active ? "btn-auto active" : "btn-auto";
    }
    
    // อัปเดตการแสดงผลความชื้นในดินปัจจุบัน
    const currentMoistureElement = document.getElementById(`current-soil-moisture-${deviceId}`);
    const soilMoistureElement = document.getElementById(`soil-moisture-${deviceId}`);
    
    if (currentMoistureElement && soilMoistureElement) {
      currentMoistureElement.textContent = `${soilMoistureElement.textContent}`;
    }
    
    // อัปเดตประวัติการทำงาน
    updateHistoryDisplay(deviceId);
  }
}

// ฟังก์ชันสำหรับเปิด/ปิดระบบรดน้ำอัตโนมัติ
function toggleAutoWatering(deviceId) {
  const watering = autoSystems[deviceId].watering;
  watering.active = !watering.active;
  
  // บันทึกประวัติการทำงาน
  addHistory(deviceId, `${watering.active ? "เปิด" : "ปิด"}ระบบรดน้ำอัตโนมัติ`);
  
  // อัปเดตการแสดงผล
  updateAutoSystemDisplay();
  
  // ส่งคำสั่งไปยัง ESP32
  if (watering.active) {
    // เริ่มตรวจสอบความชื้นในดิน
    checkSoilMoisture(deviceId);
  } else if (watering.running) {
    // หยุดรดน้ำถ้ากำลังรดน้ำอยู่
    stopWatering(deviceId);
  }
  
  // ส่งข้อมูลผ่าน MQTT
  publishAutoSystemStatus(deviceId);
}

// ฟังก์ชันสำหรับเปิด/ปิดระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติ
function toggleAutoFertilizer(deviceId) {
  const fertilizer = autoSystems[deviceId].fertilizer;
  fertilizer.active = !fertilizer.active;
  
  // บันทึกประวัติการทำงาน
  addHistory(deviceId, `${fertilizer.active ? "เปิด" : "ปิด"}ระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติ`);
  
  // อัปเดตการแสดงผล
  updateAutoSystemDisplay();
  
  // คำนวณเวลาให้ปุ๋ยครั้งถัดไป
  if (fertilizer.active) {
    calculateNextFertilizerTime(deviceId);
  } else if (fertilizer.running) {
    // หยุดให้ปุ๋ยถ้ากำลังให้ปุ๋ยอยู่
    stopFertilizing(deviceId);
  }
  
  // ส่งข้อมูลผ่าน MQTT
  publishAutoSystemStatus(deviceId);
}

// ฟังก์ชันสำหรับตรวจสอบความชื้นในดิน
function checkSoilMoisture(deviceId) {
  const watering = autoSystems[deviceId].watering;
  
  // ถ้าระบบรดน้ำอัตโนมัติไม่ได้เปิดอยู่ ให้หยุดการตรวจสอบ
  if (!watering.active) return;
  
  // อ่านค่าความชื้นในดินปัจจุบัน
  const soilMoistureElement = document.getElementById(`soil-moisture-${deviceId}`);
  if (!soilMoistureElement) return;
  
  const currentMoisture = parseInt(soilMoistureElement.textContent);
  
  // ถ้าความชื้นในดินต่ำกว่าค่าที่กำหนด ให้เริ่มรดน้ำ
  if (currentMoisture < watering.moistureThreshold && !watering.running) {
    startWatering(deviceId);
  }
  
  // ตรวจสอบทุก 1 นาที
  setTimeout(() => checkSoilMoisture(deviceId), 60000);
}

// ฟังก์ชันสำหรับเริ่มรดน้ำ
function startWatering(deviceId) {
  const watering = autoSystems[deviceId].watering;
  
  // เปิดรีเลย์ที่ควบคุมปั๊มน้ำ
  controlRelay(deviceId, watering.wateringRelay, 'on');
  
  // อัปเดตสถานะ
  watering.running = true;
  
  // บันทึกประวัติการทำงาน
  const soilMoistureElement = document.getElementById(`soil-moisture-${deviceId}`);
  const currentMoisture = soilMoistureElement ? soilMoistureElement.textContent : "0";
  addHistory(deviceId, `เริ่มรดน้ำอัตโนมัติ (ความชื้นในดิน ${currentMoisture})`);
  
  // อัปเดตการแสดงผล
  updateAutoSystemDisplay();
  
  // ส่งข้อมูลผ่าน MQTT
  publishAutoSystemStatus(deviceId);
  
  // ตั้งเวลาหยุดรดน้ำ
  setTimeout(() => stopWatering(deviceId), watering.wateringDuration * 60000);
}

// ฟังก์ชันสำหรับหยุดรดน้ำ
function stopWatering(deviceId) {
  const watering = autoSystems[deviceId].watering;
  
  // ปิดรีเลย์ที่ควบคุมปั๊มน้ำ
  controlRelay(deviceId, watering.wateringRelay, 'off');
  
  // อัปเดตสถานะ
  watering.running = false;
  
  // บันทึกประวัติการทำงาน
  addHistory(deviceId, `หยุดรดน้ำอัตโนมัติ`);
  
  // อัปเดตการแสดงผล
  updateAutoSystemDisplay();
  
  // ส่งข้อมูลผ่าน MQTT
  publishAutoSystemStatus(deviceId);
}

// ฟังก์ชันสำหรับคำนวณเวลาให้ปุ๋ยครั้งถัดไป
function calculateNextFertilizerTime(deviceId) {
  const fertilizer = autoSystems[deviceId].fertilizer;
  
  // แยกชั่วโมงและนาทีจากเวลาที่ตั้งไว้
  const [hours, minutes] = fertilizer.time.split(':').map(Number);
  
  // สร้างวันที่ปัจจุบัน
  const now = new Date();
  
  // สร้างวันที่สำหรับเวลาให้ปุ๋ยวันนี้
  let nextTime = new Date(now);
  nextTime.setHours(hours, minutes, 0, 0);
  
  // ถ้าเวลาให้ปุ๋ยวันนี้ผ่านไปแล้ว ให้เลื่อนไปวันถัดไปตามตารางที่กำหนด
  if (nextTime <= now) {
    switch (fertilizer.schedule) {
      case 'daily':
        // ทุกวัน - เลื่อนไป 1 วัน
        nextTime.setDate(nextTime.getDate() + 1);
        break;
      case 'weekly':
        // ทุกสัปดาห์ - เลื่อนไป 7 วัน
        nextTime.setDate(nextTime.getDate() + 7);
        break;
      case 'biweekly':
        // ทุก 2 สัปดาห์ - เลื่อนไป 14 วัน
        nextTime.setDate(nextTime.getDate() + 14);
        break;
      case 'monthly':
        // ทุกเดือน - เลื่อนไป 1 เดือน
        nextTime.setMonth(nextTime.getMonth() + 1);
        break;
    }
  }
  
  // บันทึกเวลาให้ปุ๋ยครั้งถัดไป
  fertilizer.nextTime = nextTime;
  
  // ตั้งเวลาให้ปุ๋ยอัตโนมัติ
  if (fertilizer.active) {
    const timeUntilNext = nextTime - now;
    setTimeout(() => startFertilizing(deviceId), timeUntilNext);
  }
  
  // อัปเดตการแสดงผล
  updateAutoSystemDisplay();
}

// ฟังก์ชันสำหรับเริ่มให้ปุ๋ย
function startFertilizing(deviceId) {
  const fertilizer = autoSystems[deviceId].fertilizer;
  
  // ถ้าระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติไม่ได้เปิดอยู่ ให้หยุดการให้ปุ๋ย
  if (!fertilizer.active) return;
  
  // เปิดรีเลย์ที่ควบคุมปั๊มปุ๋ย
  controlRelay(deviceId, fertilizer.relay, 'on');
  
  // อัปเดตสถานะ
  fertilizer.running = true;
  
  // บันทึกประวัติการทำงาน
  addHistory(deviceId, `เริ่มให้ปุ๋ยอัตโนมัติ`);
  
  // อัปเดตการแสดงผล
  updateAutoSystemDisplay();
  
  // ส่งข้อมูลผ่าน MQTT
  publishAutoSystemStatus(deviceId);
  
  // ตั้งเวลาหยุดให้ปุ๋ย
  setTimeout(() => stopFertilizing(deviceId), fertilizer.duration * 60000);
}

// ฟังก์ชันสำหรับหยุดให้ปุ๋ย
function stopFertilizing(deviceId) {
  const fertilizer = autoSystems[deviceId].fertilizer;
  
  // ปิดรีเลย์ที่ควบคุมปั๊มปุ๋ย
  controlRelay(deviceId, fertilizer.relay, 'off');
  
  // อัปเดตสถานะ
  fertilizer.running = false;
  
  // บันทึกประวัติการทำงาน
  addHistory(deviceId, `หยุดให้ปุ๋ยอัตโนมัติ`);
  
  // คำนวณเวลาให้ปุ๋ยครั้งถัดไป
  calculateNextFertilizerTime(deviceId);
  
  // อัปเดตการแสดงผล
  updateAutoSystemDisplay();
  
  // ส่งข้อมูลผ่าน MQTT
  publishAutoSystemStatus(deviceId);
}

// ฟังก์ชันสำหรับบันทึกประวัติการทำงาน
function addHistory(deviceId, event) {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // เพิ่มประวัติใหม่ไว้ที่ต้นรายการ
  systemHistory[deviceId].unshift({
    time: time,
    event: event
  });
  
  // จำกัดจำนวนประวัติไม่เกิน 20 รายการ
  if (systemHistory[deviceId].length > 20) {
    systemHistory[deviceId] = systemHistory[deviceId].slice(0, 20);
  }
  
  // อัปเดตการแสดงผลประวัติ
  updateHistoryDisplay(deviceId);
}

// ฟังก์ชันสำหรับอัปเดตการแสดงผลประวัติ
function updateHistoryDisplay(deviceId) {
  const historyListElement = document.getElementById(`history-list-${deviceId}`);
  if (!historyListElement) return;
  
  // ล้างรายการประวัติเดิม
  historyListElement.innerHTML = '';
  
  // เพิ่มรายการประวัติใหม่
  systemHistory[deviceId].forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
      <span class="history-time">${item.time}</span>
      <span class="history-event">${item.event}</span>
    `;
    historyListElement.appendChild(historyItem);
  });
}

// ฟังก์ชันสำหรับส่งข้อมูลสถานะระบบอัตโนมัติผ่าน MQTT
function publishAutoSystemStatus(deviceId) {
  if (!client || !client.connected) return;
  
  const watering = autoSystems[deviceId].watering;
  const fertilizer = autoSystems[deviceId].fertilizer;
  
  // สร้างข้อมูลสถานะระบบอัตโนมัติ
  const status = {
    watering: {
      active: watering.active,
      running: watering.running,
      moistureThreshold: watering.moistureThreshold,
      wateringDuration: watering.wateringDuration,
      wateringRelay: watering.wateringRelay
    },
    fertilizer: {
      active: fertilizer.active,
      running: fertilizer.running,
      schedule: fertilizer.schedule,
      time: fertilizer.time,
      duration: fertilizer.duration,
      relay: fertilizer.relay,
      nextTime: fertilizer.nextTime ? fertilizer.nextTime.toISOString() : null
    }
  };
  
  // ส่งข้อมูลผ่าน MQTT
  client.publish(`esp32/${deviceId}/auto_system`, JSON.stringify(status));
}

// ฟังก์ชันสำหรับรับข้อมูลสถานะระบบอัตโนมัติจาก MQTT
function handleAutoSystemStatus(deviceId, message) {
  try {
    const status = JSON.parse(message);
    
    // อัปเดตสถานะระบบรดน้ำอัตโนมัติ
    if (status.watering) {
      autoSystems[deviceId].watering.active = status.watering.active;
      autoSystems[deviceId].watering.running = status.watering.running;
    }
    
    // อัปเดตสถานะระบบผสมปุ๋ยและใส่ปุ๋ยอัตโนมัติ
    if (status.fertilizer) {
      autoSystems[deviceId].fertilizer.active = status.fertilizer.active;
      autoSystems[deviceId].fertilizer.running = status.fertilizer.running;
      if (status.fertilizer.nextTime) {
        autoSystems[deviceId].fertilizer.nextTime = new Date(status.fertilizer.nextTime);
      }
    }
    
    // อัปเดตการแสดงผล
    updateAutoSystemDisplay();
  } catch (e) {
    console.error(`เกิดข้อผิดพลาดในการประมวลผลข้อมูลสถานะระบบอัตโนมัติ:`, e);
  }
}

// ฟังก์ชันสำหรับแปลงตารางการให้ปุ๋ยเป็นข้อความภาษาไทย
function getScheduleText(schedule) {
  switch (schedule) {
    case 'daily':
      return 'ทุกวัน';
    case 'weekly':
      return 'ทุกสัปดาห์';
    case 'biweekly':
      return 'ทุก 2 สัปดาห์';
    case 'monthly':
      return 'ทุกเดือน';
    default:
      return schedule;
  }
}

// ฟังก์ชันสำหรับแปลงวันที่เป็นข้อความ
function formatDate(date) {
  if (!date) return '-';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// เพิ่ม event listener สำหรับโหลดการตั้งค่าเมื่อ DOM พร้อมใช้งาน
document.addEventListener('DOMContentLoaded', function() {
  // โหลดการตั้งค่าระบบอัตโนมัติ
  loadAutoSystemSettings();
  
  // เพิ่ม MQTT subscription สำหรับระบบอัตโนมัติ
  if (client) {
    client.subscribe('esp32/+/auto_system');
  }
});

