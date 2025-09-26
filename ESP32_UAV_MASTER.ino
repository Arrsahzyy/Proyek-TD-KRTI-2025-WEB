/**
 * ===============================================================================
 * ESP32 UAV TELEMETRY SYSTEM - MASTER VERSION (UNIFIED)
 * ===============================================================================
 * 
 * This is the unified master version that combines all features from:
 * - ESP32_DEBUG_VERSION.ino (Advanced debugging and network diagnostics)
 * - KODEESP32UNTUKWEB.ino (WebSocket communication)
 * - KODEESP32UNTUKWEB_SIMPLIFIED.ino (Simplified HTTP-only mode)
 * 
 * Hardware Configuration:
 * - GPS Module: RX->Pin16, TX->Pin17
 * - INA219 Current Sensor: SDA->Pin21, SCL->Pin22  
 * - Relay Control: Pin5
 * - Status LED: Pin2 (Built-in)
 * 
 * Features:
 * - Dual communication modes: WebSocket + HTTP fallback
 * - Advanced debugging and network diagnostics
 * - Real-time telemetry transmission to web dashboard
 * - GPS location tracking with satellite information
 * - Battery monitoring with INA219 current sensor
 * - Relay control for emergency functions
 * - WiFi connectivity with intelligent auto-reconnect
 * - Comprehensive error handling and recovery
 * - Serial command interface for manual testing
 * - Multiple operating modes (Debug/Production)
 * 
 * @author KRTI Team  
 * @version 2.0.0 - MASTER UNIFIED
 * @date 2025
 */

// =============================================================================
// LIBRARIES & DEPENDENCIES
// =============================================================================
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <HardwareSerial.h>
#include <Wire.h>
#include <Adafruit_INA219.h>
#include <TinyGPS++.h>

// =============================================================================
// CONFIGURATION MODES - UBAH SESUAI KEBUTUHAN
// =============================================================================
#define DEBUG_MODE true                    // Enable/disable debug logging
#define ENABLE_WEBSOCKET true              // Enable WebSocket (false = HTTP only)
#define ENABLE_DETAILED_DIAGNOSTICS true   // Enable detailed network diagnostics

// =============================================================================
// HARDWARE PIN CONFIGURATION
// =============================================================================
#define GPS_RX_PIN 16                     // GPS Module RX Pin
#define GPS_TX_PIN 17                     // GPS Module TX Pin
#define SDA_PIN 21                        // I2C SDA Pin (INA219)
#define SCL_PIN 22                        // I2C SCL Pin (INA219)
#define RELAY_PIN 5                       // Relay Control Pin
#define LED_PIN 2                         // Status LED Pin (Built-in)

// =============================================================================
// NETWORK CONFIGURATION - SESUAIKAN DENGAN SETUP ANDA
// =============================================================================
const char* ssid = "Redmi13";                    // WiFi SSID Anda
const char* password = "12345678";               // WiFi Password Anda
const char* serverHost = "10.86.58.211";        // IP Komputer Dashboard
const int serverPort = 3003;                    // Port Server
const String telemetryEndpoint = "/api/telemetry";
const String commandResponseEndpoint = "/api/command-response";

// =============================================================================
// GLOBAL OBJECTS
// =============================================================================
HardwareSerial gpsSerial(2);             // Hardware Serial untuk GPS
TinyGPSPlus gps;                         // GPS Parser
Adafruit_INA219 ina219;                  // Current Sensor
WebSocketsClient webSocket;              // WebSocket Client
HTTPClient http;                         // HTTP Client

// =============================================================================
// SYSTEM STATE STRUCTURE
// =============================================================================
struct SystemState {
  // Connection status
  bool wifiConnected = false;
  bool serverConnected = false;
  bool webSocketConnected = false;
  
  // Hardware status
  bool gpsValid = false;
  bool ina219Ready = false;
  
  // Timing variables
  unsigned long lastTelemetrySent = 0;
  unsigned long lastConnectionCheck = 0;
  unsigned long lastServerTest = 0;
  unsigned long lastStatusPrint = 0;
  
  // Statistics
  unsigned long packetNumber = 0;
  unsigned long successfulPackets = 0;
  unsigned long failedPackets = 0;
  int reconnectAttempts = 0;
  int httpErrorCount = 0;
  
  // Device state
  bool relayState = false;
  
  // Error tracking
  String lastError = "";
  unsigned long lastErrorTime = 0;
  
  // Communication mode
  String communicationMode = "HTTP";  // "HTTP" or "WebSocket"
} systemState;

// =============================================================================
// TELEMETRY DATA STRUCTURE
// =============================================================================
struct TelemetryData {
  // Battery data from INA219
  float battery_voltage = 0.0;
  float battery_current = 0.0;
  float battery_power = 0.0;
  
  // GPS data
  double gps_latitude = -5.358400;      // Default ITERA coordinates
  double gps_longitude = 105.311700;
  float altitude = 0.0;
  float speed = 0.0;
  int satellites = 0;
  
  // Environmental data (dapat diperluas dengan sensor tambahan)
  float temperature = 25.0;
  float humidity = 60.0;
  
