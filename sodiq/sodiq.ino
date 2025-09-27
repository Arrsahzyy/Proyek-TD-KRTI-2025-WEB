#include <Wire.h>
#include <Adafruit_INA219.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <UniversalTelegramBot.h>
#include <qqqlab_GPS_UBLOX.h>
#include <qqqlab_AutoBaud.h>
#include <PubSubClient.h>

// ----- WiFi & Telegram -----
const char* ssid = "4G-UFI-D072";
const char* password = "1234567890";
#define BOT_TOKEN "7641641971:AAG3kk2PmOjs5bt7TtcOmy_xs5LT4q1kk2o"
#define CHAT_ID "1363149761"

WiFiClientSecure secured_client;
UniversalTelegramBot bot(BOT_TOKEN, secured_client);

// ----- MQTT -----
const char* mqtt_server = "broker.hivemq.com";
WiFiClient espClient;
PubSubClient client(espClient);

// INA219 & Relay
Adafruit_INA219 ina219;
#define RELAY_PIN 5

// Relay control state & hysteresis threshold
bool relayON = false;
const float voltageON = 16.7;
const float voltageOFF = 17;

// Emergency override
String emergencyState = "off"; // "off" = normal, "on" = force relay mati

// GPS via Serial1 (pin RX=16, TX=17)
#define RX_PIN 16
#define TX_PIN 17

class GPS_UBLOX : public AP_GPS_UBLOX {
public:
  HardwareSerial *gps_serial;
  void begin(HardwareSerial *gps_serial) { this->gps_serial = gps_serial; }

  void I_setBaud(int baud) override { gps_serial->begin(baud); }
  inline int I_availableForWrite() override { return gps_serial->availableForWrite(); }
  inline int I_available() override { return gps_serial->available(); }
  inline int I_read(uint8_t* data, size_t len) override { return gps_serial->read(data, len); }
  inline int I_write(uint8_t* data, size_t len) override { return gps_serial->write(data, len); }
  inline uint32_t I_millis() override { return ::millis(); }
  void I_print(const char *str) override {
    Serial.print("[AP_GPS_UBLOX] "); Serial.print(str);
  }
} gps;

unsigned long lastSendTime = 0;
const unsigned long sendInterval = 10000;

// ------------------ Functions ------------------
void setup_wifi() {
  WiFi.begin(ssid, password);
  Serial.print("Menghubungkan ke WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nTerhubung ke WiFi");
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Menghubungkan ke MQTT...");
    // Gunakan client ID yang unique per ESP32
    String clientId = "WEBSITETD-ESP32-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("Terhubung!");
      Serial.println("Client ID: " + clientId);
      client.subscribe("awikwokemergency");
    } else {
      Serial.print("Gagal, rc=");
      Serial.print(client.state());
      Serial.println(" Coba lagi dalam 5 detik");
      delay(5000);
    }
  }
}

// Callback MQTT untuk topic emergency
void callback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();
  
  if (String(topic) == "awikwokemergency") {
    if (msg == "on") {
      emergencyState = "on";
      relayON = false;
      digitalWrite(RELAY_PIN, LOW);
      Serial.println(">>> Emergency ON: Relay dimatikan, histeresis nonaktif");
    } else if (msg == "off") {
      emergencyState = "off";
      Serial.println(">>> Emergency OFF: Relay kembali ke kontrol histeresis");
    }
    client.publish("awikwokemergency", emergencyState.c_str(), true);
  }
}

// ------------------ Setup ------------------
void setup() {
  Serial.begin(115200);

  // INA219 setup
  if (!ina219.begin()) {
    Serial.println("Gagal mendeteksi INA219. Cek wiring.");
    while (1);
  }

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("Monitoring INA219 dan GPS...");

  // WiFi setup
  setup_wifi();
  secured_client.setInsecure();

  // MQTT setup
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  // GPS Setup
  int baud = autobaud(RX_PIN);
  Serial.printf("Initial GPS baud rate: %d\n", baud);
  Serial1.begin(baud, SERIAL_8N1, RX_PIN, TX_PIN);

  gps.rate_ms = 100;
  gps.save_config = 2;
  gps.gnss_mode = 0;
  gps.begin(&Serial1);
}

