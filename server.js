/**
 * UAV Dashboard Server - RESTRUCTURED & RELIABLE VERSION
 * 
 * Features:
 * - Modular architecture for easy maintenance
 * - Comprehensive error handling
 * - Dummy data generation for testing
 * - Graceful shutdown with cache clearing
 * - Real-time telemetry support (ESP32 compatible)
 * - Beginner-friendly code structure
 * 
 * @author KRTI Team
 * @version 3.0.0
 */

// =============================================================================
// IMPORTS & DEPENDENCIES
// =============================================================================
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================
const CONFIG = {
    PORT: process.env.PORT || 3003,
    ENVIRONMENT: process.env.NODE_ENV || 'development',
    
    // Telemetry settings
    TELEMETRY: {
        CONNECTION_TIMEOUT: 15000, // 15 seconds
        MONITOR_INTERVAL: 5000,    // 5 seconds
        MAX_HISTORY_SIZE: 1000,
        DATA_RETENTION_HOURS: 24
    },
    
    // Dummy data settings (for testing)
    DUMMY_DATA: {
        ENABLED: true,
        INTERVAL: 2000,           // 2 seconds
        GPS_BASE: {
            latitude: -5.358400,  // ITERA Lampung
            longitude: 105.311700
        },
        MOVEMENT_RANGE: 0.001     // ~100m radius
    },
    
    // CORS settings
    CORS: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: false
    }
};

// =============================================================================
// SERVER STATE MANAGEMENT
// =============================================================================
class ServerState {
    constructor() {
        this.reset();
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
            packet_number: 0
        };
        
        this.connections = {
            esp32Devices: new Set(),
            webClients: new Set(),
            totalConnections: 0,
            currentConnections: 0,
            lastConnectionTime: null,
            dataPacketsReceived: 0
        };
        
        this.system = {
            startTime: Date.now(),
            isShuttingDown: false,
            dummyDataActive: false,
            lastErrorTime: null,
            errorCount: 0
        };
    }
    
    updateTelemetry(newData) {
        try {
            this.telemetry = {
                ...this.telemetry,
                ...newData,
                timestamp: Date.now(),
                packet_number: (this.telemetry.packet_number || 0) + 1
            };
            
            this.connections.dataPacketsReceived++;
            this.connections.lastConnectionTime = new Date().toISOString();
            
            return true;
        } catch (error) {
            logger.error('Failed to update telemetry:', error);
            return false;
        }
    }
}

// =============================================================================
// LOGGING UTILITY
// =============================================================================
class Logger {
    constructor() {
        this.levels = {
            error: { color: '❌', priority: 0 },
            warn: { color: '⚠️', priority: 1 },
            info: { color: '📝', priority: 2 },
            success: { color: '✅', priority: 3 },
            debug: { color: '🔍', priority: 4 }
        };
    }
    
    log(level, category, message, data = null) {
        const timestamp = new Date().toISOString();
        const levelInfo = this.levels[level] || this.levels.info;
        
        let logMessage = `${levelInfo.color} [${timestamp}] [${category.toUpperCase()}] ${message}`;
        
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
        
        // Track errors
        if (level === 'error') {
            serverState.system.lastErrorTime = Date.now();
            serverState.system.errorCount++;
        }
    }
    
    error(category, message, error = null) {
        this.log('error', category, message, error);
    }
    
    warn(category, message, data = null) {
        this.log('warn', category, message, data);
    }
    
    info(category, message, data = null) {
        this.log('info', category, message, data);
    }
    
    success(category, message, data = null) {
        this.log('success', category, message, data);
    }
    
    debug(category, message, data = null) {
        if (CONFIG.ENVIRONMENT === 'development') {
            this.log('debug', category, message, data);
        }
    }
}

// =============================================================================
// DUMMY DATA GENERATOR (FOR TESTING)
// =============================================================================
class DummyDataGenerator {
    constructor() {
        this.isActive = false;
        this.interval = null;
        this.flightCounter = 0;
        this.basePosition = CONFIG.DUMMY_DATA.GPS_BASE;
    }
    
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        serverState.system.dummyDataActive = true;
        
