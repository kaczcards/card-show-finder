# File Summaries
_A concise, one-paragraph description of every **major** file in the Card Show Finder repository. Minor helper scripts and auto-generated artifacts are omitted for brevity._

---

## Root-level Files

### `App.tsx`
Bootstraps the React Native application: registers global providers (AuthContext, ThemeContext), configures the root navigation container, and performs the initial Supabase session check so the correct navigator (Auth vs. Main) is rendered without a flicker.

### `app.config.js`
Dynamic Expo configuration that injects variables from `.env`, defines splash-screen assets, permissions, and EAS build settings so iOS/Android projects are generated with the correct bundle identifiers and API keys.

### `supabase.ts`
Singleton factory that creates and exports the typed `supabase-js` client used throughout the app; also wires Realtime subscriptions and centralises auth state listeners.

### `package.json`
Declares all runtime and dev dependencies (React Native, Expo SDK, Supabase, Stripe, Jest, ESLint, etc.), npm scripts for common tasks, and the React Native/Expo version constraints to keep the monorepo consistent.

### `eas.json`
Expo Application Services configuration describing build profiles (`development`, `preview`, `production`) and submit targets, enabling automated cloud builds and OTA updates.

---

## `src/components/*`

These folders host **reusable UI**. Each file exports a self-contained component that can be composed by screens.

* `ui/Button.tsx` – theme-aware primary/secondary buttons.
* `HomeCarousel.tsx` – auto-scrolling Hero carousel shown on Home.
* `MapShowCluster/MapShowCluster.tsx` – renders clustered map markers, delegating to `react-native-maps-super-cluster` patched for Expo.
* `GroupMessageComposer.tsx` – rich-text input bar with attachment & emoji hooks used in Messages screens.

---

## `src/screens/*`

Top-level views that pair a route with its controller logic.

* `Auth/LoginScreen.tsx`, `RegisterScreen.tsx`, `ForgotPasswordScreen.tsx` – email/password flows powered by Supabase Auth.
* `Home/HomeScreen.tsx` – fetches nearby shows (RPC `find_filtered_shows`) and displays them in list & map toggle.
* `Map/MapScreen.tsx` – full-screen map with radius filter and pin clustering.
* `ShowDetail/ShowDetailScreen.tsx` – detailed show page including favourite toggle, directions link and reviews feed.
* `Messages/DirectMessagesScreen.tsx`, `MessagesScreen.tsx` – entry points for the enhanced messaging system (conversations view & chat window).
* `Profile/ProfileScreen.tsx` – editable user profile, subscription status, badge overview.

---

## `src/services/*`

Encapsulate **business logic** and Supabase interactions.

* `showService.ts` – CRUD for shows, radius & date filters, favourite toggles.
* `messagingService.ts` – helpers for creating conversations, sending messages, marking read, all via new tables `conversations` & `messages`.
* `organizerService.ts` – show-organizer dashboards, broadcast quota checks and Edge Function calls (`send-broadcast`).
* `stripePaymentService.ts` – client-side Stripe SDK helpers for subscription checkout sessions and webhook confirmation polling.

---

## Navigation (`src/navigation/*`)

* `RootNavigator.tsx` – switches between Auth and Main stacks based on session.
* `MainTabNavigator.tsx` – defines bottom-tab layout (Home, Map, Messages, Profile) and conditionally injects Organizer/Admin tabs when role allows.

---

## Contexts (`src/contexts/*`)

* `AuthContext.tsx` – React Context managing Supabase session, user profile and role; exposes login/logout helpers.
* `ThemeContext/index.tsx` – toggles between light/dark palettes and supplies design-token values consumed by `ui/*`.

---

## Supabase Edge Functions (`supabase/functions/*`)

* `send-broadcast/index.ts` – serverless endpoint that validates sender role, enforces pre/post-show quotas, and inserts broadcast messages via RPC.
* `claim_show_series/index.ts` – permits organizers to claim unowned show series after verifying role and series status.
* `reset-broadcast-quotas/index.ts` – scheduled function that nightly resets message quotas for organizers.
* `_shared/cors.ts` – cross-origin helper injected into all functions.

---

## SQL & Migrations

* `supabase-setup.sql` – one-click bootstrap enabling PostGIS, creating `profiles`, `shows`, `zip_codes` tables and RLS policies.
* `db_migrations/enhanced_messaging_schema.sql` – introduces `conversations`, `conversation_participants`, new `messages` table, plus policies and helper RPCs.
* `db_migrations/recurring_shows_schema.sql` – adds `show_series` and related triggers enabling multi-date series management.
* `db_migrations/safe_schema_setup.sql` – idempotent baseline script for fresh environments.
* `db_migrations/migration_execution_plan.md` – chronological ledger describing how to apply every migration safely.

---

## Tests & Utilities

* `test-db-functions.js` – Node script invoking Supabase RPCs locally for smoke testing geospatial queries.
* `scripts/deploy-edge-functions.sh` – CLI helper that bundles and deploys Edge Functions via Supabase CLI in CI.

---

_This list is auto-generated in Phase 1 and updated whenever new top-level files are added or existing ones are deleted._  
If you notice a missing or outdated entry, run the **File Summary Generator** script (coming soon) or update this document manually.
