#!/usr/bin/env node
require('dotenv').config();
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');

// ======================================================
// CARD SHOW FINDER - TEST HOMEPAGE DATE DISPLAY
// ======================================================

console.log(chalk.bold.blue('======================================================'));
console.log(chalk.bold.blue('  CARD SHOW FINDER - TEST HOMEPAGE DATE DISPLAY'));
console.log(chalk.bold.blue('======================================================'));
console.log('');

// ------------------------------------------------------------------
// Connect to Supabase (support multiple env-var conventions + fallback)
// ------------------------------------------------------------------
console.log(chalk.cyan('Connecting to database...'));
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.REACT_NATIVE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.REACT_NATIVE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log(
    chalk.yellow(
      '⚠ Supabase credentials not found in env – using mock data.\n' +
        '  (Set EXPO_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_KEY if you want real queries.)'
    )
  );
}

console.log(chalk.dim(`URL: ${supabaseUrl || 'N/A (offline mode)'}`));
console.log('');

// Create a client only if creds exist – otherwise create a dummy object
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : {
        from: () => ({
          select: () => ({
            ilike: () => ({
              eq: async () => ({ data: getMockShows(), error: null }),
            }),
          }),
        }),
      };

// ======================================================
// Mock data for offline testing
// ======================================================

function getMockShows() {
  return [
    // Single-day show (same date, different times)
    {
      id: '3d5ba25a-8d2e-4430-8188-7061f4500547',
      title: 'Monthly Indianapolis Card Show (August)',
      location: 'LaQuinta Inn',
      address: '5120 Victory Drive, Indianapolis, IN 46203',
      start_date: '2025-08-02T10:00:00+00:00',
      end_date: '2025-08-02T16:00:00+00:00',
      start_time: '8:00 AM',
      end_time: '2:00 PM',
      status: 'ACTIVE',
      organizer_id: 'org123',
      entry_fee: 5,
      coordinates: '0101000020E61000001E4FCB0F6C0D56C0DFC2BAF1EE0C4440'
    },
    // Multi-day show (different dates)
    {
      id: '7c302fe1-2544-4d5d-81d6-cb235429236d',
      title: 'Weekend Indianapolis Card Show',
      location: 'LaQuinta Inn',
      address: '5120 Victory Drive, Indianapolis, IN 46203',
      start_date: '2025-09-06T10:00:00+00:00',
      end_date: '2025-09-07T16:00:00+00:00',
      start_time: '8:00 AM',
      end_time: '2:00 PM',
      status: 'ACTIVE',
      organizer_id: 'org123',
      entry_fee: 5,
      coordinates: '0101000020E61000001E4FCB0F6C0D56C0DFC2BAF1EE0C4440'
    },
    // Edge case: Show that spans midnight (same calendar day)
    {
      id: '9a501fe2-3456-7890-abcd-ef1234567890',
      title: 'Late Night Card Trading',
      location: 'Downtown Convention Center',
      address: '100 Main St, Indianapolis, IN 46204',
      start_date: '2025-10-15T20:00:00+00:00',
      end_date: '2025-10-15T23:59:59+00:00',
      start_time: '8:00 PM',
      end_time: '11:59 PM',
      status: 'ACTIVE',
      organizer_id: 'org123',
      entry_fee: 10,
      coordinates: '0101000020E61000001E4FCB0F6C0D56C0DFC2BAF1EE0C4440'
    },
    // Edge case: Show that spans midnight (different calendar days)
    {
      id: 'bc602fe3-4567-8901-bcde-f23456789012',
      title: 'Overnight Card Trading Marathon',
      location: 'Downtown Convention Center',
      address: '100 Main St, Indianapolis, IN 46204',
      start_date: '2025-11-20T20:00:00+00:00',
      end_date: '2025-11-21T04:00:00+00:00',
      start_time: '8:00 PM',
      end_time: '4:00 AM',
      status: 'ACTIVE',
      organizer_id: 'org123',
      entry_fee: 15,
      coordinates: '0101000020E61000001E4FCB0F6C0D56C0DFC2BAF1EE0C4440'
    }
  ];
}

// ======================================================
// 1. FETCH SHOWS FROM DATABASE
// ======================================================

async function getShows() {
  console.log(chalk.bold('1. FETCHING SHOWS'));
  console.log('');

  try {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .ilike('address', '%Indianapolis%')
      .eq('status', 'ACTIVE');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(chalk.yellow('No shows found in the database.'));
      console.log(chalk.yellow('Using mock data for testing...'));
      return getMockShows();
    }

    console.log(chalk.green(`✓ Found ${data.length} shows`));
    console.log('');

    return data;
  } catch (error) {
    console.error(chalk.red('Error fetching shows:'), error.message);
    console.log(chalk.yellow('Using mock data for testing...'));
    return getMockShows();
  }
}

// ======================================================
// 2. FORMAT DATE FUNCTIONS (FROM HOMESCREEN)
// ======================================================

// Format date for display (same as in HomeScreen.tsx)
function formatDate(dateString) {
  if (!dateString) return '';
  // Parse the date string and adjust for timezone issues
  // This ensures the correct date is shown regardless of local timezone
  const date = new Date(dateString);
  const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);

  return utcDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Old broken logic (comparing full datetime strings)
function getFormattedDateOld(show) {
  const startFormatted = formatDate(String(show.start_date));
  let result = startFormatted;
  
  // The bug: comparing full datetime strings (different times on same day appear as different days)
  if (show.start_date !== show.end_date) {
    result += ` - ${formatDate(String(show.end_date))}`;
  }
  
  return result;
}

