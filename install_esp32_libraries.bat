@echo off
echo ===============================================
echo ESP32 LIBRARY INSTALLATION HELPER - KRTI
echo ===============================================
echo.
echo CATATAN: Script ini adalah panduan instalasi library
echo Untuk instalasi library ESP32, lakukan melalui Arduino IDE:
echo.

echo ========== LANGKAH INSTALASI LIBRARY ==========
echo.
echo 1. BUKA ARDUINO IDE
echo    - Download dari: https://www.arduino.cc/en/software
echo    - Install Arduino IDE versi terbaru
echo.

echo 2. INSTALL ESP32 BOARD PACKAGE
echo    - File → Preferences
echo    - Additional Boards Manager URLs:
echo      https://dl.espressif.com/dl/package_esp32_index.json
echo    - Tools → Board → Boards Manager
echo    - Search "ESP32" → Install "ESP32 by Espressif Systems"
echo.

echo 3. INSTALL REQUIRED LIBRARIES
echo    Melalui Tools → Manage Libraries, install:
echo    ✅ ArduinoJson (versi 6.x)
echo    ✅ WebSockets by Markus Sattler
echo    ✅ Adafruit INA219
echo    ✅ TinyGPS++
echo    ✅ SoftwareSerial (biasanya sudah include)
echo.

echo 4. KONFIGURASI ESP32 CODE
echo    - Edit WiFi credentials di KODEESP32UNTUKWEB.ino
echo    - Edit server IP address
echo    - Upload ke ESP32
echo.

echo ========== TESTING CONNECTION ==========
echo.
echo Untuk test koneksi ESP32:
echo 1. Buka Serial Monitor di Arduino IDE (Ctrl+Shift+M)
echo 2. Set baud rate ke 115200
echo 3. Reset ESP32 dan lihat output
echo.

echo Expected output setelah ESP32 berhasil connect:
echo "📡 Packet #1 sent - Batt: XX.XXV, GPS: ❌/✅, Signal: -XXdBm"
echo.

echo ========== DASHBOARD SERVER ==========
echo.
echo Untuk menjalankan dashboard server:
echo 1. Buka terminal di folder project ini
echo 2. Jalankan: npm install
echo 3. Jalankan: node server.js
echo 4. Buka browser: http://localhost:3003
echo.

echo ========== TROUBLESHOOTING ==========
echo.
echo Jika ada masalah:
echo ❌ WiFi tidak connect → Check SSID/password di code
echo ❌ Server tidak connect → Check IP address di code
echo ❌ Library error → Install manual via Arduino IDE Library Manager
echo ❌ GPS no signal → Test outdoor, tunggu 2-5 menit
echo ❌ INA219 error → Check wiring SDA/SCL pins
echo.

echo ========== HARDWARE WIRING ==========
echo.
echo ESP32 Pin Connections:
echo GPS RX  → Pin 16
echo GPS TX  → Pin 17
echo INA SDA → Pin 21
echo INA SCL → Pin 22
echo Relay   → Pin 5
echo.

echo 📖 Baca ESP32_SETUP_INSTRUCTIONS.md untuk panduan lengkap!
echo.

pause
echo 📚 Installing ESP32 Libraries...
echo.

echo Installing WebSockets library...
arduino-cli lib install "WebSockets"

echo Installing ArduinoJson library...
arduino-cli lib install "ArduinoJson"

echo Installing ESP32 core (if not already installed)...
arduino-cli core update-index
arduino-cli core install esp32:esp32

echo.
echo ✅ Library installation completed!
echo.
echo 📋 Installed Libraries:
arduino-cli lib list | findstr "WebSockets\|ArduinoJson"

echo.
echo 🚀 Ready to compile ESP32 code!
echo.
echo Next steps:
echo 1. Open ESP32_dashboard.ino in Arduino IDE
echo 2. Select Board: ESP32 Dev Module
echo 3. Update WiFi credentials in code
echo 4. Upload to ESP32
echo.
pause
