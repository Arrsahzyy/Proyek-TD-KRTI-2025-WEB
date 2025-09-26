/**
 * UAV Dashboard JavaScript - Optimized Interactive Version
 * Enhanced with better performance, error handling, and code organization
 */

class UAVDashboard {
    constructor() {
        // Connection management
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        
        // Component instances
        this.powerChart = null;
        this.flightMap = null;
        this.flightPath = [];
        this.currentPosition = null;
        this.homePosition = null;
        
        // Configuration with better defaults
        this.settings = {
            updateInterval: 1000,
            chartDataPoints: 50,
            theme: 'dark',
            chartTimeWindowMs: 60000, // 60 second time window
            maxHistorySize: 1000,      // Limit memory usage
            animationDuration: 300     // Consistent animation timing
        };
        
        // Data management with performance optimization
        this.telemetryHistory = [];
        this.lastValues = {};
        this.trends = {};
        this.lastGeoPoint = null;
        this.performanceMetrics = {
            lastRender: 0,
            frameCount: 0,
            avgRenderTime: 0
        };
        
        // UI state management
        this.isLoading = true;
        this.notifications = [];
        this.animationFrameId = null;
        
        // Throttled functions for performance
        this.throttledUpdateChart = this.throttle(this.updatePowerChart.bind(this), 100);
        this.throttledUpdateMap = this.throttle(this.updateFlightPath.bind(this), 200);
        
        // Initialize dashboard
        this.init();
    }

