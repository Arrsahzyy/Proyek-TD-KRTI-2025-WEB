/**
 * UAV Dashboard Client - RESTRUCTURED & RELIABLE VERSION
 * 
 * Features:
 * - Modular architecture with separate concerns
 * - Comprehensive error handling and recovery
 * - Performance optimization and memory management
 * - Beginner-friendly code structure with clear documentation
 * - Real-time telemetry visualization
 * - Interactive map and chart components
 * 
 * @author KRTI Team
 * @version 3.0.0
 */

// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================
const CLIENT_CONFIG = {
    // Connection settings
    CONNECTION: {
        RECONNECT_ATTEMPTS: 10,
        RECONNECT_DELAY: 3000,
        PING_TIMEOUT: 10000,
        HEARTBEAT_INTERVAL: 5000
    },
    
    // UI update settings
    UI: {
        UPDATE_INTERVAL: 1000,        // UI refresh rate
        CHART_POINTS: 50,            // Max chart data points
        CHART_WINDOW_MS: 60000,      // Chart time window (1 minute)
        ANIMATION_DURATION: 300,     // CSS transition duration
        NOTIFICATION_TIMEOUT: 5000   // Notification display time
    },
    
    // Performance settings
    PERFORMANCE: {
        THROTTLE_DELAY: 100,         // Function throttling delay
        MAX_HISTORY_SIZE: 1000,      // Max telemetry history
        RENDER_TIMEOUT: 16,          // Max render time (60fps)
        MEMORY_CLEANUP_INTERVAL: 30000 // Memory cleanup interval
    },
    
    // Map settings
    MAP: {
        DEFAULT_CENTER: [-5.358400, 105.311700], // ITERA Lampung
        DEFAULT_ZOOM: 15,
        MAX_ZOOM: 20,
        MIN_ZOOM: 10,
        TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
class Utils {
    /**
     * Throttle function execution to improve performance
     */
    static throttle(func, delay) {
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
    
    /**
     * Debounce function execution
     */
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    /**
     * Format numbers with proper precision
     */
    static formatNumber(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) {
            return '--';
        }
        return Number(value).toFixed(decimals);
    }
    
    /**
     * Calculate trend from two values
     */
    static calculateTrend(current, previous) {
        if (!previous || !current) return 'stable';
        
        const diff = current - previous;
        const threshold = Math.abs(previous) * 0.01; // 1% threshold
        
        if (Math.abs(diff) < threshold) return 'stable';
        return diff > 0 ? 'up' : 'down';
    }
    
    /**
     * Safe element query with error handling
     */
    static safeQuerySelector(selector) {
        try {
            return document.querySelector(selector);
        } catch (error) {
            console.warn(`Invalid selector: ${selector}`, error);
            return null;
        }
    }
    
    /**
     * Add CSS class safely
     */
    static safeAddClass(element, className) {
        if (element && element.classList) {
            element.classList.add(className);
        }
    }
    
    /**
     * Remove CSS class safely
     */
    static safeRemoveClass(element, className) {
        if (element && element.classList) {
            element.classList.remove(className);
        }
    }
}

// =============================================================================
// ERROR HANDLER
// =============================================================================
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.setupGlobalErrorHandling();
    }
    
    setupGlobalErrorHandling() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.logError('Global', 'Uncaught Error', {
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error
            });
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Global', 'Unhandled Promise Rejection', {
                reason: event.reason
            });
        });
    }
    
    logError(category, message, details = null) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            category: category,
            message: message,
            details: details
        };
        
        this.errors.push(errorEntry);
        
        // Keep only recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(-this.maxErrors);
        }
        
        // Log to console
        console.error(`[${category}] ${message}`, details || '');
        
        // Show user notification for critical errors
        if (category === 'Critical') {
            notificationManager.show(`Critical Error: ${message}`, 'error');
        }
    }
    
    getRecentErrors() {
        return this.errors.slice(-10); // Last 10 errors
    }
    
    clearErrors() {
        this.errors = [];
    }
}

