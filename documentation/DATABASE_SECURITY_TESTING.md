# Database Security Testing Guide  
*Card-Show-Finder • pgTAP Suite*

## 1 · Overview
This repository ships with a comprehensive **pgTAP** test-suite that continuously validates every Row-Level-Security (RLS) policy, helper function and permission boundary in the Postgres database that powers Card-Show-Finder.

Running the suite locally or in CI guarantees:
* RLS remains enabled on every table
* Expected policies are present and non-conflicting
* Helper functions (`is_admin()`, `participates_in_show()` …) behave as designed
* Authenticated role retains the minimum CRUD privileges
* No regression opens read-or-write paths across tenant boundaries

---

## 2 · Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| PostgreSQL ≥ 14 | Database engine | `brew install postgresql` / apt / docker |
| pgTAP extension | TAP-emitting assertions inside Postgres | `CREATE EXTENSION pgtap;` *(see below)* |
| psql | CLI client | ships with PostgreSQL |
| **pg_prove** (optional) | Pretty TAP test runner | `cpanm TAP::Parser::SourceHandler::pgTAP` |

> ℹ️ The CI pipeline builds pgTAP from source—no system-wide packages are required.

---

## 3 · Local Setup

1. **Create / select** a dev database  
   ```bash
   createdb card_show_finder_dev
   ```

2. **Load schema & RLS**  
   ```bash
   psql card_show_finder_dev -f db_migrations/00_initial_schema.sql
   psql card_show_finder_dev -f consolidated-rls-policies.sql
   ```

3. **Install pgTAP** (one-time)  
   ```sql
   -- inside psql
   CREATE EXTENSION IF NOT EXISTS pgtap;
   ```

4. **Run tests**

   ```bash
   # Simple
   psql card_show_finder_dev -f test/database/security_tests.sql

   # Pretty output
   pg_prove -d card_show_finder_dev test/database/security_tests.sql
   ```

---

## 4 · Test Organisation

```
test/database/
├── security_tests.sql          # Main pgTAP suite (200+ assertions)
├── run_security_tests.sh       # Helper runner with CLI options & CI flags
└── test-results/               # (CI) JUnit XML artifacts
```

Key sections inside `security_tests.sql`:

| Section | What it validates |
|---------|-------------------|
| 1 – Setup | Creates temporary users / data fixtures in an isolated TX |
| 2 – Helper Functions | Returns & role checks for `is_admin()`, `is_mvp_dealer()` … |
| 3 – Profiles | Owner read/write, limited public fields, admin override |
| 4 – Shows | Public read, organizer CRUD, admin coordinate patch |
| 5 – User Favorite Shows | Self-service, MVP dealer / organizer read scopes |
| 6 – Show Participants | Self, organizer, MVP dealer perspectives |
| 7 – Want Lists | Self CRUD, shared access, cross-table joins |
| … | Conversations, Messages, Reviews, Planned Attendance |
| 15 – Edge Cases | Impersonation, unauthorized updates, data isolation |
| 17 – Clean-up | Rolls back the entire TX – database left untouched |

All tests run inside a single transaction and perform **ROLLBACK** at the end; your dev DB stays pristine.

---

## 5 · CI / CD Integration

A ready-to-use GitHub Actions workflow lives at  
`.github/workflows/database-security-tests.yml`.

Highlights:

* Spins up **Postgres 14** service container  
* Installs pgTAP & pg_prove from source
* Applies schema migrations **+** consolidated RLS policies
* Executes `run_security_tests.sh --ci --junit`
  * Generates JUnit XML for PR annotations
* Uploads logs & test-results as artifacts
* Fails the pipeline on any ❌ assertion

Trigger matrix:

```yaml
on:
  push:       # main, feature/*, fix/*
  pull_request:
  workflow_dispatch:
```

> Want to integrate with another CI provider?  
> Call `test/database/run_security_tests.sh --ci` after DB setup and migrate.

---

## 6 · Extending the Suite

1. **Add fixtures**: use the existing `setup_test_data()` helper or create new isolated IDs.
2. **Write assertions** with pgTAP:
   ```sql
   -- new_security_tests.sql
   SELECT lives_ok(
     $$ INSERT INTO want_lists (id, userid, title) VALUES (:id, :uid, 'Edge') $$,
     'User can create want list edge-case'
   );
   ```
3. **Include** the file by sourcing it in `security_tests.sql` **or** listing it individually when invoking pg_prove.
4. **Update** the test plan count (`SELECT plan(n);`) – keep numbers in sync.

---

## 7 · Maintenance Guidelines

* **Whenever a migration adds a table**  
  * Enable RLS immediately  
  * Create minimal pgTAP tests: owner read/write + unauthorized read
* **When adjusting a policy**  
  * Update expected policy arrays in Section 3 of the verification script
* **Before merging to main**  
  * Ensure `run_security_tests.sh --ci` passes locally
* **Quarterly audit**  
  * Run the suite against prod replica, export JUnit + posture report

---

## 8 · Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `permission denied for table …` during tests | RLS policy missing or GRANT revoked | Re-apply consolidated RLS & update tests |
| `pg_prove: command not found` | Perl TAP harness not installed | `cpanm TAP::Parser::SourceHandler::pgTAP` |
| CI fails on “pgTAP extension…” | Extension not created in test DB | Ensure `CREATE EXTENSION pgtap;` step runs before tests |
| Tests hang on GitHub Actions | Health check for Postgres not ready | Increase `health-retries` or wait-for-postgres step |

---

## 9 · Reference Commands

```bash
# Run only helper-function tests in verbose mode
pg_prove -v -d card_show_finder_dev \
  -e 'SET role = authenticated;' \
  -f test/database/security_tests.sql \
  --match '/SECTION 2/'

# Generate JUnit XML for Jenkins
pg_prove --formatter=TAP::Formatter::JUnit \
  -o junit.xml \
  -d card_show_finder_dev \
  test/database/security_tests.sql
```

---

## 10 · License & Attribution
pgTAP © 2008-2025 David E. Wheeler – MIT.  
This test-suite is © 2025 San Francisco AI Factory, released under the MIT license.

Happy (and **secure**) shipping!  
