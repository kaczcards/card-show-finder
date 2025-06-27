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
import * as userRoleService from '../../services/userRoleService';
import { UserRole } from '../../services/userRoleService';
import GroupMessageComposer from '../../components/GroupMessageComposer';

interface ShowDetailProps {
  route: any;
  navigation: any;
}

const ShowDetailScreen: React.FC<ShowDetailProps> = ({ route, navigation }) => {
  const { showId } = route.params;
  const { user, userProfile } = useAuth();
  
  const [show, setShow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  
  // Check if user is show organizer
  const [isShowOrganizer, setIsShowOrganizer] = useState(false);
  const [isMvpDealer, setIsMvpDealer] = useState(false);
  
  useEffect(() => {
    if (!user || !userProfile) {
      setIsShowOrganizer(false);
      setIsMvpDealer(false);
      return;
    }
    
    const userRole = userProfile.role as UserRole;
    setIsShowOrganizer(userRole === UserRole.SHOW_ORGANIZER);
    setIsMvpDealer(userRole === UserRole.MVP_DEALER);
    
    // In test mode, treat all authenticated users as organizers
    if (userRoleService.IS_TEST_MODE) {
      setIsShowOrganizer(true);
    }
  }, [user, userProfile]);
  
  useEffect(() => {
    fetchShowDetails();
    if (user) {
      checkIfFavorite();
    }
  }, [showId, user]);
  
  const fetchShowDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('shows')
        .select(`
          *,
          profiles:organizer_id(username, full_name, avatar_url)
        `)
        .eq('id', showId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setShow(data);
        
        // Set navigation title
        navigation.setOptions({
          title: data.title || 'Show Details'
        });
      }
    } catch (error) {
      console.error('Error fetching show details:', error);
      setError('Failed to load show details');
    } finally {
      setLoading(false);
    }
  };
  
  const checkIfFavorite = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_favorite_shows')
        .select()
        .eq('user_id', user.id)
        .eq('show_id', showId)
        .single();
      
      if (!error && data) {
        setIsFavorite(true);
      } else {
        setIsFavorite(false);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };
  
  const toggleFavorite = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save favorites');
      return;
    }
    
    try {
      if (isFavorite) {
        // Remove from favorites
        await supabase
          .from('user_favorite_shows')
          .delete()
          .eq('user_id', user.id)
          .eq('show_id', showId);
        
        setIsFavorite(false);
      } else {
        // Add to favorites
        await supabase
          .from('user_favorite_shows')
          .insert([{ user_id: user.id, show_id: showId }]);
        
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorites');
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
      const startDate = new Date(show.start_date);
      const endDate = show.end_date ? new Date(show.end_date) : null;
      
      const options = { weekday: 'short', month: 'short', day: 'numeric' } as const;
      
      if (endDate && startDate.toDateString() !== endDate.toDateString()) {
        return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
      }
      
      return startDate.toLocaleDateString(undefined, options);
    } catch (e) {
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
        <View style={styles.imagePlaceholder}>
          <Ionicons name="card" size={60} color="#CCCCCC" />
          <Text style={styles.placeholderText}>No Image Available</Text>
        </View>
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
        
        {/* Broadcast Message button for organizers */}
        {(isShowOrganizer || isMvpDealer) && (
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
            <Text style={styles.infoText}>
              Entry Fee: {typeof show.entry_fee === 'number' ? `$${show.entry_fee.toFixed(2)}` : show.entry_fee}
            </Text>
          </View>
        )}
        
        {show.organizer_id && show.profiles && (
          <View style={styles.organizerContainer}>
            <Text style={styles.sectionTitle}>Organized by:</Text>
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
          <Text style={styles.sectionTitle}>About this show</Text>
          <Text style={styles.description}>{show.description || 'No description available'}</Text>
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
});

export default ShowDetailScreen;
