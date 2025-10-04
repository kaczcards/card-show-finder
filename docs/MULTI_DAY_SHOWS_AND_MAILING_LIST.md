# Multi-Day Shows & Organizer Mailing List

## Overview
This document explains the database changes for supporting multi-day shows with variable schedules and maintaining an organizer mailing list.

## Database Changes

### 1. New Table: `web_show_submissions`
Stores organizer contact information separately from approved shows, creating a mailing list.

**Schema:**
```sql
CREATE TABLE web_show_submissions (
  id UUID PRIMARY KEY,
  organizer_name TEXT NOT NULL,
  organizer_email TEXT NOT NULL,
  pending_show_id UUID REFERENCES scraped_shows_pending(id),
  approved_show_id UUID REFERENCES shows(id),
  status TEXT DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
  submitted_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);
```

**Purpose:**
- Keeps organizer contact info private (not visible on public shows)
- Builds a mailing list of all show organizers who submit via web form
- Tracks which submissions were approved/rejected
- Links organizers to both their pending submission and approved show

### 2. New Column: `shows.daily_schedule`
Stores variable schedules for multi-day shows.

**Schema:**
```sql
ALTER TABLE shows ADD COLUMN daily_schedule JSONB;
```

**Format:**
```json
[
  {
    "date": "2025-10-04",
    "startTime": "07:00",
    "endTime": "15:00",
    "notes": ""
  },
  {
    "date": "2025-10-05",
    "startTime": "12:00",
    "endTime": "20:00",
    "notes": "VIP early access"
  },
  {
    "date": "2025-10-06",
    "startTime": "10:00",
    "endTime": "15:00",
    "notes": ""
  }
]
```

**Backwards Compatibility:**
- `start_date`, `end_date`, `start_time`, `end_time` columns remain for single-day shows
- If `daily_schedule` is NULL, fall back to legacy time fields
- If `daily_schedule` exists, use it for detailed day-by-day display

## Homepage Display Logic

### Single-Day Shows
```
Example Show A
Oct 4, 2025 • 8:00 AM - 2:00 PM
Location Name
```

### Multi-Day Shows  
```
Example Show B
Oct 4-6, 2025 • See full schedule →
Location Name
```

### Implementation
```javascript
// In show card component
if (show.daily_schedule && show.daily_schedule.length > 1) {
  // Multi-day show
  const startDate = new Date(show.start_date);
  const endDate = new Date(show.end_date);
  displayText = `${formatDateRange(startDate, endDate)} • See full schedule →`;
} else {
  // Single-day show
  displayText = `${formatDate(show.start_date)} • ${show.start_time} - ${show.end_time}`;
}
```

## Detail Page Display

Show full day-by-day breakdown:

```
📅 Show Schedule
━━━━━━━━━━━━━━━━━━
Saturday, Oct 4
7:00 AM - 3:00 PM

Sunday, Oct 5  
12:00 PM - 8:00 PM
VIP early access

Monday, Oct 6
10:00 AM - 3:00 PM
```

### Implementation
```javascript
if (show.daily_schedule) {
  show.daily_schedule.forEach(day => {
    renderDay(day.date, day.startTime, day.endTime, day.notes);
  });
} else {
  // Legacy format - single day
  renderDay(show.start_date, show.start_time, show.end_time);
}
```

## Admin Functions

### Get Organizer Mailing List
```sql
SELECT * FROM public.get_organizer_mailing_list(
  p_status => 'APPROVED',  -- NULL for all, or 'PENDING'/'APPROVED'/'REJECTED'
  p_limit => 1000,
  p_offset => 0
);
```

