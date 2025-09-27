# 🚁 ESP32 UAV Dashboard - MQTT Integration

![UAV Dashboard](https://img.shields.io/badge/UAV-Dashboard-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/version-3.1.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)
![MQTT](https://img.shields.io/badge/MQTT-Connected-success?style=for-the-badge)

## ✅ STATUS: BERHASIL TERHUBUNG!

ESP32 Anda sudah **BERHASIL TERHUBUNG** ke dashboard via MQTT HiveMQ dengan data real-time:
- **Voltage**: 15.92V, **Current**: 0.20A, **Power**: 3.25W  
- **GPS**: -5.359, 105.315 (ITERA area)
- **Relay & Emergency control**: ✅ Working

## 🚀 QUICK START

### 1. ESP32 Setup (SUDAH SELESAI ✅)
```arduino
// File: sodiq.ino sudah siap!
// Ganti WiFi jika perlu:
const char* ssid = "Galaxy A52s";
const char* password = "bentargwliatdulu";
```

### 2. Start Dashboard Server  
```powershell
cd "E:\PROJECT\UAV DASHBOARD LAST\DASHBOARD"
node server_fixed.js
```

### 3. Buka Dashboard
- **URL**: http://localhost:3003
- **Status**: Harus tampil "Connected to ESP32"
- **Data**: Real-time charts & GPS map

## 📊 FITUR YANG TERSEDIA

- ⚡ **Real-time Telemetry**: Voltage, Current, Power monitoring
- 🗺️ **GPS Tracking**: Live location & flight path on map  
- 🚨 **Emergency Control**: Stop relay via dashboard
- 📈 **Charts**: 50-point rolling history
- 🔄 **Auto-recovery**: Switches to dummy data if ESP32 disconnects

## ✨ Features

### 📊 **Real-time Monitoring**
- Live telemetry data display (speed, altitude, GPS coordinates)
- Power system monitoring (voltage, current, power consumption)
- Interactive flight path mapping with Leaflet.js
- Real-time charts and graphs

### 🎮 **Interactive Controls**
- Emergency cut-off system
- Map controls (zoom, center, fullscreen)
- Settings modal for customization
- Keyboard shortcuts support

### 🎨 **Enhanced UI/UX**
- Matte blue & gold theme design
- Smooth animations and transitions
- Loading screens with progress indicators
- Notification system
- Tooltip support
- Responsive design for all devices

### 🔧 **Technical Features**
- ESP32 integration via WiFi/Bluetooth
- Socket.IO real-time communication
- Chart.js for data visualization
- Live-server for development
- Modular architecture

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Backend**: Node.js, Express.js, Socket.IO
- **Charts**: Chart.js
- **Maps**: Leaflet.js with OpenStreetMap
- **Hardware**: ESP32 microcontroller
- **Development**: Live-server, npm

## 📁 Project Structure

```
UAV_Dashboard_KRTI_FIX/
├── index.html                 # Main dashboard interface
├── style.css                  # Matte blue & gold theme styling
├── script.js                  # Enhanced interactive functionality
├── server.js                  # Node.js backend server
├── package.json               # Project dependencies
├── ESP32/                     # ESP32 Arduino code
│   └── ESP32_dashboard/
│       ├── ESP32_dashboard.ino
│       └── ESP32_dashboard_network_agnostic.ino
├── install_esp32_libraries.bat
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Arduino IDE (for ESP32)
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/UAV_Dashboard_KRTI.git
   cd UAV_Dashboard_KRTI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Start live-server for development**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   - Dashboard: http://localhost:3000
   - Live-server: http://localhost:5000

### ESP32 Setup

1. **Install ESP32 libraries**
   ```bash
   # Windows
   install_esp32_libraries.bat
   
   # Manual installation
   # Install: WiFi, WebSocketsClient, ArduinoJson
   ```

2. **Upload ESP32 code**
   - Open `ESP32/ESP32_dashboard/ESP32_dashboard.ino`
   - Configure your WiFi credentials
   - Set server IP address
   - Upload to ESP32

## 📡 Usage

### Dashboard Features

1. **Real-time Telemetry**
   - Speed, altitude, GPS coordinates
   - Battery voltage and current
   - System status indicators

2. **Interactive Map**
   - Live flight path tracking
   - Zoom controls and map centering
   - Fullscreen mode support

3. **Power Monitoring**
   - Real-time voltage/current charts
   - Power consumption analysis
   - Export chart functionality

4. **Emergency Controls**
   - Emergency cut-off button
   - System status monitoring
   - Alert notifications

### Keyboard Shortcuts
- `Ctrl + Shift + E`: Emergency stop
- `Ctrl + ,`: Open settings
- `Ctrl + Shift + C`: Clear activity log

## 🎨 Theme Customization

The dashboard uses a **matte blue & gold theme** that's easy on the eyes:

```css
:root {
    --primary-bg: #1a365d;      /* Matte dark blue */
    --accent-color: #d69e2e;    /* Matte gold */
    --text-primary: #e2e8f0;    /* Soft white */
    --text-secondary: #cbd5e0;  /* Light gray */
}
```

## 🔧 Configuration

### Server Configuration (server.js)
```javascript
const PORT = 3000;              // Server port
const CORS_ORIGIN = "*";        // CORS settings
const UPDATE_INTERVAL = 1000;   // Telemetry update rate
```

### ESP32 Configuration
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* server_ip = "YOUR_SERVER_IP";
const int server_port = 3000;
```

## 📊 API Documentation

### WebSocket Events

**Client → Server:**
- `heartbeat`: Keep-alive signal
- `command`: Control commands

**Server → Client:**
- `telemetryData`: Real-time UAV data
- `systemStatus`: System status updates
- `connect`: Connection established
- `disconnect`: Connection lost

### HTTP API

- `POST /api/telemetry`: Send telemetry data
- `GET /api/stats`: Get system statistics

## 🏆 KRTI Competition Features

This dashboard is specifically designed for KRTI 2025 with:

- **Real-time monitoring** for flight judges
- **Emergency safety controls** for compliance
- **Data logging** for post-flight analysis
- **Professional interface** for presentations
- **Mobile responsiveness** for field operations

## 👥 Team

**SWARAKARSA ITERA TECHNOLOGY DEVELOPMENT**
- UAV Development Division
- Contact: uav@swarakarsa.itera.ac.id

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **GitHub Issues**: Report bugs and request features
- **Email**: uav@swarakarsa.itera.ac.id
- **Documentation**: Check the code comments for detailed explanations

## 🎯 Roadmap

- [ ] Advanced flight planning interface
- [ ] Historical data analysis
- [ ] Multi-UAV support
- [ ] Cloud data synchronization
- [ ] Mobile app companion

## 🙏 Acknowledgments

- KRTI (Kontes Robot Terbang Indonesia) for inspiration
- OpenStreetMap for mapping services
- Chart.js and Leaflet.js communities
- ESP32 and Arduino communities

---

Made with ❤️ by **Swarakarsa ITERA Technology Development Team** for KRTI 2025
