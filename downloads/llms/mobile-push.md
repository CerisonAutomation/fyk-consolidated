# Mobile Push Notification Patterns

> Source: capacitorjs.com docs (2024-2025)

## Overview

Push notifications keep users engaged with timely alerts on their home screens. Capacitor's `@capacitor/push-notifications` plugin provides cross-platform support via Apple APNs (iOS) and Firebase Cloud Messaging (Android).

## Installation & Setup

### Install Plugin

```bash
npm install @capacitor/push-notifications
npx cap sync
```

### iOS Configuration

1. Enable Push Notifications capability in Xcode
2. Add to `AppDelegate.swift`:

```swift
func application(_ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(
        name: .capacitorDidRegisterForRemoteNotifications,
        object: deviceToken
    )
}

func application(_ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(
        name: .capacitorDidFailToRegisterForRemoteNotifications,
        object: error
    )
}
```

### Android Configuration

1. Create Firebase project at console.firebase.google.com
2. Add Android app to Firebase project
3. Download `google-services.json`
4. Place in `android/app/` directory

No need to add Firebase SDK to manifest - the plugin handles it.

### Push Notification Icon (Android)

```xml
<!-- AndroidManifest.xml -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_icon"
    android:resource="@mipmap/push_icon_name" />
```

Important: Push icon should be white pixels on transparent backdrop.

### Notification Channel (Android 8.0+)

```xml
<!-- AndroidManifest.xml -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="@string/default_notification_channel_id" />
```

## Core Implementation

### Registration Flow

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

const registerForPushNotifications = async () => {
  // Check permissions
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    throw new Error('User denied push notification permissions');
  }

  // Register for push notifications
  await PushNotifications.register();
};
```

### Event Listeners

```typescript
const addPushNotificationListeners = async () => {
  // Registration successful - get token
  await PushNotifications.addListener('registration', (token) => {
    console.info('Registration token:', token.value);
    // Send token to your backend server
    sendTokenToServer(token.value);
  });

  // Registration failed
  await PushNotifications.addListener('registrationError', (err) => {
    console.error('Registration error:', err.error);
  });

  // Notification received while app is in foreground
  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification);
    // Show custom in-app notification
    showInAppNotification(notification);
  });

  // User tapped on notification
  await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Notification action performed:', notification.actionId, notification.inputValue);
    // Navigate to relevant screen
    handleNotificationNavigation(notification);
  });
};
```

### Complete Setup Pattern

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

class PushNotificationService {
  private token: string | null = null;

  async initialize() {
    // Add listeners first
    await this.addListeners();

    // Then register
    await this.register();
  }

  private async addListeners() {
    await PushNotifications.addListener('registration', (token) => {
      this.token = token.value;
      this.sendTokenToServer(token.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Registration error:', err.error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      this.handleForegroundNotification(notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      this.handleNotificationTap(notification);
    });
  }

  private async register() {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === 'granted') {
      await PushNotifications.register();
    }
  }

  private async sendTokenToServer(token: string) {
    // Send to your backend for sending notifications
    await fetch('/api/push-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
    });
  }

  private handleForegroundNotification(notification: any) {
    // Show custom in-app banner or modal
    console.log('Foreground notification:', notification.title, notification.body);
  }

  private handleNotificationTap(notification: any) {
    // Navigate based on notification data
    const data = notification.notification?.data;
    if (data?.screen) {
      router.push(data.screen);
    }
  }
}
```

## Notification Channels (Android)

### Create Custom Channels

```typescript
import { PushNotifications, Channel } from '@capacitor/push-notifications';

const createNotificationChannels = async () => {
  await PushNotifications.createChannel({
    id: 'messages',
    name: 'Messages',
    description: 'Direct messages from other users',
    sound: 'message_sound',
    importance: 4, // HIGH
    visibility: 1, // PUBLIC
    lights: true,
    lightColor: '#FF0000',
    vibration: true,
  });

  await PushNotifications.createChannel({
    id: 'alerts',
    name: 'Alerts',
    description: 'Important system alerts',
    importance: 5, // MAX
    visibility: 2, // SECRET
  });
};
```

### Channel Importance Levels

| Level | Value | Behavior |
|-------|-------|----------|
| NONE | 0 | No notifications |
| MIN | 1 | No sound, no visual interruption |
| LOW | 2 | No sound, appears in shade |
| DEFAULT | 3 | Makes sound |
| HIGH | 4 | Makes sound, appears as heads-up |
| MAX | 5 | Makes sound, appears as heads-up, cannot be dismissed |

## Foreground Notification Configuration

