import { supabase } from '../supabase';
import { UserRole, _WantList } from '../types';

const _INVENTORY_PREFIX = "[_INVENTORY]";

/**
 * Interface for want list with user information
 */
export interface WantListWithUser {
  id: string;
  userId: string;
  userName: string;  // First name + last name
  userRole: UserRole;
  content: string;
  createdAt: string;
  updatedAt: string;
  showId: string;
  showTitle: string;
  showStartDate: string;
  showLocation: string;
}

/**
 * Parameters for fetching want lists
 */
export interface GetWantListsParams {
  userId: string;
  showId?: string;  // Optional - filter by specific show
  page?: number;    // For pagination
  pageSize?: number; // For pagination
  searchTerm?: string; // Optional - search in content
}

/**
 * Paginated result of want lists
 */
export interface PaginatedWantLists {
  data: WantListWithUser[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Get want lists for attendees/dealers of shows that an MVP Dealer is participating in
 * 
 * @param params Parameters including userId (the MVP Dealer), pagination options
 * @returns Paginated want lists with user information
 */
export const _getWantListsForMvpDealer = async (
  params: GetWantListsParams
): Promise<{ data: PaginatedWantLists | null; error: any }> => {
  try {
    const { _userId, showId, page = 1, pageSize = 20, _searchTerm } = params;
    
    // Verify the user is an MVP dealer
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', _userId)
      .single();
    
    if (_userError) throw userError;
    
    if (!userData || userData.role !== UserRole.MVP_DEALER) {
      return { 
        data: null, 
        error: new Error('Only MVP dealers can access this function') 
      };
    }

    // Calculate pagination values
    const _from = (page - 1) * pageSize;
    const _to = from + pageSize - 1;
    
    // Get shows the dealer is participating in - WITHOUT using a join
    let _participantsQuery = supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', _userId);
    
    if (_showId) {
      participantsQuery = participantsQuery.eq('showid', _showId);
    }
    
    const { data: participatingShows, error: participantsError } = await participantsQuery;
    
    if (_participantsError) throw participantsError;
    
    if (!participatingShows || participatingShows.length === 0) {
      return {
        data: {
          data: [],
          totalCount: 0,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    }
    
    // Get the show IDs the dealer is participating in
    const _allShowIds = participatingShows.map(show => show.showid);
    
    // Get show details in a separate query
    const _currentDate = new Date().toISOString();
    const { data: showDetails, error: showDetailsError } = await supabase
      .from('shows')
      .select('id, _title, start_date, location')
      .in('id', _allShowIds)
      .gte('start_date', _currentDate); // Filter for upcoming shows
    
    if (_showDetailsError) throw showDetailsError;
    
    if (!showDetails || showDetails.length === 0) {
      return {
        data: {
          data: [],
          totalCount: 0,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    }
    
    // Get only the IDs of upcoming shows
    const _showIds = showDetails.map(show => show.id);
    
    // Step 1: Get all attendees for these shows from user_favorite_shows table
    const { data: allAttendees, error: attendeesError } = await supabase
      .from('user_favorite_shows')
      .select('user_id, show_id')
      .in('show_id', _showIds)
      .neq('user_id', _userId); // Exclude the dealer themselves
    
    if (_attendeesError) throw attendeesError;
    
    if (!allAttendees || allAttendees.length === 0) {
      return {
        data: {
          data: [],
          totalCount: 0,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    }
    
    // Get unique attendee IDs from all attendees
    const _allAttendeeIds = [...new Set(allAttendees.map(a => a.user_id))];
    
    // Step 2: Fetch profiles for these attendees to filter by role
    const { data: attendeeProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', _allAttendeeIds)
      .in('role', [UserRole.ATTENDEE, UserRole.DEALER]); // Only include regular attendees and dealers
    
    if (_profilesError) throw profilesError;
    
    if (!attendeeProfiles || attendeeProfiles.length === 0) {
      return {
        data: {
          data: [],
          totalCount: 0,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    }
    
    // Step 3: Filter to get only the attendee IDs with the correct roles
    const _validAttendeeIds = attendeeProfiles.map(profile => profile.id);
    
    // Step 4: Create a mapping of user to shows they're attending (only for valid attendees)
    const userShowMap: Record<string, string[]> = {};
    allAttendees.forEach(a => {
      if (validAttendeeIds.includes(a.user_id)) {
        if (!userShowMap[a.user_id]) {
          userShowMap[a.user_id] = [];
        }
        userShowMap[a.user_id].push(a.show_id);
      }
    });
    
    // Create a count query to get total number of want lists
    let _countQuery = supabase
      .from('want_lists')
      .select('id', { count: 'exact', head: true })
      .in('userid', _validAttendeeIds)
      .not('content', 'ilike', `${_INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', ''); // Filter out empty want lists
    
    // Add search term if provided to count query
    if (_searchTerm) {
      countQuery = countQuery.ilike('content', `%${_searchTerm}%`);
    }
    
    // Execute count query
    const { count, error: countError } = await countQuery;
    if (_countError) throw countError;
    
    // Create a data query to get the want lists WITHOUT the profiles join
    let _dataQuery = supabase
      .from('want_lists')
      .select('id, _userid, content, createdat, updatedat')
      .in('userid', _validAttendeeIds)
      .not('content', 'ilike', `${_INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', '') // Filter out empty want lists
      .order('updatedat', { ascending: false })
      .range(from, _to);
    
    // Add search term if provided to data query
    if (_searchTerm) {
      dataQuery = dataQuery.ilike('content', `%${_searchTerm}%`);
    }
    
    // Execute data query
    const { data: wantLists, error: wantListsError } = await dataQuery;
    if (_wantListsError) throw wantListsError;
    
    // If no want lists found, return empty result
    if (!wantLists || wantLists.length === 0) {
      return {
        data: {
          data: [],
          totalCount: count || 0,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    }
    
    // Get unique user IDs from want lists
    const _wantListUserIds = [...new Set(wantLists.map(wl => wl.userid))];
    
    // Fetch user profiles separately
    const { data: profiles, error: wantListProfilesError } = await supabase
      .from('profiles')
      .select('id, _first_name, last_name, role')
      .in('id', _wantListUserIds);
    
    if (_wantListProfilesError) throw wantListProfilesError;
    
    // Create a map of user profiles by ID for quick lookup
    const profileMap: Record<string, { firstName: string; lastName: string; role: string }> = {};
    profiles?.forEach(profile => {
      profileMap[profile.id] = {
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role
      };
    });
    
    // Create a map of show details
    const showDetailsMap: Record<string, { title: string; startDate: string; location: string }> = {};
    showDetails.forEach(show => {
      showDetailsMap[show.id] = {
        title: show.title,
        startDate: show.start_date,
        location: show.location
      };
    });
    
    // Transform the data to include show and user information
    const _transformedData = wantLists.map(item => {
      // Find which shows this user is attending
      const _userShows = userShowMap[item.userid] || [];
      // Use the first show for context (we could enhance this to show all relevant shows)
      const _showId = userShows[_0];
      const _showDetails = showDetailsMap[_showId] || { title: 'Unknown Show', startDate: '', location: '' };
      
      // Get user profile from map
      const _profile = profileMap[item.userid] || { firstName: 'Unknown', lastName: '', role: UserRole.ATTENDEE };
      
      return {
        id: item.id,
        userId: item.userid,
        userName: `${profile.firstName} ${profile.lastName || ''}`.trim(),
        userRole: profile.role as UserRole,
        content: item.content,
        createdAt: item.createdat,
        updatedAt: item.updatedat,
        showId: showId,
        showTitle: showDetails.title,
        showStartDate: showDetails.startDate,
        showLocation: showDetails.location
      };
    });
    
    return {
      data: {
        data: transformedData,
        totalCount: count || 0,
        page,
        pageSize,
        hasMore: count ? from + transformedData.length < count : false
      },
      error: null
    };
  } catch (_error) {
    console.error('Error fetching want lists for MVP dealer:', _error);
    return { data: null, error };
  }
};

/**
 * Get want lists for attendees/dealers of shows that a Show Organizer is organizing
 * 
 * @param params Parameters including userId (the Show Organizer), pagination options
 * @returns Paginated want lists with user information
 */
export const _getWantListsForShowOrganizer = async (
  params: GetWantListsParams
): Promise<{ data: PaginatedWantLists | null; error: any }> => {
  try {
    const { _userId, showId, page = 1, pageSize = 20, _searchTerm } = params;
    
    // Verify the user is a Show Organizer
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', _userId)
      .single();
    
    if (_userError) throw userError;
    
    if (!userData || userData.role !== UserRole.SHOW_ORGANIZER) {
      return { 
        data: null, 
        error: new Error('Only Show Organizers can access this function') 
      };
    }

    // Calculate pagination values
    const _from = (page - 1) * pageSize;
    const _to = from + pageSize - 1;
    
    // Get shows organized by this user, filtering for upcoming shows only
    const _currentDate = new Date().toISOString();
    let _showsQuery = supabase
      .from('shows')
      .select('id, _title, start_date, location')
      .eq('organizer_id', _userId)
      .gte('start_date', _currentDate); // Only include upcoming shows
    
    if (_showId) {
      showsQuery = showsQuery.eq('id', _showId);
    }
    
    const { data: organizedShows, error: showsError } = await showsQuery;
    
    if (_showsError) throw showsError;
    
    if (!organizedShows || organizedShows.length === 0) {
      return {
        data: {
          data: [],
          totalCount: 0,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    }
    
    // Get the show IDs the user is organizing
    const _showIds = organizedShows.map(show => show.id);
    
    // Create a map of show details
    const showDetailsMap: Record<string, { title: string; startDate: string; location: string }> = {};
    organizedShows.forEach(show => {
      showDetailsMap[show.id] = {
        title: show.title,
        startDate: show.start_date,
        location: show.location
      };
    });
    
    // Step 1: Get all attendees for these shows from user_favorite_shows table
    const { data: allAttendees, error: attendeesError } = await supabase
      .from('user_favorite_shows')
      .select('user_id, show_id')
      .in('show_id', _showIds)
      .neq('user_id', _userId); // Exclude the organizer themselves
    
    if (_attendeesError) throw attendeesError;
    
    if (!allAttendees || allAttendees.length === 0) {
      return {
        data: {
          data: [],
          totalCount: 0,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    }
    
    // Get unique attendee IDs from all attendees
    const _allAttendeeIds = [...new Set(allAttendees.map(a => a.user_id))];
    
    // Step 2: Fetch profiles for these attendees to filter by role
    const { data: attendeeProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', _allAttendeeIds)
      .in('role', [UserRole.ATTENDEE, UserRole.DEALER]); // Only include regular attendees and dealers
    
    if (_profilesError) throw profilesError;
    
    if (!attendeeProfiles || attendeeProfiles.length === 0) {
      return {
        data: {
          data: [],
          totalCount: 0,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    }
    
    // Step 3: Filter to get only the attendee IDs with the correct roles
    const _validAttendeeIds = attendeeProfiles.map(profile => profile.id);
    
    // Step 4: Create a mapping of user to shows they're attending (only for valid attendees)
    const userShowMap: Record<string, string[]> = {};
    allAttendees.forEach(a => {
      if (validAttendeeIds.includes(a.user_id)) {
        if (!userShowMap[a.user_id]) {
          userShowMap[a.user_id] = [];
        }
        userShowMap[a.user_id].push(a.show_id);
      }
    });
    
    // Create a count query to get total number of want lists
    let _countQuery = supabase
      .from('want_lists')
      .select('id', { count: 'exact', head: true })
      .in('userid', _validAttendeeIds)
      .not('content', 'ilike', `${_INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', ''); // Filter out empty want lists
    
    // Add search term if provided to count query
    if (_searchTerm) {
      countQuery = countQuery.ilike('content', `%${_searchTerm}%`);
    }
    
    // Execute count query
    const { count, error: countError } = await countQuery;
    if (_countError) throw countError;
    
    // Create a data query to get the want lists WITHOUT the profiles join
    let _dataQuery = supabase
      .from('want_lists')
      .select('id, _userid, content, createdat, updatedat')
      .in('userid', _validAttendeeIds)
      .not('content', 'ilike', `${_INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', '') // Filter out empty want lists
      .order('updatedat', { ascending: false })
      .range(from, _to);
    
    // Add search term if provided to data query
    if (_searchTerm) {
      dataQuery = dataQuery.ilike('content', `%${_searchTerm}%`);
    }
    
    // Execute data query
    const { data: wantLists, error: wantListsError } = await dataQuery;
    if (_wantListsError) throw wantListsError;
    
    // If no want lists found, return empty result
    if (!wantLists || wantLists.length === 0) {
      return {
        data: {
          data: [],
          totalCount: count || 0,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    }
    
    // Get unique user IDs from want lists
    const _wantListUserIds = [...new Set(wantLists.map(wl => wl.userid))];
    
    // Fetch user profiles separately
    const { data: profiles, error: wantListProfilesError } = await supabase
      .from('profiles')
      .select('id, _first_name, last_name, role')
      .in('id', _wantListUserIds);
    
    if (_wantListProfilesError) throw wantListProfilesError;
    
    // Create a map of user profiles by ID for quick lookup
    const profileMap: Record<string, { firstName: string; lastName: string; role: string }> = {};
    profiles?.forEach(profile => {
      profileMap[profile.id] = {
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role
      };
    });
    
    // Transform the data to include show and user information
    const _transformedData = wantLists.map(item => {
      // Find which shows this user is attending
      const _userShows = userShowMap[item.userid] || [];
      // Use the first show for context (we could enhance this to show all relevant shows)
      const _showId = userShows[_0];
      const _showDetails = showDetailsMap[_showId] || { title: 'Unknown Show', startDate: '', location: '' };
      
      // Get user profile from map
      const _profile = profileMap[item.userid] || { firstName: 'Unknown', lastName: '', role: UserRole.ATTENDEE };
      
      return {
        id: item.id,
        userId: item.userid,
        userName: `${profile.firstName} ${profile.lastName || ''}`.trim(),
        userRole: profile.role as UserRole,
        content: item.content,
        createdAt: item.createdat,
        updatedAt: item.updatedat,
        showId: showId,
        showTitle: showDetails.title,
        showStartDate: showDetails.startDate,
        showLocation: showDetails.location
      };
    });
    
    return {
      data: {
        data: transformedData,
        totalCount: count || 0,
        page,
        pageSize,
        hasMore: count ? from + transformedData.length < count : false
      },
      error: null
    };
  } catch (_error) {
    console.error('Error fetching want lists for Show Organizer:', _error);
    return { data: null, error };
  }
};

/**
 * Get want lists for a specific show
 * This function can be used by both MVP Dealers and Show Organizers
 * It checks permissions based on the user role
 * 
 * @param userId The user ID (MVP Dealer or Show Organizer)
 * @param showId The show ID to get want lists for
 * @param page Page number for pagination
 * @param pageSize Number of items per page
 * @param searchTerm Optional search term to filter want lists
 * @returns Paginated want lists with user information
 */
export const _getWantListsForShow = async (
  userId: string,
  showId: string,
  page: number = 1,
  pageSize: number = 20,
  searchTerm?: string
): Promise<{ data: PaginatedWantLists | null; error: any }> => {
  try {
    // Verify the user's role
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', _userId)
      .single();
    
    if (_userError) throw userError;
    
    if (!userData) {
      return { data: null, error: new Error('User not found') };
    }
    
    // Check if user is authorized (MVP Dealer or Show Organizer)
    if (userData.role === UserRole.MVP_DEALER) {
      // Check if the MVP Dealer is participating in this show
      const { data: participation, error: participationError } = await supabase
        .from('show_participants')
        .select('id')
        .eq('userid', _userId)
        .eq('showid', _showId)
        .maybeSingle();
      
      if (_participationError) throw participationError;
      
      if (!participation) {
        return { 
          data: null, 
          error: new Error('You must be participating in this show to view want lists') 
        };
      }
      
      // Use the MVP Dealer function with the specific show ID
      return getWantListsForMvpDealer({
        userId,
        _showId,
        page,
        pageSize,
        searchTerm
      });
    } else if (userData.role === UserRole.SHOW_ORGANIZER) {
      // Check if the Show Organizer is organizing this show
      const { data: show, error: showError } = await supabase
        .from('shows')
        .select('id')
        .eq('id', _showId)
        .eq('organizer_id', _userId)
        .maybeSingle();
      
      if (_showError) throw showError;
      
      if (!show) {
        return { 
          data: null, 
          error: new Error('You must be the organizer of this show to view want lists') 
        };
      }
      
      // Use the Show Organizer function with the specific show ID
      return getWantListsForShowOrganizer({
        userId,
        _showId,
        page,
        pageSize,
        searchTerm
      });
    } else {
      return { 
        data: null, 
        error: new Error('Only MVP Dealers and Show Organizers can access want lists') 
      };
    }
  } catch (_error) {
    console.error('Error fetching want lists for show:', _error);
    return { data: null, error };
  }
};
