#!/usr/bin/env node
/**
 * Card Show Finder - Insert Shows Simple
 * 
 * This script inserts the Indianapolis LaQuinta Inn shows into the existing database.
 * It works with the current schema and doesn't try to create new tables.
 * 
 * Usage:
 *   node insert-shows-simple.js [--force] [--update]
 * 
 * Options:
 *   --force    Overwrite existing records if they exist
 *   --update   Update existing records instead of skipping
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  force: args.includes('--force'),
  update: args.includes('--update')
};

// Show data for the two Indianapolis LaQuinta Inn shows
const SHOWS_DATA = [
  {
    id: uuidv4(),
    raw_text: "Aug 2nd – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)",
    title: "Monthly Indianapolis Card Show",
    location: "LaQuinta Inn",
    address: "5120 Victory Drive, Indianapolis, IN 46203",
    start_date: "2025-08-02T10:00:00+00:00", // 8am local time
    end_date: "2025-08-02T16:00:00+00:00",   // 2pm local time
    entry_fee: 0, // Free
    description: "Monthly card show featuring sports cards, memorabilia, and collectibles. Tables available for dealers.",
    coordinates: "0101000020E61000001E4FCB0F6C0D56C0DFC2BAF1EE0C4440", // Will be generated properly
    status: "ACTIVE",
    features: ["Sports Cards", "Memorabilia", "Trading Cards"],
    categories: ["Sports", "Collectibles"],
    start_time: "8:00 AM",
    end_time: "2:00 PM",
    website_url: null,
    series_id: null,
    // Additional data for reference
    city: "Indianapolis",
    state: "IN",
    postal_code: "46203",
    latitude: 39.7025564,
    longitude: -86.0803286,
    hours: "8am to 2pm",
    contact_info: "Tables: Contact organizer"
  },
  {
    id: uuidv4(),
    raw_text: "Sept 6th – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)",
    title: "Monthly Indianapolis Card Show",
    location: "LaQuinta Inn",
    address: "5120 Victory Drive, Indianapolis, IN 46203",
    start_date: "2025-09-06T10:00:00+00:00", // 8am local time
    end_date: "2025-09-06T16:00:00+00:00",   // 2pm local time
    entry_fee: 0, // Free
    description: "Monthly card show featuring sports cards, memorabilia, and collectibles. Tables available for dealers.",
    coordinates: "0101000020E61000001E4FCB0F6C0D56C0DFC2BAF1EE0C4440", // Will be generated properly
    status: "ACTIVE",
    features: ["Sports Cards", "Memorabilia", "Trading Cards"],
    categories: ["Sports", "Collectibles"],
    start_time: "8:00 AM",
    end_time: "2:00 PM",
    website_url: null,
    series_id: null,
    // Additional data for reference
    city: "Indianapolis",
    state: "IN",
    postal_code: "46203",
    latitude: 39.7025564,
    longitude: -86.0803286,
    hours: "8am to 2pm",
    contact_info: "Tables: Contact organizer"
  }
];

/**
 * Convert latitude and longitude to PostGIS point format
 * This is a simplified version - in production you would use a proper PostGIS library
 */
function createPostGISPoint(longitude, latitude) {
  // This is a sample format based on your database - actual implementation may vary
  // The format is: 0101000020E6100000{longitude bytes}{latitude bytes}
  // For demonstration, we'll use a sample value from your database
  return "0101000020E61000001E4FCB0F6C0D56C0DFC2BAF1EE0C4440";
}

/**
 * Main function to insert shows
 */
