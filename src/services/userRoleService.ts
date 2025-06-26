import { supabase } from '../supabase';

// User role constants
export enum UserRole {
  ATTENDEE = 'ATTENDEE',
  DEALER = 'DEALER',
  MVP_DEALER = 'MVP_DEALER',
  SHOW_ORGANIZER = 'SHOW_ORGANIZER',
}

// Test mode flag - set to false in production
export const IS_TEST_MODE = true; 

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

    return (data?.role?.toUpperCase() as UserRole) || null;
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
  if (IS_TEST_MODE) {
    return true; // Bypass role checks in test mode
  }
  // All roles can send messages in the current system
  return true;
};

/**
 * Checks if a user can receive messages.
 * Only MVP_DEALER and SHOW_ORGANIZER can receive messages in production.
 * @param userRole The role of the user.
 * @returns True if the user can receive messages, false otherwise.
 */
export const canUserReceiveMessage = (userRole: UserRole): boolean => {
  if (IS_TEST_MODE) {
    return true; // Bypass role checks in test mode
  }
  // Only MVP_DEALER and SHOW_ORGANIZER can receive messages
  return userRole === UserRole.MVP_DEALER || userRole === UserRole.SHOW_ORGANIZER;
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
  if (IS_TEST_MODE) {
    return true; // Bypass role checks in test mode
  }
  return userRole === UserRole.SHOW_ORGANIZER;
};

/**
 * Checks if a user can participate as a dealer in shows.
 * DEALER, MVP_DEALER, and SHOW_ORGANIZER roles can participate as dealers.
 * @param userRole The role of the user.
 * @returns True if the user can participate as a dealer, false otherwise.
 */
export const canParticipateAsDealer = (userRole: UserRole): boolean => {
  if (IS_TEST_MODE) {
    return true; // Bypass role checks in test mode
  }
  return [UserRole.DEALER, UserRole.MVP_DEALER, UserRole.SHOW_ORGANIZER].includes(userRole);
};

/**
 * Checks if a user has premium features.
 * MVP_DEALER and SHOW_ORGANIZER have premium features.
 * @param userRole The role of the user.
 * @returns True if the user has premium features, false otherwise.
 */
export const hasPremiumFeatures = (userRole: UserRole): boolean => {
  if (IS_TEST_MODE) {
    return true; // Bypass role checks in test mode
  }
  return [UserRole.MVP_DEALER, UserRole.SHOW_ORGANIZER].includes(userRole);
};

/**
 * Checks if a user needs to upgrade to access certain features.
 * ATTENDEE and DEALER roles need to upgrade for premium features.
 * @param userRole The role of the user.
 * @returns True if the user needs to upgrade, false otherwise.
 */
export const needsUpgrade = (userRole: UserRole): boolean => {
  if (IS_TEST_MODE) {
    return false; // Bypass role checks in test mode
  }
  return [UserRole.ATTENDEE, UserRole.DEALER].includes(userRole);
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
  const canReceive = targetUserRole === UserRole.MVP_DEALER || targetUserRole === UserRole.SHOW_ORGANIZER;
  
  // All users can send, but only certain roles can receive
  return canReceive;
};
