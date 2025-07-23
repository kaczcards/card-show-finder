#!/usr/bin/env node
/**
 * Test Segments Orchestration Script
 * Card-Show-Finder · July 2025
 * 
 * Runs test segments in isolation or combination with timing, logging,
 * and failure isolation. Supports both local development and CI environments.
 * 
 * Usage:
 *   node scripts/test-segments.js [options] [segments...]
 * 
 * Options:
 *   --parallel         Run compatible segments in parallel
 *   --ci               CI mode (different output formatting, stricter)
 *   --timing-only      Only show timing, no test output
 *   --fail-fast        Stop on first segment failure
 *   --report=<path>    Save JSON report to file
 *   --update-baseline  Update performance baselines
 * 
 * Segments:
 *   lint               ESLint checks
 *   type               TypeScript type checking
 *   unit               Unit tests (Jest)
 *   db:unit            Database unit tests (pgTAP)
 *   api                API integration tests
 *   db:security        Database security tests
 *   e2e:auth           E2E authentication tests
 *   e2e:core           E2E core functionality tests
 *   e2e:edge           E2E edge cases (non-blocking)
 *   perf               Performance tests (non-blocking)
 *   security           Security scans (non-blocking)
 *   build              Build verification
 *   
 * Combinations:
 *   fast               lint + type + unit
 *   ci                 lint + type + unit + db:unit + api + db:security
 *   full               All segments
 *   
 * Examples:
 *   node scripts/test-segments.js lint type unit
 *   node scripts/test-segments.js fast --timing-only
 *   node scripts/test-segments.js ci --parallel --ci
 *   node scripts/test-segments.js full --report=test-report.json
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const SEGMENTS = {
  // Core quality segments
  'lint': {
    command: 'npm',
    args: ['run', 'test:lint'],
    description: 'ESLint code quality checks',
    estimatedTime: 20, // seconds
    blocking: true,
    parallelizable: true,
    dependencies: []
  },
  'type': {
    command: 'npm',
    args: ['run', 'test:type'],
    description: 'TypeScript type checking',
    estimatedTime: 35,
    blocking: true,
    parallelizable: true,
    dependencies: []
  },
  'unit': {
    command: 'npm',
    args: ['run', 'test:unit'],
    description: 'Unit tests with Jest',
    estimatedTime: 45,
    blocking: true,
    parallelizable: true,
    dependencies: []
  },
  // Database segments
  'db:unit': {
    command: 'npm',
    args: ['run', 'test:db:unit'],
    description: 'Database unit tests with pgTAP',
    estimatedTime: 60,
    blocking: true,
    parallelizable: false,
    dependencies: ['unit']
  },
  'api': {
    command: 'npm',
    args: ['run', 'test:api'],
    description: 'API integration tests',
    estimatedTime: 90,
    blocking: true,
    parallelizable: false,
    dependencies: ['unit']
  },
  'db:security': {
    command: 'npm',
    args: ['run', 'test:db:security'],
    description: 'Database security tests',
    estimatedTime: 60,
    blocking: true,
    parallelizable: false,
    dependencies: ['db:unit']
  },
  // E2E segments
  'e2e:auth': {
    command: 'npm',
    args: ['run', 'test:e2e:auth'],
    description: 'E2E authentication tests with Detox',
    estimatedTime: 240,
    blocking: true,
    parallelizable: false,
    dependencies: ['api']
  },
  'e2e:core': {
    command: 'npm',
    args: ['run', 'test:e2e:core'],
    description: 'E2E core functionality tests with Detox',
    estimatedTime: 300,
    blocking: true,
    parallelizable: false,
    dependencies: ['e2e:auth']
  },
  'e2e:edge': {
    command: 'npm',
    args: ['run', 'test:e2e:edge'],
    description: 'E2E edge cases and error states',
    estimatedTime: 360,
    blocking: false,
    parallelizable: false,
    dependencies: ['e2e:auth']
  },
  // Performance and security
  'perf': {
    command: 'npm',
    args: ['run', 'test:perf'],
    description: 'Performance tests',
    estimatedTime: 180,
    blocking: false,
    parallelizable: true,
    dependencies: ['unit']
  },
  'security': {
    command: 'npm',
    args: ['run', 'test:sec'],
    description: 'Security scans',
    estimatedTime: 240,
    blocking: false,
    parallelizable: true,
    dependencies: []
  },
  // Build verification
  'build': {
    command: 'npm',
    args: ['run', 'test:build:verify'],
    description: 'Build verification',
    estimatedTime: 120,
    blocking: true,
    parallelizable: false,
    dependencies: ['unit']
  }
};

// Segment combinations
const COMBINATIONS = {
  'fast': ['lint', 'type', 'unit'],
  'ci': ['lint', 'type', 'unit', 'db:unit', 'api', 'db:security'],
  'full': Object.keys(SEGMENTS)
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  parallel: args.includes('--parallel'),
  ci: args.includes('--ci'),
  timingOnly: args.includes('--timing-only'),
  failFast: args.includes('--fail-fast'),
  report: args.find(arg => arg.startsWith('--report='))?.split('=')[1],
  updateBaseline: args.includes('--update-baseline')
};

// Extract segments to run
let segmentsToRun = args.filter(arg => !arg.startsWith('--'));

// Expand combinations
segmentsToRun = segmentsToRun.reduce((acc, segment) => {
  if (COMBINATIONS[segment]) {
    return [...acc, ...COMBINATIONS[segment]];
  }
  return [...acc, segment];
}, []);

// Remove duplicates
segmentsToRun = [...new Set(segmentsToRun)];

// Validate segments
const invalidSegments = segmentsToRun.filter(segment => !SEGMENTS[segment]);
if (invalidSegments.length > 0) {
  console.error(`Error: Invalid segments: ${invalidSegments.join(', ')}`);
  console.error('Available segments:', Object.keys(SEGMENTS).join(', '));
  console.error('Available combinations:', Object.keys(COMBINATIONS).join(', '));
  process.exit(1);
}

// Sort segments based on dependencies
function sortSegments(segments) {
  const result = [];
  const visited = new Set();
  
  function visit(segment) {
    if (visited.has(segment)) return;
    visited.add(segment);
    
    const dependencies = SEGMENTS[segment].dependencies || [];
    for (const dep of dependencies) {
      if (segments.includes(dep)) {
        visit(dep);
      }
    }
    
    result.push(segment);
  }
  
  for (const segment of segments) {
    visit(segment);
  }
  
  return result;
}

// Group segments for parallel execution
function groupSegmentsForParallel(sortedSegments) {
  const groups = [];
  let currentGroup = [];
  
  for (const segment of sortedSegments) {
    const segmentConfig = SEGMENTS[segment];
    
    // If segment is not parallelizable or has dependencies in the current group,
    // start a new group
    if (!segmentConfig.parallelizable || 
        segmentConfig.dependencies.some(dep => currentGroup.includes(dep))) {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
        currentGroup = [];
      }
      groups.push([segment]);
    } else {
      currentGroup.push(segment);
    }
  }
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

// Execute a single test segment
async function executeSegment(segment) {
  const config = SEGMENTS[segment];
  const startTime = Date.now();
  
  console.log(`\n${options.ci ? '::group::' : ''}🔍 Running ${segment}: ${config.description} (est. ${config.estimatedTime}s)`);
  
  // Add update-baseline flag to perf tests if needed
  let args = [...config.args];
  if (segment === 'perf' && options.updateBaseline) {
    args.push('--', '--update-baseline');
  }
  
  return new Promise((resolve) => {
    const proc = spawn(config.command, args, {
      stdio: options.timingOnly ? 'ignore' : 'inherit',
      shell: true
    });
    
    proc.on('close', (code) => {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      const result = {
        segment,
        success: code === 0,
        duration,
        estimatedTime: config.estimatedTime,
        blocking: config.blocking
      };
      
      const emoji = result.success ? '✅' : (result.blocking ? '❌' : '⚠️');
      console.log(`${emoji} ${segment} ${result.success ? 'passed' : 'failed'} in ${duration.toFixed(2)}s (${Math.round(duration / config.estimatedTime * 100)}% of estimate)`);
      
      if (options.ci) {
        console.log('::endgroup::');
      }
      
      resolve(result);
    });
  });
}

// Execute a group of segments (in parallel or sequentially)
async function executeGroup(group, parallel) {
  if (parallel && group.length > 1) {
    console.log(`\n🚀 Running ${group.length} segments in parallel: ${group.join(', ')}`);
    const results = await Promise.all(group.map(segment => executeSegment(segment)));
    return results;
  } else {
    const results = [];
    for (const segment of group) {
      const result = await executeSegment(segment);
      results.push(result);
      
      // Fail fast if configured and a blocking test failed
      if (options.failFast && !result.success && result.blocking) {
        console.error(`\n❌ Stopping due to failure in blocking segment: ${segment}`);
        break;
      }
    }
    return results;
  }
}

// Main execution function
async function run() {
  console.log(`\n🧪 Card-Show-Finder Test Segments Runner (${options.ci ? 'CI' : 'local'} mode)`);
  console.log(`📊 Running ${segmentsToRun.length} segments: ${segmentsToRun.join(', ')}`);
  
  if (segmentsToRun.length === 0) {
    console.log('No segments specified. Use --help for usage information.');
    return;
  }
  
  const startTime = Date.now();
  const results = [];
  
  try {
    // Sort segments based on dependencies
    const sortedSegments = sortSegments(segmentsToRun);
    
    if (options.parallel) {
      // Group segments for parallel execution
      const groups = groupSegmentsForParallel(sortedSegments);
      
      for (const group of groups) {
        const groupResults = await executeGroup(group, group.length > 1);
        results.push(...groupResults);
        
        // Check if we should stop due to failures
        if (options.failFast && groupResults.some(r => !r.success && r.blocking)) {
          break;
        }
      }
    } else {
      // Sequential execution
      for (const segment of sortedSegments) {
        const result = await executeSegment(segment);
        results.push(result);
        
        // Fail fast if configured and a blocking test failed
        if (options.failFast && !result.success && result.blocking) {
          console.error(`\n❌ Stopping due to failure in blocking segment: ${segment}`);
          break;
        }
      }
    }
    
    // Calculate summary
    const endTime = Date.now();
    const totalDuration = (endTime - startTime) / 1000;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const blockingFailures = results.filter(r => !r.success && r.blocking).length;
    
    console.log('\n📝 Test Summary:');
    console.log(`Total time: ${totalDuration.toFixed(2)}s`);
    console.log(`Segments: ${results.length} (${successCount} passed, ${failureCount} failed)`);
    
    if (failureCount > 0) {
      console.log('\nFailures:');
      results.filter(r => !r.success).forEach(result => {
        const emoji = result.blocking ? '❌' : '⚠️';
        console.log(`${emoji} ${result.segment} (${result.blocking ? 'blocking' : 'non-blocking'})`);
      });
    }
    
    // Save report if requested
    if (options.report) {
      const report = {
        date: new Date().toISOString(),
        totalDuration,
        segments: results,
        summary: {
          total: results.length,
          passed: successCount,
          failed: failureCount,
          blockingFailures
        }
      };
      
      fs.writeFileSync(options.report, JSON.stringify(report, null, 2));
      console.log(`\n📊 Report saved to ${options.report}`);
    }
    
    // Exit with appropriate code
    process.exit(blockingFailures > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Error running tests:', error);
    process.exit(1);
  }
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  const scriptName = path.basename(__filename);
  console.log(`
Test Segments Orchestration Script
Card-Show-Finder · July 2025

Usage:
  node ${scriptName} [options] [segments...]

Options:
  --parallel         Run compatible segments in parallel
  --ci               CI mode (different output formatting, stricter)
  --timing-only      Only show timing, no test output
  --fail-fast        Stop on first segment failure
  --report=<path>    Save JSON report to file
  --update-baseline  Update performance baselines
  --help, -h         Show this help message

Segments:
${Object.entries(SEGMENTS).map(([name, config]) => 
  `  ${name.padEnd(18)} ${config.description} (${config.blocking ? 'blocking' : 'non-blocking'})`
).join('\n')}
  
Combinations:
${Object.entries(COMBINATIONS).map(([name, segments]) => 
  `  ${name.padEnd(18)} ${segments.join(' + ')}`
).join('\n')}
  
Examples:
  node ${scriptName} lint type unit
  node ${scriptName} fast --timing-only
  node ${scriptName} ci --parallel --ci
  node ${scriptName} full --report=test-report.json
  `);
  process.exit(0);
}

// Run the tests
run();
