# Timezone Fix for Show Times

## Problem

Shows submitted via the web form were displaying incorrect times in the app:
- User submits: **8:59 AM**
- App displays: **4:59 AM** (4 hours earlier)

### Root Cause

The form was submitting times without timezone information:
```javascript
startDate: `2025-02-05T08:59:00`  // No timezone!
```

When this string is stored in PostgreSQL as `TIMESTAMPTZ`, it's interpreted as UTC. Then when the app displays it, the timezone conversion causes the 4-hour difference.

## Solution

### 1. Form Updates (`submit-show-v2.html`)

Added automatic timezone detection:
```javascript
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const dailySchedule = dates.map((date, index) => ({
    date: date,
    startTime: startTimes[index],
    endTime: endTimes[index],
    timezone: userTimezone  // ✅ Now includes timezone!
}));
```

This captures the user's timezone (e.g., `America/New_York`, `America/Chicago`, etc.) and includes it with each day's schedule.

### 2. Database Function Updates (`20250204_fix_timezone_handling.sql`)

Updated `approve_show_v2()` function to:
1. Extract timezone from `dailySchedule`
2. Build proper `TIMESTAMPTZ` values using the timezone
3. Store times correctly in the database

```sql
-- Get timezone from daily schedule
v_timezone := COALESCE(v_daily_schedule->0->>'timezone', 'America/New_York');

-- Build timestamp with timezone
v_start_date := (
  (v_first_day->>'date') || ' ' || 
  (v_first_day->>'startTime') || ':00 ' || 
  v_timezone
)::TIMESTAMPTZ;
```

## How It Works Now

### Submission Flow:
1. User enters: `8:59 AM` on `2025-02-05`
2. Form detects timezone: `America/New_York`
3. Submits:
   ```json
   {
     "date": "2025-02-05",
     "startTime": "08:59",
     "timezone": "America/New_York"
   }
   ```
4. Database converts: `2025-02-05 08:59:00 America/New_York` → stored as UTC internally
5. App retrieves: Gets UTC value, converts to user's local timezone
6. **Result**: User sees `8:59 AM` ✅

## Apply the Fix

### Step 1: Update the Approval Function

Run this migration in **Supabase SQL Editor**:
```
card-show-finder/supabase/migrations/20250204_fix_timezone_handling.sql
```

### Step 2: Update the Web Form

The form has already been updated (`submit-show-v2.html`).

### Step 3: Test

1. Submit a new show via the web form
2. Approve it in the admin panel
3. Check the show in the app
4. Times should now be correct! ✅

## Fixing Existing Shows

For shows that were already submitted with incorrect times, you have two options:

### Option A: Manual Fix (Recommended)

1. Ask the organizer to resubmit the show
2. Delete the old show
3. Approve the new submission

### Option B: SQL Fix

If you know the correct timezone for the show, you can fix it directly:

```sql
-- Fix a specific show
UPDATE shows
SET 
  start_date = '2025-02-05 08:59:00 America/New_York'::TIMESTAMPTZ,
  end_date = '2025-02-05 16:00:00 America/New_York'::TIMESTAMPTZ
WHERE id = 'cd842344-8d47-48ff-82c0-c018620d50d3';

-- Verify the fix
SELECT 
  id,
  title,
  start_date,
  start_date AT TIME ZONE 'America/New_York' as start_local
FROM shows
WHERE id = 'cd842344-8d47-48ff-82c0-c018620d50d3';
```

## App-Side Handling

The React Native app should handle timezone display correctly:

```typescript
// In your React Native app
import moment from 'moment-timezone';

// When displaying a show time:
const displayTime = moment(show.start_date)
  .tz(moment.tz.guess())  // User's timezone
  .format('h:mm A');
```

Or using native Date:
```typescript
// The database returns ISO 8601 with timezone
const showDate = new Date(show.start_date);

// This automatically displays in user's local timezone
const displayTime = showDate.toLocaleTimeString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});
```

## Common Timezones

The form automatically detects the user's timezone, but here are common US timezones:

- `America/New_York` - Eastern (EST/EDT)
- `America/Chicago` - Central (CST/CDT)
- `America/Denver` - Mountain (MST/MDT)
- `America/Phoenix` - Arizona (no DST)
- `America/Los_Angeles` - Pacific (PST/PDT)

## Testing Scenarios

### Test 1: Single Day Show
- Submit show for 2/10/2025, 9:00 AM - 5:00 PM
- Verify it shows correctly in the app

### Test 2: Multi-Day Show
- Submit show for 2/15-2/16, different times each day
- Verify both days show correct times

### Test 3: Different Timezones
- Have someone in a different timezone submit a show
- Verify their local time is preserved

## Summary

✅ **Form**: Now captures user's timezone automatically  
✅ **Database**: Stores times with proper timezone info  
✅ **App**: Should display times in user's local timezone  
✅ **Future submissions**: Will have correct times  
⚠️ **Existing shows**: May need manual correction

All new show submissions will now preserve the correct local time! 🎉
