#!/usr/bin/env node
/**
 * scraper/gemini-test.js
 * 
 * Diagnostic script to test Google Gemini API connectivity and troubleshoot 503 errors.
 * 
 * Usage:
 *   node scraper/gemini-test.js                     - Run basic API test
 *   node scraper/gemini-test.js --verbose           - Show detailed request/response info
 *   node scraper/gemini-test.js --model MODEL_NAME  - Test specific model (default: gemini-1.5-flash)
 *   node scraper/gemini-test.js --prompt "text"     - Use custom prompt text
 *   node scraper/gemini-test.js --html-file FILE    - Test with HTML from file
 */

// Import required modules
require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const minimist = require('minimist');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['model', 'prompt', 'html-file'],
  boolean: ['verbose', 'help'],
  alias: {
    v: 'verbose',
    m: 'model',
    p: 'prompt',
    f: 'html-file',
    h: 'help'
  },
  default: {
    model: 'gemini-1.5-flash',
    verbose: false
  }
});

// Constants
const AI_TIMEOUT_MS = 45000; // 45s timeout for API requests
const DEFAULT_PROMPT = "Respond with 'Hello, world!' to confirm the API is working.";

// Show help if requested
if (argv.help) {
  console.log(`
Gemini API Diagnostic Tool
=========================

Tests connectivity to Google's Gemini API and helps diagnose 503 errors.

Usage:
  node scraper/gemini-test.js [options]

Options:
  -v, --verbose             Show detailed request/response information
  -m, --model MODEL         Test specific model (default: gemini-1.5-flash)
  -p, --prompt "TEXT"       Use custom prompt text
  -f, --html-file FILE      Test with HTML content from file
  -h, --help                Show this help text

Examples:
  # Basic test with default settings
  node scraper/gemini-test.js

  # Test with verbose output
  node scraper/gemini-test.js --verbose

  # Test with gemini-pro model
  node scraper/gemini-test.js --model gemini-pro

  # Test with custom prompt
  node scraper/gemini-test.js --prompt "Summarize this text in 3 words."

  # Test with HTML file
  node scraper/gemini-test.js --html-file ./sample.html
`);
  process.exit(0);
}

// Utility functions
function log(message, data = null) {
  if (typeof data === 'object' && data !== null) {
    console.log(message);
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(message + (data ? `: ${data}` : ''));
  }
}

function logError(message, error) {
  console.error('\n' + '!'.repeat(80));
  console.error(`ERROR: ${message}`);
  
  if (error && typeof error === 'object') {
    if (error.message) console.error(`Message: ${error.message}`);
    if (error.stack && argv.verbose) console.error(`Stack: ${error.stack}`);
    if (error.response) {
      console.error(`Status: ${error.response.status} ${error.response.statusText}`);
      if (argv.verbose && error.response.headers) {
        console.error('Headers:');
        for (const [key, value] of Object.entries(error.response.headers.raw())) {
          console.error(`  ${key}: ${value}`);
        }
      }
    }
  } else {
    console.error(error);
  }
  
  console.error('!'.repeat(80));
}

// Check for API key
const apiKey = process.env.GOOGLE_AI_KEY;
if (!apiKey) {
  logError('Missing Google AI API key', 'Set GOOGLE_AI_KEY in your .env file');
  process.exit(1);
}

// Get prompt text
async function getPromptText() {
  // If HTML file is specified, read it
  if (argv['html-file']) {
    try {
      const htmlContent = fs.readFileSync(argv['html-file'], 'utf8');
      return `Extract structured data from this HTML:\n\n${htmlContent}`;
    } catch (error) {
      logError(`Failed to read HTML file: ${argv['html-file']}`, error);
      process.exit(1);
    }
  }
  
  // Use custom prompt if provided, otherwise use default
  return argv.prompt || DEFAULT_PROMPT;
}

