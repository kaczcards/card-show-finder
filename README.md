# Card Show Finder

Find sports card & trading card shows near you, fast.

![Card Show Finder banner](assets/splash.png)

## 📖 Project Overview
Card Show Finder is a cross-platform mobile app (iOS & Android) that helps collectors discover upcoming sports‐card and trading‐card shows based on **location, date, and personal preferences**.  
Built with React Native (Expo) and Firebase, the app offers map view, rich show details, favorites, calendar integration, and user authentication.

## ✨ Core Features
| Category | Highlights |
|----------|------------|
| Search & Discovery | 🗺️ Location-aware search (GPS or custom city) <br> 📆 Date filter & sorting (date, distance, rating) |
| Maps | Google Maps markers, distance calculation, directions launch |
| Show Details | Hero images, fees, ratings, rich description, map preview |
| Personalization | Favorite shows list, push-notification settings, dark mode |
| Utilities | Add to device calendar, share event, in-app image picker for profile |
| Auth | Email / password sign-up & login (Firebase Auth) |
| Admin Ready | Firestore schema & helper functions for adding/editing shows |

## 🏗️ Technology Stack
- **Frontend:** React Native 0.72 + Expo SDK 49
- **Navigation:** React Navigation 6
- **Maps & Location:** react-native-maps, expo-location, Google Maps SDK
- **Backend:** Firebase (Auth, Firestore, Cloud Storage)
- **State & Utils:** React hooks, date-fns
- **CI / CD:** EAS Build & Submit (Expo Application Services)

## 🛠️ Setup & Installation

### 1. Prerequisites
- Node ≥ 18, npm or yarn
- Expo CLI `npm install -g expo-cli`
- A Firebase project (enable Email/Password auth & Firestore)
- Google Maps SDK keys (iOS & Android)

### 2. Clone & Install
```bash
git clone https://github.com/yourusername/card-show-finder.git
cd card-show-finder
npm install   # or yarn
```

### 3. Configure Environment
Create an `.env` (or edit `firebase.js` / `app.json`) with your secrets:

```
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
GOOGLE_MAPS_API_KEY=
```

Add the Google key under:
- `app.json -> android.config.googleMaps.apiKey`
- For iOS, add to Xcode or use `expo-build-properties`.

### 4. Run Locally
```bash
# iOS simulator
npm run ios

# Android emulator
npm run android

# Expo Go (QR code)
npm start
```

## 📂 Project Structure
```
card-show-finder/
├── App.js                # Root navigator & theme
├── src/
│   ├── screens/          # Home, Map, Favorites, Profile, ShowDetails
│   ├── components/       # Reusable UI pieces
│   ├── services/         # Firebase helpers
│   └── constants/        # Theme, strings
├── firebase.js           # Firebase initialization & API layer
├── assets/               # Icons, images, fonts
└── app.json              # Expo / EAS config
```

## 🚀 Deployment & Release

### Expo Go (instant)
`expo start` → scan QR code.

### EAS Build
```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```
Artifacts are generated for TestFlight / Google Play.  
Configure signing credentials with `eas credentials`.

### OTA Updates
Minor JS updates can be shipped instantly:
```bash
eas update --branch production -m "Bug fixes"
```

## 🧩 Contributing
1. Fork & create a feature branch
2. Follow ESLint/Prettier settings
3. Submit a pull request—describe your change clearly

## 📝 License
MIT © 2025 Card Show Finder Team
