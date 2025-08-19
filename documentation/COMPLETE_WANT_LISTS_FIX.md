# COMPLETE_WANT_LISTS_FIX.md  
Attendee Want-Lists Feature – Complete Two-Part Fix  
==================================================

This document is the **one-stop guide** to make the *Attendee Want Lists* screen work for MVP Dealers and Show Organizers.

It covers **two mandatory pieces**:

1. **Database / RLS policies** – let privileged users read attendee “♥ favorites” while preserving security.  
2. **Mobile-app authentication** – ensure the client is *authenticated* before it tries to write favorites & want-lists.

---

## 1 · What’s Broken

| Layer | Symptom | Root Cause |
|-------|---------|-----------|
| DB (RLS) | Service returns **0 attendees** → no want-lists | `user_favorite_shows` table only allows `SELECT` where `auth.uid() = user_id`; dealers / organizers can’t read attendee rows. |
| Mobile app | User can heart show & edit want-list **in the UI**, but nothing is stored in DB | Client calls are executed while **not authenticated** → `INSERT` blocked by `WITH CHECK (auth.uid() = user_id)` policies. |

---

## 2 · Part A – Database Fix (RLS)

### 2.1  SQL Script

Apply the script below **in Supabase SQL Editor** (or add to migrations).

```
-- RLS Fix · user_favorite_shows readable by MVP Dealers & Organizers
create table if not exists public.user_favorite_shows (
  user_id  uuid references auth.users(id) on delete cascade,
  show_id  uuid references public.shows(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, show_id)
);

alter table public.user_favorite_shows enable row level security;

/* -------------------------------------------------------------
   READ  ▸  Self, MVP Dealer, Show Organizer
------------------------------------------------------------- */
drop policy if exists user_can_read_own_favorites          on public.user_favorite_shows;
drop policy if exists mvp_dealer_can_read_attendee_fav     on public.user_favorite_shows;
drop policy if exists organizer_can_read_attendee_fav      on public.user_favorite_shows;

create policy user_can_read_own_favorites
  on public.user_favorite_shows
  for select to authenticated
  using (auth.uid() = user_id);

create policy mvp_dealer_can_read_attendee_fav
  on public.user_favorite_shows
  for select to authenticated
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'mvp_dealer')
    and exists (select 1
                from public.show_participants sp
                where sp.userid = auth.uid()
                  and sp.showid = user_favorite_shows.show_id)
  );

create policy organizer_can_read_attendee_fav
  on public.user_favorite_shows
  for select to authenticated
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'show_organizer')
    and exists (select 1
                from public.shows s
                where s.id = user_favorite_shows.show_id
                  and s.organizer_id = auth.uid())
  );

/* -------------------------------------------------------------
   WRITE  ▸  Attendee / Dealer inserts & deletes (unchanged)
------------------------------------------------------------- */
drop policy if exists user_insert_own_favorite        on public.user_favorite_shows;
drop policy if exists user_delete_own_favorite        on public.user_favorite_shows;

create policy user_insert_own_favorite
  on public.user_favorite_shows
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy user_delete_own_favorite
  on public.user_favorite_shows
  for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.user_favorite_shows to authenticated;
```

### 2.2  Why It Works

* **Read-only** access granted to MVP Dealers & Organizers **only for relevant shows**.  
* Attendees still control their own rows for inserts/deletes.  
* No broad access; principle of least privilege maintained.

---

## 3 · Part B – Mobile-App Authentication Fix

### 3.1  Requirements

1. **Sign-in before writes**  
   ```ts
   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
   ```
2. **Use the authed client** for every DB call:
   ```ts
   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
     auth: { persistSession: true, autoRefreshToken: true }
   });
   ```
3. **Check `supabase.auth.getSession()`** on app start and re-hydrate; redirect to Login if no session.
4. **Write operations** must include the authenticated user’s ID automatically (`supabase-js` does this).  
   Example:
   ```ts
   await supabase.from('user_favorite_shows').insert({ show_id });
   await supabase.from('want_lists')
                 .upsert({ content, updatedat: new Date().toISOString() });
   ```
5. **Never override `user_id` / `userid` columns manually** – let RLS match `auth.uid()`.

### 3.2  Common Pitfalls

| Symptom | Fix |
|---------|-----|
| Insert fails with “row violates RLS” | User not logged-in or wrong `user_id` supplied |
| Works in debug, not on device | Check **bundle env vars** – ensure `SUPABASE_URL` & `ANON_KEY` match production DB |
| App shows heart instantly but lost on refresh | Local state updated, **insert promise rejected** – add error handling & toast |

---

## 4 · End-to-End Testing

1. **Apply SQL** (Part A).  
2. **Build / run app** with auth fix (Part B).

### 4.1  Data-Creation Flow

| Step | Actor | Action | Table Row |
|------|-------|--------|-----------|
| 1 | Attendee | Log in | – |
| 2 | Attendee | ★ Heart upcoming show | `user_favorite_shows` |
| 3 | Attendee | Save want list | `want_lists` |
| 4 | MVP Dealer | Must be in `show_participants` for same show | `show_participants` |

### 4.2  Verification

1. **Dealer view**: Profile → Collection → Attendee Want Lists → card appears.  
2. **Organizer view** (if applicable) sees same.  
3. **Negative tests**  
   • Un-heart show → card disappears.  
   • Prefix list with `[INVENTORY]` → filtered out.  
   • Dealer removed from show → list disappears.

### 4.3  SQL Quick-check (optional)

```sql
-- Favorite exists?
select * from user_favorite_shows where user_id = '<attendee>';

-- Want-list exists?
select * from want_lists where userid = '<attendee>';

-- Dealer can read?
set role authenticated;  -- simulate
-- (then run select above)
```

---

## 5 · Deployment Checklist

1. [ ] Run **RLS SQL** in production.  
2. [ ] Redeploy mobile app with **authenticated Supabase client**.  
3. [ ] Smoke-test with test accounts.  
4. [ ] Merge & tag release.

---

**All done!**  
With both the **database policies** and **mobile-app authentication** corrected, MVP Dealers and Show Organizers will finally see attendee want-lists for their upcoming shows.  
