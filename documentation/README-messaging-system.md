# Card Show Finder – Messaging System

Comprehensive guide for developers, DevOps, QA and product on the **role-based messaging system (Messaging v2)** released July 2025.

---

## 1 · Why a New System?

* Scale to 100 k+ users & shows  
* Enforce complex **role permissions** (Attendee, Dealer, MVP Dealer, Show Organizer) at every layer  
* Support **broadcast announcements** with organizer quotas  
* Enable basic **moderation & reporting** without a full admin console  
* Future-proof for push notifications & analytics

---

## 2 · High-Level Architecture

```
React-Native App
   │
   ├─ userRoleService.ts      (client-side capability checks)
   ├─ messagingService.ts     (API wrapper + realtime)
   │
   ▼
Supabase REST/RPC
   │
   ├─ SQL functions (can_user_send_dm, create_broadcast_message …)
   ├─ RLS policies             (hard gate security)
   ├─ Triggers                 (unread counts, last-message meta)
   │
   └─ Edge Functions (Deno)
        • send-broadcast
        • reset-broadcast-quotas (cron)
```

All business rules are **owned by the database** or Edge Functions; the mobile client only shows/hides UI.

---

## 3 · Role Capability Matrix (authoritative)

| Role → Action | DM Send | DM Reply | Broadcast | Moderate | Notes |
|---------------|---------|----------|-----------|----------|-------|
| **Attendee**        | ➜ MVP Dealer | ✔ to MVP / Organizer | — | — | |
| **Dealer**          | — | — | — | — | read-only threads |
| **MVP Dealer**      | ➜ Attendee / Dealer* / Organizer | ✔ | ➜ Attendees* | — | *must share show |
| **Show Organizer**  | ➜ All roles | ✔ | ➜ All roles (quota 2 pre + 1 post) | ✔ own shows | quota enforced |

---

## 4 · Database Objects

| Object | Purpose |
|--------|---------|
| `conversations` | direct / group / show chats |
| `conversation_participants` | per-user unread counts, can_reply flag |
| `messages` | main payload, soft-delete columns |
| `broadcast_quotas` | pre/post counters per organizer+show |
| `reported_messages` | moderation queue |
| `role_capabilities_v` | convenience view for queries |

### Key Functions

* `can_user_send_dm(sender, recipient, show?)` – matrix enforcement  
* `create_broadcast_message(...)` – full broadcast flow  
* `moderate_delete_message(message_id, mod_id, reason)` – soft delete  
* `report_message(...)` – user reporting

All functions are `SECURITY DEFINER` to bypass RLS safely.

### RLS Highlights

* `messages`: user must be participant **and** message not soft-deleted (unless admin/mod).  
* `messages` **insert**: checks `can_user_reply` or initial send.  
* `broadcast_quotas`: only function updates counters.

---

## 5 · Edge Functions

### 5.1 send-broadcast

```bash
curl -X POST https://<project>.functions.supabase.co/send-broadcast \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
        "sender_id": "USER_UUID",
        "show_id": "SHOW_UUID",
        "recipient_roles": ["attendee"],
        "message": "Doors open at 9 AM!",
        "is_pre_show": true   # optional
      }'
```

Returns:

```json
{
  "success": true,
  "conversation_id": "CONV_UUID",
  "quota_remaining": { "pre_show": 1, "post_show": 1 }
}
```

### 5.2 reset-broadcast-quotas

*Scheduled nightly `0 2 * * *` UTC* – resets organizer quotas for upcoming/past shows.  
Manual trigger:

```bash
curl -X POST https://<project>.functions.supabase.co/reset-broadcast-quotas \
  -H "Authorization: Bearer SUPABASE_SERVICE_KEY"
```

---

## 6 · Client-Side Usage

### 6.1 Permission Checks

```ts
import {
  canSendDirectMessage,
  canReplyToMessage,
  canSendBroadcast
} from '@/services/userRoleService';

if (canSendDirectMessage(myRole, targetRole)) { /* show DM button */ }
```

### 6.2 Sending a DM

```ts
await messagingService.sendMessage(currentUserId, targetUserId, 'Hi there!');
```

### 6.3 Broadcast

```ts
await messagingService.sendBroadcastMessage({
  senderId: currentUserId,
  message: 'Parking lot moved to Gate C',
  recipientRoles: [UserRole.ATTENDEE],
  showId: SHOW_ID
});
```

### 6.4 Moderation / Reporting

```ts
// Report
await messagingService.reportMessage(myId, messageId, 'Spam');

// Soft delete (organizer only)
await messagingService.moderateMessage(myId, messageId, 'Inappropriate');
```

---

## 7 · Deployment

1. **DB Migration**

```bash
psql $DATABASE_URL -f db_migrations/production_messaging_system.sql
```

2. **Edge Functions**

```bash
supabase functions deploy send-broadcast
supabase functions deploy reset-broadcast-quotas
```

3. **Schedule Cron** → Dashboard → Edge → *Schedules* `0 2 * * *`

4. **Mobile Release** – bump version, OTA JS, flip `messaging_v2_enabled` flag after 50 % adoption.

Rollback: delete functions, toggle flag off, restore DB backup.

---

## 8 · Examples & Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Attendee tries to DM Dealer | **Denied** (“Dealers are read-only”) |
| Organizer sends 3rd pre-show broadcast | Quota error `broadcast quota exceeded` |
| Dealer opens chat window | Input disabled, upgrade CTA |
| MVP Dealer broadcast to Dealers | **Denied** – only attendees allowed |
| Organizer soft-deletes message | Message hidden with “removed by moderator” placeholder for all |

---

## 9 · Troubleshooting

* **`permission denied for policy messages_select_policy`**  
  → user not participant **or** message soft-deleted.

* **Edge function 403 “Only Show Organizers…”**  
  → sender role mismatch; refresh session, check `profiles.role`.

* **Quota not resetting**  
  → verify cron logs, check `broadcast_quotas.last_updated`.

---

## 10 · Future Work

* Push notifications for unread counts  
* Admin web dashboard for moderation queue  
* AI toxicity scoring before insert  
* GraphQL subscription gateway for web app

---

Made with 💛 by the Messaging Squad  
_Last updated: 10 Jul 2025_
