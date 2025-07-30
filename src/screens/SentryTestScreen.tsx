import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import SentryTester from '../components/SentryTester';

/**
 * SentryTestScreen
 * 
 * This screen provides a UI for testing Sentry integration features.
 * It allows developers to trigger various error scenarios and verify
 * that they are properly captured in the Sentry dashboard.
 */
const SentryTestScreen: React.FC = () => {
  const _navigation = useNavigation<NativeStackNavigationProp<any>>();

  // Set navigation options
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Sentry Testing',
      headerBackTitle: 'Back',
    });
  }, [_navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Sentry Error Reporting</Text>
          <Text style={styles.headerDescription}>
            This screen allows you to test Sentry error reporting functionality.
            Use the tools below to generate different types of errors and check
            that they appear correctly in your Sentry dashboard.
          </Text>
        </View>
        
        <View style={styles.divider} />
        
        {/* The SentryTester component contains all the testing functionality */}
        <SentryTester />
        
        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            Note: Make sure you have set up your EXPO_PUBLIC_SENTRY_DSN in the .env file
            and configured your Sentry project correctly.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  headerContainer: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#343a40',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 16,
    color: '#6c757d',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#dee2e6',
    marginVertical: 16,
  },
  noteContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#6c757d',
  },
  noteText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
});

export default SentryTestScreen;
