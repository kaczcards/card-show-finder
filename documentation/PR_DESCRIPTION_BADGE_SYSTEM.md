# Badge System Integration with User Profiles

This PR implements a badge system integrated into user profiles for the Card Show Finder mobile app.

## Changes

- **Badge Service Implementation:** Created a full badge service with functions to:
  - Get all badge definitions
  - Get user's earned badges
  - Get unearned badges
  - Get featured badges for profile display
  - Get next badge to earn
  - Calculate badge progress

- **Profile Screen Enhancements:**
  - Added a new "My Badges" section to the profile screen
  - Displays up to 3 featured badges in a horizontal scrollable list
  - Shows progress toward the next badge to earn
  - Includes "View All" link to navigate to the full badges screen
  - Empty state UI for users who haven't earned badges yet

## Technical Details

- Uses the existing badge schema in Supabase
- Badges are categorized by tier (bronze, silver, gold, platinum)
- Badge system is triggered by user actions (e.g., attending shows)
- Featured badges are sorted by tier priority and recency

## Screenshots

[Screenshots would be included here]

## Testing

To test this feature:
1. Log in with a user account
2. Navigate to the Profile screen to see earned badges (if any)
3. Attend a show or have the admin manually add a badge to test badge earning
4. Verify that progress indicators update correctly

This PR completes the badge system implementation as requested, integrating it into the user profile for increased visibility and engagement.

---
*This is a Droid-assisted PR.*
