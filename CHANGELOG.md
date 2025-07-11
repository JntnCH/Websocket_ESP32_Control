# บันทึกการเปลี่ยนแปลง

## เวอร์ชัน 2.0.0 (ปัจจุบัน)

### การปรับปรุงหลัก

#### 1. เพิ่มการแสดงสถานะ input ทั้งหมด
- เพิ่มการอ่านค่าจากเซ็นเซอร์ต่างๆ:
  - เซ็นเซอร์วัดการไหลของน้ำ
  - เซ็นเซอร์วัดความชื้นในดิน
  - เซ็นเซอร์วัดอุณหภูมิ
  - เซ็นเซอร์วัดระดับน้ำ
  - เซ็นเซอร์วัดแสง
- เพิ่มการส่งข้อมูลสถานะ input ผ่าน MQTT
- เพิ่มส่วนแสดงสถานะเซ็นเซอร์ในหน้า UI

#### 2. ปรับปรุงระบบตั้งเวลา
- เพิ่มตัวเลือกหน่วยเวลา (วินาที, นาที, ชั่วโมง)
- รองรับการตั้งเวลาหลายรายการพร้อมกัน
- เพิ่มตารางแสดงรายการตั้งเวลาทั้งหมด
- สามารถยกเลิกการตั้งเวลาเฉพาะรายการได้

#### 3. ปรับปรุง UI
- ปรับแผงควบคุมให้แสดงเป็น 2 คอลัมน์
- ปรับปรุงการแสดงผลให้เหมาะสมกับอุปกรณ์มือถือ
- เพิ่มไอคอนสำหรับเซ็นเซอร์ต่างๆ
- ปรับปรุงการแสดงผลเวลาที่เหลือในการตั้งเวลา

### การเปลี่ยนแปลงทางเทคนิค

#### ฝั่ง ESP32 (Rust)
- เพิ่มการใช้งาน ADC สำหรับอ่านค่าเซ็นเซอร์แบบอนาล็อก
- เพิ่มการอ่านค่าพัลส์สำหรับเซ็นเซอร์วัดการไหลของน้ำ
- เพิ่มโครงสร้างข้อมูล `SensorData` สำหรับจัดเก็บค่าเซ็นเซอร์
- เพิ่ม thread สำหรับอ่านค่าเซ็นเซอร์และส่งข้อมูล
- ปรับปรุงระบบตั้งเวลาให้ส่งข้อมูลสถานะกลับไปยัง frontend

#### ฝั่ง Frontend (HTML/CSS/JavaScript)
- ปรับ CSS ให้ใช้ grid layout สำหรับแสดงรีเลย์เป็น 2 คอลัมน์
- เพิ่มส่วนแสดงสถานะเซ็นเซอร์ด้วย card layout
- เพิ่มตัวเลือกหน่วยเวลาในฟอร์มตั้งเวลา
- เพิ่มตารางแสดงรายการตั้งเวลา
- ปรับปรุง JavaScript เพื่อรองรับการแสดงสถานะเซ็นเซอร์
- เพิ่มฟังก์ชันสำหรับจัดการการตั้งเวลาหลายรายการ
- เพิ่มการแปลงค่า ADC เป็นหน่วยที่เข้าใจง่าย (เปอร์เซ็นต์, องศา)

## เวอร์ชัน 1.0.0 (เดิม)

### ฟีเจอร์
- ควบคุม GPIO
- เชื่อมต่อ WiFi
- OTA Firmware Update
- MQTT Subscribe เพื่อควบคุมวาล์ว
- ระบบตั้งเวลาพื้นฐาน

