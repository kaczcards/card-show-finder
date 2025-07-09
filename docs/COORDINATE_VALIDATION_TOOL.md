# Coordinate Validation Tool

An internal-only admin feature that plots **every** card show in the database on a single world map so you can visually spot incorrect or missing coordinates and fix them on the spot.

---

## 1. Why this tool exists

A map is only as good as its data.  
Even one bad latitude / longitude can:

* make a legitimate show disappear from user searches,
* confuse clustering logic, or
* render the whole map seemingly empty (when the map auto-zooms to an out-of-bounds marker in the middle of the ocean).

The **Coordinate Validation Tool** eliminates these issues by giving admins a fast, visual way to audit and correct coordinates before they impact end-users.

---

## 2. Architecture at a glance

| Layer            | Component / File                                     | Purpose |
| ---------------- | ---------------------------------------------------- | ------- |
| Database (SQL)   | `supabase/migrations/20240709_enable_extensions_and_create_nearby_shows_function.sql` | Enables `cube`, `earthdistance` & adds `nearby_shows` function. |
| Auth & RLS       | `supabase/migrations/20240709_create_admin_role.sql` | Adds `user_roles` table, `is_admin()` helper & RLS allowing admins to update shows. |
| Admin services   | `src/services/adminService.ts`                       | RPC wrapper: `checkAdminStatus`, `getAllShowsForValidation`, `updateShowCoordinates`. |
| UI               | `src/screens/Admin/AdminMapScreen.tsx`               | React-Native screen that displays the map & edit modal. |
| Navigation       | `src/navigation/AdminNavigator.tsx` (nested in `RootNavigator`) | Routes admin users to the screen. |

---

## 3. Setup instructions

> These steps **must** be completed before any admin can open the screen.

### 3.1 Run database migrations

1. Push the two new SQL migration files to Supabase:
   ```bash
   supabase db push --linked
   ```
2. Verify in the dashboard:
   * `cube`, `earthdistance`, `postgis` are enabled (`Database → Extensions`).
   * Two new functions:
     * `public.nearby_shows`
     * `public.is_admin`

### 3.2 Create the first admin user

1. Sign up a normal user via the mobile app or Supabase auth UI.
2. Grab that user’s **UUID** from `auth.users`.
3. Run the helper script (requires a service key):
   ```bash
   node scripts/create_admin_user.js <user_uuid_here>
   ```
4. Confirm a new row exists in `public.user_roles` with `role = 'admin'`.

After the first admin is created, additional admins can be granted / revoked **inside the app** (Profile → Admin → Assign Admin).

### 3.3 Environment variables

The tool uses the same Supabase credentials as the rest of the app, plus the Google Maps API key.  
Make sure `.env` contains:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

*(For build server / CI use `SUPABASE_SERVICE_KEY` as well, needed by the admin script.)*

### 3.4 Install dependencies & run the app

```bash
cd card-show-finder
npm install      # or yarn
npx expo start   # launches Metro + dev server
```

Open the app on a simulator or device.

---

## 4. Using the tool

### 4.1 Access

1. Log in with an **admin** account.
2. Open **Profile → Admin: Coordinate Validation**  
   (If you don’t see the option your account isn’t an admin.)

*(You can also deep-link directly to `cardshowfinder://Admin/AdminMap`.)*

### 4.2 Interface overview

| UI Element | Description |
| ---------- | ----------- |
| **Map**    | Every show is plotted; clusters auto-expand as you zoom in. |
| **Details panel** | Tap a pin to view show title, address & current coordinates. |
| **Edit Coordinates** button | Opens a modal where you can type new latitude / longitude. |
| **Status banner** | Green success or red error message after saving. |
| **Footer stats** | Total shows loaded & count of shows missing coordinates. |

### 4.3 Correcting a bad coordinate

1. Tap the rogue pin (or find the show in the footer stats list).  
2. Press **Edit Coordinates**.  
3. Enter the correct `latitude` and `longitude`.  
4. **Save Changes** – the marker will jump to the new spot immediately.  
5. Repeat until no outliers remain.

All updates are written to `public.shows.coordinates` with a PostGIS `POINT(long lat)` and `updated_at` timestamp.

---

## 5. Admin security model

* **RLS** – only rows where `public.is_admin()` returns `TRUE` may:
  * `SELECT` from `admin_shows_view`
  * `UPDATE` any row in `public.shows`
* App-side guard: `adminService.checkAdminStatus()` is called before every sensitive action.
* Navigation guard: non-admins hitting the route see an **Unauthorized** screen.

---

## 6. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| *“Unauthorized: Admin privileges required”* | Verify your UUID is in `public.user_roles` with `role = 'admin'` and your JWT is fresh (Profile → Refresh Session). |
| Pins still appear in wrong spot after save | Hard-reset the app to clear cache. Check DB for accidental lat/long swap. |
| Nothing on map / all pins in Gulf of Guinea | Some shows have `0,0` coords. Use footer stats to locate missing entries. |
| Migration errors about extensions | Your Supabase plan must support PostGIS. On free tier you may need to enable from the dashboard first. |

---

## 7. Future improvements

* **Reverse-geocoding script** for fully automated audits (Option B).
* Bulk CSV import / export of coordinates.
* “Drag-and-drop” pin repositioning on map.
* Heat-map overlay showing concentration of shows for business analytics.

---

Happy validating! 🎯
