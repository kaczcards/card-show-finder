# Implementing the Consolidated RLS Policy Framework  
*Card-Show-Finder Security Hardening Guide*

---

## 1 · Why Consolidate RLS?  

| Problem | Impact | Consolidated RLS Fix |
|---------|--------|----------------------|
| **Security drift** – dozens of migrations tweaked RLS in isolation. | Hidden privilege-escalation paths, hard-locked tables, conflicting rules. | One authoritative script (`CONSOLIDATED_RLS_2025.sql`) resets everything to a principle-of-least-privilege baseline. |
| **Duplicate / recursive policies** | Infinite-recursion errors (`42P17`) and noisy logs. | Non-recursive helper functions (`participates_in_show_safe`, etc.). |
| **Missing RLS on new tables** | Data leaks or 403s. | Script auto-enables RLS on every public table. |
| **Inconsistent role checks** | Hard to reason about access. | Centralised role helpers (`is_admin()`, `is_any_dealer()`, …). |

---

## 2 · Step-by-Step Implementation  

1. **Prepare a backup**  
   ```bash
   supabase db dump --file pre-rls-consolidation.sql
   ```

2. **Open Supabase → SQL Editor**  
   Paste the full contents of `CONSOLIDATED_RLS_2025.sql`.

3. **Run the script**  
   It is *idempotent* – safe to re-run.  
   Watch the NOTICE log: every policy/function reports *Created* or *Skipped*.

4. **Run verification**  
   Immediately execute `verify-rls-policies.sql`.  
   • Overall Security Status should read **SECURE** (green).  
   • Review any **HIGH/CRITICAL** findings.

5. **Commit to source control**  
   Place both SQL files in `supabase/migrations/` with a timestamp (e.g., `20250721_consolidated_rls.sql`) so CI/CD always applies them.

---

## 3 · Ongoing Maintenance  

| Task | Frequency | How |
|------|-----------|-----|
| **Add a new table** | Whenever new schema added | • Enable RLS immediately.<br>• Copy a template policy block from the consolidation script.<br>• Re-run verification. |
| **Change role logic** | Rare | Edit the relevant `is_*` helper function only – no policy edits needed. |
| **Quarterly audit** | Every 3 months | Run `verify-rls-policies.sql`, archive report in security channel. |
| **CI check** | Every PR | See §6. |

---

## 4 · Verifying Correctness  

1. **Automated** – run `verify-rls-policies.sql`; pipeline fails on non-zero high/critical.  
2. **Manual smoke**  
   - Sign-in as *Attendee*, *Dealer*, *Organizer*, *Admin*.  
   - Navigate through the app: no blank screens, no 500/403 errors.  
3. **Unit tests**  
   ```sql
   SELECT is_admin();          -- expect f for normal user
   SELECT participates_in_show_safe('<show-uuid>');
   ```
4. **Log review** – no `infinite recursion detected` errors in Postgres logs.

---

## 5 · Best Practices to Prevent Security Drift  

1. **Single Source of Truth** – *only* edit `CONSOLIDATED_RLS_2025.sql`, never live-patch individual policies.  
2. **Helper Functions over Literals** – business roles change in one place.  
3. **Least Privilege by Default** – start with `USING (false)` then open narrowly.  
4. **Name Convention** – `table_action_role` (e.g., `shows_update_organizer`).  
5. **Fail-fast Verification** – run the verifier locally before every push.  

---

## 6 · CI/CD Integration  

```yaml
# .github/workflows/db-security.yml
name: DB-Security

jobs:
  verify_rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: supabase start
      - run: supabase db reset --linked
      - run: supabase db reset && psql -f supabase/migrations/20250721_consolidated_rls.sql
      - run: psql -f verify-rls-policies.sql
```

• Pipeline fails if the verification script exits with high/critical issues.  
• Optional: upload the coloured posture report as an artefact.

---

## 7 · Troubleshooting  

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| `ERROR 42P17 infinite recursion detected` | A policy still queries its own table. | Ensure non-recursive helpers are used; rerun consolidation script. |
| Table returns 0 rows for everyone | RLS enabled but missing `SELECT` policy. | Add/select policy block in consolidation script then re-run. |
| Authenticated users get `42501 permission denied` on `INSERT` | GRANT block didn’t run. | Re-run Section 17 or execute `GRANT INSERT ON … TO authenticated`. |
| Verification shows missing functions | Helper function accidentally dropped. | Re-run consolidation script; functions are recreated. |
| CI fails with duplicate policy error (`42710`) | Script partially applied previously. | The script now drops conflicting policies first; simply rerun. |

---

## Appendix – Helpful Commands  

```sql
-- List policies for a table
SELECT * FROM pg_policies WHERE tablename = 'show_participants';

-- Check RLS enabled
SELECT relname, relrowsecurity FROM pg_class
JOIN pg_namespace n ON n.oid = relnamespace
WHERE n.nspname = 'public' AND relname = 'shows';
```

---

**Enjoy a drift-free, secure database!**  
*Questions? Contact #security on Slack.*
