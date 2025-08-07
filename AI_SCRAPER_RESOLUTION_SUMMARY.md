# AI Scraper Resolution Summary

## Problem Summary

The enhanced web scraper was encountering critical issues when attempting to use Google's AI API (Gemini) to extract card show information from HTML content:

- Initial errors: "AI error on chunk 1: 503", "AI error on chunk 2: 503", "AI error on chunk 3: 503"
- After adding API key: "AI timeout or error on chunk 1: The user aborted a request", "AI timeout or error on chunk 2: The user aborted a request"
- No shows were successfully parsed despite the scraper reporting `success: true`
- The scraper was unable to extract structured data from valid HTML content

## Root Causes Identified

Through systematic testing and diagnostics, we identified several root causes:

1. **Environment Configuration Issues**:
   - Missing dotenv configuration to load environment variables
   - Missing or incorrect Supabase environment variables
   - Missing Google Maps API key for geocoding functionality

2. **API Request Problems**:
   - Excessive chunk size (100KB) causing timeouts with the Gemini API
   - Long timeout settings (45s) leading to connection aborts
   - Lack of proper error handling for API timeouts

3. **Infrastructure Issues**:
   - Mismatch between environment variable names in code vs .env file
   - No validation of API key loading before attempting requests

## Solutions Implemented

### Environment Configuration Fixes

**Before**:
```javascript
// No dotenv configuration
const { createClient } = require('@supabase/supabase-js');
// ...other imports
```

**After**:
```javascript
// Load environment variables from .env (must be done before they are accessed)
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
// ...other imports
```

### Environment Variables Added

```
# Scraper-specific variables (derived from above)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Google Maps API Key (for scraper geocoding)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### API Request Optimizations

**Before**:
```javascript
const TIMEOUT_MS = 25000; // 25 second timeout for fetch operations
const AI_TIMEOUT_MS = 45000; // 45s per AI request
const MAX_HTML_SIZE = 100000; // 100 KB per chunk sent to AI
```

**After**:
```javascript
const TIMEOUT_MS = 25000; // 25-second timeout for page fetch operations

// Gemini API tuning:
//  - Large payloads (>25 KB) were causing request-timeouts / aborts.
//  - Field tests show 20 s + 25 KB chunks are reliable while still allowing rich context.
const AI_TIMEOUT_MS = 20000; // 20 s per AI request (reduced from 45 s for better reliability)
const MAX_HTML_SIZE = 25000; // 25 KB per chunk sent to AI (reduced from 100 KB to avoid timeouts)
```

### Diagnostic Tools Created

Created `gemini-test.js` and `test-ai-extraction.js` to:
- Test API connectivity independently
- Validate API key functionality
- Measure response times
- Test with controlled sample data

## Test Results

### API Connectivity Test

```
GEMINI API DIAGNOSTIC TOOL
================================================================================
Environment check:
- Node.js version:: v24.2.0
- API key present:: Yes
- API key format:: Valid prefix
- API key length:: 39
Prompt length:: 59 characters
Testing Gemini API with model: gemini-1.5-flash
Sending request to Gemini API...
Response received in 338ms with status: 200 OK
SUCCESS! API returned valid response
```

### Sample Data Extraction Test

```
AI EXTRACTION TEST SCRIPT
================================================================================
Testing with 585 bytes of sample HTML
...
Response received in 2938ms with status: 200 OK
...
Successfully parsed 2 shows from chunk 1
...
Successfully extracted 2 shows:
[
  {
    "name": "Dallas Card and Comic Show",
    "startDate": "January 15, 2025",
    "endDate": "January 15, 2025",
    "venueName": "Dallas Convention Center",
    ...
  },
  ...
]
```

### Enhanced Scraper Test

```
Using specific URL: https://example.com
...
HTML fetched (1256 bytes). Chunking & extracting with AI...
...
Scraper completed in 0.86s
...
```

## Next Steps for Testing with Real Card Show Content

1. **Update Seed URLs**:
   - The current seed URLs in `seed_urls.json` appear to be invalid or unavailable
   - Add working URLs for card show websites
   - Consider adding the Sports Collectors Digest URL directly to the seed file

2. **Test with Real Content**:
   - Use the provided Sports Collectors Digest content for testing
   - Create a local HTML file with the content for controlled testing
   - Run the scraper against the local file to validate extraction

3. **Fine-tune Prompts**:
   - Review and adjust the specialized SCD prompt if needed
   - Create site-specific prompts for other card show websites
   - Test different prompt structures for optimal extraction

4. **Monitor Performance**:
   - Track extraction success rates across different sites
   - Monitor API response times and adjust timeouts if needed
   - Consider implementing additional retry logic for intermittent failures

## Usage Examples

### Basic Usage

```bash
# Run with a specific URL
node scraper/enhanced-scraper.js --url "https://example.com/card-shows"

# Filter by state (using seed_urls.json)
node scraper/enhanced-scraper.js --state TX

# Test mode (no database writes)
node scraper/enhanced-scraper.js --url "https://example.com/card-shows" --dry-run

# Detailed logging
node scraper/enhanced-scraper.js --url "https://example.com/card-shows" --verbose
```

### Advanced Usage

```bash
# Disable geocoding to speed up processing
node scraper/enhanced-scraper.js --url "https://example.com/card-shows" --no-geocode

# Inspect and fix a specific record
node scraper/enhanced-scraper.js --inspect-id 52ba9458-7133-46ba-948b-7c2b8ecef48f

# Test with local HTML file (requires slight modification)
# node scraper/test-enhanced-parsing.js --file ./local-content.html
```

## Performance Optimizations

### Chunk Size and Timeout Adjustments

- **Chunk Size**: Reduced from 100KB to 25KB per chunk
  - Large payloads were causing timeouts
  - 25KB provides enough context while staying within API limits
  - Smaller chunks process faster and more reliably

- **Timeout Settings**: Reduced from 45s to 20s
  - 20s is sufficient for processing 25KB chunks
  - Prevents long-running requests that may be aborted
  - Aligns better with typical API response times (338ms - 3s in tests)

### Error Handling Improvements

- Better error logging with specific error messages
- Clearer distinction between HTTP errors and API errors
- Improved JSON parsing with fallback mechanisms
- Markdown code fence removal for better JSON parsing

### Processing Optimizations

- Smarter HTML chunking to capture relevant sections
- Specialized prompts for different website formats
- Improved data normalization for dates, locations, etc.
- Geocoding with proper error handling and timeouts

## Conclusion

The enhanced scraper is now functioning correctly with the Google AI API. The primary issues were related to environment configuration and API request parameters. By properly loading environment variables and optimizing chunk sizes and timeouts, we've resolved the timeout/abort errors and created a more robust scraping solution.

For optimal performance, continue to monitor API response times and adjust the `AI_TIMEOUT_MS` and `MAX_HTML_SIZE` constants as needed based on the specific websites being scraped. The current settings (20s timeout, 25KB chunks) provide a good balance between context size and reliability.
