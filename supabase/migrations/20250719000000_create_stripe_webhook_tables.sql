-- supabase/migrations/20250719000000_create_stripe_webhook_tables.sql
-- Migration to create tables for Stripe webhook integration

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Table: webhook_logs
-- Purpose: Store logs of webhook events for auditing and debugging
-- ===========================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  data JSONB NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by event_id
CREATE INDEX IF NOT EXISTS webhook_logs_event_id_idx ON webhook_logs(event_id);
-- Index for filtering by event_type
CREATE INDEX IF NOT EXISTS webhook_logs_event_type_idx ON webhook_logs(event_type);
-- Index for filtering by status
CREATE INDEX IF NOT EXISTS webhook_logs_status_idx ON webhook_logs(status);

-- ===========================================
-- Table: customers
-- Purpose: Map Stripe customer IDs to user IDs
-- ===========================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS customers_user_id_idx ON customers(user_id);
-- Index for faster lookups by stripe_customer_id
CREATE INDEX IF NOT EXISTS customers_stripe_customer_id_idx ON customers(stripe_customer_id);

-- ===========================================
-- Table: subscriptions
-- Purpose: Store subscription data from Stripe
-- ===========================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'trialing', 'active', 'canceled', 'incomplete', 
    'incomplete_expired', 'past_due', 'unpaid'
  )),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
-- Index for faster lookups by stripe_subscription_id
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx ON subscriptions(stripe_subscription_id);
-- Index for faster lookups by stripe_customer_id
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx ON subscriptions(stripe_customer_id);
-- Index for filtering by status
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
-- Index for filtering by plan_id
CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx ON subscriptions(plan_id);

-- Foreign key from subscriptions to customers
ALTER TABLE subscriptions
  ADD CONSTRAINT fk_subscriptions_stripe_customer_id
  FOREIGN KEY (stripe_customer_id)
  REFERENCES customers(stripe_customer_id)
  ON DELETE CASCADE;

-- ===========================================
-- Triggers for updated_at timestamps
-- ===========================================
-- Trigger for customers table
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_customers
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Trigger for subscriptions table
CREATE TRIGGER set_timestamp_subscriptions
BEFORE UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- ===========================================
-- Row Level Security Policies
-- ===========================================
-- Enable RLS on all tables
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook_logs
-- Only admins can view webhook logs
CREATE POLICY "Admins can view webhook logs"
  ON webhook_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create policies for customers
-- Users can view their own customer records
CREATE POLICY "Users can view their own customer records"
  ON customers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all customer records
CREATE POLICY "Admins can view all customer records"
  ON customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Service role can manage customer records (for webhook processing)
CREATE POLICY "Service role can manage customer records"
  ON customers
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create policies for subscriptions
-- Users can view their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Service role can manage subscriptions (for webhook processing)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ===========================================
-- Create a function to get a user's active subscription
-- ===========================================
CREATE OR REPLACE FUNCTION get_user_active_subscription(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  plan_id TEXT,
  status TEXT,
  current_period_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.plan_id,
    s.status,
    s.current_period_end
  FROM 
    subscriptions s
  WHERE 
    s.user_id = user_id_param
    AND s.status IN ('active', 'trialing')
    AND s.current_period_end > NOW()
  ORDER BY 
    s.current_period_end DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_active_subscription TO authenticated;

-- ===========================================
-- Create a function to check if a user has an active subscription
-- ===========================================
CREATE OR REPLACE FUNCTION has_active_subscription(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_subscription BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE 
      s.user_id = user_id_param
      AND s.status IN ('active', 'trialing')
      AND s.current_period_end > NOW()
  ) INTO has_subscription;
  
  RETURN has_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION has_active_subscription TO authenticated;

-- Add comment to explain the migration
COMMENT ON TABLE webhook_logs IS 'Logs of Stripe webhook events for auditing and debugging';
COMMENT ON TABLE customers IS 'Maps Stripe customer IDs to user IDs';
COMMENT ON TABLE subscriptions IS 'Stores subscription data from Stripe';
