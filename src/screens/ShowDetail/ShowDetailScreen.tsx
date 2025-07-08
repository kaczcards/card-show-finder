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
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CommonActions } from '@react-navigation/native';
import * as userRoleService from '../../services/userRoleService';
import { UserRole } from '../../types';

import GroupMessageComposer from '../../components/GroupMessageComposer';
import DealerDetailModal from '../../components/DealerDetailModal';

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

/* -------------------------------------------------------------------------- */
/* Utility presentation components (kept local to avoid extra files)          */
/* -------------------------------------------------------------------------- */
type InfoRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text?: string;
  children?: React.ReactNode;
};

/** Renders a consistent "icon + text" row */
const InfoRow: React.FC<InfoRowProps> = ({ icon, text, children }) => {
  /* ----------------------------------------------------------------
   * RN requires all strings to be wrapped in <Text>.  If a caller
   * passes `children` as a bare string we wrap it proactively.
   * ---------------------------------------------------------------- */
  const renderContent = () => {
    if (children === undefined || children === null) {
      return <Text style={styles.infoText}>{text}</Text>;
    }

    // children exists – wrap if it's a primitive
    if (typeof children === 'string' || typeof children === 'number') {
      return <Text style={styles.infoText}>{children}</Text>;
    }

    // otherwise assume it's valid ReactNode(s)
    return children;
  };

  return (
    <View style={styles.infoRow}>
      <Ionicons
        name={icon}
        size={20}
        color="#666666"
        style={styles.infoIcon}
      />
      {renderContent()}
    </View>
  );
};

