export function normalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  return `https://${trimmed}`;
}

export function validateZip(zip?: string): string | undefined {
  if (!zip) return undefined;
  
  const digitsOnly = zip.replace(/\D/g, '');
  
  if (digitsOnly.length === 5) {
    return digitsOnly;
  }
  
  return undefined;
}

export function validatePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.length < 7) {
    return undefined;
  }
  
  // E.164 format for US numbers
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }
  
  return digitsOnly;
}

export function normalizeSocials(input: Record<string, any>): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  
  // Handle both snake_case and camelCase
  result.facebookUrl = normalizeUrl(input.facebookUrl || input.facebook_url);
  result.instagramUrl = normalizeUrl(input.instagramUrl || input.instagram_url);
  result.twitterUrl = normalizeUrl(input.twitterUrl || input.twitter_url);
  result.whatnotUrl = normalizeUrl(input.whatnotUrl || input.whatnot_url);
  result.ebayStoreUrl = normalizeUrl(input.ebayStoreUrl || input.ebay_store_url);
  
  return result;
}

export function validateProfileForm(fields: Record<string, any>): { 
  normalized: Record<string, any>; 
  errors: Record<string, string> 
} {
  const normalized: Record<string, any> = { ...fields };
  const errors: Record<string, string> = {};
  
  // Normalize social URLs
  const socials = normalizeSocials(fields);
  Object.assign(normalized, socials);
  
  // Validate ZIP
  const validZip = validateZip(fields.zip);
  if (fields.zip && !validZip) {
    errors.zip = 'Please enter a valid 5-digit ZIP code';
  }
  normalized.zip = validZip;
  
  // Validate phone
  const validPhone = validatePhone(fields.phone);
  if (fields.phone && !validPhone) {
    errors.phone = 'Please enter a valid phone number (at least 7 digits)';
  }
  normalized.phone = validPhone;
  
  return { normalized, errors };
}
