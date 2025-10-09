# 🚀 Deployment Checklist

Use this checklist to ensure a smooth deployment to Vercel.

## Pre-Deployment

- [ ] All code is committed to git
- [ ] No uncommitted changes in `card-show-admin/`
- [ ] `.env.local` is NOT committed (check `.gitignore`)
- [ ] Dependencies are up to date (`npm install`)
- [ ] Application builds locally without errors (`npm run build`)
- [ ] All tests pass (if applicable)
- [ ] You have your Supabase anon key ready

## Deployment Steps

- [ ] Sign in to Vercel (https://vercel.com)
- [ ] Import GitHub repository
- [ ] Set root directory to `card-show-admin`
- [ ] Add environment variables:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Click "Deploy"
- [ ] Wait for build to complete (2-3 minutes)
- [ ] Deployment URL received

## Post-Deployment Testing

- [ ] Visit deployment URL
- [ ] Login page loads
- [ ] Can sign in with admin credentials
- [ ] Redirected to `/admin/dashboard` after login
- [ ] Dashboard displays pending shows
- [ ] Confidence scores visible
- [ ] Click "Review" - modal opens
- [ ] Edit a field in modal
- [ ] Click "Approve with Changes" - show updates
- [ ] Navigate to `/admin/logs`
- [ ] Job logs display correctly
- [ ] Click "Refresh" button - data reloads
- [ ] Test "Quick Reject" on a show
- [ ] Verify show is deleted

## Supabase Configuration

- [ ] Update Supabase Redirect URLs:
  - [ ] Add `https://your-app.vercel.app/admin/dashboard`
  - [ ] Add `https://your-app.vercel.app/auth/callback`
- [ ] Verify RLS policies are active
- [ ] Confirm admin user role is set correctly

## Optional Steps

- [ ] Configure custom domain (e.g., admin.cardshowfinder.com)
- [ ] Set up DNS records
- [ ] Wait for SSL certificate (automatic)
- [ ] Add team members to Vercel project
- [ ] Enable Vercel Analytics
- [ ] Set up deployment notifications (Slack/Email)

## Documentation

- [ ] Share deployment URL with team
- [ ] Update README with production URL
- [ ] Document any custom configurations
- [ ] Add production credentials to password manager

## Monitoring Setup

- [ ] Bookmark Vercel dashboard
- [ ] Bookmark Supabase dashboard
- [ ] Set up error monitoring
- [ ] Schedule weekly health checks

## Security Review

- [ ] Environment variables are secure
- [ ] No secrets in code
- [ ] HTTPS is enforced
- [ ] Admin role verification working
- [ ] RLS policies tested
- [ ] Unauthorized access blocked

## Final Verification

- [ ] Production URL accessible
- [ ] All features working as expected
- [ ] No console errors in browser
- [ ] Mobile responsive (test on phone)
- [ ] Performance is acceptable
- [ ] No broken links

---

## Quick Access Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com/project/zmfqzegykwyrrvrpwylf
- **Supabase API Settings**: https://app.supabase.com/project/zmfqzegykwyrrvrpwylf/settings/api
- **Deployment Guide**: See `DEPLOYMENT_GUIDE.md`

---

## If Something Goes Wrong

1. Check Vercel build logs
2. Check browser console for errors
3. Verify environment variables in Vercel
4. Check Supabase logs
5. Review `DEPLOYMENT_GUIDE.md` troubleshooting section
6. Rollback to previous deployment if needed

---

**Ready to deploy?** Follow the detailed steps in `DEPLOYMENT_GUIDE.md`

✅ = Completed  
⏸️ = In Progress  
❌ = Failed / Needs Attention
