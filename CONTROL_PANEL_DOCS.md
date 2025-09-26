# Control Panel Interactive System

## Overview

Sistem interaktif Control Panel untuk UAV Dashboard Swarnakasa ITERA dengan fitur Emergency Cut Off dan Team Info Panel yang lengkap dengan state management, animasi, dan accessibility support.

## Features

### 1. Emergency Cut Off System
- ✅ Modal konfirmasi bergaya native dashboard
- ✅ Animasi proses dengan progress ring
- ✅ Animasi sukses dengan particle effect
- ✅ Error handling dengan retry option
- ✅ State management (idle → confirming → executing → success/error)
- ✅ Focus trap untuk accessibility
- ✅ 6 detik timeout untuk ESP32 response

### 2. Team Info Panel
- ✅ Panel slide-in dari kanan (420px desktop, full mobile)
- ✅ Informasi lengkap tim Swarnakasa ITERA
- ✅ Focus trap dan keyboard navigation
- ✅ Close dengan X, ESC, atau click overlay

### 3. Toast Notification System
- ✅ Notifikasi success, error, info
- ✅ Auto-dismiss setelah 3 detik
- ✅ Swipe-to-dismiss support (mobile)
- ✅ Multiple toast management

### 4. Design System
- ✅ Palet warna sesuai spesifikasi
- ✅ Navy 900 (#0f2743), Accent Yellow (#f3c623), Danger Red (#ff3b5b)
- ✅ Border radius besar, bayangan lembut
- ✅ Hover effects dengan lifting 2px
- ✅ Focus outline dengan #4aa3ff

## File Structure

```
/
├── index.html              # Main dashboard dengan komponen modal dan panel
├── control-panel.js        # JavaScript state machine dan event handlers
├── style.css              # CSS styling dengan animasi lengkap
└── animations/            # Lottie JSON animations
    ├── progress-ring.json # Animasi progress ring
    ├── success-burst.json # Animasi success dengan particles
    └── error-pulse.json   # Animasi error pulse
```

## Integration Guide

### 1. HTML Integration

Komponen sudah terintegrasi di `index.html`:

```html
<!-- Control Panel Buttons -->
<button id="btnTeamInfo" class="team-btn hoverable">Team Info</button>
<button id="btnEmergencyCutOff" class="emergency-cutoff">Emergency Cut Off</button>

<!-- Modals & Panels -->
<div id="emergencyConfirmModal" class="control-modal-overlay">...</div>
<div id="emergencyProcessModal" class="control-modal-overlay">...</div>
<div id="teamInfoPanel" class="team-info-panel">...</div>
<div id="toastContainer" class="toast-container">...</div>

<!-- Scripts -->
<script src="control-panel.js"></script>
```

### 2. JavaScript Integration

Sistem otomatis initialize saat DOM ready:

```javascript
// Access global instance
window.controlPanel

// Check system status
if (controlPanel.isSystemBusy()) {
    console.log('System sedang sibuk');
}

// Show toast programmatically
controlPanel.showToast('Custom message', 'success', 5000);

// Get current state
const currentState = controlPanel.getSystemStatus();
```

### 3. Custom Functions Integration

Untuk integrasi dengan ESP32, implement fungsi berikut di `script.js`:

```javascript
// Function yang akan dipanggil oleh Emergency system
async function sendEmergencyCutOff() {
    try {
        // Kirim command ke ESP32
        const response = await fetch('/api/emergency-cutoff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'emergency_off' })
        });
        
        const result = await response.json();
        
        return {
            ok: response.ok,
            message: result.message || 'Command sent successfully'
        };
    } catch (error) {
        return {
            ok: false,
            message: 'Network error: ' + error.message
        };
    }
}

// Function untuk reload system
function reloadSystem() {
    // Implementasi reload logic
    location.reload();
}
```

## State Machine

```
idle → confirming → executing → success/error
  ↑                              ↓
  └──────── (reset) ←─────────────┘
```

**States:**
- `idle`: Normal operation, semua tombol aktif
- `confirming`: Modal konfirmasi terbuka
- `executing`: Mengirim command ke ESP32
- `success`: Command berhasil, tombol emergency disabled
- `error`: Command gagal, opsi retry tersedia

## Event Handlers

### Emergency Cut Off Flow

1. **Click Emergency Button** → Check system status
2. **Show Confirmation Modal** → Focus trap active
3. **User Confirms** → Show process modal dengan animasi
4. **Call `sendEmergencyCutOff()`** → 6 detik timeout
5. **Success/Error Response** → Show appropriate result modal
6. **Success** → Disable emergency button, show reload option

### Team Info Flow

1. **Click Team Info Button** → Show slide panel dari kanan
2. **Focus Trap Active** → Keyboard navigation
3. **Close Actions** → X button, ESC key, overlay click

## Customization

### Colors

Edit CSS variables di `style.css`:

```css
:root {
    --navy-900: #0f2743;
    --accent-yellow: #f3c623;
    --danger-red: #ff3b5b;
    /* ... */
}
```

### Animations

Edit durasi animasi:

```css
.control-modal-overlay {
    transition: opacity 200ms ease; /* Modal fade */
}

.team-panel-content {
    transition: transform 220ms ease; /* Panel slide */
}
```

### Toast Duration

Edit default duration:

```javascript
// In control-panel.js
show(message, type = 'info', duration = 3000) // Change 3000 to desired ms
```

## Accessibility Features

- ✅ **Focus Trap**: Keyboard navigation terjebak dalam modal/panel aktif
- ✅ **ARIA Labels**: `role="dialog"`, `aria-labelledby`, `aria-describedby`
- ✅ **Keyboard Support**: ESC untuk close, Tab untuk navigation
- ✅ **Screen Reader**: Semantic HTML dan ARIA attributes
- ✅ **Reduced Motion**: `@media (prefers-reduced-motion: reduce)`

## Browser Support

- ✅ Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- ✅ CSS Grid dan Flexbox support
- ✅ ES6+ JavaScript (classes, async/await, destructuring)
- ⚠️ IE11 tidak support (gunakan Babel untuk compatibility)

## Performance

- ✅ **Throttled Events**: Resize dan scroll events di-throttle
- ✅ **Memory Management**: Cleanup listeners on destroy
- ✅ **Animation Optimization**: CSS transforms untuk smooth animations
- ✅ **Lazy Loading**: Komponen hanya initialize saat diperlukan

## Testing

Jalankan basic test dengan browser console:

```javascript
// Test emergency flow (tanpa ESP32)
controlPanel.emergency.handleEmergencyClick();

// Test team panel
controlPanel.teamInfo.showPanel();

// Test toast
controlPanel.showToast('Test message', 'success');

// Check state
console.log(controlPanel.getSystemStatus());
```

## Troubleshooting

### Common Issues

1. **Modal tidak muncul**
   - Check console untuk error
   - Pastikan `control-panel.js` loaded sebelum `script.js`

2. **Animasi tidak smooth**
   - Check CSS `will-change` properties
   - Disable animations jika device low-performance

3. **Focus trap tidak bekerja**
   - Pastikan modal/panel memiliki focusable elements
   - Check `tabindex` attributes

4. **Toast overlap**
   - Check z-index values
   - Pastikan container positioning correct

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('controlPanelDebug', 'true');
location.reload();
```

## License

MIT License - Swarnakasa ITERA Technology Development Team

---

**Contact:** swarnakasa@itera.ac.id  
**Version:** 1.0.0  
**Last Updated:** September 2025
