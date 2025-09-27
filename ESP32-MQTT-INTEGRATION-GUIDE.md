# 🚁 UAV Dashboard ESP32 MQTT Integration Guide

## 📋 **RINGKASAN INTEGRASI**

ESP32 Anda telah berhasil terhubung ke website dashboard melalui MQTT HiveMQ! Sistem ini memungkinkan:
- ✅ **Real-time telemetry monitoring** (voltage, current, power, GPS)
- ✅ **Emergency control via MQTT**
- ✅ **Live data visualization** di dashboard
- ✅ **Automatic data logging** dan Telegram notifications

---

## 🔧 **KONFIGURASI ESP32**

### **WiFi Settings** (dalam `sodiq.ino`)
```cpp
const char* ssid = "Galaxy A52s";           // ← Ganti dengan WiFi Anda
const char* password = "bentargwliatdulu";  // ← Ganti dengan password WiFi
```

### **MQTT Configuration**
```cpp
const char* mqtt_server = "broker.hivemq.com";  // HiveMQ public broker
WiFiClient espClient;
PubSubClient client(espClient);
```

### **Telegram Bot** (Opsional)
```cpp
#define BOT_TOKEN "7641641971:AAG3kk2PmOjs5bt7TtcOmy_xs5LT4q1kk2o"
#define CHAT_ID "1363149761"
```

---

## 📡 **MQTT TOPICS YANG DIGUNAKAN**

ESP32 mengirim data ke topik-topik berikut:

| **Topic** | **Data** | **Format** | **Keterangan** |
|-----------|----------|------------|----------------|
| `awikwoktegangan` | Voltage | `"15.92"` | Tegangan battery (V) |
| `awikwokarus` | Current | `"0.20"` | Arus battery (A) |
| `awikwokdaya` | Power | `"3.25"` | Daya battery (W) |
| `awikwokrelay` | Relay Status | `"1"` / `"0"` | Status relay ON/OFF |
| `awikwokgps` | GPS Coordinates | `{"lat":-5.359,"lng":105.315}` | Koordinat GPS |
| `awikwokemergency` | Emergency | `"on"` / `"off"` | Status emergency |

---

## 🚀 **CARA MENJALANKAN SISTEM**

### **1. Persiapkan Hardware**
- ESP32 DevKit
- INA219 Current/Voltage Sensor
- GPS Module (RX=16, TX=17)
- Relay Module (Pin 5)
- Power supply dan kabel USB

### **2. Upload Kode ke ESP32**
1. Buka Arduino IDE
2. Install library yang diperlukan:
   ```
   - Adafruit_INA219
   - UniversalTelegramBot
   - qqqlab_GPS_UBLOX
   - qqqlab_AutoBaud
   - PubSubClient
   - WiFi
   ```
3. Upload file `sodiq.ino` ke ESP32
4. Monitor Serial untuk melihat status koneksi

### **3. Jalankan Dashboard Server**
```powershell
# Navigate ke folder dashboard
cd "E:\PROJECT\UAV DASHBOARD LAST\DASHBOARD"

# Install dependencies (first time only)
npm install

# Start server
node server_fixed.js
```

### **4. Buka Dashboard**
- Akses: http://localhost:3003
- Dashboard akan otomatis menampilkan data real-time dari ESP32

---

## ⚡ **STATUS KONEKSI**

Ketika sistem berjalan dengan benar, Anda akan melihat:

### **ESP32 Serial Monitor:**
```
Menghubungkan ke WiFi...
Terhubung ke WiFi
Menghubungkan ke MQTT...
Terhubung!
>>> Relay HIDUP (Tegangan <= 16.80V)
Tegangan : 15.92 V
Arus     : 0.20 A
Daya     : 3.25 W
GPS publish: {"lat":-5.35980370,"lng":105.31540330}
```

### **Dashboard Server Log:**
```
✅ [MQTT] ESP32 MQTT Bridge connected successfully
✅ [MQTT] ESP32 MQTT connection established  
🔍 [MQTT] Received telemetry from ESP32
🔍 [MQTT] Telemetry data broadcasted to dashboard clients
```

