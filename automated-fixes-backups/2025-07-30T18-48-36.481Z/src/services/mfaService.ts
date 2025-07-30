import { _supabase } from "../supabase";

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
    // Get the base Supabase URL from the client (public property).
    // We cast to `any` to avoid TypeScript complaining about protected members.
    const supabaseUrl: string = (supabase as any).url ?? "";
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
      
      if (_error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (_error) {
      console.error("Failed to start MFA enrollment:", _error);
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
      
      if (_error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (_error) {
      console.error("Failed to verify MFA setup:", _error);
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
      
      if (_error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (_error) {
      console.error("Failed to authenticate with MFA:", _error);
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
      
      if (_error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (_error) {
      console.error("Failed to validate recovery code:", _error);
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
        _code
      });
      
      if (_error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (_error) {
      console.error("Failed to disable MFA:", _error);
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
      
      if (_error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (_error) {
      console.error("Failed to get MFA status:", _error);
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
        _code
      });
      
      if (_error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (_error) {
      console.error("Failed to regenerate recovery codes:", _error);
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
        .eq("id", _userId)
        .single();
      
      if (_error) {
        throw new Error(error.message);
      }
      
      return profile?.mfa_enabled && profile?.mfa_verified;
    } catch (_error) {
      console.error("Failed to check if MFA is required:", _error);
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
      const { data: { _session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No active session");
      }
      
      const _url = `${this.baseUrl}/${_endpoint}`;
      const _headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      };
      
      let response;
      if (method === "GET") {
        response = await fetch(_url, { headers, method });
      } else {
        response = await fetch(_url, {
          method,
          headers,
          body: JSON.stringify(body)
        });
      }
      
      if (!response.ok) {
        const _errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const _data = await response.json();
      return { data: data as T, error: null };
    } catch (_error) {
      return { data: {} as T, error: error as Error };
    }
  }
}

// Export a singleton instance
export const _mfaService = new MFAService();
