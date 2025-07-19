#!/usr/bin/env node
/**
 * Stripe Webhook Testing Tool
 * ===========================
 * 
 * This script simulates Stripe webhook events by:
 * 1. Generating realistic event payloads
 * 2. Signing them with your webhook secret
 * 3. Sending them to your webhook endpoint
 * 4. Displaying the results
 * 
 * Usage:
 *   node test-stripe-webhook.js [event-type]
 * 
 * Examples:
 *   node test-stripe-webhook.js payment_intent.succeeded
 *   node test-stripe-webhook.js customer.subscription.created
 *   node test-stripe-webhook.js list  # Shows all available event types
 * 
 * Requirements:
 *   - Node.js v14+
 *   - .env file with STRIPE_WEBHOOK_SECRET and WEBHOOK_URL
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

// Environment variables
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:54321/functions/v1/stripe-webhook';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Constants
const TIMESTAMP = Math.floor(Date.now() / 1000);

// Validate environment
if (!STRIPE_WEBHOOK_SECRET) {
  console.error('\x1b[31m❌ Error: STRIPE_WEBHOOK_SECRET not found in .env file\x1b[0m');
  console.log('Create a .env file with STRIPE_WEBHOOK_SECRET=whsec_... and try again');
  process.exit(1);
}

/**
 * Available test events
 * Each event has a name, description, and a function to generate its payload
 */
