/**
 * test-state-filtering.js
 * 
 * This script demonstrates how to use the state filtering functionality
 * in the scraper-agent Edge Function. It shows examples of different ways
 * to call the function and expected responses.
 * 
 * NOTE: This is a demonstration script, not actual executable tests.
 */

// Base URL for the scraper-agent Edge Function
const FUNCTION_URL = 'https://your-project-ref.supabase.co/functions/v1/scraper-agent';

// Example 1: Call without state parameter (original behavior)
// This will process all enabled sources based on priority
console.log('Example 1: Call without state parameter');
console.log(`curl -X GET "${FUNCTION_URL}"`);
console.log('Expected response:');
console.log(`{
  "message": "Scraper completed in 12.45s. Processed 7 URLs with 6 successful scrapes. Found 23 shows.",
  "results": [
    { "url": "https://example.com/shows", "success": true, "showCount": 5 },
    { "url": "https://cardshows.org", "success": true, "showCount": 8 },
    ...
  ]
}`);

// Example 2: Call with state=IN parameter (Indiana only)
console.log('\nExample 2: Call with state=IN parameter');
console.log(`curl -X GET "${FUNCTION_URL}?state=IN"`);
console.log('Expected response:');
console.log(`{
  "message": "Scraper completed in 5.32s. Processed 2 URLs with 2 successful scrapes. Found 7 shows.",
  "state": "IN",
  "results": [
    { "url": "https://indianacardshows.com", "success": true, "showCount": 4 },
    { "url": "https://midwest-collectibles.com/indiana", "success": true, "showCount": 3 }
  ]
}`);

// Example 3: Call with lowercase state parameter (case-insensitive)
console.log('\nExample 3: Call with lowercase state parameter');
console.log(`curl -X GET "${FUNCTION_URL}?state=in"`);
console.log('Expected response: Same as Example 2 (case-insensitive matching)');

// Example 4: Call with partial state name (will be truncated to 2 letters)
console.log('\nExample 4: Call with partial state name');
console.log(`curl -X GET "${FUNCTION_URL}?state=Indiana"`);
console.log('Expected response: Same as Example 2 (truncated to "IN")');

// Example 5: Call with state that has no sources
console.log('\nExample 5: Call with state that has no sources');
console.log(`curl -X GET "${FUNCTION_URL}?state=ZZ"`);
console.log('Expected response:');
console.log(`{
  "message": "No URLs found for state ZZ."
}`);

// Node.js fetch examples

console.log('\nNode.js fetch examples:');
console.log(`
// Example 1: Fetch without state parameter
fetch('${FUNCTION_URL}')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));

// Example 2: Fetch with state parameter (Indiana)
fetch('${FUNCTION_URL}?state=IN')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));

// Example 3: Fetch with state parameter using URL constructor
const url = new URL('${FUNCTION_URL}');
url.searchParams.append('state', 'IN');
fetch(url)
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
`);

// CLI usage example
console.log('\nCLI usage example (using supabase CLI):');
console.log(`
# Run without state parameter
supabase functions invoke scraper-agent

# Run with state parameter (Indiana)
supabase functions invoke scraper-agent --query "state=IN"

# Run with state parameter (California)
supabase functions invoke scraper-agent --query "state=CA"
`);

/**
 * Implementation Notes:
 * 
 * 1. The state filter is applied to the 'state' column in the 'scraping_sources' table
 * 2. State filtering is case-insensitive (IN, in, In all work)
 * 3. State is normalized to 2-letter uppercase code (Indiana → IN)
 * 4. If no URLs match the state filter, a specific message is returned
 * 5. When state filter is used, the response includes a 'state' field
 * 
 * Database Requirements:
 * 
 * The 'scraping_sources' table should have a 'state' column that stores
 * 2-letter state codes (e.g., IN, CA, NY) for this feature to work properly.
 */
