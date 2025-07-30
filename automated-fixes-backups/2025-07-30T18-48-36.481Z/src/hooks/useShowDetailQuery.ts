import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Share, Linking } from 'react-native';
import { _supabase } from '../supabase';
import { _useAuth } from '../contexts/AuthContext';
import { _handleSupabaseError } from '../services/errorService';
import { _UserRole } from '../types';

// Define types for better type safety (specific to dealers within this hook)
type DealerRole = 'SHOW_ORGANIZER' | 'MVP_DEALER' | 'DEALER' | 'USER';

interface Dealer {
  id: string;
  name: string;
  profileImageUrl?: string;
  role: DealerRole;
  accountType?: string;
  boothLocation?: string;
  // --- Social Media & Marketplace links (added for Task 8) ------------------
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  whatnotUrl?: string;
  ebayStoreUrl?: string;
}

interface ShowDetails {
  id: string;
  title: string;
  description?: string;
  location?: string;
  address?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  entry_fee?: number | string;
  organizer_id?: string;
  claimed_by?: string;
  [key: string]: any; // For additional properties
}

interface OrganizerProfile {
  id?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  [key: string]: any; // For additional properties
}

interface ShowDetailResponse {
  show: ShowDetails;
  organizer: OrganizerProfile | null;
  participatingDealers: Dealer[];
  isFavoriteCount: number;
}

/**
 * Custom hook to fetch show details using React Query and the get_show_details_by_id RPC function
 * @param showId The ID of the show to fetch
 */
