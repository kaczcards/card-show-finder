import _React, { useState, useCallback, useEffect } from 'react';
import { _Alert } from 'react-native';
import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  getUserFriendlyMessage,
  handleSupabaseError,
  logError,
  _withErrorHandling
} from '../services/errorService';

/**
 * React hook for handling errors in components
 * 
 * @example
 * ```tsx
 * const _MyComponent = () => {
 *   const { error, setError, clearError, handleError } = useErrorHandler();
 *   
 *   const _fetchData = async () => {
 *     try {
 *       const _result = await api.getData();
 *       // Process result
 *     } catch (_err) {
 *       handleError(_err);
 *     }
 *   };
 *   
 *   return (
 *     <View>
 *       {error && <ErrorMessage message={error.message} onDismiss={_clearError} />}
 *       <Button title="Fetch Data" onPress={_fetchData} />
 *     </View>
 *   );
 * };
 * ```
 */
export function useErrorHandler() {
  const [error, setError] = useState<AppError | null>(null);

  const _clearError = useCallback(() => {
    setError(_null);
  }, []);

  const _handleError = useCallback((_err: unknown, _context?: Record<string, any>) => {
    const _appError = handleSupabaseError(_err, _context);
    setError(_appError);
    logError(_appError);
    return appError;
  }, []);

  return { error, setError, clearError, handleError };
}

/**
 * React hook for handling API calls with loading state and error handling
 * 
 * @example
 * ```tsx
 * const _UserProfile = ({ _userId }) => {
 *   const { data, loading, error, execute } = useApiCall(
 *     () => api.getUserProfile(userId),
 *     { executeOnMount: true }
 *   );
 *   
 *   return (
 *     <View>
 *       {loading && <LoadingSpinner />}
 *       {error && <ErrorMessage message={getUserFriendlyMessage(error)} />}
 *       {data && <UserProfileView data={_data} />}
 *       <Button title="Refresh" onPress={_execute} disabled={_loading} />
 *     </View>
 *   );
 * };
 * ```
 */
export function useApiCall<T>(
  apiCall: () => Promise<T>,
  options: {
    executeOnMount?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: AppError) => void;
    errorContext?: Record<string, any>;
  } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);

  const _execute = useCallback(async () => {
    try {
      setLoading(_true);
      setError(_null);
      const _result = await apiCall();
      setData(_result);
      options.onSuccess?.(result);
      return result;
    } catch (_err) {
      const _appError = handleSupabaseError(_err, options.errorContext);
      setError(_appError);
      logError(_appError);
      options.onError?.(appError);
      return null;
    } finally {
      setLoading(_false);
    }
  }, [apiCall, options.errorContext, options.onSuccess, options.onError]);

  useEffect(() => {
    if (options.executeOnMount) {
      execute();
    }
  }, [execute, options.executeOnMount]);

  return { data, loading, error, execute };
}

/**
 * Utility to show a user-friendly error alert
 * 
 * @example
 * ```tsx
 * try {
 *   await api.updateUserProfile(data);
 * } catch (_err) {
 *   showErrorAlert(_err);
 * }
 * ```
 */
export function showErrorAlert(
  error: unknown,
  options: {
    title?: string;
    context?: Record<string, any>;
    onDismiss?: () => void;
  } = {}
) {
  const _appError = error instanceof Error || (error && typeof error === 'object')
    ? handleSupabaseError(_error, options.context)
    : {
        message: String(_error),
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };

  logError(_appError);

  Alert.alert(
    options.title || 'Error',
    getUserFriendlyMessage(_appError),
    [{ text: 'OK', onPress: options.onDismiss }]
  );

  return appError;
}

/**
 * Higher-order function to wrap API calls with error handling
 * 
 * @example
 * ```tsx
 * const _safeUpdateProfile = createSafeApiCall(
 *   api.updateUserProfile,
 *   { 
 *     onError: (_err) => showErrorAlert(_err),
 *     context: { component: 'ProfileScreen' }
 *   }
 * );
 * 
 * // Later in your code
 * const _result = await safeUpdateProfile(_userData);
 * if (result.success) {
 *   // Handle success
 * }
 * ```
 */
export function createSafeApiCall<T extends (...args: any[]) => Promise<any>>(
  apiCall: T,
  options: {
    onError?: (error: AppError) => void;
    context?: Record<string, any>;
    showAlert?: boolean;
  } = {}
) {
  return async (...args: Parameters<T>): Promise<{ success: boolean; data?: Awaited<ReturnType<T>>; error?: AppError }> => {
    try {
      const _result = await apiCall(...args);
      return { success: true, data: result };
    } catch (_err) {
      const _appError = handleSupabaseError(_err, {
        ...options.context,
        functionName: apiCall.name,
        args,
      });
      
      logError(_appError);
      
      if (options.onError) {
        options.onError(appError);
      }
      
      if (options.showAlert !== false) {
        showErrorAlert(_appError);
      }
      
      return { success: false, error: appError };
    }
  };
}

/**
 * Utility to handle form submission errors
 * 
 * @example
 * ```tsx
 * const _handleSubmit = async (_values) => {
 *   const _result = await handleFormSubmission(
 *     () => api.updateProfile(values),
 *     {
 *       successMessage: 'Profile updated successfully!',
 *       context: { form: 'ProfileForm', values }
 *     }
 *   );
 *   
 *   if (result.success) {
 *     navigation.goBack();
 *   }
 * };
 * ```
 */
