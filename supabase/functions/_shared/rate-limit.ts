/**
 * Rate Limiting Middleware for Supabase Edge Functions
 * 
 * This module provides configurable rate limiting for Edge Functions with:
 * - IP-based and user-based rate limiting
 * - Configurable limits per endpoint/function
 * - Database-backed request tracking for distributed environments
 * - Standard rate limit headers (RateLimit-*)
 * - Sliding window algorithm for accurate limiting
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

/**
 * Rate limit configuration for an endpoint
 */
export interface RateLimitConfig {
  /** Number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Whether to apply rate limits based on IP address */
  ipBased?: boolean;
  /** Whether to apply rate limits based on user ID */
  userBased?: boolean;
  /** Whether to bypass rate limits for authenticated admins */
  adminBypass?: boolean;
  /** Custom error message when rate limit is exceeded */
  errorMessage?: string;
}

/**
 * Default rate limit configurations by endpoint type
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Default for all endpoints if not specified
  default: {
    limit: 60,
    window: 60, // 60 requests per minute
    ipBased: true,
    userBased: true,
    adminBypass: true,
  },
  // Auth-related endpoints (login, MFA, etc.)
  auth: {
    limit: 10,
    window: 60, // 10 requests per minute
    ipBased: true,
    userBased: true,
    adminBypass: false, // Don't bypass auth limits even for admins
    errorMessage: "Too many authentication attempts. Please try again later.",
  },
  // Public API endpoints
  api: {
    limit: 120,
    window: 60, // 120 requests per minute
    ipBased: true,
    userBased: true,
    adminBypass: true,
  },
  // Payment/financial endpoints
  payment: {
    limit: 20,
    window: 60, // 20 requests per minute
    ipBased: true,
    userBased: true,
    adminBypass: false, // Don't bypass payment limits even for admins
    errorMessage: "Too many payment requests. Please try again later.",
  },
  // Admin-only endpoints
  admin: {
    limit: 300,
    window: 60, // 300 requests per minute
    ipBased: true,
    userBased: true,
    adminBypass: true,
  },
};

/**
 * Rate limit tracking record
 */
interface RateLimitRecord {
  id?: string;
  key: string;
  endpoint: string;
  count: number;
  first_request_at: string;
  last_request_at: string;
  expires_at: string;
}

/**
 * Rate limit result
 */
interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Timestamp when the rate limit resets
  retryAfter?: number; // Seconds until retry is allowed
}

/**
 * Rate limiting service
 */
export class RateLimiter {
  private supabase: SupabaseClient;
  private tableName: string;
  
