import { supabase } from '../supabase';
import { refreshUserSession } from './sessionService';

// User role constants
export enum UserRole {
  ATTENDEE = 'attendee',
  DEALER = 'dealer',
  MVP_DEALER = 'mvp_dealer',
  SHOW_ORGANIZER = 'show_organizer',
}

/**
 * Global test-mode flag.
 *
 * KEEP THIS **FALSE** IN PRODUCTION.
 * Can be overridden at runtime by setting
 *   globalThis.CSF_IS_TEST_MODE = true
 * during e2e / unit tests.
 */
// NOTE: changing this to **const** prevents runtime overrides in production.
export const IS_TEST_MODE = false;


/* ------------------------------------------------------------------
 * Utility helpers
 * ------------------------------------------------------------------ */

/**
 * Normalises a role string coming from the database (often lowercase)
 * to the corresponding uppercase `UserRole` enum value.
 * Returns `null` if it cannot be mapped.
 */
export const normalizeRole = (role?: string | null): UserRole | null => {
  if (!role) return null;
  const upper = role.toUpperCase() as UserRole;
  return (Object.values(UserRole) as string[]).includes(upper) ? upper : null;
};

/* ------------------------------------------------------------------
 * Permission Matrix
 * ------------------------------------------------------------------ */

/**
 * Discrete actions in the system that can be gated by role.
 * Extend this enum as new features are added.
 */
export enum Action {
  SEND_DM = 'SEND_DM',
  RECEIVE_DM = 'RECEIVE_DM',
  REPLY_DM = 'REPLY_DM',
  /**
   * Generic, non-UI message actions used elsewhere in the codebase.
   * These are aliases for the more specific DM actions above but are
   * referenced by helper utilities (e.g. `canUserSendMessage`).
   * Keeping both spellings prevents brittle runtime errors when new
   * modules are introduced that rely on the generic names.
   */
  SEND_MESSAGE = 'SEND_MESSAGE',
  RECEIVE_MESSAGE = 'RECEIVE_MESSAGE',
  SEND_BROADCAST = 'SEND_BROADCAST',
  MANAGE_SHOWS = 'MANAGE_SHOWS', // create / edit show listings
  DEALER_PARTICIPATION = 'DEALER_PARTICIPATION',
  PREMIUM_FEATURE = 'PREMIUM_FEATURE',
  MODERATE_MESSAGE = 'MODERATE_MESSAGE',
}

/**
 * Mapping of role ⇒ allowed action set.
 * NOTE: keep this in sync with product requirements.
 */
const ROLE_PERMISSIONS: Record<UserRole, Set<Action>> = {
  [UserRole.ATTENDEE]: new Set<Action>([
    Action.SEND_DM,
    Action.RECEIVE_DM,
    Action.REPLY_DM,
  ]),
  [UserRole.DEALER]: new Set<Action>([
    Action.RECEIVE_DM,
    Action.DEALER_PARTICIPATION,
  ]),
  [UserRole.MVP_DEALER]: new Set<Action>([
    Action.SEND_DM,
    Action.RECEIVE_DM,
    Action.REPLY_DM,
    Action.SEND_BROADCAST,
    Action.DEALER_PARTICIPATION,
    Action.PREMIUM_FEATURE,
  ]),
  [UserRole.SHOW_ORGANIZER]: new Set<Action>([
    Action.SEND_DM,
    Action.RECEIVE_DM,
    Action.REPLY_DM,
    Action.SEND_BROADCAST,
    Action.MANAGE_SHOWS,
    Action.DEALER_PARTICIPATION,
    Action.PREMIUM_FEATURE,
    Action.MODERATE_MESSAGE,
  ]),
};

/**
 * Generic permission checker.
 * @param userRole   caller’s role
 * @param action     action to check
 */
export const canPerformAction = (userRole: UserRole, action: Action): boolean => {
  if (IS_TEST_MODE) return true;
  const allowed = ROLE_PERMISSIONS[userRole];
  return allowed ? allowed.has(action) : false;
};

/* ------------------------------------------------------------------
 * Messaging-specific helpers
 * ------------------------------------------------------------------ */

/**
 * Checks if a sender can initiate a DM to a recipient
 * (show validation must be handled by caller when needed).
 */
export const canSendDirectMessage = (
  senderRole: UserRole,
  recipientRole: UserRole
): boolean => {
  if (IS_TEST_MODE) return true;

  switch (senderRole) {
    case UserRole.ATTENDEE:
      return recipientRole === UserRole.MVP_DEALER;
    case UserRole.MVP_DEALER:
      return (
        recipientRole === UserRole.ATTENDEE ||
        recipientRole === UserRole.DEALER ||
        recipientRole === UserRole.SHOW_ORGANIZER
      );
    case UserRole.SHOW_ORGANIZER:
      return true; // can DM anyone
    default:
      return false;
  }
};

/**
 * Dealers are read-only, everyone else can reply.
 */
export const canReplyToMessage = (userRole: UserRole): boolean => {
  if (IS_TEST_MODE) return true;
  return userRole !== UserRole.DEALER;
};

