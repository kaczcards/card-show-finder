# Database Security Tests Guide

Welcome to the definitive reference for the **Card Show Finder** database-security test-suite.  
This document answers the **what, why and how** of the tests so every developer can confidently evolve our Supabase-backed data-layer without breaking the security contracts that keep user data safe.

---

## 1. What Are the Database Security Tests?

* **pgTAP-based regression tests** – Hundreds of assertions written in SQL that exercise row-level-security (RLS) policies, helper functions (`is_admin()`, `participates_in_show_safe()`…), triggers and cross-table relationships.
* **Defense in depth** – We verify *read, write, update and delete* privileges for every actor (anon, attendee, dealer, MVP dealer, show organizer, admin).
* **Executable specification** – The tests encode our security model in code; if a future migration violates a rule, the pipeline fails immediately.

---

## 2. The Issue That Was Fixed (Supabase SQL API Problem)

Historically the test-runner attempted to execute:

```js
const { data, error } = await supabase.sql(sqlString);
```

`@supabase/supabase-js` **does not expose a `.sql()` method** in production projects (it is only available inside the Supabase CLI runtime).  
This left the runner unusable in CI, blocking the entire *database-tests* job.

### Fix

1. **Replaced** the API call with a raw `psql` invocation executed through `child_process.execSync`.
2. Added explicit Postgres connection variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`).
3. Bundled a helper script `scripts/setup-local-db-tests.sh` to spin up Postgres (Docker or local), install pgTAP, apply the consolidated schema and launch the runner.

---

## 3. Running the Tests Locally

### Quick Start (one-liner)

```bash
./scripts/setup-local-db-tests.sh --docker
```

The script will:
1. Start a `postgres:14` container `card-show-finder-pg` (if not running).
2. Create a database `card_show_finder_test`.
3. Install the `pgtap` & `uuid-ossp` extensions.
4. Apply `supabase/migrations/20250722000000_canonical_database_consolidation.sql`.
5. Execute **all** security tests via `npm run test:db:security`.

Exit code `0` ⇒ all tests passed.

### Manual Flow

```bash
# 1. Ensure Postgres is running on localhost:5432
export PGPASSWORD=postgres

# 2. Prepare schema
psql -h localhost -U postgres -d postgres \
     -f supabase/migrations/20250722000000_canonical_database_consolidation.sql

# 3. Install pgTAP (one-off)
psql -h localhost -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

# 4. Run the tests
npm run test:db:security
```

Environment variables used by the runner (defaults in brackets):

| Var            | Purpose                        |
| -------------- | ------------------------------ |
| `PGHOST`       | Postgres host [`localhost`]    |
| `PGPORT`       | Port [`5432`]                  |
| `PGUSER`       | User [`postgres`]              |
| `PGPASSWORD`   | Password [`postgres`]          |
| `PGDATABASE`   | Database [`postgres`]          |
| `SQL_TEST_FILE`| Path to SQL suite [`test/database/run_security_tests.sql`] |

---

## 4. How CI/CD Executes Them

* **Job** :`database-tests` in `.github/workflows/ci.yml`
* **Services** : Spawns a disposable `postgres:14` container.
* **Steps**  
  1. Installs pgTAP and the Supabase schema.  
  2. Runs `npm run test:db:security`.  
  3. The runner parses the test summary (`Total tests / Passed / Failed`) from `psql` output and sets the job’s exit code.  

Downstream jobs (`e2e-tests`, `build-verification`) depend on the success of `database-tests`.

---

## 5. What Exactly Do the Tests Validate?

| Section | Table / Function                  | Example Assertions                                                                      |
| ------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| 2       | Helper Functions                  | `is_admin()` returns true *only* for admins                                              |
| 3       | `profiles` RLS                    | Users update **own** profile, admins update **any**                                      |
| 4       | `shows` RLS                       | Organizers manage their shows, others cannot                                             |
| 5       | `user_favorite_shows`             | Attendees create/delete favorites; organizer/MVP dealer read favorites for their shows   |
| 6       | `show_participants`               | Infinite-recursion policy replaced; registration rules enforced                          |
| 7       | `want_lists` / `shared_want_lists`| Ownership & sharing semantics                                                            |
| 9-11    | Messaging (`conversations`, `messages`) | Participants only; no impersonation                                                     |
| 12-14   | Reviews, Series, Planned Attendance| Attend-to-review linkage + organizer visibility                                          |
| 15-16   | Cross-table / Edge cases          | Attempts to escalate privileges explicitly blocked                                       |

> Total: **~200 pgTAP tests** executed in a single SQL file inside a transaction (rolled back automatically).

---

## 6. Troubleshooting

| Symptom                                             | Possible Cause / Fix                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `psql: FATAL: role "postgres" does not exist`       | Local Postgres missing `postgres` superuser → create it or export `PGUSER`/`PGPASSWORD`.  |
| `ERROR: extension "pgtap" does not exist`           | Install pgTAP (`brew install pgtap` or via script) and `CREATE EXTENSION pgtap;`.         |
| Tests hang / infinite loop                          | Accidentally reverted **non-recursive** RLS policy; re-apply consolidated migration.      |
| CI job fails with *Cannot resolve host*             | GitHub runner DNS hiccup – re-run, or ensure the container service block is unchanged.    |
| New table not covered by tests                      | See “Adding new tests” below – missing coverage treated as technical debt.               |

---

## 7. Adding New Security Tests

1. **Extend the schema** in a new migration file.  
2. **Update RLS policies** (`consolidated-rls-policies.sql` or table-level migrations).  
3. **Augment** `test/database/run_security_tests.sql`:

   ```sql
   -- SECTION X: TEST my_new_table RLS POLICIES
   SELECT has_table('public','my_new_table','Should have my_new_table');
   -- set_test_user('...'); lives_ok(...); throws_ok(...); etc.
   ```

4. **Adjust the test plan count** at the top (`SELECT plan(…);`).  
5. **Run locally** – all green? Commit + push.  
6. **CI will enforce** the new checks for every future PR.

> Keep tests **idempotent** (use `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS`, etc.) so they run safely in any environment.

---

Happy testing — and thanks for keeping our users’ data secure!  
If you have any questions or need a pairing session, ping **#backend-infra** in Slack.
