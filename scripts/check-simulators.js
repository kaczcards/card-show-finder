#!/usr/bin/env node
/**
 * iOS Simulator Availability Checker
 * 
 * This script checks what iOS simulators are available on the current system
 * and provides recommendations for Detox configuration based on availability.
 * 
 * Usage:
 *   node scripts/check-simulators.js
 * 
 * Options:
 *   --json    Output results in JSON format
 *   --ci      Format output for CI environments (more concise)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG_FILES = [
  '.detoxrc.js',
  '.detoxrc.minimal.js'
];

// Main function
async function checkSimulators() {
  console.log('📱 iOS Simulator Availability Checker');
  console.log('=====================================');
  
  // Check if running on macOS
  if (process.platform !== 'darwin') {
    console.error('❌ This script requires macOS to run xcrun commands.');
    console.log('💡 If you\'re running in CI, make sure to use a macOS runner.');
    process.exit(1);
  }
  
  try {
    // Get available simulators
    console.log('🔍 Checking available iOS simulators...');
    const simulators = getAvailableSimulators();
    
    // Group by device type and iOS version
    const deviceGroups = groupSimulators(simulators);
    
    // Display results
    displayResults(deviceGroups);
    
    // Check current Detox configuration
    checkDetoxConfig(deviceGroups);
    
    // Provide recommendations
    provideRecommendations(deviceGroups);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * Get available iOS simulators by running xcrun command
 */
function getAvailableSimulators() {
  try {
    const output = execSync('xcrun simctl list devices available --json', { encoding: 'utf8' });
    const data = JSON.parse(output);
    
    // Extract simulator data
    const simulators = [];
    Object.entries(data.devices).forEach(([runtimeId, devices]) => {
      // Extract iOS version from runtime ID (e.g., "com.apple.CoreSimulator.SimRuntime.iOS-16-4")
      const match = runtimeId.match(/iOS-(\d+)-(\d+)/);
      if (!match) return;
      
      const majorVersion = parseInt(match[1], 10);
      const minorVersion = parseInt(match[2], 10);
      const iosVersion = `${majorVersion}.${minorVersion}`;
      
      devices.forEach(device => {
        simulators.push({
          name: device.name,
          udid: device.udid,
          state: device.state,
          isAvailable: device.isAvailable,
          iosVersion,
          runtimeId
        });
      });
    });
    
    return simulators;
  } catch (error) {
    throw new Error(`Failed to get simulator list: ${error.message}`);
  }
}

/**
 * Group simulators by device type and iOS version
 */
function groupSimulators(simulators) {
  const deviceGroups = {};
  const versionGroups = {};
  
  simulators.forEach(sim => {
    // Group by device type
    if (!deviceGroups[sim.name]) {
      deviceGroups[sim.name] = [];
    }
    deviceGroups[sim.name].push(sim);
    
    // Group by iOS version
    if (!versionGroups[sim.iosVersion]) {
      versionGroups[sim.iosVersion] = [];
    }
    versionGroups[sim.iosVersion].push(sim);
  });
  
  return {
    byDevice: deviceGroups,
    byVersion: versionGroups,
    all: simulators
  };
}

/**
 * Display simulator results
 */
function displayResults(deviceGroups) {
  console.log('\n📊 Available iOS Simulators:');
  console.log('---------------------------');
  
  // Show device types
  console.log('\n📱 Device Types:');
  const deviceTypes = Object.keys(deviceGroups.byDevice).sort();
  deviceTypes.forEach(deviceType => {
    const versions = deviceGroups.byDevice[deviceType]
      .map(sim => sim.iosVersion)
      .sort((a, b) => {
        const [aMajor, aMinor] = a.split('.').map(Number);
        const [bMajor, bMinor] = b.split('.').map(Number);
        return bMajor - aMajor || bMinor - aMinor; // Sort in descending order
      });
    
    console.log(`  - ${deviceType}: iOS ${versions.join(', ')}`);
  });
  
  // Show iOS versions
  console.log('\n📊 iOS Versions:');
  const iosVersions = Object.keys(deviceGroups.byVersion).sort((a, b) => {
    const [aMajor, aMinor] = a.split('.').map(Number);
    const [bMajor, bMinor] = b.split('.').map(Number);
    return bMajor - aMajor || bMinor - aMinor; // Sort in descending order
  });
  
  iosVersions.forEach(version => {
    const devices = deviceGroups.byVersion[version]
      .map(sim => sim.name)
      .filter((v, i, a) => a.indexOf(v) === i) // Unique values
      .sort();
    
    console.log(`  - iOS ${version}: ${devices.join(', ')}`);
  });
  
  // Summary
  console.log(`\n✅ Total: ${deviceGroups.all.length} simulators, ${deviceTypes.length} device types, ${iosVersions.length} iOS versions`);
}

