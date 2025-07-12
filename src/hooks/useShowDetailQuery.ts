import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Share, Linking } from 'react-native';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { handleSupabaseError } from '../services/errorService';

// Define types for better type safety
type UserRole = 'SHOW_ORGANIZER' | 'MVP_DEALER' | 'DEALER' | 'USER';

interface Dealer {
  id: string;
  name: string;
  profileImageUrl?: string;
  role: UserRole;
  accountType?: string;
  boothLocation?: string;
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
export const useShowDetailQuery = (showId: string) => {
  const queryClient = useQueryClient();
  const authContext = useAuth();
  const user = authContext.authState?.user || null;
  
  // Function to fetch show details from the RPC
  const fetchShowDetails = async () => {
    const { data, error } = await supabase.rpc('get_show_details_by_id', { 
      show_id: showId 
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    if (!data || data.error) {
      throw new Error(data?.error || 'Failed to load show details');
    }
    
    return data as ShowDetailResponse;
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
  const isCurrentUserOrganizer = user?.id === data?.show?.organizer_id;
  
  // Check if the user has a show organizer role
  const isShowOrganizer = user?.role === 'SHOW_ORGANIZER';
  
  // Check if the show is a favorite
  const checkIfFavorite = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;
      
      const { data, error } = await supabase
        .from('user_favorite_shows')
        .select()
        .eq('user_id', session.user.id)
        .eq('show_id', showId)
        .single();
        
      return !error && !!data;
    } catch (error) {
      console.error('Error checking favorite status:', error);
      return false;
    }
  };
  
  // Use a query to check if the show is a favorite
  const { 
    data: isFavorite = false,
    refetch: refetchFavorite
  } = useQuery({
    queryKey: ['showFavorite', showId, user?.id],
    queryFn: checkIfFavorite,
    enabled: !!user?.id, // Only run if user is logged in
  });
  
  // Mutation for toggling favorite status
  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('Please sign in to save favorites');
      }
      const userId = session.user.id;

      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorite_shows')
          .delete()
          .eq('user_id', userId)
          .eq('show_id', showId);
        if (error) throw error;
        return false; // Not a favorite anymore
      } else {
        const { error } = await supabase
          .from('user_favorite_shows')
          .insert([{ user_id: userId, show_id: showId }]);
        if (error) throw error;
        return true; // Now a favorite
      }
    },
    onSuccess: (newFavoriteStatus) => {
      // Update the cache
      queryClient.setQueryData(['showFavorite', showId, user?.id], newFavoriteStatus);
      // Invalidate the show details to update the favorite count
      queryClient.invalidateQueries({ queryKey: ['showDetails', showId] });
    },
    onError: (error) => {
      const appError = handleSupabaseError(error);
      console.error('🚨 UNEXPECTED ERROR in toggleFavorite:', appError);
      Alert.alert('Error', 'An unexpected error occurred while updating favorites.');
    }
  });
  
  // Helper function to toggle favorite status
  const toggleFavorite = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save favorites');
      return;
    }
    
    toggleFavoriteMutation.mutate();
  };
  
  // Helper function to format show date
  const formatShowDate = (show: ShowDetails) => {
    if (!show.start_date) return '';
    
    const startDate = new Date(show.start_date);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    return startDate.toLocaleDateString('en-US', options);
  };
  
  // Helper function to share the show
  const shareShow = async () => {
    if (!data?.show) return;
    
    try {
      const show = data.show;
      const message = `Check out this card show: ${show.title}\n\nWhen: ${formatShowDate(show)}\nWhere: ${show.location || show.address}\n\nShared from Card Show Finder app`;
      await Share.share({ message, title: show.title });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };
  
  // Helper function to open the map location
  const openMapLocation = () => {
    if (!data?.show) return;
    
    const address = data.show.address || data.show.location || '';
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.apple.com/?q=${encodedAddress}`;
    
    Linking.openURL(url).catch(() => {
      const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      Linking.openURL(googleUrl);
    });
  };
  
  // Helper function for claiming a show (placeholder)
  const handleClaimShow = () => {
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
