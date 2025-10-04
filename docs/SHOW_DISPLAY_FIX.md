# Show Display Fix - Features, Categories, Description & Daily Schedule

## Problem

Shows approved via the web form were missing key information in the app:
1. ❌ **Daily schedule times** not displayed (multi-day shows)
2. ❌ **Features** not shown (On-Site Grading, Auction, etc.)
3. ❌ **Categories** not shown (Sports Cards, Pokemon, etc.)
4. ❌ **Description** was NULL (not being saved)

## Root Causes

### 1. Description Not Being Saved
The `approve_show_v2()` function wasn't extracting or saving the description field from the form submission.

### 2. React Native Components Missing
The app had no components to display:
- Daily schedule (multi-day shows with different times)
- Show features
- Show categories

### 3. ShowTimeInfo Not Using Daily Schedule
The time display component only looked at `start_time`/`end_time` fields, not the `daily_schedule` JSONB column.

## Solutions Implemented

### 1. Database Fix - Save Description (`20250204_add_description_to_approval.sql`)

Updated `approve_show_v2()` to extract and save:
- **description** - Show description from organizer
- **entry_fee** - Admission cost
- **image_url** - Flyer/image URL

```sql
-- Extract optional fields
v_description := v_show_data->>'description';
v_entry_fee := v_show_data->>'entryFee';
v_image_url := v_show_data->>'imageUrl';

-- Insert with these fields
INSERT INTO shows (..., description, entry_fee, image_url)
VALUES (..., v_description, v_entry_fee, v_image_url)
```

### 2. ShowTimeInfo Update

Updated to check for `daily_schedule` first:
- If all days have **same times**: Shows "8:00 AM - 4:00 PM"
- If days have **different times**: Shows "Varies by day (see below)"

```typescript
const dailySchedule = safeShow.daily_schedule || safeShow.dailySchedule;
if (dailySchedule && Array.isArray(dailySchedule) && dailySchedule.length > 0) {
  const allSameTime = dailySchedule.every(day => 
    day.startTime === dailySchedule[0].startTime && 
    day.endTime === dailySchedule[0].endTime
  );
  
  if (!allSameTime) {
    return 'Varies by day (see below)';
  }
  // Show the common time if all days are the same
}
```

### 3. New Component: ShowDailySchedule

Displays multi-day shows with times for each day:

```
📅 Daily Schedule
------------------
📅 Sat, Oct 4    ⏰ 8:00 AM - 4:00 PM
📅 Sun, Oct 5    ⏰ 12:00 PM - 8:00 PM
```

Features:
- Only shows if show is multi-day OR has varying times
- Formatted dates with day of week
- Clean, easy-to-read layout

### 4. New Component: ShowFeatures

Displays show features with icons:

```
✨ Show Features
------------------
🔍 On-Site Grading    🔨 Auction
```

Features are displayed as orange badges with emoji icons.

### 5. New Component: ShowCategories

Displays what's available at the show:

```
🃏 What's Available
-------------------
⚾ Sports Cards    ⚡ Pokemon
```

Categories are displayed as green badges with emoji icons.

## Files Modified

### Database
- ✅ `supabase/migrations/20250204_add_description_to_approval.sql` - Save description and optional fields

### React Native App
- ✅ `src/screens/ShowDetail/components/ShowTimeInfo.tsx` - Check daily_schedule first
- ✅ `src/screens/ShowDetail/components/ShowDailySchedule.tsx` - NEW: Display multi-day schedule
- ✅ `src/screens/ShowDetail/components/ShowFeatures.tsx` - NEW: Display features
- ✅ `src/screens/ShowDetail/components/ShowCategories.tsx` - NEW: Display categories
- ✅ `src/screens/ShowDetail/components/index.ts` - Export new components
- ✅ `src/screens/ShowDetail/ShowDetailScreen.tsx` - Use new components

## Apply the Fix

### Step 1: Update Database Function

Run in **Supabase SQL Editor**:
```
card-show-finder/supabase/migrations/20250204_add_description_to_approval.sql
```

### Step 2: Deploy App Update

The React Native components are already updated. Build and deploy the app:
```bash
cd card-show-finder
npx eas build --platform ios --profile production
```

### Step 3: Test

1. Submit a new show with:
   - Description
   - Multiple days with different times
   - Features checked
   - Categories checked
2. Approve the show
3. View in the app - all fields should display! ✅

## Example Output in App

### Before:
```
Show Details
📅 Date: Saturday, October 4, 2025 to Sunday, October 5, 2025
⏰ Hours: Time not specified

About this show
No description available
```

### After:
```
Show Details
📅 Date: Saturday, October 4, 2025 to Sunday, October 5, 2025
⏰ Hours: Varies by day (see below)

📅 Daily Schedule
Sat, Oct 4    8:00 AM - 4:00 PM
Sun, Oct 5    12:00 PM - 8:00 PM

✨ Show Features
🔍 On-Site Grading    🔨 Auction

🃏 What's Available
⚾ Sports Cards    ⚡ Pokemon

About this show
Come early for the best deals! Multi-day event with...
```

## Feature Icons

### Show Features:
- 🔍 On-Site Grading
- ✍️ Autograph Guests
- 🍕 Food Vendors
- 🎁 Door Prizes
- 🔨 Auction
- 📦 Card Breakers

### Show Categories:
- ⚾ Sports Cards
- ⚡ Pokemon
- 🔮 Magic: The Gathering
- 🎴 Yu-Gi-Oh
- 💥 Comics
- 🏆 Memorabilia
- 📜 Vintage

## Summary

✅ **Description** - Now saved and displayed
✅ **Daily Schedule** - Shows times for each day
✅ **Features** - Displayed as orange badges with icons
✅ **Categories** - Displayed as green badges with icons
✅ **Hours** - Smart display (same time vs. varies by day)

All the hard work show organizers put into their submissions is now visible to users! 🎉
