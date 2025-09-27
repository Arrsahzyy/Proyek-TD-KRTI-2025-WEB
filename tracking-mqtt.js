/**
 * Tracking MQTT Integration - Sesuai Source Code
 * Mengintegrasikan peta tracking dengan MQTT client
 * 
 * @author KRTI Team  
 * @version 1.0.0
 */

// =============================================================================
// GLOBAL VARIABLES - Sesuai dengan source code
// =============================================================================
let map = null;
let marker = null;
let polyline = null;
let geofence = null;
let drawing = false;
let geofencePoints = [];
let insideGeofence = true;

// --- Tracking variables ---
let tracking = false;
let trackPoints = [];
let historyMarkers = [];
let lastPointTime = null;
let totalDistance = 0;
let totalTime = 0;
let copyCoordMode = false;
let lastCurrent = null;
let lastVoltage = null;
let lastPower = null;

// --- Geofencing variables ---
let autoFollow = true;

// --- Speed & Statistics ---
let speedStats = {
  avg: 0,
  max: 0,
  min: Infinity,
  sum: 0,
  count: 0
};

let currentStats = { sum: 0, count: 0, max: 0, min: Infinity };
let voltageStats = { sum: 0, count: 0, max: 0, min: Infinity };
let powerStats = { sum: 0, count: 0, max: 0, min: Infinity };

// MQTT Configuration - Sesuai dengan source code
const MQTT_CONFIG = {
    broker: "wss://broker.hivemq.com:8884/mqtt",
    topics: {
        gps: "awikwokgps",
        speed: "awikwokkecepatan",
        voltage: "awikwoktegangan", 
        current: "awikwokarus",
        power: "awikwokdaya",
        relay: "awikwokrelay",
        emergency: "awikwokemergency"
    }
};

let mqttClient = null;

// =============================================================================
// INITIALIZATION
// =============================================================================
function initializeTrackingSystem() {
    console.log('🚁 Initializing UAV Tracking System...');
    
    // Initialize map
    initializeMap();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize MQTT connection
    initializeMQTT();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    console.log('✅ UAV Tracking System initialized successfully!');
}

// =============================================================================
// MAP INITIALIZATION
// =============================================================================
function initializeMap() {
    // Inisialisasi peta - default ke ITERA Lampung
    map = L.map('map').setView([-5.358400, 105.311700], 17);
    
    // Default tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Initialize polyline for flight path
    polyline = L.polyline([], { color: 'red' }).addTo(map);
    
    console.log('🗺️ Map initialized');
}

// =============================================================================
// MQTT FUNCTIONS - Sesuai Source Code
// =============================================================================
function initializeMQTT() {
    console.log('📡 Initializing MQTT connection...');
    
    try {
        if (typeof mqtt === 'undefined') {
            console.error('❌ MQTT.js library not loaded!');
            return;
        }
        
        // Update status
        updateMQTTStatus('connecting');
        
        // Connect to MQTT broker
        connectMQTT();
        
    } catch (error) {
        console.error('❌ MQTT initialization error:', error);
        updateMQTTStatus('error');
    }
}

function connectMQTT() {
    if (mqttClient) {
        mqttClient.end(); // Pastikan koneksi sebelumnya ditutup
    }
    
    const clientId = 'WEBSITETD-track-' + Math.random().toString(16).substr(2, 8);
    mqttClient = mqtt.connect(MQTT_CONFIG.broker, {
        clientId: clientId,
        keepalive: 60,
        connectTimeout: 30000,
        reconnectPeriod: 5000,
        clean: true
    });
    
    // MQTT Connection events
    mqttClient.on('connect', () => {
        console.log("✅ Connected to MQTT broker");
        updateMQTTStatus('connected');
        
        // Subscribe ke semua topik
        subscribeToAllTopics();
    });

    mqttClient.on('reconnect', () => {
        console.log("🔄 Reconnecting to MQTT...");
        updateMQTTStatus('reconnecting');
    });

    mqttClient.on('error', (err) => {
        console.error("❌ MQTT Error:", err);
        updateMQTTStatus('error');
    });

    mqttClient.on('close', () => {
        console.log("🔴 MQTT Disconnected");
        updateMQTTStatus('disconnected');
    });

    // Handle incoming messages
    mqttClient.on('message', (topic, message) => {
        handleMQTTMessage(topic, message.toString());
    });
}

