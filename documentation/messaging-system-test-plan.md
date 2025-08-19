# Messaging System — Test Plan

---

## 1  Prerequisites

| Item | Details |
|------|---------|
| Environments | • **Local Dev**: Expo + Supabase project with latest migrations.<br>• **Staging**: Mirror of production schema and RLS. |
| Test Accounts | At minimum one user for each role:<br>  `ATTENDEE_A`, `DEALER_D`, `MVP_DEALER_M`, `ORGANIZER_O`, `ADMIN_X` (service role for SQL checks). |
| Seed Data | ≥ 1 upcoming show with `show_id = TEST_SHOW`. |
| Tools | • Expo Go / iOS & Android simulators<br>• Supabase SQL editor or psql<br>• Postman or curl for REST/RPC calls<br>• Optional E2E runner (Detox/Playwright). |
| Feature Flags | None – `TEST_MODE` **must be false**. |
| Location Mocking | Ability to spoof lat/long for location-filter tests (Expo-location dev menu). |

---

## 2  Test Cases

### 2.1  Role-Based Permissions

| # | Action | Actors | Expected Result |
|---|--------|--------|-----------------|
| RB-1 | ATTENDEE_A opens ORGANIZER_O profile → _Message_ button | ATTENDEE_A | Button **enabled**. |
| RB-2 | ATTENDEE_A opens DEALER_D profile → _Message_ button | ATTENDEE_A | Button **disabled** with tooltip/alert "User cannot receive messages". |
| RB-3 | DEALER_D tries to broadcast | DEALER_D | Composer shows permission alert; send blocked. |
| RB-4 | MVP_DEALER_M long-presses a message → Delete | MVP_DEALER_M | Delete option **visible**. |
| RB-5 | ATTENDEE_A long-presses same message → Delete | ATTENDEE_A | Delete option **not shown**; only "Report". |

### 2.2  Direct Messaging

| # | Steps | Expected |
|---|-------|----------|
| DM-1 | ATTENDEE_A sends "Hi" to ORGANIZER_O | Conversation created, both users see message. |
| DM-2 | ORGANIZER_O replies, ATTENDEE_A sees read receipt after opening. | `read_by_user_ids` updated, UI shows "• Read". |
| DM-3 | Attempt duplicate DM between same users | Service returns existing `conversation_id`, no duplicate conversation rows. |

### 2.3  Group Messaging

| # | Steps | Expected |
|---|-------|----------|
| GM-1 | ORGANIZER_O creates group with DEALER_D & MVP_DEALER_M and sends "Welcome" | Group conversation row (`type='group'`) created; each participant has `unread_count = 1`. |
| GM-2 | MVP_DEALER_M sends reply | All others' `unread_count` increments; last message text/time updated. |

### 2.4  One-Way Announcements

| # | Steps | Expected |
|---|-------|----------|
| OW-1 | ORGANIZER_O toggles "Nearby" off and sends broadcast to ATTENDEE+DEALER roles | RPC `create_announcement` returns id; participants' `can_reply = FALSE`. |
| OW-2 | ATTENDEE_A opens convo | Orange "Announcement" badge; input disabled. |
| OW-3 | MVP_DEALER_M (not selected role) should **not** receive convo. | No new convo listed. |
| OW-4 | Failure simulation – temporarily rename RPC, send broadcast | Legacy group fallback fires; convo `one_way = FALSE`, replies allowed. |

### 2.5  Message Moderation

| # | Steps | Expected |
|---|-------|----------|
| MM-1 | ORGANIZER_O deletes offensive message in group | `is_deleted = TRUE`, `deleted_by = ORGANIZER_O`; UI shows "removed" placeholder for all. |
| MM-2 | ATTENDEE_A reports different message with reason "Spam" | Reporter id appended to `reported_by`; second report from same user rejected. |
| MM-3 | Non-moderator attempts delete via REST | Supabase returns 403 due to RLS. |

### 2.6  Location-Based Filtering

| # | Steps | Expected |
|---|-------|----------|
| LF-1 | ORGANIZER_O in **Los Angeles** sends announcement with "Nearby 50 mi" | Only users whose `profiles.location` within 50 mi radius receive convo. |
| LF-2 | Spoof ATTENDEE_A to **NYC** then repeat LF-1 | ATTENDEE_A should **not** receive convo. |
| LF-3 | Validate SQL: run `select * from conversations where id = <announcement>` → **location_filter** JSON present. |

---

## 3  Edge-Case & Error Handling Tests

| Case | Procedure | Expectation |
|------|-----------|-------------|
| E-1 Large Message | Send 1 000 char message | UI scrolls; DB insert succeeds; no crash. |
| E-2 Rapid Fire | Send 20 messages quickly | Ordering preserved; unread counts accurate. |
| E-3 Self-chat | User messages self (should be blocked by UI) | Composer won't open; explicit alert. |
| E-4 Deleted Message Resend | Moderator deletes msg, sender edits/resends content | New message stored; old remains deleted. |
| E-5 Permission Tamper | REST call inserting message with `can_reply=FALSE` participant | RLS blocks insert. |
| E-6 Stale Conversation | Participant removed, tries to send again | 403 error; client shows "You are no longer a participant." |

---

## 4  Database Integrity Verification

After functional tests, execute SQL checks with `ADMIN_X`:

1. **Row Counts**  
```sql
select
  (select count(*) from conversations) as conversations,
  (select count(*) from conversation_participants) as participants,
  (select count(*) from messages) as messages;
```
   • Ensure counts match expected increases.

2. **Foreign Keys / Orphans**  
```sql
select cp.*
from conversation_participants cp
left join conversations c on c.id = cp.conversation_id
where c.id is null;
```
   → 0 rows.

3. **Unread Count Sync**  
```sql
select cp.unread_count, 
       ( select count(*) from messages m
         where m.conversation_id = cp.conversation_id
           and not (cp.user_id = any(m.read_by_user_ids)) ) as calc
from conversation_participants cp;
```
   `unread_count = calc` for every row.

4. **One-Way Enforcement**  
```sql
select conversation_id, can_reply
from conversation_participants
join conversations using(conversation_id)
where one_way and can_reply;
```
   → 0 rows.

5. **Deleted / Reported Flags**  
Verify soft-deleted messages not returned in normal select:  
```sql
set role authenticated;
-- assume AUTH_UID = ATTENDEE_A
select * from messages where is_deleted;
```
   → 0 rows due to RLS; only requester of delete sees own deleted msgs.

---

## 5  Pass / Fail Criteria

The build passes when **all** expected results are met, no SQL integrity violations are found, and Expo logs show no unhandled errors or warnings related to messaging.

---
