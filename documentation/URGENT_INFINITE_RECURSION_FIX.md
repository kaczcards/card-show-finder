# 🚨 URGENT – Fix Infinite Recursion in `show_participants` RLS Policies

> **Audience:** DBA / Lead Engineer  
> **Database:** Supabase Postgres (production)  
> **Created:** 21 Jul 2025  

---

## 1 . Current Status

* The **infinite-recursion bug** in `show_participants` Row-Level-Security (RLS) policies **has *not* been fixed** in production.  
* Problematic policy `show_participants_select_mvp_dealer` was removed, but **the replacement policy & helper function have not been installed**.

---

## 2 . Why This Is High Priority

1. **Hard Query Failures** – MVP dealers attempting to read show participants trigger `ERROR: infinite recursion detected in policy for relation show_participants` (SQL state 42P17).  
2. **Broken Features** – Dealer dashboards, shared want-list matching and several RPCs fail, blocking business-critical workflows.  
3. **Database Instability** – Recursion guard termination clutters logs and can cancel entire sessions, risking broader outages.  
4. **Customer Impact** – Paying “MVP Dealer” subscribers cannot access key features, threatening churn and support escalations.

---

## 3 . Manual Fix — Step-by-Step (5 minutes)

1. **Open Supabase Dashboard**  
   *Project → SQL editor*  

2. **Copy & paste the “Exact SQL Code” (section 4) into a new query tab.**

3. **Run the script**  
   *Ensure it reports `COMMIT` / *Migration complete* notices at the end.*

4. **Verify** using the steps in section 5.

5. **Deploy mobile app** *(optional)* – No app changes required; backend fix is sufficient.

---

## 4 . Exact SQL Code to Execute

Paste **everything inside the gray box**:

```sql
-- === FIX INFINITE RECURSION IN show_participants POLICIES ==============
BEGIN;

------------------------------------------------------------------
-- 1. Helper function (non-recursive participation check)
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.participates_in_show_safe(showid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles p
    LEFT JOIN shows s           ON s.organizer_id = p.id
    WHERE p.id = auth.uid()
      AND (
        s.id = showid                                      -- organiser
        OR EXISTS (                                         -- dealers array
          SELECT 1 FROM shows
          WHERE id = showid
            AND dealers IS NOT NULL
            AND auth.uid()::text = ANY(dealers)
        )
        OR EXISTS (                                         -- planned attendance
          SELECT 1 FROM planned_attendance pa
          WHERE pa.show_id = showid
            AND pa.user_id = auth.uid()
        )
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.participates_in_show_safe(UUID) TO authenticated;

------------------------------------------------------------------
-- 2. Drop faulty recursive policy if it still exists
------------------------------------------------------------------
DROP POLICY IF EXISTS "show_participants_select_mvp_dealer"
  ON public.show_participants;

------------------------------------------------------------------
-- 3. Replacement policy (non-recursive)
------------------------------------------------------------------
CREATE POLICY "show_participants_select_mvp_dealer_fixed"
  ON public.show_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'mvp_dealer')
    AND (
      userid = auth.uid()                       -- always own row
      OR EXISTS (SELECT 1 FROM shows s          -- organiser
                 WHERE s.id = show_participants.showid
                   AND s.organizer_id = auth.uid())
      OR participates_in_show_safe(showid)      -- safe helper
    )
  );

------------------------------------------------------------------
-- 4. Self-visibility fallback
------------------------------------------------------------------
CREATE POLICY IF NOT EXISTS "show_participants_select_self"
  ON public.show_participants
  FOR SELECT
  TO authenticated
  USING (userid = auth.uid());

------------------------------------------------------------------
-- 5. Documentation
------------------------------------------------------------------
COMMENT ON POLICY "show_participants_select_mvp_dealer_fixed" ON public.show_participants
  IS 'Replaces recursive policy; lets MVP dealers & organisers read participants without recursion.';

COMMENT ON FUNCTION public.participates_in_show_safe(UUID)
  IS 'Non-recursive check whether current user participates in given show.';

COMMIT;
-- === END FIX ===========================================================
```

---

## 5 . How to Verify the Fix Worked

1. **Policy Check**

```sql
SELECT polname
FROM pg_policies
WHERE tablename = 'show_participants';
```

*Expected:*  
• `show_participants_select_mvp_dealer_fixed`  
• `show_participants_select_self`

2. **Function Check**

```sql
SELECT proname
FROM pg_proc
JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
WHERE n.nspname = 'public'
  AND proname = 'participates_in_show_safe';
```

*Expected:* one row returned.

3. **Runtime Smoke Test**

```sql
-- Replace with a real show UUID that the current dealer attends
SET ROLE authenticated;
SELECT *
FROM public.show_participants
WHERE showid = '<some-show-uuid>'
LIMIT 5;
```

*Expected:* rows returned, **no recursion error**.

4. **App Test**  
Log in as an MVP Dealer → open “Show Roster” → participants list loads.

---

## 6 . Consequences If Not Fixed Soon

| Timeframe | Impact |
|-----------|--------|
| **Today** | Dealers continue to hit 500-errors; support tickets escalate. |
| **48 hrs** | Churn risk grows; refunds demanded for unusable paid tier. |
| **1 week** | Persistent DB errors may trigger auto-scaling alarms, risking downtime; negative App-Store reviews accumulate. |
| **>1 week** | Engineering must perform emergency hot-patch under pressure; credibility with users & stakeholders erodes. |

**Fix immediately** to avoid revenue loss and database instability.
