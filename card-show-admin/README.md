# Card Show Admin Dashboard

Next.js admin dashboard for managing scraped card shows.

## Phase 1: Project Setup and Foundation ✅

This phase establishes the foundation for the admin dashboard with authentication and basic routing.

### Features Implemented

- ✅ Next.js 14 with App Router
- ✅ TypeScript configuration
- ✅ Tailwind CSS styling
- ✅ Supabase authentication
- ✅ Protected admin routes
- ✅ Login page
- ✅ Dashboard page (approval queue)
- ✅ Logs page (scraper job history)
- ✅ Responsive navigation

### Getting Started

1. **Install Dependencies**
   ```bash
   cd card-show-admin
   npm install
   ```

2. **Configure Environment Variables**
   
   Update `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://zmfqzegykwyrrvrpwylf.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

   Find these values in your Supabase project settings under **API**.

3. **Run Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Login**
   
   Use your admin credentials to access the dashboard.

### Project Structure

```
card-show-admin/
├── app/
│   ├── admin/
│   │   ├── dashboard/
│   │   │   └── page.tsx       # Approval queue
│   │   ├── logs/
│   │   │   └── page.tsx       # Scraper job logs
│   │   └── layout.tsx         # Protected admin layout
│   ├── login/
│   │   └── page.tsx           # Login page
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Root redirect
├── components/
│   └── AdminNav.tsx           # Navigation component
├── lib/
│   └── supabase.ts            # Supabase client setup
├── types/
│   └── supabase.ts            # Database type definitions
├── .env.local                 # Environment variables
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

### Authentication Flow

1. User visits `/admin/*` route
2. Admin layout checks for authentication
3. If not authenticated → redirect to `/login`
4. After login → verify admin role
5. If admin → access granted
6. If not admin → sign out and redirect to login

### Pages

#### Dashboard (`/admin/dashboard`)
- Shows pending approval queue
- Displays confidence scores
- Shows organizer information
- Statistics cards (total, low confidence, high confidence)

#### Job Logs (`/admin/logs`)
- Lists scraper job executions
- Shows success/failure status
- Displays performance metrics
- Sortable table with filters

#### Login (`/login`)
- Email/password authentication
- Admin role verification
- Error handling
- Responsive design

## 📚 Documentation

- **[Usage Guide](./USAGE_GUIDE.md)** - How to use the admin dashboard
- **[Phase 3 Complete](./PHASE_3_COMPLETE.md)** - Technical implementation details

### Phase 3: Core Functionality ✅

- **Approval Queue** - Review and approve/reject shows with inline editing
- **Review Modal** - Full-featured editing form with validation
- **API Endpoints** - `/api/shows/approve` and `/api/shows/reject`
- **Job Logs** - Enhanced logs viewer with refresh button
- **Learning Loop Integration** - Admin corrections feed the AI learning system

### Next Steps (Phase 4+)

- Add bulk approval/rejection
- Implement advanced filtering and search
- Create real-time updates with WebSockets
- Add notification center
- Manual scraper triggers from UI

### Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Authentication:** Supabase Auth
- **Database:** Supabase PostgreSQL

## 🚀 Deployment

The dashboard is ready for production deployment to Vercel!

### Quick Deploy:
1. Visit https://vercel.com and sign in with GitHub
2. Import repository: `kaczcards/card-show-finder`
3. Set root directory: `card-show-admin`
4. Add environment variables (see below)
5. Click "Deploy"

### Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://zmfqzegykwyrrvrpwylf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[Get from Supabase → Settings → API]
```

### Complete Instructions:
See **[READY_TO_DEPLOY.md](./READY_TO_DEPLOY.md)** for full deployment guide.

---

## 📦 Build Status

✅ **Production build passing**
- Dashboard: 3.65 kB
- Logs: 1.06 kB  
- Login: 1.84 kB
- All routes optimized

---

### Support

For issues or questions, contact: csfusers@csfinderapp.com

---

© 2025 TriForce Studios, LLC
