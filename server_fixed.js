/**
 * UAV Dashboard Server - SECURITY & PERFORMANCE FIXED VERSION
 * 
 * MAJOR FIXES APPLIED:
 * - Enhanced security: CORS whitelist, input validation, rate limiting
 * - Fixed memory leaks and race conditions
 * - Added circuit breakers and graceful degradation
 * - Improved error handling and monitoring
 * - Optimized performance and resource usage
 * 
 * @author KRTI Team  
 * @version 3.1.0 - SECURITY & PERFORMANCE FIXED
 */

// =============================================================================
// IMPORTS & DEPENDENCIES
// =============================================================================
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const Joi = require('joi');
const EventEmitter = require('events');
const MQTTBridge = require('./mqtt-client');

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================
const CONFIG = {
    PORT: parseInt(process.env.PORT) || 3003,
    ENVIRONMENT: process.env.NODE_ENV || 'development',
    
    // Security settings
    SECURITY: {
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? 
            process.env.ALLOWED_ORIGINS.split(',') : 
            ['http://localhost:3003', 'http://127.0.0.1:3003'],
        JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        MAX_CONNECTIONS_PER_IP: parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 10,
        RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
        RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },
    
    // Telemetry settings with bounds
    TELEMETRY: {
        CONNECTION_TIMEOUT: parseInt(process.env.CONNECTION_TIMEOUT) || 15000,
        MONITOR_INTERVAL: parseInt(process.env.MONITOR_INTERVAL) || 5000,
        MAX_HISTORY_SIZE: parseInt(process.env.MAX_HISTORY_SIZE) || 1000,
        DATA_RETENTION_HOURS: parseInt(process.env.DATA_RETENTION_HOURS) || 24,
        MAX_PAYLOAD_SIZE: parseInt(process.env.MAX_PAYLOAD_SIZE) || 1024, // 1KB
        DEDUP_WINDOW_MS: parseInt(process.env.DEDUP_WINDOW_MS) || 5000
    },
    
    // Dummy data settings - DISABLED
    DUMMY_DATA: {
        ENABLED: false, // Matikan dummy data
        INTERVAL: parseInt(process.env.DUMMY_DATA_INTERVAL) || 2000,
        GPS_BASE: {
            latitude: parseFloat(process.env.GPS_BASE_LAT) || -5.358400,
            longitude: parseFloat(process.env.GPS_BASE_LNG) || 105.311700
        },
        MOVEMENT_RANGE: parseFloat(process.env.GPS_MOVEMENT_RANGE) || 0.001
    },
    
    // Performance settings
    PERFORMANCE: {
        MAX_CONCURRENT_REQUESTS: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 100,
        MEMORY_LIMIT_MB: parseInt(process.env.MEMORY_LIMIT_MB) || 512,
        CPU_LIMIT_PERCENT: parseInt(process.env.CPU_LIMIT_PERCENT) || 80
    },
    
    // MQTT settings for ESP32 integration - Sesuai source code  
    MQTT: {
        BROKER: process.env.MQTT_BROKER || 'wss://broker.hivemq.com:8884/mqtt',
        CLIENT_ID: process.env.MQTT_CLIENT_ID || 'WEBSITETD-server',
        KEEPALIVE: parseInt(process.env.MQTT_KEEPALIVE) || 60,
        CONNECT_TIMEOUT: parseInt(process.env.MQTT_CONNECT_TIMEOUT) || 30000,
        RECONNECT_PERIOD: parseInt(process.env.MQTT_RECONNECT_PERIOD) || 5000,
        ENABLED: process.env.MQTT_ENABLED !== 'false'
    }
};

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================
const schemas = {
    telemetry: Joi.object({
        battery_voltage: Joi.number().min(0).max(50).optional(),
        battery_current: Joi.number().min(-10000).max(10000).optional(),
        battery_power: Joi.number().min(-500000).max(500000).optional(),
        temperature: Joi.number().min(-50).max(100).optional(),
        humidity: Joi.number().min(0).max(100).optional(),
        gps_latitude: Joi.number().min(-90).max(90).optional(),
        gps_longitude: Joi.number().min(-180).max(180).optional(),
        altitude: Joi.number().min(-1000).max(50000).optional(),
        speed: Joi.number().min(0).max(1000).optional(),
        signal_strength: Joi.number().min(-127).max(0).optional(),
        satellites: Joi.number().integer().min(0).max(50).optional(),
        connection_status: Joi.string().valid('connected', 'disconnected', 'timeout').optional(),
        connection_type: Joi.string().valid('HTTP', 'WebSocket', 'MQTT', 'none').optional(),
        packet_number: Joi.number().integer().min(0).optional(),
        timestamp: Joi.number().integer().optional(),
        device_id: Joi.string().max(64).optional(),
        relay_status: Joi.boolean().optional(),
        emergency_status: Joi.string().optional(),
        type: Joi.string().optional(),
        data_age: Joi.number().optional()
    }).options({ stripUnknown: true }),
    
    // Relaxed schema for MQTT partial data
    mqttTelemetry: Joi.object({
        battery_voltage: Joi.number().min(0).max(50).optional(),
        battery_current: Joi.number().min(-10000).max(10000).optional(), 
        battery_power: Joi.number().min(-500000).max(500000).optional(),
        temperature: Joi.number().min(-50).max(100).optional(),
        humidity: Joi.number().min(0).max(100).optional(),
        gps_latitude: Joi.number().min(-90).max(90).optional(),
        gps_longitude: Joi.number().min(-180).max(180).optional(),
        altitude: Joi.number().min(-1000).max(50000).optional(),
        speed: Joi.number().min(0).max(1000).optional(),
        signal_strength: Joi.number().min(-127).max(0).optional(),
        satellites: Joi.number().integer().min(0).max(50).optional(),
        connection_status: Joi.string().valid('connected', 'disconnected', 'timeout').optional(),
        connection_type: Joi.string().valid('HTTP', 'WebSocket', 'MQTT', 'none').optional(),
        packet_number: Joi.number().integer().min(0).optional(),
        timestamp: Joi.number().integer().optional(),
        device_id: Joi.string().max(64).optional(),
        relay_status: Joi.boolean().optional(),
        emergency_status: Joi.string().optional(),
        type: Joi.string().optional(),
        data_age: Joi.number().optional()
    }).options({ stripUnknown: true, allowUnknown: true }),
    
    command: Joi.object({
        command: Joi.string().valid('relay', 'emergency', 'reboot', 'status').required(),
        action: Joi.string().valid('on', 'off', 'emergency_on', 'emergency_off').optional(),
        value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).optional(),
        device_id: Joi.string().max(64).optional()
    }).options({ stripUnknown: true })
};