  // System data
  int signal_strength = 0;
  unsigned long timestamp = 0;
  String connection_status = "disconnected";
  String connection_type = "none";
  unsigned long packet_number = 0;
} telemetryData;

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================
const unsigned long TELEMETRY_INTERVAL = 3000;           // Send telemetry every 3 seconds
const unsigned long CONNECTION_CHECK_INTERVAL = 15000;   // Check connection every 15 seconds
const unsigned long SERVER_TEST_INTERVAL = 30000;       // Test server every 30 seconds
const unsigned long STATUS_PRINT_INTERVAL = 60000;      // Print status every minute
const unsigned long WIFI_RETRY_INTERVAL = 30000;        // WiFi retry interval
const int MAX_RECONNECT_ATTEMPTS = 5;                   // Maximum reconnection attempts
const int WEBSOCKET_RECONNECT_INTERVAL = 5000;          // WebSocket reconnect interval

// =============================================================================
// SETUP FUNCTION
// =============================================================================
void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  delay(2000);  // Give time for serial monitor to connect
  
  // Print startup banner
  printStartupBanner();
  
  // Initialize hardware components
  initializePins();
  initializeI2C();
  initializeGPS();
  initializeINA219();
  
  // Initialize network connectivity
  initializeWiFiWithDiagnostics();
  
  // Initialize communication methods
  if (systemState.wifiConnected) {
    testServerConnectivity();
    
    if (ENABLE_WEBSOCKET && systemState.serverConnected) {
      initializeWebSocket();
    }
  }
  
  // Print system summary
  printSystemSummary();
  
  Serial.println("✅ ESP32 initialization completed!");
  Serial.println("📡 Starting telemetry transmission...\n");
  
  // Initial status indication
  blinkLED(3, 300);
}

// =============================================================================
// MAIN LOOP
// =============================================================================
void loop() {
  unsigned long currentTime = millis();
  
  // Handle WebSocket events if enabled
  if (ENABLE_WEBSOCKET) {
    webSocket.loop();
  }
  
  // Check connections periodically
  if (currentTime - systemState.lastConnectionCheck > CONNECTION_CHECK_INTERVAL) {
    checkAllConnections();
    systemState.lastConnectionCheck = currentTime;
  }
  
  // Test server connectivity periodically
  if (currentTime - systemState.lastServerTest > SERVER_TEST_INTERVAL) {
    if (systemState.wifiConnected) {
      testServerConnectivity();
    }
    systemState.lastServerTest = currentTime;
  }
  
  // Read all sensor data
  readAllSensors();
  
  // Send telemetry data
  if (currentTime - systemState.lastTelemetrySent > TELEMETRY_INTERVAL) {
    sendTelemetryData();
    systemState.lastTelemetrySent = currentTime;
  }
  
  // Update status LED
  updateStatusLED();
  
  // Print status report periodically
  if (DEBUG_MODE && currentTime - systemState.lastStatusPrint > STATUS_PRINT_INTERVAL) {
    printDetailedStatusReport();
    systemState.lastStatusPrint = currentTime;
  }
  
  // Process serial commands for manual control
  processSerialCommands();
  
  // Prevent watchdog reset
  delay(100);
}

// =============================================================================
// STARTUP & INITIALIZATION FUNCTIONS
// =============================================================================
void printStartupBanner() {
  Serial.println();
  Serial.println("======================================================================");
  Serial.println("🚁 ESP32 UAV TELEMETRY SYSTEM - MASTER VERSION");
  Serial.println("📋 KRTI Team - Unified & Enhanced Version 2.0.0");
  Serial.println("======================================================================");
  Serial.println("🔧 Configuration:");
  Serial.println("   Debug Mode: " + String(DEBUG_MODE ? "✅ Enabled" : "❌ Disabled"));
  Serial.println("   WebSocket: " + String(ENABLE_WEBSOCKET ? "✅ Enabled" : "❌ Disabled"));
  Serial.println("   Diagnostics: " + String(ENABLE_DETAILED_DIAGNOSTICS ? "✅ Enabled" : "❌ Disabled"));
  Serial.println("======================================================================");
}

void initializePins() {
  Serial.println("🔧 Initializing GPIO pins...");
  
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  
  digitalWrite(RELAY_PIN, LOW);  // Relay off initially
  digitalWrite(LED_PIN, LOW);    // LED off initially
  
  systemState.relayState = false;
  
  Serial.println("   ✅ GPIO pins configured successfully");
}

void initializeI2C() {
  Serial.println("🔧 Initializing I2C interface...");
  
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);  // 100kHz for stability
  
  Serial.println("   ✅ I2C ready on SDA:" + String(SDA_PIN) + " SCL:" + String(SCL_PIN));
}

void initializeGPS() {
  Serial.println("🔧 Initializing GPS module...");
  
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  
  Serial.println("   ✅ GPS ready on RX:" + String(GPS_RX_PIN) + " TX:" + String(GPS_TX_PIN));
  Serial.println("   ⏳ Waiting for GPS satellite lock...");
}

void initializeINA219() {
  Serial.println("🔧 Initializing INA219 current sensor...");
  
  if (ina219.begin()) {
    systemState.ina219Ready = true;
    ina219.setCalibration_32V_2A();  // Configure for 32V, 2A max
    Serial.println("   ✅ INA219 sensor ready and calibrated");
  } else {
    systemState.ina219Ready = false;
    Serial.println("   ⚠️ INA219 sensor not detected - using simulated data");
  }
}