const TEST_EVENTS = {
  'payment_intent.succeeded': {
    description: 'Simulates a successful payment',
    generate: () => ({
      id: `evt_${randomId()}`,
      object: 'event',
      api_version: '2023-10-16',
      created: TIMESTAMP,
      data: {
        object: {
          id: `pi_${randomId()}`,
          object: 'payment_intent',
          amount: 2900, // $29.00
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            userId: '550e8400-e29b-41d4-a716-446655440000', // Example UUID
            planId: 'mvp-dealer-monthly'
          },
          customer: `cus_${randomId()}`,
          payment_method: `pm_${randomId()}`
        }
      },
      type: 'payment_intent.succeeded'
    })
  },
  'payment_intent.payment_failed': {
    description: 'Simulates a failed payment',
    generate: () => ({
      id: `evt_${randomId()}`,
      object: 'event',
      api_version: '2023-10-16',
      created: TIMESTAMP,
      data: {
        object: {
          id: `pi_${randomId()}`,
          object: 'payment_intent',
          amount: 2900,
          currency: 'usd',
          status: 'requires_payment_method',
          last_payment_error: {
            code: 'card_declined',
            message: 'Your card was declined.'
          },
          metadata: {
            userId: '550e8400-e29b-41d4-a716-446655440000',
            planId: 'mvp-dealer-monthly'
          },
          customer: `cus_${randomId()}`
        }
      },
      type: 'payment_intent.payment_failed'
    })
  },
  'checkout.session.completed': {
    description: 'Simulates a completed checkout session',
    generate: () => ({
      id: `evt_${randomId()}`,
      object: 'event',
      api_version: '2023-10-16',
      created: TIMESTAMP,
      data: {
        object: {
          id: `cs_${randomId()}`,
          object: 'checkout.session',
          amount_total: 26100, // $261.00
          currency: 'usd',
          customer: `cus_${randomId()}`,
          metadata: {
            planId: 'mvp-dealer-annual'
          },
          mode: 'payment',
          payment_status: 'paid',
          status: 'complete'
        }
      },
      type: 'checkout.session.completed'
    })
  },
  'customer.subscription.created': {
    description: 'Simulates a new subscription creation',
    generate: () => ({
      id: `evt_${randomId()}`,
      object: 'event',
      api_version: '2023-10-16',
      created: TIMESTAMP,
      data: {
        object: {
          id: `sub_${randomId()}`,
          object: 'subscription',
          customer: `cus_${randomId()}`,
          current_period_start: TIMESTAMP,
          current_period_end: TIMESTAMP + 30 * 24 * 60 * 60, // 30 days later
          status: 'active',
          items: {
            data: [
              {
                id: `si_${randomId()}`,
                price: {
                  id: `price_${randomId()}`,
                  product: `prod_${randomId()}`,
                  metadata: {
                    planId: 'mvp-dealer-monthly'
                  }
                }
              }
            ]
          },
          cancel_at_period_end: false
        }
      },
      type: 'customer.subscription.created'
    })
  },
  'customer.subscription.updated': {
    description: 'Simulates a subscription update',
    generate: () => ({
      id: `evt_${randomId()}`,
      object: 'event',
      api_version: '2023-10-16',
      created: TIMESTAMP,
      data: {
        object: {
          id: `sub_${randomId()}`,
          object: 'subscription',
          customer: `cus_${randomId()}`,
          current_period_start: TIMESTAMP,
          current_period_end: TIMESTAMP + 30 * 24 * 60 * 60, // 30 days later
          status: 'active',
          items: {
            data: [
              {
                id: `si_${randomId()}`,
                price: {
                  id: `price_${randomId()}`,
                  product: `prod_${randomId()}`,
                  metadata: {
                    planId: 'mvp-dealer-monthly'
                  }
                }
              }
            ]
          },
          cancel_at_period_end: true // Changed to true (canceling at period end)
        }
      },
      type: 'customer.subscription.updated'
    })
  },
  'customer.subscription.deleted': {
    description: 'Simulates a subscription cancellation',
    generate: () => ({
      id: `evt_${randomId()}`,
      object: 'event',
      api_version: '2023-10-16',
      created: TIMESTAMP,
      data: {
        object: {
          id: `sub_${randomId()}`,
          object: 'subscription',
          customer: `cus_${randomId()}`,
          current_period_start: TIMESTAMP - 30 * 24 * 60 * 60, // 30 days ago
          current_period_end: TIMESTAMP - 60, // Just expired
          status: 'canceled',
          canceled_at: TIMESTAMP - 120, // 2 minutes ago
          items: {
            data: [
              {
                id: `si_${randomId()}`,
                price: {
                  id: `price_${randomId()}`,
                  product: `prod_${randomId()}`,
                  metadata: {
                    planId: 'mvp-dealer-monthly'
                  }
                }
              }
            ]
          },
          cancel_at_period_end: false
        }
      },
      type: 'customer.subscription.deleted'
    })
  },
  'invoice.paid': {
    description: 'Simulates a paid invoice',
    generate: () => ({
      id: `evt_${randomId()}`,
      object: 'event',
      api_version: '2023-10-16',
      created: TIMESTAMP,
      data: {
        object: {
          id: `in_${randomId()}`,
          object: 'invoice',
          customer: `cus_${randomId()}`,
          subscription: `sub_${randomId()}`,
          status: 'paid',
          amount_due: 2900,
          amount_paid: 2900,
          currency: 'usd',
          paid: true,
          period_start: TIMESTAMP - 30 * 24 * 60 * 60, // 30 days ago
          period_end: TIMESTAMP
        }
      },
      type: 'invoice.paid'
    })
  },
  'invoice.payment_failed': {
    description: 'Simulates a failed invoice payment',
    generate: () => ({
      id: `evt_${randomId()}`,
      object: 'event',
      api_version: '2023-10-16',
      created: TIMESTAMP,
      data: {
        object: {
          id: `in_${randomId()}`,
          object: 'invoice',
          customer: `cus_${randomId()}`,
          subscription: `sub_${randomId()}`,
          status: 'open',
          amount_due: 2900,
          amount_paid: 0,
          currency: 'usd',
          paid: false,
          period_start: TIMESTAMP - 30 * 24 * 60 * 60, // 30 days ago
          period_end: TIMESTAMP,
          next_payment_attempt: TIMESTAMP + 24 * 60 * 60 // 1 day later
        }
      },
      type: 'invoice.payment_failed'
    })
  }
};

/**
 * Generate a random ID for Stripe objects
 * @returns {string} Random ID string
 */
function randomId() {
  return crypto.randomBytes(12).toString('hex');
}

/**
 * Sign the payload using the Stripe webhook secret
 * @param {string} payload - The JSON payload to sign
 * @param {number} timestamp - The timestamp to use for signing
 * @returns {string} The signature
 */
function generateSignature(payload, timestamp) {
  const signedPayload = `${timestamp}.${payload}`;
  return crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');
}

/**
 * Send a webhook event to the endpoint
 * @param {string} eventType - The type of event to send
 * @returns {Promise<Object>} The response from the webhook endpoint
 */