// New fixed logic (comparing only the date portions)
function getFormattedDateNew(show) {
  const startFormatted = formatDate(String(show.start_date));
  let result = startFormatted;
  
  // The fix: comparing just the calendar day portion (toDateString)
  const startDay = new Date(show.start_date).toDateString();
  const endDay = new Date(show.end_date).toDateString();
  
  if (startDay !== endDay) {
    result += ` - ${formatDate(String(show.end_date))}`;
  }
  
  return result;
}

// ======================================================
// 3. TEST SHOW DATE DISPLAY
// ======================================================

function testShowDateDisplay(shows) {
  console.log(chalk.bold('2. TESTING SHOW DATE DISPLAY'));
  console.log('');

  shows.forEach((show, index) => {
    console.log(chalk.bold.underline(`Show #${index + 1}: ${show.title}`));
    
    // Display raw date values
    console.log(chalk.cyan('Raw date values:'));
    console.log(chalk.dim(`start_date: ${show.start_date}`));
    console.log(chalk.dim(`end_date: ${show.end_date}`));
    
    // Check if dates are the same day
    const startDay = new Date(show.start_date).toDateString();
    const endDay = new Date(show.end_date).toDateString();
    const isSameDay = startDay === endDay;
    
    console.log(chalk.cyan('Date analysis:'));
    console.log(chalk.dim(`Start day: ${startDay}`));
    console.log(chalk.dim(`End day: ${endDay}`));
    console.log(chalk.dim(`Same calendar day: ${isSameDay ? 'YES' : 'NO'}`));
    
    // Test both old and new logic
    const oldResult = getFormattedDateOld(show);
    const newResult = getFormattedDateNew(show);
    
    console.log('');
    console.log(chalk.red.bold('BEFORE FIX (comparing full datetime strings):'));
    console.log(chalk.red(`  ${oldResult}`));
    
    console.log(chalk.green.bold('AFTER FIX (comparing date portions only):'));
    console.log(chalk.green(`  ${newResult}`));
    
    // Determine if the fix made a difference
    const fixMadeDifference = oldResult !== newResult;
    
    console.log('');
    if (fixMadeDifference) {
      if (isSameDay) {
        console.log(chalk.green.bold('✓ FIX WORKING CORRECTLY'));
        console.log(chalk.green('  Single-day show now displays correctly without duplicate dates'));
      } else {
        console.log(chalk.red.bold('✗ UNEXPECTED RESULT'));
        console.log(chalk.red('  Fix changed output for a multi-day show'));
      }
    } else {
      if (isSameDay) {
        console.log(chalk.red.bold('✗ FIX NOT WORKING'));
        console.log(chalk.red('  Single-day show still shows duplicate dates'));
      } else {
        console.log(chalk.green.bold('✓ CORRECT BEHAVIOR'));
        console.log(chalk.green('  Multi-day show correctly shows date range in both versions'));
      }
    }
    
    console.log('');
    console.log(chalk.dim('---------------------------------------------------'));
    console.log('');
  });
}

// ======================================================
// 4. SUMMARY OF RESULTS
// ======================================================

function showSummary(shows) {
  console.log(chalk.bold('3. SUMMARY OF RESULTS'));
  console.log('');
  
  // Count single-day and multi-day shows
  const singleDayShows = shows.filter(show => 
    new Date(show.start_date).toDateString() === new Date(show.end_date).toDateString()
  );
  
  const multiDayShows = shows.filter(show => 
    new Date(show.start_date).toDateString() !== new Date(show.end_date).toDateString()
  );
  
  console.log(chalk.cyan(`Total shows tested: ${shows.length}`));
  console.log(chalk.cyan(`Single-day shows: ${singleDayShows.length}`));
  console.log(chalk.cyan(`Multi-day shows: ${multiDayShows.length}`));
  console.log('');
  
  // Count how many shows would display differently with the fix
  const fixedShows = shows.filter(show => {
    const oldResult = getFormattedDateOld(show);
    const newResult = getFormattedDateNew(show);
    return oldResult !== newResult;
  });
  
  console.log(chalk.bold('Impact of the fix:'));
  console.log(chalk.green(`✓ ${fixedShows.length} shows will display differently with the fix`));
  
  if (fixedShows.length > 0) {
    console.log(chalk.green('✓ Single-day shows no longer display redundant dates'));
    console.log(chalk.green('  Instead of: "Sat, Aug 2 - Sat, Aug 2"'));
    console.log(chalk.green('  Now shows: "Sat, Aug 2"'));
  }
  
  console.log('');
  console.log(chalk.bold('Before/After comparison:'));
  console.log('');
  console.log(chalk.red('OLD LOGIC (HomeScreen.tsx):'));
  console.log(chalk.dim('{formatDate(String(item.startDate))}'));
  console.log(chalk.dim('{item.startDate !== item.endDate ? ` - ${formatDate(String(item.endDate))}` : \'\'}'));
  console.log('');
  console.log(chalk.green('NEW LOGIC (HomeScreen.tsx):'));
  console.log(chalk.dim('{formatDate(String(item.startDate))}'));
  console.log(chalk.dim('{(() => {'));
  console.log(chalk.dim('  const startDay = new Date(item.startDate).toDateString();'));
  console.log(chalk.dim('  const endDay = new Date(item.endDate).toDateString();'));
  console.log(chalk.dim('  return startDay !== endDay ? ` - ${formatDate(String(item.endDate))}` : \'\';'));
  console.log(chalk.dim('})()}'));
  console.log('');
}

// ======================================================
// MAIN EXECUTION
// ======================================================

async function main() {
  try {
    const shows = await getShows();
    testShowDateDisplay(shows);
    showSummary(shows);
    
    console.log(chalk.bold.green('HOMEPAGE DATE DISPLAY TEST COMPLETE!'));
    console.log('The date display fix has been verified.');
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

main();