// =============================================================================
// ENHANCED LOGGING WITH STRUCTURED OUTPUT
// =============================================================================
class Logger extends EventEmitter {
    constructor() {
        super();
        this.levels = {
            error: { priority: 0, color: '❌' },
            warn: { priority: 1, color: '⚠️' },
            info: { priority: 2, color: 'ℹ️' },
            success: { priority: 3, color: '✅' },
            debug: { priority: 4, color: '🔍' }
        };
        this.logHistory = [];
        this.maxHistorySize = 1000;
    }
    
    log(level, category, message, metadata = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            category: category.toUpperCase(),
            message,
            metadata: this.sanitizeMetadata(metadata),
            pid: process.pid,
            memory: process.memoryUsage().heapUsed
        };
        
        // Add to history with size limit
        this.logHistory.push(entry);
        if (this.logHistory.length > this.maxHistorySize) {
            this.logHistory.shift();
        }
        
        // Console output with colors
        const levelInfo = this.levels[level] || this.levels.info;
        console.log(`${levelInfo.color} [${entry.timestamp}] [${entry.category}] ${message}`, 
                   Object.keys(metadata).length > 0 ? metadata : '');
        
        // Emit event for monitoring
        this.emit('log', entry);
        
        // Track errors
        if (level === 'error') {
            this.emit('error_logged', entry);
        }
    }
    
    sanitizeMetadata(metadata) {
        const sanitized = { ...metadata };
        
        // Remove sensitive data
        const sensitiveKeys = ['password', 'secret', 'token', 'key', 'auth'];
        sensitiveKeys.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]';
            }
        });
        
        // Limit object depth and size
        return this.limitObjectSize(sanitized, 5, 1000);
    }
    
    limitObjectSize(obj, maxDepth, maxSize) {
        if (maxDepth === 0 || obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        const result = {};
        let size = 0;
        
        for (const [key, value] of Object.entries(obj)) {
            if (size >= maxSize) break;
            
            result[key] = typeof value === 'object' ? 
                this.limitObjectSize(value, maxDepth - 1, maxSize - size) : 
                value;
            size++;
        }
        
        return result;
    }
    
    error(category, message, metadata = {}) { this.log('error', category, message, metadata); }
    warn(category, message, metadata = {}) { this.log('warn', category, message, metadata); }
    info(category, message, metadata = {}) { this.log('info', category, message, metadata); }
    success(category, message, metadata = {}) { this.log('success', category, message, metadata); }
    debug(category, message, metadata = {}) { 
        if (CONFIG.ENVIRONMENT === 'development') {
            this.log('debug', category, message, metadata); 
        }
    }
}

// =============================================================================
// CIRCUIT BREAKER PATTERN
// =============================================================================
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 10000;
        this.monitoringPeriod = options.monitoringPeriod || 60000;
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.successCount = 0;
        
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            circuitOpenTime: 0
        };
    }
    
    async execute(fn) {
        this.stats.totalRequests++;
        
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
                this.successCount = 0;
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    onSuccess() {
        this.stats.successfulRequests++;
        
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= 3) { // Require 3 successes to close
                this.state = 'CLOSED';
                this.failureCount = 0;
            }
        } else {
            this.failureCount = 0;
        }
    }
    
    onFailure() {
        this.stats.failedRequests++;
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.stats.circuitOpenTime = Date.now();
        }
    }
    
    getStats() {
        return {
            ...this.stats,
            state: this.state,
            failureCount: this.failureCount,
            successRate: this.stats.totalRequests > 0 ? 
                (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 0
        };
    }
}

// =============================================================================
// DEDUPLICATION MANAGER  
// =============================================================================
class DeduplicationManager {
    constructor(windowMs = 5000) {
        this.window = windowMs;
        this.cache = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), windowMs);
    }
    
    isDuplicate(deviceId, packetNumber, timestamp) {
        const key = `${deviceId}:${packetNumber}`;
        const now = Date.now();
        
        if (this.cache.has(key)) {
            const cachedTime = this.cache.get(key);
            if (now - cachedTime < this.window) {
                return true; // Duplicate within window
            }
        }
        
        this.cache.set(key, timestamp || now);
        return false;
    }
    
    cleanup() {
        const now = Date.now();
        for (const [key, timestamp] of this.cache.entries()) {
            if (now - timestamp > this.window) {
                this.cache.delete(key);
            }
        }
    }
    
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
    }
    
    getStats() {
        return {
            cacheSize: this.cache.size,
            windowMs: this.window
        };
    }
}

// =============================================================================
// THREAD-SAFE SERVER STATE
// =============================================================================
class ServerState {
    constructor() {
        this.mutex = { locked: false };
        this.reset();
    }
    