/** Section header helper for consistent typography */
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

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
  
  // Check if user is show organizer
  const [isShowOrganizer, setIsShowOrganizer] = useState(false);
  const [isMvpDealer, setIsMvpDealer] = useState(false);
  
  // State for all participating dealers (formerly mvpDealers)
  const [participatingDealers, setParticipatingDealers] = useState<any[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(false);

  /* ---------- Dealer-detail modal state ---------- */
  const [showDealerDetailModal, setShowDealerDetailModal] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<{ id: string; name: string } | null>(
    null
  );

  /* ---------- Image loading / error state ---------- */
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageRetryCount, setImageRetryCount] = useState(0);

  /**
   * Get a consistent stock image based on show ID or index
   * This uses the same logic as HomeScreen for consistency
   */
  const getStockImage = (id?: string, index: number = 0) => {
    if (!id) return stockImages[index % stockImages.length];
    
    // Use a hash-like approach to consistently map show IDs to images
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return stockImages[hash % stockImages.length] || fallbackImage;
  };

  /**
   * Retry loading the image when it fails
   */
  const handleImageError = () => {
    // Only retry a few times to avoid infinite loop
    if (imageRetryCount < 2) {
      setImageRetryCount(prev => prev + 1);
      setImageError(false);
      setImageLoading(true);
    } else {
      setImageError(true);
      setImageLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      console.log('No user found in auth state, resetting organizer/dealer status');
      setIsShowOrganizer(false);
      setIsMvpDealer(false);
      return;
    }
    
    console.log('User role in ShowDetailScreen:', user.role);
    const userRole = user.role as UserRole;
    
    // Explicitly check if the user has the SHOW_ORGANIZER role
    const hasOrganizerRole = userRole === UserRole.SHOW_ORGANIZER;
    console.log('Is user a show organizer?', hasOrganizerRole);
    
    setIsShowOrganizer(hasOrganizerRole);
    setIsMvpDealer(userRole === UserRole.MVP_DEALER);
    
    // In test mode, treat all authenticated users as organizers
    if (userRoleService.IS_TEST_MODE) {
      console.log('Test mode enabled, treating user as organizer');
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
        .select('*')
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
        setIsShowClaimed(!!data.claimed);

        // Update navigation title
        navigation.setOptions({
          title: data.title || 'Show Details',
        });
      }
    } catch (error) {
      console.error('Error fetching show details:', error);
      setError('Failed to load show details');
    } finally {
      setLoading(false);
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
  
  /* -------------------------------------------------------------- */
  /* Helper: format a time string to 12-hour hh:mm                   */
  /* -------------------------------------------------------------- */
  const formatTime = (timeString?: string | null) => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error('Error formatting time:', e);
      return timeString ?? '';
    }
  };
  
  /**
   * Build a friendly start–end time string if the show includes hours.
   * Accepts both snake_case (DB) and camelCase (sanity) variants.
   */
  const getFormattedShowHours = (show: any): string => {
    if (!show) return 'Time not specified';

    const start =
      show.start_time ??
      show.startTime ??
      show.time ?? // legacy single-field fallback
      null;
    const end = show.end_time ?? show.endTime ?? null;

    if (start && end && start !== end) {
      return `${formatTime(start)} - ${formatTime(end)}`;
    }

    if (start) return formatTime(start);
    if (end) return formatTime(end);
    
    // Try to extract time from description as a last resort
    if (show.description) {
      return extractTimeFromDescription(show.description) || 'Time not specified';
    }
    
    return 'Time not specified';
  };
  
  /**
   * Attempts to extract time information from the show description
   * using common patterns like "10am-4pm" or "10:00 AM to 5:00 PM"
   */
  const extractTimeFromDescription = (description: string): string | null => {
    if (!description) return null;
    
    // Common time patterns:
    // 1. 10am-4pm, 10 am - 4 pm
    // 2. 10:00 AM to 5:00 PM, 10:00AM-5:00PM
    // 3. 10 to 4, 10-4
    
    // Look for time patterns with AM/PM
    const timePattern1 = /(\d{1,2})(:\d{2})?\s*(am|pm|AM|PM)\s*[-–—to]\s*(\d{1,2})(:\d{2})?\s*(am|pm|AM|PM)/;
    const match1 = description.match(timePattern1);
    if (match1) {
      return `${match1[1]}${match1[2] || ''}${match1[3].toLowerCase()} - ${match1[4]}${match1[5] || ''}${match1[6].toLowerCase()}`;
    }
    
    // Look for simple hour ranges (10-4)
    const timePattern2 = /\b(\d{1,2})\s*[-–—to]\s*(\d{1,2})(\s*[ap]m)?\b/i;
    const match2 = description.match(timePattern2);
    if (match2) {
      if (match2[3]) {
        // Has am/pm suffix
        return `${match2[1]}${match2[3].toLowerCase()} - ${match2[2]}${match2[3].toLowerCase()}`;
      } else {
        // No am/pm, assume it's like "10-4" meaning "10am-4pm"
        return `${match2[1]}am - ${match2[2]}pm`;
      }
    }
    
    // No time pattern found
    return null;
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
        
        <InfoRow icon="calendar" text={formatShowDate(show)} />
        
        {/* ------- Show Times Section ------- */}
        <View style={styles.timeContainer}>
          <SectionHeader>Show Hours</SectionHeader>
          {/* Use the getFormattedShowHours function to display times */}
          <Text style={styles.timeText}>
            {getFormattedShowHours(show)}
          </Text>

          {/* Per-day hours handling (optional array) */}
          {Array.isArray(show.show_days || show.showDays) &&
            (show.show_days || show.showDays).map((day: any, idx: number) => (
              <View key={idx} style={styles.dayTimeRow}>
                <Text style={styles.dayText}>{day.date || `Day ${idx + 1}`}:</Text>
                <Text style={styles.timeText}>
                  {day.start_time || day.startTime ? formatTime(day.start_time || day.startTime) : ''}
                  {(day.start_time || day.startTime) && (day.end_time || day.endTime) ? ' - ' : ''}
                  {day.end_time || day.endTime ? formatTime(day.end_time || day.endTime) : ''}
                </Text>
              </View>
            ))}
        </View>
        
        <InfoRow
          icon="location"
          text={show.address || show.location || 'Location not specified'}
        />
        
        {show.entry_fee && (
            </Text>
          </InfoRow>
        )}
        
        {/* Show Claim Button for Show Organizers */}
        {isShowOrganizer && !isCurrentUserOrganizer && !show.organizer_id && (
          <TouchableOpacity
            style={styles.claimShowButton}
            onPress={handleClaimShow}
            disabled={isClaimingShow}
          >
            {isClaimingShow ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="flag" size={20} color="#FFFFFF" style={styles.claimButtonIcon} />
                <Text style={styles.claimButtonText}>Claim This Show</Text>
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
        
        {show.organizer_id && show.profiles && (
          <View style={styles.organizerContainer}>
            <SectionHeader>Organized by:</SectionHeader>
            <View style={styles.organizer}>
              {show.profiles.avatar_url ? (
                <Image source={{ uri: show.profiles.avatar_url }} style={styles.organizerAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {show.profiles.full_name?.[0] || show.profiles.username?.[0] || 'O'}
                  </Text>
                </View>
              )}
              <Text style={styles.organizerName}>
                {show.profiles.full_name || show.profiles.username || 'Unknown Organizer'}
              </Text>
            </View>
          </View>
        )}
        
        <View style={styles.descriptionContainer}>
          <SectionHeader>About this show</SectionHeader>
          <Text style={styles.description}>{show.description || 'No description available'}</Text>
        </View>

        {/* Show Claiming Section for Show Organizers */}
        {isShowOrganizer && (
          <View style={styles.claimContainer}>
            {isShowClaimed && show.claimed_by === user?.id ? (
              <View>
                <View style={styles.claimedBadge}>
                  <Text style={styles.claimedText}>You manage this show</Text>
                </View>
                <View style={styles.managementSection}>
                  <Text style={styles.sectionTitle}>Show Management</Text>
                  
                  <TouchableOpacity 
                    style={styles.managementButton}
                    onPress={() => navigation.navigate('EditShow', { showId })}
                  >
                    <Text style={styles.buttonText}>Edit Show Details</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.managementButton}
                    onPress={() => navigation.navigate('ManageDealers', { showId })}
                  >
                    <Text style={styles.buttonText}>Manage Dealers</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.managementButton}
                    onPress={() => navigation.navigate('ShowAnalytics', { showId })}
                  >
                    <Text style={styles.buttonText}>View Analytics</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : !isShowClaimed ? (
              <TouchableOpacity 
                style={styles.claimButton}
                onPress={handleClaimShow}
                disabled={isClaimingShow}
              >
                {isClaimingShow ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.claimButtonText}>Claim This Show</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.alreadyClaimedText}>
                This show has already been claimed by another organizer.
              </Text>
            )}
          </View>
        )}

        {/* ---------------- Participating Dealers Section ---------------- */}        
        <View style={styles.mvpDealersContainer}> {/* Renamed for clarity, but keeping styling */}
          <SectionHeader>Participating Dealers</SectionHeader>
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

        {/* Show Features/Tags could be added here */}
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
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageLoader: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 1,
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

  /* ----------  Show Time section styles ---------- */
  timeContainer: {
    marginVertical: 10,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  timeText: {
    fontSize: 16,
    color: '#333',
  },
  noTimeText: {
    fontSize: 16,
    color: '#888',
    fontStyle: 'italic',
  },
  dayTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
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

  /* ----------  Show Claiming styles ---------- */
  claimContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e9f7',
  },
  claimButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  claimButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  claimedBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  claimedText: {
    color: 'white',
    fontWeight: '600',
  },
  alreadyClaimedText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  managementSection: {
    marginTop: 16,
  },
  managementButton: {
    backgroundColor: '#2c3e50',
    padding: 12,
    borderRadius: 6,
    marginVertical: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default ShowDetailScreen;
