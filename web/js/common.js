// Common JavaScript Functions - ฟังก์ชันที่ใช้ร่วมกันทั้งระบบ

// Global Configuration
const CONFIG = {
  MQTT_BROKER: 'wss://broker.hivemq.com:8884/mqtt',
  UPDATE_INTERVAL: 30000, // 30 seconds
  NOTIFICATION_TIMEOUT: 5000, // 5 seconds
  MAX_HISTORY_ITEMS: 50
};

// Global Variables - ใช้ร่วมกันทั้งระบบ
let mqttClient = null;
let isConnected = false;
let systemStatus = {
  autoWatering: true,
  autoFertilizer: true,
  emergencyStop: false
};

// Device Data Structure
let deviceData = {
  1: { name: 'ESP32 ตัวที่ 1', ip: '192.168.1.100', online: true, relays: 4 },
  2: { name: 'ESP32 ตัวที่ 2', ip: '192.168.1.101', online: true, relays: 4 },
  3: { name: 'ESP32 ตัวที่ 3', ip: '192.168.1.102', online: false, relays: 4 }
};

// Sensor Data Structure
let sensorData = {
  soilMoisture: { current: 45, min: 30, max: 80, avg: 55, history: [], unit: '%' },
  temperature: { current: 28.5, min: 25.2, max: 32.8, avg: 27.9, history: [], unit: '°C' },
  humidity: { current: 65, min: 40, max: 85, avg: 62, history: [], unit: '%' },
  waterLevel: { current: 75, min: 20, max: 100, avg: 68, history: [], unit: '%' }
};

// History Data
let historyData = [];

// Relay Names Configuration
const RELAY_NAMES = {
  1: 'ปั๊มน้ำ',
  2: 'ปั๊มปุ๋ย',
  3: 'วาล์วน้ำ 1',
  4: 'วาล์วน้ำ 2'
};

// ==================== MQTT Functions ====================

function initMQTT() {
  try {
    const clientId = 'esp32_dashboard_' + Math.random().toString(16).substr(2, 8);
    mqttClient = mqtt.connect(CONFIG.MQTT_BROKER, {
      clientId: clientId,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000
    });
    
    mqttClient.on('connect', function() {
      isConnected = true;
      console.log('MQTT Connected');
      showNotification('เชื่อมต่อ MQTT สำเร็จ', 'success');
      
      // Subscribe to all ESP32 topics
      mqttClient.subscribe('esp32/+/status');
      mqttClient.subscribe('esp32/+/sensor/#');
      mqttClient.subscribe('esp32/+/relay/#');
      mqttClient.subscribe('esp32/+/automation/#');
    });
    
    mqttClient.on('message', function(topic, message) {
      handleMQTTMessage(topic, message.toString());
    });
    
    mqttClient.on('error', function(error) {
      console.error('MQTT Error:', error);
      showNotification('ข้อผิดพลาด MQTT', 'error');
      // Don't show loading indefinitely on MQTT error
      hideLoading();
    });
    
    mqttClient.on('offline', function() {
      isConnected = false;
      showNotification('MQTT ออฟไลน์', 'warning');
      // Hide loading when MQTT goes offline
      hideLoading();
    });
    
  } catch (error) {
    console.error('MQTT Init Error:', error);
    showNotification('ไม่สามารถเชื่อมต่อ MQTT ได้', 'error');
    // Hide loading on MQTT init error
    hideLoading();
  }
}

function publishMQTT(topic, message) {
  if (mqttClient && isConnected) {
    mqttClient.publish(topic, message);
    console.log(`Published: ${topic} = ${message}`);
  } else {
    console.log(`Simulated: ${topic} = ${message}`);
    // Simulate response for demo
    setTimeout(() => {
      handleMQTTMessage(topic.replace('/set', ''), message);
    }, 100);
  }
}

function handleMQTTMessage(topic, message) {
  const topicParts = topic.split('/');
  const deviceId = parseInt(topicParts[1]);
  
  if (topicParts[2] === 'status') {
    deviceData[deviceId].online = message === 'online';
    if (typeof updateDeviceDisplay === 'function') {
      updateDeviceDisplay();
    }
  } else if (topicParts[2] === 'sensor') {
    const sensorType = topicParts[3];
    updateSensorValue(sensorType, parseFloat(message));
  } else if (topicParts[2] === 'relay') {
    const relayId = parseInt(topicParts[3]);
    updateRelayStatus(deviceId, relayId, message === 'on');
  }
}