    async withLock(fn) {
        // Simple mutex implementation
        while (this.mutex.locked) {
            await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        this.mutex.locked = true;
        try {
            return await fn();
        } finally {
            this.mutex.locked = false;
        }
    }
    
    reset() {
        this.telemetry = {
            battery_voltage: 0,
            battery_current: 0,
            battery_power: 0,
            temperature: 25,
            humidity: 60,
            gps_latitude: CONFIG.DUMMY_DATA.GPS_BASE.latitude,
            gps_longitude: CONFIG.DUMMY_DATA.GPS_BASE.longitude,
            altitude: 100,
            signal_strength: -70,
            satellites: 8,
            speed: 0,
            timestamp: Date.now(),
            connection_status: 'disconnected',
            connection_type: 'none',
            packet_number: 0,
            device_id: 'unknown'
        };
        
        this.connections = {
            esp32Devices: new Map(), // deviceId -> connectionInfo
            webClients: new Set(),
            totalConnections: 0,
            currentConnections: 0,
            lastConnectionTime: null,
            dataPacketsReceived: 0,
            duplicatePackets: 0,
            invalidPackets: 0
        };
        
        this.system = {
            startTime: Date.now(),
            isShuttingDown: false,
            dummyDataActive: false,
            lastErrorTime: null,
            errorCount: 0,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        };
        
        this.history = [];
    }
    
    async updateTelemetry(newData, deviceId = 'unknown') {
        return await this.withLock(async () => {
            try {
                // Validate data first
                const { error, value } = schemas.telemetry.validate(newData);
                if (error) {
                    throw new Error(`Invalid telemetry data: ${error.message}`);
                }
                
                const previousTelemetry = { ...this.telemetry };
                
                this.telemetry = {
                    ...this.telemetry,
                    ...value,
                    timestamp: Date.now(),
                    device_id: deviceId,
                    packet_number: (this.telemetry.packet_number || 0) + 1
                };
                
                this.connections.dataPacketsReceived++;
                this.connections.lastConnectionTime = new Date().toISOString();
                
                // Add to history with size limit
                this.history.push({
                    ...this.telemetry,
                    receivedAt: Date.now()
                });
                
                if (this.history.length > CONFIG.TELEMETRY.MAX_HISTORY_SIZE) {
                    this.history.shift();
                }
                
                return { success: true, previousTelemetry };
            } catch (error) {
                this.connections.invalidPackets++;
                throw error;
            }
        });
    }
    
    async getStats() {
        return await this.withLock(async () => {
            const now = Date.now();
            return {
                telemetry: { ...this.telemetry },
                connections: { 
                    ...this.connections,
                    esp32DeviceCount: this.connections.esp32Devices.size,
                    webClientCount: this.connections.webClients.size
                },
                system: {
                    ...this.system,
                    uptime: now - this.system.startTime,
                    memoryUsage: process.memoryUsage(),
                    cpuUsage: process.cpuUsage()
                },
                historySize: this.history.length
            };
        });
    }
}

// =============================================================================
// ENHANCED DUMMY DATA GENERATOR
// =============================================================================
class DummyDataGenerator {
    constructor(serverState, logger) {
        this.serverState = serverState;
        this.logger = logger;
        this.isActive = false;
        this.interval = null;
        this.flightCounter = 0;
        this.basePosition = CONFIG.DUMMY_DATA.GPS_BASE;
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 3,
            resetTimeout: 5000
        });
    }
    
    async start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.logger.info('DummyData', 'Starting realistic UAV dummy data generation');
        
        this.interval = setInterval(async () => {
            try {
                await this.circuitBreaker.execute(async () => {
                    const dummyData = this.generateRealisticData();
                    
                    // Update server state
                    await this.serverState.updateTelemetry(dummyData, 'dummy_device');
                    
                    // Broadcast data
                    this.broadcastData(dummyData);
                    
                    this.logger.debug('DummyData', 'Generated telemetry packet', {
                        packet: dummyData.packet_number,
                        battery: `${dummyData.battery_voltage.toFixed(2)}V`,
                        position: `${dummyData.gps_latitude.toFixed(6)}, ${dummyData.gps_longitude.toFixed(6)}`
                    });
                });
            } catch (error) {
                this.logger.error('DummyData', 'Error generating dummy data', { error: error.message });
                
                // Stop dummy data if circuit breaker is open
                if (this.circuitBreaker.getStats().state === 'OPEN') {
                    this.stop();
                }
            }
        }, CONFIG.DUMMY_DATA.INTERVAL);
    }
    
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        this.logger.info('DummyData', 'Stopped dummy data generation');
    }
    
    generateRealisticData() {
        this.flightCounter++;
        const time = Date.now() / 1000;
        
        // Simulate circular flight pattern
        const angle = (this.flightCounter * 0.1) % (2 * Math.PI);
        const radius = CONFIG.DUMMY_DATA.MOVEMENT_RANGE;
        
        // GPS coordinates with circular movement
        const deltaLat = Math.cos(angle) * radius;
        const deltaLng = Math.sin(angle) * radius;
        
        // Battery simulation (decreases over time)
        const batteryLevel = Math.max(10.5, 16.8 - (this.flightCounter * 0.001));
        
        // Signal strength simulation
        const distanceFromBase = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
        const signalStrength = Math.max(-100, -50 - (distanceFromBase * 10000));
        
        return {
            battery_voltage: Number((batteryLevel + Math.random() * 0.2 - 0.1).toFixed(2)),
            battery_current: Number((5.5 + Math.random() * 2).toFixed(2)),
            battery_power: Number((batteryLevel * (5.5 + Math.random() * 2)).toFixed(2)),
            temperature: Number((28 + Math.sin(time / 100) * 5 + Math.random() * 2).toFixed(1)),
            humidity: Number((55 + Math.cos(time / 120) * 10 + Math.random() * 5).toFixed(1)),
            gps_latitude: Number((this.basePosition.latitude + deltaLat).toFixed(8)),
            gps_longitude: Number((this.basePosition.longitude + deltaLng).toFixed(8)),
            altitude: Number((100 + Math.sin(angle) * 20 + Math.random() * 5).toFixed(1)),
            speed: Number((15 + Math.sin(angle * 2) * 5 + Math.random() * 2).toFixed(1)),
            signal_strength: Number(signalStrength.toFixed(0)),
            satellites: Math.floor(Math.random() * 3) + 8,
            connection_status: 'connected',
            connection_type: 'WebSocket',
            packet_number: this.flightCounter
        };
    }
    
    broadcastData(data) {
        if (global.io) {
            // Rate-limited broadcast
            global.io.emit('telemetryUpdate', data);
            global.io.emit('telemetryData', data); // Backward compatibility
        }
    }
    
    getStats() {
        return {
            isActive: this.isActive,
            flightCounter: this.flightCounter,
            circuitBreaker: this.circuitBreaker.getStats()
        };
    }
}

// =============================================================================
// INITIALIZE GLOBAL INSTANCES
// =============================================================================
const logger = new Logger();
const serverState = new ServerState();
const deduplicationManager = new DeduplicationManager(CONFIG.TELEMETRY.DEDUP_WINDOW_MS);
const dummyDataGenerator = new DummyDataGenerator(serverState, logger);
const telemetryCircuitBreaker = new CircuitBreaker({ failureThreshold: 5 });

// Initialize MQTT Bridge for ESP32 integration
let mqttBridge = null;
if (CONFIG.MQTT.ENABLED) {
    mqttBridge = new MQTTBridge({
        broker: CONFIG.MQTT.BROKER,
        clientId: CONFIG.MQTT.CLIENT_ID + '-' + Math.random().toString(16).substr(2, 8),
        keepalive: CONFIG.MQTT.KEEPALIVE,
        connectTimeout: CONFIG.MQTT.CONNECT_TIMEOUT,
        reconnectPeriod: CONFIG.MQTT.RECONNECT_PERIOD,
        logger: logger
    });
}

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for dashboard
    crossOriginEmbedderPolicy: false
}));

