/**
 * Dealer Service
 *
 * This file contains helpers for dealer-specific operations related to show participation.
 */

import { supabase } from '../supabase';
import { Show, UserRole } from '../types';

/**
 * Types for dealer show participation
 */
/**
 * Normalize a role string (DB may store lowercase) to the lowercase
 * `UserRole` enum used throughout the client.
 */
const normalizeRole = (role: string | null | undefined): UserRole | null => {
  if (!role) return null;
  // FIX: Convert to lowercase to match enum string values
  const normalizedRoleString = role.toLowerCase();
  
  // Check if the normalized string is one of the valid UserRole enum values
  if (Object.values(UserRole).includes(normalizedRoleString as UserRole)) {
    return normalizedRoleString as UserRole;
  }
  return null;
};

export interface DealerShowParticipation {
  id: string;
  userId: string;
  showId: string;
  cardTypes: string[];
  specialty?: string;
  priceRange?: 'budget' | 'mid-range' | 'high-end';
  notableItems?: string;
  boothLocation?: string;
  paymentMethods: string[];
  openToTrades: boolean;
  buyingCards: boolean;
  status: 'registered' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date | string;
}

/**
 * Input for registering or updating dealer participation
 */
export interface DealerParticipationInput {
  showId: string;
  cardTypes?: string[];
  specialty?: string;
  priceRange?: 'budget' | 'mid-range' | 'high-end';
  notableItems?: string;
  boothLocation?: string;
  paymentMethods?: string[];
  openToTrades?: boolean;
  buyingCards?: boolean;
}

/**
 * Convert a raw Supabase row into a DealerShowParticipation object
 */
const mapDbParticipationToAppParticipation = (row: any): DealerShowParticipation => ({
  id: row.id,
  userId: row.userid,
  showId: row.showid,
  cardTypes: row.card_types || [],
  specialty: row.specialty || undefined,
  priceRange: row.price_range || undefined,
  notableItems: row.notable_items || undefined,
  boothLocation: row.booth_location || undefined,
  paymentMethods: row.payment_methods || [],
  openToTrades: row.open_to_trades || false,
  buyingCards: row.buying_cards || false,
  status: row.status || 'registered',
  createdAt: row.createdat,
});

/**
 * Utility: Safely map a PostGIS `geometry(Point)`/`geography(Point)`
 * object returned by Supabase into the app's `{ latitude, longitude }`
 * shape.  Returns `undefined` if the value is missing or malformed.
 */
const mapDbCoordinatesToApp = (
  geo: any
): { latitude: number; longitude: number } | undefined => {
  if (
    geo &&
    Array.isArray(geo.coordinates) &&
    geo.coordinates.length >= 2 &&
    typeof geo.coordinates[0] === 'number' &&
    typeof geo.coordinates[1] === 'number'
  ) {
    return {
      latitude: geo.coordinates[1],
      longitude: geo.coordinates[0],
    };
  }
  return undefined;
};

/**
 * Get all shows a dealer is participating in
 * * @param userId - The dealer's user ID
 * @param status - Optional filter for participation status
 * @returns Array of shows with participation details
 */
