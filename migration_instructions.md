# Supabase Migration – Fix PostGIS Coordinate Extraction  
*(Update `nearby_shows` & `nearby_shows_earth_distance` functions to return plain latitude / longitude columns)*

---

## 1. Context

The mobile app now expects each show row to include **numeric** `latitude` and `longitude` fields.  
A new migration `supabase/migrations/20240710_update_nearby_shows_function.sql` has been added to:

1. Drop the old functions.
2. Re-create them with `ST_Y()` / `ST_X()` so each result row contains:
   ```
   latitude  -- Y (North/South)
   longitude -- X (East/West)
   ```
3. Keep all original columns + ordering + security grants.

Until this migration is applied **pins will not appear on the map**.

---

## 2. Automated Approach (recommended)

### 2.1 Prerequisites
| Requirement | Notes |
|-------------|-------|
| Supabase CLI ≥ 1.152 | `npm i -g supabase` |
| Project service key | Visible in Supabase → Project Settings → API |
| Local `.env` with `SUPABASE_DB_PASSWORD` | For CLI connection |

### 2.2 Steps

```bash
# 1. Navigate to repo root
cd card-show-finder

# 2. Ensure you are logged-in
supabase login

# 3. Point CLI at the correct project
supabase link --project-ref <PROJECT_REF>

# 4. Push only the new migration
supabase db push          # applies all pending migrations
#   └─ internally runs `migrations up`
```

The CLI will print something like:

```
Migrating: 20240710_update_nearby_shows_function.sql … done
```

> **After success** restart any Supabase Edge Functions / reload the SQL editor page so cached definitions refresh.

---

## 3. Manual Approach (SQL dashboard or psql)

If you cannot use the CLI, run the SQL file manually.

### 3.1 Via Supabase Dashboard

1. Open **SQL Editor** → **New Query**.  
2. Copy-paste the full contents of  
   `supabase/migrations/20240710_update_nearby_shows_function.sql`.
3. Click **Run**.  
4. Confirm “Success” in the output pane.

### 3.2 Via psql

```bash
psql "postgres://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres"

\i supabase/migrations/20240710_update_nearby_shows_function.sql
\q
```

---

## 4. Validation

### 4.1 Quick query

```sql
select id, latitude, longitude
from public.nearby_shows(lat => 39.95, long => -75.16, radius_miles => 5)
limit 5;
```

Expected:

| id | latitude | longitude |
|----|----------|-----------|
| …  | 39.9526  | -75.1652  |

### 4.2 Mobile app

1. Re-build / relaunch the app.  
2. Navigate to the map – pins should appear near your location.  
3. If no pins appear, open console logs; you should **not** see EWKB strings (`01010000…`).  

---

## 5. Rollback

If something goes wrong:

```sql
-- Remove new functions
DROP FUNCTION IF EXISTS public.nearby_shows;
DROP FUNCTION IF EXISTS public.nearby_shows_earth_distance;

-- Re-run previous migration file (20240709…sql) from Git history
```

---

## 6. Commit & Deploy

After confirming locally, merge the branch and let your CI/CD (or manual deploy) run the same CLI command against **production**.

*Happy mapping!*  
