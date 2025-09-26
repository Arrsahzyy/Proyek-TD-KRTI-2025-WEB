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
    /** Debounce function execution */
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    /** Format numbers with proper precision */
    static formatNumber(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) {
            return '--';
        }
        return Number(value).toFixed(decimals);
    }
    /** Calculate trend from two values */
    static calculateTrend(current, previous) {
        if (previous === undefined || current === undefined || previous === null || current === null) return 'stable';
        const diff = current - previous;
        const threshold = Math.abs(previous) * 0.01; // 1%
        if (Math.abs(diff) < threshold) return 'stable';
        return diff > 0 ? 'up' : 'down';
    }
    /** Safe element query */
    static safeQuerySelector(selector) {
        try { return document.querySelector(selector); } catch { return null; }
    }
    static safeAddClass(element, className) { if (element?.classList) element.classList.add(className); }
    static safeRemoveClass(element, className) { if (element?.classList) element.classList.remove(className); }
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
            
            // Log connection activity
            if (window.activityLogger) {
                window.activityLogger.logConnectionEvent('connected', 'Successfully connected to UAV Dashboard Server');
            }
            
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
            
            // Log disconnection activity
            if (window.activityLogger) {
                window.activityLogger.logConnectionEvent('disconnected', `Connection lost: ${reason}`);
            }
            
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
                console.log('🔥 [FRONTEND] Received telemetryUpdate:', data);
                
                // Update electrical monitoring stats IMMEDIATELY
                electricalStatsManager.updateStats(data);
                
                // IMMEDIATE CHART UPDATE - Direct call to Chart.js
                if (data && (data.battery_voltage !== undefined || data.battery_current !== undefined)) {
                    console.log('📊 [FRONTEND] Calling updateElectricalChart directly');
                    if (window.updateElectricalChart) {
                        window.updateElectricalChart(
                            parseFloat(data.battery_voltage) || 0,
                            parseFloat(data.battery_current) || 0,
                            parseFloat(data.battery_power) || 0
                        );
                    }
                    if (window.updateElectricalMonitoring) {
                        window.updateElectricalMonitoring(data);
                    }
                }
                
                if (this.onTelemetryData) {
                    this.onTelemetryData(data);
                }
                // Direct update as fallback
                this.updateTelemetryDataDirectly(data);
            } catch (error) {
                console.error('❌ [FRONTEND] Error processing telemetry data:', error);
                errorHandler.logError('Connection', 'Error processing telemetry data', error);
            }
        });
        
        // Backward compatibility
        this.socket.on('telemetryData', (data) => {
            try {
                console.log('🔥 [FRONTEND] Received telemetryData (legacy):', data);
                
                // Update electrical monitoring stats IMMEDIATELY (legacy path)
                electricalStatsManager.updateStats(data);
                
                // IMMEDIATE CHART UPDATE - Direct call to Chart.js (legacy path)
                if (data && (data.battery_voltage !== undefined || data.battery_current !== undefined)) {
                    console.log('📊 [FRONTEND-LEGACY] Calling updateElectricalChart directly');
                    if (window.updateElectricalChart) {
                        window.updateElectricalChart(
                            parseFloat(data.battery_voltage) || 0,
                            parseFloat(data.battery_current) || 0,
                            parseFloat(data.battery_power) || 0
                        );
                    }
                    if (window.updateElectricalMonitoring) {
                        window.updateElectricalMonitoring(data);
                    }
                }
                
                if (this.onTelemetryData) {
                    this.onTelemetryData(data);
                }
                // Direct update as fallback
                this.updateTelemetryDataDirectly(data);
            } catch (error) {
                console.error('❌ [FRONTEND] Error processing legacy telemetry data:', error);
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
            console.log('🤖 ESP32 Status:', status);
            this.updateESP32Status(status);
        });
        
        // ESP32 command responses
        this.socket.on('esp32CommandResponse', (response) => {
            console.log('📨 ESP32 Command Response:', response);
            this.handleESP32Response(response);
        });
        
        // ESP32 system status
        this.socket.on('esp32SystemStatus', (systemStatus) => {
            console.log('📊 ESP32 System Status:', systemStatus);
            this.updateESP32SystemStatus(systemStatus);
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
    
    sendCommand(command, value = null, action = null) {
        if (!this.socket || !this.isConnected) {
            notificationManager.show('Not connected to server', 'warning');
            return false;
        }
        
        try {
            const commandData = {
                command: command,
                value: value,
                action: action,
                timestamp: Date.now()
            };
            
            this.socket.emit('relayCommand', commandData);
            
            logger.info('Command', 'Command sent to ESP32', commandData);
            return true;
        } catch (error) {
            errorHandler.logError('Command', 'Failed to send command', error);
            return false;
        }
    }
    
    sendEmergencyCommand(action = 'emergency_off') {
        if (!this.socket || !this.isConnected) {
            notificationManager.show('❌ Cannot send emergency command - Not connected to server!', 'error');
            return false;
        }
        
        try {
            const emergencyData = {
                command: 'emergency',
                action: action,
                urgent: true,
                timestamp: Date.now(),
                source: 'WEB_DASHBOARD'
            };
            
            // Send via multiple channels for reliability
            this.socket.emit('emergencyCommand', emergencyData);
            this.socket.emit('relayCommand', emergencyData);
            
            logger.warn('Emergency', 'Emergency command sent', emergencyData);
            notificationManager.show('🚨 Emergency command sent to ESP32!', 'warning');
            
            return true;
        } catch (error) {
            errorHandler.logError('Emergency', 'Failed to send emergency command', error);
            notificationManager.show('❌ Failed to send emergency command!', 'error');
            return false;
        }
    }
    
    updateESP32Status(status) {
        try {
            const esp32Indicator = Utils.safeQuerySelector('#esp32-indicator');
            const esp32Light = Utils.safeQuerySelector('#esp32-light');
            
            if (esp32Indicator && esp32Light) {
                Utils.safeRemoveClass(esp32Light, 'connected');
                Utils.safeRemoveClass(esp32Light, 'disconnected');
                Utils.safeRemoveClass(esp32Light, 'timeout');
                
                switch(status.status) {
                    case 'connected':
                        Utils.safeAddClass(esp32Light, 'connected');
                        notificationManager.show('✅ ESP32 Connected', 'success');
                        break;
                    case 'disconnected':
                        Utils.safeAddClass(esp32Light, 'disconnected');
                        notificationManager.show('❌ ESP32 Disconnected', 'warning');
                        break;
                    case 'timeout':
                        Utils.safeAddClass(esp32Light, 'timeout');
                        notificationManager.show('⏰ ESP32 Connection Timeout', 'warning');
                        break;
                }
            }
            
            // Log ESP32 connection activity
            if (window.activityLogger) {
                window.activityLogger.logSystemEvent('esp32_status', `ESP32 ${status.status}`, status);
            }
            
        } catch (error) {
            errorHandler.logError('ESP32', 'Error updating ESP32 status', error);
        }
    }
    
    handleESP32Response(response) {
        try {
            // Show response to user
            const statusText = response.status === 'success' ? '✅' : '❌';
            const messageType = response.status === 'success' ? 'success' : 'error';
            
            notificationManager.show(
                `${statusText} ESP32: ${response.message}`, 
                messageType
            );
            
            // Special handling for emergency responses
            if (response.command === 'emergency_relay') {
                logger.warn('Emergency', 'Emergency relay response', response);
                
                if (response.status === 'success') {
                    notificationManager.show('🚨 Emergency relay activated successfully!', 'success');
                } else {
                    notificationManager.show('❌ Emergency relay activation failed!', 'error');
                }
            }
            
            // Log activity
            if (window.activityLogger) {
                window.activityLogger.logSystemEvent('esp32_response', response.message, response);
            }
            
        } catch (error) {
            errorHandler.logError('ESP32', 'Error handling ESP32 response', error);
        }
    }
    
    updateESP32SystemStatus(systemStatus) {
        try {
            // Update system status display if exists
            const statusElement = Utils.safeQuerySelector('#esp32-system-status');
            if (statusElement) {
                statusElement.innerHTML = `
                    <div class="esp32-status-item">
                        <span>WiFi: ${systemStatus.wifiConnected ? '✅' : '❌'}</span>
                    </div>
                    <div class="esp32-status-item">
                        <span>WebSocket: ${systemStatus.websocketConnected ? '✅' : '❌'}</span>
                    </div>
                    <div class="esp32-status-item">
                        <span>Relay: ${systemStatus.relayState}</span>
                    </div>
                    <div class="esp32-status-item">
                        <span>Signal: ${systemStatus.signalStrength} dBm</span>
                    </div>
                    <div class="esp32-status-item">
                        <span>Uptime: ${Math.floor(systemStatus.uptime / 1000)}s</span>
                    </div>
                `;
            }
            
            // Log system status
            if (window.activityLogger) {
                window.activityLogger.logSystemEvent('esp32_system_status', 'ESP32 system status updated', systemStatus);
            }
            
        } catch (error) {
            errorHandler.logError('ESP32', 'Error updating ESP32 system status', error);
        }
    }
    
    updateTelemetryDataDirectly(data) {
        console.log('🔥 [DIRECT UPDATE] Attempting direct DOM update with data:', data);
        try {
            // Update DOM elements with mapping
            const map = {
                battery_voltage: 'voltage-value',
                battery_current: 'current-value',
                battery_power: 'power-value',
                speed: 'speed-value',
                gps_latitude: 'latitude-value',
                gps_longitude: 'longitude-value'
            };
            
            Object.entries(map).forEach(([key, id]) => {
                if (data[key] !== undefined) {
                    const el = document.getElementById(id);
                    if (el) {
                        let unit = '';
                        switch (key) {
                            case 'battery_voltage': unit = ' V'; break;
                            case 'battery_current': unit = ' A'; break;
                            case 'battery_power': unit = ' W'; break;
                            case 'speed': unit = ' km/h'; break;
                            case 'gps_latitude': unit = '°'; break;
                            case 'gps_longitude': unit = '°'; break;
                        }
                        const decimals = (key === 'gps_latitude' || key === 'gps_longitude') ? 6 : (key === 'speed' ? 1 : 2);
                        el.textContent = parseFloat(data[key]).toFixed(decimals) + unit;
                        el.classList.add('updating');
                        setTimeout(() => el.classList.remove('updating'), 400);
                    }
                }
            });
            
            // Update additional elements
            const altEl = document.getElementById('altitude-value');
            if (altEl && data.altitude !== undefined) {
                altEl.textContent = parseFloat(data.altitude).toFixed(1) + ' m';
            }
            const sigEl = document.getElementById('signal-strength');
            if (sigEl && data.signal_strength !== undefined) {
                sigEl.textContent = data.signal_strength + ' dBm';
            }
            const tempEl = document.getElementById('temperature-value');
            if (tempEl && data.temperature !== undefined) {
                tempEl.textContent = parseFloat(data.temperature).toFixed(1) + ' °C';
            }
            
            // ⚡ DIRECT CHART UPDATE - Ensure electrical monitoring gets the data
            if (window.updateElectricalMonitoring) {
                console.log('📊 [DIRECT] Calling updateElectricalMonitoring');
                window.updateElectricalMonitoring(data);
            } else if (window.updateElectricalChart) {
                console.log('⚡ [DIRECT] Calling updateElectricalChart');
                window.updateElectricalChart(
                    parseFloat(data.battery_voltage) || 0,
                    parseFloat(data.battery_current) || 0,
                    parseFloat(data.battery_power) || 0
                );
            }
            
            // ⚡ UPDATE ELECTRICAL STATS - Ensure statistical display gets updated
            electricalStatsManager.updateStats(data);
            
            console.log('✅ [DIRECT UPDATE] DOM update completed (mapped IDs)');
        } catch (error) {
            console.error('❌ [DIRECT UPDATE] Error during direct DOM update:', error);
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
// ELECTRICAL MONITORING STATS MANAGER
// =============================================================================
class ElectricalStatsManager {
    constructor() {
        this.history = [];
        this.maxHistorySize = 50; // Keep last 50 readings for average calculation
        this.lastUpdate = 0;
        this.isInitialized = false;
        this.updateInProgress = false;
        
        // Initialize with default values to prevent empty display
        this.initializeDisplay();
    }
    
    initializeDisplay() {
        console.log('🔌 [ELECTRICAL STATS] Initializing display with default values');
        
        // Set initial values to prevent empty display
        const avgVoltageEl = document.getElementById('avg-voltage');
        const avgCurrentEl = document.getElementById('avg-current');
        const avgPowerEl = document.getElementById('avg-power');
        const statusEl = document.getElementById('electric-status');
        
        if (avgVoltageEl) avgVoltageEl.textContent = '-- V';
        if (avgCurrentEl) avgCurrentEl.textContent = '-- A';
        if (avgPowerEl) avgPowerEl.textContent = '-- W';
        if (statusEl) statusEl.textContent = 'Waiting...';
        
        this.isInitialized = true;
        console.log('✅ [ELECTRICAL STATS] Display initialized');
    }
    
    updateStats(telemetryData) {
        // Prevent concurrent updates
        if (this.updateInProgress) {
            console.log('⚠️ [ELECTRICAL STATS] Update in progress, skipping...');
            return;
        }
        
        this.updateInProgress = true;
        
        try {
            if (!telemetryData) {
                console.log('⚠️ [ELECTRICAL STATS] No telemetry data provided');
                return;
            }
            
            const voltage = parseFloat(telemetryData.battery_voltage) || 0;
            const current = parseFloat(telemetryData.battery_current) || 0;
            const power = parseFloat(telemetryData.battery_power) || 0;
            
            // Validate data - skip if all zeros (invalid reading)
            if (voltage === 0 && current === 0 && power === 0) {
                console.log('⚠️ [ELECTRICAL STATS] All values are zero, skipping update');
                return;
            }
            
            console.log('🔌 [ELECTRICAL STATS] Updating with valid data:', { voltage, current, power });
            
            // Add to history for average calculation
            this.addToHistory({ voltage, current, power, timestamp: Date.now() });
            
            // Calculate averages
            const avgVoltage = this.calculateAverage('voltage');
            const avgCurrent = this.calculateAverage('current');
            const avgPower = this.calculateAverage('power');
            
            console.log('🔌 [ELECTRICAL STATS] Calculated averages:', { avgVoltage, avgCurrent, avgPower });
            
            // Update DOM elements with protection against overwrites
            this.updateStatsDisplay(avgVoltage, avgCurrent, avgPower, voltage);
            
            this.lastUpdate = Date.now();
            
        } catch (error) {
            console.error('❌ [ELECTRICAL STATS] Error updating stats:', error);
        } finally {
            this.updateInProgress = false;
        }
    }
    
    addToHistory(data) {
        this.history.push(data);
        
        // Keep history size under control
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }
    
    calculateAverage(field) {
        if (this.history.length === 0) return 0;
        
        const validValues = this.history
            .map(item => item[field])
            .filter(value => !isNaN(value) && value !== null && value !== undefined && value > 0);
            
        if (validValues.length === 0) return 0;
        
        const sum = validValues.reduce((acc, val) => acc + val, 0);
        return sum / validValues.length;
    }
    
    updateStatsDisplay(avgVoltage, avgCurrent, avgPower, currentVoltage) {
        // Immediate DOM update with error protection
        try {
            // Update average voltage
            const avgVoltageEl = document.getElementById('avg-voltage');
            if (avgVoltageEl) {
                const newValue = `${avgVoltage.toFixed(2)} V`;
                avgVoltageEl.textContent = newValue;
                console.log('🔌 [ELECTRICAL STATS] Updated avg-voltage:', newValue);
            } else {
                console.warn('⚠️ [ELECTRICAL STATS] avg-voltage element not found');
            }
            
            // Update average current
            const avgCurrentEl = document.getElementById('avg-current');
            if (avgCurrentEl) {
                const newValue = `${avgCurrent.toFixed(2)} A`;
                avgCurrentEl.textContent = newValue;
                console.log('🔌 [ELECTRICAL STATS] Updated avg-current:', newValue);
            } else {
                console.warn('⚠️ [ELECTRICAL STATS] avg-current element not found');
            }
            
            // Update average power
            const avgPowerEl = document.getElementById('avg-power');
            if (avgPowerEl) {
                const newValue = `${avgPower.toFixed(2)} W`;
                avgPowerEl.textContent = newValue;
                console.log('🔌 [ELECTRICAL STATS] Updated avg-power:', newValue);
            } else {
                console.warn('⚠️ [ELECTRICAL STATS] avg-power element not found');
            }
            
            // Update electrical status based on current voltage
            const statusEl = document.getElementById('electric-status');
            if (statusEl) {
                let status = 'Normal';
                
                if (currentVoltage < 10.5) {
                    status = 'Voltage Drop';
                } else if (currentVoltage > 13.5) {
                    status = 'Overvoltage';
                } else if (avgCurrent > 15) {
                    status = 'Overcurrent';
                } else if (avgPower > 180) {
                    status = 'Overpower';
                }
                
                statusEl.textContent = status;
                console.log('🔌 [ELECTRICAL STATS] Updated electric-status:', status);
            } else {
                console.warn('⚠️ [ELECTRICAL STATS] electric-status element not found');
            }
            
            console.log('✅ [ELECTRICAL STATS] Display update completed successfully');
            
        } catch (error) {
            console.error('❌ [ELECTRICAL STATS] Error updating display:', error);
        }
    }
    
    // Protective method to ensure stats remain visible
    protectDisplay() {
        const elements = [
            { id: 'avg-voltage', defaultValue: '-- V' },
            { id: 'avg-current', defaultValue: '-- A' },
            { id: 'avg-power', defaultValue: '-- W' },
            { id: 'electric-status', defaultValue: 'No Data' }
        ];
        
        elements.forEach(({ id, defaultValue }) => {
            const el = document.getElementById(id);
            if (el && (el.textContent === '' || el.textContent === '0 V' || el.textContent === '0 A' || el.textContent === '0 W')) {
                console.log(`🛡️ [ELECTRICAL STATS] Protecting ${id} from empty value`);
                if (this.history.length > 0) {
                    // Recalculate and update
                    this.updateStats(this.history[this.history.length - 1]);
                } else {
                    el.textContent = defaultValue;
                }
            }
        });
    }
    
    reset() {
        this.history = [];
        this.lastUpdate = 0;
        
        // Reset display to default values
        console.log('🔄 [ELECTRICAL STATS] Resetting stats');
        this.initializeDisplay();
    }
}

// =============================================================================
// INITIALIZE GLOBAL INSTANCES
// =============================================================================
const errorHandler = new ErrorHandler();
const notificationManager = new NotificationManager();
const connectionManager = new ConnectionManager();
const telemetryDataManager = new TelemetryDataManager();
const electricalStatsManager = new ElectricalStatsManager();

// Protective interval for electrical stats consistency
setInterval(() => {
    if (electricalStatsManager) {
        electricalStatsManager.protectDisplay();
    }
}, 3000); // Check every 3 seconds to prevent data disappearing

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
            
            // Check if Leaflet is loaded
            if (typeof L === 'undefined') {
                throw new Error('Leaflet library not loaded');
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
            // Tampilkan ikon UAV awal pada posisi default
            const [defLat, defLng] = CLIENT_CONFIG.MAP.DEFAULT_CENTER;
            this.updateUAVPosition(defLat, defLng);
            
        } catch (error) {
            console.error('❌ Map initialization failed:', error);
            errorHandler.logError('Map', 'Failed to initialize flight map', error);
            
            // Create fallback message
            if (this.container) {
                this.container.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9FB4D0; background: #0F2747;">
                        <div style="text-align: center;">
                            <i class="fas fa-map" style="font-size: 48px; margin-bottom: 15px; color: #E6C70E;"></i>
                            <div style="font-size: 18px; margin-bottom: 5px;">Map unavailable</div>
                            <small>Check network connection</small>
                        </div>
                    </div>
                `;
            }
            
            // Don't throw error, allow dashboard to continue
            this.isInitialized = false;
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
                                        html: `<div class="uav-icon-container" style="display:flex !important; visibility:visible !important; opacity:1 !important; align-items:center; justify-content:center;">
                                                         <i class="fas fa-plane uav-icon" style="display:block !important; visibility:visible !important; opacity:1 !important; font-size:20px !important; color:#ffffff !important; text-shadow:0 0 6px rgba(0,0,0,0.9);"></i>
                                                         <div class="uav-pulse"></div>
                                                     </div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });
                
                this.uavMarker = L.marker(position, { 
                    icon: uavIcon,
                    title: 'UAV Position',
                    zIndexOffset: 1000
                }).addTo(this.map);
                
                // Debug log to check if marker is created
                console.log('UAV marker created at position:', position);
                
                // Force marker to be visible
                if (this.uavMarker._icon) {
                    this.uavMarker._icon.style.display = 'block';
                    this.uavMarker._icon.style.visibility = 'visible';
                    this.uavMarker._icon.style.opacity = '1';
                    this.uavMarker._icon.style.zIndex = '1000';
                }
                        } else {
                this.uavMarker.setLatLng(position);
                
                // Ensure visibility is maintained on position update
                if (this.uavMarker._icon) {
                    this.uavMarker._icon.style.display = 'block';
                    this.uavMarker._icon.style.visibility = 'visible';
                    this.uavMarker._icon.style.opacity = '1';
                                        // Perbarui innerHTML jika kosong (misal terhapus oleh leaflet re-render)
                                        if (!this.uavMarker._icon.innerHTML || this.uavMarker._icon.innerHTML.trim() === '') {
                                                this.uavMarker._icon.innerHTML = `<div class="uav-icon-container" style="display:flex !important; visibility:visible !important; opacity:1 !important; align-items:center; justify-content:center;">
                                         <i class=\"fas fa-plane uav-icon\" style=\"display:block !important; visibility:visible !important; opacity:1 !important; font-size:20px !important; color:#ffffff !important; text-shadow:0 0 6px rgba(0,0,0,0.9);\"></i>
                                                         <div class=\"uav-pulse\"></div>
                                                     </div>`;
                                        }
                }
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
                color: '#E6C70E',
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
            if (window.activityLogger) {
                window.activityLogger.logMapInteraction('Zoom In', { zoom: this.map.getZoom() });
            }
        }
    }
    
    zoomOut() {
        if (this.map) {
            this.map.zoomOut();
            if (window.activityLogger) {
                window.activityLogger.logMapInteraction('Zoom Out', { zoom: this.map.getZoom() });
            }
        }
    }
    
    centerOnUAV() {
        if (this.map && this.uavMarker) {
            this.map.setView(this.uavMarker.getLatLng(), this.map.getZoom());
            if (window.activityLogger) {
                window.activityLogger.logMapInteraction('Center on UAV', { position: this.uavMarker.getLatLng() });
            }
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
 * Power Chart Component - Chart.js Integration Only
 * Canvas implementation removed to avoid conflicts
 */
class PowerChart {
    constructor() {
        this.isInitialized = false;
        console.log('⚡ PowerChart using Chart.js integration mode');
    }
    
    async initialize() {
        // Hanya menggunakan Chart.js - tidak perlu canvas implementation
        this.isInitialized = true;
        console.log('✅ PowerChart initialized with Chart.js integration');
    }
    
    updateData(telemetryData) {
        // Update Chart.js melalui window.updateElectricalChart
        if (telemetryData && window.updateElectricalChart) {
            const voltage = parseFloat(telemetryData.battery_voltage) || 0;
            const current = parseFloat(telemetryData.battery_current) || 0;
            const power = parseFloat(telemetryData.battery_power) || 0;
            
            console.log('⚡ PowerChart updating Chart.js with:', { voltage, current, power });
            window.updateElectricalChart(voltage, current, power);
        }
    }
    
    resize() {
        // Chart.js handles resize automatically
        console.log('⚡ PowerChart resize - Chart.js handles this automatically');
    }
    
    destroy() {
        this.isInitialized = false;
        console.log('✅ PowerChart destroyed (Chart.js mode)');
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
            // Update electrical monitoring stats FIRST
            electricalStatsManager.updateStats(telemetryData);
            
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
            console.log('🔥 handleTelemetryData received:', data);
            
            // Update telemetry data manager
            const success = telemetryDataManager.updateTelemetry(data);
            
            if (success) {
                // PRIORITY: Update electrical stats manager first
                if (electricalStatsManager) {
                    console.log('🔌 Updating electrical stats manager with telemetry data');
                    electricalStatsManager.updateStats(data);
                }
                
                // Update chart - PowerChart class now integrates with Chart.js
                this.components.powerChart?.updateData(data);
                
                // Direct update to Chart.js electrical monitoring (DISABLED TO PREVENT CONFLICTS)
                // if (window.updateElectricalMonitoring) {
                //     console.log('📊 Updating electrical monitoring chart');
                //     window.updateElectricalMonitoring(data);
                // } else if (window.updateElectricalChart) {
                //     console.log('⚡ Updating electrical chart via legacy method');
                //     window.updateElectricalChart(
                //         parseFloat(data.battery_voltage) || 0,
                //         parseFloat(data.battery_current) || 0, 
                //         parseFloat(data.battery_power) || 0
                //     );
                // }
                
                // Dispatch custom event for Chart.js
                window.dispatchEvent(new CustomEvent('telemetryUpdate', { 
                    detail: data 
                }));
                
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
            console.error('❌ Failed to handle telemetry data:', error);
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
        // Show emergency confirmation modal instead of simple confirm
        const modal = Utils.safeQuerySelector('#emergency-modal');
        if (!modal) {
            // Fallback to simple confirm if modal not found
            this.performEmergencyStopConfirm();
            return;
        }
        
        // Show modal
        modal.style.display = 'flex';
        
        // Start countdown
        this.startEmergencyCountdown();
        
        // Add event listeners for modal buttons
        const confirmBtn = modal.querySelector('#emergency-confirm');
        const cancelBtn = modal.querySelector('#emergency-cancel');
        
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                this.executeEmergencyStop();
                this.hideEmergencyModal();
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                this.hideEmergencyModal();
            };
        }
    }
    
    performEmergencyStopConfirm() {
        const confirmed = confirm('🚨 EMERGENCY RELAY CUTOFF\n\nThis will activate the emergency relay to cut power to the UAV system.\nThis action cannot be undone remotely.\n\nAre you absolutely sure you want to proceed?');
        
        if (confirmed) {
            this.executeEmergencyStop();
        }
    }
    
    executeEmergencyStop() {
        console.log('🚨 EXECUTING EMERGENCY STOP');
        
        // Send emergency command via connection manager
        const success = connectionManager.sendEmergencyCommand('emergency_off');
        
        if (success) {
            // Visual feedback
            const emergencyBtn = Utils.safeQuerySelector('#emergency-cutoff');
            if (emergencyBtn) {
                Utils.safeAddClass(emergencyBtn, 'pulsing-red');
                emergencyBtn.style.backgroundColor = '#ff0000';
                emergencyBtn.innerHTML = `
                    <div class="emergency-icon">
                        <i class="fas fa-power-off"></i>
                    </div>
                    <div class="emergency-text">
                        RELAY<br>
                        <small>ACTIVATED</small>
                    </div>
                `;
                
                // Keep visual state for 10 seconds
                setTimeout(() => {
                    Utils.safeRemoveClass(emergencyBtn, 'pulsing-red');
                    emergencyBtn.style.backgroundColor = '';
                    emergencyBtn.innerHTML = `
                        <div class="emergency-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="emergency-text">
                            EMERGENCY<br>
                            <small>CUTOFF</small>
                        </div>
                    `;
                }, 10000);
            }
            
            // Log activity
            if (window.activityLogger) {
                window.activityLogger.logSystemEvent('emergency_stop', 'Emergency relay cutoff activated from dashboard');
            }
            
        } else {
            notificationManager.show('❌ Failed to send emergency stop command - Check connection!', 'error');
        }
    }
    
    startEmergencyCountdown() {
        const countdownElement = Utils.safeQuerySelector('#emergency-countdown');
        if (!countdownElement) return;
        
        let countdown = 10;
        countdownElement.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdownElement) {
                countdownElement.textContent = countdown;
            }
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                // Auto-cancel if not confirmed
                this.hideEmergencyModal();
            }
        }, 1000);
        
        // Store interval for cleanup
        this.emergencyCountdownInterval = countdownInterval;
    }
    
    hideEmergencyModal() {
        const modal = Utils.safeQuerySelector('#emergency-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Clear countdown interval
        if (this.emergencyCountdownInterval) {
            clearInterval(this.emergencyCountdownInterval);
            this.emergencyCountdownInterval = null;
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
 * Demo Data Generator for Testing
 */
class DemoDataGenerator {
    constructor() {
        this.isRunning = false;
        this.interval = null;
        this.baseValues = {
            voltage: 11.8,
            current: 7.5,
            power: 88.5
        };
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('Starting demo data generator...');
        
        this.interval = setInterval(() => {
            // Generate realistic varying data for UAV
            const voltage = this.baseValues.voltage + (Math.random() - 0.5) * 0.8;
            const current = this.baseValues.current + (Math.random() - 0.5) * 3.0;
            const power = voltage * current;
            
            const demoData = {
                battery_voltage: Math.max(10.0, Math.min(13.2, voltage)),
                battery_current: Math.max(2.0, Math.min(15.0, current)),
                battery_power: Math.max(20.0, Math.min(180.0, power)),
                timestamp: Date.now()
            };
            
            // Send to telemetry manager
            if (window.telemetryDataManager && window.dashboard) {
                telemetryDataManager.updateTelemetry(demoData);
                
                // Update electrical monitoring stats
                electricalStatsManager.updateStats(demoData);
                
                // Update dashboard components
                if (window.dashboard.components.powerChart) {
                    window.dashboard.components.powerChart.updateData(demoData);
                }
                if (window.dashboard.components.batteryMonitor) {
                    window.dashboard.components.batteryMonitor.updateData(demoData);
                }
                if (window.dashboard.components.telemetryDisplay) {
                    window.dashboard.components.telemetryDisplay.updateDisplay(demoData);
                }
                
                // Update telemetry data cards directly
                const voltageEl = document.getElementById('voltage');
                const currentEl = document.getElementById('current');
                const powerEl = document.getElementById('power');
                
                if (voltageEl) voltageEl.textContent = `${demoData.battery_voltage.toFixed(1)} V`;
                if (currentEl) currentEl.textContent = `${demoData.battery_current.toFixed(1)} A`;
                if (powerEl) powerEl.textContent = `${demoData.battery_power.toFixed(1)} W`;
                
                // Update chart di index.html jika ada
                if (window.updateElectricalChart) {
                    window.updateElectricalChart(
                        demoData.battery_voltage, 
                        demoData.battery_current, 
                        demoData.battery_power
                    );
                }
            }
        }, 2000); // Update every 2 seconds
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        console.log('Demo data generator stopped');
    }
}

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
            background: #EF4444;
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
// DEMO DATA FOR TESTING
// =============================================================================
window.demoDataGenerator = new DemoDataGenerator();

// Start demo data if no real connection after 10 seconds
setTimeout(() => {
    if (!connectionManager.isConnected) {
        console.log('No real connection detected, starting demo data...');
        window.demoDataGenerator.start();
        
        // Also add demo UAV position for map testing
        if (window.dashboard && window.dashboard.components.flightMap) {
            const basePos = CLIENT_CONFIG.MAP.DEFAULT_CENTER;
            let offsetLat = 0;
            let offsetLng = 0;
            
            setInterval(() => {
                offsetLat += (Math.random() - 0.5) * 0.0001;
                offsetLng += (Math.random() - 0.5) * 0.0001;
                
                const demoPos = [
                    basePos[0] + offsetLat,
                    basePos[1] + offsetLng
                ];
                
                window.dashboard.components.flightMap.updateUAVPosition(demoPos[0], demoPos[1]);
            }, 3000);
        }
    }
}, 10000);

// =============================================================================
// CONTROL PANEL INTEGRATION FUNCTIONS
// =============================================================================

/**
 * Send emergency cut off command to ESP32
 * This function is called by the Control Panel emergency system
 */
async function sendEmergencyCutOff() {
    try {
        console.log('[EMERGENCY] Sending emergency cut off command to ESP32...');
        
        // Check if connection manager is available
        if (window.dashboard && window.dashboard.connectionManager) {
            // Send command through existing connection manager
            const response = await window.dashboard.connectionManager.sendEmergencyCommand('emergency_off');
            
            return {
                ok: response.success || false,
                message: response.message || 'Emergency command sent to ESP32'
            };
        } else {
            // Fallback HTTP request
            const response = await fetch('/api/command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: 'emergency_cutoff',
                    action: 'emergency_off',
                    priority: 'high',
                    timestamp: Date.now()
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                return {
                    ok: true,
                    message: result.message || 'Emergency cut off command executed successfully'
                };
            } else {
                return {
                    ok: false,
                    message: `Server error: ${response.status} ${response.statusText}`
                };
            }
        }
    } catch (error) {
        console.error('[EMERGENCY] Failed to send emergency command:', error);
        return {
            ok: false,
            message: `Network error: ${error.message}`
        };
    }
}

/**
 * Reload system after emergency cut off
 * This function is called when user clicks "Muat Ulang Sistem"
 */
function reloadSystem() {
    console.log('[SYSTEM] Reloading UAV Dashboard system...');
    
    try {
        // Show loading notification
        if (window.controlPanel) {
            window.controlPanel.showToast('Memuat ulang sistem...', 'info', 2000);
        }
        
        // Reset dashboard state if available
        if (window.dashboard) {
            // Reset emergency state
            if (window.dashboard.emergency) {
                window.dashboard.emergency.reset();
            }
            
            // Reset telemetry data
            if (window.dashboard.telemetryDataManager) {
                window.dashboard.telemetryDataManager.reset();
            }
            
            // Restart connections
            if (window.dashboard.connectionManager) {
                window.dashboard.connectionManager.disconnect();
                setTimeout(() => {
                    window.dashboard.connectionManager.connect();
                }, 1000);
            }
        }
        
        // Reset control panel state
        if (window.controlPanel) {
            window.controlPanel.state.setState('idle');
            
            // Re-enable emergency button
            const emergencyBtn = document.getElementById('btnEmergencyCutOff');
            const emergencyStatus = document.getElementById('emergencyStatus');
            
            if (emergencyBtn) {
                emergencyBtn.disabled = false;
                emergencyBtn.classList.remove('disabled');
                emergencyBtn.title = '';
            }
            
            if (emergencyStatus) {
                emergencyStatus.style.display = 'none';
            }
        }
        
        // Success notification after delay
        setTimeout(() => {
            if (window.controlPanel) {
                window.controlPanel.showToast('Sistem berhasil dimuat ulang', 'success');
            }
            console.log('[SYSTEM] System reload completed successfully');
        }, 1500);
        
    } catch (error) {
        console.error('[SYSTEM] Failed to reload system:', error);
        
        if (window.controlPanel) {
            window.controlPanel.showToast('Gagal memuat ulang sistem', 'error');
        }
        
        // Fallback: full page reload
        setTimeout(() => {
            location.reload();
        }, 2000);
    }
}

// Make functions globally available
window.sendEmergencyCutOff = sendEmergencyCutOff;
window.reloadSystem = reloadSystem;

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
        CLIENT_CONFIG,
        DemoDataGenerator,
        sendEmergencyCutOff,
        reloadSystem
    };
}