// =============================================================================
// ENHANCED WIFI INITIALIZATION WITH DIAGNOSTICS
// =============================================================================
void initializeWiFiWithDiagnostics() {
  Serial.println("🔧 Starting enhanced WiFi initialization...");
  Serial.println("   📡 Target SSID: " + String(ssid));
  Serial.println("   🔑 Password: " + String(password).substring(0, 3) + "****");
  Serial.println("   🎯 Server: " + String(serverHost) + ":" + String(serverPort));
  
  // Reset WiFi configuration
  WiFi.disconnect(true);
  delay(1000);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  
  // Scan for available networks if diagnostics enabled
  if (ENABLE_DETAILED_DIAGNOSTICS) {
    scanAvailableNetworks();
  }
  
  // Attempt connection
  Serial.println("   🔗 Attempting WiFi connection...");
  WiFi.begin(ssid, password);
  
  // Wait for connection with detailed feedback
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
    
    if (attempts % 10 == 0) {
      Serial.println();
      Serial.println("   ⏰ Connection attempt " + String(attempts) + "/30");
      Serial.println("   📊 WiFi Status: " + getWiFiStatusString());
    }
  }
  
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    systemState.wifiConnected = true;
    Serial.println("   ✅ WiFi connected successfully!");
    printConnectionDetails();
    
    if (ENABLE_DETAILED_DIAGNOSTICS) {
      testNetworkConnectivity();
    }
  } else {
    systemState.wifiConnected = false;
    Serial.println("   ❌ WiFi connection failed!");
    printConnectionFailureInfo();
  }
}

void scanAvailableNetworks() {
  Serial.println("   🔍 Scanning for available networks...");
  int networkCount = WiFi.scanNetworks();
  
  if (networkCount == 0) {
    Serial.println("   ⚠️ No networks found");
  } else {
    Serial.println("   📡 Found " + String(networkCount) + " networks:");
    for (int i = 0; i < networkCount; i++) {
      String security = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "Open" : "Secured";
      Serial.println("     " + String(i + 1) + ". " + WiFi.SSID(i) + 
                    " (RSSI: " + String(WiFi.RSSI(i)) + " dBm, " + security + ")");
    }
  }
}

void printConnectionDetails() {
  Serial.println("   📍 Connection Details:");
  Serial.println("     Local IP: " + WiFi.localIP().toString());
  Serial.println("     Gateway: " + WiFi.gatewayIP().toString());
  Serial.println("     Subnet: " + WiFi.subnetMask().toString());
  Serial.println("     DNS: " + WiFi.dnsIP().toString());
  Serial.println("     MAC Address: " + WiFi.macAddress());
  Serial.println("     📶 Signal Strength: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("     🔐 Security: " + getWiFiEncryptionType());
}

void printConnectionFailureInfo() {
  Serial.println("   ❌ Connection Failed - Diagnostic Info:");
  Serial.println("     Status: " + getWiFiStatusString());
  Serial.println("     MAC Address: " + WiFi.macAddress());
  Serial.println("   💡 Troubleshooting suggestions:");
  Serial.println("     1. Verify SSID and password are correct");
  Serial.println("     2. Check if network is 2.4GHz (ESP32 doesn't support 5GHz)");
  Serial.println("     3. Ensure network is not hidden or MAC filtered");
  Serial.println("     4. Try moving closer to the router");
}

void testNetworkConnectivity() {
  Serial.println("   🌐 Testing network connectivity...");
  
  // Test DNS resolution
  IPAddress googleDNS;
  if (WiFi.hostByName("google.com", googleDNS)) {
    Serial.println("     ✅ DNS resolution working");
  } else {
    Serial.println("     ❌ DNS resolution failed");
  }
  
  // Test internet connectivity
  HTTPClient testHttp;
  testHttp.begin("http://httpbin.org/ip");
  testHttp.setTimeout(5000);
  
  int httpCode = testHttp.GET();
  if (httpCode == 200) {
    Serial.println("     ✅ Internet connectivity confirmed");
  } else {
    Serial.println("     ⚠️ Internet connectivity issue (Code: " + String(httpCode) + ")");
  }
  testHttp.end();
}

// =============================================================================
// SERVER CONNECTIVITY TESTING
// =============================================================================
void testServerConnectivity() {
  if (!systemState.wifiConnected) {
    systemState.serverConnected = false;
    return;
  }
  
  if (DEBUG_MODE) {
    Serial.println("🔍 Testing server connectivity...");
  }
  
  HTTPClient testHttp;
  String testUrl = "http://" + String(serverHost) + ":" + String(serverPort) + "/";
  
  testHttp.begin(testUrl);
  testHttp.setTimeout(5000);
  
  int httpCode = testHttp.GET();
  testHttp.end();
  
  if (httpCode > 0) {
    systemState.serverConnected = true;
    if (DEBUG_MODE) {
      Serial.println("   ✅ Server is reachable (HTTP " + String(httpCode) + ")");
    }
  } else {
    systemState.serverConnected = false;
    if (DEBUG_MODE) {
      Serial.println("   ❌ Server unreachable (Error: " + String(httpCode) + ")");
      Serial.println("   💡 Check if dashboard server is running on " + 
                    String(serverHost) + ":" + String(serverPort));
    }
  }
}

// =============================================================================
// WEBSOCKET INITIALIZATION AND HANDLING
// =============================================================================
void initializeWebSocket() {
  if (!ENABLE_WEBSOCKET || !systemState.serverConnected) {
    return;
  }
  
  Serial.println("🔌 Initializing WebSocket connection...");
  
  webSocket.begin(serverHost, serverPort, "/ws");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(WEBSOCKET_RECONNECT_INTERVAL);
  
  systemState.communicationMode = "WebSocket";
  Serial.println("   ⏳ WebSocket client configured, attempting connection...");
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      systemState.webSocketConnected = false;
      systemState.communicationMode = "HTTP";
      if (DEBUG_MODE) {
        Serial.println("🔌 WebSocket disconnected - falling back to HTTP");
      }
      break;
      
    case WStype_CONNECTED:
      systemState.webSocketConnected = true;
      systemState.communicationMode = "WebSocket";
      if (DEBUG_MODE) {
        Serial.println("🔌 WebSocket connected to: " + String((char*)payload));
      }
      sendESP32Info();
      break;
      
    case WStype_TEXT:
      if (DEBUG_MODE) {
        Serial.println("📨 WebSocket message: " + String((char*)payload));
      }
      handleWebSocketMessage(String((char*)payload));
      break;
      
    case WStype_ERROR:
      if (DEBUG_MODE) {
        Serial.println("❌ WebSocket error occurred");
      }
      systemState.webSocketConnected = false;
      systemState.communicationMode = "HTTP";
      break;
      
    default:
      break;
  }
}

