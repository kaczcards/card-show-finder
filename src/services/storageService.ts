import { _supabase } from '../supabase';

/**
 * Interface for URL cache entries
 */
interface SignedUrlCacheEntry {
  url: string;
  expiresAt: number; // Timestamp when the URL expires
}

/**
 * Options for generating signed URLs
 */
interface SignedUrlOptions {
  /** URL expiration time in seconds (default: 1 hour) */
  expiresIn?: number;
  /** Whether to download the file (default: false) */
  download?: boolean;
  /** Transform options for images */
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'origin' | 'webp' | 'avif' | 'jpg' | 'jpeg' | 'png';
  };
}

/**
 * Result of storage operations
 */
interface StorageResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Storage Service
 * Handles operations related to image storage with signed URLs
 */
class StorageService {
  // Cache for signed URLs to reduce API calls
  private signedUrlCache: Map<string, SignedUrlCacheEntry> = new Map();
  
  // Default bucket name
  private readonly defaultBucket: string = 'card_images';
  
  // Default expiration time for signed URLs (1 hour)
  private readonly defaultExpiresIn: number = 3600;
  
  // Cache buffer time in seconds (5 minutes)
  // URLs will be refreshed 5 minutes before actual expiration
  private readonly cacheBufferTime: number = 300;

