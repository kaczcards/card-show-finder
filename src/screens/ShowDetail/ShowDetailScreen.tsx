import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Share,
  ActivityIndicator,
  Alert,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CommonActions } from '@react-navigation/native';
import * as userRoleService from '../../services/userRoleService';
import * as organizerService from '../../services/organizerService';
import { showSeriesService } from '../../services/showSeriesService';
import { UserRole, Review, ShowSeries } from '../../types';

import GroupMessageComposer from '../../components/GroupMessageComposer';
import DealerDetailModal from '../../components/DealerDetailModal';
import ReviewsList from '../../components/ReviewsList';
import ReviewForm from '../../components/ReviewForm';

/* ------------------------------------------------------------------ */
/* Local assets                                                        */
/* ------------------------------------------------------------------ */
// Default placeholder shown when a show has no custom image
const placeholderShowImage = require('../../../assets/images/placeholder-show.png');

interface ShowDetailProps {
  route: any;
  navigation: any;
}
// ******** AUTHENTICATION FIX *********
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Supabase client for direct auth check
const directSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
const directSupabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey;
const directSupabase = createClient(directSupabaseUrl, directSupabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
});

const ShowDetailScreen: React.FC<ShowDetailProps> = ({ route, navigation }) => {
  const { showId } = route.params;
  
  // Get the entire auth context to access all available properties
  const authContext = useAuth();
  // Try multiple ways to access user data for resilience
  const user = authContext.authState?.user || null;
  
  // Debug logging for authentication state
  useEffect(() => {
    console.log('Auth state in ShowDetailScreen:', 
      authContext.authState?.isAuthenticated ? 'Authenticated' : 'Not authenticated',
      'User ID:', authContext.authState?.user?.id || 'undefined'
    );
  }, [authContext.authState]);
  
  const [show, setShow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  
  // State for series information
  const [showSeries, setShowSeries] = useState<ShowSeries | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);
  
  // State for reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  
  // Check if user is show organizer
  const [isShowOrganizer, setIsShowOrganizer] = useState(false);
  const [isMvpDealer, setIsMvpDealer] = useState(false);
  
  // State for all participating dealers (formerly mvpDealers)
  const [participatingDealers, setParticipatingDealers] = useState<any[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(false);

  // State for show claiming
  const [canClaimShow, setCanClaimShow] = useState(false);
  const [isClaimingShow, setIsClaimingShow] = useState(false);
  const [isCurrentUserOrganizer, setIsCurrentUserOrganizer] = useState(false);

  /* ---------- Dealer-detail modal state ---------- */
  const [showDealerDetailModal, setShowDealerDetailModal] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<{ id: string; name: string } | null>(
    null
  );

  useEffect(() => {
    if (!user) {
      console.log('No user found in auth state, resetting organizer/dealer status');
      setIsShowOrganizer(false);
      setIsMvpDealer(false);
      return;
    }
    
    console.log('User role in ShowDetailScreen:', user.role);
    const userRole = user.role as UserRole;
    setIsShowOrganizer(userRole === UserRole.SHOW_ORGANIZER);
    setIsMvpDealer(userRole === UserRole.MVP_DEALER);
    
    // In test mode, treat all authenticated users as organizers
    if (userRoleService.IS_TEST_MODE) {
      setIsShowOrganizer(true);
    }
  }, [user]);
  
  useEffect(() => {
    fetchShowDetails();
    fetchParticipatingDealers(showId); // Call the new function
    // Always verify favourite status on mount / when showId changes
    checkIfFavorite();
  }, [showId]);
  
  const fetchShowDetails = async () => {
    try {
      setLoading(true);
      /* ------------------------------------------------------------------
       * 1. Fetch the show record itself (no implicit FK join)
       * ------------------------------------------------------------------ */
      const { data, error } = await supabase
        .from('shows')
        .select('*, series_id') // Make sure to select series_id
        .eq('id', showId)
        .single();

      if (error) throw error;

      if (data) {
        /* ----------------------------------------------------------------
         * 2. If the show has an organizer_id, fetch that user's profile
         * in a second query.  Attach as `profiles` so the rest of the
         * component can keep using the previous shape.
         * ---------------------------------------------------------------- */
        if (data.organizer_id) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', data.organizer_id)
            .single();

          if (profileError) {
            console.error('Error fetching organizer profile:', profileError);
          } else if (profileData) {
            // Mimic the original foreign-table alias
            (data as any).profiles = profileData;
          }
        }

        setShow(data);
        
        // Check if this show is part of a series
        if (data.series_id) {
          fetchShowSeries(data.series_id);
          fetchSeriesReviews(data.series_id);
        }

        // Update navigation title
        navigation.setOptions({
          title: data.title || 'Show Details',
        });
        
        // Check if current user is the organizer of this show
        setIsCurrentUserOrganizer(user?.id === data.organizer_id);
      }
    } catch (error) {
      console.error('Error fetching show details:', error);
      setError('Failed to load show details');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Fetch the series information for this show
   */
  const fetchShowSeries = async (seriesId: string) => {
    try {
      setLoadingSeries(true);
      const series = await showSeriesService.getShowSeriesById(seriesId);
      setShowSeries(series);
      
      // If the series has an organizer, update the isCurrentUserOrganizer state
      if (series?.organizerId && user?.id) {
        setIsCurrentUserOrganizer(series.organizerId === user.id);
      }
    } catch (error) {
      console.error('Error fetching show series:', error);
    } finally {
      setLoadingSeries(false);
    }
  };
  
  /**
   * Fetch reviews for the series
   */
  const fetchSeriesReviews = async (seriesId: string) => {
    try {
      setLoadingReviews(true);
      const seriesReviews = await showSeriesService.getSeriesReviews(seriesId);
      setReviews(seriesReviews);
    } catch (error) {
      console.error('Error fetching series reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };
  
  /**
   * Handle submitting a new review
   */
  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!showSeries || !user) {
      Alert.alert('Error', 'You must be logged in to submit a review.');
      return;
    }
    
    try {
      const newReview = await showSeriesService.addSeriesReview({
        seriesId: showSeries.id,
        rating,
        comment
      });
      
      // Add the new review to the list
      setReviews(prevReviews => [newReview, ...prevReviews]);
      setShowReviewForm(false);
      
      // Refresh series data to get updated rating
      fetchShowSeries(showSeries.id);
      
      Alert.alert('Success', 'Your review has been submitted. Thank you!');
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    }
  };
  
  /**
   * Fetch all participating dealers (MVP and regular dealers) for a show.
   *
   * 1.  Get all participants' user_ids from `show_participants`.
   * 2.  Fetch those users' profiles where role is 'mvp_dealer' or 'dealer'.
   */
  const fetchParticipatingDealers = async (showId: string) => { // Renamed function
    try {
      setLoadingDealers(true);

      /* ---------------- Step 1: participants ---------------- */
      const {
        data: participants,
        error: participantsError,
      } = await supabase
        .from('show_participants')
        .select('userid')
        .eq('showid', showId);

      if (participantsError) {
        console.error('Error fetching show participants:', participantsError);
        return;
      }

      console.warn(`Found ${participants?.length || 0} participants for show ${showId}`);
      console.log('Participants:', JSON.stringify(participants));

      if (!participants || participants.length === 0) {
        setParticipatingDealers([]); // Set to new state name
        return;
      }

      // Extract distinct user IDs
      const participantUserIds = [
        ...new Set(participants.map((p) => p.userid)),
      ];

      console.warn(`Extracted ${participantUserIds.length} unique user IDs`);
      console.log('User IDs:', JSON.stringify(participantUserIds));

      /* ---------------- Step 2: profiles ---------------- */
      // Fetch profiles for both 'mvp_dealer' and 'dealer' roles
      const {
        data: dealerProfiles,
        error: profilesError,
      } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, profile_image_url, role, account_type') // Select role and account_type
        .in('id', participantUserIds)
        // Filter to include only 'mvp_dealer' and 'dealer' roles (case-insensitive for robustness)
        .or(`role.eq.${UserRole.MVP_DEALER},role.eq.${UserRole.DEALER}`); // Use enum values

      if (profilesError) {
        console.error('Error fetching dealer profiles:', profilesError);
        return;
      }

      console.warn(`Found ${dealerProfiles?.length || 0} participating dealers`);
      console.log('Dealer profiles:', JSON.stringify(dealerProfiles));

      if (dealerProfiles && dealerProfiles.length > 0) {
        const dealers = dealerProfiles.map((profile) => {
          const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
          return {
            id: profile.id,
            name: fullName || profile.id.substring(0, 8),
            profileImageUrl: profile.profile_image_url,
            role: profile.role as UserRole, // Store the role
            accountType: profile.account_type // Store account type
          };
        });
        setParticipatingDealers(dealers); // Set to new state name
      } else {
        setParticipatingDealers([]); // Set to new state name
      }
    } catch (error) {
      console.error('Error in fetchParticipatingDealers:', error);
    } finally {
      setLoadingDealers(false);
    }
  };
  
  /**
   * Checks if the current show is in the authenticated user's favourites
   * using the same directSupabase client utilised in `toggleFavorite`.
   */
  const checkIfFavorite = async () => {
    try {
      console.log('🔍 FAV DEBUG - Running checkIfFavorite for showId:', showId);

      /* -----------------------------------------------------------
       * 1. Get current session (avoid relying on `user` prop)
       * --------------------------------------------------------- */
      const {
        data: { session },
        error: sessionError,
      } = await directSupabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        console.warn(
          '🔍 FAV DEBUG - No authenticated session found while checking favourites',
          sessionError?.message
        );
        setIsFavorite(false);
        return;
      }

      const userId = session.user.id;

      /* -----------------------------------------------------------
       * 2. Query user_favorite_shows for this show / user combo
       * --------------------------------------------------------- */
      const { data, error } = await directSupabase
        .from('user_favorite_shows')
        .select()
        .eq('user_id', userId)
        .eq('show_id', showId)
        .single();

      if (!error && data) {
        console.log('🔍 FAV DEBUG - Favourite record exists:', data);
        setIsFavorite(true);
      } else {
        if (error && error.code !== 'PGRST116') {
          // Ignore "no rows" (PGRST116). Log anything else.
          console.error('🚨 FAV ERROR - Error checking favourite status:', error);
        }
        setIsFavorite(false);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };
  
const toggleFavorite = async () => {
  // Direct session check without using AuthContext
  try {
    // Log environment variables to debug connection issues
    console.log('🔍 ENV DEBUG - Supabase URL:', directSupabaseUrl ? 'Set' : 'Not set');
    console.log('🔍 ENV DEBUG - Supabase Key:', directSupabaseKey ? 'Set' : 'Not set');
    
    const { data: { session }, error: sessionError } = await directSupabase.auth.getSession();
    
    if (sessionError || !session || !session.user) {
      console.error('🚨 AUTH ERROR - No direct session found:', sessionError?.message, 'Code:', sessionError?.code);
      Alert.alert('Sign In Required', 'Please sign in to save favorites');
      return;
    }
    
    const userId = session.user.id;
    console.log('🔍 AUTH DEBUG - Got userId directly from session:', userId);
    
    // Check if a favorites record exists at the beginning to confirm persistence
    try {
      console.log('🔍 DB DEBUG - Checking if favorite already exists in database');
      const { data: existingFavorite, error: checkError } = await directSupabase
        .from('user_favorite_shows')
        .select()
        .eq('user_id', userId)
        .eq('show_id', showId)
        .single();
      
      if (checkError) {
        if (checkError.code === 'PGRST116') {
          // PGRST116 is "No rows returned" - expected if not favorited
          console.log('🔍 DB DEBUG - No existing favorite record found');
        } else {
          // This could indicate a more serious issue like missing table
          console.error('🚨 DB ERROR - Error checking existing favorite:', checkError.message, 'Code:', checkError.code);
          
          // Check specifically for "relation does not exist" error
          if (checkError.code === '42P01') {
            console.error('🚨 DB ERROR - The user_favorite_shows table does not exist in the database!');
            Alert.alert(
              'Database Error', 
              'The favorites feature is not properly set up. Please contact support.'
            );
            return;
          }
        }
      } else if (existingFavorite) {
        console.log('🔍 DB DEBUG - Existing favorite record found:', existingFavorite);
        // If UI state doesn't match DB state, update it
        if (!isFavorite) {
          console.log('🔍 STATE DEBUG - UI state doesn\'t match DB state, updating to favorited');
          setIsFavorite(true);
          // UI now matches DB; no further DB operation required.
          return;
        }
      }
    } catch (checkErr: any) {
      console.error('🚨 UNEXPECTED ERROR checking favorite status:', checkErr.message, checkErr.code || 'No code');
    }
    
    if (isFavorite) {
      // Remove from favorites
      console.log('🔍 DB OPERATION - Removing favorite:', { userId, showId });
      const { data: deleteData, error: deleteError } = await directSupabase
        .from('user_favorite_shows')
        .delete()
        .eq('user_id', userId)
        .eq('show_id', showId);
      
      if (deleteError) {
        console.error('🚨 DB ERROR - Failed to remove favorite:', deleteError.message, 'Code:', deleteError.code);
        
        // Handle specific error types
        if (deleteError.code === '42P01') {
          // Table doesn't exist
          Alert.alert('Database Error', 'The favorites table does not exist. Please contact support.');
        } else if (deleteError.code === '23503') {
          // Foreign key violation
          Alert.alert('Error', 'Could not remove favorite due to data integrity issue.');
        } else {
          Alert.alert('Error', `Failed to remove favorite: ${deleteError.message}`);
        }
        return;
      }
      
      console.log('✅ DB SUCCESS - Removed favorite. Response:', deleteData);
      setIsFavorite(false);
      console.log('✅ STATE UPDATE - Updated isFavorite to false');
    } else {
      // Add to favorites
      console.log('🔍 DB OPERATION - Adding favorite:', { userId, showId });
      const { data: insertData, error: insertError } = await directSupabase
        .from('user_favorite_shows')
        .insert([{ user_id: userId, show_id: showId }]);
      
      if (insertError) {
        console.error('🚨 DB ERROR - Failed to add favorite:', insertError.message, 'Code:', insertError.code);
        
        // Handle specific error types
        if (insertError.code === '42P01') {
          // Table doesn't exist
          Alert.alert('Database Error', 'The favorites table does not exist. Please contact support.');
        } else if (insertError.code === '23503') {
          // Foreign key violation
          Alert.alert('Error', 'Could not add favorite due to data integrity issue (e.g., show or user does not exist).');
        } else if (insertError.code === '23505') {
          // Unique constraint violation (already favorited)
          Alert.alert('Info', 'This show is already in your favorites.');
        } else {
          Alert.alert('Error', `Failed to add favorite: ${insertError.message}`);
        }
        return;
      }
      
      console.log('✅ DB SUCCESS - Added favorite. Response:', insertData);
      setIsFavorite(true);
      console.log('✅ STATE UPDATE - Updated isFavorite to true');
    }
  } catch (error: any) {
    // Log detailed error information
    console.error('🚨 UNEXPECTED ERROR in toggleFavorite:', error);
    console.error('Error details:', {
      message: error.message || 'Unknown error',
      code: error.code || 'No code',
      stack: error.stack || 'No stack trace'
    });
    Alert.alert('Error', 'An unexpected error occurred while updating favorites.');
  }
};

  /**
   * Handles claiming a show series as an organizer
   */
  const handleClaimShowSeries = async () => {
    if (!user || !isShowOrganizer) {
      Alert.alert('Permission Denied', 'You must be a Show Organizer to claim this show series.');
      return;
    }
    
    if (!showSeries) {
      Alert.alert('Error', 'No show series found to claim.');
      return;
    }

    try {
      setIsClaimingShow(true);
      
      const result = await showSeriesService.claimShowSeries(showSeries.id);
      
      if (result.success) {
        Alert.alert(
          'Success!', 
          'You have successfully claimed this show series. You can now manage all shows in this series and respond to reviews.',
          [{ text: 'OK', onPress: () => {
            fetchShowSeries(showSeries.id);
            fetchShowDetails();
          }}]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to claim show series. Please try again later.');
      }
    } catch (error: any) {
      console.error('Error claiming show series:', error);
      Alert.alert('Error', 'An unexpected error occurred while claiming the show series.');
    } finally {
      setIsClaimingShow(false);
    }
  };
  
  /**
   * Handles claiming an individual show as an organizer
   * (Legacy function for shows not part of a series)
   */
  const handleClaimShow = async () => {
    // If this show is part of a series, claim the series instead
    if (show?.series_id && showSeries) {
      handleClaimShowSeries();
      return;
    }
    
    if (!user || !isShowOrganizer) {
      Alert.alert('Permission Denied', 'You must be a Show Organizer to claim this show.');
      return;
    }

    try {
      setIsClaimingShow(true);
      
      const { success, error } = await organizerService.claimShow(showId, user.id);
      
      if (success) {
        Alert.alert(
          'Success!', 
          'You have successfully claimed this show. You can now manage it and respond to reviews.',
          [{ text: 'OK', onPress: () => fetchShowDetails() }]
        );
      } else {
        Alert.alert('Error', error || 'Failed to claim show. Please try again later.');
      }
    } catch (error: any) {
      console.error('Error claiming show:', error);
      Alert.alert('Error', 'An unexpected error occurred while claiming the show.');
    } finally {
      setIsClaimingShow(false);
    }
  };

  /**
   * Navigates to the edit show screen
   */
  const navigateToEditShow = () => {
    navigation.navigate('EditShow', { showId });
  };

  const shareShow = async () => {
    try {
      if (!show) return;
      
      const message = `Check out this card show: ${show.title}\n\nWhen: ${formatShowDate(show)}\nWhere: ${show.location}\n\nShared from Card Show Finder app`;
      
      await Share.share({
        message,
        title: show.title
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };
  
  const formatShowDate = (show: any) => {
    if (!show) return '';
    
    try {
      // Strip any time component and rebuild date at noon local time to
      // avoid negative TZ offsets (e.g. UTC stored date displays previous day).
      const startIso = (show.start_date as string).split('T')[0];
      const endIso =
        show.end_date && typeof show.end_date === 'string'
          ? (show.end_date as string).split('T')[0]
          : null;

      const startDate = new Date(`${startIso}T12:00:00`);
      const endDate = endIso ? new Date(`${endIso}T12:00:00`) : null;

      const options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      } as const;

      if (endDate && startDate.toDateString() !== endDate.toDateString()) {
        return `${startDate.toLocaleDateString(
          undefined,
          options
        )} - ${endDate.toLocaleDateString(undefined, options)}`;
      }

      return startDate.toLocaleDateString(undefined, options);
    } catch (e) {
      console.error('Error formatting date:', e);
      return show.start_date || 'Date unavailable';
    }
  };
  
  const openMapLocation = () => {
    if (!show) return;
    
    const address = encodeURIComponent(show.address || show.location);
    const url = `https://maps.apple.com/?q=${address}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback for Android
        const googleUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
        Linking.openURL(googleUrl);
      }
    });
  };

  /* -------------------------------------------------------------- */
  /* Placeholder navigation / messaging handlers for MVP dealers    */
  /* -------------------------------------------------------------- */
  const handleViewDealerDetails = (dealerId: string, dealerName: string) => { // Added dealerName to args
    // Open modal with booth-specific info instead of navigating away
    setSelectedDealer({ id: dealerId, name: dealerName });
    setShowDealerDetailModal(true);
  };

  const handleMessageDealer = (dealerId: string, dealerName: string) => {
    // Reset navigation so root is MainTabs → Messages (DirectMessagesScreen)
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            params: {
              screen: 'Messages',
              params: {
                recipientId: dealerId,
                recipientName: dealerName,
                isNewConversation: true,
              },
            },
          },
        ],
      })
    );
  };
  
  /**
   * Handle responding to a review
   */
  const handleRespondToReview = async (reviewId: string, response: string) => {
    try {
      await showSeriesService.respondToReview(reviewId, response);
      // Refresh reviews after responding
      if (showSeries) {
        fetchSeriesReviews(showSeries.id);
      }
      Alert.alert('Success', 'Your response has been posted.');
    } catch (error) {
      console.error('Error responding to review:', error);
      Alert.alert('Error', 'Failed to post response. Please try again.');
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>Loading show details...</Text>
      </View>
    );
  }
  
  if (error || !show) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#FF6A00" />
        <Text style={styles.errorText}>{error || 'Show not found'}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchShowDetails}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      {/* Show Image */}
      {show.image ? (
        <Image source={{ uri: show.image }} style={styles.image} />
      ) : (
        // Use branded placeholder image for consistency with list view
        <Image source={placeholderShowImage} style={styles.image} resizeMode="cover" />
      )}
      
      {/* Header Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={toggleFavorite}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={isFavorite ? '#FF6A00' : '#333333'}
          />
          <Text style={styles.actionText}>Save</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={openMapLocation}
        >
          <Ionicons name="location" size={24} color="#333333" />
          <Text style={styles.actionText}>Map</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={shareShow}
        >
          <Ionicons name="share-outline" size={24} color="#333333" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
        
        {/* Review button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowReviewForm(true)}
        >
          <Ionicons name="star-outline" size={24} color="#333333" />
          <Text style={styles.actionText}>Review</Text>
        </TouchableOpacity>
        
        {/* Broadcast Message button for organizers */}
        {(isCurrentUserOrganizer || isMvpDealer) && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowBroadcastModal(true)}
          >
            <Ionicons name="megaphone-outline" size={24} color="#FF6A00" />
            <Text style={[styles.actionText, { color: '#FF6A00' }]}>Broadcast</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Show Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.title}>{show.title}</Text>
        
        {/* Series Badge - Show if this is part of a series */}
        {showSeries && (
          <View style={styles.seriesBadge}>
            <Ionicons name="repeat" size={16} color="#FFFFFF" style={styles.seriesBadgeIcon} />
            <Text style={styles.seriesBadgeText}>
              Part of the {showSeries.name} series
            </Text>
          </View>
        )}
        
        {/* Series Rating - Show if this is part of a series */}
        {showSeries && showSeries.averageRating && (
          <View style={styles.seriesRatingContainer}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={showSeries.averageRating && star <= showSeries.averageRating ? 'star' : 'star-outline'}
                  size={18}
                  color="#FFD700"
                  style={styles.starIcon}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>
              {showSeries.averageRating.toFixed(1)} ({showSeries.reviewCount} {showSeries.reviewCount === 1 ? 'review' : 'reviews'})
            </Text>
          </View>
        )}
        
        <View style={styles.infoRow}>
          <Ionicons name="calendar" size={20} color="#666666" style={styles.infoIcon} />
          <Text style={styles.infoText}>{formatShowDate(show)}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="time" size={20} color="#666666" style={styles.infoIcon} />
          <Text style={styles.infoText}>{show.time || 'Time not specified'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="location" size={20} color="#666666" style={styles.infoIcon} />
          <Text style={styles.infoText}>{show.address || show.location || 'Location not specified'}</Text>
        </View>
        
        {show.entry_fee && (
          <View style={styles.infoRow}>
            <Ionicons name="cash" size={20} color="#666666" style={styles.infoIcon} />
            {/* Wrap template literal in braces so it returns a single string */}
            <Text style={styles.infoText}>
              {`Entry Fee: ${
                typeof show.entry_fee === 'number'
                  ? `$${show.entry_fee.toFixed(2)}`
                  : show.entry_fee
              }`}
            </Text>
          </View>
        )}
        
        {/* Show Claim Button for Show Organizers */}
        {isShowOrganizer && !isCurrentUserOrganizer && (
          <TouchableOpacity
            style={styles.claimShowButton}
            onPress={showSeries ? handleClaimShowSeries : handleClaimShow}
            disabled={isClaimingShow}
          >
            {isClaimingShow ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="flag" size={20} color="#FFFFFF" style={styles.claimButtonIcon} />
                <Text style={styles.claimButtonText}>
                  {showSeries ? 'Claim This Show Series' : 'Claim This Show'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        {/* Edit Show Button for the organizer of this show */}
        {isCurrentUserOrganizer && (
          <TouchableOpacity
            style={styles.editShowButton}
            onPress={navigateToEditShow}
          >
            <Ionicons name="create" size={20} color="#FFFFFF" style={styles.claimButtonIcon} />
            <Text style={styles.claimButtonText}>Edit Show Details</Text>
          </TouchableOpacity>
        )}
        
        {/* Show organizer info - either from the show or series */}
        {(show.organizer_id && show.profiles) || (showSeries && showSeries.organizerId) ? (
          <View style={styles.organizerContainer}>
            <Text style={styles.sectionTitle}>Organized by:</Text>
            <View style={styles.organizer}>
              {show.profiles?.avatar_url ? (
                <Image source={{ uri: show.profiles.avatar_url }} style={styles.organizerAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {show.profiles?.full_name?.[0] || show.profiles?.username?.[0] || 'O'}
                  </Text>
                </View>
              )}
              <Text style={styles.organizerName}>
                {show.profiles?.full_name || show.profiles?.username || 'Show Organizer'}
              </Text>
            </View>
          </View>
        ) : null}
        
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>About this show</Text>
          <Text style={styles.description}>{show.description || 'No description available'}</Text>
        </View>

        {/* ---------------- Participating Dealers Section ---------------- */}        
        <View style={styles.mvpDealersContainer}> {/* Renamed for clarity, but keeping styling */}
          <Text style={styles.sectionTitle}>Participating Dealers</Text> {/* Updated title */}
          {loadingDealers ? (
            <View style={styles.loadingDealersContainer}>
              <ActivityIndicator size="small" color="#FF6A00" />
              <Text style={styles.loadingDealersText}>Loading dealers...</Text>
            </View>
          ) : participatingDealers.length > 0 ? ( // Use new state name
            <View style={styles.dealersList}>
              {participatingDealers.map(dealer => ( // Use new state name
                <View key={dealer.id} style={styles.dealerItem}>
                  {/* Conditionally render as clickable based on role */}
                  {dealer.role === UserRole.MVP_DEALER ? (
                    <TouchableOpacity
                      style={styles.dealerNameButton}
                      onPress={() => handleViewDealerDetails(dealer.id, dealer.name)}
                    >
                      <Text style={styles.dealerName}>{dealer.name} (MVP)</Text> {/* Added (MVP) for clarity */}
                    </TouchableOpacity>
                  ) : (
                    // Regular dealers are not clickable, just display name
                    <Text style={[styles.dealerName, styles.nonClickableDealerName]}>{dealer.name}</Text>
                  )}

                  {/* Message Dealer button only for MVP Dealers */}
                  {dealer.role === UserRole.MVP_DEALER && (
                    <TouchableOpacity
                      style={styles.messageDealerButton}
                      onPress={() => handleMessageDealer(dealer.id, dealer.name)}
                    >
                      <Text style={styles.messageDealerButtonText}>Message Dealer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noDataText}>No participating dealers listed for this show yet.</Text> 
          )}
        </View>

        {/* Reviews Section - Show if this is part of a series */}
        {showSeries && (
          <View style={styles.reviewsContainer}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            {loadingReviews ? (
              <View style={styles.loadingDealersContainer}>
                <ActivityIndicator size="small" color="#FF6A00" />
                <Text style={styles.loadingDealersText}>Loading reviews...</Text>
              </View>
            ) : (
              <View style={styles.reviewsList}>
                {reviews.length > 0 ? (
                  <ReviewsList reviews={reviews} emptyMessage="Be the first to review this show!" />
                ) : (
                  <Text style={styles.noDataText}>No reviews yet. Be the first to leave a review!</Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>
      
      {/* Broadcast Message Modal */}
      <GroupMessageComposer
        visible={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        showId={showId}
        showTitle={show.title}
        onMessageSent={() => {
          Alert.alert('Success', 'Broadcast message sent successfully');
        }}
      />

      {/* Dealer Detail Modal */}
      {selectedDealer && (
        <DealerDetailModal
          isVisible={showDealerDetailModal}
          onClose={() => setShowDealerDetailModal(false)}
          dealerId={selectedDealer.id}
          showId={showId}
          dealerName={selectedDealer.name}
        />
      )}
      
      {/* Review Form Modal */}
      {showReviewForm && showSeries && (
        <ReviewForm
          seriesId={showSeries.id}
          onSubmit={handleSubmitReview}
          onCancel={() => setShowReviewForm(false)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#FF6A00',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FF6A00',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 10,
    color: '#999999',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    marginTop: 4,
    fontSize: 12,
  },
  detailsContainer: {
    padding: 16,
    backgroundColor: 'white',
    marginTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  // Series badge styles
  seriesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0057B8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  seriesBadgeIcon: {
    marginRight: 6,
  },
  seriesBadgeText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  // Series rating styles
  seriesRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  starIcon: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoText: {
    fontSize: 16,
    flex: 1,
  },
  claimShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6A00',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  editShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0057B8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  claimButtonIcon: {
    marginRight: 8,
  },
  claimButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  organizerContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  organizer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0057B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  descriptionContainer: {
    marginTop: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },

  /* ----------  Participating Dealers styles ---------- */
  mvpDealersContainer: { // Keeping old name for now, but semantically it's now all participating dealers
    marginTop: 24,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  dealersList: {
    marginTop: 8,
  },
  dealerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  dealerNameButton: { // This is for clickable names (MVP dealers)
    flex: 1,
  },
  dealerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0057B8',
  },
  nonClickableDealerName: { // Style for non-clickable names (regular dealers)
    color: '#333333', // Make it less prominent than a link
    // You might want to remove flex: 1 if it interferes with alignment for non-clickable
    // or adjust styling as needed.
  },
  messageDealerButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  messageDealerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  noDataText: {
    fontSize: 16,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  loadingDealersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingDealersText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
  },
  // Reviews section styles
  reviewsContainer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  reviewsList: {
    marginTop: 8,
  },
});

export default ShowDetailScreen;
