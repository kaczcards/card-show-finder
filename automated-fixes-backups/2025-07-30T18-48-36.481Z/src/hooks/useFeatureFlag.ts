/**
 * A simple feature flag hook that determines if a feature is enabled
 * 
 * Currently returns false for all features (stub implementation)
 * Can be enhanced later to check against a real feature flag system
 */
export function useFeatureFlag(featureName: string): boolean {
  // In a real implementation, this would check against a config or API
  // For now, just return false for all feature flags
  return false;
}

/**
 * Common feature flag names used throughout the app
 * Adding them here provides type safety and autocompletion
 */
export const _FeatureFlags = {
  MESSAGING_V2: 'messaging_v2_enabled',
  ADVANCED_SEARCH: 'advanced_search_enabled',
  NEW_PROFILE_UI: 'new_profile_ui_enabled',
  ENHANCED_MAPS: 'enhanced_maps_enabled',
  DEALER_ANALYTICS: 'dealer_analytics_enabled',
} as const;

// Type for feature flag names
export type FeatureFlagName = typeof FeatureFlags[keyof typeof FeatureFlags] | string;
