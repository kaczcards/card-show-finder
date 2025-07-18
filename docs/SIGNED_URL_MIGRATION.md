# Signed URL Migration Guide  
Card Show Finder – Private Image Storage  
_Last updated: 2025-07-21_

---

## 1 · What Are Signed URLs?

A **signed (pre-signed) URL** is a time-limited, cryptographically signed link that grants temporary access to a private object in storage.

* Contains a hash created with a secret key.
* Expires after a configurable number of seconds.
* Can carry transformation parameters (resize, format).
* Works with regular `https` GET requests—no extra auth headers required.

### Why We Migrated

Prior to this change **`card_images`** bucket was public. Anyone guessing / crawling URIs could view every uploaded image. We now:

1. Flip the bucket to **private** (`public = false`).
2. Grant read access only to:
   * The owner of the file.
   * Service-role (Edge Functions) for signed-URL generation.
   * Admins & MVP dealers via RLS policies.
3. Distribute images through signed URLs that expire after 1 hour (default).

---

## 2 · Security Benefits

| Risk With Public URLs | How Signed URLs Mitigate |
|-----------------------|--------------------------|
| Unauthenticated scraping | Link expires ⇒ can’t be indexed or shared indefinitely |
| Deep-link leakage (chat logs, referrers) | URL dead after TTL |
| Enumerating filenames | Even if guessed, request returns **403** without valid signature |
| Role-based privacy | RLS prevents service from signing for unauthorized users |
| Hotlinking bandwidth drain | TTL + transforms reduce abuse |

---

## 3 · How the Migration Was Implemented

1. **SQL Migration** `20250720000000_private_storage_migration.sql`  
   * `UPDATE storage.buckets SET public=false WHERE id='card_images';`
   * Removed **Public read access** policy.
   * Added RLS policies for owner, service_role, admin, MVP dealer.
2. **New Shared Service** `src/services/storageService.ts`  
   * Wrapper around Supabase Storage:
     * `uploadImage()`
     * `getSignedUrl()` (with local cache & image transforms)
     * `deleteImage()`, `listUserImages()`…
   * Default TTL `3600 s` with 5-minute refresh buffer.
3. **Code Refactor**  
   * All direct `.getPublicUrl` calls replaced by `storageService.getSignedUrl`.
   * Stored **path** (`userId/filename.jpg`) in DB instead of full public URL.
4. **Bucket Content** – existing files remain; only ACL changed.
5. **Caching** – signed URLs cached in memory per client to minimise round-trips.

---

## 4 · Developer Usage

### Upload

```ts
const { data: path, error } = await storageService.uploadImage(
  userId,
  fileOrBase64,
  /* optional */ undefined,
  'image/jpeg'
);
```

### Display an Image

```ts
const { data: url } = await storageService.getSignedUrl(path, {
  transform: { width: 600, quality: 80 }   // optional
});
<Image source={{ uri: url }} />
```

### Delete

```ts
await storageService.deleteImage(path);
```

### List & Batch Fetch

```ts
const { data: paths } = await storageService.listUserImages(userId);
const { data: map }  = await storageService.getMultipleImages(paths);
```

---

## 5 · Edge Cases & Gotchas

1. **URL Expiration** – after TTL you’ll get `403`.  
   * `storageService` auto-refreshes 5 min before expiry when reused.
2. **Large Lists** – batch `getMultipleImages()` to avoid 1 request per image.
3. **Transforms** – each unique transform combo generates a unique signature; cache keys include parameters.
4. **Sharing** – if you need to share an image outside the app generate a one-off signed link with longer TTL.
5. **Role Changes** – revoking user role does *not* invalidate existing signed URLs until they expire.
6. **Offline Clients** – store only *path* offline; signed URL must be requested when online.

---

## 6 · Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `403 Signature has expired` | TTL elapsed | Refresh via `getSignedUrl()` |
| `403 Object not found` | Wrong path / file deleted | Verify `path` column, ensure file exists |
| `401 Unauthorized` when generating URL | Function called on client not authenticated | Ensure Supabase session valid; refresh token |
| Image never loads (placeholder) | Using old public URL | Migrate DB field to path only and regenerate URL |
| CORS error in browser | Ensure Storage settings allow `*` origins (Supabase default) or configure allowed list |
| “Cannot read property signedUrl of undefined” | SDK quota exceeded / bucket name typo | Check bucket id `card_images`, inspect error object |
| Bandwidth spike | Hotlinking with long TTL | Shorten TTL or add referer validation on CDN layer |

---

## 7 · Verifying the Setup

```bash
# 1. Upload test image (CLI)
supabase storage upload card_images test.png --file ./test.png --project-ref <proj>

# 2. Generate signed URL (SQL)
select storage.signing_secret(); -- verify secret exists
select * from storage.objects where name ilike '%test.png%';

# 3. Edge Function
curl https://<proj>.functions.supabase.co/debug-signed-url?path=<userId>/test.png
# -> signed url, open in browser => 200 OK
```

---

## 8 · Next Steps

* Add CDN (Cloudflare R2 / Supabase Image CDN) in front of Storage for resizing & caching.
* Introduce presigned **POST** policy for direct S3-style uploads if mobile latency becomes an issue.
* Monitor `storage.objects` size + transfer metrics.

---

### You’re done!  
Private images are now secure, and you have full control over who can view them and for how long.
