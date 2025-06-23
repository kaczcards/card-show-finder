// src/services/subscriptionService.ts
import { supabase } from '../supabase';
import { User } from '../types';

/**
 * Subscription plan types available in the app
 */
export enum SubscriptionPlanType {
  DEALER = 'dealer',
  ORGANIZER = 'organizer'
}

/**
 * Subscription plan durations in months
 */
export enum SubscriptionDuration {
  MONTHLY = 1,
  ANNUAL = 12
}

/**
 * Subscription plan details
 */
export interface SubscriptionPlan {
  id: string;
  type: SubscriptionPlanType;
  name: string;
  description: string;
  price: number; // Price in USD
  duration: SubscriptionDuration; // Duration in months
  features: string[];
  /** Free-trial length in days (optional, e.g. 7-day trial) */
  trialDays?: number;
  isPopular?: boolean;
}

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
 * Available subscription plans
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  /* ---------- MVP DEALER ---------- */
  {
    id: 'mvp-dealer-monthly',
    type: SubscriptionPlanType.DEALER,
    name: 'MVP Dealer Monthly',
    description: 'Preview inventory, interact with collectors & more (monthly)',
    price: 29,
    duration: SubscriptionDuration.MONTHLY,
    trialDays: 7,
    features: [
      'Preview inventory for upcoming shows you attend',
      'Interact with collectors planning to attend those shows',
      'View want lists of collectors within a 25-mile radius',
      'Share external links (website, eBay, WhatNot, etc.)',
      'Dealer badge on profile'
    ]
  },
  {
    id: 'mvp-dealer-annual',
    type: SubscriptionPlanType.DEALER,
    name: 'MVP Dealer Annual',
    description: 'Save 25% with annual billing',
    price: 261, // $29 × 12 × 0.75
    duration: SubscriptionDuration.ANNUAL,
    trialDays: 7,
    isPopular: true,
    features: [
      'Preview inventory for upcoming shows you attend',
      'Interact with collectors planning to attend those shows',
      'View want lists of collectors within a 25-mile radius',
      'Share external links (website, eBay, WhatNot, etc.)',
      'Dealer badge on profile',
      'Featured dealer status'
    ]
  },

  /* ---------- SHOW ORGANIZER ---------- */
  {
    id: 'show-organizer-monthly',
    type: SubscriptionPlanType.ORGANIZER,
    name: 'Show Organizer Monthly',
    description: 'Organize shows & engage dealers/collectors (monthly)',
    price: 49,
    duration: SubscriptionDuration.MONTHLY,
    trialDays: 7,
    features: [
      'All MVP Dealer features',
      'Claim ownership of recurring shows',
      'Message dealers & collectors before/after shows',
      'Edit upcoming show times, dates & details',
      'Respond to collector reviews',
      'Promote your events',
      'Access attendee data'
    ]
  },
  {
    id: 'show-organizer-annual',
    type: SubscriptionPlanType.ORGANIZER,
    name: 'Show Organizer Annual',
    description: 'Save 25% with annual billing',
    price: 441, // $49 × 12 × 0.75
    duration: SubscriptionDuration.ANNUAL,
    trialDays: 7,
    isPopular: true,
    features: [
      'All MVP Dealer features',
      'Claim ownership of recurring shows',
      'Message dealers & collectors before/after shows',
      'Edit upcoming show times, dates & details',
      'Respond to collector reviews',
      'Promote your events',
      'Access attendee data',
      'Featured show placement'
    ]
  }
];

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
 * Get the time remaining in a user's subscription
 * @param user The user to check
 * @returns Object with days, hours remaining or null if no active subscription
 */
export const getSubscriptionTimeRemaining = (user: User): { days: number, hours: number } | null => {
  if (!hasActiveSubscription(user) || !user.subscriptionExpiry) {
    return null;
  }
  
  const now = new Date();
  const expiryDate = new Date(user.subscriptionExpiry);
  const diffMs = expiryDate.getTime() - now.getTime();
  
  // If already expired
  if (diffMs <= 0) return { days: 0, hours: 0 };
  
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
} | null => {
  if (!user || user.accountType === 'collector') {
    return null;
  }
  
  // Find the plan that matches the user's account type
  const planType = user.accountType === 'dealer' 
    ? SubscriptionPlanType.DEALER 
    : SubscriptionPlanType.ORGANIZER;
    
  // Default to the annual plan as it's the most common
  const plan = SUBSCRIPTION_PLANS.find(p => 
    p.type === planType && p.duration === SubscriptionDuration.ANNUAL
  ) || null;
  
  return {
    accountType: user.accountType,
    status: user.subscriptionStatus,
    expiry: user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null,
    isActive: hasActiveSubscription(user),
    timeRemaining: getSubscriptionTimeRemaining(user),
    plan
  };
};

/**
 * Calculate the expiry date based on the current date and plan duration
 * @param plan The subscription plan
 * @returns Date when the subscription will expire
 */
export const calculateExpiryDate = (plan: SubscriptionPlan): Date => {
  const now = new Date();
  const expiryDate = new Date(now);
  
  // If plan includes a free trial, apply trial days first (initial period)
  if (plan.trialDays && plan.trialDays > 0) {
    expiryDate.setDate(expiryDate.getDate() + plan.trialDays);
  } else {
    expiryDate.setMonth(now.getMonth() + plan.duration);
  }
  
  return expiryDate;
};

/**
 * Initiate a subscription purchase
 * @param userId The ID of the user making the purchase
 * @param planId The ID of the plan being purchased
 * @returns Promise with the payment result
 */
export const initiateSubscriptionPurchase = async (
  userId: string,
  planId: string
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
    
    // TODO: Integrate with Stripe payment processor
    // This is a placeholder for the actual payment processing logic
    // In a real implementation, this would redirect to Stripe checkout
    // or use Stripe Elements/mobile SDK
    
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
 * @returns Promise with the payment result
 */
export const renewSubscription = async (
  userId: string,
  planId: string
): Promise<PaymentResult> => {
  // The renewal process is similar to the initial purchase
  return initiateSubscriptionPurchase(userId, planId);
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
      .select('subscription_expiry, account_type')
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
      .select('subscription_expiry, subscription_status, account_type')
      .eq('id', userId)
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
      const expiryDate = new Date(userData.subscription_expiry);
      const now = new Date();
      
      if (expiryDate <= now && userData.subscription_status === 'active') {
        // Update the subscription status to expired
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'expired',
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