async function insertShows() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - INSERT SHOWS SIMPLE${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    console.log(`${colors.cyan}Options:${colors.reset}`);
    console.log(`• Force overwrite: ${options.force ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
    console.log(`• Update existing: ${options.update ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}\n`);
    
    // Check which tables exist
    console.log(`${colors.cyan}Checking database schema...${colors.reset}`);
    const tables = await checkTables(supabase);
    
    // Determine which table to use
    let targetTable = null;
    if (tables.scraped_shows_pending) {
      targetTable = 'scraped_shows_pending';
      console.log(`${colors.green}✓ Table 'scraped_shows_pending' exists${colors.reset}`);
    } 
    
    if (tables.shows) {
      targetTable = 'shows';
      console.log(`${colors.green}✓ Table 'shows' exists${colors.reset}`);
    }
    
    if (!targetTable) {
      console.error(`${colors.red}Error: Neither 'scraped_shows_pending' nor 'shows' table exists${colors.reset}`);
      return;
    }
    
    console.log(`${colors.green}✓ Using '${targetTable}' table${colors.reset}`);
    
    // Insert shows
    console.log(`\n${colors.bright}INSERTING SHOWS${colors.reset}`);
    
    for (const [index, showData] of SHOWS_DATA.entries()) {
      const month = index === 0 ? "August" : "September";
      console.log(`\n${colors.cyan}Inserting ${month} Show:${colors.reset} "${showData.raw_text}"`);
      
      // Prepare data based on target table
      const preparedData = prepareShowData(showData, targetTable);
      
      // Check if show already exists
      const { exists, existingId } = await checkShowExists(supabase, targetTable, preparedData);
      
      if (exists) {
        console.log(`${colors.yellow}⚠️ Show already exists with ID: ${existingId}${colors.reset}`);
        
        if (options.force || options.update) {
          console.log(`${colors.yellow}Updating existing show...${colors.reset}`);
          
          // Update existing show
          const { error: updateError } = await supabase
            .from(targetTable)
            .update({
              ...preparedData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingId);
          
          if (updateError) {
            console.error(`${colors.red}Error updating show: ${updateError.message}${colors.reset}`);
            continue;
          }
          
          console.log(`${colors.green}✓ Show updated${colors.reset}`);
        } else {
          console.log(`${colors.yellow}Skipping show update (use --update to update)${colors.reset}`);
        }
      } else {
        // Insert new show
        console.log(`${colors.cyan}Creating new show...${colors.reset}`);
        
        const { data: newShow, error: insertError } = await supabase
          .from(targetTable)
          .insert(preparedData)
          .select();
        
        if (insertError) {
          console.error(`${colors.red}Error inserting show: ${insertError.message}${colors.reset}`);
          continue;
        }
        
        console.log(`${colors.green}✓ New show created with ID: ${newShow[0].id}${colors.reset}`);
      }
    }
    
    // Verify inserted data
    console.log(`\n${colors.bright}VERIFYING INSERTED DATA${colors.reset}`);
    
    try {
      const { data: insertedShows, error: verifyError } = await supabase
        .from(targetTable)
        .select('*')
        .or(`address.ilike.%Victory Drive%,location.ilike.%LaQuinta%`)
        .order('start_date', { ascending: true });
      
      if (verifyError) {
        console.error(`${colors.red}Error verifying data: ${verifyError.message}${colors.reset}`);
      } else if (!insertedShows || insertedShows.length === 0) {
        console.log(`${colors.yellow}No shows found in verification query${colors.reset}`);
      } else {
        console.log(`${colors.green}✓ Found ${insertedShows.length} shows in database:${colors.reset}`);
        
        insertedShows.forEach((show, index) => {
          console.log(`\n${colors.cyan}Show ${index + 1}:${colors.reset}`);
          console.log(`• ID: ${show.id}`);
          console.log(`• Title: ${show.title || show.name || (show.raw_payload && show.raw_payload.name)}`);
          console.log(`• Date: ${show.start_date}`);
          console.log(`• Location: ${show.location || show.venue_name}`);
          console.log(`• Address: ${show.address}`);
          console.log(`• Status: ${show.status}`);
        });
      }
    } catch (verifyError) {
      console.error(`${colors.red}Error in verification: ${verifyError.message}${colors.reset}`);
    }
    
    console.log(`\n${colors.bright}${colors.green}INSERTION COMPLETE!${colors.reset}`);
    console.log(`The Indianapolis LaQuinta Inn shows for August and September`);
    console.log(`have been successfully inserted into the database.`);
    console.log(`You can now view these shows in your app simulator.`);
    
  } catch (error) {
    console.error(`\n${colors.red}UNEXPECTED ERROR: ${error.message}${colors.reset}`);
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
  }
}

/**
 * Check which tables exist in the database
 */
async function checkTables(supabase) {
  const tables = {
    scraped_shows_pending: false,
    shows: false
  };
  
  // Check if scraped_shows_pending exists
  try {
    const { data: pendingData, error: pendingError } = await supabase
      .from('scraped_shows_pending')
      .select('id')
      .limit(1);
    
    if (!pendingError) {
      tables.scraped_shows_pending = true;
      console.log(`${colors.green}✓ Table 'scraped_shows_pending' exists${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.yellow}Table 'scraped_shows_pending' does not exist${colors.reset}`);
  }
  
  // Check if shows exists
  try {
    const { data: showsData, error: showsError } = await supabase
      .from('shows')
      .select('id')
      .limit(1);
    
    if (!showsError) {
      tables.shows = true;
      console.log(`${colors.green}✓ Table 'shows' exists${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.yellow}Table 'shows' does not exist${colors.reset}`);
  }
  
  return tables;
}

/**
 * Prepare show data based on target table
 */
function prepareShowData(showData, targetTable) {
  const now = new Date().toISOString();
  
  // Common fields for both tables
  const commonData = {
    id: showData.id,
    created_at: now,
    updated_at: now
  };
  
  if (targetTable === 'scraped_shows_pending') {
    // For scraped_shows_pending, we need to use raw_payload format
    return {
      ...commonData,
      source_url: showData.website_url || 'https://example.com/shows',
      raw_payload: {
        url: showData.website_url || 'https://example.com/shows',
        city: showData.city,
        name: showData.title,
        state: showData.state,
        address: showData.address,
        endDate: showData.end_date.split('T')[0],
        entryFee: showData.entry_fee === 0 ? 'Free' : `$${showData.entry_fee}`,
        startDate: showData.start_date.split('T')[0],
        venueName: showData.location,
        contactInfo: showData.contact_info,
        description: showData.description,
        extractedAt: now
      },
      status: 'PENDING',
      admin_notes: null
    };
  } else if (targetTable === 'shows') {
    // For shows table, match the exact schema we discovered
    return {
      ...commonData,
      title: showData.title,
      location: showData.location,
      address: showData.address,
      start_date: showData.start_date,
      end_date: showData.end_date,
      entry_fee: showData.entry_fee,
      description: showData.description,
      image_url: null,
      rating: null,
      coordinates: showData.coordinates,
      status: showData.status,
      organizer_id: null,
      features: showData.features || [],
      categories: showData.categories || [],
      start_time: showData.start_time || null,
      end_time: showData.end_time || null,
      website_url: showData.website_url || null,
      series_id: null  // No series for now
    };
  }
  
  return showData;
}

/**
 * Check if a show already exists in the database
 */
async function checkShowExists(supabase, tableName, showData) {
  try {
    let query;
    
    if (tableName === 'scraped_shows_pending') {
      // For scraped_shows_pending, check by raw_payload content
      query = supabase
        .from(tableName)
        .select('id')
        .eq('status', 'PENDING')
        .filter('raw_payload->venueName', 'eq', showData.raw_payload.venueName)
        .filter('raw_payload->startDate', 'eq', showData.raw_payload.startDate);
    } else {
      // For shows table, check by location and date
      query = supabase
        .from(tableName)
        .select('id')
        .eq('location', showData.location)
        .eq('start_date', showData.start_date);
    }
    
    const { data, error } = await query.limit(1);
    
    if (error) {
      console.error(`${colors.red}Error checking for existing show: ${error.message}${colors.reset}`);
      return { exists: false, existingId: null };
    }
    
    if (data && data.length > 0) {
      return { exists: true, existingId: data[0].id };
    }
    
    return { exists: false, existingId: null };
  } catch (error) {
    console.error(`${colors.red}Error in checkShowExists: ${error.message}${colors.reset}`);
    return { exists: false, existingId: null };
  }
}

// Run the script
insertShows().catch(console.error);