// Test the Gemini API
async function testGeminiAPI(model, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  log(`Testing Gemini API with model: ${model}`);
  if (argv.verbose) {
    log('API URL:', url.replace(apiKey, 'API_KEY_REDACTED'));
    log('Prompt text (first 100 chars):', promptText.substring(0, 100) + (promptText.length > 100 ? '...' : ''));
  }
  
  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: { temperature: 0.2, topP: 0.8, topK: 40 }
  };
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    
    log('Sending request to Gemini API...');
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startTime;
    
    // Process response
    log(`Response received in ${elapsedMs}ms with status: ${response.status} ${response.statusText}`);
    
    if (argv.verbose) {
      log('Response headers:', Object.fromEntries(response.headers.entries()));
    }
    
    // Handle different status codes
    if (response.status === 200) {
      const data = await response.json();
      log('SUCCESS! API returned valid response');
      
      if (argv.verbose) {
        log('Response data:', data);
      } else {
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        log('Response text:', responseText || '(No text in response)');
      }
      
      return { success: true, model };
    } 
    else if (response.status === 503) {
      const errorText = await response.text();
      logError('Service Unavailable (503)', 'The Gemini API service is currently unavailable or overloaded.');
      log('Possible causes:');
      log('1. API quota exceeded');
      log('2. Service disruption or maintenance');
      log('3. Rate limiting');
      log('4. Region restrictions');
      
      if (errorText) {
        log('Error details:', errorText);
      }
      
      return { success: false, status: 503, model };
    }
    else if (response.status === 400) {
      const errorData = await response.json();
      logError('Bad Request (400)', 'The request was invalid or improperly formatted.');
      log('Error details:', errorData);
      log('Possible causes:');
      log('1. Invalid API key format');
      log('2. Malformed request body');
      log('3. Content policy violation in prompt');
      
      return { success: false, status: 400, model };
    }
    else if (response.status === 401) {
      logError('Unauthorized (401)', 'API key is invalid or missing permissions.');
      log('Possible causes:');
      log('1. API key is incorrect');
      log('2. API key has expired');
      log('3. Billing not enabled for this API key');
      log('4. Project not properly set up in Google Cloud');
      
      return { success: false, status: 401, model };
    }
    else if (response.status === 429) {
      logError('Too Many Requests (429)', 'You have exceeded your quota or rate limit.');
      log('Possible causes:');
      log('1. Quota exceeded for your API key');
      log('2. Too many requests in a short time period');
      log('3. Billing limits reached');
      
      return { success: false, status: 429, model };
    }
    else {
      const errorText = await response.text();
      logError(`Unexpected Status Code: ${response.status}`, errorText || 'No error details available');
      
      return { success: false, status: response.status, model };
    }
  } 
  catch (error) {
    if (error.name === 'AbortError') {
      logError('Request Timeout', `Request to Gemini API timed out after ${AI_TIMEOUT_MS/1000} seconds`);
      return { success: false, error: 'timeout', model };
    }
    
    logError('Request Failed', error);
    return { success: false, error: error.message, model };
  }
}

// Test with fallback models if primary fails
async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('GEMINI API DIAGNOSTIC TOOL');
  console.log('='.repeat(80));
  
  log('Environment check:');
  log('- Node.js version:', process.version);
  log('- API key present:', apiKey ? 'Yes' : 'No');
  log('- API key format:', apiKey ? (apiKey.startsWith('AI') ? 'Valid prefix' : 'Unusual prefix') : 'N/A');
  log('- API key length:', apiKey ? apiKey.length : 'N/A');
  
  const promptText = await getPromptText();
  log('Prompt length:', promptText.length + ' characters');
  
  // First test with specified/default model
  const primaryModel = argv.model;
  const result = await testGeminiAPI(primaryModel, promptText);
  
  // If primary model failed with 503, try fallback models
  if (!result.success && result.status === 503) {
    log('\nTrying fallback models...');
    
    const fallbackModels = ['gemini-pro', 'gemini-1.0-pro'];
    for (const fallbackModel of fallbackModels) {
      if (fallbackModel !== primaryModel) {
        log(`\nTesting with fallback model: ${fallbackModel}`);
        const fallbackResult = await testGeminiAPI(fallbackModel, promptText);
        
        if (fallbackResult.success) {
          log('\n' + '='.repeat(80));
          log(`SUCCESS WITH FALLBACK MODEL: ${fallbackModel}`);
          log(`Consider updating your code to use this model instead of ${primaryModel}`);
          log('='.repeat(80));
          process.exit(0);
        }
      }
    }
    
    log('\n' + '='.repeat(80));
    log('ALL MODELS FAILED - DIAGNOSTIC SUMMARY');
    log('='.repeat(80));
    log('1. Confirmed 503 errors across multiple Gemini models');
    log('2. This suggests a service-wide issue or account-specific restriction');
    log('3. Recommended actions:');
    log('   - Check your Google Cloud Console for quota limits or billing issues');
    log('   - Verify the API is enabled for your project');
    log('   - Try again later as this could be temporary');
    log('   - Contact Google AI support if the issue persists');
    process.exit(1);
  }
  
  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run the tests
runTests().catch(error => {
  logError('Unhandled error', error);
  process.exit(1);
});
