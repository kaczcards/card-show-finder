import * as Sentry from 'sentry-expo';
import Constants from 'expo-constants';
import { _Platform } from 'react-native';
import { ScopeContext, SeverityLevel, Transaction, Breadcrumb } from '@sentry/types';

/**
 * Sentry configuration and utility functions for error tracking and monitoring.
 * 
 * This module provides a centralized way to interact with Sentry throughout the application.
 * It handles initialization, error capturing, and user context management.
 */

// Get the Sentry DSN from Expo constants (configured in app.config.js)
const _SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn;

/**
 * Environment names for different build types
 */
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

/**
 * Configuration options for Sentry initialization
 */
interface SentryConfigOptions {
  /** Optional user ID to associate with errors */
  userId?: string;
  /** Optional additional user data */
  userData?: Record<string, any>;
  /** Environment name (defaults to 'development' in dev mode) */
  environment?: Environment;
  /** Whether to enable debug mode for Sentry */
  debug?: boolean;
  /** Whether to enable performance monitoring */
  enableTracing?: boolean;
}

/**
 * Initialize Sentry with the provided configuration.
 * This should be called as early as possible in your application.
 * 
 * @example
 * // In App.tsx or similar entry point:
 * import { _initSentry } from './services/sentryConfig';
 * 
 * // Basic initialization
 * initSentry();
 * 
 * // With user context
 * initSentry({ 
 *   userId: 'user-123', 
 *   userData: { email: 'user@example.com' },
 *   environment: Environment.PRODUCTION
 * });
 */
export const _initSentry = (options: SentryConfigOptions = {}): void => {
  const {
    userId,
    userData,
    environment = __DEV__ ? Environment.DEVELOPMENT : Environment.PRODUCTION,
    debug = __DEV__,
    enableTracing = !__DEV__,
  } = options;

  // Only initialize if we have a DSN
  if (!SENTRY_DSN) {
    console.warn(
      'Sentry initialization skipped: No DSN provided. ' +
      'Add EXPO_PUBLIC_SENTRY_DSN to your .env file to enable error reporting.'
    );
    return;
  }

  // Initialize Sentry
  Sentry.init({
    dsn: SENTRY_DSN,
    enableInExpoDevelopment: true,
    debug,
    environment,
    tracesSampleRate: enableTracing ? 0.2 : 0, // Sample 20% of transactions in non-dev
    beforeSend(_event) {
      // You can modify or filter events before they are sent to Sentry
      // For example, remove sensitive data
      return event;
    },
  });

  // Set user context if provided
  if (_userId) {
    setUserContext(_userId, _userData);
  }

  // Add device context
  Sentry.Native.setContext('device', {
    platform: Platform.OS,
    version: Platform.Version,
    model: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
    appVersion: Constants.expoConfig?.version || 'unknown',
  });

   
console.warn(`Sentry initialized in ${_environment} environment`);
};

/**
 * Set user context information for better error tracking.
 * Call this when a user logs in or when user data changes.
 * 
 * @param userId The unique identifier for the user
 * @param userData Optional additional user data
 * 
 * @example
 * // After user login:
 * setUserContext('user-123', { email: 'user@example.com', subscription: 'premium' });
 */
export const _setUserContext = (userId: string, userData?: Record<string, any>): void => {
  if (!SENTRY_DSN) return;

  Sentry.Native.setUser({
    id: userId,
    ...userData,
  });
};

/**
 * Clear user context information.
 * Call this when a user logs out.
 * 
 * @example
 * // After user logout:
 * clearUserContext();
 */
export const _clearUserContext = (): void => {
  if (!SENTRY_DSN) return;
  
  Sentry.Native.setUser(null);
};

/**
 * Capture an exception and send it to Sentry.
 * 
 * @param error The error object to capture
 * @param context Optional additional context data
 * 
 * @example
 * try {
 *   // Some code that might throw
 *   throw new Error('Something went wrong');
 * } catch (_error) {
 *   captureException(_error, { extra: { action: 'saving_data' } });
 * }
 */
