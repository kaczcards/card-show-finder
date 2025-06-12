// src/services/stripeBackendApi.js
import axios from 'axios';

// Replace with your actual Firebase Cloud Function URL
// This would be deployed as part of your backend infrastructure
const API_BASE_URL = 'https://us-central1-card-show-finder.cloudfunctions.net/api';

/**
 * Create a payment intent for a premium show listing
 * @param {string} showId - ID of the show being upgraded to premium
 * @param {string} userId - ID of the user/promoter making the payment
 * @param {number} amount - Payment amount in cents (default: 1999 = $19.99)
 * @returns {Promise<Object>} - Payment intent details or error
 */
export const createPremiumListingPaymentIntent = async (showId, userId, amount = 1999) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/create-payment-intent`, {
      showId,
      userId,
      amount,
      type: 'premium_listing'
    });

    return {
      success: true,
      clientSecret: response.data.clientSecret,
      ephemeralKey: response.data.ephemeralKey,
      customerId: response.data.customerId,
      error: null
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create payment intent'
    };
  }
};

/**
 * Get the payment status for a particular show
 * @param {string} showId - ID of the show to check payment status
 * @returns {Promise<Object>} - Payment status details or error
 */
export const getShowPaymentStatus = async (showId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/payment-status/${showId}`);
    
    return {
      success: true,
      paymentStatus: response.data.paymentStatus,
      isPremium: response.data.isPremium,
      paymentDate: response.data.paymentDate ? new Date(response.data.paymentDate) : null,
      error: null
    };
  } catch (error) {
    console.error('Error getting payment status:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get payment status'
    };
  }
};

/**
 * Confirm a premium listing payment was successful and update show status
 * @param {string} showId - ID of the show being upgraded
 * @param {string} paymentIntentId - ID of the completed Stripe payment intent
 * @returns {Promise<Object>} - Success status or error
 */
export const confirmPremiumListingPayment = async (showId, paymentIntentId) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/confirm-premium-payment`, {
      showId,
      paymentIntentId
    });
    
    return {
      success: true,
      showUpdated: response.data.showUpdated,
      error: null
    };
  } catch (error) {
    console.error('Error confirming premium payment:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to confirm payment'
    };
  }
};

/**
 * Upgrade an existing show from regular to premium
 * @param {string} showId - ID of the show to upgrade
 * @param {string} userId - ID of the user/promoter making the upgrade
 * @returns {Promise<Object>} - Payment intent for the upgrade or error
 */
export const upgradeShowToPremium = async (showId, userId) => {
  try {
    // First, check if the show exists and is eligible for upgrade
    const checkResponse = await axios.get(`${API_BASE_URL}/check-upgrade-eligibility/${showId}`);
    
    if (!checkResponse.data.eligible) {
      return {
        success: false,
        error: checkResponse.data.reason || 'Show is not eligible for upgrade'
      };
    }
    
    // If eligible, create a payment intent for the upgrade
    return await createPremiumListingPaymentIntent(showId, userId);
  } catch (error) {
    console.error('Error upgrading show to premium:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to upgrade show'
    };
  }
};

/**
 * Get pricing information for premium listings
 * @returns {Promise<Object>} - Pricing details or error
 */
export const getPremiumListingPricing = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/premium-pricing`);
    
    return {
      success: true,
      regularPrice: response.data.regularPrice,
      premiumPrice: response.data.premiumPrice,
      currency: response.data.currency,
      features: response.data.features,
      error: null
    };
  } catch (error) {
    console.error('Error getting premium pricing:', error);
    // Return default pricing if API fails
    return {
      success: true,
      regularPrice: 0, // Free
      premiumPrice: 1999, // $19.99
      currency: 'usd',
      features: [
        'Featured placement at the top of search results',
        'Highlighted in map view',
        'Premium badge on show details',
        'Analytics dashboard'
      ],
      error: null
    };
  }
};

/**
 * Submit a show for approval (after creation or update)
 * @param {string} showId - ID of the show to submit for approval
 * @param {boolean} isPremium - Whether this is a premium listing
 * @returns {Promise<Object>} - Success status or error
 */
export const submitShowForApproval = async (showId, isPremium = false) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/submit-for-approval`, {
      showId,
      isPremium
    });
    
    return {
      success: true,
      status: response.data.status,
      estimatedReviewTime: response.data.estimatedReviewTime,
      error: null
    };
  } catch (error) {
    console.error('Error submitting show for approval:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to submit show for approval'
    };
  }
};
