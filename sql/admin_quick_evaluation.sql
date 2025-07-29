-- ================================================================
-- CARD SHOW FINDER - ADMIN QUICK EVALUATION QUERIES
-- ================================================================
-- Created: July 29, 2025
-- Purpose: Collection of SQL queries for quick admin evaluation tasks
--          to efficiently review, approve, reject, and analyze scraped shows
-- ================================================================

-- ----------------------------------------------------------------
-- SECTION 1: VIEW PENDING SHOWS WITH QUALITY INDICATORS
-- ----------------------------------------------------------------

-- 1.1 Latest pending shows (basic)
-- Use when: Quick overview of the pending queue
SELECT 
  id, 
  raw_payload->>'name' AS name,
  raw_payload->>'startDate' AS start_date,
  raw_payload->>'city' AS city,
  raw_payload->>'state' AS state,
  source_url,
  created_at
FROM scraped_shows_pending
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 50;

-- 1.2 Pending shows with quality score (calculated)
-- Use when: Need to prioritize review based on completeness
WITH pending_with_quality AS (
  SELECT 
    id,
    raw_payload->>'name' AS name,
    raw_payload->>'startDate' AS start_date,
    raw_payload->>'city' AS city,
    raw_payload->>'state' AS state,
    raw_payload->>'venueName' AS venue_name,
    raw_payload->>'address' AS address,
    source_url,
    created_at,
    -- Calculate quality score (0-100)
    (CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END)
    AS quality_score
  FROM scraped_shows_pending
  WHERE status = 'PENDING'
)
SELECT 
  id,
  name,
  start_date,
  city || ', ' || state AS location,
  venue_name,
  quality_score,
  CASE 
    WHEN quality_score >= 80 THEN 'High'
    WHEN quality_score >= 50 THEN 'Medium'
    ELSE 'Low'
  END AS quality,
  source_url,
  created_at
FROM pending_with_quality
ORDER BY quality_score DESC, created_at DESC
LIMIT 100;

-- 1.3 Pending shows by source with quality distribution
-- Use when: Analyzing which sources produce the best data
WITH pending_with_quality AS (
  SELECT 
    source_url,
    (CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END)
    AS quality_score
  FROM scraped_shows_pending
  WHERE status = 'PENDING'
)
SELECT 
  source_url,
  COUNT(*) AS total_pending,
  ROUND(AVG(quality_score), 1) AS avg_quality,
  COUNT(*) FILTER (WHERE quality_score >= 80) AS high_quality,
  COUNT(*) FILTER (WHERE quality_score >= 50 AND quality_score < 80) AS medium_quality,
  COUNT(*) FILTER (WHERE quality_score < 50) AS low_quality
FROM pending_with_quality
GROUP BY source_url
ORDER BY avg_quality DESC, total_pending DESC;

-- 1.4 Find shows with specific quality issues
-- Use when: Looking for shows with particular problems to fix
SELECT 
  id,
  raw_payload->>'name' AS name,
  raw_payload->>'startDate' AS start_date,
  raw_payload->>'city' AS city,
  raw_payload->>'state' AS state,
  source_url
FROM scraped_shows_pending
WHERE status = 'PENDING'
AND (
  -- Date format issues (missing year or has state abbreviation)
  (raw_payload->>'startDate' NOT LIKE '%202%' AND raw_payload->>'startDate' IS NOT NULL)
  OR raw_payload->>'startDate' LIKE '% AL' 
  OR raw_payload->>'startDate' LIKE '% TX'
  -- Missing city
  OR raw_payload->>'city' IS NULL
  -- State not in 2-letter format
  OR (raw_payload->>'state' IS NOT NULL AND LENGTH(raw_payload->>'state') > 2)
  -- HTML artifacts
  OR raw_payload->>'description' LIKE '%<%'
  OR raw_payload->>'description' LIKE '%&nbsp;%'
)
ORDER BY created_at DESC
LIMIT 50;

-- ----------------------------------------------------------------
-- SECTION 2: BULK APPROVE HIGH-QUALITY SHOWS
-- ----------------------------------------------------------------

-- 2.1 Identify high-quality shows ready for approval
-- Use when: Preparing for bulk approval
WITH high_quality_pending AS (
  SELECT 
    id,
    raw_payload->>'name' AS name,
    raw_payload->>'startDate' AS start_date,
    raw_payload->>'city' AS city,
    raw_payload->>'state' AS state,
    -- Calculate quality score
    (CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END)
    AS quality_score
  FROM scraped_shows_pending
  WHERE status = 'PENDING'
)
SELECT 
  id,
  name,
  start_date,
  city || ', ' || state AS location,
  quality_score