    /**
     * Throttle function to limit function execution frequency
     * @param {Function} func - Function to throttle
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    async init() {
        console.log('🚁 Initializing Enhanced UAV Dashboard...');
        
        // Show loading screen with progress
        this.showLoadingScreen();
        
        // Initialize components with progress tracking
        await this.initializeWithProgress();
        
        // Hide loading screen
        this.hideLoadingScreen();
        
        this.addLogEntry('System', 'Enhanced Dashboard initialized successfully');
    }

    async initializeWithProgress() {
        const steps = [
            { name: 'Socket Connection', action: () => this.initializeSocket() },
            { name: 'Interactive Map', action: () => this.initializeMap() },
            { name: 'Power Charts', action: () => this.initializePowerChart() },
            { name: 'Event Listeners', action: () => this.setupEventListeners() },
            { name: 'UI Components', action: () => this.initializeUI() },
            { name: 'Animations', action: () => this.startAnimations() }
        ];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            this.updateLoadingProgress(step.name, (i / steps.length) * 100);
            
            try {
                await new Promise(resolve => {
                    step.action();
                    setTimeout(resolve, 200); // Small delay for visual effect
                });
            } catch (error) {
                console.error(`Error in ${step.name}:`, error);
            }
        }
        
        this.updateLoadingProgress('Complete', 100);
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    updateLoadingProgress(text, percentage) {
        const loadingText = document.getElementById('loading-text');
        const progressBar = document.getElementById('progress-bar');
        
        if (loadingText) {
            loadingText.textContent = `Loading ${text}...`;
        }
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 500);
        }
        this.isLoading = false;
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
                this.showNotification('Connected to server successfully', 'success');
                this.addLogEntry('Connection', 'Connected to server');
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ Disconnected from server:', reason);
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.showNotification(`Connection lost: ${reason}`, 'error');
                this.addLogEntry('Connection', `Disconnected: ${reason}`);
                this.attemptReconnect();
            });

            this.socket.on('telemetryData', (data) => {
                console.log('📡 Received telemetry:', data);
                const normalized = this.normalizeTelemetry(data);
                this.processTelemetryData(normalized);
            });

            // Server saat ini mengirim event 'telemetryUpdate', bukan 'telemetryData'
            this.socket.on('telemetryUpdate', (data) => {
                console.log('📡 Received telemetryUpdate:', data);
                const normalized = this.normalizeTelemetry(data);
                this.processTelemetryData(normalized);
            });

            this.socket.on('systemStatus', (status) => {
                console.log('📊 System status update:', status);
                this.updateSystemStatus(status);
            });

            this.socket.on('error', (error) => {
                console.error('🚫 Socket error:', error);
                this.showNotification(`Socket error: ${error.message}`, 'error');
                this.addLogEntry('Error', `Socket error: ${error.message || error}`);
            });

        } catch (error) {
            console.error('❌ Failed to initialize socket:', error);
            this.addLogEntry('Error', 'Failed to initialize connection');
        }
    }

    // Normalisasi nama field telemetry agar konsisten dengan UI & chart
    normalizeTelemetry(raw) {
        if (!raw || typeof raw !== 'object') return {};

        const voltage = raw.voltage ?? raw.battery_voltage;
        const current = raw.current ?? raw.battery_current;
        let power = raw.power ?? raw.battery_power;
        if ((power === undefined || power === null) && voltage !== undefined && current !== undefined) {
            power = parseFloat(voltage) * parseFloat(current);
        }

        const latitude = raw.latitude ?? raw.gps_latitude;
        const longitude = raw.longitude ?? raw.gps_longitude;

        // Hitung speed jika tidak ada, gunakan haversine antar titik
        let speed = raw.speed; // km/h
        const now = Date.now();
        if ((speed === undefined || speed === null) && latitude && longitude) {
            if (this.lastGeoPoint) {
                const dt = (now - this.lastGeoPoint.time) / 3600000; // jam
                if (dt > 0) {
                    const distKm = this.haversine(this.lastGeoPoint.lat, this.lastGeoPoint.lon, latitude, longitude);
                    speed = distKm / dt; // km/h
                }
            }
            this.lastGeoPoint = { lat: latitude, lon: longitude, time: now };
        }

        return {
            voltage: voltage !== undefined ? parseFloat(voltage) : undefined,
            current: current !== undefined ? parseFloat(current) : undefined,
            power: power !== undefined ? parseFloat(power) : undefined,
            latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
            longitude: longitude !== undefined ? parseFloat(longitude) : undefined,
            speed: speed !== undefined ? parseFloat(speed) : undefined,
            packetCount: raw.packet_number ?? raw.packetCount ?? undefined,
            satellites: raw.satellites ?? raw.gps_satellites ?? undefined
        };
    }

    // Rumus haversine sederhana menghasilkan jarak km
    haversine(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const toRad = deg => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Konsolidasi: helper trimming agar reusable
    trimChartDatasets(chart, windowMs, maxPoints, currentTime) {
        chart.data.datasets.forEach(ds => {
            if (ds.data.length > maxPoints) {
                ds.data.splice(0, ds.data.length - maxPoints);
            }
            const minWindow = currentTime - windowMs;
            ds.data = ds.data.filter(p => p.x >= minWindow);
        });
        chart.options.scales.x.min = currentTime - windowMs;
        chart.options.scales.x.max = currentTime;
    }

    // Theme variant setter konsolidasi style lama
    setThemeVariant(variant) {
        const body = document.body;
        body.classList.remove('reference-dark-theme','enhanced-dark-theme');
        if (variant === 'reference') body.classList.add('reference-dark-theme');
        else if (variant === 'enhanced') body.classList.add('enhanced-dark-theme');
        // Bisa tambahkan adaptasi warna chart
        if (this.powerChart) {
            // Update warna dataset sesuai var CSS (sekedar contoh simple)
            const styles = getComputedStyle(body);
            const accent = styles.getPropertyValue('--accent-color').trim() || '#00d4aa';
            this.powerChart.data.datasets[0].borderColor = accent;
            this.powerChart.update();
        }
    }

    initializeMap() {
        try {
            // Initialize Leaflet map
            this.flightMap = L.map('flight-map', {
                zoomControl: false,
                attributionControl: false,
                fadeAnimation: true,
                zoomAnimation: true
            }).setView([-5.3971, 105.2663], 13);

            // Add tile layer with loading animation
            const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                loading: () => this.showMapLoading(),
                load: () => this.hideMapLoading()
            }).addTo(this.flightMap);

            // Initialize flight path with animation
            this.flightPath = L.polyline([], {
                color: '#00d4aa',
                weight: 3,
                opacity: 0.8,
                smoothFactor: 1.5
            }).addTo(this.flightMap);

            // Initialize home position marker
            this.homePosition = L.marker([-5.3971, 105.2663], {
                icon: this.createHomeIcon()
            }).addTo(this.flightMap);

            // Initialize UAV marker with custom icon
            this.currentPosition = L.marker([-5.3971, 105.2663], {
                icon: this.createUAVIcon()
            }).addTo(this.flightMap);

            // Setup map controls
            this.setupMapControls();
            this.updateGPSStatus('No Signal');

            this.addLogEntry('Map', 'Interactive flight map initialized');
        } catch (error) {
            console.error('❌ Failed to initialize map:', error);
            this.addLogEntry('Error', 'Failed to initialize map');
        }
    }

    createUAVIcon() {
        return L.divIcon({
            className: 'uav-marker',
            html: `<div class="uav-icon-container">
                     <i class="fas fa-plane uav-icon"></i>
                     <div class="uav-pulse"></div>
                   </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    }

    createHomeIcon() {
        return L.divIcon({
            className: 'home-marker',
            html: `<div class="home-icon-container">
                     <i class="fas fa-home"></i>
                   </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }

    setupMapControls() {
        // Zoom controls
        document.getElementById('zoom-in')?.addEventListener('click', () => {
            this.flightMap.zoomIn();
            this.animateButtonPress('zoom-in');
        });

        document.getElementById('zoom-out')?.addEventListener('click', () => {
            this.flightMap.zoomOut();
            this.animateButtonPress('zoom-out');
        });

        // Center map
        document.getElementById('center-map')?.addEventListener('click', () => {
            if (this.currentPosition) {
                this.flightMap.setView(this.currentPosition.getLatLng(), 15);
                this.animateButtonPress('center-map');
            }
        });

        // Toggle flight path
        document.getElementById('toggle-path')?.addEventListener('click', () => {
            const isVisible = this.flightMap.hasLayer(this.flightPath);
            if (isVisible) {
                this.flightMap.removeLayer(this.flightPath);
            } else {
                this.flightMap.addLayer(this.flightPath);
            }
            this.animateButtonPress('toggle-path');
        });

        // Fullscreen map
        document.getElementById('fullscreen-map')?.addEventListener('click', () => {
            this.toggleFullscreenMap();
        });

        // Refresh map
        document.getElementById('refresh-map')?.addEventListener('click', () => {
            this.flightMap.invalidateSize();
            this.animateButtonPress('refresh-map');
        });
    }

    initializePowerChart() {
        try {
            const ctx = document.getElementById('powerChart')?.getContext('2d');
            if (!ctx) return;

            // Hide loading indicator
            const chartLoading = document.getElementById('chart-loading');
            if (chartLoading) {
                chartLoading.style.display = 'none';
            }

            const now = Date.now();
            this.powerChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Voltage (V)',
                        data: [],
                        borderColor: '#00d4aa',
                        backgroundColor: 'rgba(0, 212, 170, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    }, {
                        label: 'Current (A)',
                        data: [],
                        borderColor: '#ffa500',
                        backgroundColor: 'rgba(255, 165, 0, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    }, {
                        label: 'Power (W)',
                        data: [],
                        borderColor: '#ff3366',
                        backgroundColor: 'rgba(255, 51, 102, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 750,
                        easing: 'easeInOutQuart'
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                color: '#ffffff',
                                font: { size: 12 },
                                usePointStyle: true,
                                padding: 20
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(45, 45, 45, 0.95)',
                            titleColor: '#ffffff',
                            bodyColor: '#b0b0b0',
                            borderColor: '#404040',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            min: now - this.settings.chartTimeWindowMs,
                            max: now,
                            ticks: {
                                color: '#b0b0b0',
                                maxTicksLimit: 8,
                                callback: function(value) {
                                    const date = new Date(value);
                                    return date.toLocaleTimeString();
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawTicks: false
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#b0b0b0'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawTicks: false
                            }
                        }
                    },
                    elements: {
                        line: {
                            tension: 0.4
                        }
                    }
                }
            });

            this.addLogEntry('Chart', 'Interactive power chart initialized');
        } catch (error) {
            console.error('❌ Failed to initialize power chart:', error);
            this.addLogEntry('Error', 'Failed to initialize power chart');
        }
    }

    initializeUI() {
        // Initialize tooltips
        this.initializeTooltips();
        
        // Initialize system time
        this.updateSystemTime();
        setInterval(() => this.updateSystemTime(), 1000);
        
        // Initialize data refresh indicator
        this.startDataRefreshIndicator();
        
        // Initialize settings modal
        this.initializeSettingsModal();
        
        // Set initial theme
        this.applyTheme(this.settings.theme);
    }

    initializeTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        const tooltip = document.getElementById('tooltip');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                const text = e.target.getAttribute('data-tooltip');
                if (tooltip && text) {
                    tooltip.textContent = text;
                    tooltip.classList.add('show');
                    this.positionTooltip(tooltip, e.target);
                }
            });
            
            element.addEventListener('mouseleave', () => {
                if (tooltip) {
                    tooltip.classList.remove('show');
                }
            });
        });
    }

    positionTooltip(tooltip, target) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 8;
        
        // Prevent tooltip from going off screen
        if (left < 0) left = 8;
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        if (top < 0) top = rect.bottom + 8;
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
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

        // Chart controls
        document.getElementById('export-chart')?.addEventListener('click', () => {
            this.exportChart();
        });

        document.getElementById('toggle-chart')?.addEventListener('click', () => {
            this.toggleChartType();
        });

        // Log controls
        document.getElementById('clear-log')?.addEventListener('click', () => {
            this.clearLog();
        });

        document.getElementById('export-log')?.addEventListener('click', () => {
            this.exportLog();
        });

        // Settings button
        document.getElementById('open-settings')?.addEventListener('click', () => {
            this.openSettingsModal();
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
    }

    startAnimations() {
        // Start periodic animations
        this.startHeartbeat();
        this.animateSignalBars();
        this.animateStatusIndicators();
    }

    /**
     * Process incoming telemetry data with optimized performance
     * @param {Object} data - Normalized telemetry data
     */
    processTelemetryData(data) {
        const startTime = performance.now();
        
        try {
            // Store historical data with memory management
            const timestamp = Date.now();
            this.telemetryHistory.push({ ...data, timestamp });

            // Efficient memory management - remove old data
            if (this.telemetryHistory.length > this.settings.maxHistorySize) {
                this.telemetryHistory.splice(0, this.telemetryHistory.length - this.settings.maxHistorySize);
            }

            // Calculate trends efficiently
            this.calculateTrends(data);

            // Batch UI updates using requestAnimationFrame for smooth performance
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
            
            this.animationFrameId = requestAnimationFrame(() => {
                this.updateTelemetryDisplay(data);
                this.throttledUpdateChart(data);
                this.throttledUpdateMap(data);
                this.updateDataRefreshIndicator();
                
                // Track performance metrics
                const renderTime = performance.now() - startTime;
                this.updatePerformanceMetrics(renderTime);
            });

        } catch (error) {
            console.error('❌ Error processing telemetry data:', error);
            this.addLogEntry('Error', `Telemetry processing failed: ${error.message}`);
        }
    }

