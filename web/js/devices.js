// ตัวแปรสำหรับเก็บข้อมูลอุปกรณ์
let devices = {};

// ฟังก์ชันที่ทำงานเมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', function() {
  // เริ่มต้นการเชื่อมต่อ MQTT
  initMQTT();
  
  // เพิ่ม event listener สำหรับปุ่มเมนูของอุปกรณ์
  document.querySelectorAll('.device-menu-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const menu = this.nextElementSibling;
      menu.classList.toggle('active');
    });
  });
  
  // เพิ่ม event listener สำหรับการคลิกนอกเมนู
  document.addEventListener('click', function() {
    document.querySelectorAll('.device-menu.active').forEach(menu => {
      menu.classList.remove('active');
    });
  });
  
  // เพิ่ม event listener สำหรับปุ่มแท็บ
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      const deviceId = tabId.split('-')[1];
      
      // ลบคลาส active จากปุ่มแท็บทั้งหมดในอุปกรณ์นี้
      this.parentElement.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
      });
      
      // เพิ่มคลาส active ให้กับปุ่มที่คลิก
      this.classList.add('active');
      
      // ซ่อนแท็บทั้งหมดในอุปกรณ์นี้
      document.querySelectorAll(`.tab-pane[id$="-${deviceId}"]`).forEach(tab => {
        tab.classList.remove('active');
      });
      
      // แสดงแท็บที่เลือก
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // เพิ่ม event listener สำหรับปุ่มเพิ่มอุปกรณ์
  document.getElementById('add-device').addEventListener('click', function() {
    document.getElementById('add-device-dialog').classList.add('active');
  });
  
  // เพิ่ม event listener สำหรับปุ่มปิดไดอะล็อก
  document.querySelectorAll('.dialog-close').forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.dialog').classList.remove('active');
    });
  });
  
  // เพิ่ม event listener สำหรับปุ่มยืนยันการเพิ่มอุปกรณ์
  document.getElementById('add-device-confirm').addEventListener('click', function() {
    const name = document.getElementById('new-device-name').value;
    const ip = document.getElementById('new-device-ip').value;
    const mac = document.getElementById('new-device-mac').value;
    const location = document.getElementById('new-device-location').value;
    
    if (name && ip && mac) {
      addDevice(name, ip, mac, location);
      document.getElementById('add-device-dialog').classList.remove('active');
      
      // รีเซ็ตฟอร์ม
      document.getElementById('new-device-name').value = '';
      document.getElementById('new-device-ip').value = '';
      document.getElementById('new-device-mac').value = '';
      document.getElementById('new-device-location').value = '';
    } else {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
  });
  
  // สร้างกราฟสำหรับเซ็นเซอร์
  createSensorCharts();
});

// ฟังก์ชันเริ่มต้นการเชื่อมต่อ MQTT
function initMQTT() {
  // เชื่อมต่อกับ MQTT Broker
  const clientId = 'web_client_' + Math.random().toString(16).substr(2, 8);
  const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
    clientId: clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
  });
  
  client.on('connect', function() {
    console.log('เชื่อมต่อ MQTT สำเร็จ');
    
    // สมัครสมาชิกทุกหัวข้อของ ESP32
    client.subscribe('esp32/+/status');
    client.subscribe('esp32/+/relay/+/status');
    client.subscribe('esp32/+/sensor/+/value');
  });
  
  client.on('message', function(topic, message) {
    console.log('ได้รับข้อความ:', topic, message.toString());
    
    // แยกหัวข้อเป็นส่วนๆ
    const parts = topic.split('/');
    
    if (parts.length >= 3) {
      const deviceId = parts[1];
      
      // ตรวจสอบประเภทของข้อความ
      if (parts[2] === 'status') {
        // อัปเดตสถานะของอุปกรณ์
        updateDeviceStatus(deviceId, message.toString());
      } else if (parts[2] === 'relay' && parts.length >= 5 && parts[4] === 'status') {
        // อัปเดตสถานะของรีเลย์
        const relayId = parts[3];
        updateRelayStatus(deviceId, relayId, message.toString());
      } else if (parts[2] === 'sensor' && parts.length >= 5 && parts[4] === 'value') {
        // อัปเดตค่าของเซ็นเซอร์
        const sensorId = parts[3];
        updateSensorValue(deviceId, sensorId, message.toString());
      }
    }
  });
  
  // เก็บ client ไว้ใช้งานต่อ
  window.mqttClient = client;
}