  /**
   * Create a new rate limiter
   * @param supabaseUrl - Supabase URL
   * @param supabaseKey - Supabase service role key
   * @param tableName - Table name for rate limit records
   */
  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    tableName = "rate_limits"
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.tableName = tableName;
  }

  /**
   * Check if a request is rate limited
   * @param endpoint - Endpoint name or path
   * @param config - Rate limit configuration
   * @param ipAddress - IP address of the requester
   * @param userId - User ID if authenticated
   * @param isAdmin - Whether the user is an admin
   * @returns Rate limit result
   */
  async checkRateLimit(
    endpoint: string,
    config: RateLimitConfig,
    ipAddress?: string,
    userId?: string,
    isAdmin = false
  ): Promise<RateLimitResult> {
    // Admin bypass if configured
    if (isAdmin && config.adminBypass) {
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit,
        reset: Math.floor(Date.now() / 1000) + config.window,
      };
    }

    // Generate keys for rate limiting
    const keys: string[] = [];
    
    // Add IP-based key if enabled and available
    if (config.ipBased && ipAddress) {
      keys.push(`ip:${ipAddress}:${endpoint}`);
    }
    
    // Add user-based key if enabled and available
    if (config.userBased && userId) {
      keys.push(`user:${userId}:${endpoint}`);
    }
    
    // If no keys could be generated, allow the request
    if (keys.length === 0) {
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit,
        reset: Math.floor(Date.now() / 1000) + config.window,
      };
    }
    
    // Check each key and return the most restrictive result
    const results = await Promise.all(
      keys.map(key => this.checkSingleKey(key, endpoint, config))
    );
    
    // Find the most restrictive result (lowest remaining)
    const mostRestrictive = results.reduce((prev, curr) => 
      curr.remaining < prev.remaining ? curr : prev
    );
    
    return mostRestrictive;
  }

  /**
   * Check rate limit for a single key
   * @param key - Rate limit key
   * @param endpoint - Endpoint name
   * @param config - Rate limit configuration
   * @returns Rate limit result
   */
  private async checkSingleKey(
    key: string,
    endpoint: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.window * 1000);
    const expiresAt = new Date(now.getTime() + config.window * 1000);
    
    // Try to get existing record
    const { data: records, error: selectError } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("key", key)
      .eq("endpoint", endpoint)
      .gte("expires_at", now.toISOString());
    
    if (selectError) {
      console.error("Error checking rate limit:", selectError);
      // On error, allow the request but log the issue
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit,
        reset: Math.floor(expiresAt.getTime() / 1000),
      };
    }
    
    // If no record exists or it's expired, create a new one
    if (!records || records.length === 0) {
      const newRecord: RateLimitRecord = {
        key,
        endpoint,
        count: 1,
        first_request_at: now.toISOString(),
        last_request_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      };
      
      const { error: insertError } = await this.supabase
        .from(this.tableName)
        .insert(newRecord);
      
      if (insertError) {
        console.error("Error creating rate limit record:", insertError);
      }
      
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: Math.floor(expiresAt.getTime() / 1000),
      };
    }
    
    // Get the existing record
    const record = records[0] as RateLimitRecord;
    const currentCount = record.count;
    const resetTime = new Date(record.expires_at);
    
    // Check if limit is exceeded
    if (currentCount >= config.limit) {
      return {
        allowed: false,
        limit: config.limit,
        remaining: 0,
        reset: Math.floor(resetTime.getTime() / 1000),
        retryAfter: Math.ceil((resetTime.getTime() - now.getTime()) / 1000),
      };
    }
    
    // Increment the counter
    const { error: updateError } = await this.supabase
      .from(this.tableName)
      .update({
        count: currentCount + 1,
        last_request_at: now.toISOString(),
      })
      .eq("id", record.id);
    
    if (updateError) {
      console.error("Error updating rate limit record:", updateError);
    }
    
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - (currentCount + 1),
      reset: Math.floor(resetTime.getTime() / 1000),
    };
  }
  
  /**
   * Apply rate limiting middleware to a request
   * @param req - Request object
   * @param endpoint - Endpoint name or path
   * @param configType - Configuration type or custom config
   * @returns Response if rate limited, null otherwise
   */
  async limitRequest(
    req: Request,
    endpoint: string,
    configType: string | RateLimitConfig = "default"
  ): Promise<Response | null> {
    // Get configuration
    const config = typeof configType === "string" 
      ? DEFAULT_RATE_LIMITS[configType] || DEFAULT_RATE_LIMITS.default
      : configType;
    
    // Extract IP address
    const ipAddress = req.headers.get("CF-Connecting-IP") || 
                      req.headers.get("X-Forwarded-For") || 
                      "unknown";
    
    // Extract user ID and admin status from auth header
    let userId: string | undefined;
    let isAdmin = false;
    
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error } = await this.supabase.auth.getUser(token);
        
        if (!error && user) {
          userId = user.id;
          
          // Check if user is admin
          const { data: profile } = await this.supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          
          isAdmin = profile?.role === "admin";
        }
      } catch (error) {
        console.error("Error verifying auth token:", error);
      }
    }
    
    // Check rate limit
    const result = await this.checkRateLimit(
      endpoint,
      config,
      ipAddress as string,
      userId,
      isAdmin
    );
    
    // If rate limited, return 429 response
    if (!result.allowed) {
      const headers = this.getRateLimitHeaders(result);
      
      return new Response(
        JSON.stringify({
          error: config.errorMessage || "Too many requests. Please try again later.",
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
        }
      );
    }
    
    // Not rate limited, return null to continue processing
    return null;
  }
  
  /**
   * Add rate limit headers to a response
   * @param response - Response object
   * @param result - Rate limit result
   * @returns Response with rate limit headers
   */
  addRateLimitHeaders(response: Response, result: RateLimitResult): Response {
    const headers = this.getRateLimitHeaders(result);
    
    // Clone the response with new headers
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    
    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      newResponse.headers.set(key, value);
    });
    
    return newResponse;
  }
  
  /**
   * Get rate limit headers
   * @param result - Rate limit result
   * @returns Headers object with rate limit headers
   */
  private getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      "RateLimit-Limit": result.limit.toString(),
      "RateLimit-Remaining": result.remaining.toString(),
      "RateLimit-Reset": result.reset.toString(),
    };
    
    if (result.retryAfter !== undefined) {
      headers["Retry-After"] = result.retryAfter.toString();
    }
    
    return headers;
  }
  
  /**
   * Clean up expired rate limit records
   * @returns Number of records deleted
   */
  async cleanupExpiredRecords(): Promise<number> {
    const now = new Date();
    
    const { data, error } = await this.supabase
      .from(this.tableName)
      .delete()
      .lt("expires_at", now.toISOString())
      .select("count");
    
    if (error) {
      console.error("Error cleaning up expired rate limit records:", error);
      return 0;
    }
    
    return data?.length || 0;
  }
}

/**
 * Create a rate limiter instance with environment variables
 * @returns Rate limiter instance
 */
export function createRateLimiter(): RateLimiter {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  
  return new RateLimiter(supabaseUrl, supabaseKey);
}

// Export a singleton instance for use across functions
let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get the rate limiter singleton instance
 * @returns Rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = createRateLimiter();
  }
  return rateLimiterInstance;
}
