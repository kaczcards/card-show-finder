-- fix-rpc-function-final.sql
-- Purpose: Fix the get_visible_want_lists RPC function to avoid CTE issues and GROUP BY errors
-- Problem: 1. Original function used a CTE named "base" which caused errors
--          2. The query has a GROUP BY error with wl.updatedat
-- Solution: 1. Replace CTEs with temporary tables
--           2. Restructure the query to avoid GROUP BY issues with ORDER BY

-- Step 1: Drop the existing function
DROP FUNCTION IF EXISTS public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER);

-- Step 2: Create the fixed function
CREATE OR REPLACE FUNCTION public.get_visible_want_lists(
  viewer_id UUID,
  show_id UUID DEFAULT NULL,
  search_term TEXT DEFAULT NULL,
  page INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 20
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT;
  v_offset INTEGER := GREATEST(0, (page - 1) * page_size);
  total_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Identify the viewer's role
  SELECT role INTO v_role FROM profiles WHERE id = viewer_id;

  IF v_role NOT IN ('mvp_dealer','show_organizer') THEN
    RETURN jsonb_build_object('error', 'unauthorized_role');
  END IF;

  -- First, get the relevant shows (avoiding named CTE)
  CREATE TEMP TABLE temp_relevant_shows ON COMMIT DROP AS
  SELECT s.id
  FROM shows s
  WHERE (s.end_date >= NOW() OR (s.end_date IS NULL AND s.start_date >= NOW()))
    AND (
      (v_role = 'mvp_dealer' AND EXISTS (
        SELECT 1 FROM show_participants spd
        WHERE spd.showid = s.id AND spd.userid = viewer_id AND spd.status IN ('registered','confirmed')
      ))
      OR
      (v_role = 'show_organizer' AND s.organizer_id = viewer_id)
    )
    AND (show_id IS NULL OR s.id = show_id);

  -- Count total matches (avoiding named CTE)
  SELECT COUNT(*) INTO total_count
  FROM temp_relevant_shows rs
  JOIN show_participants spa ON spa.showid = rs.id AND spa.status IN ('registered','confirmed')
  JOIN profiles p            ON p.id = spa.userid AND p.role IN ('attendee','dealer','mvp_dealer')
  JOIN want_lists wl         ON wl.userid = spa.userid
  JOIN shows s               ON s.id = rs.id
  WHERE wl.content IS NOT NULL
    AND wl.content <> ''
    AND wl.content NOT ILIKE '[INVENTORY]%'
    AND (search_term IS NULL OR wl.content ILIKE '%' || search_term || '%');

  -- Get paged results (avoiding named CTE and fixing GROUP BY issue)
  -- Use a subquery to handle the ORDER BY before aggregation
  WITH ordered_results AS (
    SELECT 
      wl.id,
      wl.userid,
      p.first_name || ' ' || COALESCE(p.last_name,'') AS user_name,
      p.role AS user_role,
      s.id AS show_id,
      s.title AS show_title,
      s.start_date AS show_start_date,
      s.location AS show_location,
      wl.content,
      wl.updatedat
    FROM temp_relevant_shows rs
    JOIN show_participants spa ON spa.showid = rs.id AND spa.status IN ('registered','confirmed')
    JOIN profiles p            ON p.id = spa.userid AND p.role IN ('attendee','dealer','mvp_dealer')
    JOIN want_lists wl         ON wl.userid = spa.userid
    JOIN shows s               ON s.id = rs.id
    WHERE wl.content IS NOT NULL
      AND wl.content <> ''
      AND wl.content NOT ILIKE '[INVENTORY]%'
      AND (search_term IS NULL OR wl.content ILIKE '%' || search_term || '%')
    ORDER BY wl.updatedat DESC
    LIMIT page_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id',            r.id,
          'userId',        r.userid,
          'userName',      r.user_name,
          'userRole',      r.user_role,
          'showId',        r.show_id,
          'showTitle',     r.show_title,
          'showStartDate', r.show_start_date,
          'showLocation',  r.show_location,
          'content',       r.content,
          'updatedAt',     r.updatedat
        )
      ) FROM ordered_results r),
      jsonb_build_array()
    ),
    'totalCount', total_count,
    'page', page,
    'pageSize', page_size,
    'hasMore', (v_offset + page_size) < total_count
  ) INTO result;

  -- Drop the temp table (will also be dropped on COMMIT)
  DROP TABLE IF EXISTS temp_relevant_shows;

  RETURN COALESCE(result, jsonb_build_object(
    'data', jsonb_build_array(),
    'totalCount', 0,
    'page', page,
    'pageSize', page_size,
    'hasMore', FALSE
  ));
END;
$function$;

-- Step 3: Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- Step 4: Add helpful comment
COMMENT ON FUNCTION public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER) IS 
'Returns want lists visible to MVP dealers and show organizers.
- MVP dealers: see want lists of attendees for shows they are participating in
- Show organizers: see want lists of attendees for shows they organize
- Filters for upcoming/ongoing shows only
- Includes only registered/confirmed attendees
- Excludes inventory-prefixed and empty want lists';
