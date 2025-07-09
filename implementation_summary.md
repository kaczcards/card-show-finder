# Card Show Finder – Implementation Summary  
*(Recurring Shows & Organizer Dashboard)*

---

## 1. Goals Achieved
| Feature | Outcome |
|---------|---------|
| **Recurring show support** | Existing single-day shows are grouped under a new parent entity `show_series`. |
| **Single-claim workflow** | Organizers claim a *series* once and automatically own all its present/future occurrences. |
| **Organizer Dashboard** | New tab with metrics, shows list, review management, broadcast quotas and quick actions. |
| **Quota-based messaging** | Pre-/post-show broadcast messages enforced through daily quota counters. |
| **Backward compatibility** | All pre-existing functionality for individual shows remains intact. |

---

## 2. Component Architecture

### 2.1 Backend / Database
```
show_series                profiles (updated)          broadcasts
┌──────────────┐           ┌───────────┐               ┌──────────┐
│ id PK        │◄─┐   ┌───►│ ...       │        ┌─────►│ id PK    │
│ name         │  │   │    │ pre_show* │        │      │ series_id│
│ organizer_id │  │   │    │ post_show*│        │      │ ...      │
│ avg_rating   │  │   │    └───────────┘        │      └──────────┘
│ review_count │  │   │                          │
└──────────────┘  │   │                          │
                  │   │                          │
shows             │   │ reviews                  │ Edge Functions
┌──────────────┐  │   │ ┌──────────────┐        │  • claim_show_series
│ id PK        │  │   │ │ id PK        │        │  • send_broadcast_message
│ series_id FK ├──┘   └─┤ series_id FK │◄───────┘  • reset-broadcast-quotas
│ start_date   │        │ rating       │
│ ...          │        │ comment      │
└──────────────┘        └──────────────┘
```
Key decisions  
* `series_id` **nullable** on `shows` for legacy rows.  
* RLS ensures only the owning organizer (or the system role) can mutate series / quotas.  
* Broadcast quotas stored in `profiles` for O(1) access.

### 2.2 Supabase Edge Functions
| Function | Responsibility | Notes |
|----------|----------------|-------|
| `claim_show_series` | Atomic claim of an unclaimed series. | Validates auth; sets `organizer_id`. |
| `send_broadcast_message` | Inserts row in `broadcasts`, decrements quota counters. | Hard-fails at 0 quota (429). |
| `reset-broadcast-quotas` | Scheduled daily job to replenish quotas after show ends. | Uses service-role key. |

### 2.3 TypeScript Service Layer
* **`showSeriesService.ts`** – consolidated API for series, shows in series, reviews, broadcast & responses.  
* **`organizerService.ts`** – wrapper that routes `claimSeriesOrShow` to the proper function.  
* Transaction helpers abstract `supabase.from().rpc()` vs `fetch()` for Edge Function calls.

### 2.4 React-Native Front-end
Component | Purpose | Interaction
----------|---------|------------
`OrganizerDashboardScreen` | Main dashboard card with metrics & tab navigation. | Pulls metrics via `showSeriesService` + Supabase profile.  
`OrganizerShowsList` | Collapsible list of claimed series & occurrences. | Edit / cancel / broadcast actions -> navigation.  
`OrganizerReviewsScreen` | Grouped reviews with filters & inline response editor. | Uses `respondToReview()` from service.  
`AddEditShowModal` | Create/edit single or recurring occurrences. | Recurrence generation handled locally then persisted.  

#### Navigation
* New **`OrganizerNavigator`** (stack) exposes: Dashboard, Reviews, SeriesDetail (placeholder), Messaging, Add/Edit.
* **`MainTabNavigator`** gains **Organizer** tab (briefcase icon) gated by auth role.

State management relies on React hooks; loading/empty/error states standardized across screens.

---

## 3. How It All Fits Together

1. **Data flow**  
   * Mobile app → `showSeriesService` → Supabase RPC / Edge Function  
   * Edge Function (if used) executes privileged SQL then returns JSON.  
   * Front-end updates local state; lists re-render.

2. **Claim cycle**  
   ```
   UI (Claim button)
         ↓
   claim_show_series (Edge)
         ↓
   UPDATE show_series.organizer_id
         ↓
   OrganizerDashboard metrics auto-reflect new ownership
   ```

3. **Broadcast messaging**  
   * UI → `send_broadcast_message` (Edge)  
   * Function checks quotas in `profiles`, inserts `broadcasts`, decrements counters.  
   * Daily scheduled job resets counters.

4. **Recurring show creation**  
   * `AddEditShowModal` builds N occurrences (weekly/bi-weekly/monthly/quarterly).  
   * All occurrences inserted in one batch via `showSeriesService.createShows()`.

---

## 4. Key Technical Decisions

Decision | Rationale
---------|-----------
Separate `show_series` table instead of renaming `shows` | Minimal risk to existing queries; keeps one-off shows valid.  
Edge Functions for claim & broadcast | Need for server-side RLS bypass + transactional updates.  
Quota fields on `profiles` | Avoids joins when checking quotas; simple counters.  
Idempotent data migration script | Safe re-runs in CI / staging.  
Service abstraction in RN app | Isolates supabase vs Edge fetch logic, eases future backend swaps.  
Navigation split (OrganizerNavigator) | Keeps dashboards isolated; header styles differ.  
UI design tokens & skeleton loaders | Consistent look, better perceived performance.

---

## 5. Remaining Placeholders / Next Epics
* **SeriesDetailScreen** – deep dive into aggregated analytics (#237).  
* **Broadcast history & targeting improvements** (#238).  
* Possible switch to **luxon** for DST-safe recurrence.  
* Expand RLS to dealer-specific features (future marketplace).

---

## 6. Migration & Deployment
See `migration_instructions.md` for a step-by-step guide:  
1. Run schema SQL → 2. Run data migration → 3. Deploy Edge Functions → 4. Schedule quota reset → 5. Release new mobile build.

---

## 7. Testing Status
- Unit tests for `showSeriesService` cover claim, review aggregation, quota error.  
- Manual walkthrough: organizer claim, recurring creation, broadcast, review response.  
- Regression: legacy single show pages function unchanged.

---

### 🎉 The platform now supports recurring card shows and gives organizers a single, powerful dashboard to manage their events end-to-end.
