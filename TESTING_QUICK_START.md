# 🧪 Testing Quick Start

Welcome to the **Segmented Testing** workflow for Card-Show-Finder!  
Follow this guide to validate changes quickly, isolate failures, and keep PRs green.

---

## 1 · Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node | 18 LTS | `nvm install 18` |
| Yarn/NPM | latest | `corepack enable` |
| Detox CLI | ≥ 20 | `npm i -g detox-cli` |
| Expo CLI | ≥ 6 .3 | `npm i -g expo-cli` |
| pgTAP (optional local DB tests) | ≥ 1.2 | `brew install pgtap` |

After cloning the repo:

```bash
npm ci          # install JS deps
git submodule update --init --recursive
```

---

## 2 · Key Commands

| Purpose | Command | Wall-clock |
|---------|---------|-----------|
| **Instant sanity** (lint + type + unit) | `npm run test:fast` | ≈ **1 min** |
| **PR Gate** (all blocking segments) | `npm run test:ci` | ≈ **13 min** |
| **Full regression** (every segment) | `npm run test:full` | ≈ **25 min** |
| **Custom** (choose segments) | `npm run test:segments -- lint unit e2e:auth` | varies |

`npm run test:segments` is a wrapper around `scripts/test-segments.js`.  
Run `node scripts/test-segments.js --help` for all flags.

### Handy Flags

```
--parallel       # run compatible segments concurrently
--fail-fast      # stop on first blocking failure
--timing-only    # suppress test output, just show timing
--report=out.json# write JSON summary
```

Example: run critical path tests in parallel and fail-fast:

```bash
npm run test:segments -- critical --parallel --fail-fast
```

---

## 3 · Common Scenarios

| Scenario | Command |
|----------|---------|
| Before pushing a small fix | `npm run test:fast` |
| Working on DB schema | `npm run test:segments -- db:unit db:security` |
| Debugging login bug | `npm run test:e2e:auth` |
| Measuring perf regressions | `npm run test:segments -- perf --update-baseline` |
| Smoke test on feature branch | `npm run test:segments -- smoke --parallel` |

---

## 4 · Segment Overview & Timing

| Segment | What it covers | Blocking | Est. time |
|---------|----------------|----------|-----------|
| lint           | ESLint static analysis                     | ✅ | 20 s |
| type           | TypeScript compiler checks                | ✅ | 35 s |
| unit           | Pure JS/TS logic (Jest)                   | ✅ | 45 s |
| db:unit        | pgTAP tests on DB functions               | ✅ | 60 s |
| api            | Integration – Auth & REST ↔ DB            | ✅ | 90 s |
| db:security    | RLS & privilege escalation checks         | ✅ | 60 s |
| e2e:auth       | Detox – login/registration flows          | ✅ | 3 min |
| e2e:core       | Detox – browse/maps/CRUD                  | ✅ | 4 min |
| e2e:edge       | Detox – offline / error states            | ⚠️ | 5 min |
| perf           | Startup & navigation timing               | ⚠️ | 3 min |
| security       | npm audit, Gitleaks, CodeQL               | ⚠️ | 4 min |
| build          | Hermes & prebuild verification            | ✅ | 2 min |

⚠️ Non-blocking segments report warnings but don’t fail PRs.

---

## 5 · Troubleshooting Tips

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `pg_prove: command not found` | pgTAP missing | `brew install pgtap` |
| Detox fails to launch simulator | Xcode update / cache | `detox clean-framework-cache && detox build` |
| `address already in use` on DB ports | Local Postgres running | `pg_ctl stop` or change port in `.env.local` |
| E2E timeouts on CI | network-heavy tests | Re-run, increase `DETOX_SERVER_PORT_RANGE` |
| `HermesEnabled=false` after prebuild | Config drift | `npm run test:build:verify --fix` |
| Unexpected ESLint rules | Editor using old eslint | `rm -rf node_modules/.cache && npm ci` |

---

## 6 · CI Integration

GitHub Actions invokes the same segments:

```
ci.yml
 ├─ lint-and-typecheck
 ├─ unit-tests
 ├─ database-tests
 ├─ e2e-tests (matrix: auth, core, edge)
 ├─ build-verification
 └─ notify
```

Failures visible in Checks tab and Slack alerts.

---

## 7 · Need Help?

* **Script help**: `node scripts/test-segments.js --help`
* **Detox docs**: https://wix.github.io/Detox/docs
* **pgTAP**: https://pgtap.org/documentation.html
* **Ask in Slack**: `#csf-dev`

Happy testing — keep it green! 🎯
