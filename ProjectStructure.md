# Card Show Finder – Project Structure & Architecture Guide

Welcome to the codebase!  
This document provides a bird’s-eye view of how the app is organized so new contributors can ramp up quickly.

---

## 1. Layered Architecture

```
┌─────────────────────────────┐
│           UI Layer          │  ← React-Native screens & components
└──────────────▲──────────────┘
               │ props/hooks
┌──────────────┴──────────────┐
│     Navigation / Routing    │  ← React Navigation (Stack + Tab)
└──────────────▲──────────────┘
               │ async calls
┌──────────────┴──────────────┐
│        Service Layer        │  ← firebase.js helpers
└──────────────▲──────────────┘
               │ JSON / docs
┌──────────────┴──────────────┐
│     Backend (Firebase)      │  ← Auth, Firestore, Storage, Cloud Functions
└─────────────────────────────┘
```

*The goal is a clean separation: UI is **stateless** whenever possible, pulling data through typed helpers that wrap Firebase.*

---

## 2. Folder Layout

| Path | Purpose |
|------|---------|
| `App.js` | App entry; sets theme, splash handling and root navigators. |
| `src/screens/` | **Feature screens** – each file is a full-page view (Home, Map, Favorites, Profile, ShowDetails). |
| `src/components/` | **Reusable UI bits** (buttons, cards, modals). Not yet populated; create components here. |
| `src/navigation/` | Navigator declarations (currently co-located inside `App.js`; can be extracted later). |
| `src/services/` | Non-UI logic (e.g., geo utilities, API adapters). Firebase helpers live in `firebase.js`. |
| `src/hooks/` | React custom hooks: authentication, location, pagination. |
| `src/constants/` | Color palette, spacing scale, string literals. |
| `assets/` | Images, fonts, icons shown in the app. |
| `firebase.js` | **Single source of truth** for Firebase init + CRUD helpers. |
| `package.json` / `app.json` | Dependency list and Expo configuration. |
| `ProjectStructure.md` | ← you are here. |

---

## 3. Navigation Flow

### Root
* `NavigationContainer` wraps the whole tree.
* **Stack Navigator** holds:
  * `Main` – bottom-tab navigator
  * `ShowDetails` – pushed modally from Home/Map/Favorites

### Bottom Tabs (`TabNavigator`)
| Tab | Screen | Key Notes |
|-----|--------|-----------|
| Home | `HomeScreen` | List + filters |
| Map | `MapScreen` | Google Maps markers |
| Favorites | `FavoritesScreen` | User’s saved shows |
| Profile | `ProfileScreen` | Auth & settings |

Navigation props (`useNavigation`, `route.params`) are the single channel for moving data between screens.  
Avoid deep prop drilling—use hooks or context if state becomes global.

---

## 4. Data Flow & State Management

1. UI requests data via service helpers in `firebase.js`.
2. Service hits Firebase – returns a **plain JS object**.
3. Screen stores result in local `useState` or a custom hook.
4. Child components receive data through props.

There is **no global library (Redux/MobX)** at this stage; local state + Firebase realtime listeners are sufficient.  
Add **React Context** if multiple screens start sharing the same piece of state (e.g., auth user).

### Example: Fetching Nearby Shows

```ts
// HomeScreen.tsx (pseudo)
const [shows, setShows] = useState([]);

useEffect(() => {
  (async () => {
    const { shows, error } = await getCardShowsByLocation(lat, lon);
    if (!error) setShows(shows);
  })();
}, [lat, lon]);
```

---

## 5. Firebase Helpers (`firebase.js`)

* **Auth**: `signIn`, `signUp`, `logOut`, etc.
* **Firestore**: CRUD for `cardShows`, geo filtering, date range queries.
* **Favorites**: add / remove / list per user.
* **Storage**: image upload & delete.

Each helper returns `{ data, error }` objects to keep error handling consistent.

---

## 6. Extending the App

### Add a New Screen

1. `src/screens/MyNewScreen.js`
2. Register in `TabNavigator` or Stack.
3. Keep UI logic in screen, heavy logic in a service or hook.

### Add a Reusable Component

1. `src/components/MyComponent.js`
2. Export **pure** component (no side effects).
3. Document expected props in JSDoc.

### Add a Firestore Collection

1. Update security rules in Firebase console.
2. Add constants & helpers in `firebase.js`.
3. Use helper from screens/hooks.

---

## 7. Environment & Configuration

| Secret | Location |
|--------|----------|
| Firebase keys | `.env` or `firebase.js` placeholders |
| Google Maps API | `app.json -> android.config.googleMaps.apiKey` & Apple Maps in Xcode |

For EAS builds, map them via `eas.json` *build-time secrets*.

---

## 8. CI / CD (coming soon)

* **EAS Build** workflows defined via `eas.json`.
* **OTA updates** with `eas update`.
* Unit & UI tests (Jest + React Native Testing Library) planned for `/__tests__/`.

---

## 9. Coding Conventions

* ES2022 syntax, functional components only.
* Filename = ComponentName (`CamelCase`).
* Keep stylesheets at bottom of file via `StyleSheet.create`.
* **No anonymous functions** in render tree when avoidable—use `useCallback`.

---

## 10. Quick FAQ

**Q:** Where do I put context providers?  
**A:** Create under `src/hooks` or `src/context`, then wrap `NavigationContainer` in `App.js`.

**Q:** How do I test map distance calculations?  
**A:** Pure functions live in `src/services/geo.js`—unit test there.

---

Happy coding!  
*– Card Show Finder Maintainers*