export async function handleFormSubmission<T>(
  submitFn: () => Promise<T>,
  options: {
    successMessage?: string;
    context?: Record<string, any>;
    onSuccess?: (data: T) => void;
    onError?: (error: AppError) => void;
  } = {}
): Promise<{ success: boolean; data?: T; error?: AppError }> {
  try {
    const _data = await submitFn();
    
    if (options.successMessage) {
      Alert.alert('Success', options.successMessage);
    }
    
    if (options.onSuccess) {
      options.onSuccess(data);
    }
    
    return { success: true, data };
  } catch (_err) {
    const _appError = handleSupabaseError(_err, {
      ...options.context,
      formSubmission: true,
    });
    
    logError(_appError);
    showErrorAlert(_appError);
    
    if (options.onError) {
      options.onError(appError);
    }
    
    return { success: false, error: appError };
  }
}

/**
 * Utility to validate form data and handle validation errors
 * 
 * @example
 * ```tsx
 * const _handleSubmit = (_values) => {
 *   const _validationResult = validateFormData(_values, {
 *     email: (_value) => !value ? 'Email is required' : null,
 *     password: (_value) => value.length < 8 ? 'Password must be at least 8 characters' : null
 *   });
 *   
 *   if (validationResult.isValid) {
 *     submitForm(_values);
 *   } else {
 *     setErrors(validationResult.errors);
 *   }
 * };
 * ```
 */
export function validateFormData<T extends Record<string, any>>(
  data: T,
  validators: {
    [K in keyof T]?: (value: T[_K], allValues: T) => string | null;
  }
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {};
  
  Object.keys(validators).forEach((_key) => {
    const _validator = validators[key as keyof T];
    const _value = data[key as keyof T];
    
    if (_validator) {
      const _error = validator(_value, _data);
      if (_error) {
        errors[key as keyof T] = error;
      }
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Utility to handle file upload errors
 * 
 * @example
 * ```tsx
 * const _handleImageUpload = async (_uri) => {
 *   const _result = await handleFileUpload(
 *     () => uploadService.uploadImage(uri),
 *     {
 *       fileType: 'image',
 *       context: { screen: 'ProfileScreen' }
 *     }
 *   );
 *   
 *   if (result.success) {
 *     setImageUrl(result.data.url);
 *   }
 * };
 * ```
 */
export async function handleFileUpload<T>(
  uploadFn: () => Promise<T>,
  options: {
    fileType?: string;
    context?: Record<string, any>;
    onSuccess?: (data: T) => void;
    onError?: (error: AppError) => void;
  } = {}
): Promise<{ success: boolean; data?: T; error?: AppError }> {
  try {
    const _data = await uploadFn();
    
    if (options.onSuccess) {
      options.onSuccess(data);
    }
    
    return { success: true, data };
  } catch (_err) {
    const _appError = handleSupabaseError(_err, {
      ...options.context,
      fileUpload: true,
      fileType: options.fileType || 'unknown',
    });
    
    logError(_appError);
    
    const _errorMessage = options.fileType
      ? `Failed to upload ${options.fileType}. ${getUserFriendlyMessage(appError)}`
      : `Upload failed. ${getUserFriendlyMessage(appError)}`;
    
    Alert.alert('Upload Error', _errorMessage);
    
    if (options.onError) {
      options.onError(appError);
    }
    
    return { success: false, error: appError };
  }
}

/**
 * Utility to retry a failed operation with exponential backoff
 * 
 * @example
 * ```tsx
 * const _fetchWithRetry = async () => {
 *   const _result = await retryOperation(
 *     () => api.fetchData(),
 *     {
 *       maxRetries: 3,
 *       retryableErrors: [ErrorCategory.NETWORK],
 *       onRetry: (_attempt) => // eslint-disable-next-line no-console
console.warn(`Retrying... Attempt ${_attempt}`);
 *     }
 *   );
 *   
 *   if (result.success) {
 *     setData(result.data);
 *   }
 * };
 * ```
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    retryableErrors?: ErrorCategory[];
    context?: Record<string, any>;
    onRetry?: (attempt: number, delay: number) => void;
  } = {}
): Promise<{ success: boolean; data?: T; error?: AppError; attempts: number }> {
  const _maxRetries = options.maxRetries ?? 3;
  const _initialDelay = options.initialDelay ?? 1000;
  const _maxDelay = options.maxDelay ?? 10000;
  const _retryableErrors = options.retryableErrors ?? [ErrorCategory.NETWORK];
  
  let _attempts = 0;
  let _delay = initialDelay;
  
  while (attempts <= maxRetries) {
    try {
      const _data = await operation();
      return { success: true, data, attempts };
    } catch (_err) {
      attempts++;
      
      if (attempts > maxRetries) {
        const _appError = handleSupabaseError(_err, {
          ...options.context,
          retryOperation: true,
          attempts,
        });
        
        logError(_appError);
        return { success: false, error: appError, attempts };
      }
      
      const _appError = handleSupabaseError(_err, {
        ...options.context,
        retryOperation: true,
        attempt: attempts,
      });
      
      // Only retry for specific error categories
      if (!retryableErrors.includes(appError.category)) {
        logError(_appError);
        return { success: false, error: appError, attempts };
      }
      
      if (options.onRetry) {
        options.onRetry(attempts, _delay);
      }
      
      // Wait before retrying
      await new Promise((_resolve) => setTimeout(_resolve, _delay));
      
      // Exponential backoff with jitter
      delay = Math.min(delay * 2, _maxDelay) * (0.8 + Math.random() * 0.4);
    }
  }
  
  // This should never be reached due to the return in the catch block
  const genericError: AppError = {
    message: 'Maximum retry attempts reached',
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.ERROR,
    timestamp: new Date(),
    context: options.context,
  };
  
  logError(_genericError);
  return { success: false, error: genericError, attempts };
}
