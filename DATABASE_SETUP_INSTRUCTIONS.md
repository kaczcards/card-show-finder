# Database Setup Instructions

## Overview

This document provides step-by-step instructions for fixing database setup issues and properly configuring Row Level Security (RLS) policies for the Card Show Finder application. Following these instructions will ensure your database is secure and properly configured for production use.

## The Problem

The Card Show Finder application relies on Row Level Security (RLS) policies to protect data and enforce access controls. However, there's a critical issue preventing these policies from being applied:

1. **Missing `exec_sql` Function**: The RLS scripts require a PostgreSQL function called `exec_sql` to execute SQL statements with proper error handling.
2. **Circular Dependency**: The script that's supposed to create this function (`apply-consolidated-rls.js`) has a circular dependency - it tries to use the `exec_sql` function to create itself.

## Root Cause Analysis

The `apply-consolidated-rls.js` script attempts to:
1. Connect to Supabase
2. Execute SQL statements using the `exec_sql` function
3. If the function doesn't exist, create it using... the `exec_sql` function (circular dependency)

This circular dependency causes the script to fail with the error:
```
Failed to connect to Supabase: Could not find the function public.exec_sql(sql_query) in the schema cache
```

## Step-by-Step Solution

### 1. Create the `exec_sql` Function Manually

First, we need to manually create the `exec_sql` function in your Supabase database:

1. **Log in to your Supabase Dashboard**:
   - Go to [https://app.supabase.io/](https://app.supabase.io/)
   - Select your project

2. **Open the SQL Editor**:
   - Click on "SQL Editor" in the left sidebar
   - Create a new query

3. **Execute the following SQL script**:

```sql
-- Create the exec_sql function with proper error handling
BEGIN;

-- Drop the function if it already exists to ensure clean creation
DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

-- Create the exec_sql function with proper error handling
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
-- SECURITY DEFINER means this function runs with the privileges of the user who created it
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  notice_text TEXT;
  notices TEXT[] := '{}'::TEXT[];
BEGIN
  -- Execute the provided SQL query
  EXECUTE sql_query;
  
  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'notices', notices
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Return error information if the query fails
  result := jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
  
  RETURN result;
END;
$$;

-- Grant execute permission to service_role (required for RLS scripts)
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;

-- Grant execute to authenticated users if needed by your application
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;

-- Add function description
COMMENT ON FUNCTION public.exec_sql(TEXT) IS 
  'Executes arbitrary SQL with proper error handling. Used by RLS scripts and migrations.';

COMMIT;
```

4. **Click "Run" to execute the script**

5. **Verify the function was created**:
   - Execute this query to check if the function exists:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'exec_sql';
   ```
   - You should see at least one row in the results

### 2. Apply RLS Policies

Now that the `exec_sql` function is created, you can apply the RLS policies:

1. **Return to your terminal/command line**

2. **Make sure your environment variables are set up correctly**:
   - Verify your `.env` file has the following variables:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

3. **Run the RLS policy application script**:
   ```bash
   npm run db:rls:apply
   # or directly:
   node apply-consolidated-rls.js
   ```

4. **Watch for successful execution**:
   - You should see output indicating policies are being applied
   - The script should complete without errors

### 3. Verify RLS Policies

After applying the policies, verify they are working correctly:

1. **Run the verification script**:
   ```bash
   npm run db:rls:verify
   # or directly:
   node apply-consolidated-rls.js --verify-only
   ```

2. **Check the verification results**:
   - The script will analyze your RLS policies and report on their status
   - Look for "Overall Security Status" in the output
   - Ideally, you should see "SECURE" or at least "MEDIUM RISK"

3. **Address any critical issues**:
   - If the verification reports critical issues, address them before proceeding
   - The report will include specific tables and policies that need attention

## Troubleshooting

### Common Issues

#### 1. "Failed to connect to Supabase" error

**Problem**: The script cannot connect to your Supabase instance.

**Solution**:
- Verify your `SUPABASE_SERVICE_KEY` and `EXPO_PUBLIC_SUPABASE_URL` are correct
- Check your internet connection
- Ensure your Supabase project is active (not paused)

#### 2. "Permission denied" errors

**Problem**: The service role key doesn't have sufficient permissions.

**Solution**:
- Ensure you're using the service role key (not the anon key)
- Check if the key has been rotated recently
- Verify the key has admin privileges

#### 3. "Function exec_sql already exists" error

**Problem**: You're trying to create the function but it already exists with a different signature.

**Solution**:
- Drop the existing function first:
  ```sql
  DROP FUNCTION IF EXISTS public.exec_sql(TEXT);
  ```
- Then recreate it using the script above

## Next Steps After Fix

Once your database setup and RLS policies are working correctly, proceed with these steps:

### 1. Run the Full Test Suite

```bash
npm run test:db:unit
npm run test:ci
```

This will verify that all database-related tests pass with your RLS policies in place.

### 2. Update Database Backup Configuration

Ensure your database has proper backup configuration:

1. Enable Point-in-Time Recovery (PITR) in Supabase:
   - Go to Supabase Dashboard → Settings → Database
   - Enable PITR with a 30-day retention period

2. Verify backup status:
   ```bash
   node scripts/verify_backup_status.js
   ```

### 3. Complete the Production Readiness Checklist

Continue with the remaining items from the production readiness checklist:

- Fix iOS app configuration (enable Hermes, new architecture)
- Complete comprehensive test coverage
- Set up production backend optimizations
- Configure app store assets and metadata
- Prepare for beta testing and submission

## Conclusion

By following these steps, you've fixed the critical database setup issues that were blocking your test suite and CI/CD pipeline. Your database now has proper security policies in place, which is a crucial step toward making your app production-ready.

Remember to regularly run the verification script (`npm run db:rls:verify`) after making database schema changes to ensure your security policies remain effective.

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Database Backup Documentation](./docs/DATABASE_BACKUP.md)
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
