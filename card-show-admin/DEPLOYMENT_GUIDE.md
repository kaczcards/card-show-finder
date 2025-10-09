# 🚀 Deployment Guide - Card Show Admin Dashboard

## Overview

This guide walks you through deploying your admin dashboard to Vercel. The entire process takes about 5-10 minutes.

---

## Prerequisites

Before you begin, ensure you have:

- ✅ A GitHub account
- ✅ Your Supabase project URL and anon key
- ✅ Admin access to the card-show-finder repository
- ✅ The admin dashboard is committed to your repository

---

## Step 1: Prepare Your Repository

### 1.1 Ensure Latest Code is Committed

```bash
cd card-show-finder/card-show-admin
git status
# If there are uncommitted changes, commit them:
git add .
git commit -m "Prepare admin dashboard for deployment"
git push origin main
```

### 1.2 Verify .gitignore

Make sure `.env.local` is in your `.gitignore` (it already is). This prevents sensitive keys from being committed.

✅ Your `.gitignore` already includes:
- `.env*.local`
- `.env`
- `.vercel`

---

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel**
   - Visit: https://vercel.com
   - Sign in with your GitHub account

2. **Import Project**
   - Click "Add New..." → "Project"
   - Select your GitHub organization/account
   - Find and import: `kaczcards/card-show-finder`

3. **Configure Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `card-show-admin`
     - Click "Edit" next to Root Directory
     - Enter: `card-show-admin`
     - Click "Continue"
   
4. **Environment Variables**
   - Click "Add Environment Variable"
   - Add the following variables:
   
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://zmfqzegykwyrrvrpwylf.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `[Your Supabase Anon Key]` |

   **To get your anon key:**
   - Go to: https://app.supabase.com/project/zmfqzegykwyrrvrpwylf/settings/api
   - Copy the `anon` `public` key
   - Paste it in Vercel

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for the build to complete
   - You'll see a success screen with your deployment URL

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm install -g vercel

# Navigate to the admin dashboard directory
cd card-show-finder/card-show-admin

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? [Select your account]
# - Link to existing project? No
# - Project name? card-show-admin
# - Directory? ./ (current directory)
# - Override settings? No

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Enter: https://zmfqzegykwyrrvrpwylf.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Enter: [Your Supabase Anon Key]

# Deploy to production
vercel --prod
```

---

## Step 3: Verify Deployment

### 3.1 Check Build Status

- In Vercel dashboard, go to your project
- Click on the latest deployment
- Verify the build completed successfully
- Look for: "✅ Build Completed"

### 3.2 Test Your Deployment

1. **Open Your Dashboard**
   - Click "Visit" in Vercel or open your deployment URL
   - Example: `https://card-show-admin.vercel.app`

2. **Test Login**
   - Navigate to `/login`
   - Sign in with your admin credentials
   - You should be redirected to `/admin/dashboard`

3. **Test Dashboard Functions**
   - ✅ Pending shows load correctly
   - ✅ Confidence scores display
   - ✅ Review modal opens
   - ✅ Approve/reject actions work
   - ✅ Logs page loads
   - ✅ Refresh button functions

---

## Step 4: Configure Custom Domain (Optional)

If you want a custom domain like `admin.cardshowfinder.com`:

1. **In Vercel Dashboard**
   - Go to your project
   - Click "Settings" → "Domains"
   - Click "Add Domain"

2. **Add Domain**
   - Enter: `admin.cardshowfinder.com`
   - Click "Add"

3. **Configure DNS**
   - Vercel will provide DNS records
   - Add these records to your domain provider:
     - Type: `CNAME`
     - Name: `admin`
     - Value: `cname.vercel-dns.com`

4. **Wait for Verification**
   - Usually takes 5-10 minutes
   - Vercel will automatically issue an SSL certificate

---

## Step 5: Set Up Automatic Deployments

Vercel automatically deploys when you push to your repository:

### Production Deployments
- Push to `main` branch → deploys to production
- URL: Your primary domain

### Preview Deployments
- Push to other branches → creates preview URL
- Great for testing before merging

