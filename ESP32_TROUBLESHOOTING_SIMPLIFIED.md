# ESP32 Troubleshooting Guide - SIMPLIFIED VERSION

## 🔧 LANGKAH CEPAT MENGATASI MASALAH CONNECTION

### 1. UPLOAD CODE BARU YANG SIMPLIFIED
```
- Upload file: KODEESP32UNTUKWEB_SIMPLIFIED.ino
- Code ini hanya menggunakan HTTP (tidak WebSocket)
- Lebih stabil dan mudah di-debug
```

### 2. CHECK IP ADDRESS KOMPUTER
```powershell
# Buka Command Prompt/PowerShell dan ketik:
ipconfig

# Cari adapter WiFi Anda dan catat IP Address
# Contoh: 192.168.1.100, 10.86.58.211, dll
```

### 3. UBAH IP DI CODE ESP32
```cpp
// Di file KODEESP32UNTUKWEB_SIMPLIFIED.ino, line ~47
const char* serverHost = "10.86.58.211";  // UBAH INI dengan IP komputer Anda
```

### 4. CHECK NAMA WIFI DAN PASSWORD
```cpp
// Di file KODEESP32UNTUKWEB_SIMPLIFIED.ino, line ~44-45
const char* ssid = "Redmi13";           // UBAH dengan nama WiFi Anda
const char* password = "12345678";      // UBAH dengan password WiFi Anda
```

### 5. TEST KONEKSI DARI KOMPUTER
```powershell
# Test ping ke ESP32 (setelah dapat IP dari Serial Monitor)
ping [IP_ESP32]

# Test server bisa diakses dari browser
http://localhost:3003/api/telemetry
```

## 📊 MONITORING ESP32 STATUS

### Serial Monitor Output Yang Normal:
```
✅ WiFi connected successfully!
📍 IP Address: 192.168.1.XXX
✅ Server reachable! HTTP Code: 200
📤 Sending packet #1...
✅ Packet #1 sent successfully!
```

### Serial Monitor Output Yang Error:
```
❌ WiFi connection failed!
❌ Server not reachable! Error code: -1
❌ Failed to send packet #1
```

## 🚨 SOLUSI BERDASARKAN ERROR

### Error: WiFi connection failed
1. Check nama WiFi dan password di code
2. Pastikan ESP32 dalam jangkauan WiFi
3. Restart ESP32 dan router

### Error: Server not reachable
1. Pastikan server running: `node server.js`
2. Check IP address di code ESP32
3. Disable Windows Firewall sementara
4. Test dari browser: http://[IP]:3003

### Error: HTTP Connection failed
1. Check port 3003 tidak dipakai aplikasi lain
2. Restart server dengan `node server.js`
3. Check antivirus tidak block port

## 🔍 STEP-BY-STEP DEBUGGING

### STEP 1: Basic Connection Test
```
1. Upload KODEESP32UNTUKWEB_SIMPLIFIED.ino
2. Buka Serial Monitor (115200 baud)
3. Check WiFi connect berhasil
4. Catat IP Address ESP32
```

### STEP 2: Server Test
```
1. Jalankan: node server.js
2. Buka browser: http://localhost:3003
3. Check dashboard muncul
4. Check Serial Monitor ESP32 ada "Server reachable"
```

### STEP 3: Data Flow Test  
```
1. Check Serial Monitor ESP32: "Packet sent successfully"
2. Check server log: "Received telemetry data from ESP32"
3. Check dashboard: data real-time update
```

## 💡 TIPS DEBUGGING

### 1. Gunakan Serial Commands
Ketik di Serial Monitor ESP32:
- `test` = Test koneksi server
- `status` = Show status lengkap
- `relay_on` = Nyalakan relay
- `relay_off` = Matikan relay
- `restart` = Restart ESP32

### 2. Check Network Settings
```
- Pastikan ESP32 dan komputer di network yang sama
- Check router tidak block komunikasi antar device
- Disable VPN yang mungkin mengubah IP
```

### 3. Simple Test Commands
```powershell
# Test dari komputer ke server
curl http://localhost:3003/api/telemetry

# Test network connectivity
ping [IP_ESP32]
telnet [IP_KOMPUTER] 3003
```

## 📱 QUICK FIX CHECKLIST

### ✅ Before Upload Code:
- [ ] Update WiFi SSID and password in code
- [ ] Update server IP address in code  
- [ ] Check server is running (node server.js)
- [ ] Check computer IP with ipconfig

### ✅ After Upload Code:
- [ ] Open Serial Monitor (115200 baud)
- [ ] Wait for WiFi connection
- [ ] Note ESP32 IP address
- [ ] Check "Server reachable" message
- [ ] Monitor packet sending status

### ✅ If Still Not Working:
- [ ] Restart ESP32 (press reset button)
- [ ] Restart server (Ctrl+C then node server.js)
- [ ] Restart router/modem
- [ ] Try different WiFi network
- [ ] Check Windows Firewall settings

## 🆘 EMERGENCY COMMANDS

### If ESP32 Keeps Disconnecting:
```cpp
// Add to setup() for debugging
WiFi.printDiag(Serial);
```

### If Server Won't Accept Data:
```bash
# Check what's using port 3003
netstat -ano | findstr :3003

# Kill process if needed
taskkill /PID [PID_NUMBER] /F
```

### If All Else Fails:
1. Use mobile hotspot instead of WiFi router
2. Try different ESP32 board
3. Reflash ESP32 firmware
4. Check hardware connections with multimeter

---

**💻 Jika masih bermasalah, kirim screenshot dari:**
1. Serial Monitor ESP32 
2. Command prompt: ipconfig
3. Browser: http://localhost:3003
4. Server console output
