# Capacitor Mobile App Patterns

> Source: capacitorjs.com, ionic.io, nextnative.dev, capgo.app (2024-2025)

## Overview

Capacitor is a cross-platform native runtime that makes it easy to build performant mobile applications that run natively on iOS, Android, and more using modern web tooling. It creates Web Native apps, providing a modern native container approach for teams who want to build web-first without sacrificing full access to native SDKs.

## Architecture Patterns

### Project Structure

```
my-app/
├── src/                    # Web app source (React/Vue/Angular)
├── android/                # Native Android project
├── ios/                    # Native iOS project
├── capacitor.config.ts     # Capacitor configuration
├── package.json
└── build/                  # Compiled web output
```

### Configuration Pattern

```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.appname',
  appName: 'Your App Name',
  webDir: 'out',           // Build output directory
  server: {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert', 'banner', 'list'],
    },
  },
};

export default config;
```

### Initialization Commands

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli

# Initialize
npx cap init

# Add platforms
npx cap add ios
npx cap add android

# Sync web code to native
npx cap sync

# Open native IDEs
npx cap open ios
npx cap open android
```

## Plugin Integration Patterns

### Camera Access

```typescript
import { Camera, CameraResultType } from '@capacitor/camera';

const takePicture = async () => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Uri,
  });
  const imageUrl = image.webPath;
  return imageUrl;
};
```

### Geolocation

```typescript
import { Geolocation } from '@capacitor/geolocation';

const getCurrentPosition = async () => {
  const coordinates = await Geolocation.getCurrentPosition();
  console.log('Lat:', coordinates.coords.latitude);
  console.log('Lng:', coordinates.coords.longitude);
  return coordinates;
};
```

### Haptic Feedback

```typescript
import { Haptics, HapticsImpactStyle } from '@capacitor/haptics';

const triggerHaptic = async () => {
  await Haptics.impact({ style: HapticsImpactStyle.Medium });
};
```

### Filesystem Access

```typescript
import { Filesystem, Directory } from '@capacitor/filesystem';

const writeFile = async (filename: string, data: string) => {
  await Filesystem.writeFile({
    path: filename,
    data: data,
    directory: Directory.Documents,
  });
};
```

## Performance Optimization Patterns

### Lazy Loading Plugins

```typescript
// Don't import at top level - load on demand
const loadCamera = async () => {
  const { Camera } = await import('@capacitor/camera');
  return Camera;
};
```

### Bridge Call Minimization

```typescript
// Bad: Multiple bridge calls
const bad = async () => {
  await StatusBar.setStyle({ style: Style.Light });
  await StatusBar.setBackgroundColor({ color: '#ffffff' });
  await StatusBar.show();
};

// Good: Batch operations
const good = async () => {
  await Promise.all([
    StatusBar.setStyle({ style: Style.Light }),
    StatusBar.setBackgroundColor({ color: '#ffffff' }),
    StatusBar.show(),
  ]);
};
```

### WebView Optimization

- Use CSS `will-change` for animated properties
- Implement virtual scrolling for long lists
- Cache static assets in `public/` directory
- Use `loading="lazy"` on images

## Security Patterns

### Secure Storage

```typescript
import { SecureStoragePlugin } from '@capacitor-secure-storage';

await SecureStoragePlugin.set({
  key: 'auth_token',
  value: 'sensitive-value',
});

const result = await SecureStoragePlugin.get({ key: 'auth_token' });
```

### Root/Jailbreak Detection

```typescript
import { Device } from '@capacitor/device';

const checkDeviceSecurity = async () => {
  const info = await Device.getInfo();
  const battery = await Device.getBatteryInfo();
  // Check for jailbroken/rooted devices
  return { info, battery };
};
```

## Cross-Platform UI Patterns

### Platform Detection

```typescript
import { Capacitor } from '@capacitor/core';

const platform = Capacitor.getPlatform();
const isIOS = platform === 'ios';
const isAndroid = platform === 'android';

// Apply platform-specific styling
if (isIOS) {
  document.body.classList.add('platform-ios');
} else if (isAndroid) {
  document.body.classList.add('platform-android');
}
```

### Responsive Breakpoints

```
Small (< 600px):   Single-column layout
Medium (600-1024): Two-column layout
Large (> 1024):    Multi-column with sidebars
```

### Touch Target Sizing

- iOS: minimum 44x44 pixels
- Android: minimum 48x48 density-independent pixels

## Testing Patterns

### Unit Testing with Jest

```typescript
// Test Capacitor plugin mocking
jest.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: jest.fn(),
  },
}));
```

### E2E Testing with Cypress

```typescript
describe('App Navigation', () => {
  it('should navigate through all screens', () => {
    cy.visit('/');
    cy.get('[data-testid="nav-home"]').should('be.visible');
    cy.get('[data-testid="nav-settings"]').click();
    cy.url().should('include', '/settings');
  });
});
```

## Capacitor 7 Key Changes (Jan 2025)

- Updated dependencies for Android 15 and iOS 18 support
- Transition to Swift Package Manager (SPM) from CocoaPods
- Minimal breaking changes - smooth migration path
- Enterprise adoption through OutSystems partnership
- Improved plugin ecosystem

## Comparison: Capacitor vs React Native vs NativeScript

| Feature | Capacitor | React Native | NativeScript |
|---------|-----------|--------------|--------------|
| Core Tech | Web View (HTML, CSS, JS) | Native UI (JS bridges) | Native UI (JS, XML, CSS) |
| Skillset | Web Dev | React + JS | JS/TS (Angular/Vue) |
| UI Rendering | Web content in WebView | Native platform widgets | Native UI elements |
| Best For | Web devs reusing existing apps | React teams wanting native feel | Direct native API access |

## Deployment Checklist

1. Build web assets: `npm run build`
2. Sync to native: `npx cap sync`
3. Open native IDE: `npx cap open ios` / `npx cap open android`
4. Configure signing certificates and provisioning profiles
5. Set version numbers in native projects
6. Build and archive for distribution
7. Submit to App Store / Google Play

## Common Issues and Solutions

### Build Failures
- Ensure `webDir` points to correct build output
- Run `npx cap sync` after every web build
- Check native project signing configurations

### Plugin Conflicts
- Check plugin compatibility with your Capacitor version
- Use `npx cap sync --force` to resolve sync issues

### Performance Issues
- Minimize bridge calls between JS and native
- Use lazy loading for heavy plugins
- Optimize WebView content (images, CSS, JS bundles)
