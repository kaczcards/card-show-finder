import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image
} from 'react-native';
import { Conversation } from '../services/messagingService';
import { Ionicons } from '@expo/vector-icons';

interface ChatListProps {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const ChatList: React.FC<ChatListProps> = ({
  conversations,
  isLoading,
  error,
  onSelectConversation,
  onRefresh,
  refreshing = false
}) => {
  // Format date helper function
  const formatLastActive = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    
    // If it's today, show the time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If it's yesterday, show "Yesterday"
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // If it's within the last 7 days, show the day name
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    if (date > oneWeekAgo) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Otherwise, show the date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Create a truncated preview of the message
  const createMessagePreview = (text: string): string => {
    if (!text) return '';
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  };

  // Render each chat item
  const renderItem = ({ item }: { item: Conversation }) => {
    // Get the other user's profile from the conversation
    const otherUser = item.participants?.find(p => 
      p.profile_id !== 'current_user_id'
    )?.profile;
    
    const displayName = otherUser?.username || 'Anonymous';
    const avatarUrl = otherUser?.avatar_url;
    
    // Decide if there are unread messages
    const hasUnread = item.unread_count && item.unread_count > 0;
    
    // Get the most recent message
    const lastMessage = item.last_message?.content || 'No messages';
    const lastActiveTime = item.last_message?.created_at 
      ? formatLastActive(item.last_message.created_at)
      : '';

    return (
      <TouchableOpacity
        style={[
          styles.chatItem,
          hasUnread && styles.unreadChatItem
        ]}
        onPress={() => onSelectConversation(item)}
      >
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {hasUnread && (
            <View style={styles.unreadIndicator} />
          )}
        </View>
        
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={[
              styles.chatName,
              hasUnread && styles.unreadChatName
            ]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.timeText}>
              {lastActiveTime}
            </Text>
          </View>
          
          <View style={styles.messagePreviewContainer}>
            <Text 
              style={[
                styles.messagePreview,
                hasUnread && styles.unreadMessagePreview
              ]}
              numberOfLines={1}
            >
              {createMessagePreview(lastMessage)}
            </Text>
            
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show when there's an error
  const renderError = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="alert-circle" size={48} color="#FF3B30" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={onRefresh}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  // Show when there are no conversations
  const renderEmpty = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="chatbubble-ellipses-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        When you message a dealer or show organizer, your conversations will appear here
      </Text>
    </View>
  );

  // Show loading state
  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#FF6A00" />
      <Text style={styles.loadingText}>Loading conversations...</Text>
    </View>
  );

  // Main render
  if (isLoading && !refreshing && conversations.length === 0) {
    return renderLoading();
  }

  if (error && !refreshing && conversations.length === 0) {
    return renderError();
  }

  return (
    <FlatList
      data={conversations}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={renderEmpty()}
      contentContainerStyle={
        conversations.length === 0 ? styles.fullScreenContainer : styles.listContainer
      }
    />
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flexGrow: 1,
    paddingBottom: 100, // Extra padding at bottom for scroll effect
  },
  listContainer: {
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  unreadChatItem: {
    backgroundColor: '#F8F8F8',
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
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0057B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  unreadIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF6A00',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
    color: '#333333',
  },
  unreadChatName: {
    fontWeight: 'bold',
    color: '#000000',
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  messagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagePreview: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
    marginRight: 8,
  },
  unreadMessagePreview: {
    color: '#333333',
  },
  unreadBadge: {
    backgroundColor: '#FF6A00',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
    color: '#333333',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginVertical: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF6A00',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
});

export default ChatList;
