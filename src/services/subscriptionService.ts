// src/services/subscriptionService.ts
import { supabase } from '../supabase';
import { User } from '../types';
import { createPaymentSheetForSubscription } from './stripePaymentService';
import {
  SubscriptionPlan,
  SubscriptionPlanType,
  SubscriptionDuration,
  SUBSCRIPTION_PLANS,
  StripePaymentResult,
  _calculateExpiryDate as calculateExpiryDate
} from './subscriptionTypes';
import AppleIAPService, { SUBSCRIPTION_SKUS, PRODUCT_TO_PLAN_MAP } from './appleIAPService';
import { Platform } from 'react-native';

/**
 * Result of a payment operation
 */
export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  subscriptionExpiry?: Date;
}

/**
 * Check if a user has an active subscription
 * @param user The user to check
 * @returns Boolean indicating if the subscription is active
 */
export const hasActiveSubscription = (user: User): boolean => {
  if (!user) return false;
  
  // Free collector accounts don't have subscriptions
  if (user.accountType === 'collector') return false;
  
  // Check if the subscription status is active
  if (user.subscriptionStatus !== 'active') return false;
  
  // Check if the subscription has expired
  if (user.subscriptionExpiry) {
    const expiryDate = new Date(user.subscriptionExpiry);
    return expiryDate > new Date();
  }
  
  return false;
};

/**
 * Check if a user is in their trial period
 * @param user The user to check
 * @returns Boolean indicating if the user is in trial period
 */
export const isInTrialPeriod = (user: User): boolean => {
  if (!user || !hasActiveSubscription(user)) return false;
  
  // Check if payment_status is explicitly set to 'trial'
  if (user.paymentStatus === 'trial') return true;
  
  // Legacy check for users without payment_status field
  // If they have less than 7 days remaining and no payment_status,
  // they're likely in a trial period
  if (!user.paymentStatus || user.paymentStatus === 'none') {
    const timeRemaining = getSubscriptionTimeRemaining(user);
    if (timeRemaining && timeRemaining.days < 7) {
      return true;
    }
  }
  
  return false;
};

/**
 * Get the time remaining in a user's subscription
 * @param user The user to check
 * @returns Object with days, hours remaining or null if no active subscription
 */
