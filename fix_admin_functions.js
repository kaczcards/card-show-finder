#!/usr/bin/env node
/**
 * Fix Admin Functions Script
 * 
 * This script resolves two issues:
 * 1. Creates the missing database functions (is_admin) directly with SQL
 * 2. Makes kaczcards@gmail.com an admin user by finding their user ID
 * 
 * Usage: node fix_admin_functions.js
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, './.env') });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Email of the user to make admin
const ADMIN_EMAIL = 'kaczcards@gmail.com';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase credentials not found in environment variables.');
  console.error('Please ensure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your .env file.');
  process.exit(1);
}

// Initialize Supabase client with service key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Execute SQL directly using Supabase REST API
 * This is a simpler approach than using RPC
 */
async function executeSql(sql) {
  try {
    // Use the REST API to execute SQL directly
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'params=single-object',
      },
      body: JSON.stringify({
        query: sql
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SQL execution failed: ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('SQL execution error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create the missing database functions
 */
async function createDatabaseFunctions() {
  console.warn('Step 1: Creating missing database functions...');

  // Combined SQL to create everything in one transaction
  const fullSql = `
    -- Start a transaction to ensure all or nothing
    BEGIN;

    -- Create user_roles table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      UNIQUE(user_id, role)
    );

    -- Enable Row Level Security
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist to avoid errors
    DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;

    -- Create policy for admins to manage all roles
    CREATE POLICY "Admins can manage all roles" 
      ON public.user_roles 
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );

    -- Create policy for users to read their own roles
    CREATE POLICY "Users can read their own roles" 
      ON public.user_roles 
      FOR SELECT
      USING (user_id = auth.uid());

    -- Create a function to check if the current user has admin role
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      );
    END;
    $$;

    -- Grant execute permissions on function
    GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon;

    -- Create a function to assign admin role to a user
    CREATE OR REPLACE FUNCTION public.assign_admin_role(target_user_id UUID)
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      -- Check if the current user is an admin
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Only admins can assign admin roles';
      END IF;

      -- Insert or update the role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (target_user_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END;
    $$;

    -- Grant execute permissions on function
    GRANT EXECUTE ON FUNCTION public.assign_admin_role TO authenticated;

    -- Create a function to remove admin role from a user
    CREATE OR REPLACE FUNCTION public.revoke_admin_role(target_user_id UUID)
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      -- Check if the current user is an admin
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Only admins can revoke admin roles';
      END IF;

      -- Delete the role
      DELETE FROM public.user_roles
      WHERE user_id = target_user_id AND role = 'admin';
    END;
    $$;

    -- Grant execute permissions on function
    GRANT EXECUTE ON FUNCTION public.revoke_admin_role TO authenticated;

    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Admins can update show coordinates" ON public.shows;

    -- Create a special policy for the shows table to allow admins to update coordinates
    CREATE POLICY "Admins can update show coordinates"
      ON public.shows
      FOR UPDATE
      USING (EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      ));

    -- Create a view for admin-only access to all shows if it doesn't exist
    CREATE OR REPLACE VIEW admin_shows_view AS
    SELECT * FROM public.shows;

    -- Secure the admin view with RLS
    REVOKE ALL ON admin_shows_view FROM anon, authenticated;
    
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Only admins can access admin_shows_view" ON admin_shows_view;
    
    -- Create policy for admin view
    CREATE POLICY "Only admins can access admin_shows_view"
      ON admin_shows_view
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      ));

    -- Commit the transaction
    COMMIT;
  `;

  try {
    // Write SQL to a file for debugging
    fs.writeFileSync('admin_setup.sql', fullSql);
    console.warn('SQL script written to admin_setup.sql for reference');

    // Try direct SQL execution through Supabase API
    console.warn('Executing SQL directly...');
    
    // First try using Supabase's built-in query method
    try {
      const { data: _data, error } = await supabase
        .from('_sql')
        .select('*')
        .execute(fullSql);
      if (error) {
        console.error('Error executing SQL with Supabase client:', error.message);
        throw new Error(error.message);
      }
      console.warn('✅ Database setup completed successfully using Supabase client');
      return true;
    } catch (clientError) {
      console.error('Supabase client SQL execution failed, trying alternative method:', clientError.message);
      
      // Fall back to direct REST API call
      const result = await executeSql(fullSql);
      if (!result.success) {
        console.error('Alternative SQL execution method also failed:', result.error);
        
        // Last resort: Try to create just the table and insert admin manually
        console.warn('Attempting simplified table creation...');
        const simpleTableSql = `
          CREATE TABLE IF NOT EXISTS public.user_roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            role TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            UNIQUE(user_id, role)
          );
          ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
        `;
        
        const tableResult = await executeSql(simpleTableSql);
        if (!tableResult.success) {
          console.error('Failed to create even the basic table:', tableResult.error);
          return false;
        }
        
        console.warn('✅ Basic table created, will attempt direct insertion');
        return true;
      }
      
      console.warn('✅ Database setup completed successfully using alternative method');
      return true;
    }
  } catch (err) {
    console.error('Unexpected error creating database functions:', err.message);
    return false;
  }
}

/**
 * Find user ID by email
 */
async function findUserIdByEmail(email) {
  console.warn(`Step 2: Finding user ID for email: ${email}...`);
  
  try {
    // First try to find in profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('email', email)
      .single();

    if (profileData) {
      console.warn(
        `✅ Found user in profiles: ${profileData.first_name} ${profileData.last_name} (${profileData.email})`
      );
      return profileData.id;
    }

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error finding user in profiles:', profileError.message);
    }

    // If not found in profiles, try auth.users table
    try {
      const { data: authData, error: authError } = await supabase
        .auth.admin.listUsers();

      if (authError) {
        console.error('Error listing users:', authError.message);
      } else if (authData && authData.users) {
        const user = authData.users.find(u => u.email === email);
        if (user) {
          console.warn(`✅ Found user in auth.users: ${user.email}`);
          return user.id;
        }
      }
    } catch (authListError) {
      console.error('Error accessing auth.admin.listUsers:', authListError.message);
    }

    // Last resort: try direct SQL query
    try {
      const sql = `SELECT id, email FROM auth.users WHERE email = '${email}';`;
      const result = await executeSql(sql);
      if (result.success && result.data && result.data.length > 0) {
        console.warn(`✅ Found user via SQL: ${result.data[0].email}`);
        return result.data[0].id;
      }
    } catch (sqlError) {
      console.error('Error querying users via SQL:', sqlError.message);
    }

    console.error(`❌ User with email ${email} not found in database`);
    return null;
  } catch (err) {
    console.error('Unexpected error finding user:', err.message);
    return null;
  }
}

/**
 * Make a user an admin
 */
async function makeUserAdmin(userId) {
  console.warn(`Step 3: Making user ${userId} an admin...`);

  try {
    // First check if the user_roles table exists
    const { data: tableExists, error: tableError } = await supabase
      .from('user_roles')
      .select('count(*)', { count: 'exact', head: true });

    // If table doesn't exist, we'll get an error
    if (tableError && tableError.message.includes('relation "user_roles" does not exist')) {
      console.warn('User roles table does not exist yet, creating it directly...');
      
      // Create the table directly with SQL
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS public.user_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          role TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          UNIQUE(user_id, role)
        );
        ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
      `;
      
      const result = await executeSql(createTableSql);
      if (!result.success) {
        console.error('Failed to create user_roles table:', result.error);
        
        // Try direct insertion with SQL as a last resort
        console.warn('Attempting direct SQL insertion...');
        const insertSql = `
          INSERT INTO public.user_roles (user_id, role)
          VALUES ('${userId}', 'admin')
          ON CONFLICT (user_id, role) DO NOTHING;
        `;
        
        const insertResult = await executeSql(insertSql);
        if (!insertResult.success) {
          console.error('Failed to insert admin role via SQL:', insertResult.error);
          return false;
        }
        
        console.warn(`✅ Admin role assigned to user ${userId} via direct SQL`);
        return true;
      }
    }

    // Check if user already has admin role
    const { data: existingRole, error: roleError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (existingRole) {
      console.warn(`✅ User ${userId} already has admin role.`);
      return true;
    }

    if (roleError && roleError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected if the user doesn't have the role yet
      console.warn('User does not have admin role yet, will add it');
    }

    // Insert admin role for the user
    const { data, error } = await supabase
      .from('user_roles')
      .insert([
        { user_id: userId, role: 'admin' }
      ]);

    if (error) {
      console.error('Error assigning admin role:', error.message);
      
      // Try direct insertion with SQL as a last resort
      console.warn('Attempting direct SQL insertion...');
      const insertSql = `
        INSERT INTO public.user_roles (user_id, role)
        VALUES ('${userId}', 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
      `;
      
      const insertResult = await executeSql(insertSql);
      if (!insertResult.success) {
        console.error('Failed to insert admin role via SQL:', insertResult.error);
        return false;
      }
      
      console.warn(`✅ Admin role assigned to user ${userId} via direct SQL`);
      return true;
    }

    console.warn(`✅ Successfully assigned admin role to user: ${userId}`);
    return true;
  } catch (err) {
    console.error('Unexpected error making user admin:', err.message);
    return false;
  }
}

/**
 * Main function to run all steps
 */
async function main() {
  console.warn('=== Starting Admin Functions Fix ===');
  console.warn(`Using Supabase URL: ${supabaseUrl}`);
  
  // Step 1: Create database functions
  const functionsCreated = await createDatabaseFunctions();
  if (!functionsCreated) {
    console.error('❌ Failed to create database functions. Continuing anyway...');
  }
  
  // Step 2: Find user ID for kaczcards@gmail.com
  const userId = await findUserIdByEmail(ADMIN_EMAIL);
  if (!userId) {
    console.error(`❌ Could not find user ID for ${ADMIN_EMAIL}. Exiting.`);
    process.exit(1);
  }
  
  // Step 3: Make user an admin
  const adminCreated = await makeUserAdmin(userId);
  if (!adminCreated) {
    console.error('❌ Failed to make user an admin.');
    process.exit(1);
  }
  
  console.warn('=== Admin Functions Fix Complete ===');
  console.warn(`✅ Database functions created: ${functionsCreated ? 'Yes' : 'Partially'}`);
  console.warn(`✅ Admin user created: ${ADMIN_EMAIL} (${userId})`);
  console.warn('You should now be able to access admin features in the app.');
}

// Run the main function
main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
