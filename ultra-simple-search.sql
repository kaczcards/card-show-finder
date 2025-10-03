-- ULTRA SIMPLE SEARCH: Only basic columns, avoid any potential array issues
-- This version strips down to absolute basics to identify the problematic column

DROP FUNCTION IF EXISTS public.search_shows_advanced CASCADE;

CREATE OR REPLACE FUNCTION public.search_shows_advanced(
  search_params jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  param_lat double precision;
  param_lng double precision;
  param_radius integer;
  param_start_date date;
  param_end_date date;
  param_keyword text;
  param_page_size integer;
  param_page integer;
  param_offset integer;
  total_count integer;
  results jsonb;
BEGIN
  -- Extract only basic parameters
  param_lat := CASE WHEN search_params->>'lat' = 'null' OR search_params->>'lat' IS NULL THEN NULL 
               ELSE (search_params->>'lat')::double precision END;
  param_lng := CASE WHEN search_params->>'lng' = 'null' OR search_params->>'lng' IS NULL THEN NULL 
               ELSE (search_params->>'lng')::double precision END;
  param_radius := COALESCE((search_params->>'radius_miles')::integer, 25);
  param_start_date := COALESCE((search_params->>'start_date')::date, CURRENT_DATE);
  param_end_date := COALESCE((search_params->>'end_date')::date, CURRENT_DATE + INTERVAL '90 days');
  param_keyword := CASE WHEN search_params->>'keyword' = 'null' OR search_params->>'keyword' IS NULL THEN NULL 
                   ELSE search_params->>'keyword' END;
  param_page_size := COALESCE((search_params->>'page_size')::integer, 20);
  param_page := COALESCE((search_params->>'page')::integer, 1);
  
  param_offset := (param_page - 1) * param_page_size;
  
  RAISE LOG 'Ultra simple search: lat=%, lng=%, keyword=%', param_lat, param_lng, param_keyword;
  
  -- Step 1: Count shows - most basic version
  WITH basic_shows AS (
    SELECT DISTINCT s.id
    FROM public.shows s
    LEFT JOIN public.show_participants sp ON s.id = sp.showid
    WHERE
      s.start_date >= param_start_date AND
      s.start_date <= param_end_date AND
      LOWER(s.status) IN ('active', 'upcoming') AND
      (
        param_lat IS NULL OR param_lng IS NULL OR
        s.coordinates IS NULL OR
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(s.coordinates, ST_SetSRID(ST_MakePoint(param_lng, param_lat), 4326), param_radius * 1609.34)
        )
      ) AND
      (
        param_keyword IS NULL OR
        COALESCE(s.title, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(s.location, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(sp.notable_items, '') ILIKE '%' || param_keyword || '%'
      )
  )
  SELECT COUNT(*) INTO total_count FROM basic_shows;
  
  RAISE LOG 'Ultra simple search found % shows', total_count;
  
  -- Step 2: Get results - ONLY BASIC COLUMNS
  WITH final_results AS (
    SELECT DISTINCT ON (s.id)
      s.id,
      s.title,
      s.location,
      s.start_date,
      s.end_date,
      s.status,
      s.organizer_id,
      s.created_at,
      s.updated_at
    FROM public.shows s
    LEFT JOIN public.show_participants sp ON s.id = sp.showid
    WHERE
      s.start_date >= param_start_date AND
      s.start_date <= param_end_date AND
      LOWER(s.status) IN ('active', 'upcoming') AND
      (
        param_lat IS NULL OR param_lng IS NULL OR
        s.coordinates IS NULL OR
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(s.coordinates, ST_SetSRID(ST_MakePoint(param_lng, param_lat), 4326), param_radius * 1609.34)
        )
      ) AND
      (
        param_keyword IS NULL OR
        COALESCE(s.title, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(s.location, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(sp.notable_items, '') ILIKE '%' || param_keyword || '%'
      )
    ORDER BY s.id, s.start_date ASC
    LIMIT param_page_size
    OFFSET param_offset
  )
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', fr.id,
        'title', fr.title,
        'location', fr.location,
        'start_date', fr.start_date,
        'end_date', fr.end_date,
        'status', fr.status,
        'organizer_id', fr.organizer_id,
        'created_at', fr.created_at,
        'updated_at', fr.updated_at
      )
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', param_page_size,
      'current_page', param_page,
      'total_pages', CEIL(total_count::float / param_page_size),
      'has_more', (param_offset + param_page_size) < total_count
    )
  ) INTO results
  FROM final_results fr;
  
  RETURN COALESCE(results, jsonb_build_object(
    'data', '[]'::jsonb,
    'pagination', jsonb_build_object(
      'total_count', 0,
      'page_size', param_page_size,
      'current_page', param_page,
      'total_pages', 0,
      'has_more', false
    )
  ));
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Ultra simple search error: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM, 
      'sql_state', SQLSTATE,
      'data', '[]'::jsonb,
      'pagination', jsonb_build_object(
        'total_count', 0,
        'page_size', 20,
        'current_page', 1,
        'total_pages', 0,
        'has_more', false
      )
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.search_shows_advanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_shows_advanced TO anon;
GRANT EXECUTE ON FUNCTION public.search_shows_advanced TO service_role;

-- Test with absolute basics
SELECT 'ULTRA SIMPLE TEST 1: Find any shows in date range' as test_name;
SELECT search_shows_advanced('{
  "start_date": "2025-09-24",
  "end_date": "2025-10-24",
  "page_size": 3
}'::jsonb) as test_result;

SELECT 'ULTRA SIMPLE TEST 2: Search for Star Wars' as test_name;
SELECT search_shows_advanced('{
  "start_date": "2025-09-24",
  "end_date": "2025-10-24",
  "keyword": "Star Wars",
  "page_size": 3
}'::jsonb) as star_wars_result;