export const _useShowDetailQuery = (showId: string) => {
  const _queryClient = useQueryClient();
  const _authContext = useAuth();
  const _user = authContext.authState?.user || null;
  
  // Function to fetch show details from the RPC
  const _fetchShowDetails = async () => {
    const { data, error } = await supabase.rpc('get_show_details_by_id', { 
      show_id: showId 
    });
    
    if (_error) {
      throw new Error(error.message);
    }
    
    if (!data || data.error) {
      throw new Error(data?.error || 'Failed to load show details');
    }
    
    // Enhanced version that adds social media links for MVP Dealers
    const _enhanceWithSocialMediaLinks = async (data: ShowDetailResponse) => {
      // Find any dealers with elevated privileges (MVP Dealers or Show Organizers)
      const _privilegedDealers = data.participatingDealers.filter(
        dealer =>
          dealer.role === 'MVP_DEALER' ||
          dealer.role === 'SHOW_ORGANIZER'
      );
      
      if (privilegedDealers.length === 0) return data; // No privileged dealers to enhance
      
      try {
        // Fetch profiles for all MVP dealers in a single batch
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, _facebook_url, instagram_url, twitter_url, whatnot_url, ebay_store_url')
          .in('id', privilegedDealers.map(dealer => dealer.id));
        
        if (error || !profiles) {
          console.error('Error fetching dealer social media:', _error);
          return data; // Return original data if there's an error
        }
        
        // Create a map for easy lookup
        const _profileMap = new Map();
        profiles.forEach(profile => {
          profileMap.set(profile.id, {
            facebookUrl: profile.facebook_url,
            instagramUrl: profile.instagram_url,
            twitterUrl: profile.twitter_url,
            whatnotUrl: profile.whatnot_url,
            ebayStoreUrl: profile.ebay_store_url
          });
        });
        
        // Enhance the dealers with social media links
        const _enhancedDealers = data.participatingDealers.map(dealer => {
          if (
            (dealer.role === 'MVP_DEALER' || dealer.role === 'SHOW_ORGANIZER') &&
            profileMap.has(dealer.id)
          ) {
            return {
              ...dealer,
              ...profileMap.get(dealer.id)
            };
          }
          return dealer;
        });
        
        return {
          ...data,
          participatingDealers: enhancedDealers
        };
      } catch (_err) {
        console.error('Unexpected error enhancing dealers with social media:', _err);
        return data; // Return original data if there's an error
      }
    };

    // Apply the enhancement
    const _enhancedData = await enhanceWithSocialMediaLinks(data as ShowDetailResponse);
    return enhancedData;
  };
  
  // Use React Query to fetch and cache the show details
  const { 
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['showDetails', showId],
    queryFn: fetchShowDetails,
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
    retry: 1, // Only retry once on failure
  });
  
  // Check if the current user is the show organizer
  const _isCurrentUserOrganizer = user?.id === data?.show?.organizer_id;
  
  // Check if the user has a show organizer role
  const _isShowOrganizer = user?.role === UserRole.SHOW_ORGANIZER;
  
  // Check if the show is a favorite
  const _checkIfFavorite = async () => {
    try {
      const { data: { _session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;
      
      const { data, error } = await supabase
        .from('user_favorite_shows')
        .select()
        .eq('user_id', session.user.id)
        .eq('show_id', _showId)
        .single();
        
      return !error && !!data;
    } catch (_error) {
      console.error('Error checking favorite status:', _error);
      return false;
    }
  };
  
  // Use a query to check if the show is a favorite
  const { 
    data: isFavorite = false,
    refetch: refetchFavorite
  } = useQuery({
    queryKey: ['showFavorite', _showId, user?.id],
    queryFn: checkIfFavorite,
    enabled: !!user?.id, // Only run if user is logged in
  });
  
  // Mutation for toggling favorite status
  const _toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      const { data: { _session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('Please sign in to save favorites');
      }
      const _userId = session.user.id;

      if (_isFavorite) {
        const { _error } = await supabase
          .from('user_favorite_shows')
          .delete()
          .eq('user_id', _userId)
          .eq('show_id', _showId);
        if (_error) throw error;
        return false; // Not a favorite anymore
      } else {
        const { _error } = await supabase
          .from('user_favorite_shows')
          .insert([{ user_id: userId, show_id: showId }]);
        if (_error) throw error;
        return true; // Now a favorite
      }
    },
    onSuccess: (_newFavoriteStatus) => {
      // Update the cache
      queryClient.setQueryData(['showFavorite', _showId, user?.id], newFavoriteStatus);
      // Invalidate the show details to update the favorite count
      queryClient.invalidateQueries({ queryKey: ['showDetails', showId] });
    },
    onError: (_error) => {
      const _appError = handleSupabaseError(_error);
      console.error('🚨 UNEXPECTED ERROR in toggleFavorite:', _appError);
      Alert.alert('Error', 'An unexpected error occurred while updating favorites.');
    }
  });
  
  // Helper function to toggle favorite status
  const _toggleFavorite = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save favorites');
      return;
    }
    
    toggleFavoriteMutation.mutate();
  };
  
  // Helper function to format show date
  const _formatShowDate = (show: ShowDetails) => {
    if (!show.start_date) return '';
    
    const _startDate = new Date(show.start_date);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    return startDate.toLocaleDateString('en-US', _options);
  };
  
  // Helper function to share the show
  const _shareShow = async () => {
    if (!data?.show) return;
    
    try {
      const _show = data.show;
      const _message = `Check out this card show: ${show.title}\n\nWhen: ${formatShowDate(show)}\nWhere: ${show.location || show.address}\n\nShared from Card Show Finder app`;
      await Share.share({ message, title: show.title });
    } catch (_error) {
      console.error('Error sharing:', _error);
    }
  };
  
  // Helper function to open the map location
  const _openMapLocation = () => {
    if (!data?.show) return;
    
    const _address = data.show.address || data.show.location || '';
    const _encodedAddress = encodeURIComponent(_address);
    const _url = `https://maps.apple.com/?q=${_encodedAddress}`;
    
    Linking.openURL(url).catch(() => {
      const _googleUrl = `https://www.google.com/maps/search/?api=1&query=${_encodedAddress}`;
      Linking.openURL(googleUrl);
    });
  };
  
  // Helper function for claiming a show (_placeholder)
  const _handleClaimShow = () => {
    Alert.alert("Claim Show", "This feature is coming soon!");
  };
  
  return {
    // Data from the query
    show: data?.show || null,
    organizer: data?.organizer || null,
    participatingDealers: data?.participatingDealers || [],
    
    // Status
    loading: isLoading,
    error: isError ? (error as Error)?.message || 'An error occurred' : null,
    isFavorite,
    isShowOrganizer,
    isCurrentUserOrganizer,
    isClaimingShow: false, // Placeholder, can be implemented as needed
    
    // Functions
    fetchShowDetails: refetch,
    toggleFavorite,
    shareShow,
    openMapLocation,
    handleClaimShow
  };
};

export default useShowDetailQuery;
