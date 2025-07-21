-- supabase/migrations/20250721000000_add_security_tables.sql
-- Migration to add security tables for rate limiting and WAF protection

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Table: rate_limits
-- Purpose: Store rate limit information for API endpoints
-- ===========================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  first_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Enforce uniqueness of key + endpoint combination
  CONSTRAINT unique_rate_limit_key UNIQUE (key, endpoint)
);

-- Index for faster lookups by key
CREATE INDEX IF NOT EXISTS rate_limits_key_idx ON rate_limits(key);
-- Index for filtering by endpoint
CREATE INDEX IF NOT EXISTS rate_limits_endpoint_idx ON rate_limits(endpoint);
-- Index for finding expired rate limits
CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx ON rate_limits(expires_at);
-- Composite index for key + endpoint lookups
CREATE INDEX IF NOT EXISTS rate_limits_key_endpoint_idx ON rate_limits(key, endpoint);

-- ===========================================
-- Table: waf_logs
-- Purpose: Store Web Application Firewall attack logs
-- ===========================================
CREATE TABLE IF NOT EXISTS waf_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  user_agent TEXT,
  attack_type TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  location TEXT NOT NULL,
  value TEXT,
  action TEXT NOT NULL,
  protection_level TEXT NOT NULL,
  severity TEXT NOT NULL,
  headers JSONB,
  params JSONB
);

-- Index for faster lookups by timestamp (for time-based filtering)
CREATE INDEX IF NOT EXISTS waf_logs_timestamp_idx ON waf_logs(timestamp);
-- Index for filtering by IP address
CREATE INDEX IF NOT EXISTS waf_logs_ip_address_idx ON waf_logs(ip_address);
-- Index for filtering by user ID
CREATE INDEX IF NOT EXISTS waf_logs_user_id_idx ON waf_logs(user_id);
-- Index for filtering by attack type
CREATE INDEX IF NOT EXISTS waf_logs_attack_type_idx ON waf_logs(attack_type);
-- Index for filtering by rule ID
CREATE INDEX IF NOT EXISTS waf_logs_rule_id_idx ON waf_logs(rule_id);
-- Index for filtering by severity
CREATE INDEX IF NOT EXISTS waf_logs_severity_idx ON waf_logs(severity);
-- Index for filtering by request ID
CREATE INDEX IF NOT EXISTS waf_logs_request_id_idx ON waf_logs(request_id);

-- ===========================================
-- Row Level Security Policies
-- ===========================================
-- Enable RLS on all tables
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE waf_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for rate_limits
-- Only admins can view rate limits
CREATE POLICY "Admins can view rate limits"
  ON rate_limits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Service role can manage rate limits (for Edge Functions)
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create policies for waf_logs
-- Only admins can view WAF logs
CREATE POLICY "Admins can view WAF logs"
  ON waf_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Service role can insert WAF logs (for Edge Functions)
CREATE POLICY "Service role can insert WAF logs"
  ON waf_logs
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ===========================================
-- Maintenance Functions
-- ===========================================

-- Function to clean up expired rate limits
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old WAF logs
CREATE OR REPLACE FUNCTION cleanup_old_waf_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMPTZ;
BEGIN
  -- Calculate cutoff date
  cutoff_date := NOW() - (days_to_keep * INTERVAL '1 day');
  
  -- Delete logs older than cutoff date
  DELETE FROM waf_logs
  WHERE timestamp < cutoff_date;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_waf_logs TO service_role;

-- Schedule cleanup to run periodically (requires pg_cron extension)
-- Uncomment if pg_cron is available
-- SELECT cron.schedule('0 3 * * *', 'SELECT cleanup_expired_rate_limits()');
-- SELECT cron.schedule('0 4 * * *', 'SELECT cleanup_old_waf_logs()');

-- ===========================================
-- Security Monitoring Functions
-- ===========================================

-- Function to get recent attacks by IP
CREATE OR REPLACE FUNCTION get_recent_attacks_by_ip(hours INTEGER DEFAULT 24)
RETURNS TABLE (
  ip_address TEXT,
  attack_count BIGINT,
  latest_attack TIMESTAMPTZ,
  attack_types TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.ip_address,
    COUNT(*) as attack_count,
    MAX(w.timestamp) as latest_attack,
    ARRAY_AGG(DISTINCT w.attack_type) as attack_types
  FROM 
    waf_logs w
  WHERE 
    w.timestamp > NOW() - (hours * INTERVAL '1 hour')
  GROUP BY 
    w.ip_address
  ORDER BY 
    attack_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get rate limit violations
CREATE OR REPLACE FUNCTION get_rate_limit_violations(hours INTEGER DEFAULT 24)
RETURNS TABLE (
  endpoint TEXT,
  key TEXT,
  count INTEGER,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.endpoint,
    r.key,
    r.count,
    r.expires_at
  FROM 
    rate_limits r
  WHERE 
    r.count >= 10 AND
    r.last_request_at > NOW() - (hours * INTERVAL '1 hour')
  ORDER BY 
    r.count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to admins
GRANT EXECUTE ON FUNCTION get_recent_attacks_by_ip TO authenticated;
GRANT EXECUTE ON FUNCTION get_rate_limit_violations TO authenticated;

-- Add comment to explain the migration
COMMENT ON TABLE rate_limits IS 'Stores rate limit information for API endpoints';
COMMENT ON TABLE waf_logs IS 'Stores Web Application Firewall attack logs';
