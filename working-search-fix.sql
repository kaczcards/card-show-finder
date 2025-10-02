-- WORKING SEARCH FIX: Handle array columns and be less restrictive
-- This version properly handles array columns and searches comprehensively

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
  param_max_fee numeric;
  param_categories text[];
  param_features text;
  param_keyword text;
  param_dealer_types text[];
  param_page_size integer;
  param_page integer;
  param_offset integer;
  total_count integer;
  results jsonb;
BEGIN
  -- Extract parameters with null safety
  param_lat := CASE WHEN search_params->>'lat' = 'null' OR search_params->>'lat' IS NULL THEN NULL 
               ELSE (search_params->>'lat')::double precision END;
  param_lng := CASE WHEN search_params->>'lng' = 'null' OR search_params->>'lng' IS NULL THEN NULL 
               ELSE (search_params->>'lng')::double precision END;
  param_radius := COALESCE((search_params->>'radius_miles')::integer, 25);
  param_start_date := COALESCE((search_params->>'start_date')::date, CURRENT_DATE);
  param_end_date := COALESCE((search_params->>'end_date')::date, CURRENT_DATE + INTERVAL '90 days');
  param_max_fee := CASE WHEN search_params->>'max_entry_fee' = 'null' OR search_params->>'max_entry_fee' IS NULL THEN NULL 
                   ELSE (search_params->>'max_entry_fee')::numeric END;
  param_categories := CASE WHEN search_params->'categories' IS NULL OR search_params->'categories' = 'null'::jsonb THEN NULL 
                      ELSE ARRAY(SELECT jsonb_array_elements_text(search_params->'categories')) END;
  param_features := CASE WHEN search_params->>'features' = 'null' OR search_params->>'features' IS NULL THEN NULL 
                    ELSE search_params->>'features' END;
  param_keyword := CASE WHEN search_params->>'keyword' = 'null' OR search_params->>'keyword' IS NULL THEN NULL 
                   ELSE search_params->>'keyword' END;
  param_dealer_types := CASE WHEN search_params->'dealer_card_types' IS NULL OR search_params->'dealer_card_types' = 'null'::jsonb THEN NULL 
                        ELSE ARRAY(SELECT jsonb_array_elements_text(search_params->'dealer_card_types')) END;
  param_page_size := COALESCE((search_params->>'page_size')::integer, 20);
  param_page := COALESCE((search_params->>'page')::integer, 1);
  
  param_offset := (param_page - 1) * param_page_size;
  
  RAISE LOG 'search_shows_advanced: lat=%, lng=%, keyword=%, dates=% to %', 
    param_lat, param_lng, param_keyword, param_start_date, param_end_date;
  
  -- Step 1: Get total count with comprehensive search
  WITH matching_show_ids AS (
    SELECT DISTINCT show_table.id as show_id
    FROM public.shows show_table
    LEFT JOIN public.show_participants booth_table ON show_table.id = booth_table.showid
    WHERE
      -- Date filter
      show_table.start_date >= param_start_date AND
      show_table.start_date <= param_end_date AND
      
      -- Status filter
      LOWER(show_table.status) IN ('active', 'upcoming') AND
      
      -- Location filter - handle null coordinates gracefully
      (
        param_lat IS NULL OR param_lng IS NULL OR
        show_table.coordinates IS NULL OR
        (
          show_table.coordinates IS NOT NULL AND
          ST_DWithin(
            show_table.coordinates,
            ST_SetSRID(ST_MakePoint(param_lng, param_lat), 4326),
            param_radius * 1609.34
          )
        )
      ) AND
      
      -- Entry fee filter
      (param_max_fee IS NULL OR show_table.entry_fee <= param_max_fee) AND
      
      -- Categories filter - FIXED for array handling
      (param_categories IS NULL OR show_table.categories && param_categories) AND
      
      -- Features filter - FIXED for JSONB handling
      (param_features IS NULL OR show_table.features @> param_features::jsonb) AND
      
      -- COMPREHENSIVE KEYWORD SEARCH - Search EVERYTHING
      (
        param_keyword IS NULL OR
        -- Show basic info
        show_table.title ILIKE '%' || param_keyword || '%' OR
        COALESCE(show_table.description, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(show_table.location, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(show_table.address, '') ILIKE '%' || param_keyword || '%' OR
        
        -- Search array columns by converting to text
        COALESCE(array_to_string(show_table.categories, ' '), '') ILIKE '%' || param_keyword || '%' OR
        
        -- Search JSONB features by converting to text
        COALESCE(show_table.features::text, '') ILIKE '%' || param_keyword || '%' OR
        
        -- MVP Dealer booth content search
        COALESCE(booth_table.specialty, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(booth_table.notable_items, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(booth_table.card_types, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(booth_table.price_range, '') ILIKE '%' || param_keyword || '%'
      )
  )
  SELECT COUNT(*) INTO total_count FROM matching_show_ids;
  
  RAISE LOG 'search_shows_advanced: found % total matching shows', total_count;
  
  -- Step 2: Get paginated results with same filters
  WITH final_results AS (
    SELECT DISTINCT ON (show_table.id)
      show_table.id,
      show_table.title,
      show_table.description,
      show_table.location,
      show_table.address,
      show_table.start_date,
      show_table.end_date,
      show_table.entry_fee,
      show_table.image_url,
      show_table.status,
      show_table.organizer_id,
      show_table.features,
      show_table.categories,
      show_table.created_at,
      show_table.updated_at,
      -- Distance calculation
      CASE WHEN param_lat IS NOT NULL AND param_lng IS NOT NULL AND show_table.coordinates IS NOT NULL THEN
        ST_DistanceSphere(
          show_table.coordinates,
          ST_SetSRID(ST_MakePoint(param_lng, param_lat), 4326)
        ) / 1609.34
      ELSE NULL END as distance_miles,
      -- Coordinates extraction
      CASE WHEN show_table.coordinates IS NOT NULL THEN ST_Y(show_table.coordinates) ELSE NULL END as show_latitude,
      CASE WHEN show_table.coordinates IS NOT NULL THEN ST_X(show_table.coordinates) ELSE NULL END as show_longitude
    FROM public.shows show_table
    LEFT JOIN public.show_participants booth_table ON show_table.id = booth_table.showid
    WHERE
      show_table.start_date >= param_start_date AND
      show_table.start_date <= param_end_date AND
      LOWER(show_table.status) IN ('active', 'upcoming') AND
      (
        param_lat IS NULL OR param_lng IS NULL OR
        show_table.coordinates IS NULL OR
        (
          show_table.coordinates IS NOT NULL AND
          ST_DWithin(
            show_table.coordinates,
            ST_SetSRID(ST_MakePoint(param_lng, param_lat), 4326),
            param_radius * 1609.34
          )
        )
      ) AND
      (param_max_fee IS NULL OR show_table.entry_fee <= param_max_fee) AND
      (param_categories IS NULL OR show_table.categories && param_categories) AND
      (param_features IS NULL OR show_table.features @> param_features::jsonb) AND
      (
        param_keyword IS NULL OR
        show_table.title ILIKE '%' || param_keyword || '%' OR
        COALESCE(show_table.description, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(show_table.location, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(show_table.address, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(array_to_string(show_table.categories, ' '), '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(show_table.features::text, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(booth_table.specialty, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(booth_table.notable_items, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(booth_table.card_types, '') ILIKE '%' || param_keyword || '%' OR
        COALESCE(booth_table.price_range, '') ILIKE '%' || param_keyword || '%'
      )
    ORDER BY
      show_table.id,
      CASE WHEN param_lat IS NOT NULL AND param_lng IS NOT NULL AND show_table.coordinates IS NOT NULL THEN
        ST_DistanceSphere(show_table.coordinates, ST_SetSRID(ST_MakePoint(param_lng, param_lat), 4326))
      ELSE NULL END ASC NULLS LAST,
      show_table.start_date ASC
    LIMIT param_page_size
    OFFSET param_offset
  )
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', fr.id,
        'title', fr.title,
        'description', fr.description,
        'location', fr.location,
        'address', fr.address,
        'start_date', fr.start_date,
        'end_date', fr.end_date,
        'entry_fee', fr.entry_fee,
        'image_url', fr.image_url,
        'status', fr.status,
        'organizer_id', fr.organizer_id,
        'features', fr.features,
        'categories', fr.categories,
        'created_at', fr.created_at,
        'updated_at', fr.updated_at,
        'coordinates', CASE WHEN fr.show_latitude IS NOT NULL AND fr.show_longitude IS NOT NULL THEN
          jsonb_build_object('latitude', fr.show_latitude, 'longitude', fr.show_longitude)
        ELSE NULL END,
        'distance_miles', fr.distance_miles,
        'latitude', fr.show_latitude,
        'longitude', fr.show_longitude
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
    RAISE LOG 'Error in search_shows_advanced: %', SQLERRM;
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

COMMENT ON FUNCTION public.search_shows_advanced IS 
'Comprehensive search function that searches both show data and MVP dealer booth content.
Handles array columns properly using array_to_string and COALESCE for null safety.
Searches: title, description, location, address, categories, features, booth specialty, notable_items, card_types, price_range.';

-- Test it with progressive complexity
SELECT 'Step 1: Testing basic Carmel shows (no keyword)' as test_step;

SELECT search_shows_advanced('{
  "lat": null,
  "lng": null, 
  "start_date": "2025-09-24",
  "end_date": "2025-10-24",
  "keyword": null,
  "page_size": 5,
  "page": 1
}'::jsonb) as all_shows_in_date_range;

SELECT 'Step 2: Testing location filter for Carmel area' as test_step;

SELECT search_shows_advanced('{
  "lat": 40.0772001,
  "lng": -85.925938,
  "radius_miles": 50,
  "start_date": "2025-09-24",
  "end_date": "2025-10-24", 
  "keyword": null,
  "page_size": 5,
  "page": 1
}'::jsonb) as carmel_area_shows;

SELECT 'Step 3: Testing Star Wars keyword search' as test_step;

SELECT search_shows_advanced('{
  "lat": 40.0772001,
  "lng": -85.925938,
  "radius_miles": 50,
  "start_date": "2025-09-24",
  "end_date": "2025-10-24",
  "keyword": "Star Wars",
  "page_size": 5,
  "page": 1
}'::jsonb) as star_wars_search;