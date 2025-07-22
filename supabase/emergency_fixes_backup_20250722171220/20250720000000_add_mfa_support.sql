-- supabase/migrations/20250720000000_add_mfa_support.sql
-- Migration to add Multi-Factor Authentication (MFA) support
-- For Card Show Finder application

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Add MFA enabled flag to profiles table
-- ===========================================
ALTER TABLE profiles 
ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN mfa_enrollment_time TIMESTAMPTZ;

-- ===========================================
-- Table: authenticator_enrollments
-- Purpose: Store TOTP authenticator app enrollments
-- ===========================================
CREATE TABLE IF NOT EXISTS authenticator_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL, -- TOTP secret (encrypted)
  name TEXT NOT NULL, -- User-friendly name for the authenticator (e.g. "iPhone")
  counter INTEGER NOT NULL DEFAULT 0, -- For HOTP (if used)
  algorithm TEXT NOT NULL DEFAULT 'SHA1', -- TOTP algorithm
  digits INTEGER NOT NULL DEFAULT 6, -- Number of digits in the code
  period INTEGER NOT NULL DEFAULT 30, -- TOTP period in seconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  -- Ensure only one active authenticator per user (can be expanded later)
  CONSTRAINT unique_user_authenticator UNIQUE (user_id)
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS authenticator_enrollments_user_id_idx ON authenticator_enrollments(user_id);

-- ===========================================
-- Table: recovery_codes
-- Purpose: Store backup recovery codes for MFA
-- ===========================================
CREATE TABLE IF NOT EXISTS recovery_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL, -- Hashed recovery code
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS recovery_codes_user_id_idx ON recovery_codes(user_id);
-- Index for checking if a code is used
CREATE INDEX IF NOT EXISTS recovery_codes_used_idx ON recovery_codes(used);

-- ===========================================
-- Table: mfa_challenges
-- Purpose: Track active MFA challenges for login attempts
-- ===========================================
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL UNIQUE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  -- Challenges expire after 5 minutes
  CHECK (expires_at > created_at)
);

-- Index for faster lookups by challenge_id
CREATE INDEX IF NOT EXISTS mfa_challenges_challenge_id_idx ON mfa_challenges(challenge_id);
-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS mfa_challenges_user_id_idx ON mfa_challenges(user_id);
-- Index for finding expired challenges
CREATE INDEX IF NOT EXISTS mfa_challenges_expires_at_idx ON mfa_challenges(expires_at);

-- ===========================================
-- Table: mfa_login_attempts
-- Purpose: Track failed MFA attempts for rate limiting
-- ===========================================
CREATE TABLE IF NOT EXISTS mfa_login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  successful BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS mfa_login_attempts_user_id_idx ON mfa_login_attempts(user_id);
-- Index for rate limiting by IP
CREATE INDEX IF NOT EXISTS mfa_login_attempts_ip_address_idx ON mfa_login_attempts(ip_address);
-- Index for finding recent attempts
CREATE INDEX IF NOT EXISTS mfa_login_attempts_created_at_idx ON mfa_login_attempts(created_at);

-- ===========================================
-- Triggers for updated_at timestamps
-- ===========================================
-- Trigger for authenticator_enrollments table
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_authenticator_enrollments
BEFORE UPDATE ON authenticator_enrollments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- ===========================================
-- Row Level Security Policies
-- ===========================================
-- Enable RLS on all tables
ALTER TABLE authenticator_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_login_attempts ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticator_enrollments
-- Users can view and manage their own authenticator enrollments
CREATE POLICY "Users can view their own authenticator enrollments"
  ON authenticator_enrollments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own authenticator enrollments"
  ON authenticator_enrollments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own authenticator enrollments"
  ON authenticator_enrollments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own authenticator enrollments"
  ON authenticator_enrollments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for recovery_codes
-- Users can view their own recovery codes
CREATE POLICY "Users can view their own recovery codes"
  ON recovery_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage recovery codes (for MFA setup)
CREATE POLICY "Service role can manage recovery codes"
  ON recovery_codes
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create policies for mfa_challenges
-- Service role can manage MFA challenges
CREATE POLICY "Service role can manage MFA challenges"
  ON mfa_challenges
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create policies for mfa_login_attempts
-- Service role can manage MFA login attempts
CREATE POLICY "Service role can manage MFA login attempts"
  ON mfa_login_attempts
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Admins can view all MFA data for support purposes
CREATE POLICY "Admins can view all authenticator enrollments"
  ON authenticator_enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all recovery codes"
  ON recovery_codes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all MFA challenges"
  ON mfa_challenges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all MFA login attempts"
  ON mfa_login_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ===========================================
-- Helper Functions
-- ===========================================

