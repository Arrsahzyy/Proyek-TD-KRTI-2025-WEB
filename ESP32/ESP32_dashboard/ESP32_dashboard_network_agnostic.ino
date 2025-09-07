/**
 * ESP32 UAV Telemetry - NETWORK AGNOSTIC VERSION
 * Auto-discovery + Cloud fallback solution
 * Mendukung multiple network tanpa hard-coded IP
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <PubSubClient.h> // MQTT library
#include <Preferences.h>  // For storing last known config

// ================== NETWORK CONFIGURATION ==================
// WiFi credentials - bisa multiple networks
struct WiFiNetwork {
    const char* ssid;
    const char* password;
};

WiFiNetwork availableNetworks[] = {
    {"Redmi13", "12345678"},
    {"YourHomeWiFi", "password123"},
    {"YourOfficeWiFi", "office_pass"},
    // Add more networks as needed
};
const int numNetworks = sizeof(availableNetworks) / sizeof(availableNetworks[0]);

// ================== SERVER DISCOVERY CONFIGURATION ==================
// Multiple connection methods
enum ConnectionMode {
    MODE_LOCAL_DISCOVERY,   // mDNS + Network scan
    MODE_CLOUD_MQTT,       // MQTT broker
    MODE_LAST_KNOWN,       // Cached IP address
    MODE_MANUAL            // Fallback manual config
};

// MQTT Configuration (HiveMQ free tier)
const char* mqtt_server = "broker.hivemq.com";  // Free MQTT broker
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP32_UAV_Dashboard";
const char* mqtt_topic_telemetry = "uav/dashboard/telemetry";
const char* mqtt_topic_commands = "uav/dashboard/commands";

// ================== GLOBAL VARIABLES ==================
HTTPClient http;
WiFiClient wifiClient;
WebSocketsClient webSocket;
PubSubClient mqttClient(wifiClient);
Preferences preferences;

// Current connection state
struct ConnectionState {
    ConnectionMode currentMode = MODE_LOCAL_DISCOVERY;
    String serverIP = "";
    int serverPort = 3000;
    bool wifiConnected = false;
    bool serverConnected = false;
    bool mqttConnected = false;
    String lastError = "";
    unsigned long lastConnectionAttempt = 0;
    int connectionAttempts = 0;
} connectionState;

// Sensor data structure (same as before)
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

// Timing constants
const unsigned long DATA_SEND_INTERVAL = 5000;
const unsigned long CONNECTION_RETRY_INTERVAL = 30000;
const unsigned long NETWORK_SCAN_TIMEOUT = 20000;

unsigned long lastDataSent = 0;
unsigned long lastStatusPrint = 0;

// ================== SETUP ==================
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    printWelcomeBanner();
    
    // Initialize preferences for storing last known config
    preferences.begin("uav-config", false);
    
    // Load last known configuration
    loadLastKnownConfig();
    
    // Initialize sensors
    initializeSensors();
    
    // Setup MQTT
    mqttClient.setServer(mqtt_server, mqtt_port);
    mqttClient.setCallback(mqttCallback);
    
    // Start connection process
    initializeConnections();
}

// ================== MAIN LOOP ==================
void loop() {
    // 1. Maintain WiFi connection
    maintainWiFiConnection();
    
    if (!connectionState.wifiConnected) {
        delay(2000);
        return;
    }
    
    // 2. Maintain server connection based on current mode
    maintainServerConnection();
    
    // 3. Send telemetry data
    if (millis() - lastDataSent >= DATA_SEND_INTERVAL) {
        sendTelemetryData();
        lastDataSent = millis();
    }
    
    // 4. Handle MQTT if in cloud mode
    if (connectionState.currentMode == MODE_CLOUD_MQTT) {
        mqttClient.loop();
    }
    
    // 5. Print status
    if (millis() - lastStatusPrint >= 10000) {
        printConnectionStatus();
        lastStatusPrint = millis();
    }
    
    delay(100);
}

// ================== WIFI MANAGEMENT ==================
void maintainWiFiConnection() {
    if (WiFi.status() == WL_CONNECTED) {
        if (!connectionState.wifiConnected) {
            connectionState.wifiConnected = true;
            Serial.println("✅ [WIFI] Connected to: " + WiFi.SSID());
            Serial.println("    📍 IP: " + WiFi.localIP().toString());
            Serial.println("    📶 Signal: " + String(WiFi.RSSI()) + " dBm");
        }
        return;
    }
    
    // WiFi disconnected
    if (connectionState.wifiConnected) {
        Serial.println("❌ [WIFI] Connection lost!");
        connectionState.wifiConnected = false;
        connectionState.serverConnected = false;
        connectionState.mqttConnected = false;
    }
    
    // Try to connect to available networks
    connectToAvailableNetwork();
}

void connectToAvailableNetwork() {
    Serial.println("🔍 [WIFI] Scanning for available networks...");
    
    // Scan for networks
    int networkCount = WiFi.scanNetworks();
    if (networkCount == 0) {
        Serial.println("❌ [WIFI] No networks found");
        return;
    }
    
    // Try to connect to known networks
    for (int i = 0; i < numNetworks; i++) {
        // Check if this network is available
        for (int j = 0; j < networkCount; j++) {
            if (WiFi.SSID(j) == String(availableNetworks[i].ssid)) {
                Serial.println("🔗 [WIFI] Attempting: " + String(availableNetworks[i].ssid));
                
                WiFi.begin(availableNetworks[i].ssid, availableNetworks[i].password);
                
                // Wait for connection
                int attempts = 0;
                while (WiFi.status() != WL_CONNECTED && attempts < 20) {
                    delay(500);
                    Serial.print(".");
                    attempts++;
                }
                
                if (WiFi.status() == WL_CONNECTED) {
                    Serial.println(" ✅ SUCCESS!");
                    connectionState.wifiConnected = true;
                    
                    // Save successful network
                    preferences.putString("last_ssid", availableNetworks[i].ssid);
                    preferences.putString("last_pass", availableNetworks[i].password);
                    return;
                }
                
                Serial.println(" ❌ Failed");
                WiFi.disconnect();
            }
        }
    }
    
    Serial.println("❌ [WIFI] No known networks available");
}

// ================== SERVER DISCOVERY & CONNECTION ==================
void maintainServerConnection() {
    if (connectionState.serverConnected || connectionState.mqttConnected) {
        return; // Already connected
    }
    
    // Try connection based on current mode
    switch (connectionState.currentMode) {
        case MODE_LAST_KNOWN:
            tryLastKnownServer();
            break;
            
        case MODE_LOCAL_DISCOVERY:
            tryLocalDiscovery();
            break;
            
        case MODE_CLOUD_MQTT:
            tryCloudConnection();
            break;
            
        case MODE_MANUAL:
            // This would be handled by user input or config
            break;
    }
}

void tryLastKnownServer() {
    if (connectionState.serverIP.length() > 0) {
        Serial.println("🔍 [DISCOVERY] Trying last known server: " + connectionState.serverIP);
        
        if (testServerConnection(connectionState.serverIP, connectionState.serverPort)) {
            connectToServer(connectionState.serverIP, connectionState.serverPort);
            return;
        }
    }
    
    // Last known failed, try discovery
    connectionState.currentMode = MODE_LOCAL_DISCOVERY;
}

void tryLocalDiscovery() {
    Serial.println("🔍 [DISCOVERY] Starting local network discovery...");
    
    // Method 1: Try mDNS
    String mdnsServer = discoverViaMDNS();
    if (mdnsServer.length() > 0) {
        if (connectToServer(mdnsServer, 3000)) {
            return;
        }
    }
    
    // Method 2: Network scanning
    String scannedServer = scanLocalNetwork();
    if (scannedServer.length() > 0) {
        if (connectToServer(scannedServer, 3000)) {
            return;
        }
    }
    
    // Local discovery failed, switch to cloud mode
    Serial.println("❌ [DISCOVERY] Local discovery failed, switching to cloud mode");
    connectionState.currentMode = MODE_CLOUD_MQTT;
}

void tryCloudConnection() {
    Serial.println("☁️ [MQTT] Connecting to cloud broker...");
    
    if (mqttClient.connect(mqtt_client_id)) {
        Serial.println("✅ [MQTT] Connected to cloud broker");
        connectionState.mqttConnected = true;
        connectionState.lastError = "";
        
        // Subscribe to command topic
        mqttClient.subscribe(mqtt_topic_commands);
        
        return;
    }
    
    Serial.println("❌ [MQTT] Cloud connection failed");
    connectionState.lastError = "MQTT connection failed";
    
    // Fallback to manual/retry local
    connectionState.currentMode = MODE_LOCAL_DISCOVERY;
}

// ================== DISCOVERY METHODS ==================
String discoverViaMDNS() {
    if (!MDNS.begin("esp32-uav")) {
        Serial.println("❌ [mDNS] Failed to start");
        return "";
    }
    
    Serial.println("🔍 [mDNS] Searching for UAV dashboard service...");
    
    int serviceCount = MDNS.queryService("uav-dashboard", "tcp");
    if (serviceCount > 0) {
        String serverIP = MDNS.IP(0).toString();
        int serverPort = MDNS.port(0);
        
        Serial.println("✅ [mDNS] Found server: " + serverIP + ":" + String(serverPort));
        return serverIP;
    }
    
    Serial.println("❌ [mDNS] No services found");
    return "";
}

String scanLocalNetwork() {
    Serial.println("🔍 [SCAN] Scanning local network for dashboard server...");
    
    String localIP = WiFi.localIP().toString();
    String networkBase = localIP.substring(0, localIP.lastIndexOf('.') + 1);
    
    // Scan common IPs first (router, common static IPs)
    int quickScanIPs[] = {1, 100, 101, 102, 150, 200, 254};
    for (int ip : quickScanIPs) {
        String testIP = networkBase + String(ip);
        if (testServerConnection(testIP, 3000)) {
            Serial.println("✅ [SCAN] Found server: " + testIP);
            return testIP;
        }
    }
    
    // If quick scan fails, do full scan (optional, can be slow)
    Serial.println("🔍 [SCAN] Quick scan failed, trying full network scan...");
    for (int i = 1; i <= 254; i++) {
        String testIP = networkBase + String(i);
        if (testServerConnection(testIP, 3000)) {
            Serial.println("✅ [SCAN] Found server: " + testIP);
            return testIP;
        }
        
        // Avoid watchdog timeout
        if (i % 10 == 0) {
            delay(10);
            yield();
        }
    }
    
    Serial.println("❌ [SCAN] No server found on local network");
    return "";
}

// ================== CONNECTION HELPERS ==================
bool testServerConnection(String ip, int port) {
    HTTPClient testHttp;
    testHttp.begin(wifiClient, "http://" + ip + ":" + String(port) + "/");
    testHttp.setTimeout(2000); // Quick timeout for scanning
    
    int httpCode = testHttp.GET();
    testHttp.end();
    
    return (httpCode > 0);
}

bool connectToServer(String ip, int port) {
    connectionState.serverIP = ip;
    connectionState.serverPort = port;
    
    // Save successful connection
    preferences.putString("last_server_ip", ip);
    preferences.putInt("last_server_port", port);
    
    // TODO: Setup WebSocket connection here
    connectionState.serverConnected = true;
    connectionState.currentMode = MODE_LAST_KNOWN; // Remember this works
    
    Serial.println("✅ [CONNECTION] Connected to server: " + ip + ":" + String(port));
    return true;
}

// ================== DATA TRANSMISSION ==================
void sendTelemetryData() {
    readSensors();
    
    if (connectionState.mqttConnected) {
        sendDataViaMQTT();
    } else if (connectionState.serverConnected) {
        sendDataViaHTTP();
    } else {
        Serial.println("⚠️ [DATA] No active connection for sending data");
    }
}

void sendDataViaMQTT() {
    // Create JSON payload
    String jsonData = createTelemetryJSON();
    
    if (mqttClient.publish(mqtt_topic_telemetry, jsonData.c_str())) {
        Serial.println("📊 [MQTT] Telemetry sent to cloud");
    } else {
        Serial.println("❌ [MQTT] Failed to send telemetry");
        connectionState.mqttConnected = false;
    }
}

void sendDataViaHTTP() {
    String url = "http://" + connectionState.serverIP + ":" + String(connectionState.serverPort) + "/api/telemetry";
    
    http.begin(wifiClient, url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(5000);
    
    String jsonData = createTelemetryJSON();
    int httpCode = http.POST(jsonData);
    
    if (httpCode == 200) {
        Serial.println("📊 [HTTP] Telemetry sent to local server");
    } else {
        Serial.println("❌ [HTTP] Failed to send telemetry: " + String(httpCode));
        connectionState.serverConnected = false;
    }
    
    http.end();
}

String createTelemetryJSON() {
    String json = "{";
    json += "\"battery_voltage\":" + String(sensors.batteryVoltage, 2) + ",";
    json += "\"battery_current\":" + String(sensors.batteryCurrent, 2) + ",";
    json += "\"battery_power\":" + String(sensors.batteryPower, 2) + ",";
    json += "\"temperature\":" + String(sensors.temperature, 1) + ",";
    json += "\"humidity\":" + String(sensors.humidity, 1) + ",";
    json += "\"gps_latitude\":" + String(sensors.gpsLatitude, 6) + ",";
    json += "\"gps_longitude\":" + String(sensors.gpsLongitude, 6) + ",";
    json += "\"altitude\":" + String(sensors.altitude, 1) + ",";
    json += "\"signal_strength\":" + String(WiFi.RSSI()) + ",";
    json += "\"satellites\":" + String(sensors.satellites) + ",";
    json += "\"timestamp\":" + String(millis()) + ",";
    json += "\"connection_mode\":\"" + getModeString() + "\"";
    json += "}";
    return json;
}

// ================== UTILITY FUNCTIONS ==================
void loadLastKnownConfig() {
    connectionState.serverIP = preferences.getString("last_server_ip", "");
    connectionState.serverPort = preferences.getInt("last_server_port", 3000);
    
    if (connectionState.serverIP.length() > 0) {
        Serial.println("📋 [CONFIG] Loaded last known server: " + connectionState.serverIP);
    }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String message = "";
    for (int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    
    Serial.println("📨 [MQTT] Received command: " + message);
    // TODO: Process received commands
}

void readSensors() {
    // Simulate sensor readings (replace with real sensors)
    sensors.batteryVoltage = 12.0 + (random(0, 200) / 100.0);
    sensors.batteryCurrent = 1.0 + (random(0, 300) / 100.0);
    sensors.batteryPower = sensors.batteryVoltage * sensors.batteryCurrent;
    sensors.temperature = 20.0 + (random(0, 1500) / 100.0);
    sensors.humidity = 40.0 + (random(0, 4000) / 100.0);
    sensors.altitude = 150.0 + (random(-20, 20));
    sensors.gpsLatitude += (random(-5, 5) / 100000.0);
    sensors.gpsLongitude += (random(-5, 5) / 100000.0);
    sensors.signalStrength = WiFi.RSSI();
}

void initializeSensors() {
    // Initialize real sensors here
    Serial.println("🔍 [SENSORS] Initializing sensors...");
    delay(500);
    Serial.println("✅ [SENSORS] Ready");
}

String getModeString() {
    switch (connectionState.currentMode) {
        case MODE_LOCAL_DISCOVERY: return "Local Discovery";
        case MODE_CLOUD_MQTT: return "Cloud MQTT";
        case MODE_LAST_KNOWN: return "Last Known";
        case MODE_MANUAL: return "Manual";
        default: return "Unknown";
    }
}

void printWelcomeBanner() {
    Serial.println();
    Serial.println("🚀========================================🚀");
    Serial.println("    ESP32 UAV - NETWORK AGNOSTIC VERSION");
    Serial.println("   Auto-Discovery + Cloud Fallback Ready!");
    Serial.println("🚀========================================🚀");
    Serial.println();
}

void printConnectionStatus() {
    Serial.println();
    Serial.println("📊 ========== CONNECTION STATUS ==========");
    Serial.println("📶 WiFi: " + String(connectionState.wifiConnected ? "✅ " + WiFi.SSID() : "❌ Disconnected"));
    if (connectionState.wifiConnected) {
        Serial.println("    📍 IP: " + WiFi.localIP().toString());
        Serial.println("    📡 Signal: " + String(WiFi.RSSI()) + " dBm");
    }
    
    Serial.println("🔗 Mode: " + getModeString());
    
    if (connectionState.serverConnected) {
        Serial.println("🌐 Server: ✅ " + connectionState.serverIP + ":" + String(connectionState.serverPort));
    } else if (connectionState.mqttConnected) {
        Serial.println("☁️ MQTT: ✅ Connected to cloud broker");
    } else {
        Serial.println("❌ Connection: No active connection");
    }
    
    if (connectionState.lastError.length() > 0) {
        Serial.println("⚠️ Last Error: " + connectionState.lastError);
    }
    
    Serial.println("==========================================");
    Serial.println();
}
