# Fix Map Page Issues

This PR addresses persistent issues on the map page to improve user experience, navigation, and performance.

## Changes

### 1. "View Details" Button Navigation
- Added debounce protection to prevent multiple navigations on quick taps
- Added visual feedback with button state during navigation
- Improved error handling with user-friendly alerts

### 2. Address Hyperlinks
- Implemented platform-specific map URL handlers:
  - iOS: `maps:?q=address` URL scheme
  - Android: `geo:0,0?q=address` URL scheme
- Added fallback to Google Maps web URL if native maps app is not available

### 3. Coordinate Validation & Processing
- Created database migration for server-side coordinate validation
- Implemented logging for shows with invalid coordinates
- Added automatic detection and correction of swapped coordinates
- Created coordinate sanitization utilities for client-side validation

### 4. Performance Optimizations
- Added `tracksViewChanges={false}` to all markers to reduce re-renders
- Enabled `liteMode` for Android maps to improve performance
- Implemented data caching with AsyncStorage (1-hour expiration)
- Added proper error boundaries and fallbacks

## Testing

The changes have been tested on both iOS and Android simulators, verifying:

- Navigation works correctly and prevents double-firing
- Address links open native maps applications when available
- Map renders correctly even with invalid coordinates in the database
- Performance is improved, especially with multiple markers

## Next Steps

1. Apply the database migration to implement coordinate validation:
   ```
   yarn supabase migration up
   ```

2. Test on actual iOS and Android devices (not just simulators)
