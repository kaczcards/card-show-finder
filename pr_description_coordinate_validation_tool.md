# 📍 Coordinate Validation Tool – Admin Map View  
Pull Request to merge the complete implementation of the internal‐only **Coordinate Validation Tool** into *develop* (or *main*).

---

## ✨  What’s New
| Area | Description |
|------|-------------|
| Database | • Enable `cube`, `earthdistance`, `postgis`  <br>• New functions `nearby_shows`, `nearby_shows_earth_distance`, `is_admin`  <br>• Table `user_roles` + RLS policies  <br>• View `admin_shows_view`  |
| API / Scripts | `scripts/create_admin_user.js` – bootstrap first admin  |
| Services | `src/services/adminService.ts` – admin RPC helpers  |
| Mobile UI | `AdminMapScreen` (React-Native) + modal to edit lat/lng  |
| Navigation | `AdminNavigator` added & wired into `RootNavigator`  |
| Profile | Admins see “Admin: Coordinate Validation” link  |
| Docs | `/docs/COORDINATE_VALIDATION_TOOL.md` – full usage guide |

---

## 🗒️  Motivation
Bad coordinates break the public map.  
This feature gives admins a **visual audit** to quickly spot and fix outliers before they reach end-users, improving data quality and user trust.

---

## 🛠️  Implementation Details
1. **Role-Based Access**  
   * `user_roles` table and `is_admin()` function.  
   * RLS: only admins can `SELECT` from `admin_shows_view` and `UPDATE` `shows.coordinates`.

2. **Map Screen** (`AdminMapScreen`)  
   * Loads *all* shows via `adminService.getAllShowsForValidation()`.  
   * Uses existing `MapShowCluster` for clustering.  
   * Tap marker → panel → **Edit Coordinates** → modal with lat/lng inputs → save via `updateShowCoordinates()`.

3. **Near-by Shows Function**  
   * Replaces client-side filtering; reused by public map (performance boost).

4. **Navigation & Discoverability**  
   * New stack `AdminNavigator`.  
   * Profile screen conditionally displays admin link.

5. **Bootstrap Script**  
   * `node scripts/create_admin_user.js <uuid>` to create first admin when none exist.

---

## ✅  How to Test
1. **DB Migration**  
   ```bash
   supabase db push
   ```
2. **Create an admin**  
   ```bash
   node scripts/create_admin_user.js <auth.users.id>
   ```
3. **Run the app**  
   ```bash
   npx expo start
   ```  
4. **Login as admin → Profile → “Admin: Coordinate Validation”**  
5. Verify:  
   * All shows appear.  
   * Out-of-range marker visible.  
   * Edit lat/lng → Save → marker moves & DB row updated (`select coordinates from shows where id = ...`).  
   * Non-admin account is blocked with “Unauthorized”.

---

## 🔬  QA Checklist
- [ ] Migrations apply with no errors on fresh DB.  
- [ ] Public map still loads shows (regression test).  
- [ ] Admin screen hidden for non-admins.  
- [ ] RLS prevents non-admins from updating coordinates via direct API calls.  
- [ ] iOS & Android layout verified.  

---

## 📸  Screenshots / Demo
_Add gifs or screenshots once CI preview build is available._

---

## ⚠️  Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Incorrect RLS could expose admin data | High | Reviewed policies & unit tested with anon / auth tokens |
| Manual lat/lng entry errors | Medium | Includes numeric validation; future improvement = map drag-n-drop |
| Migration conflicts on shared DB | Medium | Timestamp-based migration names; run in staging first |

---

## 🔗  Related
* Closes #142 “Admin coordinate audit”
* Part of Epic **Data Quality & Integrity**

---

## 📝  Notes for Release
* Requires DB migration & first admin creation before publishing build.  
* No breaking API changes for end-users – safe for incremental rollout.
