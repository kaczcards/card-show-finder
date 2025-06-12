// src/services/paymentService.js
import { initStripe } from '@stripe/stripe-react-native';
import { upgradeToPromoter } from './authService';
import { createPremiumListingPaymentIntent } from './stripeBackendApi';
import { updateShowPremiumStatus } from './firebaseApi';

// Replace with your actual Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_yourStripePublishableKey';

// Mock server endpoint - in production, replace with your actual backend URL
const API_URL = 'https://your-backend-url.com';

// Initialize Stripe
export const initializeStripe = async () => {
  try {
    await initStripe({
      publishableKey: STRIPE_PUBLISHABLE_KEY,
      merchantIdentifier: 'merchant.com.cardshowfinder',
      urlScheme: 'cardshowfinder',
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Error initializing Stripe:', error);
    return { success: false, error: error.message };
  }
};

// Mock function to fetch payment intent from server
// In production, this would call your actual backend
export const fetchPaymentIntentFromServer = async (userId, amount = 1999) => {
  try {
    // In a real app, this would be an API call to your backend
    // which would create a PaymentIntent with Stripe's API
    console.log(`Creating payment intent for user ${userId} for $${(amount/100).toFixed(2)}`);
    
    // Mock response - in production, this would come from your backend
    return {
      success: true,
      clientSecret: 'mock_client_secret',
      customerId: 'mock_customer_id',
      ephemeralKey: 'mock_ephemeral_key',
    };
  } catch (error) {
    console.error('Error fetching payment intent:', error);
    return { success: false, error: error.message };
  }
};

// Initialize the payment sheet - now accepts stripe object as parameter
export const initializePaymentSheet = async (userId, stripe) => {
  if (!stripe) {
    console.error('Stripe object is required');
    return { success: false, error: 'Stripe not initialized' };
  }
  
  try {
    // Fetch payment intent from server (or mock)
    const { clientSecret, customerId, ephemeralKey, error } = 
      await fetchPaymentIntentFromServer(userId);
    
    if (error) {
      return { success: false, error };
    }
    
    // Initialize the payment sheet
    const { error: initError } = await stripe.initPaymentSheet({
      setupIntentClientSecret: clientSecret,
      customerId,
      customerEphemeralKeySecret: ephemeralKey,
      merchantDisplayName: 'Card Show Finder',
    });
    
    if (initError) {
      console.error('Error initializing payment sheet:', initError);
      return { success: false, error: initError.message };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error in payment sheet initialization:', error);
    return { success: false, error: error.message };
  }
};

// Present the payment sheet to the user - now accepts stripe object as parameter
export const presentPromoterUpgradePayment = async (userId, stripe) => {
  if (!stripe) {
    console.error('Stripe object is required');
    return { success: false, error: 'Stripe not initialized' };
  }
  
  try {
    // Present the payment sheet
    const { error } = await stripe.presentPaymentSheet();
    
    if (error) {
      console.error('Payment sheet error:', error);
      return { success: false, error: error.message };
    }
    
    // Payment successful, upgrade the user to promoter
    const { success, error: upgradeError } = await upgradeToPromoter(userId);
    
    if (upgradeError) {
      console.error('Error upgrading user:', upgradeError);
      return { success: false, error: upgradeError };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error processing payment:', error);
    return { success: false, error: error.message };
  }
};

// Complete implementation for promoter subscription - now accepts stripe object as parameter
export const handlePromoterUpgrade = async (userId, stripe) => {
  if (!stripe) {
    console.error('Stripe object is required');
    return { success: false, error: 'Stripe not initialized' };
  }
  
  try {
    // Step 1: Initialize the payment sheet
    const { success: initSuccess, error: initError } = 
      await initializePaymentSheet(userId, stripe);
    
    if (!initSuccess) {
      return { success: false, error: initError };
    }
    
    // Step 2: Present the payment sheet and process payment
    const { success, error } = await presentPromoterUpgradePayment(userId, stripe);
    
    return { success, error };
  } catch (error) {
    console.error('Error in promoter upgrade process:', error);
    return { success: false, error: error.message };
  }
};

// -----------------------------------------------------------------------
//  PREMIUM LISTING PAYMENT FLOW  (show-specific one-time payment)
// -----------------------------------------------------------------------

/**
 * Initialise a PaymentSheet for a premium listing purchase
 * @param {string} showId  Firestore document id for the show
 * @param {string} userId  Promoter uid
 * @param {object} stripe  useStripe() object
 */
export const initializePremiumPaymentSheet = async (showId, userId, stripe) => {
  if (!stripe) {
    console.error('Stripe object is required');
    return { success: false, error: 'Stripe not initialized' };
  }

  try {
    // Ask our backend for a new PaymentIntent + customer details
    const {
      success,
      clientSecret,
      customerId,
      ephemeralKey,
      error
    } = await createPremiumListingPaymentIntent(showId, userId);

    if (!success) {
      return { success: false, error };
    }

    // Init the payment sheet with the returned intent
    const { error: initError } = await stripe.initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      customerId,
      customerEphemeralKeySecret: ephemeralKey,
      merchantDisplayName: 'Card Show Finder'
    });

    if (initError) {
      console.error('Error initializing premium PaymentSheet:', initError);
      return { success: false, error: initError.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Unexpected error setting up premium listing payment:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Present the PaymentSheet to pay for premium listing
 * Updates the show document on success.
 */
export const presentPremiumListingPayment = async (showId, userId, stripe) => {
  if (!stripe) {
    console.error('Stripe object is required');
    return { success: false, error: 'Stripe not initialized' };
  }

  try {
    const { error } = await stripe.presentPaymentSheet();

    if (error) {
      console.error('Premium listing payment error:', error);
      return { success: false, error: error.message };
    }

    // Mark the show as premium / paid
    const { success, error: updateErr } = await updateShowPremiumStatus(
      showId,
      true,
      'paid'
    );

    if (!success) {
      return { success: false, error: updateErr };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Unexpected error completing premium payment:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Orchestrates initialization + presentation of premium listing payment
 */
export const handlePremiumListingPayment = async (showId, userId, stripe) => {
  // Step 1: init PaymentSheet
  const { success: initSuccess, error: initError } =
    await initializePremiumPaymentSheet(showId, userId, stripe);

  if (!initSuccess) {
    return { success: false, error: initError };
  }

  // Step 2: present sheet
  return await presentPremiumListingPayment(showId, userId, stripe);
};
