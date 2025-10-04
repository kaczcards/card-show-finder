# Implementation Summary - Multi-Day Shows & Organizer Mailing List

## ✅ Completed Changes

### 1. Database Migration
**File:** `supabase/migrations/20250203_multi_day_schedule_and_organizer_contact.sql`

**Changes:**
- ✅ Created `web_show_submissions` table for organizer mailing list
- ✅ Added `daily_schedule` JSONB column to `shows` table
- ✅ Updated `approve_pending_show()` function to handle both tables
- ✅ Updated `reject_pending_show()` function to track submissions
- ✅ Added `get_organizer_mailing_list()` function for admin exports
- ✅ Set up RLS policies (admins only for mailing list)

### 2. Web Form Updates
**File:** `website/submit-show-v2.html`

**Changes:**
- ✅ Form already has "Your Name" and "Your Email" fields
- ✅ JavaScript updated to submit to TWO tables:
  1. `scraped_shows_pending` (show data)
  2. `web_show_submissions` (organizer contact info)
- ✅ Supports multi-day shows with "Add Another Day" button
- ✅ Builds `dailySchedule` array for variable times per day

### 3. Documentation
**File:** `docs/MULTI_DAY_SHOWS_AND_MAILING_LIST.md`

**Includes:**
- Database schema details
- Homepage display logic (Option 4: "See full schedule →")
- Detail page implementation
- Admin functions for mailing list export
- Examples of single-day vs multi-day shows
- Privacy & security notes

## 🎯 Key Features

### For Organizers
- Submit shows with variable schedules per day
- Their contact info is kept private
- They get email confirmation when show is approved

### For You (Admin)
- Organizer contact info stored separately in `web_show_submissions`
- Build a mailing list of all show organizers
- Export emails for marketing campaigns
- Shows display cleanly: single-day shows time, multi-day shows "See full schedule"

### For Collectors (App Users)
- Homepage shows: "Oct 4-6, 2025 • See full schedule →"
- Detail page shows full day-by-day breakdown with different times

## 📋 Next Steps

### 1. Apply the Migration
```bash
cd card-show-finder

# Option A: Via Supabase Dashboard
# Go to SQL Editor → paste migration file → Run

# Option B: Via CLI (if you have supabase CLI installed)
supabase db push
```

### 2. Test the Web Form
- Open `website/submit-show-v2.html` in browser
- Submit a single-day show
- Submit a multi-day show (click "Add Another Day")
- Check Supabase tables:
  - `scraped_shows_pending` should have the show
  - `web_show_submissions` should have organizer info

### 3. Update App Code (React Native)
You'll need to update your mobile app to handle `daily_schedule`:

**Homepage (Show List):**
```javascript
// In your ShowCard component
const timeDisplay = () => {
  if (show.daily_schedule && show.daily_schedule.length > 1) {
    // Multi-day show
    return `${formatDateRange(show.start_date, show.end_date)} • See full schedule →`;
  } else {
    // Single-day show
    return `${formatDate(show.start_date)} • ${show.start_time || '9:00 AM'} - ${show.end_time || '5:00 PM'}`;
  }
};
```

**Detail Page:**
```javascript
// In ShowDetailScreen
{show.daily_schedule ? (
  <View>
    <Text style={styles.sectionTitle}>📅 Show Schedule</Text>
    {show.daily_schedule.map((day, index) => (
      <View key={index} style={styles.daySchedule}>
        <Text style={styles.dayDate}>
          {formatFullDate(day.date)}
        </Text>
        <Text style={styles.dayTime}>
          {formatTime(day.startTime)} - {formatTime(day.endTime)}
        </Text>
        {day.notes && (
          <Text style={styles.dayNotes}>{day.notes}</Text>
        )}
      </View>
    ))}
  </View>
) : (
  // Legacy format
  <Text>
    {formatDate(show.start_date)} • {show.start_time} - {show.end_time}
  </Text>
)}
```

### 4. Export Your Mailing List

**Via Supabase SQL Editor:**
```sql
SELECT 
  organizer_name,
  organizer_email,
  submitted_at
FROM web_show_submissions
WHERE status = 'APPROVED'
ORDER BY submitted_at DESC;
```

**Or via the Function:**
```sql
SELECT * FROM get_organizer_mailing_list('APPROVED', 10000, 0);
```

## 🔐 Privacy Notes

- ✅ Organizer names/emails are NOT visible on public shows
- ✅ Only admins can query `web_show_submissions`
- ✅ Anonymous users can only INSERT (submit forms)
- ✅ When a show is approved, contact info stays in separate table
- ✅ You have a growing mailing list of all show organizers

## 📊 Data Flow

1. **User Submits Form** →
2. **Two Tables Updated:**
   - `scraped_shows_pending` (show details with `dailySchedule` in raw_payload)
   - `web_show_submissions` (organizer name + email)
3. **You Review in Admin Panel** →
4. **Click Approve** →
5. **`approve_pending_show()` runs:**
   - Creates show in `shows` table with `daily_schedule` column populated
   - Links organizer submission to approved show
   - Updates `web_show_submissions.status = 'APPROVED'`
6. **Result:**
   - Show appears in app
   - Organizer info stays private
   - You can export mailing list anytime

## 🚀 Files Changed

```
card-show-finder/
├── supabase/migrations/
│   └── 20250203_multi_day_schedule_and_organizer_contact.sql  ← NEW MIGRATION
├── website/
│   └── submit-show-v2.html  ← UPDATED (multi-day, mailing list, features, categories)
├── docs/
│   ├── MULTI_DAY_SHOWS_AND_MAILING_LIST.md  ← NEW DOCS
│   └── SHOW_FEATURES_AND_CATEGORIES.md  ← NEW DOCS
└── IMPLEMENTATION_SUMMARY.md  ← THIS FILE
```

## ❓ Questions?

See the full documentation in `docs/MULTI_DAY_SHOWS_AND_MAILING_LIST.md`
MPLEMENTATION_SUMMARY.md  ← THIS FILE
```

## ❓ Questions?

See the full documentation in `docs/MULTI_DAY_SHOWS_AND_MAILING_LIST.md`
