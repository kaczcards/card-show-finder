// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the default Expo configuration
const defaultConfig = getDefaultConfig(__dirname);

// Configure Metro with minimal customizations
module.exports = {
  ...defaultConfig,
  
  // Configure the resolver with minimal customizations
  resolver: {
    ...defaultConfig.resolver,
    // Ensure these file extensions are properly resolved
    sourceExts: [
      ...defaultConfig.resolver.sourceExts,
      'jsx', 'js', 'ts', 'tsx', 'cjs', 'mjs', 'json'
    ],
    // Ensure node_modules are properly resolved
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
    ],
  },
  
  // Configure the transformer with minimal customizations
  transformer: {
    ...defaultConfig.transformer,
    // Enable Hermes transform for production
    hermesEnabled: true
  }
};
