-- Migration: Add coordinate validation and null coordinate logging
-- This migration adds server-side validation for coordinates and logs shows with null coordinates

-- First, create a function to validate coordinates
CREATE OR REPLACE FUNCTION validate_coordinates(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if either value is null
  IF lat IS NULL OR lng IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check latitude range (-90 to 90)
  IF lat < -90 OR lat > 90 THEN
    RETURN FALSE;
  END IF;
  
  -- Check longitude range (-180 to 180)
  IF lng < -180 OR lng > 180 THEN
    RETURN FALSE;
  END IF;
  
  -- All checks passed
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a table to log shows with null or invalid coordinates
CREATE TABLE IF NOT EXISTS coordinate_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  issue_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS coordinate_issues_show_id_idx ON coordinate_issues(show_id);
CREATE INDEX IF NOT EXISTS coordinate_issues_resolved_idx ON coordinate_issues(resolved_at) WHERE resolved_at IS NULL;

-- Create a trigger function to log shows with null coordinates
CREATE OR REPLACE FUNCTION log_null_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for null coordinates
  IF NEW.coordinates IS NULL OR 
     NEW.coordinates->>'latitude' IS NULL OR 
     NEW.coordinates->>'longitude' IS NULL THEN
    
    -- Log the issue
    INSERT INTO coordinate_issues (
      show_id, 
      latitude, 
      longitude, 
      issue_type
    ) VALUES (
      NEW.id,
      (NEW.coordinates->>'latitude')::DOUBLE PRECISION,
      (NEW.coordinates->>'longitude')::DOUBLE PRECISION,
      'NULL_COORDINATES'
    );
  -- Check for invalid coordinates
  ELSIF NOT validate_coordinates(
    (NEW.coordinates->>'latitude')::DOUBLE PRECISION,
    (NEW.coordinates->>'longitude')::DOUBLE PRECISION
  ) THEN
    -- Log the issue
    INSERT INTO coordinate_issues (
      show_id, 
      latitude, 
      longitude, 
      issue_type
    ) VALUES (
      NEW.id,
      (NEW.coordinates->>'latitude')::DOUBLE PRECISION,
      (NEW.coordinates->>'longitude')::DOUBLE PRECISION,
      'INVALID_COORDINATES'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on shows table
DROP TRIGGER IF EXISTS trigger_log_null_coordinates ON shows;
CREATE TRIGGER trigger_log_null_coordinates
AFTER INSERT OR UPDATE OF coordinates ON shows
FOR EACH ROW
EXECUTE FUNCTION log_null_coordinates();

-- Create or replace an admin function to get all shows with coordinate issues
CREATE OR REPLACE FUNCTION get_shows_with_coordinate_issues(
  page_number INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 10
)
RETURNS TABLE (
  issue_id UUID,
  show_id UUID,
  show_title TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  issue_type TEXT,
  created_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id AS issue_id,
    ci.show_id,
    s.title AS show_title,
    ci.latitude,
    ci.longitude,
    ci.issue_type,
    ci.created_at,
    ci.resolved_at,
    ci.resolved_by
  FROM 
    coordinate_issues ci
  JOIN 
    shows s ON ci.show_id = s.id
  WHERE 
    ci.resolved_at IS NULL
  ORDER BY 
    ci.created_at DESC
  LIMIT 
    page_size
  OFFSET 
    (page_number - 1) * page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to fix show coordinates
CREATE OR REPLACE FUNCTION fix_show_coordinates(
  show_id UUID,
  new_latitude DOUBLE PRECISION,
  new_longitude DOUBLE PRECISION,
  admin_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  issue_exists BOOLEAN;
BEGIN
  -- First, check if the issue exists
  SELECT EXISTS(
    SELECT 1 FROM coordinate_issues 
    WHERE show_id = fix_show_coordinates.show_id AND resolved_at IS NULL
  ) INTO issue_exists;
  
  -- If no issue exists, return false
  IF NOT issue_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Validate the new coordinates
  IF NOT validate_coordinates(new_latitude, new_longitude) THEN
    RAISE EXCEPTION 'Invalid coordinates provided: lat=%, lng=%', new_latitude, new_longitude;
  END IF;
  
  -- Update the show coordinates
  UPDATE shows
  SET coordinates = jsonb_build_object('latitude', new_latitude, 'longitude', new_longitude)
  WHERE id = show_id;
  
  -- Mark the issue as resolved
  UPDATE coordinate_issues
  SET 
    resolved_at = NOW(),
    resolved_by = admin_user_id
  WHERE 
    show_id = fix_show_coordinates.show_id AND 
    resolved_at IS NULL;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for coordinate_issues table
ALTER TABLE coordinate_issues ENABLE ROW LEVEL SECURITY;

-- Only admins can access the coordinate_issues table directly
CREATE POLICY admin_select_coordinate_issues ON coordinate_issues
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPERADMIN')
    )
  );

CREATE POLICY admin_insert_coordinate_issues ON coordinate_issues
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPERADMIN')
    )
  );

CREATE POLICY admin_update_coordinate_issues ON coordinate_issues
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPERADMIN')
    )
  );
