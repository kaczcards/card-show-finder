import { createClient } from '@supabase/supabase-js';
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
  `• SUPABASE URL : ${_supabaseUrl || '<EMPTY>'}\n` +
  `• ANON KEY     : ${_supabaseAnonKey?.slice(0, 8) || '<EMPTY>'}…\n` +
  '====================================================\n'
);

/* -------------------------------------------------------------------------- */
/* 1. Guard-rails / configuration validation                                  */
/* -------------------------------------------------------------------------- */

if (!_supabaseUrl || !_supabaseAnonKey) {
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
export const _supabase = _supabaseSingleton;

/* -------------------------------------------------------------------------- */
/* 3. Helper utilities                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Defensive check used by legacy code (`isSupabaseInitialized()`).
 */
export const _isSupabaseInitialized = (): boolean => {
  try {
    return Boolean(_supabaseSingleton && _supabaseSingleton.auth);
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
  if (!_isSupabaseInitialized()) {
    throw new Error(
      '[_Supabase] Client not initialised – check environment variables.'
    );
  }
  return _supabaseSingleton;
};

/**
 * Optional helper to **re**create the client (e.g. after logout to purge
 * cached auth state, or inside E2E tests).  Most apps will never need this.
 */
export const _recreateSupabaseClient = () => {
  _supabaseSingleton = createClient(_supabaseUrl, _supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return _supabaseSingleton;
};

// Export types from Supabase for use in other files
export type { User, Session } from '@supabase/supabase-js';

/* -------------------------------------------------------------------------- */
/* 4. Back-compat exports (non-underscore names)                               */
/* -------------------------------------------------------------------------- */
// Many legacy modules still import these helpers without the leading
// underscore.  Re-export them here so existing imports continue to work
// while new code can adopt the explicit “private” underscore versions.

// eslint-disable-next-line import/prefer-default-export
export const supabase = _supabase;
export const isSupabaseInitialized = _isSupabaseInitialized;
export const getSupabase = _getSupabase;
export const recreateSupabaseClient = _recreateSupabaseClient;
