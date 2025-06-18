# Card Show Finder

Cross-platform (iOS & Android) mobile app for discovering **trading-card shows** happening near you.  
Built with **React Native (Expo)** + **Supabase** so one code-base runs everywhere.

---

## Table of Contents
1. Features
2. Tech Stack
3. Prerequisites
4. Quick Start
5. Environment Variables
6. Supabase Setup
7. Project Structure
8. NPM Scripts
9. Roadmap
10. Contributing & License

---

## 1. Features (Stage 1 MVP)

| Area | Capability |
|------|------------|
| **Auth** | Email/password sign-up, persistent login |
| **Discovery** | • List & map view of upcoming shows within configurable radius (25 / 50 / 100 / 200 mi)<br>• Date-range filter (defaults to next 30 days) |
| **Details** | Full show page: address, dates, times, entry fee, description & features |
| **Map** | Google Maps pins with pop-up summary & quick navigation |
| **Favorites** | Star any show for quick access & reminders |
| **Profile** | Edit first name and home ZIP (default search location) |

Later stages add subscriptions, reviews, messaging, collections, gamification and more (see `docs/ProductPlan.pdf`).

---

## 2. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Mobile | React Native + Expo (TypeScript) | One code-base, hot-reload, OTA updates |
| Backend | Supabase (Auth, PostgreSQL, Storage) | Serverless, scalable, generous free tier |
| Maps | `react-native-maps` (Google) | Reliable geospatial SDK |
| State | React Context + custom hooks | Lightweight for MVP |
| Styling | React Native StyleSheet | No external dependency |
| Testing | Jest + React Testing Library | Unit & component tests |
| Payments (Stage 2) | Stripe | Subscriptions & IAP |

---

## 3. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18 LTS or 20 LTS | `node -v` |
| npm | ≥ 9 | `npm -v` |
| Git | latest | `git --version` |
| Expo CLI | bundled (use `npx expo`) | no global install needed |
| Xcode (mac) | 14+ | iOS Simulator |
| Android Studio | latest | Android emulator |
| Supabase account | free | https://supabase.com |
| Google Maps key | any | enable Maps SDK |

---

## 4. Quick Start

```bash
# 1 · Clone repository
git clone https://github.com/YOUR-USERNAME/card-show-finder.git
cd card-show-finder

# 2 · Install dependencies
npm install

# 3 · Copy env template & add your keys
cp .env.example .env
#   → fill in Supabase URL, Anon Key, Google Maps key

# 4 · Start the app
npx expo start -c        # press i (iOS), a (Android) or scan QR with Expo Go
```

---

## 5. Environment Variables (`.env`)

| Key | Description |
|-----|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps SDK key |

All variables **must** be prefixed with `EXPO_PUBLIC_` to be exposed at build time.

---

## 6. Supabase Setup (15 min)

1. Create a **new project** in Supabase.  
2. Enable **Email Auth** (Auth → Providers → Email).  
3. Dashboard → **SQL Editor** → New query.  
   Paste the entire `supabase-setup.sql` (repo root) and click **Run**.  
   This will:  
   • enable PostGIS  
   • create `profiles`, `shows`, `zip_codes` tables  
   • add RLS policies  
   • insert 3 sample shows  
4. Dashboard → Auth → **URL Configuration**: add  
   `exp://localhost:19000/--/*` and `cardshowfinder://*`  
5. (Optional) Download `google-services.json` / `GoogleService-Info.plist` if you plan bare builds.

Your database is ready! Registering through the app now auto-creates a profile row.

---

## 7. Project Structure

```
card-show-finder/
├── App.tsx                  # Entry – AuthProvider & startup check
├── app.config.js            # Expo config + env injection
├── .env.example             # Env template
├── supabase-setup.sql       # One-click DB bootstrap
├── src/
│   ├── components/          # Reusable UI widgets
│   ├── contexts/            # AuthContext
│   ├── hooks/               # Custom React hooks
│   ├── navigation/          # RootNavigator, tabs, stacks
│   ├── screens/             # Auth, Home, Map, Detail, Profile
│   ├── services/            # supabase.ts, showService, locationService
│   ├── types/               # Global TypeScript interfaces
│   └── assets/              # Images & icons
└── README.md
```

---

## 8. NPM Scripts

| Command | Purpose |
|---------|---------|
| `npx expo start` | Launch Metro bundler & DevTools |
| `npm run ios / android / web` | Shortcut to open platform |
| `npx expo start -c` | Launch with clean cache |
| `npx expo prebuild` | Generate native iOS/Android projects |
| `eas build` | Cloud build archives |

---

## 9. Roadmap

- **Stage 2 (Monetization)**: Subscriptions, vendor listing, show claiming, reviews  
- **Stage 3 (Community)**: Collections, dealer intelligence, messaging  
- **Stage 4 (Engagement)**: Attendance history, badge system, push notifications  

Progress tracked in the GitHub Projects board.

---

## 10. Contributing & License

Pull requests welcome!  
1. Fork → feature branch → commit → PR  
2. Follow ESLint/Prettier rules  
3. Add tests for new logic

This project is licensed under the **MIT License** – see `LICENSE`.

Happy collecting 🚀