// =============================================================================
// NOTIFICATION MANAGER
// =============================================================================
class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.init();
    }
    
    init() {
        this.container = Utils.safeQuerySelector('#notification-container');
        if (!this.container) {
            console.warn('Notification container not found');
        }
    }
    
    show(message, type = 'info', duration = CLIENT_CONFIG.UI.NOTIFICATION_TIMEOUT) {
        if (!this.container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Add close functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.remove(notification));
        
        // Add to container
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // Auto-remove after duration
        setTimeout(() => this.remove(notification), duration);
        
        // Trigger entrance animation
        setTimeout(() => notification.classList.add('show'), 10);
    }
    
    remove(notification) {
        if (!notification || !this.container) return;
        
        notification.classList.remove('show');
        
        setTimeout(() => {
            if (notification.parentNode) {
                this.container.removeChild(notification);
            }
            
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }
    
    clear() {
        this.notifications.forEach(notification => this.remove(notification));
        this.notifications = [];
    }
}

// =============================================================================
// CONNECTION MANAGER
// =============================================================================
class ConnectionManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.heartbeatInterval = null;
        this.connectionStatus = 'disconnected';
        
        this.onConnect = null;
        this.onDisconnect = null;
        this.onTelemetryData = null;
        this.onError = null;
    }
    
    async connect() {
        try {
            // Initialize Socket.IO connection
            this.socket = io({
                timeout: CLIENT_CONFIG.CONNECTION.PING_TIMEOUT,
                forceNew: true,
                transports: ['websocket', 'polling']
            });
            
            this.setupEventHandlers();
            
        } catch (error) {
            errorHandler.logError('Connection', 'Failed to initialize connection', error);
            this.handleConnectionError(error);
        }
    }
    
    setupEventHandlers() {
        if (!this.socket) return;
        
        // Connection established
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.connectionStatus = 'connected';
            this.reconnectAttempts = 0;
            
            console.log('✅ Connected to server');
            notificationManager.show('Connected to UAV Dashboard Server', 'success');
            
            this.startHeartbeat();
            
            if (this.onConnect) {
                this.onConnect();
            }
        });
        
        // Connection lost
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            this.connectionStatus = 'disconnected';
            
            console.log('❌ Disconnected from server:', reason);
            
            this.stopHeartbeat();
            
            if (this.onDisconnect) {
                this.onDisconnect(reason);
            }
            
            // Attempt reconnection
            this.attemptReconnect();
        });
        
        // Telemetry data received
        this.socket.on('telemetryUpdate', (data) => {
            try {
                if (this.onTelemetryData) {
                    this.onTelemetryData(data);
                }
            } catch (error) {
                errorHandler.logError('Connection', 'Error processing telemetry data', error);
            }
        });
        
        // Backward compatibility
        this.socket.on('telemetryData', (data) => {
            try {
                if (this.onTelemetryData) {
                    this.onTelemetryData(data);
                }
            } catch (error) {
                errorHandler.logError('Connection', 'Error processing legacy telemetry data', error);
            }
        });
        
        // Connection statistics
        this.socket.on('connectionStats', (stats) => {
            // Update UI with connection stats if needed
            console.debug('Connection stats received:', stats);
        });
        
        // ESP32 status updates
        this.socket.on('esp32Status', (status) => {
            console.log('ESP32 Status:', status);
            // Update UI to show ESP32 connection status
        });
        
        // Server shutdown notification
        this.socket.on('serverShutdown', (data) => {
            notificationManager.show('Server is shutting down...', 'warning');
            console.warn('Server shutdown:', data);
        });
        
        // Socket errors
        this.socket.on('error', (error) => {
            errorHandler.logError('Socket', 'Socket error occurred', error);
            
            if (this.onError) {
                this.onError(error);
            }
        });
        
        // Connection errors
        this.socket.on('connect_error', (error) => {
            this.handleConnectionError(error);
        });
    }
    
    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing heartbeat
        
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.isConnected) {
                this.socket.emit('heartbeat', { timestamp: Date.now() });
            }
        }, CLIENT_CONFIG.CONNECTION.HEARTBEAT_INTERVAL);
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts >= CLIENT_CONFIG.CONNECTION.RECONNECT_ATTEMPTS) {
            notificationManager.show('Maximum reconnection attempts reached', 'error');
            return;
        }
        
        this.reconnectAttempts++;
        this.connectionStatus = 'reconnecting';
        
        console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${CLIENT_CONFIG.CONNECTION.RECONNECT_ATTEMPTS})`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, CLIENT_CONFIG.CONNECTION.RECONNECT_DELAY);
    }
    
    handleConnectionError(error) {
        console.error('Connection error:', error);
        this.connectionStatus = 'error';
        
        if (error.message && error.message.includes('ECONNREFUSED')) {
            notificationManager.show('Cannot connect to server. Please check if the server is running.', 'error');
        } else {
            notificationManager.show('Connection error occurred', 'error');
        }
    }
    
    sendCommand(command, value = null) {
        if (!this.socket || !this.isConnected) {
            notificationManager.show('Not connected to server', 'warning');
            return false;
        }
        
        try {
            this.socket.emit('relayCommand', {
                command: command,
                value: value,
                timestamp: Date.now()
            });
            
            return true;
        } catch (error) {
            errorHandler.logError('Command', 'Failed to send command', error);
            return false;
        }
    }
    
    disconnect() {
        this.stopHeartbeat();
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
    }
}

// =============================================================================
// TELEMETRY DATA MANAGER
// =============================================================================
class TelemetryDataManager {
    constructor() {
        this.currentData = {};
        this.history = [];
        this.previousValues = {};
        this.trends = {};
        this.lastUpdateTime = 0;
        
        // Performance optimization
        this.updateTelemetry = Utils.throttle(
            this.updateTelemetry.bind(this), 
            CLIENT_CONFIG.PERFORMANCE.THROTTLE_DELAY
        );
    }
    
    updateTelemetry(newData) {
        try {
            const now = Date.now();
            
            // Validate data
            if (!newData || typeof newData !== 'object') {
                throw new Error('Invalid telemetry data format');
            }
            
            // Calculate trends
            this.calculateTrends(newData);
            
            // Store previous values
            this.previousValues = { ...this.currentData };
            
            // Update current data
            this.currentData = {
                ...this.currentData,
                ...newData,
                timestamp: now,
                lastUpdated: new Date().toISOString()
            };
            
            // Add to history
            this.addToHistory(this.currentData);
            
            // Update last update time
            this.lastUpdateTime = now;
            
            return true;
            
        } catch (error) {
            errorHandler.logError('TelemetryData', 'Failed to update telemetry', error);
            return false;
        }
    }
    
    calculateTrends(newData) {
        const numericFields = [
            'battery_voltage', 'battery_current', 'battery_power',
            'temperature', 'humidity', 'altitude', 'speed',
            'gps_latitude', 'gps_longitude', 'signal_strength'
        ];
        
        numericFields.forEach(field => {
            if (newData[field] !== undefined && this.currentData[field] !== undefined) {
                this.trends[field] = Utils.calculateTrend(
                    newData[field], 
                    this.currentData[field]
                );
            }
        });
    }
    
    addToHistory(data) {
        this.history.push({
            ...data,
            timestamp: Date.now()
        });
        
        // Keep history size under control
        if (this.history.length > CLIENT_CONFIG.PERFORMANCE.MAX_HISTORY_SIZE) {
            this.history = this.history.slice(-CLIENT_CONFIG.PERFORMANCE.MAX_HISTORY_SIZE);
        }
    }
    
    getCurrentData() {
        return { ...this.currentData };
    }
    
    getTrend(field) {
        return this.trends[field] || 'stable';
    }
    
    getHistory(field = null, maxItems = 100) {
        if (field) {
            return this.history
                .filter(item => item[field] !== undefined)
                .map(item => ({
                    timestamp: item.timestamp,
                    value: item[field]
                }))
                .slice(-maxItems);
        }
        
        return this.history.slice(-maxItems);
    }
    
    getDataAge() {
        if (!this.lastUpdateTime) return Infinity;
        return Date.now() - this.lastUpdateTime;
    }
    
    isDataFresh(maxAge = 10000) { // 10 seconds default
        return this.getDataAge() < maxAge;
    }
    
    reset() {
        this.currentData = {};
        this.history = [];
        this.previousValues = {};
        this.trends = {};
        this.lastUpdateTime = 0;
    }
}

// =============================================================================
// INITIALIZE GLOBAL INSTANCES
// =============================================================================
const errorHandler = new ErrorHandler();
const notificationManager = new NotificationManager();
const connectionManager = new ConnectionManager();
const telemetryDataManager = new TelemetryDataManager();

// =============================================================================
// UI COMPONENTS
// =============================================================================

/**
 * Loading Screen Manager
 */
class LoadingScreen {
    constructor() {
        this.element = Utils.safeQuerySelector('#loading-screen');
        this.progressBar = Utils.safeQuerySelector('#progress-bar');
        this.loadingText = Utils.safeQuerySelector('#loading-text');
        this.isShowing = true;
    }
    
    updateProgress(text, percentage) {
        if (this.loadingText) {
            this.loadingText.textContent = text;
        }
        
        if (this.progressBar) {
            this.progressBar.style.width = `${percentage}%`;
        }
    }
    
    hide() {
        if (!this.element || !this.isShowing) return;
        
        this.isShowing = false;
        
        Utils.safeAddClass(this.element, 'fade-out');
        
        setTimeout(() => {
            if (this.element) {
                this.element.style.display = 'none';
            }
        }, 500);
    }
    
    show() {
        if (!this.element) return;
        
        this.isShowing = true;
        this.element.style.display = 'flex';
        Utils.safeRemoveClass(this.element, 'fade-out');
    }
}

/**
 * System Time Display
 */
class SystemTimeDisplay {
    constructor() {
        this.element = Utils.safeQuerySelector('#system-time');
        this.isRunning = false;
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.update();
        
        this.interval = setInterval(() => {
            this.update();
        }, 1000);
    }
    
    stop() {
        this.isRunning = false;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    
    update() {
        if (!this.element) return;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        this.element.textContent = timeString;
    }
}

/**
 * Data Refresh Indicator
 */
class DataRefreshIndicator {
    constructor() {
        this.element = Utils.safeQuerySelector('#data-refresh');
        this.isActive = false;
    }
    
    start() {
        if (!this.element) return;
        
        this.isActive = true;
        Utils.safeAddClass(this.element, 'active');
        
        this.interval = setInterval(() => {
            if (this.element) {
                this.element.style.opacity = this.element.style.opacity === '0.3' ? '1' : '0.3';
            }
        }, 1000);
    }
    
    stop() {
        this.isActive = false;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        if (this.element) {
            Utils.safeRemoveClass(this.element, 'active');
            this.element.style.opacity = '1';
        }
    }
}

/**
 * Flight Map Component
 */
class FlightMap {
    constructor() {
        this.map = null;
        this.container = Utils.safeQuerySelector('#flight-map');
        this.uavMarker = null;
        this.homeMarker = null;
        this.flightPath = [];
        this.pathPolyline = null;
        this.isInitialized = false;
    }
    
    async initialize() {
        try {
            if (!this.container) {
                throw new Error('Map container not found');
            }
            
            // Initialize Leaflet map
            this.map = L.map(this.container, {
                center: CLIENT_CONFIG.MAP.DEFAULT_CENTER,
                zoom: CLIENT_CONFIG.MAP.DEFAULT_ZOOM,
                maxZoom: CLIENT_CONFIG.MAP.MAX_ZOOM,
                minZoom: CLIENT_CONFIG.MAP.MIN_ZOOM,
                zoomControl: false // We'll add custom controls
            });
            
            // Add tile layer
            L.tileLayer(CLIENT_CONFIG.MAP.TILE_URL, {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
            
            // Add home marker
            this.addHomeMarker();
            
            // Setup map controls
            this.setupControls();
            
            this.isInitialized = true;
            console.log('✅ Flight map initialized successfully');
            
        } catch (error) {
            errorHandler.logError('Map', 'Failed to initialize flight map', error);
            throw error;
        }
    }
    
    addHomeMarker() {
        if (!this.map) return;
        
        const homeIcon = L.divIcon({
            className: 'home-marker',
            html: '<div class="home-icon-container"><i class="fas fa-home"></i></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        this.homeMarker = L.marker(CLIENT_CONFIG.MAP.DEFAULT_CENTER, { 
            icon: homeIcon,
            title: 'Home Position'
        }).addTo(this.map);
    }
    
    setupControls() {
        // Custom zoom controls
        const zoomInBtn = Utils.safeQuerySelector('#zoom-in');
        const zoomOutBtn = Utils.safeQuerySelector('#zoom-out');
        const centerBtn = Utils.safeQuerySelector('#center-map');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
        }
        
        if (centerBtn) {
            centerBtn.addEventListener('click', () => this.centerOnUAV());
        }
    }
    
    updateUAVPosition(lat, lng) {
        if (!this.map || !lat || !lng) return;
        
        try {
            const position = [lat, lng];
            
            // Create or update UAV marker
            if (!this.uavMarker) {
                const uavIcon = L.divIcon({
                    className: 'uav-marker',
                    html: `<div class="uav-icon-container">
                             <i class="fas fa-plane uav-icon"></i>
                             <div class="uav-pulse"></div>
                           </div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });
                
                this.uavMarker = L.marker(position, { 
                    icon: uavIcon,
                    title: 'UAV Position'
                }).addTo(this.map);
            } else {
                this.uavMarker.setLatLng(position);
            }
            
            // Add to flight path
            this.addToFlightPath(position);
            
            // Update path display
            this.updateFlightPath();
            
        } catch (error) {
            errorHandler.logError('Map', 'Failed to update UAV position', error);
        }
    }
    
    addToFlightPath(position) {
        this.flightPath.push(position);
        
        // Keep path length reasonable
        if (this.flightPath.length > 100) {
            this.flightPath = this.flightPath.slice(-100);
        }
    }
    
    updateFlightPath() {
        if (!this.map || this.flightPath.length < 2) return;
        
        try {
            // Remove existing path
            if (this.pathPolyline) {
                this.map.removeLayer(this.pathPolyline);
            }
            
            // Create new path
            this.pathPolyline = L.polyline(this.flightPath, {
                color: '#d69e2e',
                weight: 3,
                opacity: 0.8,
                smoothFactor: 1
            }).addTo(this.map);
            
        } catch (error) {
            errorHandler.logError('Map', 'Failed to update flight path', error);
        }
    }
    
    zoomIn() {
        if (this.map) {
            this.map.zoomIn();
        }
    }
    
    zoomOut() {
        if (this.map) {
            this.map.zoomOut();
        }
    }
    
    centerOnUAV() {
        if (this.map && this.uavMarker) {
            this.map.setView(this.uavMarker.getLatLng(), this.map.getZoom());
        }
    }
    
    resize() {
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        }
    }
}

