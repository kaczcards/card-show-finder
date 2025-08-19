# Attendee Want Lists – Implementation Guide

## 1. Feature Overview & Business Value
Card-show stakeholders (MVP Dealers & Show Organizers) now see real-time **Want Lists** from attendees/dealers of shows they serve—directly inside *My Collection*.  
Benefits  
• MVP Dealers stock the right inventory → higher sales & NPS  
• Organizers understand demand → curate dealer mix & marketing  
• Attendees still share lists once and automatically reach every participating MVP Dealer.

---

## 2. Technical Implementation Details
* React-Native front-end (Expo)  
* Supabase Postgres backend with PostGIS, RLS policies  
* New service file `showWantListService.ts` consolidates permission-aware queries.  
* New component `AttendeeWantLists.tsx` renders paginated lists with search & show-filter.  
* CollectionScreen conditionally swaps “Share with Upcoming Shows” for the new viewer when `role ∈ {mvp_dealer, show_organizer}`.

---

## 3. Database Schema Changes  (`db_migrations/attendee_want_lists_setup.sql`)
Tables / columns (all `public.*`):
1. **show_participants** (id, userid, showid, role, … dealer fields, `created_at`, `updated_at`)  
2. **planned_attendance** (id, user_id, show_id) – triggers auto-sync into `show_participants`.  
3. **want_lists** (id, userid, content, createdat, updatedat)  
4. **shared_want_lists** (id, userid, showid, wantlistid, sharedat)

Indexes for `userid`, `showid`, `updatedat`, GIN on `card_types`.

RLS Policies  
• Self-access for owners  
• MVP Dealer access when also participating in same show  
• Organizer access when they organize the show  
• Insert/Update/Delete self only.

Triggers  
`sync_show_participants_from_planned_attendance` keeps participant rows in sync.

---

## 4. API / Service Layer Changes
File `src/services/showWantListService.ts`:
* `getWantListsForMvpDealer(params)`  
* `getWantListsForShowOrganizer(params)`  
* `getWantListsForShow(userId, showId, …)` (role-aware wrapper)

Features  
• Pagination (`page`, `pageSize`), search (`ilike`), optional show filter  
• Safely joins `shows`, `profiles`, `show_participants` complying with RLS.  
• Transforms rows into `WantListWithUser` DTO.

---

## 5. UI / UX Changes
### Collection page
| Role | Previous | New |
|------|----------|-----|
| Attendee / Regular Dealer | Want List editor + “Share with Upcoming Shows” | **Unchanged** |
| MVP Dealer / Organizer | Want List editor *(sharing removed)* + **Attendee Want Lists viewer** | **New value** |

Component highlights  
• Header, search bar, show-picker dropdown (if >1 show)  
• Card layout: attendee name, role badge, show title/date/location, list content, updated timestamp  
• Pull-to-refresh, infinite scroll.

Responsive, uses existing design system colors.

---

## 6. Testing Strategy
Automated script `test-attendee-want-lists.js` (Node, service-role) performs:
1. Spin-up test users (attendee, dealer, MVP Dealer, organizer)  
2. Create shows, want lists, share records  
3. Assert RLS:  
   • MVP Dealer sees lists only for shows they attend  
   • Organizer sees lists for shows they own  
   • Regular dealer cannot view lists  
4. Validate pagination & search counts  
5. Clean-up all test data.

Front-end: Jest component snapshot + manual QA checklist.

---

## 7. Deployment Instructions
1. **DB Migration**  
   Execute `db_migrations/attendee_want_lists_setup.sql` via Supabase SQL editor or `supabase db push`.  
2. **Backend/Front-end**  
   ```
   git checkout main
   git merge fix-show-creation-coordinates   # contains code
   expo prebuild / eas build
   ```  
3. **Environment** – No new ENV vars.  
4. **Post-deploy** – Run `test-attendee-want-lists.js` with service key to verify.

---

## 8. User Impact Analysis
Stakeholder | Impact
------------|--------
MVP Dealer  | Gains real-time attendee demand insight; removes manual sharing step.
Show Organizer | Gains aggregate attendee demand insight.
Regular Dealer / Attendee | Workflow unchanged; privacy preserved via RLS.
Platform | Higher engagement, subscription value justification.

---

## 9. Performance Considerations
• Indexes on `want_lists.updatedat`, `show_participants.showid/userid` ensure O(log n) fetch.  
• Pagination (server-side `range()` limits) prevents over-fetching.  
• Search uses `ILIKE` on unindexed text; acceptable for small lists (<20 k). Future: add `pg_trgm` & GIN index if growth demands.  
• Component lazy-loads next page at 80 % scroll.

---

## 10. Future Enhancements
1. **Full-text search** (pg_trgm) & highlight terms.  
2. **Real-time subscriptions** (Supabase Realtime) to push updates without refresh.  
3. **Analytics dashboard** for organizers: top-requested cards, heat-maps.  
4. **CSV export** for dealers.  
5. **Private / public list toggle** allowing attendees granular control.  
6. **Notification**: alert dealer when a matching card in their inventory meets attendee request.  
7. **Mobile Push**: Dealers receive new want list alerts before show day.  

---

### Contact
Product & Engineering: `#show-insights` Slack channel – questions / feedback welcome. 