// ฟังก์ชันอัปเดตสถานะของอุปกรณ์
function updateDeviceStatus(deviceId, status) {
  const deviceCard = document.querySelector(`.device-card[data-device-id="${deviceId}"]`);
  
  if (deviceCard) {
    const statusElement = deviceCard.querySelector('.device-status');
    
    if (status === 'online') {
      statusElement.classList.remove('offline');
      statusElement.classList.add('online');
      statusElement.querySelector('span').textContent = 'ออนไลน์';
      
      // เปิดใช้งานปุ่มต่างๆ
      deviceCard.querySelectorAll('button:disabled').forEach(btn => {
        btn.disabled = false;
      });
    } else {
      statusElement.classList.remove('online');
      statusElement.classList.add('offline');
      statusElement.querySelector('span').textContent = 'ออฟไลน์';
      
      // ปิดใช้งานปุ่มต่างๆ
      deviceCard.querySelectorAll('.relays-actions button, .sensors-actions button').forEach(btn => {
        btn.disabled = true;
      });
    }
  }
}

// ฟังก์ชันอัปเดตสถานะของรีเลย์
function updateRelayStatus(deviceId, relayId, status) {
  const relayCheckbox = document.getElementById(`device-${deviceId}-relay-${relayId}`);
  
  if (relayCheckbox) {
    relayCheckbox.checked = status === 'on';
    
    // อัปเดตข้อความสถานะ
    const statusElement = relayCheckbox.closest('.relay-item').querySelector('.status-off, .status-on');
    
    if (statusElement) {
      if (status === 'on') {
        statusElement.classList.remove('status-off');
        statusElement.classList.add('status-on');
        statusElement.textContent = 'เปิด';
      } else {
        statusElement.classList.remove('status-on');
        statusElement.classList.add('status-off');
        statusElement.textContent = 'ปิด';
      }
    }
  }
}

// ฟังก์ชันอัปเดตค่าของเซ็นเซอร์
function updateSensorValue(deviceId, sensorId, value) {
  // หาชนิดของเซ็นเซอร์
  let sensorType = '';
  
  if (sensorId.includes('soil')) {
    sensorType = 'soil-moisture';
  } else if (sensorId.includes('temp')) {
    sensorType = 'temperature';
  } else if (sensorId.includes('humid')) {
    sensorType = 'humidity';
  } else if (sensorId.includes('light')) {
    sensorType = 'light';
  } else if (sensorId.includes('water')) {
    sensorType = 'water-level';
  }
  
  // อัปเดตค่าที่แสดง
  const sensorElement = document.querySelector(`.sensor-item[data-device-id="${deviceId}"][data-sensor-id="${sensorId}"]`);
  
  if (sensorElement) {
    const valueElement = sensorElement.querySelector('.sensor-value');
    
    if (valueElement) {
      valueElement.textContent = value;
    }
    
    // อัปเดตกราฟ
    updateSensorChart(deviceId, sensorType, value);
  }
}