function subscribeToAllTopics() {
    const topics = Object.values(MQTT_CONFIG.topics);
    
    topics.forEach(topic => {
        mqttClient.subscribe(topic, { qos: 1 }, (error) => {
            if (error) {
                console.error(`❌ Failed to subscribe to ${topic}:`, error);
            } else {
                console.log(`✅ Subscribed to topic: ${topic}`);
            }
        });
    });
}

// =============================================================================
// MQTT MESSAGE HANDLING - Sesuai Source Code
// =============================================================================
function handleMQTTMessage(topic, message) {
    try {
        console.log(`📨 Received: ${topic} -> ${message}`);
        
        // Handle GPS data
        if (topic === MQTT_CONFIG.topics.gps && tracking) {
            handleGPSData(message);
        }
        // Handle sensor data
        else if (topic === MQTT_CONFIG.topics.current) {
            handleCurrentData(parseFloat(message));
        }
        else if (topic === MQTT_CONFIG.topics.voltage) {
            handleVoltageData(parseFloat(message));
        }
        else if (topic === MQTT_CONFIG.topics.power) {
            handlePowerData(parseFloat(message));
        }
        else if (topic === MQTT_CONFIG.topics.relay) {
            handleRelayStatus(message.trim());
        }
        else if (topic === MQTT_CONFIG.topics.speed) {
            handleSpeedData(parseFloat(message));
        }
        
    } catch (error) {
        console.error('❌ Error handling MQTT message:', error);
    }
}

function handleGPSData(message) {
    try {
        const { lat, lng } = JSON.parse(message);
        const latlng = [lat, lng];
        const currentTime = Date.now();

        let distance = 0;
        let speed = 0;
        let deltaTime = 0;

        if (trackPoints.length > 0) {
            const last = trackPoints[trackPoints.length - 1];
            distance = haversineDistance([last.lat, last.lng], latlng);
            deltaTime = (currentTime - lastPointTime) / 1000;
            speed = deltaTime > 0 ? (distance / (deltaTime / 3600)) : 0;

            totalDistance += isNaN(distance) ? 0 : distance;
            totalTime += isNaN(deltaTime) ? 0 : deltaTime;

            // Update speed statistics
            if (!isNaN(speed)) {
                speedStats.sum += speed;
                speedStats.count++;
                speedStats.max = Math.max(speedStats.max, speed);
                speedStats.min = Math.min(speedStats.min, speed);
            }
        } else {
            totalDistance = 0;
            totalTime = 0;
        }

        lastPointTime = currentTime;
        
        // Update summary
        updateSummary(speed);

        // Create marker info
        const timestamp = new Date(currentTime).toLocaleTimeString();
        const cumulativeDistance = (totalDistance || 0).toFixed(3);
        const elapsedTime = Math.round(totalTime || 0);

        const markerInfo = createMarkerInfoPopup({
            timestamp,
            elapsedTime,
            distance: distance.toFixed(3),
            speed: speed.toFixed(2),
            cumulativeDistance,
            current: lastCurrent,
            voltage: lastVoltage,
            power: lastPower
        });

        // Add markers to map
        addMarkersToMap(latlng, markerInfo);

        // Update main marker position
        if (!marker) {
            marker = L.marker(latlng).addTo(map);
        } else {
            marker.setLatLng(latlng);
        }

        // Auto follow if enabled
        if (autoFollow) map.panTo(latlng);

        // Store track point
        trackPoints.push({
            lat: latlng[0],
            lng: latlng[1],
            time: currentTime,
            info: markerInfo
        });

        // Update polyline
        polyline.setLatLngs(trackPoints.map(p => [p.lat, p.lng]));

        // Check geofence if exists
        checkGeofence(latlng);
        
    } catch (e) {
        console.error("❌ Invalid GPS message:", e);
    }
}

