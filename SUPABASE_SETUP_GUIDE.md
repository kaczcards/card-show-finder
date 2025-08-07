# Supabase Production Setup Guide

This guide provides comprehensive instructions for setting up your Supabase production environment for the Card Show Finder app. Following these steps will ensure your backend is properly configured, secure, and ready for production deployment.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Supabase Service Key Setup](#supabase-service-key-setup)
3. [Environment Variables Configuration](#environment-variables-configuration)
4. [Testing Your Configuration](#testing-your-configuration)
5. [Security Best Practices](#security-best-practices)
6. [Database Backup Configuration](#database-backup-configuration)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have:
- A Supabase account with admin access to your project
- Access to your production Supabase project dashboard
- Git repository cloned locally
- Node.js and npm installed

## Supabase Service Key Setup

The `SUPABASE_SERVICE_KEY` is required for admin operations, including database migrations, RLS policy management, and CI/CD workflows.

### Step 1: Access Your Supabase Dashboard

1. Navigate to [Supabase Dashboard](https://app.supabase.io/)
2. Select your **production** project
3. Verify you're on the production project by checking the project name and URL

### Step 2: Retrieve Your Service Key

1. In the sidebar, click on **Settings**
2. Select **API** from the settings menu
3. Scroll down to the **Project API keys** section
4. Find the key labeled `service_role` (this has admin privileges)
5. Click the **Copy** button next to the service role key

![Service Key Location](https://example.com/images/service-key-location.png)

> ⚠️ **IMPORTANT**: The service role key has **full admin access** to your database. Never expose it in client-side code or public repositories.

## Environment Variables Configuration

### Step 1: Update Your Local .env File

Create or update your `.env` file with the following values:

```
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-production-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Other required variables
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-production-google-maps-key
EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-dsn.ingest.sentry.io/project-id

# Stripe (if using payment features)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# MFA (if using two-factor authentication)
MFA_ENCRYPTION_KEY=your-32-character-encryption-key
```

Replace each placeholder with your actual production values.

### Step 2: Create Environment-Specific Files

For better organization, create separate environment files:

1. `.env.development` - Development environment settings
2. `.env.staging` - Staging/testing environment settings
3. `.env.production` - Production environment settings

This allows you to easily switch between environments without manually editing values.

## Testing Your Configuration

### Step 1: Run the Environment Validation Script

We've created a validation script to verify your environment setup:

```bash
# Install required dependencies
npm install

# Run the validation script for production
node scripts/validate-environment.js --production
```

The script will:
- Verify all required variables are present
- Check variable formats and patterns
- Test connectivity to Supabase
- Validate your Google Maps API key
- Provide detailed error messages if any issues are found

### Step 2: Test Database Connectivity

Verify your Supabase connection with:

```bash
# Test RLS policies
npm run db:rls:verify

# Run database unit tests
npm run test:db:unit
```

### Step 3: Verify RLS Policies

Ensure your Row Level Security policies are correctly applied:

```bash
# Apply and verify consolidated RLS policies
node apply-consolidated-rls.js
```

## Security Best Practices

### 1. Protect Your Service Key

- **Never** commit your `.env` file to version control
- **Never** expose the service key in client-side code
- Use GitHub Secrets or similar for CI/CD pipelines
- Rotate keys periodically (every 90-180 days)

### 2. Configure Proper RLS Policies

Row Level Security is critical for protecting your data:

```bash
# Apply consolidated RLS policies to production
node apply-consolidated-rls.js --production
```

### 3. Enable MFA for Supabase Dashboard Access

1. Go to your Supabase account settings
2. Enable two-factor authentication
3. Require team members to do the same

### 4. Set Up IP Allow Lists

Restrict dashboard access to known IP addresses:

1. Go to Supabase Dashboard → Settings → API
2. Configure IP Allow List for the dashboard
3. Add your office IP ranges and VPN endpoints

### 5. Audit Regularly

1. Review database access logs weekly
2. Check for unusual activity patterns
3. Monitor failed authentication attempts

## Database Backup Configuration

### Enable Point-in-Time Recovery

1. Go to Supabase Dashboard → Settings → Database
2. Enable **Point-in-Time Recovery (PITR)**
3. Set retention period to **30 days** (recommended)
4. Verify backup status shows as **COMPLETED**

### Schedule Regular Backups

Set up additional backup procedures:

```bash
# Verify backup status
SUPABASE_ACCESS_TOKEN=<token> \
PROJECT_REF=<project_ref> \
node scripts/verify_backup_status.js
```

## Troubleshooting

### Common Issues and Solutions

#### "Missing required environment variables"

**Problem**: The validation script reports missing variables.
**Solution**: Double-check your `.env` file and ensure all required variables are present.

#### "Invalid service key format"

**Problem**: Your service key doesn't match the expected format.
**Solution**: Ensure you've copied the entire key from the Supabase dashboard without any extra spaces.

#### "Connection failed with service key"

**Problem**: The script can't connect to Supabase with your service key.
**Solution**: 
1. Verify your `SUPABASE_SERVICE_KEY` is correct
2. Check if your IP is allowed in the Supabase dashboard
3. Ensure your project is active and not paused

#### "RLS policies not applied correctly"

**Problem**: Security tests fail after applying RLS policies.
**Solution**:
1. Run `node apply-consolidated-rls.js --force` to reapply all policies
2. Check for SQL errors in the console output
3. Verify your service key has admin privileges

#### "Database migration failed"

**Problem**: Unable to apply database changes.
**Solution**:
1. Check for SQL syntax errors in your migration files
2. Ensure your service key has the correct permissions
3. Try running migrations individually to isolate the issue

### Getting Help

If you encounter persistent issues:

1. Check the [Supabase documentation](https://supabase.io/docs)
2. Review our internal troubleshooting guide in `docs/DATABASE_BACKUP.md`
3. Contact the development team on Slack (#backend-support channel)

## Next Steps

After successfully setting up your Supabase production environment:

1. Complete the [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
2. Set up [Continuous Integration](./CICD_SETUP_GUIDE.md)
3. Configure [Monitoring and Alerts](./SENTRY_INTEGRATION.md)

---

**Remember**: Always validate your configuration before deploying to production, and maintain separate environments (development, staging, production) to ensure a smooth workflow.