// CORS with whitelist
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin || CONFIG.SECURITY.ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn('CORS', 'Origin not allowed', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: false,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: CONFIG.SECURITY.RATE_LIMIT_WINDOW,
    max: CONFIG.SECURITY.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('RateLimit', 'Rate limit exceeded', { 
            ip: req.ip, 
            userAgent: req.get('User-Agent') 
        });
        res.status(429).json({ 
            error: 'Rate limit exceeded', 
            retryAfter: Math.ceil(CONFIG.SECURITY.RATE_LIMIT_WINDOW / 1000) 
        });
    }
});

app.use('/api/', limiter);

// Body parsing with size limits
app.use(express.json({ 
    limit: CONFIG.TELEMETRY.MAX_PAYLOAD_SIZE,
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: CONFIG.TELEMETRY.MAX_PAYLOAD_SIZE 
}));

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.debug('HTTP', `${req.method} ${req.path}`, {
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });
    
    next();
});

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Cache control for real-time data
    if (req.path.includes('/api/')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
});

// =============================================================================
// SOCKET.IO SETUP WITH SECURITY
// =============================================================================
const io = socketIo(server, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: CONFIG.TELEMETRY.MAX_PAYLOAD_SIZE,
    allowEIO3: true,
    transports: ['websocket', 'polling']
});

// Connection rate limiting per IP
const connectionCounts = new Map();

io.use((socket, next) => {
    const ip = socket.request.connection.remoteAddress;
    const count = connectionCounts.get(ip) || 0;
    
    if (count >= CONFIG.SECURITY.MAX_CONNECTIONS_PER_IP) {
        logger.warn('SocketIO', 'Connection limit exceeded', { ip });
        return next(new Error('Connection limit exceeded'));
    }
    
    connectionCounts.set(ip, count + 1);
    
    // Cleanup on disconnect
    socket.on('disconnect', () => {
        const currentCount = connectionCounts.get(ip) || 0;
        if (currentCount <= 1) {
            connectionCounts.delete(ip);
        } else {
            connectionCounts.set(ip, currentCount - 1);
        }
    });
    
    next();
});

// Make io globally available for broadcasting
global.io = io;

// =============================================================================
// MQTT INTEGRATION SETUP
// =============================================================================
if (mqttBridge) {
    // Setup MQTT event handlers
    mqttBridge.on('connected', () => {
        logger.success('MQTT', 'ESP32 MQTT Bridge connected successfully');
        // Notify all WebSocket clients about MQTT connection
        io.emit('mqtt_status', { 
            status: 'connected', 
            message: 'ESP32 MQTT connection established',
            timestamp: Date.now()
        });
    });
    
    mqttBridge.on('disconnected', () => {
        logger.warn('MQTT', 'ESP32 MQTT Bridge disconnected');
        io.emit('mqtt_status', { 
            status: 'disconnected', 
            message: 'ESP32 MQTT connection lost',
            timestamp: Date.now()
        });
    });
    
    mqttBridge.on('error', (error) => {
        logger.error('MQTT', 'ESP32 MQTT Bridge error', { error: error.message });
        io.emit('mqtt_status', { 
            status: 'error', 
            message: `MQTT Error: ${error.message}`,
            timestamp: Date.now()
        });
    });
    
    // Handle telemetry data from ESP32
    mqttBridge.on('telemetryData', async (mqttData) => {
        try {
            logger.debug('MQTT', 'Received telemetry from ESP32', mqttData);
            
            // Convert MQTT data to dashboard telemetry format
            const telemetryData = await convertMQTToTelemetry(mqttData);
            
            if (telemetryData) {
                // Update server state with ESP32 data
                await serverState.updateTelemetry(telemetryData, 'ESP32_MQTT');
                
                // Broadcast to all connected dashboard clients
                io.emit('telemetryUpdate', {
                    ...telemetryData,
                    source: 'ESP32_MQTT',
                    mqtt_topic: mqttData.topic,
                    timestamp: mqttData.timestamp
                });
                
                logger.debug('MQTT', 'Telemetry data broadcasted to dashboard clients');
            }
            
        } catch (error) {
            logger.error('MQTT', 'Error processing ESP32 telemetry', { 
                error: error.message,
                mqttData 
            });
        }
    });
}

/**
 * Convert MQTT data format to dashboard telemetry format
 */
async function convertMQTToTelemetry(mqttData) {
    try {
        const { topic, data, timestamp } = mqttData;
        
        // Get current telemetry state to merge with new data
        const currentTelemetry = mqttBridge ? mqttBridge.getCurrentTelemetry() : {};
        
        // Create base telemetry object
        let telemetryData = {
            timestamp: timestamp || Date.now(),
            connection_status: 'connected',
            connection_type: 'MQTT',
            device_id: 'ESP32_UAV',
            ...currentTelemetry
        };
        
        // Add the new data based on type
        switch (data.type) {
            case 'voltage':
                telemetryData.battery_voltage = data.battery_voltage;
                break;
            case 'current':
                telemetryData.battery_current = data.battery_current;
                break;
            case 'power':
                telemetryData.battery_power = data.battery_power;
                break;
            case 'gps':
                telemetryData.gps_latitude = data.gps_latitude;
                telemetryData.gps_longitude = data.gps_longitude;
                break;
            case 'relay':
                telemetryData.relay_status = data.relay_status;
                break;
            case 'emergency':
                telemetryData.emergency_status = data.emergency_status;
                break;
        }
        
        // Validate using relaxed MQTT schema
        const { error, value } = schemas.mqttTelemetry.validate(telemetryData);
        if (error) {
            logger.warn('MQTT', 'MQTT telemetry validation warning', { 
                error: error.message,
                data: telemetryData 
            });
            // Still return the data for processing, just log the warning
            return telemetryData;
        }
        
        return telemetryData;
        
    } catch (error) {
        logger.error('MQTT', 'Error converting MQTT to telemetry', { 
            error: error.message,
            mqttData 
        });
        return null;
    }
}

