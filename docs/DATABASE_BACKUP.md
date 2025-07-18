# Database Backup Strategy

Card Show Finder – **Supabase Postgres**

---

## 1. Why Backups Matter

Trading-card show data (shows, participants, messages, reviews, etc.) is business-critical.  
A repeatable backup + restore process ensures that:

* Service outages can be recovered quickly  
* Data-loss incidents (accidental deletes, bad migrations) are reversible  
* Compliance requirements for data retention are met  

---

## 2. Backup Configuration Summary

| Item | Value |
|------|-------|
| Method | **Point-in-Time-Recovery (PITR)** via Supabase Dashboard |
| Frequency | Continuous (changes streamed), **meets weekly requirement** |
| Retention | **30 days** |
| Scope | **Entire database** (all schemas & extensions) |
| Storage | Managed by Supabase in the same region |
| Additional Export | Optional weekly `pg_dump` pushed to private S3 (see § 5) |

---

## 3. One-Time Setup (5 min)

1. **Open Dashboard**  
   `https://app.supabase.com/project/<your-project-ref>`
2. Sidebar → **Project Settings** → **Database**
3. Scroll to **Point in Time Recovery**  
   • Toggle **Enable PITR**  
   • Set **Retention period** → `30 days`  
   • Click **Save**  
4. Verify banner: “PITR enabled – retaining WAL files for 30 days”.

That’s it – Supabase now maintains continuous WAL backups and daily base snapshots behind the scenes.

---

## 4. How It Works

1. Supabase captures a **base snapshot** daily.  
2. All changes are streamed into **Write-Ahead-Log (WAL)** files.  
3. At restore time Supabase rewinds to any second within the last 30 days by replaying WAL on top of the latest snapshot.

Because WAL is continuous, this exceeds the “weekly backup” requirement.

---

## 5. (Optional) Weekly Off-Site Dump

Company policy may require an off-platform copy. Use the built-in *Scheduled export* feature **or** a GitHub Action:

```sh
# Example cron script (runs every Sunday 02:00 UTC)
docker run --rm --network=host \
  -e PGPASSWORD=$PG_PASSWORD \
  postgres:15-alpine \
  pg_dump -h $PG_HOST -U $PG_USER -d $PG_DB \
  -Fc -Z9 -f dump_$(date +%Y-%m-%d).dump

aws s3 cp dump_$(date +%Y-%m-%d).dump s3://cardshowfinder-db-backups/
```

Retention on S3: 30 days lifecycle rule.

---

## 6. Recovery Scenarios

### 6.1 Restore Whole Database to a Past Timestamp

1. Dashboard → **Project Settings → Database → Backups**  
2. Choose **Restore** → **Point in time**  
3. Pick the date/time (UTC) within last 30 days  
4. Type the project name to confirm → **Restore Project**  
   • Supabase spins up a *new* project in the same org with the data at that instant  
   • DNS & API keys differ – update env vars before switching traffic  
5. Smoke-test the restored project → flip production DNS / secrets when ready  
6. Delete old project only after full validation.

### 6.2 Restore Single Table / Row

Because PITR restores the entire cluster you have two options:

1. **Spin-up restore**, export the needed table (`pg_dump -t table`), then `psql` into production.  
2. Use **Logical Replication / `pg_restore --data-only`** from an S3 dump created in § 5.

### 6.3 Rollback a Bad Migration

If a migration ran moments ago:

1. Note the exact `created_at` of the migration commit.  
2. Perform *timestamp* restore to **1 minute before** that time.  
3. Diff & cherry-pick schema/data or fully switch traffic.

---

## 7. Verification & Monitoring

| Task | Schedule | Responsible |
|------|----------|-------------|
| PITR status check (dashboard) | Weekly | DevOps |
| Random table restore test (to temp project) | Monthly | DevOps |
| S3 dump presence & size | Weekly | GitHub Action |

Alerting: integrate Supabase **Status webhook** + Slack / PagerDuty.

---

## 8. Access & Security

* Only the **Owner** role and designated **DB-Admin** service account can trigger restores.  
* Off-site dumps are encrypted in transit (TLS) and at rest (S3 SSE-S3).  
* Rotation of `$PG_PASSWORD` and AWS IAM credentials every 90 days.

---

## 9. Backup Configuration Change Procedure

1. Create Jira ticket & get approval from CTO.  
2. Make changes in Supabase dashboard (or Terraform, when IaC is adopted).  
3. Update this document (PR → `docs/DATABASE_BACKUP.md`).  
4. Run a restore test immediately after change.

---

## 10. Appendix

### 10.1 CLI Helpers

```sh
# Download latest base snapshot meta
supabase db backup list

# Trigger immediate snapshot (Pro)
supabase db backup create
```

### 10.2 Useful Links

* Supabase docs – Backups & PITR: https://supabase.com/docs/guides/platform/backups
* PostgreSQL pg_dump: https://www.postgresql.org/docs/current/app-pgdump.html
* Disaster Recovery Checklist: internal Notion page 🗒️

---

**Last reviewed:** 2025-07-18    **Next review due:** 2025-10-18
