@echo off
echo ===============================================
echo ESP32 LIBRARY INSTALLATION SCRIPT
echo ===============================================
echo.

echo 🔍 Checking Arduino CLI installation...
arduino-cli version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Arduino CLI not found!
    echo Please install Arduino CLI first:
    echo https://arduino.github.io/arduino-cli/installation/
    pause
    exit /b 1
)
echo ✅ Arduino CLI found

echo.
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