FROM high_quality_pending
WHERE quality_score >= 80
AND name IS NOT NULL
AND start_date IS NOT NULL
AND city IS NOT NULL
ORDER BY quality_score DESC, start_date ASC
LIMIT 100;

-- 2.2 Bulk approve high-quality shows (with transaction)
-- Use when: Ready to approve a batch of high-quality shows
-- IMPORTANT: Review the list first using query 2.1
BEGIN;

-- Store current user ID for audit trail
DO $$
DECLARE
  current_admin_id UUID;
BEGIN
  current_admin_id := auth.uid();
  
  -- Approve high-quality shows
  WITH high_quality_pending AS (
    SELECT 
      id,
      (CASE WHEN raw_payload->>'name' IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN raw_payload->>'startDate' IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN raw_payload->>'city' IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN raw_payload->>'state' IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN raw_payload->>'venueName' IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN raw_payload->>'address' IS NOT NULL THEN 15 ELSE 0 END)
      AS quality_score
    FROM scraped_shows_pending
    WHERE status = 'PENDING'
  ),
  to_approve AS (
    SELECT id
    FROM high_quality_pending
    WHERE quality_score >= 80
    AND id IN (
      -- Optionally replace with specific IDs from query 2.1
      SELECT id FROM scraped_shows_pending 
      WHERE status = 'PENDING'
      AND raw_payload->>'name' IS NOT NULL
      AND raw_payload->>'startDate' IS NOT NULL
      AND raw_payload->>'city' IS NOT NULL
      LIMIT 50  -- Safety limit
    )
  ),
  approved AS (
    UPDATE scraped_shows_pending
    SET 
      status = 'APPROVED',
      admin_notes = 'Bulk approved - high quality',
      reviewed_at = NOW()
    WHERE id IN (SELECT id FROM to_approve)
    RETURNING id
  )
  -- Add audit records
  INSERT INTO admin_feedback (pending_id, admin_id, action, feedback)
  SELECT 
    id, 
    current_admin_id, 
    'bulk_approve', 
    'Bulk approved - high quality'
  FROM approved;

  -- Log the count
  RAISE NOTICE 'Approved % high-quality shows', (SELECT COUNT(*) FROM approved);
END $$;

-- Review changes before committing
SELECT * FROM scraped_shows_pending WHERE status = 'APPROVED' AND reviewed_at > NOW() - INTERVAL '5 minutes';

-- Uncomment to apply changes:
-- COMMIT;
ROLLBACK;  -- Comment this out when ready to commit

-- 2.3 Approve shows from a specific source (with transaction)
-- Use when: A particular source consistently produces good data
BEGIN;

-- Store current user ID for audit trail
DO $$
DECLARE
  current_admin_id UUID;
  source_to_approve TEXT := 'https://sportscollectorsdigest.com/show-calendar';  -- CHANGE THIS
  approved_count INT;
BEGIN
  current_admin_id := auth.uid();
  
  -- Approve shows from specified source
  WITH to_approve AS (
    SELECT id
    FROM scraped_shows_pending
    WHERE status = 'PENDING'
    AND source_url = source_to_approve
    AND raw_payload->>'name' IS NOT NULL
    AND raw_payload->>'startDate' IS NOT NULL
    LIMIT 100  -- Safety limit
  ),
  approved AS (
    UPDATE scraped_shows_pending
    SET 
      status = 'APPROVED',
      admin_notes = 'Bulk approved - trusted source',
      reviewed_at = NOW()
    WHERE id IN (SELECT id FROM to_approve)
    RETURNING id
  )
  -- Add audit records
  INSERT INTO admin_feedback (pending_id, admin_id, action, feedback)
  SELECT 
    id, 
    current_admin_id, 
    'bulk_approve', 
    'Bulk approved - trusted source: ' || source_to_approve
  FROM approved;

  -- Get count for log message
  SELECT COUNT(*) INTO approved_count FROM approved;
  
  -- Log the count
  RAISE NOTICE 'Approved % shows from source: %', approved_count, source_to_approve;
END $$;

-- Review changes before committing
SELECT * FROM scraped_shows_pending WHERE status = 'APPROVED' AND reviewed_at > NOW() - INTERVAL '5 minutes';

-- Uncomment to apply changes:
-- COMMIT;
ROLLBACK;  -- Comment this out when ready to commit

-- ----------------------------------------------------------------
-- SECTION 3: BULK REJECT OBVIOUSLY BAD SHOWS
-- ----------------------------------------------------------------