// ==================== Device Control Functions ====================

function toggleRelay(deviceId, relayId, state) {
  if (!deviceData[deviceId] || !deviceData[deviceId].online) {
    showNotification(`${deviceData[deviceId]?.name || 'อุปกรณ์'} ออฟไลน์`, 'error');
    // Reset checkbox if exists
    const checkbox = document.getElementById(`relay-${deviceId}-${relayId}`);
    if (checkbox) checkbox.checked = false;
    return false;
  }
  
  const relayName = RELAY_NAMES[relayId] || `รีเลย์ ${relayId}`;
  const action = state ? 'เปิด' : 'ปิด';
  
  publishMQTT(`esp32/${deviceId}/relay/${relayId}/set`, state ? 'on' : 'off');
  showNotification(`${action}${relayName} (${deviceData[deviceId].name})`, 'success');
  addHistoryItem(`${action}${relayName} - ${deviceData[deviceId].name}`);
  
  return true;
}

function testRelay(deviceId, relayId) {
  if (!deviceData[deviceId] || !deviceData[deviceId].online) {
    showNotification(`${deviceData[deviceId]?.name || 'อุปกรณ์'} ออฟไลน์`, 'error');
    return;
  }
  
  const relayName = RELAY_NAMES[relayId] || `รีเลย์ ${relayId}`;
  const checkbox = document.getElementById(`relay-${deviceId}-${relayId}`);
  
  showNotification(`ทดสอบ${relayName}...`, 'info');
  
  // Test sequence: on for 2 seconds, then off
  if (checkbox) checkbox.checked = true;
  publishMQTT(`esp32/${deviceId}/relay/${relayId}/set`, 'on');
  
  setTimeout(() => {
    if (checkbox) checkbox.checked = false;
    publishMQTT(`esp32/${deviceId}/relay/${relayId}/set`, 'off');
    showNotification(`ทดสอบ${relayName}เสร็จสิ้น`, 'success');
    addHistoryItem(`ทดสอบ${relayName} - ${deviceData[deviceId].name}`);
  }, 2000);
}

function rebootDevice(deviceId) {
  if (!deviceData[deviceId]) return;
  
  if (confirm(`คุณต้องการรีบูต ${deviceData[deviceId].name} หรือไม่?`)) {
    showNotification(`กำลังรีบูต ${deviceData[deviceId].name}...`, 'info');
    
    // Simulate reboot
    deviceData[deviceId].online = false;
    if (typeof updateDeviceDisplay === 'function') {
      updateDeviceDisplay();
    }
    
    publishMQTT(`esp32/${deviceId}/reboot`, 'true');
    
    setTimeout(() => {
      deviceData[deviceId].online = true;
      if (typeof updateDeviceDisplay === 'function') {
        updateDeviceDisplay();
      }
      showNotification(`รีบูต ${deviceData[deviceId].name} เรียบร้อย`, 'success');
      addHistoryItem(`รีบูต ${deviceData[deviceId].name}`);
    }, 3000);
  }
}

function updateRelayStatus(deviceId, relayId, state) {
  const checkbox = document.getElementById(`relay-${deviceId}-${relayId}`);
  if (checkbox) {
    checkbox.checked = state;
  }
  
  // Update any status displays
  const statusElement = document.getElementById(`status-${deviceId}-${relayId}`);
  if (statusElement) {
    statusElement.textContent = state ? 'เปิด' : 'ปิด';
    statusElement.className = state ? 'status-on' : 'status-off';
  }
}

// ==================== Sensor Functions ====================

function updateSensorValue(sensorType, value) {
  // Map MQTT sensor types to our data structure
  const sensorMap = {
    'soil_moisture': 'soilMoisture',
    'temperature': 'temperature',
    'humidity': 'humidity',
    'water_level': 'waterLevel'
  };
  
  const mappedSensor = sensorMap[sensorType];
  if (mappedSensor && sensorData[mappedSensor]) {
    sensorData[mappedSensor].current = value;
    sensorData[mappedSensor].history.push(value);
    
    // Keep only last 20 readings
    if (sensorData[mappedSensor].history.length > 20) {
      sensorData[mappedSensor].history.shift();
    }
    
    updateSensorStats(mappedSensor);
    
    // Update displays if functions exist
    if (typeof updateSensorDisplay === 'function') {
      updateSensorDisplay();
    }
    if (typeof updateCharts === 'function') {
      updateCharts();
    }
  }
}

