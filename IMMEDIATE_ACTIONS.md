# 🚨 IMMEDIATE ACTIONS
Card-Show-Finder · July 2025  

These items **block all further testing and CI merges**.  
Tackle them in the order shown – each unblocks the next layer of tests.

| # | Owner | Task | Why it’s Urgent | ETA |
|---|-------|------|-----------------|-----|
| 1 | iOS / Native | **Fix iOS JS-engine conflict** in `ios/Podfile.properties.json`  <br/>• Remove `"expo.jsEngine": "jsc"`  <br/>• Keep a single `"expo.jsEngine": "hermes"`  <br/>• Ensure `"newArchEnabled": "false"` | Prebuild currently toggles back to JSC → native crashes & build-verify failure | 10 min |
| 2 | Android / Native | **Lock Hermes settings** in `android/gradle.properties`  <br/>• `hermesEnabled=true`  <br/>• `newArchEnabled=false`  <br/>Commit the file after change | Expo prebuild rewrites values if file is missing/dirty.  Needed for parity with iOS | 5 min |
| 3 | Tooling | **Add missing dev-dependencies**  ```bash npm i -D eslint eslint-plugin-react @typescript-eslint/{parser,eslint-plugin} jest ts-jest @types/jest npm-run-all ``` | Lint, type & unit segments fail instantly → blocks PR checks | 8 min |
| 4 | FE / TS | **Create minimal Jest config**  ```bash npx jest --init   # choose ts, node, coverage=Y ```  Add first smoke test (`__tests__/smoke.unit.test.ts`) returning `true === true`. | Allows `unit` segment to run & expose real test failures instead of “jest not found” | 10 min |
| 5 | Backend | **Patch `simple-security-test-runner.js`**  <br/>• Replace deprecated `supabase.sql` with `supabase.rpc` or query builder  <br/>• Verify connection using `supabase.from('table').select().limit(1)` | `db:security` segment crashes (“supabase.sql is not a function”) → hides RLS issues | 15 min |
| 6 | CI / Tooling | **Persist Hermes after prebuild**  <br/>Add step in `scripts/test-build-verify.js` and CI to re-apply Hermes if prebuild flips it. | Prevents future drift, keeps build-verify passing | 10 min |

---

## Quick Verification Path

1. Run `npm run test:segments -- build --fix` → should pass ✅  
2. Run `npm run test:segments -- lint type unit` → all three pass ✅  
3. Run `npm run test:segments -- db:security` → passes ✅  

Once the above three checkpoints are green, proceed with remaining checklist in `TESTING_CHECKLIST.md`.
