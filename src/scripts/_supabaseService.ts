/**
 * Supabase Service Client
 * 
 * This module provides a Supabase client configured with service role permissions
 * for use in server-side Node.js scripts. It requires SUPABASE_URL and 
 * SUPABASE_SERVICE_ROLE_KEY environment variables to be set.
 * 
 * IMPORTANT: This client has elevated database privileges and should NEVER
 * be used in client-side code or exposed to end users.
 */

// Load environment variables from .env file
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

/**
 * Ensures that a required environment variable is defined
 * @param name The name of the environment variable
 * @returns The value of the environment variable
 * @throws Error if the environment variable is not defined
 */
export function ensureEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Please ensure this is set in your .env file or environment.`
    );
  }
  return value;
}

// Get and validate required environment variables
const supabaseUrl = ensureEnv('SUPABASE_URL');
const supabaseServiceKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');

// Create the service client with admin privileges
export const serviceSupabase = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Log connection info in development mode
if (process.env.NODE_ENV !== 'production') {
  console.log(
    '\n================= [SERVICE SUPABASE] =================\n' +
    `• SUPABASE URL    : ${supabaseUrl}\n` +
    `• SERVICE KEY     : ${supabaseServiceKey.slice(0, 8)}...\n` +
    `• ENVIRONMENT     : ${process.env.NODE_ENV || 'development'}\n` +
    '====================================================\n'
  );
}

// Export types from Supabase for use in other files
export type { SupabaseClient } from '@supabase/supabase-js';
