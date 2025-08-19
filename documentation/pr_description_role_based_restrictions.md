# PR: Role-Based UI Restrictions & Collection Screen Restructure

## 📋 Overview
This pull-request introduces **role-aware navigation and feature-gating** across the mobile app as well as a **simplified, text-based “My Collection” experience**.  
The work completes the _Show Organizer / MVP Dealer_ security hardening and implements the collection page redesign requested in the July 2025 spec update.

| Area | Summary |
|------|---------|
| Navigation | **Organizer tab** is rendered **only** when the authenticated user’s role === `show_organizer` |
| Show Detail | • “Claim this show” & “Broadcast” actions now visible **exclusively** to Show Organizers<br>• Broadcast no longer shown to MVP Dealers<br>• Button code paths untouched for organizers |
| Collection Screen | • Removed **My Cards** grid<br>• Added text-box based **“What I’m Selling”**<br>• Dynamic section order:<br>&nbsp;&nbsp;— _Attendee / Dealer_: Want List ➜ Selling<br>&nbsp;&nbsp;— _MVP Dealer / Organizer_: Selling ➜ Want List ➜ Attendee Want Lists<br>• Contextual info notes per role |
| Shared Want Lists | MVP Dealers & Organizers use the existing `AttendeeWantLists` component embedded below their lists |

## 🤔 Motivation
1. **Security / UX** – Prevent non-organizers from accessing administrative tooling.
2. **Dealer Value Prop** – Tease Attendee Want List access to convert regular dealers to MVP tier.
3. **Simpler Collection** – Text field is faster than photo uploads and aligns with new roadmap.

## 🗂️ Major Changes
### Navigation
* `src/navigation/MainTabNavigator.tsx`
  * Injected `useAuth` and conditionally registers **Organizer** tab.

### Show Detail
* `src/screens/ShowDetail/ShowDetailScreen.tsx`
  * `Broadcast` button gated behind `isCurrentUserOrganizer`.
  * `Claim Show` button shown only to Show Organizers not already owning the show/series.

### Collection
* `src/screens/Collection/CollectionScreen.tsx`
  * Removed Tabs; introduced scroll layout with `section` blocks.
  * New local state for **sellingList** text.
  * Role-conditional rendering & info banners.
  * Embedded `AttendeeWantLists` for MVP Dealers & Organizers.
* Deleted legacy card-grid logic inside this screen (card components remain for future use).

### Types / Context
* No schema changes; leverages existing `UserRole` enum and `AuthContext`.

## 🖼️ UI Preview
_(screenshots/GIFs to be attached after CI build)_

## ✅ Testing Steps
1. **Log in as each role** and verify visibility matrix:

| Role | Organizer Tab | Claim / Broadcast | Want List Order | Attendee Want Lists |
|------|---------------|-------------------|-----------------|---------------------|
| Attendee | ✗ | ✗ | Want ➜ Sell | ✗ |
| Dealer | ✗ | ✗ | Want ➜ Sell | ✗ (upgrade notice) |
| MVP Dealer | ✗ | ✗ | Sell ➜ Want ➜ AWL | ✓ |
| Show Organizer | ✓ | ✓ | Sell ➜ Want ➜ AWL | ✓ |

2. Validate saving of “What I’m Selling” persists (mocked locally until backend endpoint ready).
3. Regression: favorite shows, review flows, and existing navigation remain functional.

## 🔧 Migrations
* **None** – purely front-end; no DB or Supabase storage changes.

## 🔍 Known Limitations / Follow-Ups
* Selling list persists only in component state; endpoint to be added (**CSF-134**).
* Organizer dashboard still draft; hidden tab prevents access for other roles but underlying screens need QA.
* Analytics events will be wired in a subsequent PR.

## ☑️ Checklist
- [x] Feature flag removed – code paths are live
- [x] Manual tests on iOS & Android
- [x] Unit tests updated (`roleVisibility.test.tsx`)
- [ ] Screenshots added to PR description
- [ ] Product owner sign-off

---

_This PR was prepared by the Factory Droid based on stakeholder requirements dated **9 July 2025**._
