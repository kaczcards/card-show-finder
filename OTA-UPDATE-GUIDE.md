# 🚀 OTA Update Guide (Using EAS Update)

## ⚠️ Important: Expo Publish is Deprecated

**OLD (Deprecated):**
```bash
npx expo publish --release-channel production  # ❌ No longer works
```

**NEW (Use this instead):**
```bash
eas update --branch production --message "Your update message"
```

---

## 📦 How EAS Update Works

### What Gets Updated via OTA:
- ✅ JavaScript code changes
- ✅ React components
- ✅ App logic and business rules
- ✅ Styles and UI updates
- ✅ Asset files (images, fonts)

### What DOESN'T Get Updated via OTA:
- ❌ Native code changes
- ❌ New native modules/dependencies
- ❌ `app.json` changes (app name, icon, permissions)
- ❌ Expo SDK version upgrades

**For those, you need a full build:** `eas build --platform all`

---

## 🎯 Publishing an OTA Update

### Basic Command:
```bash
cd /Users/kevin/card-show-finder

# Publish to production branch
eas update --branch production --message "Fix authentication issues"
```

### With Specific Options:
```bash
# Publish to specific branch
eas update --branch production

# Publish with custom message
eas update --branch production --message "Fix email verification URLs"

# Publish to multiple branches (if you have staging/dev)
eas update --branch staging --message "Testing new features"
```

---

## 🌳 Understanding Branches

EAS Update uses **branches** instead of release channels:

| Old (Expo Publish) | New (EAS Update) |
|-------------------|------------------|
| `--release-channel production` | `--branch production` |
| `--release-channel staging` | `--branch staging` |
| `--release-channel dev` | `--branch development` |

Your production app should be configured to use the `production` branch.

---

## ⏱️ Update Timeline

### When Users Get Updates:

1. **You publish update** → Uploaded to EAS servers (takes 1-2 minutes)
2. **User opens app** → App checks for updates in background
3. **App downloads update** → Usually takes 5-30 seconds
4. **Next app restart** → Update is applied

### User Experience:
- **First open after publish:** App downloads update in background (still using old version)
- **Second open:** New version is active!
- **Or:** App can force restart to apply immediately (if configured)

---

## 🔍 Verify Your Update

### Check Update Status:

1. **EAS Dashboard:**
   - Go to: https://expo.dev
   - Navigate to your project
   - Click "Updates" tab
   - See publish history and download stats

2. **Command Line:**
   ```bash
   # View recent updates
   eas update:list --branch production
   
   # View specific update details
   eas update:view [update-id]
   ```

3. **In Your App:**
   - Open production app on device
   - Check for updates in app (should auto-detect)
   - Restart app to apply

---

## 🧪 Testing OTA Updates

### Test on Your Device:

1. **Install production build** (from App Store or TestFlight)
2. **Open the app** (using old version)
3. **Publish OTA update:** `eas update --branch production`
4. **Close app completely**
5. **Reopen app** (downloads update in background)
6. **Close and reopen again** (update applied!)
7. **Test your new features**

### Check Update Applied:
- Add a version indicator in your app
- Check Expo DevTools
- Log to console: `Updates.checkForUpdateAsync()`

---

## 🔄 Rollback an Update

If something goes wrong:

### Option 1: Publish Previous Version
```bash
# Republish from a previous commit
git checkout <previous-commit-hash>
eas update --branch production --message "Rollback to previous version"
git checkout main
```

### Option 2: Republish Current Code
```bash
# Fix the bug first
git revert HEAD  # or fix manually
git commit -m "fix: resolve issue"
git push

# Then publish
eas update --branch production --message "Fix critical bug"
```

### Option 3: Use EAS Dashboard
- Go to EAS dashboard
- Find a previous working update
- Click "Republish" to make it current

---

## 📊 Current Update Status

### What Was Just Published:

**Changes:**
- ✅ Fixed email verification URL: `csfinderapp.com/verify`
- ✅ Fixed password reset URL: `csfinderapp.com/reset-password`
- ✅ Removed duplicate profile creation
- ✅ Fixed infinite recursion in RLS policies
- ✅ Added email verification enforcement

**Branch:** `production`

**Message:** "Fix email verification and password reset URLs"

**Affected Files:**
- `src/services/supabaseAuthService.ts`
- `src/contexts/AuthContext.tsx`
- `src/components/EmailVerificationGuard.tsx`
- `App.tsx`

---

## 🎛️ EAS Update Configuration

### Check Your `eas.json`:

Your project should have EAS Update configured. Check:

```bash
cat eas.json
```

Should include something like:
```json
{
  "build": {
    "production": {
      "channel": "production"
    }
  },
  "update": {
    "production": {
      "channel": "production"
    }
  }
}
```

---

## 🚨 Common Issues

### Issue: "Not logged in to EAS"
**Solution:**
```bash
eas login
```

### Issue: "No project found"
**Solution:**
```bash
eas init
```

### Issue: "Build not configured for updates"
**Solution:**
Your app build needs to be configured to check for updates. Rebuild with:
```bash
eas build --platform all --profile production
```

### Issue: Updates not downloading
**Possible causes:**
- App not configured with correct update URL
- Network issues
- App build predates EAS Update setup
- Wrong branch name

---

## 📚 Quick Reference

### Most Common Commands:

```bash
# Publish OTA update
eas update --branch production --message "Your message"

# List recent updates
eas update:list --branch production

# View update details
eas update:view [update-id]

# Configure updates
eas update:configure

# Login to EAS
eas login

# Check EAS account
eas whoami
```

---

## ✅ Best Practices

1. **Always test locally first** before publishing
2. **Use descriptive messages** for each update
3. **Monitor after publishing** to catch issues early
4. **Keep a rollback plan** ready
5. **Don't update native code** via OTA (won't work)
6. **Use staging branch** for testing before production
7. **Document what changed** in each update

---

## 🎉 Your Update is Live!

The update you just published will roll out to users automatically:

1. ✅ **Code pushed to GitHub**
2. ✅ **OTA update published to EAS**
3. ⏳ **Users will receive update** when they next open the app
4. 📊 **Monitor in EAS dashboard** for download stats

---

**Need help?** Check:
- EAS Update docs: https://docs.expo.dev/eas-update/introduction/
- EAS Dashboard: https://expo.dev
- Your project updates: https://expo.dev/accounts/[your-account]/projects/card-show-finder/updates

---

**Last updated:** October 2, 2025
