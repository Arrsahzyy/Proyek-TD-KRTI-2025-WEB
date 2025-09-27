# 🚁 ESP32 MQTT Configuration Guide - HiveMQ Integration

## ✅ KONFIGURASI ESP32 SUDAH DIPERBARUI

ESP32 code Anda sudah **siap untuk digunakan** dengan website dashboard yang baru! 

### 📡 **KONFIGURASI MQTT ESP32:**

```cpp
// Broker HiveMQ Public
const char* mqtt_server = "broker.hivemq.com";

// Client ID (unique per ESP32)
String clientId = "WEBSITETD-ESP32-" + String(random(0xffff), HEX);

// MQTT Topics
- awikwoktegangan    → Voltage data (V)
- awikwokarus        → Current data (A)  
- awikwokdaya        → Power data (W)
- awikwokrelay       → Relay status (1/0)
- awikwokgps         → GPS coordinates JSON
- awikwokemergency   → Emergency commands (subscribe)
```

---

## 🔧 **CARA UPLOAD KE ESP32**

### **1. Buka Arduino IDE**
- File → Open → `sodiq.ino`
- Pastikan ESP32 board sudah dipilih

### **2. Update WiFi (Jika perlu)**
```cpp
// Di baris 11-12, ganti dengan WiFi Anda:
const char* ssid = "NAMA_WIFI_ANDA";
const char* password = "PASSWORD_WIFI_ANDA";
```

### **3. Upload ke ESP32**
- Sambungkan ESP32 ke komputer via USB
- Pilih port yang benar (Tools → Port)
- Klik Upload (Ctrl+U)

### **4. Monitor Serial**
- Tools → Serial Monitor
- Set baud rate ke **115200**
- Lihat output koneksi MQTT

---

## 📊 **DATA YANG DIKIRIM ESP32**

ESP32 akan mengirim data setiap detik:

```
✅ Voltage: 15.92 V    → awikwoktegangan
✅ Current: 0.20 A     → awikwokarus  
✅ Power: 3.25 W       → awikwokdaya
✅ Relay: 1/0          → awikwokrelay
✅ GPS: {"lat":-5.359,"lng":105.315} → awikwokgps
```

---

## 🚀 **TESTING WORKFLOW**

### **Step 1: Start Dashboard**
```powershell
cd "E:\PROJECT\UAV DASHBOARD LAST\DASHBOARD"
node server_fixed.js
```

### **Step 2: Upload ESP32 Code**
- Upload `sodiq.ino` ke ESP32
- Monitor Serial untuk melihat koneksi

### **Step 3: Buka Dashboard**  
- URL: http://localhost:3003
- Start Tracking untuk mulai recording GPS

### **Step 4: Verifikasi Data**
- Cek real-time charts (voltage, current, power)
- Cek GPS marker di map
- Test emergency button

---

## 🔍 **EXPECTED OUTPUT**

### **ESP32 Serial Monitor:**
```
Terhubung ke WiFi
Menghubungkan ke MQTT...Terhubung!
Client ID: WEBSITETD-ESP32-A1B2
Tegangan : 15.92 V
Arus     : 0.20 A
Daya     : 3.25 W
Status Relay Tetap: MATI
GPS publish: {"lat":-5.35980370,"lng":105.31540330}
```

### **Dashboard Server Log:**
```
✅ Connected to MQTT broker
🔍 Received message on awikwoktegangan { message: '15.92' }
🔍 Received message on awikwokarus { message: '0.20' }
🔍 Received message on awikwokdaya { message: '3.25' }
🔍 Received message on awikwokgps { message: '{"lat":-5.359,"lng":105.315}' }
```

### **Dashboard Website:**
```
🟢 MQTT Status: Connected
📊 Real-time Charts: Updating
🗺️ GPS Map: Tracking location
⚡ Current Data: 0.20 A
🔋 Voltage Data: 15.92 V
🔌 Power Data: 3.25 W
```

---

## ⚙️ **FITUR KONTROL**

### **Emergency Stop:**
1. Klik tombol "Emergency" di dashboard
2. ESP32 akan menerima command di topic `awikwokemergency`
3. Relay otomatis OFF dan hysteresis disabled
4. Untuk reset: kirim "off" ke topic yang sama

### **Auto Relay Control:**
```cpp
// Relay otomatis berdasarkan voltage:
Relay ON:  voltage <= 16.7V  
Relay OFF: voltage >= 17.0V
Emergency: Relay paksa OFF
```

---

## 🔧 **TROUBLESHOOTING**

### **ESP32 Tidak Connect ke MQTT:**
1. Cek koneksi WiFi (LED ESP32 harus nyala solid)
2. Cek broker: `broker.hivemq.com` harus accessible
3. Restart ESP32 (tekan tombol RST)

### **Dashboard Tidak Menerima Data:**  
1. Pastikan server running di port 3003
2. Cek MQTT status di dashboard (harus 🟢)
3. Refresh browser (F5)

### **GPS Tidak Update:**
1. ESP32 harus di outdoor untuk GPS fix
2. Tunggu 2-3 menit untuk GPS lock
3. Cek Serial Monitor: "GPS publish" harus muncul

---

## ✅ **INTEGRATION CHECKLIST**

```
☑️ ESP32 Code Updated
☑️ WiFi Configuration Set  
☑️ MQTT Broker: broker.hivemq.com
☑️ Client ID: WEBSITETD-ESP32-XXXX
☑️ Topics: awikwok* series
☑️ Dashboard Server Ready
☑️ Frontend MQTT Client Ready
☑️ Real-time Tracking Ready
☑️ Emergency Control Ready
```

---

## 🎯 **HASIL AKHIR**

Setelah upload ESP32 code:

1. **✅ Real-time monitoring** voltage, current, power di dashboard
2. **✅ GPS tracking** dengan flight path recording  
3. **✅ Emergency control** dari website ke ESP32
4. **✅ Auto relay management** berdasarkan voltage threshold
5. **✅ Telegram notifications** setiap 10 detik
6. **✅ Data retention** dengan MQTT retained messages

System integration **100% siap digunakan!** 🚁✨

Upload code ke ESP32 Anda dan sistem akan langsung bekerja dengan dashboard website!