-- 3.1 Identify low-quality shows for rejection
-- Use when: Finding shows that are not worth keeping
SELECT 
  id,
  raw_payload->>'name' AS name,
  raw_payload->>'startDate' AS start_date,
  raw_payload->>'city' AS city,
  raw_payload->>'state' AS state,
  source_url,
  CASE
    WHEN raw_payload->>'name' IS NULL THEN 'Missing name'
    WHEN raw_payload->>'startDate' IS NULL THEN 'Missing date'
    WHEN raw_payload->>'city' IS NULL AND raw_payload->>'address' IS NULL THEN 'Missing location'
    WHEN raw_payload->>'startDate' LIKE '% AL' OR raw_payload->>'startDate' LIKE '% TX' THEN 'Bad date format'
    WHEN raw_payload->>'name' ILIKE '%not a card show%' THEN 'Not a card show'
    WHEN raw_payload->>'name' ILIKE '%cancelled%' THEN 'Cancelled event'
    ELSE 'Other quality issues'
  END AS rejection_reason
FROM scraped_shows_pending
WHERE status = 'PENDING'
AND (
  raw_payload->>'name' IS NULL OR
  raw_payload->>'startDate' IS NULL OR
  (raw_payload->>'city' IS NULL AND raw_payload->>'address' IS NULL) OR
  raw_payload->>'startDate' LIKE '% AL' OR
  raw_payload->>'startDate' LIKE '% TX' OR
  raw_payload->>'name' ILIKE '%not a card show%' OR
  raw_payload->>'name' ILIKE '%cancelled%'
)
ORDER BY created_at DESC
LIMIT 100;

-- 3.2 Bulk reject low-quality shows (with transaction)
-- Use when: Ready to reject a batch of low-quality shows
-- IMPORTANT: Review the list first using query 3.1
BEGIN;

-- Store current user ID for audit trail
DO $$
DECLARE
  current_admin_id UUID;
BEGIN
  current_admin_id := auth.uid();
  
  -- Reject low-quality shows
  WITH to_reject AS (
    SELECT 
      id,
      CASE
        WHEN raw_payload->>'name' IS NULL THEN 'TITLE_MISSING'
        WHEN raw_payload->>'startDate' IS NULL THEN 'DATE_FORMAT'
        WHEN raw_payload->>'city' IS NULL AND raw_payload->>'address' IS NULL THEN 'CITY_MISSING, ADDRESS_POOR'
        WHEN raw_payload->>'startDate' LIKE '% AL' OR raw_payload->>'startDate' LIKE '% TX' THEN 'DATE_FORMAT'
        WHEN raw_payload->>'name' ILIKE '%not a card show%' THEN 'SPAM'
        WHEN raw_payload->>'name' ILIKE '%cancelled%' THEN 'SPAM'
        ELSE 'Low quality'
      END AS rejection_reason
    FROM scraped_shows_pending
    WHERE status = 'PENDING'
    AND (
      raw_payload->>'name' IS NULL OR
      raw_payload->>'startDate' IS NULL OR
      (raw_payload->>'city' IS NULL AND raw_payload->>'address' IS NULL) OR
      raw_payload->>'startDate' LIKE '% AL' OR
      raw_payload->>'startDate' LIKE '% TX' OR
      raw_payload->>'name' ILIKE '%not a card show%' OR
      raw_payload->>'name' ILIKE '%cancelled%'
    )
    LIMIT 50  -- Safety limit
  ),
  rejected AS (
    UPDATE scraped_shows_pending
    SET 
      status = 'REJECTED',
      admin_notes = r.rejection_reason,
      reviewed_at = NOW()
    FROM to_reject r
    WHERE scraped_shows_pending.id = r.id
    RETURNING scraped_shows_pending.id, r.rejection_reason
  )
  -- Add audit records
  INSERT INTO admin_feedback (pending_id, admin_id, action, feedback)
  SELECT 
    id, 
    current_admin_id, 
    'bulk_reject', 
    rejection_reason
  FROM rejected;

  -- Log the count
  RAISE NOTICE 'Rejected % low-quality shows', (SELECT COUNT(*) FROM rejected);
END $$;

-- Review changes before committing
SELECT * FROM scraped_shows_pending WHERE status = 'REJECTED' AND reviewed_at > NOW() - INTERVAL '5 minutes';

-- Uncomment to apply changes:
-- COMMIT;
ROLLBACK;  -- Comment this out when ready to commit

-- 3.3 Reject shows with specific issues (with transaction)
-- Use when: Targeting a specific quality problem
BEGIN;

-- Store current user ID for audit trail
DO $$
DECLARE
  current_admin_id UUID;
  rejection_tag TEXT := 'DATE_FORMAT';  -- CHANGE THIS: DATE_FORMAT, VENUE_MISSING, etc.
  rejection_note TEXT := 'Date format issues - missing year or includes state';  -- CHANGE THIS
  rejected_count INT;
