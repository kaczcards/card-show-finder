# Card Show Finder – Production Read-Me  
**Document version:** v0.9.0-prod-blueprint (2025-06-30)

---

## 1  Purpose of this Document
This file is a **technical, production-oriented read-me** for human developers, code-review droids, and read-only AI assistants.  
It captures:

* Current implementation state of the mobile app & Supabase backend  
* Architectural decisions & code organisation  
* Security, performance and scaling considerations  
* Concrete TODO items blocking a public store release  
* Verified commands / links that agents may need for CI, CD and local onboarding

---

## 2  High-Level Product Overview
Card Show Finder (CSF) is an **Expo-based React Native app** that helps collectors discover, track and interact with trading-card shows across the United States.

Core value proposition
1. **Discovery** – location/date aware list & map of shows  
2. **Engagement** – favourites, reminders, messaging with dealers & organisers  
3. **Monetisation** – paid roles (DEALER, MVP_DEALER, SHOW_ORGANIZER) + subscriptions via Stripe

---

## 3  System Architecture

### 3.1 Pillars

| Layer | Runtime | Responsibilities | Key Files |
|-------|---------|------------------|-----------|
| Mobile client | React Native + Expo SDK 49 | UI, offline caching, geolocation, local push | `App.tsx`, `src/screens/**`, `src/components/**` |
| API / Realtime | Supabase (Postgres 15 + Row-Level Security + Realtime) | Auth, CRUD, RPCs (`find_filtered_shows`, `get_user_conversations`) | `src/services/*Service.ts`, `db_migrations/*.sql` |
| Payments | Stripe | Role upgrades & subscription webhooks | `src/services/stripePaymentService.ts` (stub) |
| Storage | Supabase Storage | Show & card images | Bucket `card_images` |
| Build & Deploy | EAS Build + GitHub Actions (planned) | Signed iOS / Android binaries, OTA updates | `.eas.json` (TBD) |

### 3.2 Data Model (abridged)

```
auth.users  (managed by Supabase Auth)
profiles     id PK | role | home_zip_code | subscription_status …
shows        id PK | title | coordinates (GEOGRAPHY) | features JSONB
show_participants userid ↔ showid
messages     id PK | conversation_id | sender_id | read_by_user_ids[]
conversations id PK | type (direct|group|show) | last_message_* …
zip_codes    zip_code PK | lat | lng  (read-only, for geo queries)
```

Spatial indices are created on `shows.coordinates` and RPCs use PostGIS `ST_DWithin` for radius filtering.

---

## 4  Implemented Features (✅)

| Domain | Status | Notes |
|--------|--------|-------|
| Email/password auth | ✅ | AsyncStorage session, profile auto-provision |
| Role-based access | ✅ | `userRoleService` enum & helpers, RLS enforces |
| Show list & filters | ✅ | Distance, date range, fee, categories, features |
| Map view | ✅ | Clustered markers, call-outs, open detail |
| Show detail | ✅ | Images, description, organiser badge |
| Favourites | ✅ | Stored in profile JSON array |
| Basic messaging | ✅ | Direct & group, unread counters, realtime channel |
| Collection (cards) | MVP prototype | CRUD local only, sync pipeline missing |
| Badges & gamification | MVP prototype | Placeholder logic |

---

## 5  Outstanding Work for Production (🚧)

### 5.1 Must-have
1. **Subscriptions & Role upgrade flow**  
   • Implement `stripePaymentService`, Stripe webhook listener (Supabase edge function) to sync `profiles.role` & `subscription_status`.

2. **Push notifications**  
   • Configure Expo Notifications + Supabase `supabase.functions` trigger for new messages & show reminders.

3. **App Store compliance**  
   • Add Privacy Policy link, In-App Purchase disclosure, marketing screenshots.  
   • Migrate `react-native-maps` to Google Maps SDK keys for release.

