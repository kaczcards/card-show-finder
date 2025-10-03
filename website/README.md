# 📅 Card Show Submission Form

A beautiful, mobile-friendly web form for show organizers to submit their upcoming card shows to your app.

## 🎯 Features

✅ **No Login Required** - Lower barrier to entry for organizers  
✅ **Mobile-Friendly** - Works perfectly on phones and tablets  
✅ **App Download Teaser** - Encourages organizers to download your app  
✅ **Required Fields Only** - Show Name, Date, Times, Location, Address  
✅ **Optional Fields** - Admission, Contact, Image, Description  
✅ **Pending Queue** - All submissions go to your review queue  
✅ **Direct to Supabase** - No backend needed, saves directly to your database  

## 📁 Files Included

- **`submit-show.html`** - The submission form (ready to use!)
- **`enable-public-submissions.sql`** - SQL to allow anonymous submissions
- **`SETUP-GUIDE.md`** - Detailed setup instructions
- **`README.md`** - This file

## 🚀 Quick Start (5 Minutes)

### 1. Run the SQL
```bash
# In your Supabase SQL Editor, run:
website/enable-public-submissions.sql
```

### 2. Update the HTML
Open `submit-show.html` and replace:
- `YOUR_SUPABASE_URL_HERE` with your Supabase URL
- `YOUR_SUPABASE_ANON_KEY_HERE` with your anon key

### 3. Add to WordPress
- Go to **Pages → Add New**
- Add a **Custom HTML** block
- Paste the entire HTML file
- Publish!

### 4. Test It
- Visit your new page
- Submit a test show
- Check `scraped_shows_pending` table in Supabase

## 📱 What It Looks Like

### Desktop View
```
┌─────────────────────────────────────────┐
│  📅 Submit Your Card Show               │
│  Share your upcoming card show with     │
│  collectors everywhere!                 │
├─────────────────────────────────────────┤
│  🎉 Want to Manage Your Shows?          │
│  Download the Card Show Finder app...   │
│  [📱 Download iOS] [🤖 Download Android]│
├─────────────────────────────────────────┤
│  Show Name: [_______________] *         │
│  Date: [_______________] *              │
│  Start: [____] End: [____] *            │
│  Location: [_______________] *          │
│  Address: [_______________] *           │
│                                         │
│  Admission: [_______________]           │
│  Contact: [_______________]             │
│  Image URL: [_______________]           │
│  Description: [____________]            │
│                                         │
│      [Submit Show for Review]           │
└─────────────────────────────────────────┘
```

### Mobile View
- Stacks vertically
- Touch-friendly buttons
- Easy to fill on phone

## 🔄 Workflow

1. **Organizer visits** your website
2. **Fills out form** with show details
3. **Clicks Submit** → Goes to `scraped_shows_pending` table
4. **You review** in Supabase or admin panel
5. **You approve** → Show appears in app!

## 🎨 Customization

### Change Colors
Search and replace `#FF6B35` with your brand color

### Add Fields
See `SETUP-GUIDE.md` for instructions

### Change Success Message
Edit line 242 in `submit-show.html`

## 📊 View Submissions

### Option 1: Supabase Dashboard
```
Supabase → Table Editor → scraped_shows_pending
Filter: status = 'PENDING'
```

### Option 2: Admin Panel (Future)
We can build a simple admin page with:
- List of pending shows
- One-click approve/reject
- Edit before publishing
- Stats and analytics

## 🛠️ Troubleshooting

**Form not submitting?**
- Check Supabase URL and key
- Verify SQL policy is enabled
- Check browser console (F12)

**Submissions not appearing?**
- Check `scraped_shows_pending` table
- Verify you have admin access
- Check status = 'PENDING'

**Form looks broken?**
- Use "Custom HTML" block in WordPress
- Don't use "Code" or "Preformatted" blocks
- Copy the ENTIRE HTML file

## 🎓 Need Help?

Check out `SETUP-GUIDE.md` for detailed instructions!

## 📈 Next Steps

1. ✅ **Set up the form** (you're doing it!)
2. **Test with real data** - Have a friend submit a show
3. **Promote the form** - Add link to social media
4. **Build admin panel** - Make approvals even easier
5. **Add email notifications** - Get notified of new shows
6. **Track analytics** - See how many submissions you get

## 💡 Ideas for Later

- **Auto-approve trusted organizers** - Skip review for regulars
- **Bulk import from spreadsheet** - Import many shows at once
- **Show preview** - Let organizers see how it'll look before submitting
- **Duplicate detection** - Warn if similar show already exists
- **Calendar integration** - Export to Google Calendar

---

**Built with ❤️ for Card Show Finder**
