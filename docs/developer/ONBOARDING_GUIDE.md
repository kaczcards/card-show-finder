# Developer Onboarding Guide

Welcome to **Card Show Finder**!  
This guide will take you from a clean machine to running the mobile app, understanding the tech stack, and confidently contributing code and database changes.

---

## 1  ·  Local Setup

### 1.1 Prerequisites

| Tool | Recommended Version | Notes |
|------|---------------------|-------|
| Node.js | 18 LTS or 20 LTS | `node -v` |
| npm | ≥ 9 | bundled with Node |
| Git | latest | `git --version` |
| Expo CLI | no global install required | we use `npx expo` |
| Xcode (mac only) | 14 + | iOS simulator |
| Android Studio | latest | Android emulator |
| Supabase account | free | create at <https://supabase.com> |
| Google Maps API key | any | enable **Maps SDK** |

> Tip: macOS users should also install **watchman** (`brew install watchman`) for faster file watching.

### 1.2 Clone the Repository

```
git clone https://github.com/kaczcards/card-show-finder.git
cd card-show-finder
```

> We work on feature branches. **Do not commit directly to `main`.**

### 1.3 Install Dependencies

```
npm install
```

Expo SDK and React Native peer dependencies are installed automatically.

### 1.4 Environment Variables

Copy the example file and fill in your own values:

```
cp .env.example .env
```

| Key | Description |
|-----|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://[YOUR_SUPABASE_PROJECT_ID].supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `[YOUR_SUPABASE_ANON_KEY]` |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Your Maps key |

**Never** commit real keys. The repo is public.

### 1.5 Database & Auth (local vs. cloud)

We use the hosted Supabase instance shared by the team.  
If you want a private playground:

1. `supabase init` (requires Supabase CLI).  
2. Run `supabase db reset` then execute `supabase-setup.sql`.  
3. Add your local project URL & anon key to `.env`.

---

## 2  ·  Architecture Overview

### 2.1 High-Level Diagram

```
React Native (Expo) app  ─┬─>  Supabase Auth (JWT)
                          ├─>  Supabase Postgres  +  PostGIS
                          ├─>  Supabase Storage (images)
                          └─>  Supabase Edge Functions (serverless API)
```

### 2.2 Tech Stack

| Layer | Technology | Reason |
|-------|------------|--------|
| Mobile | React Native + Expo (TypeScript) | single code-base, OTA updates |
| Backend-as-a-Service | Supabase | Postgres, Auth, Storage, Realtime |
| Geospatial | PostGIS | distance / radius queries |
| Maps | `react-native-maps` + Google Maps | reliable SDK |
| Payments | Stripe (future) | subscriptions |
| State | React Context + custom hooks | lightweight |

### 2.3 Data Flow (Example)

1. User taps **“Favorite”** star on a show.  
2. `ShowDetailScreen` calls `showService.toggleFavorite(showId)`.  
3. Service inserts or deletes row in `user_favorite_shows` via Supabase JS SDK.  
4. Postgres trigger updates `favorite_shows_count`.  
5. UI receives optimistic update via React state; Realtime channel later confirms.

---

## 3  ·  Running the App Locally

### 3.1 Start Metro & DevTools

```
npx expo start -c      # -c clears cache (recommended on first run)
```

Press:

* `i` – open iOS simulator  
* `a` – open Android emulator  
* `w` – open in browser (web support is experimental)

### 3.2 Common Issues

| Symptom | Fix |
|---------|-----|
| `error: node X not found` | Run `nvm use 18` (or system Node 18) |
| Infinite *“Building JavaScript bundle”* | Kill Metro (`Ctrl +C`) and run `expo start -c` |
| Map not rendering | Verify `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is in `.env` |
| Supabase 401 errors | Check `EXPO_PUBLIC_SUPABASE_URL` & anon key; make sure Row Level Security policies allow access |

---

## 4  ·  Codebase Tour

```
src/
├── components/        reusable UI (atomic + domain)
├── contexts/          AuthContext, ThemeContext
├── hooks/             custom hooks (e.g., useShows, usePermissions)
├── navigation/        RootNavigator → stack / tab navigators
├── screens/           top-level views grouped by feature
├── services/          business logic & Supabase calls
├── constants/         theme + subscription pricing
├── types/             shared TypeScript interfaces
└── supabase.ts        singleton Supabase client
```

### 4.1 Key Services

| Service | Responsibility |
|---------|----------------|
| `showService.ts` | CRUD & search for shows (RPC `find_filtered_shows`) |
| `messagingService.ts` | Conversations, messages, unread counts |
| `organizerService.ts` | Organizer dashboards & quotas |
| `stripePaymentService.ts` | Create payment intents & listen to webhooks |
| `supabaseAuthService.ts` | login / register / reset password |

### 4.2 Navigation

* **RootNavigator** – decides between `AuthNavigator` and `MainNavigator`  
* **MainTabNavigator** – Home · Map · Messages · Profile tabs  
* Role-specific navigators (Admin, Organizer) are conditionally injected.

---

## 5  ·  Contributing

### 5.1 Branching & Commits

* `main` – production ready
* `develop` – integration (coming soon)
* `feature/<name>` or `fix/<name>` branches
* Use **Conventional Commits** (`feat:`, `fix:`, `docs:` …).

### 5.2 Linting & Formatting

```
npm run lint      # ESLint
npm run format    # Prettier
```

CI will reject commits that fail linting.

### 5.3 Testing

* **Jest** unit tests live next to code: `Button.test.tsx`
* Run all tests:

  ```
  npm test
  ```

* E2E tests with **Detox** are planned (see `README-PRODUCTION.md`).

### 5.4 SQL Migrations

1. Add a new file in `db_migrations/YYMMDD_description.sql`.  
2. Document it in `db_migrations/migration_execution_plan.md`.  
3. Run locally with Supabase CLI:

   ```
   supabase db remote commit -m "add reviews table"
   ```

4. Include upgrade & rollback notes in the PR.

### 5.5 Pull Requests

Follow `PR_INSTRUCTIONS.md`. Each PR must include:

* Linked issue
* Description & screenshots
* Test coverage or manual QA steps
* Checklist of breaking-change considerations

---

## 6  ·  Troubleshooting & FAQ

* **“Cannot find module ‘react-native-maps’”** – Run `npx expo install react-native-maps`.
* **Metro cache corruption** – Delete `node_modules`, `yarn.lock`, `package-lock.json`, then `npm install`.
* **Slow iOS builds** – In Simulator uncheck *Debug > Slow Animations*.

---

## 7  ·  Further Reading

* [developer/FILE_SUMMARIES.md](FILE_SUMMARIES.md) – What each file does  
* [developer/DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) – Tables, columns & RLS  
* [developer/EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md) – API guide  
* [README-PRODUCTION.md](../README-PRODUCTION.md) – Production topology & CI/CD

---

### Welcome Aboard 🎉

Ping `@maintainers` in Slack if you get stuck. Happy shipping!
