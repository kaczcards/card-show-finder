/**
 * Security Middleware for Supabase Edge Functions
 * 
 * This module provides a comprehensive security layer that combines:
 * - Rate limiting
 * - Web Application Firewall (WAF)
 * - Authentication verification
 * - Role-based access control
 * - Security headers
 * 
 * Usage:
 * ```
 * import { applySecurity } from "../_shared/security.ts";
 * 
 * serve(async (req) => {
 *   // Apply security middleware
 *   const securityResponse = await applySecurity(req, {
 *     rateLimit: "api",
 *     waf: "medium",
 *     auth: "required",
 *     roles: ["admin", "show_organizer"]
 *   });
 *   
 *   // If security check failed, return the error response
 *   if (securityResponse) return securityResponse;
 *   
 *   // Continue with your endpoint logic
 *   // ...
 * });
 * ```
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { getRateLimiter, RateLimitConfig, DEFAULT_RATE_LIMITS } from "./rate-limit.ts";
import { getWAF, WafProtectionLevel, DEFAULT_WAF_CONFIG } from "./waf.ts";
import { corsHeaders } from "./cors.ts";

/**
 * Authentication requirement
 */
export type AuthRequirement = "none" | "optional" | "required";

/**
 * Security configuration for an endpoint
 */
export interface SecurityConfig {
  /** Rate limit configuration type or custom config */
  rateLimit?: keyof typeof DEFAULT_RATE_LIMITS | RateLimitConfig | false;
  /** WAF protection level or custom config */
  waf?: WafProtectionLevel | false;
  /** Authentication requirement */
  auth?: AuthRequirement;
  /** Required roles (if auth is required or optional) */
  roles?: string[];
  /** Whether to add security headers to the response */
  securityHeaders?: boolean;
  /** Custom security headers to add */
  customHeaders?: Record<string, string>;
  /** Whether to bypass security for specific IPs */
  trustedIps?: string[];
}

/**
 * Default security configurations by endpoint type
 */
export const DEFAULT_SECURITY_CONFIG: Record<string, SecurityConfig> = {
  // Default for all endpoints if not specified
  default: {
    rateLimit: "default",
    waf: WafProtectionLevel.MEDIUM,
    auth: "optional",
    securityHeaders: true
  },
  // Public endpoints (no auth required)
  public: {
    rateLimit: "api",
    waf: WafProtectionLevel.MEDIUM,
    auth: "none",
    securityHeaders: true
  },
  // Auth-related endpoints
  auth: {
    rateLimit: "auth",
    waf: WafProtectionLevel.HIGH,
    auth: "none", // Auth endpoints handle their own authentication
    securityHeaders: true
  },
  // Protected API endpoints
  protected: {
    rateLimit: "api",
    waf: WafProtectionLevel.MEDIUM,
    auth: "required",
    securityHeaders: true
  },
  // Payment/financial endpoints
  payment: {
    rateLimit: "payment",
    waf: WafProtectionLevel.HIGH,
    auth: "required",
    securityHeaders: true
  },
  // Admin-only endpoints
  admin: {
    rateLimit: "admin",
    waf: WafProtectionLevel.HIGH,
    auth: "required",
    roles: ["admin"],
    securityHeaders: true
  },
  // Webhook endpoints (external services calling in)
  webhook: {
    rateLimit: "api",
    waf: WafProtectionLevel.LOW,
    auth: "none",
    securityHeaders: false // Often not needed for webhooks
  }
};

/**
 * User data with role information
 */
interface UserData {
  id: string;
  role: string;
  email?: string;
}

/**
 * Authentication result
 */
interface AuthResult {
  authenticated: boolean;
  user?: UserData;
  error?: string;
}

/**
 * Default security headers to add to responses
 */
export const DEFAULT_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; object-src 'none'; upgrade-insecure-requests;",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
};

/**
 * Create a Supabase client with environment variables
 * @returns Supabase client
 */
function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Verify authentication from request
 * @param req - Request object
 * @returns Authentication result
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authenticated: false, error: "Missing or invalid Authorization header" };
  }
  
  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = createSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { authenticated: false, error: error?.message || "Invalid token" };
    }
    
    // Get user role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, email")
      .eq("id", user.id)
      .single();
    
    if (profileError) {
      console.warn(`User ${user.id} authenticated but profile not found:`, profileError);
      // Still authenticated, but with unknown role
      return { 
        authenticated: true, 
        user: { id: user.id, role: "unknown", email: user.email }
      };
    }
    
    return { 
      authenticated: true, 
      user: { 
        id: user.id, 
        role: profile.role || "unknown",
        email: profile.email || user.email
      }
    };
  } catch (error) {
    console.error("Error verifying authentication:", error);
    return { authenticated: false, error: "Authentication error" };
  }
}

/**
 * Check if user has required roles
 * @param user - User data
 * @param requiredRoles - Required roles
 * @returns Whether user has required roles
 */
export function hasRequiredRoles(user: UserData, requiredRoles?: string[]): boolean {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  
  // Admin role always has access
  if (user.role === "admin") {
    return true;
  }
  
  return requiredRoles.includes(user.role);
}

/**
 * Add security headers to a response
 * @param response - Response object
 * @param customHeaders - Custom headers to add
 * @returns Response with security headers
 */
