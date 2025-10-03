# 🎉 Multi-Day Show Support - Setup Guide

This guide will help you set up the new multi-day show feature with organizer contact fields.

## ✨ What's New

### 1. **Organizer Contact Information**
- Organizer Name (required)
- Organizer Email (required)
- Allows you to follow up with show organizers

### 2. **Multi-Day Show Support**
- Add multiple days with different hours for each day
- "Add Another Day" button for flexible scheduling
- Perfect for weekend shows or multi-day events

### 3. **Enhanced Data Structure**
Shows can now have:
- **Single Day**: Oct 4, 2025 • 8am - 2pm
- **Multi-Day with Same Hours**: Oct 4-6, 2025 • 9am - 5pm each day
- **Multi-Day with Different Hours**: 
  - Day 1: Oct 4 • 8am - 4pm
  - Day 2: Oct 5 • 12pm - 8pm
  - Day 3: Oct 6 • 9am - 3pm

---

## 📋 Setup Steps

### Step 1: Run Database Migration

Go to **Supabase → SQL Editor** and run:

**File:** `website/migration-multiday-shows.sql`

```sql
-- Add organizer fields to shows table
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS organizer_name TEXT,
ADD COLUMN IF NOT EXISTS organizer_email TEXT,
ADD COLUMN IF NOT EXISTS daily_schedule JSONB;

-- Add organizer fields to scraped_shows_pending table
ALTER TABLE public.scraped_shows_pending
ADD COLUMN IF NOT EXISTS organizer_name TEXT,
ADD COLUMN IF NOT EXISTS organizer_email TEXT;

-- Create an index on daily_schedule for faster queries
CREATE INDEX IF NOT EXISTS idx_shows_daily_schedule ON public.shows USING GIN (daily_schedule);
```

### Step 2: Update the Approve Function

Run this to update the function to handle the new fields:

**File:** `website/approve-function-multiday.sql`

```sql
-- This updates the approve_pending_show function
-- to include organizer info and daily_schedule
```

Copy and run the entire file from `approve-function-multiday.sql`.

### Step 3: Replace Submit Form

**Option A: Use the New Form**
1. Replace `submit-show.html` with `submit-show-v2.html`
2. Update your WordPress page with the new HTML

**Option B: Keep Both**
- Keep old form for backwards compatibility
- Add new form on a different page (e.g., `/submit-show-v2`)

### Step 4: Update Admin Panel

The admin panel (`admin-approve.html`) has been automatically updated to show:
- Organizer name and email
- Daily schedule breakdown (if multi-day)
- Better formatting for multi-day events

Just refresh the page - no changes needed!

---

## 🎯 How It Works

### Submission Form Flow

1. **User fills in their info:**
   - Name: "John Smith"
   - Email: "john@cardshow.com"

2. **User adds show details:**
   - Show Name: "Summer Card Show"
   - Venue: "Convention Center"
   - Address: "123 Main St"

3. **User adds schedule:**
   - **Day 1**: Oct 4, 2025 • 8am - 4pm
   - Clicks "Add Another Day"
   - **Day 2**: Oct 5, 2025 • 10am - 6pm
   - Clicks "Add Another Day"
   - **Day 3**: Oct 6, 2025 • 9am - 3pm

4. **Data saved as:**
```json
{
  "name": "Summer Card Show",
  "venueName": "Convention Center",
  "address": "123 Main St",
  "organizerName": "John Smith",
  "organizerEmail": "john@cardshow.com",
  "dailySchedule": [
    {"date": "2025-10-04", "startTime": "08:00", "endTime": "16:00"},
    {"date": "2025-10-05", "startTime": "10:00", "endTime": "18:00"},
    {"date": "2025-10-06", "startTime": "09:00", "endTime": "15:00"}
  ],
  "startDate": "2025-10-04T08:00:00",
  "endDate": "2025-10-06T15:00:00"
}
```

### Admin Panel Display

```
┌─────────────────────────────────────────────┐
│ 🎪 Summer Card Show                         │
│ 📅 Sat, Oct 4, 2025 - Mon, Oct 6, 2025     │
├─────────────────────────────────────────────┤
│ 📅 Daily Schedule:                          │
│   Day 1: Sat, Oct 4, 2025 • 08:00 - 16:00 │
│   Day 2: Sun, Oct 5, 2025 • 10:00 - 18:00 │
│   Day 3: Mon, Oct 6, 2025 • 09:00 - 15:00 │
├─────────────────────────────────────────────┤
│ 👤 Organizer: John Smith                   │
│ 📧 Email: john@cardshow.com                │
│ 📍 Venue: Convention Center                 │
│ 📮 Address: 123 Main St                     │
└─────────────────────────────────────────────┘
```

### App Display (Recommended Implementation)

**For your mobile app**, update the show detail view to display:

```tsx
{show.daily_schedule ? (
  // Multi-day show with different hours
  <View>
    <Text>📅 Show Schedule:</Text>
    {show.daily_schedule.map((day, index) => (
      <View key={index}>
        <Text>Day {index + 1}: {formatDate(day.date)}</Text>
        <Text>{day.startTime} - {day.endTime}</Text>
      </View>
    ))}
  </View>
) : (
  // Simple single-day or uniform multi-day
  <View>
    <Text>📅 {formatDateRange(show.start_date, show.end_date)}</Text>
    <Text>🕐 {formatTime(show.start_date)} - {formatTime(show.end_date)}</Text>
  </View>
)}
```

---

## 🗂️ Database Schema

### `shows` Table (New Columns)

