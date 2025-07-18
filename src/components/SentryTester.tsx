import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Alert
} from 'react-native';
import {
  captureException,
  captureMessage,
  addBreadcrumb,
  startTransaction,
  SentryRaw
} from '../services/sentryConfig';

/**
 * SentryTester component provides a UI to test various Sentry features.
 * This is useful during development to ensure Sentry is properly integrated
 * and to demonstrate how different error scenarios are handled.
 */
const SentryTester: React.FC = () => {
  const [lastAction, setLastAction] = useState<string>('');
  
  // Function to trigger a JavaScript error
  const triggerError = () => {
    try {
      // Intentionally cause an error
      const nullObject: any = null;
      nullObject.nonExistentMethod();
    } catch (error) {
      if (error instanceof Error) {
        captureException(error);
        setLastAction(`Error captured: ${error.message}`);
      }
    }
  };

  // Function to trigger an unhandled promise rejection
  const triggerUnhandledPromiseRejection = () => {
    setLastAction('Triggering unhandled promise rejection...');
    // This will cause an unhandled promise rejection
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('This is an unhandled promise rejection'));
      }, 100);
    });
  };

  // Function to trigger a fatal JavaScript error
  const triggerFatalError = () => {
    setLastAction('Triggering fatal error...');
    Alert.alert(
      'Trigger Fatal Error',
      'This will crash the app. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, Crash It',
          onPress: () => {
            // This will cause a fatal error and crash the app
            const badArray = [];
            // @ts-ignore - Intentionally causing an error
            badArray[999999].nonExistentProperty.nonExistentMethod();
          },
        },
      ],
    );
  };

  // Function to send a custom message with different severity levels
  const sendMessage = (level: 'debug' | 'info' | 'warning' | 'error') => {
    captureMessage(`Test ${level} message from SentryTester`, level, {
      tags: {
        source: 'SentryTester',
        testType: 'message',
      },
      extra: {
        timestamp: new Date().toISOString(),
      },
    });
    setLastAction(`${level} message sent to Sentry`);
  };

  // Function to test breadcrumbs
  const testBreadcrumbs = () => {
    // Add a series of breadcrumbs
    addBreadcrumb({
      category: 'test',
      message: 'First breadcrumb',
      level: 'info',
    });
    
    setTimeout(() => {
      addBreadcrumb({
        category: 'test',
        message: 'Second breadcrumb',
        level: 'info',
      });
    }, 500);
    
    setTimeout(() => {
      addBreadcrumb({
        category: 'test',
        message: 'Third breadcrumb',
        level: 'warning',
        data: {
          testId: 123,
          action: 'breadcrumb-test',
        },
      });
      
      // Trigger an error after breadcrumbs are set
      try {
        throw new Error('Error after breadcrumbs');
      } catch (error) {
        if (error instanceof Error) {
          captureException(error);
          setLastAction('Breadcrumbs test completed with error');
        }
      }
    }, 1000);
    
    setLastAction('Adding breadcrumbs...');
  };

  // Function to test performance monitoring
  const testPerformance = async () => {
    const transaction = startTransaction('test-transaction', 'test');
    
    setLastAction('Starting performance test...');
    
    // Add a span to measure a specific operation
    const span = transaction.startChild({
      op: 'test-operation',
      description: 'Test operation for Sentry performance monitoring',
    });
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Finish the span
    span.finish();
    
    // Add another span
    const span2 = transaction.startChild({
      op: 'another-operation',
      description: 'Another test operation',
    });
    
    // Simulate more work
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Finish the second span
    span2.finish();
    
    // Finish the transaction
    transaction.finish();
    
    setLastAction('Performance test completed');
  };

  // Function to test user feedback
  const testUserFeedback = () => {
    try {
      throw new Error('Error for user feedback');
    } catch (error) {
      if (error instanceof Error) {
        // Capture the error and get the event ID
        const eventId = SentryRaw.Native.captureException(error);
        
        // Show the user feedback dialog
        SentryRaw.Native.showReportDialog({
          eventId,
          title: 'Report Feedback',
          subtitle: 'Tell us what happened',
          subtitle2: 'Your feedback helps us improve',
          user: {
            email: 'test@example.com',
            name: 'Test User',
          },
        });
        
        setLastAction('User feedback dialog shown');
      }
    }
  };

  // Function to test setting context
  const testSetContext = () => {
    SentryRaw.Native.setContext('test-context', {
      testKey1: 'testValue1',
      testKey2: true,
      testKey3: 123,
      timestamp: new Date().toISOString(),
    });
    
    setLastAction('Context set - will be included with next error');
    
    // Trigger an error to include the context
    setTimeout(() => {
      try {
        throw new Error('Error with custom context');
      } catch (error) {
        if (error instanceof Error) {
          captureException(error);
          setLastAction('Error with custom context captured');
        }
      }
    }, 500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Sentry Testing Tool</Text>
          <Text style={styles.description}>
            Use the buttons below to test Sentry integration features.
            Check your Sentry dashboard to verify events are being captured.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Error Capturing</Text>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={triggerError}
          >
            <Text style={styles.buttonText}>Trigger Handled Error</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={triggerUnhandledPromiseRejection}
          >
            <Text style={styles.buttonText}>Trigger Unhandled Promise Rejection</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.dangerButton]} 
            onPress={triggerFatalError}
          >
            <Text style={styles.buttonText}>Trigger Fatal Error (App Crash)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message Capturing</Text>
          
          <TouchableOpacity 
            style={[styles.button, styles.infoButton]} 
            onPress={() => sendMessage('info')}
          >
            <Text style={styles.buttonText}>Send Info Message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.warningButton]} 
            onPress={() => sendMessage('warning')}
          >
            <Text style={styles.buttonText}>Send Warning Message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.errorButton]} 
            onPress={() => sendMessage('error')}
          >
            <Text style={styles.buttonText}>Send Error Message</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Features</Text>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testBreadcrumbs}
          >
            <Text style={styles.buttonText}>Test Breadcrumbs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testPerformance}
          >
            <Text style={styles.buttonText}>Test Performance Monitoring</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testSetContext}
          >
            <Text style={styles.buttonText}>Test Custom Context</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testUserFeedback}
          >
            <Text style={styles.buttonText}>Test User Feedback</Text>
          </TouchableOpacity>
        </View>

        {lastAction ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultLabel}>Last Action:</Text>
            <Text style={styles.resultText}>{lastAction}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#343a40',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#6c757d',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#343a40',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  infoButton: {
    backgroundColor: '#17a2b8',
  },
  warningButton: {
    backgroundColor: '#ffc107',
  },
  errorButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 14,
    color: '#212529',
  },
});

export default SentryTester;
