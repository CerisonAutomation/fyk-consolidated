# PWA Install Prompt Best Practices

The PWA install experience lets users add your web app to their home screen or desktop. Modern PWAs can be installed with a custom UI flow using the `beforeinstallprompt` event.

---

## Install Criteria

For a PWA to be installable, it must meet these requirements:

1. **Valid Web App Manifest** with required fields:
   - `name` or `short_name`
   - `start_url`
   - `display` (set to `standalone`, `fullscreen`, or `minimal-ui`)
   - `icons` (at least 192x192 and 512x512)
2. **Served over HTTPS** (or localhost for development)
3. **Registered service worker** with a `fetch` handler
4. **Engagement heuristic** (user has interacted with the domain)

---

## The `beforeinstallprompt` Event

This event fires when the browser determines the PWA meets install criteria. It is your primary hook for creating a custom install flow.

### Capture and Defer the Prompt

```javascript
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the default mini-infobar
  e.preventDefault();

  // Stash the event so it can be triggered later
  deferredPrompt = e;

  // Update UI to show install button
  showInstallButton();
});

function showInstallButton() {
  const installBtn = document.getElementById('install-button');
  installBtn.style.display = 'block';
}
```

### Trigger the Install from Custom UI

```javascript
const installButton = document.getElementById('install-button');

installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;

  // Hide the custom install UI
  hideInstallButton();

  // Show the browser's install prompt
  deferredPrompt.prompt();

  // Wait for the user's choice
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install`);

  // The event can only be used once
  deferredPrompt = null;
});
```

---

## Complete Install UI Implementation

```html
<!-- HTML -->
<div id="pwa-install-banner" class="install-banner hidden">
  <div class="install-content">
    <img src="/icons/app-icon-192.png" alt="App Icon" class="install-icon">
    <div class="install-text">
      <h3>Install MyApp</h3>
      <p>Add to your home screen for the best experience</p>
    </div>
    <div class="install-actions">
      <button id="install-btn" class="btn-primary">Install</button>
      <button id="install-dismiss" class="btn-secondary">Not now</button>
    </div>
  </div>
</div>
```

```css
/* CSS */
.install-banner {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 16px 24px;
  z-index: 1000;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.install-banner.hidden {
  transform: translateX(-50%) translateY(100%);
  opacity: 0;
  pointer-events: none;
}

.install-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.install-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}

.install-actions {
  display: flex;
  gap: 8px;
}
```

```javascript
// JavaScript
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.installBanner = document.getElementById('pwa-install-banner');
    this.installBtn = document.getElementById('install-btn');
    this.dismissBtn = document.getElementById('install-dismiss');

    this.init();
  }

  init() {
    // Capture the install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;

      // Don't show if user previously dismissed
      if (!this.wasDismissed()) {
        this.showBanner();
      }
    });

    // Install button click
    this.installBtn.addEventListener('click', () => this.install());

    // Dismiss button click
    this.dismissBtn.addEventListener('click', () => this.dismiss());

    // Track successful install
    window.addEventListener('appinstalled', () => {
      this.onInstalled();
    });

    // Check if already installed
    if (this.isStandalone()) {
      this.hideBanner();
    }
  }

  async install() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installed');
    }

    this.deferredPrompt = null;
    this.hideBanner();
  }

  dismiss() {
    this.hideBanner();
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }

  wasDismissed() {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (!dismissed) return false;

    // Show again after 7 days
    const daysSinceDismiss = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
    return daysSinceDismiss < 7;
  }

  onInstalled() {
    this.hideBanner();
    localStorage.removeItem('pwa-install-dismissed');

    // Track installation
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_install', { method: 'custom_install' });
    }
  }

  isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  showBanner() {
    this.installBanner.classList.remove('hidden');
  }

  hideBanner() {
    this.installBanner.classList.add('hidden');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PWAInstaller();
});
```

---

## Detect Display Mode

```javascript
function getPWADisplayMode() {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui';
  }
  if (window.matchMedia('(display-mode: browser)').matches) {
    return 'browser';
  }
  if (window.navigator.standalone) {
    return 'standalone-ios'; // iOS Safari
  }
  return 'unknown';
}
```

### Adapt UI for Standalone Mode

```css
/* Show browser-only UI elements */
@media not all and (display-mode: standalone) {
  .browser-only {
    display: block;
  }
}

