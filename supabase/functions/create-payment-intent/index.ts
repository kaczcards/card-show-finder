// supabase/functions/create-payment-intent/index.ts
/**
 * Stripe Payment Intent Creation - Supabase Edge Function
 * 
 * This function creates a Stripe Payment Intent for subscription purchases.
 * It handles:
 * - Authentication verification
 * - Customer creation/retrieval
 * - Payment intent creation with proper metadata
 * - Returning data needed for the Stripe Payment Sheet
 * 
 * Request body:
 * {
 *   amount: number,      // Amount in cents (e.g., 2900 for $29)
 *   currency: string,    // Currency code (e.g., 'usd')
 *   userId: string,      // User ID from Supabase Auth
 *   planId: string       // Subscription plan ID (e.g., 'mvp-dealer-monthly')
 * }
 * 
 * Response:
 * {
 *   paymentIntent: string,     // Payment Intent client secret
 *   ephemeralKey: string,      // Ephemeral Key for the customer
 *   customer: string,          // Stripe Customer ID
 *   publishableKey: string     // Stripe Publishable Key
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import Stripe from "https://esm.sh/stripe@13.2.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_PUBLISHABLE_KEY = Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Initialize Stripe client
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16", // Use the latest stable API version
  httpClient: Stripe.createFetchHttpClient(),
});

// Create a Supabase client with the service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Verify the JWT token from the request
 * @param authHeader - The Authorization header from the request
 * @returns The user ID from the token, or null if invalid
 */
async function verifyToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("Auth error:", error);
      return null;
    }

    return user.id;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

/**
 * Get or create a Stripe customer for the user
 * @param userId - The user ID from Supabase Auth
 * @returns The Stripe Customer ID
 */
async function getOrCreateCustomer(userId: string): Promise<string> {
  try {
    // Check if we already have a customer record for this user
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (customerData?.stripe_customer_id) {
      return customerData.stripe_customer_id;
    }

    // Get user details from Supabase
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      throw new Error(`Could not find user profile: ${userError?.message}`);
    }

    // Create a new customer in Stripe
    const customer = await stripe.customers.create({
      email: userData.email || undefined,
      name: userData.first_name && userData.last_name 
        ? `${userData.first_name} ${userData.last_name}` 
        : undefined,
      metadata: {
        userId: userId, // Store the user ID in Stripe metadata for webhook processing
      },
    });

    // Store the customer ID in our database
    await supabase.from("customers").insert({
      user_id: userId,
      stripe_customer_id: customer.id,
      email: userData.email || null,
    });

    return customer.id;
  } catch (error) {
    console.error("Error creating/retrieving customer:", error);
    throw new Error(`Failed to create/retrieve customer: ${error.message}`);
  }
}

/**
 * Main handler function for the Edge Function
 */
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    const { amount, currency, userId, planId } = body;
    if (!amount || !currency || !userId || !planId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    const authenticatedUserId = await verifyToken(authHeader);

    if (!authenticatedUserId || authenticatedUserId !== userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get or create a Stripe customer for the user
    const customerId = await getOrCreateCustomer(userId);

    // Create an ephemeral key for the customer
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2023-10-16" }
    );

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId,
        planId: planId,
      },
    });

    // Return the payment intent details
    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey: STRIPE_PUBLISHABLE_KEY,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
