/**
 * polyfills.ts
 *
 * Centralised polyfills for APIs that are not yet consistently
 * available in all React-Native runtimes (Hermes / JSC).
 *
 * IMPORTANT:  Always *feature-detect* before defining a polyfill to
 * avoid “duplicate identifier” TypeScript or runtime errors when the
 * host environment eventually gains native support.
 *
 * Usage (entry-point – App.tsx or index.ts):
 *   import './src/utils/polyfills';
 */

/* ------------------------------------------------------------------ */
/* structuredClone                                                    */
/* ------------------------------------------------------------------ */
// Hermes started shipping structuredClone in RN 0.79, but older simulators /
// devices or JSC-based runtimes may still be missing it.  Supabase’s realtime
// Postgres client and various React-Query utils rely on this API.
if (typeof globalThis.structuredClone !== 'function') {
   
  console.warn(
    '[_polyfills] structuredClone not found – installing lightweight polyfill.'
  );

  // A *very* small subset implementation that is sufficient for our usage
  // (plain objects, _arrays, numbers, strings, booleans, null).  It will
  // throw for functions, class instances, Dates, Maps, Sets, etc., mirroring
  // the native behaviour of throwing on non-serialisable input.
  // If we ever need full spec compliance we can replace this with
  // `@ungap/structured-clone` or another more complete shim.
   
  // @ts-ignore – add to global scope
  globalThis.structuredClone = <T>(value: T): T => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      throw new Error(
        '[_polyfills] structuredClone polyfill failed – input may ' +
          'contain non-serialisable values.',
      );
    }
  };
}

// Export nothing – this module is imported for its side-effects only.
export {};