function updateSensorStats(sensorType) {
  const sensor = sensorData[sensorType];
  if (sensor && sensor.history.length > 0) {
    sensor.min = Math.min(...sensor.history);
    sensor.max = Math.max(...sensor.history);
    sensor.avg = sensor.history.reduce((a, b) => a + b, 0) / sensor.history.length;
  }
}

function generateRandomSensorData() {
  // Generate realistic sensor data
  sensorData.soilMoisture.current = Math.max(0, Math.min(100,
    sensorData.soilMoisture.current + (Math.random() - 0.5) * 10));
  
  sensorData.temperature.current = Math.max(15, Math.min(45,
    sensorData.temperature.current + (Math.random() - 0.5) * 2));
  
  sensorData.humidity.current = Math.max(20, Math.min(100,
    sensorData.humidity.current + (Math.random() - 0.5) * 5));
  
  sensorData.waterLevel.current = Math.max(0, Math.min(100,
    sensorData.waterLevel.current + (Math.random() - 0.5) * 3));
  
  // Update history and stats
  Object.keys(sensorData).forEach(sensorType => {
    const sensor = sensorData[sensorType];
    sensor.history.push(sensor.current);
    if (sensor.history.length > 20) {
      sensor.history.shift();
    }
    updateSensorStats(sensorType);
  });
}

// ==================== Automation Functions ====================

function toggleAutoWatering() {
  systemStatus.autoWatering = !systemStatus.autoWatering;
  
  const action = systemStatus.autoWatering ? 'เปิด' : 'ปิด';
  showNotification(`${action}ระบบรดน้ำอัตโนมัติ`, 'success');
  addHistoryItem(`${action}ระบบรดน้ำอัตโนมัติ`);
  
  publishMQTT('esp32/1/automation/watering/set', systemStatus.autoWatering ? 'on' : 'off');
  
  if (typeof updateAutomationStatus === 'function') {
    updateAutomationStatus();
  }
}

function toggleAutoFertilizer() {
  systemStatus.autoFertilizer = !systemStatus.autoFertilizer;
  
  const action = systemStatus.autoFertilizer ? 'เปิด' : 'ปิด';
  showNotification(`${action}ระบบผสมปุ๋ยอัตโนมัติ`, 'success');
  addHistoryItem(`${action}ระบบผสมปุ๋ยอัตโนมัติ`);
  
  publishMQTT('esp32/1/automation/fertilizer/set', systemStatus.autoFertilizer ? 'on' : 'off');
  
  if (typeof updateAutomationStatus === 'function') {
    updateAutomationStatus();
  }
}

function emergencyStop() {
  if (confirm('คุณต้องการหยุดระบบฉุกเฉินหรือไม่?')) {
    systemStatus.emergencyStop = true;
    showLoading();
    
    // Stop all relays
    Object.keys(deviceData).forEach(deviceId => {
      for (let relay = 1; relay <= deviceData[deviceId].relays; relay++) {
        const checkbox = document.getElementById(`relay-${deviceId}-${relay}`);
        if (checkbox) {
          checkbox.checked = false;
          publishMQTT(`esp32/${deviceId}/relay/${relay}/set`, 'off');
        }
      }
    });
    
    // Stop automation
    systemStatus.autoWatering = false;
    systemStatus.autoFertilizer = false;
    
    addHistoryItem('หยุดระบบฉุกเฉิน - ปิดอุปกรณ์ทั้งหมด');
    
    setTimeout(() => {
      hideLoading();
      showNotification('หยุดระบบฉุกเฉินเรียบร้อย', 'warning');
      systemStatus.emergencyStop = false;
      
      if (typeof updateAutomationStatus === 'function') {
        updateAutomationStatus();
      }
    }, 1000);
  }
}

// ==================== History Functions ====================

function addHistoryItem(event) {
  const now = new Date();
  const time = now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0');
  
  historyData.unshift({ time, event, timestamp: now });
  
  // Keep only last items
  if (historyData.length > CONFIG.MAX_HISTORY_ITEMS) {
    historyData = historyData.slice(0, CONFIG.MAX_HISTORY_ITEMS);
  }
  
  if (typeof updateHistoryDisplay === 'function') {
    updateHistoryDisplay();
  }
}

