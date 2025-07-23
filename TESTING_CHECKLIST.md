# 📋 Testing Checklist – Small, Actionable Segments  
Card-Show-Finder · July 2025  

Use this list to work through all test segments in **5-15 minute bites**.  
Check each item off as you complete it.

---

## Legend  

- [ ] ⬜ – Task not started  
- [x] ✅ – Completed  
- ⏱️ Estimated time

---

## 0 · Global Prerequisites (once per machine)

| Task | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Install Node 18 `nvm install 18` | 5 m | `node -v` → `v18.x` | Wrong version → `nvm use 18` |
| [ ] Install Expo CLI `npm i -g expo-cli@latest` | 5 m | `expo --version` | Proxy issues → set `npm config set https-proxy` |
| [ ] Install Detox CLI `npm i -g detox-cli` | 5 m | `detox --version` | Xcode CLT missing |
| [ ] Install pgTAP `brew install pgtap` | 10 m | `pg_prove --version` | Linux: build from source |
| [ ] Clone repo & `npm ci` | 10 m | Tests run | Ensure only one lock-file |

---

## 1 · Lint Segment (`lint`)

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Install ESLint deps `npm i -D eslint eslint-plugin-react @typescript-eslint/{parser,eslint-plugin}` | 10 m | `npm run lint` exits 0 | Plugin missing → reinstall |
| [ ] Run **lint** `npm run test:segments -- lint` | 2 m | “✅ lint passed” | Auto-fix: `npm run lint -- --fix` |

---

## 2 · Type Segment (`type`)

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Fix top-10 TS errors (see `npm run typecheck`) | 15 m | `npm run test:segments -- type` → ✅ | Unknown packages → add `@types/*` |
| [ ] Repeat until **type** passes | — | — | Use `ts-ignore` only as last resort |

---

## 3 · Unit Tests (`unit`)

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Install Jest deps `npm i -D jest @types/jest ts-jest` | 10 m | `npx jest --init` done | Config error → delete `jest.config.js` & re-init |
| [ ] Add first test in `__tests__/smoke.unit.test.ts` | 5 m | `npm run test:segments -- unit` passes | “jest not found” → reinstall |
| [ ] Convert legacy tests to `.unit.test.ts` | 15 m ea. | Coverage increases | Async failures → use `await` |

---

## 4 · DB Unit (`db:unit`)

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Start local Postgres `docker compose up db` | 5 m | `psql` connects | Port conflict → change 5432 |
| [ ] Run `npm run test:segments -- db:unit` | 5 m | pgTAP summary all ✓ | Missing extension → `CREATE EXTENSION pgtap` |

---

## 5 · API Integration (`api`)

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Install supertest `npm i -D supertest` | 5 m | Test file imports | Fetch fails → set `.env.test` |
| [ ] Write smoke: GET `/health` returns 200 | 10 m | `npm run test:segments -- api` passes | Timeouts → increase `jest.setTimeout` |

---

## 6 · DB Security (`db:security`)

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Fix Supabase helper in `simple-security-test-runner.js` (`createClient` then `client.rpc`) | 10 m | `npm run test:segments -- db:security` passes | “supabase.sql is not a function” → replace with `client.rpc` |
| [ ] Review failing RLS assertions & patch policies | 15 m ea. | pgTAP green | Use `ALTER POLICY` |

---

## 7 · E2E Auth (`e2e:auth`)

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Open iOS simulator once (Xcode) to cache download | 5 m | Device boots | Licenses prompt → accept |
| [ ] Run `npm run test:e2e:build` | 10 m | Build succeeds | “detox-ios”: update Xcode |
| [ ] Execute segment `npm run test:segments -- e2e:auth` | 8 m | All tests pass | flake → `detox retry-all` |

---

## 8 · E2E Core (`e2e:core`)

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Ensure location permissions mocked (`ios/.detoxrc`) | 5 m | Core tests stable | Location dialogs show → add `permissions` |
| [ ] Run segment `npm run test:segments -- e2e:core` | 10 m | Passes | Increase `idleTimeout` for map load |

---

## 9 · E2E Edge (`e2e:edge`) ⚠️ non-blocking

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Simulate airplane-mode script (`edge/offline-mode.test.js`) | 10 m | Fails gracefully | Crash → guard `NetInfo` listeners |
| [ ] Segment run `npm run test:segments -- e2e:edge` | 8 m | Fails only on known issues | Mark flaky with `jest.retryTimes` |

---

## 10 · Performance (`perf`) ⚠️ non-blocking

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Record baseline `npm run test:segments -- perf --update-baseline` | 5 m | `perf-baseline.json` updated | File missing → create empty `{}` |
| [ ] Add >20 % regression guard in script | 10 m | CI warns on slowdown | Noise → raise threshold |

---

## 11 · Security Scan (`security`) ⚠️ non-blocking

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Install gitleaks `brew install gitleaks` | 5 m | `gitleaks version` | Mac M1: use `--build-from-source` |
| [ ] Run `npm run test:segments -- security` | 4 m | No high CVEs | Ignore dev deps: add `.github/dependabot.yml` |

---

## 12 · Build Verification (`build`)

| Step | ⏱️ | Validate | Troubleshoot |
|------|----|----------|--------------|
| [ ] Run `npm run test:segments -- build --fix` | 2 m | “✅ BUILD VERIFICATION PASSED” | Hermes overwritten → commit gradle & podfile |
| [ ] Commit config changes (`gradle.properties`, `Podfile.properties.json`) | 3 m | `git diff` clean | Prebuild resets → re-run with `--fix` |

---

## ✅ Completion Criteria

- All **blocking** segments pass locally & in CI  
- Non-blocking segments produce **no new warnings** for two consecutive runs  
- `npm run test:ci` finishes ≤ 15 min  

Tick every box above ➜ **full regression test suite complete!**