**Returns:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "organizer_name": "John Smith",
      "organizer_email": "john@example.com",
      "status": "APPROVED",
      "submitted_at": "2025-02-03T10:00:00Z",
      "approved_show_id": "...",
      "notes": null
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 1000,
    "offset": 0
  }
}
```

## Web Form Submission Flow

1. User fills out form with:
   - Their name and email
   - Show details
   - Daily schedule (can add multiple days)

2. JavaScript submits to two tables:
   ```javascript
   // Step 1: Insert show into scraped_shows_pending
   const pendingShow = await insertPendingShow(showData);
   
   // Step 2: Insert organizer into web_show_submissions
   await insertOrganizerInfo({
     organizer_name,
     organizer_email,
     pending_show_id: pendingShow.id
   });
   ```

3. Admin reviews submission

4. When approved, `approve_pending_show()` function:
   - Creates show in `shows` table with `daily_schedule` populated
   - Updates `web_show_submissions.approved_show_id`
   - Updates `web_show_submissions.status = 'APPROVED'`
   - Organizer info stays private in `web_show_submissions` table

## Migration File
Location: `supabase/migrations/20250203_multi_day_schedule_and_organizer_contact.sql`

To apply:
```bash
# Via Supabase CLI
supabase db push

# Or manually in Supabase SQL Editor
# Copy/paste the migration file contents
```

## Privacy & Security

✅ **Organizer info is private**
- `web_show_submissions` table has RLS enabled
- Only admins can SELECT from this table
- Anonymous users can only INSERT (for form submissions)
- Public users cannot see organizer names/emails

✅ **Show data is public**
- `shows` table does NOT contain organizer personal info
- `daily_schedule` is public (show times are meant to be seen)
- Legacy `website_url` field can be used for public contact

## Export Mailing List

### Via SQL
```sql
SELECT 
  organizer_name,
  organizer_email,
  status,
  submitted_at
FROM web_show_submissions
WHERE status = 'APPROVED'
ORDER BY submitted_at DESC;
```

### Via Function (in app)
```javascript
const { data } = await supabase
  .rpc('get_organizer_mailing_list', {
    p_status: 'APPROVED',
    p_limit: 10000,
    p_offset: 0
  });

// Export to CSV
const csv = data.data.map(row => 
  `${row.organizer_name},${row.organizer_email}`
).join('\n');
```

## Examples

### Example 1: Single-Day Show
**Web Form Input:**
- Day 1: Oct 4, 2025, 8:00 AM - 2:00 PM

**Resulting Database:**
```javascript
{
  title: "Example Show A",
  start_date: "2025-10-04T08:00:00Z",
  end_date: "2025-10-04T14:00:00Z",
  daily_schedule: [
    {
      date: "2025-10-04",
      startTime: "08:00",
      endTime: "14:00"
    }
  ]
}
```

### Example 2: Multi-Day Show
**Web Form Input:**
- Day 1: Oct 4, 2025, 7:00 AM - 3:00 PM
- Day 2: Oct 5, 2025, 12:00 PM - 8:00 PM
- Day 3: Oct 6, 2025, 10:00 AM - 3:00 PM

**Resulting Database:**
```javascript
{
  title: "Example Show B",
  start_date: "2025-10-04T07:00:00Z",
  end_date: "2025-10-06T15:00:00Z",
  daily_schedule: [
    {
      date: "2025-10-04",
      startTime: "07:00",
      endTime: "15:00"
    },
    {
      date: "2025-10-05",
      startTime: "12:00",
      endTime: "20:00"
    },
    {
      date: "2025-10-06",
      startTime: "10:00",
      endTime: "15:00"
    }
  ]
}
```

## Next Steps

1. **Apply Migration**
   ```bash
   cd card-show-finder
   supabase db push
   ```

2. **Update App Code**
   - Homepage: Check for `daily_schedule` and display "See full schedule" for multi-day
   - Detail Page: Render day-by-day breakdown from `daily_schedule`
   - Handle legacy shows where `daily_schedule` is null

3. **Test Web Form**
   - Visit `submit-show-v2.html`
   - Submit a single-day show
   - Submit a multi-day show
   - Verify both tables get populated

4. **Export Mailing List**
   - Use `get_organizer_mailing_list()` function
   - Export to CSV for email campaigns

## Questions?

- **Q: What happens to existing shows?**
  - A: They continue to work. `daily_schedule` is nullable. Fall back to `start_time`/`end_time` if null.

- **Q: Can I edit daily_schedule after approval?**
  - A: Yes, admins can update the JSONB column directly, or via a future admin function.

- **Q: How do I email all organizers?**
  - A: Export mailing list, import to Mailchimp/SendGrid/etc.

- **Q: Can organizers see each other's emails?**
  - A: No. RLS policies prevent this. Only admins can view `web_show_submissions`.
