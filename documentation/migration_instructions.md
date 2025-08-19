# Database Migration Instructions  
_Adding social-media & marketplace URL columns to `profiles`_

This migration introduces five **nullable** text columns so MVP Dealers and Show Organizers can save their public links:

| Column name      | Purpose                                  |
|------------------|------------------------------------------|
| `facebook_url`   | Facebook profile/page                    |
| `instagram_url`  | Instagram profile                        |
| `twitter_url`    | Twitter / X profile                      |
| `whatnot_url`    | Whatnot store URL (dealers)              |
| `ebay_store_url` | eBay store URL (dealers)                 |

The SQL file is already in the repo at  
`supabase/migrations/20250715000000_add_social_media_columns.sql`.

---

## 1. Apply via Supabase UI (Quick & graphical)

1. Sign in to your Supabase project.  
2. In the left sidebar choose **SQL editor → New query**.  
3. Copy-paste the entire contents of  
   `supabase/migrations/20250715000000_add_social_media_columns.sql`  
   into the query window.  
4. Press **Run**.  
   • The UI will execute `ALTER TABLE profiles …` and add all five columns.  
   • Because we used `ADD COLUMN IF NOT EXISTS`, running it again is safe.  
5. Confirm success in **Table editor → profiles** – you should see the new
   columns at the bottom (all nullable).

---

## 2. Apply via Supabase CLI (Automated / CI-friendly)

### Prerequisites
* Supabase CLI ≥ `1.0.0` installed and authenticated  
  ```bash
  supabase login        # first time only
  supabase link --project-ref <your-project-ref>
  ```

### Run the migration
From the repo root:

```bash
# Push only the new migration
supabase db push \
  --file supabase/migrations/20250715000000_add_social_media_columns.sql
```

The CLI will connect and execute the SQL on your **remote** database.  
If you prefer the full diff-based workflow:

```bash
supabase db diff --schema public --file tmp_diff.sql   # optional preview
supabase db push                                       # pushes all pending migrations
```

---

## 3. Verify the columns

```sql
select
  column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'profiles'
  and column_name in (
    'facebook_url','instagram_url','twitter_url',
    'whatnot_url','ebay_store_url');
```

All five rows should appear with `data_type = text` and `is_nullable = YES`.

---

## 4. Rollback (if ever needed)

Because we added **nullable** columns with no dependent objects it is safe to
drop them:

```sql
alter table profiles
  drop column ebay_store_url,
  drop column whatnot_url,
  drop column twitter_url,
  drop column instagram_url,
  drop column facebook_url;
```

(Remember to also back out UI/Code references.)

---

## 5. Troubleshooting

| Symptom                              | Fix |
|--------------------------------------|-----|
| “column does not exist” runtime error| Migration wasn’t applied; re-run steps above. |
| Migration fails with permissions     | Ensure your service role / CLI token has `alter table` privileges. |
| Columns not visible in Table Editor  | Refresh the page or clear browser cache. |

You are now ready to let users add and display their social-media links in the app. 🎉
