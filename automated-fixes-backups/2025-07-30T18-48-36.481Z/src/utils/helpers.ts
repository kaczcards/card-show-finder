/**
 * General utility functions for the app
 */

/**
 * Creates a debounced version of a function that only calls the original 
 * function after a specified delay has passed without any new calls.
 * 
 * @param func The function to debounce
 * @param delay The delay in milliseconds
 * @returns A debounced version of the function
 */
export const _debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (_timeoutId) {
      clearTimeout(_timeoutId);
    }
    
    // Cast the `setTimeout` return value to `any` to satisfy the Node/browser
    // disparity (`number` in browsers vs `NodeJS.Timeout` in Node).
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay) as any;
  };
};
