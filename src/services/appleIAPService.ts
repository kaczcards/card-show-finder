import { 
  initConnection, 
  endConnection,
  getProducts,
  getAvailablePurchases,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  validateReceiptIos,
  Product,
  PurchaseError,
  SubscriptionPurchase,
  ProductPurchase
} from 'react-native-iap';
import { Platform } from 'react-native';
import { supabase } from '../supabase';
import { User } from '../types';
import { handleNetworkError, handleSupabaseError } from './errorService';

// Define subscription product IDs
export const SUBSCRIPTION_SKUS = {
  // Dealer subscription products
  DEALER_MONTHLY: 'com.cardshowfinder.dealer.monthly',
  DEALER_ANNUAL: 'com.cardshowfinder.dealer.annual',
  
  // Organizer subscription products
  ORGANIZER_MONTHLY: 'com.cardshowfinder.organizer.monthly',
  ORGANIZER_ANNUAL: 'com.cardshowfinder.organizer.annual',
};

// Map product IDs to internal plan IDs
export const PRODUCT_TO_PLAN_MAP: Record<string, string> = {
  [SUBSCRIPTION_SKUS.DEALER_MONTHLY]: 'dealer-monthly',
  [SUBSCRIPTION_SKUS.DEALER_ANNUAL]: 'dealer-annual',
  [SUBSCRIPTION_SKUS.ORGANIZER_MONTHLY]: 'organizer-monthly',
  [SUBSCRIPTION_SKUS.ORGANIZER_ANNUAL]: 'organizer-annual',
};

// Map product IDs to account types
export const PRODUCT_TO_ACCOUNT_TYPE: Record<string, string> = {
  [SUBSCRIPTION_SKUS.DEALER_MONTHLY]: 'dealer',
  [SUBSCRIPTION_SKUS.DEALER_ANNUAL]: 'dealer',
  [SUBSCRIPTION_SKUS.ORGANIZER_MONTHLY]: 'organizer',
  [SUBSCRIPTION_SKUS.ORGANIZER_ANNUAL]: 'organizer',
};

// Type definitions
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

/**
 * Apple IAP Service
 * 
 * Handles all Apple In-App Purchase functionality including:
 * - Initialization and connection management
 * - Product retrieval and display
 * - Purchase processing
 * - Receipt validation
 * - Subscription status updates in Supabase
 */
class AppleIAPService {
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isInitialized: boolean = false;
  private cachedProducts: Product[] = [];
  private purchaseCallbacks: Record<string, (result: PurchaseResult) => void> = {};

  /**
   * Initialize the IAP connection and set up listeners
   * Should be called when the app starts
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.warn('[AppleIAPService] Already initialized');
      return true;
    }

    try {
      if (Platform.OS !== 'ios') {
        console.warn('[AppleIAPService] Not running on iOS, IAP functionality disabled');
        return false;
      }

      // Initialize the connection to the App Store
      await initConnection();
      console.warn('[AppleIAPService] IAP connection initialized');
      
      // Set up purchase update listener
      this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
        console.warn('[AppleIAPService] Purchase updated:', purchase);
        
        try {
          // Finish the transaction immediately to prevent duplicate callbacks
          const { transactionReceipt } = purchase;
          if (transactionReceipt) {
            await finishTransaction({ purchase, isConsumable: false });
          }
          
          // Process the purchase
          await this.handlePurchaseSuccess(purchase);
        } catch (error) {
          console.error('[AppleIAPService] Error processing purchase:', error);
          this.notifyPurchaseCallback(purchase.productId || '', {
            success: false,
            error: 'Failed to process purchase',
            productId: purchase.productId,
            transactionId: purchase.transactionId
          });
        }
      });

      // Set up purchase error listener
      this.purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
        console.error('[AppleIAPService] Purchase error:', error);
        
        // Find the product ID from the error if possible
        const productId = error.productId || '';
        
        // Notify callback with error
        this.notifyPurchaseCallback(productId, {
          success: false,
          error: this.getReadableErrorMessage(error),
          productId
        });
      });
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[AppleIAPService] Failed to initialize IAP:', error);
      handleNetworkError(error, {
        context: 'AppleIAPService.initialize',
        severity: 'high'
      });
      return false;
    }
  }

  /**
   * Get all available subscription products
   */
  async getAvailableProducts(): Promise<Product[]> {
    try {
      if (!this.isInitialized && !(await this.initialize())) {
        throw new Error('IAP service not initialized');
      }

      // If we have cached products, return them
      if (this.cachedProducts.length > 0) {
        return this.cachedProducts;
      }

      // Get all subscription products
      const products = await getProducts({ skus: Object.values(SUBSCRIPTION_SKUS) });
      
      if (products.length === 0) {
        console.warn('[AppleIAPService] No products available');
      } else {
        console.warn('[AppleIAPService] Products retrieved:', products.length);
        // Cache the products
        this.cachedProducts = products;
      }
      
      return products;
    } catch (error) {
      console.error('[AppleIAPService] Error getting products:', error);
      handleNetworkError(error, {
        context: 'AppleIAPService.getAvailableProducts',
        severity: 'medium'
      });
      return [];
    }
  }