        logger.info('DummyData', 'Starting realistic UAV dummy data generation');
        
        this.interval = setInterval(() => {
            try {
                const dummyData = this.generateRealisticData();
                
                // Update server state
                serverState.updateTelemetry(dummyData);
                
                // Broadcast to all connected clients
                this.broadcastData(dummyData);
                
                logger.debug('DummyData', 'Generated telemetry packet', {
                    packet: dummyData.packet_number,
                    battery: `${dummyData.battery_voltage.toFixed(2)}V`,
                    position: `${dummyData.gps_latitude.toFixed(6)}, ${dummyData.gps_longitude.toFixed(6)}`
                });
                
            } catch (error) {
                logger.error('DummyData', 'Error generating dummy data', error);
            }
        }, CONFIG.DUMMY_DATA.INTERVAL);
    }
    
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        serverState.system.dummyDataActive = false;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        logger.info('DummyData', 'Stopped dummy data generation');
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
        
        // Signal strength simulation (varies with distance)
        const distanceFromBase = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
        const signalStrength = Math.max(-100, -50 - (distanceFromBase * 10000));
        
        return {
            // Battery system
            battery_voltage: Number((batteryLevel + Math.random() * 0.2 - 0.1).toFixed(2)),
            battery_current: Number((5.5 + Math.random() * 2).toFixed(2)),
            battery_power: Number((batteryLevel * (5.5 + Math.random() * 2)).toFixed(2)),
            
            // Environmental
            temperature: Number((28 + Math.sin(time / 100) * 5 + Math.random() * 2).toFixed(1)),
            humidity: Number((55 + Math.cos(time / 120) * 10 + Math.random() * 5).toFixed(1)),
            
            // GPS & Navigation
            gps_latitude: Number((this.basePosition.latitude + deltaLat).toFixed(8)),
            gps_longitude: Number((this.basePosition.longitude + deltaLng).toFixed(8)),
            altitude: Number((100 + Math.sin(angle) * 20 + Math.random() * 5).toFixed(1)),
            speed: Number((15 + Math.sin(angle * 2) * 5 + Math.random() * 2).toFixed(1)),
            
            // Communication
            signal_strength: Number(signalStrength.toFixed(0)),
            satellites: Math.floor(Math.random() * 3) + 8, // 8-10 satellites
            
            // Status
            connection_status: 'connected',
            connection_type: 'test',
            packet_number: this.flightCounter
        };
    }
    
    broadcastData(data) {
        if (io) {
            // Send to web clients
            io.emit('telemetryUpdate', data);
            io.emit('telemetryData', data); // Backward compatibility
            
            // Update connection status
            io.emit('connectionStats', {
                ...serverState.connections,
                isDummyData: true
            });
        }
    }
}

// =============================================================================
// INITIALIZE GLOBAL INSTANCES
// =============================================================================
const serverState = new ServerState();
const logger = new Logger();
const dummyDataGenerator = new DummyDataGenerator();

// =============================================================================
// EXPRESS APP SETUP
// =============================================================================
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: CONFIG.CORS,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Middleware setup
app.use(cors(CONFIG.CORS));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Cache control for real-time data
    if (req.path.includes('/api/')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
});