void sendESP32Info() {
  DynamicJsonDocument doc(512);
  doc["deviceType"] = "ESP32";
  doc["deviceId"] = WiFi.macAddress();
  doc["firmware"] = "2.0.0-MASTER";
  doc["capabilities"] = "GPS,INA219,Relay";
  doc["debugMode"] = DEBUG_MODE;
  doc["webSocketEnabled"] = ENABLE_WEBSOCKET;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  webSocket.sendTXT("esp32Connect:" + jsonString);
}

void handleWebSocketMessage(String message) {
  if (message.startsWith("esp32Command:") || message.startsWith("relayCommand:")) {
    String jsonPart = message.substring(message.indexOf(":") + 1);
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, jsonPart);
    
    if (error) {
      if (DEBUG_MODE) {
        Serial.println("❌ JSON parsing failed: " + String(error.c_str()));
      }
      return;
    }
    
    String command = doc["command"];
    String action = doc["action"];
    
    if (command == "relay" || command == "emergency") {
      handleRelayCommand(action);
      sendCommandResponse(command, action, "executed");
    } else if (command == "reboot") {
      Serial.println("🔄 Reboot command received via WebSocket");
      delay(1000);
      ESP.restart();
    }
  }
}

// =============================================================================
// SENSOR READING FUNCTIONS
// =============================================================================
void readAllSensors() {
  // Read GPS data
  readGPSData();
  
  // Read battery data from INA219
  readINA219Data();
  
  // Update system data
  telemetryData.signal_strength = WiFi.RSSI();
  telemetryData.timestamp = millis();
  telemetryData.packet_number = systemState.packetNumber;
  
  // Update connection status
  if (systemState.wifiConnected && systemState.serverConnected) {
    telemetryData.connection_status = "connected";
    telemetryData.connection_type = systemState.communicationMode;
  } else if (systemState.wifiConnected) {
    telemetryData.connection_status = "wifi_only";
    telemetryData.connection_type = "none";
  } else {
    telemetryData.connection_status = "disconnected";
    telemetryData.connection_type = "none";
  }
}

void readGPSData() {
  while (gpsSerial.available() > 0) {
    if (gps.encode(gpsSerial.read())) {
      if (gps.location.isValid()) {
        telemetryData.gps_latitude = gps.location.lat();
        telemetryData.gps_longitude = gps.location.lng();
        systemState.gpsValid = true;
      }
      
      if (gps.altitude.isValid()) {
        telemetryData.altitude = gps.altitude.meters();
      }
      
      if (gps.speed.isValid()) {
        telemetryData.speed = gps.speed.kmph();
      }
      
      if (gps.satellites.isValid()) {
        telemetryData.satellites = gps.satellites.value();
      }
    }
  }
  
  // Check GPS validity timeout (no valid data for 30 seconds)
  static unsigned long lastValidGPS = 0;
  if (systemState.gpsValid) {
    lastValidGPS = millis();
  } else if (millis() - lastValidGPS > 30000) {
    systemState.gpsValid = false;
  }
}

