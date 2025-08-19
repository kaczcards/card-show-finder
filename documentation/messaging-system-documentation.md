# Messaging System Documentation

## 1. System Overview
Card Show Finder's messaging layer gives users a secure, real-time channel to communicate within the app.

Key capabilities  
• Direct messages (1-to-1)  
• Group chats (multi-user)  
• Show-specific announcement channels (one-way broadcasts)  
• Role-aware access control enforced in both the client and Supabase RLS  
• Realtime updates via Supabase Realtime  
• In-app moderation (report & soft-delete)

The design follows a conversation-centric model: `conversations` → `conversation_participants` → `messages`.

---

## 2. Database Schema (enhanced)

| Table | Purpose | Notable columns |
|-------|---------|--------------------|
| `conversations` | Root record for a chat thread | `type` (`direct` `group` `show`), `one_way` (bool), `show_id` (fk), `last_message_text/timestamp`, `location_filter` (jsonb) |
| `conversation_participants` | Links users to conversations | `can_reply` (bool), `unread_count` |
| `messages` | Stores each chat entry | `message_text`, `read_by_user_ids` (uuid[]), `is_deleted`, `deleted_by`, `reported_by` (uuid[]) |
| Functions |  | `create_announcement`, `moderate_delete_message`, `report_message`, `get_user_conversations`, `mark_message_as_read`, `mark_conversation_as_read`, `find_recipients_by_location` |
| Policies (RLS) | Enforce access | Users can only read/write where they are participants, cannot insert if `can_reply = FALSE`, cannot see deleted messages they did not delete |

All new schema artifacts live in `db_migrations/messaging_enhancements.sql`.

---

## 3. Role-Based Permissions

| Role | Can *send* | Can *receive* | Can *broadcast* | Can *moderate* |
|------|------------|---------------|-----------------|----------------|
| ATTENDEE | ✔︎ direct \<-> role-eligible | ✘ | ✘ | ✘ |
| DEALER | ✔︎ | ✘ | ✘ | ✘ |
| MVP_DEALER | ✔︎ | ✔︎ | ✔︎ | ✔︎ |
| SHOW_ORGANIZER | ✔︎ | ✔︎ | ✔︎ | ✔︎ |

The permission matrix is codified in `src/services/userRoleService.ts`.  
`TEST_MODE` has been **removed**; behavior is uniform across environments.

---

## 4. Messaging Features

### 4.1 Direct Messaging  
• Created on first contact (`createDirectConversation`)  
• Automatic look-up to reuse existing threads.

### 4.2 Group Messaging  
• Created via `createGroupConversation` with N participants  
• Unread counters per participant.

### 4.3 Announcements (One-Way)  
• `create_announcement` RPC creates `conversations.one_way = TRUE` and sets `can_reply = FALSE` for recipients.  
• Organizers/MVP dealers choose recipient roles and optional 50-mile "Nearby" filter.  
• Recipients see an orange "Announcement" badge; input field disabled.

### 4.4 Broadcast Fallback  
If the RPC fails, a legacy group chat is created so no message is lost.

### 4.5 Read Receipts  
• `read_by_user_ids` array updated when messages displayed.  
• `unread_count` kept in `conversation_participants`.

---

## 5. Moderation Features

| Action | Who | Implementation |
|--------|-----|----------------|
| Delete (soft) | Organizer / MVP Dealer / sender | `moderate_delete_message` sets `is_deleted=TRUE`, message text is replaced client-side |
| Report | Any participant | `report_message` appends reporter id to `reported_by`; future admin dashboard can query |
| Visibility | All users | Deleted messages show *"This message has been removed."* placeholder |

---

## 6. UI Components

| File | Purpose |
|------|---------|
| `DirectMessagesScreen.tsx` | Full inbox, conversation view, moderation UI, announcement banners |
| `GroupMessageComposer.tsx` | Composer modal for broadcasts (role & location filtering switches) |
| `MessageButton.tsx` | Profile-level CTA, enforces role matrix before opening composer |
| `ChatWindow`, `MessageList`, `ChatList` | Low-level chat rendering (unchanged) |

Visual cues  
• Orange accent for broadcasts, greyed input when reply disabled  
• Role indicator banner at top shows messaging ability/mod privileges.

---

## 7. Testing Guidelines

1. **Environment** – run `npx expo start`, ensure `.env` points to staging Supabase with new schema migrated.  
2. **Roles** – create test users for each role; verify login.  
3. **Direct Messages**  
   a. ATTENDEE → MVP_DEALER should succeed.  
   b. ATTENDEE → DEALER should **block** (button disabled or alert).  
4. **Group Chat** – Organizer selects multiple roles → all recipients receive message, unread badge increments.  
5. **Announcement**  
   a. Organizer sends broadcast with "Nearby" toggle.  
   b. Recipients in radius receive conversation marked *Announcement*; input disabled.  
6. **Read Receipts** – open convo as recipient; sender sees "• Read".  
7. **Moderation**  
   a. Long-press message as organizer → Delete; message replaced.  
   b. Long-press as attendee → Report; same message cannot be reported twice by same user.  
8. **RLS** – from psql, attempt to select messages for non-participant, expect permission denial.  
9. **Fallback** – temporarily rename RPC, send broadcast, ensure legacy path still delivers.

Automate critical flows with Detox or Playwright E2E.

---

## 8. Future Enhancements

• Admin web dashboard for triaging reported messages & viewing analytics  
• Push notifications for new messages / announcements  
• Threaded replies or message reactions  
• Rich media (images, card photos) using Supabase Storage + signed URLs  
• End-to-end encryption for private chats  
• AI moderation pipeline integration (Perspective API)  
• Advanced segmentation filters (sport, team, past attendance)  
• Archiving / deleting inactive conversations server-side cron

---
