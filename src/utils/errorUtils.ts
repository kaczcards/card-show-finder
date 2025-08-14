import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  getUserFriendlyMessage,
  handleSupabaseError,
  logError,
  // withErrorHandling is not used in this module
} from '../services/errorService';

/**
 * React hook for handling errors in components
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { error, setError, clearError, handleError } = useErrorHandler();
 *   
 *   const fetchData = async () => {
 *     try {
 *       const result = await api.getData();
 *       // Process result
 *     } catch (err) {
 *       handleError(err);
 *     }
 *   };
 *   
 *   return (
 *     <View>
 *       {error && <ErrorMessage message={error.message} onDismiss={clearError} />}
 *       <Button title="Fetch Data" onPress={fetchData} />
 *     </View>
 *   );
 * };
 * ```
 */
export function useErrorHandler() {
  const [error, setError] = useState<AppError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((err: unknown, context?: Record<string, any>) => {
    const appError = handleSupabaseError(err, context);
    setError(appError);
    logError(appError);
    return appError;
  }, []);

  return { error, setError, clearError, handleError };
}

/**
 * React hook for handling API calls with loading state and error handling
 * 
 * @example
 * ```tsx
 * const UserProfile = ({ userId }) => {
 *   const { data, loading, error, execute } = useApiCall(
 *     () => api.getUserProfile(userId),
 *     { executeOnMount: true }
 *   );
 *   
 *   return (
 *     <View>
 *       {loading && <LoadingSpinner />}
 *       {error && <ErrorMessage message={getUserFriendlyMessage(error)} />}
 *       {data && <UserProfileView data={data} />}
 *       <Button title="Refresh" onPress={execute} disabled={loading} />
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

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
      options.onSuccess?.(result);
      return result;
    } catch (err) {
      const appError = handleSupabaseError(err, options.errorContext);
      setError(appError);
      logError(appError);
      options.onError?.(appError);
      return null;
    } finally {
      setLoading(false);
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
 * } catch (err) {
 *   showErrorAlert(err);
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
  const appError = error instanceof Error || (error && typeof error === 'object')
    ? handleSupabaseError(error, options.context)
    : {
        message: String(error),
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
      };

  logError(appError);

  Alert.alert(
    options.title || 'Error',
    getUserFriendlyMessage(appError),
    [{ text: 'OK', onPress: options.onDismiss }]
  );

  return appError;
}

/**
 * Higher-order function to wrap API calls with error handling
 * 
 * @example
 * ```tsx
 * const safeUpdateProfile = createSafeApiCall(
 *   api.updateUserProfile,
 *   { 
 *     onError: (err) => showErrorAlert(err),
 *     context: { component: 'ProfileScreen' }
 *   }
 * );
 * 
 * // Later in your code
 * const result = await safeUpdateProfile(userData);
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
      const result = await apiCall(...args);
      return { success: true, data: result };
    } catch (err) {
      const appError = handleSupabaseError(err, {
        ...options.context,
        functionName: apiCall.name,
        args,
      });
      
      logError(appError);
      
      if (options.onError) {
        options.onError(appError);
      }
      
      if (options.showAlert !== false) {
        showErrorAlert(appError);
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
 * const handleSubmit = async (values) => {
 *   const result = await handleFormSubmission(
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
    const data = await submitFn();
    
    if (options.successMessage) {
      Alert.alert('Success', options.successMessage);
    }
    
    if (options.onSuccess) {
      options.onSuccess(data);
    }
    
    return { success: true, data };
  } catch (err) {
    const appError = handleSupabaseError(err, {
      ...options.context,
      formSubmission: true,
    });
    
    logError(appError);
    showErrorAlert(appError);
    
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
 * const handleSubmit = (values) => {
 *   const validationResult = validateFormData(values, {
 *     email: (value) => !value ? 'Email is required' : null,
 *     password: (value) => value.length < 8 ? 'Password must be at least 8 characters' : null
 *   });
 *   
 *   if (validationResult.isValid) {
 *     submitForm(values);
 *   } else {
 *     setErrors(validationResult.errors);
 *   }
 * };
 * ```
 */
export function validateFormData<T extends Record<string, any>>(
  data: T,
  validators: {
    [K in keyof T]?: (value: T[K], allValues: T) => string | null;
  }
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {};
  
  Object.keys(validators).forEach((key) => {
    const validator = validators[key as keyof T];
    const value = data[key as keyof T];
    
    if (validator) {
      const error = validator(value, data);
      if (error) {
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
 * const handleImageUpload = async (uri) => {
 *   const result = await handleFileUpload(
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
    const data = await uploadFn();
    
    if (options.onSuccess) {
      options.onSuccess(data);
    }
    
    return { success: true, data };
  } catch (err) {
    const appError = handleSupabaseError(err, {
      ...options.context,
      fileUpload: true,
      fileType: options.fileType || 'unknown',
    });
    
    logError(appError);
    
    const errorMessage = options.fileType
      ? `Failed to upload ${options.fileType}. ${getUserFriendlyMessage(appError)}`
      : `Upload failed. ${getUserFriendlyMessage(appError)}`;
    
    Alert.alert('Upload Error', errorMessage);
    
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
 * const fetchWithRetry = async () => {
 *   const result = await retryOperation(
 *     () => api.fetchData(),
 *     {
 *       maxRetries: 3,
 *       retryableErrors: [ErrorCategory.NETWORK],
 *       onRetry: (attempt) => console.warn(`Retrying... Attempt ${attempt}`);
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
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelay ?? 1000;
  const maxDelay = options.maxDelay ?? 10000;
  const retryableErrors = options.retryableErrors ?? [ErrorCategory.NETWORK];
  
  let attempts = 0;
  let delay = initialDelay;
  
  while (attempts <= maxRetries) {
    try {
      const data = await operation();
      return { success: true, data, attempts };
    } catch (err) {
      attempts++;
      
      if (attempts > maxRetries) {
        const appError = handleSupabaseError(err, {
          ...options.context,
          retryOperation: true,
          attempts,
        });
        
        logError(appError);
        return { success: false, error: appError, attempts };
      }
      
      const appError = handleSupabaseError(err, {
        ...options.context,
        retryOperation: true,
        attempt: attempts,
      });
      
      // Only retry for specific error categories
      if (!retryableErrors.includes(appError.category)) {
        logError(appError);
        return { success: false, error: appError, attempts };
      }
      
      if (options.onRetry) {
        options.onRetry(attempts, delay);
      }
      
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      // Exponential backoff with jitter
      delay = Math.min(delay * 2, maxDelay) * (0.8 + Math.random() * 0.4);
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
  
  logError(genericError);
  return { success: false, error: genericError, attempts };
}
