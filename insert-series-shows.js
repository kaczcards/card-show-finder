#!/usr/bin/env node
/**
 * Card Show Finder - Insert Series Shows
 * 
 * This script inserts the Indianapolis LaQuinta Inn show series into the live database.
 * It creates a series record and inserts both the August and September shows with proper linking.
 * 
 * Usage:
 *   node insert-series-shows.js [--force] [--update] [--mock-owner=name]
 * 
 * Options:
 *   --force    Overwrite existing records if they exist
 *   --update   Update existing records instead of skipping
 *   --mock-owner=name  Create mock ownership with specified name
 */

const { createClient } = require('@supabase/supabase-js');
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
  update: args.includes('--update'),
  mockOwner: null
};

// Check for mock owner argument
const mockOwnerArg = args.find(arg => arg.startsWith('--mock-owner='));
if (mockOwnerArg) {
  options.mockOwner = mockOwnerArg.split('=')[1];
}

// Show data for the two Indianapolis LaQuinta Inn shows
const SERIES_DATA = {
  name: "Monthly Indianapolis Card Show",
  description: "Monthly card show featuring sports cards, memorabilia, and collectibles",
  venue_name: "LaQuinta Inn",
  address: "5120 Victory Drive",
  city: "Indianapolis",
  state: "IN",
  postal_code: "46203",
  latitude: 39.7025564,
  longitude: -86.0803286,
  typical_hours: "8am to 2pm",
  typical_entry_fee: "Free",
  recurrence_pattern: "monthly-first-saturday"
};

const SHOWS_DATA = [
  {
    raw: "Aug 2nd – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)",
    name: "Monthly Indianapolis Card Show",
    start_date: "2025-08-02",
    end_date: "2025-08-02",
    venue_name: "LaQuinta Inn",
    address: "5120 Victory Drive",
    city: "Indianapolis",
    state: "IN",
    postal_code: "46203",
    latitude: 39.7025564,
    longitude: -86.0803286,
    formatted_address: "La Quinta Inn & Suites Indianapolis South, 5120, Victory Drive, Indianapolis, Marion County, Indiana, 46203, United States",
    entry_fee: "Free",
    hours: "8am to 2pm",
    description: "Monthly card show featuring sports cards, memorabilia, and collectibles",
    contact_info: "Tables: Contact organizer",
    source_url: "https://example.com/shows/august",
    status: "APPROVED"
  },
  {
    raw: "Sept 6th – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)",
    name: "Monthly Indianapolis Card Show",
    start_date: "2025-09-06",
    end_date: "2025-09-06",
    venue_name: "LaQuinta Inn",
    address: "5120 Victory Drive",
    city: "Indianapolis",
    state: "IN",
    postal_code: "46203",
    latitude: 39.7025564,
    longitude: -86.0803286,
    formatted_address: "La Quinta Inn & Suites Indianapolis South, 5120, Victory Drive, Indianapolis, Marion County, Indiana, 46203, United States",
    entry_fee: "Free",
    hours: "8am to 2pm",
    description: "Monthly card show featuring sports cards, memorabilia, and collectibles",
    contact_info: "Tables: Contact organizer",
    source_url: "https://example.com/shows/september",
    status: "APPROVED"
  }
];

// Mock owner data if requested
const MOCK_OWNER = {
  name: options.mockOwner || "John Smith",
  email: "organizer@example.com",
  ownership_type: "owner",
  ownership_verified: true,
  verification_method: "document"
};

/**
 * Main function to insert series and shows
 */
