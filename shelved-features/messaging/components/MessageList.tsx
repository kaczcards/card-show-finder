import React from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Image,
  ActivityIndicator 
} from 'react-native';
import { Conversation } from '../services/messagingService';

// Helper function to format date
const formatMessageDate = (dateString: string): string => {
  const messageDate = new Date(dateString);
  const now = new Date();
  
  // If message is from today, show time only
  if (messageDate.toDateString() === now.toDateString()) {
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // If message is from this year, show month and day
  if (messageDate.getFullYear() === now.getFullYear()) {
    return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  
  // Otherwise show full date
  return messageDate.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

interface MessageListProps {
  conversations: Conversation[];
  isLoading: boolean;
  onSelectConversation: (conversation: Conversation) => void;
}

const MessageList: React.FC<MessageListProps> = ({ 
  conversations, 
  isLoading, 
  onSelectConversation 
}) => {
  // Render each conversation item
  const renderItem = ({ item }: { item: Conversation }) => {
    const participant = item.participant_profile;
    const displayName = participant?.full_name || participant?.username || 'Unknown User';
    const lastMessage = item.last_message;
    const messagePreview = lastMessage?.content || 'No messages';
    const timestamp = lastMessage?.created_at ? formatMessageDate(lastMessage.created_at) : '';
    
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => onSelectConversation(item)}
      >
        <View style={styles.avatarContainer}>
          {participant?.avatar_url ? (
            <Image 
              source={{ uri: participant.avatar_url }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.participantName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.timestamp}>
              {timestamp}
            </Text>
          </View>
          
          <View style={styles.messageRow}>
            <Text 
              style={[
                styles.messagePreview, 
                item.unread_count > 0 && styles.unreadMessage
              ]} 
              numberOfLines={1}
            >
              {messagePreview}
            </Text>
            
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Empty state when no conversations exist
  const renderEmptyComponent = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.emptyText}>Loading conversations...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>
          When you start conversations with dealers or show organizers, they'll appear here.
        </Text>
      </View>
    );
  };

  return (
    <FlatList
      data={conversations}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      removeClippedSubviews={false}
      ListEmptyComponent={renderEmptyComponent}
      contentContainerStyle={conversations.length === 0 ? styles.listEmptyContent : styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 8,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: 'white',
  },
  avatarContainer: {
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
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreview: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  unreadMessage: {
    fontWeight: 'bold',
    color: '#000000',
  },
  unreadBadge: {
    backgroundColor: '#FF6A00',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 8,
    color: '#333333',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

export default MessageList;
