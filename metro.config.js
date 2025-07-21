// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the default Expo configuration
const defaultConfig = getDefaultConfig(__dirname);

// Configure Metro with Node.js polyfills
module.exports = {
  ...defaultConfig,
  
  // Configure the resolver with Node.js polyfills
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
    // Add Node.js module polyfills
    extraNodeModules: {
      // Map 'buffer' imports to the buffer polyfill package
      'buffer': path.resolve(__dirname, 'node_modules/buffer'),
      // Add other Node.js polyfills if needed
      'stream': path.resolve(__dirname, 'node_modules/readable-stream'),
      'crypto': path.resolve(__dirname, 'node_modules/react-native-crypto'),
      'process': path.resolve(__dirname, 'node_modules/process')
    }
  },
  
  // Configure the transformer with Hermes support
  transformer: {
    ...defaultConfig.transformer,
    // Enable hermes transform
    hermesEnabled: true,
    // Preserve class names and function names for better debugging
    minifierConfig: {
      keep_classnames: true, // Helps with TypeScript inheritance
      keep_fnames: true      // Helps with function names in stack traces
    }
  }
};