/**
 * Power Chart Component
 */
class PowerChart {
    constructor() {
        this.chart = null;
        this.canvas = Utils.safeQuerySelector('#powerChart');
        this.container = Utils.safeQuerySelector('.graph-container');
        this.isInitialized = false;
        this.data = {
            voltage: [],
            current: [],
            power: []
        };
    }
    
    async initialize() {
        try {
            if (!this.canvas) {
                throw new Error('Chart canvas not found');
            }
            
            const ctx = this.canvas.getContext('2d');
            
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Voltage (V)',
                            data: [],
                            borderColor: '#d69e2e',
                            backgroundColor: 'rgba(214, 158, 46, 0.1)',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4
                        },
                        {
                            label: 'Current (A)',
                            data: [],
                            borderColor: '#3182ce',
                            backgroundColor: 'rgba(49, 130, 206, 0.1)',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4
                        },
                        {
                            label: 'Power (W)',
                            data: [],
                            borderColor: '#38a169',
                            backgroundColor: 'rgba(56, 161, 105, 0.1)',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#e2e8f0',
                                font: {
                                    size: 12
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'second',
                                displayFormats: {
                                    second: 'HH:mm:ss'
                                }
                            },
                            grid: {
                                color: 'rgba(226, 232, 240, 0.1)'
                            },
                            ticks: {
                                color: '#cbd5e0',
                                maxTicksLimit: 10
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(226, 232, 240, 0.1)'
                            },
                            ticks: {
                                color: '#cbd5e0'
                            }
                        }
                    },
                    animation: {
                        duration: 0 // Disable animation for better performance
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
            
            this.isInitialized = true;
            console.log('✅ Power chart initialized successfully');
            
        } catch (error) {
            errorHandler.logError('Chart', 'Failed to initialize power chart', error);
            throw error;
        }
    }
    
    updateData(telemetryData) {
        if (!this.chart || !this.isInitialized) return;
        
        try {
            const now = new Date();
            
            // Add new data points
            this.chart.data.labels.push(now);
            this.chart.data.datasets[0].data.push({
                x: now,
                y: telemetryData.battery_voltage || 0
            });
            this.chart.data.datasets[1].data.push({
                x: now,
                y: telemetryData.battery_current || 0
            });
            this.chart.data.datasets[2].data.push({
                x: now,
                y: telemetryData.battery_power || 0
            });
            
            // Keep data within window
            const maxPoints = CLIENT_CONFIG.UI.CHART_POINTS;
            const windowMs = CLIENT_CONFIG.UI.CHART_WINDOW_MS;
            const cutoffTime = now.getTime() - windowMs;
            
            // Remove old data points
            this.chart.data.datasets.forEach(dataset => {
                dataset.data = dataset.data.filter(point => 
                    point.x.getTime() > cutoffTime
                );
            });
            
            // Remove old labels
            this.chart.data.labels = this.chart.data.labels.filter(label => 
                label.getTime() > cutoffTime
            );
            
            // Update chart
            this.chart.update('none'); // 'none' mode for better performance
            
        } catch (error) {
            errorHandler.logError('Chart', 'Failed to update chart data', error);
        }
    }
    
    resize() {
        if (this.chart) {
            this.chart.resize();
        }
    }
}