export const getSubscriptionTimeRemaining = (user: User): { days: number, hours: number } | null => {
  /* ------------------------------------------------------------------
   * 1. Bail-out cases – users that should never have a subscription
   * ------------------------------------------------------------------ */
  if (!user || user.accountType === 'collector') {
    return null;
  }

  /* ------------------------------------------------------------------
   * 2. Inactive subscription statuses
   * ------------------------------------------------------------------ */
  if (user.subscriptionStatus !== 'active') {
    return null;
  }

  // If we don't even have an expiry date we cannot compute anything
  if (!user?.subscriptionExpiry) {
    return null;
  }

  const expiryDate = new Date(user.subscriptionExpiry);

  // Guard against corrupted / unparsable dates
  if (Number.isNaN(expiryDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();

  // If already expired, return explicit zero time remaining object
  if (diffMs <= 0) {
    return { days: 0, hours: 0 };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return { days, hours };
};

/**
 * Check if a user's subscription has expired
 * @param user The user to check
 * @returns Boolean indicating if the subscription is expired
 */
export const isSubscriptionExpired = (user: User): boolean => {
  if (!user || user.accountType === 'collector') return false;
  
  if (user.subscriptionStatus === 'expired') return true;
  
  if (user.subscriptionExpiry) {
    const expiryDate = new Date(user.subscriptionExpiry);
    return expiryDate <= new Date();
  }
  
  return false;
};

/**
 * Get subscription details for a user
 * @param user The user to get subscription details for
 * @returns Object with subscription details or null if no subscription
 */
export const getSubscriptionDetails = (user: User): {
  accountType: string;
  status: string;
  expiry: Date | null;
  isActive: boolean;
  timeRemaining: { days: number, hours: number } | null;
  plan: SubscriptionPlan | null;
  isPaid: boolean;
  isTrialPeriod: boolean;
} | null => {
  if (!user || user.accountType === 'collector') {
    return null;
  }
  
  // Resolve plan type safely – unknown account types yield null plan
  let plan: SubscriptionPlan | null = null;
  if (user.accountType === 'dealer' || user.accountType === 'organizer') {
    const planType =
      user.accountType === 'dealer'
        ? SubscriptionPlanType.DEALER
        : SubscriptionPlanType.ORGANIZER;

    // Default to the annual plan as it's the most common
    plan =
      SUBSCRIPTION_PLANS.find(
        (p) => p.type === planType && p.duration === SubscriptionDuration.ANNUAL,
      ) || null;
  }
  
  // Check if user is in trial period
  const isTrialPeriod = isInTrialPeriod(user);
  
  // Check if user has paid (either explicitly marked as paid or has active subscription but not in trial)
  const isPaid = user.paymentStatus === 'paid' || 
                (hasActiveSubscription(user) && !isTrialPeriod);
  
  // Determine expiry date object (may be invalid Date)
  const expiryObj = user.subscriptionExpiry
    ? new Date(user.subscriptionExpiry)
    : null;

  const expiryValid = expiryObj !== null && !Number.isNaN(expiryObj.getTime());

  // Active status uses both subscription flag and valid expiry date
  const active = hasActiveSubscription(user) && expiryValid;

  return {
    accountType: user.accountType,
    status: user.subscriptionStatus,
    expiry: expiryObj,
    isActive: active,
    timeRemaining: active ? getSubscriptionTimeRemaining(user) : getSubscriptionTimeRemaining(user),
    plan,
    isPaid,
    isTrialPeriod
  };
};

/**
 * Get available Apple IAP products for a specific account type
 * @param accountType The account type to get products for
 * @returns Promise with formatted product information
 */
export const getAvailableAppleProducts = async (
  accountType: 'dealer' | 'organizer'
): Promise<Array<{
  id: string,
  title: string,
  description: string,
  price: string,
  localizedPrice: string,
  currency: string,
  planId: string
}>> => {
  // Only available on iOS
  if (Platform.OS !== 'ios') {
    return [];
  }
  
  try {
    // Initialize Apple IAP service if needed
    await AppleIAPService.initialize();
    
    // Get products for the specified account type
    const products = await AppleIAPService.getProductsForAccountType(accountType);
    
    // Format the products for display
    return products.map(product => ({
      id: product.productId,
      title: product.title,
      description: product.description,
      price: product.price,
      localizedPrice: product.localizedPrice,
      currency: product.currency,
      planId: PRODUCT_TO_PLAN_MAP[product.productId] || ''
    }));
  } catch (error) {
    console.error('[subscriptionService] Error getting Apple products:', error);
    return [];
  }
};

/**
 * Initiate an Apple IAP subscription purchase
 * @param userId The ID of the user making the purchase
 * @param planId The ID of the plan being purchased
 * @returns Promise with the payment result
 */
export const initiateAppleIAPPurchase = async (
  userId: string,
  planId: string
): Promise<PaymentResult> => {
  try {
    // Only available on iOS
    if (Platform.OS !== 'ios') {
      return {
        success: false,
        error: 'Apple IAP is only available on iOS devices'
      };
    }
    
    // Find the selected plan
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      return {
        success: false,
        error: 'Invalid subscription plan selected'
      };
    }
    
    // Map internal plan ID to Apple product ID
    let appleProductId: string;
    if (plan.type === SubscriptionPlanType.DEALER) {
      appleProductId = plan.duration === SubscriptionDuration.MONTHLY 
        ? SUBSCRIPTION_SKUS.DEALER_MONTHLY 
        : SUBSCRIPTION_SKUS.DEALER_ANNUAL;
    } else if (plan.type === SubscriptionPlanType.ORGANIZER) {
      appleProductId = plan.duration === SubscriptionDuration.MONTHLY 
        ? SUBSCRIPTION_SKUS.ORGANIZER_MONTHLY 
        : SUBSCRIPTION_SKUS.ORGANIZER_ANNUAL;
    } else {
      return {
        success: false,
        error: 'Invalid plan type'
      };
    }
    
    // Initialize Apple IAP service if needed
    await AppleIAPService.initialize();
    
    // Initiate the purchase
    const purchaseResult = await AppleIAPService.purchaseSubscription(appleProductId, userId);
    
    if (!purchaseResult.success) {
      return {
        success: false,
        error: purchaseResult.error || 'Apple IAP purchase failed'
      };
    }
    
    // Get the user's updated subscription details
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('subscription_expiry')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      console.error('[subscriptionService] Error fetching updated profile:', fetchError);
    }
    
    return {
      success: true,
      transactionId: purchaseResult.transactionId,
      subscriptionExpiry: profile?.subscription_expiry 
        ? new Date(profile.subscription_expiry) 
        : undefined
    };
  } catch (error: any) {
    console.error('[subscriptionService] Error processing Apple IAP purchase:', error);
    return {
      success: false,
      error: error.message || 'Failed to process Apple IAP payment'
    };
  }
};

/**
 * Initiate a subscription purchase
 * @param userId The ID of the user making the purchase
 * @param planId The ID of the plan being purchased
 * @param paymentMethod The payment method to use ('stripe' or 'apple')
 * @param stripeCtx Optional Stripe helpers (initPaymentSheet, presentPaymentSheet) –
 *                  if provided we run the real payment flow, otherwise we fall back
 *                  to the legacy mock implementation (useful for unit tests / Storybook).
 * @returns Promise with the payment result
 */
export const initiateSubscriptionPurchase = async (
  userId: string,
  planId: string,
  paymentMethod: 'stripe' | 'apple' = 'stripe',
  stripeCtx?: {
    initPaymentSheet: (params: any) => Promise<any>;
    presentPaymentSheet: () => Promise<any>;
  }
): Promise<PaymentResult> => {
  try {
    // Find the selected plan
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      return {
        success: false,
        error: 'Invalid subscription plan selected'
      };
    }
    
    // If using Apple IAP and on iOS, use the Apple IAP flow
    if (paymentMethod === 'apple' && Platform.OS === 'ios') {
      return initiateAppleIAPPurchase(userId, planId);
    }
    
    /* ------------------------------------------------------------------
     * 1. Real payment flow via Stripe (preferred)
     * ------------------------------------------------------------------ */
    if (stripeCtx) {
      const stripeResult: StripePaymentResult =
        await createPaymentSheetForSubscription(
          userId,
          planId,
          stripeCtx.initPaymentSheet,
          stripeCtx.presentPaymentSheet
        );

      if (!stripeResult.success) {
        return {
          success: false,
          error: stripeResult.error || 'Stripe payment failed',
        };
      }

      /* After a successful payment, the stripePaymentService already
       * updates the user profile with the correct expiry date and role.
       * We need to also update the payment_status to 'paid'
       */
      const { data: profile, error: updateError } = await supabase
        .from('profiles')
        .update({ payment_status: 'paid' })
        .eq('id', userId)
        .select('subscription_expiry')
        .single();

      if (updateError) {
        console.error('Error updating payment status:', updateError);
      }

      return {
        success: true,
        transactionId: stripeResult.transactionId,
        subscriptionExpiry: profile?.subscription_expiry
          ? new Date(profile.subscription_expiry)
          : undefined,
      };
    }
    
    /* ------------------------------------------------------------------
     * 2. Legacy mock payment (development fallback)
     * ------------------------------------------------------------------ */
    // For demonstration purposes, we'll simulate a successful payment
    const mockTransactionId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Calculate when the subscription will expire
    const expiryDate = calculateExpiryDate(plan);
    
    // Update the user's profile with the new subscription information
    const { error } = await supabase
      .from('profiles')
      .update({
        account_type: plan.type,
        subscription_status: 'active',
        payment_status: 'paid', // Mark as paid immediately for prepaid subscriptions
        subscription_expiry: expiryDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating subscription status:', error);
      return {
        success: false,
        error: 'Failed to update subscription status'
      };
    }
    
    return {
      success: true,
      transactionId: mockTransactionId,
      subscriptionExpiry: expiryDate
    };
  } catch (error: any) {
    console.error('Error processing subscription purchase:', error);
    return {
      success: false,
      error: error.message || 'Failed to process payment'
    };
  }
};

/**
 * Renew an existing subscription
 * @param userId The ID of the user renewing their subscription
 * @param planId The ID of the plan being renewed
 * @param paymentMethod The payment method to use ('stripe' or 'apple')
 * @returns Promise with the payment result
 */
export const renewSubscription = async (
  userId: string,
  planId: string,
  paymentMethod: 'stripe' | 'apple' = 'stripe'
): Promise<PaymentResult> => {
  // Forward to initiateSubscriptionPurchase so we keep one code-path
  return initiateSubscriptionPurchase(userId, planId, paymentMethod);
};

/**
 * Restore purchases from Apple App Store
 * @param userId The ID of the user restoring purchases
 * @returns Promise with the result of the restoration
 */
export const restorePurchases = async (
  _userId: string
): Promise<{ success: boolean, error?: string }> => {
  try {
    // Only available on iOS
    if (Platform.OS !== 'ios') {
      return {
        success: false,
        error: 'Restore purchases is only available on iOS devices'
      };
    }
    
    // Initialize Apple IAP service if needed
    await AppleIAPService.initialize();
    
    // Restore purchases
    const restored = await AppleIAPService.restorePurchases();
    
    if (!restored) {
      return {
        success: false,
        error: 'No purchases to restore'
      };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[subscriptionService] Error restoring purchases:', error);
    return {
      success: false,
      error: error.message || 'Failed to restore purchases'
    };
  }
};

/**
 * Cancel a user's subscription
 * @param userId The ID of the user cancelling their subscription
 * @returns Promise with the result of the cancellation
 */
export const cancelSubscription = async (
  userId: string
): Promise<{ success: boolean, error?: string }> => {
  try {
    // Get the user's current subscription details
    const { data: userData, error: fetchError } = await supabase
      .from('profiles')
      .select('subscription_expiry, account_type, payment_status')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      throw fetchError;
    }
    
    // Update the subscription status to indicate it's cancelled
    // but allow the user to continue using it until the expiry date
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'expired',
        // If they're in trial and cancel, reset payment_status to 'none'
        // If they've paid, keep their payment_status as 'paid' until expiry
        payment_status: userData.payment_status === 'trial' ? 'none' : userData.payment_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    return {
      success: false,
      error: error.message || 'Failed to cancel subscription'
    };
  }
};

/**
 * Check for and update expired subscriptions
 * This would typically be called by a server-side cron job,
 * but can be checked on app startup as well
 * @param userId The ID of the user to check
 * @returns Promise indicating if any update was made
 */
export const checkAndUpdateSubscriptionStatus = async (
  userId: string
): Promise<boolean> => {
  try {
    // Get the user's current subscription details
    const { data: userData, error: fetchError } = await supabase
      .from('profiles')
      .select('subscription_expiry, subscription_status, account_type, payment_status')
      .eq('id', userId)
      .single();
    
    if (fetchError || !userData) {
      return false;
    }

    /* ------------------------------------------------------------------
     * Validate we actually have the minimum fields required to evaluate
     * the subscription.  In some edge-cases (e.g. very old accounts or
     * partially-migrated test fixtures) the profile row can exist while
     * critical columns are `null` or empty.  When that happens we should
     * bail out early and *not* attempt to run an update query.
     * ------------------------------------------------------------------ */
    if (
      !userData.subscription_expiry ||            // no expiry date stored
      !userData.subscription_status ||            // missing status field
      !userData.account_type                      // missing account type
    ) {
      return false;
    }
    
    // If the user doesn't have a subscription or it's already marked as expired, do nothing
    if (
      userData.account_type === 'collector' || 
      userData.subscription_status === 'none' ||
      userData.subscription_status === 'expired'
    ) {
      return false;
    }
    
    // Check if the subscription has expired
    if (userData.subscription_expiry) {
      const expiryDate = new Date(userData.subscription_expiry);
      const now = new Date();
      
      if (expiryDate <= now && userData.subscription_status === 'active') {
        // Update the subscription status to expired
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'expired',
            payment_status: 'none', // Reset payment status when subscription expires
            updated_at: now.toISOString()
          })
          .eq('id', userId);
        
        if (!error) {
          return true; // Status was updated
        }
      }
    }
    
    return false; // No update was needed
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
};

