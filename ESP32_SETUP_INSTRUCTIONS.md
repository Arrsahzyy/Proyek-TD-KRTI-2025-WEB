# ESP32 Setup Instructions - UAV Dashboard KRTI

## 📋 Overview
Panduan lengkap untuk menghubungkan ESP32 dengan dashboard UAV yang telah dibuat. ESP32 akan membaca data sensor dan mengirimkannya secara real-time ke website dashboard.

---

## 🛠️ Hardware Requirements

### Komponen yang Dibutuhkan:
1. **ESP32 Development Board**
2. **GPS Module** (NEO-6M atau NEO-8M)
3. **INA219 Current Sensor**
4. **Relay Module** (5V)
5. **Kabel jumper**
6. **Breadboard** (opsional)

### Koneksi Hardware:

```
ESP32 Pin Configuration:
├── GPS Module
│   ├── GPS RX → ESP32 Pin 16
│   ├── GPS TX → ESP32 Pin 17
│   ├── GPS VCC → 3.3V
│   └── GPS GND → GND
│
├── INA219 Current Sensor
│   ├── INA219 SDA → ESP32 Pin 21
│   ├── INA219 SCL → ESP32 Pin 22
│   ├── INA219 VCC → 3.3V
│   └── INA219 GND → GND
│
├── Relay Module
│   ├── Relay Signal → ESP32 Pin 5
│   ├── Relay VCC → 5V (atau 3.3V tergantung relay)
│   └── Relay GND → GND
│
└── Status LED
    └── Built-in LED → ESP32 Pin 2 (otomatis)
```

---

## 💻 Software Requirements

### 1. Arduino IDE Setup
```bash
# Install Arduino IDE (versi 1.8.19 atau 2.x)
# Download dari: https://www.arduino.cc/en/software
```

### 2. ESP32 Board Package
1. Buka Arduino IDE
2. Go to **File → Preferences**
3. Tambahkan URL berikut ke "Additional Boards Manager URLs":
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
4. Go to **Tools → Board → Boards Manager**
5. Cari "ESP32" dan install **"ESP32 by Espressif Systems"**

### 3. Required Libraries
Install library berikut melalui **Tools → Manage Libraries**:

```bash
# Core Libraries (install via Library Manager)
1. ArduinoJson (versi 6.x)
2. WebSockets (by Markus Sattler)
3. Adafruit INA219
4. TinyGPS++
5. SoftwareSerial (biasanya sudah include)

# WiFi dan HTTP libraries sudah built-in di ESP32
```

#### Cara Install Libraries:
1. Buka **Tools → Manage Libraries**
2. Search masing-masing library
3. Klik **Install** pada versi terbaru

---

## ⚙️ Configuration Steps

### Step 1: Konfigurasi Kode ESP32

1. **Buka file `KODEESP32UNTUKWEB.ino`**

2. **Edit WiFi Credentials** (Baris 48-49):
   ```cpp
   const char* ssid = "NAMA_WIFI_ANDA";           // Ganti dengan nama WiFi
   const char* password = "PASSWORD_WIFI_ANDA";   // Ganti dengan password WiFi
   ```

3. **Edit Server Configuration** (Baris 52):
   ```cpp
   const char* serverHost = "192.168.1.100";      // Ganti dengan IP komputer Anda
   const int serverPort = 3003;                   // Port server (default 3003)
   ```

### Step 2: Mencari IP Address Komputer

#### Windows:
```cmd
# Buka Command Prompt dan jalankan:
ipconfig

# Cari "IPv4 Address" pada adapter WiFi yang aktif
# Contoh: 192.168.1.100
```

#### Linux/macOS:
```bash
# Jalankan di terminal:
ifconfig

# atau
ip addr show
```

### Step 3: Upload Code ke ESP32

1. **Connect ESP32** ke komputer via USB
2. **Select Board**: 
   - Go to **Tools → Board → ESP32 Arduino**
   - Pilih **"ESP32 Dev Module"** (atau sesuai board Anda)
3. **Select Port**: 
   - Go to **Tools → Port**
   - Pilih port COM yang sesuai (Windows) atau /dev/ttyUSB0 (Linux)
4. **Upload Code**: 
   - Klik **Upload** (ikon panah kanan)
   - Tunggu hingga "Hard resetting via RTS pin..." muncul

---

## 🚀 Running the Dashboard

### Step 1: Start Dashboard Server

1. **Buka Terminal** di folder project dashboard
2. **Install dependencies** (jika belum):
   ```bash
   npm install
   ```
3. **Start server**:
   ```bash
   node server.js
   ```

### Step 2: Open Dashboard

1. **Buka browser**
2. **Navigate ke**: `http://localhost:3003`
3. **Dashboard akan terbuka** dan menampilkan interface

---

## 🔧 Testing & Troubleshooting

### Monitoring ESP32
1. **Buka Serial Monitor** di Arduino IDE (**Tools → Serial Monitor**)
2. **Set baud rate** ke **115200**
3. **Reset ESP32** (tekan tombol RST)