// =============================================================================
// TELEMETRY DISPLAY MANAGER
// =============================================================================
class TelemetryDisplay {
    constructor() {
        this.elements = {
            // Data cards
            speed: Utils.safeQuerySelector('[data-field="speed"]'),
            longitude: Utils.safeQuerySelector('[data-field="longitude"]'),
            latitude: Utils.safeQuerySelector('[data-field="latitude"]'),
            voltage: Utils.safeQuerySelector('[data-field="voltage"]'),
            current: Utils.safeQuerySelector('[data-field="current"]'),
            power: Utils.safeQuerySelector('[data-field="power"]'),
            
            // Trend indicators
            speedTrend: Utils.safeQuerySelector('#speed-trend'),
            lonTrend: Utils.safeQuerySelector('#lon-trend'),
            latTrend: Utils.safeQuerySelector('#lat-trend'),
            voltageTrend: Utils.safeQuerySelector('#voltage-trend'),
            currentTrend: Utils.safeQuerySelector('#current-trend'),
            powerTrend: Utils.safeQuerySelector('#power-trend')
        };
        
        this.setupDataCards();
    }
    
    setupDataCards() {
        // Find all data cards and setup their structure
        const dataCards = document.querySelectorAll('.data-card');
        
        dataCards.forEach((card, index) => {
            const configs = [
                { field: 'speed', icon: 'fas fa-tachometer-alt', label: 'Speed', unit: 'km/h', trend: 'speed' },
                { field: 'longitude', icon: 'fas fa-map-marker-alt', label: 'Longitude', unit: '°', trend: 'lon' },
                { field: 'latitude', icon: 'fas fa-map-marker-alt', label: 'Latitude', unit: '°', trend: 'lat' },
                { field: 'voltage', icon: 'fas fa-bolt', label: 'Battery Voltage', unit: 'V', trend: 'voltage' },
                { field: 'current', icon: 'fas fa-plug', label: 'Current', unit: 'A', trend: 'current' },
                { field: 'power', icon: 'fas fa-battery-half', label: 'Power', unit: 'W', trend: 'power' }
            ];
            
            if (index < configs.length) {
                const config = configs[index];
                
                card.innerHTML = `
                    <div class="data-icon">
                        <i class="${config.icon}"></i>
                    </div>
                    <div class="data-content">
                        <div class="data-label">${config.label}</div>
                        <div class="data-value" id="${config.field}-value">--</div>
                    </div>
                    <div class="data-trend" id="${config.trend}-trend">
                        <i class="fas fa-minus"></i>
                    </div>
                `;
                
                card.setAttribute('data-field', config.field);
                card.setAttribute('data-tooltip', config.label);
            }
        });
    }
    
