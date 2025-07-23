#!/usr/bin/env node
/**
 * Card Show Finder - Interactive Secrets Setup
 * 
 * This script helps you set up all required secrets for local development
 * and CI/CD pipeline. It will:
 * 
 * 1. Check for missing secrets in your .env file
 * 2. Prompt you for each missing value with helpful hints
 * 3. Generate random values where appropriate
 * 4. Validate input formats
 * 5. Update your .env file
 * 
 * Usage:
 *   node scripts/setup-secrets.js
 * 
 * Options:
 *   --force       Prompt for all secrets, even if they exist
 *   --generate    Auto-generate values where possible
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Configure colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Define all secrets with validation and help text
const secrets = [
  {
    name: 'EXPO_TOKEN',
    description: 'Expo access token for EAS builds and OTA updates',
    required: true,
    category: 'Expo',
    validate: (value) => value && value.length >= 24,
    error: 'Expo token should be at least 24 characters',
    hint: `Generate at https://expo.dev/accounts/[username]/settings/access-tokens
    • Create a new token with "Owner" scope
    • Name it something like "CI/CD Pipeline"
    • Copy the full token value (starts with "eas_...")`
  },
  {
    name: 'EXPO_ACCOUNT_NAME',
    description: 'Expo account/organization slug for Slack and OTA URLs',
    required: true,
    category: 'Expo',
    validate: (value) => value && /^[a-z0-9_-]+$/i.test(value),
    error: 'Expo account name should be alphanumeric (may include dashes/underscores)',
    hint: `Your Expo username or organization name (lowercase)
    • This is the slug visible in your Expo dashboard URL:
    • https://expo.dev/accounts/<this-value>/projects`
  },
  {
    name: 'EXPO_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
    required: true,
    category: 'Supabase',
    validate: (value) => value && value.startsWith('https://') && value.includes('.supabase.co'),
    error: 'Supabase URL should be a valid URL (https://<project-id>.supabase.co)',
    hint: `Find in Supabase dashboard → Project Settings → API → Project URL
    • Should look like: https://abcdefghijklm.supabase.co`
  },
  {
    name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key for client access',
    required: true,
    category: 'Supabase',
    validate: (value) => value && value.length > 20,
    error: 'Supabase anon key should be at least 20 characters',
    hint: `Find in Supabase dashboard → Project Settings → API → anon key
    • Long string that starts with "eyJ..."`
  },
  {
    name: 'SUPABASE_SERVICE_KEY',
    description: 'Supabase service key for admin access (CI/CD)',
    required: true,
    category: 'Supabase',
    validate: (value) => value && value.length > 20,
    error: 'Supabase service key should be at least 20 characters',
    hint: `Find in Supabase dashboard → Project Settings → API → service_role key
    • Long string that starts with "eyJ..."`
  },
  {
    name: 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
    description: 'Google Maps API key for map functionality',
    required: true,
    category: 'Google',
    validate: (value) => value && value.length > 20,
    error: 'Google Maps API key should be at least 20 characters',
    hint: `Create in Google Cloud Console → APIs & Services → Credentials
    • Make sure the key has Maps SDK for iOS, Android and Web enabled
    • Restrict the key to your app's bundle ID for security`
  },
  {
    name: 'EXPO_PUBLIC_SENTRY_DSN',
    description: 'Sentry DSN for error tracking',
    required: true,
    category: 'Sentry',
    validate: (value) => value && value.includes('sentry.io'),
    error: 'Sentry DSN should be a valid URL containing sentry.io',
    hint: `Create at https://sentry.io → Projects → [project] → Client Keys (DSN)
    • Format: https://<key>@<org>.ingest.sentry.io/<project>`
  },
  {
    name: 'STRIPE_SECRET_KEY',
    description: 'Stripe secret key for server-side API access',
    required: true,
    category: 'Stripe',
    validate: (value) => value && (value.startsWith('sk_test_') || value.startsWith('sk_live_')),
    error: 'Stripe secret key should start with sk_test_ or sk_live_',
    hint: `Find in Stripe Dashboard → Developers → API keys → Secret key
    • Use sk_test_... for development/staging
    • Use sk_live_... for production (be careful!)`
  },
  {
    name: 'STRIPE_PUBLISHABLE_KEY',
    description: 'Stripe publishable key for client-side integration',
    required: true,
    category: 'Stripe',
    validate: (value) => value && (value.startsWith('pk_test_') || value.startsWith('pk_live_')),
    error: 'Stripe publishable key should start with pk_test_ or pk_live_',
    hint: `Find in Stripe Dashboard → Developers → API keys → Publishable key
    • Use pk_test_... for development/staging
    • Use pk_live_... for production`
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    description: 'Stripe webhook signing secret',
    required: true,
    category: 'Stripe',
    validate: (value) => value && value.startsWith('whsec_'),
    error: 'Stripe webhook secret should start with whsec_',
    hint: `Find in Stripe Dashboard → Developers → Webhooks → Signing secret
    • Click on your webhook endpoint
    • Click "Reveal" next to "Signing secret"
    • If none exists, you may need to create a webhook endpoint first`
  },
  {
    name: 'MFA_ENCRYPTION_KEY',
    description: 'Key for encrypting MFA secrets',
    required: false,
    category: 'Security',
    validate: (value) => value && value.length >= 32,
    error: 'MFA encryption key should be at least 32 characters',
    hint: 'Generate with: openssl rand -base64 32',
    generate: () => crypto.randomBytes(32).toString('base64')
  },
  {
    name: 'SLACK_WEBHOOK_URL',
    description: 'Slack webhook URL for build notifications',
    required: false,
    category: 'Notifications',
    validate: (value) => value && value.startsWith('https://hooks.slack.com/'),
    error: 'Slack webhook URL should start with https://hooks.slack.com/',
    hint: `Create in Slack → App Management → Incoming Webhooks → Add → Choose channel
    • Format: https://hooks.slack.com/services/T.../B.../X...`
  },
  {
    name: 'MAIL_SERVER',
    description: 'SMTP server for email notifications',
    required: false,
    category: 'Notifications',
    validate: (value) => value && value.length > 0,
    error: 'SMTP server cannot be empty',
    hint: 'Your email provider\'s SMTP server (e.g., smtp.sendgrid.net)'
  },
  {
    name: 'MAIL_PORT',
    description: 'SMTP port for email notifications',
    required: false,
    category: 'Notifications',
    validate: (value) => value && !isNaN(value) && parseInt(value) > 0,
    error: 'SMTP port should be a positive number',
    hint: 'Your email provider\'s SMTP port (e.g., 465 for TLS, 587 for STARTTLS)'
  },
  {
    name: 'MAIL_USERNAME',
    description: 'SMTP username for email notifications',
    required: false,
    category: 'Notifications',
    validate: (value) => value && value.length > 0,
    error: 'SMTP username cannot be empty',
    hint: 'Your email provider\'s SMTP username'
  },
  {
    name: 'MAIL_PASSWORD',
    description: 'SMTP password for email notifications',
    required: false,
    category: 'Notifications',
    validate: (value) => value && value.length > 0,
    error: 'SMTP password cannot be empty',
    hint: 'Your email provider\'s SMTP password or API key'
  },
  {
    name: 'NOTIFICATION_EMAIL',
    description: 'Email address to receive notifications',
    required: false,
    category: 'Notifications',
    validate: (value) => value && value.includes('@'),
    error: 'Notification email should be a valid email address',
    hint: 'Email address(es) to receive build notifications (comma-separated)'
  }
];

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Helper function to check if a command exists
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Helper function to generate a random value
function generateValue(secret) {
  if (secret.name === 'MFA_ENCRYPTION_KEY') {
    if (commandExists('openssl')) {
      try {
        return execSync('openssl rand -base64 32').toString().trim();
      } catch (e) {
        return crypto.randomBytes(32).toString('base64');
      }
    } else {
      return crypto.randomBytes(32).toString('base64');
    }
  }
  return null;
}

// Main function
async function main() {
  console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  Card Show Finder - Secrets Setup${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
  console.log();
  console.log(`This script will help you set up all required secrets for local development`);
  console.log(`and CI/CD pipeline. It will update your ${colors.bright}.env${colors.reset} file with the values you provide.`);
  console.log();

  const rootDir = process.cwd();
  const envPath = path.join(rootDir, '.env');
  const envExamplePath = path.join(rootDir, '.env.example');

  // Check if .env file exists
  let envVars = {};
  if (fs.existsSync(envPath)) {
    console.log(`${colors.green}✓ Found existing .env file${colors.reset}`);
    
    // Parse existing .env file
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        envVars[key] = value;
      }
    });
  } else if (fs.existsSync(envExamplePath)) {
    console.log(`${colors.yellow}⚠ No .env file found. Creating one from .env.example${colors.reset}`);
    fs.copyFileSync(envExamplePath, envPath);
    
    // Parse .env.example to get structure but not values
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        envVars[key] = '';
      }
    });
  } else {
    console.log(`${colors.red}✗ No .env or .env.example file found. Creating a new .env file${colors.reset}`);
    envVars = {};
  }

  const forcePrompt = process.argv.includes('--force');
  const autoGenerate = process.argv.includes('--generate');

  // Group secrets by category
  const secretsByCategory = {};
  secrets.forEach(secret => {
    if (!secretsByCategory[secret.category]) {
      secretsByCategory[secret.category] = [];
    }
    secretsByCategory[secret.category].push(secret);
  });

  // Track changes
  let changedSecrets = 0;
  let missingRequired = 0;

  // Process each category
  for (const category of Object.keys(secretsByCategory)) {
    console.log(`\n${colors.bright}${colors.cyan}## ${category} ##${colors.reset}`);
    
    for (const secret of secretsByCategory[category]) {
      const currentValue = envVars[secret.name];
      const isValid = currentValue && secret.validate(currentValue);
      
      if (forcePrompt || !isValid) {
        if (!isValid && secret.required) {
          if (currentValue) {
            console.log(`${colors.red}✗ Invalid ${secret.name}${colors.reset}`);
          } else {
            console.log(`${colors.red}✗ Missing ${secret.name}${colors.reset}`);
          }
          missingRequired++;
        }

        console.log(`\n${colors.bright}${secret.name}${colors.reset}`);
        console.log(`${colors.gray}${secret.description}${colors.reset}`);
        
        let newValue = currentValue || '';
        
        // Try to generate value if possible and auto-generate is enabled
        if (autoGenerate && secret.generate && (!currentValue || !isValid)) {
          newValue = secret.generate();
          console.log(`${colors.green}✓ Auto-generated value${colors.reset}`);
        } else {
          // Show hint
          if (secret.hint) {
            console.log(`${colors.yellow}Hint:${colors.reset} ${secret.hint}`);
          }
          
          // Show current value if it exists
          if (currentValue) {
            console.log(`${colors.gray}Current value: ${currentValue}${colors.reset}`);
          }
          
          // Prompt for new value
          newValue = await prompt(`Enter value for ${colors.bright}${secret.name}${colors.reset} (${secret.required ? 'required' : 'optional'}): `);
          
          // Use current value if input is empty
          if (!newValue && currentValue) {
            newValue = currentValue;
            console.log(`${colors.gray}Using existing value${colors.reset}`);
          }
          
          // Generate value if input is 'generate' and generation is possible
          if (newValue === 'generate' && secret.generate) {
            newValue = secret.generate();
            console.log(`${colors.green}✓ Generated value${colors.reset}`);
          }
        }
        
        // Validate new value
        if (newValue && secret.validate(newValue)) {
          envVars[secret.name] = newValue;
          console.log(`${colors.green}✓ Valid value${colors.reset}`);
          changedSecrets++;
        } else if (newValue && !secret.validate(newValue)) {
          console.log(`${colors.red}✗ ${secret.error}${colors.reset}`);
          if (secret.required) {
            // For required secrets, keep prompting until valid
            let validValue = false;
            while (!validValue) {
              newValue = await prompt(`Please enter a valid value for ${colors.bright}${secret.name}${colors.reset}: `);
              
              if (newValue === 'generate' && secret.generate) {
                newValue = secret.generate();
                console.log(`${colors.green}✓ Generated value${colors.reset}`);
              }
              
              if (newValue && secret.validate(newValue)) {
                envVars[secret.name] = newValue;
                console.log(`${colors.green}✓ Valid value${colors.reset}`);
                changedSecrets++;
                validValue = true;
              } else if (!newValue) {
                console.log(`${colors.red}✗ Required value cannot be empty${colors.reset}`);
              } else {
                console.log(`${colors.red}✗ ${secret.error}${colors.reset}`);
              }
            }
          } else if (newValue) {
            // For optional secrets, warn but accept invalid value
            console.log(`${colors.yellow}⚠ Using invalid value (optional secret)${colors.reset}`);
            envVars[secret.name] = newValue;
            changedSecrets++;
          }
        } else if (!newValue && !secret.required) {
          console.log(`${colors.gray}Skipping optional secret${colors.reset}`);
        } else if (!newValue && secret.required) {
          console.log(`${colors.red}✗ Required value cannot be empty${colors.reset}`);
          // Keep prompting until valid
          let validValue = false;
          while (!validValue) {
            newValue = await prompt(`Please enter a value for ${colors.bright}${secret.name}${colors.reset}: `);
            
            if (newValue === 'generate' && secret.generate) {
              newValue = secret.generate();
              console.log(`${colors.green}✓ Generated value${colors.reset}`);
            }
            
            if (newValue && secret.validate(newValue)) {
              envVars[secret.name] = newValue;
              console.log(`${colors.green}✓ Valid value${colors.reset}`);
              changedSecrets++;
              validValue = true;
            } else if (!newValue) {
              console.log(`${colors.red}✗ Required value cannot be empty${colors.reset}`);
            } else {
              console.log(`${colors.red}✗ ${secret.error}${colors.reset}`);
            }
          }
        }
      } else {
        // Secret exists and is valid
        console.log(`${colors.green}✓ ${secret.name}${colors.reset} ${colors.gray}(already set)${colors.reset}`);
      }
    }
  }

  // Write updated .env file
  if (changedSecrets > 0) {
    // Build .env content
    let envContent = '';
    
    // Get structure from .env.example if it exists
    if (fs.existsSync(envExamplePath)) {
      const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
      const lines = exampleContent.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          if (envVars[key] !== undefined) {
            envContent += `${key}=${envVars[key]}\n`;
            delete envVars[key]; // Remove from object to track what's been written
          } else {
            envContent += line + '\n'; // Keep original line (comments, etc.)
          }
        } else {
          envContent += line + '\n'; // Keep original line (comments, etc.)
        }
      }
    }
    
    // Add any remaining variables not in .env.example
    for (const [key, value] of Object.entries(envVars)) {
      if (value !== undefined) {
        envContent += `${key}=${value}\n`;
      }
    }
    
    // Write to .env file
    fs.writeFileSync(envPath, envContent);
    console.log(`\n${colors.green}✓ Updated .env file with ${changedSecrets} new/changed secrets${colors.reset}`);
  } else {
    console.log(`\n${colors.gray}No changes made to .env file${colors.reset}`);
  }

  // Final status
  console.log(`\n${colors.bright}${colors.cyan}========================================${colors.reset}`);
  if (missingRequired > 0) {
    console.log(`${colors.yellow}⚠ ${missingRequired} required secrets were missing or invalid${colors.reset}`);
    console.log(`${colors.green}✓ All required secrets have now been configured${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ All required secrets are properly configured${colors.reset}`);
  }
  
  // Next steps
  console.log(`\n${colors.bright}Next steps:${colors.reset}`);
  console.log(`1. Add these secrets to GitHub Actions for CI/CD pipeline:`);
  console.log(`   ${colors.gray}GitHub repository → Settings → Secrets and variables → Actions → New repository secret${colors.reset}`);
  console.log(`2. For the Android service account key, use "Add secret (file)" option`);
  console.log(`3. Test the CI pipeline by pushing a small change to the develop branch`);

  // Close readline interface
  rl.close();
}

// Run the main function
main().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
