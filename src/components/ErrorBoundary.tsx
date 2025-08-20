import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as Sentry from 'sentry-expo';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary component that catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 * 
 * With custom fallback:
 * ```tsx
 * <ErrorBoundary fallback={<CustomErrorView onRetry={() => {}} />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
    this.resetError = this.resetError.bind(this);
  }

  /**
   * Update state so the next render will show the fallback UI.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Log the error to Sentry if available.
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Report to Sentry if available
    try {
      if (Sentry && Sentry.Native && typeof Sentry.Native.captureException === 'function') {
        Sentry.Native.captureException(error, {
          extra: {
            componentStack: errorInfo.componentStack,
            ...(__DEV__ ? { devMode: true } : {}),
          },
          tags: {
            errorSource: 'ReactErrorBoundary',
            platform: Platform.OS,
          },
        });
      }
    } catch (sentryError) {
      // Fail silently if Sentry reporting fails
      if (__DEV__) {
        console.error('Failed to report error to Sentry:', sentryError);
      }
    }

    // Log to console in development
    if (__DEV__) {
      console.error('Error caught by ErrorBoundary:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  /**
   * Reset the error state to re-render the children.
   */
  resetError(): void {
    this.setState({ hasError: false, error: undefined });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Otherwise, use the default fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorMessage}>
              The app encountered an unexpected error.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.resetError}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Reload</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // When there's no error, render children normally
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#dc3545',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#343a40',
  },
  retryButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ErrorBoundary;
