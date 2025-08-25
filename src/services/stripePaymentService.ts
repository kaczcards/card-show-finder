import { StripeProvider as _StripeProvider, useStripe as _useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../supabase';
// The helper in `subscriptionTypes` was accidentally exported with an underscore –
// alias it locally so we can keep the nice name in the rest of this file.
import {
  SubscriptionPlan,
  SUBSCRIPTION_PLANS,
  _calculateExpiryDate as calculateExpiryDate,
  SubscriptionPlanType,
  SubscriptionDuration,
} from './subscriptionTypes';
import { UserRole } from './userRoleService';

// --- Type Definitions ---

/**
 * Represents the outcome of a payment operation.
 */
export interface StripePaymentResult {
  success: boolean;
  error?: string;
  transactionId?: string;
}

/**
 * Defines the expected JSON response from the backend (Supabase Edge Function)
 * when creating a payment intent.
 */
interface PaymentIntentResponse {
  paymentIntent: string; // The Payment Intent client secret
  ephemeralKey: string;  // The Ephemeral Key secret for the customer
  customer: string;      // The Stripe Customer ID
  publishableKey: string; // The Stripe publishable key
}

/**
 * Defines the structure for logging a payment transaction in Supabase.
 */
interface PaymentLog {
  id?: string;
  user_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending';
  transaction_id: string; // Stripe Payment Intent ID
  error_message?: string;
  created_at?: string;
}

// --- Constants ---

// It's crucial to load this from environment variables and not hardcode it.
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const SUPABASE_EDGE_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`;

// --- Service Implementation ---

/**
 * Initializes the Stripe SDK.
 * This should be called once at the root of your application.
 * @returns {_boolean} True if initialization was successful, false otherwise.
 */
export const initializeStripe = (): boolean => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.error('Stripe publishable key is not set. Please check your environment variables.');
    return false;
  }
  // The StripeProvider component handles initialization. This function is for validation.
  return true;
};

/**
 * Creates and presents the Stripe Payment Sheet for a given subscription plan.
 * This function orchestrates the entire client-side payment flow.
 *
 * @param userId - The ID of the user purchasing the subscription.
 * @param planId - The ID of the subscription plan being purchased.
 * @param initPaymentSheet - The `initPaymentSheet` function from the `useStripe` hook.
 * @param presentPaymentSheet - The `presentPaymentSheet` function from the `useStripe` hook.
 * @returns {Promise<StripePaymentResult>} The result of the payment operation.
 */
export const createPaymentSheetForSubscription = async (
  userId: string,
  planId: string,
  initPaymentSheet: (params: any) => Promise<any>,
  presentPaymentSheet: () => Promise<any>,
  couponCode?: string
): Promise<StripePaymentResult> => {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  if (!plan) {
    return { success: false, error: 'Subscription plan not found.' };
  }

  try {
    /* ------------------------------------------------------------------
     * 0. Coupon / referral handling – may grant a free first month
     * ------------------------------------------------------------------ */
    if (couponCode && couponCode.trim().length > 0) {
      const { data: couponResp, error: couponErr } = await supabase.rpc(
        'redeem_coupon_for_subscription',
        {
          p_user_id: userId,
          p_code: couponCode.trim(),
          /*  Use String(...) so TS sees a genuine string and we avoid unsafe casts  */
          p_plan_type: String(plan.type).toLowerCase(),
          p_duration: String(plan.duration).toLowerCase(),
          preview_only: false,
        },
      );

      if (couponErr) {
        return {
          success: false,
          error: couponErr.message || 'Failed to redeem promo code',
        };
      }

      if (couponResp?.grant_free_month === true) {
        // Apply free-month locally (no Stripe charge)
        const freeTxId = `free_${Date.now()}`;
        await processFreeMonthSubscriptionUpdate(userId, plan, freeTxId);
        return { success: true, transactionId: freeTxId };
      }
      // Otherwise fall through to normal paid flow (coupon recorded server-side)
    }

    // 1. Create a payment intent on the server (via Supabase Edge Function)

    // -----------------------------------------------------------
    // Retrieve the current access-token from Supabase auth session
    // -----------------------------------------------------------
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;

    const response = await fetch(SUPABASE_EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass the access token only if we actually have one
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        amount: plan.price * 100, // Stripe expects amount in cents
        currency: 'usd',
        userId: userId,
        planId: plan.id,
        ...(couponCode ? { couponCode } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(errorBody.error || 'Failed to create payment intent.');
    }

    const {
      paymentIntent,
      ephemeralKey,
      customer,
    }: PaymentIntentResponse = await response.json();

    // 2. Initialize the Payment Sheet
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'Card Show Finder, LLC.',
      customerId: customer,
      customerEphemeralKeySecret: ephemeralKey,
      paymentIntentClientSecret: paymentIntent,
      allowsDelayedPaymentMethods: true,
      returnURL: 'cardshowfinder://stripe-redirect', // Custom URL scheme
    });

    if (initError) {
      console.error('Stripe initPaymentSheet error:', initError);
      await logPayment({
        user_id: userId,
        plan_id: plan.id,
        amount: plan.price,
        currency: 'usd',
        status: 'failed',
        transaction_id: paymentIntent,
        error_message: `Init Error: ${initError.message}`,
      });
      return { success: false, error: `Initialization failed: ${initError.message}` };
    }

    // 3. Present the Payment Sheet
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      // User cancelled or payment failed
      if (presentError.code === 'Canceled') {
        return { success: false, error: 'Payment was canceled.' };
      }
      console.error('Stripe presentPaymentSheet error:', presentError);
      await logPayment({
        user_id: userId,
        plan_id: plan.id,
        amount: plan.price,
        currency: 'usd',
        status: 'failed',
        transaction_id: paymentIntent,
        error_message: `Present Error: ${presentError.message}`,
      });
      return { success: false, error: `Payment failed: ${presentError.message}` };
    }

    // 4. Payment succeeded, process the subscription
    await processSubscriptionUpdate(userId, plan, paymentIntent);

    return { success: true, transactionId: paymentIntent };

  } catch (error: any) {
    console.error('An unexpected error occurred during payment:', error);
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
};

/**
 * Handles the logic after a successful payment: calculates expiry, updates the user's profile,
 * and logs the transaction.
 *
 * @param userId - The ID of the user.
 * @param plan - The subscription plan that was purchased.
 * @param transactionId - The Stripe Payment Intent ID for logging.
 */
export const processSubscriptionUpdate = async (
  userId: string,
  plan: SubscriptionPlan,
  transactionId: string
): Promise<void> => {
  try {
    /**
     * Calculate the expiry date for the **paid** subscription.
     * We intentionally ignore any free-trial data here because an upgrade
     * should terminate the trial and start the paid period immediately.
     * The helper in `subscriptionTypes` already encodes:
     *   • Annual  → +365 days
     *   • Monthly → +30  days
     */
    const expiryDate = calculateExpiryDate(plan);

    // Determine the new role based on the subscription type
    const newRole =
      plan.type === 'dealer' ? UserRole.MVP_DEALER : UserRole.SHOW_ORGANIZER;

    // Update user profile in Supabase
    await updateUserProfileWithSubscription(
      userId,
      newRole,
      expiryDate.toISOString(),
    );

    // Log the successful payment
    await logPayment({
      user_id: userId,
      plan_id: plan.id,
      amount: plan.price,
      currency: 'usd',
      status: 'succeeded',
      transaction_id: transactionId,
    });

    // --- Organizer referral earnings (dealer monthly only) -----------------
    if (
      plan.type === SubscriptionPlanType.DEALER &&
      plan.duration === SubscriptionDuration.MONTHLY
    ) {
      try {
        await supabase.rpc('award_referral_on_payment', {
          p_user_id: userId,
          p_payment_id: transactionId,
          p_paid_at: new Date().toISOString(),
        });
      } catch (rpcErr: any) {
        // Non-critical: log & continue
        console.error('award_referral_on_payment RPC failed:', rpcErr);
      }
    }

  } catch (error: any) {
    console.error(
      'Failed to process subscription update after payment:',
      error,
    );
    // Even if post-payment processing fails, the payment was successful.
    // This should be handled with a reconciliation process or monitoring.
    // For now, we log the error.
    await logPayment({
      user_id: userId,
      plan_id: plan.id,
      amount: plan.price,
      currency: 'usd',
      status: 'failed', // Log as 'failed' to indicate a processing failure post-payment
      transaction_id: transactionId,
      error_message: 'Post-payment profile update failed.',
    });
  }
};

/**
 * Applies a **free first month** promo: updates the user's profile
 * with an active subscription whose `payment_status` is set to
 * `'trial'` (so UI can still show trial banners) **and** logs a
 * $0 payment marked as succeeded.
 *
 * This mirrors `processSubscriptionUpdate` but with the specific
 * free-month semantics required by coupon codes.
 *
 * @param userId        The user receiving the free month
 * @param plan          The subscription plan (type/duration drive role + expiry)
 * @param transactionId A synthetic ID we generate for analytics/logging
 */
export const processFreeMonthSubscriptionUpdate = async (
  userId: string,
  plan: SubscriptionPlan,
  transactionId: string,
): Promise<void> => {
  try {
    // Compute expiry using the same helper (30-day or 365-day window)
    const expiryDate = calculateExpiryDate(plan);

    // Determine new role from plan type
    const newRole =
      plan.type === 'dealer' ? UserRole.MVP_DEALER : UserRole.SHOW_ORGANIZER;

    // Update profile – note payment_status = 'trial'
    await updateUserProfileWithSubscription(
      userId,
      newRole,
      expiryDate.toISOString(),
    );
    // Override payment_status to 'trial' after the generic update
    await supabase
      .from('profiles')
      .update({
        payment_status: 'trial',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // Log a zero-dollar payment so analytics still capture the event
    await logPayment({
      user_id: userId,
      plan_id: plan.id,
      amount: 0,
      currency: 'usd',
      status: 'succeeded',
      transaction_id: transactionId,
    });
  } catch (error: any) {
    console.error(
      'Failed to process free-month subscription update:',
      error,
    );
    // Non-critical – the user already has the promo applied. We still log for observability.
    await logPayment({
      user_id: userId,
      plan_id: plan.id,
      amount: 0,
      currency: 'usd',
      status: 'failed',
      transaction_id: transactionId,
      error_message: 'Post-promo profile update failed.',
    });
  }
};

/**
 * Updates the user's profile in the Supabase 'profiles' table with new subscription details.
 *
 * @param userId - The user's ID.
 * @param newRole - The new role to assign to the user.
 * @param expiryDateISO - The ISO string of the subscription expiry date.
 */
const updateUserProfileWithSubscription = async (
  userId: string,
  newRole: UserRole,
  expiryDateISO: string
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({
      role: newRole,
      subscription_status: 'active',
      // Mark the user as having completed payment so UI does not show “Trial” banners
      payment_status: 'paid',
      subscription_expiry: expiryDateISO,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user profile with subscription:', error);
    throw new Error('Failed to update user profile after payment.');
  }
};

/**
 * Logs a payment transaction to the 'payments' table in Supabase.
 *
 * @param paymentData - The payment details to log.
 */
const logPayment = async (paymentData: PaymentLog): Promise<void> => {
  const { error } = await supabase.from('payments').insert(paymentData);

  if (error) {
    console.error('Error logging payment transaction:', error);
    // This is a non-critical error for the user flow, but important for analytics/debugging.
  }
};
