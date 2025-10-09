# Admin Dashboard Usage Guide

## Getting Started

### First Time Setup

1. **Get your Supabase Anon Key**
   - Go to your Supabase project: https://app.supabase.com/project/zmfqzegykwyrrvrpwylf
   - Navigate to Settings → API
   - Copy the `anon` `public` key
   - Add it to `card-show-admin/.env.local`:
     ```
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
     ```

2. **Install & Run**
   ```bash
   cd card-show-admin
   npm install
   npm run dev
   ```

3. **Access the Dashboard**
   - Open http://localhost:3000/login
   - Sign in with your admin account
   - You'll be automatically redirected to the dashboard

---

## Dashboard Pages

### 📊 Approval Queue (`/admin/dashboard`)

**Purpose**: Review and approve shows scraped by the automated system.

#### What You'll See:
- **Stats Cards**: Quick overview of pending shows
  - Total pending shows
  - Low confidence shows (<70%)
  - High confidence shows (≥80%)

- **Show List**: All pending shows, sorted by confidence score
  - Show title
  - Location
  - Start date
  - Organizer email (if available)
  - Confidence score badge (color-coded)
  - Review button
  - Quick Reject button

#### How to Review a Show:

1. **Click "Review"** on any show
2. **Modal Opens** with all show details
3. **Edit any field** that needs correction:
   - Title
   - Location
   - Venue name
   - Address, city, state, ZIP
   - Start and end dates
   - Description
   - Organizer name, email, phone
   - Website URL
4. **Choose an action**:
   - **Approve with Changes**: Saves your edits and activates the show
   - **Reject & Delete**: Permanently removes the show
   - **Cancel**: Closes modal without changes

#### Quick Actions:

- **Quick Reject**: Click the "Quick Reject" button to delete a show without opening the modal
- Confirmation prompt appears before deletion
- List refreshes automatically after any action

---

### 📋 Job Logs (`/admin/logs`)

**Purpose**: Monitor scraper job execution and performance.

#### What You'll See:
- **Summary Stats**:
  - Total jobs in view
  - Successful jobs (green)
  - Failed jobs (red)
  - Total shows inserted across all jobs

- **Jobs Table**:
  - Job Name (e.g., "scrape-card-shows")
  - Status (color-coded badge)
  - Start Time
  - Duration in seconds
  - Shows Inserted / Shows Scraped
  - Success Rate %

#### Status Colors:
- 🟢 **Green (SUCCESS)**: Job completed successfully
- 🔴 **Red (FAILED)**: Job encountered errors
- 🔵 **Blue (RUNNING)**: Job is currently executing
- 🟡 **Yellow**: Other status

#### Actions:
- **Refresh Button**: Click to reload the latest job data
- Shows the 20 most recent jobs

---

## Tips & Best Practices

### Reviewing Shows Efficiently

1. **Start with High Confidence**
   - Shows are sorted by confidence score
   - High-confidence shows (80%+) usually need minimal edits
   - Review them first for quick wins

2. **What to Check**:
   - ✅ Title is clear and descriptive
   - ✅ Location is accurate (city, state)
   - ✅ Dates are correct
   - ✅ Organizer info is present and valid
   - ✅ No duplicate shows

3. **Common Corrections**:
   - Fixing typos in scraped text
   - Standardizing location formats
   - Adding missing venue names
   - Correcting date formats
   - Validating organizer contact info

### Learning Loop Integration

**Every correction you make teaches the system!**

When you approve a show with changes:
1. Your corrections are logged to the `scraper_feedback` table
2. The AI learning system analyzes patterns in your corrections
3. Rules are automatically generated to fix similar issues in future scrapes
4. Over time, the system gets smarter and requires fewer manual corrections

### Monitoring Job Health

**Check the logs page regularly to:**
- Ensure scraper jobs are running successfully
- Identify failing scrapers that need attention
- Monitor the volume of shows being processed
- Track improvement in success rates over time

**Red Flags to Watch For:**
- ❌ Multiple consecutive FAILED jobs
- ❌ Success rate dropping below 80%
- ❌ No shows being inserted despite scraping
- ❌ Very long duration times (possible timeout issues)

---

## Troubleshooting

### Can't Log In?
- Verify you have an admin role in the `user_profiles` table
- Check that your email and password are correct
- Ensure your Supabase project is running

### Shows Not Appearing?
- Check that shows exist with `status = 'PENDING'`
- Verify shows have `scraped_organizer_name` (not null)
- Check the console for any error messages

### Review Modal Not Working?
- Check browser console for errors
- Ensure all environment variables are set correctly
- Try refreshing the page

### Logs Not Loading?
- Verify the `v_scraper_activity` view exists in your database
- Check that scraper jobs have been run
- Look for errors in the browser console

---

## Keyboard Shortcuts

*Future enhancement - not yet implemented*

---

## Need Help?

- Check the `PHASE_3_COMPLETE.md` for technical details
- Review the backend documentation in `docs/`
- Inspect the browser console for error messages
- Check the Supabase logs for backend issues

---

## What's Next?

Future enhancements being considered:
- Bulk approve/reject multiple shows at once
- Advanced filtering (by confidence, location, date)
- Search functionality
- Real-time updates when new shows arrive
- Export logs to CSV
- Notification center
- Manual scraper triggers from the UI
- Learning loop dashboard to view AI rules

---

**Happy curating! 🎉**
