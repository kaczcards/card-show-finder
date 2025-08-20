import { Linking, Alert } from 'react-native';

/**
 * Options for opening external links
 */
export interface SafeLinkingOptions {
  /**
   * Optional array of allowed hostnames
   * If provided, only URLs with hostnames ending with one of these will be opened
   * Example: ['facebook.com', 'instagram.com']
   */
  whitelistHosts?: string[];
  
  /**
   * Whether to show an alert when a link cannot be opened
   * @default true
   */
  showErrorAlert?: boolean;
  
  /**
   * Custom error message for invalid URLs
   * @default 'The link appears to be invalid.'
   */
  errorMessage?: string;
}

/**
 * Default whitelist of common social media and marketplace domains
 */
export const DEFAULT_WHITELIST_HOSTS = [
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'whatnot.com',
  'ebay.com'
];

/**
 * Safely opens an external URL with validation and optional domain whitelisting
 * 
 * @param rawUrl - The URL to open
 * @param opts - Optional configuration
 * @returns Promise resolving to true if URL was opened successfully, false otherwise
 * 
 * @example
 * // Open any http/https URL
 * openExternalLink('https://example.com');
 * 
 * @example
 * // Only open specific domains
 * openExternalLink('instagram.com/username', { 
 *   whitelistHosts: ['instagram.com', 'facebook.com'] 
 * });
 */
export async function openExternalLink(
  rawUrl: string, 
  opts?: SafeLinkingOptions
): Promise<boolean> {
  // Default options
  const options: Required<SafeLinkingOptions> = {
    whitelistHosts: DEFAULT_WHITELIST_HOSTS,
    showErrorAlert: true,
    errorMessage: 'The link appears to be invalid.',
    ...opts
  };
  
  // Trim input; if empty return false
  const trimmedUrl = rawUrl?.trim();
  if (!trimmedUrl) return false;
  
  // Prepare URL with protocol if missing
  let formattedUrl = trimmedUrl;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`;
  }
  
  try {
    // Parse with URL to validate and extract components
    const parsedUrl = new URL(formattedUrl);
    
    // Only allow http/https schemes
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
    }
    
    // Check against whitelist if provided
    if (options.whitelistHosts && options.whitelistHosts.length > 0) {
      const isWhitelisted = options.whitelistHosts.some(host => 
        parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`)
      );
      
      if (!isWhitelisted) {
        throw new Error(`Domain not in whitelist: ${parsedUrl.hostname}`);
      }
    }
    
    // Check if URL can be opened
    const canOpen = await Linking.canOpenURL(formattedUrl);
    if (!canOpen) {
      throw new Error('URL cannot be opened by any app');
    }
    
    // Open the URL
    await Linking.openURL(formattedUrl);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[safeLinking] Error opening URL:', error);
    }
    
    // Show error alert if enabled
    if (options.showErrorAlert) {
      Alert.alert(
        'Unable to open link',
        options.errorMessage,
      );
    }
    
    return false;
  }
}

/**
 * Opens a social media profile URL
 * 
 * @param platform - The social media platform
 * @param handle - The username or handle (without @ symbol)
 * @returns Promise resolving to true if URL was opened successfully
 */
export function openSocialProfile(
  platform: 'facebook' | 'instagram' | 'twitter' | 'x' | 'whatnot' | 'ebay',
  handle: string
): Promise<boolean> {
  // Remove @ if present
  const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
  
  // Build the appropriate URL for each platform
  let url: string;
  switch (platform) {
    case 'facebook':
      url = `https://facebook.com/${cleanHandle}`;
      break;
    case 'instagram':
      url = `https://instagram.com/${cleanHandle}`;
      break;
    case 'twitter':
    case 'x':
      url = `https://twitter.com/${cleanHandle}`;
      break;
    case 'whatnot':
      url = `https://whatnot.com/user/${cleanHandle}`;
      break;
    case 'ebay':
      // For eBay, the handle could be a store name or a user ID
      url = `https://www.ebay.com/usr/${cleanHandle}`;
      break;
    default:
      return Promise.resolve(false);
  }
  
  return openExternalLink(url);
}
