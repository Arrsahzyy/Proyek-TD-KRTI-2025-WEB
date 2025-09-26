/**
 * Control Panel Interactive System
 * 
 * Features:
 * - Emergency Cut Off confirmation and execution
 * - Team Info panel with slide animation
 * - Toast notification system
 * - State machine management
 * - Focus trap and accessibility support
 * 
 * @author Swarnakasa ITERA Team
 * @version 1.0.0
 */

// =============================================================================
// GLOBAL STATE MANAGEMENT
// =============================================================================
class ControlPanelState {
    constructor() {
        this.systemStatus = 'idle'; // idle, confirming, executing, success, error
        this.isEmergencyActive = false;
        this.isTeamPanelOpen = false;
        this.listeners = new Map();
        
        // Emergency execution tracking
        this.emergencyTimeout = null;
        this.emergencyStartTime = null;
    }
    
    setState(newStatus) {
        const oldStatus = this.systemStatus;
        this.systemStatus = newStatus;
        console.log(`[CONTROL-PANEL] State changed: ${oldStatus} → ${newStatus}`);
        
        // Trigger state change listeners
        if (this.listeners.has(newStatus)) {
            this.listeners.get(newStatus).forEach(callback => callback(newStatus, oldStatus));
        }
    }
    
    addStateListener(state, callback) {
        if (!this.listeners.has(state)) {
            this.listeners.set(state, []);
        }
        this.listeners.get(state).push(callback);
    }
    
    isSystemBusy() {
        return ['confirming', 'executing'].includes(this.systemStatus);
    }
}

// =============================================================================
// TOAST NOTIFICATION SYSTEM
// =============================================================================
class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.init();
    }
    
    init() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            console.error('[TOAST] Toast container not found');
            return;
        }
    }
    
    show(message, type = 'info', duration = 3000) {
        if (!this.container) {
            console.warn('[TOAST] Toast container not available');
            return;
        }
        
        const toast = this.createToast(message, type);
        this.container.appendChild(toast);
        this.toasts.push(toast);
        
        // Trigger show animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto-remove
        setTimeout(() => this.removeToast(toast), duration);
        
        return toast;
    }
    
    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getIconForType(type);
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icon}"></i>
            </div>
            <div class="toast-content">
                <p class="toast-message">${message}</p>
            </div>
            <button class="toast-close" aria-label="Tutup notifikasi">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.removeToast(toast));
        
        // Add swipe-to-dismiss (basic version)
        let startX = 0;
        toast.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });
        
        toast.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const diff = startX - endX;
            
            if (Math.abs(diff) > 100) { // 100px swipe threshold
                this.removeToast(toast);
            }
        });
        
        return toast;
    }
    
    getIconForType(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-triangle'
        };
        return icons[type] || icons.info;
    }
    
    removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        
        toast.classList.remove('show');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }
    
    clear() {
        this.toasts.forEach(toast => this.removeToast(toast));
    }
}

// =============================================================================
// FOCUS TRAP UTILITY
// =============================================================================
class FocusTrap {
    constructor(element) {
        this.element = element;
        this.focusableElements = [];
        this.firstFocusable = null;
        this.lastFocusable = null;
        this.previousFocus = null;
    }
    
    activate() {
        this.previousFocus = document.activeElement;
        this.updateFocusableElements();
        
        if (this.firstFocusable) {
            this.firstFocusable.focus();
        }
        
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    deactivate() {
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        
        if (this.previousFocus) {
            this.previousFocus.focus();
        }
    }
    
    updateFocusableElements() {
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');
        
        this.focusableElements = Array.from(this.element.querySelectorAll(focusableSelectors));
        this.firstFocusable = this.focusableElements[0];
        this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];
    }
    