void readINA219Data() {
  if (systemState.ina219Ready) {
    // Read INA219 sensor data with error checking
    float voltage = ina219.getBusVoltage_V();
    float current = ina219.getCurrent_mA();
    float power = ina219.getPower_mW();
    
    // Check if readings are valid (not NaN or extreme values)
    if (!isnan(voltage) && !isnan(current) && !isnan(power) && 
        voltage >= 0 && voltage <= 50 && current >= -5000 && current <= 5000) {
      telemetryData.battery_voltage = voltage;
      telemetryData.battery_current = current;
      telemetryData.battery_power = power;
    } else {
      // If sensor reading fails, mark as not ready
      systemState.ina219Ready = false;
      if (DEBUG_MODE) {
        Serial.println("⚠️ INA219 reading error - invalid data detected");
      }
    }
  } else {
    // Simulate battery data if sensor not available
    telemetryData.battery_voltage = 11.8 + random(-50, 50) / 100.0;
    telemetryData.battery_current = 150 + random(-20, 20);
    telemetryData.battery_power = telemetryData.battery_voltage * telemetryData.battery_current;
  }
}

// =============================================================================
// TELEMETRY TRANSMISSION FUNCTIONS
// =============================================================================
void sendTelemetryData() {
  if (!systemState.wifiConnected) {
    return;
  }
  
  // Try WebSocket first if available
  if (ENABLE_WEBSOCKET && systemState.webSocketConnected) {
    sendTelemetryViaWebSocket();
  } else {
    // Fallback to HTTP
    sendTelemetryViaHTTP();
  }
  
  systemState.packetNumber++;
}

void sendTelemetryViaWebSocket() {
  DynamicJsonDocument doc(1024);
  
  // Add all telemetry data
  doc["battery_voltage"] = round(telemetryData.battery_voltage * 100) / 100.0;
  doc["battery_current"] = round(telemetryData.battery_current * 100) / 100.0;
  doc["battery_power"] = round(telemetryData.battery_power * 100) / 100.0;
  doc["gps_latitude"] = telemetryData.gps_latitude;
  doc["gps_longitude"] = telemetryData.gps_longitude;
  doc["altitude"] = telemetryData.altitude;
  doc["speed"] = telemetryData.speed;
  doc["satellites"] = telemetryData.satellites;
  doc["temperature"] = telemetryData.temperature;
  doc["humidity"] = telemetryData.humidity;
  doc["signal_strength"] = telemetryData.signal_strength;
  doc["timestamp"] = telemetryData.timestamp;
  doc["connection_status"] = telemetryData.connection_status;
  doc["connection_type"] = telemetryData.connection_type;
  doc["packet_number"] = telemetryData.packet_number;
  doc["relay_state"] = systemState.relayState;
  doc["gps_valid"] = systemState.gpsValid;
  doc["ina219_ready"] = systemState.ina219Ready;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  bool success = webSocket.sendTXT("telemetryData:" + jsonString);
  
  if (success) {
    systemState.successfulPackets++;
    if (DEBUG_MODE) {
      Serial.println("📡 Telemetry sent via WebSocket (Packet #" + String(systemState.packetNumber) + ")");
    }
  } else {
    systemState.failedPackets++;
    if (DEBUG_MODE) {
      Serial.println("❌ WebSocket send failed - falling back to HTTP");
    }
    sendTelemetryViaHTTP();
  }
}

void sendTelemetryViaHTTP() {
  if (!systemState.serverConnected) {
    testServerConnectivity();
    if (!systemState.serverConnected) {
      systemState.failedPackets++;
      return;
    }
  }
  
  DynamicJsonDocument doc(1024);
  
  // Add all telemetry data (same as WebSocket)
  doc["battery_voltage"] = round(telemetryData.battery_voltage * 100) / 100.0;
  doc["battery_current"] = round(telemetryData.battery_current * 100) / 100.0;
  doc["battery_power"] = round(telemetryData.battery_power * 100) / 100.0;
  doc["gps_latitude"] = telemetryData.gps_latitude;
  doc["gps_longitude"] = telemetryData.gps_longitude;
  doc["altitude"] = telemetryData.altitude;
  doc["speed"] = telemetryData.speed;
  doc["satellites"] = telemetryData.satellites;
  doc["temperature"] = telemetryData.temperature;
  doc["humidity"] = telemetryData.humidity;
  doc["signal_strength"] = telemetryData.signal_strength;
  doc["timestamp"] = telemetryData.timestamp;
  doc["connection_status"] = telemetryData.connection_status;
  doc["connection_type"] = telemetryData.connection_type;
  doc["packet_number"] = telemetryData.packet_number;
  doc["relay_state"] = systemState.relayState;
  doc["gps_valid"] = systemState.gpsValid;
  doc["ina219_ready"] = systemState.ina219Ready;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  HTTPClient http;
  String url = "http://" + String(serverHost) + ":" + String(serverPort) + telemetryEndpoint;
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  int httpCode = http.POST(jsonString);
  http.end();
  
  if (httpCode == 200) {
    systemState.successfulPackets++;
    systemState.httpErrorCount = 0;
    if (DEBUG_MODE) {
      Serial.println("📡 Telemetry sent via HTTP (Packet #" + String(systemState.packetNumber) + ")");
    }
  } else {
    systemState.failedPackets++;
    systemState.httpErrorCount++;
    systemState.lastError = "HTTP Error: " + String(httpCode);
    systemState.lastErrorTime = millis();
    
    if (DEBUG_MODE) {
      Serial.println("❌ HTTP send failed: " + String(httpCode));
    }
    
    // If too many HTTP errors, test server connectivity
    if (systemState.httpErrorCount >= 3) {
      systemState.serverConnected = false;
    }
  }
}

