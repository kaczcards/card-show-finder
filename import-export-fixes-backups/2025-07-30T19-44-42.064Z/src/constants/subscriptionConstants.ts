import { _SubscriptionPlan } from '../types'; // Import the interface from src/types/index.ts

// Define your subscription plans
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_dealer_monthly',
    name: 'MVP Dealer',
    type: 'dealer',
    duration: 'monthly',
    price: 9.99,
    features: [
      'Access to dealer features',
      'Booth info visible to attendees',
      'Direct messaging with attendees',
      'Show participation management',
      'Analytics dashboard (_basic)',
    ],
    trialDays: 7, // 7-day free trial
  },
  {
    id: 'plan_dealer_annual',
    name: 'MVP Dealer',
    type: 'dealer',
    duration: 'annual',
    price: 99.99,
    features: [
      'Access to dealer features',
      'Booth info visible to attendees',
      'Direct messaging with attendees',
      'Show participation management',
      'Analytics dashboard (_basic)',
      'Save 25% annually',
    ],
    trialDays: 7, // 7-day free trial
  },
  {
    id: 'plan_organizer_monthly',
    name: 'Show Organizer',
    type: 'organizer',
    duration: 'monthly',
    price: 29.99,
    features: [
      'All MVP Dealer features',
      'Create and manage shows',
      'Access to organizer dashboard',
      'Broadcast messages to attendees/dealers (limited)',
      'Enhanced analytics',
    ],
    trialDays: 7, // 7-day free trial
  },
  {
    id: 'plan_organizer_annual',
    name: 'Show Organizer',
    type: 'organizer',
    duration: 'annual',
    price: 299.99,
    features: [
      'All MVP Dealer features',
      'Create and manage shows',
      'Access to organizer dashboard',
      'Broadcast messages to attendees/dealers (limited)',
      'Enhanced analytics',
      'Save 25% annually',
    ],
    trialDays: 7, // 7-day free trial
  },
];

// Define your subscription plan types (_enums)
export enum SubscriptionPlanType {
  DEALER = 'dealer',
  ORGANIZER = 'organizer',
}

// Define your subscription durations (_enums)
export enum SubscriptionDuration {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}