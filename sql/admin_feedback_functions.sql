-- ================================================================
-- CARD SHOW FINDER - ADMIN FEEDBACK FUNCTIONS
-- ================================================================
-- Created: July 29, 2025
-- Purpose: SQL functions to support the admin evaluation system
--          for reviewing and providing feedback on scraped shows
-- ================================================================

-- Ensure pg_trgm extension is available for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------
-- FUNCTION: get_feedback_stats
-- ----------------------------------------------------------------
-- Returns statistics about feedback tags with counts and trends
-- Parameters:
--   days_ago - Number of days to look back (default: 30)
--   min_count - Minimum count to include a tag (default: 1)
-- Returns: Table of feedback statistics
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_feedback_stats(
  days_ago INT DEFAULT 30,
  min_count INT DEFAULT 1
)
RETURNS TABLE (
  tag TEXT,
  count BIGINT,
  percentage NUMERIC(5,1),
  previous_count BIGINT,
  trend NUMERIC(5,1),
  source_distribution JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_feedback BIGINT;
  total_previous BIGINT;
BEGIN
  -- Validate parameters
  IF days_ago <= 0 THEN
    RAISE EXCEPTION 'days_ago must be positive';
  END IF;
  
  -- Get total feedback counts for percentage calculation
  SELECT COUNT(DISTINCT pending_id) INTO total_feedback
  FROM admin_feedback
  WHERE action = 'reject'
    AND created_at > NOW() - (days_ago * INTERVAL '1 day')
    AND feedback IS NOT NULL;
    
  -- Get previous period total for trend calculation
  SELECT COUNT(DISTINCT pending_id) INTO total_previous
  FROM admin_feedback
  WHERE action = 'reject'
    AND created_at BETWEEN NOW() - (2 * days_ago * INTERVAL '1 day') AND NOW() - (days_ago * INTERVAL '1 day')
    AND feedback IS NOT NULL;
  
  -- Extract tags from feedback text
  RETURN QUERY
  WITH extracted_tags AS (
    -- Extract tags from feedback (comma or space separated before the first dash)
    SELECT 
      af.id,
      af.pending_id,
      ssp.source_url,
      regexp_split_to_table(
        CASE 
          WHEN position('-' IN af.feedback) > 0 
          THEN substring(af.feedback FROM 1 FOR position('-' IN af.feedback) - 1)
          WHEN position('–' IN af.feedback) > 0 
          THEN substring(af.feedback FROM 1 FOR position('–' IN af.feedback) - 1)
          ELSE af.feedback
        END,
        '[,\\s]+'
      ) AS tag
    FROM admin_feedback af
    JOIN scraped_shows_pending ssp ON af.pending_id = ssp.id
    WHERE af.created_at > NOW() - (days_ago * INTERVAL '1 day')
      AND af.action = 'reject'
      AND af.feedback IS NOT NULL
  ),
  valid_tags AS (
    -- Keep only known tags and uppercase them
    SELECT 
      id,
      pending_id,
      source_url,
      UPPER(TRIM(tag)) AS tag
    FROM extracted_tags
    WHERE TRIM(tag) != ''
      AND UPPER(TRIM(tag)) IN (
        'DATE_FORMAT', 'VENUE_MISSING', 'ADDRESS_POOR', 'DUPLICATE',
        'MULTI_EVENT_COLLAPSE', 'EXTRA_HTML', 'SPAM', 'STATE_FULL',
        'CITY_MISSING'
      )
  ),
  current_period AS (
    -- Count occurrences of each tag in current period
    SELECT 
      tag,
      COUNT(*) AS count
    FROM valid_tags
    GROUP BY tag
    HAVING COUNT(*) >= min_count
  ),
  previous_period AS (
    -- Count occurrences of each tag in previous period
    SELECT 
      UPPER(TRIM(tag)) AS tag,
      COUNT(*) AS count
    FROM (
      SELECT 
        regexp_split_to_table(
          CASE 
            WHEN position('-' IN af.feedback) > 0 
            THEN substring(af.feedback FROM 1 FOR position('-' IN af.feedback) - 1)
            WHEN position('–' IN af.feedback) > 0 
            THEN substring(af.feedback FROM 1 FOR position('–' IN af.feedback) - 1)
            ELSE af.feedback
          END,
          '[,\\s]+'
        ) AS tag
      FROM admin_feedback af
      WHERE af.created_at BETWEEN NOW() - (2 * days_ago * INTERVAL '1 day') AND NOW() - (days_ago * INTERVAL '1 day')
        AND af.action = 'reject'
        AND af.feedback IS NOT NULL
    ) t
    WHERE TRIM(tag) != ''
      AND UPPER(TRIM(tag)) IN (
        'DATE_FORMAT', 'VENUE_MISSING', 'ADDRESS_POOR', 'DUPLICATE',
        'MULTI_EVENT_COLLAPSE', 'EXTRA_HTML', 'SPAM', 'STATE_FULL',
        'CITY_MISSING'
      )
    GROUP BY UPPER(TRIM(tag))
  ),
  source_distributions AS (
    -- Calculate distribution of tags by source
    SELECT 
      tag,
      jsonb_object_agg(source_url, source_count) AS source_distribution
    FROM (
      SELECT 
        tag,
        source_url,
        COUNT(*) AS source_count
      FROM valid_tags
      GROUP BY tag, source_url
      ORDER BY COUNT(*) DESC
    ) src_counts
    GROUP BY tag
  )
  SELECT 
    cp.tag,
    cp.count,
    CASE WHEN total_feedback > 0 THEN
      ROUND(cp.count * 100.0 / total_feedback, 1)
    ELSE
      0
    END AS percentage,
    COALESCE(pp.count, 0) AS previous_count,
    CASE 
      WHEN COALESCE(pp.count, 0) > 0 THEN
        ROUND(((cp.count::NUMERIC / total_feedback) - 
               (COALESCE(pp.count, 0)::NUMERIC / NULLIF(total_previous, 0))) * 100, 1)
      ELSE
        NULL
    END AS trend,
    COALESCE(sd.source_distribution, '{}'::jsonb) AS source_distribution
  FROM current_period cp
  LEFT JOIN previous_period pp ON cp.tag = pp.tag
  LEFT JOIN source_distributions sd ON cp.tag = sd.tag
  ORDER BY cp.count DESC;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCTION: get_source_stats
-- ----------------------------------------------------------------
-- Returns performance metrics for scraping sources
-- Parameters:
--   days_ago - Number of days to look back (default: 30)
--   min_shows - Minimum number of shows to include a source (default: 5)
-- Returns: Table of source statistics
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_source_stats(
  days_ago INT DEFAULT 30,
  min_shows INT DEFAULT 5
)
RETURNS TABLE (
  source_url TEXT,
  total_shows BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  pending_count BIGINT,
  approval_rate NUMERIC(5,1),
  rejection_rate NUMERIC(5,1),
  avg_quality_score NUMERIC(5,1),
  common_issues JSONB,
  priority_score INT,
  enabled BOOLEAN,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  error_streak INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
BEGIN
  -- Validate parameters
  IF days_ago <= 0 THEN
    RAISE EXCEPTION 'days_ago must be positive';
  END IF;
  
  RETURN QUERY
  WITH source_counts AS (
    -- Get counts by status for each source
    SELECT 
      source_url,
      COUNT(*) AS total_shows,
      COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved_count,
      COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_count,
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
      AVG(
        CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END +
        CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END +
        CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END
      ) AS avg_quality_score
    FROM scraped_shows_pending
    WHERE created_at > NOW() - (days_ago * INTERVAL '1 day')
    GROUP BY source_url
    HAVING COUNT(*) >= min_shows
  ),
  source_issues AS (
    -- Extract common issues from feedback
    WITH feedback_tags AS (
      SELECT 
        ssp.source_url,
        regexp_split_to_table(
          CASE 
            WHEN position('-' IN af.feedback) > 0 
            THEN substring(af.feedback FROM 1 FOR position('-' IN af.feedback) - 1)
            WHEN position('–' IN af.feedback) > 0 
            THEN substring(af.feedback FROM 1 FOR position('–' IN af.feedback) - 1)
            ELSE af.feedback
          END,
          '[,\\s]+'
        ) AS tag
      FROM admin_feedback af
      JOIN scraped_shows_pending ssp ON af.pending_id = ssp.id
      WHERE af.created_at > NOW() - (days_ago * INTERVAL '1 day')
        AND af.action = 'reject'
        AND af.feedback IS NOT NULL
    ),
    valid_tags AS (
      SELECT 
        source_url,
        UPPER(TRIM(tag)) AS tag
      FROM feedback_tags
      WHERE TRIM(tag) != ''
        AND UPPER(TRIM(tag)) IN (
          'DATE_FORMAT', 'VENUE_MISSING', 'ADDRESS_POOR', 'DUPLICATE',
          'MULTI_EVENT_COLLAPSE', 'EXTRA_HTML', 'SPAM', 'STATE_FULL',
          'CITY_MISSING'
        )
    ),
    tag_counts AS (
      SELECT 
        source_url,
        tag,
        COUNT(*) AS count
      FROM valid_tags
      GROUP BY source_url, tag
    )
    SELECT 
      source_url,
      jsonb_object_agg(tag, count) AS common_issues
    FROM tag_counts
    GROUP BY source_url
  )
  SELECT 
    sc.source_url,
    sc.total_shows,
    sc.approved_count,
    sc.rejected_count,
    sc.pending_count,
    CASE 
      WHEN (sc.approved_count + sc.rejected_count) > 0 THEN 
        ROUND(sc.approved_count * 100.0 / (sc.approved_count + sc.rejected_count), 1)
      ELSE 0
    END AS approval_rate,
    CASE 
      WHEN (sc.approved_count + sc.rejected_count) > 0 THEN 
        ROUND(sc.rejected_count * 100.0 / (sc.approved_count + sc.rejected_count), 1)
      ELSE 0
    END AS rejection_rate,
    ROUND(sc.avg_quality_score, 1) AS avg_quality_score,
    COALESCE(si.common_issues, '{}'::jsonb) AS common_issues,
    ss.priority_score,
    ss.enabled,
    ss.last_success_at,
    ss.last_error_at,
    ss.error_streak
  FROM source_counts sc
  LEFT JOIN source_issues si ON sc.source_url = si.source_url
  LEFT JOIN scraping_sources ss ON sc.source_url = ss.url
  ORDER BY sc.total_shows DESC;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCTION: find_duplicate_pending_shows
-- ----------------------------------------------------------------
-- Finds potential duplicate shows using fuzzy matching
-- Parameters:
--   similarity_threshold - Minimum similarity score (0-1) (default: 0.6)
--   max_results - Maximum number of duplicate pairs to return (default: 100)
-- Returns: Table of potential duplicate pairs
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_duplicate_pending_shows(
  similarity_threshold FLOAT DEFAULT 0.6,
  max_results INT DEFAULT 100
)
RETURNS TABLE (
  id1 UUID,
  id2 UUID,
  name1 TEXT,
  name2 TEXT,
  start_date1 TEXT,
  start_date2 TEXT,
  city1 TEXT,
  city2 TEXT,
  state1 TEXT,
  state2 TEXT,
  source_url1 TEXT,
  source_url2 TEXT,
  created_at1 TIMESTAMPTZ,
  created_at2 TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate parameters
  IF similarity_threshold < 0 OR similarity_threshold > 1 THEN
    RAISE EXCEPTION 'similarity_threshold must be between 0 and 1';
  END IF;
  
  IF max_results <= 0 THEN
    RAISE EXCEPTION 'max_results must be positive';
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id AS id1,
    b.id AS id2,
    a.raw_payload->>'name' AS name1,
    b.raw_payload->>'name' AS name2,
    a.raw_payload->>'startDate' AS start_date1,
    b.raw_payload->>'startDate' AS start_date2,
    a.raw_payload->>'city' AS city1,
    b.raw_payload->>'city' AS city2,
    a.raw_payload->>'state' AS state1,
    b.raw_payload->>'state' AS state2,
    a.source_url AS source_url1,
    b.source_url AS source_url2,
    a.created_at AS created_at1,
    b.created_at AS created_at2,
    GREATEST(
      similarity(LOWER(COALESCE(a.raw_payload->>'name', '')), LOWER(COALESCE(b.raw_payload->>'name', ''))),
      similarity(
        LOWER(COALESCE(a.raw_payload->>'city', '') || ' ' || COALESCE(a.raw_payload->>'state', '')),
        LOWER(COALESCE(b.raw_payload->>'city', '') || ' ' || COALESCE(b.raw_payload->>'state', ''))
      )
    )::FLOAT AS similarity
  FROM scraped_shows_pending a
  JOIN scraped_shows_pending b ON 
    a.id < b.id AND  -- Avoid self-joins and duplicates
    a.status = 'PENDING' AND
    b.status = 'PENDING'
  WHERE (
    -- Exact match on name and date
    (LOWER(COALESCE(a.raw_payload->>'name', '')) = LOWER(COALESCE(b.raw_payload->>'name', '')) 
     AND a.raw_payload->>'startDate' = b.raw_payload->>'startDate')
    
    -- OR high name similarity and same date
    OR (similarity(LOWER(COALESCE(a.raw_payload->>'name', '')), LOWER(COALESCE(b.raw_payload->>'name', ''))) > similarity_threshold 
        AND a.raw_payload->>'startDate' = b.raw_payload->>'startDate')
    
    -- OR same name and close dates (if dates are in a parseable format)
    OR (LOWER(COALESCE(a.raw_payload->>'name', '')) = LOWER(COALESCE(b.raw_payload->>'name', '')) 
        AND a.raw_payload->>'startDate' ~ '^\d{4}-\d{2}-\d{2}' 
        AND b.raw_payload->>'startDate' ~ '^\d{4}-\d{2}-\d{2}' 
        AND ABS(EXTRACT(EPOCH FROM (
            TO_DATE(a.raw_payload->>'startDate', 'YYYY-MM-DD') - 
            TO_DATE(b.raw_payload->>'startDate', 'YYYY-MM-DD')
        )) / 86400) <= 1)
    
    -- OR high name similarity and same location
    OR (similarity(LOWER(COALESCE(a.raw_payload->>'name', '')), LOWER(COALESCE(b.raw_payload->>'name', ''))) > similarity_threshold 
        AND LOWER(COALESCE(a.raw_payload->>'city', '')) = LOWER(COALESCE(b.raw_payload->>'city', '')) 
        AND (a.raw_payload->>'state' IS NULL OR b.raw_payload->>'state' IS NULL 
             OR LOWER(a.raw_payload->>'state') = LOWER(b.raw_payload->>'state')))
  )
  ORDER BY similarity DESC, a.created_at DESC
  LIMIT max_results;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCTION: calculate_source_rejection_rate
-- ----------------------------------------------------------------
-- Calculates rejection rates for sources to adjust priorities
-- Parameters:
--   days_ago - Number of days to look back (default: 30)
--   min_shows - Minimum number of shows to calculate rate (default: 5)
-- Returns: Table of source rejection rates
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_source_rejection_rate(
  days_ago INT DEFAULT 30,
  min_shows INT DEFAULT 5
)
RETURNS TABLE (
  source_url TEXT,
  total_shows BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  pending_count BIGINT,
  rejection_rate NUMERIC(5,1),
  current_priority INT,
  suggested_priority INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate parameters
  IF days_ago <= 0 THEN
    RAISE EXCEPTION 'days_ago must be positive';
  END IF;
  
  RETURN QUERY
  WITH source_stats AS (
    SELECT 
      source_url,
      COUNT(*) AS total_shows,
      COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved_count,
      COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_count,
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
      ROUND(COUNT(*) FILTER (WHERE status = 'REJECTED')::NUMERIC / 
            NULLIF(COUNT(*) FILTER (WHERE status IN ('APPROVED', 'REJECTED')), 0) * 100, 1) AS rejection_rate
    FROM scraped_shows_pending
    WHERE created_at > NOW() - (days_ago * INTERVAL '1 day')
    GROUP BY source_url
    HAVING COUNT(*) >= min_shows
      AND COUNT(*) FILTER (WHERE status IN ('APPROVED', 'REJECTED')) > 0
  )
  SELECT 
    ss.source_url,
    ss.total_shows,
    ss.approved_count,
    ss.rejected_count,
    ss.pending_count,
    ss.rejection_rate,
    COALESCE(s.priority_score, 50) AS current_priority,
    -- Calculate suggested priority based on rejection rate
    CASE
      WHEN ss.rejection_rate >= 80 THEN GREATEST(10, COALESCE(s.priority_score, 50) - 20)  -- Severe penalty
      WHEN ss.rejection_rate >= 50 THEN GREATEST(20, COALESCE(s.priority_score, 50) - 10)  -- Major penalty
      WHEN ss.rejection_rate >= 30 THEN GREATEST(30, COALESCE(s.priority_score, 50) - 5)   -- Minor penalty
      WHEN ss.rejection_rate <= 10 AND ss.total_shows >= 10 THEN LEAST(100, COALESCE(s.priority_score, 50) + 5)  -- Bonus
      ELSE COALESCE(s.priority_score, 50)  -- No change
    END AS suggested_priority
  FROM source_stats ss
  LEFT JOIN scraping_sources s ON ss.source_url = s.url
  ORDER BY ss.rejection_rate DESC;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCTION: approve_pending_batch
-- ----------------------------------------------------------------
-- Safely approves a batch of pending shows with validation
-- Parameters:
--   show_ids - Array of UUIDs to approve
--   admin_id - UUID of the admin performing the action
--   feedback - Optional feedback text
--   min_quality - Minimum quality score to approve (default: 0)
-- Returns: Number of shows approved
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_pending_batch(
  show_ids UUID[],
  admin_id UUID,
  feedback TEXT DEFAULT NULL,
  min_quality INT DEFAULT 0
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approved_count INT;
  invalid_ids UUID[];
  already_processed UUID[];
  low_quality UUID[];
  valid_ids UUID[];
BEGIN
  -- Validate parameters
  IF show_ids IS NULL OR array_length(show_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'show_ids cannot be null or empty';
  END IF;
  
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_id cannot be null';
  END IF;
  
  -- Check for invalid IDs (not in the table)
  SELECT array_agg(id)
  INTO invalid_ids
  FROM (
    SELECT unnest(show_ids) AS id
    EXCEPT
    SELECT id FROM scraped_shows_pending
  ) t;
  
  IF invalid_ids IS NOT NULL AND array_length(invalid_ids, 1) > 0 THEN
    RAISE WARNING 'Some show IDs do not exist: %', invalid_ids;
  END IF;
  
  -- Check for already processed shows
  SELECT array_agg(id)
  INTO already_processed
  FROM scraped_shows_pending
  WHERE id = ANY(show_ids)
    AND status <> 'PENDING';
  
  IF already_processed IS NOT NULL AND array_length(already_processed, 1) > 0 THEN
    RAISE WARNING 'Some shows are already processed: %', already_processed;
  END IF;
  
  -- Check for low quality shows if min_quality > 0
  IF min_quality > 0 THEN
    SELECT array_agg(id)
    INTO low_quality
    FROM scraped_shows_pending
    WHERE id = ANY(show_ids)
      AND status = 'PENDING'
      AND (
        (CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END) +
        (CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END) +
        (CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END) +
        (CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END) +
        (CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END) +
        (CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END)
      ) < min_quality;
    
    IF low_quality IS NOT NULL AND array_length(low_quality, 1) > 0 THEN
      RAISE WARNING 'Some shows have quality below %: %', min_quality, low_quality;
    END IF;
  END IF;
  
  -- Get valid IDs for processing
  SELECT array_agg(id)
  INTO valid_ids
  FROM scraped_shows_pending
  WHERE id = ANY(show_ids)
    AND status = 'PENDING'
    AND (min_quality = 0 OR (
      (CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END)
    ) >= min_quality);
  
  IF valid_ids IS NULL OR array_length(valid_ids, 1) = 0 THEN
    RAISE WARNING 'No valid shows to approve';
    RETURN 0;
  END IF;
  
  -- Update status for valid shows
  UPDATE scraped_shows_pending
  SET 
    status = 'APPROVED',
    admin_notes = CASE WHEN feedback IS NOT NULL THEN feedback ELSE 'Batch approved' END,
    reviewed_at = NOW()
  WHERE id = ANY(valid_ids);
  
  GET DIAGNOSTICS approved_count = ROW_COUNT;
  
  -- Add feedback records
  INSERT INTO admin_feedback (pending_id, admin_id, action, feedback)
  SELECT 
    id, 
    admin_id, 
    'approve', 
    CASE WHEN feedback IS NOT NULL THEN feedback ELSE 'Batch approved' END
  FROM unnest(valid_ids) AS id;
  
  RETURN approved_count;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCTION: reject_pending_batch
-- ----------------------------------------------------------------
-- Safely rejects a batch of pending shows with proper feedback
-- Parameters:
--   show_ids - Array of UUIDs to reject
--   admin_id - UUID of the admin performing the action
--   feedback - Feedback text (required)
-- Returns: Number of shows rejected
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_pending_batch(
  show_ids UUID[],
  admin_id UUID,
  feedback TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rejected_count INT;
  invalid_ids UUID[];
  already_processed UUID[];
  valid_ids UUID[];
BEGIN
  -- Validate parameters
  IF show_ids IS NULL OR array_length(show_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'show_ids cannot be null or empty';
  END IF;
  
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_id cannot be null';
  END IF;
  
  IF feedback IS NULL OR trim(feedback) = '' THEN
    RAISE EXCEPTION 'feedback cannot be null or empty for rejections';
  END IF;
  
  -- Check for invalid IDs (not in the table)
  SELECT array_agg(id)
  INTO invalid_ids
  FROM (
    SELECT unnest(show_ids) AS id
    EXCEPT
    SELECT id FROM scraped_shows_pending
  ) t;
  
  IF invalid_ids IS NOT NULL AND array_length(invalid_ids, 1) > 0 THEN
    RAISE WARNING 'Some show IDs do not exist: %', invalid_ids;
  END IF;
  
  -- Check for already processed shows
  SELECT array_agg(id)
  INTO already_processed
  FROM scraped_shows_pending
  WHERE id = ANY(show_ids)
    AND status <> 'PENDING';
  
  IF already_processed IS NOT NULL AND array_length(already_processed, 1) > 0 THEN
    RAISE WARNING 'Some shows are already processed: %', already_processed;
  END IF;
  
  -- Get valid IDs for processing
  SELECT array_agg(id)
  INTO valid_ids
  FROM scraped_shows_pending
  WHERE id = ANY(show_ids)
    AND status = 'PENDING';
  
  IF valid_ids IS NULL OR array_length(valid_ids, 1) = 0 THEN
    RAISE WARNING 'No valid shows to reject';
    RETURN 0;
  END IF;
  
  -- Update status for valid shows
  UPDATE scraped_shows_pending
  SET 
    status = 'REJECTED',
    admin_notes = feedback,
    reviewed_at = NOW()
  WHERE id = ANY(valid_ids);
  
  GET DIAGNOSTICS rejected_count = ROW_COUNT;
  
  -- Add feedback records
  INSERT INTO admin_feedback (pending_id, admin_id, action, feedback)
  SELECT 
    id, 
    admin_id, 
    'reject', 
    feedback
  FROM unnest(valid_ids) AS id;
  
  RETURN rejected_count;
END;
$$;

-- ----------------------------------------------------------------
-- VIEW: pending_quality_view
-- ----------------------------------------------------------------
-- View that calculates quality scores for pending shows
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW pending_quality_view AS
SELECT 
  id,
  source_url,
  raw_payload->>'name' AS name,
  raw_payload->>'startDate' AS start_date,
  raw_payload->>'city' AS city,
  raw_payload->>'state' AS state,
  raw_payload->>'venueName' AS venue_name,
  raw_payload->>'address' AS address,
  status,
  created_at,
  reviewed_at,
  -- Calculate quality score (0-100)
  (CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END) +
  (CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END) +
  (CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END) +
  (CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END) +
  (CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END) +
  (CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END)
  AS quality_score,
  -- Quality band
  CASE 
    WHEN (CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END) +
         (CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END) +
         (CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END) +
         (CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END) +
         (CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END) +
         (CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END) >= 80 THEN 'High'
    WHEN (CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END) +
         (CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END) +
         (CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END) +
         (CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END) +
         (CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END) +
         (CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END) >= 50 THEN 'Medium'
    ELSE 'Low'
  END AS quality_band,
  -- Potential issues
  ARRAY_REMOVE(ARRAY[
    CASE WHEN raw_payload->>'name' IS NULL THEN 'Missing name' END,
    CASE WHEN raw_payload->>'startDate' IS NULL THEN 'Missing date' END,
    CASE WHEN raw_payload->>'startDate' NOT LIKE '%202%' AND raw_payload->>'startDate' IS NOT NULL THEN 'Date missing year' END,
    CASE WHEN raw_payload->>'startDate' LIKE '% AL' OR raw_payload->>'startDate' LIKE '% TX' THEN 'Date format issue' END,
    CASE WHEN raw_payload->>'city' IS NULL THEN 'Missing city' END,
    CASE WHEN raw_payload->>'state' IS NULL THEN 'Missing state' END,
    CASE WHEN raw_payload->>'state' IS NOT NULL AND LENGTH(raw_payload->>'state') > 2 THEN 'State not abbreviated' END,
    CASE WHEN raw_payload->>'venueName' IS NULL THEN 'Missing venue' END,
    CASE WHEN raw_payload->>'address' IS NULL THEN 'Missing address' END,
    CASE WHEN raw_payload->>'description' LIKE '%<%' OR raw_payload->>'description' LIKE '%&nbsp;%' THEN 'HTML artifacts' END
  ], NULL) AS potential_issues
FROM scraped_shows_pending;

-- ----------------------------------------------------------------
-- FUNCTION: update_source_priorities
-- ----------------------------------------------------------------
-- Updates source priorities based on rejection rates
-- Parameters:
--   days_ago - Number of days to look back (default: 30)
--   min_shows - Minimum number of shows to adjust priority (default: 10)
--   dry_run - If true, returns changes without applying them (default: false)
-- Returns: Table of source priority changes
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_source_priorities(
  days_ago INT DEFAULT 30,
  min_shows INT DEFAULT 10,
  dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  source_url TEXT,
  old_priority INT,
  new_priority INT,
  rejection_rate NUMERIC(5,1),
  total_shows BIGINT,
  adjustment_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_count INT := 0;
BEGIN
  -- Create temp table for results
  CREATE TEMP TABLE IF NOT EXISTS priority_updates (
    source_url TEXT,
    old_priority INT,
    new_priority INT,
    rejection_rate NUMERIC(5,1),
    total_shows BIGINT,
    adjustment_reason TEXT
  ) ON COMMIT DROP;
  
  -- Clear temp table
  DELETE FROM priority_updates;
  
  -- Calculate priority updates
  WITH source_stats AS (
    SELECT 
      source_url,
      COUNT(*) AS total_shows,
      COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
      COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected,
      ROUND(COUNT(*) FILTER (WHERE status = 'REJECTED')::NUMERIC / 
            NULLIF(COUNT(*) FILTER (WHERE status IN ('APPROVED', 'REJECTED')), 0) * 100, 1) AS rejection_rate
    FROM scraped_shows_pending
    WHERE created_at > NOW() - (days_ago * INTERVAL '1 day')
    GROUP BY source_url
    HAVING COUNT(*) >= min_shows
      AND COUNT(*) FILTER (WHERE status IN ('APPROVED', 'REJECTED')) > 0
  ),
  priority_changes AS (
    SELECT 
      s.url AS source_url,
      s.priority_score AS old_priority,
      -- Calculate new priority based on rejection rate
      CASE
        WHEN ss.rejection_rate >= 80 THEN GREATEST(10, s.priority_score - 20)  -- Severe penalty
        WHEN ss.rejection_rate >= 50 THEN GREATEST(20, s.priority_score - 10)  -- Major penalty
        WHEN ss.rejection_rate >= 30 THEN GREATEST(30, s.priority_score - 5)   -- Minor penalty
        WHEN ss.rejection_rate <= 10 AND ss.total_shows >= 10 THEN LEAST(100, s.priority_score + 5)  -- Bonus
        ELSE s.priority_score  -- No change
      END AS new_priority,
      ss.rejection_rate,
      ss.total_shows,
      CASE
        WHEN ss.rejection_rate >= 80 THEN 'Severe penalty (-20) for high rejection rate'
        WHEN ss.rejection_rate >= 50 THEN 'Major penalty (-10) for high rejection rate'
        WHEN ss.rejection_rate >= 30 THEN 'Minor penalty (-5) for moderate rejection rate'
        WHEN ss.rejection_rate <= 10 AND ss.total_shows >= 10 THEN 'Bonus (+5) for low rejection rate'
        ELSE 'No change needed'
      END AS adjustment_reason
    FROM scraping_sources s
    JOIN source_stats ss ON s.url = ss.source_url
    WHERE s.enabled = TRUE  -- Only adjust enabled sources
      AND (
        -- Only update if there's a significant change
        (ss.rejection_rate >= 30 AND s.priority_score > 30) OR
        (ss.rejection_rate <= 10 AND ss.total_shows >= 10 AND s.priority_score < 95)
      )
  )
  INSERT INTO priority_updates
  SELECT * FROM priority_changes
  WHERE old_priority <> new_priority;  -- Only if score actually changes
  
  -- Apply updates if not dry run
  IF NOT dry_run THEN
    UPDATE scraping_sources
    SET 
      priority_score = pu.new_priority,
      updated_at = NOW(),
      notes = COALESCE(notes, '') || ' | ' || NOW()::DATE || ': Priority adjusted from ' || 
              pu.old_priority || ' to ' || pu.new_priority || ' based on rejection rate.'
    FROM priority_updates pu
    WHERE scraping_sources.url = pu.source_url;
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Updated % source priorities', update_count;
  END IF;
  
  -- Return results
  RETURN QUERY
  SELECT * FROM priority_updates
  ORDER BY 
    CASE 
      WHEN new_priority < old_priority THEN 0  -- Penalties first
      ELSE 1  -- Bonuses second
    END,
    ABS(new_priority - old_priority) DESC;  -- Largest changes first
END;
$$;
