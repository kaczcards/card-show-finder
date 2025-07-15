## Issues Fixed

This PR fixes two critical blocker issues in the Organizer Dashboard workflow:

### 1. Fix "Create New Show" Blank Page

**Problem:** Clicking the "Create a new Show" button opened a blank screen because the AddShowScreen component was just a placeholder returning null.

**Solution:**
- Created a full implementation of the AddShowScreen component with proper form fields
- Added form validation and submission handling for creating shows
- Updated OrganizerNavigator.tsx to import and use the actual screen
- Added new service methods in showSeriesService.ts for creating standalone shows and shows in a series

### 2. Fix "Claim Show" Functionality Not Updating UI

**Problem:** After clicking to claim a show, the app showed a success message, but the show did not move from the "Unclaimed Shows" tab to the organizer's "My Shows" tab.

**Solution:**
- Created a unified fullRefresh method that refreshes all relevant data:
  - Dashboard metrics
  - OrganizerShowsList data
  - UnclaimedShowsList data
- Properly passed the onClaimSuccess callback to the UnclaimedShowsList component
- Added proper error handling and logging to all service functions
- Fixed all references to the refresh functions throughout the component

## Implementation Details

- Added 500+ lines of new code for the AddShowScreen implementation
- Improved service methods with proper type definitions and error handling
- Fixed all references to refresh functions to maintain consistency
- Added proper validation for form fields and API responses

These changes ensure a smooth workflow for organizers when creating new shows or claiming existing ones.

*This is a Droid-assisted PR.*
