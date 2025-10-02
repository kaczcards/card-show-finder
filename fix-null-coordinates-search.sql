-- Fix search function to handle shows with null coordinates
-- This should find your Carmel show even without coordinates

DROP FUNCTION IF EXISTS public.search_shows_advanced CASCADE;

CREATE OR REPLACE FUNCTION public.search_shows_advanced(
  search_params jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lat double precision;
  lng double precision;
  radius_miles integer;
  start_date date;
  end_date date;
  max_entry_fee numeric;
  categories text[];
  features text;
  keyword text;
  dealer_card_types text[];
  page_size integer;
  page integer;
  offset_val integer;
  total_count integer;
  results jsonb;
BEGIN
  -- Extract parameters from JSONB (with null safety)
  lat := CASE WHEN search_params->>'lat' = 'null' OR search_params->>'lat' IS NULL THEN NULL 
         ELSE (search_params->>'lat')::double precision END;
  lng := CASE WHEN search_params->>'lng' = 'null' OR search_params->>'lng' IS NULL THEN NULL 
         ELSE (search_params->>'lng')::double precision END;
  radius_miles := COALESCE((search_params->>'radius_miles')::integer, 25);
  start_date := COALESCE((search_params->>'start_date')::date, CURRENT_DATE);
  end_date := COALESCE((search_params->>'end_date')::date, CURRENT_DATE + INTERVAL '90 days');
  max_entry_fee := CASE WHEN search_params->>'max_entry_fee' = 'null' OR search_params->>'max_entry_fee' IS NULL THEN NULL 
                   ELSE (search_params->>'max_entry_fee')::numeric END;
  categories := CASE WHEN search_params->'categories' IS NULL OR search_params->'categories' = 'null'::jsonb THEN NULL 
                ELSE ARRAY(SELECT jsonb_array_elements_text(search_params->'categories')) END;
  features := CASE WHEN search_params->>'features' = 'null' OR search_params->>'features' IS NULL THEN NULL 
              ELSE search_params->>'features' END;
  keyword := CASE WHEN search_params->>'keyword' = 'null' OR search_params->>'keyword' IS NULL THEN NULL 
             ELSE search_params->>'keyword' END;
  dealer_card_types := CASE WHEN search_params->'dealer_card_types' IS NULL OR search_params->'dealer_card_types' = 'null'::jsonb THEN NULL 
                       ELSE ARRAY(SELECT jsonb_array_elements_text(search_params->'dealer_card_types')) END;
  page_size := COALESCE((search_params->>'page_size')::integer, 20);
  page := COALESCE((search_params->>'page')::integer, 1);
  
  -- Calculate offset
  offset_val := (page - 1) * page_size;
  
  RAISE LOG 'search_shows_advanced called with params: lat=%, lng=%, keyword=%, start_date=%, end_date=%', 
    lat, lng, keyword, start_date, end_date;
  
  -- Build search query - Get total count first
  WITH matching_shows AS (
    SELECT DISTINCT s.id
    FROM public.shows s
    LEFT JOIN public.show_participants sp ON s.id = sp.showid
    LEFT JOIN public.profiles p ON sp.userid = p.id
    WHERE
      -- Date range filter
      s.start_date >= start_date AND
      s.start_date <= end_date AND
      
      -- Status filter
      LOWER(s.status) IN ('active', 'upcoming') AND
      
      -- *** FIXED LOCATION FILTER - Handle null coordinates properly ***
      (
        -- If no location provided, include all shows
        (lat IS NULL OR lng IS NULL) OR
        -- If location provided but show has no coordinates, include show anyway
        s.coordinates IS NULL OR
        -- If both have coordinates, check distance
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(
            s.coordinates,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326),
            radius_miles * 1609.34
          )
        )
      ) AND
      
      -- Entry fee filter
      (max_entry_fee IS NULL OR s.entry_fee <= max_entry_fee) AND
      
      -- Categories filter
      (categories IS NULL OR s.categories && categories) AND
      
      -- Features filter
      (features IS NULL OR s.features @> features::jsonb) AND
      
      -- ENHANCED KEYWORD SEARCH - includes MVP Dealer booth content!
      (
        keyword IS NULL OR
        -- Search show details
        s.title ILIKE '%' || keyword || '%' OR
        s.description ILIKE '%' || keyword || '%' OR
        s.location ILIKE '%' || keyword || '%' OR
        s.address ILIKE '%' || keyword || '%' OR
        -- Search MVP Dealer booth content from show_participants
        sp.specialty ILIKE '%' || keyword || '%' OR
        sp.notable_items ILIKE '%' || keyword || '%' OR
        sp.card_types ILIKE '%' || keyword || '%' OR
        sp.price_range ILIKE '%' || keyword || '%'
      )
  )
  SELECT COUNT(*) INTO total_count FROM matching_shows;
  
  RAISE LOG 'search_shows_advanced found % matching shows', total_count;
  
  -- Get the actual paginated results
  WITH filtered_shows AS (
    SELECT DISTINCT ON (s.id)
      s.*,
      -- Distance calculation if coordinates provided
      CASE WHEN lat IS NOT NULL AND lng IS NOT NULL AND s.coordinates IS NOT NULL THEN
        ST_DistanceSphere(
          s.coordinates,
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)
        ) / 1609.34
      ELSE NULL END as distance_miles,
      -- Extract coordinates for response
      CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates) ELSE NULL END as latitude,
      CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates) ELSE NULL END as longitude
    FROM public.shows s
    LEFT JOIN public.show_participants sp ON s.id = sp.showid
    LEFT JOIN public.profiles p ON sp.userid = p.id
    WHERE
      s.start_date >= start_date AND
      s.start_date <= end_date AND
      LOWER(s.status) IN ('active', 'upcoming') AND
      -- *** Same fixed location filter ***
      (
        (lat IS NULL OR lng IS NULL) OR
        s.coordinates IS NULL OR
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(
            s.coordinates,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326),
            radius_miles * 1609.34
          )
        )
      ) AND
      (max_entry_fee IS NULL OR s.entry_fee <= max_entry_fee) AND
      (categories IS NULL OR s.categories && categories) AND
      (features IS NULL OR s.features @> features::jsonb) AND
      (
        keyword IS NULL OR
        s.title ILIKE '%' || keyword || '%' OR
        s.description ILIKE '%' || keyword || '%' OR
        s.location ILIKE '%' || keyword || '%' OR
        s.address ILIKE '%' || keyword || '%' OR
        sp.specialty ILIKE '%' || keyword || '%' OR
        sp.notable_items ILIKE '%' || keyword || '%' OR
        sp.card_types ILIKE '%' || keyword || '%' OR
        sp.price_range ILIKE '%' || keyword || '%'
      )
    ORDER BY
      s.id,
      -- Sort by distance if possible, otherwise by date
      CASE WHEN lat IS NOT NULL AND lng IS NOT NULL AND s.coordinates IS NOT NULL THEN
        ST_DistanceSphere(s.coordinates, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
      ELSE NULL END ASC NULLS LAST,
      s.start_date ASC
    LIMIT page_size
    OFFSET offset_val
  )
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', fs.id,
        'title', fs.title,
        'description', fs.description,
        'location', fs.location,
        'address', fs.address,
        'start_date', fs.start_date,
        'end_date', fs.end_date,
        'entry_fee', fs.entry_fee,
        'image_url', fs.image_url,
        'status', fs.status,
        'organizer_id', fs.organizer_id,
        'features', fs.features,
        'categories', fs.categories,
        'created_at', fs.created_at,
        'updated_at', fs.updated_at,
        -- Include coordinates in both formats for compatibility
        'coordinates', CASE WHEN fs.latitude IS NOT NULL AND fs.longitude IS NOT NULL THEN
          jsonb_build_object('latitude', fs.latitude, 'longitude', fs.longitude)
        ELSE NULL END,
        'distance_miles', fs.distance_miles,
        'latitude', fs.latitude,
        'longitude', fs.longitude
      )
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', page_size,
      'current_page', page,
      'total_pages', CEIL(total_count::float / page_size),
      'has_more', (offset_val + page_size) < total_count
    )
  ) INTO results
  FROM filtered_shows fs;
  
  RETURN COALESCE(results, jsonb_build_object(
    'data', '[]'::jsonb,
    'pagination', jsonb_build_object(
      'total_count', 0,
      'page_size', page_size,
      'current_page', page,
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
'Fixed search function that handles shows with null coordinates.
Searches show titles/descriptions AND dealer booth information (specialty, notable_items, card_types).
Shows with null coordinates are included in results when location filter is provided.
Includes detailed logging for debugging purposes.';

-- Test the function
SELECT 'Testing search function...' as status;

-- Test with your exact search parameters
SELECT search_shows_advanced('{
  "lat": 40.0772001,
  "lng": -85.925938,
  "radius_miles": 25,
  "start_date": "2025-09-24",
  "end_date": "2025-10-24",
  "max_entry_fee": null,
  "categories": null,
  "features": null,
  "keyword": "Star Wars",
  "dealer_card_types": null,
  "page_size": 20,
  "page": 1
}'::jsonb) as search_result;