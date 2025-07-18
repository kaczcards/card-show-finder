# Sentry Integration Guide

Error tracking & performance monitoring for **Card Show Finder** is powered by **Sentry**.  
This document explains how the integration is wired, how to configure it, and recommended
workflows for getting the most value out of Sentry data.

---

## 1. Why Sentry?

* Automatic collection of JavaScript & native crashes on iOS and Android  
* Full stack-traces with source-maps for readable errors  
* User, device and breadcrumb context to reproduce edge-cases fast  
* Performance tracing (cold-start, navigation, API calls)  
* “User Feedback” dialog for voluntary bug reports

---

## 2. Prerequisites

| Item | Where to get it | Notes |
| --- | --- | --- |
| **Sentry account** | https://sentry.io | Free tier is fine |
| **Organisation + Project** | Sentry dashboard | Name the project `card-show-finder` |
| **DSN** | Project Settings → Client Keys | Copy the HTTPS DSN |
| **Auth Token** | Settings → Developer Settings → Auth Tokens | Create **project:releases** token – used for sourcemap upload |

Add the following to your **`.env`** (copy from `.env.example`):

```
EXPO_PUBLIC_SENTRY_DSN=https://<publicKey>@o<orgId>.ingest.sentry.io/<projectId>
SENTRY_AUTH_TOKEN=<token with project:releases scope>
```

> All keys prefixed with `EXPO_PUBLIC_` are embedded at build-time.  
> Never commit the real `.env`; use the template.

---

## 3. Packages & Configuration

### 3.1 Installed packages

```
npm install @sentry/react-native @sentry/integrations sentry-expo --legacy-peer-deps
```

### 3.2 `app.config.js`

1. **Plugin**:  

```js
plugins: [
  ["expo-location", { … }],
  "sentry-expo"            // 👈 add this
],
```

2. **Extra field & env validation**

```js
extra: {
  sentryDsn: EXPO_PUBLIC_SENTRY_DSN,
  …
}
```

3. **Post-publish hook** (already scaffolded):

```js
hooks: {
  postPublish: [
    {
      file: "sentry-expo/upload-sourcemaps",
      config: {
        organization: "YOUR_SENTRY_ORGANIZATION",
        project: "card-show-finder",
        authToken: process.env.SENTRY_AUTH_TOKEN
      }
    }
  ]
}
```

### 3.3 Project service layer

* **`src/services/sentryConfig.ts`**

  * `initSentry()` – called once in `App.tsx`
  * `setUserContext() / clearUserContext()` – tie errors to signed-in users
  * `captureException()`, `captureMessage()`, `addBreadcrumb()`
  * `startTransaction()` – performance spans

* **`src/components/SentryErrorBoundary.tsx`**

  Re-usable error boundary with friendly UI and “Report Issue” button.

* **`src/components/SentryTester.tsx` & `SentryTestScreen.tsx`**

  QA tool to intentionally trigger errors, messages, breadcrumbs and transactions.

* **`App.tsx`**

  ```tsx
  import { initSentry } from './src/services/sentryConfig';
  …
  useEffect(() => { initSentry(); }, []);
  …
  <SentryErrorBoundary>
    {/* the rest of the providers */}
  </SentryErrorBoundary>
  ```

---

## 4. Building & Releasing

### 4.1 Development

`expo start` – Sentry runs in **debug mode**; events appear in the *development* environment.

### 4.2 EAS build / OTA updates

The **sentry-expo** plugin automatically:

* Injects release & build numbers
* Uploads sourcemaps after `eas build` or `eas update`
* Tags events with `release`, `dist`, `environment`

Nothing else to do.

### 4.3 Manual sourcemap upload (fallback)

```
npx sentry-expo upload-sourcemaps \
  --auth-token=$SENTRY_AUTH_TOKEN \
  --org YOUR_ORG --project card-show-finder \
  --release $(node -p "require('./app.json').expo.version") \
  --dist $(node -p "require('./app.json').expo.android.versionCode")
```

---

## 5. How to Use in Code

```ts
import { captureException, captureMessage, addBreadcrumb } from '../services/sentryConfig';

// handled error
try {
  await saveProfile(data);
} catch (err) {
  captureException(err as Error, { tags: { feature: 'profile' } });
}

// custom info
captureMessage('User opened Map screen', 'info');

// breadcrumbs
addBreadcrumb({ category: 'navigation', message: 'Map → ShowDetail', level: 'info' });
```

### Performance example

```ts
const transaction = startTransaction('loadShows', 'data');
const span = transaction.startChild({ op: 'db', description: 'fetch shows' });
await fetchShows();
span.finish();
transaction.finish();
```

---

## 6. Best Practices

1. **Initialize early** – first line in `App.tsx` inside `useEffect`.
2. **Wrap navigation root** with `SentryErrorBoundary`.
3. **Attach user context** after login:

   ```ts
   setUserContext(profile.id, { email: profile.email, role: profile.role });
   ```

4. **Breadcrumbs**: record significant actions (navigation, important button taps).
5. **PII**: avoid sending raw addresses / phone numbers – scrub or omit.
6. **Sampling**: change `tracesSampleRate` in `initSentry()` (0.2 = 20%).
7. **Batch errors** from React Query with `onError` callbacks.
8. **Native crashes**: Sentry auto-captures them once in release builds.
9. **Release health**: keep `version` in `app.config.js` updated for each store release.

---

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| **No events** in Sentry | Check DSN in `.env`; ensure `initSentry()` runs; disable network proxies |
| **“Missing auth token”** during sourcemap upload | Add `SENTRY_AUTH_TOKEN` env variable or token scope `project:releases` |
| **Unreadable stacks** | Sourcemaps failed: run manual upload (see 4.3) |
| **High event volume** | Lower `tracesSampleRate`; filter noisy errors in `beforeSend` |

---

## 8. Roadmap

* Enable **session replay** once Expo SDK adds support  
* Use **Sentry Performance** dashboards to monitor slow queries in production  
* Hook **release tracking** to GitHub Actions for automated deploy notes

---

Happy debugging! 🎯
