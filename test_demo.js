// Quick test for demo data functionality
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

// Generate demo data
setInterval(() => {
    const demoData = {
        battery_voltage: 14.8 + (Math.random() - 0.5) * 0.4,
        battery_current: 2.5 + (Math.random() - 0.5) * 0.8,
        temperature: 25 + (Math.random() - 0.5) * 10,
        timestamp: Date.now()
    };
    demoData.battery_power = demoData.battery_voltage * demoData.battery_current;
    
    console.log('📊 Demo data:', demoData);
    io.emit('telemetryUpdate', demoData);
}, 2000);

io.on('connection', (socket) => {
    console.log('🔗 Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

server.listen(3001, () => {
    console.log('🚀 Demo server running on http://localhost:3001');
});