async function sendWebhookEvent(eventType) {
  if (!TEST_EVENTS[eventType]) {
    console.error(`\x1b[31m❌ Error: Unknown event type "${eventType}"\x1b[0m`);
    console.log('Run with "list" to see available event types');
    process.exit(1);
  }

  console.log(`\x1b[36m📤 Sending "${eventType}" webhook event...\x1b[0m`);
  
  // Generate the event payload
  const event = TEST_EVENTS[eventType].generate();
  const payload = JSON.stringify(event);
  
  // Generate the signature
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(payload, timestamp);
  
  try {
    // Send the request
    console.log(`\x1b[90m🔗 POST ${WEBHOOK_URL}\x1b[0m`);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': `t=${timestamp},v1=${signature}`,
      },
      body: payload,
    });
    
    // Parse the response
    let responseBody;
    try {
      responseBody = await response.json();
    } catch (e) {
      responseBody = await response.text();
    }
    
    // Display the result
    if (response.ok) {
      console.log(`\x1b[32m✅ Success! Status: ${response.status}\x1b[0m`);
      console.log('Response:', JSON.stringify(responseBody, null, 2));
    } else {
      console.error(`\x1b[31m❌ Error! Status: ${response.status}\x1b[0m`);
      console.error('Response:', JSON.stringify(responseBody, null, 2));
    }
    
    return { status: response.status, body: responseBody };
  } catch (error) {
    console.error('\x1b[31m❌ Failed to send webhook:\x1b[0m', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\x1b[33m⚠️ Is your Supabase function running? Try:\x1b[0m');
      console.log('  supabase functions serve stripe-webhook');
    }
    return { status: 'error', error };
  }
}

/**
 * Display available event types
 */
function listEventTypes() {
  console.log('\x1b[36m📋 Available event types:\x1b[0m');
  console.log('');
  
  Object.entries(TEST_EVENTS).forEach(([eventType, { description }]) => {
    console.log(`\x1b[33m${eventType}\x1b[0m`);
    console.log(`  ${description}`);
    console.log('');
  });
  
  console.log('To test an event, run:');
  console.log('  node test-stripe-webhook.js <event-type>');
}

/**
 * Display help information
 */
function showHelp() {
  console.log('\x1b[36m🔍 Stripe Webhook Testing Tool\x1b[0m');
  console.log('');
  console.log('Usage:');
  console.log('  node test-stripe-webhook.js [event-type]');
  console.log('');
  console.log('Commands:');
  console.log('  list    Show available event types');
  console.log('  help    Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node test-stripe-webhook.js payment_intent.succeeded');
  console.log('  node test-stripe-webhook.js customer.subscription.created');
  console.log('');
  console.log('Environment:');
  console.log('  WEBHOOK_URL           URL to send webhooks to');
  console.log('  STRIPE_WEBHOOK_SECRET Secret for signing webhooks');
  console.log('');
  console.log('Current settings:');
  console.log(`  WEBHOOK_URL: ${WEBHOOK_URL}`);
  console.log(`  STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Not set'}`);
}

/**
 * Run a sequence of tests
 * @param {string[]} eventTypes - Array of event types to test
 */
async function runTestSequence(eventTypes) {
  console.log(`\x1b[36m🔄 Running test sequence with ${eventTypes.length} events...\x1b[0m`);
  
  for (const eventType of eventTypes) {
    console.log(`\n\x1b[36m▶️ Testing "${eventType}":\x1b[0m`);
    await sendWebhookEvent(eventType);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n\x1b[36m✨ Test sequence complete!\x1b[0m');
}

/**
 * Main function
 */
async function main() {
  const arg = process.argv[2];
  
  if (!arg || arg === 'help') {
    showHelp();
    return;
  }
  
  if (arg === 'list') {
    listEventTypes();
    return;
  }
  
  if (arg === 'sequence') {
    // Run a predefined sequence of tests
    await runTestSequence([
      'payment_intent.succeeded',
      'customer.subscription.created',
      'customer.subscription.updated',
      'invoice.paid',
      'customer.subscription.deleted'
    ]);
    return;
  }
  
  // Send a single event
  await sendWebhookEvent(arg);
}

// Run the script
main().catch(error => {
  console.error('\x1b[31m❌ Unhandled error:\x1b[0m', error);
  process.exit(1);
});