function handleCurrentData(current) {
    if (!isNaN(current)) {
        lastCurrent = current;

        // Update chart if available
        updateChart('currentChart', current);

        // Update statistics
        updateStatistics(currentStats, current);

        // Update summary
        updateSummary();
        
        console.log(`⚡ Current: ${current.toFixed(2)} A`);
    }
}

function handleVoltageData(voltage) {
    if (!isNaN(voltage)) {
        lastVoltage = voltage;

        // Update chart if available
        updateChart('voltageChart', voltage);

        // Update statistics
        updateStatistics(voltageStats, voltage);

        // Update summary
        updateSummary();
        
        console.log(`🔋 Voltage: ${voltage.toFixed(2)} V`);
    }
}

function handlePowerData(power) {
    if (!isNaN(power)) {
        lastPower = power;

        // Update chart if available  
        updateChart('powerChart', power);

        // Update statistics
        updateStatistics(powerStats, power);

        // Update summary
        updateSummary();
        
        console.log(`⚡ Power: ${power.toFixed(2)} W`);
    }
}

function handleRelayStatus(status) {
    const relayStatusEl = document.getElementById("relayStatus");
    if (relayStatusEl) {
    // Terima format HIDUP/MATI atau 1/0
    if (status === "HIDUP" || status === "1") {
            relayStatusEl.innerHTML = "🟢";
    } else if (status === "MATI" || status === "0") {
            relayStatusEl.innerHTML = "🔴";
        }
    }
    
    console.log(`🔌 Relay: ${status}`);
}

function handleSpeedData(speed) {
    if (!isNaN(speed)) {
        // Update speed statistics
        speedStats.sum += speed;
        speedStats.count++;
        speedStats.max = Math.max(speedStats.max, speed);
        speedStats.min = Math.min(speedStats.min, speed);

        // Update summary
        updateSummary(speed);
        
        console.log(`🏃 Speed: ${speed.toFixed(2)} km/h`);
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
function updateChart(chartName, value) {
    const chart = window[chartName];
    if (chart && chart.updateSeries) {
        let chartData = [...(chart.w.config.series[0].data || [])];
        chartData.push([Date.now(), value]);
        
        const maxDataPoints = 100;
        if (chartData.length > maxDataPoints) {
            chartData = chartData.slice(-maxDataPoints);
        }
        
        chart.updateSeries([{ data: chartData }]);
    }
}

function updateStatistics(statsObject, value) {
    statsObject.sum += value;
    statsObject.count++;
    statsObject.max = Math.max(statsObject.max || 0, value);
    statsObject.min = Math.min(statsObject.min || Infinity, value);
}

function createMarkerInfoPopup(data) {
    return `
        <b>Waktu:</b> ${data.timestamp}<br>
        <b>Durasi dari titik awal:</b> ${data.elapsedTime} detik<br>
        <b>Jarak dari titik sebelumnya:</b> ${data.distance} km<br>
        <b>Kecepatan:</b> ${data.speed} km/h<br>
        <b>Jarak dari titik pertama:</b> ${data.cumulativeDistance} km<br>
        <b>Arus:</b> ${data.current !== null ? data.current.toFixed(2) + " A" : "-"}<br>
        <b>Arus avg:</b> ${currentStats.count > 0 ? (currentStats.sum / currentStats.count).toFixed(2) : "-"} A<br>
        <b>Arus min:</b> ${currentStats.min !== Infinity ? currentStats.min.toFixed(2) : "-"} A<br>
        <b>Arus max:</b> ${currentStats.max !== -Infinity ? currentStats.max.toFixed(2) : "-"} A<br>
        <b>Tegangan:</b> ${data.voltage !== null ? data.voltage.toFixed(2) + " V" : "-"}<br>
        <b>Tegangan avg:</b> ${voltageStats.count > 0 ? (voltageStats.sum / voltageStats.count).toFixed(2) : "-"} V<br>
        <b>Tegangan min:</b> ${voltageStats.min !== Infinity ? voltageStats.min.toFixed(2) : "-"} V<br>
        <b>Tegangan max:</b> ${voltageStats.max !== -Infinity ? voltageStats.max.toFixed(2) : "-"} V<br>
        <b>Daya:</b> ${data.power !== null ? data.power.toFixed(2) + " W" : "-"}<br>
        <b>Daya avg:</b> ${powerStats.count > 0 ? (powerStats.sum / powerStats.count).toFixed(2) : "-"} W<br>
        <b>Daya min:</b> ${powerStats.min !== Infinity ? powerStats.min.toFixed(2) : "-"} W<br>
        <b>Daya max:</b> ${powerStats.max !== -Infinity ? powerStats.max.toFixed(2) : "-"} W
    `;
}

function addMarkersToMap(latlng, markerInfo) {
    if (trackPoints.length === 0) {
        // First point - start marker
        const startMarker = L.marker(latlng, {
            icon: L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png',
                iconSize: [25, 25]
            })
        }).addTo(map).bindPopup(markerInfo);
        historyMarkers.push(startMarker);
    } else {
        // Regular point - circle marker
        const m = L.circleMarker(latlng, {
            radius: 5,
            color: 'blue', 
            fillColor: '#30f',
            fillOpacity: 0.8
        }).addTo(map).bindPopup(markerInfo);
        historyMarkers.push(m);
    }
}