BEGIN
  current_admin_id := auth.uid();
  
  -- Reject shows with specific issues
  WITH to_reject AS (
    SELECT id
    FROM scraped_shows_pending
    WHERE status = 'PENDING'
    AND (
      -- Customize this condition based on the issue
      -- Example for DATE_FORMAT:
      (raw_payload->>'startDate' NOT LIKE '%202%' AND raw_payload->>'startDate' IS NOT NULL)
      OR raw_payload->>'startDate' LIKE '% AL' 
      OR raw_payload->>'startDate' LIKE '% TX'
    )
    LIMIT 50  -- Safety limit
  ),
  rejected AS (
    UPDATE scraped_shows_pending
    SET 
      status = 'REJECTED',
      admin_notes = rejection_tag || ' - ' || rejection_note,
      reviewed_at = NOW()
    WHERE id IN (SELECT id FROM to_reject)
    RETURNING id
  )
  -- Add audit records
  INSERT INTO admin_feedback (pending_id, admin_id, action, feedback)
  SELECT 
    id, 
    current_admin_id, 
    'bulk_reject', 
    rejection_tag || ' - ' || rejection_note
  FROM rejected;

  -- Get count for log message
  SELECT COUNT(*) INTO rejected_count FROM rejected;
  
  -- Log the count
  RAISE NOTICE 'Rejected % shows with issue: %', rejected_count, rejection_tag;
END $$;

-- Review changes before committing
SELECT * FROM scraped_shows_pending WHERE status = 'REJECTED' AND reviewed_at > NOW() - INTERVAL '5 minutes';

-- Uncomment to apply changes:
-- COMMIT;
ROLLBACK;  -- Comment this out when ready to commit

-- ----------------------------------------------------------------
-- SECTION 4: FIND POTENTIAL DUPLICATES
-- ----------------------------------------------------------------

-- 4.1 Find exact duplicates (same name, date, and location)
-- Use when: Looking for obvious duplicates
SELECT 
  a.id AS id1,
  b.id AS id2,
  a.raw_payload->>'name' AS name,
  a.raw_payload->>'startDate' AS start_date,
  a.raw_payload->>'city' AS city,
  a.raw_payload->>'state' AS state,
  a.source_url AS source1,
  b.source_url AS source2,
  a.created_at AS created1,
  b.created_at AS created2
FROM scraped_shows_pending a
JOIN scraped_shows_pending b ON 
  a.id < b.id AND  -- Avoid self-joins and duplicates (a,b) vs (b,a)
  a.status = 'PENDING' AND
  b.status = 'PENDING' AND
  LOWER(a.raw_payload->>'name') = LOWER(b.raw_payload->>'name') AND
  a.raw_payload->>'startDate' = b.raw_payload->>'startDate' AND
  LOWER(COALESCE(a.raw_payload->>'city', '')) = LOWER(COALESCE(b.raw_payload->>'city', ''))
ORDER BY a.created_at DESC;

-- 4.2 Find similar shows (fuzzy matching)
-- Use when: Looking for potential duplicates with slight differences
-- Requires: pg_trgm extension (CREATE EXTENSION IF NOT EXISTS pg_trgm;)
SELECT 
  a.id AS id1,
  b.id AS id2,
  a.raw_payload->>'name' AS name1,
  b.raw_payload->>'name' AS name2,
  a.raw_payload->>'startDate' AS date1,
  b.raw_payload->>'startDate' AS date2,
  a.raw_payload->>'city' AS city1,
  b.raw_payload->>'city' AS city2,
  a.raw_payload->>'state' AS state1,
  b.raw_payload->>'state' AS state2,
  a.source_url AS source1,
  b.source_url AS source2,
  GREATEST(
    similarity(LOWER(a.raw_payload->>'name'), LOWER(b.raw_payload->>'name')),
    similarity(
      LOWER(COALESCE(a.raw_payload->>'city', '') || ' ' || COALESCE(a.raw_payload->>'state', '')),
      LOWER(COALESCE(b.raw_payload->>'city', '') || ' ' || COALESCE(b.raw_payload->>'state', ''))
    )
  )::NUMERIC(5,2) AS similarity
FROM scraped_shows_pending a
JOIN scraped_shows_pending b ON 
  a.id < b.id AND  -- Avoid self-joins and duplicates
  a.status = 'PENDING' AND
  b.status = 'PENDING'
