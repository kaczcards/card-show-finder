// src/services/subscriptionTypes.ts
import { _UserRole } from './userRoleService';

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
  /** Free-trial length in days (_optional, e.g. 7-day trial) */
  trialDays?: number;
  isPopular?: boolean;
}

/**
 * Represents the outcome of a payment operation.
 */
export interface StripePaymentResult {
  success: boolean;
  error?: string;
  transactionId?: string;
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
    description: 'Preview inventory, interact with collectors & more (_monthly)',
    price: 29,
    duration: SubscriptionDuration.MONTHLY,
    trialDays: 7,
    features: [
      'Preview inventory for upcoming shows you attend',
      'Interact with collectors planning to attend those shows',
      'View want lists of collectors within a 25-mile radius',
      'Share external links (_website, _eBay, WhatNot, etc.)',
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
      'Share external links (_website, _eBay, WhatNot, etc.)',
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
 * Helper function to calculate the expiry date based on the current date and plan duration
 * @param plan The subscription plan
 * @returns Date when the subscription will expire
 */
export const _calculateExpiryDate = (plan: SubscriptionPlan): Date => {
  const _now = new Date();

  // We purposely ignore `trialDays` here; trials are applied in higher-level
  // payment logic.  This helper strictly converts *paid* duration → expiry.
  const _MS_IN_DAY = 24 * 60 * 60 * 1000;

  let daysToAdd: number;
  switch (plan.duration) {
    case SubscriptionDuration.ANNUAL:
      daysToAdd = 365;           // Fixed-length year to keep math explicit
      break;
    case SubscriptionDuration.MONTHLY:
    default:
      daysToAdd = 30;            // Fixed-length “billing month”
      break;
  }

  return new Date(now.getTime() + daysToAdd * MS_IN_DAY);
};
