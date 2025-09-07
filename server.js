/**
 * UAV Dashboard Server - ROBUST & ENHANCED VERSION
 * Compatible dengan ESP32 telemetry system
 * Socket.IO + HTTP API + Static file serving
 * Enhanced with proper error handling and graceful shutdown
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

// Global variables for cleanup
let connectionMonitorInterval = null;
let demoDataInterval = null;
let isShuttingDown = false;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname)); // Serve static files from current directory

// Request logging middleware
app.use((req, res, next) => {
    if (!isShuttingDown) {
        console.log(`📥 ${req.method} ${req.url} - ${req.ip}`);
        next();
    } else {
        res.status(503).json({ error: 'Server is shutting down' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Express Error:', err);
    if (!res.headersSent) {
        res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
        });
    }
});

// Store latest telemetry data
let latestTelemetry = {
    battery_voltage: 0,
    battery_current: 0,
    battery_power: 0,
    temperature: 0,
    humidity: 0,
    gps_latitude: 0,
    gps_longitude: 0,
    altitude: 0,
    signal_strength: 0,
    satellites: 0,
    timestamp: Date.now(),
    connection_status: 'disconnected'
};

let connectedDevices = new Set();
let connectionStats = {
    totalConnections: 0,
    currentConnections: 0,
    lastConnectionTime: null,
    dataPacketsReceived: 0
};

// ================== ROUTES ==================

// Root route - serve dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Get latest telemetry data
app.get('/api/telemetry', (req, res) => {
    res.json({
        success: true,
        data: latestTelemetry,
        timestamp: new Date().toISOString(),
        stats: connectionStats
    });
});

// API: Receive telemetry data from ESP32 (HTTP fallback)
app.post('/api/telemetry', (req, res) => {
    try {
        if (isShuttingDown) {
            return res.status(503).json({ error: 'Server is shutting down' });
        }

        const telemetryData = req.body;
        
        // Basic validation
        if (!telemetryData || typeof telemetryData !== 'object') {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid telemetry data format' 
            });
        }

        // Validate numeric fields if present
        const numericFields = ['battery_voltage', 'battery_current', 'temperature', 'altitude', 'signal_strength'];
        for (const field of numericFields) {
            if (telemetryData[field] !== undefined && (isNaN(telemetryData[field]) || !isFinite(telemetryData[field]))) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Invalid ${field}: must be a valid number` 
                });
            }
        }

        // Update latest data
        latestTelemetry = {
            ...latestTelemetry,
            ...telemetryData,
            timestamp: Date.now(),
            connection_status: 'connected',
            connection_type: 'HTTP'
        };
        
        connectionStats.dataPacketsReceived++;
        connectionStats.lastConnectionTime = new Date().toISOString();
        
        // Broadcast to all connected web clients with error handling
        if (io && !isShuttingDown) {
            io.emit('telemetryUpdate', latestTelemetry);
        }
        
        console.log('📊 [HTTP] Telemetry received:', {
            battery: `${telemetryData.battery_voltage || 'N/A'}V`,
            temp: `${telemetryData.temperature || 'N/A'}°C`,
            signal: `${telemetryData.signal_strength || 'N/A'}dBm`,
            packet: `#${telemetryData.packet_number || connectionStats.dataPacketsReceived}`
        });
        
        res.json({ 
            success: true, 
            message: 'Telemetry data received',
            packet_number: connectionStats.dataPacketsReceived,
            timestamp: latestTelemetry.timestamp
        });
        
    } catch (error) {
        console.error('❌ [HTTP] Error processing telemetry:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to process telemetry data'
        });
    }
});

// API: Send command to ESP32
app.post('/api/command', (req, res) => {
    const { command, value } = req.body;
    
    // Broadcast command to ESP32 via Socket.IO
    io.emit('esp32Command', { command, value, timestamp: Date.now() });
    
    console.log('🔌 [COMMAND] Sent to ESP32:', command, value);
    res.json({ success: true, message: 'Command sent' });
});

// API: Connection statistics
app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            ...connectionStats,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        }
    });
});

// ================== SOCKET.IO EVENTS ==================

io.on('connection', (socket) => {
    if (isShuttingDown) {
        socket.emit('serverShuttingDown', { message: 'Server is shutting down' });
        socket.disconnect(true);
        return;
    }

    console.log('🔗 [SOCKET] Client connected:', socket.id);
    connectionStats.currentConnections++;
    
    // Send latest data to newly connected client with error handling
    try {
        socket.emit('telemetryUpdate', latestTelemetry);
        socket.emit('connectionStats', connectionStats);
    } catch (error) {
        console.error('❌ Error sending initial data to client:', error);
    }
    
    // Handle ESP32 connection
    socket.on('esp32Connect', (data) => {
        try {
            console.log('🤖 [ESP32] Device connected:', data);
            connectedDevices.add(socket.id);
            connectionStats.totalConnections++;
            connectionStats.lastConnectionTime = new Date().toISOString();
            
            latestTelemetry.connection_status = 'connected';
            latestTelemetry.connection_type = 'WebSocket';
            
            // Broadcast ESP32 connection status to all web clients
            if (!isShuttingDown) {
                io.emit('esp32Status', { status: 'connected', device: data });
            }
        } catch (error) {
            console.error('❌ Error handling ESP32 connection:', error);
        }
    });
    
    // Handle telemetry data from ESP32 (WebSocket)
    socket.on('telemetryData', (data) => {
        try {
            if (isShuttingDown) return;

            // Basic validation
            if (!data || typeof data !== 'object') {
                console.error('❌ Invalid telemetry data from ESP32');
                return;
            }

            // Update latest data
            latestTelemetry = {
                ...latestTelemetry,
                ...data,
                timestamp: Date.now(),
                connection_status: 'connected',
                connection_type: 'WebSocket'
            };
            
            connectionStats.dataPacketsReceived++;
            connectionStats.lastConnectionTime = new Date().toISOString();
            
            // Broadcast to all web clients
            socket.broadcast.emit('telemetryUpdate', latestTelemetry);
            
            console.log('📊 [WEBSOCKET] Telemetry received:', {
                battery: `${data.battery_voltage || 'N/A'}V`,
                temp: `${data.temperature || 'N/A'}°C`,
                signal: `${data.signal_strength || 'N/A'}dBm`,
                packet: `#${data.packet_number || connectionStats.dataPacketsReceived}`
            });
        } catch (error) {
            console.error('❌ Error processing WebSocket telemetry:', error);
        }
    });
    
    // Handle relay commands from web interface
    socket.on('relayCommand', (data) => {
        console.log('🔌 [RELAY] Command from web:', data);
        // Forward to ESP32
        socket.broadcast.emit('esp32Command', data);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('❌ [SOCKET] Client disconnected:', socket.id);
        connectionStats.currentConnections--;
        
        if (connectedDevices.has(socket.id)) {
            connectedDevices.delete(socket.id);
            console.log('🤖 [ESP32] Device disconnected');
            
            // Update connection status if no ESP32 devices connected
            if (connectedDevices.size === 0) {
                latestTelemetry.connection_status = 'disconnected';
                io.emit('esp32Status', { status: 'disconnected' });
            }
        }
    });
});

// ================== CONNECTION MONITORING ==================

// Monitor ESP32 connection status
connectionMonitorInterval = setInterval(() => {
    const now = Date.now();
    const lastDataAge = now - latestTelemetry.timestamp;
    
    // Consider connection lost if no data for 15 seconds
    if (lastDataAge > 15000 && latestTelemetry.connection_status === 'connected') {
        latestTelemetry.connection_status = 'disconnected';
        console.log('⚠️ [MONITOR] ESP32 connection timeout - no data for 15s');
        io.emit('esp32Status', { status: 'timeout' });
    }
}, 5000);

// ================== SERVER STARTUP ==================

server.listen(PORT, () => {
    console.log('🚀========================================🚀');
    console.log('       UAV DASHBOARD SERVER READY!');
    console.log('🚀========================================🚀');
    console.log('');
    console.log('📊 Server Status:');
    console.log('   🌐 Web Dashboard: http://localhost:' + PORT);
    console.log('   📡 Socket.IO: Ready for ESP32 connection');
    console.log('   🔌 HTTP API: /api/telemetry (POST)');
    console.log('   📈 Statistics: /api/stats (GET)');
    console.log('');
    console.log('🔍 Waiting for ESP32 connection...');
    console.log('   📍 IP Address needed in ESP32 code: YOUR_COMPUTER_IP');
    console.log('   🔢 Port: ' + PORT);
    console.log('');
    console.log('✅ Ready to receive telemetry data!');
});

// ================== GRACEFUL SHUTDOWN ==================

const gracefulShutdown = (signal = 'UNKNOWN') => {
    if (isShuttingDown) {
        console.log('⚠️  Shutdown already in progress...');
        return;
    }

    isShuttingDown = true;
    console.log(`🛑 Server shutting down (signal: ${signal})...`);
    
    // Clear all intervals
    if (connectionMonitorInterval) {
        clearInterval(connectionMonitorInterval);
        connectionMonitorInterval = null;
        console.log('🔄 Connection monitor stopped');
    }

    if (demoDataInterval) {
        clearInterval(demoDataInterval);
        demoDataInterval = null;
        console.log('🔄 Demo data stopped');
    }

    // Notify all connected clients
    try {
        io.emit('serverShuttingDown', { message: 'Server is shutting down', timestamp: Date.now() });
    } catch (error) {
        console.error('❌ Error notifying clients:', error);
    }

    // Set shutdown timeout
    const shutdownTimeout = setTimeout(() => {
        console.log('⏰ Force exit after timeout');
        process.exit(1);
    }, 8000);

    // Close Socket.IO gracefully
    if (io) {
        io.close((err) => {
            if (err) {
                console.error('❌ Error closing Socket.IO:', err);
            } else {
                console.log('✅ Socket.IO closed');
            }
            
            // Close HTTP server
            if (server) {
                server.close((err) => {
                    clearTimeout(shutdownTimeout);
                    
                    if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
                        console.error('❌ Error closing server:', err);
                        process.exit(1);
                    } else {
                        console.log('✅ HTTP server closed');
                        console.log('👋 Server shutdown complete');
                        process.exit(0);
                    }
                });
            } else {
                clearTimeout(shutdownTimeout);
                console.log('👋 Server shutdown complete');
                process.exit(0);
            }
        });
    } else {
        // Fallback if io is not available
        if (server) {
            server.close(() => {
                clearTimeout(shutdownTimeout);
                console.log('✅ HTTP server closed');
                console.log('👋 Server shutdown complete');
                process.exit(0);
            });
        } else {
            clearTimeout(shutdownTimeout);
            process.exit(0);
        }
    }
};

// Handle termination signals with signal names
process.on('SIGINT', () => gracefulShutdown('SIGINT'));     // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));   // Process termination
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));   // Nodemon restart

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

console.log('🎯 Server initialized successfully');