  /**
   * Get products for a specific account type (dealer or organizer)
   */
  async getProductsForAccountType(accountType: 'dealer' | 'organizer'): Promise<Product[]> {
    const products = await this.getAvailableProducts();
    
    // Filter products by account type
    return products.filter(product => {
      const productAccountType = this.getAccountTypeForProduct(product.productId);
      return productAccountType === accountType;
    });
  }

  /**
   * Purchase a subscription product
   * @param productId The Apple product ID to purchase
   * @param userId The user ID to associate with the purchase
   */
  async purchaseSubscription(
    productId: string, 
    userId: string
  ): Promise<PurchaseResult> {
    try {
      if (!this.isInitialized && !(await this.initialize())) {
        throw new Error('IAP service not initialized');
      }

      if (!productId) {
        throw new Error('Product ID is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Create a promise that will be resolved when the purchase completes
      return new Promise((resolve) => {
        // Store the callback to be called when the purchase completes
        this.purchaseCallbacks[productId] = resolve;
        
        // Request the purchase
        requestPurchase({ sku: productId })
          .catch(error => {
            console.error('[AppleIAPService] Purchase request failed:', error);
            // Clean up the callback
            delete this.purchaseCallbacks[productId];
            
            // Resolve with error
            resolve({
              success: false,
              error: this.getReadableErrorMessage(error),
              productId
            });
          });
      });
    } catch (error: any) {
      console.error('[AppleIAPService] Purchase failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to purchase subscription',
        productId
      };
    }
  }

  /**
   * Handle a successful purchase
   * @param purchase The purchase object from react-native-iap
   */
  private async handlePurchaseSuccess(
    purchase: ProductPurchase | SubscriptionPurchase
  ): Promise<void> {
    try {
      const { productId, transactionId, transactionReceipt } = purchase;
      
      if (!productId || !transactionId || !transactionReceipt) {
        throw new Error('Invalid purchase data');
      }

      console.warn('[AppleIAPService] Processing purchase:', productId);

      // Validate the receipt with Apple
      const validationResult = await this.validateReceipt(transactionReceipt);
      
      if (!validationResult.success) {
        throw new Error(`Receipt validation failed: ${validationResult.error}`);
      }

      // Get the subscription details from the purchase
      const subscriptionDetails = this.getSubscriptionDetailsFromPurchase(purchase);
      
      // Update the user's subscription in Supabase
      await this.updateUserSubscription(transactionId, subscriptionDetails);

      // Notify callback of success
      this.notifyPurchaseCallback(productId || '', {
        success: true,
        productId,
        transactionId,
        receipt: transactionReceipt
      });
      
    } catch (error: any) {
      console.error('[AppleIAPService] Error processing purchase:', error);
      
      // Notify callback of failure
      this.notifyPurchaseCallback(purchase.productId || '', {
        success: false,
        error: error.message || 'Failed to process purchase',
        productId: purchase.productId,
        transactionId: purchase.transactionId
      });
    }
  }

  /**
   * Validate a receipt with Apple's servers
   */
  private async validateReceipt(receipt: string): Promise<{ success: boolean; error?: string }> {
    try {
      /**
       * ------------------------------------------------------------------
       * 1. Attempt PRODUCTION validation first
       * ------------------------------------------------------------------
       */
      const prodResult: any = await validateReceiptIos({
        receiptBody: { 'receipt-data': receipt },
        isTest: false, // always start with production environment
      });

      // Successful validation in production (status === 0)
      if (prodResult?.status === 0 && prodResult?.receipt) {
        return { success: true };
      }

      /**
       * ------------------------------------------------------------------
       * 2. If we get status 21007 -> sandbox receipt sent to production
       *    Retry against the sandbox environment
       * ------------------------------------------------------------------
       */
      if (prodResult?.status === 21007) {
        console.warn(
          '[AppleIAPService] Production validation returned 21007 – retrying in sandbox'
        );

        const sandboxResult: any = await validateReceiptIos({
          receiptBody: { 'receipt-data': receipt },
          isTest: true,
        });

        if (sandboxResult?.status === 0 && sandboxResult?.receipt) {
          return { success: true };
        }

        // Sandbox also failed – propagate error
        return {
          success: false,
          error: `Sandbox validation failed (status ${sandboxResult?.status ?? 'unknown'})`,
        };
      }

      // Any other non-zero status code from production
      return {
        success: false,
        error: `Production validation failed (status ${prodResult?.status ?? 'unknown'})`,
      };
    } catch (err: any) {
      console.error('[AppleIAPService] Receipt validation exception:', err);
      return {
        success: false,
        error: err?.message || 'Receipt validation threw an exception',
      };
    }
  }

  /**
   * Extract subscription details from a purchase
   */
  private getSubscriptionDetailsFromPurchase(
    purchase: ProductPurchase | SubscriptionPurchase
  ): SubscriptionDetails {
    const { productId } = purchase;
    
    // Get the plan ID and account type from the product ID
    const planId = PRODUCT_TO_PLAN_MAP[productId || ''] || 'unknown';
    const accountType = PRODUCT_TO_ACCOUNT_TYPE[productId || ''] || 'unknown';
    
    // Calculate expiry date (1 month or 1 year from now)
    const now = new Date();
    const expiryDate = new Date(now);
    
    if (planId.includes('monthly')) {
      expiryDate.setMonth(now.getMonth() + 1);
    } else if (planId.includes('annual')) {
      expiryDate.setFullYear(now.getFullYear() + 1);
    }
    
    return {
      planId,
      accountType,
      expiryDate: expiryDate.toISOString(),
      status: 'active',
      paymentStatus: 'paid'
    };
  }

  /**
   * Update the user's subscription in Supabase
   */
  private async updateUserSubscription(
    transactionId: string,
    details: SubscriptionDetails
  ): Promise<void> {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Update the user's profile with subscription details
      const { error } = await supabase
        .from('profiles')
        .update({
          account_type: details.accountType,
          subscription_status: details.status,
          subscription_expiry: details.expiryDate,
          payment_status: details.paymentStatus,
          apple_transaction_id: transactionId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      console.warn('[AppleIAPService] User subscription updated successfully');
    } catch (error) {
      console.error('[AppleIAPService] Failed to update user subscription:', error);
      handleSupabaseError(error, {
        context: 'AppleIAPService.updateUserSubscription',
        severity: 'high'
      });
      throw error;
    }
  }

  /**
   * Get the account type for a product ID
   */
  private getAccountTypeForProduct(productId: string): string {
    return PRODUCT_TO_ACCOUNT_TYPE[productId] || 'unknown';
  }

  /**
   * Notify a purchase callback with the result
   */
  private notifyPurchaseCallback(productId: string | undefined, result: PurchaseResult): void {
    // Normalise undefined / null productIds so we always hit a deterministic key
    const key = productId ?? '';

    const callback = this.purchaseCallbacks[key];
    if (callback) {
      callback(result);
      delete this.purchaseCallbacks[key];
    }
  }

  /**
   * Get a user-friendly error message for IAP errors
   */
  private getReadableErrorMessage(error: any): string {
    // Handle specific error codes from react-native-iap
    if (error.code) {
      switch (error.code) {
        case 'E_USER_CANCELLED':
          return 'Purchase was cancelled';
        case 'E_ALREADY_OWNED':
          return 'You already own this subscription';
        case 'E_NOT_PREPARED':
          return 'In-app purchase system is not ready';
        case 'E_REMOTE_ERROR':
          return 'An error occurred with the App Store';
        case 'E_NETWORK_ERROR':
          return 'Network connection error';
        case 'E_SERVICE_ERROR':
          return 'App Store service is currently unavailable';
        case 'E_RECEIPT_FAILED':
          return 'Failed to validate purchase receipt';
        case 'E_NOT_ENDED':
          return 'Previous transaction not ended';
        case 'E_UNKNOWN':
        default:
          return error.message || 'An unknown error occurred';
      }
    }
    
    return error.message || 'An error occurred during purchase';
  }

  /**
   * Check if a user has an active subscription
   */
  async checkSubscriptionStatus(_user: User): Promise<boolean> {
    if (!_user) return false;
    
    // If user has active subscription status and future expiry date
    if (_user.subscriptionStatus === 'active' && _user.subscriptionExpiry) {
      const expiryDate = new Date(_user.subscriptionExpiry);
      const now = new Date();
      return expiryDate > now;
    }
    
    return false;
  }

  /**
   * Restore purchases for the current user
   */
  async restorePurchases(): Promise<boolean> {
    try {
      if (!this.isInitialized && !(await this.initialize())) {
        throw new Error('IAP service not initialized');
      }

      // Get available purchases from Apple
      const availablePurchases = await getAvailablePurchases();
      
      if (!availablePurchases || availablePurchases.length === 0) {
        console.warn('[AppleIAPService] No purchases to restore');
        return false;
      }

      console.warn('[AppleIAPService] Purchases to restore:', availablePurchases.length);
      
      // Process each purchase
      let restoredAny = false;
      for (const purchase of availablePurchases) {
        try {
          await this.handlePurchaseSuccess(purchase);
          restoredAny = true;
        } catch (error: any) {
          console.error('[AppleIAPService] Error restoring purchase:', error);
        }
      }

      return restoredAny;
    } catch (error: any) {
      console.error('[AppleIAPService] Failed to restore purchases:', error);
      return false;
    }
  }

  /**
   * Clean up IAP listeners
   * Should be called when the app is closed or the user logs out
   */
  cleanup(): void {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }
    
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }
    
    // End the connection to the App Store
    if (this.isInitialized) {
      endConnection()
        .then(() => {
          console.warn('[AppleIAPService] IAP connection ended');
        })
        .catch(error => {
          console.error('[AppleIAPService] Error ending IAP connection:', error);
        });
      
      this.isInitialized = false;
    }
    
    // Clear cached data
    this.cachedProducts = [];
    this.purchaseCallbacks = {};
  }
}

// Export a singleton instance
export default new AppleIAPService();