    updateDisplay(telemetryData) {
        try {
            // Update data values
            this.updateDataField('speed', telemetryData.speed, 'km/h', 1);
            this.updateDataField('longitude', telemetryData.gps_longitude, '°', 6);
            this.updateDataField('latitude', telemetryData.gps_latitude, '°', 6);
            this.updateDataField('voltage', telemetryData.battery_voltage, 'V', 2);
            this.updateDataField('current', telemetryData.battery_current, 'A', 2);
            this.updateDataField('power', telemetryData.battery_power, 'W', 1);
            
            // Update trend indicators
            this.updateTrendIndicator('speed', telemetryDataManager.getTrend('speed'));
            this.updateTrendIndicator('lon', telemetryDataManager.getTrend('gps_longitude'));
            this.updateTrendIndicator('lat', telemetryDataManager.getTrend('gps_latitude'));
            this.updateTrendIndicator('voltage', telemetryDataManager.getTrend('battery_voltage'));
            this.updateTrendIndicator('current', telemetryDataManager.getTrend('battery_current'));
            this.updateTrendIndicator('power', telemetryDataManager.getTrend('battery_power'));
            
        } catch (error) {
            errorHandler.logError('TelemetryDisplay', 'Failed to update display', error);
        }
    }
    
    updateDataField(field, value, unit, decimals) {
        const element = Utils.safeQuerySelector(`#${field}-value`);
        if (!element) return;
        
        const formattedValue = Utils.formatNumber(value, decimals);
        element.textContent = formattedValue === '--' ? '--' : `${formattedValue} ${unit}`;
        
        // Add animation class
        Utils.safeAddClass(element, 'animate-number');
        setTimeout(() => {
            Utils.safeRemoveClass(element, 'animate-number');
        }, 300);
    }
    
