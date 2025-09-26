/**
 * Control Panel System - Unit Tests
 * 
 * Basic testing for Emergency Cut Off and Team Info functionality
 * Run in browser console after page loads
 * 
 * @author Swarnakasa ITERA Team
 */

// =============================================================================
// TEST UTILITIES
// =============================================================================
class ControlPanelTester {
    constructor() {
        this.results = [];
        this.passed = 0;
        this.failed = 0;
    }
    
    test(name, testFunction) {
        console.log(`🧪 [TEST] Running: ${name}`);
        
        try {
            const result = testFunction();
            if (result === true || result === undefined) {
                this.passed++;
                this.results.push({ name, status: 'PASS', error: null });
                console.log(`✅ [PASS] ${name}`);
            } else {
                this.failed++;
                this.results.push({ name, status: 'FAIL', error: 'Test returned false' });
                console.log(`❌ [FAIL] ${name}: Test returned false`);
            }
        } catch (error) {
            this.failed++;
            this.results.push({ name, status: 'FAIL', error: error.message });
            console.log(`❌ [FAIL] ${name}: ${error.message}`);
        }
    }
    
    async testAsync(name, testFunction) {
        console.log(`🧪 [TEST] Running (async): ${name}`);
        
        try {
            const result = await testFunction();
            if (result === true || result === undefined) {
                this.passed++;
                this.results.push({ name, status: 'PASS', error: null });
                console.log(`✅ [PASS] ${name}`);
            } else {
                this.failed++;
                this.results.push({ name, status: 'FAIL', error: 'Test returned false' });
                console.log(`❌ [FAIL] ${name}: Test returned false`);
            }
        } catch (error) {
            this.failed++;
            this.results.push({ name, status: 'FAIL', error: error.message });
            console.log(`❌ [FAIL] ${name}: ${error.message}`);
        }
    }
    
