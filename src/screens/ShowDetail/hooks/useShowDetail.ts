import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { handleSupabaseError } from '../../../services/errorService';
import { UserRole } from '../../../types';  // shared UserRole definition

interface Dealer {
  id: string;
  name: string;
  profileImageUrl?: string;
  role: UserRole;
  accountType?: string;
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
  profiles?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
  [key: string]: any; // For additional properties
}

interface UseShowDetailResult {
  show: ShowDetails | null;
  loading: boolean;
  error: string | null;
  isFavorite: boolean;
  isShowOrganizer: boolean;
  isCurrentUserOrganizer: boolean;
  isClaimingShow: boolean;
  participatingDealers: Dealer[];
  loadingDealers: boolean;
  fetchShowDetails: () => Promise<void>;
  toggleFavorite: () => Promise<void>;
  shareShow: () => Promise<void>;
  openMapLocation: () => void;
  handleClaimShow: () => void;
}

/**
 * Custom hook to handle show detail data fetching and state management
 * @param showId The ID of the show to fetch
 * @param onShare Function to handle sharing the show
 * @param onOpenMap Function to handle opening the map
 */
export const useShowDetail = (
  showId: string,
  onShare: (show: ShowDetails) => Promise<void>,
  onOpenMap: (address: string) => void
): UseShowDetailResult => {
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isClaimingShow, setIsClaimingShow] = useState(false);
  const [isShowClaimed, setIsShowClaimed] = useState(false);
  const [participatingDealers, setParticipatingDealers] = useState<Dealer[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  
  // Auth context for current user
  const authContext = useAuth();
  const user = authContext.authState?.user || null;
  
  // Derived state
  const [isShowOrganizer, setIsShowOrganizer] = useState(false);
  const [isCurrentUserOrganizer, setIsCurrentUserOrganizer] = useState(false);

  // Check if user is a show organizer
  useEffect(() => {
    if (user) {
      const userRole = user.role as UserRole;
      const hasOrganizerRole = userRole === 'SHOW_ORGANIZER';
      setIsShowOrganizer(hasOrganizerRole);
    } else {
      setIsShowOrganizer(false);
    }
  }, [user]);

  // Fetch show details and dealers when showId changes
  useEffect(() => {
    fetchShowDetails();
    fetchParticipatingDealers();
    checkIfFavorite();
  }, [showId]);

  /**
   * Fetch show details from the database
   */
  const fetchShowDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      /* ------------------------------------------------------------------
       * Step 1: Fetch the show row on its own (no joins)
       * ------------------------------------------------------------------ */
      const {
        data: showData,
        error: showError,
      } = await supabase.from('shows').select('*').eq('id', showId).single();

      if (showError) throw showError;
      if (!showData) throw new Error('Show not found');

      /* ------------------------------------------------------------------
       * Step 2: If the show has an organiser, fetch their profile
       * ------------------------------------------------------------------ */
      let organizerProfile: any = null;
      if (showData.organizer_id) {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(
            'id, first_name, last_name, profile_image_url, username, full_name, avatar_url'
          )
          .eq('id', showData.organizer_id)
          .single();

        if (!profileError && profileData) {
          organizerProfile = profileData;
        }
      }

      /* ------------------------------------------------------------------
       * Step 3: Combine the data and update component state
       * ------------------------------------------------------------------ */
      const combinedData = {
        ...showData,
        profiles: organizerProfile,
      };

      setShow(combinedData);
      setIsCurrentUserOrganizer(user?.id === showData.organizer_id);
      setIsShowClaimed(!!showData.claimed_by);
    } catch (error) {
      console.error('Error fetching show details:', error);
      setError('Failed to load show details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch participating dealers for the show
   */
  const fetchParticipatingDealers = async () => {
    setLoadingDealers(true);
    try {
      const { data: participants, error: participantsError } = await supabase
        .from('show_participants')
        .select('userid')
        .eq('showid', showId);

      if (participantsError) throw participantsError;
      if (!participants || participants.length === 0) {
        setParticipatingDealers([]);
        return;
      }

      const participantUserIds = [...new Set(participants.map((p) => p.userid))];
      const { data: dealerProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, profile_image_url, role, account_type')
        .in('id', participantUserIds)
        // Roles are stored lowercase in DB, so query accordingly
        .or('role.eq.mvp_dealer,role.eq.dealer');

      if (profilesError) throw profilesError;

      const dealers = (dealerProfiles || []).map((profile) => ({
        id: profile.id,
        name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.id.substring(0, 8),
        profileImageUrl: profile.profile_image_url,
        // Normalise role to uppercase so downstream comparisons
        // (`dealer.role === 'MVP_DEALER'`, etc.) work reliably.
        role: ((profile.role ?? '') as string).toUpperCase() as UserRole,
        accountType: profile.account_type,
      }));
      setParticipatingDealers(dealers);
    } catch (error) {
      console.error('Error in fetchParticipatingDealers:', error);
      // Don't set error state here to avoid disrupting the main UI if dealers can't load
    } finally {
      setLoadingDealers(false);
    }
  };

  /**
   * Check if the current show is marked as a favorite by the user
   */
  const checkIfFavorite = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setIsFavorite(false);
        return;
      }
      const { data, error } = await supabase
        .from('user_favorite_shows')
        .select()
        .eq('user_id', session.user.id)
        .eq('show_id', showId)
        .single();
      setIsFavorite(!error && !!data);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  /**
   * Toggle the favorite status of the show
   */
  const toggleFavorite = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        Alert.alert('Sign In Required', 'Please sign in to save favorites');
        return;
      }
      const userId = session.user.id;

      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorite_shows')
          .delete()
          .eq('user_id', userId)
          .eq('show_id', showId);
        if (error) throw error;
        setIsFavorite(false);
      } else {
        const { error } = await supabase
          .from('user_favorite_shows')
          .insert([{ user_id: userId, show_id: showId }]);
        if (error) throw error;
        setIsFavorite(true);
      }
    } catch (error) {
      const appError = handleSupabaseError(error);
      console.error('🚨 UNEXPECTED ERROR in toggleFavorite:', appError);
      Alert.alert('Error', 'An unexpected error occurred while updating favorites.');
    }
  };

  /**
   * Share the show details
   */
  const shareShow = async () => {
    if (!show) return;
    try {
      // Cast `show` explicitly to `ShowDetails` to satisfy the expected type
      await onShare(show as ShowDetails);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  /**
   * Open the show location in a map app
   */
  const openMapLocation = () => {
    if (!show) return;
    const address = show.address || show.location || '';
    onOpenMap(address);
  };

  /**
   * Handle claiming a show (placeholder)
   */
  const handleClaimShow = () => {
    Alert.alert("Claim Show", "This feature is coming soon!");
  };

  return {
    show,
    loading,
    error,
    isFavorite,
    isShowOrganizer,
    isCurrentUserOrganizer,
    isClaimingShow,
    participatingDealers,
    loadingDealers,
    fetchShowDetails,
    toggleFavorite,
    shareShow,
    openMapLocation,
    handleClaimShow
  };
};

export default useShowDetail;
