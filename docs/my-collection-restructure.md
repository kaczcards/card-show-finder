# “My Collection” Page Restructure – Technical Overview  
_project path: `card-show-finder/src/screens/Collection/CollectionScreen.tsx`_

---

## 1 . What Changed?

| Area | Old Behaviour | New Behaviour |
|------|---------------|---------------|
| Navigation | Two-tab UI (`What I’m Selling` & `Want List`). | Single scrollable page with *sections* rendered in different orders depending on user role. |
| Layout | Tabs controlled by local `activeTab` state. | Sections are plain React components inside a `<ScrollView>` – no tab state required. |
| Components added | — | `AttendeeWantLists`, upgraded `UnclaimedShowsList`, service helpers. |
| Services | Limited to user CRUD. | + `getSharedWantListsForDealer`, generic `getAttendeeWantListsForShow`, show-series helper `getUnclaimedShows`. |
| Role context | Not considered in collection UI. | `UserRole` drives UI ordering, feature availability, and instructional messaging. |

---

## 2 . Component Diagram (conceptual)

```
CollectionScreen
 ├─ CardGrid            (What I'm Selling)
 ├─ WantListEditor      (My Want List)
 ├─ AttendeeWantLists   (visible only to MVP_DEALER & SHOW_ORGANIZER)
 └─ InfoNoteContainer   (role hints / upsell)
```

All data-fetching is delegated to services inside `src/services/*`.

---

## 3 . Role-Based Rendering Logic

```ts
const isAdvanced = role === MVP_DEALER || role === SHOW_ORGANIZER;

return isAdvanced
  ? [Selling, WantList, AttendeeWantLists]
  : [WantList, Selling, InfoNote];
```

### Order & Visibility Matrix

| Role | Section 1 | Section 2 | Section 3 |
|------|-----------|-----------|-----------|
| **ATTENDEE** | My Want List | What I’m Selling | Info Note |
| **DEALER** | My Want List | What I’m Selling | Upsell Note |
| **MVP_DEALER** | What I’m Selling | My Want List | Attendee Want Lists |
| **SHOW_ORGANIZER** | What I’m Selling | My Want List | Attendee Want Lists |

Instructional notes differ:

* ATTENDEE – simple FYI about sharing.
* DEALER – FYI + upgrade message.
* Advanced roles – no note; feature present.

---

## 4 . “Attendee Want Lists” Feature

### Purpose  
Enable MVP Dealers & Show Organizers to browse attendee wish-lists for shows they are registered for.

### Key Elements
* **Component**: `src/components/AttendeeWantLists.tsx`
  * Dropdown (`@react-native-picker/picker`) to select one of the user’s upcoming shows.
  * Search bar (name/card keyword).
  * `FlatList` of attendee cards with “View Full List” modal via `Alert`.
  * Pull-to-refresh.
* **Service Calls**
  * `getUpcomingShows()` – restrict to shows where current user participates.
  * `getSharedWantListsForDealer(userId, showId)` – RBAC enforced (must be MVP_DEALER or SHOW_ORGANIZER).
* **RBAC**
  * Guard rendered early: non-authorized users see **Access Restricted** screen with upsell.

---

## 5 . Testing Checklist

| Scenario | Steps | Expected |
|----------|-------|----------|
| ATTENDEE user | Login → open My Collection | Want List section on top, selling grid below, info note visible. No Attendee Want Lists component. |
| DEALER (non-MVP) | Same | Identical to ATTENDEE but upgrade note appears. |
| MVP_DEALER | Same | Selling grid first → Want List → Attendee Want Lists. Dropdown lists only shows the dealer is marked as attending. Search filter works. |
| SHOW_ORGANIZER | Same as MVP dealer | Claim feature in UnclaimedShowsList works, organiser can view want lists. |
| RBAC violation | Manually hit `getSharedWantListsForDealer` with ATTENDEE id | Service returns error “Only MVP dealers or show organizers…”. |
| Pull to refresh | In any list, drag down | Spinners appear, data reloads. |
| Edge: No shows returned | For dealer with no upcoming shows | Attendee Want Lists shows “No Shows Found” empty-state. |
| Edge: Attendee shared w/out creating list | component displays italic placeholder text. |

---

## 6 . Future Enhancements

* Navigate to a *detail screen* instead of `Alert` for full want list viewing with dealer contact actions.
* Server-side pagination & infinite scroll for large events.
* Bulk messaging: allow MVP Dealers to send offers directly from list view.
* In WantListEditor: markdown support & optimisation for very large lists.
* In CardGrid: drag-n-drop re-ordering.
* Analytics: track dealer clicks on attendee lists for prioritisation scoring.
* Integrate **UnclaimedShowsList** into organizer dashboard (already scaffolded) with role-aware routing.

---

### File Reference

* `src/screens/Collection/CollectionScreen.tsx`
* `src/components/AttendeeWantLists.tsx`
* `src/components/CardGrid.tsx`
* `src/components/WantListEditor.tsx`
* `src/services/collectionService.ts`
* `src/services/showSeriesService.ts`

---

_This document should be committed alongside the code changes to aid QA, PMs, and future developers._  