    handleKeyDown(event) {
        if (event.key !== 'Tab') return;
        
        if (event.shiftKey) {
            // Shift + Tab
            if (document.activeElement === this.firstFocusable) {
                event.preventDefault();
                this.lastFocusable?.focus();
            }
        } else {
            // Tab
            if (document.activeElement === this.lastFocusable) {
                event.preventDefault();
                this.firstFocusable?.focus();
            }
        }
    }
}

// =============================================================================
// EMERGENCY CUT OFF SYSTEM
// =============================================================================
class EmergencyCutOffManager {
    constructor(state, toastManager) {
        this.state = state;
        this.toast = toastManager;
        this.focusTrap = null;
        
        // Modal elements
        this.confirmModal = null;
        this.processModal = null;
        this.btnEmergency = null;
        this.emergencyStatus = null;
        
        this.init();
    }
    
    init() {
        // Get DOM elements
        this.confirmModal = document.getElementById('emergencyConfirmModal');
        this.processModal = document.getElementById('emergencyProcessModal');
        this.btnEmergency = document.getElementById('btnEmergencyCutOff');
        this.emergencyStatus = document.getElementById('emergencyStatus');
        
        if (!this.confirmModal || !this.processModal || !this.btnEmergency) {
            console.error('[EMERGENCY] Required elements not found');
            return;
        }
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        console.log('[EMERGENCY] Setting up event listeners...');
        console.log('[EMERGENCY] Emergency button element:', this.btnEmergency);
        
        // Emergency button click with immediate feedback
        this.btnEmergency.addEventListener('click', (event) => {
            console.log('[EMERGENCY] Button click event fired!', event);
            event.preventDefault();
            event.stopPropagation();
            this.handleEmergencyClick();
        });
        
        // Add immediate visual feedback for debugging
        this.btnEmergency.addEventListener('mousedown', () => {
            console.log('[EMERGENCY] Mouse down on emergency button');
            this.btnEmergency.style.transform = 'scale(0.95)';
        });
        
        this.btnEmergency.addEventListener('mouseup', () => {
            console.log('[EMERGENCY] Mouse up on emergency button');
            this.btnEmergency.style.transform = 'scale(1)';
        });
        
        // Confirm modal buttons
        const cancelBtn = this.confirmModal.querySelector('#emergencyCancel');
        const confirmBtn = this.confirmModal.querySelector('#emergencyConfirm');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelEmergency());
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.executeEmergency());
        }
        
        // ESC key handling
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (this.state.systemStatus === 'confirming') {
                    this.cancelEmergency();
                }
            }
        });
        
        // Overlay click to close
        this.confirmModal.addEventListener('click', (event) => {
            if (event.target === this.confirmModal) {
                this.cancelEmergency();
            }
        });
    }
    
    handleEmergencyClick() {
        console.log('🚨 [EMERGENCY] Emergency button clicked!');
        console.log('🚨 [EMERGENCY] Current system status:', this.state.systemStatus);
        console.log('🚨 [EMERGENCY] Toast manager:', this.toast);
        
        // Add immediate visual feedback
        this.btnEmergency.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.8)';
        setTimeout(() => {
            this.btnEmergency.style.boxShadow = '';
        }, 200);
        
        // Check system status
        if (this.state.systemStatus !== 'idle') {
            console.log('🚨 [EMERGENCY] System not idle, showing warning');
            this.toast.show('Tindakan tidak tersedia saat ini', 'warning');
            return;
        }
        
        console.log('🚨 [EMERGENCY] Proceeding to show modal');
        this.showConfirmModal();
    }
    
    showConfirmModal() {
        console.log('[EMERGENCY] Showing confirmation modal');
        
        this.state.setState('confirming');
        
        // Show modal
        this.confirmModal.style.display = 'flex';
        setTimeout(() => {
            this.confirmModal.classList.add('show');
        }, 10);
        
        // Setup focus trap
        const modalContent = this.confirmModal.querySelector('.control-modal');
        if (modalContent) {
            this.focusTrap = new FocusTrap(modalContent);
            this.focusTrap.activate();
        }
    }
    
    cancelEmergency() {
        console.log('[EMERGENCY] Emergency cancelled');
        
        this.hideConfirmModal();
        this.state.setState('idle');
        this.toast.show('Emergency Cut Off dibatalkan', 'info');
    }
    
    hideConfirmModal() {
        if (this.focusTrap) {
            this.focusTrap.deactivate();
            this.focusTrap = null;
        }
        
        this.confirmModal.classList.remove('show');
        
        setTimeout(() => {
            this.confirmModal.style.display = 'none';
        }, 200);
    }
    
    async executeEmergency() {
        console.log('[EMERGENCY] Executing emergency cut off');
        
        this.hideConfirmModal();
        this.showProcessModal();
        this.state.setState('executing');
        
        try {
            // Call the actual emergency function
            const result = await this.sendEmergencyCutOff();
            
            if (result.ok) {
                this.showSuccessState(result.message);
            } else {
                this.showErrorState(result.message);
            }
        } catch (error) {
            console.error('[EMERGENCY] Execution failed:', error);
            this.showErrorState('Tidak dapat menghubungi perangkat');
        }
    }
    
    showProcessModal() {
        const content = `
            <div class="process-content">
                <div class="process-ring">
                    <svg class="process-ring-svg">
                        <defs>
                            <linearGradient id="processGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" style="stop-color:#f6a100"/>
                                <stop offset="100%" style="stop-color:#ff3b5b"/>
                            </linearGradient>
                        </defs>
                        <circle cx="60" cy="60" r="56" class="process-ring-bg"/>
                        <circle cx="60" cy="60" r="56" class="process-ring-progress"/>
                    </svg>
                    <div class="process-icon">
                        <i class="fas fa-power-off"></i>
                    </div>
                </div>
                <div class="process-text">
                    <h3>Mematikan...</h3>
                    <p>Mengirim perintah ke ESP32. Mohon tunggu.</p>
                </div>
                <div class="signal-animation">
                    <div class="signal-line"></div>
                </div>
            </div>
        `;
        
        this.processModal.querySelector('#emergencyProcessContent').innerHTML = content;
        this.processModal.style.display = 'flex';
        
        setTimeout(() => {
            this.processModal.classList.add('show');
        }, 10);
    }
    
    showSuccessState(message) {
        console.log('[EMERGENCY] Success state');
        
        this.state.setState('success');
        
        const content = `
            <div class="success-content">
                <div class="success-icon">
                    <i class="fas fa-check"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 8px;">Emergency Cut Off berhasil</h3>
                <p style="color: var(--text-secondary); margin-bottom: 16px;">Relay telah terputus dan sistem dalam keadaan aman.</p>
                <small style="color: var(--text-secondary);">Muat ulang sistem untuk menggunakan kembali.</small>
                <div class="success-actions">
                    <button id="reloadSystemBtn" class="btn-primary">
                        <i class="fas fa-redo"></i>
                        Muat Ulang Sistem
                    </button>
                    <button id="closeSuccessBtn" class="btn-ghost">
                        <i class="fas fa-times"></i>
                        Tutup
                    </button>
                </div>
            </div>
        `;
        
        this.processModal.querySelector('#emergencyProcessContent').innerHTML = content;
        
        // Add success particles
        this.addSuccessParticles();
        
        // Setup button handlers
        const reloadBtn = this.processModal.querySelector('#reloadSystemBtn');
        const closeBtn = this.processModal.querySelector('#closeSuccessBtn');
        
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => this.reloadSystem());
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideProcessModal());
        }
        
        // Update UI state
        this.updateEmergencyButtonState(true);
        this.toast.show('Emergency Cut Off berhasil. Relay OFF', 'success');
    }
    
    showErrorState(message) {
        console.log('[EMERGENCY] Error state');
        
        this.state.setState('error');
        
        const content = `
            <div class="error-content">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 8px;">Gagal memutus relay</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">${message}</p>
                <div class="success-actions">
                    <button id="retryEmergencyBtn" class="btn-danger">
                        <i class="fas fa-redo"></i>
                        Coba Lagi
                    </button>
                    <button id="closeErrorBtn" class="btn-ghost">
                        <i class="fas fa-times"></i>
                        Tutup
                    </button>
                </div>
            </div>
        `;
        
        this.processModal.querySelector('#emergencyProcessContent').innerHTML = content;
        
        // Setup button handlers
        const retryBtn = this.processModal.querySelector('#retryEmergencyBtn');
        const closeBtn = this.processModal.querySelector('#closeErrorBtn');
        
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.hideProcessModal();
                setTimeout(() => this.executeEmergency(), 100);
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideProcessModal();
                this.state.setState('idle');
            });
        }
        
        this.toast.show('Gagal memutus relay. Coba lagi', 'error');
    }
    
    hideProcessModal() {
        this.processModal.classList.remove('show');
        
        setTimeout(() => {
            this.processModal.style.display = 'none';
        }, 200);
    }
    
    addSuccessParticles() {
        const container = this.processModal.querySelector('.success-content');
        if (!container) return;
        
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'success-particles';
        container.appendChild(particlesContainer);
        
        // Create particles
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = `${Math.random() * 100}%`;
                particle.style.animationDelay = `${Math.random() * 200}ms`;
                particlesContainer.appendChild(particle);
                
                // Remove particle after animation
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 1000);
            }, i * 50);
        }
    }
    
    updateEmergencyButtonState(disabled) {
        if (disabled) {
            this.btnEmergency.disabled = true;
            this.btnEmergency.classList.add('disabled');
            this.btnEmergency.title = 'Aktifkan kembali setelah muat ulang';
            
            if (this.emergencyStatus) {
                this.emergencyStatus.style.display = 'block';
            }
        } else {
            this.btnEmergency.disabled = false;
            this.btnEmergency.classList.remove('disabled');
            this.btnEmergency.title = '';
            
            if (this.emergencyStatus) {
                this.emergencyStatus.style.display = 'none';
            }
        }
    }
    
    async sendEmergencyCutOff() {
        // Simulate sending command to ESP32
        return new Promise((resolve) => {
            // Set timeout for 6 seconds
            const timeoutId = setTimeout(() => {
                resolve({ 
                    ok: false, 
                    message: 'Tidak ada respons dari perangkat (timeout)' 
                });
            }, 6000);
            
            // Simulate network delay and response
            setTimeout(() => {
                clearTimeout(timeoutId);
                
                // Simulate success/failure (90% success rate for demo)
                const success = Math.random() > 0.1;
                
                if (success) {
                    resolve({ 
                        ok: true, 
                        message: 'Relay emergency cutoff berhasil dijalankan' 
                    });
                } else {
                    resolve({ 
                        ok: false, 
                        message: 'Perangkat menolak perintah emergency' 
                    });
                }
            }, 2000 + Math.random() * 2000); // 2-4 second delay
        });
    }
    
    reloadSystem() {
        console.log('[EMERGENCY] Reloading system');
        
        this.toast.show('Memuat ulang sistem...', 'info');
        
        // Reset state
        this.state.setState('idle');
        this.updateEmergencyButtonState(false);
        this.hideProcessModal();
        
        // Simulate system reload
        setTimeout(() => {
            this.toast.show('Sistem berhasil dimuat ulang', 'success');
        }, 1500);
    }
}

