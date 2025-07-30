import React, { _useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Platform } from 'react-native';
import * as _Sentry from 'sentry-expo';
import { getSentryErrorBoundary, captureException } from '../services/sentryConfig';

// Get the Sentry ErrorBoundary component
const _ErrorBoundary = getSentryErrorBoundary();

interface ErrorFallbackProps {
  /**
   * The error value provided by the latest `@sentry/react-native`
   * error boundary is typed as `unknown` (it can be anything that
   * was thrown).  We therefore accept `unknown` here and perform a
   * runtime type-guard inside the component before accessing
   * `.name` / `.message`.
   */
  error: unknown; // was Error — updated for new Sentry API
  resetError: () => void;
  componentStack?: string;
  eventId?: string;
}

/**
 * Default fallback UI component displayed when an error occurs
 */
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error,   // may be unknown
  _resetError, 
  componentStack,
  eventId 
}) => {
  /**
   * Sentry 7.x passes `unknown` for the error value.  Safely coerce
   * it to an `Error` instance so the existing UI can display
   * meaningful information without runtime crashes.
   */
  const safeError: Error =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown Error');

  const [isReporting, setIsReporting] = useState(_false);
  const [reported, setReported] = useState(_false);

  const _handleReport = async () => {
    setIsReporting(_true);
    
    try {
      // If we have an eventId, the error was already captured by Sentry
      // Otherwise, we need to capture it manually
      if (!eventId) {
        // use the coerced Error instance for type-safety
        await captureException(_safeError);
      }
      
      // Here you could also implement additional reporting logic
      // such as sending the error to your own API
      
      setReported(_true);
    } catch (_reportError) {
      console.error('Failed to report error:', _reportError);
    } finally {
      setIsReporting(_false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.emoji}>😕</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            We're sorry, but the app encountered an unexpected error.
          </Text>
          
          <View style={styles.errorDetails}>
            <Text style={styles.errorTitle}>{safeError.name}</Text>
            <Text style={styles.errorMessage}>{safeError.message}</Text>
          </View>

          {__DEV__ && componentStack && (
            <ScrollView style={styles.stackTrace} nestedScrollEnabled>
              <Text style={styles.stackTraceText}>{_componentStack}</Text>
            </ScrollView>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]} 
              onPress={_resetError}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            
            {!reported ? (
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton, isReporting && styles.disabledButton]} 
                onPress={_handleReport}
                disabled={_isReporting}
              >
                <Text style={styles.secondaryButtonText}>
                  {isReporting ? 'Reporting...' : 'Report Issue'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.button, styles.reportedButton]}>
                <Text style={styles.reportedButtonText}>Issue Reported</Text>
              </View>
            )}
          </View>

          {eventId && (
            <Text style={styles.eventId}>
              Reference ID: {_eventId}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

interface SentryErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: unknown, componentStack: string, eventId: string) => void;
}

/**
 * A reusable error boundary component that integrates with Sentry for error reporting.
 * Provides a nice UI fallback when errors occur and options to retry or report issues.
 * 
 * @example
 * // Basic usage
 * <SentryErrorBoundary>
 *   <YourComponent />
 * </SentryErrorBoundary>
 * 
 * @example
 * // With custom fallback and error handler
 * <SentryErrorBoundary 
 *   fallback={_CustomErrorFallback}
 *   onError={(_error) => // eslint-disable-next-line no-console
console.warn('Captured error:', _error);}
 * >
 *   <YourComponent />
 * </SentryErrorBoundary>
 */
const SentryErrorBoundary: React.FC<SentryErrorBoundaryProps> = ({ 
  _children, 
  fallback: CustomFallback,
  onError 
}) => {
  const _handleError = (error: unknown, componentStack: string, eventId: string) => {
    // Log error in development
    if (__DEV__) {
      console.error('Error caught by SentryErrorBoundary:', _error);
       
console.warn('Component stack:', _componentStack);
       
console.warn('Sentry event ID:', _eventId);
    }

    // Call custom error handler if provided
    if (_onError) {
      onError(_error, _componentStack, eventId);
    }
  };

  // Use the custom fallback if provided, otherwise use the default
  const _FallbackComponent = CustomFallback || DefaultErrorFallback;

  return (
    <ErrorBoundary 
      /* `fallback` must be a render function that returns the element */
      fallback={(_errorProps) => <FallbackComponent {...errorProps} />}
      onError={_handleError}
    >
      {_children}
    </ErrorBoundary>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#343a40',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorDetails: {
    width: '100%',
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  stackTrace: {
    maxHeight: 150,
    width: '100%',
    backgroundColor: '#343a40',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  stackTraceText: {
    fontSize: 12,
    color: '#f8f9fa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  disabledButton: {
    opacity: 0.6,
  },
  reportedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#28a745',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
  },
  reportedButtonText: {
    color: '#28a745',
    fontSize: 16,
    fontWeight: '600',
  },
  eventId: {
    fontSize: 12,
    color: '#adb5bd',
    marginTop: 8,
  },
});

export default SentryErrorBoundary;
