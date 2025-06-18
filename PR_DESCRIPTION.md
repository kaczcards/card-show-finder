# PR: Fix Spatial Query Errors & Add Client-Side ZIP Code Caching

## ✨ What’s New
| Area | Type | Description |
|------|------|-------------|
| `src/services/showService.ts` | **Fix** | Re-wrote the `st_dwithin` filter call to use the correct PostGIS argument order, eliminating `PGRST100` syntax errors. |
| `src/services/locationService.ts` | **Feature** | Added lightweight client-side caching for ZIP-code look-ups with **AsyncStorage** to avoid redundant geocoding and DB round-trips that are blocked by RLS. |
| `src/services/locationService.ts` | **Utility** | Introduced `clearZipCodeCache()` to wipe either a single ZIP entry or the entire cache. |

---

## 1  Spatial Query Syntax Fix (showService.ts)

### Before  
```ts
query.filter(
  'coordinates',
  'st_dwithin',
  `POINT(${lng} ${lat})::geography`,
  radiusMeters
);
```
*Supabase translated the above to* `st_dwithin.POINT(...` *which Postgres rejected.*

### After  
```ts
query.filter(
  'st_dwithin',                  // operator **first**
  'coordinates',                 // column
  `POINT(${lng} ${lat})`,        // geometry
  radiusMeters                   // distance (m)
);
```
Key changes  
1. **Operator-first signature** matches Supabase PostGIS helper contract.  
2. Point no longer cast inline; Postgres auto-casts in the helper.  
3. Radius converted from miles → meters (`* 1609.34`).

Result: `getShows()` now returns data instead of throwing `failed to parse filter…`.

---

## 2  Client-Side ZIP Code Caching (locationService.ts)

### Why  
Row-Level-Security prevents mobile clients from inserting into `public.zip_codes`, so every sign-in forced a live geocode. We now persist look-ups locally.

### How  

| Step | Details |
|------|---------|
| Key Prefix | `@zip_cache:<ZIP>` ensures isolation in AsyncStorage. |
| Look-up | `getZipCodeCoordinates()` checks cache first → DB → geocode service. |
| Cache Write | Newly geocoded results saved with `setZipCache()`. |
| RLS Note | We **still** skip DB inserts to respect existing security policy. |

### AsyncStorage Helpers  
```ts
const getZipFromCache(zip): ZipCodeData | null
const setZipCache(data: ZipCodeData): void
```

---

## 3  Cache Maintenance Utility

```ts
clearZipCodeCache(zip?: string): Promise<void>
```
* When a `zip` is supplied only that entry is removed.  
* With no argument all cached ZIP entries are purged (filtered by prefix).

---

## 🧪 Testing

1. **Spatial Search**
   1. Launch app – Home screen should load without `PGRST100`.
   2. Change radius / location; verify results update.
2. **ZIP Code Cache**
   1. Fresh install → register with ZIP **46060**.  
   2. Observe console:  
      - First run: *“geocoded on-device – not cached in DB due to RLS.”*  
      - Subsequent launches: data retrieved from AsyncStorage, no geocoding call.
   3. Run `clearZipCodeCache()` in dev menu, restart → geocode fires again.

---

## 🔄 Migration / Config

No DB migrations required.  
Ensure `@react-native-async-storage/async-storage` is installed (already in `package.json`).

---

## ✅ Checklist
- [x] Spatial query passes on local & staging databases
- [x] Caching logic covered by unit tests (added in separate commit)
- [x] No RLS violations logged
- [x] Docs updated (`PR_DESCRIPTION.md`)
