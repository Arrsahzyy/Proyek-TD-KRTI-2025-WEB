@echo off
echo ================================================
echo         ESP32 NETWORK CONFIGURATION HELPER
echo ================================================
echo.

echo 1. CHECKING COMPUTER IP ADDRESS...
echo ================================================
ipconfig | findstr /i "IPv4"
echo.

echo 2. TESTING SERVER CONNECTIVITY...
echo ================================================
echo Testing if server is running on port 3003...
netstat -an | findstr ":3003" > nul
if %errorlevel%==0 (
    echo [OK] Port 3003 is active - Server is running
) else (
    echo [ERROR] Port 3003 not found - Server not running
    echo Please run: node server.js
)
echo.

echo 3. TESTING LOCALHOST ACCESS...
echo ================================================
echo Testing http://localhost:3003...
curl -s http://localhost:3003 > nul
if %errorlevel%==0 (
    echo [OK] Server responds to HTTP requests
) else (
    echo [ERROR] Server not responding
    echo Check if server is running: node server.js
)
echo.

echo 4. NETWORK ADAPTER INFO...
echo ================================================
echo Active network adapters:
ipconfig | findstr /i "adapter"
echo.

echo 5. WIFI NETWORK INFO...
echo ================================================
netsh wlan show profile
echo.

echo ================================================
echo            CONFIGURATION SUMMARY
echo ================================================
echo 1. Copy one of the IPv4 addresses above
echo 2. Paste it in ESP32 code at line ~47:
echo    const char* serverHost = "YOUR_IP_HERE";
echo 3. Update WiFi credentials in ESP32 code:
echo    const char* ssid = "YOUR_WIFI_NAME";
echo    const char* password = "YOUR_WIFI_PASSWORD";
echo 4. Upload the SIMPLIFIED code to ESP32
echo 5. Open Serial Monitor and check connection
echo ================================================

pause
