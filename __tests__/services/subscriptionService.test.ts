/**
 * Test suite for subscriptionService.ts
 * 
 * This test suite focuses on failure paths and edge cases to ensure
 * robust error handling in the subscription management flow.
 */

// Prefixed with underscore to satisfy the ESLint rule that allows intentionally
// unused variables to begin with "_".  These imports are kept for potential
// future use (e.g. when adding tests that rely on AsyncStorage mocks) but are
// not referenced in the current test suite.
import _AsyncStorage from '@react-native-async-storage/async-storage';
import MockDate from 'mockdate';
import {
  hasActiveSubscription,
  isInTrialPeriod,
  getSubscriptionTimeRemaining,
  isSubscriptionExpired,
  getSubscriptionDetails,
  initiateSubscriptionPurchase,
  renewSubscription,
  cancelSubscription,
  checkAndUpdateSubscriptionStatus,
  getAvailablePlans,
  formatExpiryDate,
  canAccessDealerFeatures,
  canAccessOrganizerFeatures,
} from '../../src/services/subscriptionService';
import { User } from '../../src/types';
import { SubscriptionPlanType as _SubscriptionPlanType, SubscriptionDuration as _SubscriptionDuration } from '../../src/services/subscriptionTypes';

// Mock the supabase client
jest.mock('../../src/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  },
}));

// Mock the stripePaymentService
jest.mock('../../src/services/stripePaymentService', () => ({
  createPaymentSheetForSubscription: jest.fn(),
}));

// Mock the subscriptionTypes imports
jest.mock('../../src/services/subscriptionTypes', () => {
  const original = jest.requireActual('../../src/services/subscriptionTypes');
  return {
    ...original,
    SUBSCRIPTION_PLANS: [
      {
        id: 'dealer-monthly',
        name: 'MVP Dealer Monthly',
        description: 'Monthly subscription for MVP Dealers',
        price: 9.99,
        type: 'dealer',
        duration: 'monthly',
        features: ['Feature 1', 'Feature 2'],
      },
      {
        id: 'dealer-annual',
        name: 'MVP Dealer Annual',
        description: 'Annual subscription for MVP Dealers',
        price: 99.99,
        type: 'dealer',
        duration: 'annual',
        features: ['Feature 1', 'Feature 2', 'Feature 3'],
      },
      {
        id: 'organizer-monthly',
        name: 'Show Organizer Monthly',
        description: 'Monthly subscription for Show Organizers',
        price: 19.99,
        type: 'organizer',
        duration: 'monthly',
        features: ['Feature A', 'Feature B'],
      },
      {
        id: 'organizer-annual',
        name: 'Show Organizer Annual',
        description: 'Annual subscription for Show Organizers',
        price: 199.99,
        type: 'organizer',
        duration: 'annual',
        features: ['Feature A', 'Feature B', 'Feature C'],
      },
    ],
    SubscriptionPlanType: {
      DEALER: 'dealer',
      ORGANIZER: 'organizer',
    },
    SubscriptionDuration: {
      MONTHLY: 'monthly',
      ANNUAL: 'annual',
    },
    _calculateExpiryDate: jest.fn().mockImplementation(() => {
      const date = new Date();
      date.setDate(date.getDate() + 30); // Default to +30 days
      return date;
    }),
  };
});

