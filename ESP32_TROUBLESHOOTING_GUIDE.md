# 🚨 ESP32 Connection Troubleshooting Guide

## **Masalah:** HTTP Response Code: -1 (Connection Refused)

**Error yang Anda alami:** ESP32 tidak dapat terhubung ke server dashboard meskipun WiFi sudah connected.

---

## 🎯 **SOLUSI STEP-BY-STEP**

### **Step 1: Upload ESP32_DEBUG_VERSION.ino**

1. **Ganti code ESP32** dengan file `ESP32_DEBUG_VERSION.ino` yang baru saya buat
2. **Upload ke ESP32** via Arduino IDE
3. **Buka Serial Monitor** (115200 baud)
4. **Monitor output** untuk debugging detail

Expected output yang lebih informatif:
```
🚁 ESP32 UAV Telemetry System - DEBUG MODE
📋 KRTI Team - Enhanced Troubleshooting Version
==================================================
🔧 Initializing pins...
   ✅ Pins configured
🔧 Initializing I2C...
   ✅ I2C ready on SDA:21 SCL:22
🔧 Initializing GPS...
   ✅ GPS ready on RX:16 TX:17
🔧 Initializing INA219...
   ⚠️ INA219 not found - using simulated data
🔧 [WiFi] Starting detailed WiFi initialization...
   📡 SSID: Redmi13
   🔑 Password: 123****
   🎯 Target Server: 10.86.58.211:3003
   🔍 Scanning available networks...
   📡 Found 5 networks:
      1. Redmi13 (-45 dBm) ← TARGET NETWORK FOUND! ✅
      2. Other Network (-67 dBm)
   🔗 Attempting connection to Redmi13...
   ✅ WiFi connected successfully!
   📍 Local IP: 10.86.58.xxx
   📍 Gateway: 10.86.58.146
   📶 RSSI: -45 dBm
   🧪 Testing network connectivity...
   🌐 Testing HTTP connection to server...
   📍 Test URL: http://10.86.58.211:3003/api/telemetry
   📊 HTTP GET Test Response: 200
   ✅ Server is reachable!
```

### **Step 2: Start Dashboard Server**

**Pastikan server berjalan saat testing:**

```powershell
# Di terminal, navigate ke project folder
cd "UAV_Dashboard_KRTI FIX-uji mulai dari awal-dikit lagi final"

# Start server
node server.js
```

**Expected output server:**
```
✅ [2025-09-24T08:30:00.000Z] [SYSTEM] 🚀 UAV Dashboard Server Started Successfully! 🚀
📊 Server Information:
   🌐 Dashboard URL: http://localhost:3003
   🔌 Socket.IO: Ready for ESP32 connections
   📡 HTTP API: Available at /api/
```

### **Step 3: Analisis Output Debug ESP32**

Cek bagian ini di Serial Monitor ESP32:

#### ✅ **Jika WiFi Berhasil:**
```
✅ WiFi connected successfully!
📍 Local IP: 10.86.58.xxx
```

#### ✅ **Jika Server Test Berhasil:**
```
📊 HTTP GET Test Response: 200
✅ Server is reachable!
```

#### ❌ **Jika Server Test Gagal:**
```
📊 HTTP GET Test Response: -1
❌ Server not reachable - Error: connection refused
```

### **Step 4: Windows Firewall Configuration**

**Jika server test gagal, configure Windows Firewall:**

1. **Buka Windows Defender Firewall**:
   ```
   Start → Settings → Update & Security → Windows Security → Firewall & network protection
   ```

2. **Allow an app through firewall**:
   - Klik "Allow an app or feature through Windows Defender Firewall"
   - Klik "Change Settings"
   - Klik "Allow another app..."
   - Browse dan pilih `node.exe` (biasanya di `C:\Program Files\nodejs\node.exe`)
   - **Centang both Private dan Public networks**
   - Klik OK

3. **Alternative - Disable Firewall sementara untuk testing**:
   ```
   Turn off Windows Defender Firewall (untuk testing saja)
   ```

### **Step 5: Manual Port Test**

**Test manual apakah port 3003 accessible:**

```powershell
# Test dari komputer yang sama
curl http://10.86.58.211:3003/api/telemetry

# Atau buka browser:
http://10.86.58.211:3003
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "battery_voltage": 16.75,
    "connection_status": "connected"
  }
}
```

### **Step 6: Network Connectivity Test**

**Test apakah ESP32 dan komputer di network yang sama:**

1. **Cek ESP32 IP dari Serial Monitor:**
   ```
   📍 Local IP: 10.86.58.xxx
   ```

2. **Ping dari komputer ke ESP32:**
   ```cmd
   ping 10.86.58.xxx
   ```

3. **Pastikan subnet sama:**
   - Komputer: `10.86.58.211`
   - ESP32: `10.86.58.xxx` (harus sama range)

---

## 🔧 **Common Solutions**

### **Problem 1: Connection Refused (-1)**
```cpp
📊 HTTP Response Code: -1
❌ HTTP Connection Failed!
🔍 Analysis: Connection refused - Server might be down or firewall blocking
```

**Solutions:**
- ✅ Start dashboard server: `node server.js`
- ✅ Disable Windows Firewall temporarily
- ✅ Check if port 3003 is available: `netstat -an | findstr :3003`

### **Problem 2: WiFi Connection Issues**
```cpp
❌ WiFi connection failed!
📊 Final Status: Connection Failed
```

**Solutions:**
- ✅ Check SSID and password are correct
- ✅ Ensure WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- ✅ Move ESP32 closer to router
- ✅ Try different WiFi network for testing

### **Problem 3: Server Unreachable**
```cpp
📊 HTTP GET Test Response: -3
❌ Server not reachable - Error: connection lost
```

**Solutions:**
- ✅ Check computer IP address: `ipconfig`
- ✅ Update ESP32 code with correct IP
- ✅ Restart router if necessary
- ✅ Try connecting ESP32 to phone hotspot for testing

---

## 📋 **Testing Checklist**

- [ ] **ESP32_DEBUG_VERSION.ino uploaded successfully**
- [ ] **Serial Monitor shows detailed WiFi connection info**
- [ ] **ESP32 gets IP address in same subnet as computer**
- [ ] **Dashboard server is running (`node server.js`)**
- [ ] **Windows Firewall allows Node.js**
- [ ] **Manual curl test to server works**
- [ ] **ESP32 HTTP GET test returns 200**
- [ ] **ESP32 starts sending telemetry packets**

---

## 📞 **Next Steps**

1. **Upload ESP32_DEBUG_VERSION.ino**
2. **Start dashboard server**
3. **Monitor Serial output** dan kirim saya hasilnya
4. **Saya akan analyze** output debug untuk solusi spesifik

**Dengan version debug ini, kita akan dapat melihat exactly dimana masalahnya dan fix dengan tepat!** 🎯
