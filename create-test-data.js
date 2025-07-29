#!/usr/bin/env node
/**
 * Card Show Finder - Test Data Generator
 * 
 * This script creates test data in the scraped_shows_pending table
 * to simulate what the scraper would produce. It bypasses the need
 * for scraping sources and provides sample data to test the admin
 * evaluation system.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Constants
const TEST_SOURCES = [
  'https://www.cardshowcentral.com/shows',
  'https://www.beckett.com/news/category/shows-events/',
  'https://www.sportscollectorsdigest.com/events/',
  'https://cardboardconnection.com/calendar',
  'https://www.cardshow.com/upcoming-shows/'
];

// Supabase configuration
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// Create Supabase client
function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Supabase URL or key not found in environment variables.');
    console.log('Please ensure your .env file contains:');
    console.log('  EXPO_PUBLIC_SUPABASE_URL=your_supabase_url');
    console.log('  SUPABASE_SERVICE_KEY=your_service_key');
    process.exit(1);
  }
  
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

// Generate a future date string (YYYY-MM-DD format)
function generateFutureDate(daysAhead = 30) {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead));
  return date.toISOString().split('T')[0];
}

// Generate test data with varying quality and issues
async function generateTestData() {
  console.log('=== GENERATING TEST DATA FOR ADMIN CLI TESTING ===');
  console.log('This will create sample pending shows with various quality levels and issues.');
  
  const supabase = createSupabaseClient();
  console.log('Connected to Supabase successfully.');
  
  // Sample test data with varying quality and issues
  const testShows = [
    // High quality show (complete data)
    {
      source_url: TEST_SOURCES[0],
      raw_payload: {
        name: '[TEST] Complete Card Show - High Quality',
        startDate: generateFutureDate(14),
        endDate: generateFutureDate(15),
        city: 'Chicago',
        state: 'IL',
        venueName: 'Rosemont Convention Center',
        address: '5555 N. River Rd, Rosemont, IL 60018',
        description: 'This is a test high-quality card show with complete data.',
        admission: '$5.00',
        tableInfo: '8ft tables available for $80',
        website: 'https://example.com/card-show',
        contactEmail: 'organizer@example.com',
        contactPhone: '555-123-4567'
      },
      status: 'PENDING',
      admin_notes: 'Test data - High quality (100/100)'
    },
    
    // Medium quality show (missing some fields)
    {
      source_url: TEST_SOURCES[1],
      raw_payload: {
        name: '[TEST] Partial Card Show - Medium Quality',
        startDate: generateFutureDate(21),
        city: 'Dallas',
        state: 'TX',
        venueName: 'Dallas Event Center',
        // Missing address
        description: 'This is a test medium-quality card show missing some data.',
        admission: '$3.00'
        // Missing other fields
      },
      status: 'PENDING',
      admin_notes: 'Test data - Medium quality (85/100)'
    },
    
    // Low quality show (missing critical fields)
    {
      source_url: TEST_SOURCES[2],
      raw_payload: {
        name: '[TEST] Minimal Card Show - Low Quality',
        // Missing date
        city: 'Atlanta',
        // Missing state
        // Missing venue
        // Missing address
        description: 'This is a test low-quality card show missing critical data.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Low quality (35/100)'
    },
    
    // Show with date format issues
    {
      source_url: TEST_SOURCES[3],
      raw_payload: {
        name: '[TEST] Date Format Issues Show',
        startDate: 'July 15 AL', // Problematic date format
        city: 'Mobile',
        state: 'AL',
        venueName: 'Mobile Convention Center',
        address: '1 Convention Plaza, Mobile, AL 36602',
        description: 'This test show has date format issues.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Date format issue'
    },
    
    // Show with state abbreviation issues
    {
      source_url: TEST_SOURCES[4],
      raw_payload: {
        name: '[TEST] State Format Issues Show',
        startDate: generateFutureDate(7),
        city: 'Miami',
        state: 'Florida', // Full state name instead of abbreviation
        venueName: 'Miami Event Hall',
        address: '123 Beach Blvd, Miami, Florida 33101',
        description: 'This test show has state abbreviation issues.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - State not abbreviated'
    },
    
    // Show with HTML artifacts in description
    {
      source_url: TEST_SOURCES[0],
      raw_payload: {
        name: '[TEST] HTML Artifacts Show',
        startDate: generateFutureDate(28),
        city: 'Boston',
        state: 'MA',
        venueName: 'Boston Exhibition Hall',
        address: '415 Summer St, Boston, MA 02210',
        description: '<p>This test show has HTML artifacts in the description.</p><br/>&nbsp;Contact at <a href="mailto:test@example.com">email</a>'
      },
      status: 'PENDING',
      admin_notes: 'Test data - HTML artifacts in description'
    },
    
    // Potential duplicate #1 (exact name, same date)
    {
      source_url: TEST_SOURCES[1],
      raw_payload: {
        name: '[TEST] Duplicate Sports Card Expo',
        startDate: '2025-08-15',
        city: 'Philadelphia',
        state: 'PA',
        venueName: 'Liberty Convention Center',
        address: '12 Independence Mall, Philadelphia, PA 19106',
        description: 'This is duplicate test show #1 with the same name and date.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Potential duplicate #1'
    },
    
    // Potential duplicate #2 (exact name, same date)
    {
      source_url: TEST_SOURCES[2],
      raw_payload: {
        name: '[TEST] Duplicate Sports Card Expo',
        startDate: '2025-08-15',
        city: 'Philadelphia',
        state: 'PA',
        venueName: 'Liberty Convention Hall', // Slightly different venue
        address: '12 Independence Mall East, Philadelphia, PA 19106', // Slightly different address
        description: 'This is duplicate test show #2 with the same name and date.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Potential duplicate #2'
    },
    
    // Potential duplicate #3 (similar name, same date)
    {
      source_url: TEST_SOURCES[3],
      raw_payload: {
        name: '[TEST] Duplicate Sports Cards Exhibition',
        startDate: '2025-08-15',
        city: 'Philadelphia',
        state: 'PA',
        venueName: 'Liberty Center',
        address: '12 Independence Mall, Philadelphia, PA 19106',
        description: 'This is duplicate test show #3 with a similar name and same date.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Potential duplicate #3 (similar name)'
    },
    
    // Potential duplicate #4 (same name, off-by-one date)
    {
      source_url: TEST_SOURCES[4],
      raw_payload: {
        name: '[TEST] Duplicate Sports Card Expo',
        startDate: '2025-08-16', // One day later
        city: 'Philadelphia',
        state: 'PA',
        venueName: 'Liberty Convention Center',
        address: '12 Independence Mall, Philadelphia, PA 19106',
        description: 'This is duplicate test show #4 with the same name but date off by one day.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Potential duplicate #4 (date off by one day)'
    },
    
    // Show missing venue
    {
      source_url: TEST_SOURCES[0],
      raw_payload: {
        name: '[TEST] Missing Venue Show',
        startDate: generateFutureDate(42),
        city: 'Seattle',
        state: 'WA',
        // Missing venue
        address: '800 Convention Pl, Seattle, WA 98101',
        description: 'This test show is missing venue information.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Missing venue'
    },
    
    // Show with poor address
    {
      source_url: TEST_SOURCES[1],
      raw_payload: {
        name: '[TEST] Poor Address Show',
        startDate: generateFutureDate(35),
        city: 'Denver',
        state: 'CO',
        venueName: 'Denver Sports Complex',
        address: 'Downtown Denver', // Poor/incomplete address
        description: 'This test show has a poor/incomplete address.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Poor address'
    },
    
    // Show with missing city
    {
      source_url: TEST_SOURCES[2],
      raw_payload: {
        name: '[TEST] Missing City Show',
        startDate: generateFutureDate(49),
        // Missing city
        state: 'NV',
        venueName: 'Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        description: 'This test show is missing city information.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Missing city'
    },
    
    // Multi-event collapse issue
    {
      source_url: TEST_SOURCES[3],
      raw_payload: {
        name: '[TEST] Multi-Event Collapse Issue',
        startDate: generateFutureDate(56),
        city: 'San Francisco',
        state: 'CA',
        venueName: 'Moscone Center',
        address: '747 Howard St, San Francisco, CA 94103',
        description: 'This show actually contains multiple events: Card Show on Saturday, Autograph Session on Sunday, Trading Event on Monday. Should be split into separate events.'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Multi-event collapse issue'
    },
    
    // Potential spam
    {
      source_url: TEST_SOURCES[4],
      raw_payload: {
        name: '[TEST] BEST DEALS ON CARDS BUY NOW!!!',
        startDate: generateFutureDate(63),
        city: 'Orlando',
        state: 'FL',
        venueName: 'Orange County Convention Center',
        address: '9800 International Dr, Orlando, FL 32819',
        description: 'AMAZING DEALS!!! BUY DIRECT FROM US!!! 70% OFF ALL CARDS!!! VISIT OUR WEBSITE TO ORDER NOW!!! NOT A REAL SHOW!!!'
      },
      status: 'PENDING',
      admin_notes: 'Test data - Potential spam'
    }
  ];
  
  // Insert test data
  let successCount = 0;
  let errorCount = 0;
  
  for (const show of testShows) {
    try {
      const { error } = await supabase
        .from('scraped_shows_pending')
        .insert({
          source_url: show.source_url,
          raw_payload: show.raw_payload,
          status: show.status,
          admin_notes: show.admin_notes,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`Error inserting show "${show.raw_payload.name}":`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Created: ${show.raw_payload.name}`);
        successCount++;
      }
    } catch (err) {
      console.error(`Exception inserting show "${show.raw_payload.name}":`, err.message);
      errorCount++;
    }
  }
  
  console.log('\n=== TEST DATA GENERATION SUMMARY ===');
  console.log(`Total shows attempted: ${testShows.length}`);
  console.log(`Successfully created: ${successCount}`);
  console.log(`Failed to create: ${errorCount}`);
  
  if (successCount > 0) {
    // Get the IDs of the newly created shows
    const { data: newShows, error } = await supabase
      .from('scraped_shows_pending')
      .select('id, raw_payload->name as name')
      .ilike('raw_payload->>name', '%[TEST]%')
      .order('created_at', { ascending: false })
      .limit(testShows.length);
    
    if (!error && newShows && newShows.length > 0) {
      console.log('\n=== NEWLY CREATED TEST SHOWS ===');
      newShows.forEach((show, index) => {
        console.log(`${index + 1}. UUID: ${show.id}`);
        console.log(`   Name: ${show.name}`);
      });
      
      console.log('\n=== NEXT STEPS ===');
      console.log('1. Run the admin CLI to process these test shows:');
      console.log('   node admin_cli_simple.js');
      console.log('2. Or run the non-interactive test script:');
      console.log('   node test-admin-cli.js');
    }
  }
}

// Run the script
generateTestData().catch(console.error);