    updateTrendIndicator(field, trend) {
        const element = Utils.safeQuerySelector(`#${field}-trend`);
        if (!element) return;
        
        // Remove old trend classes
        element.className = 'data-trend';
        
        // Update icon and class based on trend
        let icon = 'fas fa-minus';
        if (trend === 'up') {
            icon = 'fas fa-arrow-up';
            Utils.safeAddClass(element, 'trend-up');
        } else if (trend === 'down') {
            icon = 'fas fa-arrow-down';
            Utils.safeAddClass(element, 'trend-down');
        }
        
        element.innerHTML = `<i class="${icon}"></i>`;
    }
}

// =============================================================================
// MAIN DASHBOARD CLASS
// =============================================================================
class UAVDashboard {
    constructor() {
        this.isInitialized = false;
        this.components = {};
        this.updateInterval = null;
        
        // Bind methods to preserve 'this' context
        this.handleTelemetryData = this.handleTelemetryData.bind(this);
        this.handleConnectionChange = this.handleConnectionChange.bind(this);
        this.handleWindowResize = this.handleWindowResize.bind(this);
    }
    
    async initialize() {
        try {
            console.log('🚁 Initializing Enhanced UAV Dashboard...');
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup connection handlers
            this.setupConnectionHandlers();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start updates
            this.startPeriodicUpdates();
            
            // Hide loading screen
            this.components.loadingScreen.hide();
            
            this.isInitialized = true;
            console.log('✅ UAV Dashboard initialized successfully');
            
            notificationManager.show('UAV Dashboard ready', 'success');
            
        } catch (error) {
            errorHandler.logError('Critical', 'Failed to initialize dashboard', error);
            notificationManager.show('Failed to initialize dashboard', 'error');
        }
    }
    
