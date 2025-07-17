/**
 * polyfills.ts
 * 
 * This file contains polyfills for modern JavaScript features that might not be
 * available in all environments, particularly React Native.
 * 
 * Usage:
 * Import this file at the entry point of your application (e.g., App.tsx)
 * ```
 * import './src/utils/polyfills';
 * ```
 */

/**
 * structuredClone Polyfill
 * 
 * The structuredClone() global method creates a deep clone of a given value using
 * the structured clone algorithm. This polyfill provides a simplified version
 * that works for most JSON-serializable data, which is sufficient for Supabase's needs.
 * 
 * Limitations of this polyfill:
 * - Cannot clone functions, Symbols, WeakMaps, etc.
 * - Cannot handle circular references
 * - Loses prototype chain information
 * - Date objects become strings
 * - RegExp, Map, Set objects are not properly cloned
 * 
 * These limitations are acceptable for Supabase usage as it primarily deals with
 * JSON-serializable data for authentication and database operations.
 */

// Only add the polyfill if it doesn't already exist
if (typeof globalThis.structuredClone !== 'function') {
  // Define the type for the polyfill to match the native function
  type StructuredCloneFunction = <T>(value: T) => T;

  /**
   * Simple implementation using JSON serialization/deserialization
   * This is sufficient for most Supabase use cases which involve
   * serializable session and user data
   */
  const jsonClone: StructuredCloneFunction = <T>(value: T): T => {
    if (value === undefined) return value;
    
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      console.warn(
        '[structuredClone polyfill] Failed to clone value:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      // Return the original value as fallback (though it won't be a clone)
      return value;
    }
  };

  // Add to globalThis so it's available everywhere
  globalThis.structuredClone = jsonClone;

  // Log that the polyfill has been applied (helpful for debugging)
  if (__DEV__) {
    console.log('[Polyfill] Added structuredClone polyfill for Supabase compatibility');
  }
}

/**
 * Type declaration to make TypeScript aware of our polyfill
 * This ensures no type errors when using structuredClone
 */
declare global {
  interface Window {
    structuredClone<T>(value: T): T;
  }
  
  var structuredClone: <T>(value: T) => T;
}

// Export nothing - this file is used for its side effects only
export {};
