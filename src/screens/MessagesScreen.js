// src/screens/MessagesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { getConversations, getUnreadMessageCount } from '../services/messagingService';

const MessagesScreen = () => {
  const navigation = useNavigation();
  const { currentUser, userProfile } = useUser();
  
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);
  
  // Check if user is a dealer or show organizer (MVP user)
  const isMvpUser = userProfile?.role === 'dealer' || userProfile?.role === 'showOrganizer';
  
  // Format timestamp to relative time (e.g., "2h ago")
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now - messageTime;
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return messageTime.toLocaleDateString();
  };
  
  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get all conversations for the current user
      const { conversations: convos, error: convoError } = await getConversations(currentUser.uid);
      
      if (convoError) {
        setError(convoError);
        return;
      }
      
      // Get total unread count
      const { count, error: countError } = await getUnreadMessageCount(currentUser.uid);
      
      if (!countError) {
        setTotalUnread(count);
      }
      
      // Process conversations to extract the other participant
      const processedConvos = convos.map(convo => {
        // Find the other participant (not the current user)
        const otherParticipant = convo.participants.find(
          p => p.id !== currentUser.uid
        );
        
        // Get unread count for current user
        const unreadCount = convo.unreadCount?.[currentUser.uid] || 0;
        
        return {
          ...convo,
          otherParticipant,
          unreadCount
        };
      });
      
      setConversations(processedConvos);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);
  
  // Load conversations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );
  
  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };
  
  // Navigate to conversation detail
  const handleOpenConversation = (conversation) => {
    navigation.navigate('ConversationDetail', { 
      conversationId: conversation.id,
      otherUser: conversation.otherParticipant
    });
  };
  
  // Start a new conversation
  const handleNewMessage = () => {
    if (!isMvpUser) {
      Alert.alert(
        'MVP Feature',
        'Starting new conversations is only available for dealers and show organizers.'
      );
      return;
    }
    
    navigation.navigate('NewMessage');
  };
  
  // If not logged in, show login prompt
  if (!currentUser) {
    return (
      <View style={styles.loginContainer}>
        <Ionicons name="chatbubbles-outline" size={80} color="#3498db" />
        <Text style={styles.loginTitle}>Sign in to access messages</Text>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Render each conversation item
  const renderConversation = ({ item }) => {
    const { otherParticipant, lastMessage, lastMessageTimestamp, unreadCount } = item;
    
    return (
      <TouchableOpacity 
        style={[
          styles.conversationItem,
          unreadCount > 0 && styles.unreadConversation
        ]}
        onPress={() => handleOpenConversation(item)}
      >
        {/* User avatar */}
        <View style={styles.avatarContainer}>
          {otherParticipant.photoURL ? (
            <Image 
              source={{ uri: otherParticipant.photoURL }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={[
              styles.avatarPlaceholder,
              otherParticipant.role === 'dealer' && styles.dealerAvatar,
              otherParticipant.role === 'showOrganizer' && styles.organizerAvatar
            ]}>
              <Text style={styles.avatarText}>
                {otherParticipant.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          
          {/* Role badge */}
          {otherParticipant.role !== 'attendee' && (
            <View style={[
              styles.roleBadge,
              otherParticipant.role === 'showOrganizer' && styles.organizerBadge
            ]}>
              <Ionicons 
                name={otherParticipant.role === 'dealer' ? 'briefcase' : 'calendar'} 
                size={10} 
                color="#fff" 
              />
            </View>
          )}
        </View>
        
        {/* Conversation details */}
        <View style={styles.conversationDetails}>
          <View style={styles.conversationHeader}>
            <Text style={styles.participantName}>
              {otherParticipant.name || 'User'}
            </Text>
            <Text style={styles.timestamp}>
              {formatTime(lastMessageTimestamp)}
            </Text>
          </View>
          
          <View style={styles.messagePreviewContainer}>
            <Text 
              style={[
                styles.messagePreview,
                unreadCount > 0 && styles.unreadMessagePreview
              ]}
              numberOfLines={1}
            >
              {lastMessage || 'No messages yet'}
            </Text>
            
            {/* Unread badge */}
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Empty state
  const renderEmptyComponent = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={60} color="#adb5bd" />
        <Text style={styles.emptyTitle}>No Messages Yet</Text>
        <Text style={styles.emptySubtitle}>
          {isMvpUser 
            ? 'Start a conversation with attendees or other dealers'
            : 'Messages from dealers will appear here'}
        </Text>
        
        {isMvpUser && (
          <TouchableOpacity 
            style={styles.emptyActionButton}
            onPress={handleNewMessage}
          >
            <Text style={styles.emptyActionButtonText}>Start a Conversation</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      {/* Header with unread count */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        {totalUnread > 0 && (
          <View style={styles.totalUnreadBadge}>
            <Text style={styles.totalUnreadText}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </Text>
          </View>
        )}
        
        {/* New message button (MVP users only) */}
        {isMvpUser && (
          <TouchableOpacity 
            style={styles.newMessageButton}
            onPress={handleNewMessage}
          >
            <Ionicons name="create-outline" size={24} color="#3498db" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadConversations}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Conversations list */}
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3498db']}
          />
        }
      />
      
      {/* Loading indicator */}
      {loading && !refreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      )}
      
      {/* Role-specific info banner */}
      {!isMvpUser && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#3498db" />
          <Text style={styles.infoBannerText}>
            You can message dealers at shows you plan to attend
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    flex: 1,
  },
  totalUnreadBadge: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 10,
  },
  totalUnreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  newMessageButton: {
    padding: 8,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  unreadConversation: {
    backgroundColor: '#f0f8ff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#adb5bd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dealerAvatar: {
    backgroundColor: '#3498db',
  },
  organizerAvatar: {
    backgroundColor: '#9b59b6',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  roleBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3498db',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  organizerBadge: {
    backgroundColor: '#9b59b6',
  },
  conversationDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
  },
  timestamp: {
    fontSize: 12,
    color: '#6c757d',
  },
  messagePreviewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreview: {
    fontSize: 14,
    color: '#6c757d',
    flex: 1,
  },
  unreadMessagePreview: {
    color: '#212529',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#3498db',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyActionButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  emptyActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 30,
    textAlign: 'center',
    color: '#212529',
  },
  loginButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderTopWidth: 1,
    borderTopColor: '#bde0fe',
  },
  infoBannerText: {
    color: '#0c4a6e',
    marginLeft: 8,
    fontSize: 14,
  },
});

export default MessagesScreen;
