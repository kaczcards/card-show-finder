// supabase/functions/mfa/index.ts
/**
 * Multi-Factor Authentication (MFA) Edge Function
 * 
 * This function provides endpoints for managing MFA in the Card Show Finder app:
 * - Enrollment: Generate TOTP secrets and QR codes
 * - Verification: Validate TOTP codes during setup and login
 * - Recovery: Generate and validate backup recovery codes
 * - Management: Enable/disable MFA
 * 
 * Security features:
 * - Rate limiting for failed attempts
 * - Secure secret generation and storage
 * - Comprehensive audit logging
 * - Proper error handling and validation
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import * as OTPAuth from "https://esm.sh/otpauth@9.1.4";
import * as base32 from "https://esm.sh/hi-base32@0.5.1";
import * as qrcode from "https://esm.sh/qrcode@1.5.3";
import { corsHeaders } from "../_shared/cors.ts";
import { applySecurity } from "../_shared/security.ts";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MFA_ENCRYPTION_KEY = Deno.env.get("MFA_ENCRYPTION_KEY") || ""; // For encrypting TOTP secrets
const APP_NAME = "Card Show Finder";

// Constants
const RATE_LIMIT_MAX_ATTEMPTS = 5; // Max failed attempts before rate limiting
const RATE_LIMIT_WINDOW_MINUTES = 60; // Rate limiting window in minutes
const RECOVERY_CODES_COUNT = 10; // Number of recovery codes to generate
const TOTP_DIGITS = 6; // Number of digits in TOTP code
const TOTP_PERIOD = 30; // TOTP period in seconds
const TOTP_ALGORITHM = "SHA1"; // TOTP algorithm
const RECOVERY_CODE_LENGTH = 10; // Length of recovery codes

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Encrypt sensitive data using AES-GCM
 * @param text - Text to encrypt
 * @returns Encrypted text (base64)
 */
async function encrypt(text: string): Promise<string> {
  if (!MFA_ENCRYPTION_KEY) {
    throw new Error("MFA_ENCRYPTION_KEY not set");
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Derive key from the encryption key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(MFA_ENCRYPTION_KEY),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("CardShowFinderMFA"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  // Combine IV and ciphertext and encode as base64
  const result = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypt encrypted data
 * @param encryptedText - Encrypted text (base64)
 * @returns Decrypted text
 */
async function decrypt(encryptedText: string): Promise<string> {
  if (!MFA_ENCRYPTION_KEY) {
    throw new Error("MFA_ENCRYPTION_KEY not set");
  }
  
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Decode base64
  const encryptedData = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  
  // Extract IV (first 12 bytes)
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);
  
  // Derive key from the encryption key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(MFA_ENCRYPTION_KEY),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("CardShowFinderMFA"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  
  // Decrypt the data
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  
  return decoder.decode(decrypted);
}

/**
 * Generate a secure random string
 * @param length - Length of the string
 * @param charset - Character set to use
 * @returns Random string
 */
function generateSecureRandomString(
  length: number,
  charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
): string {
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  
  return result;
}

/**
 * Generate recovery codes
 * @param count - Number of recovery codes to generate
 * @returns Array of recovery codes
 */
function generateRecoveryCodes(count: number): string[] {
  const codes: string[] = [];
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  
  for (let i = 0; i < count; i++) {
    // Format: XXXX-XXXX-XXXX
    const part1 = generateSecureRandomString(4, charset);
    const part2 = generateSecureRandomString(4, charset);
    const part3 = generateSecureRandomString(4, charset);
    codes.push(`${part1}-${part2}-${part3}`);
  }
  
  return codes;
}

/**
 * Hash a recovery code
 * @param code - Recovery code to hash
 * @returns Hashed code
 */
async function hashRecoveryCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/**
 * Check if a user is rate limited
 * @param userId - User ID
 * @param ipAddress - IP address
 * @returns Whether the user is rate limited
 */
async function isRateLimited(userId: string, ipAddress: string): Promise<boolean> {
  // Get failed attempts count
  const { data: attemptCount, error } = await supabase.rpc(
    "count_failed_mfa_attempts",
    { user_id_param: userId, ip_address_param: ipAddress }
  );
  
  if (error) {
    console.error("Error checking rate limit:", error);
    return false; // Default to not rate limited on error
  }
  
  return attemptCount >= RATE_LIMIT_MAX_ATTEMPTS;
}

/**
 * Log an MFA attempt
 * @param userId - User ID
 * @param ipAddress - IP address
 * @param userAgent - User agent
 * @param successful - Whether the attempt was successful
 */
async function logMfaAttempt(
  userId: string,
  ipAddress: string,
  userAgent: string,
  successful: boolean
): Promise<void> {
  await supabase.rpc("log_mfa_attempt", {
    user_id_param: userId,
    ip_address_param: ipAddress,
    user_agent_param: userAgent,
    successful_param: successful
  });
}

/**
 * Verify a TOTP code
 * @param secret - TOTP secret
 * @param code - TOTP code to verify
 * @returns Whether the code is valid
 */
function verifyTOTP(secret: string, code: string): boolean {
  try {
    // Create TOTP object
    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      algorithm: TOTP_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret)
    });
    
    // Verify the code with a window of 1 to account for time drift
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  } catch (error) {
    console.error("Error verifying TOTP:", error);
    return false;
  }
}