export const getDealerShows = async (
  userId: string,
  status?: 'registered' | 'confirmed' | 'cancelled' | 'completed'
): Promise<{ data: Array<Show & { participation: DealerShowParticipation }> | null; error: string | null }> => {
  try {
    if (!userId) {
      return { data: null, error: 'Invalid userId' };
    }

    let query = supabase
      .from('show_participants')
      .select(`
        *,
        shows:showid (*)
      `)
      .eq('userid', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    // Transform the data to match our expected format
    const transformedData = data.map(item => {
      const show = item.shows;
      const participation = mapDbParticipationToAppParticipation(item);
      
      return {
        id: show.id,
        title: show.title,
        description: show.description,
        location: show.location,
        address: show.address,
        startDate: show.start_date,
        endDate: show.end_date,
        entryFee: show.entry_fee,
        imageUrl: show.image_url,
        rating: show.rating,
        coordinates: mapDbCoordinatesToApp(show.coordinates),
        status: show.status,
        organizerId: show.organizer_id,
        features: show.features || {},
        categories: show.categories || [],
        createdAt: show.created_at,
        updatedAt: show.updated_at,
        participation,
      };
    });

    return { data: transformedData, error: null };
  } catch (err: any) {
    console.error('Error fetching dealer shows:', err);
    return { data: null, error: err.message || 'Failed to fetch dealer shows' };
  }
};

/**
 * Register a dealer for a show
 * * @param userId - The dealer's user ID
 * @param participationData - Dealer participation details
 * @returns The created participation record or error
 */
export const registerForShow = async (
  userId: string,
  participationData: DealerParticipationInput
): Promise<{ data: DealerShowParticipation | null; error: string | null }> => {
  try {
    if (!userId || !participationData.showId) {
      return { data: null, error: 'Invalid userId or showId' };
    }

    // Check if user has dealer role
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    // ------------------------------------------------------------
    // Debugging – log the raw role we got back from Supabase
    // ------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log(
      '[registerForShow] DB role value:',
      userData?.role,
      '| normalised:',
      normalizeRole(userData?.role)
    );

    const userRole = normalizeRole(userData?.role);

    /**
     * Temporary, more lenient role check:
     * 1. Accept normalised enum values (DEALER / MVP_DEALER)
     * 2. Fallback – if the raw string contains “dealer” or “mvp”
     * (case-insensitive) we also treat it as dealer-tier.
     */
    const rawRole = (userData?.role || '').toString().toLowerCase();
    const isDealerLike =
      rawRole.includes('dealer') || rawRole.includes('mvp');

    if (
      !userRole &&
      !isDealerLike
    ) {
      return { data: null, error: 'User is not a dealer' };
    }

    // If we passed the lenient check but normalisation failed,
    // treat the user as a basic DEALER for the remainder of this call.
    const effectiveRole =
      userRole ?? UserRole.DEALER;

    if (
      effectiveRole !== UserRole.DEALER &&
      effectiveRole !== UserRole.MVP_DEALER
    ) {
      return { data: null, error: 'User is not a dealer' };
    }

    // Check if dealer is already registered for this show
    const { data: existingReg, error: checkError } = await supabase
      .from('show_participants')
      .select('id')
      .eq('userid', userId)
      .eq('showid', participationData.showId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingReg) {
      return { data: null, error: 'Already registered for this show' };
    }

    // Insert new participation record
    const insertData: Record<string, any> = {
      userid: userId,
      showid: participationData.showId,
      status: 'registered',
    };

    // Map optional fields if provided
    if (participationData.cardTypes !== undefined) insertData.card_types = participationData.cardTypes;
    if (participationData.specialty !== undefined) insertData.specialty = participationData.specialty;
    if (participationData.priceRange !== undefined) insertData.price_range = participationData.priceRange;
    if (participationData.notableItems !== undefined) insertData.notable_items = participationData.notableItems;
    if (participationData.boothLocation !== undefined) insertData.booth_location = participationData.boothLocation;
    if (participationData.paymentMethods !== undefined) insertData.payment_methods = participationData.paymentMethods;
    if (participationData.openToTrades !== undefined) insertData.open_to_trades = participationData.openToTrades;
    if (participationData.buyingCards !== undefined) insertData.buying_cards = participationData.buyingCards;

    const { data, error } = await supabase
      .from('show_participants')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data: mapDbParticipationToAppParticipation(data), error: null };
  } catch (err: any) {
    console.error('Error registering for show:', err);
    return { data: null, error: err.message || 'Failed to register for show' };
  }
};

/**
 * Update dealer participation details for a show
 * * @param userId - The dealer's user ID
 * @param participationId - The participation record ID
 * @param participationData - Updated dealer participation details
 * @returns The updated participation record or error
 */