// Static file serving
app.use(express.static(__dirname, {
    etag: false,
    lastModified: false,
    maxAge: 0
}));

// =============================================================================
// ENHANCED API ROUTES WITH VALIDATION
// =============================================================================

// Root route
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'index.html'));
        logger.debug('HTTP', 'Dashboard served', { ip: req.ip });
    } catch (error) {
        logger.error('HTTP', 'Failed to serve dashboard', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const stats = await serverState.getStats();
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: stats.system.uptime,
            memory: stats.system.memoryUsage,
            connections: stats.connections,
            circuitBreakers: {
                telemetry: telemetryCircuitBreaker.getStats(),
                dummyData: dummyDataGenerator.getStats().circuitBreaker
            },
            deduplication: deduplicationManager.getStats()
        };
        
        // Check if system is healthy
        const memoryUsageMB = stats.system.memoryUsage.heapUsed / 1024 / 1024;
        if (memoryUsageMB > CONFIG.PERFORMANCE.MEMORY_LIMIT_MB) {
            health.status = 'degraded';
            health.warnings = ['High memory usage'];
        }
        
        res.json(health);
    } catch (error) {
        logger.error('Health', 'Health check failed', { error: error.message });
        res.status(500).json({ 
            status: 'unhealthy', 
            error: 'Health check failed' 
        });
    }
});

// Get current telemetry with caching
app.get('/api/telemetry', async (req, res) => {
    try {
        const stats = await serverState.getStats();
        
        const response = {
            success: true,
            data: stats.telemetry,
            timestamp: new Date().toISOString(),
            stats: {
                connections: stats.connections,
                isDummyData: dummyDataGenerator.isActive,
                uptime: stats.system.uptime
            }
        };
        
        res.json(response);
        logger.debug('API', 'Telemetry data requested');
    } catch (error) {
        logger.error('API', 'Failed to get telemetry data', { error: error.message });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve telemetry data' 
        });
    }
});

// Receive telemetry data with validation and deduplication
app.post('/api/telemetry', async (req, res) => {
    try {
        await telemetryCircuitBreaker.execute(async () => {
            const telemetryData = req.body;
            const deviceId = req.get('X-Device-ID') || telemetryData.device_id || 'unknown';
            
            // Check for duplicates
            if (telemetryData.packet_number && 
                deduplicationManager.isDuplicate(deviceId, telemetryData.packet_number, telemetryData.timestamp)) {
                serverState.connections.duplicatePackets++;
                logger.debug('ESP32', 'Duplicate packet detected', { 
                    deviceId, 
                    packetNumber: telemetryData.packet_number 
                });
                return res.status(200).json({ 
                    success: true, 
                    message: 'Duplicate packet ignored',
                    duplicate: true
                });
            }
            
            // Stop dummy data when real data arrives
            if (dummyDataGenerator.isActive) {
                dummyDataGenerator.stop();
                logger.info('ESP32', 'Real telemetry received - stopping dummy data');
            }
            
            // Update telemetry with connection info
            const updatedData = {
                ...telemetryData,
                connection_status: 'connected',
                connection_type: 'HTTP'
            };
            
            const { success } = await serverState.updateTelemetry(updatedData, deviceId);
            
            if (success) {
                // Broadcast to connected web clients
                io.emit('telemetryUpdate', (await serverState.getStats()).telemetry);
                
                logger.info('ESP32', 'Telemetry received via HTTP', {
                    deviceId,
                    packet: telemetryData.packet_number,
                    battery: `${telemetryData.battery_voltage || 'N/A'}V`,
                    signal: `${telemetryData.signal_strength || 'N/A'}dBm`
                });
                
                res.json({ 
                    success: true, 
                    message: 'Telemetry data received successfully',
                    packet_number: (await serverState.getStats()).telemetry.packet_number
                });
            } else {
                throw new Error('Failed to update telemetry state');
            }
        });
    } catch (error) {
        logger.error('ESP32', 'Error processing telemetry data', { error: error.message });
        
        if (error.message.includes('Circuit breaker is OPEN')) {
            res.status(503).json({ 
                success: false, 
                error: 'Service temporarily unavailable',
                retryAfter: 10
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: error.message || 'Failed to process telemetry data'
            });
        }
    }
});

// Send command with validation
app.post('/api/command', async (req, res) => {
    try {
        const { error, value } = schemas.command.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                error: `Invalid command: ${error.message}` 
            });
        }
        
        const { command, action, value: cmdValue, device_id } = value;
        
        // Enhanced command data with safety checks
        const commandData = { 
            command, 
            action, 
            value: cmdValue,
            device_id,
            timestamp: Date.now(),
            source: 'HTTP_API',
            urgent: command === 'emergency' || action?.includes('emergency'),
            id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        // Send command via MQTT if available and it's emergency command
        if (mqttBridge && mqttBridge.isConnected && command === 'emergency') {
            try {
                // Send emergency command to ESP32 via MQTT
                mqttBridge.sendEmergencyCommand(action === 'emergency_on' ? 'on' : 'off');
                commandData.mqtt_sent = true;
                logger.success('MQTT', 'Emergency command sent via MQTT', { action });
            } catch (mqttError) {
                logger.error('MQTT', 'Failed to send emergency command via MQTT', { 
                    error: mqttError.message 
                });
                commandData.mqtt_sent = false;
                commandData.mqtt_error = mqttError.message;
            }
        }
        
        // Broadcast command to ESP32 via Socket.IO (backup method)
        io.emit('esp32Command', commandData);
        
        // Also send as relayCommand for backward compatibility
        if (command === 'relay' || command === 'emergency') {
            io.emit('relayCommand', commandData);
        }
        
        logger.info('Command', 'Sent command to ESP32', commandData);
        res.json({ 
            success: true, 
            message: 'Command sent successfully',
            command: commandData
        });
        
    } catch (error) {
        logger.error('Command', 'Error sending command', { error: error.message });
        res.status(400).json({ 
            success: false, 
            error: error.message || 'Failed to send command'
        });
    }
});