### **Dashboard Website:**
- 🟢 **Connection Status**: Connected to ESP32
- 📊 **Real-time charts** menampilkan voltage, current, power
- 🗺️ **GPS map** menunjukkan lokasi UAV
- ⚡ **Live telemetry data** update setiap detik

---

## 🛠️ **TROUBLESHOOTING**

### **ESP32 tidak terhubung ke WiFi**
```cpp
// Cek konfigurasi WiFi di kode
const char* ssid = "NAMA_WIFI_ANDA";
const char* password = "PASSWORD_WIFI_ANDA";
```

### **MQTT tidak terhubung**
1. Pastikan WiFi ESP32 stabil
2. Cek internet connection
3. HiveMQ broker: `broker.hivemq.com:1883`

### **Dashboard tidak menampilkan data**
1. Pastikan server berjalan di port 3003
2. Cek browser console untuk error
3. Verify MQTT connection di server log

### **GPS tidak mengirim data**
1. Pastikan GPS module terhubung ke pin 16,17
2. Tunggu GPS mendapatkan fix (bisa 1-5 menit)
3. Gunakan GPS di area outdoor untuk signal terbaik

---

## 🎛️ **KONTROL EMERGENCY**

### **Dari Dashboard:**
- Klik tombol **Emergency Stop** 
- Sistem akan mengirim perintah ke ESP32 via MQTT
- Relay akan dimatikan secara paksa

### **Dari MQTT Manual:**
```bash
# Emergency ON (relay off)
mosquitto_pub -h broker.hivemq.com -t awikwokemergency -m "on"

# Emergency OFF (normal operation)  
mosquitto_pub -h broker.hivemq.com -t awikwokemergency -m "off"
```

---

## 📊 **API ENDPOINTS**

### **Get Current Telemetry**
```
GET http://localhost:3003/api/telemetry
```

### **Get MQTT Status**
```
GET http://localhost:3003/api/mqtt/status
```

### **Send Emergency Command**
```
POST http://localhost:3003/api/mqtt/emergency
Content-Type: application/json

{
  "action": "on"  // or "off"
}
```

---

## 🔄 **DATA FLOW DIAGRAM**

```
ESP32 → MQTT → Dashboard Server → WebSocket → Browser Dashboard
  ↓         ↓           ↓              ↓             ↓
INA219   HiveMQ    Node.js Server  Socket.IO    Real-time UI
GPS      Topics    MQTT Client      Events       Charts & Map
Relay    Publish   Data Processing  Broadcasting  Notifications
```

---

## 📈 **MONITORING FEATURES**

### **Real-time Charts:**
- Battery Voltage (V)
- Battery Current (A) 
- Power Consumption (W)
- 50-point rolling window

### **GPS Tracking:**
- Live location on OpenStreetMap
- Flight path history
- Center on UAV button

### **System Statistics:**
- MQTT connection status
- Data age indicators
- Message count & timing
- Error logging

---

## ⚠️ **KEAMANAN & LIMITS**

### **Relay Control Logic:**
```cpp
// Hidup jika tegangan <= 16.7V
if (!relayON && loadVoltage <= voltageON) {
    relayON = true;
    digitalWrite(RELAY_PIN, HIGH);
}

// Mati jika tegangan >= 17V  
if (relayON && loadVoltage >= voltageOFF) {
    relayON = false;
    digitalWrite(RELAY_PIN, LOW);
}
```

### **Emergency Override:**
- Emergency mode akan memaksa relay OFF
- Mengabaikan voltage thresholds
- Hanya bisa direset via MQTT command

---

## 🎯 **NEXT STEPS**

1. **✅ COMPLETED**: ESP32 ↔ MQTT ↔ Dashboard Integration
2. **Optional Improvements:**
   - Add more sensors (temperature, humidity)
   - Implement data logging to database
   - Add email notifications
   - Create mobile app interface
   - Add authentication & user management

---

## 📞 **SUPPORT**

Jika ada masalah:
1. Cek Serial Monitor ESP32 untuk error messages
2. Cek Server console untuk MQTT connection status
3. Verifikasi WiFi dan internet connection
4. Test MQTT broker dengan MQTT client tool

**Author**: KRTI Team  
**Version**: ESP32-MQTT Integration v1.0  
**Last Updated**: September 27, 2025