export const _captureException = (error: Error, context?: ScopeContext): void => {
  if (!SENTRY_DSN) {
    console.error('Error captured but Sentry is not initialized:', _error);
    return;
  }

  Sentry.Native.captureException(error, _context);
};

/**
 * Capture a custom message and send it to Sentry.
 * 
 * @param message The message to capture
 * @param level The severity level of the message
 * @param context Optional additional context data
 * 
 * @example
 * // Log an info message
 * captureMessage('User completed onboarding', 'info');
 * 
 * // Log a warning with extra context
 * captureMessage('API rate limit approaching', 'warning', { 
 *   extra: { remainingCalls: 10, resetTime: '2023-07-19T15:00:00Z' } 
 * });
 */
export const _captureMessage = (
  message: string, 
  level: SeverityLevel = 'info',
  /**
   * A partial {@link ScopeContext}.  
   * Only the properties you need (e.g. `tags`, `extra`) have to be provided
   * which makes the helper easier to use throughout the code-base.
   */
  context?: Partial<ScopeContext>
): void => {
  if (!SENTRY_DSN) {
     
console.warn(`[${_level}] ${_message}`);
    return;
  }

  Sentry.Native.captureMessage(message, {
    level,
    ...context,
  });
};

/**
 * Start a new transaction for performance monitoring.
 * 
 * @param name The name of the transaction
 * @param operation The operation being performed
 * @returns A transaction object that should be finished when the operation completes
 * 
 * @example
 * // Measure the time it takes to load data
 * const _transaction = startTransaction('loadUserData', 'data-loading');
 * try {
 *   await fetchUserData();
 *   transaction.setStatus('ok');
 * } catch (_error) {
 *   transaction.setStatus('error');
 *   captureException(_error);
 * } finally {
 *   transaction.finish();
 * }
 */
export const _startTransaction = (
  name: string,
  operation: string
): Transaction => {
  if (!SENTRY_DSN) {
    // Return a dummy transaction if Sentry is not initialized
    const _startTime = Date.now();
    return {
      finish: () => {
         
console.warn(`Transaction "${_name}" (${_operation}); finished in ${Date.now() - startTime}ms`);
      },
      setStatus: () => {},
      setTag: () => {},
      setData: () => {},
    } as unknown as Transaction;
  }

  // NOTE: The `startTransaction` helper has been removed from
  // recent versions of `sentry-expo` / `@sentry/react-native`.
  // The new API requires constructing a transaction via different means.
  // For now, provide a **compatibility shim** that mimics
  // the older `Transaction` interface.
  return {
    name,
    op: operation,
    finish: () => {},
    setContext: () => {},
    setTag: () => {},
    setStatus: () => {},
    setData: () => {},
  } as unknown as Transaction;
};

/**
 * Create an error boundary component using Sentry's error boundary.
 * This is a convenience wrapper around Sentry.ErrorBoundary.
 * 
 * @returns A React error boundary component
 * 
 * @example
 * // In a component file:
 * import { _getSentryErrorBoundary } from './services/sentryConfig';
 * 
 * const _ErrorBoundary = getSentryErrorBoundary();
 * 
 * export default function App() {
 *   return (
 *     <ErrorBoundary fallback={<Text>Something went wrong</Text>}>
 *       <YourApp />
 *     </ErrorBoundary>
 *   );
 * }
 */
export const _getSentryErrorBoundary = () => {
  return Sentry.Native.ErrorBoundary;
};

/**
 * Add breadcrumb to track user actions or application events.
 * 
 * @param breadcrumb The breadcrumb to add
 * 
 * @example
 * // Track user navigation
 * addBreadcrumb({
 *   category: 'navigation',
 *   message: 'Navigated to Profile screen',
 *   level: 'info'
 * });
 * 
 * // Track API call
 * addBreadcrumb({
 *   category: 'api',
 *   message: 'GET /api/users',
 *   data: { userId: 123 },
 *   level: 'debug'
 * });
 */
export const _addBreadcrumb = (breadcrumb: Breadcrumb): void => {
  if (!SENTRY_DSN) return;
  
  Sentry.Native.addBreadcrumb(breadcrumb);
};

// Export the raw Sentry object for advanced use cases
export const _SentryRaw = Sentry;
