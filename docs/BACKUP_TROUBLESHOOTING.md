# Database Backup Troubleshooting Guide  
Card Show Finder – Supabase Postgres

> Use this playbook whenever backups or restores fail, or when the
> dashboard shows warnings about Point-in-Time Recovery (PITR).

---

## 0. Rapid-Fire Checklist

| ✅ / ❌ | Question |
|---------|----------|
|         | Is **PITR** toggled *ON* in Project Settings → Database? |
|         | Does **Retention period** display **30 days**? |
|         | Is the latest **base snapshot** status **COMPLETED** & < 24 h old? |
|         | Are **WAL size** and **Disk usage** < 80 % of plan quota? |
|         | Do GitHub Action logs show successful off-site dump upload? |

If any answer is **NO**, jump to the matching section below.

---

## 1. PITR Setup Issues

### 1.1 PITR Toggle Missing / Disabled

**Symptoms**

* “Point in Time Recovery” toggle is greyed out  
* Cannot set retention period

**Root Cause**

Project is on the **Free** tier – PITR is a Pro-plan feature.

**Fix**

1. Org Owner upgrades project to **Pro** or higher.  
2. Re-open **Project Settings → Database**  
3. Toggle **Enable PITR** → set **30 days** → **Save**.

### 1.2 Retention Period Incorrect

**Symptoms**

Retention shows “7 days” or other value ≠ 30 days.

**Fix**

1. Change value to **30** and click **Save**.  
2. Refresh the page – if it reverts, contact Supabase support;
   your region/plan may have a hard cap.

### 1.3 “Project does not support PITR” Error

**Symptoms**

Banner appears after enabling PITR.

**Causes & Resolutions**

| Cause | Resolution |
|-------|------------|
| Region still on legacy storage infra | Open a support ticket – Supabase must migrate cluster. |
| Disk size < 8 GB | Upgrade disk in **Add-ons** tab (> 8 GB). |

---

## 2. Backup Failure Scenarios

### 2.1 Base Snapshot Status: **FAILED**

1. **Download logs** – click the snapshot row → **View logs**.  
2. Typical errors & remedies:

| Log Error | Action |
|-----------|--------|
| `disk quota exceeded` | Increase disk size or prune old WAL files (see 2.2). |
| `checksum mismatch` | Re-run snapshot after verifying disk health; if persists open support ticket. |
| `timeout acquiring lock` | Heavy migrations running – retry after load subsides. |

After fixing, click **Create snapshot now** to verify.

### 2.2 WAL Growth Exceeds Quota

**Symptoms**

* “WAL retention at risk” notification  
* Dashboard shows ≥ 80 % space used

**Fix**

1. Verify no long-running transactions keeping WAL pinned:  
   ```sql
   select pid, state, query_start, query
   from pg_stat_activity
   where state <> 'idle'
   order by query_start;
   ```  
2. Terminate rogue sessions if safe:  
   ```sql
   select pg_terminate_backend(<pid>);
   ```  
3. Vacuum large tables:  
   ```sql
   vacuum analyze verbose <table>;
   ```  
4. If still >80 % → **Add-ons** → expand disk.

### 2.3 Off-Site Dump GitHub Action Fails

1. Open Actions → **DB-Backup** run → check log.  
2. Common issues:

| Message | Fix |
|---------|-----|
| `psql: could not connect` | Rotate `$PG_PASSWORD`; confirm IP whitelisting. |
| `aws s3 cp` 403 error | Verify IAM user’s `s3:PutObject` permission & bucket policy. |
| `no space left on device` in runner | Add `rm dump_*.dump` at end or choose `ubuntu-22.04-large` runner. |

Re-run job after correction.

---

## 3. Restore Troubleshooting

### 3.1 “Earliest recoverable time is …” Later Than Desired

Cause: WAL files older than X days were purged.

* Verify **Retention** still 30 days.  
* If retention recently lowered then raised, older WAL is irretrievable.  
* Resort to off-site weekly dump.

### 3.2 Restore Project Stuck in **Initializing**

1. Wait at least 15 minutes – large DBs take time.  
2. Check Supabase Status page – incident may be ongoing.  
3. If > 30 min, open support ticket with restore ID.

### 3.3 Data Mismatch After Restore

* Confirm you pointed your app to the new **project ref** & updated `SUPABASE_URL`.  
* Flush client-side caches (React Query, AsyncStorage).  
* Compare row counts:  
  ```sql
  select 'shows' as table, count(*) from shows
  union all
  select 'profiles', count(*) from profiles;
  ```  
  Discrepancy → run off-site dump import or manual `pg_restore`.

---

## 4. Escalation Path

1. Perform steps in relevant section.  
2. Post summary & log snippets in **#devops** Slack (<15 min).  
3. Page on-call engineer if production impact (pager policy: P1).  
4. Open Supabase support ticket – include project ref & log IDs.  

---

## 5. Preventive Actions

* **Monthly restore test** into sandbox project.  
* Monitor **disk & WAL usage** with Datadog integration; alert at 70 %.  
* Rotate **DB credentials & AWS keys** every 90 days.  
* Keep **pgTAP** tests green to avoid bad migrations.

---

### Revision History

| Date | Author | Notes |
|------|--------|-------|
| 2025-07-18 | K. U. | Initial guide |