| Column | Type | Description |
|--------|------|-------------|
| `organizer_name` | TEXT | Name of show organizer |
| `organizer_email` | TEXT | Email for follow-up |
| `daily_schedule` | JSONB | Array of daily schedules |

### `scraped_shows_pending` Table (New Columns)

| Column | Type | Description |
|--------|------|-------------|
| `organizer_name` | TEXT | Name of submitter |
| `organizer_email` | TEXT | Email for updates |

### `daily_schedule` JSON Format

```json
[
  {
    "date": "2025-10-04",
    "startTime": "08:00",
    "endTime": "16:00"
  },
  {
    "date": "2025-10-05",
    "startTime": "12:00",
    "endTime": "20:00"
  }
]
```

---

## 🔄 Backwards Compatibility

### Old Shows (No daily_schedule)
- Will continue to work normally
- Display using `start_date` and `end_date`
- No migration needed for existing shows

### New Shows
- Can have `daily_schedule` for detailed per-day hours
- `start_date` and `end_date` still stored for range queries
- App can check: if `daily_schedule` exists, use it; otherwise use date range

---

## 🧪 Testing Checklist

### Test Submission Form
- [ ] Submit a single-day show
- [ ] Submit a 2-day show with same hours
- [ ] Submit a 3-day show with different hours each day
- [ ] Submit with all optional fields
- [ ] Submit with only required fields
- [ ] Test "Remove Day" button
- [ ] Verify organizer name/email are required

### Test Admin Panel
- [ ] View pending shows
- [ ] See organizer info displayed
- [ ] See daily schedule formatted correctly
- [ ] Approve a multi-day show
- [ ] Check `shows` table has correct data
- [ ] Verify `daily_schedule` JSONB is populated

### Test in Mobile App
- [ ] Old shows still display correctly
- [ ] New single-day shows display
- [ ] New multi-day shows display schedule
- [ ] Organizer contact info accessible (if needed)

---

## 📱 Mobile App Updates Needed

You'll need to update your React Native app to display the new fields:

### 1. Update TypeScript Types

```typescript
interface DaySchedule {
  date: string;  // "2025-10-04"
  startTime: string;  // "08:00"
  endTime: string;  // "16:00"
}

interface Show {
  id: string;
  title: string;
  location: string;
  address: string;
  start_date: string;
  end_date: string;
  daily_schedule?: DaySchedule[];  // New!
  organizer_name?: string;  // New!
  organizer_email?: string;  // New!
  // ... other fields
}
```

### 2. Update Show Detail Component

```tsx
// In your ShowDetailScreen.tsx or similar
const ShowSchedule = ({ show }) => {
  if (show.daily_schedule && show.daily_schedule.length > 0) {
    return (
      <View>
        <Text style={styles.sectionTitle}>📅 Show Schedule</Text>
        {show.daily_schedule.map((day, index) => (
          <View key={index} style={styles.dayRow}>
            <Text style={styles.dayLabel}>Day {index + 1}</Text>
            <Text>{formatDate(day.date)}</Text>
            <Text>{day.startTime} - {day.endTime}</Text>
          </View>
        ))}
      </View>
    );
  }
  
  // Fallback to simple date range
  return (
    <View>
      <Text>{formatDateRange(show.start_date, show.end_date)}</Text>
    </View>
  );
};
```

### 3. Update List View (Optional)

In the show list, you might want to indicate multi-day shows:

```tsx
{show.daily_schedule && show.daily_schedule.length > 1 && (
  <Badge>{show.daily_schedule.length} Days</Badge>
)}
```

---

## 🎨 UI/UX Recommendations

### For the App

1. **Show List View:**
   - Show overall date range (Oct 4-6)
   - Add badge: "3-Day Event"

2. **Show Detail View:**
   - Expandable "View Schedule" section
   - Each day as a card or row
   - Clear day numbering

3. **Contact Organizer (Optional):**
   - Add "Contact Organizer" button
   - Opens email with pre-filled subject
   - Only if organizer provided public contact

### For the Admin Panel

Already implemented! Shows:
- Clear day-by-day breakdown
- Organizer contact for follow-up
- All in one clean interface

---

## 🚀 What's Next?

### Future Enhancements

1. **Email Notifications:**
   - Auto-email organizer when show is approved
   - Send reminder day before show
   - Weekly digest of upcoming shows

2. **Organizer Dashboard:**
   - Let organizers track their submissions
   - Edit approved shows
   - View attendance stats

3. **Recurring Shows:**
   - "Repeat weekly" option
   - "Same show next month" quick copy

4. **Advanced Scheduling:**
   - Different vendor hours vs public hours
   - Early bird / VIP access times
   - Setup / teardown times

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| `migration-multiday-shows.sql` | Database schema updates |
| `submit-show-v2.html` | New submission form |
| `approve-function-multiday.sql` | Updated approve function |
| `admin-approve.html` | Updated (already done) |
| `MULTIDAY-SETUP-GUIDE.md` | This guide |

---

## 🆘 Troubleshooting

**"Column does not exist" error:**
- Make sure you ran the migration SQL
- Check both `shows` and `scraped_shows_pending` tables

**Daily schedule not showing in admin panel:**
- Check browser console (F12)
- Verify `raw_payload` contains `dailySchedule` array
- Make sure it's an array, not a string

**Approve function fails:**
- Run the updated `approve-function-multiday.sql`
- Check that function has `v_daily_schedule` variable
- Verify GRANT EXECUTE permissions

**Old form still appears:**
- Clear browser cache
- Make sure you uploaded `submit-show-v2.html`
- Check WordPress page is using new HTML

---

**Need help? Let me know!** 🚀
