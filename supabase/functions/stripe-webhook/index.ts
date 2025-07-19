// supabase/functions/stripe-webhook/index.ts
/**
 * Stripe Webhook Handler - Supabase Edge Function
 * 
 * This function processes incoming Stripe webhook events, verifies their authenticity,
 * and updates the database accordingly. It handles subscription lifecycle events,
 * payment successes/failures, and other critical billing events.
 * 
 * Events handled include:
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 * 
 * Security:
 * - Rate limiting to prevent abuse
 * - WAF protection against common attack patterns
 * - Validates webhook signatures using Stripe's signing secret
 * - Uses environment variables for sensitive keys
 * - Implements proper error handling and logging
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import Stripe from "https://esm.sh/stripe@13.2.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { applySecurity, createSecureResponse, createSecureErrorResponse } from "../_shared/security.ts";

// Environment variables
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Initialize Stripe and Supabase clients
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16", // Use the latest stable API version
  httpClient: Stripe.createFetchHttpClient(),
});

// Use service role key for admin access to Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * User roles in the application
 */
enum UserRole {
  ATTENDEE = "attendee",
  DEALER = "dealer",
  MVP_DEALER = "mvp_dealer",
  SHOW_ORGANIZER = "show_organizer",
  ADMIN = "admin",
}

/**
 * Subscription status types
 */
enum SubscriptionStatus {
  ACTIVE = "active",
  TRIALING = "trialing",
  PAST_DUE = "past_due",
  CANCELED = "canceled",
  INCOMPLETE = "incomplete",
  INCOMPLETE_EXPIRED = "incomplete_expired",
  UNPAID = "unpaid",
}

/**
 * Payment status types
 */
enum PaymentStatus {
  TRIAL = "trial",
  PAID = "paid",
  NONE = "none",
}

/**
 * Maps Stripe subscription plans to user roles
 */
const PLAN_TO_ROLE_MAPPING: Record<string, UserRole> = {
  "mvp-dealer-monthly": UserRole.MVP_DEALER,
  "mvp-dealer-annual": UserRole.MVP_DEALER,
  "show-organizer-monthly": UserRole.SHOW_ORGANIZER,
  "show-organizer-annual": UserRole.SHOW_ORGANIZER,
};

/**
 * Log webhook events to Supabase for auditing and debugging
 */
async function logWebhookEvent(
  eventId: string,
  eventType: string,
  status: "success" | "error",
  data: any,
  errorMessage?: string
) {
  try {
    await supabase.from("webhook_logs").insert({
      event_id: eventId,
      event_type: eventType,
      status: status,
      data: data,
      error_message: errorMessage,
    });
  } catch (error) {
    // If logging fails, we don't want to fail the whole webhook
    console.error("Error logging webhook event:", error);
  }
}

/**
 * Get user ID from Stripe customer ID via metadata lookup
 */
async function getUserIdFromCustomerId(customerId: string): Promise<string | null> {
  try {
    // First check if we have a direct mapping in the customers table
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (customerData?.user_id) {
      return customerData.user_id;
    }

    // If no mapping found, try to get it from Stripe customer metadata
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || customer.deleted) {
      return null;
    }

    // If customer exists and has userId in metadata, use that
    if (customer.metadata?.userId) {
      // Store the mapping for future lookups
      await supabase.from("customers").upsert({
        stripe_customer_id: customerId,
        user_id: customer.metadata.userId,
        email: customer.email || "",
      });
      
      return customer.metadata.userId;
    }

    return null;
  } catch (error) {
    console.error("Error getting user ID from customer ID:", error);
    return null;
  }
}

/**
 * Update user profile with subscription information
 */
