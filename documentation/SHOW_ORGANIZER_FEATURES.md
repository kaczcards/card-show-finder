# Show Organizer Features – Phase 1  

This document explains the **database foundations, backend functions, RLS rules, and TypeScript services** added in *Phase 1* to enable Show-Organizer capabilities in **Card Show Finder**.

---

## 1  Overview
With these changes, any user who has the role **`SHOW_ORGANIZER`** can now:

| Ability | What it means |
|---------|---------------|
| Claim shows | Take ownership of an existing show record (and all children if it is a series parent). |
| Manage recurring series | Mark a record as the series “parent”, add/remove child dates, and query aggregate review scores. |
| Add flexible show info | Store arbitrary key/value details (`extra_details` JSONB) such as parking notes, social links, table counts, etc. |
| Respond to reviews | Post, edit, or delete an official organizer reply on any review of their shows. |
| Broadcast messages | Send quota-limited messages to **attendees** or **dealers** and view a full send history. |

Everything is implemented entirely in **Supabase SQL** and exposed in the app through **`organizerService.ts`**.

---

## 2  Database Changes (`db_migrations/show_organizer_phase1.sql`)

| Table / Object | New Column / Object | Purpose |
|----------------|---------------------|---------|
| `public.shows` | `parent_show_id UUID` | Links a child occurrence to its series parent. |
|                | `is_series_parent BOOLEAN DEFAULT FALSE` | Marks the canonical record for a series. |
|                | `extra_details JSONB DEFAULT '{}'` | Flexible organizer-defined metadata. |
| `public.profiles` | `broadcast_message_count INT DEFAULT 0` | Rolling monthly counter. |
|                  | `last_broadcast_reset_date TIMESTAMPTZ` | Used to reset quota on month start. |
| `public.broadcast_logs` *(NEW)* | Full audit of organized messages.<br>`id, organizer_id, show_id, message_content, recipients[], sent_at` |
| **Indexes** | `shows_parent_show_id_idx`, `broadcast_logs_*_idx` | Performance on common queries. |

---

## 3  Supabase Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `claim_show` | `(show_id UUID, organizer_id UUID) → BOOLEAN` | Assigns `organizer_id` to an unclaimed show and cascades to children if the show is a series parent. |
| `get_aggregate_review_score` | `(series_parent_id UUID) → TABLE(avg, total)` | Computes average rating & review count across parent + children. |
| `reset_broadcast_count` | `(p_organizer_id UUID)` | Resets monthly quota on first use each month. |
| `is_show_organizer_for_review` | `(review_id UUID) → BOOLEAN` | Helper used by RLS to gate review responses. |

All functions are `SECURITY DEFINER` and executable by the `authenticated` role.

---

## 4  Row-Level Security Highlights

| Table | Policy |
|-------|--------|
| `shows` | `UPDATE … USING (auth.uid() = organizer_id)` – organizers can edit only their own shows. |
| `reviews` | Organizer may update only `organizer_response` when `is_show_organizer_for_review(review_id)` returns true. |
| `broadcast_logs` | `INSERT` / `SELECT` allowed only where `organizer_id = auth.uid()`. |

---

## 5  TypeScript Service (`src/services/organizerService.ts`)

| Method | Description |
|--------|-------------|
| `claimShow(showId, organizerId)` | Wraps the `claim_show` RPC. |
| `getOrganizerShows(id, {includeSeriesChildren})` | Returns owned shows (optionally including child occurrences). |
| `markShowAsSeriesParent(showId)` | Sets `is_series_parent = true`. |
| `addShowToSeries(childId, parentId)` / `removeShowFromSeries` | Manage parent/child links. |
| `getSeriesReviewScore(parentId)` | Calls `get_aggregate_review_score`. |
| `updateShowExtraDetails(showId, json)` | Patches `extra_details`. |
| `respondToReview(reviewId, text)` | Adds or updates organizer reply. |
| `deleteReviewResponse(reviewId)` | Removes a reply. |
| `sendBroadcastMessage(organizerId, {showId, content, recipients[]})` | Inserts `broadcast_logs` and bumps quota. |
| `getBroadcastQuota(organizerId)` | Returns `{used, limit, remaining, resetDate}` (default limit = 10). |
| `getBroadcastHistory(organizerId, opts)` | Paged history with optional show filter. |

---

## 6  Running the Migration

1. **Checkout the feature branch**  
   ```bash
   git checkout feature/show-organizer-phase1
   ```

2. **Configure environment** (`.env`):
   ```
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_KEY=<service-role-key>
   ```

3. **Execute**:
   ```bash
   cd db_migrations
   node execute_show_organizer_migration.js
   ```

4. **Review manual notes** at the bottom of `show_organizer_phase1.sql` for marking existing series parents and linking children.

---

## 7  Frontend Usage Examples

### 7.1  Claim a Show
```ts
import { claimShow } from '../services/organizerService';

const { success, error } = await claimShow(showId, user.id);
if (success) alert('Show claimed!');
```

### 7.2  Create / Manage a Series
```ts
await markShowAsSeriesParent(parentId);
await addShowToSeries(childId, parentId);
const score = await getSeriesReviewScore(parentId);
console.log(score.data?.averageRating);
```

### 7.3  Add Flexible Details
```ts
await updateShowExtraDetails(showId, {
  parkingInfo: 'Free lot behind venue',
  tables: 75,
  website: 'https://carmelcardshow.com'
});
```

### 7.4  Respond to a Review
```ts
await respondToReview(reviewId, 'Thanks!  We added more food vendors for next month.');
```

### 7.5  Broadcast a Message
```ts
await sendBroadcastMessage(user.id, {
  showId,
  content: 'Tables are now sold out – thank you, dealers!',
  recipients: ['dealers']
});
```

Use `getBroadcastQuota` to warn the organizer before sending:
```ts
const { data: quota } = await getBroadcastQuota(user.id);
if (quota?.remaining === 0) alert('Limit reached');
```

---

## 8  Next Steps (Phase 2 Preview)

* Organizer-dashboard UI refinements & analytics  
* Dealer/attendee segmentation in broadcasts  
* Payment-tier enforcement on quotas  
* Push-notification / email delivery integration  
* Show-view and review-stats dashboards  

Phase 1 lays the groundwork; future phases will build richer workflows on top of this schema. 🎉
