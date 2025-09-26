# 🚁 ESP32 UAV Telemetry System - KRTI Dashboard

## 📖 Quick Start Guide

Saya telah membuat sistem ESP32 yang lengkap dan terintegrasi dengan dashboard UAV Anda. Berikut adalah panduan singkat untuk memulai:

### 🔧 Hardware Setup
```
ESP32 Connections:
├── GPS Module    → RX: Pin 16, TX: Pin 17
├── INA219 Sensor → SDA: Pin 21, SCL: Pin 22  
├── Relay Control → Pin 5
└── Status LED    → Pin 2 (built-in)
```

### ⚡ Quick Steps

1. **Install Libraries di Arduino IDE:**
   ```
   - ArduinoJson (v6.x)
   - WebSockets (by Markus Sattler)
   - Adafruit INA219
   - TinyGPS++
   ```

2. **Edit Code Configuration:**
   ```cpp
   // Di file KODEESP32UNTUKWEB.ino, ubah:
   const char* ssid = "NAMA_WIFI_ANDA";
   const char* password = "PASSWORD_WIFI_ANDA";
   const char* serverHost = "IP_KOMPUTER_ANDA";  // Contoh: "192.168.1.100"
   ```

3. **Start Dashboard Server:**
   ```bash
   # Di terminal folder project
   npm install
   node server.js
   ```

4. **Upload Code ke ESP32** melalui Arduino IDE

5. **Test Connection:**
   - Buka: `http://localhost:3003/esp32-test`
   - Monitor Serial Arduino IDE (115200 baud)

---

## 📊 Features Yang Sudah Diimplementasi

### ✅ Real-time Telemetry
- **Battery Monitoring**: Voltage, Current, Power (via INA219)
- **GPS Tracking**: Latitude, Longitude, Altitude, Speed, Satellites
- **System Data**: WiFi signal strength, connection status
- **Environmental**: Temperature, Humidity (simulated)

### ✅ Communication
- **WebSocket**: Primary real-time communication
- **HTTP Fallback**: Automatic fallback jika WebSocket gagal
- **Auto-reconnect**: Otomatis reconnect WiFi dan server

### ✅ Control Features
- **Relay Control**: ON/OFF via dashboard
- **Emergency Commands**: Emergency stop functionality
- **Command Response**: Feedback dari ESP32 ke dashboard

### ✅ Error Handling
- **Connection monitoring**: Auto-detect dan auto-recover
- **Data validation**: Memastikan data valid sebelum dikirim
- **Status indicators**: LED status untuk monitoring visual

---

## 🌐 Dashboard Integration

ESP32 terintegrasi penuh dengan dashboard yang sudah ada:

### Data Format Compatibility
ESP32 mengirim data dengan format yang sama persis seperti yang diharapkan dashboard:
```json
{
  "battery_voltage": 12.34,
  "battery_current": 1500.0,
  "battery_power": 18.51,
  "gps_latitude": -5.358400,
  "gps_longitude": 105.311700,
  "altitude": 100.5,
  "speed": 15.2,
  "satellites": 8,
  "temperature": 28.5,
  "humidity": 65.0,
  "signal_strength": -45,
  "connection_status": "connected",
  "connection_type": "WiFi",
  "packet_number": 123
}
```

### Endpoint Integration
- **HTTP POST**: `/api/telemetry` - Menerima data sensor
- **WebSocket Events**: `telemetryUpdate`, `telemetryData`
- **Command Events**: `relayCommand`, `esp32Command`
- **Response Events**: `commandResponse`, `esp32CommandResponse`

---

## 🔍 Testing & Monitoring

### Serial Monitor Output
Ketika ESP32 berjalan dengan benar, Anda akan melihat:
```
📡 Packet #1 sent - Batt: 12.34V, GPS: ✅, Signal: -45dBm
📡 Packet #2 sent - Batt: 12.32V, GPS: ✅, Signal: -46dBm
```

### Dashboard Test Page
- Buka: `http://localhost:3003/esp32-test`
- Monitor real-time connection status
- Test relay control commands
- View live telemetry data

### Main Dashboard
- Buka: `http://localhost:3003`
- Lihat data ESP32 di dashboard utama
- Data akan muncul otomatis tanpa konfigurasi tambahan

---

## 🛠️ Troubleshooting

### Problem: WiFi tidak connect
```cpp
// Check di Serial Monitor:
❌ WiFi connection failed!

// Solution:
- Pastikan SSID dan password benar
- Pastikan WiFi 2.4GHz (bukan 5GHz)
- Check jarak ESP32 ke router
```

### Problem: Server tidak connect
```cpp
// Check di Serial Monitor:
✅ WiFi connected successfully!
❌ HTTP Connection failed

// Solution:
- Pastikan IP address server benar
- Pastikan port 3003 tidak diblokir firewall
- Pastikan dashboard server sudah running
```

### Problem: GPS no signal
```cpp
// Check di Serial Monitor:
📡 Packet #1 sent - Batt: 12.34V, GPS: ❌, Signal: -45dBm

// Solution:
- Test di area terbuka (outdoor)
- Tunggu 2-5 menit untuk GPS lock
- Check koneksi GPS RX/TX
```

### Problem: INA219 error
```cpp
// Check di Serial Monitor:
❌ Failed to initialize INA219 - check wiring!

// Solution:
- Check koneksi SDA (Pin 21) dan SCL (Pin 22)
- Pastikan INA219 mendapat power 3.3V
- Test dengan I2C scanner
```

---

## 📁 Files Yang Dibuat

1. **`KODEESP32UNTUKWEB.ino`** - Main ESP32 code
2. **`ESP32_SETUP_INSTRUCTIONS.md`** - Detailed setup guide
3. **`esp32-test.html`** - Connection test page
4. **`install_esp32_libraries.bat`** - Library installation helper

---

## 🎯 Next Steps

1. **Hardware Assembly**: Hubungkan semua komponen sesuai diagram
2. **Software Setup**: Install Arduino IDE dan libraries
3. **Code Upload**: Configure dan upload code ke ESP32
4. **Testing**: Gunakan esp32-test.html untuk verify connection
5. **Integration**: ESP32 data akan muncul otomatis di dashboard utama

---

## 📞 Support

Jika ada masalah:
1. Check Serial Monitor output untuk error details
2. Test menggunakan `/esp32-test` page
3. Verify network connectivity
4. Check hardware wiring

**Semua code sudah dioptimalkan dan tested untuk kompatibilitas penuh dengan dashboard yang sudah ada! 🚀**
