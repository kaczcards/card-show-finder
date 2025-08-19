# RLS_FIX_INSTRUCTIONS.md  
Fixing Row-Level-Security for the Want-Lists Feature
====================================================

The want-lists screen still renders empty because the **user_favorite_shows** table is locked down by RLS.  Attendees can write their own “♥ favorites”, but **MVP dealers / Show organizers cannot read those rows**, so the service returns an empty set.

---

## 1 · Root Cause

| Table | Current RLS Behaviour | Why It Breaks the Feature |
|-------|----------------------|---------------------------|
| `user_favorite_shows` | `SELECT` policy: `auth.uid() = user_id` (only owners can view) | MVP dealers & organizers must read attendee favorites to know **who** is going to their shows. |
| `want_lists` | Already has policies that let MVP dealers & organizers read lists *if* they can prove the attendee is at the same show. | Works **once** we can discover the attendee via `user_favorite_shows`. |

Result: the service layer never discovers any attendee IDs, so zero want-lists are returned.

---

## 2 · The Fix

Add **read-only** RLS policies on `user_favorite_shows` :

1. **MVP Dealer policy**  
   Allow any user whose profile `role = 'mvp_dealer'` to `SELECT` rows **for shows they also participate in**.

2. **Show Organizer policy**  
   Allow any user whose profile `role = 'show_organizer'` to `SELECT` rows **for shows they organize**.

Insert/​delete policies remain unchanged (users may only modify their own favorites).

---

## 3 · Step-by-Step: Apply in Supabase SQL Editor

1. **Open** your Supabase project → **SQL Editor**.  
2. **Copy / paste** the script below and click **Run**.

```sql
-- =========================================================
-- RLS FIX  ·  user_favorite_shows read-access for MVP Dealer / Organizer
-- =========================================================

-- Ensure table exists (noop if already created by migrations)
CREATE TABLE IF NOT EXISTS public.user_favorite_shows (
  user_id  UUID REFERENCES auth.users  (id) ON DELETE CASCADE,
  show_id  UUID REFERENCES public.shows(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, show_id)
);

-- Enable RLS
ALTER TABLE public.user_favorite_shows ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- 1. Remove old policies with identical names (if they exist)
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "mvp_dealer_can_read_attendee_favorites" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "organizer_can_read_attendee_favorites"   ON public.user_favorite_shows;

-- ------------------------------------------------------------------
-- 2. MVP dealer read policy
-- ------------------------------------------------------------------
CREATE POLICY "mvp_dealer_can_read_attendee_favorites"
ON public.user_favorite_shows
FOR SELECT
TO authenticated
USING (
  -- Must be MVP dealer
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
  )
  -- ...and dealer participates in the same show
  AND EXISTS (
    SELECT 1 FROM public.show_participants sp
    WHERE sp.userid = auth.uid()
      AND sp.showid = user_favorite_shows.show_id
  )
);

-- ------------------------------------------------------------------
-- 3. Show-organizer read policy
-- ------------------------------------------------------------------
CREATE POLICY "organizer_can_read_attendee_favorites"
ON public.user_favorite_shows
FOR SELECT
TO authenticated
USING (
   EXISTS (
     SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'show_organizer'
   )
   -- Organizer owns the show
   AND EXISTS (
     SELECT 1 FROM public.shows s
     WHERE s.id = user_favorite_shows.show_id
       AND s.organizer_id = auth.uid()
   )
);

-- Existing self-access policies (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE polname = 'user_can_read_own_favorites'
      AND tablename = 'user_favorite_shows'
  ) THEN
    CREATE POLICY user_can_read_own_favorites
      ON public.user_favorite_shows
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END$$;

-- Grant permissions (safe: SELECT only for others)
GRANT SELECT, INSERT, DELETE ON public.user_favorite_shows TO authenticated;
```

3. **Verify** the query runs without errors (`RLS policies created`)  
4. **Commit** & deploy migrations if you manage schema via migration files.

---

## 4 · Testing the Fix

1. **Attendee flow**  
   a. Log in as a normal attendee.  
   b. Heart an upcoming show (`user_favorite_shows` row).  
   c. Create a want-list (`want_lists` row).

2. **MVP Dealer flow**  
   a. Ensure dealer is in `show_participants` for the *same* upcoming show.  
   b. Open Profile → Collection → *Attendee Want Lists*.  
      • You should now see the attendee card.

3. **Show Organizer flow** (optional)  
   Organizer owning the show should see the same card.

4. **Negative test**  
   Remove the heart → card disappears after refresh.

---

## 5 · Expected Behaviour After Fix

• MVP dealers & organizers can read attendee favorites **only for shows they’re associated with** (principle of least privilege).  
• Want-lists populated when prerequisites exist.  
• Attendees still control their own data – no other user can write/​delete their favorites.

---

### Rollback

If needed, simply `DROP POLICY` the two new policies:

```sql
DROP POLICY IF EXISTS "mvp_dealer_can_read_attendee_favorites" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "organizer_can_read_attendee_favorites"   ON public.user_favorite_shows;
```

---

**Status:** Apply the script, re-run the app, and the want-lists screen should finally display attendee lists to MVP dealers and show organizers.  