    assertEqual(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
        }
        return true;
    }
    
    assertTrue(condition, message = '') {
        if (!condition) {
            throw new Error(`Expected true, got ${condition}. ${message}`);
        }
        return true;
    }
    
    assertElementExists(selector, message = '') {
        const element = document.querySelector(selector);
        if (!element) {
            throw new Error(`Element ${selector} not found. ${message}`);
        }
        return true;
    }
    
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    summary() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${this.passed + this.failed}`);
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
        
        if (this.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.results.filter(r => r.status === 'FAIL').forEach(r => {
                console.log(`  - ${r.name}: ${r.error}`);
            });
        }
        
        return this.failed === 0;
    }
}

// =============================================================================
// MAIN TEST SUITE
// =============================================================================
async function runControlPanelTests() {
    console.clear();
    console.log('🚀 Starting Control Panel Tests...\n');
    
    const tester = new ControlPanelTester();
    
    // =============================================================================
    // INITIALIZATION TESTS
    // =============================================================================
    
    tester.test('System Initialization', () => {
        tester.assertTrue(typeof window.controlPanel !== 'undefined', 'controlPanel global should exist');
        tester.assertTrue(typeof window.controlPanel.getSystemStatus === 'function', 'getSystemStatus should be function');
        return true;
    });
    
    tester.test('Initial State', () => {
        const status = window.controlPanel.getSystemStatus();
        tester.assertEqual(status, 'idle', 'Initial system status should be idle');
        return true;
    });
    
    tester.test('DOM Elements Exist', () => {
        tester.assertElementExists('#btnEmergencyCutOff', 'Emergency button should exist');
        tester.assertElementExists('#btnTeamInfo', 'Team info button should exist');
        tester.assertElementExists('#emergencyConfirmModal', 'Emergency modal should exist');
        tester.assertElementExists('#teamInfoPanel', 'Team panel should exist');
        tester.assertElementExists('#toastContainer', 'Toast container should exist');
        return true;
    });
    
    // =============================================================================
    // EMERGENCY CUT OFF TESTS
    // =============================================================================
    
    tester.test('Emergency Button Click (Idle State)', () => {
        const emergencyBtn = document.getElementById('btnEmergencyCutOff');
        const initialStatus = window.controlPanel.getSystemStatus();
        
        tester.assertEqual(initialStatus, 'idle', 'Should start in idle state');
        
        // Simulate click
        emergencyBtn.click();
        
        const newStatus = window.controlPanel.getSystemStatus();
        tester.assertEqual(newStatus, 'confirming', 'Should change to confirming state');
        
        return true;
    });
    
    tester.test('Modal Visibility After Emergency Click', () => {
        const modal = document.getElementById('emergencyConfirmModal');
        const display = window.getComputedStyle(modal).display;
        
        tester.assertTrue(display !== 'none', 'Modal should be visible');
        tester.assertTrue(modal.classList.contains('show'), 'Modal should have show class');
        
        return true;
    });
    
    tester.test('Emergency Cancel Function', () => {
        const cancelBtn = document.querySelector('#emergencyCancel');
        
        tester.assertTrue(cancelBtn !== null, 'Cancel button should exist');
        
        // Simulate cancel
        cancelBtn.click();
        
        const status = window.controlPanel.getSystemStatus();
        tester.assertEqual(status, 'idle', 'Should return to idle state');
        
        return true;
    });
    
    tester.testAsync('Emergency Execution Success Flow', async () => {
        // Mock successful sendEmergencyCutOff
        window.sendEmergencyCutOff = async () => ({ ok: true, message: 'Test success' });
        
        // Click emergency button
        const emergencyBtn = document.getElementById('btnEmergencyCutOff');
        emergencyBtn.click();
        
        await tester.wait(100); // Wait for modal to show
        
        // Confirm emergency
        const confirmBtn = document.querySelector('#emergencyConfirm');
        confirmBtn.click();
        
        await tester.wait(100); // Wait for process modal
        
        // Check if process modal is shown
        const processModal = document.getElementById('emergencyProcessModal');
        tester.assertTrue(processModal.style.display === 'flex', 'Process modal should be visible');
        
        await tester.wait(3000); // Wait for execution to complete
        
        // Check final state
        const finalStatus = window.controlPanel.getSystemStatus();
        tester.assertEqual(finalStatus, 'success', 'Should be in success state');
        
        return true;
    });
    
    // =============================================================================
    // TEAM INFO PANEL TESTS
    // =============================================================================
    
    tester.test('Team Info Button Click', () => {
        // First reset any open panels
        const panel = document.getElementById('teamInfoPanel');
        panel.classList.remove('show');
        panel.style.display = 'none';
        
        const teamBtn = document.getElementById('btnTeamInfo');
        teamBtn.click();
        
        tester.assertTrue(panel.style.display === 'block', 'Panel should be visible');
        tester.assertTrue(panel.classList.contains('show'), 'Panel should have show class');
        
        return true;
    });
    
    tester.test('Team Panel Close Function', () => {
        const closeBtn = document.querySelector('#teamPanelClose');
        
        tester.assertTrue(closeBtn !== null, 'Close button should exist');
        
        closeBtn.click();
        
        const panel = document.getElementById('teamInfoPanel');
        tester.assertTrue(!panel.classList.contains('show'), 'Panel should not have show class');
        
        return true;
    });
    
    // =============================================================================
    // TOAST NOTIFICATION TESTS
    // =============================================================================
    
    tester.test('Toast Creation', () => {
        const toast = window.controlPanel.showToast('Test message', 'info', 1000);
        
        tester.assertTrue(toast !== null, 'Toast should be created');
        tester.assertTrue(toast.classList.contains('toast'), 'Should have toast class');
        tester.assertTrue(toast.classList.contains('info'), 'Should have info class');
        
        return true;
    });
    
    tester.testAsync('Toast Auto Dismiss', async () => {
        const toast = window.controlPanel.showToast('Auto dismiss test', 'success', 500);
        
        // Wait for toast to show
        await tester.wait(100);
        tester.assertTrue(toast.classList.contains('show'), 'Toast should be shown');
        
        // Wait for auto dismiss
        await tester.wait(600);
        tester.assertTrue(!toast.classList.contains('show'), 'Toast should be dismissed');
        
        return true;
    });
    
    // =============================================================================
    // STATE MANAGEMENT TESTS
    // =============================================================================
    
    tester.test('System Busy Check', () => {
        // Reset to idle first
        window.controlPanel.state.setState('idle');
        tester.assertTrue(!window.controlPanel.isSystemBusy(), 'Should not be busy in idle');
        
        // Test busy states
        window.controlPanel.state.setState('confirming');
        tester.assertTrue(window.controlPanel.isSystemBusy(), 'Should be busy in confirming');
        
        window.controlPanel.state.setState('executing');
        tester.assertTrue(window.controlPanel.isSystemBusy(), 'Should be busy in executing');
        
        // Reset back to idle
        window.controlPanel.state.setState('idle');
        
        return true;
    });
    
    // =============================================================================
    // ACCESSIBILITY TESTS
    // =============================================================================
    
    tester.test('Focus Trap Elements', () => {
        // Open emergency modal
        const emergencyBtn = document.getElementById('btnEmergencyCutOff');
        emergencyBtn.click();
        
        const modal = document.querySelector('#emergencyConfirmModal .control-modal');
        const focusableElements = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])');
        
        tester.assertTrue(focusableElements.length > 0, 'Modal should have focusable elements');
        
        // Cancel to close
        const cancelBtn = document.querySelector('#emergencyCancel');
        cancelBtn.click();
        
        return true;
    });
    
    tester.test('ARIA Attributes', () => {
        const confirmModal = document.getElementById('emergencyConfirmModal');
        const modalDialog = confirmModal.querySelector('[role="dialog"]');
        
        tester.assertTrue(modalDialog !== null, 'Modal should have dialog role');
        tester.assertTrue(modalDialog.hasAttribute('aria-labelledby'), 'Should have aria-labelledby');
        tester.assertTrue(modalDialog.hasAttribute('aria-describedby'), 'Should have aria-describedby');
        
        return true;
    });
    
    // =============================================================================
    // ERROR HANDLING TESTS
    // =============================================================================
    
    tester.testAsync('Emergency Execution Error Flow', async () => {
        // Mock failed sendEmergencyCutOff
        window.sendEmergencyCutOff = async () => ({ ok: false, message: 'Test error' });
        
        // Click emergency button
        const emergencyBtn = document.getElementById('btnEmergencyCutOff');
        emergencyBtn.click();
        
        await tester.wait(100);
        
        // Confirm emergency
        const confirmBtn = document.querySelector('#emergencyConfirm');
        confirmBtn.click();
        
        await tester.wait(3000); // Wait for execution to complete
        
        // Check error state
        const finalStatus = window.controlPanel.getSystemStatus();
        tester.assertEqual(finalStatus, 'error', 'Should be in error state');
        
        // Close error modal
        const closeErrorBtn = document.querySelector('#closeErrorBtn');
        if (closeErrorBtn) {
            closeErrorBtn.click();
        }
        
        return true;
    });
    
    // =============================================================================
    // CLEANUP AND SUMMARY
    // =============================================================================
    
    tester.test('Cleanup Test', () => {
        // Reset system state
        window.controlPanel.state.setState('idle');
        
        // Close any open modals/panels
        const modals = document.querySelectorAll('.control-modal-overlay, .team-info-panel');
        modals.forEach(modal => {
            modal.classList.remove('show');
            modal.style.display = 'none';
        });
        
        // Clear toasts
        window.controlPanel.toast.clear();
        
        tester.assertEqual(window.controlPanel.getSystemStatus(), 'idle', 'Should be back to idle state');
        
        return true;
    });
    
    // Show results
    return tester.summary();
}

// =============================================================================
// MANUAL TEST HELPERS
// =============================================================================

// Helper functions for manual testing
window.testHelpers = {
    // Test emergency flow manually
    testEmergency() {
        console.log('🧪 Testing Emergency Flow...');
        document.getElementById('btnEmergencyCutOff').click();
    },
    
    // Test team info panel
    testTeamInfo() {
        console.log('🧪 Testing Team Info Panel...');
        document.getElementById('btnTeamInfo').click();
    },
    
    // Test toast notifications
    testToasts() {
        console.log('🧪 Testing Toast Notifications...');
        window.controlPanel.showToast('Success toast test', 'success');
        setTimeout(() => window.controlPanel.showToast('Error toast test', 'error'), 1000);
        setTimeout(() => window.controlPanel.showToast('Info toast test', 'info'), 2000);
    },
    
    // Test state changes
    testStates() {
        console.log('🧪 Testing State Changes...');
        ['idle', 'confirming', 'executing', 'success', 'error'].forEach((state, index) => {
            setTimeout(() => {
                window.controlPanel.state.setState(state);
                console.log(`State changed to: ${state}`);
            }, index * 1000);
        });
    },
    
    // Stress test with multiple actions
    stressTest() {
        console.log('🧪 Running Stress Test...');
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                window.controlPanel.showToast(`Stress test ${i + 1}`, 'info', 2000);
            }, i * 500);
        }
        
        setTimeout(() => {
            this.testEmergency();
            setTimeout(() => {
                document.querySelector('#emergencyCancel')?.click();
            }, 1000);
        }, 3000);
        
        setTimeout(() => {
            this.testTeamInfo();
            setTimeout(() => {
                document.querySelector('#teamPanelClose')?.click();
            }, 1000);
        }, 5000);
    }
};

// =============================================================================
// AUTO-RUN TESTS
// =============================================================================

// Auto-run tests when included
if (typeof window !== 'undefined' && window.controlPanel) {
    // Run tests automatically after a short delay
    setTimeout(() => {
        console.log('🤖 Auto-running Control Panel tests...');
        runControlPanelTests().then(success => {
            if (success) {
                console.log('\n🎉 All tests passed! System is ready.');
            } else {
                console.log('\n⚠️ Some tests failed. Check implementation.');
            }
            
            console.log('\n📚 Manual test helpers available:');
            console.log('- testHelpers.testEmergency()');
            console.log('- testHelpers.testTeamInfo()'); 
            console.log('- testHelpers.testToasts()');
            console.log('- testHelpers.testStates()');
            console.log('- testHelpers.stressTest()');
        });
    }, 2000);
} else {
    console.log('⏳ Control Panel not ready yet. Run runControlPanelTests() manually.');
}

// Export for manual use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runControlPanelTests, ControlPanelTester };
}
