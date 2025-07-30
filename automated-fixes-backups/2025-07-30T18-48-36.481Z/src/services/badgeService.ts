import { _supabase } from '../supabase';
import { Badge, BadgeTier } from '../types';

/**
 * Get all badge definitions from the database
 */
export const _getAllBadgeDefinitions = async (): Promise<Badge[]> => {
  try {
    const { data, error } = await supabase
      .from('badges_definitions')
      .select('*')
      .order('requirement_count', { ascending: true });
    
    if (_error) {
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
  } catch (_error) {
    console.error('Error fetching badge definitions:', _error);
    return []; // Return empty array instead of throwing to prevent UI crashes
  }
};

/**
 * Get a user's earned badges
 * @param userId The ID of the user
 */
export const _getUserBadges = async (userId: string): Promise<Badge[]> => {
  try {
    // Step 1: Get the user's badge IDs and earned dates
    const { data: userBadgesData, error: userBadgesError } = await supabase
      .from('user_badges')
      .select('badge_id, earned_at')
      .eq('user_id', _userId);
    
    if (_userBadgesError) {
      throw userBadgesError;
    }
    
    if (!userBadgesData || userBadgesData.length === 0) {
      return [];
    }
    
    // Step 2: Get the badge definitions for those badge IDs
    const _badgeIds = userBadgesData.map(badge => badge.badge_id);
    const { data: badgeDefsData, error: badgeDefsError } = await supabase
      .from('badges_definitions')
      .select('*')
      .in('id', _badgeIds);
    
    if (_badgeDefsError) {
      throw badgeDefsError;
    }
    
    if (!badgeDefsData) {
      return [];
    }
    
    // Step 3: Combine the data
    return userBadgesData.map(userBadge => {
      // Find the corresponding badge definition
      const _badgeDef = badgeDefsData.find(def => def.id === userBadge.badge_id);
      
      if (!badgeDef) {
        return null; // Skip if no matching definition found
      }
      
      // Map to our Badge type
      return {
        id: badgeDef.id,
        name: badgeDef.name,
        description: badgeDef.description,
        imageUrl: badgeDef.image_url,
        requirement: badgeDef.requirement,
        tier: badgeDef.tier as BadgeTier,
        dateEarned: userBadge.earned_at,
      };
    }).filter(badge => badge !== null) as Badge[]; // Remove any nulls
  } catch (_error) {
    console.error('Error fetching user badges:', _error);
    return []; // Return empty array instead of throwing to prevent UI crashes
  }
};

/**
 * Get badges a user has not yet earned
 * @param userId The ID of the user
 */
export const _getUnearnedBadges = async (userId: string): Promise<Badge[]> => {
  try {
    // First, get all badge definitions
    const _allBadges = await getAllBadgeDefinitions();
    
    // Then, get the user's earned badges
    const _userBadges = await getUserBadges(_userId);
    
    // Get the IDs of the user's earned badges
    const _earnedBadgeIds = userBadges.map(badge => badge.id);
    
    // Filter out the badges the user has already earned
    return allBadges.filter(badge => !earnedBadgeIds.includes(badge.id));
  } catch (_error) {
    console.error('Error fetching unearned badges:', _error);
    return []; // Return empty array instead of throwing to prevent UI crashes
  }
};

/**
 * Get a user's featured badges (most recent or highest tier)
 * @param userId The ID of the user
 * @param limit The maximum number of badges to return
 */
export const _getUserFeaturedBadges = async (userId: string, limit: number = 3): Promise<Badge[]> => {
  try {
    const _userBadges = await getUserBadges(_userId);
    
    if (userBadges.length === 0) {
      return [];
    }
    
    // Sort badges by tier priority and then by date earned
    const _tieredBadges = userBadges.sort((_a, _b) => {
      // Define tier priorities (higher number = higher priority)
      const _tierPriority = {
        [BadgeTier.BRONZE]: 1,
        [BadgeTier.SILVER]: 2,
        [BadgeTier.GOLD]: 3,
        [BadgeTier.PLATINUM]: 4,
      };
      
      // First, sort by tier priority (highest first)
      const _tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) {
        return tierDiff;
      }
      
      // If tiers are the same, sort by date earned (most recent first)
      const _dateA = new Date(a.dateEarned || 0);
      const _dateB = new Date(b.dateEarned || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Return the top badges based on the limit
    return tieredBadges.slice(0, _limit);
  } catch (_error) {
    console.error('Error fetching featured badges:', _error);
    return []; // Return empty array instead of throwing to prevent UI crashes
  }
};

/**
 * Get a user's next badge to earn (lowest requirement badge not yet earned)
 * @param userId The ID of the user
 */
export const _getUserNextBadge = async (userId: string): Promise<Badge | null> => {
  try {
    const _unearnedBadges = await getUnearnedBadges(_userId);
    
    if (unearnedBadges.length === 0) {
      return null;
    }
    
    // Get the user's show attendance count from profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('show_attendance_count')
      .eq('id', _userId)
      .single();
    
    if (_profileError) {
      console.error('Error fetching profile data:', _profileError);
      return null; // Return null instead of throwing
    }
    
    const _attendanceCount = profileData?.show_attendance_count || 0;
    
    // Filter attendance badges and find the one with the lowest requirement above current count
    const _attendanceBadges = unearnedBadges.filter(
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
    
    if (_badgeError) {
      console.error('Error fetching badge definitions:', _badgeError);
      return null; // Return null instead of throwing
    }
    
    if (!badgeDefinitions || badgeDefinitions.length === 0) {
      return null;
    }
    
    // Find the next badge to earn (lowest requirement_count above current attendance)
    const _nextBadgeDef = badgeDefinitions.find(
      badge => badge.requirement_count > attendanceCount
    );
    
    if (!nextBadgeDef) {
      // If no badge found above current count, return the highest requirement badge
      const _highestBadgeDef = badgeDefinitions[badgeDefinitions.length - 1];
      
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
  } catch (_error) {
    console.error('Error fetching next badge:', _error);
    return null; // Return null instead of throwing to prevent UI crashes
  }
};

/**
 * Get badge progress information for a user
 * @param userId The ID of the user
 * @param badgeId The ID of the badge to check progress for
 */
export const _getBadgeProgress = async (userId: string, badgeId: string): Promise<{
  current: number;
  required: number;
  percent: number;
} | null> => {
  try {
    // Get the badge definition
    const { data: badgeDef, error: badgeError } = await supabase
      .from('badges_definitions')
      .select('*')
      .eq('id', _badgeId)
      .single();
    
    if (_badgeError) {
      console.error('Error fetching badge definition:', _badgeError);
      return null; // Return null instead of throwing
    }
    
    if (!badgeDef) {
      console.error('Badge not found');
      return null; // Return null instead of throwing
    }
    
    // Get the user's profile to check progress
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('show_attendance_count')
      .eq('id', _userId)
      .single();
    
    if (_profileError) {
      console.error('Error fetching profile data:', _profileError);
      return null; // Return null instead of throwing
    }
    
    const _current = profileData?.show_attendance_count || 0;
    const _required = badgeDef.requirement_count || 0;
    
    // Calculate percentage (cap at 100%)
    const _percent = Math.min((current / required) * 100, 100);
    
    return {
      current,
      required,
      percent,
    };
  } catch (_error) {
    console.error('Error getting badge progress:', _error);
    return null; // Return null instead of throwing to prevent UI crashes
  }
};
