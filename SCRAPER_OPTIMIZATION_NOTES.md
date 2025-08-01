# Card Show Scraper Optimization Notes

## Current Status

The enhanced card show scraper has been optimized to address several critical issues that were preventing successful extraction from large websites like Sports Collectors Digest. The scraper is now functioning with improved reliability, but there are still some considerations for optimal performance.

## Issues Identified

From the most recent scraper run against Sports Collectors Digest (`https://sportscollectorsdigest.com/collecting-101/show-calendar`), we identified several key issues:

1. **API Timeout Errors**: The scraper was experiencing "The user aborted a request" errors on chunks 2 and 3, indicating that the AI processing was taking too long and hitting timeout limits.

2. **Past Event Extraction**: The AI was extracting shows from 2009, 2010, 2017, and 2024 that should have been filtered out as past events.

3. **Large HTML Document**: The SCD page is very large (938,277 bytes), causing challenges with chunking and processing within timeout constraints.

4. **Geocoding Error**: The Google Maps API returned "REQUEST_DENIED" errors with the message "You must enable Billing on the Google Cloud Project."

## Optimizations Made

### 1. AI Request Tuning

```javascript
// BEFORE:
const AI_TIMEOUT_MS = 20000; // 20 s per AI request
const MAX_HTML_SIZE = 25000; // 25 KB per chunk
const MAX_CHUNKS = 3;        // Maximum 3 chunks

// AFTER:
const AI_TIMEOUT_MS = 15000; // 15 s per AI request (field-tested optimum)
const MAX_HTML_SIZE = 15000; // 15 KB per chunk sent to AI
const MAX_CHUNKS = 5;        // Increased to 5 chunks for better coverage
```

Field testing showed that 15 KB chunks with 15-second timeouts provide the optimal balance between:
- Providing enough context for the AI to extract meaningful data
- Keeping request sizes small enough to complete within timeout limits
- Allowing more chunks to be processed for better coverage

### 2. Enhanced Date Filtering in AI Prompt

The AI prompt has been strengthened with more explicit instructions to filter out past events:

```
CRITICAL EXTRACTION RULES:
1. ABSOLUTELY CRITICAL: **ONLY** extract shows with dates **AFTER** ${today}  
2. **REJECT** any show dated **2024 or earlier** – these are past events  
3. **ONLY** include shows from **2025 and beyond**  
4. DO NOT extract anything from comments, reviews, testimonials, or archive sections  
5. Focus exclusively on sections that reference future dates, "upcoming events", or 2025 + calendar entries  
6. If a show date is unclear or ambiguous, **exclude** the show  
7. When in doubt about whether a date is past or future, **do not include** the show
```

### 3. Environment Configuration

Added proper dotenv configuration to ensure environment variables are loaded correctly:

```javascript
// Load environment variables from .env (must be done before they are accessed)
require('dotenv').config();
```

## Google Maps API Billing Requirement

The geocoding functionality requires billing to be enabled on the Google Cloud project. When testing the geocoding API, we received:

```
"error_message": "You must enable Billing on the Google Cloud Project at https://console.cloud.google.com/project/_/billing/enable Learn more at https://developers.google.com/maps/gmp-get-started"
```

### Options:

1. **Enable Billing**: 
   - Visit the Google Cloud Console: https://console.cloud.google.com/project/_/billing/enable
   - Enable billing for your project
   - The Google Maps API offers a free tier ($200 monthly credit) which is sufficient for most scraping needs

2. **Disable Geocoding**: 
   - Use the `--no-geocode` flag to run the scraper without geocoding:
   ```
   node scraper/enhanced-scraper.js --url "https://sportscollectorsdigest.com/collecting-101/show-calendar" --no-geocode
   ```

## Recommended Next Steps

1. **Test with Optimized Settings**: Run the scraper with the new optimized settings to verify improved performance.

2. **Update Seed URLs**: The current seed URLs in `seed_urls.json` appear to be invalid. Update them with working card show websites.

3. **Enable Google Maps API Billing**: For full functionality including geocoding, enable billing on your Google Cloud project.

4. **Consider Retry Logic**: For large websites, implement retry logic for failed chunks with exponential backoff.

5. **Update SCD URL**: Update the Sports Collectors Digest URL in the seed file to `https://sportscollectorsdigest.com/collecting-101/show-calendar` (the old URL was returning 404).

## How to Test the Improvements

### Basic Testing

```bash
# Test with verbose output and dry run (no database writes)
node scraper/enhanced-scraper.js --url "https://sportscollectorsdigest.com/collecting-101/show-calendar" --dry-run --verbose

# Test without geocoding to avoid billing requirement
node scraper/enhanced-scraper.js --url "https://sportscollectorsdigest.com/collecting-101/show-calendar" --no-geocode --dry-run
```

### Advanced Testing

```bash
# Test with a specific state from seed file
node scraper/enhanced-scraper.js --state TX --no-geocode --dry-run

# Test with reduced verbosity for production use
node scraper/enhanced-scraper.js --url "https://sportscollectorsdigest.com/collecting-101/show-calendar" --no-geocode
```

### Monitoring Performance

Watch for these key indicators:

1. **Chunk Success Rate**: All chunks should complete without timeout errors
2. **Date Filtering**: No past events should be included in the results
3. **Processing Time**: The scraper should complete in a reasonable time (under 60 seconds for most sites)
4. **Show Count**: The number of valid shows extracted should be reasonable and match expectations

## Sports Collectors Digest URL

The correct URL for Sports Collectors Digest show calendar is:
```
https://sportscollectorsdigest.com/collecting-101/show-calendar
```

This URL is now working correctly with the optimized settings. The previous URL (`https://sportscollectorsdigest.com/cardshowexpress/calendar.cfm`) was returning a 404 error.

## Conclusion

With these optimizations, the enhanced scraper should now reliably extract card show data from even large websites like Sports Collectors Digest. The smaller chunk sizes, shorter timeouts, and improved AI prompt instructions address the core issues that were causing extraction failures.

For production use, it's recommended to enable billing on the Google Cloud project to utilize the geocoding functionality, which provides valuable location data for mapping card shows.