// =============================================================================
// RELAY CONTROL FUNCTIONS
// =============================================================================
void handleRelayCommand(String action) {
  if (DEBUG_MODE) {
    Serial.println("🔧 Relay command received: " + action);
  }
  
  if (action == "on" || action == "emergency_on") {
    digitalWrite(RELAY_PIN, HIGH);
    systemState.relayState = true;
    Serial.println("   ✅ Relay activated");
  } else if (action == "off" || action == "emergency_off") {
    digitalWrite(RELAY_PIN, LOW);
    systemState.relayState = false;
    Serial.println("   ✅ Relay deactivated");
  } else {
    Serial.println("   ⚠️ Unknown relay command: " + action);
  }
}

void sendCommandResponse(String command, String action, String status) {
  DynamicJsonDocument doc(512);
  doc["command"] = command;
  doc["action"] = action;
  doc["status"] = status;
  doc["deviceId"] = WiFi.macAddress();
  doc["timestamp"] = millis();
  doc["relayState"] = systemState.relayState;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Try WebSocket first
  if (ENABLE_WEBSOCKET && systemState.webSocketConnected) {
    webSocket.sendTXT("commandResponse:" + jsonString);
  } else {
    // Fallback to HTTP
    HTTPClient http;
    String url = "http://" + String(serverHost) + ":" + String(serverPort) + commandResponseEndpoint;
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(3000);
    
    http.POST(jsonString);
    http.end();
  }
}

// =============================================================================
// CONNECTION MANAGEMENT FUNCTIONS
// =============================================================================
void checkAllConnections() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    systemState.wifiConnected = false;
    systemState.serverConnected = false;
    systemState.webSocketConnected = false;
    
    if (DEBUG_MODE) {
      Serial.println("⚠️ WiFi disconnected - attempting reconnection...");
    }
    
    if (systemState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      WiFi.reconnect();
      systemState.reconnectAttempts++;
      
      // Wait for reconnection with timeout
      int attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 15) {
        delay(1000);
        attempts++;
      }
      
      if (WiFi.status() == WL_CONNECTED) {
        systemState.wifiConnected = true;
        systemState.reconnectAttempts = 0;
        
        if (DEBUG_MODE) {
          Serial.println("✅ WiFi reconnected! IP: " + WiFi.localIP().toString());
        }
        
        // Re-test server and reinitialize WebSocket
        testServerConnectivity();
        if (ENABLE_WEBSOCKET && systemState.serverConnected) {
          initializeWebSocket();
        }
      } else {
        if (DEBUG_MODE) {
          Serial.println("❌ WiFi reconnection failed");
        }
      }
    } else {
      if (DEBUG_MODE) {
        Serial.println("❌ Max WiFi reconnection attempts reached");
        Serial.println("⏰ Waiting 30 seconds before retry...");
      }
      delay(30000);
      systemState.reconnectAttempts = 0;
    }
  } else {
    systemState.wifiConnected = true;
    
    // Check WebSocket connection if enabled
    if (ENABLE_WEBSOCKET && !systemState.webSocketConnected && systemState.serverConnected) {
      if (DEBUG_MODE) {
        Serial.println("🔌 WebSocket disconnected - attempting reconnection...");
      }
      webSocket.disconnect();
      delay(1000);
      initializeWebSocket();
    }
  }
}

// =============================================================================
// STATUS INDICATION FUNCTIONS
// =============================================================================
void updateStatusLED() {
  static unsigned long lastBlink = 0;
  static bool ledState = false;
  unsigned long currentTime = millis();
  
  if (systemState.wifiConnected && systemState.serverConnected) {
    // Solid on when fully connected
    digitalWrite(LED_PIN, HIGH);
  } else if (systemState.wifiConnected) {
    // Slow blink when WiFi connected but server disconnected
    if (currentTime - lastBlink > 1000) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlink = currentTime;
    }
  } else {
    // Fast blink when WiFi disconnected
    if (currentTime - lastBlink > 200) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlink = currentTime;
    }
  }
}

void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_PIN, LOW);
    delay(delayMs);
  }
}

// =============================================================================
// STATUS REPORTING FUNCTIONS
// =============================================================================
void printSystemSummary() {
  Serial.println();
  Serial.println("======================================================================");
  Serial.println("               SYSTEM CONFIGURATION SUMMARY");
  Serial.println("======================================================================");
  Serial.println("Network Configuration:");
  Serial.println("├─ WiFi SSID: " + String(ssid));
  Serial.println("├─ Server Host: " + String(serverHost));
  Serial.println("├─ Server Port: " + String(serverPort));
  Serial.println("├─ Telemetry Endpoint: " + telemetryEndpoint);
  Serial.println("└─ Send Interval: " + String(TELEMETRY_INTERVAL) + "ms");
  Serial.println();
  Serial.println("Hardware Status:");
  Serial.println("├─ GPS Module: " + String(systemState.gpsValid ? "✅ Valid Signal" : "⏳ Searching"));
  Serial.println("├─ INA219 Sensor: " + String(systemState.ina219Ready ? "✅ Ready" : "❌ Error"));
  Serial.println("├─ WiFi Connection: " + String(systemState.wifiConnected ? "✅ Connected" : "❌ Disconnected"));
  Serial.println("├─ Server Connection: " + String(systemState.serverConnected ? "✅ Connected" : "❌ Disconnected"));
  Serial.println("└─ Communication Mode: " + systemState.communicationMode);
  Serial.println("======================================================================");
}

