import { PostgrestError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Error severity levels for logging and reporting
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error categories to classify different types of errors
 */
export enum ErrorCategory {
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown',
}

/**
 * Structured error object for consistent error handling
 */
export interface AppError {
  message: string;
  code?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  originalError?: any;
  context?: Record<string, any>;
  timestamp: Date;
}

/**
 * Configuration for error service behavior
 */
interface ErrorServiceConfig {
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  enableStorageLogging: boolean;
  maxStoredErrors: number;
}

// Default configuration
const defaultConfig: ErrorServiceConfig = {
  enableConsoleLogging: true,
  enableRemoteLogging: false, // Disabled by default until a remote service is configured
  enableStorageLogging: true,
  maxStoredErrors: 100,
};

// Current configuration
let currentConfig: ErrorServiceConfig = { ...defaultConfig };

/**
 * Configure error service behavior
 */
export function configureErrorService(config: Partial<ErrorServiceConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Process a Supabase PostgrestError into our standard AppError format
 */
export function handleSupabaseError(
  error: PostgrestError | Error | unknown,
  context?: Record<string, any>,
  severity: ErrorSeverity = ErrorSeverity.ERROR
): AppError {
  // Handle PostgrestError type from Supabase
  if (isPostgrestError(error)) {
    return {
      message: error.message || 'Database operation failed',
      code: error.code,
      category: determineErrorCategory(_error),
      severity,
      originalError: error,
      context,
      timestamp: new Date(),
    };
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred',
      category: ErrorCategory.UNKNOWN,
      severity,
      originalError: error,
      context,
      timestamp: new Date(),
    };
  }

  // Handle unknown error types
  return {
    message: 'An unknown error occurred',
    category: ErrorCategory.UNKNOWN,
    severity,
    originalError: error,
    context,
    timestamp: new Date(),
  };
}

/**
 * Handle network-related errors
 */
export function handleNetworkError(
  error: Error | unknown,
  context?: Record<string, any>
): AppError {
  const appError: AppError = {
    message: error instanceof Error ? error.message : 'Network connection failed',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.ERROR,
    originalError: error,
    context,
    timestamp: new Date(),
  };

  logError(_appError);
  return appError;
}

/**
 * Handle authentication-related errors
 */
export function handleAuthError(
  error: Error | unknown,
  context?: Record<string, any>
): AppError {
  const appError: AppError = {
    message: error instanceof Error ? error.message : 'Authentication failed',
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.ERROR,
    originalError: error,
    context,
    timestamp: new Date(),
  };

  logError(_appError);
  return appError;
}

/**
 * Create a validation error when input validation fails
 */
export function createValidationError(
  message: string,
  context?: Record<string, any>
): AppError {
  const appError: AppError = {
    message,
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    context,
    timestamp: new Date(),
  };

  logError(_appError);
  return appError;
}

/**
 * Create a permission error when user lacks required permissions
 */
export function createPermissionError(
  message: string = 'You do not have permission to perform this action',
  context?: Record<string, any>
): AppError {
  const appError: AppError = {
    message,
    category: ErrorCategory.PERMISSION,
    severity: ErrorSeverity.WARNING,
    context,
    timestamp: new Date(),
  };

  logError(_appError);
  return appError;
}

/**
 * Log an error based on current configuration
 */
export function logError(error: AppError): void {
  // Console logging
  if (currentConfig.enableConsoleLogging) {
    console.error(
      `[${error.severity.toUpperCase()}] [${error.category}] ${error.message}`,
      {
        code: error.code,
        context: error.context,
        timestamp: error.timestamp,
        originalError: error.originalError,
      }
    );
  }

  // Store error in AsyncStorage for later retrieval
  if (currentConfig.enableStorageLogging) {
    storeErrorInStorage(_error).catch(_e => 
      console.error('Failed to store error in AsyncStorage:', _e)
    );
  }

  // Remote logging could be implemented here
  if (currentConfig.enableRemoteLogging) {
    // Implementation would depend on the remote logging service
    // sendErrorToRemoteService(_error);
  }
}

/**
 * Store errors in AsyncStorage for later retrieval
 */
async function storeErrorInStorage(error: AppError): Promise<void> {
  try {
    // Get existing errors
    const _storedErrorsJson = await AsyncStorage.getItem('app_errors');
    let storedErrors: AppError[] = storedErrorsJson ? JSON.parse(storedErrorsJson) : [];

    // Add new error
    storedErrors.push(error);

    // Limit the number of stored errors
    if (storedErrors.length > currentConfig.maxStoredErrors) {
      storedErrors = storedErrors.slice(-currentConfig.maxStoredErrors);
    }

    // Save back to storage
    await AsyncStorage.setItem('app_errors', JSON.stringify(storedErrors));
  } catch (_e) {
    // Fail silently, but log to console
    console.error('Error storing error in AsyncStorage:', _e);
  }
}

/**
 * Retrieve stored errors from AsyncStorage
 */
export async function getStoredErrors(): Promise<AppError[]> {
  try {
    const _storedErrorsJson = await AsyncStorage.getItem('app_errors');
    return storedErrorsJson ? JSON.parse(storedErrorsJson) : [];
  } catch (_e) {
    console.error('Error retrieving errors from AsyncStorage:', _e);
    return [];
  }
}

/**
 * Clear stored errors from AsyncStorage
 */
export async function clearStoredErrors(): Promise<void> {
  try {
    await AsyncStorage.setItem('app_errors', JSON.stringify([]));
  } catch (_e) {
    console.error('Error clearing errors from AsyncStorage:', _e);
  }
}

/**
 * Get a user-friendly error message based on the error category and code
 */
export function getUserFriendlyMessage(error: AppError): string {
  // Default messages by category
  const defaultMessages: Record<ErrorCategory, string> = {
    [ErrorCategory.DATABASE]: 'There was a problem accessing the database.',
    [ErrorCategory.AUTHENTICATION]: 'There was a problem with your account authentication.',
    [ErrorCategory.NETWORK]: 'Network connection issue. Please check your internet connection.',
    [ErrorCategory.VALIDATION]: 'Some information you entered is not valid.',
    [ErrorCategory.PERMISSION]: 'You do not have permission to perform this action.',
    [ErrorCategory.UNKNOWN]: 'An unexpected error occurred. Please try again later.',
  };

  // Specific error code handling
  if (error.code) {
    switch (error.code) {
      case '23505': // PostgreSQL unique violation
        return 'This information already exists in our system.';
      case '42P01': // PostgreSQL undefined table
        return 'We encountered a database configuration issue. Please contact support.';
      case '42501': // PostgreSQL insufficient privilege
        return 'You do not have permission to perform this action.';
      case '23503': // PostgreSQL foreign key violation
        return 'This operation cannot be completed because it references missing data.';
      case 'PGRST301': // Supabase RLS policy violation
        return 'Access denied due to security policy.';
      case '401':
      case 'auth/invalid-email':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Invalid login credentials. Please check your email and password.';
      case '403':
        return 'You do not have permission to access this resource.';
      case '404':
        return 'The requested resource was not found.';
      case '429':
        return 'Too many requests. Please try again later.';
      case '500':
        return 'Server error. Please try again later.';
      default:
        // Use the original error message if it's user-friendly, otherwise use default
        return isUserFriendlyMessage(error.message)
          ? error.message
          : defaultMessages[error.category];
    }
  }

  // If no specific code handling, use the message if it's user-friendly
  return isUserFriendlyMessage(error.message)
    ? error.message
    : defaultMessages[error.category];
}

/**
 * Type guard to check if an object is a PostgrestError
 */
function isPostgrestError(error: any): error is PostgrestError {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    'details' in error
  );
}

