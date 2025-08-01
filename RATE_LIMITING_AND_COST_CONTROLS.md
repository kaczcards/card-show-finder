# Rate Limiting and Cost Controls in the Enhanced Scraper

## Overview

The enhanced card show scraper includes robust rate limiting and cost control mechanisms to prevent unexpected API charges and ensure responsible usage of external services. This document explains the implemented controls and how to manage them effectively.

## Cost Control Measures

The scraper uses two primary external APIs that have associated costs:

1. **Google AI (Gemini) API** - Used for extracting structured data from HTML content
   - Pricing: ~$0.0001 per 1K characters (varies by model)
   - Primary cost driver: Number and size of HTML chunks processed

2. **Google Maps Geocoding API** - Used for converting addresses to coordinates
   - Pricing: ~$0.005 per geocoding request
   - Primary cost driver: Number of shows geocoded

## Specific Rate Limits Implemented

### Google AI (Gemini) API Limits

```javascript
const AI_REQUEST_DELAY_MS = 2000;  // 2 seconds between AI requests
const MAX_AI_REQUESTS = 10;        // Maximum 10 AI requests per run
const MAX_HTML_SIZE = 8000;        // 8 KB per chunk (reduced from 100 KB)
const AI_TIMEOUT_MS = 10000;       // 10-second timeout per request
```

These settings limit the scraper to:
- Maximum 10 AI requests per scraper run
- Maximum 30 requests per minute (due to 2-second delay)
- Maximum 80 KB of HTML processed per run (10 chunks × 8 KB)

### Google Maps Geocoding API Limits

```javascript
const GEOCODE_REQUEST_DELAY_MS = 1000;  // 1 second between geocoding requests
const MAX_GEOCODING_REQUESTS = 20;      // Maximum 20 geocoding requests per run
```

These settings limit the scraper to:
- Maximum 20 geocoding requests per scraper run
- Maximum 60 requests per minute (due to 1-second delay)

## Monitoring and Adjusting Costs

### Monitoring API Usage

1. **Google Cloud Console**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" → "Dashboard"
   - Select the specific API (Gemini API or Geocoding API)
   - View usage metrics and quotas

2. **Scraper Logs**
   - Run the scraper with `--verbose` flag to see detailed logs
   - Look for "Rate limiting" messages that indicate when limits are being applied
   - Monitor the number of chunks processed and shows geocoded

### Cost Estimation

#### Typical Run Costs

For a single URL scrape with default settings:

1. **Gemini API**: 
   - Maximum 10 chunks × 8 KB = 80 KB ≈ $0.008
   - Typical usage (3 chunks): $0.0024

2. **Geocoding API**:
   - Maximum 20 geocoding requests × $0.005 = $0.10
   - Typical usage (5-10 shows): $0.025-$0.05

3. **Total estimated cost per URL**: $0.03-$0.11

### Adjusting Cost Controls

To reduce costs further:
- Use `--no-geocode` flag to disable geocoding
- Reduce `MAX_AI_REQUESTS` and `MAX_GEOCODING_REQUESTS` constants
- Increase delay values to reduce request frequency

To allow higher usage (with higher costs):
- Increase `MAX_AI_REQUESTS` and `MAX_GEOCODING_REQUESTS` constants
- Decrease delay values (not recommended below 1000ms)

## Safety Measures

The scraper includes multiple layers of protection:

1. **Hard Caps**: Absolute limits on the number of API requests per run
2. **Rate Limiting**: Enforced delays between requests to prevent API abuse
3. **Timeout Controls**: Prevent hanging requests that could increase costs
4. **Dry Run Mode**: Test extraction without saving to database using `--dry-run`
5. **Selective Geocoding**: Only geocodes shows with sufficient address information
6. **Verbose Logging**: Clear visibility into API usage with `--verbose` flag

## Modifying Rate Limits

To modify the rate limits, edit the constants at the top of `enhanced-scraper.js`:

```javascript
// To increase API usage (and costs)
const MAX_AI_REQUESTS = 20;        // Increased from 10
const MAX_GEOCODING_REQUESTS = 40; // Increased from 20

// To reduce API usage (and costs)
const MAX_AI_REQUESTS = 5;         // Reduced from 10
const MAX_GEOCODING_REQUESTS = 10; // Reduced from 20
```

## Best Practices for Production Use

1. **Start Small**:
   - Begin with restrictive limits and gradually increase as needed
   - Test with `--dry-run` to understand API usage patterns

2. **Set Budget Alerts**:
   - Configure billing alerts in Google Cloud Console
   - Set daily/monthly budget caps to prevent surprises

3. **Batch Processing**:
   - Schedule scraping during off-peak hours
   - Spread large batches across multiple days

4. **Selective Scraping**:
   - Use `--state` filter to process URLs by state
   - Prioritize high-quality sources that yield more shows

5. **Monitoring**:
   - Regularly check Google Cloud Console for usage metrics
   - Review scraper logs to identify optimization opportunities

6. **Geocoding Optimization**:
   - Consider running without geocoding initially (`--no-geocode`)
   - Add geocoding in a separate pass for only validated shows

7. **API Key Security**:
   - Use API key restrictions in Google Cloud Console
   - Limit API key usage to specific IPs or referrers

## Command Examples

### Cost-Conscious Usage

```bash
# No geocoding (saves ~$0.10 per run)
node scraper/enhanced-scraper.js --url "https://example.com/shows" --no-geocode

# Dry run to test extraction without saving
node scraper/enhanced-scraper.js --url "https://example.com/shows" --dry-run --verbose

# Process only shows from a specific state
node scraper/enhanced-scraper.js --state TX --no-geocode
```

### Production Usage

```bash
# Full processing with geocoding (most expensive)
node scraper/enhanced-scraper.js --url "https://example.com/shows"

# Batch processing with verbose logging
node scraper/enhanced-scraper.js --state CA --verbose
```

## Conclusion

The enhanced scraper's rate limiting and cost control mechanisms provide a balanced approach to extracting card show data while preventing unexpected API charges. By understanding and properly configuring these controls, you can optimize your scraping operations for both cost and effectiveness.

For any questions or concerns about API usage and costs, consult the [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator) or contact Google Cloud Support.