function haversineDistance(coord1, coord2) {
    const R = 6371; // Earth radius in km
    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * Math.PI / 180;
}

// =============================================================================
// UI UPDATE FUNCTIONS
// =============================================================================
function updateSummary(currentSpeed = 0) {
    // Update time and duration
    const timeEl = document.getElementById("sumTime");
    if (timeEl) timeEl.innerText = new Date().toLocaleTimeString();
    
    const durationEl = document.getElementById("sumDuration");
    if (durationEl) durationEl.innerText = `${Math.round(totalTime)} detik`;
    
    const distanceEl = document.getElementById("sumDistance");
    if (distanceEl) distanceEl.innerText = `${totalDistance.toFixed(3)} km`;

    // Update speed statistics
    const avgSpeed = speedStats.count > 0 ? (speedStats.sum / speedStats.count) : 0;
    const maxSpeed = speedStats.max > 0 ? speedStats.max : 0;
    const minSpeed = speedStats.min !== Infinity ? speedStats.min : 0;

    const speedEl = document.getElementById("sumSpeed");
    if (speedEl) speedEl.innerText = `${currentSpeed.toFixed(2)} km/h`;
    
    const avgSpeedEl = document.getElementById("sumAvgSpeed");
    if (avgSpeedEl) avgSpeedEl.innerText = `${avgSpeed.toFixed(2)} km/h`;
    
    const maxSpeedEl = document.getElementById("sumMaxSpeed");
    if (maxSpeedEl) maxSpeedEl.innerText = `${maxSpeed.toFixed(2)} km/h`;
    
    const minSpeedEl = document.getElementById("sumMinSpeed");
    if (minSpeedEl) minSpeedEl.innerText = `${minSpeed.toFixed(2)} km/h`;

    // Update electrical data
    updateElectricalSummary();
}