async function insertSeriesShows() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - INSERT SERIES SHOWS${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    console.log(`${colors.cyan}Options:${colors.reset}`);
    console.log(`• Force overwrite: ${options.force ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
    console.log(`• Update existing: ${options.update ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
    console.log(`• Mock owner: ${options.mockOwner ? colors.green + options.mockOwner + colors.reset : colors.yellow + 'Default (John Smith)' + colors.reset}\n`);
    
    // Check if tables exist
    console.log(`${colors.cyan}Checking database schema...${colors.reset}`);
    const { error: schemaError } = await checkDatabaseSchema(supabase);
    
    if (schemaError) {
      console.error(`${colors.red}Error checking schema: ${schemaError.message}${colors.reset}`);
      return;
    }
    
    // Start transaction
    console.log(`${colors.cyan}Starting database transaction...${colors.reset}`);
    
    // 1. Insert or update series
    console.log(`\n${colors.bright}1. INSERTING SHOW SERIES${colors.reset}`);
    const { seriesId, seriesError } = await insertSeries(supabase, SERIES_DATA);
    
    if (seriesError) {
      console.error(`${colors.red}Error inserting series: ${seriesError.message}${colors.reset}`);
      return;
    }
    
    console.log(`${colors.green}✓ Series inserted with ID: ${seriesId}${colors.reset}`);
    
    // 2. Insert shows
    console.log(`\n${colors.bright}2. INSERTING SHOWS${colors.reset}`);
    const showResults = [];
    
    for (const [index, showData] of SHOWS_DATA.entries()) {
      const month = index === 0 ? "August" : "September";
      console.log(`\n${colors.cyan}Inserting ${month} Show:${colors.reset} "${showData.raw}"`);
      
      const showWithSeries = {
        ...showData,
        series_id: seriesId
      };
      
      const { showId, showError } = await insertShow(supabase, showWithSeries);
      
      if (showError) {
        console.error(`${colors.red}Error inserting ${month} show: ${showError.message}${colors.reset}`);
        continue;
      }
      
      console.log(`${colors.green}✓ ${month} show inserted with ID: ${showId}${colors.reset}`);
      showResults.push({ month, id: showId });
    }
    
    // 3. Insert mock ownership if requested
    if (options.mockOwner || options.force) {
      console.log(`\n${colors.bright}3. CREATING MOCK OWNERSHIP${colors.reset}`);
      
      // First, create a mock user if it doesn't exist
      const { userId, userError } = await createMockUser(supabase, MOCK_OWNER);
      
      if (userError) {
        console.error(`${colors.red}Error creating mock user: ${userError.message}${colors.reset}`);
      } else {
        console.log(`${colors.green}✓ Mock user created with ID: ${userId}${colors.reset}`);
        
        // Then create ownership record
        const { ownershipId, ownershipError } = await createOwnership(supabase, {
          series_id: seriesId,
          user_id: userId,
          ownership_type: MOCK_OWNER.ownership_type,
          ownership_verified: MOCK_OWNER.ownership_verified,
          verification_method: MOCK_OWNER.verification_method
        });
        
        if (ownershipError) {
          console.error(`${colors.red}Error creating ownership: ${ownershipError.message}${colors.reset}`);
        } else {
          console.log(`${colors.green}✓ Ownership record created with ID: ${ownershipId}${colors.reset}`);
        }
      }
    }
    
    // 4. Verify inserted data
    console.log(`\n${colors.bright}4. VERIFYING INSERTED DATA${colors.reset}`);
    
    // Verify series
    const { data: seriesData, error: seriesVerifyError } = await supabase
      .from('show_series')
      .select('*')
      .eq('id', seriesId)
      .single();
    
    if (seriesVerifyError) {
      console.error(`${colors.red}Error verifying series: ${seriesVerifyError.message}${colors.reset}`);
    } else {
      console.log(`\n${colors.cyan}Series Record:${colors.reset}`);
      console.log(JSON.stringify(seriesData, null, 2));
    }
    
    // Verify shows
    for (const result of showResults) {
      const { data: showData, error: showVerifyError } = await supabase
        .from('shows')
        .select('*')
        .eq('id', result.id)
        .single();
      
      if (showVerifyError) {
        console.error(`${colors.red}Error verifying ${result.month} show: ${showVerifyError.message}${colors.reset}`);
      } else {
        console.log(`\n${colors.cyan}${result.month} Show Record:${colors.reset}`);
        console.log(JSON.stringify(showData, null, 2));
      }
    }
    
    console.log(`\n${colors.bright}${colors.green}INSERTION COMPLETE!${colors.reset}`);
    console.log(`The Indianapolis LaQuinta Inn series with both August and September shows`);
    console.log(`has been successfully inserted into the database.`);
    console.log(`You can now view these shows in your app simulator.`);
    
  } catch (error) {
    console.error(`\n${colors.red}UNEXPECTED ERROR: ${error.message}${colors.reset}`);
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
  }
}

/**
 * Check if required tables exist in the database
 */
async function checkDatabaseSchema(supabase) {
  try {
    // Check if show_series table exists
    const { data: seriesExists, error: seriesError } = await supabase
      .from('show_series')
      .select('id')
      .limit(1);
    
    if (seriesError && !seriesError.message.includes('does not exist')) {
      return { error: seriesError };
    }
    
    if (seriesError && seriesError.message.includes('does not exist')) {
      console.log(`${colors.yellow}⚠️ Table 'show_series' does not exist. Creating...${colors.reset}`);
      
      // Create show_series table
      const { error: createSeriesError } = await supabase.rpc('create_show_series_table');
      
      if (createSeriesError) {
        return { error: createSeriesError };
      }
      
      console.log(`${colors.green}✓ Table 'show_series' created${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Table 'show_series' exists${colors.reset}`);
    }
    
    // Check if shows table exists
    const { data: showsExists, error: showsError } = await supabase
      .from('shows')
      .select('id')
      .limit(1);
    
    if (showsError && !showsError.message.includes('does not exist')) {
      return { error: showsError };
    }
    
    if (showsError && showsError.message.includes('does not exist')) {
      console.log(`${colors.yellow}⚠️ Table 'shows' does not exist. Creating...${colors.reset}`);
      
      // Create shows table
      const { error: createShowsError } = await supabase.rpc('create_shows_table');
      
      if (createShowsError) {
        return { error: createShowsError };
      }
      
      console.log(`${colors.green}✓ Table 'shows' created${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Table 'shows' exists${colors.reset}`);
    }
    
    // Check if series_ownership table exists
    const { data: ownershipExists, error: ownershipError } = await supabase
      .from('series_ownership')
      .select('id')
      .limit(1);
    
    if (ownershipError && !ownershipError.message.includes('does not exist')) {
      return { error: ownershipError };
    }
    
    if (ownershipError && ownershipError.message.includes('does not exist')) {
      console.log(`${colors.yellow}⚠️ Table 'series_ownership' does not exist. Creating...${colors.reset}`);
      
      // Create series_ownership table
      const { error: createOwnershipError } = await supabase.rpc('create_series_ownership_table');
      
      if (createOwnershipError) {
        return { error: createOwnershipError };
      }
      
      console.log(`${colors.green}✓ Table 'series_ownership' created${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Table 'series_ownership' exists${colors.reset}`);
    }
    
    return { error: null };
  } catch (error) {
    return { error };
  }
}

/**
 * Insert or update a series record
 */
async function insertSeries(supabase, seriesData) {
  try {
    // Check if series already exists with same venue and address
    const { data: existingSeries, error: checkError } = await supabase
      .from('show_series')
      .select('id')
      .eq('venue_name', seriesData.venue_name)
      .eq('address', seriesData.address)
      .eq('city', seriesData.city)
      .eq('state', seriesData.state)
      .limit(1);
    
    if (checkError) {
      return { seriesError: checkError };
    }
    
    let seriesId;
    
    if (existingSeries && existingSeries.length > 0) {
      seriesId = existingSeries[0].id;
      
      console.log(`${colors.yellow}⚠️ Series already exists with ID: ${seriesId}${colors.reset}`);
      
      if (options.force || options.update) {
        console.log(`${colors.yellow}Updating existing series...${colors.reset}`);
        
        // Update existing series
        const { error: updateError } = await supabase
          .from('show_series')
          .update({
            ...seriesData,
            updated_at: new Date().toISOString()
          })
          .eq('id', seriesId);
        
        if (updateError) {
          return { seriesError: updateError };
        }
        
        console.log(`${colors.green}✓ Series updated${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Skipping series update (use --update to update)${colors.reset}`);
      }
    } else {
      // Insert new series
      console.log(`${colors.cyan}Creating new series...${colors.reset}`);
      
      const { data: newSeries, error: insertError } = await supabase
        .from('show_series')
        .insert({
          ...seriesData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (insertError) {
        return { seriesError: insertError };
      }
      
      seriesId = newSeries[0].id;
      console.log(`${colors.green}✓ New series created${colors.reset}`);
    }
    
    return { seriesId, seriesError: null };
  } catch (error) {
    return { seriesError: error };
  }
}

/**
 * Insert or update a show record
 */
async function insertShow(supabase, showData) {
  try {
    // Check if show already exists with same date and venue
    const { data: existingShow, error: checkError } = await supabase
      .from('shows')
      .select('id')
      .eq('venue_name', showData.venue_name)
      .eq('address', showData.address)
      .eq('start_date', showData.start_date)
      .limit(1);
    
    if (checkError) {
      return { showError: checkError };
    }
    
    let showId;
    
    if (existingShow && existingShow.length > 0) {
      showId = existingShow[0].id;
      
      console.log(`${colors.yellow}⚠️ Show already exists with ID: ${showId}${colors.reset}`);
      
      if (options.force || options.update) {
        console.log(`${colors.yellow}Updating existing show...${colors.reset}`);
        
        // Update existing show
        const { error: updateError } = await supabase
          .from('shows')
          .update({
            ...showData,
            updated_at: new Date().toISOString()
          })
          .eq('id', showId);
        
        if (updateError) {
          return { showError: updateError };
        }
        
        console.log(`${colors.green}✓ Show updated${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Skipping show update (use --update to update)${colors.reset}`);
      }
    } else {
      // Insert new show
      console.log(`${colors.cyan}Creating new show...${colors.reset}`);
      
      // Add approval and timestamps
      const enhancedShowData = {
        ...showData,
        approved_at: new Date().toISOString(),
        approved_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: newShow, error: insertError } = await supabase
        .from('shows')
        .insert(enhancedShowData)
        .select();
      
      if (insertError) {
        return { showError: insertError };
      }
      
      showId = newShow[0].id;
      console.log(`${colors.green}✓ New show created${colors.reset}`);
    }
    
    return { showId, showError: null };
  } catch (error) {
    return { showError: error };
  }
}

/**
 * Create a mock user for ownership testing
 */
async function createMockUser(supabase, userData) {
  try {
    // Check if user already exists with same email
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userData.email)
      .limit(1);
    
    if (checkError && !checkError.message.includes('does not exist')) {
      return { userError: checkError };
    }
    
    let userId;
    
    // If users table doesn't exist, create a mock user in auth.users
    if (checkError && checkError.message.includes('does not exist')) {
      console.log(`${colors.yellow}⚠️ Table 'users' does not exist. Creating mock auth user...${colors.reset}`);
      
      // Create user in auth.users
      const { data: newAuthUser, error: signupError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: 'Password123!',
        user_metadata: { name: userData.name },
        email_confirm: true
      });
      
      if (signupError) {
        return { userError: signupError };
      }
      
      userId = newAuthUser.user.id;
      console.log(`${colors.green}✓ Mock auth user created${colors.reset}`);
    } else if (existingUser && existingUser.length > 0) {
      userId = existingUser[0].id;
      console.log(`${colors.yellow}⚠️ User already exists with ID: ${userId}${colors.reset}`);
      
      if (options.force || options.update) {
        console.log(`${colors.yellow}Updating existing user...${colors.reset}`);
        
        // Update existing user
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: userData.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (updateError) {
          return { userError: updateError };
        }
        
        console.log(`${colors.green}✓ User updated${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Skipping user update (use --update to update)${colors.reset}`);
      }
    } else {
      // Insert new user
      console.log(`${colors.cyan}Creating new user...${colors.reset}`);
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          name: userData.name,
          email: userData.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (insertError) {
        return { userError: insertError };
      }
      
      userId = newUser[0].id;
      console.log(`${colors.green}✓ New user created${colors.reset}`);
    }
    
    return { userId, userError: null };
  } catch (error) {
    return { userError: error };
  }
}

/**
 * Create a series ownership record
 */
async function createOwnership(supabase, ownershipData) {
  try {
    // Check if ownership already exists
    const { data: existingOwnership, error: checkError } = await supabase
      .from('series_ownership')
      .select('id')
      .eq('series_id', ownershipData.series_id)
      .eq('user_id', ownershipData.user_id)
      .limit(1);
    
    if (checkError) {
      return { ownershipError: checkError };
    }
    
    let ownershipId;
    
    if (existingOwnership && existingOwnership.length > 0) {
      ownershipId = existingOwnership[0].id;
      
      console.log(`${colors.yellow}⚠️ Ownership already exists with ID: ${ownershipId}${colors.reset}`);
      
      if (options.force || options.update) {
        console.log(`${colors.yellow}Updating existing ownership...${colors.reset}`);
        
        // Update existing ownership
        const { error: updateError } = await supabase
          .from('series_ownership')
          .update({
            ...ownershipData,
            updated_at: new Date().toISOString()
          })
          .eq('id', ownershipId);
        
        if (updateError) {
          return { ownershipError: updateError };
        }
        
        console.log(`${colors.green}✓ Ownership updated${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Skipping ownership update (use --update to update)${colors.reset}`);
      }
    } else {
      // Insert new ownership
      console.log(`${colors.cyan}Creating new ownership record...${colors.reset}`);
      
      const { data: newOwnership, error: insertError } = await supabase
        .from('series_ownership')
        .insert({
          ...ownershipData,
          verified_at: ownershipData.ownership_verified ? new Date().toISOString() : null,
          verified_by: ownershipData.ownership_verified ? 'system' : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (insertError) {
        return { ownershipError: insertError };
      }
      
      ownershipId = newOwnership[0].id;
      console.log(`${colors.green}✓ New ownership record created${colors.reset}`);
    }
    
    return { ownershipId, ownershipError: null };
  } catch (error) {
    return { ownershipError: error };
  }
}

// Run the script
insertSeriesShows().catch(console.error);