// =============================================================================
// TEAM INFO PANEL SYSTEM
// =============================================================================
class TeamInfoManager {
    constructor(state, toastManager) {
        this.state = state;
        this.toast = toastManager;
        this.focusTrap = null;
        
        // Panel elements
        this.panel = null;
        this.btnTeamInfo = null;
        
        this.init();
    }
    
    init() {
        // Get DOM elements
        this.panel = document.getElementById('teamInfoPanel');
        this.btnTeamInfo = document.getElementById('btnTeamInfo');
        
        if (!this.panel || !this.btnTeamInfo) {
            console.error('[TEAM-INFO] Required elements not found');
            return;
        }
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Team info button click
        this.btnTeamInfo.addEventListener('click', () => this.showPanel());
        
        // Close button clicks
        const closeBtn1 = this.panel.querySelector('#teamPanelClose');
        const closeBtn2 = this.panel.querySelector('#teamPanelCloseBtn');
        
        if (closeBtn1) {
            closeBtn1.addEventListener('click', () => this.hidePanel());
        }
        
        if (closeBtn2) {
            closeBtn2.addEventListener('click', () => this.hidePanel());
        }
        
        // Overlay click to close
        const overlay = this.panel.querySelector('.team-panel-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.hidePanel());
        }
        
        // ESC key handling
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.state.isTeamPanelOpen) {
                this.hidePanel();
            }
        });
    }
    
    showPanel() {
        console.log('[TEAM-INFO] Showing team panel');
        
        this.state.isTeamPanelOpen = true;
        
        // Show panel
        this.panel.style.display = 'block';
        setTimeout(() => {
            this.panel.classList.add('show');
        }, 10);
        
        // Setup focus trap
        const panelContent = this.panel.querySelector('.team-panel-content');
        if (panelContent) {
            this.focusTrap = new FocusTrap(panelContent);
            this.focusTrap.activate();
        }
        
        this.toast.show('Panel Team Info dibuka', 'info');
    }
    
    hidePanel() {
        console.log('[TEAM-INFO] Hiding team panel');
        
        this.state.isTeamPanelOpen = false;
        
        if (this.focusTrap) {
            this.focusTrap.deactivate();
            this.focusTrap = null;
        }
        
        this.panel.classList.remove('show');
        
        setTimeout(() => {
            this.panel.style.display = 'none';
        }, 220);
    }
}

