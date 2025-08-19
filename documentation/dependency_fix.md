## Issues Fixed

This PR fixes multiple issues in the Organizer Dashboard:

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
- Created a unified fullRefresh method that refreshes all relevant data
- Properly passed the onClaimSuccess callback to the UnclaimedShowsList component
- Added proper error handling and logging to all service functions
- Fixed all references to the refresh functions throughout the component

### 3. Fix Dependency Issue Breaking the App

**Problem:** The app was crashing during build with "Unable to resolve @react-native-community/datetimepicker" because we were using a package that wasn't installed.

**Solution:**
- Replaced @react-native-community/datetimepicker with react-native-date-picker (which was already installed)
- Updated the DatePicker usage to match the API of the installed package
- Used modal date picker instead of inline component
- Updated callbacks to use onConfirm and onCancel instead of onChange

## Implementation Details

- Added 500+ lines of new code for the AddShowScreen implementation
- Improved service methods with proper type definitions and error handling
- Fixed all references to refresh functions to maintain consistency
- Added proper validation for form fields and API responses
- Ensured all dependencies are properly used and available in the project

These changes ensure a smooth workflow for organizers when creating new shows or claiming existing ones.

*This is a Droid-assisted PR.*