    async initializeComponents() {
        const steps = [
            { name: 'Loading Screen', action: () => this.components.loadingScreen = new LoadingScreen() },
            { name: 'System Time', action: () => this.components.systemTime = new SystemTimeDisplay() },
            { name: 'Data Refresh Indicator', action: () => this.components.dataRefresh = new DataRefreshIndicator() },
            { name: 'Flight Map', action: () => this.initializeFlightMap() },
            { name: 'Power Chart', action: () => this.initializePowerChart() },
            { name: 'Telemetry Display', action: () => this.components.telemetryDisplay = new TelemetryDisplay() },
            { name: 'Connection', action: () => this.initializeConnection() }
        ];
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const progress = Math.floor(((i + 1) / steps.length) * 100);
            
            this.components.loadingScreen?.updateProgress(`Initializing ${step.name}...`, progress);
            
            try {
                await step.action();
                console.log(`✅ ${step.name} initialized`);
            } catch (error) {
                console.error(`❌ Failed to initialize ${step.name}:`, error);
                throw error;
            }
            
            // Small delay for smooth loading animation
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    async initializeFlightMap() {
        this.components.flightMap = new FlightMap();
        await this.components.flightMap.initialize();
    }
    
    async initializePowerChart() {
        this.components.powerChart = new PowerChart();
        await this.components.powerChart.initialize();
    }
    
    async initializeConnection() {
        connectionManager.onConnect = this.handleConnectionChange;
        connectionManager.onDisconnect = this.handleConnectionChange;
        connectionManager.onTelemetryData = this.handleTelemetryData;
        connectionManager.onError = (error) => {
            errorHandler.logError('Connection', 'Connection error', error);
        };
        
        await connectionManager.connect();
    }
    
    setupConnectionHandlers() {
        // Additional connection event handling if needed
    }
    
    setupEventListeners() {
        // Window resize handler
        window.addEventListener('resize', this.handleWindowResize);
        
        // Emergency stop button
        const emergencyBtn = Utils.safeQuerySelector('#emergency-cutoff');
        if (emergencyBtn) {
            emergencyBtn.addEventListener('click', this.handleEmergencyStop.bind(this));
        }
        
        // Team info button
        const teamBtn = Utils.safeQuerySelector('.team-btn');
        if (teamBtn) {
            teamBtn.addEventListener('click', this.showTeamInfo.bind(this));
        }
        
        // Map controls
        const fullscreenBtn = Utils.safeQuerySelector('#fullscreen-map');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', this.toggleMapFullscreen.bind(this));
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey) {
                switch (event.key) {
                    case 'r':
                        event.preventDefault();
                        this.refreshDashboard();
                        break;
                    case 'f':
                        event.preventDefault();
                        this.toggleMapFullscreen();
                        break;
                }
            }
        });
    }
    
    startPeriodicUpdates() {
        // Start system time
        this.components.systemTime?.start();
        
        // Start data refresh indicator
        this.components.dataRefresh?.start();
        
        // Start periodic UI updates
        this.updateInterval = setInterval(() => {
            this.updateUI();
        }, CLIENT_CONFIG.UI.UPDATE_INTERVAL);
    }
    
    stopPeriodicUpdates() {
        this.components.systemTime?.stop();
        this.components.dataRefresh?.stop();
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    handleTelemetryData(data) {
        try {
            // Update telemetry data manager
            const success = telemetryDataManager.updateTelemetry(data);
            
            if (success) {
                // Update chart
                this.components.powerChart?.updateData(data);
                
                // Update map
                if (data.gps_latitude && data.gps_longitude) {
                    this.components.flightMap?.updateUAVPosition(
                        data.gps_latitude, 
                        data.gps_longitude
                    );
                }
                
                // Update telemetry display
                this.components.telemetryDisplay?.updateDisplay(data);
                
                // Update connection status
                this.updateConnectionStatus(data.connection_status);
            }
            
        } catch (error) {
            errorHandler.logError('Dashboard', 'Failed to handle telemetry data', error);
        }
    }
    
    handleConnectionChange() {
        this.updateConnectionStatus(connectionManager.connectionStatus);
    }
    
    updateConnectionStatus(status) {
        // Update ESP32 status indicator
        const esp32Status = Utils.safeQuerySelector('#esp32-status');
        const esp32Light = Utils.safeQuerySelector('#esp32-light');
        
        if (esp32Status) {
            esp32Status.textContent = status === 'connected' ? 'Online' : 'Offline';
            esp32Status.className = `status-value ${status === 'connected' ? 'online' : 'offline'}`;
        }
        
        if (esp32Light) {
            esp32Light.className = 'indicator-light';
            if (status === 'connected') {
                Utils.safeAddClass(esp32Light, 'online');
            }
        }
        
        // Update connection mode
        const connectionMode = Utils.safeQuerySelector('#connection-mode');
        if (connectionMode) {
            const currentData = telemetryDataManager.getCurrentData();
            connectionMode.textContent = currentData.connection_type || 'None';
        }
    }
    
    updateUI() {
        try {
            // Update data packet count
            const currentData = telemetryDataManager.getCurrentData();
            if (currentData.packet_number) {
                const packetElement = Utils.safeQuerySelector('#data-packets');
                if (packetElement) {
                    packetElement.textContent = currentData.packet_number.toString();
                }
            }
            
            // Update signal strength
            if (currentData.signal_strength !== undefined) {
                const signalElement = Utils.safeQuerySelector('#signal-strength');
                if (signalElement) {
                    signalElement.textContent = `${currentData.signal_strength} dBm`;
                }
            }
            
            // Check data freshness
            if (!telemetryDataManager.isDataFresh()) {
                this.updateConnectionStatus('timeout');
            }
            
        } catch (error) {
            errorHandler.logError('Dashboard', 'Failed to update UI', error);
        }
    }
    
    handleWindowResize() {
        // Resize map
        this.components.flightMap?.resize();
        
        // Resize chart
        this.components.powerChart?.resize();
    }
    
    handleEmergencyStop() {
        const confirmed = confirm('⚠️ EMERGENCY STOP\n\nThis will send an emergency stop command to the UAV.\nAre you sure you want to proceed?');
        
        if (confirmed) {
            const success = connectionManager.sendCommand('EMERGENCY_STOP', true);
            
            if (success) {
                notificationManager.show('Emergency stop command sent!', 'warning');
                
                // Visual feedback
                const emergencyBtn = Utils.safeQuerySelector('#emergency-cutoff');
                if (emergencyBtn) {
                    Utils.safeAddClass(emergencyBtn, 'pulsing-red');
                    setTimeout(() => {
                        Utils.safeRemoveClass(emergencyBtn, 'pulsing-red');
                    }, 3000);
                }
            } else {
                notificationManager.show('Failed to send emergency stop command', 'error');
            }
        }
    }
    
    showTeamInfo() {
        notificationManager.show('Swarakarsa ITERA Technology Development Team - Lampaui Batas, Generasi Emas Mengudara', 'info', 8000);
    }
    
    toggleMapFullscreen() {
        const mapCard = Utils.safeQuerySelector('.flight-path-card');
        if (!mapCard) return;
        
        if (mapCard.classList.contains('fullscreen')) {
            Utils.safeRemoveClass(mapCard, 'fullscreen');
        } else {
            Utils.safeAddClass(mapCard, 'fullscreen');
        }
        
        // Resize map after transition
        setTimeout(() => {
            this.components.flightMap?.resize();
        }, 300);
    }
    
    refreshDashboard() {
        notificationManager.show('Refreshing dashboard...', 'info');
        
        // Reset telemetry data
        telemetryDataManager.reset();
        
        // Reconnect if needed
        if (!connectionManager.isConnected) {
            connectionManager.connect();
        }
    }
    
    destroy() {
        console.log('🛑 Shutting down UAV Dashboard...');
        
        // Stop updates
        this.stopPeriodicUpdates();
        
        // Disconnect from server
        connectionManager.disconnect();
        
        // Clear notifications
        notificationManager.clear();
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleWindowResize);
        
        // Reset state
        this.isInitialized = false;
        this.components = {};
        
        console.log('✅ Dashboard shutdown complete');
    }
}

