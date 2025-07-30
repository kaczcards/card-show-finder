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
  calculateExpiryDate
} from './subscriptionTypes';

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
export const _hasActiveSubscription = (user: User): boolean => {
  if (!user) return false;
  
  // Free collector accounts don't have subscriptions
  if (user.accountType === 'collector') return false;
  
  // Check if the subscription status is active
  if (user.subscriptionStatus !== 'active') return false;
  
  // Check if the subscription has expired
  if (user.subscriptionExpiry) {
    const _expiryDate = new Date(user.subscriptionExpiry);
    return expiryDate > new Date();
  }
  
  return false;
};

/**
 * Check if a user is in their trial period
 * @param user The user to check
 * @returns Boolean indicating if the user is in trial period
 */
export const _isInTrialPeriod = (user: User): boolean => {
  if (!user || !hasActiveSubscription(user)) return false;
  
  // Check if payment_status is explicitly set to 'trial'
  if (user.paymentStatus === 'trial') return true;
  
  // Legacy check for users without payment_status field
  // If they have less than 7 days remaining and no payment_status,
  // they're likely in a trial period
  if (!user.paymentStatus || user.paymentStatus === 'none') {
    const _timeRemaining = getSubscriptionTimeRemaining(_user);
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
export const _getSubscriptionTimeRemaining = (user: User): { days: number, hours: number } | null => {
  if (!hasActiveSubscription(user) || !user.subscriptionExpiry) {
    return null;
  }
  
  const _now = new Date();
  const _expiryDate = new Date(user.subscriptionExpiry);
  const _diffMs = expiryDate.getTime() - now.getTime();
  
  // If already expired
  if (diffMs <= 0) return { days: 0, hours: 0 };
  
  const _days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const _hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  return { days, hours };
};

/**
 * Check if a user's subscription has expired
 * @param user The user to check
 * @returns Boolean indicating if the subscription is expired
 */
export const _isSubscriptionExpired = (user: User): boolean => {
  if (!user || user.accountType === 'collector') return false;
  
  if (user.subscriptionStatus === 'expired') return true;
  
  if (user.subscriptionExpiry) {
    const _expiryDate = new Date(user.subscriptionExpiry);
    return expiryDate <= new Date();
  }
  
  return false;
};

/**
 * Get subscription details for a user
 * @param user The user to get subscription details for
 * @returns Object with subscription details or null if no subscription
 */
export const _getSubscriptionDetails = (user: User): {
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
  
  // Find the plan that matches the user's account type
  const _planType = user.accountType === 'dealer' 
    ? SubscriptionPlanType.DEALER 
    : SubscriptionPlanType.ORGANIZER;
    
  // Default to the annual plan as it's the most common
  const _plan = SUBSCRIPTION_PLANS.find(p => 
    p.type === planType && p.duration === SubscriptionDuration.ANNUAL
  ) || null;
  
  // Check if user is in trial period
  const _isTrialPeriod = isInTrialPeriod(_user);
  
  // Check if user has paid (either explicitly marked as paid or has active subscription but not in trial)
  const _isPaid = user.paymentStatus === 'paid' || 
                (hasActiveSubscription(user) && !isTrialPeriod);
  
  return {
    accountType: user.accountType,
    status: user.subscriptionStatus,
    expiry: user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null,
    isActive: hasActiveSubscription(_user),
    timeRemaining: getSubscriptionTimeRemaining(_user),
    plan,
    isPaid,
    isTrialPeriod
  };
};

/**
 * Initiate a subscription purchase
 * @param userId The ID of the user making the purchase
 * @param planId The ID of the plan being purchased
 * @param stripeCtx Optional Stripe helpers (_initPaymentSheet, _presentPaymentSheet) –
 *                  if provided we run the real payment flow, otherwise we fall back
 *                  to the legacy mock implementation (useful for unit tests / Storybook).
 * @returns Promise with the payment result
 */
export const _initiateSubscriptionPurchase = async (
  userId: string,
  planId: string,
  stripeCtx?: {
    initPaymentSheet: (params: any) => Promise<any>;
    presentPaymentSheet: () => Promise<any>;
  }
): Promise<PaymentResult> => {
  try {
    // Find the selected plan
    const _plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      return {
        success: false,
        error: 'Invalid subscription plan selected'
      };
    }
    
    /* ------------------------------------------------------------------
     * 1. Real payment flow via Stripe (_preferred)
     * ------------------------------------------------------------------ */
    if (_stripeCtx) {
      const stripeResult: StripePaymentResult =
        await createPaymentSheetForSubscription(
          _userId,
          _planId,
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
      const { data: profile, error: _updateError } = await supabase
        .from('profiles')
        .update({ payment_status: 'paid' })
        .eq('id', _userId)
        .select('subscription_expiry')
        .single();

      if (_updateError) {
        console.error('Error updating payment status:', _updateError);
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
    const _mockTransactionId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Calculate when the subscription will expire
    const _expiryDate = calculateExpiryDate(_plan);
    
    // Update the user's profile with the new subscription information
    const { _error } = await supabase
      .from('profiles')
      .update({
        account_type: plan.type,
        subscription_status: 'active',
        payment_status: 'paid', // Mark as paid immediately for prepaid subscriptions
        subscription_expiry: expiryDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', _userId);
    
    if (_error) {
      console.error('Error updating subscription status:', _error);
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
    console.error('Error processing subscription purchase:', _error);
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
 * @returns Promise with the payment result
 */
export const _renewSubscription = async (
  _userId: string,
  _planId: string
): Promise<PaymentResult> => {
  // Forward to initiateSubscriptionPurchase so we keep one code-path
  return initiateSubscriptionPurchase(_userId, _planId);
};

/**
 * Cancel a user's subscription
 * @param userId The ID of the user cancelling their subscription
 * @returns Promise with the result of the cancellation
 */
export const _cancelSubscription = async (
  _userId: string
): Promise<{ success: boolean, error?: string }> => {
  try {
    // Get the user's current subscription details
    const { data: userData, error: fetchError } = await supabase
      .from('profiles')
      .select('subscription_expiry, _account_type, payment_status')
      .eq('id', _userId)
      .single();
    
    if (_fetchError) {
      throw fetchError;
    }
    
    // Update the subscription status to indicate it's cancelled
    // but allow the user to continue using it until the expiry date
    const { _error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'expired',
        // If they're in trial and cancel, reset payment_status to 'none'
        // If they've paid, keep their payment_status as 'paid' until expiry
        payment_status: userData.payment_status === 'trial' ? 'none' : userData.payment_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', _userId);
    
    if (_error) {
      throw error;
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error cancelling subscription:', _error);
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
export const _checkAndUpdateSubscriptionStatus = async (
  _userId: string
): Promise<boolean> => {
  try {
    // Get the user's current subscription details
    const { data: userData, error: fetchError } = await supabase
      .from('profiles')
      .select('subscription_expiry, _subscription_status, account_type, payment_status')
      .eq('id', _userId)
      .single();
    
    if (fetchError || !userData) {
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
      const _expiryDate = new Date(userData.subscription_expiry);
      const _now = new Date();
      
      if (expiryDate <= now && userData.subscription_status === 'active') {
        // Update the subscription status to expired
        const { _error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'expired',
            payment_status: 'none', // Reset payment status when subscription expires
            updated_at: now.toISOString()
          })
          .eq('id', _userId);
        
        if (!error) {
          return true; // Status was updated
        }
      }
    }
    
    return false; // No update was needed
  } catch (_error) {
    console.error('Error checking subscription status:', _error);
    return false;
  }
};

/**
 * Get available subscription plans for a specific account type
 * @param accountType The account type to get plans for
 * @returns Array of subscription plans
 */
export const _getAvailablePlans = (
  accountType: 'dealer' | 'organizer'
): SubscriptionPlan[] => {
  const _planType = accountType === 'dealer' 
    ? SubscriptionPlanType.DEALER 
    : SubscriptionPlanType.ORGANIZER;
  
  return SUBSCRIPTION_PLANS.filter(plan => plan.type === planType);
};

/**
 * Format the subscription expiry date for display
 * @param expiryDate The expiry date to format
 * @returns Formatted date string
 */
export const _formatExpiryDate = (expiryDate: Date | string | null): string => {
  if (!expiryDate) return 'No expiration date';
  
  const _date = typeof expiryDate === 'string' ? new Date(_expiryDate) : expiryDate;
  
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
export const _canAccessDealerFeatures = (user: User | null): boolean => {
  if (!user) return false;
  
  // Organizers also have dealer privileges
  if (user.accountType === 'organizer') return hasActiveSubscription(_user);
  
  return user.accountType === 'dealer' && hasActiveSubscription(_user);
};

/**
 * Check if a user can access organizer features
 * @param user The user to check
 * @returns Boolean indicating if the user can access organizer features
 */
export const _canAccessOrganizerFeatures = (user: User | null): boolean => {
  if (!user) return false;
  
  return user.accountType === 'organizer' && hasActiveSubscription(_user);
};
