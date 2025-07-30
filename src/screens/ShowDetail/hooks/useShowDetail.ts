import { useState, useEffect } from 'react';
import { _Alert } from 'react-native';
import { _supabase } from '../../../supabase';
import { _useAuth } from '../../../contexts/AuthContext';
import { _handleSupabaseError } from '../../../services/errorService';
import { _UserRole } from '../../../types';  // shared UserRole definition

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
export const _useShowDetail = (
  showId: string,
  onShare: (show: ShowDetails) => Promise<void>,
  onOpenMap: (address: string) => void
): UseShowDetailResult => {
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [loading, setLoading] = useState(_true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(_false);
  const [isClaimingShow, _setIsClaimingShow] = useState(_false);
  const [_isShowClaimed, setIsShowClaimed] = useState(_false);
  const [participatingDealers, setParticipatingDealers] = useState<Dealer[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(_false);
  
  // Auth context for current user
  const _authContext = useAuth();
  const _user = authContext.authState?.user || null;
  
  // Derived state
  const [isShowOrganizer, setIsShowOrganizer] = useState(_false);
  const [isCurrentUserOrganizer, setIsCurrentUserOrganizer] = useState(_false);

  // Check if user is a show organizer
  useEffect(() => {
    if (_user) {
      const _userRole = user.role as UserRole;
      const _hasOrganizerRole = userRole === UserRole.SHOW_ORGANIZER;
      setIsShowOrganizer(_hasOrganizerRole);
    } else {
      setIsShowOrganizer(_false);
    }
  }, [_user]);

  // Fetch show details and dealers when showId changes
  useEffect(() => {
    fetchShowDetails();
    fetchParticipatingDealers();
    checkIfFavorite();
  }, [_showId]);

  /**
   * Fetch show details from the database
   */
  const _fetchShowDetails = async () => {
    try {
      setLoading(_true);
      setError(_null);
      
      /* ------------------------------------------------------------------
       * Step 1: Fetch the show row on its own (no joins)
       * ------------------------------------------------------------------ */
      const {
        data: showData,
        error: showError,
      } = await supabase.from('shows').select('*').eq('id', _showId).single();

      if (_showError) throw showError;
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
            'id, _first_name, last_name, profile_image_url, username, full_name, avatar_url'
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
      const _combinedData = {
        ...showData,
        profiles: organizerProfile,
      };

      setShow(_combinedData);
      setIsCurrentUserOrganizer(user?.id === showData.organizer_id);
      setIsShowClaimed(!!showData.claimed_by);
    } catch (_error) {
      console.error('Error fetching show details:', _error);
      setError('Failed to load show details');
    } finally {
      setLoading(_false);
    }
  };

  /**
   * Fetch participating dealers for the show
   */
  const _fetchParticipatingDealers = async () => {
    setLoadingDealers(_true);
    try {
      const { data: participants, error: participantsError } = await supabase
        .from('show_participants')
        .select('userid')
        .eq('showid', _showId);

      if (_participantsError) throw participantsError;
      if (!participants || participants.length === 0) {
        setParticipatingDealers([]);
        return;
      }

      const _participantUserIds = [...new Set(participants.map((_p) => p.userid))];
      const { data: dealerProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, _first_name, last_name, profile_image_url, role, account_type')
        .in('id', _participantUserIds)
        // Roles are stored lowercase in DB, so query accordingly
        .or('role.eq.mvp_dealer,role.eq.dealer');

      if (_profilesError) throw profilesError;

      const _dealers = (dealerProfiles || []).map((_profile) => ({
        id: profile.id,
        name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.id.substring(0, _8),
        profileImageUrl: profile.profile_image_url,
        // Normalise role to uppercase so downstream comparisons
        // (`dealer.role === 'MVP_DEALER'`, etc.) work reliably.
        role: ((profile.role ?? '') as string).toUpperCase() as UserRole,
        accountType: profile.account_type,
      }));
      setParticipatingDealers(_dealers);
    } catch (_error) {
      console.error('Error in fetchParticipatingDealers:', _error);
      // Don't set error state here to avoid disrupting the main UI if dealers can't load
    } finally {
      setLoadingDealers(_false);
    }
  };

  /**
   * Check if the current show is marked as a favorite by the user
   */
  const _checkIfFavorite = async () => {
    try {
      const { data: { _session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setIsFavorite(_false);
        return;
      }
      const { data, error } = await supabase
        .from('user_favorite_shows')
        .select()
        .eq('user_id', session.user.id)
        .eq('show_id', _showId)
        .single();
      setIsFavorite(!error && !!data);
    } catch (_error) {
      console.error('Error checking favorite status:', _error);
    }
  };

  /**
   * Toggle the favorite status of the show
   */
  const _toggleFavorite = async () => {
    try {
      const { data: { _session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        Alert.alert('Sign In Required', 'Please sign in to save favorites');
        return;
      }
      const _userId = session.user.id;

      if (_isFavorite) {
        const { _error } = await supabase
          .from('user_favorite_shows')
          .delete()
          .eq('user_id', _userId)
          .eq('show_id', _showId);
        if (_error) throw error;
        setIsFavorite(_false);
      } else {
        const { _error } = await supabase
          .from('user_favorite_shows')
          .insert([{ user_id: userId, show_id: showId }]);
        if (_error) throw error;
        setIsFavorite(_true);
      }
    } catch (_error) {
      const _appError = handleSupabaseError(_error);
      console.error('🚨 UNEXPECTED ERROR in toggleFavorite:', _appError);
      Alert.alert('Error', 'An unexpected error occurred while updating favorites.');
    }
  };

  /**
   * Share the show details
   */
  const _shareShow = async () => {
    if (!show) return;
    try {
      // Cast `show` explicitly to `ShowDetails` to satisfy the expected type
      await onShare(show as ShowDetails);
    } catch (_error) {
      console.error('Error sharing:', _error);
    }
  };

  /**
   * Open the show location in a map app
   */
  const _openMapLocation = () => {
    if (!show) return;
    const _address = show.address || show.location || '';
    onOpenMap(_address);
  };

  /**
   * Handle claiming a show (_placeholder)
   */
  const _handleClaimShow = () => {
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