/**
 * Broadcast: MVP dealer (attendees only) or organizer (quota enforced server-side)
 */
export const canSendBroadcast = (userRole: UserRole): boolean => {
  if (IS_TEST_MODE) return true;
  return (
    userRole === UserRole.MVP_DEALER ||
    userRole === UserRole.SHOW_ORGANIZER
  );
};

/**
 * Show organizers (for their shows) & admins (handled elsewhere) can moderate.
 */
export const canModerateMessages = (userRole: UserRole): boolean => {
  if (IS_TEST_MODE) return true;
  return userRole === UserRole.SHOW_ORGANIZER;
};

/**
 * Fetches a user's role from the profiles table.
 * @param userId The ID of the user.
 * @returns The user's role as a string, or null if not found/error.
 */
export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    return normalizeRole(data?.role);
  } catch (error) {
    console.error('Exception in getUserRole:', error);
    return null;
  }
};

/**
 * Get user profile by ID.
 * @param userId User ID to lookup
 * @returns User profile information or null
 */
export const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, role')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception in getUserProfile:', error);
    return null;
  }
};

/**
 * Checks if a user can send messages.
 * In our current system, all users can send messages.
 * @param userRole The role of the user.
 * @returns True if the user can send messages, false otherwise.
 */
export const canUserSendMessage = (userRole: UserRole): boolean => {
  return canPerformAction(userRole, Action.SEND_MESSAGE);
};

/**
 * Checks if a user can receive messages.
 * Only MVP_DEALER and SHOW_ORGANIZER can receive messages in production.
 * @param userRole The role of the user.
 * @returns True if the user can receive messages, false otherwise.
 */
export const canUserReceiveMessage = (userRole: UserRole): boolean => {
  return canPerformAction(userRole, Action.RECEIVE_MESSAGE);
};

/**
 * Provides a general function to check if a user has a specific role.
 * @param userRole The role of the user.
 * @param requiredRole The role required for the action.
 * @returns True if the user has the required role, false otherwise.
 */
export const hasRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  if (IS_TEST_MODE) {
    return true; // Bypass role checks in test mode
  }
  return userRole === requiredRole;
};

/**
 * Provides a general function to check if a user has one of several roles.
 * @param userRole The role of the user.
 * @param requiredRoles An array of roles, at least one of which the user must have.
 * @returns True if the user has any of the required roles, false otherwise.
 */
export const hasAnyRole = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  if (IS_TEST_MODE) {
    return true; // Bypass role checks in test mode
  }
  return requiredRoles.includes(userRole);
};

/**
 * Checks if a user can create or edit show listings.
 * Only SHOW_ORGANIZER role can manage show listings.
 * @param userRole The role of the user.
 * @returns True if the user can manage show listings, false otherwise.
 */
export const canManageShows = (userRole: UserRole): boolean => {
  return canPerformAction(userRole, Action.MANAGE_SHOWS);
};

/**
 * Checks if a user can participate as a dealer in shows.
 * DEALER, MVP_DEALER, and SHOW_ORGANIZER roles can participate as dealers.
 * @param userRole The role of the user.
 * @returns True if the user can participate as a dealer, false otherwise.
 */
export const canParticipateAsDealer = (userRole: UserRole): boolean => {
  return canPerformAction(userRole, Action.DEALER_PARTICIPATION);
};

/**
 * Checks if a user has premium features.
 * MVP_DEALER and SHOW_ORGANIZER have premium features.
 * @param userRole The role of the user.
 * @returns True if the user has premium features, false otherwise.
 */
export const hasPremiumFeatures = (userRole: UserRole): boolean => {
  return canPerformAction(userRole, Action.PREMIUM_FEATURE);
};

/**
 * Checks if a user needs to upgrade to access certain features.
 * ATTENDEE and DEALER roles need to upgrade for premium features.
 * @param userRole The role of the user.
 * @returns True if the user needs to upgrade, false otherwise.
 */
export const needsUpgrade = (userRole: UserRole): boolean => {
  return !hasPremiumFeatures(userRole);
};

/**
 * Checks if a user can contact another user based on their roles.
 * Used to determine if "Message" button should be shown in profiles.
 * @param currentUserRole Role of the current user 
 * @param targetUserRole Role of the user to be messaged
 * @returns Boolean indicating if messaging is allowed
 */
export const canContactUser = (currentUserRole: UserRole, targetUserRole: UserRole): boolean => {
  if (IS_TEST_MODE) {
    return true; // Allow all messaging in test mode
  }
  
  // Check if the target user can receive messages
  return canUserReceiveMessage(targetUserRole);
};

/* ------------------------------------------------------------------
 * Session / role synchronisation helpers
 * ------------------------------------------------------------------ */

/**
 * Convenience helper that:
 * 1. Refreshes the session token
 * 2. Fetches the latest role from the database
 *
 * This should be called after any action that might change the user's
 * subscription or role (e.g., webhook, upgrade flow).
 */
export const updateUserRole = async (userId: string): Promise<UserRole | null> => {
  await refreshUserSession();
  return getUserRole(userId);
};