/**
 * Get available subscription plans for a specific account type
 * @param accountType The account type to get plans for
 * @returns Array of subscription plans
 */
export const getAvailablePlans = (
  accountType: 'dealer' | 'organizer'
): SubscriptionPlan[] => {
  const planType = accountType === 'dealer' 
    ? SubscriptionPlanType.DEALER 
    : SubscriptionPlanType.ORGANIZER;
  
  return SUBSCRIPTION_PLANS.filter(plan => plan.type === planType);
};

/**
 * Format the subscription expiry date for display
 * @param expiryDate The expiry date to format
 * @returns Formatted date string
 */
export const formatExpiryDate = (expiryDate: Date | string | null): string => {
  if (!expiryDate) return 'No expiration date';
  
  const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Check if a user can access dealer features
 * @param user The user to check
 * @returns Boolean indicating if the user can access dealer features
 */
export const canAccessDealerFeatures = (user: User | null): boolean => {
  if (!user) return false;
  
  // Organizers also have dealer privileges
  if (user.accountType === 'organizer') return hasActiveSubscription(user);
  
  return user.accountType === 'dealer' && hasActiveSubscription(user);
};

/**
 * Check if a user can access organizer features
 * @param user The user to check
 * @returns Boolean indicating if the user can access organizer features
 */
export const canAccessOrganizerFeatures = (user: User | null): boolean => {
  if (!user) return false;
  
  return user.accountType === 'organizer' && hasActiveSubscription(user);
};