// =============================================================================
// GLOBAL FUNCTIONS & EVENT HANDLERS
// =============================================================================

/**
 * Handle page visibility changes to optimize performance
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden - reduce update frequency or pause updates
        console.log('📱 Page hidden - reducing activity');
    } else {
        // Page is visible - resume normal operation
        console.log('📱 Page visible - resuming activity');
    }
});

/**
 * Handle page unload to cleanup resources
 */
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
});

/**
 * Handle online/offline events
 */
window.addEventListener('online', () => {
    notificationManager.show('Internet connection restored', 'success');
    if (window.dashboard && !connectionManager.isConnected) {
        connectionManager.connect();
    }
});

window.addEventListener('offline', () => {
    notificationManager.show('Internet connection lost', 'warning');
});

// =============================================================================
// DASHBOARD INITIALIZATION
// =============================================================================

/**
 * Initialize dashboard when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Starting Enhanced UAV Dashboard...');
        
        // Create global dashboard instance
        window.dashboard = new UAVDashboard();
        
        // Initialize dashboard
        await window.dashboard.initialize();
        
    } catch (error) {
        console.error('💥 Failed to start dashboard:', error);
        
        // Show critical error message
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #e53e3e;
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;
        errorMsg.innerHTML = `
            <h3>❌ Dashboard Initialization Failed</h3>
            <p>Please refresh the page or contact support.</p>
            <p><small>Error: ${error.message}</small></p>
        `;
        document.body.appendChild(errorMsg);
    }
});

// =============================================================================
// EXPORTS (for testing and modules)
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        UAVDashboard,
        ConnectionManager,
        TelemetryDataManager,
        FlightMap,
        PowerChart,
        Utils,
        CLIENT_CONFIG
    };
}