function exportHistory() {
  const csvContent = "data:text/csv;charset=utf-8," +
    "เวลา,เหตุการณ์,วันที่\n" +
    historyData.map(item => {
      const date = item.timestamp ? item.timestamp.toLocaleDateString('th-TH') : 'ไม่ระบุ';
      return `${item.time},"${item.event}",${date}`;
    }).join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `history_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showNotification('ส่งออกประวัติเรียบร้อย', 'success');
}

function clearHistory() {
  if (confirm('คุณต้องการล้างประวัติทั้งหมดหรือไม่?')) {
    historyData = [];
    showNotification('ล้างประวัติเรียบร้อย', 'success');
    
    if (typeof updateHistoryDisplay === 'function') {
      updateHistoryDisplay();
    }
  }
}

// ==================== UI Utility Functions ====================

function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container') || createNotificationContainer();
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
        <div class="notification-message">${message}</div>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;

  container.appendChild(notification);

  // Auto remove after timeout
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.add('removing');
      setTimeout(() => notification.remove(), 300);
    }
  }, CONFIG.NOTIFICATION_TIMEOUT);
}

function createNotificationContainer() {
  const container = document.createElement('div');
  container.id = 'notification-container';
  container.className = 'notification-container'; // Add the class from notification-fix.css
  document.body.appendChild(container);
  return container;
}

function showLoading() {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); z-index: 9999; 
            display: flex; justify-content: center; align-items: center;
        `;
    overlay.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; text-align: center;">
                <div class="loading-spinner"></div>
                <p class="mt-2">กำลังโหลด...</p>
            </div>
        `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// ==================== Data Management ====================

function generateInitialData() {
  // Generate initial sensor history
  Object.keys(sensorData).forEach(sensorType => {
    const sensor = sensorData[sensorType];
    for (let i = 0; i < 10; i++) {
      let value;
      switch (sensorType) {
        case 'soilMoisture':
          value = 40 + Math.random() * 20;
          break;
        case 'temperature':
          value = 26 + Math.random() * 6;
          break;
        case 'humidity':
          value = 50 + Math.random() * 30;
          break;
        case 'waterLevel':
          value = 60 + Math.random() * 30;
          break;
        default:
          value = Math.random() * 100;
      }
      sensor.history.push(value);
    }
    updateSensorStats(sensorType);
  });
  
  // Generate initial history
  historyData = [
    { time: '10:30', event: 'เริ่มรดน้ำอัตโนมัติ (ความชื้นในดิน 25%)', timestamp: new Date() },
    { time: '10:35', event: 'หยุดรดน้ำอัตโนมัติ', timestamp: new Date() },
    { time: '08:00', event: 'เริ่มให้ปุ๋ยอัตโนมัติ', timestamp: new Date() },
    { time: '08:02', event: 'หยุดให้ปุ๋ยอัตโนมัติ', timestamp: new Date() }
  ];
}

function startDataUpdates() {
  // Update sensor data periodically
  setInterval(() => {
    generateRandomSensorData();
    
    if (typeof updateSensorDisplay === 'function') {
      updateSensorDisplay();
    }
    if (typeof updateCharts === 'function') {
      updateCharts();
    }
  }, CONFIG.UPDATE_INTERVAL);
}

// ==================== CSS Animations ====================

// Add required CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .loading-spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .alert {
        padding: 12px 16px;
        border-radius: 6px;
        border: 1px solid transparent;
        font-size: 14px;
    }
    
    .alert-success {
        color: #155724;
        background-color: #d4edda;
        border-color: #c3e6cb;
    }
    
    .alert-danger {
        color: #721c24;
        background-color: #f8d7da;
        border-color: #f5c6cb;
    }
    
    .alert-warning {
        color: #856404;
        background-color: #fff3cd;
        border-color: #ffeaa7;
    }
    
    .alert-info {
        color: #0c5460;
        background-color: #d1ecf1;
        border-color: #bee5eb;
    }
    
    .mb-2 { margin-bottom: 8px; }
    .mt-2 { margin-top: 8px; }
`;
document.head.appendChild(style);

// Initialize common functions when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  generateInitialData();
  
  // Try to initialize MQTT but don't block the UI
  try {
    initMQTT();
  } catch (error) {
    console.warn('MQTT initialization failed, continuing without MQTT:', error);
    showNotification('ทำงานในโหมดออฟไลน์', 'warning');
  }
  
  startDataUpdates();
  console.log('Common functions initialized');
  
  // Ensure loading is hidden after initialization
  setTimeout(() => {
    hideLoading();
  }, 1000);
});