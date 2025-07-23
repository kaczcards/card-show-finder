import { supabase } from "../supabase";

/**
 * MFA enrollment response
 */
export interface MFAEnrollmentResponse {
  secret: string;
  qrCode: string;
  challengeId: string;
  algorithm: string;
  digits: number;
  period: number;
}

/**
 * MFA verification response
 */
export interface MFAVerificationResponse {
  success: boolean;
  recoveryCodes: string[];
  message: string;
}

/**
 * MFA authentication response
 */
export interface MFAAuthenticationResponse {
  success: boolean;
  message: string;
  sessionId?: string;
}

/**
 * MFA recovery code validation response
 */
export interface MFARecoveryResponse {
  success: boolean;
  message: string;
  sessionId?: string;
  recoveryCodesRemaining: number;
}

/**
 * MFA status response
 */
export interface MFAStatusResponse {
  mfaEnabled: boolean;
  mfaVerified: boolean;
  enrollmentTime: string | null;
  recoveryCodesRemaining: number;
}

/**
 * MFA service for managing Multi-Factor Authentication
 */
export class MFAService {
  private readonly baseUrl: string;

  /**
   * Constructor
   */
  constructor() {
    // Get the Supabase URL from the client
    const supabaseUrl = supabase.auth.url() || "";
    // Replace the auth part with functions
    this.baseUrl = supabaseUrl.replace("/auth/v1", "/functions/v1/mfa");
  }

  /**
   * Start MFA enrollment process
   * @returns MFA enrollment data including secret and QR code
   */
  async startEnrollment(): Promise<MFAEnrollmentResponse> {
    try {
      const { data, error } = await this.callMFAEndpoint<MFAEnrollmentResponse>("enroll", {}, "GET");
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (error) {
      console.error("Failed to start MFA enrollment:", error);
      throw error;
    }
  }

  /**
   * Verify MFA setup with a TOTP code
   * @param code - The TOTP code from the authenticator app
   * @param challengeId - The challenge ID from enrollment
   * @returns Verification result with recovery codes
   */
  async verifySetup(code: string, challengeId: string): Promise<MFAVerificationResponse> {
    try {
      const { data, error } = await this.callMFAEndpoint<MFAVerificationResponse>("verify", {
        code,
        challengeId
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (error) {
      console.error("Failed to verify MFA setup:", error);
      throw error;
    }
  }

  /**
   * Authenticate with MFA during login
   * @param code - The TOTP code from the authenticator app
   * @param userId - The user ID to authenticate
   * @param sessionId - Optional session ID for tracking
   * @returns Authentication result
   */
  async authenticate(code: string, userId: string, sessionId?: string): Promise<MFAAuthenticationResponse> {
    try {
      const { data, error } = await this.callMFAEndpoint<MFAAuthenticationResponse>("authenticate", {
        code,
        userId,
        sessionId
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (error) {
      console.error("Failed to authenticate with MFA:", error);
      throw error;
    }
  }

  /**
   * Validate a recovery code
   * @param code - The recovery code
   * @param userId - The user ID
   * @param sessionId - Optional session ID for tracking
   * @returns Validation result
   */
  async validateRecoveryCode(code: string, userId: string, sessionId?: string): Promise<MFARecoveryResponse> {
    try {
      const { data, error } = await this.callMFAEndpoint<MFARecoveryResponse>("validate-recovery", {
        code,
        userId,
        sessionId
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (error) {
      console.error("Failed to validate recovery code:", error);
      throw error;
    }
  }

  /**
   * Disable MFA for the current user
   * @param code - Optional TOTP code for verification (required for non-admin users)
   * @returns Result of the operation
   */
  async disableMFA(code?: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await this.callMFAEndpoint<{ success: boolean; message: string }>("disable", {
        code
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (error) {
      console.error("Failed to disable MFA:", error);
      throw error;
    }
  }

  /**
   * Get the current MFA status
   * @returns MFA status information
   */
  async getMFAStatus(): Promise<MFAStatusResponse> {
    try {
      const { data, error } = await this.callMFAEndpoint<MFAStatusResponse>("status", {}, "GET");
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (error) {
      console.error("Failed to get MFA status:", error);
      throw error;
    }
  }

  /**
   * Regenerate recovery codes
   * @param code - TOTP code for verification
   * @returns New recovery codes
   */
  async regenerateRecoveryCodes(code: string): Promise<MFAVerificationResponse> {
    try {
      const { data, error } = await this.callMFAEndpoint<MFAVerificationResponse>("regenerate-recovery-codes", {
        code
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (error) {
      console.error("Failed to regenerate recovery codes:", error);
      throw error;
    }
  }

  /**
   * Check if MFA is required for a user
   * @param userId - User ID to check
   * @returns Whether MFA is required
   */
  async isMFARequired(userId: string): Promise<boolean> {
    try {
      // Get user profile to check if MFA is enabled
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("mfa_enabled, mfa_verified")
        .eq("id", userId)
        .single();
      
      if (error) {
        throw new Error(error.message);
      }
      
      return profile?.mfa_enabled && profile?.mfa_verified;
    } catch (error) {
      console.error("Failed to check if MFA is required:", error);
      return false; // Default to not requiring MFA on error
    }
  }

  /**
   * Call an MFA endpoint
   * @param endpoint - Endpoint to call
   * @param body - Request body
   * @param method - HTTP method
   * @returns Response data and error
   */
  private async callMFAEndpoint<T>(
    endpoint: string,
    body: Record<string, any> = {},
    method: "GET" | "POST" = "POST"
  ): Promise<{ data: T; error: Error | null }> {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No active session");
      }
      
      const url = `${this.baseUrl}/${endpoint}`;
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      };
      
      let response;
      if (method === "GET") {
        response = await fetch(url, { headers, method });
      } else {
        response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(body)
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      return { data: data as T, error: null };
    } catch (error) {
      return { data: {} as T, error: error as Error };
    }
  }
}

// Export a singleton instance
export const mfaService = new MFAService();
