/**
 * test-social-icons.js
 * 
 * A simple test script to verify that the social media icons are working properly
 * and can be imported without errors.
 * 
 * Usage:
 * 1. Import this component in your App.tsx or any screen
 * 2. Render it to see all social icons with different sizes and configurations
 * 
 * Example:
 * import TestSocialIcons from './test-social-icons';
 * 
 * // In your render function
 * return <TestSocialIcons />;
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import SocialIcon from './src/components/ui/SocialIcon';

const TestSocialIcons = () => {
  const [iconSize, setIconSize] = useState(20);
  const [showBackground, setShowBackground] = useState(true);
  
  // All supported social platforms
  const platforms = ['facebook', 'instagram', 'twitter', 'whatnot', 'ebay'];
  
  // Test function for icon press
  const handleIconPress = (platform) => {
    Alert.alert(`${platform} Icon Pressed`, `You pressed the ${platform} icon`);
  };
  
  // Error handling for imports
  const verifyImports = () => {
    try {
      // Test importing the images directly to verify paths
      const whatnotLogo = require('./assets/images/social/whatnot-logo.png');
      const ebayLogo = require('./assets/images/social/ebay-logo.png');
      
      Alert.alert(
        'Import Check Passed',
        'All social media icon assets were imported successfully!'
      );
    } catch (error) {
      Alert.alert(
        'Import Error',
        `Failed to import social media icons: ${error.message}`
      );
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Social Icons Test</Text>
        
        {/* Test all platforms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Social Platforms</Text>
          <View style={styles.iconsRow}>
            {platforms.map((platform) => (
              <SocialIcon
                key={platform}
                platform={platform}
                onPress={() => handleIconPress(platform)}
                size={iconSize}
                style={showBackground ? styles.iconWithBackground : styles.iconTransparent}
              />
            ))}
          </View>
        </View>
        
        {/* Size controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Icon Size: {iconSize}px</Text>
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setIconSize(Math.max(10, iconSize - 5))}
            >
              <Text style={styles.buttonText}>Smaller</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.button}
              onPress={() => setIconSize(Math.min(50, iconSize + 5))}
            >
              <Text style={styles.buttonText}>Larger</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Background toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Background</Text>
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.button, showBackground && styles.activeButton]}
              onPress={() => setShowBackground(true)}
            >
              <Text style={styles.buttonText}>With Background</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, !showBackground && styles.activeButton]}
              onPress={() => setShowBackground(false)}
            >
              <Text style={styles.buttonText}>Transparent</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Individual platform tests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Individual Icons</Text>
          
          <View style={styles.platformRow}>
            <Text style={styles.platformLabel}>Whatnot:</Text>
            <SocialIcon
              platform="whatnot"
              onPress={() => handleIconPress('whatnot')}
              size={iconSize}
              style={showBackground ? styles.iconWithBackground : styles.iconTransparent}
            />
          </View>
          
          <View style={styles.platformRow}>
            <Text style={styles.platformLabel}>eBay:</Text>
            <SocialIcon
              platform="ebay"
              onPress={() => handleIconPress('ebay')}
              size={iconSize}
              style={showBackground ? styles.iconWithBackground : styles.iconTransparent}
            />
          </View>
        </View>
        
        {/* Import verification */}
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={verifyImports}
        >
          <Text style={styles.verifyButtonText}>Verify Icon Imports</Text>
        </TouchableOpacity>
        
        <Text style={styles.footer}>
          If all icons display correctly and the verification passes, the implementation is working!
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  iconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  iconWithBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  iconTransparent: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    backgroundColor: 'transparent',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#0056b3',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformLabel: {
    fontSize: 16,
    width: 80,
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    marginBottom: 40,
  },
});

export default TestSocialIcons;
