// e2e/teardown.js
const detox = require('detox');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables from .env.test if it exists, fallback to .env
const envPath = fs.existsSync(path.resolve(process.cwd(), '.env.test')) 
  ? path.resolve(process.cwd(), '.env.test')
  : path.resolve(process.cwd(), '.env');

dotenv.config({ path: envPath });

// Get Supabase credentials
const supabaseUrl = process.env.EXPO_PUBLIC_TEST_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_TEST_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Artifacts directory
const artifactsDir = path.join(process.cwd(), 'e2e', 'artifacts');

// Clean up test data from database
async function cleanupTestDatabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not found. Skipping test database cleanup.');
    return;
  }

  try {
    console.log('Starting test database cleanup...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get test data from global object
    const testUser = global.__DETOX_GLOBAL__?.TEST_USER;
    const testShows = global.__DETOX_GLOBAL__?.TEST_SHOWS;
    
    if (!testUser || !testShows) {
      console.warn('Test data not found in global object. Skipping database cleanup.');
      return;
    }
    
    // Sign in as the test user to get their ID
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });
    
    if (authError) {
      console.warn(`Failed to authenticate as test user: ${authError.message}`);
    } else {
      const userId = authData?.user?.id;
      
      if (userId) {
        // Clean up any favorites created by test user
        await supabase.from('user_favorite_shows').delete().eq('userid', userId);
        console.log('Cleaned up test user favorites');
        
        // Clean up any want lists created by test user
        await supabase.from('want_lists').delete().eq('userid', userId);
        console.log('Cleaned up test user want lists');
        
        // Clean up any show participants created by test user
        await supabase.from('show_participants').delete().eq('userid', userId);
        console.log('Cleaned up test user show participants');
        
        // Clean up profile
        await supabase.from('profiles').delete().eq('id', userId);
        console.log('Cleaned up test user profile');
        
        // Delete the user account
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteError) {
          console.warn(`Failed to delete test user: ${deleteError.message}`);
        } else {
          console.log('Deleted test user account');
        }
      }
    }
    
    // Clean up test shows
    if (testShows && testShows.length > 0) {
      for (const show of testShows) {
        // Find the show by name and delete it
        const { data: showData, error: showQueryError } = await supabase
          .from('shows')
          .select('id')
          .eq('name', show.name)
          .limit(1);
        
        if (showQueryError) {
          console.warn(`Failed to find test show "${show.name}": ${showQueryError.message}`);
        } else if (showData && showData.length > 0) {
          const showId = showData[0].id;
          
          // Delete any show participants
          await supabase.from('show_participants').delete().eq('showid', showId);
          
          // Delete any favorites for this show
          await supabase.from('user_favorite_shows').delete().eq('showid', showId);
          
          // Delete the show
          const { error: deleteShowError } = await supabase
            .from('shows')
            .delete()
            .eq('id', showId);
          
          if (deleteShowError) {
            console.warn(`Failed to delete test show "${show.name}": ${deleteShowError.message}`);
          } else {
            console.log(`Deleted test show "${show.name}"`);
          }
        }
      }
    }
    
    console.log('Test database cleanup completed successfully');
  } catch (err) {
    console.error('Error cleaning up test database:', err);
  }
}

// Generate test report
function generateTestReport() {
  try {
    console.log('Generating test report...');
    
    const reportPath = path.join(artifactsDir, 'test-report.json');
    
    // Get test results from global object
    const testResults = global.__DETOX_GLOBAL__?.TEST_RESULTS || {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      timestamp: new Date().toISOString(),
    };
    
    // Calculate test duration
    const setupTimestamp = global.__DETOX_GLOBAL__?.SETUP_TIMESTAMP || 0;
    const teardownTimestamp = Date.now();
    const totalDuration = teardownTimestamp - setupTimestamp;
    
    testResults.duration = totalDuration;
    
    // Write test report to file
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    
    console.log(`Test report generated: ${reportPath}`);
    console.log(`Test summary: ${testResults.passed} passed, ${testResults.failed} failed, ${testResults.skipped} skipped`);
    console.log(`Total duration: ${totalDuration}ms`);
  } catch (err) {
    console.error('Error generating test report:', err);
  }
}

