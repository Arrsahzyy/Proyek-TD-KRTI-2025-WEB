# 📡 HiveMQ WebSocket Demo - ESP32 Configuration Guide

## ✅ Konfigurasi Optimal Selesai

Sistem telah dikonfigurasi sesuai dengan HiveMQ WebSocket Client demo dari https://www.hivemq.com/demos/websocket-client/ dengan konfigurasi:

### 🔧 **MQTT Broker Configuration:**
- **Host**: `mqtt-dashboard.com`
- **Port ESP32**: `1883` (Standard MQTT)
- **Port WebSocket**: `8884` (WebSocket Secure)
- **Client ID**: `clientId-YRz6RXk2VE`
- **Topic**: `testtopic/maudongg`
- **Command Topic**: `testtopic/maudongg/cmd`

### 📊 **Sistem Architecture:**

```
ESP32 (mqtt://mqtt-dashboard.com:1883) 
   ↓ Publish: testtopic/maudongg
   ↑ Subscribe: testtopic/maudongg/cmd
   ↓
Server Backend (mqtt://mqtt-dashboard.com:1883)
   ↓ Bridge to WebSocket
   ↓
Dashboard Frontend (wss://mqtt-dashboard.com:8884/mqtt)
   ↓ Display real-time data
   ↑ Send emergency commands
```

### 🚀 **Konfigurasi yang Diperbarui:**

#### 1. **ESP32 (sodiq.ino):**
```cpp
// MQTT Configuration
const char* mqtt_server = "mqtt-dashboard.com";
const int mqtt_port = 1883;
String clientId = "clientId-YRz6RXk2VE";

// Topics
Publish: "testtopic/maudongg"
Subscribe: "testtopic/maudongg/cmd"
```

#### 2. **Server Backend (server_fixed.js):**
```javascript
MQTT: {
    BROKER: 'mqtt://mqtt-dashboard.com:1883',
    CLIENT_ID: 'clientId-YRz6RXk2VE-server'
}
```

#### 3. **MQTT Client Bridge (mqtt-client.js):**
```javascript
topics: {
    subscribe: ['testtopic/maudongg'],
    publish: { emergency: 'testtopic/maudongg/cmd' }
}
```

#### 4. **Frontend WebSocket (frontend-mqtt-client.js):**
```javascript
config: {
    broker: 'wss://mqtt-dashboard.com:8884/mqtt',
    clientId: 'clientId-YRz6RXk2VE'
}
```

### ✅ **Status Server Aktif:**

```
📊 Server Information:
   🌐 Dashboard URL: http://localhost:3003
   🚁 MQTT ESP32: ✅ Connected to mqtt-dashboard.com
   📡 WebSocket: Ready with authentication
   📍 Subscribed to: testtopic/maudongg
   🎯 Client ID: clientId-YRz6RXk2VE-server
   ⚡ Dummy Data: Disabled - Real ESP32 data only
```

### 🔄 **Testing Workflow:**

#### 1. **Upload ESP32 Code:**
- Buka Arduino IDE
- Load file `sodiq/sodiq.ino`
- Pastikan WiFi credentials benar
- Upload ke ESP32

#### 2. **Monitor Koneksi:**
```
Serial Monitor ESP32 (115200 baud):
✅ Terhubung ke WiFi!
✅ Terhubung ke MQTT broker!
✅ Subscribed to: testtopic/maudongg/cmd
📡 MQTT Published: {"ts":...}
```

#### 3. **Dashboard Monitoring:**
```
Server Log:
📡 [MQTT] Message received on testtopic/maudongg
📊 [ESP32] Voltage: XX.XXV, Current: X.XXA
📍 [GPS] Location: (-X.XXXXXX, XXX.XXXXXX)

Frontend:
- MQTT Status: Connected
- Charts: Real-time update
- Map: GPS tracking
- Emergency: Button active
```

### 🆘 **Emergency Command Test:**

#### Dari Dashboard:
1. Klik "Emergency Stop" button
2. Frontend sends: `{"cmd":"emergency","value":1}`
3. Topic: `testtopic/maudongg/cmd`
4. ESP32 receives dan matikan relay

#### ESP32 Response:
```
Received MQTT: testtopic/maudongg/cmd -> {"cmd":"emergency","value":1}
>>> Emergency ON: Relay dimatikan, histeresis nonaktif
```

### 📋 **Expected JSON Format:**

#### ESP32 → Dashboard:
```json
{
  "ts": 1234567890,
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

#### Dashboard → ESP32:
```json
{
  "cmd": "emergency",
  "value": 1
}
```

### 🎯 **Optimization Features:**

- ✅ **Dual Connection**: ESP32 menggunakan standard MQTT (1883), Frontend menggunakan WebSocket (8884)
- ✅ **Consistent Client ID**: Semua menggunakan `clientId-YRz6RXk2VE` base
- ✅ **Unified Topics**: `testtopic/maudongg` untuk data, `testtopic/maudongg/cmd` untuk commands
- ✅ **Real-time Sync**: Server bridge antara MQTT dan WebSocket
- ✅ **Emergency Control**: Bidirectional command system
- ✅ **GPS Integration**: Location tracking dengan map display
- ✅ **Activity Logging**: Semua events dicatat di dashboard

### 🚀 **Ready for Testing!**

**Website sudah optimal dan siap digunakan dengan:**
1. ✅ HiveMQ mqtt-dashboard.com broker connection
2. ✅ WebSocket secure connection untuk frontend
3. ✅ ESP32 standard MQTT connection
4. ✅ Unified topic structure
5. ✅ Real-time data streaming
6. ✅ Emergency command system
7. ✅ GPS tracking dan monitoring

**Upload kode ESP32 dan mulai testing!**