### Expected Output:
```
==================================================
ESP32 UAV Telemetry System - KRTI Dashboard
==================================================
🔧 Initializing pins...
   ✅ Pins initialized
🔧 Initializing I2C...
   ✅ I2C initialized on pins SDA:21 SCL:22
🔧 Initializing GPS...
   ✅ GPS initialized on pins RX:16 TX:17
   📡 Waiting for GPS signal...
🔧 Initializing INA219 current sensor...
   ✅ INA219 initialized successfully
🔧 Initializing WiFi...
   📡 Connecting to: YOUR_WIFI_NAME
   ✅ WiFi connected successfully!
   📍 IP Address: 192.168.1.101
   📶 Signal Strength: -45 dBm
🔧 Initializing WebSocket connection...
   🌐 Server: 192.168.1.100:3003
   ✅ WebSocket configured
✅ ESP32 initialization completed!
📡 Starting telemetry transmission...
🔌 WebSocket connected to: /
📡 Packet #1 sent - Batt: 12.34V, GPS: ❌, Signal: -45dBm
```

### Common Issues & Solutions:

#### 1. WiFi Connection Failed
```
❌ Masalah: WiFi tidak terhubung
✅ Solusi:
- Pastikan SSID dan password benar
- Pastikan ESP32 dalam jangkauan WiFi
- Coba restart ESP32
- Periksa apakah WiFi menggunakan 2.4GHz (ESP32 tidak support 5GHz)
```

#### 2. Server Connection Failed
```
❌ Masalah: ESP32 terhubung WiFi tapi tidak ke server
✅ Solusi:
- Pastikan IP address server benar
- Pastikan server dashboard sudah running
- Pastikan port 3003 tidak diblokir firewall
- Coba ping IP server dari ESP32
```

#### 3. INA219 Not Found
```
❌ Masalah: INA219 tidak terdeteksi
✅ Solusi:
- Periksa koneksi SDA (Pin 21) dan SCL (Pin 22)
- Pastikan INA219 mendapat power 3.3V
- Cek dengan I2C scanner
```

#### 4. GPS No Signal
```
❌ Masalah: GPS tidak mendapat sinyal
✅ Solusi:
- Pastikan GPS di area terbuka (tidak indoor)
- Tunggu 2-5 menit untuk cold start
- Periksa koneksi RX/TX
- Pastikan GPS mendapat power 3.3V
```

---

## 📊 Dashboard Features

Setelah ESP32 terhubung, dashboard akan menampilkan:

### Real-time Data:
- **Battery Monitoring**: Voltage, Current, Power dari INA219
- **GPS Location**: Latitude, Longitude, Altitude, Speed
- **System Status**: WiFi signal, connection status
- **Environmental**: Temperature, Humidity (simulated)

### Interactive Features:
- **Live Map**: Menampilkan posisi UAV real-time
- **Power Chart**: Grafik konsumsi daya
- **Relay Control**: Kontrol relay via dashboard
- **Emergency Stop**: Fitur emergency shutdown

### Control Commands:
```javascript
// Relay control via dashboard
- Relay ON/OFF
- Emergency commands
- System status queries
```

---

## 🔍 Advanced Configuration

### Custom Sensor Integration:
```cpp
// Tambahkan sensor tambahan di function readSensorData()
void readSensorData() {
  readGPSData();
  readINA219Data();
  readSystemData();
  
  // Tambahkan sensor custom disini:
  // readTemperatureSensor();
  // readPressureSensor();
  
  updateTelemetryData();
}
```

### Telemetry Interval Adjustment:
```cpp
// Ubah interval pengiriman data (line 157)
const unsigned long TELEMETRY_INTERVAL = 2000;  // 2 detik default
// Ubah ke 1000 untuk 1 detik, 5000 untuk 5 detik
```

### WebSocket vs HTTP:
```cpp
// ESP32 otomatis menggunakan WebSocket jika tersedia
// Jika WebSocket gagal, akan fallback ke HTTP POST
// Tidak perlu konfigurasi tambahan
```

---

## 📝 Testing Checklist

- [ ] Hardware terhubung sesuai diagram
- [ ] Libraries terinstall semua
- [ ] WiFi credentials benar
- [ ] Server IP address benar
- [ ] ESP32 code terupload successfully
- [ ] Dashboard server running
- [ ] Serial monitor menampilkan koneksi berhasil
- [ ] Dashboard menerima data real-time
- [ ] GPS mendapat sinyal (jika outdoor)
- [ ] INA219 membaca nilai battery
- [ ] Relay dapat dikontrol via dashboard

---

## 🆘 Support & Troubleshooting

### Debug Mode:
Tambahkan debug prints jika diperlukan:
```cpp
Serial.println("DEBUG: " + String(variabel_debug));
```

### Factory Reset ESP32:
Jika ESP32 bermasalah total:
1. Hold tombol BOOT saat menyalakan
2. Upload code baru
3. Reset konfigurasi WiFi

### Contact:
- **KRTI Team Support**
- **Check Serial Monitor output** untuk error details
- **Verify network connectivity** antara ESP32 dan server

---

## ✅ Success Indicators

Ketika semua berjalan dengan baik, Anda akan melihat:

1. **ESP32 Serial Output**: Menampilkan data terkirim setiap 2 detik
2. **Dashboard**: Menampilkan data real-time dari ESP32
3. **LED Status**: LED ESP32 menyala solid (connected) atau berkedip (connecting)
4. **Map Updates**: Posisi GPS terupdate di map (jika GPS valid)
5. **Battery Data**: Voltage/current/power terbaca dari INA219

**Selamat! ESP32 Anda telah terhubung dengan dashboard UAV! 🚀**
