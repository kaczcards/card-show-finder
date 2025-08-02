/**
 * Edge Cases and Async Operations Test Suite
 * 
 * This test suite focuses on testing edge cases related to asynchronous operations
 * using pure JavaScript/TypeScript patterns, including race conditions, memory management,
 * promise chains, timeouts, concurrent operations, and error handling patterns.
 */

// Simple mock for AsyncStorage-like functionality
const mockStorage = {
  _data: new Map<string, string>(),
  setItem: jest.fn((key: string, value: string) => {
    return new Promise<void>((resolve, reject) => {
      // Simulate occasional failures
      if (Math.random() < 0.1) {
        reject(new Error('Storage error'));
        return;
      }
      
      setTimeout(() => {
        mockStorage._data.set(key, value);
        resolve();
      }, Math.random() * 10); // Random delay to simulate race conditions
    });
  }),
  getItem: jest.fn((key: string) => {
    return new Promise<string | null>((resolve) => {
      setTimeout(() => {
        resolve(mockStorage._data.get(key) || null);
      }, Math.random() * 10); // Random delay to simulate race conditions
    });
  }),
  removeItem: jest.fn((key: string) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        mockStorage._data.delete(key);
        resolve();
      }, Math.random() * 10);
    });
  }),
  clear: jest.fn(() => {
    return new Promise<void>((resolve) => {
      mockStorage._data.clear();
      resolve();
    });
  }),
  getAllKeys: jest.fn(() => {
    return new Promise<string[]>((resolve) => {
      resolve(Array.from(mockStorage._data.keys()));
    });
  })
};

// Mock for EventEmitter
class MockEventEmitter {
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  
  addListener(event: string, listener: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return {
      remove: () => this.removeListener(event, listener)
    };
  }
  
  removeListener(event: string, listener: (...args: any[]) => void) {
    if (!this.listeners.has(event)) return;
    
    const eventListeners = this.listeners.get(event)!;
    const index = eventListeners.indexOf(listener);
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }
  }
  
  removeAllListeners(event?: string) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
  
  emit(event: string, ...args: any[]) {
    if (!this.listeners.has(event)) return false;
    
    const eventListeners = this.listeners.get(event)!;
    eventListeners.forEach(listener => {
      try {
        listener(...args);
      } catch (e) {
        console.error('Error in event listener:', e);
      }
    });
    return true;
  }
}