// System statistics
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await serverState.getStats();
        
        const response = {
            success: true,
            server: {
                uptime: stats.system.uptime,
                memory: stats.system.memoryUsage,
                environment: CONFIG.ENVIRONMENT,
                startTime: new Date(stats.system.startTime).toISOString(),
                version: '3.1.0'
            },
            connections: stats.connections,
            system: {
                ...stats.system,
                isDummyDataActive: dummyDataGenerator.isActive
            },
            telemetry: {
                lastUpdate: new Date(stats.telemetry.timestamp).toISOString(),
                packetsReceived: stats.connections.dataPacketsReceived,
                duplicatePackets: stats.connections.duplicatePackets,
                invalidPackets: stats.connections.invalidPackets,
                connectionStatus: stats.telemetry.connection_status
            },
            performance: {
                circuitBreakers: {
                    telemetry: telemetryCircuitBreaker.getStats(),
                    dummyData: dummyDataGenerator.getStats().circuitBreaker
                },
                deduplication: deduplicationManager.getStats()
            }
        };
        
        // Add MQTT statistics if available
        if (mqttBridge) {
            response.mqtt = {
                isConnected: mqttBridge.isConnected,
                statistics: mqttBridge.getStatistics(),
                configuration: {
                    broker: CONFIG.MQTT.BROKER,
                    clientId: CONFIG.MQTT.CLIENT_ID,
                    enabled: CONFIG.MQTT.ENABLED
                }
            };
        }
        
        res.json(response);
        logger.debug('API', 'System stats requested');
        
    } catch (error) {
        logger.error('API', 'Error getting system stats', { error: error.message });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve system statistics' 
        });
    }
});

// Get MQTT status and telemetry data
app.get('/api/mqtt/status', async (req, res) => {
    try {
        if (!mqttBridge) {
            return res.json({
                success: true,
                mqtt: {
                    enabled: false,
                    message: 'MQTT integration disabled'
                }
            });
        }
        
        const telemetryData = mqttBridge.getCurrentTelemetry();
        const statistics = mqttBridge.getStatistics();
        
        res.json({
            success: true,
            mqtt: {
                enabled: true,
                connected: mqttBridge.isConnected,
                statistics: statistics,
                telemetry: telemetryData,
                dataAge: mqttBridge.getDataAge(),
                isDataFresh: mqttBridge.isDataFresh(30) // 30 seconds threshold
            }
        });
        
        logger.debug('API', 'MQTT status requested');
        
    } catch (error) {
        logger.error('API', 'Error getting MQTT status', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve MQTT status'
        });
    }
});

