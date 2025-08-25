import { supabase } from '../supabase';

/**
 * Search for organizers by name or email
 * 
 * @param query Search query string (partial match against first_name, last_name, or email)
 * @param limit Maximum number of results to return
 * @returns Array of matching organizer profiles
 */
export const searchOrganizers = async (
  query: string,
  limit = 20
): Promise<Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>> => {
  try {
    const searchTerm = `%${query}%`;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('account_type', 'organizer')
      .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(limit);
    
    if (error) {
      console.error('Error searching organizers:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Unexpected error in searchOrganizers:', error);
    return [];
  }
};

/**
 * Generate a random alphanumeric code
 * 
 * @param prefix Prefix for the code (default: 'ORG-')
 * @param len Length of the random part (default: 8)
 * @returns Random uppercase alphanumeric code
 */
export const generateRandomCode = (prefix = 'ORG-', len = 8): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omitting similar-looking chars (O/0, I/1)
  let result = prefix;
  
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * Create a referral code for an organizer
 * 
 * @param organizerId UUID of the organizer
 * @param code Optional custom code (if not provided, a random code will be generated)
 * @param opts Additional options (applies_to, discount_type, expires_at, active)
 * @returns Object containing the created code
 */
export const createReferralCodeForOrganizer = async (
  organizerId: string,
  code?: string,
  opts?: {
    appliesTo?: 'dealer' | 'organizer' | 'both';
    discountType?: 'free_month';
    expiresAt?: string;
    active?: boolean;
  }
): Promise<{ code: string }> => {
  // Default options
  const appliesTo = opts?.appliesTo || 'both';
  const discountType = opts?.discountType || 'free_month';
  const expiresAt = opts?.expiresAt || '2025-12-31 23:59:59+00';
  const active = opts?.active !== undefined ? opts.active : true;
  
  // If no code provided, generate a random one
  let finalCode = code ? code.toUpperCase() : generateRandomCode();
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      const { data: _data, error } = await supabase
        .from('referral_codes')
        .insert({
          code: finalCode,
          organizer_id: organizerId,
          applies_to: appliesTo,
          discount_type: discountType,
          expires_at: expiresAt,
          active: active,
        })
        .select('code')
        .single();
      
      if (error) {
        // Check if it's a unique violation (duplicate code)
        if (error.code === '23505' && !code) {
          // Only retry with a new random code if we generated it (not if user provided it)
          attempts++;
          finalCode = generateRandomCode();
          continue;
        }
        throw error;
      }
      
      return { code: finalCode };
    } catch (error) {
      console.error('Error creating referral code:', error);
      if (attempts >= maxAttempts - 1) {
        throw new Error('Failed to create referral code after multiple attempts');
      }
      attempts++;
      if (!code) {
        finalCode = generateRandomCode();
      }
    }
  }
  
  throw new Error('Failed to create referral code');
};

/**
 * Get existing referral codes for an organizer
 * 
 * @param organizerId UUID of the organizer
 * @returns Array of code strings
 */
export const getExistingCodesForOrganizer = async (
  organizerId: string
): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching existing codes:', error);
      throw error;
    }
    
    return data ? data.map(item => item.code) : [];
  } catch (error) {
    console.error('Unexpected error in getExistingCodesForOrganizer:', error);
    return [];
  }
};
