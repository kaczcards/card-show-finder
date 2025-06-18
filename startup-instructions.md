# Card Show Finder – Startup & Testing Guide  
*(Supabase + Expo — June 2025)*

Follow the checklist in exact order. When you reach the end you will have the app running locally **and** you will have proven that it’s talking to Supabase correctly.

---

## 1. Prerequisites (install once)

| Tool | Minimum Version | Check / Install |
|------|-----------------|-----------------|
| **Node LTS** | 18 or 20 | `node -v` |
| **npm** | ≥ 9 | `npm -v` |
| **Git** | latest | `git --version` |
| **Expo CLI** | (bundled) | use **`npx expo …`** (no global install) |
| **Xcode** (mac) | 14+ | iOS Simulator |
| **Android Studio** | latest | Android emulator |
| **Supabase account** | free | https://supabase.com |
| **Google Maps key** | any | later for Map screen |

---

## 2. Clone & install

```bash
git clone https://github.com/<your-username>/card-show-finder.git
cd card-show-finder

# clean slate install
rm -rf node_modules package-lock.json && npm install
```

---

## 3. Configure `.env`

```bash
cp .env.example .env
```

Open `.env` and paste:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

> No quotes, no trailing spaces.  
> `.env` is already git-ignored.

---

## 4. First run ‑ verify Supabase

```bash
npx expo start -c
```

DevTools opens → press **i** (iOS) or **a** (Android).

Screen should show  
`✅ Supabase connection successful!`

If it shows a red ❌: check `.env`, then restart with `-c`.

---

## 5. Supabase database quick-check

1. Dashboard → **Table Editor** → confirm `profiles`, `shows`, `zip_codes`.
2. SQL Editor → run  
   `select name from pg_available_extensions where name='postgis';`
   (should return a version).

### Run full setup script

Dashboard → SQL Editor → new query → paste **`supabase-setup.sql`** (repo root) → **Run**.  
The script:

* enables PostGIS  
* creates all tables & policies  
* inserts 3 sample shows

Running twice is safe (existing tables will error but skip).

---

## 6. Test authentication

1. In the app tap **Register**
2. Use sample data (email `test@example.com`, pwd `Test123!`, ZIP `90210`)
3. Submit → app navigates to home.

Verify in Supabase:

* **Auth → Users** row exists  
* **profiles** row created

Logout → login again to confirm persistence.

---

## 7. Seed & view shows (optional)

```sql
insert into public.shows
(title,location,address,start_date,end_date,entry_fee,status,coordinates)
values
('Demo Card Show','LA Convention Center',
 '1201 S Figueroa St, Los Angeles, CA',
 now() + interval '7 days',
 now() + interval '7 days',
 0,'ACTIVE',
 ST_Point(-118.2673,34.0403)::geography );
```

Home list shows it, Map pin appears.

---

## 8. Favourites test

1. On Show Detail tap ♥ → turns red  
2. profiles.favorite_shows array updates  
3. Tap again to remove.

---

## 9. Quick error scenarios

| Scenario | Expected UI |
|----------|-------------|
| No internet then open app | Red banner “Connection failed” |
| Delete show in DB then refresh | Show disappears |
| Disable Email auth then register | Toast “Registration failed” |

---

## 10. Daily workflow

```bash
npx expo start          # run dev server
git checkout -b feature/my-task
git add .
git commit -m "feat: my task"
git push -u origin feature/my-task
```

---

## 11. Ready for Stage 1 dev

When all above passes you can:

1. Implement Home/Map filters, Favorites tab, etc.  
2. Build release with  
   `npx expo prebuild && eas build`

Happy collecting 🚀