// Log performance metrics
function logPerformanceMetrics() {
  try {
    console.log('Logging performance metrics...');
    
    // Get performance data from global object
    const performance = global.__DETOX_GLOBAL__?.PERFORMANCE;
    
    if (!performance || !performance.enabled) {
      console.log('Performance monitoring was not enabled. Skipping metrics logging.');
      return;
    }
    
    const { measurements, thresholds, logPath } = performance;
    
    if (!measurements || !measurements.length) {
      console.log('No performance measurements were collected.');
      return;
    }
    
    // Generate performance report
    const reportPath = path.join(artifactsDir, 'performance-report.json');
    
    // Calculate performance statistics
    const stats = {
      cpu: {
        min: Number.MAX_VALUE,
        max: 0,
        avg: 0,
        exceededThreshold: 0,
      },
      memory: {
        min: Number.MAX_VALUE,
        max: 0,
        avg: 0,
        exceededThreshold: 0,
      },
      startupTime: {
        value: 0,
        exceededThreshold: false,
      },
      transitionTimes: [],
    };
    
    // Process CPU and memory measurements
    const cpuMeasurements = measurements.filter(m => m.metric === 'cpu');
    const memoryMeasurements = measurements.filter(m => m.metric === 'memory');
    const startupMeasurement = measurements.find(m => m.metric === 'startupTime');
    const transitionMeasurements = measurements.filter(m => m.metric === 'transitionTime');
    
    // CPU statistics
    if (cpuMeasurements.length > 0) {
      stats.cpu.min = Math.min(...cpuMeasurements.map(m => m.value));
      stats.cpu.max = Math.max(...cpuMeasurements.map(m => m.value));
      stats.cpu.avg = cpuMeasurements.reduce((sum, m) => sum + m.value, 0) / cpuMeasurements.length;
      stats.cpu.exceededThreshold = cpuMeasurements.filter(m => m.value > thresholds.cpu).length;
    }
    
    // Memory statistics
    if (memoryMeasurements.length > 0) {
      stats.memory.min = Math.min(...memoryMeasurements.map(m => m.value));
      stats.memory.max = Math.max(...memoryMeasurements.map(m => m.value));
      stats.memory.avg = memoryMeasurements.reduce((sum, m) => sum + m.value, 0) / memoryMeasurements.length;
      stats.memory.exceededThreshold = memoryMeasurements.filter(m => m.value > thresholds.memory).length;
    }
    
    // Startup time
    if (startupMeasurement) {
      stats.startupTime.value = startupMeasurement.value;
      stats.startupTime.exceededThreshold = startupMeasurement.value > thresholds.startupTime;
    }
    
    // Transition times
    if (transitionMeasurements.length > 0) {
      stats.transitionTimes = transitionMeasurements.map(m => ({
        from: m.from,
        to: m.to,
        time: m.value,
        exceededThreshold: m.value > thresholds.transitionTime,
      }));
    }
    
    // Write performance report
    fs.writeFileSync(reportPath, JSON.stringify({
      statistics: stats,
      measurements,
      thresholds,
    }, null, 2));
    
    console.log(`Performance report generated: ${reportPath}`);
    
    // Log performance summary
    console.log('Performance Summary:');
    console.log(`- CPU: Avg ${stats.cpu.avg.toFixed(2)}% (Max: ${stats.cpu.max}%, Threshold: ${thresholds.cpu}%)`);
    console.log(`- Memory: Avg ${stats.memory.avg.toFixed(2)}MB (Max: ${stats.memory.max}MB, Threshold: ${thresholds.memory}MB)`);
    console.log(`- App Startup: ${stats.startupTime.value}ms (Threshold: ${thresholds.startupTime}ms)`);
    console.log(`- Screen Transitions: ${stats.transitionTimes.length} measured`);
    
    // Log any performance warnings
    const warnings = [];
    
    if (stats.cpu.exceededThreshold > 0) {
      warnings.push(`CPU usage exceeded threshold ${stats.cpu.exceededThreshold} times`);
    }
    
    if (stats.memory.exceededThreshold > 0) {
      warnings.push(`Memory usage exceeded threshold ${stats.memory.exceededThreshold} times`);
    }
    
    if (stats.startupTime.exceededThreshold) {
      warnings.push(`App startup time (${stats.startupTime.value}ms) exceeded threshold (${thresholds.startupTime}ms)`);
    }
    
    const slowTransitions = stats.transitionTimes.filter(t => t.exceededThreshold);
    if (slowTransitions.length > 0) {
      warnings.push(`${slowTransitions.length} screen transitions were slower than threshold (${thresholds.transitionTime}ms)`);
    }
    
    if (warnings.length > 0) {
      console.log('\nPerformance Warnings:');
      warnings.forEach(warning => console.log(`- ${warning}`));
    } else {
      console.log('\nAll performance metrics are within acceptable thresholds');
    }
  } catch (err) {
    console.error('Error logging performance metrics:', err);
  }
}

// Clean up artifacts
function cleanupArtifacts() {
  try {
    console.log('Checking artifacts cleanup configuration...');
    
    // Check if we should clean up artifacts
    const shouldCleanup = process.env.DETOX_CLEANUP_ARTIFACTS === 'true';
    
    if (!shouldCleanup) {
      console.log('Artifacts cleanup is disabled. Skipping.');
      return;
    }
    
    console.log('Cleaning up artifacts...');
    
    // Get list of files to keep
    const keepFiles = [
      'test-report.json',
      'performance-report.json',
      'e2e-results.xml',
    ];
    
    // Read artifacts directory
    const files = fs.readdirSync(artifactsDir);
    
    // Delete files that are not in the keep list
    let deletedCount = 0;
    for (const file of files) {
      if (!keepFiles.includes(file)) {
        const filePath = path.join(artifactsDir, file);
        
        // Check if it's a directory
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          // Skip directories for now
          continue;
        }
        
        // Delete the file
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
    
    console.log(`Cleaned up ${deletedCount} artifact files`);
  } catch (err) {
    console.error('Error cleaning up artifacts:', err);
  }
}

// Main teardown function
module.exports = async () => {
  console.log('Starting Detox E2E test teardown');
  
  try {
    // Clean up test database
    await cleanupTestDatabase();
    
    // Generate test report
    generateTestReport();
    
    // Log performance metrics
    logPerformanceMetrics();
    
    // Clean up artifacts if configured
    cleanupArtifacts();
    
    // Detox cleanup is automatically handled by the Jest runner in Detox v20+.
    // (Calling detox.cleanup() manually would throw an error.)
    console.log('Detox cleanup handled automatically by the test runner');
  } catch (err) {
    console.error('Error during teardown:', err);
    // Continue with teardown process despite errors
  }
  
  console.log('Detox E2E test teardown completed');
};
