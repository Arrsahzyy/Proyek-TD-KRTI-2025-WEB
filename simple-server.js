const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files
app.use(express.static('.'));

// Route for index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌐 Development server running at http://localhost:${PORT}`);
    console.log(`📊 Test Activity Logger at: http://localhost:${PORT}/activity-logger-test.html`);
    console.log(`🚁 UAV Dashboard at: http://localhost:${PORT}/index.html`);
});