WHERE (
  -- High name similarity and same date
  (similarity(LOWER(a.raw_payload->>'name'), LOWER(b.raw_payload->>'name')) > 0.7 
   AND a.raw_payload->>'startDate' = b.raw_payload->>'startDate')
  -- OR same name and close dates (if dates are in a parseable format)
  OR (LOWER(a.raw_payload->>'name') = LOWER(b.raw_payload->>'name') 
      AND a.raw_payload->>'startDate' ~ '^\d{4}-\d{2}-\d{2}' 
      AND b.raw_payload->>'startDate' ~ '^\d{4}-\d{2}-\d{2}' 
      AND ABS(EXTRACT(EPOCH FROM (
          TO_DATE(a.raw_payload->>'startDate', 'YYYY-MM-DD') - 
          TO_DATE(b.raw_payload->>'startDate', 'YYYY-MM-DD')
      )) / 86400) <= 1)
  -- OR high name similarity and same location
  OR (similarity(LOWER(a.raw_payload->>'name'), LOWER(b.raw_payload->>'name')) > 0.6 
      AND LOWER(COALESCE(a.raw_payload->>'city', '')) = LOWER(COALESCE(b.raw_payload->>'city', '')) 
      AND (a.raw_payload->>'state' IS NULL OR b.raw_payload->>'state' IS NULL 
           OR LOWER(a.raw_payload->>'state') = LOWER(b.raw_payload->>'state')))
)
ORDER BY similarity DESC, a.created_at DESC
LIMIT 100;

-- 4.3 Resolve duplicates (keep newest, reject oldest)
-- Use when: Ready to resolve a batch of duplicates
-- IMPORTANT: Review the list first using queries 4.1 or 4.2
BEGIN;

-- Store current user ID for audit trail
DO $$
DECLARE
  current_admin_id UUID;
BEGIN
  current_admin_id := auth.uid();
  
  -- Find exact duplicates
  WITH exact_duplicates AS (
    SELECT 
      LEAST(a.id, b.id) AS older_id,
      GREATEST(a.id, b.id) AS newer_id
    FROM scraped_shows_pending a
    JOIN scraped_shows_pending b ON 
      a.id <> b.id AND
      a.status = 'PENDING' AND
      b.status = 'PENDING' AND
      LOWER(a.raw_payload->>'name') = LOWER(b.raw_payload->>'name') AND
      a.raw_payload->>'startDate' = b.raw_payload->>'startDate' AND
      LOWER(COALESCE(a.raw_payload->>'city', '')) = LOWER(COALESCE(b.raw_payload->>'city', ''))
  ),
  rejected AS (
    UPDATE scraped_shows_pending
    SET 
      status = 'REJECTED',
      admin_notes = 'DUPLICATE - Newer version exists',
      reviewed_at = NOW()
    WHERE id IN (SELECT older_id FROM exact_duplicates)
    RETURNING id
  ),
  approved AS (
    UPDATE scraped_shows_pending
    SET 
      status = 'APPROVED',
      admin_notes = 'Approved (duplicate resolved)',
      reviewed_at = NOW()
    WHERE id IN (SELECT newer_id FROM exact_duplicates)
    RETURNING id
  )
  -- Add audit records
  INSERT INTO admin_feedback (pending_id, admin_id, action, feedback)
  SELECT 
    id, 
    current_admin_id, 
    'bulk_reject', 
    'DUPLICATE - Newer version exists'
  FROM rejected
  UNION ALL
  SELECT 
    id, 
    current_admin_id, 
    'bulk_approve', 
    'Approved (duplicate resolved)'
  FROM approved;

  -- Log the counts
  RAISE NOTICE 'Resolved % duplicate pairs', (SELECT COUNT(*) FROM rejected);
END $$;

-- Review changes before committing
SELECT * FROM scraped_shows_pending 
WHERE status IN ('APPROVED', 'REJECTED') 
AND reviewed_at > NOW() - INTERVAL '5 minutes';

-- Uncomment to apply changes:
-- COMMIT;
ROLLBACK;  -- Comment this out when ready to commit

-- ----------------------------------------------------------------
-- SECTION 5: UPDATE SOURCE PRIORITY BASED ON REJECTION RATES
-- ----------------------------------------------------------------

-- 5.1 Calculate rejection rates by source
-- Use when: Analyzing which sources produce poor quality data
WITH source_stats AS (
  SELECT 
    source_url,
    COUNT(*) AS total_shows,
    COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
    COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected,
    COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
    ROUND(COUNT(*) FILTER (WHERE status = 'REJECTED')::NUMERIC / 
          NULLIF(COUNT(*) FILTER (WHERE status IN ('APPROVED', 'REJECTED')), 0) * 100, 1) AS rejection_rate
  FROM scraped_shows_pending
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY source_url
)
SELECT 
  s.*,
  ss.priority_score AS current_priority
FROM source_stats s
LEFT JOIN scraping_sources ss ON s.source_url = ss.url
WHERE s.total_shows >= 5  -- Only sources with meaningful sample size
ORDER BY s.rejection_rate DESC;

-- 5.2 Update priority scores based on rejection rates (with transaction)
-- Use when: Adjusting scraper priorities based on data quality
BEGIN;

