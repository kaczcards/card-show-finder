# Production Messaging System – Implementation Plan

This document is the single source-of-truth for releasing the new role-based messaging system to **production**.

---

## 1. Scope Recap
* Role-gated direct messages, broadcasts, moderation, unread counts
* Two Supabase Edge Functions  
  • `send-broadcast` – validated + quota-enforced broadcasts  
  • `reset-broadcast-quotas` – nightly quota reset
* Comprehensive SQL migration (`db_migrations/production_messaging_system.sql`)
* React-Native UI changes in `DirectMessagesScreen`, `ChatWindow`, `MessageComposer`, etc.

---

## 2. Prerequisites & Owners
| Area | Prerequisite | Owner |
|------|--------------|-------|
| Branch | `main` up-to-date, feature branches merged | Eng Lead |
| Access | Supabase project **service role** key & CLI | DevOps |
| Secrets | Set `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` in CI | DevOps |
| Feature Flag | `messaging_v2_enabled` default **false** | Backend |

---

## 3. Deployment Steps

### 3.1 Database Migration
1. Backup production DB  
   `pg_dump $DATABASE_URL > prod-backup-$(date +%F).sql`
2. Enable maintenance window (read-only)
3. Apply migration  
   ```bash
   psql $DATABASE_URL -f db_migrations/production_messaging_system.sql
   ```
4. Verify:
   * New tables exist (`broadcast_quotas`, `reported_messages`)
   * RLS policies active:  
     `SELECT relrowsecurity FROM pg_class WHERE relname = 'messages';`
5. Re-enable writes.

### 3.2 Edge Functions
1. `cd supabase/functions`
2. Deploy broadcast sender  
   `supabase functions deploy send-broadcast --project-ref <ref>`
3. Deploy quota reset  
   `supabase functions deploy reset-broadcast-quotas --project-ref <ref>`
4. Schedule quota reset nightly (UTC 02:00) in **Supabase Dashboard → Edge Functions → Schedules**  
   Cron: `0 2 * * *`
5. Confirm logs:  
   `supabase functions logs reset-broadcast-quotas`

### 3.3 Environment Variables
| Key | Function | Value |
|-----|----------|-------|
| `SUPABASE_URL` | both | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | both | Service role secret |
| `JWT_SECRET` (edge runtime v1) | both | same as project |

### 3.4 Front-End / Mobile App
1. Pull latest `userRoleService.ts` & `messagingService.ts`
2. **DirectMessagesScreen**
   * Hide “Message” button when `!canSendDirectMessage(currentRole, targetRole)`
3. **ChatWindow**
   * Disable input if `!canReplyToMessage(currentRole)`
   * Show “Reported / Deleted” placeholder for `is_deleted`
4. **BroadcastComposer**
   * Show broadcast option only for roles that pass `canSendBroadcast`
5. Run `yarn test` + lint + `expo start` for manual check.

### 3.5 Feature Flag Flip
1. Deploy backend first with flag **off**
2. Release mobile build to stores / OTA
3. After 50% adoption, flip `messaging_v2_enabled` to **true** via remote config.

---

## 4. Testing Strategy

### 4.1 Automated
| Layer | Tool | Cases |
|-------|------|-------|
| Unit | Jest | permission matrix, helper functions |
| DB | pgTap | `can_user_send_dm`, RLS read/write |
| Edge | Deno test | happy & quota-exceeded paths |
| API | Postman/Newman | send DM, broadcast, moderation |

### 4.2 Staging End-to-End
1. Seed demo data: 2 attendees, 1 dealer, 1 MVP, 1 organizer, 1 show.
2. Flows:
   * Attendee → MVP dealer DM (should work)
   * Attendee → Dealer DM (blocked)
   * Organizer pre-show broadcast x2 (3rd blocked)
   * MVP broadcast to attendees (OK) to dealer (blocked)
   * Moderator soft-deletes a message; verify placeholder
3. Regression: legacy chat loads all historical messages.

### 4.3 Load / Soak
* k6 script to simulate 5k concurrent DM sends & 500 broadcasts.
* Ensure p99 latency < 200 ms, error rate < 0.5 %.

---

## 5. Rollback Plan

| Component | Rollback Action |
|-----------|-----------------|
| Edge Functions | `supabase functions delete send-broadcast` etc. |
| Front-End | Toggle `messaging_v2_enabled` **false** |
| Database | `psql $DATABASE_URL < prod-backup.sql` OR `BEGIN; DELETE FROM new tables; ALTER ...; COMMIT;` |
| Migration | Have `rollback_production_messaging.sql` that drops new objects & restores old RLS |

Rollback should be rehearsed on staging **before** production rollout.

---

## 6. Monitoring & Alerts
* Supabase Logs → Edge Function Errors > 0.1% triggers PagerDuty
* psql check every 5 min: `SELECT count(*) FROM reported_messages WHERE report_status='pending';`
* Datadog synthetic hitting `/functions/v1/send-broadcast` health endpoint

---

## 7. Timeline

| Phase | Target Date | Owner |
|-------|-------------|-------|
| Code freeze & review | D-3 | Eng Lead |
| Staging deploy & QA | D-2 | QA |
| Production DB migration | D-1 07:00 UTC | DBA |
| Edge Functions + Flags | D-1 07:30 UTC | DevOps |
| Mobile release | D0 | Mobile Lead |
| Flag flip 25 % | D+2 | PM |
| Full rollout | D+5 | PM |

---

## 8. Sign-Off Checklist
- [ ] Migration applied without errors
- [ ] Edge Functions returning 200
- [ ] UI Feature flag tested
- [ ] Smoke tests green
- [ ] PagerDuty on-call informed
- [ ] Rollback script validated

> When all boxes are checked, update the CHANGELOG and announce in #release-alerts.
