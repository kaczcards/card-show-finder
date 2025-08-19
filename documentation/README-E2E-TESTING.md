# End-to-End (E2E) Testing Guide

Card-Show-Finder uses **Detox + Jest** for fully automated, device-level tests.  
All tests live in `e2e/` and are organised into **batches** that can be executed independently so a full suite can be split into ~1-hour chunks.

## 1. Prerequisites

| Tool | Version | Notes |
| ---- | ------- | ----- |
| Node | 18 LTS / 20 LTS | Same as project |
| Xcode | 14 + | iOS simulator builds |
| Android SDK | latest | Only if you want Android E2E |
| `npx expo` | bundled | No global install needed |
| Apple Simulator *iPhone 16 Plus* | | Detox default |
| Supabase Test Project | optional | Tests seed data if env keys present |

### Install dependencies

```bash
npm ci
# or
yarn install
```

## 2. Directory Overview

```
e2e/
├── tests/           # actual test files (JS)
│   └── auth/        #     └── registration.test.js, …
├── helpers/         # shared Detox helpers
├── config/
│   └── batches.js   # batch definitions & helpers
├── scripts/         # CLI utilities for running batches
│   ├── run-batch.js
│   └── run-all-batches.js
├── artifacts/       # screenshots, traces, logs
└── reports/         # JSON & HTML summaries
```

## 3. Batch System

The **batch system** lives in `e2e/config/batches.js`.

Each entry:

```js
{
  name: "auth-basic",
  description: "Basic authentication flows",
  testFiles: [
    "auth/registration.test.js",
    "auth/login.test.js",
    "auth/logout.test.js"
  ],
  estimatedTime: 45,          // minutes
  tags: ["auth", "critical"],
  priority: 1                 // lower = runs first
}
```

`status: "planned"` marks placeholder batches whose tests are not yet implemented.

### Why batches?

• Finer-grained progress reporting  
• Run only what you need locally  
• Splits CI job into parallel or sequential 1-hour chunks

## 4. NPM Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run test:e2e:build` | Build the iOS debug app for Detox |
| `npm run test:e2e` | Run **all** tests in a single Jest run (slow) |
| `npm run test:e2e:batch -- --batch auth-basic` | Run one batch |
| `npm run test:e2e:auth` | Convenience shortcut for the first auth batch |
| `npm run test:e2e:auth-advanced` | Runs the second auth batch |
| `npm run test:e2e:tag -- --tag auth` | Run every batch with the *auth* tag |
| `npm run test:e2e:all` | Sequentially run every active batch with progress & HTML report |

*(Anything after `--` is forwarded to the underlying script.)*

### Common Options

```
--device        ios.sim.debug   # or android.emu.debug
--timeout       60              # max minutes for a batch
--batch-timeout 60              # per-batch timeout when using run-all
--total-timeout 480             # global timeout (run-all)
--verbose                       # very chatty logging
--report=false                  # skip HTML generation
```

## 5. Running Examples

### 5.1 Single Batch

```bash
# registration + login + logout (~45 min)
npm run test:e2e:batch -- --batch auth-basic
```

### 5.2 All Auth-related Batches

```bash
npm run test:e2e:tag -- --tag auth
```

### 5.3 Full Suite Over-Night

```bash
npm run test:e2e:all -- --device ios.sim.debug --batch-timeout 60
```

### 5.4 CI (GitHub Actions) Snippet

```yaml
- name: Build Detox app
  run: npm run test:e2e:build

- name: Run E2E (critical path)
  run: npm run test:e2e:batch -- --batch auth-basic --device ios.sim.debug --timeout 60
```

## 6. Interpreting Results

### Console Output

* **PASS ✔︎ / FAIL ✕** lines appear for every Jest test.
* After each batch you’ll see:

```
Batch auth-basic completed in 43.21 minutes
Status: SUCCESS
```

### Artifacts

Location: `e2e/artifacts/<Detox-timestamp>/`

* `detox.log` – low-level device log
* `*.trace.json` – performance timeline
* Screenshots for every test (start / failure / done)

### Reports

`e2e/reports/<timestamp>/`

```
└── auth-basic-results.json    # machine readable
└── report.html                # pretty dashboard
```

Open the HTML in any browser; green = success, red = failure.  
A progress bar at the top shows overall pass rate.

## 7. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| **“Simulator not found”** | Ensure *iPhone 16 Plus* is available → Xcode → Window → Devices |
| **Hangs on build** | `detox clean-framework-cache && detox build …` |
| **Supabase data missing** | set `EXPO_PUBLIC_TEST_SUPABASE_*` keys or disable test DB seeding in `e2e/setup.js` |
| **Timeout reached** | Increase `--timeout`, split batch, or use `--verbose` to see stuck test |

## 8. Adding New Tests

1. Place the spec under `e2e/tests/<area>/`.
2. Add its relative path to the appropriate batch in `batches.js`.
3. Ensure **estimatedTime** is updated so batch-duration forecasting stays accurate.
4. Run the batch locally:  
   `npm run test:e2e:batch -- --batch your-batch-name`

## 9. Helpful Tips

* **Iterate quickly:** `detox test --configuration ios.sim.debug --file e2e/tests/auth/login.test.js`
* **Skip flaky test:** prefix with `it.skip(…)` while investigating.
* **Only run one test:** `it.only(…)`.
* **Auto-open HTML report:**  

  ```bash
  open $(ls -td e2e/reports/*/ | head -1)/report.html
  ```

Happy testing! 🚀
