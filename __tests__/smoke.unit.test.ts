/**
 * Smoke Test for Jest + TypeScript Configuration
 * 
 * This basic test verifies that:
 * 1. Jest is properly configured and running
 * 2. TypeScript compilation is working
 * 3. Basic test assertions function correctly
 */

// Test basic JavaScript functionality
describe('JavaScript Environment', () => {
  it('supports basic operations', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toHaveLength(5);
    expect([1, 2, 3]).toContain(2);
    expect({ name: 'test' }).toHaveProperty('name');
  });

  it('supports async/await', async () => {
    const result = await Promise.resolve('async works');
    expect(result).toBe('async works');
  });
});

// Test TypeScript functionality
describe('TypeScript Environment', () => {
  // Define a TypeScript interface
  interface User {
    id: number;
    name: string;
    active?: boolean;
  }

  it('supports TypeScript types', () => {
    // Create an object with the interface
    const user: User = {
      id: 1,
      name: 'Test User'
    };

    // TypeScript assertions
    expect(user.id).toBe(1);
    expect(user.name).toBe('Test User');
    expect(user.active).toBeUndefined();
  });

  it('supports TypeScript generics', () => {
    // Test with generics
    function getFirst<T>(array: T[]): T | undefined {
      return array[0];
    }

    expect(getFirst([1, 2, 3])).toBe(1);
    expect(getFirst(['a', 'b', 'c'])).toBe('a');
    expect(getFirst([])).toBeUndefined();
  });
});

// Test Jest environment
describe('Jest Test Environment', () => {
  it('supports mocks', () => {
    const mockFn = jest.fn();
    mockFn('test');
    
    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('supports snapshots', () => {
    const data = {
      timestamp: new Date().toISOString().split('T')[0], // Just the date part for stability
      message: 'Smoke test complete',
      success: true
    };
    
    // This will create a snapshot file on first run
    expect(data).toMatchSnapshot({
      timestamp: expect.any(String) // Make snapshot stable
    });
  });
});
