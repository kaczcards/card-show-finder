/**
 * Test suite for stripePaymentService.ts
 * 
 * This test suite focuses on core functionality and realistic error paths
 * in the payment processing flow.
 */

import { SubscriptionPlan, SubscriptionPlanType, SubscriptionDuration } from '../../src/services/subscriptionTypes';
import { UserRole } from '../../src/services/userRoleService';

// These will be populated via a dynamic import after we finish env-var setup
let initializeStripe: any;
let createPaymentSheetForSubscription: any;
let processSubscriptionUpdate: any;

// Mock the supabase client
jest.mock('../../src/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(),
  },
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

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_key';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://mock-supabase-url.com';

  // Reset all mocks
  jest.clearAllMocks();
  
  // Provide a sane default for `supabase.auth.getSession` so tests start with
  // a valid structure (individual tests can override this as needed).
  const supabaseMock = require('../../src/supabase').supabase;
  supabaseMock.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'mock-access-token' } },
    error: null,
  });
  
  // Mock console methods to prevent noise in test output
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  /**
   * Re-require the stripePaymentService module *after* the environment
   * variables have been (re)configured and `jest.resetModules()` has cleared
   * the module cache.
   */
  jest.isolateModules(() => {
    const stripeService = require('../../src/services/stripePaymentService');
    initializeStripe = stripeService.initializeStripe;
    createPaymentSheetForSubscription = stripeService.createPaymentSheetForSubscription;
    processSubscriptionUpdate = stripeService.processSubscriptionUpdate;
  });
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

// Mock global fetch
global.fetch = jest.fn();

describe('stripePaymentService', () => {
  // Mock data
  const mockUserId = 'user-123';
  const mockPlanId = 'dealer-monthly';
  const mockInvalidPlanId = 'invalid-plan';
  const mockPaymentIntent = 'pi_mock_payment_intent';
  const mockEphemeralKey = 'ek_mock_ephemeral_key';
  const mockCustomer = 'cus_mock_customer';
  const mockPublishableKey = 'pk_test_mock_key';
  
  const mockPlan: SubscriptionPlan = {
    id: 'dealer-monthly',
    name: 'MVP Dealer Monthly',
    description: 'Monthly subscription for MVP Dealers',
    price: 9.99,
    type: SubscriptionPlanType.DEALER,
    duration: SubscriptionDuration.MONTHLY,
    features: ['Feature 1', 'Feature 2'],
  };

  // Mock Stripe functions
  const mockInitPaymentSheet = jest.fn();
  const mockPresentPaymentSheet = jest.fn();

  // Mock Supabase responses
  const mockSupabase = require('../../src/supabase').supabase;

  describe('initializeStripe', () => {
    test('should return true when publishable key is set', () => {
      // Arrange
      process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_valid_key';
      
      // Act
      const result = initializeStripe();
      
      // Assert
      expect(result).toBe(true);
    });

    test('should return false when publishable key is empty', () => {
      // Arrange
      process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = '';
      // Re-import the module with the updated environment
      let testInitializeStripe: any;
      jest.isolateModules(() => {
        const stripeService = require('../../src/services/stripePaymentService');
        testInitializeStripe = stripeService.initializeStripe;
      });

      // Act
      const result = testInitializeStripe();

      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'Stripe publishable key is not set. Please check your environment variables.'
      );
    });
  });

  describe('createPaymentSheetForSubscription', () => {
    beforeEach(() => {
      // Default mock for successful session retrieval
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-access-token',
          },
        },
        error: null,
      });

      // Default mock for successful fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          paymentIntent: mockPaymentIntent,
          ephemeralKey: mockEphemeralKey,
          customer: mockCustomer,
          publishableKey: mockPublishableKey,
        }),
      });

      // Default mocks for Stripe functions
      mockInitPaymentSheet.mockResolvedValue({ error: null });
      mockPresentPaymentSheet.mockResolvedValue({ error: null });
    });

    test('should return error for invalid plan ID', async () => {
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockInvalidPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Subscription plan not found.',
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should handle network failure during payment intent creation', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle payment intent creation error (400)', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: 'Invalid request parameters',
        }),
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid request parameters');
    });

    test('should handle payment intent creation error (401)', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({
          error: 'Unauthorized access',
        }),
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized access');
    });

    test('should handle payment intent creation error (500)', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({
          error: 'Server error',
        }),
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });

    test('should handle Stripe initPaymentSheet error', async () => {
      // Arrange
      mockInitPaymentSheet.mockResolvedValue({
        error: { code: 'initialization_error', message: 'Failed to initialize payment sheet' },
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Initialization failed: Failed to initialize payment sheet');
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle Stripe presentPaymentSheet canceled error', async () => {
      // Arrange
      mockPresentPaymentSheet.mockResolvedValue({
        error: { code: 'Canceled', message: 'The payment was canceled' },
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment was canceled.');
    });

    test('should handle Stripe presentPaymentSheet payment failure', async () => {
      // Arrange
      mockPresentPaymentSheet.mockResolvedValue({
        error: { code: 'payment_failed', message: 'The payment failed' },
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed: The payment failed');
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle timeout during payment intent creation', async () => {
      // Arrange
      jest.useFakeTimers();
      const mockFetchPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timed out'));
        }, 30000);
      });
      (global.fetch as jest.Mock).mockReturnValue(mockFetchPromise);
      
      // Act
      const resultPromise = createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Fast-forward time
      jest.advanceTimersByTime(31000);
      
      // Assert
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
      
      jest.useRealTimers();
    });

    test('should handle invalid user ID', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: 'Invalid user ID',
        }),
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        'invalid-user-id',
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    test('should handle successful payment flow', async () => {
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(mockPaymentIntent);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/create-payment-intent'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-access-token',
          }),
          body: expect.any(String),
        })
      );
    });
  });

  describe('Edge cases', () => {
    test('should handle concurrent payment attempts', async () => {
      // Arrange
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              paymentIntent: mockPaymentIntent,
              ephemeralKey: mockEphemeralKey,
              customer: mockCustomer,
              publishableKey: mockPublishableKey,
            }),
          });
        } else {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
              error: 'Payment already in progress',
            }),
          });
        }
      });
      
      // Act
      const results = await Promise.all([
        createPaymentSheetForSubscription(
          mockUserId,
          mockPlanId,
          mockInitPaymentSheet,
          mockPresentPaymentSheet
        ),
        createPaymentSheetForSubscription(
          mockUserId,
          mockPlanId,
          mockInitPaymentSheet,
          mockPresentPaymentSheet
        ),
      ]);
      
      // Assert
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Payment already in progress');
    });

    test('should handle JSON parse errors in API response', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON')),
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected token < in JSON');
    });

    test('should handle empty response from payment intent creation', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot read properties of null');
    });

    test('should handle rate limiting from Stripe API', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({
          error: 'Too many requests. Please try again later.',
        }),
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Too many requests. Please try again later.');
    });

    test('should handle Stripe API service outage', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        json: jest.fn().mockResolvedValue({
          error: 'Stripe API is currently unavailable',
        }),
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe API is currently unavailable');
    });

    test('should handle invalid currency code', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: 'Invalid currency code',
        }),
      });
      
      // Act
      const result = await createPaymentSheetForSubscription(
        mockUserId,
        mockPlanId,
        mockInitPaymentSheet,
        mockPresentPaymentSheet
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid currency code');
    });
  });
});
