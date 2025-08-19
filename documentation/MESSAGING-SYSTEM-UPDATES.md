# Messaging System Updates

## 1&nbsp;· Executive Summary  
The messaging layer has been upgraded from a **simple direct-message model** to a **fully-featured, role-aware communication system**. Highlights:

* One-way announcement channels for show organisers & MVP dealers.  
* Granular role-based send / receive limits enforced end-to-end (client + RLS).  
* Built-in moderation: soft-delete and user reporting.  
* Geo-filtered broadcasts (50-mile radius starter).  
* Removal of the global `TEST_MODE` switch to eliminate security gaps.  
* UI overhaul that surfaces permissions and hides developer-only panels.

---

## 2&nbsp;· Modified / Added Files

| File | Purpose of Change |
|------|-------------------|
| **db_migrations/messaging_enhancements.sql** | New columns (`one_way`, `is_deleted`, `location_filter`, etc.), new RPC functions (`create_announcement`, `moderate_delete_message`, `report_message`), updated RLS. |
| **src/services/userRoleService.ts** | Removed `TEST_MODE`; introduced explicit `Action` matrix, new helpers (`canSendAnnouncement`, `canModerateMessages`). |
| **src/services/messagingService.ts** | Announcement RPC call + legacy fallback, moderation API, geo-filter broadcast, unread logic clean-up. |
| **src/components/GroupMessageComposer.tsx** | UI for role/geo toggle, permission enforcement. |
| **src/components/MessageButton.tsx** | Role-aware enable/disable, modal tidy-up. |
| **src/screens/Messages/DirectMessagesScreen.tsx** | Debug panel removed, announcement banner, moderation UI, role indicator, reply gating. |
| **Multiple style tweaks / asset updates** | Orange/blue palette for announcements, map icons, etc. |
| **docs/** *messaging-system-documentation.md* & *messaging-system-test-plan.md* | Developer docs + QA checklist (new). |

---

## 3&nbsp;· Key New Features

1. **Show Announcements (One-Way)**  
   * `create_announcement` RPC creates `conversations.one_way=TRUE` and sets `can_reply=FALSE` for recipients.

2. **Geo-Filtered Broadcasts**  
   * Optional 50-mile radius using `find_recipients_by_location`.

3. **Message Moderation**  
   * Soft delete (`moderate_delete_message`) and user reporting (`report_message`).

4. **Role-Aware UI**  
   * Buttons disabled / banners shown when actions are restricted.

5. **Unread Counts & Read Receipts**  
   * `unread_count` sync + `read_by_user_ids` array.

6. **Location of Business Logic**  
   * All heavy logic pushed to Supabase RPCs for consistency & auditability.

---

## 4&nbsp;· Breaking Changes

* **`TEST_MODE` flag removed** – all environments now respect real RBAC.  
  Any automation that relied on the bypass must be updated to set proper roles or use Supabase service-key calls.

* Messages table renamed during migration (`messages_old` ➜ `messages`); any direct SQL queries **must** reference new schema.

* Conversation creation helpers changed signatures (`createConversation` params object).

---

## 5&nbsp;· Next Steps for Deployment

| Step | Owner | Notes |
|------|-------|-------|
| 1. **Run migration** `db_migrations/messaging_enhancements.sql` on staging | Backend | Verify RLS with test accounts. |
| 2. **Smoke QA** using *messaging-system-test-plan.md* | QA | Cover role matrix + announcement flow. |
| 3. **Build & release** Expo update to TestFlight / Internal track | Mobile | Ensure OTA enabled for JS bundle. |
| 4. **Data back-fill** – populate `location` JSON for existing profiles | Ops | Required for geo filter. |
| 5. **Prod rollout** after staging sign-off | DevOps | Tag `v2.0.0`. |
| 6. **Monitor** logs & "reported messages" table for first 48 h | Support | Escalate any RLS or moderation issues. |

---

## 6&nbsp;· Security Considerations

* **RLS-first design** – no message/participant row is readable unless `auth.uid()` is a participant **and** message not deleted.  
* **Soft delete** keeps audit trail (`deleted_by`, `deleted_at`) without exposing content to others.  
* **Input validation** on all RPCs; creator role and recipient roles are verified server-side.  
* **Removal of debug UI** prevents accidental leakage of user IDs / JWTs.  
* **No client-side bypasses** – permissions checked both in UI and server; defence-in-depth.  
* **Future**: integrate content-moderation API and admin dashboard for reported items.

---

*Prepared by: Engineering Team* – 2025-06-27