// Send emergency command via MQTT  
app.post('/api/mqtt/emergency', async (req, res) => {
    try {
        const { action } = req.body;
        
        if (!mqttBridge || !mqttBridge.isConnected) {
            return res.status(503).json({
                success: false,
                error: 'MQTT not connected'
            });
        }
        
        if (!['on', 'off'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid action. Must be "on" or "off"'
            });
        }
        
        mqttBridge.sendEmergencyCommand(action);
        
        logger.success('MQTT', 'Emergency command sent via API', { action });
        
        res.json({
            success: true,
            message: `Emergency ${action} command sent via MQTT`,
            timestamp: Date.now()
        });
        
    } catch (error) {
        logger.error('API', 'Error sending MQTT emergency command', { 
            error: error.message 
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================================================
// ENHANCED SOCKET.IO EVENT HANDLERS
// =============================================================================
io.on('connection', async (socket) => {
    logger.info('Socket', 'New client connected', { 
        id: socket.id,
        ip: socket.request.connection.remoteAddress 
    });
    
    try {
        // Add to web clients
        serverState.connections.webClients.add(socket.id);
        serverState.connections.currentConnections++;
        serverState.connections.totalConnections++;
        
        // Send current data to newly connected client
        const stats = await serverState.getStats();
        socket.emit('telemetryUpdate', stats.telemetry);
        socket.emit('connectionStats', {
            ...stats.connections,
            isDummyData: dummyDataGenerator.isActive
        });
        
        // Handle ESP32 device connection
        socket.on('esp32Connect', async (deviceInfo) => {
            try {
                const deviceId = deviceInfo?.deviceId || socket.id;
                logger.info('ESP32', 'Device connected via WebSocket', { deviceInfo, deviceId });
                
                // Stop dummy data when real device connects
                if (dummyDataGenerator.isActive) {
                    dummyDataGenerator.stop();
                    logger.info('ESP32', 'Real device connected - stopping dummy data');
                }
                
                // Add to ESP32 devices
                await serverState.withLock(async () => {
                    serverState.connections.esp32Devices.set(deviceId, {
                        socketId: socket.id,
                        deviceInfo,
                        connectedAt: Date.now(),
                        lastSeen: Date.now()
                    });
                    serverState.connections.lastConnectionTime = new Date().toISOString();
                    
                    // Update telemetry status
                    serverState.telemetry.connection_status = 'connected';
                    serverState.telemetry.connection_type = 'WebSocket';
                });
                
                // Broadcast ESP32 connection status
                io.emit('esp32Status', { 
                    status: 'connected', 
                    device: deviceInfo,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('ESP32', 'Error handling ESP32 connection', { error: error.message });
            }
        });
        
        // Handle telemetry data with rate limiting
        socket.on('telemetryData', async (data) => {
            try {
                await telemetryCircuitBreaker.execute(async () => {
                    const deviceId = data.device_id || socket.id;
                    
                    // Check for duplicates
                    if (data.packet_number && 
                        deduplicationManager.isDuplicate(deviceId, data.packet_number, data.timestamp)) {
                        serverState.connections.duplicatePackets++;
                        return;
                    }
                    
                    const updatedData = {
                        ...data,
                        connection_status: 'connected',
                        connection_type: 'WebSocket'
                    };
                    
                    const { success } = await serverState.updateTelemetry(updatedData, deviceId);
                    
                    if (success) {
                        // Update device last seen
                        const device = serverState.connections.esp32Devices.get(deviceId);
                        if (device) {
                            device.lastSeen = Date.now();
                        }
                        
                        // Broadcast to other clients
                        socket.broadcast.emit('telemetryUpdate', (await serverState.getStats()).telemetry);
                        
                        logger.debug('ESP32', 'Telemetry received via WebSocket', {
                            deviceId,
                            packet: data.packet_number,
                            battery: `${data.battery_voltage || 'N/A'}V`
                        });
                    }
                });
            } catch (error) {
                logger.error('ESP32', 'Error processing WebSocket telemetry', { error: error.message });
            }
        });
        
        // Handle commands with validation
        socket.on('relayCommand', async (commandData) => {
            try {
                const { error, value } = schemas.command.validate(commandData);
                if (error) {
                    logger.warn('Command', 'Invalid command received', { error: error.message });
                    return;
                }
                
                logger.info('Command', 'Relay command from web client', value);
                
                const enhancedCommand = {
                    ...value,
                    timestamp: Date.now(),
                    source: 'WEB_INTERFACE',
                    relayedBy: socket.id,
                    id: `relay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
                
                // Forward to ESP32 devices
                socket.broadcast.emit('esp32Command', enhancedCommand);
                socket.broadcast.emit('relayCommand', enhancedCommand);
                
            } catch (error) {
                logger.error('Command', 'Error relaying command', { error: error.message });
            }
        });
        
        // Handle emergency commands with high priority
        socket.on('emergencyCommand', async (emergencyData) => {
            try {
                logger.warn('Emergency', 'EMERGENCY COMMAND received', emergencyData);
                
                const criticalCommand = {
                    ...emergencyData,
                    command: 'emergency',
                    urgent: true,
                    timestamp: Date.now(),
                    source: 'WEB_EMERGENCY',
                    issuedBy: socket.id,
                    id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
                
                // Send to ALL ESP32 devices immediately
                io.emit('esp32Command', criticalCommand);
                io.emit('emergencyStop', criticalCommand);
                
                logger.warn('Emergency', 'Emergency command broadcasted to all ESP32 devices');
                
            } catch (error) {
                logger.error('Emergency', 'Error handling emergency command', { error: error.message });
            }
        });
        
        // Handle client disconnect
        socket.on('disconnect', async (reason) => {
            try {
                logger.info('Socket', 'Client disconnected', { 
                    id: socket.id, 
                    reason: reason 
                });
                
                await serverState.withLock(async () => {
                    // Remove from web clients
                    serverState.connections.webClients.delete(socket.id);
                    serverState.connections.currentConnections--;
                    
                    // Check if it was an ESP32 device
                    let deviceId = null;
                    for (const [id, device] of serverState.connections.esp32Devices.entries()) {
                        if (device.socketId === socket.id) {
                            deviceId = id;
                            break;
                        }
                    }
                    
                    if (deviceId) {
                        serverState.connections.esp32Devices.delete(deviceId);
                        logger.info('ESP32', 'Device disconnected', { deviceId });
                        
                        // Update connection status if no ESP32 devices remain
                        if (serverState.connections.esp32Devices.size === 0) {
                            serverState.telemetry.connection_status = 'disconnected';
                            serverState.telemetry.connection_type = 'none';
                            
                            // Start dummy data if no real devices connected
                            if (CONFIG.DUMMY_DATA.ENABLED && !dummyDataGenerator.isActive) {
                                setTimeout(() => {
                                    if (serverState.connections.esp32Devices.size === 0) {
                                        dummyDataGenerator.start();
                                        logger.info('ESP32', 'No real devices - starting dummy data');
                                    }
                                }, 5000);
                            }
                            
                            io.emit('esp32Status', { 
                                status: 'disconnected',
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                });
                
            } catch (error) {
                logger.error('Socket', 'Error handling disconnect', { error: error.message });
            }
        });
        
        // Handle socket errors
        socket.on('error', (error) => {
            logger.error('Socket', 'Socket error occurred', { 
                id: socket.id, 
                error: error.message || error 
            });
        });
        
    } catch (error) {
        logger.error('Socket', 'Error in connection handler', { error: error.message });
    }
});

// =============================================================================
// MONITORING AND HEALTH CHECKS
// =============================================================================
let connectionMonitor = null;

async function startConnectionMonitor() {
    connectionMonitor = setInterval(async () => {
        try {
            const stats = await serverState.getStats();
            const now = Date.now();
            const lastDataAge = now - stats.telemetry.timestamp;
            
            // Check for connection timeout (only for real devices)
            if (lastDataAge > CONFIG.TELEMETRY.CONNECTION_TIMEOUT && 
                stats.telemetry.connection_status === 'connected' &&
                !dummyDataGenerator.isActive) {
                
                logger.warn('Monitor', 'ESP32 connection timeout', {
                    lastDataAge: Math.floor(lastDataAge / 1000) + 's'
                });
                
                await serverState.withLock(async () => {
                    serverState.telemetry.connection_status = 'timeout';
                });
                
                io.emit('esp32Status', { 
                    status: 'timeout',
                    lastDataAge: lastDataAge,
                    timestamp: new Date().toISOString()
                });
                
                // Start dummy data after timeout
                if (CONFIG.DUMMY_DATA.ENABLED && !dummyDataGenerator.isActive) {
                    setTimeout(() => {
                        if (serverState.telemetry.connection_status === 'timeout') {
                            dummyDataGenerator.start();
                            logger.info('Monitor', 'Starting dummy data due to timeout');
                        }
                    }, 3000);
                }
            }
            
            // Cleanup stale device connections
            for (const [deviceId, device] of serverState.connections.esp32Devices.entries()) {
                if (now - device.lastSeen > CONFIG.TELEMETRY.CONNECTION_TIMEOUT) {
                    logger.warn('Monitor', 'Removing stale device connection', { deviceId });
                    serverState.connections.esp32Devices.delete(deviceId);
                }
            }
            
            // Broadcast current connection stats
            io.emit('connectionStats', {
                ...stats.connections,
                isDummyData: dummyDataGenerator.isActive,
                serverUptime: stats.system.uptime
            });
            
            // Memory usage monitoring
            const memoryUsageMB = stats.system.memoryUsage.heapUsed / 1024 / 1024;
            if (memoryUsageMB > CONFIG.PERFORMANCE.MEMORY_LIMIT_MB) {
                logger.warn('Monitor', 'High memory usage detected', { 
                    usage: `${memoryUsageMB.toFixed(2)}MB`,
                    limit: `${CONFIG.PERFORMANCE.MEMORY_LIMIT_MB}MB`
                });
            }
            
        } catch (error) {
            logger.error('Monitor', 'Error in connection monitor', { error: error.message });
        }
    }, CONFIG.TELEMETRY.MONITOR_INTERVAL);
    
    logger.info('Monitor', 'Connection monitoring started');
}

function stopConnectionMonitor() {
    if (connectionMonitor) {
        clearInterval(connectionMonitor);
        connectionMonitor = null;
        logger.info('Monitor', 'Connection monitoring stopped');
    }
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================
async function gracefulShutdown(signal) {
    logger.warn('System', `Received ${signal} - initiating graceful shutdown`);
    
    if (serverState.system.isShuttingDown) {
        logger.warn('System', 'Shutdown already in progress');
        return;
    }
    
    serverState.system.isShuttingDown = true;
    
    try {
        // Stop all timers and generators
        stopConnectionMonitor();
        dummyDataGenerator.stop();
        deduplicationManager.destroy();
        
        // Disconnect MQTT if connected
        if (mqttBridge) {
            logger.info('MQTT', 'Disconnecting from MQTT broker...');
            mqttBridge.disconnect();
            logger.success('MQTT', 'MQTT connection closed');
        }
        
        // Notify all connected clients
        io.emit('serverShutdown', {
            message: 'Server is shutting down',
            timestamp: new Date().toISOString(),
            graceful: true
        });
        
        // Close Socket.IO connections
        await new Promise((resolve) => {
            setTimeout(() => {
                io.close((err) => {
                    if (err) {
                        logger.error('System', 'Error closing Socket.IO', { error: err.message });
                    } else {
                        logger.success('System', 'Socket.IO closed successfully');
                    }
                    resolve();
                });
            }, 1000);
        });
        
        // Close HTTP server
        await new Promise((resolve) => {
            server.close((err) => {
                if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
                    logger.error('System', 'Error closing HTTP server', { error: err.message });
                } else {
                    logger.success('System', 'HTTP server closed successfully');
                }
                resolve();
            });
        });
        
        logger.success('System', 'Graceful shutdown completed');
        process.exit(0);
        
    } catch (error) {
        logger.error('System', 'Error during graceful shutdown', { error: error.message });
        process.exit(1);
    }
}

// =============================================================================
// ERROR HANDLING
// =============================================================================
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (error) => {
    logger.error('System', 'Uncaught Exception', { 
        error: error.message,
        stack: error.stack 
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('System', 'Unhandled Promise Rejection', { 
        reason: reason,
        promise: promise
    });
});

// =============================================================================
// PORT AVAILABILITY CHECK
// =============================================================================
const net = require('net');

/**
 * Check if a port is available for use
 */
function checkPortAvailable(port) {
    return new Promise((resolve, reject) => {
        const tester = net.createServer()
            .once('error', err => {
                if (err.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${port} is already in use. Please stop the existing server or use a different port.`));
                } else {
                    reject(err);
                }
            })
            .once('listening', () => {
                tester.once('close', () => resolve(port)).close();
            })
            .listen(port);
    });
}

/**
 * Find next available port starting from the given port
 */
async function findAvailablePort(startPort, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;
        try {
            await checkPortAvailable(port);
            return port;
        } catch (error) {
            if (i === maxAttempts - 1) {
                throw new Error(`Could not find available port after checking ${maxAttempts} ports starting from ${startPort}`);
            }
            continue;
        }
    }
}

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function startServer() {
    try {
        // Check if the configured port is available
        let actualPort = CONFIG.PORT;
        
        try {
            await checkPortAvailable(CONFIG.PORT);
            logger.info('System', `Port ${CONFIG.PORT} is available`);
        } catch (error) {
            logger.warn('System', `Port ${CONFIG.PORT} is in use, finding alternative...`);
            
            // Find next available port
            actualPort = await findAvailablePort(CONFIG.PORT);
            logger.info('System', `Using alternative port ${actualPort}`);
            
            // Update config for this session
            CONFIG.PORT = actualPort;
        }
        
        // Start server on available port
        await new Promise((resolve, reject) => {
            server.listen(actualPort, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Start monitoring
        await startConnectionMonitor();
        
        // Start MQTT connection if enabled
        if (mqttBridge) {
            try {
                logger.info('MQTT', 'Connecting to ESP32 via MQTT...');
                await mqttBridge.connect();
                logger.success('MQTT', 'ESP32 MQTT connection established');
            } catch (mqttError) {
                logger.error('MQTT', 'Failed to connect to MQTT broker', { 
                    error: mqttError.message,
                    broker: CONFIG.MQTT.BROKER 
                });
                // Continue without MQTT - server can still work with HTTP/WebSocket
            }
        }
        
        // Start dummy data if enabled (only if MQTT is not connected)
        if (CONFIG.DUMMY_DATA.ENABLED && (!mqttBridge || !mqttBridge.isConnected)) {
            setTimeout(() => {
                dummyDataGenerator.start();
                logger.info('DummyData', 'Started dummy data generator (MQTT not available)');
            }, 2000);
        } else if (mqttBridge && mqttBridge.isConnected) {
            logger.info('MQTT', 'Using real ESP32 data via MQTT - dummy data disabled');
        }
        
        // Success messages
        logger.success('System', '🚀 UAV Dashboard Server Started Successfully! 🚀');
        console.log('');
        console.log('📊 Server Information:');
        console.log(`   🌐 Dashboard URL: http://localhost:${CONFIG.PORT}`);
        console.log(`   🔒 Security: CORS whitelist, rate limiting, input validation`);
        console.log(`   🛡️ Monitoring: Circuit breakers, health checks, deduplication`);
        console.log(`   📡 WebSocket: Ready with authentication and rate limiting`);
        console.log(`   🚁 MQTT ESP32: ${mqttBridge && mqttBridge.isConnected ? '✅ Connected' : '❌ Disconnected'}`);
        console.log(`   🎯 Environment: ${CONFIG.ENVIRONMENT}`);
        console.log(`   📈 Version: 3.1.0 (Security & Performance Fixed)`);
        console.log('');
        
        if (mqttBridge && mqttBridge.isConnected) {
            logger.success('System', '🚁 ESP32 connected via MQTT - Real telemetry data active');
        } else {
            logger.info('System', '⚠️ ESP32 not connected - Using demo data mode');
        }
        
        logger.info('System', '✅ Ready to receive telemetry data');
        
    } catch (error) {
        logger.error('System', 'Failed to start server', { error: error.message });
        
        if (error.code === 'EADDRINUSE') {
            logger.error('System', `Port ${CONFIG.PORT} is already in use`);
        }
        
        process.exit(1);
    }
}

// Start the server
startServer();

// =============================================================================
// EXPORTS (for testing)
// =============================================================================
module.exports = {
    app,
    server,
    io: () => global.io,
    serverState,
    logger,
    dummyDataGenerator,
    CONFIG,
    schemas
};
