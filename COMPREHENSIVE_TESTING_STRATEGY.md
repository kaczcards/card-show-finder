# Comprehensive Testing Strategy  
Card-Show-Finder · July 2025  

This document defines **what we test, when we test, and how we test** – in
_lean, bite-sized segments_ that give fast feedback and isolate failures.
It is designed to run **locally** and inside the new GitHub Actions
pipeline.

---

## 1 · Test Segments & Purpose

| Segment | Scope | Key Tools | Average Run-time* | Blocking? |
|---------|-------|-----------|-------------------|-----------|
| **1. Lint** | Static code quality (JS/TS) | ESLint | **15-20 s** | ✅ |
| **2. Type Check** | Type safety (TS) | `tsc --noEmit` | **25-35 s** | ✅ |
| **3. Unit** | Pure functions, reducers, helpers | Jest | **35-45 s** | ✅ |
| **4. DB Unit** | Supabase SQL, pgTAP assertions | pgTAP via `psql` | **40-60 s** | ✅ |
| **5. Integration API** | Network, auth, DB round-trips | Jest + Supertest | **60-90 s** | ✅ |
| **6. DB Security** | RLS, auth bypass, SQLi patterns | pgTAP + custom scripts | **45-60 s** | ✅ |
| **7. E2E Auth** | Login, registration, password flows | Detox (iOS sim) | **3-4 min** | ✅ |
| **8. E2E Core** | Search, browse, maps, CRUD | Detox batches | **4-5 min** | ✅ |
| **9. E2E Edge** | Offline, error-states, stress | Detox batches | **5-6 min** | ⚠️ *non-blocking* |
| **10. Performance** | Startup, render, DB latency | Detox perf logger | **2-3 min** | ⚠️ |
| **11. Security Scan** | deps, secrets, CodeQL | npmaudit/Gitleaks/CodeQL | **2-4 min** (CI) | ⚠️ |
| **12. Build Verification** | Hermes config, prebuild sanity | EAS prebuild | **1-2 min** | ✅ |

\* Times measured on M1 Mac & `ubuntu-latest` runners; scale as hardware varies.

---

## 2 · Execution Order

```
Lint ─▶ TypeCheck ─▶ Unit ─▶ DB-Unit ─▶ Integration-API ─▶ DB-Security
                                             │
                                             ▼
                                +───────────▶E2E-Auth
                                │            ▼
                                │      E2E-Core
                                │            ▼
                                │      E2E-Edge (non-blocking)
                                ▼
                           Performance (non-blocking)
```

`Security Scan` and `Build Verification` run **in parallel** once Unit &
Integration segments succeed.

---

## 3 · npm Scripts

Add to **package.json** (or update if already present):

```jsonc
"scripts": {
  /* --- Core quality --- */
  "test:lint":      "eslint . --ext .js,.jsx,.ts,.tsx",
  "test:type":      "tsc --noEmit",
  "test:unit":      "jest --runInBand --selectProjects unit",
  /* --- Database --- */
  "test:db:unit":   "npm run db:rls:verify && pg_prove test/database/**/*.sql",
  "test:db:security": "node simple-security-test-runner.js",
  /* --- Integration API --- */
  "test:api":       "jest --runInBand --selectProjects api",
  /* --- E2E (Detox batches already exist) --- */
  "test:e2e:auth":  "npm run test:e2e:batch -- --batch auth-basic",
  "test:e2e:core":  "npm run test:e2e:batch -- --batch core",
  "test:e2e:edge":  "npm run test:e2e:batch -- --batch edge",
  /* --- Performance --- */
  "test:perf":      "node e2e/scripts/run-batch.js --batch perf --perf",
  /* --- Security scan (CLI) --- */
  "test:sec":       "npm audit --audit-level=high && gitleaks detect --no-banner",
  /* --- Master orchestrators --- */
  "test:fast":      "npm-run-all -s test:lint test:type test:unit",
  "test:ci":        "npm-run-all -s test:lint test:type test:unit test:db:unit test:api test:db:security",
  "test:full":      "npm-run-all -s test:ci test:e2e:auth test:e2e:core test:e2e:edge test:perf test:sec"
}
```

