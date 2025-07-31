/**
 * Test suite for errorService.ts
 * 
 * This test suite focuses on failure paths and edge cases to ensure
 * robust error handling throughout the application.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PostgrestError } from '@supabase/supabase-js';
import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  configureErrorService,
  handleSupabaseError,
  handleNetworkError,
  handleAuthError,
  createValidationError,
  createPermissionError,
  logError,
  getStoredErrors,
  clearStoredErrors,
  getUserFriendlyMessage,
  withErrorHandling,
} from '../../src/services/errorService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('errorService', () => {
  // Spy on console methods to prevent noise in test output and verify logging
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    
    // Reset configuration to default before each test
    configureErrorService({
      enableConsoleLogging: true,
      enableRemoteLogging: false,
      enableStorageLogging: true,
      maxStoredErrors: 100,
    });
    
    // Default AsyncStorage mock implementations
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore console methods after each test
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe('Error Configuration', () => {
    test('should apply partial configuration changes', () => {
      // Arrange & Act
      configureErrorService({
        enableConsoleLogging: false,
        maxStoredErrors: 50,
      });
      
      // Create an error to test configuration
      const error = createValidationError('Test validation error');
      logError(error);
      
      // Assert
      expect(consoleErrorSpy).not.toHaveBeenCalled(); // Console logging disabled
      expect(AsyncStorage.setItem).toHaveBeenCalled(); // Storage logging still enabled
    });

    test('should disable all logging when configured', () => {
      // Arrange & Act
      configureErrorService({
        enableConsoleLogging: false,
        enableRemoteLogging: false,
        enableStorageLogging: false,
      });
      
      // Create an error to test configuration
      const error = createValidationError('Test validation error');
      logError(error);
      
      // Assert
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    test('should apply maximum stored errors limit', async () => {
      // Arrange
      const maxErrors = 5;
      configureErrorService({
        maxStoredErrors: maxErrors,
      });
      
      // Mock existing errors (more than the new limit)
      const existingErrors = Array(10).fill(null).map((_, i) => ({
        message: `Existing error ${i}`,
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      }));
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingErrors));
      
      // Act
      const newError = createValidationError('New validation error');
      await logError(newError);
      
      // Assert
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      
      // Extract the stored errors from the mock call
      const storedErrorsJson = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const storedErrors = JSON.parse(storedErrorsJson);
      
      // Verify we only kept the maximum number of errors
      expect(storedErrors.length).toBe(maxErrors);
      
      // Verify we kept the most recent errors (the last ones from the original array plus the new one)
      expect(storedErrors[maxErrors - 1].message).toBe('New validation error');
      expect(storedErrors[0].message).toBe(`Existing error ${10 - maxErrors + 1}`);
    });
  });

  describe('Error Handling Functions', () => {
    describe('handleSupabaseError', () => {
      test('should handle PostgrestError correctly', () => {
        // Arrange
        const postgrestError: PostgrestError = {
          message: 'Database error',
          details: 'Constraint violation',
          hint: 'Check your input',
          code: '23505', // Unique violation
        };
        
        // Act
        const appError = handleSupabaseError(postgrestError);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message: 'Database error',
          code: '23505',
          category: ErrorCategory.VALIDATION, // Based on the error code
          severity: ErrorSeverity.ERROR,
          originalError: postgrestError,
        }));
      });

      test('should handle PostgrestError with permission code', () => {
        // Arrange
        const postgrestError: PostgrestError = {
          message: 'Permission denied',
          details: 'Insufficient privileges',
          hint: 'Check your permissions',
          code: '42501', // Permission denied
        };
        
        // Act
        const appError = handleSupabaseError(postgrestError);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message: 'Permission denied',
          code: '42501',
          category: ErrorCategory.PERMISSION,
          severity: ErrorSeverity.ERROR,
        }));
      });

      test('should handle PostgrestError with RLS policy violation', () => {
        // Arrange
        const postgrestError: PostgrestError = {
          message: 'RLS policy violation',
          details: 'Access denied',
          hint: 'Check your permissions',
          code: 'PGRST301', // RLS policy violation
        };
        
        // Act
        const appError = handleSupabaseError(postgrestError);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message: 'RLS policy violation',
          code: 'PGRST301',
          category: ErrorCategory.PERMISSION,
          severity: ErrorSeverity.ERROR,
        }));
      });

      test('should handle standard Error objects', () => {
        // Arrange
        const standardError = new Error('Standard error');
        
        // Act
        const appError = handleSupabaseError(standardError);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message: 'Standard error',
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.ERROR,
          originalError: standardError,
        }));
      });

      test('should handle unknown error types', () => {
        // Arrange
        const unknownError = 'Just a string error';
        
        // Act
        const appError = handleSupabaseError(unknownError);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message: 'An unknown error occurred',
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.ERROR,
          originalError: unknownError,
        }));
      });

      test('should handle null/undefined errors', () => {
        // Act & Assert
        expect(handleSupabaseError(null)).toEqual(expect.objectContaining({
          message: 'An unknown error occurred',
          category: ErrorCategory.UNKNOWN,
        }));
        
        expect(handleSupabaseError(undefined)).toEqual(expect.objectContaining({
          message: 'An unknown error occurred',
          category: ErrorCategory.UNKNOWN,
        }));
      });

      test('should handle custom severity level', () => {
        // Arrange
        const error = new Error('Critical error');
        
        // Act
        const appError = handleSupabaseError(error, {}, ErrorSeverity.CRITICAL);
        
        // Assert
        expect(appError.severity).toBe(ErrorSeverity.CRITICAL);
      });

      test('should include context data', () => {
        // Arrange
        const error = new Error('Error with context');
        const context = { userId: '123', action: 'update' };
        
        // Act
        const appError = handleSupabaseError(error, context);
        
        // Assert
        expect(appError.context).toEqual(context);
      });
    });

    describe('handleNetworkError', () => {
      test('should process network errors correctly', () => {
        // Arrange
        const networkError = new Error('Network connection failed');
        
        // Act
        const appError = handleNetworkError(networkError);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message: 'Network connection failed',
          category: ErrorCategory.NETWORK,
          severity: ErrorSeverity.ERROR,
          originalError: networkError,
        }));
        
        // Verify it was logged
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      test('should handle non-Error network failures', () => {
        // Arrange
        const nonErrorFailure = { status: 0, statusText: 'Network error' };
        
        // Act
        const appError = handleNetworkError(nonErrorFailure);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message: 'Network connection failed',
          category: ErrorCategory.NETWORK,
          originalError: nonErrorFailure,
        }));
      });
    });

    describe('handleAuthError', () => {
      test('should process authentication errors correctly', () => {
        // Arrange
        const authError = new Error('Invalid credentials');
        
        // Act
        const appError = handleAuthError(authError);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message: 'Invalid credentials',
          category: ErrorCategory.AUTHENTICATION,
          severity: ErrorSeverity.ERROR,
          originalError: authError,
        }));
        
        // Verify it was logged
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      test('should handle non-Error auth failures', () => {
        // Arrange
        const nonErrorFailure = { code: 'auth/invalid-email' };
        
        // Act
        const appError = handleAuthError(nonErrorFailure);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message: 'Authentication failed',
          category: ErrorCategory.AUTHENTICATION,
          originalError: nonErrorFailure,
        }));
      });
    });

    describe('createValidationError', () => {
      test('should create validation errors correctly', () => {
        // Arrange
        const message = 'Invalid input data';
        const context = { field: 'email', value: 'invalid' };
        
        // Act
        const appError = createValidationError(message, context);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message,
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.WARNING,
          context,
        }));
        
        // Verify it was logged
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('createPermissionError', () => {
      test('should create permission errors correctly', () => {
        // Arrange
        const message = 'Access denied to this resource';
        const context = { resource: 'payments', action: 'create' };
        
        // Act
        const appError = createPermissionError(message, context);
        
        // Assert
        expect(appError).toEqual(expect.objectContaining({
          message,
          category: ErrorCategory.PERMISSION,
          severity: ErrorSeverity.WARNING,
          context,
        }));
        
        // Verify it was logged
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      test('should use default message when none provided', () => {
        // Act
        const appError = createPermissionError();
        
        // Assert
        expect(appError.message).toBe('You do not have permission to perform this action');
      });
    });
  });

  describe('Error Storage', () => {
    test('should store errors in AsyncStorage', async () => {
      // Arrange
      const error = createValidationError('Test error');
      
      // Act
      await logError(error);
      
      // Assert
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('app_errors');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'app_errors',
        expect.any(String)
      );
      
      // Verify the stored data
      const storedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(Array.isArray(storedData)).toBe(true);
      expect(storedData[0]).toEqual(expect.objectContaining({
        message: 'Test error',
        category: ErrorCategory.VALIDATION,
      }));
    });

    test('should append new errors to existing ones', async () => {
      // Arrange
      const existingErrors = [
        {
          message: 'Existing error',
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.ERROR,
          timestamp: new Date().toISOString(),
        },
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingErrors));
      
      // Act
      const newError = createValidationError('New error');
      await logError(newError);
      
      // Assert
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      
      // Verify the stored data
      const storedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(storedData.length).toBe(2);
      expect(storedData[0].message).toBe('Existing error');
      expect(storedData[1].message).toBe('New error');
    });

    test('should handle AsyncStorage getItem failure', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage read error'));
      
      // Act
      const error = createValidationError('Test error');
      await logError(error);
      
      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error storing error in AsyncStorage:',
        expect.any(Error)
      );
    });

    test('should handle AsyncStorage setItem failure', async () => {
      // Arrange
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage write error'));
      
      // Act
      const error = createValidationError('Test error');
      await logError(error);
      
      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error storing error in AsyncStorage:',
        expect.any(Error)
      );
    });

    test('should handle corrupted JSON in AsyncStorage', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{"corrupted:json');
      
      // Act
      const error = createValidationError('Test error');
      await logError(error);
      
      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error storing error in AsyncStorage:',
        expect.any(Error)
      );
    });

    test('should enforce maximum error storage limit', async () => {
      // Arrange
      const maxErrors = 10;
      configureErrorService({ maxStoredErrors: maxErrors });
      
      // Create more errors than the limit
      const existingErrors = Array(maxErrors + 5).fill(null).map((_, i) => ({
        message: `Error ${i}`,
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(Date.now() - (i * 1000)).toISOString(), // Older errors first
      }));
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingErrors));
      
      // Act
      const newError = createValidationError('New error');
      await logError(newError);
      
      // Assert
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      
      // Verify the stored data
      const storedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(storedData.length).toBe(maxErrors);
      
      // Should keep the most recent errors (including the new one)
      expect(storedData[maxErrors - 1].message).toBe('New error');
    });

    test('should retrieve stored errors', async () => {
      // Arrange
      const mockErrors = [
        {
          message: 'Stored error 1',
          category: ErrorCategory.DATABASE,
          severity: ErrorSeverity.ERROR,
          timestamp: new Date().toISOString(),
        },
        {
          message: 'Stored error 2',
          category: ErrorCategory.NETWORK,
          severity: ErrorSeverity.WARNING,
          timestamp: new Date().toISOString(),
        },
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockErrors));
      
      // Act
      const retrievedErrors = await getStoredErrors();
      
      // Assert
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('app_errors');
      expect(retrievedErrors).toEqual(mockErrors);
    });

    test('should handle getStoredErrors failure', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage read error'));
      
      // Act
      const retrievedErrors = await getStoredErrors();
      
      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error retrieving errors from AsyncStorage:',
        expect.any(Error)
      );
      expect(retrievedErrors).toEqual([]);
    });

    test('should clear stored errors', async () => {
      // Act
      await clearStoredErrors();
      
      // Assert
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_errors', '[]');
    });

    test('should handle clearStoredErrors failure', async () => {
      // Arrange
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage write error'));
      
      // Act
      await clearStoredErrors();
      
      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error clearing errors from AsyncStorage:',
        expect.any(Error)
      );
    });
  });

  describe('Error Logging', () => {
    test('should log errors to console when enabled', () => {
      // Arrange
      configureErrorService({ enableConsoleLogging: true });
      const error: AppError = {
        message: 'Test error',
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };
      
      // Act
      logError(error);
      
      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[ERROR] [database] Test error`,
        expect.objectContaining({
          context: undefined,
          timestamp: error.timestamp,
        })
      );
    });

    test('should not log errors to console when disabled', () => {
      // Arrange
      configureErrorService({ enableConsoleLogging: false });
      const error: AppError = {
        message: 'Test error',
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };
      
      // Act
      logError(error);
      
      // Assert
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should not store errors when storage logging is disabled', async () => {
      // Arrange
      configureErrorService({ enableStorageLogging: false });
      const error: AppError = {
        message: 'Test error',
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };
      
      // Act
      await logError(error);
      
      // Assert
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('getUserFriendlyMessage', () => {
    test('should return specific message for PostgreSQL unique violation', () => {
      // Arrange
      const error: AppError = {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };
      
      // Act
      const friendlyMessage = getUserFriendlyMessage(error);
      
      // Assert
      expect(friendlyMessage).toBe('This information already exists in our system.');
    });

    test('should return specific message for PostgreSQL undefined table', () => {
      // Arrange
      const error: AppError = {
        message: 'relation "non_existent_table" does not exist',
        code: '42P01',
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };
      
      // Act
      const friendlyMessage = getUserFriendlyMessage(error);
      
      // Assert
      expect(friendlyMessage).toBe('We encountered a database configuration issue. Please contact support.');
    });

    test('should return specific message for auth errors', () => {
      // Arrange
      const error: AppError = {
        message: 'Invalid email or password',
        code: 'auth/wrong-password',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };
      
      // Act
      const friendlyMessage = getUserFriendlyMessage(error);
      
      // Assert
      expect(friendlyMessage).toBe('Invalid login credentials. Please check your email and password.');
    });

    test('should return specific message for HTTP status codes', () => {
      // Arrange
      const error404: AppError = {
        message: 'Not found',
        code: '404',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };
      
      const error500: AppError = {
        message: 'Internal server error',
        code: '500',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };
      
      // Act
      const friendlyMessage404 = getUserFriendlyMessage(error404);
      const friendlyMessage500 = getUserFriendlyMessage(error500);
      
      // Assert
      expect(friendlyMessage404).toBe('The requested resource was not found.');
      expect(friendlyMessage500).toBe('Server error. Please try again later.');
    });

    test('should use original message if it is user-friendly', () => {
      // Arrange
      const error: AppError = {
        message: 'Your password must be at least 8 characters long',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.WARNING,
        timestamp: new Date(),
      };
      
      // Act
      const friendlyMessage = getUserFriendlyMessage(error);
      
      // Assert
      expect(friendlyMessage).toBe('Your password must be at least 8 characters long');
    });

    test('should fall back to category default if message is technical', () => {
      // Arrange
      const error: AppError = {
        message: 'TypeError: Cannot read property "id" of undefined',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.WARNING,
        timestamp: new Date(),
      };
      
      // Act
      const friendlyMessage = getUserFriendlyMessage(error);
      
      // Assert
      expect(friendlyMessage).toBe('Some information you entered is not valid.');
    });

    test('should handle errors with no message', () => {
      // Arrange
      const error: AppError = {
        message: '',
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };
      
      // Act
      const friendlyMessage = getUserFriendlyMessage(error);
      
      // Assert
      expect(friendlyMessage).toBe('An unexpected error occurred. Please try again later.');
    });
  });

  describe('withErrorHandling', () => {
    test('should wrap function and return result on success', async () => {
      // Arrange
      const successFn = jest.fn().mockResolvedValue('success result');
      const wrappedFn = withErrorHandling(successFn);
      
      // Act
      const result = await wrappedFn('arg1', 'arg2');
      
      // Assert
      expect(successFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('success result');
    });

    test('should catch and handle errors', async () => {
      // Arrange
      const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const wrappedFn = withErrorHandling(errorFn);
      
      // Act & Assert
      await expect(wrappedFn('arg1')).rejects.toMatchObject({
        message: 'Test error',
        category: ErrorCategory.UNKNOWN,
      });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should use custom error handler if provided', async () => {
      // Arrange
      const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const customErrorHandler = jest.fn();
      const wrappedFn = withErrorHandling(errorFn, customErrorHandler);
      
      // Act
      try {
        await wrappedFn('arg1');
      } catch (error) {
        // Expected to throw
      }
      
      // Assert
      expect(customErrorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
          category: ErrorCategory.UNKNOWN,
        })
      );
      
      // Should not use default error logging
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should include function name and args in error context', async () => {
      // Arrange
      function namedFunction() {
        return Promise.reject(new Error('Named function error'));
      }
      
      const wrappedFn = withErrorHandling(namedFunction);
      
      // Act
      try {
        await wrappedFn();
      } catch (error) {
        // Expected to throw
        expect(error).toMatchObject({
          context: {
            functionName: 'namedFunction',
            args: [],
          },
        });
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle circular reference errors', async () => {
      // Arrange
      const circularObj: any = { name: 'circular' };
      circularObj.self = circularObj; // Create circular reference
      
      const error = new Error('Circular reference error');
      error.cause = circularObj;
      
      // Act
      const appError = handleSupabaseError(error);
      await logError(appError);
      
      // Assert - should not throw when stringifying
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    test('should handle very large error objects', async () => {
      // Arrange
      const largeData = Array(10000).fill('x').join(''); // Create a large string
      const largeError = new Error('Large error');
      (largeError as any).largeData = largeData;
      
      // Act
      const appError = handleSupabaseError(largeError);
      await logError(appError);
      
      // Assert - should not throw when storing
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    test('should handle errors with Unicode characters', async () => {
      // Arrange
      const unicodeError = new Error('Unicode error: 你好, مرحبا, привет, こんにちは');
      
      // Act
      const appError = handleSupabaseError(unicodeError);
      await logError(appError);
      
      // Assert
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      
      // Verify the message was preserved
      const storedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(storedData[0].message).toBe('Unicode error: 你好, مرحبا, привет, こんにちは');
    });

    test('should handle AsyncStorage quota exceeded', async () => {
      // Arrange
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Quota exceeded')
      );
      
      // Act
      const error = createValidationError('Test error');
      await logError(error);
      
      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error storing error in AsyncStorage:',
        expect.any(Error)
      );
    });

    test('should handle errors with unusual properties', async () => {
      // Arrange
      const unusualError = new Error('Unusual error');
      (unusualError as any).domNode = document.createElement('div'); // DOM node that can't be serialized
      (unusualError as any).function = function() { return 'cannot serialize'; };
      
      // Act
      const appError = handleSupabaseError(unusualError);
      await logError(appError);
      
      // Assert - should not throw when storing
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    test('should handle large volumes of errors efficiently', async () => {
      // Arrange
      const errorCount = 1000;
      const errors = Array(errorCount).fill(null).map((_, i) => ({
        message: `Error ${i}`,
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      }));
      
      // Configure to keep all errors for this test
      configureErrorService({ maxStoredErrors: errorCount + 1 });
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(errors));
      
      // Act
      const startTime = performance.now();
      
      const newError = createValidationError('Performance test error');
      await logError(newError);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Assert
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      
      // This is a soft assertion - the actual threshold depends on the environment
      // but we want to ensure it doesn't take an unreasonable amount of time
      expect(duration).toBeLessThan(1000); // Should process in under 1 second
      
      // Verify we stored all errors plus the new one
      const storedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(storedData.length).toBe(errorCount + 1);
    });

    test('should efficiently process and store 100 errors in sequence', async () => {
      // Arrange
      const errorCount = 100;
      
      // Configure to keep all errors
      configureErrorService({ maxStoredErrors: errorCount + 10 });
      
      // Mock empty initial storage
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      // Act
      const startTime = performance.now();
      
      // Process 100 errors in sequence
      for (let i = 0; i < errorCount; i++) {
        const error = createValidationError(`Sequential error ${i}`);
        // Update the mock to return the growing array
        const currentErrors = Array(i).fill(null).map((_, j) => ({
          message: `Sequential error ${j}`,
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.WARNING,
          timestamp: new Date(),
        }));
        
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          i === 0 ? null : JSON.stringify(currentErrors)
        );
        
        await logError(error);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Assert
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(errorCount);
      
      // This is a soft assertion - the actual threshold depends on the environment
      expect(duration).toBeLessThan(5000); // Should process in under 5 seconds
    });
  });
});
