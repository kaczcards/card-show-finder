import { _createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Supabase configuration - ideally from environment variables
const _supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '';
const _supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

/* -------------------------------------------------------------------------- */
/*  🔍 DIAGNOSTICS – PRINT SUPABASE CREDS IN DEV                              */
/* -------------------------------------------------------------------------- */
// NOTE: These values are **public** (anon key & project URL) so it's safe
// to log them for debugging.  Remove or wrap behind an env‐guard before
// shipping production builds if desired.
console.warn(
  '\n================= [SUPABASE CONFIG] =================\n' +
  `• SUPABASE URL : ${supabaseUrl || '<EMPTY>'}\n` +
  `• ANON KEY     : ${supabaseAnonKey?.slice(0, _8) || '<EMPTY>'}…\n` +
  '====================================================\n'
);

/* -------------------------------------------------------------------------- */
/* 1. Guard-rails / configuration validation                                  */
/* -------------------------------------------------------------------------- */

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast – running with a broken client leads to subtle bugs later
  console.error(
    '[_Supabase] Missing configuration. ' +
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
let _supabaseSingleton = createClient(_supabaseUrl, _supabaseAnonKey, {
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
export const _supabase = supabaseSingleton;

/* -------------------------------------------------------------------------- */
/* 3. Helper utilities                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Defensive check used by legacy code (`isSupabaseInitialized()`).
 */
export const _isSupabaseInitialized = (): boolean => {
  try {
    return Boolean(supabaseSingleton && supabaseSingleton.auth);
  } catch (_err) {
    console.error('[_Supabase] initialization check failed:', _err);
    return false;
  }
};

/**
 * Provides the singleton client or throws a descriptive error.
 * Prefer this helper in newly-written code so errors surface early.
 */
export const _getSupabase = () => {
  if (!isSupabaseInitialized()) {
    throw new Error(
      '[_Supabase] Client not initialised – check environment variables.'
    );
  }
  return supabaseSingleton;
};

/**
 * Optional helper to **re**create the client (e.g. after logout to purge
 * cached auth state, or inside E2E tests).  Most apps will never need this.
 */
export const _recreateSupabaseClient = () => {
  supabaseSingleton = createClient(_supabaseUrl, _supabaseAnonKey, {
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