/**
 * Check current Detox configuration
 */
function checkDetoxConfig(deviceGroups) {
  console.log('\n🔍 Checking Detox Configuration:');
  console.log('------------------------------');
  
  let configsFound = 0;
  
  CONFIG_FILES.forEach(configFile => {
    const configPath = path.join(process.cwd(), configFile);
    
    if (fs.existsSync(configPath)) {
      configsFound++;
      console.log(`\n📄 ${configFile}:`);
      
      try {
        // Clear require cache to ensure we get fresh config
        delete require.cache[require.resolve(configPath)];
        
        const config = require(configPath);
        const devices = config.devices || {};
        
        Object.entries(devices).forEach(([key, device]) => {
          if (device.type === 'ios.simulator') {
            const deviceType = device.device?.type;
            const deviceOS = device.device?.os;
            
            console.log(`  - Device "${key}":`);
            console.log(`    - Type: ${deviceType || 'Not specified'}`);
            console.log(`    - OS: ${deviceOS || 'Not specified (recommended)'}`);
            
            // Check if this device type exists
            if (deviceType) {
              const exists = Object.keys(deviceGroups.byDevice).some(
                name => name.toLowerCase() === deviceType.toLowerCase()
              );
              
              if (exists) {
                console.log(`    - Status: ✅ Device type "${deviceType}" is available`);
              } else {
                console.log(`    - Status: ❌ Device type "${deviceType}" not found in available simulators`);
              }
            }
            
            // Check if the OS version exists
            if (deviceOS) {
              const exists = Object.keys(deviceGroups.byVersion).includes(deviceOS);
              
              if (exists) {
                console.log(`    - Status: ✅ iOS ${deviceOS} is available`);
              } else {
                console.log(`    - Status: ❌ iOS ${deviceOS} not found in available simulators`);
                console.log(`    - Recommendation: Remove explicit OS version or update to an available version`);
              }
            } else {
              console.log(`    - Status: ✅ No explicit OS version (recommended for CI)`);
            }
          }
        });
      } catch (error) {
        console.log(`  ❌ Error parsing config: ${error.message}`);
      }
    }
  });
  
  if (configsFound === 0) {
    console.log('❌ No Detox configuration files found.');
  }
}

/**
 * Provide recommendations based on available simulators
 */
function provideRecommendations(deviceGroups) {
  console.log('\n💡 Recommendations for Detox Configuration:');
  console.log('----------------------------------------');
  
  // Find most widely available device types
  const deviceCounts = {};
  Object.keys(deviceGroups.byDevice).forEach(deviceType => {
    deviceCounts[deviceType] = deviceGroups.byDevice[deviceType].length;
  });
  
  // Sort device types by availability (number of iOS versions)
  const sortedDevices = Object.entries(deviceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([device, count]) => ({ device, count }));
  
  // Get the top 3 most available device types
  const recommendedDevices = sortedDevices.slice(0, 3);
  
  console.log('\n📱 Recommended device types (most widely available):');
  recommendedDevices.forEach(({ device, count }, index) => {
    console.log(`  ${index + 1}. ${device} (available with ${count} iOS versions)`);
  });
  
  // Find latest iOS versions
  const latestVersions = Object.keys(deviceGroups.byVersion)
    .sort((a, b) => {
      const [aMajor, aMinor] = a.split('.').map(Number);
      const [bMajor, bMinor] = b.split('.').map(Number);
      return bMajor - aMajor || bMinor - aMinor; // Sort in descending order
    })
    .slice(0, 3);
  
  console.log('\n📊 Latest iOS versions available:');
  latestVersions.forEach((version, index) => {
    const devices = deviceGroups.byVersion[version]
      .map(sim => sim.name)
      .filter((v, i, a) => a.indexOf(v) === i) // Unique values
      .sort();
    
    console.log(`  ${index + 1}. iOS ${version} (available on: ${devices.join(', ')})`);
  });
  
  // Sample configuration
  console.log('\n📝 Recommended Detox configuration:');
  console.log('```javascript');
  console.log('devices: {');
  console.log('  \'simulator\': {');
  console.log('    type: \'ios.simulator\',');
  console.log('    device: {');
  console.log(`      type: '${recommendedDevices[0]?.device || 'iPhone 14'}'`);
  console.log('      // Do NOT specify OS version for CI compatibility');
  console.log('    }');
  console.log('  }');
  console.log('}');
  console.log('```');
  
  console.log('\n⚠️  Important CI Notes:');
  console.log('1. GitHub Actions macOS runners update Xcode frequently, changing available simulators');
  console.log('2. Avoid pinning specific iOS versions in Detox config for CI environments');
  console.log('3. Use widely available device types (iPhone 14, iPhone 13, etc.)');
  console.log('4. Consider adding fallback device configurations for older simulators');
}

// Run the script
checkSimulators().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