    /**
     * Update performance metrics for monitoring
     * @param {number} renderTime - Time taken for current render
     */
    updatePerformanceMetrics(renderTime) {
        this.performanceMetrics.frameCount++;
        this.performanceMetrics.avgRenderTime = 
            (this.performanceMetrics.avgRenderTime + renderTime) / 2;
        
        // Log performance warning if render time is too high
        if (renderTime > 16) { // 60fps = ~16ms per frame
            console.warn(`🐌 Slow render detected: ${renderTime.toFixed(2)}ms`);
        }
    }

    /**
     * Calculate trends with improved efficiency
     * @param {Object} data - Current telemetry data
     */
    calculateTrends(data) {
        const numericKeys = ['voltage', 'current', 'power', 'speed', 'latitude', 'longitude'];
        
        numericKeys.forEach(key => {
            if (data[key] !== undefined && this.lastValues[key] !== undefined) {
                const current = data[key];
                const previous = this.lastValues[key];
                const diff = current - previous;
                
                if (Math.abs(diff) < 0.01) { // Threshold for stability
                    this.trends[key] = 'stable';
                } else {
                    this.trends[key] = diff > 0 ? 'up' : 'down';
                }
            }
        });
        
        // Only update lastValues for changed data
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined) {
                this.lastValues[key] = data[key];
            }
        });
    }

    updateTelemetryDisplay(data) {
        try {
            // Update data cards with animations
            const updates = {
                'telemetry-speed': { value: data.speed, unit: 'km/h', trend: 'speed' },
                'longitude': { value: data.longitude, unit: '°', trend: 'longitude', format: 4 },
                'latitude': { value: data.latitude, unit: '°', trend: 'latitude', format: 4 },
                'voltage': { value: data.voltage, unit: 'V', trend: 'voltage' },
                'current': { value: data.current, unit: 'A', trend: 'current' },
                'power': { value: data.power, unit: 'W', trend: 'power' }
            };

            Object.entries(updates).forEach(([id, config]) => {
                this.updateDataCard(id, config, data);
            });

            // Update system status
            this.updateDataPacketCount(data.packetCount);
                
        } catch (error) {
            console.error('❌ Error updating telemetry display:', error);
        }
    }

    updateDataCard(id, config, data) {
        const element = document.getElementById(id);
        const trendElement = document.getElementById(`${config.trend}-trend`);
        
        if (element && config.value !== undefined) {
            // Format value
            let displayValue = config.value;
            if (config.format) {
                displayValue = parseFloat(config.value).toFixed(config.format);
            }
            
            // Update with animation
            element.textContent = `${displayValue}${config.unit ? ' ' + config.unit : ''}`;
            element.classList.add('animate-number');
            
            setTimeout(() => {
                element.classList.remove('animate-number');
            }, 500);
            
            // Update trend indicator
            if (trendElement && this.trends[config.trend]) {
                const trend = this.trends[config.trend];
                trendElement.innerHTML = this.getTrendIcon(trend);
                trendElement.className = `data-trend trend-${trend}`;
            }
        }
    }

    getTrendIcon(trend) {
        switch (trend) {
            case 'up': return '<i class="fas fa-arrow-up"></i>';
            case 'down': return '<i class="fas fa-arrow-down"></i>';
            default: return '<i class="fas fa-minus"></i>';
        }
    }

    updatePowerChart(data) {
        if (!this.powerChart) return;

        try {
            const time = Date.now();
            const maxDataPoints = this.settings.chartDataPoints;
            const windowMs = this.settings.chartTimeWindowMs;

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

            // Trim & atur window via helper konsolidasi
            this.trimChartDatasets(this.powerChart, windowMs, maxDataPoints, time);

            // Update with animation
            this.powerChart.update('active');
        } catch (error) {
            console.error('❌ Error updating power chart:', error);
        }
    }

    updateFlightPath(data) {
        if (!this.flightMap || !data.latitude || !data.longitude) return;

        try {
            const newPosition = [data.latitude, data.longitude];
            
            // Update UAV marker position with animation
            this.currentPosition.setLatLng(newPosition);
            
            // Add to flight path
            const currentPath = this.flightPath.getLatLngs();
            currentPath.push(newPosition);
            
            // Limit path length
            if (currentPath.length > 200) {
                currentPath.shift();
            }
            
            this.flightPath.setLatLngs(currentPath);
            
            // Update GPS status
            const satelliteCount = data.satellites || 0;
            this.updateGPSStatus(satelliteCount >= 4 ? 'Good Fix' : satelliteCount > 0 ? 'Poor Fix' : 'No Signal');
            
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
            // Update ESP32 status with animation
            this.updateStatusItem('esp32-status', 'esp32-pulse', status.esp32Connected);
            
            // Update connection mode
            this.updateStatusValue('connection-mode', status.connectionMode || '--');

            // Update signal strength
            const signalStrength = status.signalStrength;
            this.updateStatusValue('signal-strength', signalStrength ? `${signalStrength} dBm` : '--');
            this.updateSignalBars(signalStrength);

        } catch (error) {
            console.error('❌ Error updating system status:', error);
        }
    }

    updateStatusItem(statusId, pulseId, isOnline) {
        const statusElement = document.getElementById(statusId);
        const pulseElement = document.getElementById(pulseId);
        
        if (statusElement) {
            statusElement.textContent = isOnline ? 'Online' : 'Offline';
            statusElement.className = `status-value ${isOnline ? 'online' : 'offline'}`;
        }
        
        if (pulseElement) {
            if (isOnline) {
                pulseElement.classList.add('active');
            } else {
                pulseElement.classList.remove('active');
            }
        }
    }

    updateStatusValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateSignalBars(strength) {
        const signalBars = document.querySelectorAll('#signal-bars .signal-bar');
        const strengthValue = Math.abs(strength || -100);
        
        let activeBars = 0;
        if (strengthValue <= 50) activeBars = 4;
        else if (strengthValue <= 60) activeBars = 3;
        else if (strengthValue <= 70) activeBars = 2;
        else if (strengthValue <= 80) activeBars = 1;
        
        signalBars.forEach((bar, index) => {
            if (index < activeBars) {
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        });
    }

    updateConnectionStatus(connected) {
        try {
            const statusDot = document.querySelector('#cloud-status .status-dot');
            const statusText = document.querySelector('#cloud-status .status-text');

            if (statusDot) {
                statusDot.className = `status-dot ${connected ? 'online' : 'offline'} pulsing`;
            }

            if (statusText) {
                statusText.textContent = connected ? 'Cloud Connected' : 'Cloud Disconnected';
            }

        } catch (error) {
            console.error('❌ Error updating connection status:', error);
        }
    }

    updateGPSStatus(status) {
        const gpsElement = document.getElementById('gps-status');
        if (gpsElement) {
            const spanElement = gpsElement.querySelector('span');
            if (spanElement) {
                spanElement.textContent = `GPS: ${status}`;
                
                // Update color based on status
                gpsElement.className = 'gps-status';
                if (status.includes('Good')) {
                    gpsElement.classList.add('good');
                } else if (status.includes('Poor')) {
                    gpsElement.classList.add('poor');
                } else {
                    gpsElement.classList.add('no-signal');
                }
            }
        }
    }

    updateDataPacketCount(count) {
        const element = document.getElementById('data-packets');
        if (element && count !== undefined) {
            element.textContent = count.toString();
            
            // Animate packet indicator
            const packetAnimation = document.getElementById('packet-animation');
            if (packetAnimation) {
                packetAnimation.style.animation = 'none';
                setTimeout(() => {
                    packetAnimation.style.animation = 'pulse 0.5s ease';
                }, 10);
            }
        }
    }

    updateSystemTime() {
        const timeElement = document.getElementById('system-time');
        if (timeElement) {
            const now = new Date();
            timeElement.textContent = now.toLocaleTimeString();
        }
    }

    updateDataRefreshIndicator() {
        const indicator = document.getElementById('data-refresh');
        if (indicator) {
            indicator.style.animation = 'none';
            setTimeout(() => {
                indicator.style.animation = 'pulse 1s ease-in-out';
            }, 10);
        }
    }

    startDataRefreshIndicator() {
        setInterval(() => {
            this.updateDataRefreshIndicator();
        }, 1000);
    }

    // Notification System
    showNotification(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="close-btn">&times;</button>
        `;

        // Add close functionality
        const closeBtn = notification.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });

        container.appendChild(notification);

        // Auto remove after duration
        setTimeout(() => {
            this.removeNotification(notification);
        }, duration);
    }

    removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                notification.parentNode.removeChild(notification);
            }, 300);
        }
    }

    // Interactive Functions
    handleEmergencyStop() {
        if (confirm('⚠️ EMERGENCY STOP\n\nThis will immediately cut power to all systems.\n\nAre you absolutely sure?')) {
            this.sendCommand('emergency', 'stop');
            this.showNotification('Emergency cut-off activated!', 'error');
            this.addLogEntry('Emergency', 'Emergency cut-off activated');
            
            // Visual feedback
            const btn = document.getElementById('emergency-cutoff');
            if (btn) {
                btn.style.background = 'radial-gradient(circle, #990000, #660000)';
                btn.querySelector('.emergency-text').innerHTML = 'SYSTEM<br><span class="cut-text">STOPPED</span>';
                setTimeout(() => {
                    btn.style.background = '';
                    btn.querySelector('.emergency-text').innerHTML = 'EMERGENCY<br><span class="cut-text">CUT OFF</span>';
                }, 5000);
            }
        }
    }

    showTeamInfo() {
        const info = `🚁 SWARAKARSA ITERA TECHNOLOGY DEVELOPMENT

UAV Dashboard System v2.0
Enhanced Interactive Edition

Developed for KRTI Competition 2025

Features:
• Real-time telemetry monitoring
• Interactive flight path mapping
• Power system analytics
• Emergency cut-off controls
• Responsive design

Team: UAV Development Division
Contact: uav@swarakarsa.itera.ac.id`;

        alert(info);
        this.addLogEntry('Info', 'Team information displayed');
    }

    exportChart() {
        if (this.powerChart) {
            const url = this.powerChart.toBase64Image();
            const link = document.createElement('a');
            link.download = `power-chart-${new Date().toISOString().split('T')[0]}.png`;
            link.href = url;
            link.click();
            
            this.showNotification('Chart exported successfully', 'success');
        }
    }

    toggleChartType() {
        if (this.powerChart) {
            const currentType = this.powerChart.config.type;
            const newType = currentType === 'line' ? 'bar' : 'line';
            
            this.powerChart.config.type = newType;
            this.powerChart.update();
            
            this.showNotification(`Chart type changed to ${newType}`, 'info');
        }
    }

    clearLog() {
        const logContainer = document.getElementById('activity-log');
        if (logContainer) {
            logContainer.innerHTML = '';
            this.addLogEntry('System', 'Activity log cleared');
            this.showNotification('Activity log cleared', 'info');
        }
    }

    exportLog() {
        const logs = Array.from(document.querySelectorAll('.log-entry')).map(entry => {
            const time = entry.querySelector('.log-time').textContent;
            const message = entry.querySelector('.log-message').textContent;
            return `${time} ${message}`;
        }).join('\n');

        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `dashboard-log-${new Date().toISOString().split('T')[0]}.txt`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        this.showNotification('Log exported successfully', 'success');
    }

    toggleFullscreenMap() {
        const mapCard = document.querySelector('.flight-path-card');
        if (mapCard) {
            if (!mapCard.classList.contains('fullscreen')) {
                mapCard.classList.add('fullscreen');
                this.flightMap.invalidateSize();
                this.showNotification('Map in fullscreen mode', 'info');
            } else {
                mapCard.classList.remove('fullscreen');
                this.flightMap.invalidateSize();
            }
        }
    }

    animateButtonPress(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 150);
        }
    }

    // Settings Modal
    initializeSettingsModal() {
        const modal = document.getElementById('settings-modal');
        const closeBtn = document.getElementById('close-settings');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeSettingsModal();
            });
        }
        
        // Settings controls
        this.setupSettingsControls();
    }

    openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    closeSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    setupSettingsControls() {
        // Update interval
        const intervalSlider = document.getElementById('update-interval');
        const intervalValue = document.getElementById('interval-value');
        
        if (intervalSlider && intervalValue) {
            intervalSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                intervalValue.textContent = `${value}ms`;
                this.settings.updateInterval = parseInt(value);
            });
        }

        // Chart data points
        const pointsSlider = document.getElementById('chart-points');
        const pointsValue = document.getElementById('points-value');
        
        if (pointsSlider && pointsValue) {
            pointsSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                pointsValue.textContent = value;
                this.settings.chartDataPoints = parseInt(value);
            });
        }

        // Theme selector
        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                this.applyTheme(e.target.value);
            });
        }
    }

    applyTheme(theme) {
        document.body.className = `theme-${theme}`;
        this.settings.theme = theme;
    }

    handleResize() {
        if (this.powerChart) {
            this.powerChart.resize();
        }
        if (this.flightMap) {
            this.flightMap.invalidateSize();
        }
    }

    handleKeyboardShortcuts(event) {
        // Emergency stop: Ctrl+Shift+E
        if (event.ctrlKey && event.shiftKey && event.key === 'E') {
            event.preventDefault();
            this.handleEmergencyStop();
        }
        
        // Settings: Ctrl+Comma
        if (event.ctrlKey && event.key === ',') {
            event.preventDefault();
            this.openSettingsModal();
        }
        
        // Clear log: Ctrl+Shift+C
        if (event.ctrlKey && event.shiftKey && event.key === 'C') {
            event.preventDefault();
            this.clearLog();
        }
    }

    startHeartbeat() {
        setInterval(() => {
            if (this.isConnected && this.socket) {
                this.socket.emit('heartbeat', { 
                    timestamp: Date.now(),
                    clientType: 'enhanced-dashboard' 
                });
            }
        }, 30000);
    }

    animateSignalBars() {
        const bars = document.querySelectorAll('.signal-bars .bar');
        let index = 0;
        
        setInterval(() => {
            bars.forEach((bar, i) => {
                bar.classList.toggle('active', i <= index);
            });
            index = (index + 1) % bars.length;
        }, 2000);
    }

    animateStatusIndicators() {
        // Add subtle animations to status indicators
        const indicators = document.querySelectorAll('.status-pulse');
        indicators.forEach(indicator => {
            setInterval(() => {
                if (Math.random() > 0.7) {
                    indicator.classList.add('active');
                    setTimeout(() => {
                        indicator.classList.remove('active');
                    }, 1000);
                }
            }, 3000);
        });
    }

    sendCommand(action, value) {
        if (!this.isConnected) {
            this.showNotification('Cannot send command - not connected', 'warning');
            return;
        }

        try {
            const command = { action, value, timestamp: Date.now() };
            this.socket.emit('command', command);
            this.addLogEntry('Command', `Sent: ${action} = ${value}`);
        } catch (error) {
            console.error('❌ Error sending command:', error);
            this.showNotification(`Failed to send command: ${error.message}`, 'error');
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
            
            const indicator = document.createElement('div');
            indicator.className = 'log-indicator';
            
            entry.appendChild(timestamp);
            entry.appendChild(msg);
            entry.appendChild(indicator);
            logContainer.appendChild(entry);

            // Limit log entries
            while (logContainer.children.length > 50) {
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
            this.showNotification('Max reconnection attempts reached', 'error');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        
        this.showNotification(`Reconnecting in ${delay/1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warning');

        setTimeout(() => {
            if (!this.isConnected) {
                this.initializeSocket();
            }
        }, delay);
    }
}

// Initialize enhanced dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Enhanced UAV Dashboard...');
    window.dashboard = new UAVDashboard();
});

// Export for global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UAVDashboard;
}
