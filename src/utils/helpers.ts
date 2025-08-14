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
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
};
