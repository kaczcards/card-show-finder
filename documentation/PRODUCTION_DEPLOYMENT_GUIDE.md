# Want Lists Fix – Production Deployment Guide

This document explains **exactly** how to ship the want-lists feature fix to production with zero downtime and a safe rollback path.  
It assumes you have **Supabase Admin** access and permission to publish a new version of the mobile app / OTA update.

---

## 1. Pre-Deployment Checklist ✅

| # | Item | Completed |
|---|------|-----------|
| 1 | Confirm you are on the **production** Supabase project (double-check URL). | ☐ |
| 2 | Review and back-up the **current schema & policies** (`supabase → Database → Backups`). | ☐ |
| 3 | Verify you have service-role or SQL editor rights. | ☐ |
| 4 | Identify **test accounts** for each role:<br>• Attendee<br>• Dealer<br>• MVP Dealer<br>• Show Organizer | ☐ |
| 5 | Identify at least **one upcoming show** (`start_date >= today`) for testing. | ☐ |
| 6 | Clone latest repo & run `npm i` (local sanity test passes). | ☐ |
| 7 | Copy the script `production-fix-want-lists.sql` (or the SQL below). | ☐ |
| 8 | Bump mobile app version / prepare OTA bundle that contains the latest `showWantListService` & `AuthContext`. | ☐ |

---

## 2. Step-by-Step Deployment Instructions 🚀

### 2.1 Database Patch – Supabase SQL Editor

1. **Open** Supabase → SQL Editor → _New Query_.  
2. **Paste** the entire contents of `production-fix-want-lists.sql`.  
3. **Run** the script.  
   *Execution is idempotent; it will create missing tables, indexes, and the RLS policies while skipping anything that already exists.*  
4. Verify the console ends with:

```
NOTICE:  WANT LISTS FEATURE FIX COMPLETED SUCCESSFULLY
```

### 2.2 Mobile / Web Client Update

1. Merge `main` → `release` (or your prod branch).  
2. Build & publish:
   * Expo OTA: `eas update --branch production --message "Want lists fix"`  
   * Native stores: run `eas build`.  
3. Wait for ingest (App Store / Play Store) **or** push OTA immediately if using Expo Go.

### 2.3 Feature Flag (optional)

If you gate features per release channel, enable the `WANT_LISTS_ENABLED=true` flag now.

---

## 3. Post-Deployment Verification 🔍

Perform **all** checks before calling the rollout done.

### 3.1 Database Sanity

```sql
-- MVP dealer should see >0 rows
select * from get_accessible_want_lists('<mvp_dealer_id>') limit 5;
```

Expected: rows containing attendee names and want list content.

### 3.2 End-to-End UI Tests

1. **Attendee** logs in → hearts the upcoming show → creates a want list.  
2. **MVP Dealer** who is registered for same show:
   * Navigate Profile → Collection → “Attendee Want Lists”.  
   * Verify attendee card appears within ~5 s.  
3. **Show Organizer** of that show:
   * Performs same check – card appears.  
4. **Regression**: Regular **Dealer** *must not* see other people’s want lists.  
5. **Un-heart** the show as attendee → dealer view disappears on refresh.

### 3.3 Diagnostics Function (optional)

```sql
select * from diagnose_want_list_issues('<mvp_dealer_id>');
```

All rows should return `PASS`.

---

## 4. Troubleshooting 🛠️

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| 0 rows returned in `get_accessible_want_lists` | 1️⃣ Dealer not in `show_participants` OR 2️⃣ Show date is in past | Insert row in `show_participants` or change show date |
| Attendee want list saved but dealers don’t see it | Attendee forgot to **heart** the show | Instruct attendee to tap heart icon |
| RLS “permission denied” errors | SQL script not fully applied | Re-run `production-fix-want-lists.sql` |
| Mobile app shows “setup in progress” banner | Client still on old bundle | Force-update (kill & reopen) or wait for OTA |
| Writes succeed locally but vanish on refresh | Requests made while **unauthenticated** | Check `AuthContext`; ensure session present before calling Supabase |

---

## 5. Rollback Procedure ⏪

1. **SQL**:  
   ```sql
   BEGIN;
   -- Remove new RLS policies
   DROP POLICY IF EXISTS "Allow MVP dealers to view favorite shows for shows they participate in" ON user_favorite_shows;
   DROP POLICY IF EXISTS "Allow show organizers to view favorite shows for shows they organize"   ON user_favorite_shows;
   DROP POLICY IF EXISTS "MVP dealers can view want lists for attendees of their shows"           ON want_lists;
   DROP POLICY IF EXISTS "Show organizers can view want lists for attendees of their shows"       ON want_lists;
   COMMIT;
   ```
2. **App**: disable feature flag or roll back build in store / OTA.  
3. Confirm dealers/organizers no longer see attendee data.

---

## 6. Performance Monitoring 📈

1. **Query Statistics**: Supabase Dashboard → Database → Query Performance.  
   *Check `user_favorite_shows` and `want_lists` scans stay <50 ms.*  
2. **Row Counts Alert**: create a scheduled function to alarm if `want_lists` grows >10 k (index maintenance).  
3. **Logs**: enable log drains for `denied by RLS` errors – spike indicates mis-role or new policy needed.  
4. **Mobile Crashlytics**: watch for new errors in `showWantListService`.  
5. **App Performance**: expect <1 s load time for Attendee Want Lists on LTE for ≤500 lists.

---

### All set!

Deployment is **complete** when:
* SQL script ran without error  
* New app build is in users’ hands  
* Dealers & organizers see attendee want lists for their upcoming shows  
* No RLS errors appear in logs for 24 h  

Happy collecting 🚀

---

## 7. Database Backup Configuration 🗄️

> _One-time setup for **new production** Supabase projects (skip if PITR is already enabled)._  

1. **Open** Supabase Dashboard → **Project Settings → Database**  
2. Scroll to **Point-in-Time Recovery (PITR)**  
3. Toggle **Enable PITR** → set **Retention period** to **30 days** → **Save**  
   *This gives you continuous WAL backups that fully cover a weekly-backup requirement.*  
4. **Verify** success:  
   * Dashboard shows “PITR enabled – retaining WAL files for **30 days**”  
   * Latest base snapshot status is **COMPLETED** (should be <24 h old)  
5. (Optional) run `node scripts/verify_backup_status.js` to programmatically check:  
   ```bash
   SUPABASE_ACCESS_TOKEN=<token> \
   PROJECT_REF=<project_ref> \
   node scripts/verify_backup_status.js
   ```  
   The script will flag any issues with snapshots or retention.

For deeper recovery workflows, off-site dumps, and troubleshooting, see  
`docs/DATABASE_BACKUP.md`.