/* Hide browser-only UI when installed */
@media all and (display-mode: standalone) {
  .browser-only {
    display: none;
  }

  /* Adjust background for standalone */
  body {
    background-color: #f5f5f5;
  }

  /* Add safe area padding for iOS */
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

---

## Web App Manifest

```json
{
  "name": "My Application",
  "short_name": "MyApp",
  "description": "A progressive web application",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a73e8",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Desktop view"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "720x1280",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Mobile view"
    }
  ],
  "shortcuts": [
    {
      "name": "Dashboard",
      "url": "/dashboard",
      "icons": [{ "src": "/icons/shortcut-dashboard.png", "sizes": "96x96" }]
    },
    {
      "name": "Settings",
      "url": "/settings",
      "icons": [{ "src": "/icons/shortcut-settings.png", "sizes": "96x96" }]
    }
  ]
}
```

---

## Platform-Specific Considerations

### iOS Safari

- `beforeinstallprompt` does not fire on iOS. Show a manual "Add to Home Screen" instruction.
- Detect iOS:

```javascript
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isIOSSafari() {
  return isIOS() && navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('CriOS');
}

// Show iOS-specific install instructions
if (isIOSSafari()) {
  showIOSInstallInstructions();
}
```

```html
<!-- iOS install instructions modal -->
<div id="ios-install-modal" class="modal hidden">
  <div class="modal-content">
    <h3>Install This App</h3>
    <ol>
      <li>Tap the <strong>Share</strong> button in Safari</li>
      <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
      <li>Tap <strong>"Add"</strong> in the top right</li>
    </ol>
    <button onclick="closeModal()">Got it</button>
  </div>
</div>
```

### Android / Chrome

- `beforeinstallprompt` fires normally.
- Chrome may also show its own install banner after engagement heuristics are met.

### Desktop (Chrome, Edge)

- PWAs can be installed on desktop.
- Consider desktop-specific shortcuts and window controls.

---

## Tracking and Analytics

```javascript
// Track install prompt events
window.addEventListener('beforeinstallprompt', (e) => {
  analytics.track('pwa_install_prompt_shown');
});

// Track successful install
window.addEventListener('appinstalled', (e) => {
  analytics.track('pwa_installed', {
    timestamp: Date.now(),
    displayMode: getPWADisplayMode(),
  });
});

// Track user choice
async function trackInstallChoice(deferredPrompt) {
  const { outcome } = await deferredPrompt.userChoice;
  analytics.track('pwa_install_choice', {
    outcome, // 'accepted' or 'dismissed'
    timestamp: Date.now(),
  });
}
```

---

## Install UX Best Practices

1. **Don't show the banner immediately.** Wait for user engagement (2+ page views, or after completing a key action).
2. **Respect dismissal.** If the user clicks "Not now," don't show again for at least 7 days.
3. **Don't block content.** The install prompt should be non-intrusive (banner, not modal).
4. **Show benefits.** Explain what the user gains: "Works offline," "Faster loading," "No app store needed."
5. **Use a clear CTA.** "Install App" is better than "Add to Home Screen."
6. **Handle already-installed users.** Hide the install button if the app is already installed:
   ```javascript
   if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
     hideInstallButton();
   }
   ```
7. **Track the funnel.** Monitor prompt shown -> accepted vs dismissed -> actually installed.
8. **A/B test placement.** Try different positions (top banner, floating button, settings page).
9. **Provide value first.** Let users experience the app before asking them to install.
10. **Use screenshots in manifest.** Chrome uses screenshots for the install dialog on desktop.

---

## Post-Install Experience

```javascript
// Detect first launch after install
function isFirstLaunch() {
  return !localStorage.getItem('pwa-installed');
}

window.addEventListener('appinstalled', () => {
  localStorage.setItem('pwa-installed', 'true');
  localStorage.setItem('pwa-install-date', Date.now().toString());
});

// Show onboarding for first launch
if (isFirstLaunch() && getPWADisplayMode() === 'standalone') {
  showOnboardingTour();
}
```

---

## Feature Detection Summary

```javascript
const pwaFeatures = {
  canInstall: !!window.deferredPrompt, // Before install prompt available
  isStandalone: window.matchMedia('(display-mode: standalone)').matches,
  hasServiceWorker: 'serviceWorker' in navigator,
  hasPushManager: 'PushManager' in window,
  hasNotifications: 'Notification' in window,
  hasPeriodicSync: 'periodicSync' in navigator.serviceWorker,
  hasWebShare: 'share' in navigator,
  hasBadgeAPI: 'setAppBadge' in navigator,
  storagePersisted: navigator.storage?.persisted?.(),
  displayMode: getPWADisplayMode(),
};
```

---

**Sources:** web.dev, MDN Web Docs, Chrome Developers
