// ตัวแปรสำหรับเก็บข้อมูลระบบอัตโนมัติ
let automations = [
  {
    id: 1,
    name: "รดน้ำตอนเช้า",
    type: "schedule",
    active: true,
    schedule: {
      time: "06:00",
      days: [0, 1, 2, 3, 4, 5, 6] // ทุกวัน
    },
    device: 1,
    actions: ["pump", "valve1"],
    duration: {
      value: 15,
      unit: "minutes"
    },
    nextRun: "พรุ่งนี้ 06:00 น."
  },
  {
    id: 2,
    name: "ให้ปุ๋ยประจำสัปดาห์",
    type: "schedule",
    active: true,
    schedule: {
      time: "07:00",
      days: [0] // วันอาทิตย์
    },
    device: 1,
    actions: ["pump", "fertilizer", "valve1"],
    duration: {
      value: 10,
      unit: "minutes"
    },
    nextRun: "วันอาทิตย์ 07:00 น."
  },
  {
    id: 3,
    name: "รดน้ำเมื่อดินแห้ง",
    type: "trigger",
    active: true,
    trigger: {
      sensor: "soil-moisture",
      operator: "lt",
      value: 30
    },
    device: 1,
    actions: ["pump", "valve1"],
    duration: {
      value: 60,
      unit: "sensor",
      stopCondition: {
        sensor: "soil-moisture",
        operator: "gt",
        value: 60
      }
    },
    currentStatus: "ความชื้นในดิน 45% (ไม่ทำงาน)"
  },
  {
    id: 4,
    name: "รดน้ำเมื่ออากาศร้อน",
    type: "trigger",
    active: false,
    trigger: {
      sensor: "temperature",
      operator: "gt",
      value: 35
    },
    device: 1,
    actions: ["pump", "valve1", "valve2"],
    duration: {
      value: 5,
      unit: "minutes"
    },
    currentStatus: "อุณหภูมิ 28.5°C (ไม่ทำงาน)"
  },
  {
    id: 5,
    name: "รดน้ำเมื่อไม่มีฝน",
    type: "condition",
    active: true,
    condition: {
      type: "no-rain",
      hours: 24
    },
    device: 1,
    actions: ["pump", "valve1", "valve2"],
    duration: {
      value: 20,
      unit: "minutes"
    },
    currentStatus: "ไม่มีฝนตกใน 36 ชั่วโมง (พร้อมทำงาน)"
  }
];

// ตัวแปรสำหรับเก็บข้อมูลประวัติการทำงาน
let history = [
  {
    time: "วันนี้ 06:00 น.",
    title: "รดน้ำตอนเช้า",
    details: "เปิดปั๊มน้ำ, เปิดวาล์วน้ำ 1 เป็นเวลา 15 นาที",
    status: "success"
  },
  {
    time: "เมื่อวาน 14:32 น.",
    title: "รดน้ำเมื่อดินแห้ง",
    details: "เปิดปั๊มน้ำ, เปิดวาล์วน้ำ 1 จนกว่าความชื้นในดิน > 60%",
    status: "success"
  },
  {
    time: "เมื่อวาน 06:00 น.",
    title: "รดน้ำตอนเช้า",
    details: "เปิดปั๊มน้ำ, เปิดวาล์วน้ำ 1 เป็นเวลา 15 นาที",
    status: "success"
  },
  {
    time: "2 วันก่อน 15:45 น.",
    title: "รดน้ำเมื่ออากาศร้อน",
    details: "เปิดปั๊มน้ำ, เปิดวาล์วน้ำ 1, เปิดวาล์วน้ำ 2 เป็นเวลา 5 นาที",
    status: "error",
    error: "ปั๊มน้ำไม่ทำงาน"
  }
];

// เมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', function() {
  // จัดการแท็บ
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // ลบคลาส active จากทุกปุ่มและทุกแท็บ
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // เพิ่มคลาส active ให้กับปุ่มที่คลิกและแท็บที่เกี่ยวข้อง
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // จัดการเมนูของแต่ละระบบอัตโนมัติ
  const menuButtons = document.querySelectorAll('.automation-menu-btn');
  
  menuButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const menu = this.nextElementSibling;
      
      // ปิดเมนูอื่นๆ ที่เปิดอยู่
      document.querySelectorAll('.automation-menu').forEach(m => {
        if (m !== menu) {
          m.style.display = 'none';
        }
      });
      
      // สลับการแสดงเมนู
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });
  });
  
  // ปิดเมนูเมื่อคลิกที่อื่น
  document.addEventListener('click', function() {
    document.querySelectorAll('.automation-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  });
  
  // จัดการไดอะล็อกเพิ่มระบบอัตโนมัติ
  const addAutomationButton = document.getElementById('add-automation');
  const addAutomationDialog = document.getElementById('add-automation-dialog');
  const dialogCloseButtons = document.querySelectorAll('.dialog-close');
  const addAutomationConfirmButton = document.getElementById('add-automation-confirm');
  
  // เปิดไดอะล็อก
  addAutomationButton.addEventListener('click', function() {
    addAutomationDialog.style.display = 'flex';
  });
  
  // ปิดไดอะล็อก
  dialogCloseButtons.forEach(button => {
    button.addEventListener('click', function() {
      addAutomationDialog.style.display = 'none';
    });
  });
  
  // ปิดไดอะล็อกเมื่อคลิกพื้นหลัง
  addAutomationDialog.addEventListener('click', function(e) {
    if (e.target === addAutomationDialog) {
      addAutomationDialog.style.display = 'none';
    }
  });
  
  // จัดการการเปลี่ยนประเภทของระบบอัตโนมัติ
  const automationType = document.getElementById('new-automation-type');
  const scheduleSection = document.getElementById('schedule-section');
  const triggerSection = document.getElementById('trigger-section');
  const conditionSection = document.getElementById('condition-section');
  
  automationType.addEventListener('change', function() {
    // ซ่อนทุกส่วน
    scheduleSection.style.display = 'none';
    triggerSection.style.display = 'none';
    conditionSection.style.display = 'none';
    
    // แสดงส่วนที่เลือก
    switch (this.value) {
      case 'schedule':
        scheduleSection.style.display = 'block';
        break;
      case 'trigger':
        triggerSection.style.display = 'block';
        break;
      case 'condition':
        conditionSection.style.display = 'block';
        break;
    }
  });
  
  // จัดการการเปลี่ยนประเภทของเงื่อนไข
  const conditionType = document.getElementById('condition-type');
  const customConditionGroup = document.getElementById('custom-condition-group');
  
  conditionType.addEventListener('change', function() {
    customConditionGroup.style.display = this.value === 'custom' ? 'block' : 'none';
  });
  
  // จัดการการเปลี่ยนหน่วยของระยะเวลา
  const durationUnit = document.getElementById('automation-duration-unit');
  const sensorStopCondition = document.getElementById('sensor-stop-condition');
  
  durationUnit.addEventListener('change', function() {
    sensorStopCondition.style.display = this.value === 'sensor' ? 'block' : 'none';
  });
  
  // จัดการการเปลี่ยนเซ็นเซอร์ทริกเกอร์
  const triggerSensor = document.getElementById('trigger-sensor');
  const triggerUnit = document.getElementById('trigger-unit');
  
  triggerSensor.addEventListener('change', function() {
    // เปลี่ยนหน่วยตามประเภทของเซ็นเซอร์
    switch (this.value) {
      case 'soil-moisture':
      case 'humidity':
        triggerUnit.textContent = '%';
        break;
      case 'temperature':
        triggerUnit.textContent = '°C';
        break;
      case 'light':
        triggerUnit.textContent = 'lux';
        break;
      case 'water-level':
        triggerUnit.textContent = 'cm';
        break;
    }
  });
  
  // จัดการการเปลี่ยนเซ็นเซอร์หยุดทำงาน
  const stopSensor = document.getElementById('stop-sensor');
  const stopUnit = document.getElementById('stop-unit');
  
  stopSensor.addEventListener('change', function() {
    // เปลี่ยนหน่วยตามประเภทของเซ็นเซอร์
    switch (this.value) {
      case 'soil-moisture':
      case 'humidity':
        stopUnit.textContent = '%';
        break;
      case 'temperature':
        stopUnit.textContent = '°C';
        break;
      case 'light':
        stopUnit.textContent = 'lux';
        break;
      case 'water-level':
        stopUnit.textContent = 'cm';
        break;
    }
  });
  
  // จัดการการเพิ่มระบบอัตโนมัติ
  addAutomationConfirmButton.addEventListener('click', function() {
    // เก็บข้อมูลจากฟอร์ม
    const name = document.getElementById('new-automation-name').value;
    const type = document.getElementById('new-automation-type').value;
    const device = document.getElementById('automation-device').value;
    
    // ตรวจสอบว่ากรอกชื่อหรือไม่
    if (!name) {
      alert('กรุณากรอกชื่อระบบอัตโนมัติ');
      return;
    }
    
    // สร้างระบบอัตโนมัติใหม่
    const newAutomation = {
      id: automations.length + 1,
      name: name,
      type: type,
      active: true,
      device: parseInt(device)
    };
    
    // เพิ่มข้อมูลตามประเภท
    switch (type) {
      case 'schedule':
        const scheduleTime = document.getElementById('schedule-time').value;
        const scheduleDays = Array.from(document.querySelectorAll('.days-selector input:checked')).map(input => parseInt(input.value));
        
        newAutomation.schedule = {
          time: scheduleTime,
          days: scheduleDays.length > 0 ? scheduleDays : [0, 1, 2, 3, 4, 5, 6] // ถ้าไม่เลือกวัน ให้เป็นทุกวัน
        };
        
        // คำนวณเวลาทำงานครั้งต่อไป
        const daysOfWeek = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const today = new Date().getDay();
        
        if (scheduleDays.includes(today)) {
          newAutomation.nextRun = `วันนี้ ${scheduleTime} น.`;
        } else if (scheduleDays.length > 0) {
          // หาวันถัดไปที่จะทำงาน
          let nextDay = scheduleDays.find(day => day > today);
          if (!nextDay) {
            nextDay = scheduleDays[0]; // วนกลับไปวันแรกถ้าไม่มีวันถัดไป
          }
          newAutomation.nextRun = `วัน${daysOfWeek[nextDay]} ${scheduleTime} น.`;
        } else {
          newAutomation.nextRun = `พรุ่งนี้ ${scheduleTime} น.`;
        }
        break;
        
      case 'trigger':
        const triggerSensor = document.getElementById('trigger-sensor').value;
        const triggerOperator = document.getElementById('trigger-operator').value;
        const triggerValue = document.getElementById('trigger-value').value;
        
        newAutomation.trigger = {
          sensor: triggerSensor,
          operator: triggerOperator,
          value: parseInt(triggerValue)
        };
        
        // สร้างข้อความสถานะปัจจุบัน
        const sensorValues = {
          'soil-moisture': '45%',
          'temperature': '28.5°C',
          'humidity': '65%',
          'light': '5000 lux',
          'water-level': '75 cm'
        };
        
        newAutomation.currentStatus = `${getSensorName(triggerSensor)} ${sensorValues[triggerSensor]} (ไม่ทำงาน)`;
        break;
        
      case 'condition':
        const conditionType = document.getElementById('condition-type').value;
        
        newAutomation.condition = {
          type: conditionType
        };
        
        if (conditionType === 'custom') {
          newAutomation.condition.custom = document.getElementById('custom-condition').value;
        } else if (conditionType === 'no-rain') {
          newAutomation.condition.hours = 24;
          newAutomation.currentStatus = 'ไม่มีฝนตกใน 36 ชั่วโมง (พร้อมทำงาน)';
        } else if (conditionType === 'daytime') {
          newAutomation.currentStatus = 'ขณะนี้เป็นเวลากลางวัน (พร้อมทำงาน)';
        } else if (conditionType === 'nighttime') {
          newAutomation.currentStatus = 'ขณะนี้เป็นเวลากลางคืน (ไม่ทำงาน)';
        }
        break;
    }
    
    // เก็บข้อมูลการทำงาน
    const actions = Array.from(document.querySelectorAll('.actions-selector input:checked')).map(input => input.value);
    newAutomation.actions = actions;
    
    // เก็บข้อมูลระยะเวลา
    const durationValue = document.getElementById('automation-duration').value;
    const durationUnit = document.getElementById('automation-duration-unit').value;
    
    newAutomation.duration = {
      value: parseInt(durationValue),
      unit: durationUnit
    };
    
    // เก็บข้อมูลเงื่อนไขการหยุดทำงาน (ถ้ามี)
    if (durationUnit === 'sensor') {
      const stopSensor = document.getElementById('stop-sensor').value;
      const stopOperator = document.getElementById('stop-operator').value;
      const stopValue = document.getElementById('stop-value').value;
      
      newAutomation.duration.stopCondition = {
        sensor: stopSensor,
        operator: stopOperator,
        value: parseInt(stopValue)
      };
    }
    
    // เพิ่มระบบอัตโนมัติใหม่
    automations.push(newAutomation);
    
    // เพิ่มระบบอัตโนมัติใหม่ลงในหน้าเว็บ
    addAutomationToUI(newAutomation);
    
    // ปิดไดอะล็อก
    addAutomationDialog.style.display = 'none';
    
    // รีเซ็ตฟอร์ม
    document.getElementById('new-automation-name').value = '';
    document.getElementById('new-automation-type').value = 'schedule';
    document.getElementById('schedule-time').value = '18:00';
    document.querySelectorAll('.days-selector input').forEach(input => input.checked = false);
    document.getElementById('trigger-sensor').value = 'soil-moisture';
    document.getElementById('trigger-operator').value = 'lt';
    document.getElementById('trigger-value').value = '30';
    document.getElementById('condition-type').value = 'no-rain';
    document.getElementById('custom-condition').value = '';
    document.getElementById('automation-device').value = '1';
    document.querySelectorAll('.actions-selector input').forEach(input => input.checked = false);
    document.getElementById('automation-duration').value = '15';
    document.getElementById('automation-duration-unit').value = 'minutes';
    document.getElementById('stop-sensor').value = 'soil-moisture';
    document.getElementById('stop-operator').value = 'gt';
    document.getElementById('stop-value').value = '60';
    
    // แสดงส่วนตารางเวลา
    scheduleSection.style.display = 'block';
    triggerSection.style.display = 'none';
    conditionSection.style.display = 'none';
    customConditionGroup.style.display = 'none';
    sensorStopCondition.style.display = 'none';
  });
  
  // ฟังก์ชันเพิ่มระบบอัตโนมัติลงในหน้าเว็บ
  function addAutomationToUI(automation) {
    // สร้าง HTML สำหรับระบบอัตโนมัติ
    const automationCard = document.createElement('div');
    automationCard.className = 'automation-card';
    automationCard.setAttribute('data-automation-id', automation.id);
    
    // สร้างส่วนหัวของการ์ด
    const automationHeader = document.createElement('div');
    automationHeader.className = 'automation-header';
    
    // สร้างส่วนสถานะ
    const automationStatus = document.createElement('div');
    automationStatus.className = `automation-status ${automation.active ? 'active' : 'inactive'}`;
    automationStatus.innerHTML = `
      <label class="switch">
        <input type="checkbox" ${automation.active ? 'checked' : ''}>
        <span class="slider round"></span>
      </label>
    `;
    
    // สร้างส่วนชื่อ
    const automationTitle = document.createElement('div');
    automationTitle.className = 'automation-title';
    automationTitle.innerHTML = `
      <h3>${automation.name}</h3>
      <span class="automation-type ${automation.type}">${getTypeName(automation.type)}</span>
    `;
    
    // สร้างส่วนการกระทำ
    const automationActions = document.createElement('div');
    automationActions.className = 'automation-actions';
    automationActions.innerHTML = `
      <button class="btn-icon automation-menu-btn"><i class="fas fa-ellipsis-v"></i></button>
      <div class="automation-menu">
        <a href="#" class="automation-menu-item" data-action="edit"><i class="fas fa-edit"></i> แก้ไข</a>
        <a href="#" class="automation-menu-item" data-action="duplicate"><i class="fas fa-copy"></i> ทำซ้ำ</a>
        <a href="#" class="automation-menu-item" data-action="delete"><i class="fas fa-trash"></i> ลบ</a>
      </div>
    `;
    
    // เพิ่มส่วนต่างๆ ลงในส่วนหัว
    automationHeader.appendChild(automationStatus);
    automationHeader.appendChild(automationTitle);
    automationHeader.appendChild(automationActions);
    
    // สร้างส่วนเนื้อหา
    const automationContent = document.createElement('div');
    automationContent.className = 'automation-content';
    
    // สร้างส่วนรายละเอียด
    const automationDetails = document.createElement('div');
    automationDetails.className = 'automation-details';
    
    // สร้างรายละเอียดตามประเภท
    let detailsHTML = '';
    
    switch (automation.type) {
      case 'schedule':
        const daysOfWeek = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        let daysText = '';
        
        if (automation.schedule.days.length === 7) {
          daysText = 'ทุกวัน';
        } else if (automation.schedule.days.length === 5 && 
                  automation.schedule.days.includes(1) && 
                  automation.schedule.days.includes(2) && 
                  automation.schedule.days.includes(3) && 
                  automation.schedule.days.includes(4) && 
                  automation.schedule.days.includes(5)) {
          daysText = 'วันจันทร์-ศุกร์';
        } else if (automation.schedule.days.length === 2 && 
                  automation.schedule.days.includes(0) && 
                  automation.schedule.days.includes(6)) {
          daysText = 'วันเสาร์-อาทิตย์';
        } else {
          daysText = automation.schedule.days.map(day => `วัน${daysOfWeek[day]}`).join(', ');
        }
        
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">เวลา:</span>
            <span class="detail-value">${automation.schedule.time} น. ${daysText}</span>
          </div>
        `;
        break;
        
      case 'trigger':
        const operatorSymbols = {
          'lt': '<',
          'gt': '>',
          'eq': '=',
          'lte': '≤',
          'gte': '≥'
        };
        
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">เงื่อนไข:</span>
            <span class="detail-value">${getSensorName(automation.trigger.sensor)} ${operatorSymbols[automation.trigger.operator]} ${automation.trigger.value}${getSensorUnit(automation.trigger.sensor)}</span>
          </div>
        `;
        break;
        
      case 'condition':
        let conditionText = '';
        
        if (automation.condition.type === 'no-rain') {
          conditionText = `ไม่มีฝนตกใน ${automation.condition.hours} ชั่วโมงที่ผ่านมา`;
        } else if (automation.condition.type === 'daytime') {
          conditionText = 'เป็นเวลากลางวัน';
        } else if (automation.condition.type === 'nighttime') {
          conditionText = 'เป็นเวลากลางคืน';
        } else if (automation.condition.type === 'custom') {
          conditionText = automation.condition.custom;
        }
        
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">เงื่อนไข:</span>
            <span class="detail-value">${conditionText}</span>
          </div>
        `;
        break;
    }
    
    // เพิ่มรายละเอียดอุปกรณ์
    detailsHTML += `
      <div class="detail-item">
        <span class="detail-label">อุปกรณ์:</span>
        <span class="detail-value">ESP32 ตัวที่ ${automation.device}</span>
      </div>
    `;
    
    // เพิ่มรายละเอียดการทำงาน
    const actionNames = {
      'pump': 'เปิดปั๊มน้ำ',
      'fertilizer': 'เปิดปั๊มปุ๋ย',
      'valve1': 'เปิดวาล์วน้ำ 1',
      'valve2': 'เปิดวาล์วน้ำ 2'
    };
    
    const actionsText = automation.actions.map(action => actionNames[action]).join(', ');
    
    detailsHTML += `
      <div class="detail-item">
        <span class="detail-label">การทำงาน:</span>
        <span class="detail-value">${actionsText}</span>
      </div>
    `;
    
    // เพิ่มรายละเอียดระยะเวลา
    let durationText = '';
    
    if (automation.duration.unit === 'minutes') {
      durationText = `${automation.duration.value} นาที`;
    } else if (automation.duration.unit === 'hours') {
      durationText = `${automation.duration.value} ชั่วโมง`;
    } else if (automation.duration.unit === 'sensor' && automation.duration.stopCondition) {
      const stopOperatorSymbols = {
        'lt': '<',
        'gt': '>',
        'eq': '=',
        'lte': '≤',
        'gte': '≥'
      };
      
      durationText = `จนกว่า${getSensorName(automation.duration.stopCondition.sensor)} ${stopOperatorSymbols[automation.duration.stopCondition.operator]} ${automation.duration.stopCondition.value}${getSensorUnit(automation.duration.stopCondition.sensor)}`;
    }
    
    detailsHTML += `
      <div class="detail-item">
        <span class="detail-label">ระยะเวลา:</span>
        <span class="detail-value">${durationText}</span>
      </div>
    `;
    
    automationDetails.innerHTML = detailsHTML;
    
    // สร้างส่วนการทำงานครั้งต่อไป
    const automationNext = document.createElement('div');
    automationNext.className = 'automation-next';
    
    if (automation.type === 'schedule') {
      automationNext.innerHTML = `
        <span class="next-label">ทำงานครั้งต่อไป:</span>
        <span class="next-value">${automation.nextRun}</span>
      `;
    } else {
      automationNext.innerHTML = `
        <span class="next-label">สถานะปัจจุบัน:</span>
        <span class="next-value">${automation.currentStatus}</span>
      `;
    }
    
    // เพิ่มส่วนต่างๆ ลงในส่วนเนื้อหา
    automationContent.appendChild(automationDetails);
    automationContent.appendChild(automationNext);
    
    // เพิ่มส่วนต่างๆ ลงในการ์ด
    automationCard.appendChild(automationHeader);
    automationCard.appendChild(automationContent);
    
    // เพิ่มการ์ดลงในรายการตามประเภท
    let targetList;
    
    switch (automation.type) {
      case 'schedule':
        targetList = document.querySelector('#schedules .automation-list');
        break;
      case 'trigger':
        targetList = document.querySelector('#triggers .automation-list');
        break;
      case 'condition':
        targetList = document.querySelector('#conditions .automation-list');
        break;
    }
    
    if (targetList) {
      targetList.appendChild(automationCard);
      
      // เพิ่ม event listener สำหรับปุ่มเมนู
      const menuButton = automationCard.querySelector('.automation-menu-btn');
      const menu = automationCard.querySelector('.automation-menu');
      
      menuButton.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // ปิดเมนูอื่นๆ ที่เปิดอยู่
        document.querySelectorAll('.automation-menu').forEach(m => {
          if (m !== menu) {
            m.style.display = 'none';
          }
        });
        
        // สลับการแสดงเมนู
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      });
      
      // เพิ่ม event listener สำหรับสวิตช์
      const switchInput = automationCard.querySelector('.switch input');
      
      switchInput.addEventListener('change', function() {
        const automationId = parseInt(automationCard.getAttribute('data-automation-id'));
        const automation = automations.find(a => a.id === automationId);
        
        if (automation) {
          automation.active = this.checked;
          automationCard.querySelector('.automation-status').className = `automation-status ${automation.active ? 'active' : 'inactive'}`;
        }
      });
      
      // เพิ่ม event listener สำหรับการกระทำในเมนู
      const menuItems = automationCard.querySelectorAll('.automation-menu-item');
      
      menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
          e.preventDefault();
          
          const action = this.getAttribute('data-action');
          const automationId = parseInt(automationCard.getAttribute('data-automation-id'));
          const automation = automations.find(a => a.id === automationId);
          
          if (automation) {
            switch (action) {
              case 'edit':
                // TODO: เปิดไดอะล็อกแก้ไข
                alert(`แก้ไขระบบอัตโนมัติ: ${automation.name}`);
                break;
              case 'duplicate':
                // สร้างสำเนา
                const duplicate = JSON.parse(JSON.stringify(automation));
                duplicate.id = automations.length + 1;
                duplicate.name = `${automation.name} (สำเนา)`;
                
                automations.push(duplicate);
                addAutomationToUI(duplicate);
                break;
              case 'delete':
                // ลบระบบอัตโนมัติ
                if (confirm(`ต้องการลบระบบอัตโนมัติ "${automation.name}" หรือไม่?`)) {
                  const index = automations.findIndex(a => a.id === automationId);
                  
                  if (index !== -1) {
                    automations.splice(index, 1);
                    automationCard.remove();
                  }
                }
                break;
            }
          }
          
          // ปิดเมนู
          menu.style.display = 'none';
        });
      });
    }
  }
  
  // ฟังก์ชันแปลงประเภทเป็นชื่อ
  function getTypeName(type) {
    switch (type) {
      case 'schedule':
        return 'ตารางเวลา';
      case 'trigger':
        return 'ทริกเกอร์';
      case 'condition':
        return 'เงื่อนไข';
      default:
        return type;
    }
  }
  
  // ฟังก์ชันแปลงชื่อเซ็นเซอร์
  function getSensorName(sensor) {
    switch (sensor) {
      case 'soil-moisture':
        return 'ความชื้นในดิน';
      case 'temperature':
        return 'อุณหภูมิ';
      case 'humidity':
        return 'ความชื้นในอากาศ';
      case 'light':
        return 'แสง';
      case 'water-level':
        return 'ระดับน้ำ';
      default:
        return sensor;
    }
  }
  
  // ฟังก์ชันแปลงหน่วยเซ็นเซอร์
  function getSensorUnit(sensor) {
    switch (sensor) {
      case 'soil-moisture':
      case 'humidity':
        return '%';
      case 'temperature':
        return '°C';
      case 'light':
        return ' lux';
      case 'water-level':
        return ' cm';
      default:
        return '';
    }
  }
});

