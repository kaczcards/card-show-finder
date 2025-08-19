# Pull Request – Introduce Detox **E2E Batch Testing** System

## 📑  Summary  
This PR refactors our Detox end-to-end tests into a **batch-based execution system** that splits the suite into logical groups running in ~1 hour intervals.  
It solves the _“E2E ran for 10 h with no update”_ pain-point by:

* keeping each run short & focused  
* producing incremental HTML/JSON reports per batch  
* enabling parallel / selective execution in CI & local dev  
* giving reviewers a clear map of what is covered today and what is still planned

Everything lives **inside `e2e/`** and is **100 % additive** – no production code touched.

---

## 🗒️  Motivation

| Problem | Impact |
|---------|--------|
| Single monolithic test file (`authentication.test.js`, 790 LOC) | 10 h wall-clock, impossible to debug failures mid-run |
| No way to run only a subset locally | High dev friction, low test adoption |
| CI timeout risk | Flaky pipelines, slow feedback |
| Missing progress visibility | Reviewers can’t tell what’s executed or how long it took |

Batch execution addresses all of the above while laying the foundation for future feature-area tests (Home, Map, Shows, etc.).

---

## 🏗️  Implementation Details

### 1. Directory Structure

```
e2e/
├── tests/               # grouped specs
│   └── auth/            # registration.test.js, login.test.js, …
├── config/
│   └── batches.js       # master definition of batches
├── scripts/
│   ├── run-batch.js     # run one batch
│   └── run-all-batches.js
├── artifacts/           # screenshots / traces  (git-ignored; .gitkeep)
└── reports/             # HTML & JSON summaries (git-ignored; .gitkeep)
```

### 2. New Test Files  
The original giant spec is now split into **6 atomic specs** inside `tests/auth/`:

* `registration.test.js`
* `login.test.js`
* `logout.test.js`
* `password-reset.test.js`
* `session-persistence.test.js`
* `error-handling.test.js`

### 3. `batches.js`

```js
{
  name: "auth-basic",
  testFiles: ["auth/registration.test.js", "auth/login.test.js", "auth/logout.test.js"],
  estimatedTime: 45,  // minutes
  tags: ["auth", "critical-path"],
  priority: 1
}
```

Two active batches ship in this PR:

| Batch | What it covers | Est. time |
|-------|----------------|-----------|
| **auth-basic**     | happy-path registration / login / logout | 45 min |
| **auth-advanced**  | password reset, session persistence, error & edge cases | 50 min |

Further batches are scaffolded (`home-navigation`, `show-listings`, etc.) with `status: "planned"` to keep roadmap visible.

### 4. Batch Runners

* **`run-batch.js`** – executes one batch, streams log, enforces per-batch timeout, writes JSON & HTML report.
* **`run-all-batches.js`** – sequentially processes every active batch (or filtered list) with global timeout & prompts when exceeding time budget.

Both scripts are node-based (no external deps) and create timestamped reports under `e2e/reports/`.

### 5. npm Scripts

```json
"test:e2e:batch": "node e2e/scripts/run-batch.js",
"test:e2e:auth":  "npm run test:e2e:batch -- --batch auth-basic",
"test:e2e:all":   "node e2e/scripts/run-all-batches.js"
```

### 6. Reporting

* **Console** – PASS/FAIL per test & per batch with colorful summary  
* **JSON** – machine-readable results for CI artefacts  
* **HTML** – polished dashboard (progress bar, per-batch tables) for manual review

---

## 🚀  How to Use

### Local Dev

```bash
# Build once (same as before)
npm run test:e2e:build

# Fast smoke test (~45 min)
npm run test:e2e:auth             # runs auth-basic batch

# Any batch
npm run test:e2e:batch -- --batch auth-advanced

# All active batches overnight
npm run test:e2e:all -- --batch-timeout 60
```

Flags:  
`--device ios.sim.debug`  |  `--timeout 90`  |  `--tag auth`  |  `--report=false`  |  `--verbose`

### CI Example (GitHub Actions)

```yaml
- name: Build Detox app
  run: npm run test:e2e:build

- name: Run critical auth batch
  run: npm run test:e2e:batch -- --batch auth-basic --device ios.sim.debug --timeout 60
  # upload e2e/reports/** as artifact
```

Scale out by launching multiple matrix jobs, each with a different batch name.

---

## 🔍  Reviewer Checklist

1. **Directory additions only** – verify no app code changed.
2. **`package.json` scripts** – confirm no conflicts.
3. **`batches.js`** – sanity-check paths & estimated times.
4. **Runner scripts** – review for shell-exec security (uses `execSync`).
5. **.gitignore** – new exclusions for artifacts & reports.

---

## 🛣️  Next Steps

* Flesh out _planned_ batches (Home, Map, Shows, Profile).  
* Enable parallelism in CI to bring wall-clock under 30 min.  
* Add Android configuration once iOS green.  
* Migrate screenshots to S3 for long-term retention.

---

### 📌  TL;DR

E2E now runs in **bite-sized, trackable batches**.  
Start with:

```bash
npm run test:e2e:auth
```

and inspect the shiny `e2e/reports/<timestamp>/report.html`!  

Happy (faster) testing 🚀
