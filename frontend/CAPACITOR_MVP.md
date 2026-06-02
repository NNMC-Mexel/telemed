# Capacitor MVP

Mobile shell lives inside the existing React frontend:

- `android/` - Android native project
- `ios/` - iOS native project
- `capacitor.config.ts` - Capacitor app config

## Common Commands

```bash
cd frontend
npm run cap:sync
```

This builds the Vite app and copies `dist/` into Android and iOS.

Open native projects:

```bash
npm run cap:open:android
npm run cap:open:ios
```

Run directly from CLI:

```bash
npm run cap:run:android
npm run cap:run:ios
```

## Local Requirements

Android:

- Android Studio or Android SDK
- `ANDROID_HOME` or `android/local.properties` with `sdk.dir=...`
- JDK 21

iOS:

- Full Xcode installation
- CocoaPods
- Xcode selected via `xcode-select`

If Xcode is installed but Command Line Tools are selected:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## MVP Scope

Backend, Strapi API, and signaling server stay unchanged. The mobile app uses the current React/Vite frontend bundled through Capacitor.

Camera and microphone permissions are configured for video consultations. Media/file permissions are configured for document upload flows.
