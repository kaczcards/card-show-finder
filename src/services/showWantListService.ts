import { supabase } from '../supabase';
import { UserRole, WantList } from '../types';

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
    
    // Base query to get shows the dealer is participating in
    let query = supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', userId);
    
    if (showId) {
      query = query.eq('showid', showId);
    }
    
    const { data: participatingShows, error: showsError } = await query;
    
    if (showsError) throw showsError;
    
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
    const showIds = participatingShows.map(show => show.showid);
    
    // Get all attendees for these shows
    const { data: attendees, error: attendeesError } = await supabase
      .from('show_participants')
      .select('userid, showid')
      .in('showid', showIds)
      .neq('userid', userId); // Exclude the dealer themselves
    
    if (attendeesError) throw attendeesError;
    
    if (!attendees || attendees.length === 0) {
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
    
    // Get unique attendee IDs
    const attendeeIds = [...new Set(attendees.map(a => a.userid))];
    
    // Create a mapping of user to shows they're attending
    const userShowMap: Record<string, string[]> = {};
    attendees.forEach(a => {
      if (!userShowMap[a.userid]) {
        userShowMap[a.userid] = [];
      }
      userShowMap[a.userid].push(a.showid);
    });
    
    // Create a count query to get total number of want lists
    let countQuery = supabase
      .from('want_lists')
      .select('id', { count: 'exact', head: true })
      .in('userid', attendeeIds)
      .not('content', 'ilike', `${INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', ''); // Filter out empty want lists
    
    // Create a data query to get the want lists with user info
    let dataQuery = supabase
      .from('want_lists')
      .select(`
        id,
        userid,
        content,
        createdat,
        updatedat,
        profiles:userid(id, firstName, lastName, role)
      `)
      .in('userid', attendeeIds)
      .not('content', 'ilike', `${INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', '') // Filter out empty want lists
      .order('updatedat', { ascending: false })
      .range(from, to);
    
    // Add search term if provided to both queries
    if (searchTerm) {
      countQuery = countQuery.ilike('content', `%${searchTerm}%`);
      dataQuery = dataQuery.ilike('content', `%${searchTerm}%`);
    }
    
    // Execute count query
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    
    // Execute data query
    const { data: wantLists, error: wantListsError } = await dataQuery;
    if (wantListsError) throw wantListsError;
    
    // Get show details for context
    const { data: shows, error: showDetailsError } = await supabase
      .from('shows')
      .select('id, title, start_date, location')
      .in('id', showIds);
    
    if (showDetailsError) throw showDetailsError;
    
    // Create a map of show details
    const showDetailsMap: Record<string, { title: string; startDate: string; location: string }> = {};
    shows?.forEach(show => {
      showDetailsMap[show.id] = {
        title: show.title,
        startDate: show.start_date,
        location: show.location
      };
    });
    
    // Transform the data to include show information
    const transformedData = wantLists?.map(item => {
      // Find which shows this user is attending
      const userShows = userShowMap[item.userid] || [];
      // Use the first show for context (we could enhance this to show all relevant shows)
      const showId = userShows[0];
      const showDetails = showDetailsMap[showId] || { title: 'Unknown Show', startDate: '', location: '' };
      
      return {
        id: item.id,
        userId: item.userid,
        userName: `${item.profiles.firstName} ${item.profiles.lastName || ''}`.trim(),
        userRole: item.profiles.role,
        content: item.content,
        createdAt: item.createdat,
        updatedAt: item.updatedat,
        showId: showId,
        showTitle: showDetails.title,
        showStartDate: showDetails.startDate,
        showLocation: showDetails.location
      };
    }) || [];
    
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
    
    // Get shows organized by this user
    let showsQuery = supabase
      .from('shows')
      .select('id, title, start_date, location')
      .eq('organizer_id', userId);
    
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
    
    // Get all attendees for these shows
    const { data: attendees, error: attendeesError } = await supabase
      .from('show_participants')
      .select('userid, showid')
      .in('showid', showIds);
    
    if (attendeesError) throw attendeesError;
    
    if (!attendees || attendees.length === 0) {
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
    
    // Get unique attendee IDs
    const attendeeIds = [...new Set(attendees.map(a => a.userid))];
    
    // Create a mapping of user to shows they're attending
    const userShowMap: Record<string, string[]> = {};
    attendees.forEach(a => {
      if (!userShowMap[a.userid]) {
        userShowMap[a.userid] = [];
      }
      userShowMap[a.userid].push(a.showid);
    });
    
    // Create a count query to get total number of want lists
    let countQuery = supabase
      .from('want_lists')
      .select('id', { count: 'exact', head: true })
      .in('userid', attendeeIds)
      .not('content', 'ilike', `${INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', ''); // Filter out empty want lists
    
    // Create a data query to get the want lists with user info
    let dataQuery = supabase
      .from('want_lists')
      .select(`
        id,
        userid,
        content,
        createdat,
        updatedat,
        profiles:userid(id, firstName, lastName, role)
      `)
      .in('userid', attendeeIds)
      .not('content', 'ilike', `${INVENTORY_PREFIX}%`) // Filter out inventory items
      .not('content', 'eq', '') // Filter out empty want lists
      .order('updatedat', { ascending: false })
      .range(from, to);
    
    // Add search term if provided to both queries
    if (searchTerm) {
      countQuery = countQuery.ilike('content', `%${searchTerm}%`);
      dataQuery = dataQuery.ilike('content', `%${searchTerm}%`);
    }
    
    // Execute count query
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    
    // Execute data query
    const { data: wantLists, error: wantListsError } = await dataQuery;
    if (wantListsError) throw wantListsError;
    
    // Transform the data to include show information
    const transformedData = wantLists?.map(item => {
      // Find which shows this user is attending
      const userShows = userShowMap[item.userid] || [];
      // Use the first show for context (we could enhance this to show all relevant shows)
      const showId = userShows[0];
      const showDetails = showDetailsMap[showId] || { title: 'Unknown Show', startDate: '', location: '' };
      
      return {
        id: item.id,
        userId: item.userid,
        userName: `${item.profiles.firstName} ${item.profiles.lastName || ''}`.trim(),
        userRole: item.profiles.role,
        content: item.content,
        createdAt: item.createdat,
        updatedAt: item.updatedat,
        showId: showId,
        showTitle: showDetails.title,
        showStartDate: showDetails.startDate,
        showLocation: showDetails.location
      };
    }) || [];
    
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