-- Update priorities based on rejection rates
WITH source_stats AS (
  SELECT 
    source_url,
    COUNT(*) AS total_shows,
    COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
    COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected,
    ROUND(COUNT(*) FILTER (WHERE status = 'REJECTED')::NUMERIC / 
          NULLIF(COUNT(*) FILTER (WHERE status IN ('APPROVED', 'REJECTED')), 0) * 100, 1) AS rejection_rate
  FROM scraped_shows_pending
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY source_url
),
priority_updates AS (
  SELECT 
    s.url,
    s.priority_score AS old_score,
    -- Adjust score based on rejection rate
    CASE
      WHEN ss.rejection_rate >= 80 THEN GREATEST(10, s.priority_score - 20)  -- Severe penalty
      WHEN ss.rejection_rate >= 50 THEN GREATEST(20, s.priority_score - 10)  -- Major penalty
      WHEN ss.rejection_rate >= 30 THEN GREATEST(30, s.priority_score - 5)   -- Minor penalty
      WHEN ss.rejection_rate <= 10 AND ss.total_shows >= 10 THEN LEAST(100, s.priority_score + 5)  -- Bonus
      ELSE s.priority_score  -- No change
    END AS new_score
  FROM scraping_sources s
  JOIN source_stats ss ON s.url = ss.source_url
  WHERE ss.total_shows >= 5  -- Only sources with meaningful sample size
    AND (
      -- Only update if there's a significant change
      (ss.rejection_rate >= 30 AND s.priority_score > 30) OR
      (ss.rejection_rate <= 10 AND ss.total_shows >= 10 AND s.priority_score < 95)
    )
),
updated AS (
  UPDATE scraping_sources
  SET 
    priority_score = pu.new_score,
    updated_at = NOW(),
    notes = COALESCE(notes, '') || ' | ' || NOW()::DATE || ': Priority adjusted from ' || 
            pu.old_score || ' to ' || pu.new_score || ' based on rejection rate.'
  FROM priority_updates pu
  WHERE scraping_sources.url = pu.url
    AND scraping_sources.priority_score <> pu.new_score  -- Only if score actually changes
  RETURNING scraping_sources.url, scraping_sources.priority_score, pu.old_score
)
-- Show what changed
SELECT 
  u.url,
  u.old_score AS previous_score,
  u.priority_score AS new_score,
  ss.rejection_rate
FROM updated u
JOIN source_stats ss ON u.url = ss.source_url
ORDER BY ss.rejection_rate DESC;

-- Uncomment to apply changes:
-- COMMIT;
ROLLBACK;  -- Comment this out when ready to commit

-- 5.3 Disable consistently poor sources (with transaction)
-- Use when: Removing sources that consistently produce bad data
BEGIN;

-- Disable sources with high rejection rates
WITH source_stats AS (
  SELECT 
    source_url,
    COUNT(*) AS total_shows,
    COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
    COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected,
    ROUND(COUNT(*) FILTER (WHERE status = 'REJECTED')::NUMERIC / 
          NULLIF(COUNT(*) FILTER (WHERE status IN ('APPROVED', 'REJECTED')), 0) * 100, 1) AS rejection_rate
  FROM scraped_shows_pending
  WHERE created_at > NOW() - INTERVAL '60 days'  -- Longer timeframe for disabling
  GROUP BY source_url
),
to_disable AS (
  SELECT 
    s.url,
    ss.total_shows,
    ss.approved,
    ss.rejected,
    ss.rejection_rate
  FROM scraping_sources s
  JOIN source_stats ss ON s.url = ss.source_url
  WHERE ss.total_shows >= 10  -- Only sources with meaningful sample size
    AND ss.rejection_rate >= 85  -- Very high rejection rate
    AND s.enabled = TRUE  -- Currently enabled
),
disabled AS (
  UPDATE scraping_sources
  SET 
    enabled = FALSE,
    updated_at = NOW(),
    notes = COALESCE(notes, '') || ' | ' || NOW()::DATE || ': Disabled due to ' || 
            td.rejection_rate || '% rejection rate (' || td.rejected || '/' || td.total_shows || ' shows rejected).'
  FROM to_disable td
  WHERE scraping_sources.url = td.url
  RETURNING scraping_sources.url, scraping_sources.notes
)
-- Show what changed
SELECT * FROM disabled;

-- Uncomment to apply changes:
-- COMMIT;
ROLLBACK;  -- Comment this out when ready to commit

-- ----------------------------------------------------------------
-- SECTION 6: GENERATE FEEDBACK REPORTS
-- ----------------------------------------------------------------

