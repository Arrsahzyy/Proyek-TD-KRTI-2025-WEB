/**
 * MQTT Client for UAV Dashboard - ESP32 Integration
 * 
 * Menghubungkan server dashboard dengan ESP32 via MQTT HiveMQ
 * Handles semua topik MQTT dari ESP32 dan meneruskan ke dashboard
 * 
 * @author KRTI Team
 * @version 1.0.0
 */

const mqtt = require('mqtt');
const EventEmitter = require('events');

class MQTTBridge extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // MQTT Configuration - HiveMQ (sesuai source code)
        this.config = {
            broker: options.broker || 'wss://broker.hivemq.com:8884/mqtt',
            clientId: options.clientId || 'WEBSITETD-server-' + Math.random().toString(16).substr(2, 8),
            keepalive: options.keepalive || 60,
            connectTimeout: options.connectTimeout || 30000,
            reconnectPeriod: options.reconnectPeriod || 5000,
            clean: true
        };
        
        // ESP32 MQTT Topics - Sesuai dengan source code
        this.topics = {
            // Subscribe topics (dari ESP32 ke dashboard)
            subscribe: [
                'awikwokgps',           // GPS coordinates  
                'awikwokkecepatan',     // Speed data
                'awikwoktegangan',      // Voltage data
                'awikwokarus',          // Current data
                'awikwokdaya',          // Power data
                'awikwokrelay',         // Relay status
                'awikwokemergency'      // Emergency status (ESP32 echo retain)
            ],
            // Publish topics (dari dashboard ke ESP32)
            publish: {
                emergency: 'awikwokemergency'   // Emergency command topic
            }
        };
        
        this.client = null;
        this.isConnected = false;
        this.lastData = {};
        this.statistics = {
            messagesReceived: 0,
            messagesSent: 0,
            lastMessageTime: null,
            connectionAttempts: 0,
            reconnects: 0
        };
        
        this.logger = options.logger || console;
    }
    
    /**
     * Connect to MQTT broker
     */
    async connect() {
        try {
            this.statistics.connectionAttempts++;
            this.logger.info('MQTT', 'Connecting to MQTT broker...', this.config);
            
            this.client = mqtt.connect(this.config.broker, {
                clientId: this.config.clientId,
                keepalive: this.config.keepalive,
                connectTimeout: this.config.connectTimeout,
                reconnectPeriod: this.config.reconnectPeriod,
                clean: this.config.clean,
                // Last Will agar client lain tahu jika server putus
                will: {
                    topic: 'awikwokstatus',
                    payload: 'offline',
                    qos: 1,
                    retain: true
                }
            });
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Return promise that resolves when connected
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('MQTT connection timeout'));
                }, this.config.connectTimeout);
                
                this.client.once('connect', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                
                this.client.once('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
        } catch (error) {
            this.logger.error('MQTT', 'Connection failed', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Setup MQTT event handlers
     */
    setupEventHandlers() {
        // Connection successful
        this.client.on('connect', () => {
            this.isConnected = true;
            this.logger.success('MQTT', 'Connected to MQTT broker', { 
                clientId: this.config.clientId,
                broker: this.config.broker 
            });
            
            // Subscribe to all ESP32 topics
            this.subscribeToTopics();
            
            this.emit('connected');
        });
        
        // Message received
        this.client.on('message', (topic, message) => {
            this.handleIncomingMessage(topic, message);
        });
        
        // Connection closed
        this.client.on('close', () => {
            this.isConnected = false;
            this.logger.warn('MQTT', 'Connection closed');
            this.emit('disconnected');
        });
        
        // Reconnecting
        this.client.on('reconnect', () => {
            this.statistics.reconnects++;
            this.logger.info('MQTT', 'Attempting to reconnect...', { 
                attempt: this.statistics.reconnects 
            });
            this.emit('reconnecting');
        });
        
        // Error handling
        this.client.on('error', (error) => {
            this.logger.error('MQTT', 'MQTT Client Error', { 
                error: error.message,
                code: error.code 
            });
            this.emit('error', error);
        });
        
        // Offline
        this.client.on('offline', () => {
            this.isConnected = false;
            this.logger.warn('MQTT', 'Client went offline');
            this.emit('offline');
        });
    }
    
    /**
     * Subscribe to all ESP32 topics
     */
    subscribeToTopics() {
        this.topics.subscribe.forEach(topic => {
            this.client.subscribe(topic, { qos: 1 }, (error) => {
                if (error) {
                    this.logger.error('MQTT', `Failed to subscribe to ${topic}`, { error: error.message });
                } else {
                    this.logger.info('MQTT', `Subscribed to topic: ${topic}`);
                }
            });
        });
    }
    
    /**
     * Handle incoming MQTT messages from ESP32
     */
    handleIncomingMessage(topic, message) {
        try {
            this.statistics.messagesReceived++;
            this.statistics.lastMessageTime = new Date();
            
            const messageStr = message.toString();
            this.logger.debug('MQTT', `Received message on ${topic}`, { message: messageStr });
            
            // Parse message based on topic
            const data = this.parseMessageByTopic(topic, messageStr);
            
            if (data) {
                // Store last data
                this.lastData[topic] = {
                    value: data,
                    timestamp: Date.now(),
                    raw: messageStr
                };
                
                // Emit parsed data event
                this.emit('telemetryData', {
                    topic: topic,
                    data: data,
                    timestamp: Date.now()
                });
                
                // Emit specific topic events
                this.emit(topic, data);
            }
            
        } catch (error) {
            this.logger.error('MQTT', 'Error processing message', { 
                topic, 
                message: message.toString(), 
                error: error.message 
            });
        }
    }
    
    /**
     * Parse message content based on topic
     */
    parseMessageByTopic(topic, message) {
        try {
            // Handle GPS data
            if (topic === 'awikwokgps') {
                const gpsData = JSON.parse(message);
                return {
                    gps_latitude: gpsData.lat || null,
                    gps_longitude: gpsData.lng || null,
                    timestamp: Date.now(),
                    type: 'gps'
                };
            }
            
            // Handle voltage data
            if (topic === 'awikwoktegangan') {
                return {
                    battery_voltage: parseFloat(message),
                    timestamp: Date.now(),
                    type: 'voltage'
                };
            }
            
            // Handle current data
            if (topic === 'awikwokarus') {
                return {
                    battery_current: parseFloat(message),
                    timestamp: Date.now(),
                    type: 'current'
                };
            }
            
            // Handle power data
            if (topic === 'awikwokdaya') {
                return {
                    battery_power: parseFloat(message),
                    timestamp: Date.now(),
                    type: 'power'
                };
            }
            
            // Handle relay status
            if (topic === 'awikwokrelay') {
                const raw = message.trim();
                // Terima format "HIDUP"/"MATI" atau "1"/"0"
                const isOn = raw === 'HIDUP' || raw === '1';
                return {
                    relay_status: isOn,
                    relay_raw: raw,
                    timestamp: Date.now(),
                    type: 'relay'
                };
            }
            
            // Handle speed data
            if (topic === 'awikwokkecepatan') {
                return {
                    speed: parseFloat(message),
                    timestamp: Date.now(),
                    type: 'speed'
                };
            }

            // Emergency status (retain) dari ESP32 / dashboard
            if (topic === 'awikwokemergency') {
                const state = message.trim();
                return {
                    emergency_status: state,
                    timestamp: Date.now(),
                    type: 'emergency'
                };
            }
            
            // Default case
            return {
                raw_data: message,
                topic: topic,
                type: 'unknown'
            };
        } catch (error) {
            this.logger.error('MQTT', 'Error parsing message', { 
                topic, 
                message, 
                error: error.message 
            });
            return null;
        }
    }
    
    /**
     * Send emergency command to ESP32
     */
    sendEmergencyCommand(action = 'off') {
        if (!this.isConnected) {
            throw new Error('MQTT not connected');
        }
        
        const validActions = ['on', 'off'];
        if (!validActions.includes(action)) {
            throw new Error(`Invalid emergency action: ${action}. Must be 'on' or 'off'`);
        }
        
        // Format perintah sesuai source code - kirim "on" langsung
        const payload = action;
        
        this.client.publish(this.topics.publish.emergency, payload, { qos: 1 }, (error) => {
            if (error) {
                this.logger.error('MQTT', 'Failed to send emergency command', { 
                    action, 
                    error: error.message 
                });
            } else {
                this.statistics.messagesSent++;
                this.logger.success('MQTT', 'Emergency command sent', { action, payload });
            }
        });
    }
    
    /**
     * Get current telemetry data
     */
    getCurrentTelemetry() {
        const telemetry = {};
        
        // Combine all last received data into telemetry object
        Object.keys(this.lastData).forEach(topic => {
            const topicData = this.lastData[topic];
            Object.assign(telemetry, topicData.value);
        });
        
        // Add metadata
        telemetry.timestamp = Date.now();
        telemetry.connection_status = this.isConnected ? 'connected' : 'disconnected';
        telemetry.data_age = this.getDataAge();
        
        return telemetry;
    }
    
    /**
     * Get age of last received data in seconds
     */
    getDataAge() {
        if (!this.statistics.lastMessageTime) return null;
        return Math.floor((Date.now() - this.statistics.lastMessageTime.getTime()) / 1000);
    }
    
    /**
     * Get connection statistics
     */
    getStatistics() {
        return {
            ...this.statistics,
            isConnected: this.isConnected,
            dataAge: this.getDataAge(),
            topicsSubscribed: this.topics.subscribe.length,
            lastDataCount: Object.keys(this.lastData).length
        };
    }
    
    /**
     * Disconnect from MQTT broker
     */
    disconnect() {
        if (this.client) {
            this.logger.info('MQTT', 'Disconnecting from MQTT broker');
            this.client.end();
            this.isConnected = false;
            this.emit('disconnected');
        }
    }
    
    /**
     * Check if data is fresh (received within specified time)
     */
    isDataFresh(maxAgeSeconds = 30) {
        const age = this.getDataAge();
        return age !== null && age <= maxAgeSeconds;
    }
}

module.exports = MQTTBridge;
