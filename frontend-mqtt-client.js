/**
 * Frontend MQTT Client - WebSocket Connection
 * Menghubungkan dashboard langsung ke MQTT broker via WebSocket
 * 
 * @author KRTI Team
 * @version 1.0.0
 */

class FrontendMQTTClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        
        // MQTT Configuration - HiveMQ WebSocket (sama dengan source code)
        this.config = {
            broker: 'wss://broker.hivemq.com:8884/mqtt',
            clientId: 'WEBSITETD-web-' + Math.random().toString(16).substr(2, 8),
            keepalive: 60,
            cleanSession: true,
            connectTimeout: 30000,
            reconnectPeriod: 1000
        };
        
        // Topics - Sesuai dengan source code
        this.topics = {
            gps: 'awikwokgps',
            speed: 'awikwokkecepatan', 
            voltage: 'awikwoktegangan',
            current: 'awikwokarus',
            power: 'awikwokdaya',
            relay: 'awikwokrelay',
            emergency: 'awikwokemergency'
        };
        
        // Status elements
        this.statusElements = {
            connection: document.getElementById('mqtt-connection-status'),
            lastUpdate: document.getElementById('mqtt-last-update'),
            activity: document.getElementById('activity-log')
        };
        
        // Callbacks
        this.onTelemetryReceived = null;
        this.onStatusChange = null;
        
        this.init();
    }
    
    /**
     * Initialize MQTT client
     */
    init() {
        this.logActivity('Initializing MQTT client...');
        this.connect();
    }
    
    /**
     * Connect to MQTT broker
     */
    connect() {
        try {
            this.logActivity(`Connecting to ${this.config.broker}...`);
            this.updateConnectionStatus('connecting');
            
            // Import MQTT.js library dynamically
            if (typeof mqtt === 'undefined') {
                this.logActivity('Loading MQTT.js library...', 'error');
                this.loadMQTTLibrary();
                return;
            }
            
            // Create MQTT client
            this.client = mqtt.connect(this.config.broker, {
                clientId: this.config.clientId,
                keepalive: this.config.keepalive,
                clean: this.config.cleanSession,
                connectTimeout: this.config.connectTimeout,
                reconnectPeriod: this.config.reconnectPeriod
            });
            
            this.setupEventHandlers();
            
        } catch (error) {
            this.logActivity(`Connection error: ${error.message}`, 'error');
            this.handleConnectionError();
        }
    }
    
    /**
     * Load MQTT.js library dynamically
     */
    loadMQTTLibrary() {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/mqtt@5.14.1/dist/mqtt.min.js';
        script.onload = () => {
            this.logActivity('MQTT.js library loaded successfully');
            setTimeout(() => this.connect(), 1000);
        };
        script.onerror = () => {
            this.logActivity('Failed to load MQTT.js library', 'error');
        };
        document.head.appendChild(script);
    }
    
    /**
     * Setup MQTT event handlers
     */
    setupEventHandlers() {
        // Connection successful
        this.client.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            
            this.logActivity(`Connected to MQTT broker with client ID: ${this.config.clientId}`, 'success');
            this.updateConnectionStatus('connected');
            
            // Subscribe to telemetry topic
            this.subscribeToTopics();
        });
        
        // Message received
        this.client.on('message', (topic, message) => {
            this.handleIncomingMessage(topic, message.toString());
        });
        
        // Connection closed
        this.client.on('close', () => {
            this.isConnected = false;
            this.logActivity('MQTT connection closed', 'warning');
            this.updateConnectionStatus('disconnected');
        });
        
        // Reconnecting
        this.client.on('reconnect', () => {
            this.reconnectAttempts++;
            this.logActivity(`Reconnection attempt ${this.reconnectAttempts}...`, 'info');
            this.updateConnectionStatus('reconnecting');
        });
        
        // Error handling
        this.client.on('error', (error) => {
            this.logActivity(`MQTT Error: ${error.message}`, 'error');
            this.handleConnectionError();
        });
        
        // Offline
        this.client.on('offline', () => {
            this.isConnected = false;
            this.logActivity('Client went offline', 'warning');
            this.updateConnectionStatus('offline');
        });
    }
    
    /**
     * Subscribe to MQTT topics
     */
    subscribeToTopics() {
        // Subscribe ke semua topik sesuai source code
        const topicsToSubscribe = [
            this.topics.gps,
            this.topics.speed, 
            this.topics.voltage,
            this.topics.current,
            this.topics.power,
            this.topics.relay,
            this.topics.emergency
        ];
        
        topicsToSubscribe.forEach(topic => {
            this.client.subscribe(topic, { qos: 1 }, (error) => {
                if (error) {
                    this.logActivity(`Failed to subscribe to ${topic}: ${error.message}`, 'error');
                } else {
                    this.logActivity(`Subscribed to topic: ${topic}`, 'success');
                }
            });
        });
    }
    
    /**
     * Handle incoming MQTT messages
     */
    handleIncomingMessage(topic, message) {
        try {
            this.logActivity(`Received: ${topic} -> ${message.substring(0, 50)}...`);
            
            // Update last update time
            if (this.statusElements.lastUpdate) {
                this.statusElements.lastUpdate.textContent = new Date().toLocaleTimeString();
            }
            
            // Handle different topics sesuai source code
            if (topic === this.topics.gps) {
                // GPS data dalam format JSON: {"lat": -6.123, "lng": 106.456}
                try {
                    const gpsData = JSON.parse(message);
                    this.processGPSData(gpsData);
                } catch (e) {
                    this.logActivity(`Invalid GPS JSON: ${message}`, 'error');
                }
            }
            else if (topic === this.topics.current) {
                // Data arus dalam format angka
                const current = parseFloat(message);
                if (!isNaN(current)) {
                    this.processCurrentData(current);
                }
            }
            else if (topic === this.topics.voltage) {
                // Data tegangan dalam format angka
                const voltage = parseFloat(message);
                if (!isNaN(voltage)) {
                    this.processVoltageData(voltage);
                }
            }
            else if (topic === this.topics.power) {
                // Data daya dalam format angka
                const power = parseFloat(message);
                if (!isNaN(power)) {
                    this.processPowerData(power);
                }
            }
            else if (topic === this.topics.relay) {
                // Status relay: "HIDUP" atau "MATI"
                this.processRelayStatus(message.trim());
            }
            else if (topic === this.topics.speed) {
                // Data kecepatan dalam format angka
                const speed = parseFloat(message);
                if (!isNaN(speed)) {
                    this.processSpeedData(speed);
                }
            }
            else if (topic === this.topics.emergency) {
                this.processEmergencyStatus(message.trim());
            }
            
        } catch (error) {
            this.logActivity(`Error processing message: ${error.message}`, 'error');
        }
    }
    
    /**
     * Process GPS data dan update dashboard
     */
    processGPSData(gpsData) {
        const { lat, lng } = gpsData;
        
        // Broadcast GPS data ke komponen lain
        window.dispatchEvent(new CustomEvent('mqttGPSUpdate', {
            detail: { lat, lng, timestamp: Date.now() }
        }));
        
        // Update dashboard jika tracking aktif
        if (window.tracking && window.updateGPSPosition) {
            window.updateGPSPosition(lat, lng);
        }
        
        this.logActivity(`GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'info');
    }
    
    /**
     * Process Current data
     */
    processCurrentData(current) {
        // Store untuk statistik
        if (window.lastCurrent !== undefined) {
            window.lastCurrent = current;
        }
        
        // Update chart jika ada
        if (window.currentChart && window.currentChart.updateSeries) {
            let currentData = [...(window.currentChart.w.config.series[0].data || [])];
            currentData.push([Date.now(), current]);
            
            // Batasi data untuk performance
            const maxDataPoints = 100;
            if (currentData.length > maxDataPoints) {
                currentData = currentData.slice(-maxDataPoints);
            }
            
            window.currentChart.updateSeries([{ data: currentData }]);
        }
        
        // Update statistik
        if (window.currentStats) {
            window.currentStats.sum += current;
            window.currentStats.count++;
            window.currentStats.max = Math.max(window.currentStats.max || 0, current);
            window.currentStats.min = Math.min(window.currentStats.min || Infinity, current);
        }
        
        // Update summary
        if (window.updateSummary) {
            window.updateSummary();
        }
        
        // Broadcast event
        window.dispatchEvent(new CustomEvent('mqttCurrentUpdate', {
            detail: { current, timestamp: Date.now() }
        }));
        
        this.logActivity(`Current: ${current.toFixed(2)} A`, 'info');
    }
    
    /**
     * Process Voltage data
     */
    processVoltageData(voltage) {
        // Store untuk statistik
        if (window.lastVoltage !== undefined) {
            window.lastVoltage = voltage;
        }
        
        // Update chart jika ada
        if (window.voltageChart && window.voltageChart.updateSeries) {
            let voltageData = [...(window.voltageChart.w.config.series[0].data || [])];
            voltageData.push([Date.now(), voltage]);
            
            const maxDataPoints = 100;
            if (voltageData.length > maxDataPoints) {
                voltageData = voltageData.slice(-maxDataPoints);
            }
            
            window.voltageChart.updateSeries([{ data: voltageData }]);
        }
        
        // Update statistik
        if (window.voltageStats) {
            window.voltageStats.sum += voltage;
            window.voltageStats.count++;
            window.voltageStats.max = Math.max(window.voltageStats.max || 0, voltage);
            window.voltageStats.min = Math.min(window.voltageStats.min || Infinity, voltage);
        }
        
        // Update summary
        if (window.updateSummary) {
            window.updateSummary();
        }
        
        // Broadcast event
        window.dispatchEvent(new CustomEvent('mqttVoltageUpdate', {
            detail: { voltage, timestamp: Date.now() }
        }));
        
        this.logActivity(`Voltage: ${voltage.toFixed(2)} V`, 'info');
    }
    
    /**
     * Process Power data
     */
    processPowerData(power) {
        // Store untuk statistik
        if (window.lastPower !== undefined) {
            window.lastPower = power;
        }
        
        // Update chart jika ada
        if (window.powerChart && window.powerChart.updateSeries) {
            let powerData = [...(window.powerChart.w.config.series[0].data || [])];
            powerData.push([Date.now(), power]);
            
            const maxDataPoints = 100;
            if (powerData.length > maxDataPoints) {
                powerData = powerData.slice(-maxDataPoints);
            }
            
            window.powerChart.updateSeries([{ data: powerData }]);
        }
        
        // Update statistik
        if (window.powerStats) {
            window.powerStats.sum += power;
            window.powerStats.count++;
            window.powerStats.max = Math.max(window.powerStats.max || 0, power);
            window.powerStats.min = Math.min(window.powerStats.min || Infinity, power);
        }
        
        // Update summary
        if (window.updateSummary) {
            window.updateSummary();
        }
        
        // Broadcast event
        window.dispatchEvent(new CustomEvent('mqttPowerUpdate', {
            detail: { power, timestamp: Date.now() }
        }));
        
        this.logActivity(`Power: ${power.toFixed(2)} W`, 'info');
    }
    
    /**
     * Process Relay Status
     */
    processRelayStatus(status) {
        const relayStatusEl = document.getElementById("relayStatus");
        if (relayStatusEl) {
            if (status === "HIDUP") {
                relayStatusEl.innerHTML = "🟢";
            } else if (status === "MATI") {
                relayStatusEl.innerHTML = "🔴";
            }
        }
        
        // Broadcast event
        window.dispatchEvent(new CustomEvent('mqttRelayUpdate', {
            detail: { status, timestamp: Date.now() }
        }));
        
        this.logActivity(`Relay: ${status}`, status === "HIDUP" ? 'success' : 'warning');
    }

    /**
     * Process Emergency status (on/off)
     */
    processEmergencyStatus(state) {
        const emergencyEl = document.getElementById('emergencyStatus');
        if (emergencyEl) {
            if (state === 'on') {
                emergencyEl.textContent = 'EMERGENCY ON';
                emergencyEl.classList.add('active');
            } else {
                emergencyEl.textContent = 'EMERGENCY OFF';
                emergencyEl.classList.remove('active');
            }
        }

        window.dispatchEvent(new CustomEvent('mqttEmergencyUpdate', {
            detail: { state, timestamp: Date.now() }
        }));

        this.logActivity(`Emergency status: ${state.toUpperCase()}`, state === 'on' ? 'error' : 'info');
    }
    
    /**
     * Process Speed data
     */
    processSpeedData(speed) {
        // Update statistik kecepatan jika ada
        if (window.speedStats) {
            window.speedStats.sum += speed;
            window.speedStats.count++;
            window.speedStats.max = Math.max(window.speedStats.max || 0, speed);
            window.speedStats.min = Math.min(window.speedStats.min || Infinity, speed);
        }
        
        // Update summary
        if (window.updateSummary) {
            window.updateSummary(speed);
        }
        
        // Broadcast event
        window.dispatchEvent(new CustomEvent('mqttSpeedUpdate', {
            detail: { speed, timestamp: Date.now() }
        }));
        
        this.logActivity(`Speed: ${speed.toFixed(2)} km/h`, 'info');
    }
    
    /**
     * Process telemetry data and update dashboard
     */
    processTelemetryData(data) {
        // Convert to dashboard format
        const telemetryData = {
            battery_voltage: data.voltage || 0,
            battery_current: data.current || 0,
            battery_power: data.power || 0,
            relay_status: data.relay === 1,
            emergency_status: data.emergency || 'off',
            gps_latitude: data.lat || null,
            gps_longitude: data.lng || null,
            gps_fix: data.gps_fix || false,
            timestamp: data.ts || Date.now(),
            connection_status: 'connected',
            connection_type: 'MQTT_WebSocket'
        };
        
        // Update dashboard if functions exist
        if (window.updateElectricalMonitoring) {
            window.updateElectricalMonitoring(telemetryData);
        }
        
        if (window.updateElectricalChart) {
            window.updateElectricalChart(
                telemetryData.battery_voltage,
                telemetryData.battery_current,
                telemetryData.battery_power
            );
        }
        
        // Update telemetry data manager if exists
        if (window.telemetryDataManager) {
            window.telemetryDataManager.updateTelemetry(telemetryData);
        }
        
        // Broadcast to other components
        window.dispatchEvent(new CustomEvent('mqttTelemetryUpdate', {
            detail: telemetryData
        }));
    }
    
    /**
     * Send emergency command (sesuai source code)
     */
    sendEmergencyCommand(action = 'on') {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('MQTT not connected'));
                return;
            }
            
            // Format sesuai source code - kirim "on" langsung ke topik emergency
            const payload = action;
            
            this.client.publish(this.topics.emergency, payload, { qos: 1 }, (error) => {
                if (error) {
                    this.logActivity(`Failed to send emergency command: ${error.message}`, 'error');
                    reject(error);
                } else {
                    this.logActivity(`Emergency command sent: ${action}`, 'success');
                    resolve({ success: true, action, payload });
                }
            });
        });
    }
    
    /**
     * Update connection status in UI
     */
    updateConnectionStatus(status) {
        if (this.statusElements.connection) {
            const statusElement = this.statusElements.connection;
            statusElement.textContent = status.toUpperCase();
            statusElement.className = `status-${status}`;
        }
        
        // Callback for status change
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
        
        // Update global connection state
        window.mqttConnectionStatus = status;
    }
    
    /**
     * Handle connection errors with exponential backoff
     */
    handleConnectionError() {
        this.isConnected = false;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logActivity('Max reconnection attempts reached. Stopping.', 'error');
            return;
        }
        
        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        
        this.logActivity(`Reconnecting in ${this.reconnectDelay / 1000} seconds...`, 'info');
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, this.reconnectDelay);
    }
    
    /**
     * Log activity to console and activity log
     */
    logActivity(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        
        // Console log
        switch (type) {
            case 'error':
                console.error(logMessage);
                break;
            case 'warning':
                console.warn(logMessage);
                break;
            case 'success':
                console.log(`✅ ${logMessage}`);
                break;
            default:
                console.log(logMessage);
        }
        
        // Update activity log in UI
        if (this.statusElements.activity) {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-${type}`;
            logEntry.textContent = logMessage;
            
            this.statusElements.activity.insertBefore(logEntry, this.statusElements.activity.firstChild);
            
            // Keep only last 50 entries
            while (this.statusElements.activity.children.length > 50) {
                this.statusElements.activity.removeChild(this.statusElements.activity.lastChild);
            }
        }
    }
    
    /**
     * Get connection statistics
     */
    getStatistics() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            clientId: this.config.clientId,
            broker: this.config.broker,
            topics: this.topics
        };
    }
    
    /**
     * Disconnect from MQTT broker
     */
    disconnect() {
        if (this.client) {
            this.logActivity('Disconnecting from MQTT broker...');
            this.client.end();
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
        }
    }
}

// Initialize frontend MQTT client when DOM is ready
window.frontendMQTTClient = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to ensure other scripts are loaded
    setTimeout(() => {
        window.frontendMQTTClient = new FrontendMQTTClient();
    }, 2000);
});

// Make emergency function globally available
window.sendMQTTEmergencyCommand = async function(action = 'on') {
    if (window.frontendMQTTClient) {
        try {
            const result = await window.frontendMQTTClient.sendEmergencyCommand(action);
            console.log('Emergency command result:', result);
            return result;
        } catch (error) {
            console.error('Emergency command error:', error);
            throw error;
        }
    } else {
        throw new Error('MQTT client not initialized');
    }
};
