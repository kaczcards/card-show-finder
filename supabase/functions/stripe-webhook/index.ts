// supabase/functions/stripe-webhook/index.ts
/**
 * Stripe Webhook Handler - Supabase Edge Function
 * 
 * This function processes Stripe webhook events, specifically handling
 * payment_intent.succeeded events to award referral earnings for
 * MVP Dealer Monthly subscriptions.
 * 
 * It verifies Stripe signatures, extracts payment details, and calls
 * the award_referral_on_payment database function.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import Stripe from "https://esm.sh/stripe@13.2.0?target=deno";

// Environment variables
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Initialize Stripe client with account secret
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Create a Supabase client with the service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS headers for preflight requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Stripe-Signature",
};

// Main webhook handler
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

    // Get the signature from the headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing Stripe signature" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the raw request body for signature verification
    const rawBody = await req.text();
    
    // Verify the signature and construct the event
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle the event based on its type
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Extract the necessary data
      const paymentIntentId = paymentIntent.id;
      const created = paymentIntent.created; // Unix timestamp
      const userId = paymentIntent.metadata?.userId;
      const planId = paymentIntent.metadata?.planId;
      
      // Check if this is an MVP Dealer Monthly payment
      if (planId !== 'mvp-dealer-monthly') {
        // Not an MVP Dealer Monthly payment, no-op
        return new Response(
          JSON.stringify({ 
            received: true, 
            message: "Event received but not processed (not an MVP Dealer Monthly payment)" 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      // Convert the Unix timestamp to ISO string
      const paidAt = new Date(created * 1000).toISOString();
      
      // Call the award_referral_on_payment function
      try {
        const { data, error } = await supabase.rpc('award_referral_on_payment', {
          p_user_id: userId,
          p_payment_id: paymentIntentId,
          p_paid_at: paidAt
        });
        
        if (error) {
          console.error('Error calling award_referral_on_payment:', error);
          // We still return 200 to Stripe to prevent retries
          return new Response(
            JSON.stringify({ 
              received: true, 
              message: "Event processed but RPC call failed",
              error: error.message
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            received: true, 
            message: "Referral award processed successfully" 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (rpcError) {
        console.error('Unexpected error calling award_referral_on_payment:', rpcError);
        // We still return 200 to Stripe to prevent retries
        return new Response(
          JSON.stringify({ 
            received: true, 
            message: "Event processed but RPC call failed unexpectedly",
            error: rpcError.message
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      // For other event types, just acknowledge receipt
      return new Response(
        JSON.stringify({ 
          received: true, 
          message: `Event of type ${event.type} received but not processed` 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error('Unexpected error processing webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