> `npm-run-all` is a tiny dev-dependency for sequential orchestration  
> `pg_prove` ships with pgTAP (already installed in CI).

---

## 4 · Segment Details

### 4.1 Lint
* **Goal**: catch stylistic & potential bug patterns instantly.
* **Config**: `.eslintrc.json`, extended with `plugin:security/recommended`.

### 4.2 Type Check
* Prevents runtime errors from TS mis-typing.
* Runs strict `tsc --noEmit`.

### 4.3 Unit
* Jest **unit** project filters files ending in `.unit.test.(ts|js)`.
* Mock external modules; no network / DB.

### 4.4 Database Unit
* Uses **pgTAP**; tests live schema in ephemeral Postgres container.
* Asserts **functions, views, triggers** behave as expected.

### 4.5 Integration API
* Spins up Supabase locally (or mocks) & tests REST/RPC endpoints.
* Ensures auth tokens, DB side-effects, network error handling.

### 4.6 Database Security
* Executes `test/database/comprehensive_rls_security_tests.sql`.
* Fails if RLS or privilege escalation vulnerabilities detected.

### 4.7-4.9 E2E (Detox)
* **Auth** batch – login, register, forgot pwd, session persistence.  
* **Core** batch – browse shows, map display, create/update.  
* **Edge** batch – airplane mode, network failures, rapid user churn.

Each Detox batch is defined in `e2e/config/batches.js` and can run in
parallel on CI via a **matrix** (see below).

### 4.10 Performance
* Uses Detox performance hooks to measure:
  * Cold-start time
  * First useful UI render
  * Critical screen navigation
* Fails if >20 % regression vs baseline (stored in JSON).

### 4.11 Security Scan
* `npm audit`, OWASP Dependency-Check, Gitleaks, CodeQL static analysis.

### 4.12 Build Verification
* `expo prebuild --clean` for **ios** & **android**.  
* Greps for `hermesEnabled=true` / `"expo.jsEngine":"hermes"`.

---

## 5 · Parallel Execution in CI

Excerpt from **ci.yml**:

```yaml
jobs:
  e2e-tests:
    strategy:
      matrix:
        batch: [auth, core, edge]
    steps:
      - run: npm run test:e2e:batch -- --batch ${{ matrix.batch }}
```

Unit, DB, and API suites can also use `matrix: node-version: [18, 20]` for
version coverage if desired.

---

## 6 · Timing & Gates

| Stage | Expected Wall-clock | CI Gate |
|-------|---------------------|---------|
| Quality (1-3) | ~1 min | Must pass |
| DB + API (4-6) | ~3 min | Must pass |
| E2E Auth/Core (7-8) | ~9 min | Must pass on `main`, optional on PR |
| E2E Edge (9) | ~6 min | Non-blocking; surfaces warnings |
| Perf + Security (10-11) | ~6 min | Warnings block release only |
| Build Verify (12) | ~2 min | Must pass |

Total *blocking* time on PR ≈ **13-14 minutes**.

---

## 7 · Local Developer Workflows

| Task | Command | Notes |
|------|---------|-------|
| Quick sanity before commit | `npm run test:fast` | ≤ 1 min |
| Full verification | `npm run test:full` | ~25 min |
| Specific Detox batch | `npm run test:e2e:batch -- --batch auth-basic` | |
| Re-record perf baseline | `npm run test:perf -- --update-baseline` | |

---

## 8 · Maintenance Guidelines

1. **Add tests to correct segment** – keep cycles short (<60 s per test file).
2. **Update estimates quarterly** – reflect device & runner speed.
3. **Retire flaky E2E tests** quickly – quarantine via `--batch edge`.
4. **Benchmark performance baseline** after major React Native upgrades.
5. **Review security scan reports weekly** – fix critical CVEs promptly.

---

### Happy Testing 🎯
