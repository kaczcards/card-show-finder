# Fixing the “operator does not exist: geography ->> unknown” Error  
_PostGIS coordinate-validation repair guide_

---

## 1  What’s happening?

* Your `shows.coordinates` column is **geography(point)** (PostGIS).  
* A trigger called **`trigger_log_null_coordinates`** (added by a recent migration) assumes **JSON**:
  ```sql
  NEW.coordinates->>'latitude'
  ```
  Using `->>` on a geography value raises  
  `42883: operator does not exist: geography ->> unknown`.

Result: every `INSERT` / `UPDATE` to `shows` that touches `coordinates` fails, blocking show creation.

---

## 2  One-time manual fix (5 min)

1. **Open Supabase dashboard → SQL Editor**  
2. **Paste the SQL below** and run it (✅ safe to re-run; it drops before creating).

### SQL — drop bad trigger & add PostGIS-aware version
```sql
-- 1. Remove the JSON-based trigger
DROP TRIGGER IF EXISTS trigger_log_null_coordinates ON public.shows;
DROP FUNCTION IF EXISTS log_null_coordinates;

-- 2. Create a PostGIS-aware trigger function
CREATE OR REPLACE FUNCTION log_null_coordinates()
RETURNS TRIGGER AS $$
DECLARE
  lat DOUBLE PRECISION;
  lng DOUBLE PRECISION;
BEGIN
  /* Handle NULL geography */
  IF NEW.coordinates IS NULL THEN
    INSERT INTO public.coordinate_issues (
      show_id, issue_type
    ) VALUES (NEW.id, 'NULL_COORDINATES');
    RETURN NEW;
  END IF;

  /* Extract lat / lng from geography → geometry */
  lat := ST_Y(NEW.coordinates::geometry);
  lng := ST_X(NEW.coordinates::geometry);

  /* Validate ranges */
  IF lat IS NULL OR lng IS NULL
     OR lat < -90 OR lat > 90
     OR lng < -180 OR lng > 180 THEN
    INSERT INTO public.coordinate_issues (
      show_id, latitude, longitude, issue_type
    ) VALUES (NEW.id, lat, lng, 'INVALID_COORDINATES');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-attach trigger to shows.co**ordinates
CREATE TRIGGER trigger_log_null_coordinates
AFTER INSERT OR UPDATE OF coordinates ON public.shows
FOR EACH ROW EXECUTE FUNCTION log_null_coordinates();
```

---

## 3  Test the fix

### A. Insert a quick test show (replace values as needed)

```sql
INSERT INTO public.shows (
  title, location, address,
  start_date, end_date,
  coordinates, organizer_id
)
VALUES (
  'Coordinate Fix Test',
  'Test Hall',
  '123 Fix St, Fixville, CA 90210',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '8 days',
  ST_SetSRID(ST_Point(-122.4194, 37.7749), 4326)::geography,
  auth.uid()  -- run with your user or null if disabled RLS
)
RETURNING id, ST_AsText(coordinates);
```

🟢 If the row is inserted and `ST_AsText` returns `POINT(-122.4194 37.7749)` the trigger no longer blocks you.

### B. Create via app

1. Log in as **Show Organizer**.  
2. Use **Add Show** with a real address.  
3. Submission should succeed with a success toast instead of the previous crash.

---

## 4  Verify everything

- [ ] SQL executed without errors.  
- [ ] Creating a show in the app no longer crashes.  
- [ ] New row appears in `shows` and `coordinates` contains a `POINT(...)`.  
- [ ] No new rows in `coordinate_issues` unless coordinates are actually bad.  
- [ ] Map pins display for newly-created show.

---

## 5  Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `permission denied for table coordinate_issues` | Assign `ADMIN` role or edit RLS; trigger inserts into `coordinate_issues`. |
| Still seeing `geography ->> unknown` | Trigger drop failed – re-run step 2. |
| App shows `RLS policy violation` | Running tests as anon; use a Supabase **service-role** key or login in the app. |

---

### 📝 Notes

* The replacement trigger **does not** block inserts; it only logs issues to `coordinate_issues`.  
* If you prefer _no trigger at all_, simply run **step 1** (drop trigger/function) and skip steps 2-3.
