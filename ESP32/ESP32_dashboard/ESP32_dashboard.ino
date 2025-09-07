/**
 * ESP32 UAV Telemetry Code - FIXED VERSION
 * Compatible dengan Socket.IO server dashboard
 * Multi-protocol support: HTTP Primary + WebSocket fallback
 * Auto-reconnection dan robust error handling
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>  // Socket.IO compatible library
#include <ArduinoJson.h>

// Library availability check
#define HAS_WEBSOCKETS 1
#define HAS_JSON 1

// Socket.IO WebSocket client
WebSocketsClient webSocket;

// ================== KONFIGURASI - SESUAI SETUP KOMPUTER KAMU ==================
const char* WIFI_SSID = "Redmi13";              // ✅ WiFi kamu (sudah sesuai)
const char* WIFI_PASSWORD = "12345678";         // ✅ Password WiFi kamu (sudah sesuai)
const char* SERVER_HOST = "10.94.89.211";       // ✅ IP KOMPUTER KAMU (updated!)
const int SERVER_PORT = 3000;

// ================== GLOBAL VARIABLES ==================
HTTPClient http;
WiFiClient wifiClient;

// Status variables
struct SystemStatus {
    bool wifiConnected = false;
    bool websocketConnected = false;
    bool httpReady = false;
    bool sensorsReady = false;
    unsigned long lastDataSent = 0;
    unsigned long connectionStartTime = 0;
    int totalDataPackets = 0;
    int connectionAttempts = 0;
    String lastError = "";
} status;

// Sensor data
struct SensorData {
    float batteryVoltage = 12.5;
    float batteryCurrent = 2.3;
    float batteryPower = 0.0;
    float temperature = 25.8;
    float humidity = 65.0;
    float gpsLatitude = -5.397;
    float gpsLongitude = 105.266;
    float altitude = 150.0;
    int signalStrength = 0;
    int satellites = 8;
} sensors;

// Timing constants - OPTIMIZED untuk koneksi yang stabil
const unsigned long DATA_SEND_INTERVAL = 3000;    // Send data every 3 seconds (lebih stabil)
const unsigned long STATUS_PRINT_INTERVAL = 10000; // Print status every 10 seconds  
const unsigned long WIFI_RECONNECT_INTERVAL = 15000; // WiFi reconnect attempt every 15 seconds
const unsigned long HTTP_TIMEOUT = 5000; // HTTP timeout 5 seconds

unsigned long lastStatusPrint = 0;
unsigned long lastWifiReconnect = 0;

// ================== SETUP ==================
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    printWelcomeBanner();
    initializeSystem();
}

// ================== MAIN LOOP - FIXED VERSION ==================
void loop() {
    // 1. Check WiFi connection FIRST
    if (!checkWiFiConnection()) {
        delay(2000); // Wait longer on WiFi issues
        return;
    }
    
    // 2. Try WebSocket first (if available), fallback to HTTP
    bool dataSent = false;
    
    #if HAS_WEBSOCKETS
    if (status.websocketConnected) {
        webSocket.loop(); // Process WebSocket events
        
        if (millis() - status.lastDataSent >= DATA_SEND_INTERVAL) {
            dataSent = sendDataWebSocket();
            if (dataSent) status.lastDataSent = millis();
        }
    } else {
        // Try to connect WebSocket
        connectWebSocket();
    }
    #endif
    
    // 3. HTTP Fallback - ALWAYS try HTTP if WebSocket fails
    if (!dataSent && millis() - status.lastDataSent >= DATA_SEND_INTERVAL) {
        dataSent = sendDataHTTP();
        if (dataSent) status.lastDataSent = millis();
    }
    
    // 4. Print status summary
    if (millis() - lastStatusPrint >= STATUS_PRINT_INTERVAL) {
        printSystemStatus();
        lastStatusPrint = millis();
    }
    
    // 5. Short delay to prevent overwhelming
    delay(200);
}

// ================== INITIALIZATION ==================
void printWelcomeBanner() {
    Serial.println();
    Serial.println("🚀========================================🚀");
    Serial.println("       ESP32 UAV TELEMETRY SYSTEM");
    Serial.println("     Dashboard Connection - READY!");
    Serial.println("🚀========================================🚀");
    Serial.println();
    
    // Library detection
    Serial.println("📚 LIBRARY DETECTION:");
    Serial.println("   WebSocket support: " + String(HAS_WEBSOCKETS ? "✅ AVAILABLE" : "❌ NOT AVAILABLE"));
    Serial.println("   JSON support: " + String(HAS_JSON ? "✅ AVAILABLE" : "❌ NOT AVAILABLE (manual)"));
    Serial.println("   HTTP support: ✅ AVAILABLE");
    Serial.println();
    
    Serial.println("📋 SYSTEM INITIALIZATION:");
}

void initializeSystem() {
    Serial.print("🔍 [SENSORS] Initializing... ");
    initializeSensors();
    Serial.println("✅ READY");
    
    Serial.print("📶 [WIFI] Connecting to: " + String(WIFI_SSID) + "... ");
    initializeWiFi();
    
    Serial.print("🌐 [HTTP] Initializing client... ");
    initializeHTTP();
    Serial.println("✅ READY");
    
    Serial.println();
    Serial.println("✅ SYSTEM READY FOR DASHBOARD CONNECTION!");
    Serial.println();
}

void initializeSensors() {
    // Initialize real sensors here (INA219, BME280, GPS, etc.)
    // For now, using simulated data
    status.sensorsReady = true;
    delay(500); // Simulate sensor initialization time
}

void initializeWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    Serial.print("Connecting");
    while (WiFi.status() != WL_CONNECTED && attempts < 40) { // Increased attempts
        delay(500);
        Serial.print(".");
        attempts++;
        
        // Try to reconnect every 10 attempts
        if (attempts % 10 == 0) {
            Serial.print(" [Retry] ");
            WiFi.disconnect();
            delay(1000);
            WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        }
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        status.wifiConnected = true;
        status.connectionStartTime = millis();
        Serial.println(" ✅ CONNECTED");
        Serial.println("📶 IP Address: " + WiFi.localIP().toString());
        Serial.println("📶 Gateway: " + WiFi.gatewayIP().toString());
        Serial.println("📶 Signal Strength: " + String(WiFi.RSSI()) + " dBm");
        
        // Test connectivity to server
        testServerConnectivity();
    } else {
        status.wifiConnected = false;
        Serial.println(" ❌ FAILED - Check WiFi credentials!");
        status.lastError = "WiFi connection failed - Check credentials";
    }
}

void initializeHTTP() {
    status.httpReady = true;
}

// Test server connectivity
void testServerConnectivity() {
    Serial.print("🔍 [CONNECTIVITY] Testing server connection... ");
    
    http.begin(wifiClient, "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT));
    http.setTimeout(HTTP_TIMEOUT);
    int httpCode = http.GET();
    
    if (httpCode > 0) {
        Serial.println("✅ SERVER REACHABLE (HTTP " + String(httpCode) + ")");
        status.lastError = "";
    } else {
        Serial.println("❌ SERVER UNREACHABLE");
        Serial.println("    Check: Server running? IP correct? Port open?");
        status.lastError = "Cannot reach server at " + String(SERVER_HOST) + ":" + String(SERVER_PORT);
    }
    
    http.end();
}

// ================== WEBSOCKET FUNCTIONS - SOCKET.IO COMPATIBLE ==================
#if HAS_WEBSOCKETS
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("❌ [WEBSOCKET] Disconnected from server");
            status.websocketConnected = false;
            status.lastError = "WebSocket disconnected";
            break;
            
        case WStype_CONNECTED:
            Serial.printf("✅ [WEBSOCKET] Connected to: %s\n", payload);
            status.websocketConnected = true;
            status.lastError = "";
            
            // Send ESP32 connection info immediately
            sendConnectionInfo();
            break;
            
        case WStype_TEXT:
            Serial.printf("📨 [WEBSOCKET] Received: %s\n", payload);
            handleIncomingMessage(String((char*)payload));
            break;
            
        case WStype_BIN:
            Serial.printf("📦 [WEBSOCKET] Binary data received: %u bytes\n", length);
            break;
            
        case WStype_PING:
            Serial.println("💓 [WEBSOCKET] Ping received");
            break;
            
        case WStype_PONG:
            Serial.println("💓 [WEBSOCKET] Pong received");
            break;
            
        default:
            break;
    }
}

void connectWebSocket() {
    if (status.websocketConnected) return;
    
    Serial.print("🔗 [WEBSOCKET] Connecting to Socket.IO server... ");
    status.connectionAttempts++;
    
    // Socket.IO connection string format
    webSocket.begin(SERVER_HOST, SERVER_PORT, "/socket.io/?EIO=4&transport=websocket");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    webSocket.enableHeartbeat(15000, 3000, 2);
    
    Serial.println("Attempting...");
}

void sendConnectionInfo() {
    if (!status.websocketConnected) return;
    
    // Socket.IO event format: 42["event_name", data]
    String socketIOMessage = "42[\"esp32Connect\",{";
    socketIOMessage += "\"deviceId\":\"ESP32_UAV_DASHBOARD\",";
    socketIOMessage += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
    socketIOMessage += "\"signalStrength\":" + String(WiFi.RSSI()) + ",";
    socketIOMessage += "\"timestamp\":" + String(millis()) + ",";
    socketIOMessage += "\"version\":\"2.0_FIXED\"";
    socketIOMessage += "}]";
    
    webSocket.sendTXT(socketIOMessage);
    Serial.println("🤖 [ESP32] Connection info sent to dashboard");
}

bool sendDataWebSocket() {
    if (!status.websocketConnected || !status.sensorsReady) return false;
    
    readSensors();
    
    // Socket.IO telemetry event format
    String socketIOMessage = "42[\"telemetryData\",{";
    socketIOMessage += "\"battery_voltage\":" + String(sensors.batteryVoltage, 2) + ",";
    socketIOMessage += "\"battery_current\":" + String(sensors.batteryCurrent, 2) + ",";
    socketIOMessage += "\"battery_power\":" + String(sensors.batteryPower, 2) + ",";
    socketIOMessage += "\"temperature\":" + String(sensors.temperature, 1) + ",";
    socketIOMessage += "\"humidity\":" + String(sensors.humidity, 1) + ",";
    socketIOMessage += "\"gps_latitude\":" + String(sensors.gpsLatitude, 6) + ",";
    socketIOMessage += "\"gps_longitude\":" + String(sensors.gpsLongitude, 6) + ",";
    socketIOMessage += "\"altitude\":" + String(sensors.altitude, 1) + ",";
    socketIOMessage += "\"signal_strength\":" + String(WiFi.RSSI()) + ",";
    socketIOMessage += "\"satellites\":" + String(sensors.satellites) + ",";
    socketIOMessage += "\"timestamp\":" + String(millis()) + ",";
    socketIOMessage += "\"packet_number\":" + String(status.totalDataPackets);
    socketIOMessage += "}]";
    
    webSocket.sendTXT(socketIOMessage);
    
    status.totalDataPackets++;
    Serial.println("📊 [WEBSOCKET] Telemetry sent (Packet #" + String(status.totalDataPackets) + ")");
    printSensorData();
    
    return true;
}

void handleIncomingMessage(String message) {
    // Handle Socket.IO relay commands
    if (message.indexOf("relayCommand") != -1) {
        Serial.println("🔌 [RELAY] Command received: " + message);
        executeRelayCommand(message);
    }
}
#endif

// ================== HTTP FUNCTIONS - ROBUST VERSION ==================
bool sendDataHTTP() {
    if (!status.httpReady || !status.sensorsReady || !status.wifiConnected) return false;
    
    readSensors();
    
    String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/api/telemetry";
    
    // Configure HTTP client with timeout
    http.begin(wifiClient, url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("User-Agent", "ESP32-UAV-Dashboard/2.0");
    http.setTimeout(HTTP_TIMEOUT);
    
    // Create JSON data - compact format
    String jsonData = "{";
    jsonData += "\"battery_voltage\":" + String(sensors.batteryVoltage, 2) + ",";
    jsonData += "\"battery_current\":" + String(sensors.batteryCurrent, 2) + ",";
    jsonData += "\"battery_power\":" + String(sensors.batteryPower, 2) + ",";
    jsonData += "\"temperature\":" + String(sensors.temperature, 1) + ",";
    jsonData += "\"humidity\":" + String(sensors.humidity, 1) + ",";
    jsonData += "\"gps_latitude\":" + String(sensors.gpsLatitude, 6) + ",";
    jsonData += "\"gps_longitude\":" + String(sensors.gpsLongitude, 6) + ",";
    jsonData += "\"altitude\":" + String(sensors.altitude, 1) + ",";
    jsonData += "\"signal_strength\":" + String(WiFi.RSSI()) + ",";
    jsonData += "\"satellites\":" + String(sensors.satellites) + ",";
    jsonData += "\"timestamp\":" + String(millis()) + ",";
    jsonData += "\"packet_number\":" + String(status.totalDataPackets) + ",";
    jsonData += "\"device_id\":\"ESP32_UAV_DASHBOARD\",";
    jsonData += "\"connection_type\":\"HTTP\"";
    jsonData += "}";
    
    // Send POST request
    int httpResponseCode = http.POST(jsonData);
    
    // Handle response
    if (httpResponseCode == 200) {
        status.totalDataPackets++;
        Serial.println("📊 [HTTP] Telemetry sent successfully (Packet #" + String(status.totalDataPackets) + ")");
        printSensorData();
        status.lastError = "";
        
        // Get response body for debugging
        String response = http.getString();
        if (response.length() > 0) {
            Serial.println("    📨 Server response: " + response);
        }
        
        http.end();
        return true;
        
    } else if (httpResponseCode > 0) {
        // HTTP error code received
        String errorMsg = "HTTP Error " + String(httpResponseCode);
        Serial.println("❌ [HTTP] " + errorMsg);
        status.lastError = errorMsg;
        
    } else {
        // Connection error
        String errorMsg = "Connection failed: " + http.errorToString(httpResponseCode);
        Serial.println("❌ [HTTP] " + errorMsg);
        status.lastError = errorMsg;
        
        // Try to diagnose connection issue
        Serial.println("    🔍 Diagnosis: Check if server is running at " + url);
    }
    
    http.end();
    return false;
}

// ================== SENSOR FUNCTIONS ==================
void readSensors() {
    // Simulate sensor readings - GANTI DENGAN SENSOR ASLI
    sensors.batteryVoltage = 12.0 + (random(0, 200) / 100.0);  // 12.0-14.0V
    sensors.batteryCurrent = 1.0 + (random(0, 300) / 100.0);   // 1.0-4.0A  
    sensors.batteryPower = sensors.batteryVoltage * sensors.batteryCurrent;
    sensors.temperature = 20.0 + (random(0, 1500) / 100.0);    // 20-35°C
    sensors.humidity = 40.0 + (random(0, 4000) / 100.0);       // 40-80%
    sensors.altitude = 150.0 + (random(-20, 20));              // 130-170m
    
    // Small GPS movement simulation
    sensors.gpsLatitude += (random(-5, 5) / 100000.0);
    sensors.gpsLongitude += (random(-5, 5) / 100000.0);
    
    sensors.signalStrength = WiFi.RSSI();
}

void printSensorData() {
    Serial.println("    🔋 Battery: " + String(sensors.batteryVoltage, 1) + "V, " + 
                   String(sensors.batteryCurrent, 1) + "A, " + 
                   String(sensors.batteryPower, 1) + "W");
    Serial.println("    🌡️ Temp: " + String(sensors.temperature, 1) + "°C, " +
                   "Humidity: " + String(sensors.humidity, 1) + "%");
}

// ================== UTILITY FUNCTIONS - ENHANCED ==================
bool checkWiFiConnection() {
    // Check current WiFi status
    wl_status_t currentStatus = WiFi.status();
    
    if (currentStatus != WL_CONNECTED && status.wifiConnected) {
        // WiFi just disconnected
        status.wifiConnected = false;
        #if HAS_WEBSOCKETS
        status.websocketConnected = false;
        #endif
        Serial.println("❌ [WIFI] Connection lost! Attempting reconnection...");
        status.lastError = "WiFi disconnected";
        
        // Immediate reconnection attempt
        WiFi.disconnect();
        delay(1000);
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        
        return false;
        
    } else if (currentStatus == WL_CONNECTED && !status.wifiConnected) {
        // WiFi just reconnected
        status.wifiConnected = true;
        Serial.println("✅ [WIFI] Reconnected! IP: " + WiFi.localIP().toString());
        Serial.println("    📶 Signal: " + String(WiFi.RSSI()) + " dBm");
        status.lastError = "";
        
        // Test server connectivity after reconnection
        testServerConnectivity();
        
        return true;
        
    } else if (currentStatus == WL_CONNECTED) {
        // WiFi is connected and was already connected
        return true;
    }
    
    // Handle specific WiFi error states
    switch (currentStatus) {
        case WL_NO_SSID_AVAIL:
            Serial.println("❌ [WIFI] SSID '" + String(WIFI_SSID) + "' not found");
            status.lastError = "SSID not found: " + String(WIFI_SSID);
            break;
            
        case WL_CONNECT_FAILED:
            Serial.println("❌ [WIFI] Connection failed - wrong password?");
            status.lastError = "Connection failed - check password";
            break;
            
        case WL_CONNECTION_LOST:
            Serial.println("❌ [WIFI] Connection lost");
            status.lastError = "Connection lost";
            break;
            
        case WL_DISCONNECTED:
            // This is handled above
            break;
            
        default:
            Serial.println("❌ [WIFI] Unknown status: " + String(currentStatus));
            status.lastError = "Unknown WiFi error: " + String(currentStatus);
            break;
    }
    
    // Attempt reconnection if needed and enough time has passed
    if (!status.wifiConnected && millis() - lastWifiReconnect >= WIFI_RECONNECT_INTERVAL) {
        Serial.println("🔄 [WIFI] Scheduled reconnection attempt...");
        
        WiFi.disconnect();
        delay(2000);
        
        Serial.print("    Connecting to '" + String(WIFI_SSID) + "'...");
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        
        // Wait for connection with timeout
        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 20) {
            delay(500);
            Serial.print(".");
            attempts++;
        }
        
        if (WiFi.status() == WL_CONNECTED) {
            Serial.println(" ✅ SUCCESS!");
            status.wifiConnected = true;
            testServerConnectivity();
        } else {
            Serial.println(" ❌ FAILED");
        }
        
        lastWifiReconnect = millis();
    }
    
    return status.wifiConnected;
}

void executeRelayCommand(String command) {
    // Parse dan execute relay commands
    Serial.println("🔌 [RELAY] Executing command: " + command);
    
    // Add actual relay control code here
    // Example: digitalWrite(RELAY_PIN, HIGH/LOW);
    
    // Send confirmation back (if WebSocket available)
    #if HAS_WEBSOCKETS
    if (status.websocketConnected) {
        String response = "{\"type\":\"relayStatus\",\"command\":\"" + command + "\",\"status\":\"executed\"}";
        webSocket.send(response);
    }
    #endif
    
    Serial.println("✅ [RELAY] Command executed successfully");
}

void printSystemStatus() {
    Serial.println();
    Serial.println("📊 ============ SYSTEM STATUS ============");
    Serial.println("⏰ Uptime: " + String(millis() / 1000) + " seconds");
    Serial.println("📶 WiFi: " + String(status.wifiConnected ? "✅ CONNECTED" : "❌ DISCONNECTED"));
    
    if (status.wifiConnected) {
        Serial.println("    📍 IP: " + WiFi.localIP().toString());
        Serial.println("    📡 Signal: " + String(WiFi.RSSI()) + " dBm");
    }
    
    #if HAS_WEBSOCKETS
    Serial.println("🔗 WebSocket: " + String(status.websocketConnected ? "✅ CONNECTED" : "❌ DISCONNECTED"));
    Serial.println("🌐 Communication: WebSocket (Real-time)");
    #else
    Serial.println("🌐 Communication: HTTP (Polling)");
    #endif
    
    Serial.println("🔍 Sensors: " + String(status.sensorsReady ? "✅ READY" : "❌ NOT READY"));
    Serial.println("📦 Data packets sent: " + String(status.totalDataPackets));
    Serial.println("🔄 Connection attempts: " + String(status.connectionAttempts));
    
    if (status.lastError != "") {
        Serial.println("⚠️ Last error: " + status.lastError);
    }
    
    Serial.println("==========================================");
    Serial.println();
}