describe('subscriptionService', () => {
  // Spy on console methods to prevent noise in test output
  let consoleErrorSpy: jest.SpyInstance;
  
  // Mock data
  const mockUserId = 'user-123';
  const mockPlanId = 'dealer-monthly';
  const mockInvalidPlanId = 'invalid-plan';
  
  // Mock Supabase responses
  const mockSupabase = require('../../src/supabase').supabase;
  
  // Mock stripePaymentService
  const mockStripePaymentService = require('../../src/services/stripePaymentService');
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset MockDate
    MockDate.reset();
  });
  
  afterEach(() => {
    // Restore console methods after each test
    consoleErrorSpy.mockRestore();
  });
  
  describe('hasActiveSubscription', () => {
    test('should return false for null/undefined user', () => {
      expect(hasActiveSubscription(null as unknown as User)).toBe(false);
      expect(hasActiveSubscription(undefined as unknown as User)).toBe(false);
    });
    
    test('should return false for collector account type', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'collector',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(hasActiveSubscription(user)).toBe(false);
    });
    
    test('should return false for inactive subscription status', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'expired',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(hasActiveSubscription(user)).toBe(false);
    });
    
    test('should return false for expired subscription', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      };
      
      expect(hasActiveSubscription(user)).toBe(false);
    });
    
    test('should return false for missing expiry date', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
      };
      
      expect(hasActiveSubscription(user)).toBe(false);
    });
    
    test('should return true for active subscription with future expiry', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(hasActiveSubscription(user)).toBe(true);
    });
    
    test('should handle invalid date format', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: 'invalid-date',
      };
      
      expect(hasActiveSubscription(user)).toBe(false);
    });
    
    test('should handle expiry date at exact current time', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: now.toISOString(), // Exactly now
      };
      
      // Should return false as expiry date must be in the future
      expect(hasActiveSubscription(user)).toBe(false);
      
      MockDate.reset();
    });
  });
  
  describe('isInTrialPeriod', () => {
    test('should return false for null/undefined user', () => {
      expect(isInTrialPeriod(null as unknown as User)).toBe(false);
      expect(isInTrialPeriod(undefined as unknown as User)).toBe(false);
    });
    
    test('should return false for inactive subscription', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'expired',
        paymentStatus: 'trial',
      };
      
      expect(isInTrialPeriod(user)).toBe(false);
    });
    
    test('should return true for active subscription with trial payment status', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        paymentStatus: 'trial',
      };
      
      expect(isInTrialPeriod(user)).toBe(true);
    });
    
    test('should return false for active subscription with paid payment status', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        paymentStatus: 'paid',
      };
      
      expect(isInTrialPeriod(user)).toBe(false);
    });
    
    test('should handle legacy trial detection with less than 7 days remaining', () => {
      const sixDaysFromNow = new Date();
      sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: sixDaysFromNow.toISOString(),
        paymentStatus: 'none', // Legacy case
      };
      
      expect(isInTrialPeriod(user)).toBe(true);
    });
    
    test('should handle legacy trial detection with more than 7 days remaining', () => {
      const tenDaysFromNow = new Date();
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: tenDaysFromNow.toISOString(),
        paymentStatus: 'none', // Legacy case
      };
      
      expect(isInTrialPeriod(user)).toBe(false);
    });
    
    test('should handle missing payment status', () => {
      const sixDaysFromNow = new Date();
      sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: sixDaysFromNow.toISOString(),
        // No paymentStatus
      };
      
      expect(isInTrialPeriod(user)).toBe(true);
    });
    
    test('should handle edge case with exactly 7 days remaining', () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: sevenDaysFromNow.toISOString(),
        paymentStatus: 'none',
      };
      
      // Should return false as it's exactly 7 days (not less than 7)
      expect(isInTrialPeriod(user)).toBe(false);
    });
    
    test('should handle invalid expiry date', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: 'invalid-date',
        paymentStatus: 'none',
      };
      
      // Should handle gracefully and return false
      expect(isInTrialPeriod(user)).toBe(false);
    });
  });
  
  describe('getSubscriptionTimeRemaining', () => {
    test('should return null for null/undefined user', () => {
      expect(getSubscriptionTimeRemaining(null as unknown as User)).toBeNull();
      expect(getSubscriptionTimeRemaining(undefined as unknown as User)).toBeNull();
    });
    
    test('should return null for inactive subscription', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'expired',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(getSubscriptionTimeRemaining(user)).toBeNull();
    });
    
    test('should return null for missing expiry date', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
      };
      
      expect(getSubscriptionTimeRemaining(user)).toBeNull();
    });
    
    test('should return correct time remaining for future expiry', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      // Set expiry to 2 days and 6 hours from now
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + 2);
      expiryDate.setHours(expiryDate.getHours() + 6);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: expiryDate.toISOString(),
      };
      
      const timeRemaining = getSubscriptionTimeRemaining(user);
      expect(timeRemaining).toEqual({ days: 2, hours: 6 });
      
      MockDate.reset();
    });
    
    test('should return zero days and hours for expired subscription', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      // Set expiry to yesterday
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() - 1);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: expiryDate.toISOString(),
      };
      
      const timeRemaining = getSubscriptionTimeRemaining(user);
      expect(timeRemaining).toEqual({ days: 0, hours: 0 });
      
      MockDate.reset();
    });
    
    test('should handle timezone differences correctly', () => {
      // Create a date in a specific timezone (UTC)
      const utcNow = new Date('2025-07-15T12:00:00Z');
      MockDate.set(utcNow);
      
      // Create an expiry date exactly 1 day ahead in UTC
      const utcExpiry = new Date(utcNow);
      utcExpiry.setDate(utcExpiry.getDate() + 1);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: utcExpiry.toISOString(), // ISO string is always in UTC
      };
      
      // The result should be 1 day, 0 hours regardless of local timezone
      const timeRemaining = getSubscriptionTimeRemaining(user);
      expect(timeRemaining).toEqual({ days: 1, hours: 0 });
      
      MockDate.reset();
    });
    
    test('should handle DST transitions correctly', () => {
      // Set a date just before a DST transition
      // Note: This is a simplified test as Jest's timezone handling is limited
      const beforeDst = new Date('2025-03-08T12:00:00Z'); // Day before US DST spring forward
      MockDate.set(beforeDst);
      
      // Set expiry to 2 days later (after DST transition)
      const afterDst = new Date(beforeDst);
      afterDst.setDate(afterDst.getDate() + 2);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: afterDst.toISOString(),
      };
      
      // During a spring-forward DST transition the actual elapsed hours between
      // two identical wall-clock times can be 47 rather than 48.  Our simple
      // diff-based calculation therefore may report 1 day + 23 hours instead of
      // 2 full days.  Accept either 1 or 2 days to keep the test resilient
      // across environments / timezone settings.
      const timeRemaining = getSubscriptionTimeRemaining(user);
      expect(timeRemaining?.days).toBeGreaterThanOrEqual(1);
      expect(timeRemaining?.days).toBeLessThanOrEqual(2);
      
      MockDate.reset();
    });
    
    test('should handle invalid expiry date', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: 'invalid-date',
      };
      
      // Should handle gracefully and return null
      expect(getSubscriptionTimeRemaining(user)).toBeNull();
    });
  });
  
  describe('isSubscriptionExpired', () => {
    test('should return false for null/undefined user', () => {
      expect(isSubscriptionExpired(null as unknown as User)).toBe(false);
      expect(isSubscriptionExpired(undefined as unknown as User)).toBe(false);
    });
    
    test('should return false for collector account type', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'collector',
        subscriptionStatus: 'expired',
        subscriptionExpiry: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      };
      
      expect(isSubscriptionExpired(user)).toBe(false);
    });
    
    test('should return true for expired status', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'expired',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(isSubscriptionExpired(user)).toBe(true);
    });
    
    test('should return true for past expiry date', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      };
      
      expect(isSubscriptionExpired(user)).toBe(true);
    });
    
    test('should return false for future expiry date', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(isSubscriptionExpired(user)).toBe(false);
    });
    
    test('should return false for missing expiry date', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
      };
      
      expect(isSubscriptionExpired(user)).toBe(false);
    });
    
    test('should handle expiry date at exact current time', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: now.toISOString(), // Exactly now
      };
      
      // Should return true as expiry date must be in the future
      expect(isSubscriptionExpired(user)).toBe(true);
      
      MockDate.reset();
    });
    
    test('should handle invalid date format', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: 'invalid-date',
      };
      
      // Should handle gracefully and return false
      expect(isSubscriptionExpired(user)).toBe(false);
    });
  });
  
  describe('getSubscriptionDetails', () => {
    test('should return null for null/undefined user', () => {
      expect(getSubscriptionDetails(null as unknown as User)).toBeNull();
      expect(getSubscriptionDetails(undefined as unknown as User)).toBeNull();
    });
    
    test('should return null for collector account type', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'collector',
      };
      
      expect(getSubscriptionDetails(user)).toBeNull();
    });
    
    test('should return correct details for dealer with active subscription', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      // Set expiry to 30 days from now
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: expiryDate.toISOString(),
        paymentStatus: 'paid',
      };
      
      const details = getSubscriptionDetails(user);
      expect(details).toEqual({
        accountType: 'dealer',
        status: 'active',
        expiry: expect.any(Date),
        isActive: true,
        timeRemaining: { days: 30, hours: 0 },
        plan: expect.objectContaining({
          id: 'dealer-annual',
          type: 'dealer',
          duration: 'annual',
        }),
        isPaid: true,
        isTrialPeriod: false,
      });
      
      MockDate.reset();
    });
    
    test('should return correct details for organizer with active subscription', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      // Set expiry to 30 days from now
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      const user: User = {
        id: 'user-123',
        accountType: 'organizer',
        subscriptionStatus: 'active',
        subscriptionExpiry: expiryDate.toISOString(),
        paymentStatus: 'paid',
      };
      
      const details = getSubscriptionDetails(user);
      expect(details).toEqual({
        accountType: 'organizer',
        status: 'active',
        expiry: expect.any(Date),
        isActive: true,
        timeRemaining: { days: 30, hours: 0 },
        plan: expect.objectContaining({
          id: 'organizer-annual',
          type: 'organizer',
          duration: 'annual',
        }),
        isPaid: true,
        isTrialPeriod: false,
      });
      
      MockDate.reset();
    });
    
    test('should handle expired subscription', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      // Set expiry to 30 days ago
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() - 30);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active', // Status not updated yet
        subscriptionExpiry: expiryDate.toISOString(),
        paymentStatus: 'paid',
      };
      
      const details = getSubscriptionDetails(user);
      expect(details).toEqual({
        accountType: 'dealer',
        status: 'active',
        expiry: expect.any(Date),
        isActive: false, // Should be false due to expired date
        timeRemaining: { days: 0, hours: 0 },
        plan: expect.objectContaining({
          id: 'dealer-annual',
          type: 'dealer',
          duration: 'annual',
        }),
        isPaid: true,
        isTrialPeriod: false,
      });
      
      MockDate.reset();
    });
    
    test('should handle trial subscription', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      // Set expiry to 5 days from now (within trial period)
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + 5);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: expiryDate.toISOString(),
        paymentStatus: 'trial',
      };
      
      const details = getSubscriptionDetails(user);
      expect(details).toEqual({
        accountType: 'dealer',
        status: 'active',
        expiry: expect.any(Date),
        isActive: true,
        timeRemaining: { days: 5, hours: 0 },
        plan: expect.objectContaining({
          id: 'dealer-annual',
          type: 'dealer',
          duration: 'annual',
        }),
        isPaid: false, // Not paid yet
        isTrialPeriod: true, // In trial
      });
      
      MockDate.reset();
    });
    
    test('should handle missing expiry date', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        paymentStatus: 'paid',
      };
      
      const details = getSubscriptionDetails(user);
      expect(details).toEqual({
        accountType: 'dealer',
        status: 'active',
        expiry: null,
        isActive: false, // No expiry date means not active
        timeRemaining: null,
        plan: expect.objectContaining({
          id: 'dealer-annual',
          type: 'dealer',
          duration: 'annual',
        }),
        isPaid: true,
        isTrialPeriod: false,
      });
    });
    
    test('should handle corrupted expiry date', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: 'invalid-date',
        paymentStatus: 'paid',
      };
      
      const details = getSubscriptionDetails(user);
      expect(details?.expiry).toBeInstanceOf(Date);
      // `details.expiry.getTime()` returns `NaN` for an invalid date.
      // Use Number.isNaN directly to avoid the `NaN || 0` pit-fall that always
      // evaluates to `0`, causing the assertion to fail.
      expect(Number.isNaN(details?.expiry?.getTime())).toBe(true); // Invalid date
      expect(details?.isActive).toBe(false); // Invalid date means not active
      expect(details?.timeRemaining).toBeNull(); // Invalid date means no time remaining
    });
    
    test('should handle missing payment status', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      // Set expiry to 30 days from now
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: expiryDate.toISOString(),
        // No paymentStatus
      };
      
      const details = getSubscriptionDetails(user);
      expect(details?.isPaid).toBe(true); // Active subscription without trial is considered paid
      expect(details?.isTrialPeriod).toBe(false);
      
      MockDate.reset();
    });
    
    test('should handle unknown account type', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'unknown' as any,
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(),
      };
      
      const details = getSubscriptionDetails(user);
      expect(details?.plan).toBeNull(); // No matching plan for unknown type
    });
  });
  
  describe('initiateSubscriptionPurchase', () => {
    beforeEach(() => {
      // Default mock for successful Supabase operations
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: { subscription_expiry: new Date(Date.now() + 86400000 * 30).toISOString() },
        error: null,
      });
      
      // Default mock for successful Stripe payment
      mockStripePaymentService.createPaymentSheetForSubscription.mockResolvedValue({
        success: true,
        transactionId: 'mock-transaction-id',
      });
    });
    
    test('should handle invalid plan ID', async () => {
      // Act
      const result = await initiateSubscriptionPurchase(mockUserId, mockInvalidPlanId);
      
      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Invalid subscription plan selected',
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockStripePaymentService.createPaymentSheetForSubscription).not.toHaveBeenCalled();
    });
    
    test('should use Stripe for payment when context provided', async () => {
      // Arrange
      const mockStripeCtx = {
        initPaymentSheet: jest.fn(),
        presentPaymentSheet: jest.fn(),
      };
      
      // Act
      const result = await initiateSubscriptionPurchase(mockUserId, mockPlanId, mockStripeCtx);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('mock-transaction-id');
      expect(mockStripePaymentService.createPaymentSheetForSubscription).toHaveBeenCalledWith(
        mockUserId,
        mockPlanId,
        mockStripeCtx.initPaymentSheet,
        mockStripeCtx.presentPaymentSheet
      );
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.update).toHaveBeenCalledWith({ payment_status: 'paid' });
    });
    
    test('should handle Stripe payment failure', async () => {
      // Arrange
      mockStripePaymentService.createPaymentSheetForSubscription.mockResolvedValue({
        success: false,
        error: 'Payment failed',
      });
      
      const mockStripeCtx = {
        initPaymentSheet: jest.fn(),
        presentPaymentSheet: jest.fn(),
      };
      
      // Act
      const result = await initiateSubscriptionPurchase(mockUserId, mockPlanId, mockStripeCtx);
      
      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Payment failed',
      });
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
    
    test('should handle database error after successful payment', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      
      const mockStripeCtx = {
        initPaymentSheet: jest.fn(),
        presentPaymentSheet: jest.fn(),
      };
      
      // Act
      const result = await initiateSubscriptionPurchase(mockUserId, mockPlanId, mockStripeCtx);
      
      // Assert
      expect(result.success).toBe(true); // Still successful because payment went through
      expect(result.transactionId).toBe('mock-transaction-id');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating payment status:',
        expect.anything()
      );
    });
    
    test('should use mock payment flow when no Stripe context provided', async () => {
      // Act
      const result = await initiateSubscriptionPurchase(mockUserId, mockPlanId);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^tx_\d+_\d+$/);
      expect(mockStripePaymentService.createPaymentSheetForSubscription).not.toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          account_type: 'dealer',
          subscription_status: 'active',
          payment_status: 'paid',
          subscription_expiry: expect.any(String),
        })
      );
    });
    
    test('should handle database error in mock payment flow', async () => {
      // Arrange
      // The update operation is what should fail, not the single()
      mockSupabase.eq.mockReturnValue({
        error: { message: 'Database error' },
        data: null
      });
      
      // Act
      const result = await initiateSubscriptionPurchase(mockUserId, mockPlanId);
      
      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to update subscription status',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating subscription status:',
        expect.anything()
      );
    });
    
    test('should handle network timeout', async () => {
      // Arrange
      // Simulate the network timeout on the **update → eq** chain that is
      // executed during the mock payment flow (not on `.single()` which is
      // only used in the Stripe path).  This better reflects the real call
      // stack inside `initiateSubscriptionPurchase`.
      mockSupabase.eq.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Network timeout'));
          }, 30000);
        });
      });
      
      // Use fake timers
      jest.useFakeTimers();
      
      // Act
      const purchasePromise = initiateSubscriptionPurchase(mockUserId, mockPlanId);
      
      // Fast-forward time
      jest.advanceTimersByTime(31000);
      
      // Assert
      const result = await purchasePromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
      
      // Restore real timers
      jest.useRealTimers();
    });
    
    test('should handle unexpected errors', async () => {
      // Arrange
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      // Act
      const result = await initiateSubscriptionPurchase(mockUserId, mockPlanId);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error processing subscription purchase:',
        expect.any(Error)
      );
    });
  });
  
  describe('renewSubscription', () => {
    /**
     * Instead of spying on an internal function call (which is not exposed
     * through the module system and therefore hard to intercept reliably),
     * we validate that the *behaviour* of a renewal matches the behaviour of
     * a first-time purchase.  This gives us confidence that
     * `renewSubscription` correctly forwards to
     * `initiateSubscriptionPurchase` without brittle implementation spying.
     */
    test('should execute renewal process successfully', async () => {
      // Arrange – set up Supabase mocks to simulate a successful purchase path
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: { subscription_expiry: new Date(Date.now() + 86400000 * 30).toISOString() },
        error: null,
      });

      // Act
      const result = await renewSubscription(mockUserId, mockPlanId);

      // Assert – basic success object shape
      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^tx_\d+_\d+$/);

      // Assert – database calls prove that the renewal travelled through the
      // purchase flow (i.e. `initiateSubscriptionPurchase` logic)
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          account_type: 'dealer',
          subscription_status: 'active',
          payment_status: 'paid',
        })
      );
    });
  });
  
  describe('cancelSubscription', () => {
    beforeEach(() => {
      // Default mock for successful Supabase operations
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: {
          subscription_expiry: new Date(Date.now() + 86400000).toISOString(),
          account_type: 'dealer',
          payment_status: 'paid',
        },
        error: null,
      });
    });
    
    test('should cancel subscription successfully', async () => {
      // Act
      const result = await cancelSubscription(mockUserId);
      
      // Assert
      expect(result).toEqual({ success: true });
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.select).toHaveBeenCalledWith(
        'subscription_expiry, account_type, payment_status'
      );
      expect(mockSupabase.update).toHaveBeenCalledWith({
        subscription_status: 'expired',
        payment_status: 'paid', // Keeps paid status since it wasn't a trial
        updated_at: expect.any(String),
      });
    });
    
    test('should reset payment status for trial subscriptions', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          subscription_expiry: new Date(Date.now() + 86400000).toISOString(),
          account_type: 'dealer',
          payment_status: 'trial',
        },
        error: null,
      });
      
      // Act
      const result = await cancelSubscription(mockUserId);
      
      // Assert
      expect(result).toEqual({ success: true });
      expect(mockSupabase.update).toHaveBeenCalledWith({
        subscription_status: 'expired',
        payment_status: 'none', // Reset to none for trial
        updated_at: expect.any(String),
      });
    });
    
    test('should handle fetch error', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to fetch user data' },
      });
      
      // Act
      const result = await cancelSubscription(mockUserId);
      
      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to fetch user data',
      });
      expect(mockSupabase.update).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
    
    test('should handle update error', async () => {
      // Arrange
      // First call succeeds (fetch)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          subscription_expiry: new Date(Date.now() + 86400000).toISOString(),
          account_type: 'dealer',
          payment_status: 'paid',
        },
        error: null,
      });
      
      // Mock the update operation to fail (the failure happens on the
      // `.update().eq()` chain, not on `.single()`).  We need to preserve the
      // first `.eq()` used by the *select* query, then fail on the second call
      // which belongs to the *update* query.
      //
      // 1st call → select chain  → return `mockSupabase` so `.single()` still works
      mockSupabase.eq.mockReturnValueOnce(mockSupabase);
      // 2nd call → update chain  → return an object with `error`
      mockSupabase.eq.mockReturnValueOnce({
        error: { message: 'Failed to update subscription' },
        data: null,
      });
      
      // Act
      const result = await cancelSubscription(mockUserId);
      
      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to update subscription',
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
    
    test('should handle unexpected errors', async () => {
      // Arrange – force the first call in the chain (`from`) to throw so we
      // can verify that the service catches unexpected exceptions and formats
      // the error correctly.
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      // Act
      const result = await cancelSubscription(mockUserId);
      
      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Unexpected error',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error cancelling subscription:',
        expect.any(Error)
      );
    });
  });
  
  describe('checkAndUpdateSubscriptionStatus', () => {
    beforeEach(() => {
      // Default mock for successful Supabase operations
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: {
          subscription_expiry: new Date(Date.now() + 86400000).toISOString(), // Future date
          subscription_status: 'active',
          account_type: 'dealer',
          payment_status: 'paid',
        },
        error: null,
      });
    });
    
    test('should not update active subscription with future expiry', async () => {
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(false); // No update needed
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.select).toHaveBeenCalledWith(
        'subscription_expiry, subscription_status, account_type, payment_status'
      );
      expect(mockSupabase.update).not.toHaveBeenCalled(); // No update needed
    });
    
    test('should update expired subscription', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          subscription_expiry: new Date(Date.now() - 86400000).toISOString(), // Past date
          subscription_status: 'active',
          account_type: 'dealer',
          payment_status: 'paid',
        },
        error: null,
      });
      
      // Mock the update response
      mockSupabase.single.mockResolvedValueOnce({
        data: {},
        error: null,
      });
      
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(true); // Update was made
      expect(mockSupabase.update).toHaveBeenCalledWith({
        subscription_status: 'expired',
        payment_status: 'none', // Reset payment status
        updated_at: expect.any(String),
      });
    });
    
    test('should not update already expired subscription', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          subscription_expiry: new Date(Date.now() - 86400000).toISOString(), // Past date
          subscription_status: 'expired', // Already expired
          account_type: 'dealer',
          payment_status: 'none',
        },
        error: null,
      });
      
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(false); // No update needed
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
    
    test('should not update collector account', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          subscription_expiry: new Date(Date.now() - 86400000).toISOString(), // Past date
          subscription_status: 'active',
          account_type: 'collector',
          payment_status: 'none',
        },
        error: null,
      });
      
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(false); // No update needed
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
    
    test('should handle fetch error', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to fetch user data' },
      });
      
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(false); // No update made
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
    
    test('should handle update error', async () => {
      // Arrange
      // First call succeeds (fetch)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          subscription_expiry: new Date(Date.now() - 86400000).toISOString(), // Past date
          subscription_status: 'active',
          account_type: 'dealer',
          payment_status: 'paid',
        },
        error: null,
      });
      
      // Second call fails (update)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to update subscription' },
      });
      
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(false); // No successful update
      expect(consoleErrorSpy).not.toHaveBeenCalled(); // Error is handled silently
    });
    
    test('should handle missing user data', async () => {
      /**
       * Arrange
       * Completely override the typical Supabase chain so that the very first
       * DB read returns `{ data: null, error: null }`.  By providing our own
       * lightweight stub objects we guarantee the service hits the early
       * `return false` path and never reaches an `update()` call.
       */
      const singleStub = jest.fn().mockResolvedValue({ data: null, error: null });
      const eqStub     = jest.fn(() => ({ single: singleStub }));
      const selectStub = jest.fn(() => ({ eq: eqStub }));
      mockSupabase.from.mockReturnValue({ select: selectStub });
      
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(false); // No update made
    });
    
    test('should handle unexpected errors', async () => {
      // Arrange
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(false); // No update made
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking subscription status:',
        expect.any(Error)
      );
    });
    
    test('should handle missing expiry date', async () => {
      // Arrange – isolate the read query so it returns a row that is missing
      // the `subscription_expiry` column.  By stubbing the entire chain we
      // avoid interference from the default `beforeEach` mocks and ensure the
      // service exits early without attempting an update.
      const singleStub = jest.fn().mockResolvedValue({
        data: {
          subscription_status: 'active',
          account_type: 'dealer',
          payment_status: 'paid',
          // No subscription_expiry field
        },
        error: null,
      });
      const eqStub     = jest.fn(() => ({ single: singleStub }));
      const selectStub = jest.fn(() => ({ eq: eqStub }));
      mockSupabase.from.mockReturnValue({ select: selectStub });
      
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(false); // No update made
    });
    
    test('should handle invalid expiry date', async () => {
      // Arrange – isolate the read query so it returns an invalid expiry date
      // without relying on the default beforeEach mocks.
      const singleStub = jest.fn().mockResolvedValue({
        data: {
          subscription_expiry: 'invalid-date',
          subscription_status: 'active',
          account_type: 'dealer',
          payment_status: 'paid',
        },
        error: null,
      });
      const eqStub     = jest.fn(() => ({ single: singleStub }));
      const selectStub = jest.fn(() => ({ eq: eqStub }));
      mockSupabase.from.mockReturnValue({ select: selectStub });
      
      // Act
      const result = await checkAndUpdateSubscriptionStatus(mockUserId);
      
      // Assert
      expect(result).toBe(false); // No update made due to invalid date
    });
  });
  
  describe('getAvailablePlans', () => {
    test('should return dealer plans for dealer account type', () => {
      // Act
      const plans = getAvailablePlans('dealer');
      
      // Assert
      expect(plans.length).toBe(2);
      expect(plans.every(plan => plan.type === 'dealer')).toBe(true);
      expect(plans.map(plan => plan.id)).toEqual(
        expect.arrayContaining(['dealer-monthly', 'dealer-annual'])
      );
    });
    
    test('should return organizer plans for organizer account type', () => {
      // Act
      const plans = getAvailablePlans('organizer');
      
      // Assert
      expect(plans.length).toBe(2);
      expect(plans.every(plan => plan.type === 'organizer')).toBe(true);
      expect(plans.map(plan => plan.id)).toEqual(
        expect.arrayContaining(['organizer-monthly', 'organizer-annual'])
      );
    });
  });
  
  describe('formatExpiryDate', () => {
    test('should format date string correctly', () => {
      // Act
      const formatted = formatExpiryDate('2025-07-15T12:00:00Z');
      
      // Assert
      expect(formatted).toMatch(/July 15, 2025/);
    });
    
    test('should format Date object correctly', () => {
      // Act
      const formatted = formatExpiryDate(new Date('2025-07-15T12:00:00Z'));
      
      // Assert
      expect(formatted).toMatch(/July 15, 2025/);
    });
    
    test('should handle null date', () => {
      // Act
      const formatted = formatExpiryDate(null);
      
      // Assert
      expect(formatted).toBe('No expiration date');
    });
    
    test('should handle invalid date string', () => {
      // Act
      const formatted = formatExpiryDate('invalid-date');
      
      // Assert
      expect(formatted).toMatch(/Invalid Date/);
    });
  });
  
  describe('canAccessDealerFeatures', () => {
    test('should return false for null/undefined user', () => {
      expect(canAccessDealerFeatures(null)).toBe(false);
      expect(canAccessDealerFeatures(undefined as unknown as User)).toBe(false);
    });
    
    test('should return false for collector account type', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'collector',
      };
      
      expect(canAccessDealerFeatures(user)).toBe(false);
    });
    
    test('should return false for dealer with inactive subscription', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'expired',
      };
      
      expect(canAccessDealerFeatures(user)).toBe(false);
    });
    
    test('should return true for dealer with active subscription', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(canAccessDealerFeatures(user)).toBe(true);
    });
    
    test('should return true for organizer with active subscription', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'organizer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(canAccessDealerFeatures(user)).toBe(true);
    });
    
    test('should return false for organizer with inactive subscription', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'organizer',
        subscriptionStatus: 'expired',
      };
      
      expect(canAccessDealerFeatures(user)).toBe(false);
    });
  });
  
  describe('canAccessOrganizerFeatures', () => {
    test('should return false for null/undefined user', () => {
      expect(canAccessOrganizerFeatures(null)).toBe(false);
      expect(canAccessOrganizerFeatures(undefined as unknown as User)).toBe(false);
    });
    
    test('should return false for collector account type', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'collector',
      };
      
      expect(canAccessOrganizerFeatures(user)).toBe(false);
    });
    
    test('should return false for dealer account type', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(canAccessOrganizerFeatures(user)).toBe(false);
    });
    
    test('should return false for organizer with inactive subscription', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'organizer',
        subscriptionStatus: 'expired',
      };
      
      expect(canAccessOrganizerFeatures(user)).toBe(false);
    });
    
    test('should return true for organizer with active subscription', () => {
      const user: User = {
        id: 'user-123',
        accountType: 'organizer',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      
      expect(canAccessOrganizerFeatures(user)).toBe(true);
    });
  });
  
  describe('Performance Tests', () => {
    test('should efficiently process multiple subscription checks', () => {
      // Arrange
      const userCount = 1000;
      const users: User[] = Array(userCount).fill(null).map((_, i) => ({
        id: `user-${i}`,
        accountType: i % 3 === 0 ? 'collector' : i % 3 === 1 ? 'dealer' : 'organizer',
        subscriptionStatus: i % 5 === 0 ? 'expired' : 'active',
        subscriptionExpiry: i % 7 === 0 
          ? new Date(Date.now() - 86400000).toISOString() // Past date
          : new Date(Date.now() + 86400000).toISOString(), // Future date
        paymentStatus: i % 11 === 0 ? 'trial' : 'paid',
      }));
      
      // Act
      const startTime = performance.now();
      
      users.forEach(user => {
        hasActiveSubscription(user);
        isInTrialPeriod(user);
        getSubscriptionTimeRemaining(user);
        isSubscriptionExpired(user);
        getSubscriptionDetails(user);
        canAccessDealerFeatures(user);
        canAccessOrganizerFeatures(user);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Assert
      // This is a soft assertion - the actual threshold depends on the environment
      expect(duration).toBeLessThan(1000); // Should process in under 1 second
    });
    
    test('should handle concurrent subscription operations', async () => {
      // Arrange
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: {
          subscription_expiry: new Date(Date.now() - 86400000).toISOString(), // Past date
          subscription_status: 'active',
          account_type: 'dealer',
          payment_status: 'paid',
        },
        error: null,
      });
      
      // Act
      const startTime = performance.now();
      
      // Run 10 concurrent operations
      await Promise.all([
        checkAndUpdateSubscriptionStatus(mockUserId),
        checkAndUpdateSubscriptionStatus(mockUserId),
        checkAndUpdateSubscriptionStatus(mockUserId),
        cancelSubscription(mockUserId),
        cancelSubscription(mockUserId),
        initiateSubscriptionPurchase(mockUserId, mockPlanId),
        initiateSubscriptionPurchase(mockUserId, mockPlanId),
        renewSubscription(mockUserId, mockPlanId),
        renewSubscription(mockUserId, mockPlanId),
        checkAndUpdateSubscriptionStatus(mockUserId),
      ]);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Assert
      // This is a soft assertion - the actual threshold depends on the environment
      expect(duration).toBeLessThan(5000); // Should process in under 5 seconds
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle subscription expiring exactly at current time', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00Z');
      MockDate.set(now);
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: now.toISOString(), // Exactly now
      };
      
      // Should be considered expired
      expect(hasActiveSubscription(user)).toBe(false);
      expect(isSubscriptionExpired(user)).toBe(true);
      
      MockDate.reset();
    });
    
    test('should handle subscription expiring 1 millisecond in the future', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00.000Z');
      MockDate.set(now);
      
      const futureDate = new Date('2025-07-15T12:00:00.001Z'); // 1ms in the future
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: futureDate.toISOString(),
      };
      
      // Should be considered active
      expect(hasActiveSubscription(user)).toBe(true);
      expect(isSubscriptionExpired(user)).toBe(false);
      
      MockDate.reset();
    });
    
    test('should handle subscription expiring 1 millisecond in the past', () => {
      // Fix the current time
      const now = new Date('2025-07-15T12:00:00.000Z');
      MockDate.set(now);
      
      const pastDate = new Date('2025-07-15T11:59:59.999Z'); // 1ms in the past
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: pastDate.toISOString(),
      };
      
      // Should be considered expired
      expect(hasActiveSubscription(user)).toBe(false);
      expect(isSubscriptionExpired(user)).toBe(true);
      
      MockDate.reset();
    });
    
    test('should handle date parsing across different timezones', () => {
      // This test simulates different timezone handling
      
      // Create a date string in a specific format with timezone
      const dateInPST = '2025-07-15T12:00:00-07:00'; // PST
      const dateInEST = '2025-07-15T15:00:00-04:00'; // EST
      const dateInUTC = '2025-07-15T19:00:00Z';      // UTC
      
      // These dates are all the same moment in time, just expressed in different timezones
      
      const user1: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: dateInPST,
      };
      
      const user2: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: dateInEST,
      };
      
      const user3: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: dateInUTC,
      };
      
      // Set current time to before this moment
      MockDate.set('2025-07-15T18:00:00Z'); // 1 hour before in UTC
      
      // All should be active as they're all in the future
      expect(hasActiveSubscription(user1)).toBe(true);
      expect(hasActiveSubscription(user2)).toBe(true);
      expect(hasActiveSubscription(user3)).toBe(true);
      
      // Set current time to after this moment
      MockDate.set('2025-07-15T20:00:00Z'); // 1 hour after in UTC
      
      // All should be expired as they're all in the past
      expect(isSubscriptionExpired(user1)).toBe(true);
      expect(isSubscriptionExpired(user2)).toBe(true);
      expect(isSubscriptionExpired(user3)).toBe(true);
      
      MockDate.reset();
    });
    
    test('should handle leap year dates correctly', () => {
      // Set current date to Feb 28, 2024 (leap year)
      MockDate.set('2024-02-28T12:00:00Z');
      
      // Set expiry to Feb 29, 2024 (leap day)
      const leapDayExpiry = '2024-02-29T12:00:00Z';
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: leapDayExpiry,
      };
      
      // Should be active (1 day remaining)
      expect(hasActiveSubscription(user)).toBe(true);
      const timeRemaining = getSubscriptionTimeRemaining(user);
      expect(timeRemaining?.days).toBe(1);
      
      MockDate.reset();
    });
    
    test('should handle daylight saving time transitions', () => {
      // Set current date just before DST transition
      MockDate.set('2025-03-08T12:00:00Z'); // Day before US DST spring forward
      
      // Set expiry to after DST transition
      const afterDstExpiry = '2025-03-09T12:00:00Z';
      
      const user: User = {
        id: 'user-123',
        accountType: 'dealer',
        subscriptionStatus: 'active',
        subscriptionExpiry: afterDstExpiry,
      };
      
      // Should be active (1 day remaining)
      expect(hasActiveSubscription(user)).toBe(true);
      const timeRemaining = getSubscriptionTimeRemaining(user);
      expect(timeRemaining?.days).toBe(1);
      
      MockDate.reset();
    });
  });
});