// Static file serving
app.use(express.static(__dirname, {
    etag: false,
    lastModified: false,
    maxAge: 0
}));

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * Root route - serve main dashboard
 */
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'index.html'));
        logger.debug('HTTP', 'Dashboard served to client', { ip: req.ip });
    } catch (error) {
        logger.error('HTTP', 'Failed to serve dashboard', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Test route - serve electrical monitoring test page
 */
app.get('/test', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'test-electrical.html'));
        logger.debug('HTTP', 'Test page served to client', { ip: req.ip });
    } catch (error) {
        logger.error('HTTP', 'Failed to serve test page', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * ESP32 Test route - serve ESP32 connection test page
 */
app.get('/esp32-test', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'esp32-test.html'));
        logger.debug('HTTP', 'ESP32 test page served to client', { ip: req.ip });
    } catch (error) {
        logger.error('HTTP', 'Failed to serve ESP32 test page', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get current telemetry data
 */
app.get('/api/telemetry', (req, res) => {
    try {
        const response = {
            success: true,
            data: serverState.telemetry,
            timestamp: new Date().toISOString(),
            stats: {
                ...serverState.connections,
                isDummyData: serverState.system.dummyDataActive,
                uptime: Date.now() - serverState.system.startTime
            }
        };
        
        res.json(response);
        logger.debug('API', 'Telemetry data requested');
    } catch (error) {
        logger.error('API', 'Failed to get telemetry data', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve telemetry data' 
        });
    }
});

/**
 * Receive telemetry data from ESP32 (HTTP fallback)
 */
app.post('/api/telemetry', (req, res) => {
    try {
        const telemetryData = req.body;
        
        // Validate incoming data
        if (!telemetryData || typeof telemetryData !== 'object') {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid telemetry data format' 
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
        
        const success = serverState.updateTelemetry(updatedData);
        
        if (success) {
            // Broadcast to all connected web clients
            io.emit('telemetryUpdate', serverState.telemetry);
            io.emit('telemetryData', serverState.telemetry); // Backward compatibility
            
            logger.info('ESP32', 'Telemetry received via HTTP', {
                packet: serverState.telemetry.packet_number,
                battery: `${telemetryData.battery_voltage || 'N/A'}V`,
                signal: `${telemetryData.signal_strength || 'N/A'}dBm`
            });
            
            res.json({ 
                success: true, 
                message: 'Telemetry data received successfully',
                packet_number: serverState.telemetry.packet_number
            });
        } else {
            throw new Error('Failed to update telemetry state');
        }
        
    } catch (error) {
        logger.error('ESP32', 'Error processing telemetry data', error);
        res.status(400).json({ 
            success: false, 
            error: error.message || 'Failed to process telemetry data'
        });
    }
});

/**
 * Send command to ESP32
 */
app.post('/api/command', (req, res) => {
    try {
        const { command, value, action } = req.body;
        
        if (!command) {
            return res.status(400).json({ 
                success: false, 
                error: 'Command is required' 
            });
        }
        
        // Enhanced command data with safety checks
        const commandData = { 
            command, 
            value: value || null, 
            action: action || null,
            timestamp: Date.now(),
            source: 'HTTP_API',
            urgent: command === 'emergency' || action === 'emergency_off'
        };
        
        // Broadcast command to ESP32 via Socket.IO
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
        logger.error('Command', 'Error sending command', error);
        res.status(400).json({ 
            success: false, 
            error: error.message || 'Failed to send command'
        });
    }
});

/**
 * Receive command response from ESP32
 */
app.post('/api/command-response', (req, res) => {
    try {
        const responseData = req.body;
        
        // Validate incoming response
        if (!responseData || typeof responseData !== 'object') {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid response data format' 
            });
        }
        
        logger.info('ESP32', 'Command response received', {
            command: responseData.command,
            status: responseData.status,
            message: responseData.message,
            deviceId: responseData.deviceId
        });
        
        // Forward response to all connected web clients
        io.emit('esp32CommandResponse', responseData);
        
        res.json({ 
            success: true, 
            message: 'Command response received successfully'
        });
        
    } catch (error) {
        logger.error('ESP32', 'Error processing command response', error);
        res.status(400).json({ 
            success: false, 
            error: error.message || 'Failed to process command response'
        });
    }
});

/**
 * Get system statistics and health info
 */
app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            success: true,
            server: {
                uptime: Math.floor((Date.now() - serverState.system.startTime) / 1000),
                memory: process.memoryUsage(),
                version: require('./package.json').version,
                environment: CONFIG.ENVIRONMENT,
                startTime: new Date(serverState.system.startTime).toISOString()
            },
            connections: {
                ...serverState.connections,
                esp32Count: serverState.connections.esp32Devices.size,
                webClientCount: serverState.connections.webClients.size
            },
            system: {
                ...serverState.system,
                isDummyDataActive: dummyDataGenerator.isActive,
                errorRate: serverState.system.errorCount / Math.max(1, (Date.now() - serverState.system.startTime) / 3600000)
            },
            telemetry: {
                lastUpdate: new Date(serverState.telemetry.timestamp).toISOString(),
                packetsReceived: serverState.connections.dataPacketsReceived,
                connectionStatus: serverState.telemetry.connection_status
            }
        };
        
        res.json(stats);
        logger.debug('API', 'System stats requested');
        
    } catch (error) {
        logger.error('API', 'Error getting system stats', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve system statistics' 
        });
    }
});