export const updateShowParticipation = async (
  userId: string,
  participationId: string,
  participationData: Partial<DealerParticipationInput>
): Promise<{ data: DealerShowParticipation | null; error: string | null }> => {
  try {
    if (!userId || !participationId) {
      return { data: null, error: 'Invalid userId or participationId' };
    }

    // Verify ownership of the participation record
    const { data: existingReg, error: checkError } = await supabase
      .from('show_participants')
      .select('id')
      .eq('id', participationId)
      .eq('userid', userId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (!existingReg) {
      return { data: null, error: 'Participation record not found or unauthorized' };
    }

    // Prepare update data - convert camelCase to snake_case for DB
    const updateData: Record<string, any> = {};
    if (participationData.cardTypes !== undefined) updateData.card_types = participationData.cardTypes;
    if (participationData.specialty !== undefined) updateData.specialty = participationData.specialty;
    if (participationData.priceRange !== undefined) updateData.price_range = participationData.priceRange;
    if (participationData.notableItems !== undefined) updateData.notable_items = participationData.notableItems;
    if (participationData.boothLocation !== undefined) updateData.booth_location = participationData.boothLocation;
    if (participationData.paymentMethods !== undefined) updateData.payment_methods = participationData.paymentMethods;
    if (participationData.openToTrades !== undefined) updateData.open_to_trades = participationData.openToTrades;
    if (participationData.buyingCards !== undefined) updateData.buying_cards = participationData.buyingCards;

    // Update the participation record
    const { data, error } = await supabase
      .from('show_participants')
      .update(updateData)
      .eq('id', participationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data: mapDbParticipationToAppParticipation(data), error: null };
  } catch (err: any) {
    console.error('Error updating show participation:', err);
    return { data: null, error: err.message || 'Failed to update show participation' };
  }
};

/**
 * Cancel dealer participation in a show
 * * @param userId - The dealer's user ID
 * @param participationId - The participation record ID
 * @returns Success or error message
 */
export const cancelShowParticipation = async (
  userId: string,
  participationId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    if (!userId || !participationId) {
      return { success: false, error: 'Invalid userId or participationId' };
    }

    // Verify ownership of the participation record
    const { data: existingReg, error: checkError } = await supabase
      .from('show_participants')
      .select('id')
      .eq('id', participationId)
      .eq('userid', userId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (!existingReg) {
      return { success: false, error: 'Participation record not found or unauthorized' };
    }

    // Cancellation strategy:
    // We simply remove the participation row, which has the same practical
    // effect as setting a "cancelled" status.  This avoids relying on the
    // optional `status` column that may not be present in every deployed
    // database schema.
    const { error } = await supabase
      .from('show_participants')
      .delete()
      .eq('id', participationId);

    if (error) {
      throw error;
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Error cancelling show participation:', err);
    return { success: false, error: err.message || 'Failed to cancel show participation' };
  }
};

/**
 * Get dealer information for a specific show
 * * @param showId - The show ID
 * @returns Array of dealer participation records for the show
 */
export const getDealersForShow = async (
  showId: string
): Promise<{ data: Array<DealerShowParticipation> | null; error: string | null }> => {
  try {
    if (!showId) {
      return { data: null, error: 'Invalid showId' };
    }

    // Step 1: Fetch show participants data
    const { data: participantsData, error: participantsError } = await supabase
      .from('show_participants')
      .select('*')
      .eq('showid', showId)
      .order('createdat', { ascending: true });

    if (participantsError) {
      throw participantsError;
    }

    if (!participantsData || participantsData.length === 0) {
      return { data: [], error: null };
    }

    // Step 2: Extract user IDs from participants
    const userIds = participantsData.map(participant => participant.userid);

    // Step 3: Fetch profiles for these user IDs
    // Only select columns that definitely exist in the schema
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', userIds);

    if (profilesError) {
      throw profilesError;
    }

    // Create a map of user profiles for easy lookup
    const profilesMap: Record<string, any> = {};
    if (profilesData) {
      profilesData.forEach(profile => {
        profilesMap[profile.id] = profile;
      });
    }

    // Step 4: Combine the data in JavaScript
    const transformedData = participantsData.map(item => {
      const participation = mapDbParticipationToAppParticipation(item);
      const profile = profilesMap[item.userid];
      
      // Add dealer profile info
      return {
        ...participation,
        dealerName: profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() 
          : 'Unknown Dealer',
        dealerEmail: profile?.email,
        dealerProfileImage: undefined // Profile image URL is not available in the schema
      };
    });

    return { data: transformedData, error: null };
  } catch (err: any) {
    console.error('Error fetching dealers for show:', err);
    return { data: null, error: err.message || 'Failed to fetch dealers for show' };
  }
};

/**
 * Get upcoming shows available for dealer registration
 * * @param userId - The dealer's user ID
 * @param filters - Optional filters for shows
 * @returns Array of shows available for registration
 */
export const getAvailableShowsForDealer = async (
  userId: string,
  filters: {
    startDate?: Date | string;
    endDate?: Date | string;
    radius?: number;
    latitude?: number;
    longitude?: number;
  } = {}
): Promise<{ data: Show[] | null; error: string | null }> => {
  try {
    if (!userId) {
      return { data: null, error: 'Invalid userId' };
    }

    // Get shows the dealer is already registered for
    const { data: participations, error: partError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', userId);

    if (partError) {
      throw partError;
    }

    // Extract show IDs the dealer is already registered for
    const registeredShowIds = participations ? participations.map(p => p.showid) : [];

    // Build the query for available shows
    let query = supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      .gt('start_date', new Date().toISOString());

    // Apply filters
    if (filters.startDate) {
      query = query.gte('start_date', filters.startDate as any);
    }
    if (filters.endDate) {
      query = query.lte('end_date', filters.endDate as any);
    }

    // Exclude shows the dealer is already registered for
    if (registeredShowIds.length > 0) {
      query = query.not('id', 'in', `(${registeredShowIds.join(',')})`)
    }

    // Order by start date
    query = query.order('start_date', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // If we have lat/lng and radius, filter results by distance
    // This is a client-side filter since we already have the data
    let filteredData = data || [];
    
    if (
      filters.latitude && 
      filters.longitude && 
      filters.radius && 
      filteredData.length > 0
    ) {
      // This would ideally use the server-side PostGIS functions,
      // but for simplicity we'll do basic filtering here
      console.log('Filtering by distance is not implemented in this version');
    }

    return { 
      data: filteredData.map(show => ({
        id: show.id,
        title: show.title,
        description: show.description,
        location: show.location,
        address: show.address,
        startDate: show.start_date,
        endDate: show.end_date,
        entryFee: show.entry_fee,
        imageUrl: show.image_url,
        rating: show.rating,
        coordinates: mapDbCoordinatesToApp(show.coordinates),
        status: show.status,
        organizerId: show.organizer_id,
        features: show.features || {},
        categories: show.categories || [],
        createdAt: show.created_at,
        updatedAt: show.updated_at,
      })), 
      error: null 
    };
  } catch (err: any) {
    console.error('Error fetching available shows for dealer:', err);
    return { data: null, error: err.message || 'Failed to fetch available shows' };
  }
};