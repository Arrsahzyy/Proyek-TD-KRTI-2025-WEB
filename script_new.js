// UAV Dashboard JavaScript - Enhanced for Reference Layout
class UAVDashboard {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        
        // Chart instances
        this.powerChart = null;
        this.flightMap = null;
        this.flightPath = [];
        this.currentPosition = null;
        
        // Initialize dashboard
        this.init();
    }

    init() {
        console.log('🚁 Initializing UAV Dashboard...');
        this.initializeSocket();
        this.initializeMap();
        this.initializePowerChart();
        this.setupEventListeners();
        this.startHeartbeat();
        
        // Update connection status display
        this.updateConnectionStatus(false);
        this.addLogEntry('System', 'Dashboard initialized successfully');
    }

    initializeSocket() {
        try {
            console.log('🔌 Connecting to server...');
            this.socket = io();

            this.socket.on('connect', () => {
                console.log('✅ Connected to server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.addLogEntry('Connection', 'Connected to server');
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ Disconnected from server:', reason);
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.addLogEntry('Connection', `Disconnected: ${reason}`);
                this.attemptReconnect();
            });

            this.socket.on('telemetryData', (data) => {
                console.log('📡 Received telemetry:', data);
                this.updateTelemetryDisplay(data);
                this.updatePowerChart(data);
                this.updateFlightPath(data);
            });

            this.socket.on('systemStatus', (status) => {
                console.log('📊 System status update:', status);
                this.updateSystemStatus(status);
            });

            this.socket.on('error', (error) => {
                console.error('🚫 Socket error:', error);
                this.addLogEntry('Error', `Socket error: ${error.message || error}`);
            });

        } catch (error) {
            console.error('❌ Failed to initialize socket:', error);
            this.addLogEntry('Error', 'Failed to initialize connection');
        }
    }

    initializeMap() {
        try {
            // Initialize Leaflet map
            this.flightMap = L.map('flight-map', {
                zoomControl: false,
                attributionControl: false
            }).setView([-5.3971, 105.2663], 13); // Default to Bandar Lampung

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
            }).addTo(this.flightMap);

            // Initialize flight path polyline
            this.flightPath = L.polyline([], {
                color: '#20b2aa',
                weight: 3,
                opacity: 0.8
            }).addTo(this.flightMap);

            // Initialize UAV marker
            const uavIcon = L.divIcon({
                className: 'uav-marker',
                html: '<i class="fas fa-plane" style="color: #20b2aa; font-size: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);"></i>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            this.currentPosition = L.marker([-5.3971, 105.2663], {
                icon: uavIcon
            }).addTo(this.flightMap);

            // Setup map control buttons
            this.setupMapControls();

            this.addLogEntry('Map', 'Flight map initialized');
        } catch (error) {
            console.error('❌ Failed to initialize map:', error);
            this.addLogEntry('Error', 'Failed to initialize map');
        }
    }

    setupMapControls() {
        // Zoom in button
        document.getElementById('zoom-in')?.addEventListener('click', () => {
            this.flightMap.zoomIn();
        });

        // Zoom out button
        document.getElementById('zoom-out')?.addEventListener('click', () => {
            this.flightMap.zoomOut();
        });

        // Center map button
        document.getElementById('center-map')?.addEventListener('click', () => {
            if (this.currentPosition) {
                this.flightMap.setView(this.currentPosition.getLatLng(), 15);
            }
        });
    }

    initializePowerChart() {
        try {
            const ctx = document.getElementById('powerChart')?.getContext('2d');
            if (!ctx) return;

            this.powerChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Voltage (V)',
                        data: [],
                        borderColor: '#20b2aa',
                        backgroundColor: 'rgba(32, 178, 170, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }, {
                        label: 'Current (A)',
                        data: [],
                        borderColor: '#ffaa00',
                        backgroundColor: 'rgba(255, 170, 0, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    }, {
                        label: 'Power (W)',
                        data: [],
                        borderColor: '#ff4444',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                color: '#ffffff',
                                font: {
                                    size: 12
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            ticks: {
                                color: '#b0b0b0',
                                maxTicksLimit: 10
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        },
                        y: {
                            ticks: {
                                color: '#b0b0b0'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        }
                    },
                    elements: {
                        point: {
                            radius: 2,
                            hoverRadius: 4
                        }
                    }
                }
            });

            this.addLogEntry('Chart', 'Power system chart initialized');
        } catch (error) {
            console.error('❌ Failed to initialize power chart:', error);
            this.addLogEntry('Error', 'Failed to initialize power chart');
        }
    }

    setupEventListeners() {
        // Emergency cut-off button
        const emergencyBtn = document.getElementById('emergency-cutoff');
        if (emergencyBtn) {
            emergencyBtn.addEventListener('click', () => {
                this.handleEmergencyStop();
            });
        }

        // Team button
        const teamBtn = document.querySelector('.team-btn');
        if (teamBtn) {
            teamBtn.addEventListener('click', () => {
                this.showTeamInfo();
            });
        }

        // Window resize handler for responsive chart
        window.addEventListener('resize', () => {
            if (this.powerChart) {
                this.powerChart.resize();
            }
            if (this.flightMap) {
                this.flightMap.invalidateSize();
            }
        });
    }

    updateTelemetryDisplay(data) {
        try {
            // Update telemetry data cards
            const elements = {
                'telemetry-speed': data.speed ? `${data.speed} km/h` : 'Speed',
                'longitude': data.longitude ? `${data.longitude.toFixed(4)}°` : '35.6° N',
                'latitude': data.latitude ? `${data.latitude.toFixed(4)}°` : '89.1° E',
                'voltage': data.voltage ? `${data.voltage} V` : '14.8 V',
                'current': data.current ? `${data.current} A` : '25.3 A',
                'power': data.power ? `${data.power} W` : '374.4 W'
            };

            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                }
            });

            // Update system status
            document.getElementById('data-packets')?.textContent = 
                data.packetCount ? data.packetCount.toString() : '--';
                
        } catch (error) {
            console.error('❌ Error updating telemetry display:', error);
        }
    }

    updatePowerChart(data) {
        if (!this.powerChart) return;

        try {
            const time = new Date().getTime();
            const maxDataPoints = 50;

            // Add new data points
            if (data.voltage !== undefined) {
                this.powerChart.data.datasets[0].data.push({x: time, y: data.voltage});
            }
            if (data.current !== undefined) {
                this.powerChart.data.datasets[1].data.push({x: time, y: data.current});
            }
            if (data.power !== undefined) {
                this.powerChart.data.datasets[2].data.push({x: time, y: data.power});
            }

            // Remove old data points
            this.powerChart.data.datasets.forEach(dataset => {
                if (dataset.data.length > maxDataPoints) {
                    dataset.data.shift();
                }
            });

            this.powerChart.update('none');
        } catch (error) {
            console.error('❌ Error updating power chart:', error);
        }
    }

    updateFlightPath(data) {
        if (!this.flightMap || !data.latitude || !data.longitude) return;

        try {
            const newPosition = [data.latitude, data.longitude];
            
            // Update UAV marker position
            this.currentPosition.setLatLng(newPosition);
            
            // Add to flight path
            const currentPath = this.flightPath.getLatLngs();
            currentPath.push(newPosition);
            
            // Limit path length
            if (currentPath.length > 100) {
                currentPath.shift();
            }
            
            this.flightPath.setLatLngs(currentPath);
            
            // Auto-center map on first GPS fix
            if (currentPath.length === 1) {
                this.flightMap.setView(newPosition, 15);
            }
            
        } catch (error) {
            console.error('❌ Error updating flight path:', error);
        }
    }

    updateSystemStatus(status) {
        try {
            // Update ESP32 status
            const esp32Status = document.getElementById('esp32-status');
            if (esp32Status) {
                esp32Status.textContent = status.esp32Connected ? 'Online' : 'Offline';
                esp32Status.className = `status-value ${status.esp32Connected ? 'online' : 'offline'}`;
            }

            // Update connection mode
            const connectionMode = document.getElementById('connection-mode');
            if (connectionMode) {
                connectionMode.textContent = status.connectionMode || '--';
            }

            // Update signal strength
            const signalStrength = document.getElementById('signal-strength');
            if (signalStrength) {
                signalStrength.textContent = status.signalStrength ? `${status.signalStrength} dBm` : '--';
            }

        } catch (error) {
            console.error('❌ Error updating system status:', error);
        }
    }

    updateConnectionStatus(connected) {
        try {
            const statusDot = document.querySelector('.status-dot');
            const statusText = document.querySelector('.status-text');

            if (statusDot) {
                statusDot.className = `status-dot ${connected ? 'online' : 'offline'}`;
            }

            if (statusText) {
                statusText.textContent = connected ? 'Cloud Connected' : 'Cloud Disconnected';
            }

        } catch (error) {
            console.error('❌ Error updating connection status:', error);
        }
    }

    handleEmergencyStop() {
        if (confirm('⚠️ EMERGENCY STOP\n\nThis will immediately cut power to all systems.\n\nAre you absolutely sure?')) {
            this.sendCommand('emergency', 'stop');
            this.addLogEntry('Emergency', 'Emergency cut-off activated');
            
            // Visual feedback
            const btn = document.getElementById('emergency-cutoff');
            if (btn) {
                btn.style.background = '#990000';
                btn.textContent = 'ACTIVATED';
                setTimeout(() => {
                    btn.style.background = '';
                    btn.innerHTML = 'Emergency<br>Cut Off<br>Button';
                }, 3000);
            }
        }
    }

    showTeamInfo() {
        alert('🚁 SWARAKARSA ITERA TECHNOLOGY DEVELOPMENT\n\nUAV Dashboard System\nVersion 2.0\n\nDeveloped for KRTI Competition\n\nTeam: UAV Development Division');
        this.addLogEntry('Info', 'Team information displayed');
    }

    sendCommand(action, value) {
        if (!this.isConnected) {
            this.addLogEntry('Warning', 'Cannot send command - not connected');
            return;
        }

        try {
            const command = { action, value, timestamp: Date.now() };
            this.socket.emit('command', command);
            this.addLogEntry('Command', `Sent: ${action} = ${value}`);
        } catch (error) {
            console.error('❌ Error sending command:', error);
            this.addLogEntry('Error', `Failed to send command: ${error.message}`);
        }
    }

    addLogEntry(type, message) {
        try {
            const logContainer = document.getElementById('activity-log');
            if (!logContainer) return;

            const entry = document.createElement('div');
            entry.className = 'log-entry';
            
            const timestamp = document.createElement('span');
            timestamp.className = 'log-time';
            timestamp.textContent = `[${type}]`;
            
            const msg = document.createElement('span');
            msg.className = 'log-message';
            msg.textContent = message;
            
            entry.appendChild(timestamp);
            entry.appendChild(msg);
            logContainer.appendChild(entry);

            // Limit log entries
            while (logContainer.children.length > 20) {
                logContainer.removeChild(logContainer.firstChild);
            }

            // Scroll to bottom
            logContainer.scrollTop = logContainer.scrollHeight;
            
        } catch (error) {
            console.error('❌ Error adding log entry:', error);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.addLogEntry('Error', 'Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        this.addLogEntry('Connection', `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

        setTimeout(() => {
            if (!this.isConnected) {
                this.initializeSocket();
            }
        }, this.reconnectDelay * this.reconnectAttempts);
    }

    startHeartbeat() {
        setInterval(() => {
            if (this.isConnected && this.socket) {
                this.socket.emit('heartbeat', { timestamp: Date.now() });
            }
        }, 30000); // Every 30 seconds
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting UAV Dashboard...');
    window.dashboard = new UAVDashboard();
});

// Export for global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UAVDashboard;
}
