# 🚑 Immediate Deployment Guide  
_fix “infinite recursion detected in policy for relation ‘show_participants’”_

---

## 1  Prerequisites
1. Supabase project admin access (SQL Editor).  
2. Service-role key or SQL console access.  
3. Branch `fix-show-creation-coordinates` pulled locally (contains `fix-rls-infinite-recursion.sql`).

---

## 2  Apply the RLS hot-fix (2 min)

### a. Open Supabase → SQL Editor  
1. Create a new query tab.  
2. Paste the contents of **`fix-rls-infinite-recursion.sql`** (found at project root).  
3. Click **Run**.

The script:
• Drops the recursive policies.  
• Adds simplified, non-recursive policies allowing self-access plus wide read for MVP Dealers & Organizers (temporary).  

_Expected result_: “COMMIT” with no errors.

---

## 3  Restart client caches (30 sec)

1. In Expo dev, press `r` to reload.  
2. For production builds:  
   • Kill & relaunch the app or publish an OTA update after merging branch (next step).

---

## 4  Deploy code update (optional but recommended)

```
git checkout main
git merge fix-show-creation-coordinates
# build / publish
eas build --profile production
```

This contains UI error-handling and the VirtualizedList fix, but the database patch alone unblocks usage.

---

## 5  Smoke-test (3 min)

1. Sign in as **MVP Dealer**.  
2. Navigate → **My Collection**.  
   • No “infinite recursion” errors should appear.  
   • Attendee Want Lists load or show friendly “setting up” message if data missing.  
3. Sign in as **Attendee**.  
   • Create / view Want List; no errors.  
4. Run simple SQL to confirm:

```sql
select * from show_participants limit 5;
```
It should return rows without error.

---

## 6  Next Steps

The new policies are intentionally broad.  
Once stable, tighten access:

* Limit MVP Dealer visibility to shows they participate in.  
* Re-enable refined joins using `show_participants` only after adding **SECURITY INVOKER** helper views to avoid self-reference.

---

### Need help?

Slack `#urgent-prod` or email devops@cardshowfinder.app.