// =============================================================================
// MAIN CONTROL PANEL SYSTEM
// =============================================================================
class ControlPanelSystem {
    constructor() {
        this.state = new ControlPanelState();
        this.toast = new ToastManager();
        this.emergency = null;
        this.teamInfo = null;
        
        this.init();
    }
    
    init() {
        console.log('[CONTROL-PANEL] Initializing Control Panel System');
        
        // Initialize subsystems
        this.emergency = new EmergencyCutOffManager(this.state, this.toast);
        this.teamInfo = new TeamInfoManager(this.state, this.toast);
        
        // Setup global event listeners
        this.setupGlobalListeners();
        
        console.log('[CONTROL-PANEL] Control Panel System ready');
    }
    
    setupGlobalListeners() {
        // Handle visibility change to pause/resume animations
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('[CONTROL-PANEL] Page hidden - pausing animations');
            } else {
                console.log('[CONTROL-PANEL] Page visible - resuming animations');
            }
        });
        
        // Handle page unload
        window.addEventListener('beforeunload', () => {
            console.log('[CONTROL-PANEL] Page unloading - cleanup');
            this.cleanup();
        });
    }
    
    cleanup() {
        // Cleanup any running timeouts/intervals
        if (this.state.emergencyTimeout) {
            clearTimeout(this.state.emergencyTimeout);
        }
        
        // Clear all toasts
        this.toast.clear();
        
        console.log('[CONTROL-PANEL] Cleanup completed');
    }
    
    // Public API methods
    getSystemStatus() {
        return this.state.systemStatus;
    }
    
    showToast(message, type, duration) {
        return this.toast.show(message, type, duration);
    }
    
    isSystemBusy() {
        return this.state.isSystemBusy();
    }
}