-- Function to check if a user has MFA enabled
CREATE OR REPLACE FUNCTION has_mfa_enabled(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_enabled BOOLEAN;
BEGIN
  SELECT mfa_enabled AND mfa_verified INTO is_enabled
  FROM profiles
  WHERE id = user_id_param;
  
  RETURN COALESCE(is_enabled, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION has_mfa_enabled TO authenticated;

-- Function to enable MFA for a user
CREATE OR REPLACE FUNCTION enable_mfa(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  -- Check if user has a verified authenticator
  IF EXISTS (
    SELECT 1 FROM authenticator_enrollments
    WHERE user_id = user_id_param
  ) THEN
    -- Update the profile to enable MFA
    UPDATE profiles
    SET 
      mfa_enabled = TRUE,
      mfa_verified = TRUE,
      mfa_enrollment_time = NOW()
    WHERE id = user_id_param;
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION enable_mfa TO authenticated;

-- Function to disable MFA for a user
CREATE OR REPLACE FUNCTION disable_mfa(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update the profile to disable MFA
  UPDATE profiles
  SET 
    mfa_enabled = FALSE,
    mfa_verified = FALSE
  WHERE id = user_id_param;
  
  -- Delete all authenticator enrollments
  DELETE FROM authenticator_enrollments
  WHERE user_id = user_id_param;
  
  -- Delete all recovery codes
  DELETE FROM recovery_codes
  WHERE user_id = user_id_param;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION disable_mfa TO authenticated;

-- Function to create a new MFA challenge
CREATE OR REPLACE FUNCTION create_mfa_challenge(user_id_param UUID)
RETURNS TEXT AS $$
DECLARE
  challenge_id TEXT;
BEGIN
  -- Generate a unique challenge ID
  challenge_id := encode(gen_random_bytes(16), 'hex');
  
  -- Insert the challenge
  INSERT INTO mfa_challenges (
    user_id,
    challenge_id,
    expires_at
  ) VALUES (
    user_id_param,
    challenge_id,
    NOW() + INTERVAL '5 minutes'
  );
  
  RETURN challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to service role
GRANT EXECUTE ON FUNCTION create_mfa_challenge TO service_role;

-- Function to verify an MFA challenge
CREATE OR REPLACE FUNCTION verify_mfa_challenge(challenge_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  challenge_record mfa_challenges%ROWTYPE;
BEGIN
  -- Get the challenge
  SELECT * INTO challenge_record
  FROM mfa_challenges
  WHERE challenge_id = challenge_id_param
  AND verified = FALSE
  AND expires_at > NOW();
  
  -- If challenge doesn't exist or is expired, return false
  IF challenge_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Mark the challenge as verified
  UPDATE mfa_challenges
  SET 
    verified = TRUE,
    verified_at = NOW()
  WHERE id = challenge_record.id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to service role
GRANT EXECUTE ON FUNCTION verify_mfa_challenge TO service_role;

-- Function to count failed MFA attempts in the last hour
CREATE OR REPLACE FUNCTION count_failed_mfa_attempts(user_id_param UUID, ip_address_param TEXT)
RETURNS INTEGER AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM mfa_login_attempts
  WHERE (user_id = user_id_param OR ip_address = ip_address_param)
  AND successful = FALSE
  AND created_at > NOW() - INTERVAL '1 hour';
  
  RETURN attempt_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to service role
GRANT EXECUTE ON FUNCTION count_failed_mfa_attempts TO service_role;

-- Function to log an MFA attempt
CREATE OR REPLACE FUNCTION log_mfa_attempt(
  user_id_param UUID, 
  ip_address_param TEXT, 
  user_agent_param TEXT, 
  successful_param BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO mfa_login_attempts (
    user_id,
    ip_address,
    user_agent,
    successful
  ) VALUES (
    user_id_param,
    ip_address_param,
    user_agent_param,
    successful_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to service role
GRANT EXECUTE ON FUNCTION log_mfa_attempt TO service_role;

-- Function to clean up expired MFA challenges
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_challenges()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM mfa_challenges
  WHERE expires_at < NOW()
  AND verified = FALSE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup to run periodically (requires pg_cron extension)
-- Uncomment if pg_cron is available
-- SELECT cron.schedule('0 * * * *', 'SELECT cleanup_expired_mfa_challenges()');

-- Add comment to explain the migration
COMMENT ON TABLE authenticator_enrollments IS 'Stores TOTP authenticator app enrollments for MFA';
COMMENT ON TABLE recovery_codes IS 'Stores backup recovery codes for MFA';
COMMENT ON TABLE mfa_challenges IS 'Tracks active MFA challenges for login attempts';
COMMENT ON TABLE mfa_login_attempts IS 'Tracks MFA login attempts for rate limiting';

COMMENT ON COLUMN profiles.mfa_enabled IS 'Whether MFA is enabled for the user';
COMMENT ON COLUMN profiles.mfa_verified IS 'Whether the user has verified their MFA setup';
COMMENT ON COLUMN profiles.mfa_enrollment_time IS 'When the user enrolled in MFA';