void printDetailedStatusReport() {
  float successRate = 0;
  unsigned long totalPackets = systemState.successfulPackets + systemState.failedPackets;
  if (totalPackets > 0) {
    successRate = (float)systemState.successfulPackets / totalPackets * 100;
  }
  
  Serial.println();
  Serial.println("============================================================");
  Serial.println("📊 DETAILED SYSTEM STATUS REPORT");
  Serial.println("============================================================");
  Serial.println("⏰ Uptime: " + String(millis() / 60000) + " minutes");
  Serial.println();
  Serial.println("🌐 Network Status:");
  Serial.println("├─ WiFi: " + String(systemState.wifiConnected ? "✅ Connected" : "❌ Disconnected"));
  Serial.println("├─ IP Address: " + (systemState.wifiConnected ? WiFi.localIP().toString() : "N/A"));
  Serial.println("├─ Signal Strength: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("├─ Server: " + String(systemState.serverConnected ? "✅ Reachable" : "❌ Unreachable"));
  Serial.println("└─ Communication: " + systemState.communicationMode);
  Serial.println();
  Serial.println("🔌 Hardware Status:");
  Serial.println("├─ GPS Signal: " + String(systemState.gpsValid ? "✅ Valid" : "❌ Invalid"));
  Serial.println("├─ GPS Satellites: " + String(telemetryData.satellites));
  Serial.println("├─ INA219 Sensor: " + String(systemState.ina219Ready ? "✅ Ready" : "❌ Error"));
  Serial.println("└─ Relay State: " + String(systemState.relayState ? "ON" : "OFF"));
  Serial.println();
  Serial.println("📡 Telemetry Statistics:");
  Serial.println("├─ Total Packets: " + String(totalPackets));
  Serial.println("├─ Successful: " + String(systemState.successfulPackets));
  Serial.println("├─ Failed: " + String(systemState.failedPackets));
  Serial.println("├─ Success Rate: " + String(successRate, 1) + "%");
  Serial.println("└─ Current Packet #: " + String(systemState.packetNumber));
  Serial.println();
  Serial.println("🔋 Current Readings:");
  Serial.println("├─ Battery Voltage: " + String(telemetryData.battery_voltage, 2) + "V");
  Serial.println("├─ Battery Current: " + String(telemetryData.battery_current, 1) + "mA");
  Serial.println("├─ Battery Power: " + String(telemetryData.battery_power, 1) + "mW");
  Serial.println("├─ GPS Position: " + String(telemetryData.gps_latitude, 6) + ", " + String(telemetryData.gps_longitude, 6));
  Serial.println("└─ Altitude: " + String(telemetryData.altitude, 1) + "m");
  
  if (systemState.lastError.length() > 0) {
    Serial.println();
    Serial.println("⚠️ Last Error: " + systemState.lastError);
    Serial.println("   Time: " + String((millis() - systemState.lastErrorTime) / 1000) + " seconds ago");
  }
  
  Serial.println("============================================================");
}

// =============================================================================
// SERIAL COMMAND INTERFACE
// =============================================================================
void processSerialCommands() {
  if (Serial.available()) {
    String command = Serial.readString();
    command.trim();
    command.toLowerCase();
    
    Serial.println("🎮 Command received: " + command);
    
    if (command == "status") {
      printDetailedStatusReport();
    } else if (command == "test") {
      testServerConnectivity();
    } else if (command == "wifi") {
      printConnectionDetails();
    } else if (command == "gps") {
      printGPSInfo();
    } else if (command == "sensor") {
      printSensorInfo();
    } else if (command == "relay_on") {
      handleRelayCommand("on");
    } else if (command == "relay_off") {
      handleRelayCommand("off");
    } else if (command == "reboot") {
      Serial.println("🔄 Rebooting ESP32...");
      delay(1000);
      ESP.restart();
    } else if (command == "help") {
      printSerialCommands();
    } else {
      Serial.println("❓ Unknown command. Type 'help' for available commands.");
    }
  }
}

void printSerialCommands() {
  Serial.println();
  Serial.println("🎮 AVAILABLE SERIAL COMMANDS:");
  Serial.println("════════════════════════════════");
  Serial.println("status    - Show detailed status report");
  Serial.println("test      - Test server connectivity");
  Serial.println("wifi      - Show WiFi connection details");
  Serial.println("gps       - Show GPS information");
  Serial.println("sensor    - Show sensor readings");
  Serial.println("relay_on  - Turn relay ON");
  Serial.println("relay_off - Turn relay OFF");
  Serial.println("reboot    - Restart ESP32");
  Serial.println("help      - Show this help menu");
  Serial.println("════════════════════════════════");
}

void printGPSInfo() {
  Serial.println();
  Serial.println("🛰️ GPS INFORMATION:");
  Serial.println("══════════════════════════════");
  Serial.println("Status: " + String(systemState.gpsValid ? "✅ Valid Signal" : "❌ No Signal"));
  Serial.println("Satellites: " + String(telemetryData.satellites));
  Serial.println("Latitude: " + String(telemetryData.gps_latitude, 6));
  Serial.println("Longitude: " + String(telemetryData.gps_longitude, 6));
  Serial.println("Altitude: " + String(telemetryData.altitude, 1) + " meters");
  Serial.println("Speed: " + String(telemetryData.speed, 1) + " km/h");
  Serial.println("══════════════════════════════");
}

void printSensorInfo() {
  Serial.println();
  Serial.println("🔋 SENSOR INFORMATION:");
  Serial.println("══════════════════════════════");
  Serial.println("INA219 Status: " + String(systemState.ina219Ready ? "✅ Ready" : "❌ Error"));
  Serial.println("Battery Voltage: " + String(telemetryData.battery_voltage, 2) + " V");
  Serial.println("Battery Current: " + String(telemetryData.battery_current, 1) + " mA");
  Serial.println("Battery Power: " + String(telemetryData.battery_power, 1) + " mW");
  Serial.println("Temperature: " + String(telemetryData.temperature, 1) + " °C");
  Serial.println("Humidity: " + String(telemetryData.humidity, 1) + " %");
  Serial.println("WiFi Signal: " + String(telemetryData.signal_strength) + " dBm");
  Serial.println("══════════════════════════════");
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
String getWiFiStatusString() {
  switch (WiFi.status()) {
    case WL_IDLE_STATUS: return "Idle";
    case WL_NO_SSID_AVAIL: return "SSID Not Available";
    case WL_SCAN_COMPLETED: return "Scan Completed";
    case WL_CONNECTED: return "Connected";
    case WL_CONNECT_FAILED: return "Connection Failed";
    case WL_CONNECTION_LOST: return "Connection Lost";
    case WL_DISCONNECTED: return "Disconnected";
    default: return "Unknown (" + String(WiFi.status()) + ")";
  }
}

String getWiFiEncryptionType() {
  // Get encryption type of currently connected network
  // Find the current SSID in scan results to get encryption type
  int networkCount = WiFi.scanNetworks();
  String currentSSID = WiFi.SSID();
  
  for (int i = 0; i < networkCount; i++) {
    if (WiFi.SSID(i) == currentSSID) {
      switch (WiFi.encryptionType(i)) {
        case WIFI_AUTH_OPEN: return "Open";
        case WIFI_AUTH_WEP: return "WEP";
        case WIFI_AUTH_WPA_PSK: return "WPA PSK";
        case WIFI_AUTH_WPA2_PSK: return "WPA2 PSK";
        case WIFI_AUTH_WPA_WPA2_PSK: return "WPA/WPA2 PSK";
        case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2 Enterprise";
        default: return "Unknown";
      }
    }
  }
  return "Unknown";
}

// =============================================================================
// END OF ESP32 UAV TELEMETRY SYSTEM - MASTER VERSION
// =============================================================================

/**
 * PENGGUNAAN DAN KONFIGURASI:
 * 
 * 1. SESUAIKAN KONFIGURASI NETWORK:
 *    - Ubah ssid dan password sesuai WiFi Anda
 *    - Ubah serverHost dengan IP komputer yang menjalankan dashboard
 *    - Pastikan serverPort sesuai (default: 3003)
 * 
 * 2. PILIH MODE OPERASI:
 *    - DEBUG_MODE: true untuk debugging detail, false untuk production
 *    - ENABLE_WEBSOCKET: true untuk WebSocket + HTTP, false untuk HTTP saja
 *    - ENABLE_DETAILED_DIAGNOSTICS: true untuk diagnostik jaringan detail
 * 
 * 3. KONEKSI HARDWARE:
 *    - GPS Module: RX ke Pin 16, TX ke Pin 17, VCC ke 3.3V, GND ke GND
 *    - INA219: SDA ke Pin 21, SCL ke Pin 22, VCC ke 3.3V, GND ke GND
 *    - Relay: IN ke Pin 5, VCC ke 5V, GND ke GND
 *    - LED Status: Otomatis menggunakan LED built-in pada Pin 2
 * 
 * 4. SERIAL COMMANDS:
 *    Buka Serial Monitor (115200 baud) dan ketik command:
 *    - status: Status sistem lengkap
 *    - test: Test koneksi server
 *    - wifi: Info koneksi WiFi
 *    - gps: Info GPS
 *    - sensor: Info sensor
 *    - relay_on/relay_off: Control relay
 *    - reboot: Restart ESP32
 *    - help: Daftar command
 * 
 * 5. STATUS LED:
 *    - Solid ON: WiFi dan server terhubung
 *    - Blink lambat: WiFi terhubung, server terputus
 *    - Blink cepat: WiFi terputus
 * 
 * LIBRARY YANG DIBUTUHKAN:
 * - WiFi (ESP32 Core)
 * - HTTPClient (ESP32 Core)
 * - ArduinoJson
 * - WebSocketsClient
 * - HardwareSerial (ESP32 Core)
 * - Wire (ESP32 Core)
 * - Adafruit_INA219
 * - TinyGPS++
 */
