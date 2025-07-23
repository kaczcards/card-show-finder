#!/usr/bin/env node
/**
 * Card Show Finder - Secrets Audit Script
 * 
 * This script checks for the presence of required environment variables and secrets,
 * helps identify what's missing, and provides guidance on where to get each secret.
 * 
 * Usage:
 *   node scripts/audit-secrets.js
 * 
 * Options:
 *   --verbose    Show additional information about each secret
 *   --github     Check GitHub Actions secrets (requires gh CLI)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// Chalk v5+ is ESM-only. When required from CommonJS it exposes the API under
// the `default` property. The line below seamlessly supports both v4 (CJS)
// and v5+ (ESM) without changing the rest of the code.
const chalkImport = require('chalk');
const chalk = chalkImport.default || chalkImport;
const dotenv = require('dotenv');
const { exit } = require('process');

// Load environment variables from .env file if it exists
let envVars = {};
try {
  if (fs.existsSync(path.join(process.cwd(), '.env'))) {
    envVars = dotenv.parse(fs.readFileSync(path.join(process.cwd(), '.env')));
    console.log(chalk.green('✓ Found .env file'));
  } else {
    console.log(chalk.yellow('⚠ No .env file found. Create one from .env.example'));
  }
} catch (error) {
  console.error(chalk.red('Error reading .env file:'), error.message);
}

// Check if Expo is installed and configured
let expoConfig = {};
try {
  if (fs.existsSync(path.join(process.cwd(), 'app.json'))) {
    expoConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'app.json'), 'utf8')).expo;
    console.log(chalk.green('✓ Found app.json with Expo configuration'));
  } else if (fs.existsSync(path.join(process.cwd(), 'app.config.js'))) {
    console.log(chalk.green('✓ Found app.config.js (dynamic Expo configuration)'));
    console.log(chalk.yellow('  Note: Dynamic config detected - some values may be computed at runtime'));
  } else {
    console.log(chalk.red('✗ No Expo configuration found (app.json or app.config.js)'));
  }
} catch (error) {
  console.error(chalk.red('Error reading Expo configuration:'), error.message);
}

// Check for GitHub CLI and authentication if --github flag is provided
let githubSecretsAvailable = false;
if (process.argv.includes('--github')) {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    execSync('gh auth status', { stdio: 'ignore' });
    githubSecretsAvailable = true;
    console.log(chalk.green('✓ GitHub CLI authenticated and ready to check secrets'));
  } catch (error) {
    console.log(chalk.yellow('⚠ GitHub CLI not available or not authenticated'));
    console.log('  Install with: npm install -g gh');
    console.log('  Authenticate with: gh auth login');
  }
}

// Define required secrets with descriptions and instructions
const requiredSecrets = [
  {
    name: 'EXPO_TOKEN',
    description: 'Expo access token for EAS builds and OTA updates',
    envVar: 'EXPO_TOKEN',
    category: 'Expo',
    priority: 'high',
    instructions: 'Generate at https://expo.dev/accounts/[username]/settings/access-tokens',
    checkCommand: 'EXPO_TOKEN=[value] npx eas whoami',
    githubRequired: true
  },
  {
    name: 'EXPO_ACCOUNT_NAME',
    description: 'Expo account/organization slug for Slack and OTA URLs',
    envVar: 'EXPO_ACCOUNT_NAME',
    category: 'Expo',
    priority: 'high',
    instructions: 'Your Expo username or organization name (lowercase)',
    githubRequired: true
  },
  {
    name: 'EXPO_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
    envVar: 'EXPO_PUBLIC_SUPABASE_URL',
    category: 'Supabase',
    priority: 'high',
    instructions: 'Find in Supabase dashboard → Project Settings → API → Project URL',
    githubRequired: true
  },
  {
    name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key for client access',
    envVar: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    category: 'Supabase',
    priority: 'high',
    instructions: 'Find in Supabase dashboard → Project Settings → API → anon key',
    githubRequired: true
  },
  {
    name: 'SUPABASE_SERVICE_KEY',
    description: 'Supabase service key for admin access (CI/CD)',
    envVar: 'SUPABASE_SERVICE_KEY',
    category: 'Supabase',
    priority: 'high',
    instructions: 'Find in Supabase dashboard → Project Settings → API → service_role key',
    githubRequired: true
  },
  {
    name: 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
    description: 'Google Maps API key for map functionality',
    envVar: 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
    category: 'Google',
    priority: 'high',
    instructions: 'Create in Google Cloud Console → APIs & Services → Credentials',
    githubRequired: true
  },
  {
    name: 'EXPO_PUBLIC_SENTRY_DSN',
    description: 'Sentry DSN for error tracking',
    envVar: 'EXPO_PUBLIC_SENTRY_DSN',
    category: 'Sentry',
    priority: 'high',
    instructions: 'Create at https://sentry.io → Projects → [project] → Client Keys (DSN)',
    githubRequired: true
  },
  {
    name: 'STRIPE_SECRET_KEY',
    description: 'Stripe secret key for server-side API access',
    envVar: 'STRIPE_SECRET_KEY',
    category: 'Stripe',
    priority: 'high',
    instructions: 'Find in Stripe Dashboard → Developers → API keys → Secret key',
    githubRequired: true
  },
  {
    name: 'STRIPE_PUBLISHABLE_KEY',
    description: 'Stripe publishable key for client-side integration',
    envVar: 'STRIPE_PUBLISHABLE_KEY',
    category: 'Stripe',
    priority: 'high',
    instructions: 'Find in Stripe Dashboard → Developers → API keys → Publishable key',
    githubRequired: true
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    description: 'Stripe webhook signing secret',
    envVar: 'STRIPE_WEBHOOK_SECRET',
    category: 'Stripe',
    priority: 'high',
    instructions: 'Find in Stripe Dashboard → Developers → Webhooks → Signing secret',
    githubRequired: true
  },
  {
    name: 'APPLE_ID',
    description: 'Apple ID email for App Store Connect',
    envVar: 'APPLE_ID',
    category: 'Apple',
    priority: 'high',
    instructions: 'Your Apple Developer account email',
    githubRequired: true
  },
  {
    name: 'APPLE_TEAM_ID',
    description: '10-character Apple developer team identifier',
    envVar: 'APPLE_TEAM_ID',
    category: 'Apple',
    priority: 'high',
    instructions: 'Find in App Store Connect → Membership',
    githubRequired: true
  },
  {
    name: 'ASC_APP_ID',
    description: 'Numeric Apple Store Connect App ID',
    envVar: 'ASC_APP_ID',
    category: 'Apple',
    priority: 'high',
    instructions: 'Find in App Store Connect → App → App Information → Apple ID (numeric)',
    githubRequired: true
  },
  {
    name: 'ANDROID_SERVICE_ACCOUNT_KEY',
    description: 'Google Play service account JSON key file',
    envVar: null, // This is a file, not an environment variable
    category: 'Google',
    priority: 'high',
    instructions: 'Create in Google Play Console → API access → Service accounts → Create key (JSON)',
    note: 'This must be uploaded as a file secret in GitHub Actions',
    githubRequired: true
  },
  {
    name: 'SLACK_WEBHOOK_URL',
    description: 'Slack webhook URL for build notifications',
    envVar: 'SLACK_WEBHOOK_URL',
    category: 'Notifications',
    priority: 'medium',
    instructions: 'Create in Slack → App Management → Incoming Webhooks → Add → Choose channel',
    githubRequired: true
  },
  {
    name: 'MAIL_SERVER',
    description: 'SMTP server for email notifications',
    envVar: 'MAIL_SERVER',
    category: 'Notifications',
    priority: 'medium',
    instructions: 'Your email provider\'s SMTP server (e.g., smtp.sendgrid.net)',
    githubRequired: true
  },
  {
    name: 'MAIL_PORT',
    description: 'SMTP port for email notifications',
    envVar: 'MAIL_PORT',
    category: 'Notifications',
    priority: 'medium',
    instructions: 'Your email provider\'s SMTP port (e.g., 465 for TLS, 587 for STARTTLS)',
    githubRequired: true
  },
  {
    name: 'MAIL_USERNAME',
    description: 'SMTP username for email notifications',
    envVar: 'MAIL_USERNAME',
    category: 'Notifications',
    priority: 'medium',
    instructions: 'Your email provider\'s SMTP username',
    githubRequired: true
  },
  {
    name: 'MAIL_PASSWORD',
    description: 'SMTP password for email notifications',
    envVar: 'MAIL_PASSWORD',
    category: 'Notifications',
    priority: 'medium',
    instructions: 'Your email provider\'s SMTP password or API key',
    githubRequired: true
  },
  {
    name: 'NOTIFICATION_EMAIL',
    description: 'Email address to receive notifications',
    envVar: 'NOTIFICATION_EMAIL',
    category: 'Notifications',
    priority: 'medium',
    instructions: 'Email address(es) to receive build notifications (comma-separated)',
    githubRequired: true
  },
  {
    name: 'MFA_ENCRYPTION_KEY',
    description: 'Key for encrypting MFA secrets',
    envVar: 'MFA_ENCRYPTION_KEY',
    category: 'Security',
    priority: 'medium',
    instructions: 'Generate with: openssl rand -base64 32',
    githubRequired: true
  },
  {
    name: 'GITLEAKS_LICENSE',
    description: 'Gitleaks Pro license key',
    envVar: 'GITLEAKS_LICENSE',
    category: 'Security',
    priority: 'low',
    instructions: 'Purchase from https://gitleaks.io',
    githubRequired: true,
    optional: true
  }
];

// Check GitHub secrets if --github flag is provided
let githubSecrets = [];
if (githubSecretsAvailable) {
  try {
    const repoInfo = execSync('gh repo view --json nameWithOwner').toString();
    const { nameWithOwner } = JSON.parse(repoInfo);
    
    console.log(chalk.blue(`\nChecking GitHub secrets for ${nameWithOwner}...`));
    
    // List repository secrets
    const secretsOutput = execSync('gh api repos/:owner/:repo/actions/secrets --jq ".secrets[].name"').toString();
    githubSecrets = secretsOutput.split('\n').filter(Boolean);
    
    console.log(chalk.green(`Found ${githubSecrets.length} GitHub secrets`));
  } catch (error) {
    console.error(chalk.red('Error checking GitHub secrets:'), error.message);
    githubSecretsAvailable = false;
  }
}

// Print audit report
console.log(chalk.blue.bold('\n=== Secret Audit Report ==='));

// Group secrets by category
const secretsByCategory = {};
requiredSecrets.forEach(secret => {
  if (!secretsByCategory[secret.category]) {
    secretsByCategory[secret.category] = [];
  }
  secretsByCategory[secret.category].push(secret);
});

// Track missing secrets
const missingSecrets = {
  high: [],
  medium: [],
  low: []
};

// Display secrets by category
Object.keys(secretsByCategory).forEach(category => {
  console.log(chalk.cyan(`\n## ${category} ##`));
  
  secretsByCategory[category].forEach(secret => {
    const envValue = secret.envVar ? envVars[secret.envVar] : null;
    const githubValue = githubSecretsAvailable ? githubSecrets.includes(secret.name) : false;
    
    let status = '';
    let envStatus = '';
    let githubStatus = '';
    
    // Check .env status
    if (secret.envVar) {
      if (envValue) {
        envStatus = chalk.green('✓ .env');
      } else {
        envStatus = chalk.red('✗ .env');
        if (secret.priority !== 'low' || !secret.optional) {
          missingSecrets[secret.priority].push({ ...secret, missing: 'env' });
        }
      }
    } else {
      envStatus = chalk.gray('N/A');
    }
    
    // Check GitHub status
    if (secret.githubRequired) {
      if (githubSecretsAvailable) {
        if (githubValue) {
          githubStatus = chalk.green('✓ GitHub');
        } else {
          githubStatus = chalk.red('✗ GitHub');
          if (secret.priority !== 'low' || !secret.optional) {
            missingSecrets[secret.priority].push({ ...secret, missing: 'github' });
          }
        }
      } else {
        githubStatus = chalk.yellow('? GitHub');
      }
    } else {
      githubStatus = chalk.gray('N/A');
    }
    
    const priorityBadge = secret.priority === 'high' 
      ? chalk.bgRed(' HIGH ') 
      : secret.priority === 'medium' 
        ? chalk.bgYellow(' MED ') 
        : chalk.bgBlue(' LOW ');
    
    console.log(`${priorityBadge} ${secret.name}: ${envStatus} ${githubStatus}`);
    
    if (process.argv.includes('--verbose')) {
      console.log(`  ${chalk.gray(secret.description)}`);
      if (secret.note) {
        console.log(`  ${chalk.yellow('Note:')} ${secret.note}`);
      }
    }
  });
});

// Summary of missing secrets
console.log(chalk.blue.bold('\n=== Missing Secrets Summary ==='));

const totalMissing = missingSecrets.high.length + missingSecrets.medium.length + missingSecrets.low.length;

if (totalMissing === 0) {
  console.log(chalk.green('✓ All required secrets are configured!'));
} else {
  if (missingSecrets.high.length > 0) {
    console.log(chalk.red(`\n⚠️ ${missingSecrets.high.length} HIGH PRIORITY secrets missing:`));
    missingSecrets.high.forEach(secret => {
      console.log(`  - ${secret.name} (${secret.missing})`);
      console.log(`    ${chalk.gray(secret.instructions)}`);
    });
  }
  
  if (missingSecrets.medium.length > 0) {
    console.log(chalk.yellow(`\n⚠️ ${missingSecrets.medium.length} MEDIUM PRIORITY secrets missing:`));
    missingSecrets.medium.forEach(secret => {
      console.log(`  - ${secret.name} (${secret.missing})`);
      console.log(`    ${chalk.gray(secret.instructions)}`);
    });
  }
  
  if (missingSecrets.low.length > 0) {
    console.log(chalk.blue(`\n⚠️ ${missingSecrets.low.length} LOW PRIORITY secrets missing:`));
    missingSecrets.low.forEach(secret => {
      console.log(`  - ${secret.name} (${secret.missing})`);
      console.log(`    ${chalk.gray(secret.instructions)}`);
    });
  }
}

// Next steps
console.log(chalk.blue.bold('\n=== Next Steps ==='));

if (totalMissing > 0) {
  console.log(`1. Add missing secrets to ${chalk.bold('.env')} file for local development`);
  console.log(`2. Add missing secrets to ${chalk.bold('GitHub Actions')} for CI/CD pipeline:`);
  console.log(`   ${chalk.gray('GitHub repository → Settings → Secrets and variables → Actions → New repository secret')}`);
  
  if (missingSecrets.high.some(s => s.name === 'ANDROID_SERVICE_ACCOUNT_KEY')) {
    console.log(`\n   ${chalk.yellow('Note:')} For ANDROID_SERVICE_ACCOUNT_KEY, use "Add secret (file)" option`);
  }
  
  console.log(`\n3. Run this script again with ${chalk.bold('--github')} flag to verify GitHub secrets:`);
  console.log(`   ${chalk.gray('node scripts/audit-secrets.js --github')}`);
  
  console.log(`\n4. Test the CI pipeline by pushing a small change to the develop branch`);
} else {
  console.log(`1. ${chalk.green('✓')} All secrets are properly configured!`);
  console.log(`2. Test the CI pipeline by pushing a small change to the develop branch`);
  console.log(`3. Check GitHub Actions to verify the pipeline runs successfully`);
  console.log(`4. Consider setting up a secret rotation schedule (every 90 days recommended)`);
}

// Exit with error code if high priority secrets are missing
if (missingSecrets.high.length > 0) {
  process.exit(1);
}
