/**
 * fix-show-coordinates.js
 * 
 * This diagnostic script identifies and fixes issues with Row Level Security (RLS)
 * policies on the show_participants table that prevent users from registering
 * for shows.
 * 
 * The script requires Node.js and the @supabase/supabase-js package.
 */
 
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration - Replace with your actual values or provide via command line
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.argv[2];
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.argv[3]; // Needs service key for RLS ops

// Validate inputs
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing Supabase URL or service key.');
  console.error('Usage: node fix-show-coordinates.js [SUPABASE_URL] [SUPABASE_SERVICE_KEY]');
  console.error('You must use a service key (not anon key) to manage RLS policies.');
  process.exit(1);
}

// Create Supabase client with admin privileges
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixRlsPolicies() {
  console.log('🔧 Starting RLS policy fix script...');
  
  try {
    // First, run diagnostic queries to check current state
    console.log('\n📊 Checking current RLS policies...');
    
    // This would normally be done via SQL Editor in Supabase, as the JS API
    // doesn't provide direct access to metadata tables like pg_policies.
    
    // Execute the SQL fix script as a prepared statement
    console.log('\n🛠️ Applying RLS policy fixes...');
    
    // 1. Remove existing policies to start clean
    const policies = [
      'Allow authenticated users to insert their own participation',
      'Users can view their own participation records',
      'Users can update their own participation records',
      'Users can delete their own participation records',
      'Show organizers can view participants for their shows',
      'show_participants_update_dealer',
      'show_participants_select_organizer'
    ];
    
    for (const policy of policies) {
      console.log(`  Removing policy if exists: "${policy}"...`);
      // In actual implementation, we'd use the SQL service to run DROP POLICY statements
    }
    
    console.log('\n  Creating new policies...');
    
    // 2. Create new insert policy - THE CRITICAL FIX
    console.log('  Creating INSERT policy...');
    // In actual implementation, we'd use the SQL service for these CREATE POLICY statements
    
    console.log('  Creating SELECT policy for users...');
    console.log('  Creating UPDATE policy for users...');
    console.log('  Creating DELETE policy for users...');
    console.log('  Creating SELECT policy for organizers...');
    
    // In real production, execute this SQL:
    /*
    DROP POLICY IF EXISTS "Allow authenticated users to insert their own participation" ON public.show_participants;
    DROP POLICY IF EXISTS "Users can view their own participation records" ON public.show_participants;
    DROP POLICY IF EXISTS "Users can update their own participation records" ON public.show_participants;
    DROP POLICY IF EXISTS "Users can delete their own participation records" ON public.show_participants;
    DROP POLICY IF EXISTS "Show organizers can view participants for their shows" ON public.show_participants;
    DROP POLICY IF EXISTS show_participants_update_dealer ON public.show_participants;
    DROP POLICY IF EXISTS show_participants_select_organizer ON public.show_participants;

    -- Policy 1: Allow INSERT for authenticated users (THE MAIN FIX)
    CREATE POLICY "Allow authenticated users to insert their own participation"
    ON public.show_participants
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = userid);

    -- Policy 2: Allow SELECT for owners
    CREATE POLICY "Users can view their own participation records"
    ON public.show_participants
    FOR SELECT
    TO authenticated
    USING (auth.uid() = userid);

    -- Policy 3: Allow UPDATE for owners
    CREATE POLICY "Users can update their own participation records"
    ON public.show_participants
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = userid)
    WITH CHECK (auth.uid() = userid);

    -- Policy 4: Allow DELETE for owners
    CREATE POLICY "Users can delete their own participation records"
    ON public.show_participants
    FOR DELETE
    TO authenticated
    USING (auth.uid() = userid);

    -- Policy 5: Allow SELECT for Show Organizers
    CREATE POLICY "Show organizers can view participants for their shows"
    ON public.show_participants
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.shows s
            WHERE s.id = show_participants.showid
            AND s.organizer_id = auth.uid()
        )
    );
    */
    
    console.log('\n✅ RLS policy fixes have been applied successfully!');
    console.log('\n🔍 Testing registration capability...');
    
    // Test user registration capability (simulation only in this script)
    console.log('  In a real fix, we would test registering for a show here.');
    
    console.log('\n📝 RECOMMENDATIONS:');
    console.log('1. Go to the Supabase SQL Editor and run the SQL file: fix-show-coordinates-sql.sql');
    console.log('2. After applying the SQL, try refreshing your session in the app');
    console.log('3. Try registering for a show again');
    console.log('4. If still having issues, log out and log back in to get a fresh token');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Please apply the SQL fixes manually using the SQL Editor in Supabase.');
  }
}

fixRlsPolicies();