### capacitor.config.ts

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert', 'banner', 'list'],
    },
  },
};

export default config;
```

### Presentation Options

| Option | Description | Platform |
|--------|-------------|----------|
| badge | Updates app icon badge count | iOS only |
| sound | Device rings/vibrates | Both |
| alert | Display notification | Both (deprecated iOS) |
| banner | Show as banner | Both |
| list | Show in notification center | Both |

## Notification Management

### Get Delivered Notifications

```typescript
const getDelivered = async () => {
  const notificationList = await PushNotifications.getDeliveredNotifications();
  console.log('Delivered notifications:', notificationList);
  return notificationList;
};
```

### Remove Notifications

```typescript
// Remove specific notifications
await PushNotifications.removeDeliveredNotifications(delivered);

// Remove all notifications
await PushNotifications.removeAllDeliveredNotifications();
```

### Unregister

```typescript
const unregister = async () => {
  await PushNotifications.unregister();
};
```

## Android-Specific Considerations

### Doze Mode
- Devices in Doze mode restrict notification delivery
- Use FCM high-priority messages for time-sensitive notifications
- Request users to disable battery optimization for critical apps

### Android 13+ Permission
```typescript
// Required for Android 13 (SDK 33)
const checkAndRequestPermission = async () => {
  const permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === 'prompt') {
    await PushNotifications.requestPermissions();
  }
};
```

### Android 15 Private Space
- Users can install apps in private space
- Notifications won't show until private space is unlocked
- Cannot detect if app is in private space
- Inform users of critical notifications

### Development vs Production
- Test outside Android Studio for realistic behavior
- Development builds may have different notification behavior
- Use Firebase Console to test in production

## iOS-Specific Considerations

### Silent Push Notifications
- Not supported by Capacitor plugin
- Use native code solutions for background updates
- See Apple's "Pushing Background Updates to Your App"

### APNs Token Format
- iOS sends device token as `Data` type
- Convert to hex string for server storage
- Token can change on app reinstall or OS update

## Server-Side Sending

### Firebase Admin SDK (Node.js)

```javascript
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendNotification = async (token, title, body, data = {}) => {
  const message = {
    token,
    notification: { title, body },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        clickAction: 'OPEN_ACTIVITY',
      },
    },
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: 'default',
        },
      },
    },
  };

  const response = await admin.messaging().send(message);
  console.log('Successfully sent:', response);
};
```

### Send to Topic

```javascript
const sendToTopic = async (topic, title, body) => {
  const message = {
    topic,
    notification: { title, body },
    android: {
      priority: 'high',
    },
  };

  await admin.messaging().send(message);
};

// Subscribe device to topic
await admin.messaging().subscribeToTopic([token1, token2], 'news');
```

## Best Practices

### Permission Request Timing
```typescript
// Don't request on app launch - wait for meaningful engagement
const requestAfterEngagement = async () => {
  // After user completes onboarding or key action
  const hasCompletedOnboarding = await AsyncStorage.getItem('onboarded');
  if (hasCompletedOnboarding) {
    await registerForPushNotifications();
  }
};
```

### Notification Content
- Keep titles under 40 characters
- Keep body under 120 characters
- Include actionable data in notification payload
- Personalize when possible

### Deep Linking
```typescript
// Handle notification tap navigation
const handleNotificationTap = (notification) => {
  const { data } = notification;

  if (data.screen === 'profile') {
    router.push(`/profile/${data.userId}`);
  } else if (data.screen === 'order') {
    router.push(`/orders/${data.orderId}`);
  } else {
    router.push('/');
  }
};
```

### Token Management
- Store tokens securely on server
- Handle token refresh on app update
- Remove tokens for uninstalled apps
- Implement token rotation

## Common Issues

### Token Not Received
- Verify Firebase configuration files
- Check device network connectivity
- Ensure proper permission handling
- Test on real devices (not simulators)

### Notifications Not Delivered
- Check notification channel configuration
- Verify app is not in Doze mode (Android)
- Check APNs certificate validity (iOS)
- Validate FCM server key

### Foreground Notifications Not Showing
- Configure `presentationOptions` correctly
- Implement `pushNotificationReceived` listener
- Show custom in-app notification UI

## Testing Checklist

- [ ] Test on both iOS and Android devices
- [ ] Verify permission prompt appears at appropriate time
- [ ] Test foreground notification display
- [ ] Test background notification tap behavior
- [ ] Verify deep linking from notifications
- [ ] Test notification channels (Android)
- [ ] Test with app killed (cold start)
- [ ] Test token refresh on app update
- [ ] Verify server-side sending works
- [ ] Test with different notification priorities