// ฟังก์ชันสร้างกราฟสำหรับเซ็นเซอร์
function createSensorCharts() {
  // สร้างกราฟความชื้นในดิน
  const soilMoistureCtx = document.getElementById('device-1-soil-moisture-chart');
  
  if (soilMoistureCtx) {
    const soilMoistureChart = new Chart(soilMoistureCtx, {
      type: 'line',
      data: {
        labels: Array.from({length: 10}, (_, i) => i * 5 + ' นาทีที่แล้ว'),
        datasets: [{
          label: 'ความชื้นในดิน (%)',
          data: [45, 46, 44, 42, 40, 38, 39, 41, 43, 45],
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
    
    // เก็บกราฟไว้ใช้งานต่อ
    window.soilMoistureChart = soilMoistureChart;
  }
  
  // สร้างกราฟอุณหภูมิ
  const temperatureCtx = document.getElementById('device-1-temperature-chart');
  
  if (temperatureCtx) {
    const temperatureChart = new Chart(temperatureCtx, {
      type: 'line',
      data: {
        labels: Array.from({length: 10}, (_, i) => i * 5 + ' นาทีที่แล้ว'),
        datasets: [{
          label: 'อุณหภูมิ (°C)',
          data: [28.5, 28.7, 29.0, 29.2, 29.5, 29.8, 30.0, 29.7, 29.3, 28.5],
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            min: 20,
            max: 40
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
    
    // เก็บกราฟไว้ใช้งานต่อ
    window.temperatureChart = temperatureChart;
  }
}

// ฟังก์ชันอัปเดตกราฟของเซ็นเซอร์
function updateSensorChart(deviceId, sensorType, value) {
  let chart;
  
  if (sensorType === 'soil-moisture') {
    chart = window.soilMoistureChart;
  } else if (sensorType === 'temperature') {
    chart = window.temperatureChart;
  }
  
  if (chart) {
    // เพิ่มข้อมูลใหม่
    chart.data.datasets[0].data.push(parseFloat(value));
    
    // ลบข้อมูลเก่า
    if (chart.data.datasets[0].data.length > 10) {
      chart.data.datasets[0].data.shift();
    }
    
    // อัปเดตกราฟ
    chart.update();
  }
}

// ฟังก์ชันเปิดรีเลย์ทั้งหมดของอุปกรณ์
function turnAllRelaysOn(deviceId) {
  const relayCheckboxes = document.querySelectorAll(`input[id^="device-${deviceId}-relay-"]`);
  
  relayCheckboxes.forEach(checkbox => {
    checkbox.checked = true;
    
    // ส่งคำสั่งไปยัง MQTT
    const relayId = checkbox.id.split('-')[3];
    window.mqttClient.publish(`esp32/${deviceId}/relay/${relayId}/command`, 'on');
    
    // อัปเดตข้อความสถานะ
    const statusElement = checkbox.closest('.relay-item').querySelector('.status-off, .status-on');
    
    if (statusElement) {
      statusElement.classList.remove('status-off');
      statusElement.classList.add('status-on');
      statusElement.textContent = 'เปิด';
    }
  });
}

// ฟังก์ชันปิดรีเลย์ทั้งหมดของอุปกรณ์
function turnAllRelaysOff(deviceId) {
  const relayCheckboxes = document.querySelectorAll(`input[id^="device-${deviceId}-relay-"]`);
  
  relayCheckboxes.forEach(checkbox => {
    checkbox.checked = false;
    
    // ส่งคำสั่งไปยัง MQTT
    const relayId = checkbox.id.split('-')[3];
    window.mqttClient.publish(`esp32/${deviceId}/relay/${relayId}/command`, 'off');
    
    // อัปเดตข้อความสถานะ
    const statusElement = checkbox.closest('.relay-item').querySelector('.status-off, .status-on');
    
    if (statusElement) {
      statusElement.classList.remove('status-on');
      statusElement.classList.add('status-off');
      statusElement.textContent = 'ปิด';
    }
  });
}

// ฟังก์ชันรีเฟรชข้อมูลเซ็นเซอร์ทั้งหมดของอุปกรณ์
function refreshAllSensors(deviceId) {
  // ส่งคำสั่งไปยัง MQTT
  window.mqttClient.publish(`esp32/${deviceId}/sensor/command`, 'refresh');
}

// ฟังก์ชันแสดงไดอะล็อกเพิ่มรีเลย์
function showAddRelayDialog(deviceId) {
  // สร้างไดอะล็อกเพิ่มรีเลย์
  const dialog = document.createElement('div');
  dialog.className = 'dialog active';
  dialog.id = 'add-relay-dialog';
  
  dialog.innerHTML = `
    <div class="dialog-content">
      <div class="dialog-header">
        <h3>เพิ่มรีเลย์</h3>
        <button class="btn-icon dialog-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label for="new-relay-name">ชื่อรีเลย์</label>
          <input type="text" id="new-relay-name" placeholder="ปั๊มน้ำ 2">
        </div>
        <div class="form-group">
          <label for="new-relay-pin">พิน GPIO</label>
          <input type="number" id="new-relay-pin" placeholder="14">
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn-secondary dialog-close">ยกเลิก</button>
        <button class="btn-primary" id="add-relay-confirm">เพิ่มรีเลย์</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // เพิ่ม event listener สำหรับปุ่มปิดไดอะล็อก
  dialog.querySelector('.dialog-close').addEventListener('click', function() {
    document.body.removeChild(dialog);
  });
  
  // เพิ่ม event listener สำหรับปุ่มยืนยันการเพิ่มรีเลย์
  dialog.querySelector('#add-relay-confirm').addEventListener('click', function() {
    const name = document.getElementById('new-relay-name').value;
    const pin = document.getElementById('new-relay-pin').value;
    
    if (name && pin) {
      addRelay(deviceId, name, pin);
      document.body.removeChild(dialog);
    } else {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
  });
}

// ฟังก์ชันแสดงไดอะล็อกเพิ่มเซ็นเซอร์
function showAddSensorDialog(deviceId) {
  // สร้างไดอะล็อกเพิ่มเซ็นเซอร์
  const dialog = document.createElement('div');
  dialog.className = 'dialog active';
  dialog.id = 'add-sensor-dialog';
  
  dialog.innerHTML = `
    <div class="dialog-content">
      <div class="dialog-header">
        <h3>เพิ่มเซ็นเซอร์</h3>
        <button class="btn-icon dialog-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label for="new-sensor-type">ประเภทเซ็นเซอร์</label>
          <select id="new-sensor-type">
            <option value="soil-moisture">ความชื้นในดิน</option>
            <option value="temperature">อุณหภูมิ</option>
            <option value="humidity">ความชื้นในอากาศ</option>
            <option value="light">แสง</option>
            <option value="water-level">ระดับน้ำ</option>
          </select>
        </div>
        <div class="form-group">
          <label for="new-sensor-name">ชื่อเซ็นเซอร์</label>
          <input type="text" id="new-sensor-name" placeholder="ความชื้นในดิน 2">
        </div>
        <div class="form-group">
          <label for="new-sensor-pin">พิน GPIO</label>
          <input type="number" id="new-sensor-pin" placeholder="33">
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn-secondary dialog-close">ยกเลิก</button>
        <button class="btn-primary" id="add-sensor-confirm">เพิ่มเซ็นเซอร์</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // เพิ่ม event listener สำหรับปุ่มปิดไดอะล็อก
  dialog.querySelector('.dialog-close').addEventListener('click', function() {
    document.body.removeChild(dialog);
  });
  
  // เพิ่ม event listener สำหรับปุ่มยืนยันการเพิ่มเซ็นเซอร์
  dialog.querySelector('#add-sensor-confirm').addEventListener('click', function() {
    const type = document.getElementById('new-sensor-type').value;
    const name = document.getElementById('new-sensor-name').value;
    const pin = document.getElementById('new-sensor-pin').value;
    
    if (type && name && pin) {
      addSensor(deviceId, type, name, pin);
      document.body.removeChild(dialog);
    } else {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
  });
}

// ฟังก์ชันเพิ่มอุปกรณ์
function addDevice(name, ip, mac, location) {
  // สร้าง ID ใหม่
  const deviceId = document.querySelectorAll('.device-card').length + 1;
  
  // สร้าง HTML สำหรับอุปกรณ์ใหม่
  const deviceHTML = `
    <div class="device-card" data-device-id="${deviceId}">
      <div class="device-header">
        <div class="device-status offline">
          <i class="fas fa-circle"></i>
          <span>ออฟไลน์</span>
        </div>
        <div class="device-actions">
          <button class="btn-icon device-menu-btn"><i class="fas fa-ellipsis-v"></i></button>
          <div class="device-menu">
            <a href="#" class="device-menu-item" data-action="edit"><i class="fas fa-edit"></i> แก้ไข</a>
            <a href="#" class="device-menu-item" data-action="restart"><i class="fas fa-sync"></i> รีสตาร์ท</a>
            <a href="#" class="device-menu-item" data-action="delete"><i class="fas fa-trash"></i> ลบ</a>
          </div>
        </div>
      </div>
      <div class="device-content">
        <div class="device-info">
          <h3>${name}</h3>
          <div class="device-details">
            <div class="detail-item">
              <span class="detail-label">IP Address:</span>
              <span class="detail-value">${ip}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">MAC Address:</span>
              <span class="detail-value">${mac}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">เวอร์ชัน Firmware:</span>
              <span class="detail-value">1.0.0</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">ตำแหน่ง:</span>
              <span class="detail-value">${location || '-'}</span>
            </div>
          </div>
        </div>
        
        <div class="device-tabs">
          <div class="tabs-header">
            <button class="tab-btn active" data-tab="relays-${deviceId}">รีเลย์</button>
            <button class="tab-btn" data-tab="sensors-${deviceId}">เซ็นเซอร์</button>
            <button class="tab-btn" data-tab="settings-${deviceId}">ตั้งค่า</button>
          </div>
          <div class="tabs-content">
            <!-- แท็บรีเลย์ -->
            <div class="tab-pane active" id="relays-${deviceId}">
              <div class="relays-grid">
                <!-- ยังไม่มีรีเลย์ -->
              </div>
              <div class="relays-actions">
                <button class="btn-primary" onclick="turnAllRelaysOn(${deviceId})" disabled>เปิดทั้งหมด</button>
                <button class="btn-secondary" onclick="turnAllRelaysOff(${deviceId})" disabled>ปิดทั้งหมด</button>
                <button class="btn-secondary" onclick="showAddRelayDialog(${deviceId})" disabled>เพิ่มรีเลย์</button>
              </div>
            </div>
            
            <!-- แท็บเซ็นเซอร์ -->
            <div class="tab-pane" id="sensors-${deviceId}">
              <div class="sensors-grid">
                <!-- ยังไม่มีเซ็นเซอร์ -->
              </div>
              <div class="sensors-actions">
                <button class="btn-primary" onclick="refreshAllSensors(${deviceId})" disabled>รีเฟรชข้อมูล</button>
                <button class="btn-secondary" onclick="showAddSensorDialog(${deviceId})" disabled>เพิ่มเซ็นเซอร์</button>
              </div>
            </div>
            
            <!-- แท็บตั้งค่า -->
            <div class="tab-pane" id="settings-${deviceId}">
              <!-- ตั้งค่าของอุปกรณ์ -->
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // เพิ่มอุปกรณ์ใหม่ลงในรายการ
  document.querySelector('.devices-list').insertAdjacentHTML('beforeend', deviceHTML);
  
  // เพิ่ม event listener สำหรับปุ่มเมนูของอุปกรณ์
  const menuBtn = document.querySelector(`.device-card[data-device-id="${deviceId}"] .device-menu-btn`);
  
  menuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const menu = this.nextElementSibling;
    menu.classList.toggle('active');
  });
  
  // เพิ่ม event listener สำหรับปุ่มแท็บ
  document.querySelectorAll(`.device-card[data-device-id="${deviceId}"] .tab-btn`).forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      
      // ลบคลาส active จากปุ่มแท็บทั้งหมดในอุปกรณ์นี้
      this.parentElement.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
      });
      
      // เพิ่มคลาส active ให้กับปุ่มที่คลิก
      this.classList.add('active');
      
      // ซ่อนแท็บทั้งหมดในอุปกรณ์นี้
      document.querySelectorAll(`.tab-pane[id$="-${deviceId}"]`).forEach(tab => {
        tab.classList.remove('active');
      });
      
      // แสดงแท็บที่เลือก
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// ฟังก์ชันเพิ่มรีเลย์
function addRelay(deviceId, name, pin) {
  // หาจำนวนรีเลย์ปัจจุบัน
  const relayCount = document.querySelectorAll(`#relays-${deviceId} .relay-item`).length;
  const relayId = relayCount + 1;
  
  // สร้าง HTML สำหรับรีเลย์ใหม่
  const relayHTML = `
    <div class="relay-item" data-relay-id="${relayId}">
      <div class="relay-header">
        <span class="relay-name">${name}</span>
        <div class="relay-toggle">
          <label class="switch">
            <input type="checkbox" id="device-${deviceId}-relay-${relayId}">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="relay-details">
        <div class="detail-item">
          <span class="detail-label">พิน GPIO:</span>
          <span class="detail-value">${pin}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">สถานะ:</span>
          <span class="detail-value status-off">ปิด</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">เปิดล่าสุด:</span>
          <span class="detail-value">-</span>
        </div>
      </div>
    </div>
  `;
  
  // เพิ่มรีเลย์ใหม่ลงในรายการ
  document.querySelector(`#relays-${deviceId} .relays-grid`).insertAdjacentHTML('beforeend', relayHTML);
  
  // เพิ่ม event listener สำหรับสวิตช์
  const relayCheckbox = document.getElementById(`device-${deviceId}-relay-${relayId}`);
  
  relayCheckbox.addEventListener('change', function() {
    // ส่งคำสั่งไปยัง MQTT
    const command = this.checked ? 'on' : 'off';
    window.mqttClient.publish(`esp32/${deviceId}/relay/${relayId}/command`, command);
    
    // อัปเดตข้อความสถานะ
    const statusElement = this.closest('.relay-item').querySelector('.status-off, .status-on');
    
    if (statusElement) {
      if (this.checked) {
        statusElement.classList.remove('status-off');
        statusElement.classList.add('status-on');
        statusElement.textContent = 'เปิด';
      } else {
        statusElement.classList.remove('status-on');
        statusElement.classList.add('status-off');
        statusElement.textContent = 'ปิด';
      }
    }
  });
}

// ฟังก์ชันเพิ่มเซ็นเซอร์
function addSensor(deviceId, type, name, pin) {
  // หาจำนวนเซ็นเซอร์ปัจจุบัน
  const sensorCount = document.querySelectorAll(`#sensors-${deviceId} .sensor-item`).length;
  const sensorId = `${type}-${sensorCount + 1}`;
  
  // กำหนดหน่วยตามประเภทของเซ็นเซอร์
  let unit = '';
  let defaultValue = '0';
  
  if (type === 'soil-moisture') {
    unit = '%';
    defaultValue = '0%';
  } else if (type === 'temperature') {
    unit = '°C';
    defaultValue = '0°C';
  } else if (type === 'humidity') {
    unit = '%';
    defaultValue = '0%';
  } else if (type === 'light') {
    unit = 'lux';
    defaultValue = '0 lux';
  } else if (type === 'water-level') {
    unit = '%';
    defaultValue = '0%';
  }
  
  // สร้าง HTML สำหรับเซ็นเซอร์ใหม่
  const sensorHTML = `
    <div class="sensor-item" data-device-id="${deviceId}" data-sensor-id="${sensorId}">
      <div class="sensor-header">
        <span class="sensor-name">${name}</span>
        <span class="sensor-value">${defaultValue}</span>
      </div>
      <div class="sensor-chart">
        <canvas id="device-${deviceId}-${sensorId}-chart"></canvas>
      </div>
      <div class="sensor-details">
        <div class="detail-item">
          <span class="detail-label">พิน GPIO:</span>
          <span class="detail-value">${pin}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">ค่าต่ำสุด:</span>
          <span class="detail-value">-</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">ค่าสูงสุด:</span>
          <span class="detail-value">-</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">อัปเดตล่าสุด:</span>
          <span class="detail-value">-</span>
        </div>
      </div>
    </div>
  `;
  
  // เพิ่มเซ็นเซอร์ใหม่ลงในรายการ
  document.querySelector(`#sensors-${deviceId} .sensors-grid`).insertAdjacentHTML('beforeend', sensorHTML);
  
  // สร้างกราฟสำหรับเซ็นเซอร์ใหม่
  const chartCtx = document.getElementById(`device-${deviceId}-${sensorId}-chart`);
  
  if (chartCtx) {
    const chart = new Chart(chartCtx, {
      type: 'line',
      data: {
        labels: Array.from({length: 10}, (_, i) => i * 5 + ' นาทีที่แล้ว'),
        datasets: [{
          label: `${name} (${unit})`,
          data: Array(10).fill(0),
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
    
    // เก็บกราฟไว้ใช้งานต่อ
    window[`device${deviceId}${sensorId}Chart`] = chart;
  }
}

// ฟังก์ชันบันทึกการตั้งค่าอุปกรณ์
function saveDeviceSettings(deviceId) {
  const name = document.getElementById(`device-${deviceId}-name`).value;
  const location = document.getElementById(`device-${deviceId}-location`).value;
  const wifiSsid = document.getElementById(`device-${deviceId}-wifi-ssid`).value;
  const wifiPassword = document.getElementById(`device-${deviceId}-wifi-password`).value;
  const mqttBroker = document.getElementById(`device-${deviceId}-mqtt-broker`).value;
  const updateInterval = document.getElementById(`device-${deviceId}-update-interval`).value;
  
  // อัปเดตชื่ออุปกรณ์
  document.querySelector(`.device-card[data-device-id="${deviceId}"] h3`).textContent = name;
  
  // ส่งการตั้งค่าไปยัง MQTT
  const settings = {
    name: name,
    location: location,
    wifi: {
      ssid: wifiSsid,
      password: wifiPassword
    },
    mqtt: {
      broker: mqttBroker
    },
    update_interval: parseInt(updateInterval)
  };
  
  window.mqttClient.publish(`esp32/${deviceId}/settings`, JSON.stringify(settings));
  
  alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
}

// ฟังก์ชันรีเซ็ตการตั้งค่าอุปกรณ์
function resetDeviceSettings(deviceId) {
  if (confirm('คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตการตั้งค่าทั้งหมด?')) {
    document.getElementById(`device-${deviceId}-name`).value = `ESP32 ตัวที่ ${deviceId}`;
    document.getElementById(`device-${deviceId}-location`).value = '';
    document.getElementById(`device-${deviceId}-wifi-ssid`).value = 'MyWiFi';
    document.getElementById(`device-${deviceId}-wifi-password`).value = '';
    document.getElementById(`device-${deviceId}-mqtt-broker`).value = 'mqtt://broker.hivemq.com:1883';
    document.getElementById(`device-${deviceId}-update-interval`).value = '300';
  }
}

