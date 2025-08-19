# RLS Policy Consolidation – Reference Guide  
*(`RLS_CONSOLIDATION_README.md`)*

---

## 1 · Background – The Security-Drift Problem  

Over two years the database accumulated **30+ migrations** and a handful of hot-fix SQL files.  
Each introduced or tweaked Row Level Security (RLS) rules **in isolation**. The result:

* Duplicate / overlapping policies with different names  
* Tables with RLS enabled but **no policies** (hard-locked)  
* Policies referencing columns or roles that no longer exist  
* Recursive “SELECT FOR SELECT” policies causing infinite loops  
* Inconsistent privilege boundaries between tables that should align (e.g. `want_lists`, `shared_want_lists`, `show_participants`)  

Collectively this **security drift** produced bugs (empty screens, 403s) and potential privilege-escalation vectors.

---

## 2 · Solution – Comprehensive Consolidation  

We shipped two scripts:

| File | Purpose |
|------|---------|
| **`consolidated-rls-policies.sql`** | Drops conflicting rules, defines a clean, principle-of-least-privilege policy set, and enables RLS everywhere. |
| **`verify-rls-policies.sql`** | Audits the live DB after consolidation, producing a colour-coded “Security Posture Report”. |

Key remediation steps inside the consolidation script:

1. **Helper functions** (`is_admin()`, `is_show_organizer()` …) centralise role logic.
2. `safe_drop_policy()` removes legacy policies idempotently.
3. Every public table now **enables RLS** and receives a _single coherent policy bundle_ covering:
   * self-service access (owner),
   * elevated roles (MVP Dealer, Show Organizer),
   * admin/service role.
4. Cyclic policies replaced with **non-recursive JOIN-based checks**.
5. Storage policies harmonised—avatars & show images separated by bucket with correct read/write rules.
6. Global `GRANT` block re-aligns `authenticated` privileges after policy enforcement.

---

## 3 · Policy Design Highlights  

* **Principle of Least Privilege** – users only read what they truly need.  
* **Role Functions Over Role Literals** – simplifies future changes (edit the function, not 30 policies).  
* **Consistency Across Feature Families** – want-list tables and conversation tables follow the same pattern (self / elevated / admin).  
* **Admin Escape Hatch** – `is_admin()` gives full access for moderation & support without using the powerful Supabase `service_role` key.  

---

## 4 · How to Run  

### 4.1 · Apply Consolidation  

1. Open **Supabase** → **SQL Editor**.  
2. Paste or upload `consolidated-rls-policies.sql`.  
3. **Run**.  The script is *idempotent*—safe to re-run.

_Optional_: commit it to `/supabase/migrations/` (timestamped) so it auto-applies in CI/CD.

### 4.2 · Verify Deployment  

1. Immediately after the previous step, open a new SQL tab.  
2. Run `verify-rls-policies.sql`.  
3. Inspect the console output:  
   * `Overall Security Status: SECURE` in green = ✅  
   * Any **CRITICAL/HIGH** findings require attention—re-run consolidation or patch manually.

---

## 5 · Testing & QA Procedures  

| Layer | What to Check | Tool / Method |
|-------|---------------|---------------|
| Unit | Helper functions return expected booleans | `SELECT is_mvp_dealer();` etc. |
| Policy | Example user can/can’t read rows | Supabase Auth “Run as user” → table explorer |
| Integration | Mobile app pages load with correct data | Expo Dev build |
| Automated | `verify-rls-policies.sql` summary shows 0 FAIL (critical/high) | SQL Editor / CI |

For CI, add a job that spins up a test DB, applies migrations, then runs the verification script and fails the pipeline on non-zero high/critical issues.

---

## 6 · Maintenance Guidelines  

1. **Before adding a new table**  
   * Enable RLS immediately.  
   * Decide owner/elevated/admin matrix and copy a template policy block.

2. **Before changing roles**  
   * Update the relevant `is_*` helper function **only** – existing policies automatically respect new logic.

3. **After every migration**  
   * Run `verify-rls-policies.sql` locally or in CI to catch drift early.

4. **Naming Convention**  
   * Keep policy names short and functional: `table_action_role` (e.g., `want_lists_select_self`).  

5. **One Source of Truth**  
   * Always modify `consolidated-rls-policies.sql`, then re-apply—never hand-edit individual policies in production.

6. **Periodic Audit**  
   * Schedule quarterly verification; archive the posture report in the security channel.

---

## 7 · Troubleshooting  

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Table returns 0 rows for everyone | RLS enabled, but missing `SELECT` policies | Add/select policy in consolidation script & re-run |
| Infinite recursion error | A policy queries same table without `LIMIT 1` or via a function | Ensure policy predicates use JOINs on other tables or limit recursion |
| Authenticated users get 42501 “permission denied” on `INSERT` | Missing `INSERT` privilege grant | Consolidation script’s GRANT block didn’t run—re-apply or grant manually |

---

## 8 · Changelog  

* **v1.0 (2025-07-18)** – Initial consolidation & verification scripts.  
* **v1.1** – Added `planned_attendance` policies, storage bucket separation.  
* **v1.2** – CI verification job template (docs only).

---

Happy (and secure) shipping!  
