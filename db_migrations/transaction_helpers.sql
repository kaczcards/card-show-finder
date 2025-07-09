-- db_migrations/transaction_helpers.sql
-- SQL stored procedures for transaction handling from edge functions
-- These procedures allow edge functions to use transactions for atomic operations

-- Enable better error reporting
SET client_min_messages TO 'notice';

-- Function to begin a transaction
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Start a new transaction
  BEGIN;
END;
$$;

COMMENT ON FUNCTION begin_transaction() IS 'Starts a new database transaction for use in edge functions';

-- Function to commit a transaction
CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Commit the current transaction
  COMMIT;
END;
$$;

COMMENT ON FUNCTION commit_transaction() IS 'Commits the current database transaction for use in edge functions';

-- Function to rollback a transaction
CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Rollback the current transaction
  ROLLBACK;
END;
$$;

COMMENT ON FUNCTION rollback_transaction() IS 'Rolls back the current database transaction for use in edge functions';

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION begin_transaction() TO authenticated;
GRANT EXECUTE ON FUNCTION commit_transaction() TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_transaction() TO authenticated;

-- Log that the transaction helpers have been created
DO $$
BEGIN
  RAISE NOTICE 'Transaction helper functions created successfully';
  RAISE NOTICE 'These functions enable edge functions to use database transactions';
END $$;
