# Pull Request – Fix Infinite Recursion in `show_participants` RLS Policies

## 📑 Summary  
This PR eliminates an **infinite-recursion bug** in the Row-Level-Security (RLS) policies of the `show_participants` table that crashed queries for MVP dealers and occasionally caused the entire Postgres session to terminate.  
A new migration (`20250722000000_fix_show_participants_infinite_recursion.sql`) safely **drops the faulty policy, introduces a non-recursive replacement, and adds a helper function** to keep the logic tidy and fast.

---

## 🐞 Problem  

| Policy | Symptom | Why it’s bad |
|--------|---------|--------------|
| `show_participants_select_mvp_dealer` | Selecting from `show_participants` as an MVP Dealer raised `ERROR:  infinite recursion detected in policy for relation show_participants` | The policy referenced **the same table it protects** inside its `USING (…)` clause, forcing Postgres to re-evaluate the policy for each nested lookup – an endless loop. |

### Impact
* **MVP dealers** could not load participant lists or shared want lists.  
* Any RPC/function touching `show_participants` under the dealer role failed, breaking:
  * Dealer dashboard
  * Show roster view
  * Dealer-specific want-list matching
* Postgres back-end processes occasionally hit the recursion guard and aborted, producing noisy logs.

---

## 🔍 Root Cause  
```sql
CREATE POLICY show_participants_select_mvp_dealer ON public.show_participants
  FOR SELECT USING (
    … AND EXISTS (
      SELECT 1 FROM show_participants sp            -- ← 🔁 self-reference
      WHERE sp.showid = show_participants.showid
        AND sp.userid = auth.uid()
    )
);
```

The self-reference means *evaluating the policy requires running the same query*, so Postgres enters an infinite evaluation loop and throws.

---

## 🛠️  Solution  

1. **Helper Function – `participates_in_show_safe(showid uuid)`**  
   Encapsulates the “does current user participate in this show?” check **without touching `show_participants`**.  
   Queries `shows`, `planned_attendance`, and the `dealers` array instead.

2. **Drop Faulty Policy**  
   ```sql
   DROP POLICY IF EXISTS "show_participants_select_mvp_dealer" ON public.show_participants;
   ```

3. **Create Replacement – `show_participants_select_mvp_dealer_fixed`**  
   ```sql
   CREATE POLICY "show_participants_select_mvp_dealer_fixed"
   ON public.show_participants
   FOR SELECT
   TO authenticated
   USING (
     is_mvp_dealer() AND
     (
       userid = auth.uid()                       -- always see own row
       OR EXISTS (SELECT 1 FROM shows s           -- organiser view
                  WHERE s.id = showid AND s.organizer_id = auth.uid())
       OR participates_in_show_safe(showid)       -- safe participation check
     )
   );
   ```

4. **Guarantee Self-visibility** (`show_participants_select_self`)  
   Users can still see their own rows regardless of dealer/organiser roles.

5. **Permissions & Comments**  
   * `GRANT EXECUTE` on the helper function to `authenticated`.
   * Explanatory comments on both policy and function.

All changes are wrapped in a single transactional migration to remain **idempotent** and **rollback-safe**.

---

## ✅ Testing Instructions  

### 1. Schema / Policy Verification
```sh
supabase db reset          # or psql -U postgres < migrations/*
psql -U postgres -c "SELECT polname, using FROM pg_policies WHERE tablename='show_participants';"
```
*Expect to see `show_participants_select_mvp_dealer_fixed` and no original recursive policy.*

### 2. Regression Test – SQL
```sql
-- As MVP dealer user (replace with real UUID)
set role authenticated;
select * from show_participants where showid = '<some-show-uuid>';
-- ✅ should return rows, not error
```

### 3. Application Smoke
1. Sign-in as MVP dealer in the app.
2. Open **Show Roster** → participants list loads.
3. Navigate to **Attendee Want Lists** → lists render without 500 error.

### 4. Automated
Add a database test case (pgTap or Jest + Supabase client) asserting the query above succeeds.

---

## 📉 Risk & Rollback  

Risk is **low** – change only touches security layer.  
Rollback: `supabase db rewind` one migration or manually re-create the old policy (not recommended).

---

## 🔒 Security

* Function `participates_in_show_safe` is `SECURITY DEFINER` but limited to harmless `SELECT` queries.
* No new write paths opened.

---

## 📝 Checklist
- [x] Migration file added & named correctly
- [x] Helper function documented
- [x] Old policy dropped
- [x] Self-visibility policy intact
- [x] Verified with local Supabase & sample data
- [x] PR title / body written

Happy querying! 🚀