/**
 * Determine the error category based on the error
 */
function determineErrorCategory(error: PostgrestError | Error): ErrorCategory {
  if (isPostgrestError(error)) {
    // PostgreSQL error codes
    if (error.code?.startsWith('23')) return ErrorCategory.VALIDATION;
    if (error.code?.startsWith('28') || error.code?.startsWith('42501')) return ErrorCategory.PERMISSION;
    if (error.code?.startsWith('PGRST3')) return ErrorCategory.PERMISSION;
    
    return ErrorCategory.DATABASE;
  }

  // Check error message for common patterns
  const _message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('connection')) return ErrorCategory.NETWORK;
  if (message.includes('auth') || message.includes('login') || message.includes('password')) return ErrorCategory.AUTHENTICATION;
  if (message.includes('permission') || message.includes('access') || message.includes('denied')) return ErrorCategory.PERMISSION;
  if (message.includes('valid') || message.includes('required')) return ErrorCategory.VALIDATION;

  return ErrorCategory.UNKNOWN;
}

/**
 * Check if a message is user-friendly enough to show directly
 */
function isUserFriendlyMessage(message: string): boolean {
  if (!message) return false;
  
  // Too technical or exposing implementation details
  const _technicalTerms = [
    'undefined',
    'null',
    'NaN',
    'exception',
    'syntax error',
    'unexpected token',
    'stack',
    'reference error',
    'type error',
    'cannot read property',
    'is not a function',
    'failed to fetch',
    'network request failed',
    'JSON',
    'parse',
    'promise',
    'async',
    'timeout',
    'cors',
    'xhr',
    'http',
    'ssl',
    'certificate',
    'localhost',
    'port',
    'proxy',
    'socket',
    'postgresql',
    'supabase',
    'database',
    'query',
    'sql',
  ];

  // Check if message contains technical terms
  const _lowercaseMsg = message.toLowerCase();
  return !technicalTerms.some(term => lowercaseMsg.includes(term.toLowerCase()));
}

/**
 * Wrap a function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler?: (error: AppError) => void
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (_error) {
      const _appError = handleSupabaseError(_error, { functionName: fn.name, args });
      
      if (_errorHandler) {
        errorHandler(_appError);
      } else {
        logError(_appError);
      }
      
      throw appError;
    }
  };
}