// ------------------ Loop ------------------
void loop() {
  if (!client.connected()) reconnectMQTT();
  client.loop();

  gps.update();

  // INA219 data
  float busVoltage = ina219.getBusVoltage_V();
  float shuntVoltage = ina219.getShuntVoltage_mV() / 1000;
  float current_A = ina219.getCurrent_mA() / 1000;
  float corrected_A = (current_A + 0.2045) / 0.9999;
  float loadVoltage = busVoltage + shuntVoltage;
  float power_mW = loadVoltage * corrected_A;

  Serial.print("Tegangan : "); Serial.print(loadVoltage); Serial.println(" V");
  Serial.print("Arus     : "); Serial.print(corrected_A); Serial.println(" A");
  Serial.print("Daya     : "); Serial.print(power_mW); Serial.println(" W");

  // Relay control dengan emergency override
  if (emergencyState == "off") {
    if (!relayON && loadVoltage <= voltageON) {
      relayON = true;
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println(">>> Relay HIDUP (Tegangan <= 16.80V)");
    } else if (relayON && loadVoltage >= voltageOFF) {
      relayON = false;
      digitalWrite(RELAY_PIN, LOW);
      Serial.println(">>> Relay MATI (Tegangan >= 17V)");
    } else {
      Serial.print("Status Relay Tetap: ");
      Serial.println(relayON ? "HIDUP" : "MATI");
    }
  } else {
    relayON = false;
    digitalWrite(RELAY_PIN, LOW);
  }

  // Kirim data ke MQTT retain
  client.publish("awikwoktegangan", String(loadVoltage,2).c_str(), true);
  client.publish("awikwokarus", String(corrected_A,2).c_str(), true);
  client.publish("awikwokdaya", String(power_mW,2).c_str(), true);
  client.publish("awikwokrelay", relayON ? "1" : "0", true);

  // Kirim GPS ke MQTT (jika fix)
  if (gps.state.status >= 3) {
    double lat = gps.state.lat * 1e-7;
    double lng = gps.state.lng * 1e-7;
    String gpsJson = "{\"lat\":" + String(lat, 8) + ",\"lng\":" + String(lng, 8) + "}";
    client.publish("awikwokgps", gpsJson.c_str(), true);
    Serial.println("GPS publish: " + gpsJson);
  } else {
    Serial.println("GPS belum fix, tidak publish ke MQTT");
  }

  // Kirim Telegram tiap 10 detik
  if (millis() - lastSendTime > sendInterval) {
    lastSendTime = millis();

    String message = "📡 *Monitoring INA219 + GPS*\n";
    message += "🔋 Tegangan: " + String(loadVoltage, 2) + " V\n";
    message += "⚡ Arus: " + String(corrected_A, 2) + " A\n";
    message += "🔌 Daya: " + String(power_mW, 2) + " W\n";
    message += relayON ? "✅ Relay: *HIDUP*\n" : "❌ Relay: *MATI*\n";

    if (gps.state.status >= 3) {
      double lat = gps.state.lat * 1e-7;
      double lng = gps.state.lng * 1e-7;
      message += "📍 Lokasi:\n";
      message += "(" + String(lat, 7) + ", " + String(lng, 7) + ")\n";
      message += "🌐 https://maps.google.com/?q=" + String(lat, 7) + "," + String(lng, 7);
    } else {
      message += "📍 Lokasi: Tidak tersedia (GPS belum fix)";
    }

    bot.sendMessage(CHAT_ID, message, "Markdown");
  }

  Serial.println("-----------------------------");
  delay(1000);
}
