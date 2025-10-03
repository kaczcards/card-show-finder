/**
 * Debug script to check what's happening with the search_shows_advanced function
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Please ensure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugSearchFunction() {
  console.log('🔍 Debugging search_shows_advanced function...');
  
  // Test 1: Check if the function exists
  console.log('\n1. Testing if search_shows_advanced function exists...');
  
  try {
    const testParams = {
      lat: null,
      lng: null,
      radius_miles: 25,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      max_entry_fee: null,
      categories: null,
      features: null,
      keyword: null,
      dealer_card_types: null,
      page_size: 20,
      page: 1,
      status: 'ACTIVE'
    };

    console.log('📋 Test parameters:', testParams);
    
    const { data, error } = await supabase.rpc('search_shows_advanced', {
      search_params: testParams
    });
    
    console.log('🔍 RPC Response:');
    console.log('- Error:', error);
    console.log('- Data type:', typeof data);
    console.log('- Data value:', data);
    
    if (data) {
      console.log('- Data keys:', Object.keys(data || {}));
      console.log('- Data.data type:', typeof data.data);
      console.log('- Data.data:', data.data);
      console.log('- Data.pagination:', data.pagination);
    }
    
    if (error) {
      console.log('❌ RPC Function error details:');
      console.log('- Code:', error.code);
      console.log('- Message:', error.message);
      console.log('- Details:', error.details);
      console.log('- Hint:', error.hint);
    }
    
  } catch (err) {
    console.error('❌ Exception calling RPC function:', err);
  }
  
  // Test 2: Check what functions exist in the database
  console.log('\n2. Checking what search/show-related functions exist...');
  
  try {
    const { data: functions, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .ilike('routine_name', '%show%')
      .eq('routine_schema', 'public');
    
    if (funcError) {
      console.log('⚠️ Could not check functions:', funcError);
    } else {
      console.log('📋 Available show-related functions:');
      functions.forEach(func => {
        console.log(`- ${func.routine_name} (${func.routine_type})`);
      });
    }
  } catch (err) {
    console.log('⚠️ Could not check functions:', err.message);
  }
  
  // Test 3: Try a simple search with keyword
  console.log('\n3. Testing search with "Star Wars" keyword...');
  
  try {
    const starWarsParams = {
      lat: null,
      lng: null,
      radius_miles: 25,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      max_entry_fee: null,
      categories: null,
      features: null,
      keyword: 'Star Wars',
      dealer_card_types: null,
      page_size: 20,
      page: 1,
      status: 'ACTIVE'
    };

    const { data: starWarsData, error: starWarsError } = await supabase.rpc('search_shows_advanced', {
      search_params: starWarsParams
    });
    
    console.log('🌟 Star Wars search results:');
    console.log('- Error:', starWarsError);
    console.log('- Data:', starWarsData);
    
    if (starWarsData && starWarsData.data) {
      console.log(`- Found ${starWarsData.data.length} shows`);
      starWarsData.data.forEach((show, index) => {
        console.log(`  ${index + 1}. ${show.title} - ${show.location}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Exception with Star Wars search:', err);
  }
  
  console.log('\n✅ Debug complete!');
}

console.log('🚀 Starting search function debug...');
debugSearchFunction();