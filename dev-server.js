/**
 * UAV Dashboard Development Server
 * Simple static file server for frontend development
 * Use this for UI testing without ESP32 telemetry features
 * For full functionality use: npm start (runs server.js with Socket.IO)
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = 5002;

// Serve static files from current directory
app.use(express.static(__dirname));

// Route for main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚁 UAV Dashboard running at:`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`🔗 Network: http://127.0.0.1:${PORT}`);
    console.log(`📂 Serving from: ${__dirname}`);
    console.log(`✨ Theme: Matte blue & gold`);
});

module.exports = app;
