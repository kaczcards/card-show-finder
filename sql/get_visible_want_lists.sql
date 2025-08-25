-- sql/get_visible_want_lists.sql
-- Purpose: Provide a SECURITY DEFINER RPC to return want lists visible to a viewer
-- Logic:
--  - MVP dealers: attendees of shows they are registered/confirmed for (upcoming/ongoing)
--  - Show organizers: attendees of their upcoming/ongoing shows
--  - Attendee roles included: attendee, dealer, mvp_dealer
--  - Filters out inventory-prefixed and empty want lists

CREATE OR REPLACE FUNCTION public.get_visible_want_lists(
  viewer_id UUID,
  show_id UUID DEFAULT NULL,
  search_term TEXT DEFAULT NULL,
  page INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 20
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  WITH relevant_shows AS (
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
      AND (show_id IS NULL OR s.id = show_id)
  ),
  base AS (
    SELECT 
      wl.id           AS want_list_id,
      wl.userid       AS attendee_id,
      (p.first_name || ' ' || COALESCE(p.last_name,'')) AS attendee_name,
      s.id            AS show_id,
      s.title         AS show_title,
      s.start_date    AS show_start_date,
      s.location      AS show_location,
      wl.content,
      wl.updatedat    AS updated_at
    FROM relevant_shows rs
    JOIN show_participants spa ON spa.showid = rs.id AND spa.status IN ('registered','confirmed')
    JOIN profiles p            ON p.id = spa.userid AND p.role IN ('attendee','dealer','mvp_dealer')
    JOIN want_lists wl         ON wl.userid = spa.userid
    JOIN shows s               ON s.id = rs.id
    WHERE wl.content IS NOT NULL
      AND wl.content <> ''
      AND wl.content NOT ILIKE '[INVENTORY]%'
      AND (search_term IS NULL OR wl.content ILIKE '%' || search_term || '%')
  )
  SELECT COUNT(*) INTO total_count FROM base;

  WITH paged AS (
    SELECT * FROM base
    ORDER BY updated_at DESC
    LIMIT page_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',            want_list_id,
        'userId',        attendee_id,
        'userName',      attendee_name,
        'showId',        show_id,
        'showTitle',     show_title,
        'showStartDate', show_start_date,
        'showLocation',  show_location,
        'content',       content,
        'updatedAt',     updated_at
      )
    ) FILTER (WHERE TRUE), jsonb_build_array()),
    'totalCount', total_count,
    'page', page,
    'pageSize', page_size,
    'hasMore', (v_offset + page_size) < total_count
  ) INTO result
  FROM paged;

  RETURN COALESCE(result, jsonb_build_object(
    'data', jsonb_build_array(),
    'totalCount', 0,
    'page', page,
    'pageSize', page_size,
    'hasMore', FALSE
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
