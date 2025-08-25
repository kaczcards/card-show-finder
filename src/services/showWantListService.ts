import { supabase } from '../supabase';
import { UserRole, WantList as _WantList } from '../types';

const INVENTORY_PREFIX = "[INVENTORY]";

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
export const getWantListsForMvpDealer = async (
  params: GetWantListsParams
): Promise<{ data: PaginatedWantLists | null; error: any }> => {
  try {
    const { userId, showId, page = 1, pageSize = 20, searchTerm } = params;

    /* ------------------------------------------------------------------
     * Fast-path via SECURITY DEFINER RPC (bypasses RLS complexity)
     * ----------------------------------------------------------------*/
    const {
      data: rpcData,
      error: rpcError,
    } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: userId,
      show_id: showId ?? null,
      search_term: searchTerm ?? null,
      page,
      page_size: pageSize,
    });

    if (!rpcError && rpcData && !rpcData.error && Array.isArray(rpcData.data)) {
      const transformed: WantListWithUser[] = rpcData.data.map(
        (item: any): WantListWithUser => ({
          id: item.id,
          userId: item.userId,
          userName: item.userName,
          userRole: item.userRole ?? UserRole.ATTENDEE, // fallback
          content: item.content,
          createdAt: item.updatedAt, // RPC doesn’t return createdAt
          updatedAt: item.updatedAt,
          showId: item.showId,
          showTitle: item.showTitle,
          showStartDate: item.showStartDate,
          showLocation: item.showLocation,
        }),
      );

      const paginated: PaginatedWantLists = {
        data: transformed,
        totalCount: rpcData.totalCount ?? transformed.length,
        page: rpcData.page ?? page,
        pageSize: rpcData.pageSize ?? pageSize,
        hasMore:
          typeof rpcData.hasMore === 'boolean'
            ? rpcData.hasMore
            : false,
      };

      return { data: paginated, error: null };
    }
    
    /* ------------------------------------------------------------------
     * Fallback RPC v1 (older): get_accessible_want_lists
     * This RPC returns full un-paginated array; we filter & paginate here
     * ----------------------------------------------------------------*/
    const { data: rpc2, error: rpc2Error } = await supabase.rpc(
      'get_accessible_want_lists',
      { viewer_id: userId }
    );

    if (!rpc2Error && Array.isArray(rpc2)) {
      // Normalise field names coming from legacy RPC
      let items: WantListWithUser[] = rpc2.map((r: any): WantListWithUser => ({
        id: r.want_list_id ?? r.id,
        userId: r.attendee_id ?? r.userid,
        userName: r.attendee_name ?? r.userName ?? '',
        userRole: UserRole.ATTENDEE,
        content: r.content,
        createdAt: r.updated_at ?? r.updatedAt ?? '',
        updatedAt: r.updated_at ?? r.updatedAt ?? '',
        showId: r.show_id ?? r.showId ?? '',
        showTitle: r.show_title ?? r.showTitle ?? '',
        showStartDate: r.show_start_date ?? r.showStartDate ?? '',
        showLocation: r.show_location ?? r.showLocation ?? '',
      }));

      // Optional filters
      if (showId) {
        items = items.filter((i) => i.showId === showId);
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        items = items.filter((i) => i.content?.toLowerCase().includes(term));
      }

      const totalCount = items.length;
      const start = (page - 1) * pageSize;
      const paged = items.slice(start, start + pageSize);

      return {
        data: {
          data: paged,
          totalCount,
          page,
          pageSize,
          hasMore: start + paged.length < totalCount,
        },
        error: null,
      };
    }

    // Verify the user is an MVP dealer
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    
    if (!userData || userData.role !== UserRole.MVP_DEALER) {
      return { 
        data: null, 
        error: new Error('Only MVP dealers can access this function') 
      };
    }

    // Calculate pagination values
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    // Get shows the dealer is participating in
    let participantsQuery = supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', userId);
    
    if (showId) {
      participantsQuery = participantsQuery.eq('showid', showId);
    }
    
    const { data: participatingShows, error: participantsError } = await participantsQuery;
    
    if (participantsError) throw participantsError;
    
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
    const allShowIds = participatingShows.map(show => show.showid);
    
    // Get show details in a separate query
    const currentDate = new Date().toISOString();
    /* ------------------------------------------------------------------
     * Upcoming _or_ ongoing shows:
     *   • If end_date exists – use `end_date >= today`
     *   • If end_date is NULL – fall back to `start_date >= today`
     * ----------------------------------------------------------------*/
    const { data: showDetails, error: showDetailsError } = await supabase
      .from('shows')
      .select('id, title, start_date, end_date, location')
      .in('id', allShowIds)
      .or(
        `end_date.gte.${currentDate},and(end_date.is.null,start_date.gte.${currentDate})`
      );
    
    if (showDetailsError) throw showDetailsError;
    
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
    const showIds = showDetails.map(show => show.id);
    
    // Create a map of show details for quick lookup
    const showDetailsMap: Record<string, { title: string; startDate: string; location: string }> = {};
    showDetails.forEach(show => {
      showDetailsMap[show.id] = {
        title: show.title,
        startDate: show.start_date,
        location: show.location
      };
    });
    
    /* ------------------------------------------------------------------
     * Step 1: fetch attendees / dealers (incl MVP dealers) who have
     *         REGISTERED or CONFIRMED participation via show_participants
     * ----------------------------------------------------------------*/
    const { data: allAttendees, error: attendeesError } = await supabase
      .from('show_participants')
      .select('userid, showid, role, status')
      .in('showid', showIds)
      .neq('userid', userId)
      .in('role', [
        UserRole.ATTENDEE,
        UserRole.DEALER,
        UserRole.MVP_DEALER,
      ])
      .in('status', ['registered', 'confirmed']);
    
    if (attendeesError) throw attendeesError;
    
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
    const allAttendeeIds = [...new Set(allAttendees.map(a => a.userid))];
    
    // Step 2: Fetch profiles for these attendees to filter by role
    const { data: attendeeProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', allAttendeeIds)
      .in('role', [
        UserRole.ATTENDEE,
        UserRole.DEALER,
        UserRole.MVP_DEALER,
      ]);
    
    if (profilesError) throw profilesError;
    
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
    const validAttendeeIds = attendeeProfiles.map(profile => profile.id);
    
    // Step 4: Create a mapping of user to shows they're attending (only for valid attendees)
    const userShowMap: Record<string, string[]> = {};
    allAttendees.forEach(a => {
      if (validAttendeeIds.includes(a.userid)) {
        if (!userShowMap[a.userid]) {
          userShowMap[a.userid] = [];
        }
        userShowMap[a.userid].push(a.showid);
      }
    });
    
    // Create a count query to get total number of want lists
    let countQuery = supabase
      .from('want_lists')
      .select('id', { count: 'exact', head: true })
      .in('userid', validAttendeeIds)
      .not('content', 'ilike', `${INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', ''); // Filter out empty want lists
    
    // Add search term if provided to count query
    if (searchTerm) {
      countQuery = countQuery.ilike('content', `%${searchTerm}%`);
    }
    
    // Execute count query
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    
    // Create a data query to get the want lists WITHOUT the profiles join
    let dataQuery = supabase
      .from('want_lists')
      .select('id, userid, content, createdat, updatedat')
      .in('userid', validAttendeeIds)
      .not('content', 'ilike', `${INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', '') // Filter out empty want lists
      .order('updatedat', { ascending: false })
      .range(from, to);
    
    // Add search term if provided to data query
    if (searchTerm) {
      dataQuery = dataQuery.ilike('content', `%${searchTerm}%`);
    }
    
    // Execute data query
    const { data: wantLists, error: wantListsError } = await dataQuery;
    if (wantListsError) throw wantListsError;
    
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
    const wantListUserIds = [...new Set(wantLists.map(wl => wl.userid))];
    
    // Fetch user profiles separately
    const { data: profiles, error: wantListProfilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .in('id', wantListUserIds);
    
    if (wantListProfilesError) throw wantListProfilesError;
    
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
    const transformedData = wantLists.map(item => {
      // Find which shows this user is attending
      const userShows = userShowMap[item.userid] || [];
      // Use the first show for context (we could enhance this to show all relevant shows)
      const showId = userShows[0];
      const showDetails = showDetailsMap[showId] || { title: 'Unknown Show', startDate: '', location: '' };
      
      // Get user profile from map
      const profile = profileMap[item.userid] || { firstName: 'Unknown', lastName: '', role: UserRole.ATTENDEE };
      
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
  } catch (error) {
    console.error('Error fetching want lists for MVP dealer:', error);
    return { data: null, error };
  }
};

/**
 * Get want lists for attendees/dealers of shows that a Show Organizer is organizing
 * 
 * @param params Parameters including userId (the Show Organizer), pagination options
 * @returns Paginated want lists with user information
 */
export const getWantListsForShowOrganizer = async (
  params: GetWantListsParams
): Promise<{ data: PaginatedWantLists | null; error: any }> => {
  try {
    const { userId, showId, page = 1, pageSize = 20, searchTerm } = params;

    /* ------------------------------------------------------------------
     * Fast-path via SECURITY DEFINER RPC (bypasses RLS complexity)
     * ----------------------------------------------------------------*/
    const {
      data: rpcData,
      error: rpcError,
    } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: userId,
      show_id: showId ?? null,
      search_term: searchTerm ?? null,
      page,
      page_size: pageSize,
    });

    if (!rpcError && rpcData && !rpcData.error && Array.isArray(rpcData.data)) {
      const transformed: WantListWithUser[] = rpcData.data.map(
        (item: any): WantListWithUser => ({
          id: item.id,
          userId: item.userId,
          userName: item.userName,
          userRole: item.userRole ?? UserRole.ATTENDEE,
          content: item.content,
          createdAt: item.updatedAt,
          updatedAt: item.updatedAt,
          showId: item.showId,
          showTitle: item.showTitle,
          showStartDate: item.showStartDate,
          showLocation: item.showLocation,
        }),
      );

      const paginated: PaginatedWantLists = {
        data: transformed,
        totalCount: rpcData.totalCount ?? transformed.length,
        page: rpcData.page ?? page,
        pageSize: rpcData.pageSize ?? pageSize,
        hasMore:
          typeof rpcData.hasMore === 'boolean'
            ? rpcData.hasMore
            : false,
      };

      return { data: paginated, error: null };
    }
    
    // Verify the user is a Show Organizer
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    
    if (!userData || userData.role !== UserRole.SHOW_ORGANIZER) {
      return { 
        data: null, 
        error: new Error('Only Show Organizers can access this function') 
      };
    }

    // Calculate pagination values
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    // Get shows organized by this user, filtering for upcoming shows only
    const currentDate = new Date().toISOString();
    let showsQuery = supabase
      .from('shows')
      .select('id, title, start_date, end_date, location')
      .eq('organizer_id', userId)
      // Upcoming **or** ongoing – see MVP dealer helper above
      .or(
        `end_date.gte.${currentDate},and(end_date.is.null,start_date.gte.${currentDate})`
      );
    
    if (showId) {
      showsQuery = showsQuery.eq('id', showId);
    }
    
    const { data: organizedShows, error: showsError } = await showsQuery;
    
    if (showsError) throw showsError;
    
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
    const showIds = organizedShows.map(show => show.id);
    
    // Create a map of show details
    const showDetailsMap: Record<string, { title: string; startDate: string; location: string }> = {};
    organizedShows.forEach(show => {
      showDetailsMap[show.id] = {
        title: show.title,
        startDate: show.start_date,
        location: show.location
      };
    });
    
    /* ------------------------------------------------------------------
     * Step 1 – attendees / dealers (incl MVP) registered for the show
     *          via show_participants
     * ----------------------------------------------------------------*/
    const { data: allAttendees, error: attendeesError } = await supabase
      .from('show_participants')
      .select('userid, showid, role, status')
      .in('showid', showIds)
      .neq('userid', userId)
      .in('role', [
        UserRole.ATTENDEE,
        UserRole.DEALER,
        UserRole.MVP_DEALER,
      ])
      .in('status', ['registered', 'confirmed']);
    
    if (attendeesError) throw attendeesError;
    
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
    const allAttendeeIds = [...new Set(allAttendees.map(a => a.userid))];
    
    // Step 2: Fetch profiles for these attendees to filter by role
    const { data: attendeeProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', allAttendeeIds)
      .in('role', [
        UserRole.ATTENDEE,
        UserRole.DEALER,
        UserRole.MVP_DEALER,
      ]);
    
    if (profilesError) throw profilesError;
    
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
    const validAttendeeIds = attendeeProfiles.map(profile => profile.id);
    
    // Step 4: Create a mapping of user to shows they're attending (only for valid attendees)
    const userShowMap: Record<string, string[]> = {};
    allAttendees.forEach(a => {
      if (validAttendeeIds.includes(a.userid)) {
        if (!userShowMap[a.userid]) {
          userShowMap[a.userid] = [];
        }
        userShowMap[a.userid].push(a.showid);
      }
    });
    
    // Create a count query to get total number of want lists
    let countQuery = supabase
      .from('want_lists')
      .select('id', { count: 'exact', head: true })
      .in('userid', validAttendeeIds)
      .not('content', 'ilike', `${INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', ''); // Filter out empty want lists
    
    // Add search term if provided to count query
    if (searchTerm) {
      countQuery = countQuery.ilike('content', `%${searchTerm}%`);
    }
    
    // Execute count query
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    
    // Create a data query to get the want lists WITHOUT the profiles join
    let dataQuery = supabase
      .from('want_lists')
      .select('id, userid, content, createdat, updatedat')
      .in('userid', validAttendeeIds)
      .not('content', 'ilike', `${INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', '') // Filter out empty want lists
      .order('updatedat', { ascending: false })
      .range(from, to);
    
    // Add search term if provided to data query
    if (searchTerm) {
      dataQuery = dataQuery.ilike('content', `%${searchTerm}%`);
    }
    
    // Execute data query
    const { data: wantLists, error: wantListsError } = await dataQuery;
    if (wantListsError) throw wantListsError;
    
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
    const wantListUserIds = [...new Set(wantLists.map(wl => wl.userid))];
    
    // Fetch user profiles separately
    const { data: profiles, error: wantListProfilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .in('id', wantListUserIds);
    
    if (wantListProfilesError) throw wantListProfilesError;
    
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
    const transformedData = wantLists.map(item => {
      // Find which shows this user is attending
      const userShows = userShowMap[item.userid] || [];
      // Use the first show for context (we could enhance this to show all relevant shows)
      const showId = userShows[0];
      const showDetails = showDetailsMap[showId] || { title: 'Unknown Show', startDate: '', location: '' };
      
      // Get user profile from map
      const profile = profileMap[item.userid] || { firstName: 'Unknown', lastName: '', role: UserRole.ATTENDEE };
      
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
  } catch (error) {
    console.error('Error fetching want lists for Show Organizer:', error);
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
export const getWantListsForShow = async (
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
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    
    if (!userData) {
      return { data: null, error: new Error('User not found') };
    }
    
    // Check if user is authorized (MVP Dealer or Show Organizer)
    if (userData.role === UserRole.MVP_DEALER) {
      // Check if the MVP Dealer is participating in this show
      const { data: participation, error: participationError } = await supabase
        .from('show_participants')
        .select('id')
        .eq('userid', userId)
        .eq('showid', showId)
        .maybeSingle();
      
      if (participationError) throw participationError;
      
      if (!participation) {
        return { 
          data: null, 
          error: new Error('You must be participating in this show to view want lists') 
        };
      }
      
      // Use the MVP Dealer function with the specific show ID
      return getWantListsForMvpDealer({
        userId,
        showId,
        page,
        pageSize,
        searchTerm
      });
    } else if (userData.role === UserRole.SHOW_ORGANIZER) {
      // Check if the Show Organizer is organizing this show
      const { data: show, error: showError } = await supabase
        .from('shows')
        .select('id')
        .eq('id', showId)
        .eq('organizer_id', userId)
        .maybeSingle();
      
      if (showError) throw showError;
      
      if (!show) {
        return { 
          data: null, 
          error: new Error('You must be the organizer of this show to view want lists') 
        };
      }
      
      // Use the Show Organizer function with the specific show ID
      return getWantListsForShowOrganizer({
        userId,
        showId,
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
  } catch (error) {
    console.error('Error fetching want lists for show:', error);
    return { data: null, error };
  }
};