-- 6.1 Common rejection reasons
-- Use when: Analyzing patterns to improve scraper
WITH extracted_tags AS (
  -- Extract tags from feedback (comma or space separated before the first dash)
  SELECT 
    af.id,
    af.pending_id,
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
  WHERE af.created_at > NOW() - INTERVAL '30 days'
    AND af.action = 'reject'
    AND af.feedback IS NOT NULL
),
valid_tags AS (
  -- Keep only known tags and uppercase them
  SELECT 
    id,
    pending_id,
    UPPER(TRIM(tag)) AS tag
  FROM extracted_tags
  WHERE TRIM(tag) != ''
    AND UPPER(TRIM(tag)) IN (
      'DATE_FORMAT', 'VENUE_MISSING', 'ADDRESS_POOR', 'DUPLICATE',
      'MULTI_EVENT_COLLAPSE', 'EXTRA_HTML', 'SPAM', 'STATE_FULL',
      'CITY_MISSING'
    )
),
tag_counts AS (
  -- Count occurrences of each tag
  SELECT 
    tag,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(DISTINCT pending_id) FROM valid_tags), 1) AS percentage
  FROM valid_tags
  GROUP BY tag
)
SELECT 
  tag,
  count,
  percentage || '%' AS pct_of_rejections
FROM tag_counts
ORDER BY count DESC;