function updateElectricalSummary() {
    // Current
    const avgCurrent = currentStats.count > 0 ? (currentStats.sum / currentStats.count).toFixed(2) : "0";
    
    const currentEl = document.getElementById("arus");
    if (currentEl) currentEl.innerText = lastCurrent !== null ? lastCurrent.toFixed(2) : "0";
    
    const currentAvgEl = document.getElementById("arusAvg");
    if (currentAvgEl) currentAvgEl.innerText = avgCurrent;
    
    const currentMinEl = document.getElementById("arusMin");
    if (currentMinEl) currentMinEl.innerText = currentStats.min !== Infinity ? currentStats.min.toFixed(2) : "0";
    
    const currentMaxEl = document.getElementById("arusMax");
    if (currentMaxEl) currentMaxEl.innerText = currentStats.max !== -Infinity ? currentStats.max.toFixed(2) : "0";

    // Voltage
    const avgVoltage = voltageStats.count > 0 ? (voltageStats.sum / voltageStats.count).toFixed(2) : "0";
    
    const voltageEl = document.getElementById("tegangan");
    if (voltageEl) voltageEl.innerText = lastVoltage !== null ? lastVoltage.toFixed(2) : "0";
    
    const voltageAvgEl = document.getElementById("teganganAvg");
    if (voltageAvgEl) voltageAvgEl.innerText = avgVoltage;
    
    const voltageMinEl = document.getElementById("teganganMin");
    if (voltageMinEl) voltageMinEl.innerText = voltageStats.min !== Infinity ? voltageStats.min.toFixed(2) : "0";
    
    const voltageMaxEl = document.getElementById("teganganMax");
    if (voltageMaxEl) voltageMaxEl.innerText = voltageStats.max !== -Infinity ? voltageStats.max.toFixed(2) : "0";

    // Power
    const avgPower = powerStats.count > 0 ? (powerStats.sum / powerStats.count).toFixed(2) : "0";
    
    const powerEl = document.getElementById("daya");
    if (powerEl) powerEl.innerText = lastPower !== null ? lastPower.toFixed(2) : "0";
    
    const powerAvgEl = document.getElementById("dayaAvg");
    if (powerAvgEl) powerAvgEl.innerText = avgPower;
    
    const powerMinEl = document.getElementById("dayaMin");
    if (powerMinEl) powerMinEl.innerText = powerStats.min !== Infinity ? powerStats.min.toFixed(2) : "0";
    
    const powerMaxEl = document.getElementById("dayaMax");
    if (powerMaxEl) powerMaxEl.innerText = powerStats.max !== -Infinity ? powerStats.max.toFixed(2) : "0";
}

function updateMQTTStatus(status) {
    const mqttStatusEl = document.getElementById("mqttStatus");
    if (mqttStatusEl) {
        switch(status) {
            case 'connected':
                mqttStatusEl.innerHTML = "🟢";
                mqttStatusEl.style.color = "green";
                break;
            case 'connecting':
            case 'reconnecting':
                mqttStatusEl.innerHTML = "🟡";
                mqttStatusEl.style.color = "orange";
                break;
            case 'disconnected':
            case 'error':
            default:
                mqttStatusEl.innerHTML = "🔴";
                mqttStatusEl.style.color = "red";
                break;
        }
    }
    
    // Update connection status text if element exists
    const connectionStatusEl = document.getElementById('mqtt-connection-status');
    if (connectionStatusEl) {
        connectionStatusEl.textContent = status.toUpperCase();
        connectionStatusEl.className = `status-${status}`;
    }
}

// =============================================================================
// EVENT LISTENERS & CONTROLS
// =============================================================================
function setupEventListeners() {
    // Toggle Tracking Button
    const toggleBtn = document.getElementById('toggleTrackingBtn');
    if (toggleBtn) {
        toggleBtn.onclick = toggleTracking;
    }

    // Reset Button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.onclick = resetTracking;
    }

    // Save Button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.onclick = saveTrack;
    }

    // Emergency Button
    const emergencyBtn = document.getElementById('emergencyBtn');
    if (emergencyBtn) {
        emergencyBtn.onclick = sendEmergencyCommand;
    }

    // Geofence controls
    setupGeofenceControls();
    
    // Map click for coordinate copying
    if (map) {
        map.on('click', handleMapClick);
    }
}

