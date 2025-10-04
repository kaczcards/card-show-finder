#!/usr/bin/env node

/**
 * Email Sender Script
 * 
 * This script processes pending email notifications from the database
 * and sends them using your preferred email service.
 * 
 * Run this:
 * - As a cron job (every 5 minutes)
 * - Manually when needed
 * - Via a serverless function
 * 
 * Usage:
 *   node send-pending-emails.js
 * 
 * Environment variables required:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_KEY - Your Supabase service role key
 *   EMAIL_SERVICE - "resend", "sendgrid", "mailgun", or "console" (for testing)
 *   EMAIL_API_KEY - API key for your email service
 *   FROM_EMAIL - Email address to send from (e.g., noreply@cardshowfinder.com)
 */

const https = require('https');

// Configuration
const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://zmfqzegykwyrrvrpwylf.supabase.co',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY',
  emailService: process.env.EMAIL_SERVICE || 'console', // resend, sendgrid, mailgun, console
  emailApiKey: process.env.EMAIL_API_KEY || '',
  fromEmail: process.env.FROM_EMAIL || 'Card Show Finder <noreply@cardshowfinder.com>'
};

/**
 * Fetch pending emails from Supabase
 */
async function fetchPendingEmails() {
  return new Promise((resolve, reject) => {
    const url = new URL('/rest/v1/pending_email_notifications', CONFIG.supabaseUrl);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': CONFIG.supabaseKey,
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to fetch emails: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Update email status in database
 */
async function updateEmailStatus(emailId, status, errorMessage = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/rest/v1/email_notifications?id=eq.${emailId}`, CONFIG.supabaseUrl);
    
    const payload = JSON.stringify({
      status: status,
      sent_at: status === 'SENT' ? new Date().toISOString() : null,
      error_message: errorMessage
    });

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PATCH',
      headers: {
        'apikey': CONFIG.supabaseKey,
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Failed to update email status: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send email using Resend
 */
async function sendWithResend(email) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: CONFIG.fromEmail,
      to: [email.recipient_email],
      subject: email.subject,
      text: email.body
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.emailApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Resend API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send email using SendGrid
 */
async function sendWithSendGrid(email) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      personalizations: [{
        to: [{ email: email.recipient_email }],
        subject: email.subject
      }],
      from: { email: CONFIG.fromEmail.match(/<(.+)>/)?.[1] || CONFIG.fromEmail },
      content: [{
        type: 'text/plain',
        value: email.body
      }]
    });

    const options = {
      hostname: 'api.sendgrid.com',
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.emailApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // SendGrid returns 202 Accepted with no body on success
          resolve({ id: res.headers['x-message-id'] || 'sendgrid-success' });
        } else {
          reject(new Error(`SendGrid API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send email using console (for testing)
 */
async function sendWithConsole(email) {
  console.log('\n' + '='.repeat(60));
  console.log('📧 EMAIL PREVIEW (console mode)');
  console.log('='.repeat(60));
  console.log('From:', CONFIG.fromEmail);
  console.log('To:', email.recipient_email);
  console.log('Subject:', email.subject);
  console.log('-'.repeat(60));
  console.log(email.body);
  console.log('='.repeat(60) + '\n');
  return Promise.resolve({ id: 'console-test' });
}

/**
 * Send a single email
 */
async function sendEmail(email) {
  console.log(`📤 Sending email to ${email.recipient_email}...`);
  
  try {
    let result;
    
    switch (CONFIG.emailService) {
      case 'resend':
        result = await sendWithResend(email);
        break;
      case 'sendgrid':
        result = await sendWithSendGrid(email);
        break;
      case 'console':
        result = await sendWithConsole(email);
        break;
      default:
        throw new Error(`Unsupported email service: ${CONFIG.emailService}`);
    }
    
    await updateEmailStatus(email.id, 'SENT');
    console.log(`✅ Email sent successfully (ID: ${email.id})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email ${email.id}:`, error.message);
    await updateEmailStatus(email.id, 'FAILED', error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Card Show Finder Email Sender');
  console.log('📧 Email Service:', CONFIG.emailService);
  console.log('🔗 Supabase URL:', CONFIG.supabaseUrl);
  console.log('');

  try {
    // Fetch pending emails
    console.log('🔍 Fetching pending emails...');
    const emails = await fetchPendingEmails();
    
    if (emails.length === 0) {
      console.log('✨ No pending emails to send.');
      return;
    }

    console.log(`📬 Found ${emails.length} pending email(s)\n`);

    // Send each email
    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      const success = await sendEmail(email);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      
      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main, sendEmail };
