/**
 * Test script to find your specific booth registration with "Star Wars"
 */

const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testSpecificBooth() {
  console.log('🔍 Testing your specific booth registration...');
  
  // Get current user
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    console.log('❌ No authenticated user found');
    return;
  }
  
  const userId = authData.user.id;
  console.log(`👤 User ID: ${userId}`);
  
  // Find shows in Carmel area with "Star Wars" booth content
  console.log('\n1. Finding shows with your booth registrations...');
  
  const { data: booths, error: boothError } = await supabase
    .from('show_participants')
    .select(`
      *,
      shows!inner (
        id,
        title,
        location,
        address,
        start_date,
        end_date,
        status,
        coordinates
      )
    `)
    .eq('userid', userId)
    .ilike('notable_items', '%Star Wars%');
  
  if (boothError) {
    console.error('❌ Error fetching booths:', boothError);
    return;
  }
  
  console.log(`🏪 Found ${booths.length} booth registrations with "Star Wars" in notable_items:`);
  
  if (booths.length === 0) {
    // Check ALL your registrations
    console.log('\n2. Checking ALL your booth registrations...');
    const { data: allBooths } = await supabase
      .from('show_participants')
      .select(`
        *,
        shows!inner (
          id,
          title,
          location,
          address,
          start_date,
          end_date,
          status,
          coordinates
        )
      `)
      .eq('userid', userId);
    
    console.log(`📋 Your total registrations: ${allBooths?.length || 0}`);
    allBooths?.forEach((booth, i) => {
      console.log(`  ${i + 1}. Show: ${booth.shows.title}`);
      console.log(`     Location: ${booth.shows.location}`);
      console.log(`     Date: ${booth.shows.start_date}`);
      console.log(`     Status: ${booth.shows.status}`);
      console.log(`     Notable Items: "${booth.notable_items}"`);
      console.log('');
    });
    
    console.log('❗ No registrations found with "Star Wars" in notable_items field.');
    console.log('   Please check if you saved your booth info correctly.');
    return;
  }
  
  // Analyze each matching booth
  booths.forEach((booth, i) => {
    const show = booth.shows;
    console.log(`\n  ${i + 1}. Show: ${show.title}`);
    console.log(`     📍 Location: ${show.location}`);
    console.log(`     📅 Date: ${show.start_date} - ${show.end_date}`);
    console.log(`     🏷️  Status: ${show.status}`);
    console.log(`     🎯 Notable Items: "${booth.notable_items}"`);
    console.log(`     🎪 Specialty: "${booth.specialty}"`);
    console.log(`     🃏 Card Types: "${booth.card_types}"`);
    
    // Check if coordinates exist
    if (show.coordinates) {
      console.log(`     🗺️  Coordinates: ${JSON.stringify(show.coordinates)}`);
    } else {
      console.log(`     ❌ No coordinates for this show`);
    }
  });
  
  // Test search function with this specific show
  if (booths.length > 0) {
    const targetShow = booths[0].shows;
    console.log(`\n3. Testing search function for "${targetShow.title}"...`);
    
    const testParams = {
      lat: 40.0772001,
      lng: -85.925938,
      radius_miles: 50, // Increase radius to be safe
      start_date: '2025-09-01', // Expand date range
      end_date: '2025-12-31',
      max_entry_fee: null,
      categories: null,
      features: null,
      keyword: 'Star Wars',
      dealer_card_types: null,
      page_size: 20,
      page: 1
    };
    
    const { data: searchResult, error: searchError } = await supabase.rpc('search_shows_advanced', {
      search_params: testParams
    });
    
    if (searchError) {
      console.error('❌ Search error:', searchError);
    } else {
      console.log(`🔍 Search results: ${searchResult.pagination.total_count} shows found`);
      
      const foundTargetShow = searchResult.data.find(s => s.id === targetShow.id);
      if (foundTargetShow) {
        console.log('✅ Your show WAS found in search results!');
      } else {
        console.log('❌ Your show was NOT found in search results');
        console.log('   This suggests a bug in the search function logic');
      }
    }
  }
  
  console.log('\n✅ Test complete!');
}

testSpecificBooth();