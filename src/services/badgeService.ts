import { supabase } from '../supabase';
import { Badge, BadgeTier } from '../types';

/**
 * Get all badge definitions from the database
 */
export const getAllBadgeDefinitions = async (): Promise<Badge[]> => {
  try {
    const { data, error } = await supabase
      .from('badges_definitions')
      .select('*')
      .order('requirement_count', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      return [];
    }
    
    // Map the database records to our Badge type
    return data.map(badge => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.image_url,
      requirement: badge.requirement,
      tier: badge.tier as BadgeTier,
    }));
  } catch (error) {
    console.error('Error fetching badge definitions:', error);
    throw error;
  }
};

/**
 * Get a user's earned badges
 * @param userId The ID of the user
 */
export const getUserBadges = async (userId: string): Promise<Badge[]> => {
  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select(`
        badge_id,
        earned_at,
        badges_definitions (
          id,
          name,
          description,
          image_url,
          requirement,
          tier
        )
      `)
      .eq('user_id', userId);
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      return [];
    }
    
    // Map the database records to our Badge type
    return data.map(badge => ({
      id: badge.badges_definitions.id,
      name: badge.badges_definitions.name,
      description: badge.badges_definitions.description,
      imageUrl: badge.badges_definitions.image_url,
      requirement: badge.badges_definitions.requirement,
      tier: badge.badges_definitions.tier as BadgeTier,
      dateEarned: badge.earned_at,
    }));
  } catch (error) {
    console.error('Error fetching user badges:', error);
    throw error;
  }
};

/**
 * Get badges a user has not yet earned
 * @param userId The ID of the user
 */
export const getUnearnedBadges = async (userId: string): Promise<Badge[]> => {
  try {
    // First, get all badge definitions
    const allBadges = await getAllBadgeDefinitions();
    
    // Then, get the user's earned badges
    const userBadges = await getUserBadges(userId);
    
    // Get the IDs of the user's earned badges
    const earnedBadgeIds = userBadges.map(badge => badge.id);
    
    // Filter out the badges the user has already earned
    return allBadges.filter(badge => !earnedBadgeIds.includes(badge.id));
  } catch (error) {
    console.error('Error fetching unearned badges:', error);
    throw error;
  }
};

/**
 * Get a user's featured badges (most recent or highest tier)
 * @param userId The ID of the user
 * @param limit The maximum number of badges to return
 */
export const getUserFeaturedBadges = async (userId: string, limit: number = 3): Promise<Badge[]> => {
  try {
    const userBadges = await getUserBadges(userId);
    
    if (userBadges.length === 0) {
      return [];
    }
    
    // Sort badges by tier priority and then by date earned
    const tieredBadges = userBadges.sort((a, b) => {
      // Define tier priorities (higher number = higher priority)
      const tierPriority = {
        [BadgeTier.BRONZE]: 1,
        [BadgeTier.SILVER]: 2,
        [BadgeTier.GOLD]: 3,
        [BadgeTier.PLATINUM]: 4,
      };
      
      // First, sort by tier priority (highest first)
      const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) {
        return tierDiff;
      }
      
      // If tiers are the same, sort by date earned (most recent first)
      const dateA = new Date(a.dateEarned || 0);
      const dateB = new Date(b.dateEarned || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Return the top badges based on the limit
    return tieredBadges.slice(0, limit);
  } catch (error) {
    console.error('Error fetching featured badges:', error);
    throw error;
  }
};

/**
 * Get a user's next badge to earn (lowest requirement badge not yet earned)
 * @param userId The ID of the user
 */
export const getUserNextBadge = async (userId: string): Promise<Badge | null> => {
  try {
    const unearnedBadges = await getUnearnedBadges(userId);
    
    if (unearnedBadges.length === 0) {
      return null;
    }
    
    // Get the user's show attendance count from profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('show_attendance_count')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    const attendanceCount = profileData?.show_attendance_count || 0;
    
    // Filter attendance badges and find the one with the lowest requirement above current count
    const attendanceBadges = unearnedBadges.filter(
      badge => badge.requirement === 'show_attendance'
    );
    
    if (attendanceBadges.length === 0) {
      return null;
    }
    
    // Get badge definitions to access requirement_count
    const { data: badgeDefinitions, error: badgeError } = await supabase
      .from('badges_definitions')
      .select('*')
      .in('id', attendanceBadges.map(badge => badge.id))
      .order('requirement_count', { ascending: true });
    
    if (badgeError) {
      throw badgeError;
    }
    
    if (!badgeDefinitions || badgeDefinitions.length === 0) {
      return null;
    }
    
    // Find the next badge to earn (lowest requirement_count above current attendance)
    const nextBadgeDef = badgeDefinitions.find(
      badge => badge.requirement_count > attendanceCount
    );
    
    if (!nextBadgeDef) {
      // If no badge found above current count, return the highest requirement badge
      const highestBadgeDef = badgeDefinitions[badgeDefinitions.length - 1];
      
      // Map to our Badge type
      return {
        id: highestBadgeDef.id,
        name: highestBadgeDef.name,
        description: highestBadgeDef.description,
        imageUrl: highestBadgeDef.image_url,
        requirement: highestBadgeDef.requirement,
        tier: highestBadgeDef.tier as BadgeTier,
      };
    }
    
    // Map to our Badge type
    return {
      id: nextBadgeDef.id,
      name: nextBadgeDef.name,
      description: nextBadgeDef.description,
      imageUrl: nextBadgeDef.image_url,
      requirement: nextBadgeDef.requirement,
      tier: nextBadgeDef.tier as BadgeTier,
    };
  } catch (error) {
    console.error('Error fetching next badge:', error);
    throw error;
  }
};

/**
 * Get badge progress information for a user
 * @param userId The ID of the user
 * @param badgeId The ID of the badge to check progress for
 */
export const getBadgeProgress = async (userId: string, badgeId: string): Promise<{
  current: number;
  required: number;
  percent: number;
}> => {
  try {
    // Get the badge definition
    const { data: badgeDef, error: badgeError } = await supabase
      .from('badges_definitions')
      .select('*')
      .eq('id', badgeId)
      .single();
    
    if (badgeError) {
      throw badgeError;
    }
    
    if (!badgeDef) {
      throw new Error('Badge not found');
    }
    
    // Get the user's profile to check progress
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('show_attendance_count')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    const current = profileData?.show_attendance_count || 0;
    const required = badgeDef.requirement_count || 0;
    
    // Calculate percentage (cap at 100%)
    const percent = Math.min((current / required) * 100, 100);
    
    return {
      current,
      required,
      percent,
    };
  } catch (error) {
    console.error('Error getting badge progress:', error);
    throw error;
  }
};