async function updateUserSubscription(
  userId: string,
  status: SubscriptionStatus,
  planId: string,
  expiryDate: string,
  paymentStatus: PaymentStatus = PaymentStatus.PAID
) {
  const role = PLAN_TO_ROLE_MAPPING[planId] || UserRole.ATTENDEE;
  
  const { error } = await supabase
    .from("profiles")
    .update({
      role: role,
      subscription_status: status,
      payment_status: paymentStatus,
      subscription_expiry: expiryDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }
}

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  // Extract metadata from the payment intent
  const userId = paymentIntent.metadata?.userId;
  const planId = paymentIntent.metadata?.planId;
  
  if (!userId || !planId) {
    throw new Error("Missing userId or planId in payment intent metadata");
  }

  // Log the successful payment
  await supabase.from("payments").insert({
    user_id: userId,
    plan_id: planId,
    amount: paymentIntent.amount / 100, // Convert from cents to dollars
    currency: paymentIntent.currency,
    status: "succeeded",
    transaction_id: paymentIntent.id,
  });

  // If this is not part of a subscription (one-time payment),
  // we need to manually update the user's subscription status
  // Check if there's already a subscription record for this user
  const { data: subscriptionData } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!subscriptionData) {
    // Calculate expiry date based on plan
    const now = new Date();
    let expiryDate: Date;
    
    if (planId.includes("annual")) {
      expiryDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
    } else {
      expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }

    // Update user profile with subscription info
    await updateUserSubscription(
      userId,
      SubscriptionStatus.ACTIVE,
      planId,
      expiryDate.toISOString()
    );
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  // Extract metadata from the payment intent
  const userId = paymentIntent.metadata?.userId;
  const planId = paymentIntent.metadata?.planId;
  
  if (!userId || !planId) {
    throw new Error("Missing userId or planId in payment intent metadata");
  }

  // Log the failed payment
  await supabase.from("payments").insert({
    user_id: userId,
    plan_id: planId,
    amount: paymentIntent.amount / 100, // Convert from cents to dollars
    currency: paymentIntent.currency,
    status: "failed",
    transaction_id: paymentIntent.id,
    error_message: paymentIntent.last_payment_error?.message || "Payment failed",
  });

  // No need to update subscription status here as the subscription
  // will be updated by the subscription events
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  
  // Get customer ID from the session
  const customerId = session.customer as string;
  
  // Get user ID from customer ID
  const userId = await getUserIdFromCustomerId(customerId);
  if (!userId) {
    throw new Error("Could not find user ID for customer: " + customerId);
  }

  // If this is a subscription checkout
  if (session.mode === "subscription" && session.subscription) {
    // The subscription details will be handled by the subscription events
    // No need to do anything here
    return;
  }
  
  // If this is a one-time payment
  if (session.mode === "payment") {
    const planId = session.metadata?.planId;
    if (!planId) {
      throw new Error("Missing planId in checkout session metadata");
    }

    // Calculate expiry date based on plan
    const now = new Date();
    let expiryDate: Date;
    
    if (planId.includes("annual")) {
      expiryDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
    } else {
      expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }

    // Update user profile with subscription info
    await updateUserSubscription(
      userId,
      SubscriptionStatus.ACTIVE,
      planId,
      expiryDate.toISOString()
    );

    // Log the payment
    await supabase.from("payments").insert({
      user_id: userId,
      plan_id: planId,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency || "usd",
      status: "succeeded",
      transaction_id: session.id,
    });
  }
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  // Get customer ID from the subscription
  const customerId = subscription.customer as string;
  
  // Get user ID from customer ID
  const userId = await getUserIdFromCustomerId(customerId);
  if (!userId) {
    throw new Error("Could not find user ID for customer: " + customerId);
  }

  // Get the subscription item (should be only one for our use case)
  const item = subscription.items.data[0];
  if (!item) {
    throw new Error("No subscription item found");
  }

  // Get the price ID and product ID
  const priceId = item.price.id;
  const productId = item.price.product as string;

  // Get plan ID from product metadata
  const product = await stripe.products.retrieve(productId);
  const planId = product.metadata?.planId;
  
  if (!planId) {
    throw new Error("Missing planId in product metadata");
  }

  // Determine subscription status
  let status: SubscriptionStatus;
  let paymentStatus: PaymentStatus;
  
  if (subscription.status === "trialing") {
    status = SubscriptionStatus.TRIALING;
    paymentStatus = PaymentStatus.TRIAL;
  } else if (subscription.status === "active") {
    status = SubscriptionStatus.ACTIVE;
    paymentStatus = PaymentStatus.PAID;
  } else {
    status = subscription.status as SubscriptionStatus;
    paymentStatus = PaymentStatus.NONE;
  }

  // Calculate expiry date
  const expiryDate = new Date(subscription.current_period_end * 1000).toISOString();

  // Update user profile with subscription info
  await updateUserSubscription(userId, status, planId, expiryDate, paymentStatus);

  // Store subscription details in Supabase
  await supabase.from("subscriptions").insert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    plan_id: planId,
    stripe_price_id: priceId,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: expiryDate,
    cancel_at_period_end: subscription.cancel_at_period_end,
  });
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  // Get subscription ID
  const subscriptionId = subscription.id;
  
  // Get subscription from database
  const { data: subscriptionData, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("user_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (subscriptionError || !subscriptionData) {
    // Try to get user ID from customer ID
    const customerId = subscription.customer as string;
    const userId = await getUserIdFromCustomerId(customerId);
    
    if (!userId) {
      throw new Error("Could not find subscription or user for subscription: " + subscriptionId);
    }
    
    // This is a new subscription we haven't seen before
    // Handle it like a new subscription
    return handleSubscriptionCreated(event);
  }

  const userId = subscriptionData.user_id;
  let planId = subscriptionData.plan_id;

  // Check if the plan has changed
  const item = subscription.items.data[0];
  if (item) {
    const productId = item.price.product as string;
    const product = await stripe.products.retrieve(productId);
    
    if (product.metadata?.planId) {
      planId = product.metadata.planId;
    }
  }

  // Determine subscription status
  let status: SubscriptionStatus;
  let paymentStatus: PaymentStatus;
  
  if (subscription.status === "trialing") {
    status = SubscriptionStatus.TRIALING;
    paymentStatus = PaymentStatus.TRIAL;
  } else if (subscription.status === "active") {
    status = SubscriptionStatus.ACTIVE;
    paymentStatus = PaymentStatus.PAID;
  } else {
    status = subscription.status as SubscriptionStatus;
    paymentStatus = PaymentStatus.NONE;
  }

  // Calculate expiry date
  const expiryDate = new Date(subscription.current_period_end * 1000).toISOString();

  // Update user profile with subscription info
  await updateUserSubscription(userId, status, planId, expiryDate, paymentStatus);

  // Update subscription details in Supabase
  await supabase
    .from("subscriptions")
    .update({
      plan_id: planId,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: expiryDate,
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq("stripe_subscription_id", subscriptionId);
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  // Get subscription ID
  const subscriptionId = subscription.id;
  
  // Get subscription from database
  const { data: subscriptionData, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("user_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (subscriptionError || !subscriptionData) {
    console.error("Could not find subscription:", subscriptionId);
    return;
  }

  const userId = subscriptionData.user_id;

  // Update user profile to revert to basic role
  await supabase
    .from("profiles")
    .update({
      role: UserRole.ATTENDEE,
      subscription_status: SubscriptionStatus.CANCELED,
      payment_status: PaymentStatus.NONE,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  // Update subscription status in database
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);
}

/**
 * Handle invoice.paid event
 */
async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  
  // If this is a subscription invoice
  if (invoice.subscription) {
    const subscriptionId = invoice.subscription as string;
    
    // Get subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Get subscription from database
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("user_id, plan_id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    if (subscriptionError || !subscriptionData) {
      console.error("Could not find subscription:", subscriptionId);
      return;
    }

    const userId = subscriptionData.user_id;
    const planId = subscriptionData.plan_id;

    // If the subscription was in a past_due state, update it to active
    if (subscription.status === "active") {
      // Calculate expiry date
      const expiryDate = new Date(subscription.current_period_end * 1000).toISOString();

      // Update user profile with subscription info
      await updateUserSubscription(
        userId,
        SubscriptionStatus.ACTIVE,
        planId,
        expiryDate,
        PaymentStatus.PAID
      );

      // Update subscription details in Supabase
      await supabase
        .from("subscriptions")
        .update({
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: expiryDate,
        })
        .eq("stripe_subscription_id", subscriptionId);
    }

    // Log the payment
    await supabase.from("payments").insert({
      user_id: userId,
      plan_id: planId,
      amount: invoice.amount_paid / 100, // Convert from cents to dollars
      currency: invoice.currency,
      status: "succeeded",
      transaction_id: invoice.id,
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
    });
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  
  // If this is a subscription invoice
  if (invoice.subscription) {
    const subscriptionId = invoice.subscription as string;
    
    // Get subscription from database
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("user_id, plan_id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    if (subscriptionError || !subscriptionData) {
      console.error("Could not find subscription:", subscriptionId);
      return;
    }

    const userId = subscriptionData.user_id;
    const planId = subscriptionData.plan_id;

    // Update user profile to past_due status
    await supabase
      .from("profiles")
      .update({
        subscription_status: SubscriptionStatus.PAST_DUE,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // Update subscription status in database
    await supabase
      .from("subscriptions")
      .update({
        status: "past_due",
      })
      .eq("stripe_subscription_id", subscriptionId);

    // Log the failed payment
    await supabase.from("payments").insert({
      user_id: userId,
      plan_id: planId,
      amount: invoice.amount_due / 100, // Convert from cents to dollars
      currency: invoice.currency,
      status: "failed",
      transaction_id: invoice.id,
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
      error_message: "Invoice payment failed",
    });
  }
}

/**
 * Main webhook handler function
 */
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    // Apply security middleware with webhook configuration
    // This adds rate limiting and WAF protection
    const securityResponse = await applySecurity(req, "webhook");
    if (securityResponse) return securityResponse;
    
    // Verify request method
    if (req.method !== "POST") {
      return createSecureErrorResponse("Method not allowed", 405, "webhook");
    }

    // Get the signature from the headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return createSecureErrorResponse("No signature provided", 400, "webhook");
    }

    // Get the raw body
    const body = await req.text();
    
    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error(`⚠️ Webhook signature verification failed:`, err);
      return createSecureErrorResponse("Invalid signature", 400, "webhook");
    }

    // Process the event based on its type
    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(event);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentIntentFailed(event);
          break;
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event);
          break;
        case "customer.subscription.created":
          await handleSubscriptionCreated(event);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event);
          break;
        case "invoice.paid":
          await handleInvoicePaid(event);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event);
          break;
        default:
          // Log unhandled events for monitoring purposes
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Log successful event processing
      await logWebhookEvent(event.id, event.type, "success", event.data.object);

      // Return a 200 response to acknowledge receipt of the event
      return createSecureResponse({ received: true }, 200, "webhook");
    } catch (error) {
      // Log error for debugging
      console.error(`Error processing webhook ${event.type}:`, error);
      
      // Log failed event processing
      await logWebhookEvent(
        event.id,
        event.type,
        "error",
        event.data.object,
        error.message
      );

      // Return error response
      return createSecureErrorResponse(`Webhook processing failed: ${error.message}`, 500, "webhook");
    }
  } catch (error) {
    // Catch any other errors
    console.error("Unexpected error:", error);
    return createSecureErrorResponse(`Unexpected error: ${error.message}`, 500, "webhook");
  }
});
