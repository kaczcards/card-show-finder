/**
 * Debug script to find out why "Star Wars" search is returning 0 results
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugStarWarsSearch() {
  console.log('🔍 Debugging "Star Wars" search...');
  console.log('=================================');
  
  // Step 1: Check if there are any shows at all
  console.log('\n1. Checking total shows in database...');
  const { data: allShows, error: showsError } = await supabase
    .from('shows')
    .select('id, title, status, start_date')
    .order('start_date', { ascending: false });
  
  if (showsError) {
    console.error('❌ Error fetching shows:', showsError);
    return;
  }
  
  console.log(`📊 Total shows in database: ${allShows.length}`);
  console.log('📅 Recent shows:');
  allShows.slice(0, 5).forEach((show, i) => {
    console.log(`  ${i + 1}. ${show.title} - ${show.status} - ${show.start_date}`);
  });
  
  // Step 2: Check if you (as MVP dealer) are registered for any shows
  console.log('\n2. Checking your show registrations...');
  const { data: currentUser } = await supabase.auth.getUser();
  let userId = null;
  
  if (currentUser?.user) {
    userId = currentUser.user.id;
    console.log(`👤 Current user ID: ${userId}`);
    
    const { data: registrations, error: regError } = await supabase
      .from('show_participants')
      .select(`
        id,
        showid,
        specialty,
        notable_items,
        card_types,
        shows (
          title,
          start_date,
          status
        )
      `)
      .eq('userid', userId);
    
    if (regError) {
      console.error('❌ Error fetching registrations:', regError);
    } else {
      console.log(`📋 Your show registrations: ${registrations.length}`);
      registrations.forEach((reg, i) => {
        console.log(`  ${i + 1}. ${reg.shows?.title} - ${reg.shows?.start_date}`);
        console.log(`     Specialty: "${reg.specialty}"`);
        console.log(`     Notable Items: "${reg.notable_items}"`);
        console.log(`     Card Types: "${reg.card_types}"`);
      });
    }
  }
  
  // Step 3: Search for shows containing "Star Wars" in titles/descriptions
  console.log('\n3. Checking shows with "Star Wars" in title/description...');
  const { data: titleMatches, error: titleError } = await supabase
    .from('shows')
    .select('id, title, description')
    .or('title.ilike.%Star Wars%,description.ilike.%Star Wars%');
  
  if (titleError) {
    console.error('❌ Error searching titles:', titleError);
  } else {
    console.log(`🎬 Shows with "Star Wars" in title/description: ${titleMatches.length}`);
    titleMatches.forEach((show, i) => {
      console.log(`  ${i + 1}. ${show.title}`);
    });
  }
  
  // Step 4: Check show_participants for "Star Wars"
  console.log('\n4. Checking dealer booth info for "Star Wars"...');
  const { data: boothMatches, error: boothError } = await supabase
    .from('show_participants')
    .select(`
      id,
      userid,
      showid,
      specialty,
      notable_items,
      card_types,
      shows (
        title,
        start_date,
        status
      )
    `)
    .or('specialty.ilike.%Star Wars%,notable_items.ilike.%Star Wars%,card_types.ilike.%Star Wars%');
  
  if (boothError) {
    console.error('❌ Error searching booth info:', boothError);
  } else {
    console.log(`🏪 Dealer booths with "Star Wars": ${boothMatches.length}`);
    boothMatches.forEach((booth, i) => {
      console.log(`  ${i + 1}. Show: ${booth.shows?.title} - ${booth.shows?.start_date}`);
      console.log(`     Dealer: ${booth.userid}`);
      console.log(`     Specialty: "${booth.specialty}"`);
      console.log(`     Notable Items: "${booth.notable_items}"`);
      console.log(`     Card Types: "${booth.card_types}"`);
    });
  }
  
  // Step 5: Test the search function directly
  console.log('\n5. Testing search_shows_advanced function directly...');
  const searchParams = {
    lat: 40.0772001,
    lng: -85.925938,
    radius_miles: 25,
    start_date: '2025-09-24',
    end_date: '2025-10-24',
    max_entry_fee: null,
    categories: null,
    features: null,
    keyword: 'Star Wars',
    dealer_card_types: null,
    page_size: 20,
    page: 1,
    status: 'ACTIVE'
  };
  
  console.log('🔍 Search parameters:', searchParams);
  
  const { data: searchResults, error: searchError } = await supabase.rpc('search_shows_advanced', {
    search_params: searchParams
  });
  
  if (searchError) {
    console.error('❌ Search function error:', searchError);
  } else {
    console.log('🔍 Search function results:');
    console.log(`- Total shows found: ${searchResults?.pagination?.total_count || 0}`);
    console.log(`- Shows returned: ${searchResults?.data?.length || 0}`);
    
    if (searchResults?.data?.length > 0) {
      searchResults.data.forEach((show, i) => {
        console.log(`  ${i + 1}. ${show.title} - ${show.location}`);
      });
    }
    
    if (searchResults?.error) {
      console.log('❌ Function returned error:', searchResults.error);
    }
  }
  
  // Step 6: Try search without location filter
  console.log('\n6. Testing search without location filter...');
  const globalSearchParams = {
    ...searchParams,
    lat: null,
    lng: null,
    radius_miles: null
  };
  
  const { data: globalResults, error: globalError } = await supabase.rpc('search_shows_advanced', {
    search_params: globalSearchParams
  });
  
  if (globalError) {
    console.error('❌ Global search error:', globalError);
  } else {
    console.log(`🌍 Global search results: ${globalResults?.pagination?.total_count || 0} shows`);
    if (globalResults?.data?.length > 0) {
      globalResults.data.slice(0, 3).forEach((show, i) => {
        console.log(`  ${i + 1}. ${show.title} - ${show.location}`);
      });
    }
  }
  
  console.log('\n✅ Debug complete!');
  console.log('\n🔧 Next steps:');
  console.log('1. If you see your booth registration above with "Star Wars", the data exists');
  console.log('2. If the search function returns 0 results, there may be a query issue');
  console.log('3. Check if your show is within the date range (2025-09-24 to 2025-10-24)');
  console.log('4. Check if your show status is "active" or "upcoming"');
}

console.log('🚀 Starting Star Wars search debug...');
debugStarWarsSearch();