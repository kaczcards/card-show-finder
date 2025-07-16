-- fix-coordinate-validation-trigger.sql
-- This migration fixes the coordinate validation trigger to work with PostGIS geography
-- instead of incorrectly assuming JSON format.

-- Step 1: Drop the existing problematic trigger
DROP TRIGGER IF EXISTS trigger_log_null_coordinates ON shows;

-- Step 2: Create a new trigger function that works with geography(point) columns
CREATE OR REPLACE FUNCTION log_null_coordinates()
RETURNS TRIGGER AS $$
DECLARE
  lat DOUBLE PRECISION;
  lng DOUBLE PRECISION;
  is_valid BOOLEAN;
BEGIN
  -- Step 3: Handle null geography values properly
  IF NEW.coordinates IS NULL THEN
    -- Log the issue for null coordinates
    INSERT INTO coordinate_issues (
      show_id, 
      latitude, 
      longitude, 
      issue_type
    ) VALUES (
      NEW.id,
      NULL,
      NULL,
      'NULL_COORDINATES'
    );
    RETURN NEW;
  END IF;
  
  -- Step 4: Use PostGIS functions to extract coordinates from geography type
  -- Convert geography to geometry to extract coordinates
  -- ST_X gets longitude, ST_Y gets latitude from a point geometry
  BEGIN
    -- Convert to geometry first (geography to geometry conversion is needed for ST_X/ST_Y)
    lng := ST_X(NEW.coordinates::geometry);
    lat := ST_Y(NEW.coordinates::geometry);
    
    -- Check if extraction succeeded
    is_valid := true;
  EXCEPTION WHEN OTHERS THEN
    -- If conversion fails, log the error
    is_valid := false;
    
    INSERT INTO coordinate_issues (
      show_id, 
      latitude, 
      longitude, 
      issue_type
    ) VALUES (
      NEW.id,
      NULL,
      NULL,
      'INVALID_GEOMETRY'
    );
    
    RETURN NEW;
  END;
  
  -- Step 5: Validate coordinates using PostGIS functions
  -- Check if coordinates are valid (within proper ranges)
  IF lat IS NULL OR lng IS NULL OR 
     lat < -90 OR lat > 90 OR 
     lng < -180 OR lng > 180 THEN
    
    -- Log the issue for invalid coordinates
    INSERT INTO coordinate_issues (
      show_id, 
      latitude, 
      longitude, 
      issue_type
    ) VALUES (
      NEW.id,
      lat,
      lng,
      'INVALID_COORDINATES'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create a new trigger with the fixed function
CREATE TRIGGER trigger_log_null_coordinates
AFTER INSERT OR UPDATE OF coordinates ON shows
FOR EACH ROW
EXECUTE FUNCTION log_null_coordinates();

-- Step 7: Update the fix_show_coordinates function to use PostGIS format
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
  IF new_latitude IS NULL OR new_longitude IS NULL OR
     new_latitude < -90 OR new_latitude > 90 OR
     new_longitude < -180 OR new_longitude > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates provided: lat=%, lng=%', new_latitude, new_longitude;
  END IF;
  
  -- Update the show coordinates using PostGIS function to create geography point
  -- ST_SetSRID(ST_Point(longitude, latitude), 4326)::geography creates a proper geography point
  UPDATE shows
  SET coordinates = ST_SetSRID(ST_Point(new_longitude, new_latitude), 4326)::geography
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

-- Step 8: Add a comment explaining the fix
COMMENT ON FUNCTION log_null_coordinates() IS 'Logs shows with null or invalid coordinates using PostGIS functions. Fixed to work with geography type instead of JSON.';
COMMENT ON FUNCTION fix_show_coordinates(UUID, DOUBLE PRECISION, DOUBLE PRECISION, UUID) IS 'Fixes show coordinates using PostGIS functions and marks the issue as resolved.';