/**
 * Control dummy data generation
 */
app.post('/api/dummy-data/:action', (req, res) => {
    try {
        const { action } = req.params;
        
        switch (action) {
            case 'start':
                dummyDataGenerator.start();
                res.json({ 
                    success: true, 
                    message: 'Dummy data generation started',
                    isActive: dummyDataGenerator.isActive
                });
                break;
                
            case 'stop':
                dummyDataGenerator.stop();
                res.json({ 
                    success: true, 
                    message: 'Dummy data generation stopped',
                    isActive: dummyDataGenerator.isActive
                });
                break;
                
            default:
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid action. Use "start" or "stop"' 
                });
        }
        
        logger.info('DummyData', `Dummy data ${action} requested via API`);
        
    } catch (error) {
        logger.error('DummyData', 'Error controlling dummy data', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to control dummy data' 
        });
    }
});

// =============================================================================
// SOCKET.IO EVENT HANDLERS
// =============================================================================

io.on('connection', (socket) => {
    logger.info('Socket', 'New client connected', { id: socket.id });
    
    // Add to web clients
    serverState.connections.webClients.add(socket.id);
    serverState.connections.currentConnections++;
    serverState.connections.totalConnections++;
    
    // Send current data to newly connected client
    socket.emit('telemetryUpdate', serverState.telemetry);
    socket.emit('connectionStats', {
        ...serverState.connections,
        isDummyData: serverState.system.dummyDataActive
    });
    
    // Handle ESP32 device connection
    socket.on('esp32Connect', (deviceInfo) => {
        try {
            logger.info('ESP32', 'Device connected via WebSocket', deviceInfo);
            
            // Stop dummy data when real device connects
            if (dummyDataGenerator.isActive) {
                dummyDataGenerator.stop();
                logger.info('ESP32', 'Real device connected - stopping dummy data');
            }
            
            // Add to ESP32 devices
            serverState.connections.esp32Devices.add(socket.id);
            serverState.connections.lastConnectionTime = new Date().toISOString();
            
            // Update telemetry status
            serverState.telemetry.connection_status = 'connected';
            serverState.telemetry.connection_type = 'WebSocket';
            
            // Broadcast ESP32 connection status
            io.emit('esp32Status', { 
                status: 'connected', 
                device: deviceInfo,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            logger.error('ESP32', 'Error handling ESP32 connection', error);
        }
    });
    
    // Handle telemetry data from ESP32 (WebSocket)
    socket.on('telemetryData', (data) => {
        try {
            const updatedData = {
                ...data,
                connection_status: 'connected',
                connection_type: 'WebSocket'
            };
            
            const success = serverState.updateTelemetry(updatedData);
            
            if (success) {
                // Broadcast to all other web clients (not the sender)
                socket.broadcast.emit('telemetryUpdate', serverState.telemetry);
                socket.broadcast.emit('telemetryData', serverState.telemetry);
                
                logger.debug('ESP32', 'Telemetry received via WebSocket', {
                    packet: serverState.telemetry.packet_number,
                    battery: `${data.battery_voltage || 'N/A'}V`,
                    signal: `${data.signal_strength || 'N/A'}dBm`
                });
            }
            
        } catch (error) {
            logger.error('ESP32', 'Error processing WebSocket telemetry', error);
        }
    });
    
    // Handle relay commands from web interface to ESP32
    socket.on('relayCommand', (commandData) => {
        try {
            logger.info('Command', 'Relay command from web client', commandData);
            
            const enhancedCommand = {
                ...commandData,
                timestamp: Date.now(),
                source: 'WEB_INTERFACE',
                relayedBy: socket.id
            };
            
            // Forward to ESP32 devices
            socket.broadcast.emit('esp32Command', enhancedCommand);
            socket.broadcast.emit('relayCommand', enhancedCommand); // Keep both for compatibility
            
        } catch (error) {
            logger.error('Command', 'Error relaying command', error);
        }
    });
    
    // Handle ESP32 command responses
    socket.on('commandResponse', (responseData) => {
        try {
            logger.info('ESP32', 'Command response received via WebSocket', responseData);
            
            // Forward response to all web clients
            socket.broadcast.emit('esp32CommandResponse', responseData);
            
        } catch (error) {
            logger.error('ESP32', 'Error handling command response', error);
        }
    });
    
    // Handle system status from ESP32
    socket.on('systemStatus', (statusData) => {
        try {
            logger.info('ESP32', 'System status received', statusData);
            
            // Forward to all web clients
            socket.broadcast.emit('esp32SystemStatus', statusData);
            
        } catch (error) {
            logger.error('ESP32', 'Error handling system status', error);
        }
    });
    
    // Handle emergency commands with high priority
    socket.on('emergencyCommand', (emergencyData) => {
        try {
            logger.warn('Emergency', 'EMERGENCY COMMAND received from web interface', emergencyData);
            
            const criticalCommand = {
                ...emergencyData,
                command: 'emergency',
                urgent: true,
                timestamp: Date.now(),
                source: 'WEB_EMERGENCY',
                issuedBy: socket.id
            };
            
            // Send to ALL ESP32 devices immediately
            io.emit('esp32Command', criticalCommand);
            io.emit('emergencyStop', criticalCommand); // Direct emergency event
            
            // Log emergency action
            logger.warn('Emergency', 'Emergency command broadcasted to all ESP32 devices');
            
        } catch (error) {
            logger.error('Emergency', 'Error handling emergency command', error);
        }
    });
    
    // Handle client disconnect
    socket.on('disconnect', (reason) => {
        try {
            logger.info('Socket', 'Client disconnected', { 
                id: socket.id, 
                reason: reason 
            });
            
            // Remove from connections
            serverState.connections.webClients.delete(socket.id);
            serverState.connections.currentConnections--;
            
            // Check if it was an ESP32 device
            if (serverState.connections.esp32Devices.has(socket.id)) {
                serverState.connections.esp32Devices.delete(socket.id);
                logger.info('ESP32', 'Device disconnected');
                
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
                        }, 5000); // Wait 5 seconds before starting dummy data
                    }
                    
                    io.emit('esp32Status', { 
                        status: 'disconnected',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
        } catch (error) {
            logger.error('Socket', 'Error handling disconnect', error);
        }
    });
    
    // Handle socket errors
    socket.on('error', (error) => {
        logger.error('Socket', 'Socket error occurred', { 
            id: socket.id, 
            error: error.message || error 
        });
    });
});

// =============================================================================
// CONNECTION MONITORING
// =============================================================================

let connectionMonitor = null;

function startConnectionMonitor() {
    connectionMonitor = setInterval(() => {
        try {
            const now = Date.now();
            const lastDataAge = now - serverState.telemetry.timestamp;
            
            // Check for connection timeout (only for real devices, not dummy data)
            if (lastDataAge > CONFIG.TELEMETRY.CONNECTION_TIMEOUT && 
                serverState.telemetry.connection_status === 'connected' &&
                !serverState.system.dummyDataActive) {
                
                logger.warn('Monitor', 'ESP32 connection timeout - no data received', {
                    lastDataAge: Math.floor(lastDataAge / 1000) + 's'
                });
                
                serverState.telemetry.connection_status = 'timeout';
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
                            logger.info('Monitor', 'Starting dummy data due to connection timeout');
                        }
                    }, 3000);
                }
            }
            
            // Broadcast current connection stats
            io.emit('connectionStats', {
                ...serverState.connections,
                isDummyData: serverState.system.dummyDataActive,
                serverUptime: now - serverState.system.startTime
            });
            
        } catch (error) {
            logger.error('Monitor', 'Error in connection monitor', error);
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

function gracefulShutdown(signal) {
    logger.warn('System', `Received ${signal} - initiating graceful shutdown`);
    
    if (serverState.system.isShuttingDown) {
        logger.warn('System', 'Shutdown already in progress');
        return;
    }
    
    serverState.system.isShuttingDown = true;
    
    // Stop all timers and generators
    stopConnectionMonitor();
    dummyDataGenerator.stop();
    
    // Notify all connected clients about shutdown
    io.emit('serverShutdown', {
        message: 'Server is shutting down',
        timestamp: new Date().toISOString(),
        graceful: true
    });
    
    // Add cache-busting headers for shutdown
    const shutdownHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Shutdown': 'true'
    };
    
    // Close Socket.IO connections
    setTimeout(() => {
        io.close((err) => {
            if (err) {
                logger.error('System', 'Error closing Socket.IO', err);
            } else {
                logger.success('System', 'Socket.IO closed successfully');
            }
            
            // Close HTTP server
            server.close((err) => {
                if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
                    logger.error('System', 'Error closing HTTP server', err);
                    process.exit(1);
                } else {
                    logger.success('System', 'HTTP server closed successfully');
                    logger.success('System', 'Graceful shutdown completed');
                    
                    // Reset state for clean restart
                    serverState.reset();
                    
                    process.exit(0);
                }
            });
        });
    }, 1000); // Give clients 1 second to receive shutdown notification
    
    // Force exit after 10 seconds
    setTimeout(() => {
        logger.error('System', 'Force exit - graceful shutdown timeout');
        process.exit(1);
    }, 10000);
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (error) => {
    logger.error('System', 'Uncaught Exception - this should not happen', error);
    
    // Try to save current state before exit
    try {
        logger.info('System', 'Attempting emergency shutdown');
        gracefulShutdown('UNCAUGHT_EXCEPTION');
    } catch (e) {
        logger.error('System', 'Emergency shutdown failed', e);
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('System', 'Unhandled Promise Rejection', { 
        reason: reason,
        promise: promise
    });
    
    // Log but don't exit for promise rejections
    // They might be recoverable
});

// Handle EADDRINUSE error specifically
process.on('EADDRINUSE', () => {
    logger.error('System', `Port ${CONFIG.PORT} is already in use`);
    logger.info('System', 'Try changing the port or stopping the existing server');
    process.exit(1);
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function startServer() {
    try {
        // Start server
        await new Promise((resolve, reject) => {
            server.listen(CONFIG.PORT, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Start monitoring and dummy data
        startConnectionMonitor();
        
        if (CONFIG.DUMMY_DATA.ENABLED) {
            setTimeout(() => {
                dummyDataGenerator.start();
            }, 2000); // Start dummy data after 2 seconds
        }
        
        // Success messages
        logger.success('System', '🚀 UAV Dashboard Server Started Successfully! 🚀');
        console.log('');
        console.log('📊 Server Information:');
        console.log(`   🌐 Dashboard URL: http://localhost:${CONFIG.PORT}`);
        console.log(`   🔌 Socket.IO: Ready for ESP32 connections`);
        console.log(`   📡 HTTP API: Available at /api/`);
        console.log(`   🎯 Environment: ${CONFIG.ENVIRONMENT}`);
        console.log(`   📈 Version: ${require('./package.json').version}`);
        console.log('');
        console.log('🔍 Available Endpoints:');
        console.log('   GET  / - Main Dashboard');
        console.log('   GET  /api/telemetry - Get current telemetry');
        console.log('   POST /api/telemetry - Receive ESP32 data');
        console.log('   POST /api/command - Send commands to ESP32');
        console.log('   GET  /api/stats - Server statistics');
        console.log('   POST /api/dummy-data/start - Start dummy data');
        console.log('   POST /api/dummy-data/stop - Stop dummy data');
        console.log('');
        
        if (CONFIG.DUMMY_DATA.ENABLED) {
            logger.info('System', '🤖 Dummy data generation enabled for testing');
        }
        
        logger.info('System', '✅ Ready to receive ESP32 telemetry data');
        
    } catch (error) {
        logger.error('System', 'Failed to start server', error);
        
        if (error.code === 'EADDRINUSE') {
            logger.error('System', `Port ${CONFIG.PORT} is already in use`);
            logger.info('System', 'Please stop the existing server or change the port');
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
    io,
    serverState,
    logger,
    dummyDataGenerator,
    CONFIG
};
