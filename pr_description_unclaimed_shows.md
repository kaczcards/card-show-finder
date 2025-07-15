## Issue Fixed
The error `TypeError: Cannot convert undefined value to object` was happening inside service functions when trying to process malformed coordinates data from the database.

## Root Cause
We isolated the problem by wrapping each service function call in its own try/catch block. The issue was in the coordinate handling code, where one of the service functions was attempting to access properties on the coordinates object without proper validation, causing the TypeError before any data reached the hook.

## Changes Made
- Added diagnostic try/catch blocks around individual service calls to pinpoint the exact failure point
- Created a new `extractSafeCoordinates` helper method in the service to safely parse PostGIS coordinates
- Improved input validation for all array returns in the service functions
- Added robust error handling for database queries
- Added detailed logging to track the execution path and identify future issues

## Testing
These changes ensure both service functions (`getAllShowSeries` and `getUnclaimedShows`) will always return valid arrays, even when coordinate data is missing or malformed. This prevents the TypeError by handling malformed database data at its source.

*This is a Droid-assisted PR that focuses on fixing the root cause in the service layer rather than adding symptom-masking fixes in the hook.*