4. **Offline / poor network UX**  
   • Graceful error screens, persisted queries (React-Query or MMKV).

5. **Comprehensive testing**  
   • Minimum 80 % unit coverage for services + Detox E2E smoke tests on iOS & Android.

### 5.2 Nice-to-have before v1.0
* Dealer show-participation workflow UI  
* Image compression on upload (card images)  
* In-app calendar export (ICS)  
* Dark-mode styling pass

---

## 6  Security Considerations

| Area | Current | Required for prod |
|------|---------|-------------------|
| API keys | Anon key exposed in client (ok) | **Never** embed service-role key |
| RLS | Enabled on all user data tables | Pen-test custom policies (`messages`, `shows`) |
| Auth | Email confirmed, JWT auto-refresh | Enforce password strength, optional MFA |
| Storage | `card_images` bucket public read | Generate signed URLs for private assets |
| Webhooks | N/A | Verify `Stripe-Signature`, Supabase JWT secret rotation |
| Secrets | .env (local) / EAS secret | Use GitHub Actions encrypted secrets |

---

## 7  Performance & Scaling

* **Bundle size**: < 5 MB (assets trimmed, images ≤1 MB each; Metro static `require()` paths comply)  
* **DB indices**: verified on `shows.start_date`, `coordinates` (GIST) and messaging tables.  
* **Pagination & caching**: `getShows` capped at 200 rows; add infinite scroll + SWR for map clusters.  
* **Background tasks**: switch Expo Updates to `checkAutomatically: 'ON_LOAD'` w/ code-push cadence weekly.  
* **Monitoring**: integrate Sentry RN + Supabase log drains → Logflare.

---

## 8  Deployment Strategy

### 8.1 Mobile builds
```
# Build preview
eas build --profile preview --platform all

# Promote to prod
eas build --profile production --platform all
eas submit -p ios --latest
eas submit -p android --latest
```
`eas.json` profiles (TBD) must inject `EXPO_PUBLIC_SUPABASE_*` & `GOOGLE_MAPS_API_KEY`.

### 8.2 Database migrations
* SQL files live in `/db_migrations`.  
* Use `supabase db push` (local dev) or GitHub Action `supabase-db-deploy@v1` for prod.  
* Always run migrations inside a transaction; RPCs compiled after DDL.

### 8.3 Edge Functions
* `functions/stripe-webhook.ts` (to-be-written) → deploy via `supabase functions deploy stripe-webhook`.

---

## 9  Local Development Quick-start

```bash
# prerequisites: Node 20, npm 9+, PostgreSQL 15 (optional, docker ok)

git clone https://github.com/kaczcards/card-show-finder.git
cd card-show-finder
npm install

cp .env.example .env           # fill Supabase & Maps keys
npx supabase start             # optional local db
npx expo start                 # run in Expo Go

# seed example shows
psql -f db_migrations/basic_cards_only.sql
```

---

## 10  CI / CD Pipeline (planned)

| Stage | Tool | Status |
|-------|------|--------|
| Lint & type-check | `eslint`, `tsc` | ✅ in pre-push hook |
| Unit tests | Jest | 🟡 minimal |
| Build | EAS Build cloud | 🟡 manual trigger |
| Migrations | Supabase CLI | 🚧 auto-deploy |
| Release | GitHub Actions | 🚧 write workflow |

---

## 11  Contribution Guide (abridged)

1. **Branch** off `main`, prefix `feat/`, `fix/`, `chore/`.  
2. Follow **Conventional Commits**.  
3. Run `npm test && npm run lint:fix`.  
4. Open PR → template in `PR_DESCRIPTION.md`.  
5. At least one approving review + passing pipeline.

---

## 12  Acknowledgements
Thanks to the collector community & early beta testers, and to the open-source libraries that power CSF.

---

## 13  Change Log (this doc)
* v0.9.0 – Initial production blueprint (2025-06-30)

---

_End of README-PRODUCTION.md_
