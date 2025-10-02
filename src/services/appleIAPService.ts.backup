// TEMPORARY STUB - IAP service disabled for testing registration fix
// TODO: Re-enable after proper native module setup with react-native-iap

import { User } from '../types';

export const SUBSCRIPTION_SKUS = {
  DEALER_MONTHLY: 'com.cardshowfinder.dealer.monthly',
  DEALER_ANNUAL: 'com.cardshowfinder.dealer.annual',
  ORGANIZER_MONTHLY: 'com.cardshowfinder.organizer.monthly',
  ORGANIZER_ANNUAL: 'com.cardshowfinder.organizer.annual',
};

export const PRODUCT_TO_PLAN_MAP: Record<string, string> = {
  [SUBSCRIPTION_SKUS.DEALER_MONTHLY]: 'dealer-monthly',
  [SUBSCRIPTION_SKUS.DEALER_ANNUAL]: 'dealer-annual',
  [SUBSCRIPTION_SKUS.ORGANIZER_MONTHLY]: 'organizer-monthly',
  [SUBSCRIPTION_SKUS.ORGANIZER_ANNUAL]: 'organizer-annual',
};

export const PRODUCT_TO_ACCOUNT_TYPE: Record<string, string> = {
  [SUBSCRIPTION_SKUS.DEALER_MONTHLY]: 'dealer',
  [SUBSCRIPTION_SKUS.DEALER_ANNUAL]: 'dealer',
  [SUBSCRIPTION_SKUS.ORGANIZER_MONTHLY]: 'organizer',
  [SUBSCRIPTION_SKUS.ORGANIZER_ANNUAL]: 'organizer',
};

export interface PurchaseResult {
  success: boolean;
  error?: string;
  productId?: string;
  transactionId?: string;
  receipt?: string;
}

export interface SubscriptionDetails {
  planId: string;
  accountType: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'trial';
  paymentStatus: 'paid' | 'trial' | 'unpaid';
}

class AppleIAPServiceStub {
  async initialize(): Promise<boolean> {
    console.warn('[AppleIAPService] STUB: IAP service is disabled');
    return false;
  }

  async getAvailableProducts(): Promise<any[]> {
    console.warn('[AppleIAPService] STUB: Returning empty products list');
    return [];
  }

  async getProductsForAccountType(_accountType: 'dealer' | 'organizer'): Promise<any[]> {
    return [];
  }

  async purchaseSubscription(_productId: string, _userId: string): Promise<PurchaseResult> {
    return {
      success: false,
      error: 'IAP service is currently disabled'
    };
  }

  async checkSubscriptionStatus(_user: User): Promise<boolean> {
    return false;
  }

  async restorePurchases(): Promise<boolean> {
    console.warn('[AppleIAPService] STUB: Restore purchases not available');
    return false;
  }

  cleanup(): void {
    console.warn('[AppleIAPService] STUB: Cleanup called');
  }
}

export default new AppleIAPServiceStub();