### Configuration
- In Vercel: Settings → Git
- You can configure:
  - Which branches trigger production
  - Build command (default: `npm run build`)
  - Output directory (default: `.next`)
  - Install command (default: `npm install`)

---

## Troubleshooting

### Build Fails with "Module not found"

**Solution**: Ensure all dependencies are in `package.json`
```bash
cd card-show-admin
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Environment Variables Not Working

**Solution**: 
1. Go to Vercel → Your Project → Settings → Environment Variables
2. Make sure variables are set for "Production"
3. Redeploy: Deployments → [...] → Redeploy

### 404 Errors on Routes

**Solution**: This is a Next.js App Router project. Verify:
- `next.config.js` exists
- Routes are in the `app/` directory
- Redeploy the project

### Login Redirects to Wrong URL

**Solution**: Check Supabase Auth settings
1. Go to: https://app.supabase.com/project/zmfqzegykwyrrvrpwylf/auth/url-configuration
2. Add your Vercel URL to "Redirect URLs":
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/admin/dashboard`

### Admin Access Denied

**Solution**: Verify admin role
```sql
-- Run in Supabase SQL Editor
SELECT email, role FROM user_profiles 
WHERE user_id = 'your-user-id';

-- If not admin, update:
UPDATE user_profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

---

## Post-Deployment Checklist

- [ ] Deployment successful (no build errors)
- [ ] Dashboard URL accessible
- [ ] Login page loads
- [ ] Can sign in with admin credentials
- [ ] Dashboard shows pending shows
- [ ] Review modal works
- [ ] Approve action works
- [ ] Reject action works
- [ ] Logs page displays jobs
- [ ] Refresh button works
- [ ] All environment variables set
- [ ] (Optional) Custom domain configured
- [ ] (Optional) Team members added to Vercel project

---

## Environment Variables Reference

| Variable | Value | Where to Find |
|----------|-------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zmfqzegykwyrrvrpwylf.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API → `anon` `public` |

**Note**: The `NEXT_PUBLIC_` prefix is required for client-side environment variables in Next.js.

---

## Security Best Practices

1. **Never commit `.env.local`** - Already in `.gitignore` ✅
2. **Use Supabase RLS** - Already configured ✅
3. **Verify admin role** - Already implemented ✅
4. **Use HTTPS only** - Vercel provides automatically ✅
5. **Rotate keys periodically** - Set a reminder for every 90 days

---

## Monitoring & Maintenance

### Check Deployment Health

1. **Vercel Analytics** (Free)
   - Go to your project → Analytics
   - Monitor page views, load times, errors

2. **Vercel Logs**
   - Go to your project → Logs
   - View real-time logs for debugging

3. **Supabase Logs**
   - Go to: https://app.supabase.com/project/zmfqzegykwyrrvrpwylf/logs
   - Monitor API requests, auth events, errors

### Regular Maintenance

- **Weekly**: Check Vercel logs for errors
- **Monthly**: Review Supabase usage metrics
- **Quarterly**: Update dependencies
  ```bash
  npm outdated
  npm update
  ```

---

## Rollback (If Needed)

If a deployment causes issues:

1. Go to Vercel → Your Project → Deployments
2. Find the last working deployment
3. Click [...] → "Promote to Production"
4. The previous version will be live immediately

---

## Next Steps After Deployment

1. **Share the URL** with your team
2. **Add team members** in Vercel (Settings → Team)
3. **Set up monitoring** (Vercel Analytics)
4. **Create admin accounts** in Supabase
5. **Test the approval workflow** end-to-end
6. **Monitor scraper jobs** in the logs page

---

## Support

**Vercel Support**
- Documentation: https://vercel.com/docs
- Support: https://vercel.com/support

**Supabase Support**
- Documentation: https://supabase.com/docs
- Support: https://supabase.com/support

**Project Issues**
- Contact: csfusers@csfinderapp.com

---

## 🎉 Congratulations!

Your admin dashboard is now live and ready to use. You can start reviewing and approving shows right away!

**Your Dashboard URL**: `https://[your-project].vercel.app`

---

**Deployment completed by**: Droid (Factory AI)  
**Date**: October 9, 2025
