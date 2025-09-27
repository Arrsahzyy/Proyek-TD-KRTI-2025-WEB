# 📡 ESP32 MQTT Upload & Testing Guide

## ✅ Konfigurasi ESP32 Sudah Diperbarui

Kode ESP32 (`sodiq/sodiq.ino`) telah diperbarui dengan konfigurasi broker **mqtt-dashboard.com** yang sesuai dengan HiveMQ WebSocket Client Showcase.

### 🔧 **Perubahan Konfigurasi:**

```cpp
// MQTT Configuration
const char* mqtt_server = "mqtt-dashboard.com";
const int mqtt_port = 1883;
String clientId = "clientId-YRz6RXk2VE";

// Topic Configuration
Publish topic: "testtopic/maudongg"
Subscribe topic: "testtopic/maudongg/cmd"
```

### 📊 **Format Data JSON:**
```json
{
  "ts": 12345678,
  "voltage": 15.92,
  "current": 0.20,
  "power": 3.25,
  "relay": 1,
  "emergency": "off",
  "lat": -6.123456,
  "lng": 106.123456,
  "gps_fix": true
}
```

## 🚀 **Langkah Upload ke ESP32:**

### 1. **Buka Arduino IDE**
   - Pastikan board ESP32 sudah terpilih
   - Pilih port COM yang sesuai
   - Pastikan library yang diperlukan sudah terinstall:
     - `Adafruit INA219`
     - `PubSubClient`
     - `UniversalTelegramBot`
     - `qqqlab_GPS_UBLOX`

### 2. **Upload Kode**
   - Buka file: `sodiq/sodiq.ino`
   - **PENTING**: Pastikan WiFi credentials sudah benar:
     ```cpp
     const char* ssid = "Galaxy A52s";
     const char* password = "bentargwliatdulu";
     ```
   - Klik Upload (Ctrl+U)

### 3. **Monitor Serial**
   - Buka Serial Monitor (Ctrl+Shift+M)
   - Set baud rate: **115200**
   - ESP32 akan menampilkan:
     ```
     🌐 Memulai koneksi WiFi...
     SSID: Galaxy A52s
     Menghubungkan ke WiFi...
     ✅ Terhubung ke WiFi!
     IP Address: 192.168.x.x
     
     Menghubungkan ke MQTT broker: mqtt-dashboard.com:1883
     Client ID: clientId-YRz6RXk2VE
     ✅ Terhubung ke MQTT broker!
     ✅ Subscribed to: testtopic/maudongg/cmd
     ```

## 📡 **Testing Koneksi:**

### 1. **Server Status**
   Server sudah berjalan di: `http://localhost:3003`
   ```
   ✅ MQTT ESP32: Connected to mqtt-dashboard.com
   ✅ Subscribed to topic: testtopic/maudongg
   ✅ Ready to receive telemetry data
   ```

### 2. **Monitoring Data ESP32**
   Setelah ESP32 terhubung, Anda akan melihat:
   
   **Di Serial Monitor ESP32:**
   ```
   Tegangan : 15.92 V
   Arus     : 0.20 A
   Daya     : 3.25 W
   Status Relay Tetap: MATI
   📡 MQTT Published: {"ts":12345...}
   ```

   **Di Server Log:**
   ```
   📡 [MQTT] Message received on testtopic/maudongg
   📊 [ESP32] Voltage: 15.92V, Current: 0.20A, Power: 3.25W
   📍 [GPS] Location: (-6.123456, 106.123456)
   ```

### 3. **Dashboard Web**
   - Buka: `http://localhost:3003`
   - Lihat indikator MQTT status berubah jadi "Connected"
   - Chart akan menampilkan data real-time dari ESP32
   - GPS location akan update di map

## 🆘 **Test Emergency Button:**

### 1. **Dari Dashboard Web:**
   - Klik tombol "Emergency Stop"
   - ESP32 akan menerima command dan mematikan relay
   - Status emergency berubah jadi "on"

### 2. **Monitoring Response:**
   **Di ESP32 Serial:**
   ```
   Received MQTT: testtopic/maudongg/cmd -> {"cmd":"emergency","value":1}
   >>> Emergency ON: Relay dimatikan, histeresis nonaktif
   ```

## 🔍 **Troubleshooting:**

### ❌ **WiFi Connection Failed:**
```
- Pastikan SSID dan password benar
- Cek jarak ESP32 ke router
- Reset ESP32 dan coba lagi
```

### ❌ **MQTT Connection Failed:**
```
- Cek koneksi internet
- Pastikan mqtt-dashboard.com accessible
- Periksa firewall settings
```

### ❌ **No Data in Dashboard:**
```
- Pastikan server masih running
- Cek ESP32 Serial Monitor untuk error
- Refresh browser dashboard
```

## 📋 **Status Checklist:**

- ✅ ESP32 code updated dengan mqtt-dashboard.com config
- ✅ Server running dan connected ke broker
- ✅ Dashboard web siap menerima data
- ✅ Emergency command system ready
- ✅ GPS dan INA219 sensor integration
- ✅ Telegram notification system
- ⏳ **NEXT**: Upload code ke ESP32 dan test koneksi

## 🎯 **Expected Results:**

Setelah upload berhasil, Anda akan melihat:
1. **ESP32**: Terhubung ke WiFi dan MQTT broker
2. **Server**: Menerima data real-time dari ESP32
3. **Dashboard**: Menampilkan grafik dan data live
4. **Emergency**: Button berfungsi untuk control relay
5. **GPS**: Location tracking di map dashboard

**Ready untuk testing! Upload kode ke ESP32 Anda sekarang.**
