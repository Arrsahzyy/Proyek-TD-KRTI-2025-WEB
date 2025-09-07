// Simple robust server for UAV Dashboard testing
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// Demo data generator
let demoInterval = null;

function startDemoData() {
    console.log('🎮 Starting demo data generation...');
    
    if (demoInterval) clearInterval(demoInterval);
    
    demoInterval = setInterval(() => {
        const voltage = 14.8 + Math.sin(Date.now() / 10000) * 0.5 + (Math.random() - 0.5) * 0.2;
        const current = 2.5 + Math.sin(Date.now() / 15000) * 0.8 + (Math.random() - 0.5) * 0.3;
        const power = voltage * current;
        
        const data = {
            battery_voltage: parseFloat(voltage.toFixed(2)),
            battery_current: parseFloat(current.toFixed(2)),
            battery_power: parseFloat(power.toFixed(2)),
            temperature: 25 + (Math.random() - 0.5) * 5,
            humidity: 60 + (Math.random() - 0.5) * 10,
            gps_latitude: -5.3971 + (Math.random() - 0.5) * 0.001,
            gps_longitude: 105.2663 + (Math.random() - 0.5) * 0.001,
            altitude: 100 + (Math.random() - 0.5) * 10,
            signal_strength: -50 + (Math.random() - 0.5) * 10,
            satellites: Math.floor(8 + Math.random() * 4),
            timestamp: Date.now()
        };
        
        console.log(`📊 Demo: V=${data.battery_voltage}V, I=${data.battery_current}A, P=${data.battery_power}W`);
        io.emit('telemetryUpdate', data);
    }, 1000);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('🔗 Client connected:', socket.id);
    
    // Start demo data if this is the first client
    if (io.engine.clientsCount === 1) {
        setTimeout(() => startDemoData(), 2000);
    }
    
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

// Root route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// API endpoint for ESP32
app.post('/api/telemetry', (req, res) => {
    const data = req.body;
    console.log('📡 ESP32 data received:', data);
    io.emit('telemetryUpdate', data);
    res.json({ success: true });
});

// Graceful shutdown with timeout
const shutdown = () => {
    console.log('🛑 Shutting down server...');
    
    // Clear demo data interval
    if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
        console.log('🔄 Demo data stopped');
    }
    
    // Close server with timeout
    server.close((err) => {
        if (err) {
            console.error('❌ Error closing server:', err);
        } else {
            console.log('✅ Server closed');
        }
        process.exit(0);
    });
    
    // Force exit after 3 seconds if server doesn't close
    setTimeout(() => {
        console.log('⏰ Force exit after timeout');
        process.exit(1);
    }, 3000);
};

// Handle multiple shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGUSR2', shutdown); // nodemon restart

// Handle unhandled errors
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown();
});

server.listen(PORT, () => {
    console.log('🚀========================================🚀');
    console.log('       UAV DASHBOARD SERVER READY!');
    console.log('🚀========================================🚀');
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`📡 Socket.IO ready for ESP32 connection`);
    console.log(`🔌 API endpoint: /api/telemetry`);
    console.log('✅ Ready to receive telemetry data!');
});
