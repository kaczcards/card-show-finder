import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface Participant {
  user_id: string;
  display_name?: string;
  photo_url?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'show';
  show_id?: string;
  participant_count: number;
  last_message_text?: string;
  last_message_timestamp?: string;
  unread_count: number;
  participants: Participant[];
}

interface ChatListProps {
  conversations: Conversation[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectConversation: (conversation: Conversation) => void;
  onNewConversation: () => void;
  currentUserId: string;
}

const ChatList: React.FC<ChatListProps> = ({
  conversations,
  isLoading,
  onRefresh,
  onSelectConversation,
  onNewConversation,
  currentUserId
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Within a week
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    if (date > oneWeekAgo) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Older
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  // Trigger haptic feedback when selecting a conversation with unread messages
  const handleConversationSelect = (conversation: Conversation) => {
    if (conversation.unread_count > 0 && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelectConversation(conversation);
  };
  
  // Filter conversations based on search query
  const filteredConversations = searchQuery.trim() === '' 
    ? conversations 
    : conversations.filter(conversation => {
        // For direct conversations, search participant name
        if (conversation.type === 'direct' && conversation.participants.length > 0) {
          const participant = conversation.participants[0];
          const name = participant.display_name || '';
          return name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        
        // For group/show chats, search all participant names
        return conversation.participants.some(p => 
          (p.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
  
  // Sort conversations by most recent message
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const timeA = a.last_message_timestamp ? new Date(a.last_message_timestamp).getTime() : 0;
    const timeB = b.last_message_timestamp ? new Date(b.last_message_timestamp).getTime() : 0;
    return timeB - timeA; // Most recent first
  });
  
  // Render each conversation item
  const renderConversationItem = ({ item }: { item: Conversation }) => {
    // Get display name based on conversation type
    let displayName: string;
    let photoUrl: string | undefined;
    
    if (item.type === 'direct' && item.participants.length > 0) {
      // Direct message - show the other participant's name
      const otherParticipant = item.participants[0];
      displayName = otherParticipant.display_name || `User ${otherParticipant.user_id.substring(0, 8)}`;
      photoUrl = otherParticipant.photo_url;
    } else if (item.type === 'group') {
      // Group chat - show number of participants and list names
      const participantNames = item.participants
        .slice(0, 3)
        .map(p => p.display_name || 'User')
        .join(', ');
      
      displayName = `Group (${item.participant_count}): ${participantNames}${item.participants.length > 3 ? '...' : ''}`;
    } else if (item.type === 'show') {
      // Show chat - show show name if available
      displayName = `Show Chat${item.show_id ? ` - ${item.show_id}` : ''}`;
    } else {
      // Fallback
      displayName = `Conversation ${item.id.substring(0, 8)}`;
    }
    
    // Determine if conversation has unread messages
    const hasUnread = item.unread_count > 0;
    
    return (
      <TouchableOpacity
        style={[styles.conversationItem, hasUnread && styles.unreadConversationItem]}
        onPress={() => handleConversationSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[
              styles.avatarPlaceholder,
              item.type !== 'direct' && styles.groupAvatarPlaceholder
            ]}>
              <Text style={styles.avatarText}>
                {item.type === 'direct' 
                  ? displayName.charAt(0).toUpperCase() 
                  : item.type === 'group' 
                    ? 'G'
                    : 'S'}
              </Text>
            </View>
          )}
          
          {/* Activity indicator dot for unread */}
          {hasUnread && (
            <View style={styles.activityIndicator} />
          )}
        </View>
        
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[
              styles.nameText, 
              hasUnread && styles.unreadName
            ]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[
              styles.timeText,
              hasUnread && styles.unreadTime
            ]}>
              {formatDate(item.last_message_timestamp)}
            </Text>
          </View>
          
          <View style={styles.previewRow}>
            <Text style={[
              styles.previewText,
              hasUnread && styles.unreadPreviewText
            ]} numberOfLines={1}>
              {item.last_message_text || 'No messages yet'}
            </Text>
            
            {item.unread_count > 0 && (
              <View style={[
                styles.unreadBadge,
                item.unread_count > 9 && styles.widerBadge,
                item.unread_count > 99 && styles.widestBadge
              ]}>
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
  
  // Render loading state
  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#FF6A00" />
      <Text style={styles.loadingText}>Loading conversations...</Text>
    </View>
  );
  
  // Render empty state
  const renderEmpty = () => (
    <View style={styles.centerContainer}>
      {searchQuery ? (
        // No search results
        <>
          <Ionicons name="search" size={60} color="#C7C7CC" />
          <Text style={styles.emptyText}>No matching conversations</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </>
      ) : (
        // No conversations
        <>
          <Ionicons name="chatbubbles-outline" size={60} color="#C7C7CC" />
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>
            Start a new conversation to begin messaging
          </Text>
          <TouchableOpacity style={styles.newChatButton} onPress={onNewConversation}>
            <Text style={styles.newChatButtonText}>Start New Conversation</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      
      {isLoading && conversations.length === 0 ? renderLoading() : (
        <>
          <FlatList
            data={sortedConversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              sortedConversations.length === 0 ? styles.emptyListContainer : styles.listContainer
            }
            refreshControl={
              <RefreshControl 
                refreshing={isLoading} 
                onRefresh={onRefresh}
                colors={['#FF6A00']}
                tintColor="#FF6A00"
              />
            }
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
          />
          
          <TouchableOpacity 
            style={styles.floatingButton}
            onPress={onNewConversation}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 80, // Space for floating button
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8E8E93',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginHorizontal: 20,
  },
  newChatButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FF6A00',
    borderRadius: 20,
  },
  newChatButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadConversationItem: {
    backgroundColor: '#FFF9F4', // Subtle tint for unread conversations
    borderLeftWidth: 3,
    borderLeftColor: '#FF6A00',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
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
    backgroundColor: '#0057B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarPlaceholder: {
    backgroundColor: '#FF6A00',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  activityIndicator: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF6A00',
    borderWidth: 2,
    borderColor: 'white',
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  unreadName: {
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  unreadTime: {
    color: '#FF6A00',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
    marginRight: 8,
  },
  unreadPreviewText: {
    color: '#333333',
    fontWeight: '500',
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
  widerBadge: {
    minWidth: 24,
  },
  widestBadge: {
    minWidth: 30,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  floatingButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6A00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default ChatList;
