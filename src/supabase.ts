import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Supabase configuration - ideally from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

/* -------------------------------------------------------------------------- */
/* 1. Guard-rails / configuration validation                                  */
/* -------------------------------------------------------------------------- */

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast – running with a broken client leads to subtle bugs later
  console.error(
    '[Supabase] Missing configuration. ' +
      'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.'
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Singleton client creation                                               */
/* -------------------------------------------------------------------------- */

/**
 * Internal holder for the Supabase singleton.
 * We keep it in a `let` so tests (or a logout flow) can force-recreate it
 * via `recreateSupabaseClient()`.
 */
let supabaseSingleton = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // we never use browser-based auth redirects
  },
});

/**
 * Public accessor used throughout the codebase to avoid importing
 * `createClient` elsewhere.  Always returns **the same** instance.
 */
export const supabase = supabaseSingleton;

/* -------------------------------------------------------------------------- */
/* 3. Helper utilities                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Defensive check used by legacy code (`isSupabaseInitialized()`).
 */
export const isSupabaseInitialized = (): boolean => {
  try {
    return Boolean(supabaseSingleton && supabaseSingleton.auth);
  } catch (err) {
    console.error('[Supabase] initialization check failed:', err);
    return false;
  }
};

/**
 * Provides the singleton client or throws a descriptive error.
 * Prefer this helper in newly-written code so errors surface early.
 */
export const getSupabase = () => {
  if (!isSupabaseInitialized()) {
    throw new Error(
      '[Supabase] Client not initialised – check environment variables.'
    );
  }
  return supabaseSingleton;
};

/**
 * Optional helper to **re**create the client (e.g. after logout to purge
 * cached auth state, or inside E2E tests).  Most apps will never need this.
 */
export const recreateSupabaseClient = () => {
  supabaseSingleton = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return supabaseSingleton;
};

// Export types from Supabase for use in other files
export type { User, Session } from '@supabase/supabase-js';
