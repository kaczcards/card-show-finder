import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image
} from 'react-native';
import { Conversation } from '../../../services/messagingService';

interface ChatItemProps {
  conversation: Conversation;
  onSelect: (conversation: Conversation) => void;
  isSelected?: boolean;
}

const ChatItem: React.FC<ChatItemProps> = ({
  conversation,
  onSelect,
  isSelected = false
}) => {
  // Get the other user's profile from the conversation
  const otherParticipant = conversation.participants && conversation.participants.length > 0 
    ? conversation.participants[0] 
    : null;
  
  // For group chats, show count instead
  const isGroupChat = conversation.type !== 'direct' || conversation.participant_count > 2;
  
  // Determine display name with fallbacks
  let displayName = '';
  if (isGroupChat) {
    displayName = `Group (${conversation.participant_count})`;
  } else if (otherParticipant?.display_name) {
    displayName = otherParticipant.display_name;
  } else {
    displayName = 'Unknown User';
  }
  
  const photoUrl = !isGroupChat && otherParticipant?.photo_url;
  
  // Decide if there are unread messages
  const hasUnread = conversation.unread_count > 0;
  
  // Format date helper function
  const formatLastActive = (dateString?: string): string => {
    if (!dateString) return '';
    
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
  const createMessagePreview = (text?: string): string => {
    if (!text) return 'No messages';
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  };

  return (
    <TouchableOpacity 
      style={[
        styles.chatItem,
        hasUnread && styles.unreadChatItem,
        isSelected && styles.selectedChatItem
      ]}
      onPress={() => onSelect(conversation)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}. ${
        hasUnread
          ? `${conversation.unread_count} unread ${conversation.unread_count === 1 ? 'message' : 'messages'}.`
          : 'No unread messages.'
      } Last active ${formatLastActive(conversation.last_message_timestamp)}.`}
      accessibilityHint="Double-tap to open the conversation."
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.avatarContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, isGroupChat && styles.groupAvatar]}>
            <Text style={styles.avatarFallbackText}>
              {isGroupChat ? `${conversation.participant_count}` : displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {hasUnread && (
          /* Decorative unread badge – hide from screen readers */
          <View
            style={styles.unreadIndicator}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          />
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
            {formatLastActive(conversation.last_message_timestamp)}
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
            {createMessagePreview(conversation.last_message_text)}
          </Text>
          
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  selectedChatItem: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
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
  groupAvatar: {
    backgroundColor: '#FF6A00',
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
});

export default ChatItem;
