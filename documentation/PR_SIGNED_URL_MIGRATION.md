# PR: Migrate Card Images to Private Storage with Signed URLs 🔐🖼️

## 1 · Purpose

We are moving **all card_images** from a **public bucket** to a **private bucket** served through time-limited **signed URLs**.  
Goals:

* Eliminate uncontrolled public access to user–uploaded images  
* Honour privacy expectations for collections & want-lists  
* Lay groundwork for CDN-optimised image transforms

---

## 2 · What Changed

| Area | Change |
|------|--------|
| **DB Migration** | `20250720000000_private_storage_migration.sql` converts `card_images` bucket to `public=false`, removes public-read policy, adds RLS for owners/service-role/admin/MVP-dealer |
| **Shared Service** | `src/services/storageService.ts` – helper for `uploadImage`, `getSignedUrl`, cache, transforms |
| **Collection Service** | Replaced `getPublicUrl()` calls with `storageService.getSignedUrl()` and now stores **path** (e.g. `userId/file.jpg`) instead of full URL |
| **Image Upload/Delete** | All CRUD methods use `uploadImage` / `deleteImage` which respect private bucket |
| **Debug Function** | `/functions/debug-signed-url` (non-prod) to generate test links |
| **Docs** | `docs/SIGNED_URL_MIGRATION.md` (overview, dev usage, troubleshooting) |
| **Policies** | New RLS functions `is_mvp_dealer()` etc. |

---

## 3 · How to Test

1. **Apply migration on staging**

   ```bash
   supabase db push --file supabase/migrations/20250720000000_private_storage_migration.sql
   ```

2. **Upload image via app**

   * Add a new card → ensure upload succeeds.
   * DB should store `userId/filename.jpg` not an `https://…` URL.

3. **View collection**

   * Images load through signed URLs (inspect Network → request path has `?token=…&expires=`).
   * Refresh page after 1 h: service refreshes URL automatically.

4. **Direct-link protection**

   * Copy signed URL, wait for expiry (`expires=` param) or shorten TTL in dev:
     ```bash
     curl -I '<signed-url>'   # after TTL => 403
     ```
5. **Role checks**

   * Non-owner should receive 403 when requesting signed URL through debug endpoint.
   * Admin can still fetch any path.

6. **Backward compatibility**

   * Existing rows with full public URL: update image, verify path gets migrated.

---

## 4 · Migration Steps (Prod)

1. **Schedule maintenance window** – images briefly unavailable until redeploy.
2. **Run SQL migration**:
   ```bash
   supabase db push --file supabase/migrations/20250720000000_private_storage_migration.sql
   ```
3. **Deploy new shared code / functions**:
   ```bash
   supabase functions deploy mfa stripe-webhook debug-signed-url
   expo build  # mobile app to pick up new endpoints
   ```
4. **Data patch (one-off)**  
   Convert existing `imageurl` values that are full URLs into path-only strings:
   ```sql
   UPDATE user_cards
   SET imageurl = regexp_replace(imageurl, '^.*card_images/([^?]+).*$', '\1')
   WHERE imageurl LIKE '%card_images/%';
   ```
5. **Purge CDN / cache** – if Cloudflare in front of Storage, purge old public URLs.
6. **Smoke tests** – repeat section 3 above.

---

## 5 · Security Implications

* **Access control**: Public read removed; only owner, service-role, admins and MVP dealers (via custom RLS) can generate links.
* **Least exposure**: Links auto-expire (default 1 h) and cannot be guessed (HMAC signature).
* **Reduced scraping**: Images no longer crawlable by bots or search engines.
* **Logging**: Access moved server-side (`createSignedUrl`), improving audit capability.
* **Break-glass**: Admins retain full read via RLS.
* **Future attack surface**: Signed URLs shield against enumeration but rely on storage secret; rotate yearly.

---

## 6 · Reviewer Checklist

- [ ] Migration applies cleanly on staging.
- [ ] App uploads new images and displays them via signed URLs.
- [ ] Existing images patched to path-only values.
- [ ] No unauthorised 403/401 for legitimate users.
- [ ] Debug signed-url function disabled in production (`ENVIRONMENT=production`).

---

**Happy reviewing!** 🎉
