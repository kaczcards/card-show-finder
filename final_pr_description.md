# Fix Critical Organizer Dashboard Issues

This PR fixes multiple critical issues in the Organizer Dashboard:

## 1. Fix "Create New Show" Screen Crashing

**Problem:** The app was crashing with `Invariant Violation: new NativeEventEmitter() requires a non-null argument` when opening the AddShowScreen.

**Solution:**
- Removed `react-native-date-picker` dependency which was causing the native module error
- Replaced DatePicker with simple TextInput components for date entry
- Implemented date parsing and validation for the text inputs
- Maintained the same visual style and functionality without native dependencies

## 2. Fix "Claim Show" UI Not Refreshing 

**Problem:** After claiming a show, it wouldn't disappear from the unclaimed list or appear in the "My Shows" tab until app restart.

**Solution:**
- Implemented a proper refresh mechanism using React refs
- Added `forwardRef` and `useImperativeHandle` to both list components
- Modified the OrganizerDashboardScreen to trigger refresh on both lists when claiming a show
- Ensured metrics are also refreshed to show updated show counts

## 3. Fix Dependency Issues

**Problem:** The app was initially using an incorrect date picker dependency.

**Solution:**
- Switched to simple text inputs that don't require native modules
- This is a more reliable approach for an Expo managed app without ejecting
- Improved error handling for date parsing from text input

## 4. Fix Syntax Error in ShowSeriesService

**Problem:** Missing comma in showSeriesService.ts object definition was causing bundling to fail.

**Solution:**
- Added the missing comma between methods in the service object
- Fixed the syntax error that was preventing the app from bundling

All critical issues have been resolved and the app now allows for complete organizer workflows:
- Creating new shows works without crashing
- Claiming shows properly updates all UI components
- The app builds and runs without bundling errors

*This is a Droid-assisted PR.*