// =============================================================================
// INITIALIZATION & EXPORT
// =============================================================================

// Initialize when DOM is ready
let controlPanelSystem = null;

function initializeControlPanel() {
    try {
        console.log('🎮 [CONTROL-PANEL] Starting initialization...');
        
        // Wait a bit for DOM to be fully ready
        setTimeout(() => {
            // Check if required elements exist
            const emergencyBtn = document.getElementById('btnEmergencyCutOff');
            const teamInfoBtn = document.getElementById('btnTeamInfo');
            const confirmModal = document.getElementById('emergencyConfirmModal');
            const processModal = document.getElementById('emergencyProcessModal');
            
            console.log('🎮 [CONTROL-PANEL] Element check:');
            console.log('   - Emergency button:', emergencyBtn);
            console.log('   - Team Info button:', teamInfoBtn);
            console.log('   - Confirm modal:', confirmModal);
            console.log('   - Process modal:', processModal);
            
            if (!emergencyBtn) {
                console.error('🎮 [CONTROL-PANEL] Emergency button #btnEmergencyCutOff not found!');
                console.error('🎮 [CONTROL-PANEL] Available buttons:', document.querySelectorAll('button'));
                return false;
            }
            
            if (!teamInfoBtn) {
                console.error('🎮 [CONTROL-PANEL] Team Info button #btnTeamInfo not found!');
                return false;
            }
            
            if (!confirmModal || !processModal) {
                console.error('🎮 [CONTROL-PANEL] Modal elements not found!');
                return false;
            }
            
            // Initialize the system
            controlPanelSystem = new ControlPanelSystem();
            window.controlPanel = controlPanelSystem;
            
            console.log('🎮 [CONTROL-PANEL] System initialized successfully!');
            console.log('🎮 [CONTROL-PANEL] Emergency button ready:', emergencyBtn);
            
            // Test click event directly
            emergencyBtn.addEventListener('click', function(e) {
                console.log('🎮 [TEST] Direct emergency button click detected!', e);
            });
            
            return true;
        }, 500); // Wait 500ms for DOM to be fully ready
        
    } catch (error) {
        console.error('🎮 [CONTROL-PANEL] Initialization failed:', error);
        return false;
    }
}