function toggleTracking() {
    tracking = !tracking;
    
    const btn = document.getElementById('toggleTrackingBtn');
    const status = document.getElementById('trackingStatus');
    
    if (tracking) {
        // Start tracking & connect MQTT
        if (btn) btn.innerText = "Stop Tracking";
        if (status) {
            status.innerHTML = "🟢";
            status.style.color = "green";
        }
        
        if (!mqttClient || !mqttClient.connected) {
            initializeMQTT();
        }
        
        console.log('🚁 Tracking started');
    } else {
        // Stop tracking & disconnect MQTT
        if (btn) btn.innerText = "Start Tracking";
        if (status) {
            status.innerHTML = "🔴";
            status.style.color = "red";
        }
        
        console.log('🚁 Tracking stopped');
    }
}

function resetTracking() {
    // Clear track data
    trackPoints = [];
    
    // Remove polyline and recreate
    if (polyline) {
        map.removeLayer(polyline);
    }
    polyline = L.polyline([], { color: 'red' }).addTo(map);
    
    // Remove main marker
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    
    // Remove all history markers
    historyMarkers.forEach(m => map.removeLayer(m));
    historyMarkers = [];
    
    // Reset statistics
    lastPointTime = null;
    totalDistance = 0;
    totalTime = 0;
    lastCurrent = null;
    lastVoltage = null;
    lastPower = null;
    
    // Reset speed stats
    speedStats = {
        avg: 0,
        max: 0,
        min: Infinity,
        sum: 0,
        count: 0
    };
    
    // Reset chart stats
    currentStats = { sum: 0, count: 0, max: 0, min: Infinity };
    voltageStats = { sum: 0, count: 0, max: 0, min: Infinity };
    powerStats = { sum: 0, count: 0, max: 0, min: Infinity };
    
    // Reset charts
    resetCharts();
    
    // Update summary
    updateSummary();
    
    console.log('🔄 Tracking data reset');
    alert("🔄 Semua track, kecepatan, dan statistik sudah direset.");
}

function resetCharts() {
    const charts = ['currentChart', 'voltageChart', 'powerChart'];
    
    charts.forEach(chartName => {
        const chart = window[chartName];
        if (chart && chart.updateSeries) {
            chart.updateSeries([{ data: [] }]);
            
            if (chart.zoomX) {
                chart.zoomX(new Date().getTime() - 60000, new Date().getTime());
            }
        }
    });
}

function saveTrack() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(trackPoints, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "uav-track.json");
    dlAnchor.click();
    
    console.log('💾 Track data saved');
}

function sendEmergencyCommand() {
    if (!mqttClient || !mqttClient.connected) {
        alert("❌ Tidak terhubung ke MQTT. Mulai tracking terlebih dahulu!");
        return;
    }
    
    if (confirm("⚠️ Apakah Anda yakin ingin mematikan relay secara EMERGENCY?")) {
        mqttClient.publish(MQTT_CONFIG.topics.emergency, "on", { qos: 1 }, (err) => {
            if (!err) {
                alert("✅ Pesan EMERGENCY telah dikirim!");
                console.log('🚨 Emergency command sent');
            } else {
                alert("❌ Gagal mengirim pesan EMERGENCY!");
                console.error('❌ Emergency command error:', err);
            }
        });
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'f') {
            autoFollow = !autoFollow;
            alert(`Auto-follow: ${autoFollow ? 'ON' : 'OFF'}`);
        }
    });
}

function handleMapClick(e) {
    if (!copyCoordMode) return;
    
    const coord = { lat: e.latlng.lat, lng: e.latlng.lng };
    const coordStr = JSON.stringify(coord);
    
    navigator.clipboard.writeText(coordStr).then(() => {
        alert("📋 Copied: " + coordStr);
    }).catch(err => {
        console.error("Clipboard error:", err);
    });
}