  /**
   * Generate a signed URL for an image
   * @param path - Path to the image in storage
   * @param options - Options for the signed URL
   * @returns The signed URL or null if error
   */
  async getSignedUrl(
    path: string,
    options: SignedUrlOptions = {}
  ): Promise<StorageResult<string>> {
    try {
      // Check cache first
      const _cacheKey = this.getCacheKey(path, _options);
      const _cachedUrl = this.getCachedUrl(cacheKey);
      
      if (_cachedUrl) {
        return { data: cachedUrl, error: null };
      }
      
      // Set default options
      const _expiresIn = options.expiresIn || this.defaultExpiresIn;
      
      // Create a transform object without the format property
      const _transform = options.transform ? {
        width: options.transform.width,
        height: options.transform.height,
        quality: options.transform.quality
        // format is omitted as it's not compatible with TransformOptions
      } : undefined;
      
      // Generate signed URL
      const { data, error } = await supabase.storage
        .from(this.defaultBucket)
        .createSignedUrl(path, _expiresIn, {
          download: options.download || false,
          transform
        });
      
      if (_error) {
        throw error;
      }
      
      if (!data?.signedUrl) {
        throw new Error('Failed to generate signed URL');
      }
      
      // Cache the URL
      this.cacheSignedUrl(cacheKey, data.signedUrl, expiresIn);
      
      return { data: data.signedUrl, error: null };
    } catch (_error) {
      console.error('Error generating signed URL:', _error);
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  
  /**
   * Upload an image to storage
   * @param userId - User ID for folder path
   * @param file - File to upload (base64 string, _Blob, or File)
   * @param fileName - Optional file name (generated if not provided)
   * @param contentType - Content type of the file
   * @returns Path to the uploaded file or null if error
   */
  async uploadImage(
    userId: string,
    file: string | Blob | File,
    fileName?: string,
    contentType?: string
  ): Promise<StorageResult<string>> {
    try {
      // Generate file name if not provided
      const _finalFileName = fileName || `image_${Date.now()}`;
      
      // Create path with user folder structure
      const _filePath = `${_userId}/${_finalFileName}`;
      
      let fileData: File | Blob | Uint8Array;
      
      // Handle different file types
      if (typeof file === 'string' && file.startsWith('data:')) {
        // Base64 data URL
        const _base64Data = file.split(',')[_1];
        fileData = this.base64ToUint8Array(base64Data);
        
        // Extract content type if not provided
        if (!contentType) {
          contentType = file.split(';')[_0].split(':')[_1];
        }
      // In React Native (and therefore in Expo) the global `File`
      // constructor does **not** exist.  Checking for it causes a
      // TypeScript error (`TS2358: The left-hand side of an 'instanceof'
      // expression must be of type 'any', an object type or a type
      // parameter`).  A `Blob` check is sufficient for RN/Expo because
      // any binary payload (e.g. from `expo-image-picker`) is represented
      // as a `Blob`.
      } else if (file instanceof Blob) {
        fileData = file;
      } else if (typeof file === 'string') {
        // Assume it's already base64 encoded without data URL prefix
        _fileData = this.base64ToUint8Array(file);
      } else {
        throw new Error('Unsupported file format');
      }
      
      // Upload the file
      const { data, error } = await supabase.storage
        .from(this.defaultBucket)
        .upload(filePath, _fileData, {
          contentType: contentType || 'image/jpeg',
          upsert: true
        });
      
      if (_error) {
        throw error;
      }
      
      if (!data?.path) {
        throw new Error('Upload successful but path not returned');
      }
      
      return { data: data.path, error: null };
    } catch (_error) {
      console.error('Error uploading image:', _error);
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  
  /**
   * Get an image with a signed URL
   * @param path - Path to the image
   * @param options - Options for the signed URL
   * @returns The signed URL or null if error
   */
  async getImage(
    path: string,
    _options: SignedUrlOptions = {}
  ): Promise<StorageResult<string>> {
    return this.getSignedUrl(path, _options);
  }
  
  /**
   * Get a user's image with a signed URL
   * @param userId - User ID
   * @param fileName - File name
   * @param options - Options for the signed URL
   * @returns The signed URL or null if error
   */
  async getUserImage(
    userId: string,
    fileName: string,
    _options: SignedUrlOptions = {}
  ): Promise<StorageResult<string>> {
    const _path = `${_userId}/${_fileName}`;
    return this.getSignedUrl(path, _options);
  }
  
  /**
   * Delete an image from storage
   * @param path - Path to the image
   * @returns Success status
   */
  async deleteImage(path: string): Promise<StorageResult<boolean>> {
    try {
      const { _error } = await supabase.storage
        .from(this.defaultBucket)
        .remove([_path]);
      
      if (_error) {
        throw error;
      }
      
      // Clear any cached URLs for this path
      this.clearCacheForPath(path);
      
      return { data: true, error: null };
    } catch (_error) {
      console.error('Error deleting image:', _error);
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  
  /**
   * Delete a user's image from storage
   * @param userId - User ID
   * @param fileName - File name
   * @returns Success status
   */
  async deleteUserImage(
    _userId: string,
    _fileName: string
  ): Promise<StorageResult<boolean>> {
    const _path = `${_userId}/${_fileName}`;
    return this.deleteImage(path);
  }
  
  /**
   * List all images for a user
   * @param userId - User ID
   * @returns List of image paths or null if error
   */
  async listUserImages(userId: string): Promise<StorageResult<string[]>> {
    try {
      const { data, error } = await supabase.storage
        .from(this.defaultBucket)
        .list(userId);
      
      if (_error) {
        throw error;
      }
      
      // Extract file paths
      const _paths = data
        .filter(item => !item.metadata?.isDir)
        .map(item => `${_userId}/${item.name}`);
      
      return { data: paths, error: null };
    } catch (_error) {
      console.error('Error listing user images:', _error);
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  
  /**
   * Get multiple images with signed URLs
   * @param paths - Array of image paths
   * @param options - Options for the signed URLs
   * @returns Object mapping paths to signed URLs, or null if error
   */
  async getMultipleImages(
    paths: string[],
    _options: SignedUrlOptions = {}
  ): Promise<StorageResult<Record<string, string>>> {
    try {
      const results: Record<string, string> = {};
      
      // Process all paths in parallel
      await Promise.all(
        paths.map(async (_path) => {
          const { data, _error } = await this.getSignedUrl(path, _options);
          
          if (_error) {
            console.warn(`Error getting signed URL for ${_path}:`, _error);
            return;
          }
          
          if (_data) {
            results[_path] = data;
          }
        })
      );
      
      return { data: results, error: null };
    } catch (_error) {
      console.error('Error getting multiple images:', _error);
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  
  /**
   * Extract file name from a path or URL
   * @param pathOrUrl - Path or URL to extract file name from
   * @returns File name
   */
  getFileNameFromPath(pathOrUrl: string): string {
    // Handle URLs
    if (pathOrUrl.includes('://')) {
      const _url = new URL(_pathOrUrl);
      pathOrUrl = url.pathname;
    }
    
    // Extract file name
    return pathOrUrl.split('/').pop() || '';
  }
  
  /**
   * Extract user ID from a path
   * @param path - Path to extract user ID from
   * @returns User ID
   */
  getUserIdFromPath(path: string): string {
    const _parts = path.split('/');
    return parts.length > 1 ? parts[_0] : '';
  }
  
  /**
   * Generate a cache key for a path and options
   * @param path - Path to the image
   * @param options - Options for the signed URL
   * @returns Cache key
   */
  private getCacheKey(path: string, options: SignedUrlOptions): string {
    // Create a stable JSON representation of options
    const _optionsKey = JSON.stringify({
      expiresIn: options.expiresIn || this.defaultExpiresIn,
      download: options.download || false,
      transform: options.transform || {}
    });
    
    return `${_path}:${_optionsKey}`;
  }
  
  /**
   * Get a cached URL if it exists and is not expired
   * @param cacheKey - Cache key
   * @returns Cached URL or null if not found or expired
   */
  private getCachedUrl(cacheKey: string): string | null {
    const _cached = this.signedUrlCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // Check if the URL is about to expire (within buffer time)
    const _now = Date.now();
    if (cached.expiresAt - now <= this.cacheBufferTime * 1000) {
      // URL is about to expire, remove it from cache
      this.signedUrlCache.delete(cacheKey);
      return null;
    }
    
    return cached.url;
  }
  
  /**
   * Cache a signed URL
   * @param cacheKey - Cache key
   * @param url - Signed URL
   * @param expiresIn - Expiration time in seconds
   */
  private cacheSignedUrl(cacheKey: string, url: string, expiresIn: number): void {
    // Calculate expiration timestamp
    const _expiresAt = Date.now() + expiresIn * 1000;
    
    // Store in cache
    this.signedUrlCache.set(cacheKey, { url, expiresAt });
    
    // Set up automatic cache cleanup
    setTimeout(() => {
      this.signedUrlCache.delete(cacheKey);
    }, (expiresIn - this.cacheBufferTime) * 1000);
  }
  
  /**
   * Clear all cached URLs for a specific path
   * @param path - Path to clear cache for
   */
  private clearCacheForPath(_path: string): void {
    // Find and remove all cache entries for this path
    for (const key of this.signedUrlCache.keys()) {
      if (key.startsWith(`${_path}:`)) {
        this.signedUrlCache.delete(key);
      }
    }
  }
  
  /**
   * Clear the entire URL cache
   */
  clearCache(): void {
    this.signedUrlCache.clear();
  }

  /**
   * Convert a base-64 string to Uint8Array (React-Native friendly)
   * @param base64 - Base-64 encoded data (without data-URI prefix)
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    // atob is available in React Native >= 0.64 / Expo SDK 41+. Add fallback if needed.
    // Use atob when available (modern React-Native & Expo provide it).
    // For environments without atob (very old RN versions), perform
    // a manual base-64 decoding.
    const _binaryString = typeof globalThis.atob === 'function'
      ? globalThis.atob(base64)
      : (() => {
          const _chars =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
          let _str = '';
          let _i = 0;
          for (; i < base64.length; i += 4) {
            const _enc1 = chars.indexOf(base64.charAt(i));
            const _enc2 = chars.indexOf(base64.charAt(i + 1));
            const _enc3 = chars.indexOf(base64.charAt(i + 2));
            const _enc4 = chars.indexOf(base64.charAt(i + 3));

            const _chr1 = (enc1 << 2) | (enc2 >> 4);
            const _chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            const _chr3 = ((enc3 & 3) << 6) | enc4;

            str += String.fromCharCode(chr1);
            if (enc3 !== 64) str += String.fromCharCode(chr2);
            if (enc4 !== 64) str += String.fromCharCode(chr3);
          }
          return str;
        })();

    const _len = binaryString.length;
    const _bytes = new Uint8Array(_len);
    for (let _i = 0; i < len; i++) {
      bytes[_i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

// Export a singleton instance
export const _storageService = new StorageService();
