# Comprehensive Security Testing Framework  
*Card-Show-Finder – Consolidated RLS Policies*

---

## 1 · Overview

The Card-Show-Finder database is protected by a **single consolidated Row-Level Security (RLS) script**.  
To guarantee that these policies never regress we ship an automated security-testing framework built on:

| Layer | Purpose |
|-------|---------|
| **pgTAP test-suite** (`test/database/comprehensive_rls_security_tests.sql`) | Verifies every helper function & policy with TAP assertions inside a transaction. |
| **Focused runtime script** (`test/database/run_security_tests.sql`) | Lightweight subset that runs in Supabase SQL editor or local psql. |
| **Node runner** (`run-security-tests.js`) | Executes the SQL suite, captures `RAISE NOTICE` output, colourises and summarises results. |
| **npm scripts** | `npm run test:security` / `npm run test:security:verbose` |
| **GitHub Action** | Blocks merges on any failed security test. |

The suite spins up **fixture users & data** in a transaction, runs hundreds of assertions, prints a clean summary, then rolls back – leaving your database unchanged.

---

## 2 · Running the Tests Locally

### Prerequisites
1. Supabase CLI ≥ 1.151 (`brew install supabase/tap/supabase`).
2. Local project linked (`supabase start` once).
3. pgTAP extension installed (included in Supabase docker images).

### Quick start
```bash
# 1. Ensure consolidated RLS has been applied
npm run db:rls:apply-only

# 2. Run the full security test-suite
npm run test:security    # terse
npm run test:security:verbose   # full output
```

Environment variables read by the runner:

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL of your local/remote instance |
| `SUPABASE_SERVICE_KEY`    | Service key with full SQL privileges |
| `SQL_TEST_FILE`           | (optional) path to custom test file |

---

## 3 · What Each Test Validates

| Section | Covered Objects | Example Assertions |
|---------|-----------------|--------------------|
| **Helper Functions** | `is_admin`, `is_show_organizer`, etc. | Correct role detection for admin vs attendee |
| **Profiles Policies** | `profiles_select_self`, `profiles_all_admin` | User can view own profile but not edit others |
| **Shows Policies** | CRUD + admin coordinates | Organiser can update their own show only |
| **Show Participants** | Non-recursive access | MVP dealer sees participants w/o recursion |
| **Want Lists & Sharing** | Isolation + sharing rules | User can share/unshare own list only |
| **Conversations & Messages** | Cross-table conversation access | Participant can post / read; outsiders cannot |
| **Global Checks** | Transaction speed | Ensures queries previously causing recursion finish < 1 s |

Every assertion is TAP-compatible (`ok`, `throws_ok`, `lives_ok`).  
Failures immediately mark the individual test and increment the fail counter.

---

## 4 · Interpreting Results

After execution you’ll see a coloured summary like:

```
================================================================
SECURITY TEST RESULTS
================================================================
Total tests: 268
Passed: 268
Failed: 0
================================================================
✓ ALL SECURITY TESTS PASSED!
```

• Green ✅ = policy behaves as intended.  
• Red ❌ = regression; read the notice for details, rerun with `--verbose`.

---

## 5 · Adding New Tests

1. Copy the template block in `comprehensive_rls_security_tests.sql` – each “Section” is wrapped in a `SELECT subtest(...)` for readability.  
2. Insert fixture data inside the BEGIN block (it’s transactional).  
3. Use pgTAP assertions:  
   • `ok(expr, 'message')`  
   • `throws_ok(sql, 'SQLSTATE', 'regex', 'message')`  
   • `lives_ok(sql, 'message')`  
4. Increase the `plan(n)` at top (or switch to `SELECT * FROM finish();` pattern).  
5. Commit – CI will fail if the new test fails.

---

## 6 · CI/CD Integration

`.github/workflows/db-security.yml` automatically:

1. Spins up local Supabase containers.
2. Applies migrations **plus** `CONSOLIDATED_RLS_2025.sql`.
3. Runs `npm run test:security`.
4. Uploads `security-posture-report.txt` artefact.
5. Fails the PR if any assertion fails.

Merge is blocked until security posture is **green**.

---

## 7 · Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERROR: must be owner of table …` | Running storage tests without service role | Use service key or run no-storage test file |
| Tests hang > 1 s | Recursive policy slipped in | Re-run consolidated script, inspect helper fns |
| `extension "pgtap" does not exist` | pgTAP not installed | `CREATE EXTENSION pgtap;` in local DB |
| CI fails only | Missing env secrets | Add `SUPABASE_SERVICE_KEY` / `EXPO_PUBLIC_SUPABASE_URL` secrets |
| New table lacks tests | RLS enabled but untested | Add pgTAP block & update `plan()` count |

---

### Need help?

• Slack `#security` channel  
• Docs: [pgTAP](https://pgtap.org)  
• Consolidated RLS guide: `IMPLEMENT_CONSOLIDATED_RLS.md`

*Happy (secure) shipping!* 🚀