// =============================================================================
// GEOFENCE FUNCTIONS
// =============================================================================
function setupGeofenceControls() {
    const drawBtn = document.getElementById('drawGeofenceBtn');
    if (drawBtn) {
        drawBtn.onclick = startDrawingGeofence;
    }
    
    const resetGeofenceBtn = document.getElementById('resetGeofenceBtn');
    if (resetGeofenceBtn) {
        resetGeofenceBtn.onclick = resetGeofence;
    }
    
    const saveGeofenceBtn = document.getElementById('saveGeofenceBtn');
    if (saveGeofenceBtn) {
        saveGeofenceBtn.onclick = saveGeofence;
    }
    
    // Map event listeners for geofencing
    if (map) {
        map.on('contextmenu', finishDrawingGeofence);
    }
}

function startDrawingGeofence() {
    drawing = true;
    geofencePoints = [];
    
    if (geofence) {
        map.removeLayer(geofence);
        geofence = null;
    }
    
    alert('Klik pada peta untuk menandai area geofence.\nKlik kanan untuk selesai.');
    
    // Override map click handler for geofence drawing
    map.off('click');
    map.on('click', function(e) {
        if (!drawing) return;
        
        geofencePoints.push([e.latlng.lat, e.latlng.lng]);
        
        if (geofence) {
            map.removeLayer(geofence);
        }
        geofence = L.polygon(geofencePoints, { color: 'green', fillOpacity: 0.2 }).addTo(map);
    });
}

function finishDrawingGeofence() {
    if (!drawing) return;
    
    if (geofencePoints.length < 3) {
        alert('Minimal 3 titik untuk membuat geofence.');
        return;
    }
    
    drawing = false;
    alert('Geofence selesai dibuat.');
    
    // Restore original map click handler
    map.off('click');
    map.on('click', handleMapClick);
}

function resetGeofence() {
    if (geofence) {
        map.removeLayer(geofence);
        geofence = null;
    }
    
    geofencePoints = [];
    drawing = false;
    
    alert("🔄 Geofence sudah direset.");
}

function saveGeofence() {
    if (!geofencePoints.length) {
        alert('Tidak ada geofence untuk disimpan.');
        return;
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geofencePoints, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "geofence.json");
    dlAnchor.click();
}

function checkGeofence(latlng) {
    if (!geofence) return;
    
    const isInside = isPointInPolygon(latlng, geofencePoints);
    
    if (isInside !== insideGeofence) {
        insideGeofence = isInside;
        if (!isInside) {
            alert('🚨 Perhatian: UAV keluar dari geofence!');
        } else {
            alert('✅ UAV kembali masuk ke geofence.');
        }
    }
}

function isPointInPolygon(latlng, polygonPoints) {
    const x = latlng[1], y = latlng[0];
    let inside = false;
    
    for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
        const xi = polygonPoints[i][1], yi = polygonPoints[i][0];
        const xj = polygonPoints[j][1], yj = polygonPoints[j][0];
        
        const intersect = ((yi > y) !== (yj > y)) &&
                          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

// =============================================================================
// GLOBAL EXPORTS & INITIALIZATION
// =============================================================================
// Make functions globally available
window.initializeTrackingSystem = initializeTrackingSystem;
window.updateSummary = updateSummary;
window.tracking = tracking;
window.lastCurrent = lastCurrent;
window.lastVoltage = lastVoltage;
window.lastPower = lastPower;
window.currentStats = currentStats;
window.voltageStats = voltageStats;
window.powerStats = powerStats;
window.speedStats = speedStats;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for other scripts to load
    setTimeout(() => {
        initializeTrackingSystem();
    }, 1000);
});

console.log('📡 Tracking MQTT module loaded');