describe('Edge Cases and Async Operations', () => {
  // Spy on console methods to prevent noise in test output
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let setTimeoutSpy: jest.SpyInstance;
  let clearTimeoutSpy: jest.SpyInstance;
  
  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Spy on setTimeout and clearTimeout
    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    // Clear mock storage
    mockStorage._data.clear();
  });
  
  // Cleanup after each test
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  describe('Race Conditions', () => {
    test('should handle multiple concurrent storage operations on the same key', async () => {
      // Arrange
      const key = 'user_preferences';
      const initialData = JSON.stringify({ theme: 'light', notifications: true });
      
      // Set initial data
      await mockStorage.setItem(key, initialData);
      
      // Act - Simulate two concurrent updates
      const update1 = async () => {
        const data = JSON.parse(await mockStorage.getItem(key) || '{}');
        data.theme = 'dark';
        await mockStorage.setItem(key, JSON.stringify(data));
        return data;
      };
      
      const update2 = async () => {
        const data = JSON.parse(await mockStorage.getItem(key) || '{}');
        data.notifications = false;
        await mockStorage.setItem(key, JSON.stringify(data));
        return data;
      };
      
      // Run both updates concurrently
      const [result1, result2] = await Promise.all([update1(), update2()]);
      
      // Assert
      // One update will overwrite the other due to race condition
      expect(result1).not.toEqual(result2);
      
      // The final stored value will be from whichever operation completed last
      const finalValue = JSON.parse(await mockStorage.getItem(key) || '{}');
      expect(finalValue).toEqual(expect.objectContaining({
        theme: expect.any(String),
        notifications: expect.any(Boolean),
      }));
      
      // Only one property was updated in each result
      expect(result1.theme).toBe('dark');
      expect(result2.notifications).toBe(false);
    }, 60000);
    
    test('should implement optimistic locking to prevent race conditions', async () => {
      // Arrange
      const key = 'counter';
      let currentVersion = 1;
      let currentValue = 0;
      
      // Mock storage with version checking
      const getWithVersion = jest.fn(async () => {
        return JSON.stringify({ value: currentValue, version: currentVersion });
      });
      
      const setWithVersion = jest.fn(async (k: string, valueStr: string) => {
        const data = JSON.parse(valueStr);
        
        // Simulate optimistic locking - only update if versions match
        if (data.version === currentVersion) {
          currentValue = data.value;
          currentVersion++;
          return;
        } else {
          throw new Error('Version mismatch - data was modified by another process');
        }
      });
      
      // Function to increment with retry logic
      const incrementWithRetry = async (maxRetries = 3): Promise<number> => {
        let retries = 0;
        
        while (retries < maxRetries) {
          try {
            // Get current data
            const dataStr = await getWithVersion(key);
            const data = JSON.parse(dataStr || '{"value":0,"version":1}');
            
            // Update with current version
            const newData = {
              value: data.value + 1,
              version: data.version
            };
            
            // Try to save
            await setWithVersion(key, JSON.stringify(newData));
            return newData.value;
          } catch (error) {
            retries++;
            if (retries >= maxRetries) {
              throw error;
            }
            // Wait before retrying (exponential backoff)
            await new Promise(r => setTimeout(r, 10 * Math.pow(2, retries)));
            jest.advanceTimersByTime(10 * Math.pow(2, retries));
          }
        }
        
        throw new Error('Failed after max retries');
      };
      
      // Act - Run multiple increments in parallel
      const results = await Promise.allSettled([
        incrementWithRetry(),
        incrementWithRetry(),
        incrementWithRetry()
      ]);
      
      // Assert
      // All operations should eventually succeed with retries
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      
      // Final value should be incremented by the number of operations
      expect(currentValue).toBe(3);
      
      // Version should be incremented for each successful update
      expect(currentVersion).toBe(4); // Started at 1, then 3 successful updates
    }, 60000);
  });

  describe('Memory Management', () => {
    test('should properly cleanup event listeners when component unmounts', () => {
      // Arrange
      const eventEmitter = new MockEventEmitter();
      const mockCallback = jest.fn();
      
      // Act - Simulate component lifecycle
      // Setup phase (componentDidMount)
      const subscription = eventEmitter.addListener('dataChange', mockCallback);
      
      // Verify listener is working
      eventEmitter.emit('dataChange', { value: 'test' });
      expect(mockCallback).toHaveBeenCalledWith({ value: 'test' });
      
      // Cleanup phase (componentWillUnmount)
      subscription.remove();
      
      // Verify listener is removed
      mockCallback.mockClear();
      eventEmitter.emit('dataChange', { value: 'test2' });
      expect(mockCallback).not.toHaveBeenCalled();
    });
    
    test('should cancel timers to prevent memory leaks', () => {
      // Arrange
      const mockCallback = jest.fn();
      
      // Act - Simulate component with timer
      const timerId = setTimeout(mockCallback, 500);
      
      // Simulate component unmount - cleanup timers
      clearTimeout(timerId);
      
      // Fast-forward time
      jest.advanceTimersByTime(1000);
      
      // Assert
      expect(mockCallback).not.toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);
    });
    
    test('should handle abandoned promises that could cause memory leaks', async () => {
      // Arrange
      const abortController = new AbortController();
      const { signal } = abortController;
      
      // Create a promise that checks for abort signal
      const longRunningOperation = () => new Promise((resolve, reject) => {
        const checkAbort = () => {
          if (signal.aborted) {
            reject(new Error('Operation aborted'));
            return true;
          }
          return false;
        };
        
        // Immediate check
        if (checkAbort()) return;
        
        // Set up periodic checks
        const intervalId = setInterval(() => {
          if (checkAbort()) {
            clearInterval(intervalId);
          }
        }, 100);
        
        // Resolve after a long time if not aborted
        setTimeout(() => {
          clearInterval(intervalId);
          resolve('Operation completed');
        }, 500);
      });
      
      // Act - Start a long running operation
      const operationPromise = longRunningOperation();
      
      // Simulate component unmount - abort the operation
      abortController.abort();
      
      // Fast-forward time to trigger interval checks
      jest.advanceTimersByTime(100);
      
      // Assert
      await expect(operationPromise).rejects.toThrow('Operation aborted');
    }, 60000);
  });

  describe('Promise Chain Failures', () => {
    test('should handle errors in the middle of promise chains', async () => {
      // Arrange
      const processData = async (data: any) => {
        // Step 1: Validate
        const _validatedData = await Promise.resolve(data);
        
        // Step 2: Transform (will fail)
        const _transformedData = await Promise.reject(new Error('Transform failed'));
        
        // Step 3: Save (should never execute)
        const _savedData = await Promise.resolve({ ..._transformedData, saved: true });
        
        return _savedData;
      };
      
      // Act & Assert
      await expect(processData({ test: true })).rejects.toThrow('Transform failed');
    });
    
    test('should handle errors in nested promise chains', async () => {
      // Arrange
      const innerOperation = async () => {
        throw new Error('Inner operation failed');
      };
      
      const middleOperation = async () => {
        try {
          return await innerOperation();
        } catch (error) {
          throw new Error(`Middle operation caught: ${(error as Error).message}`);
        }
      };
      
      const outerOperation = async () => {
        try {
          return await middleOperation();
        } catch (error) {
          throw new Error(`Outer operation caught: ${(error as Error).message}`);
        }
      };
      
      // Act & Assert
      await expect(outerOperation()).rejects.toThrow(
        'Outer operation caught: Middle operation caught: Inner operation failed'
      );
    });
    
    test('should recover from promise chain failures with fallback values', async () => {
      // Arrange
      const fetchWithFallback = async (url: string, fallback: any) => {
        try {
          throw new Error('Network error');
        } catch (error) {
          console.error('Error fetching data:', error);
          return fallback;
        }
      };
      
      // Act
      const result = await fetchWithFallback('https://api.example.com/data', { fallback: true });
      
      // Assert
      expect(result).toEqual({ fallback: true });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Timeout Handling', () => {
    test('should handle promise timeout with race pattern', async () => {
      // Arrange
      const timeoutPromise = (ms: number) => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
        });
      };
      
      const slowOperation = () => {
        return new Promise(resolve => {
          setTimeout(() => resolve('Success'), 200);
        });
      };
      
      // Act & Assert - Operation should timeout
      const racePromise = Promise.race([slowOperation(), timeoutPromise(100)]);
      
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(100);
      
      await expect(racePromise).rejects.toThrow('Operation timed out after 100ms');
    });
    
    test('should implement custom timeout for async operations', async () => {
      // Arrange
      const operationWithTimeout = async <T>(
        operation: () => Promise<T>,
        timeoutMs: number
      ): Promise<T> => {
        const timeoutError = new Error(`Operation timed out after ${timeoutMs}ms`);
        
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
        });
        
        return Promise.race([
          operation(),
          timeoutPromise
        ]).finally(() => {
          clearTimeout(timeoutId);
        });
      };
      
      // A slow operation that would take too long
      const slowOperation = () => new Promise<string>(resolve => {
        setTimeout(() => resolve('Success'), 200);
      });
      
      // Act & Assert
      const operationPromise = operationWithTimeout(() => slowOperation(), 100);
      
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(100);
      
      await expect(operationPromise).rejects.toThrow('Operation timed out after 100ms');
    });
    
    test('should handle timeouts in parallel operations', async () => {
      // Arrange
      const operationWithTimeout = async (id: number, duration: number, timeout: number) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Operation ${id} timed out after ${timeout}ms`));
          }, timeout);
          
          setTimeout(() => {
            clearTimeout(timeoutId);
            resolve(`Operation ${id} completed in ${duration}ms`);
          }, duration);
        });
      };
      
      // Act
      const results = await Promise.allSettled([
        operationWithTimeout(1, 50, 100),  // Should succeed
        operationWithTimeout(2, 150, 100), // Should timeout
        operationWithTimeout(3, 80, 100),  // Should succeed
      ]);
      
      // Fast-forward time to trigger all operations
      jest.advanceTimersByTime(50);  // First operation completes
      jest.advanceTimersByTime(30);  // Third operation completes
      jest.advanceTimersByTime(20);  // Timeout for second operation
      
      // Assert
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      
      if (results[1].status === 'rejected') {
        expect(results[1].reason.message).toContain('Operation 2 timed out');
      }
    });
  });

  describe('Concurrent Operations', () => {
    test('should limit concurrency of parallel operations', async () => {
      // Arrange
      const concurrencyLimit = 3;
      let activeOperations = 0;
      let maxConcurrentOperations = 0;
      
      const operation = async (id: number) => {
        activeOperations++;
        maxConcurrentOperations = Math.max(maxConcurrentOperations, activeOperations);
        
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 10));
        jest.advanceTimersByTime(10);
        
        activeOperations--;
        return `Operation ${id} completed`;
      };
      
      // Helper to run operations with limited concurrency
      const runWithConcurrencyLimit = async (operations: (() => Promise<any>)[], limit: number) => {
        const results: any[] = [];
        const executing: Promise<any>[] = [];
        
        for (const operation of operations) {
          const p = Promise.resolve().then(() => operation());
          results.push(p);
          
          if (limit <= operations.length) {
            const e: Promise<any> = p.then(() => {
              executing.splice(executing.indexOf(e), 1);
            });
            executing.push(e);
            
            if (executing.length >= limit) {
              await Promise.race(executing);
            }
          }
        }
        
        return Promise.all(results);
      };
      
      // Act
      const operations = Array(10).fill(null).map((_, i) => () => operation(i + 1));
      await runWithConcurrencyLimit(operations, concurrencyLimit);
      
      // Assert
      expect(maxConcurrentOperations).toBeLessThanOrEqual(concurrencyLimit);
    }, 60000);
    
    test('should handle errors in concurrent operations without stopping others', async () => {
      // Arrange
      const operations = [
        () => Promise.resolve('Operation 1 success'),
        () => Promise.reject(new Error('Operation 2 failed')),
        () => Promise.resolve('Operation 3 success'),
        () => Promise.reject(new Error('Operation 4 failed')),
        () => Promise.resolve('Operation 5 success'),
      ];
      
      // Act
      const results = await Promise.allSettled(operations.map(op => op()));
      
      // Assert
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('rejected');
      expect(results[4].status).toBe('fulfilled');
      
      const successResults = results.filter(r => r.status === 'fulfilled');
      expect(successResults.length).toBe(3);
    });
    
    test('should prioritize operations in concurrent queue', async () => {
      // Arrange
      interface QueueItem {
        id: number;
        priority: number;
        operation: () => Promise<any>;
      }
      
      const priorityQueue: QueueItem[] = [
        { id: 1, priority: 2, operation: () => Promise.resolve('Operation 1 (Medium)') },
        { id: 2, priority: 1, operation: () => Promise.resolve('Operation 2 (High)') },
        { id: 3, priority: 3, operation: () => Promise.resolve('Operation 3 (Low)') },
        { id: 4, priority: 1, operation: () => Promise.resolve('Operation 4 (High)') },
        { id: 5, priority: 2, operation: () => Promise.resolve('Operation 5 (Medium)') },
      ];
      
      // Sort by priority (lower number = higher priority)
      priorityQueue.sort((a, b) => a.priority - b.priority);
      
      // Act
      const executionOrder: number[] = [];
      const _results = await Promise.all(
        priorityQueue.map(item => {
          return item.operation().then(result => {
            executionOrder.push(item.id);
            return result;
          });
        })
      );
      
      // Assert
      // High priority operations (2, 4) should be at the start of the execution order
      expect(executionOrder[0]).toBe(2);
      expect(executionOrder[1]).toBe(4);
      
      // Low priority operation (3) should be at the end
      expect(executionOrder[executionOrder.length - 1]).toBe(3);
    });
  });

  describe('Data Structure Edge Cases', () => {
    test('should handle deeply nested objects', async () => {
      // Arrange
      const deeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'Deep value',
                },
              },
            },
          },
        },
      };
      
      // Act
      await mockStorage.setItem('deeplyNested', JSON.stringify(deeplyNested));
      const retrieved = JSON.parse(await mockStorage.getItem('deeplyNested') || '{}');
      
      // Assert
      expect(retrieved.level1.level2.level3.level4.level5.value).toBe('Deep value');
    }, 60000);
    
    test('should handle circular references', async () => {
      // Arrange
      const circular: any = {
        name: 'Circular Object',
        value: 42,
      };
      circular.self = circular; // Create circular reference
      
      // Create a more complex circular structure
      circular.child = {
        parent: circular,
        name: 'Child Object',
      };
      
      // Act & Assert
      // Direct JSON.stringify will throw
      expect(() => JSON.stringify(circular)).toThrow();
      
      // Custom serializer to handle circular references
      const seen = new WeakSet();
      const serialized = JSON.stringify(circular, (key, value) => {
        if (key && typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        return value;
      });
      
      // Assert the serialized string contains the marker
      expect(serialized).toContain('[Circular Reference]');
      
      // We can deserialize it back
      const deserialized = JSON.parse(serialized);
      expect(deserialized.name).toBe('Circular Object');
      expect(deserialized.value).toBe(42);
      expect(deserialized.child.name).toBe('Child Object');
      expect(deserialized.child.parent).toBe('[Circular Reference]');
    });
    
    test('should handle Unicode and special characters', async () => {
      // Arrange
      const specialCharsObject = {
        emoji: '😀🚀🌟🔥🎉',
        arabic: 'مرحبا بالعالم',
        chinese: '你好世界',
        russian: 'Привет, мир',
        japanese: 'こんにちは世界',
        korean: '안녕하세요 세계',
        thai: 'สวัสดีชาวโลก',
        specialChars: '©®™§¶†‡♠♣♥♦¿¡«»',
        escapeChars: '\n\t\r\b\f\\\'\\"',
      };
      
      // Act
      await mockStorage.setItem('specialChars', JSON.stringify(specialCharsObject));
      const retrieved = JSON.parse(await mockStorage.getItem('specialChars') || '{}');
      
      // Assert
      expect(retrieved.emoji).toBe(specialCharsObject.emoji);
      expect(retrieved.arabic).toBe(specialCharsObject.arabic);
      expect(retrieved.chinese).toBe(specialCharsObject.chinese);
      expect(retrieved.russian).toBe(specialCharsObject.russian);
      expect(retrieved.japanese).toBe(specialCharsObject.japanese);
      expect(retrieved.korean).toBe(specialCharsObject.korean);
      expect(retrieved.thai).toBe(specialCharsObject.thai);
      expect(retrieved.specialChars).toBe(specialCharsObject.specialChars);
      expect(retrieved.escapeChars).toBe(specialCharsObject.escapeChars);
    }, 60000);
    
    test('should handle malformed data', async () => {
      // Arrange
      const malformedJSON = '{"name": "Test", "value": 42, missing: quotes, unclosed: {';
      
      // Act & Assert
      expect(() => JSON.parse(malformedJSON)).toThrow(SyntaxError);
      
      // Safe parser with error handling
      const safeParse = (json: string, fallback: any = {}) => {
        try {
          return JSON.parse(json);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          return fallback;
        }
      };
      
      // Act with safe parser
      const result = safeParse(malformedJSON, { error: true });
      
      // Assert
      expect(result).toEqual({ error: true });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Error Propagation', () => {
    test('should propagate errors through async chains', async () => {
      // Arrange
      const step1 = async () => {
        throw new Error('Error in step 1');
      };
      
      const step2 = async () => {
        await step1();
        return 'Step 2 completed';
      };
      
      const step3 = async () => {
        const result = await step2();
        return `Step 3 completed with ${result}`;
      };
      
      // Act & Assert
      await expect(step3()).rejects.toThrow('Error in step 1');
    });
    
    test('should transform errors through async chains', async () => {
      // Arrange
      const step1 = async () => {
        throw new Error('Database connection failed');
      };
      
      const step2 = async () => {
        try {
          await step1();
          return 'Step 2 completed';
        } catch (error) {
          throw new Error(`Data retrieval error: ${(error as Error).message}`);
        }
      };
      
      const step3 = async () => {
        try {
          const result = await step2();
          return `Step 3 completed with ${result}`;
        } catch (error) {
          throw new Error(`Processing error: ${(error as Error).message}`);
        }
      };
      
      // Act & Assert
      await expect(step3()).rejects.toThrow('Processing error: Data retrieval error: Database connection failed');
    });
    
    test('should handle errors with context information', async () => {
      // Arrange
      interface AppError extends Error {
        code?: string;
        context?: Record<string, any>;
      }
      
      const createAppError = (
        message: string,
        code?: string,
        context?: Record<string, any>
      ): AppError => {
        const error = new Error(message) as AppError;
        if (code) error.code = code;
        if (context) error.context = context;
        return error;
      };
      
      const executeOperation = async (context: string) => {
        try {
          throw new Error('Operation failed');
        } catch (error) {
          const appError = createAppError(
            (error as Error).message,
            'OPERATION_ERROR',
            { context }
          );
          throw appError;
        }
      };
      
      // Act & Assert
      try {
        await executeOperation('test-context');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Operation failed');
        expect(error.code).toBe('OPERATION_ERROR');
        expect(error.context).toEqual({ context: 'test-context' });
      }
    });
    
    test('should aggregate errors from multiple operations', async () => {
      // Arrange
      const operations = [
        () => Promise.resolve('Operation 1 success'),
        () => Promise.reject(new Error('Operation 2 failed')),
        () => Promise.resolve('Operation 3 success'),
        () => Promise.reject(new Error('Operation 4 failed')),
      ];
      
      // Custom implementation to aggregate errors
      const executeAll = async (ops: (() => Promise<any>)[]) => {
        const results = await Promise.allSettled(ops.map(op => op()));
        
        const successes = results
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map(r => r.value);
        
        const failures = results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map(r => r.reason);
        
        if (failures.length > 0) {
          const error = new Error(`${failures.length} operations failed`);
          (error as any).failures = failures;
          (error as any).successes = successes;
          throw error;
        }
        
        return successes;
      };
      
      // Act & Assert
      try {
        await executeAll(operations);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('2 operations failed');
        expect(error.failures.length).toBe(2);
        expect(error.failures[0].message).toBe('Operation 2 failed');
        expect(error.failures[1].message).toBe('Operation 4 failed');
        expect(error.successes.length).toBe(2);
        expect(error.successes).toEqual(['Operation 1 success', 'Operation 3 success']);
      }
    });
  });

  describe('Retry Mechanisms', () => {
    test('should implement retry with exponential backoff', async () => {
      // Arrange
      let attempts = 0;
      const maxAttempts = 3;
      
      const unreliableOperation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error(`Attempt ${attempts} failed`));
        }
        return Promise.resolve(`Success on attempt ${attempts}`);
      });
      
      const withRetry = async <T>(
        operation: () => Promise<T>,
        maxRetries: number,
        baseDelay = 10,
        factor = 2
      ): Promise<T> => {
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;
            console.warn(`Attempt ${attempt} failed: ${lastError.message}`);
            
            if (attempt < maxRetries) {
              const delay = baseDelay * Math.pow(factor, attempt - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
              jest.advanceTimersByTime(delay);
            }
          }
        }
        
        throw new Error(`All ${maxRetries} attempts failed. Last error: ${lastError?.message}`);
      };
      
      // Act
      const result = await withRetry(unreliableOperation, maxAttempts);
      
      // Assert
      expect(result).toBe('Success on attempt 3');
      expect(unreliableOperation).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    }, 60000);
    
    test('should implement retry with jitter to prevent thundering herd', async () => {
      // Arrange
      let attempts = 0;
      const maxAttempts = 3;
      
      const unreliableOperation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error(`Attempt ${attempts} failed`));
        }
        return Promise.resolve(`Success on attempt ${attempts}`);
      });
      
      const withRetryAndJitter = async <T>(
        operation: () => Promise<T>,
        maxRetries: number,
        baseDelay = 10,
        factor = 2,
        jitter = 0.5
      ): Promise<T> => {
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;
            
            if (attempt < maxRetries) {
              // Calculate delay with exponential backoff
              const expDelay = baseDelay * Math.pow(factor, attempt - 1);
              
              // Add jitter to prevent thundering herd problem
              const jitterAmount = expDelay * jitter;
              const delay = expDelay + (Math.random() * jitterAmount * 2) - jitterAmount;
              
              await new Promise(resolve => setTimeout(resolve, delay));
              jest.advanceTimersByTime(Math.ceil(delay));
            }
          }
        }
        
        throw new Error(`All ${maxRetries} attempts failed. Last error: ${lastError?.message}`);
      };
      
      // Act
      const result = await withRetryAndJitter(unreliableOperation, maxAttempts);
      
      // Assert
      expect(result).toBe('Success on attempt 3');
      expect(unreliableOperation).toHaveBeenCalledTimes(3);
      
      // Verify setTimeout was called with different values each time
      const delays = setTimeoutSpy.mock.calls.map(call => call[1]);
      expect(new Set(delays).size).toBe(delays.length); // All delays should be unique
    }, 60000);
    
    test('should implement conditional retry based on error type', async () => {
      // Arrange
      const networkError = new Error('Network error');
      (networkError as any).code = 'NETWORK_ERROR';
      
      const validationError = new Error('Validation error');
      (validationError as any).code = 'VALIDATION_ERROR';
      
      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        
        if (callCount === 1) {
          return Promise.reject(networkError); // Should retry
        } else if (callCount === 2) {
          return Promise.reject(validationError); // Should not retry
        }
        
        return Promise.resolve('Success');
      });
      
      const withConditionalRetry = async <T>(
        operation: () => Promise<T>,
        maxRetries: number,
        shouldRetry: (error: Error) => boolean
      ): Promise<T> => {
        let attempts = 0;
        let lastError: Error | null = null;
        
        while (attempts < maxRetries) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;
            attempts++;
            
            if (attempts >= maxRetries || !shouldRetry(lastError)) {
              throw lastError;
            }
            
            await new Promise(resolve => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
          }
        }
        
        throw lastError;
      };
      
      // Only retry network errors, not validation errors
      const shouldRetry = (error: Error) => (error as any).code === 'NETWORK_ERROR';
      
      // Act & Assert
      await expect(withConditionalRetry(operation, 3, shouldRetry)).rejects.toThrow('Validation error');
      expect(operation).toHaveBeenCalledTimes(2);
    }, 60000);
  });

  describe('Performance Optimization', () => {
    test('should efficiently process large arrays with chunking', async () => {
      // Arrange
      const largeArray = Array(100).fill(null).map((_, i) => ({ id: i, value: `Item ${i}` }));
      
      // Function to process array in chunks
      const processInChunks = async <T, R>(
        items: T[],
        chunkSize: number,
        processor: (chunk: T[]) => Promise<R[]>
      ): Promise<R[]> => {
        const results: R[] = [];
        
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const chunkResults = await processor(chunk);
          results.push(...chunkResults);
          
          // Allow event loop to process other tasks between chunks
          await new Promise(resolve => setTimeout(resolve, 0));
          jest.advanceTimersByTime(0);
        }
        
        return results;
      };
      
      // Mock processor function
      const processItems = jest.fn().mockImplementation(async (items: any[]) => {
        return items.map(item => ({ ...item, processed: true }));
      });
      
      // Act
      const startTime = performance.now();
      const results = await processInChunks(largeArray, 10, processItems);
      const endTime = performance.now();
      
      // Assert
      expect(results.length).toBe(100);
      expect(results[0].processed).toBe(true);
      expect(results[99].processed).toBe(true);
      
      // Should have called the processor 10 times (100 items / 10 chunk size)
      expect(processItems).toHaveBeenCalledTimes(10);
      
      // Performance should be reasonable (specific threshold depends on environment)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Should process in under 1 second
    }, 60000);
    
    test('should implement memoization for expensive calculations', () => {
      // Arrange
      const expensiveCalculation = jest.fn((a: number, b: number) => {
        // Simulate expensive calculation
        let result = 0;
        for (let i = 0; i < 100; i++) {
          result += Math.sqrt(a * i + b);
        }
        return result;
      });
      
      // Create a memoized version of the function
      const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
        const cache = new Map<string, ReturnType<T>>();
        
        return ((...args: Parameters<T>): ReturnType<T> => {
          const key = JSON.stringify(args);
          
          if (cache.has(key)) {
            return cache.get(key)!;
          }
          
          const result = fn(...args);
          cache.set(key, result);
          return result;
        }) as T;
      };
      
      const memoizedCalculation = memoize(expensiveCalculation);
      
      // Act
      const result1 = memoizedCalculation(10, 20);
      const result2 = memoizedCalculation(5, 10);
      const _result3 = memoizedCalculation(10, 20); // Should use cached result
      const _result4 = memoizedCalculation(5, 10);  // Should use cached result
      
      // Assert
      expect(result1).toBe(memoizedCalculation(10, 20));
      expect(result2).toBe(memoizedCalculation(5, 10));
      
      // Original function should only be called twice
      expect(expensiveCalculation).toHaveBeenCalledTimes(2);
    });
    
    test('should handle rapid concurrent operations', async () => {
      // Arrange
      const concurrentOperations = 20;
      let completedOperations = 0;
      let failedOperations = 0;
      
      // Mock storage with occasional failures
      jest.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        // 10% chance of failure
        if (Math.random() < 0.1) {
          return Promise.reject(new Error('Random failure'));
        }
        return Promise.resolve();
      });
      
      // Act
      const startTime = performance.now();
      
      // Launch many concurrent operations
      const promises = Array(concurrentOperations).fill(null).map((_, i) => {
        return mockStorage.setItem(`key-${i}`, `value-${i}`)
          .then(() => {
            completedOperations += 1;
          })
          .catch(() => {
            failedOperations += 1;
          });
      });
      
      await Promise.all(promises);
      
      // Assert
      expect(completedOperations + failedOperations).toBe(concurrentOperations);
      // We expect some random failures but not all
      expect(completedOperations).toBeGreaterThan(0);
      
      const duration = performance.now() - startTime;
      // Entire burst should finish quickly
      expect(duration).toBeLessThan(1000);
    });
  });
});
