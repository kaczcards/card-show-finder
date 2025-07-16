# Task 8: Social Media Links for Profiles & Show Pop-ups

This PR implements social media and marketplace links functionality for MVPs and Show Organizers, allowing them to:
1. Add their social media links to their profile
2. Display these links in map show pop-ups/callouts

## Changes Overview

- **Database Migration**: Added 5 new nullable columns to profiles table (`facebook_url`, `instagram_url`, `twitter_url`, `whatnot_url`, `ebay_store_url`)
- **TypeScript Interface**: Enhanced User type with new social media field definitions
- **Auth Service**: Updated supabaseAuthService to handle the new fields when mapping profiles and updating user data
- **User Profile Screen**: Added social media section with:
  - Edit form with URL validation
  - Display of links with clickable icons
  - Marketplace links (Whatnot/eBay) only shown for Dealers/Organizers
- **Map Callouts**: Updated MapShowCluster to fetch organizer profiles and display social media icons in show callouts

## Implementation Details

### Database Changes
- Added text columns for 5 social media/marketplace URLs to profiles table
- Added column comments to document their purpose
- All columns are nullable to maintain backwards compatibility

### UI/UX Features
- Social media links show as clickable icons in map callouts for show venues
- Profile screen shows full URLs with appropriate icons
- URL validation ensures properly formatted social media links
- Links automatically open in respective apps when clicked
- Error handling for invalid URLs

## Testing Instructions

1. **Database Migration**: Run the migration against Supabase
2. **Profile Editing**: Test adding social media links in the Profile screen
3. **Validation**: Test that invalid URLs are rejected with appropriate error messages
4. **Map Integration**: Verify that social media icons appear in map callouts for shows
5. **App Integration**: Confirm links open in respective apps when clicked

## Screenshots

(Screenshots to be added during review)