-- 6.2 Rejection reasons by source
-- Use when: Identifying source-specific issues
WITH source_feedback AS (
  SELECT 
    ssp.source_url,
    af.feedback
  FROM admin_feedback af
  JOIN scraped_shows_pending ssp ON af.pending_id = ssp.id
  WHERE af.created_at > NOW() - INTERVAL '30 days'
    AND af.action = 'reject'
    AND af.feedback IS NOT NULL
),
extracted_tags AS (
  -- Extract tags from feedback
  SELECT 
    source_url,
    regexp_split_to_table(
      CASE 
        WHEN position('-' IN feedback) > 0 
        THEN substring(feedback FROM 1 FOR position('-' IN feedback) - 1)
        WHEN position('–' IN feedback) > 0 
        THEN substring(feedback FROM 1 FOR position('–' IN feedback) - 1)
        ELSE feedback
      END,
      '[,\\s]+'
    ) AS tag
  FROM source_feedback
),
valid_tags AS (
  -- Keep only known tags and uppercase them
  SELECT 
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
tag_counts AS (
  -- Count occurrences of each tag by source
  SELECT 
    source_url,
    tag,
    COUNT(*) AS count
  FROM valid_tags
  GROUP BY source_url, tag
),
source_totals AS (
  -- Get total rejections by source
  SELECT 
    source_url,
    COUNT(*) AS total_rejections
  FROM source_feedback
  GROUP BY source_url
)
SELECT 
  tc.source_url,
  tc.tag,
  tc.count,
  ROUND(tc.count * 100.0 / st.total_rejections, 1) || '%' AS pct_of_source_rejections
FROM tag_counts tc
JOIN source_totals st ON tc.source_url = st.source_url
ORDER BY tc.source_url, tc.count DESC;

-- 6.3 Feedback trends over time
-- Use when: Tracking improvement or degradation
WITH weekly_feedback AS (
  SELECT 
    date_trunc('week', af.created_at) AS week,
    af.action,
    COUNT(*) AS count
  FROM admin_feedback af
  WHERE af.created_at > NOW() - INTERVAL '90 days'
  GROUP BY date_trunc('week', af.created_at), af.action
),
weekly_totals AS (
  SELECT 
    week,
    SUM(count) AS total
  FROM weekly_feedback
  GROUP BY week
)
SELECT 
  to_char(wf.week, 'YYYY-MM-DD') AS week_starting,
  wf.action,
  wf.count,
  ROUND(wf.count * 100.0 / wt.total, 1) || '%' AS percentage
FROM weekly_feedback wf
JOIN weekly_totals wt ON wf.week = wt.week
ORDER BY wf.week DESC, wf.action;

-- 6.4 Admin activity report
-- Use when: Tracking review workload and patterns
SELECT 
  date_trunc('day', af.created_at) AS day,
  af.admin_id,
  COUNT(*) AS total_actions,
  COUNT(*) FILTER (WHERE af.action = 'approve') AS approvals,
  COUNT(*) FILTER (WHERE af.action = 'reject') AS rejections,
  COUNT(*) FILTER (WHERE af.action = 'edit') AS edits,
  COUNT(*) FILTER (WHERE af.action LIKE 'bulk%') AS bulk_actions,
  ROUND(AVG(EXTRACT(EPOCH FROM (af.created_at - ssp.created_at)) / 3600), 1) AS avg_hours_to_review
FROM admin_feedback af
JOIN scraped_shows_pending ssp ON af.pending_id = ssp.id
WHERE af.created_at > NOW() - INTERVAL '30 days'
GROUP BY date_trunc('day', af.created_at), af.admin_id
ORDER BY day DESC, total_actions DESC;

-- ----------------------------------------------------------------
-- SECTION 7: EXPORT PENDING DATA TO CSV
-- ----------------------------------------------------------------

-- 7.1 Export pending shows to CSV
-- Use when: Need to analyze data outside of SQL
-- How to use: Run this in psql with \copy or in pgAdmin
COPY (
  SELECT 
    id,
    source_url,
    raw_payload->>'name' AS name,
    raw_payload->>'startDate' AS start_date,
    raw_payload->>'endDate' AS end_date,
    raw_payload->>'venueName' AS venue_name,
    raw_payload->>'address' AS address,
    raw_payload->>'city' AS city,
    raw_payload->>'state' AS state,
    raw_payload->>'entryFee' AS entry_fee,
    raw_payload->>'contactInfo' AS contact_info,
    raw_payload->>'url' AS url,
    raw_payload->>'description' AS description,
    status,
    admin_notes,
    created_at,
    reviewed_at
  FROM scraped_shows_pending
  WHERE status = 'PENDING'
  ORDER BY created_at DESC
) TO '/tmp/pending_shows_export.csv' WITH CSV HEADER;

-- 7.2 Export feedback analysis to CSV
-- Use when: Need to analyze feedback patterns outside of SQL
COPY (
  WITH extracted_tags AS (
    SELECT 
      af.id,
      af.pending_id,
      ssp.source_url,
      af.created_at,
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
    WHERE af.action = 'reject'
      AND af.feedback IS NOT NULL
  )
  SELECT 
    id,
    pending_id,
    source_url,
    created_at,
    UPPER(TRIM(tag)) AS tag
  FROM extracted_tags
  WHERE TRIM(tag) != ''
  ORDER BY created_at DESC
) TO '/tmp/feedback_analysis_export.csv' WITH CSV HEADER;

-- 7.3 Export source stats to CSV
-- Use when: Need to analyze source performance outside of SQL
COPY (
  WITH source_stats AS (
    SELECT 
      source_url,
      COUNT(*) AS total_shows,
      COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
      COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected,
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
      ROUND(COUNT(*) FILTER (WHERE status = 'REJECTED')::NUMERIC / 
            NULLIF(COUNT(*) FILTER (WHERE status IN ('APPROVED', 'REJECTED')), 0) * 100, 1) AS rejection_rate,
      ROUND(COUNT(*) FILTER (WHERE status = 'APPROVED')::NUMERIC / 
            NULLIF(COUNT(*) FILTER (WHERE status IN ('APPROVED', 'REJECTED')), 0) * 100, 1) AS approval_rate
    FROM scraped_shows_pending
    GROUP BY source_url
  )
  SELECT 
    s.*,
    ss.priority_score,
    ss.enabled,
    ss.last_success_at,
    ss.last_error_at,
    ss.error_streak
  FROM source_stats s
  LEFT JOIN scraping_sources ss ON s.source_url = ss.url
  ORDER BY s.total_shows DESC
) TO '/tmp/source_stats_export.csv' WITH CSV HEADER;

-- ----------------------------------------------------------------
-- SECTION 8: BONUS - QUICK ACTIONS
-- ----------------------------------------------------------------

-- 8.1 Approve a single show by ID
-- Use when: Need to quickly approve one show
UPDATE scraped_shows_pending
SET 
  status = 'APPROVED',
  admin_notes = 'Manually approved',
  reviewed_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000000'  -- REPLACE WITH ACTUAL ID
  AND status = 'PENDING';

INSERT INTO admin_feedback (pending_id, admin_id, action, feedback)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- REPLACE WITH ACTUAL ID
  auth.uid(),
  'approve',
  'Manually approved'
);

-- 8.2 Reject a single show by ID
-- Use when: Need to quickly reject one show
UPDATE scraped_shows_pending
SET 
  status = 'REJECTED',
  admin_notes = 'DUPLICATE - Already exists',  -- REPLACE WITH ACTUAL REASON
  reviewed_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000000'  -- REPLACE WITH ACTUAL ID
  AND status = 'PENDING';

INSERT INTO admin_feedback (pending_id, admin_id, action, feedback)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- REPLACE WITH ACTUAL ID
  auth.uid(),
  'reject',
  'DUPLICATE - Already exists'  -- REPLACE WITH ACTUAL REASON
);

-- 8.3 Run normalizer to process approved shows
-- Use when: Need to trigger normalization after approvals
SELECT normalizer();

-- 8.4 Update a scraping source URL
-- Use when: Source URL has changed
UPDATE scraping_sources
SET 
  url = 'https://new-url.com/shows',  -- REPLACE WITH NEW URL
  notes = COALESCE(notes, '') || ' | ' || NOW()::DATE || ': URL updated from old-url to new-url.',
  updated_at = NOW()
WHERE url = 'https://old-url.com/shows';  -- REPLACE WITH OLD URL