export function addSecurityHeaders(
  response: Response,
  customHeaders: Record<string, string> = {}
): Response {
  // Clone the response
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
  
  // Add default security headers
  Object.entries({ ...DEFAULT_SECURITY_HEADERS, ...customHeaders }).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  
  return newResponse;
}

/**
 * Apply security middleware to a request
 * @param req - Request object
 * @param config - Security configuration
 * @returns Response if security check failed, null otherwise
 */
export async function applySecurity(
  req: Request,
  config: SecurityConfig | keyof typeof DEFAULT_SECURITY_CONFIG = "default"
): Promise<Response | null> {
  // Get configuration
  const securityConfig = typeof config === "string" 
    ? DEFAULT_SECURITY_CONFIG[config] || DEFAULT_SECURITY_CONFIG.default
    : { ...DEFAULT_SECURITY_CONFIG.default, ...config };
  
  // Extract IP address
  const ipAddress = req.headers.get("CF-Connecting-IP") || 
                   req.headers.get("X-Forwarded-For") || 
                   "unknown";
  
  // Check if IP is trusted
  if (securityConfig.trustedIps?.includes(ipAddress as string)) {
    return null; // Skip security checks for trusted IPs
  }
  
  // Get endpoint path for logging
  const url = new URL(req.url);
  const path = url.pathname;
  
  // Apply rate limiting if enabled
  if (securityConfig.rateLimit) {
    const rateLimiter = getRateLimiter();
    const rateLimitResponse = await rateLimiter.limitRequest(
      req,
      path,
      securityConfig.rateLimit
    );
    
    if (rateLimitResponse) {
      return addCorsAndSecurityHeaders(rateLimitResponse, securityConfig);
    }
  }
  
  // Apply WAF protection if enabled
  if (securityConfig.waf) {
    const waf = getWAF();
    const wafResponse = await waf.protect(
      req,
      securityConfig.waf
    );
    
    if (wafResponse) {
      return addCorsAndSecurityHeaders(wafResponse, securityConfig);
    }
  }
  
  // Verify authentication if required
  let authResult: AuthResult = { authenticated: false };
  
  if (securityConfig.auth !== "none") {
    authResult = await verifyAuth(req);
    
    // If authentication is required and failed
    if (securityConfig.auth === "required" && !authResult.authenticated) {
      return addCorsAndSecurityHeaders(
        new Response(
          JSON.stringify({ error: "Unauthorized", message: authResult.error || "Authentication required" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        ),
        securityConfig
      );
    }
  }
  
  // Check roles if authenticated
  if (authResult.authenticated && authResult.user && securityConfig.roles) {
    if (!hasRequiredRoles(authResult.user, securityConfig.roles)) {
      return addCorsAndSecurityHeaders(
        new Response(
          JSON.stringify({ 
            error: "Forbidden", 
            message: `Required role: ${securityConfig.roles.join(" or ")}` 
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" }
          }
        ),
        securityConfig
      );
    }
  }
  
  // All security checks passed
  return null;
}

/**
 * Add CORS and security headers to a response
 * @param response - Response object
 * @param config - Security configuration
 * @returns Response with headers
 */
function addCorsAndSecurityHeaders(response: Response, config: SecurityConfig): Response {
  // Add CORS headers
  const corsResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: { ...corsHeaders, ...Object.fromEntries(response.headers.entries()) }
  });
  
  // Add security headers if enabled
  if (config.securityHeaders) {
    return addSecurityHeaders(corsResponse, config.customHeaders);
  }
  
  return corsResponse;
}

/**
 * Wrap a response with security headers
 * @param response - Response object
 * @param config - Security configuration
 * @returns Response with security headers
 */
export function wrapResponseWithSecurity(
  response: Response,
  config: SecurityConfig | keyof typeof DEFAULT_SECURITY_CONFIG = "default"
): Response {
  // Get configuration
  const securityConfig = typeof config === "string" 
    ? DEFAULT_SECURITY_CONFIG[config] || DEFAULT_SECURITY_CONFIG.default
    : { ...DEFAULT_SECURITY_CONFIG.default, ...config };
  
  return addCorsAndSecurityHeaders(response, securityConfig);
}

/**
 * Get authenticated user from request
 * @param req - Request object
 * @returns User data if authenticated, null otherwise
 */
export async function getAuthenticatedUser(req: Request): Promise<UserData | null> {
  const authResult = await verifyAuth(req);
  return authResult.authenticated && authResult.user ? authResult.user : null;
}

/**
 * Create a secure response
 * @param body - Response body
 * @param status - Response status
 * @param config - Security configuration
 * @returns Secure response
 */
export function createSecureResponse(
  body: any,
  status = 200,
  config: SecurityConfig | keyof typeof DEFAULT_SECURITY_CONFIG = "default"
): Response {
  const response = new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    {
      status,
      headers: { "Content-Type": typeof body === "string" ? "text/plain" : "application/json" }
    }
  );
  
  return wrapResponseWithSecurity(response, config);
}

/**
 * Create a secure error response
 * @param message - Error message
 * @param status - Response status
 * @param config - Security configuration
 * @returns Secure error response
 */
export function createSecureErrorResponse(
  message: string,
  status = 400,
  config: SecurityConfig | keyof typeof DEFAULT_SECURITY_CONFIG = "default"
): Response {
  return createSecureResponse({ error: message }, status, config);
}
