/**
 * smoke.unit.test.ts
 * 
 * Basic smoke test to verify that the Jest testing infrastructure is working correctly.
 * This includes TypeScript compilation, basic JavaScript features, and test environment.
 */

// Type definitions to test TypeScript compilation
interface User {
  id: number;
  name: string;
  email?: string;
}

type MathOperation = (a: number, b: number) => number;

describe('Smoke Test Suite', () => {
  describe('Basic Jest Functionality', () => {
    it('should run tests', () => {
      expect(true).toBe(true);
    });

    it('should support basic assertions', () => {
      expect(1).toBe(1);
      expect('test').toBe('test');
      expect({ a: 1 }).toEqual({ a: 1 });
    });

    it('should support matcher negation', () => {
      expect(1).not.toBe(2);
      expect('test').not.toBe('other');
    });
  });

  describe('TypeScript Compilation', () => {
    it('should compile TypeScript interfaces', () => {
      const user: User = {
        id: 1,
        name: 'Test User'
      };
      
      expect(user.id).toBe(1);
      expect(user.name).toBe('Test User');
    });

    it('should compile TypeScript type aliases', () => {
      const add: MathOperation = (a, b) => a + b;
      const subtract: MathOperation = (a, b) => a - b;
      
      expect(add(2, 3)).toBe(5);
      expect(subtract(5, 3)).toBe(2);
    });

    it('should support optional properties', () => {
      const user1: User = { id: 1, name: 'User 1' };
      const user2: User = { id: 2, name: 'User 2', email: 'user2@example.com' };
      
      expect(user1.email).toBeUndefined();
      expect(user2.email).toBe('user2@example.com');
    });
  });

  describe('Basic Arithmetic', () => {
    it('should perform addition correctly', () => {
      expect(1 + 2).toBe(3);
      expect(0.1 + 0.2).toBeCloseTo(0.3);
    });

    it('should perform subtraction correctly', () => {
      expect(5 - 3).toBe(2);
      expect(10 - 5 - 3).toBe(2);
    });

    it('should perform multiplication correctly', () => {
      expect(2 * 3).toBe(6);
      expect(0.1 * 0.2).toBeCloseTo(0.02);
    });

    it('should perform division correctly', () => {
      expect(6 / 2).toBe(3);
      expect(1 / 3).toBeCloseTo(0.333, 2);
    });
  });

  describe('String Operations', () => {
    it('should concatenate strings', () => {
      expect('Hello' + ' ' + 'World').toBe('Hello World');
    });

    it('should support template literals', () => {
      const name = 'Jest';
      expect(`Hello ${name}`).toBe('Hello Jest');
    });

    it('should support string methods', () => {
      const str = 'Hello World';
      expect(str.toLowerCase()).toBe('hello world');
      expect(str.toUpperCase()).toBe('HELLO WORLD');
      expect(str.split(' ')).toEqual(['Hello', 'World']);
      expect(str.replace('World', 'Jest')).toBe('Hello Jest');
    });
  });

  describe('Array Operations', () => {
    it('should create and manipulate arrays', () => {
      const arr = [1, 2, 3];
      expect(arr.length).toBe(3);
      expect(arr[0]).toBe(1);
    });

    it('should support array methods', () => {
      const arr = [1, 2, 3];
      expect(arr.map(x => x * 2)).toEqual([2, 4, 6]);
      expect(arr.filter(x => x > 1)).toEqual([2, 3]);
      expect(arr.reduce((acc, val) => acc + val, 0)).toBe(6);
    });

    it('should support array spread operator', () => {
      const arr1 = [1, 2];
      const arr2 = [3, 4];
      expect([...arr1, ...arr2]).toEqual([1, 2, 3, 4]);
    });

    it('should support array destructuring', () => {
      const [a, b, ...rest] = [1, 2, 3, 4, 5];
      expect(a).toBe(1);
      expect(b).toBe(2);
      expect(rest).toEqual([3, 4, 5]);
    });
  });

  describe('Object Operations', () => {
    it('should create and access object properties', () => {
      const obj = { a: 1, b: 'test', c: true };
      expect(obj.a).toBe(1);
      expect(obj.b).toBe('test');
      expect(obj.c).toBe(true);
    });

    it('should support object spread operator', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 3, c: 4 };
      expect({ ...obj1, ...obj2 }).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should support object destructuring', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const { a, b, ...rest } = obj;
      expect(a).toBe(1);
      expect(b).toBe(2);
      expect(rest).toEqual({ c: 3 });
    });

    it('should support computed property names', () => {
      const key = 'dynamicKey';
      const obj = { [key]: 'value' };
      expect(obj.dynamicKey).toBe('value');
    });
  });

  describe('Async/Await Functionality', () => {
    it('should support promises', () => {
      return Promise.resolve(42).then(value => {
        expect(value).toBe(42);
      });
    });

    it('should support async/await', async () => {
      const value = await Promise.resolve(42);
      expect(value).toBe(42);
    });

    it('should handle promise rejection', async () => {
      await expect(Promise.reject(new Error('Test error'))).rejects.toThrow('Test error');
    });

    it('should handle multiple async operations', async () => {
      const results = await Promise.all([
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3)
      ]);
      
      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('Test Environment', () => {
    it('should have access to Jest globals', () => {
      expect(typeof describe).toBe('function');
      expect(typeof it).toBe('function');
      expect(typeof expect).toBe('function');
      expect(typeof beforeEach).toBe('function');
      expect(typeof afterEach).toBe('function');
    });

    it('should support mocks', () => {
      const mockFn = jest.fn();
      mockFn('test');
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should support spies', () => {
      const obj = {
        method: (value: string) => `Hello ${value}`
      };
      
      const spy = jest.spyOn(obj, 'method');
      obj.method('World');
      
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('World');
    });
  });
});