/**
 * Verify user authentication
 * @param authHeader - Authorization header
 * @returns User ID if authenticated, null otherwise
 */
async function verifyAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  
  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error("Auth error:", error);
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

/**
 * Handle MFA enrollment request
 * @param req - Request object
 * @returns Response object
 */
async function handleEnroll(req: Request): Promise<Response> {
  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    const userId = await verifyAuth(authHeader);
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get user email for TOTP label
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();
    
    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Check if MFA is already enrolled
    const { data: enrollmentData } = await supabase
      .from("authenticator_enrollments")
      .select("id")
      .eq("user_id", userId)
      .single();
    
    if (enrollmentData) {
      return new Response(
        JSON.stringify({ error: "MFA already enrolled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Generate TOTP secret
    const secret = generateSecureRandomString(20);
    
    // Create TOTP object
    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      label: userData.email || userId,
      algorithm: TOTP_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret)
    });
    
    // Generate QR code
    const otpauth = totp.toString();
    const qrCode = await qrcode.toDataURL(otpauth);
    
    // Create a challenge to verify setup
    const { data: challengeData } = await supabase.rpc(
      "create_mfa_challenge",
      { user_id_param: userId }
    );
    
    // Encrypt the secret
    const encryptedSecret = await encrypt(secret);
    
    // Store temporary enrollment data in session storage
    // We'll move it to the database after verification
    await supabase
      .from("authenticator_enrollments")
      .insert({
        user_id: userId,
        secret: encryptedSecret,
        name: "Authenticator App",
        algorithm: TOTP_ALGORITHM,
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD
      });
    
    // Update profile to indicate MFA setup in progress
    await supabase
      .from("profiles")
      .update({
        mfa_verified: false
      })
      .eq("id", userId);
    
    return new Response(
      JSON.stringify({
        secret,
        qrCode,
        challengeId: challengeData,
        algorithm: TOTP_ALGORITHM,
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error enrolling MFA:", error);
    return new Response(
      JSON.stringify({ error: "Failed to enroll MFA" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle MFA verification request (during setup)
 * @param req - Request object
 * @returns Response object
 */
async function handleVerify(req: Request): Promise<Response> {
  try {
    // Parse request body
    const { code, challengeId } = await req.json();
    
    // Validate required fields
    if (!code || !challengeId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    const userId = await verifyAuth(authHeader);
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get IP and user agent for logging
    const ipAddress = req.headers.get("CF-Connecting-IP") || 
                     req.headers.get("X-Forwarded-For") || 
                     "unknown";
    const userAgent = req.headers.get("User-Agent") || "unknown";
    
    // Check if rate limited
    if (await isRateLimited(userId, ipAddress as string)) {
      return new Response(
        JSON.stringify({ 
          error: "Too many failed attempts. Please try again later." 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get the challenge
    const { data: challengeData } = await supabase
      .from("mfa_challenges")
      .select("*")
      .eq("challenge_id", challengeId)
      .eq("user_id", userId)
      .single();
    
    if (!challengeData || challengeData.verified || new Date(challengeData.expires_at) < new Date()) {
      await logMfaAttempt(userId, ipAddress as string, userAgent as string, false);
      return new Response(
        JSON.stringify({ error: "Invalid or expired challenge" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get the enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("authenticator_enrollments")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (enrollmentError || !enrollment) {
      await logMfaAttempt(userId, ipAddress as string, userAgent as string, false);
      return new Response(
        JSON.stringify({ error: "MFA not enrolled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Decrypt the secret
    const secret = await decrypt(enrollment.secret);
    
    // Verify the code
    if (!verifyTOTP(secret, code)) {
      await logMfaAttempt(userId, ipAddress as string, userAgent as string, false);
      return new Response(
        JSON.stringify({ error: "Invalid code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Verify the challenge
    await supabase.rpc("verify_mfa_challenge", { challenge_id_param: challengeId });
    
    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODES_COUNT);
    
    // Hash and store recovery codes
    const recoveryCodesPromises = recoveryCodes.map(async (code) => {
      const hash = await hashRecoveryCode(code);
      return {
        user_id: userId,
        code_hash: hash
      };
    });
    
    const recoveryCodesData = await Promise.all(recoveryCodesPromises);
    await supabase.from("recovery_codes").insert(recoveryCodesData);
    
    // Enable MFA for the user
    await supabase.rpc("enable_mfa", { user_id_param: userId });
    
    // Log successful attempt
    await logMfaAttempt(userId, ipAddress as string, userAgent as string, true);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        recoveryCodes,
        message: "MFA successfully enabled"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error verifying MFA:", error);
    return new Response(
      JSON.stringify({ error: "Failed to verify MFA" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle MFA authentication request (during login)
 * @param req - Request object
 * @returns Response object
 */
async function handleAuthenticate(req: Request): Promise<Response> {
  try {
    // Parse request body
    const { code, userId, sessionId } = await req.json();
    
    // Validate required fields
    if (!code || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get IP and user agent for logging
    const ipAddress = req.headers.get("CF-Connecting-IP") || 
                     req.headers.get("X-Forwarded-For") || 
                     "unknown";
    const userAgent = req.headers.get("User-Agent") || "unknown";
    
    // Check if rate limited
    if (await isRateLimited(userId, ipAddress as string)) {
      return new Response(
        JSON.stringify({ 
          error: "Too many failed attempts. Please try again later." 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get the enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("authenticator_enrollments")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (enrollmentError || !enrollment) {
      await logMfaAttempt(userId, ipAddress as string, userAgent as string, false);
      return new Response(
        JSON.stringify({ error: "MFA not enrolled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Decrypt the secret
    const secret = await decrypt(enrollment.secret);
    
    // Verify the code
    if (!verifyTOTP(secret, code)) {
      await logMfaAttempt(userId, ipAddress as string, userAgent as string, false);
      return new Response(
        JSON.stringify({ error: "Invalid code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Update last used timestamp
    await supabase
      .from("authenticator_enrollments")
      .update({
        last_used_at: new Date().toISOString()
      })
      .eq("id", enrollment.id);
    
    // Log successful attempt
    await logMfaAttempt(userId, ipAddress as string, userAgent as string, true);
    
    // Return success
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "MFA authentication successful",
        sessionId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error authenticating MFA:", error);
    return new Response(
      JSON.stringify({ error: "Failed to authenticate MFA" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle recovery code validation request
 * @param req - Request object
 * @returns Response object
 */
async function handleValidateRecovery(req: Request): Promise<Response> {
  try {
    // Parse request body
    const { code, userId, sessionId } = await req.json();
    
    // Validate required fields
    if (!code || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get IP and user agent for logging
    const ipAddress = req.headers.get("CF-Connecting-IP") || 
                     req.headers.get("X-Forwarded-For") || 
                     "unknown";
    const userAgent = req.headers.get("User-Agent") || "unknown";
    
    // Check if rate limited
    if (await isRateLimited(userId, ipAddress as string)) {
      return new Response(
        JSON.stringify({ 
          error: "Too many failed attempts. Please try again later." 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Hash the recovery code
    const codeHash = await hashRecoveryCode(code);
    
    // Check if the recovery code exists and is unused
    const { data: recoveryCode, error: recoveryError } = await supabase
      .from("recovery_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("code_hash", codeHash)
      .eq("used", false)
      .single();
    
    if (recoveryError || !recoveryCode) {
      await logMfaAttempt(userId, ipAddress as string, userAgent as string, false);
      return new Response(
        JSON.stringify({ error: "Invalid recovery code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Mark the recovery code as used
    await supabase
      .from("recovery_codes")
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq("id", recoveryCode.id);
    
    // Log successful attempt
    await logMfaAttempt(userId, ipAddress as string, userAgent as string, true);
    
    // Return success
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Recovery code validated successfully",
        sessionId,
        recoveryCodesRemaining: RECOVERY_CODES_COUNT - 1 // Approximate count
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error validating recovery code:", error);
    return new Response(
      JSON.stringify({ error: "Failed to validate recovery code" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle MFA disable request
 * @param req - Request object
 * @returns Response object
 */
async function handleDisable(req: Request): Promise<Response> {
  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    const userId = await verifyAuth(authHeader);
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Parse request body to get confirmation code
    const { code } = await req.json();
    
    // Get IP and user agent for logging
    const ipAddress = req.headers.get("CF-Connecting-IP") || 
                     req.headers.get("X-Forwarded-For") || 
                     "unknown";
    const userAgent = req.headers.get("User-Agent") || "unknown";
    
    // Get the enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("authenticator_enrollments")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (enrollmentError || !enrollment) {
      return new Response(
        JSON.stringify({ error: "MFA not enrolled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // If code is provided, verify it
    if (code) {
      // Decrypt the secret
      const secret = await decrypt(enrollment.secret);
      
      // Verify the code
      if (!verifyTOTP(secret, code)) {
        await logMfaAttempt(userId, ipAddress as string, userAgent as string, false);
        return new Response(
          JSON.stringify({ error: "Invalid code" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      // If no code provided, require admin auth
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      
      if (!userProfile || userProfile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Code required to disable MFA" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
    
    // Disable MFA
    await supabase.rpc("disable_mfa", { user_id_param: userId });
    
    // Log successful attempt
    await logMfaAttempt(userId, ipAddress as string, userAgent as string, true);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "MFA disabled successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error disabling MFA:", error);
    return new Response(
      JSON.stringify({ error: "Failed to disable MFA" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle status check request
 * @param req - Request object
 * @returns Response object
 */
async function handleStatus(req: Request): Promise<Response> {
  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    const userId = await verifyAuth(authHeader);
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get MFA status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("mfa_enabled, mfa_verified, mfa_enrollment_time")
      .eq("id", userId)
      .single();
    
    if (profileError) {
      return new Response(
        JSON.stringify({ error: "Failed to get MFA status" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get recovery codes count
    const { data: recoveryCodes, error: recoveryError } = await supabase
      .from("recovery_codes")
      .select("id")
      .eq("user_id", userId)
      .eq("used", false);
    
    const recoveryCodesRemaining = recoveryCodes?.length || 0;
    
    return new Response(
      JSON.stringify({
        mfaEnabled: profile.mfa_enabled,
        mfaVerified: profile.mfa_verified,
        enrollmentTime: profile.mfa_enrollment_time,
        recoveryCodesRemaining
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error getting MFA status:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get MFA status" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle regenerate recovery codes request
 * @param req - Request object
 * @returns Response object
 */
async function handleRegenerateRecoveryCodes(req: Request): Promise<Response> {
  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    const userId = await verifyAuth(authHeader);
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Parse request body to get confirmation code
    const { code } = await req.json();
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: "TOTP code required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get IP and user agent for logging
    const ipAddress = req.headers.get("CF-Connecting-IP") || 
                     req.headers.get("X-Forwarded-For") || 
                     "unknown";
    const userAgent = req.headers.get("User-Agent") || "unknown";
    
    // Get the enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("authenticator_enrollments")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (enrollmentError || !enrollment) {
      return new Response(
        JSON.stringify({ error: "MFA not enrolled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Decrypt the secret
    const secret = await decrypt(enrollment.secret);
    
    // Verify the code
    if (!verifyTOTP(secret, code)) {
      await logMfaAttempt(userId, ipAddress as string, userAgent as string, false);
      return new Response(
        JSON.stringify({ error: "Invalid code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Delete existing recovery codes
    await supabase
      .from("recovery_codes")
      .delete()
      .eq("user_id", userId);
    
    // Generate new recovery codes
    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODES_COUNT);
    
    // Hash and store recovery codes
    const recoveryCodesPromises = recoveryCodes.map(async (code) => {
      const hash = await hashRecoveryCode(code);
      return {
        user_id: userId,
        code_hash: hash
      };
    });
    
    const recoveryCodesData = await Promise.all(recoveryCodesPromises);
    await supabase.from("recovery_codes").insert(recoveryCodesData);
    
    // Log successful attempt
    await logMfaAttempt(userId, ipAddress as string, userAgent as string, true);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        recoveryCodes,
        message: "Recovery codes regenerated successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error regenerating recovery codes:", error);
    return new Response(
      JSON.stringify({ error: "Failed to regenerate recovery codes" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Main handler function
 */
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // Apply global security (rate-limit + WAF) for MFA endpoints
  const securityResp = await applySecurity(req, "auth");
  if (securityResp) return securityResp;
  
  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    
    switch (path) {
      case "enroll":
        return await handleEnroll(req);
      case "verify":
        return await handleVerify(req);
      case "authenticate":
        return await handleAuthenticate(req);
      case "validate-recovery":
        return await handleValidateRecovery(req);
      case "disable":
        return await handleDisable(req);
      case "status":
        return await handleStatus(req);
      case "regenerate-recovery-codes":
        return await handleRegenerateRecoveryCodes(req);
      default:
        return new Response(
          JSON.stringify({ 
            error: "Not found",
            endpoints: [
              "/enroll - Start MFA enrollment",
              "/verify - Verify MFA setup",
              "/authenticate - Validate a TOTP code during login",
              "/validate-recovery - Validate a recovery code",
              "/disable - Disable MFA",
              "/status - Check MFA status",
              "/regenerate-recovery-codes - Generate new recovery codes"
            ]
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
