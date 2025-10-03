# 🔑 GitHub Authentication Setup

GitHub no longer accepts passwords for git operations. You need to use one of these methods:

---

## ⚡ Quick Fix: Personal Access Token (PAT)

This is the fastest way to get pushing immediately.

### Step 1: Create a Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `card-show-finder-deployment`
4. Set expiration: `90 days` (or longer)
5. Select scopes:
   - ✅ **repo** (all repo permissions)
   - ✅ **workflow** (if you use GitHub Actions)
6. Click **"Generate token"** at the bottom
7. **COPY THE TOKEN** - you won't see it again!

### Step 2: Use the Token for Git Push

When git asks for credentials:
- **Username:** Your GitHub username
- **Password:** Paste the token (not your GitHub password!)

Or set it up permanently:

```bash
# Store credentials in macOS Keychain (recommended for Mac)
git config --global credential.helper osxkeychain

# Then do the push - it will save your token after first use
git push origin main
```

---

## 🔐 Better Solution: SSH Keys (Recommended)

SSH keys are more secure and don't expire.

### Check if you already have SSH keys:

```bash
ls -la ~/.ssh
```

Look for files like `id_rsa.pub` or `id_ed25519.pub`. If you see them, you might already have keys!

### Create new SSH key (if needed):

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Press Enter to accept default location
# Press Enter twice for no passphrase (or add one for extra security)

# Start SSH agent
eval "$(ssh-agent -s)"

# Add key to SSH agent
ssh-add ~/.ssh/id_ed25519

# Copy public key to clipboard
pbcopy < ~/.ssh/id_ed25519.pub
```

### Add SSH key to GitHub:

1. Go to: https://github.com/settings/keys
2. Click **"New SSH key"**
3. Title: `MacBook - Card Show Finder`
4. Key type: `Authentication Key`
5. Paste your public key (already in clipboard from `pbcopy` command)
6. Click **"Add SSH key"**

### Test SSH connection:

```bash
ssh -T git@github.com
```

You should see: "Hi username! You've successfully authenticated..."

### Switch your repo to use SSH:

```bash
cd /Users/kevin/card-show-finder

# Check current remote (probably HTTPS)
git remote -v

# Change to SSH (replace YOUR_USERNAME and YOUR_REPO)
git remote set-url origin git@github.com:YOUR_USERNAME/YOUR_REPO.git

# Verify it changed
git remote -v

# Now push
git push origin main
```

---

## 🚀 Quick Push with Token (Right Now)

If you just want to push immediately:

```bash
cd /Users/kevin/card-show-finder

# Use token directly in the URL (one-time)
git push https://YOUR_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git main
```

**Replace:**
- `YOUR_TOKEN` - Your Personal Access Token from GitHub
- `YOUR_USERNAME` - Your GitHub username
- `YOUR_REPO` - Repository name (probably `card-show-finder`)

---

## 🔍 Find Your Repository URL

If you're not sure of the exact repository URL:

1. Go to your repository on GitHub.com
2. Click the green **"Code"** button
3. Copy the HTTPS or SSH URL shown

---

## ✅ After Authentication Works

Once you can push:

```bash
# Stage all changes
git add -A

# Commit
git commit -m "fix: resolve registration and authentication issues

- Fix infinite recursion in RLS policies
- Remove duplicate profile creation from signup
- Add email verification enforcement
- Update password reset redirect URL
- Add website password reset page

All changes tested locally and working correctly"

# Push
git push origin main
```

---

## 🆘 Still Having Issues?

### Check these common problems:

1. **Wrong username/token** - Make sure you're using the token, not your password
2. **Token expired** - Tokens expire after the time you set
3. **Wrong scopes** - Token needs `repo` scope selected
4. **Wrong remote URL** - Make sure it points to your actual repository
5. **Network issues** - Try: `git push -v origin main` for verbose output

### Get help:

```bash
# See more details about the error
git push -v origin main

# Check your git config
git config --list | grep -E "user|remote"

# Test GitHub connection
curl -I https://github.com
```

---

## 📋 Summary

**Fastest way:** Use Personal Access Token (5 minutes)  
**Best way:** Set up SSH keys (10 minutes, but permanent)

Both methods work great - choose what you're comfortable with!

---

**Need help?** Let me know which method you want to use and I can guide you through it! 🚀
