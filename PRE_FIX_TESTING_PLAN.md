# Pre-Fix Testing & Execution Plan  
_for `DATABASE_COMPLEXITY_COMPREHENSIVE_FIX.sql`_

---

## 1. Current State Assessment ☑️

Before touching production or even staging:

1. **Schema Dump**
   ```bash
   supabase db dump --data-only=false --schema=public > pre_fix_schema_$(date +%Y%m%d_%H%M%S).sql
   ```
2. **Runtime Smoke-Tests**
   | Area | Query / Action | Expected |
   |------|----------------|----------|
   | Shows API | `SELECT get_paginated_shows(37.7,-122.4);` | May error or return inconsistent data |
   | RLS recursion | `SELECT * FROM show_participants LIMIT 1;` | Might raise `42P17` currently |
   | Favorite shows | `SELECT * FROM user_favorite_shows LIMIT 1;` | Should succeed |
   | Conversations | `SELECT get_conversations();` | Works but check for slow / missing data |
3. **Duplicate Function Count**
   ```sql
   SELECT proname, count(*) 
   FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
   WHERE n.nspname='public' AND proname IN (
     'get_paginated_shows','participates_in_show'
   )
   GROUP BY 1 HAVING COUNT(*)>1;
   ```
4. **Policy Audit**
   ```sql
   SELECT tablename, policyname
   FROM pg_policies WHERE schemaname='public'
     AND qual ILIKE '%show_participants%';
   ```

Record every error message and save to `pre_fix_baseline_report.md`.

---

## 2. Backup Strategy ⛑️

| Item | Tool / Command | Location |
|------|---------------|----------|
| Full logical backup | `pg_dump -Fc --no-owner --schema=public $DB_URL -f full_backup_$(date +%Y%m%d).dump` | `s3://db-backups/card-show-finder/` |
| Point-in-time | Ensure WAL archiving/Supabase PITR is **ON** | Supabase dashboard |
| Targeted object backup | `CREATE SCHEMA IF NOT EXISTS db_backup_before_fix;` followed by `CREATE TABLE AS / CREATE FUNCTION ...` | Same DB |

**Restore test**  
```bash
pg_restore -d $DB_URL --no-owner full_backup_YYYYMMDD.dump
```
Do this on a disposable database to verify integrity **before** running the fix.

---

## 3. Step-by-Step Execution 🚀

1. **Maintenance window** announced (15 min should suffice).
2. **Switch to psql / Supabase SQL editor** connected as service role.
3. **BEGIN a top-level transaction** (the script does its own, but outer wrap gives extra safety):
   ```sql
   BEGIN;
   ```
4. **Run the script**  
   ```sql
   \i DATABASE_COMPLEXITY_COMPREHENSIVE_FIX.sql
   ```
   Watch for final summary:
   ```
   DATABASE COMPLEXITY FIX COMPLETE
   Errors: 0
   ```
5. **Commit outer transaction** only if summary shows `Errors: 0`:
   ```sql
   COMMIT;
   ```
6. Tag schema version:
   ```sql
   INSERT INTO schema_migrations(version) VALUES('20250723_complexity_fix');
   ```

---

## 4. Verification Tests ✅

Run each block; any error = abort + rollback.

### 4.1 Functions Exist
```sql
SELECT proname FROM pg_proc
WHERE proname IN ('get_paginated_shows','get_show_details_by_id',
                  'create_show_with_coordinates','get_conversations',
                  'get_conversation_messages','send_message');
```
Expect 6 rows.

### 4.2 RLS Health
```sql
-- No policies reference their own table
SELECT * FROM pg_policies
WHERE schemaname='public' AND qual ILIKE '%'||tablename||'%';
-- Expect zero rows
```

### 4.3 Unit Smoke-Tests
```sql
-- Shows within 25 miles of NYC
SELECT (get_paginated_shows(40.7128,-74.0060))->'data'->0;
-- Create dummy show (rollback afterwards)
SELECT create_show_with_coordinates('Test','t','NYC','addr',
  now(), now()+interval '1 day', 5,'',40.7,-74.0);
```

### 4.4 Regression Checks
Re-run the table from section 1 step 2; all should **succeed** without recursion errors.

---

## 5. Rollback Plan 🔄

1. If **ANY** verification fails:
   ```sql
   ROLLBACK; -- if still inside outer tx
   ```
2. If outer transaction already committed:
   ```sql
   -- Generate ready-made rollback script
   SELECT generate_rollback_script() \g rollback.sql
   \i rollback.sql
   ```
3. **Restore full backup** (worst-case):
   ```bash
   pg_restore -d $DB_URL --clean --no-owner full_backup_YYYYMMDD.dump
   ```
4. **Notify stakeholders** and re-schedule maintenance window.

Save `post_fix_report.md` with results and commit to repo.

---

_End of plan_