// Immediate fallback emergency button handler
function setupFallbackEmergencyHandler() {
    console.log('🎮 [FALLBACK] Setting up immediate emergency handler...');
    
    const emergencyBtn = document.getElementById('btnEmergencyCutOff');
    if (emergencyBtn) {
        console.log('🎮 [FALLBACK] Emergency button found, adding immediate handler');
        
        emergencyBtn.addEventListener('click', function(event) {
            console.log('🚨 [FALLBACK] Emergency button clicked via fallback handler!');
            event.preventDefault();
            event.stopPropagation();
            
            // Show immediate visual feedback
            emergencyBtn.style.transform = 'scale(0.9)';
            emergencyBtn.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.8)';
            
            setTimeout(() => {
                emergencyBtn.style.transform = 'scale(1)';
                emergencyBtn.style.boxShadow = '';
            }, 150);
            
            // Show confirmation modal directly
            const confirmModal = document.getElementById('emergencyConfirmModal');
            if (confirmModal) {
                console.log('🚨 [FALLBACK] Showing confirmation modal directly');
                confirmModal.style.display = 'flex';
                setTimeout(() => {
                    confirmModal.classList.add('show');
                }, 10);
            } else {
                console.error('🚨 [FALLBACK] Confirmation modal not found');
            }
        });
    } else {
        console.error('🎮 [FALLBACK] Emergency button not found for fallback handler');
    }
}

// Setup fallback immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupFallbackEmergencyHandler();
        setTimeout(() => {
            console.log('🎮 [CONTROL-PANEL] DOM loaded, initializing...');
            initializeControlPanel();
        }, 200);
    });
} else {
    // DOM already loaded
    setupFallbackEmergencyHandler();
    setTimeout(() => {
        console.log('🎮 [CONTROL-PANEL] DOM already ready, initializing...');
        initializeControlPanel();
    }, 200);
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ControlPanelSystem,
        ControlPanelState,
        ToastManager,
        EmergencyCutOffManager,
        TeamInfoManager,
        FocusTrap
    };
}
