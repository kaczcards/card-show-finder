import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../../../services/messagingService';

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  showTimestamp?: boolean;
  isOptimistic?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isCurrentUser,
  showTimestamp = true,
  isOptimistic = false
}) => {
  // Format date helper function
  const formatTime = (dateString?: string): string => {
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
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Otherwise, show the date and time
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric' 
    }) + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Check if message has been read by someone else
  const isRead = message.read_by_user_ids && message.read_by_user_ids.some(
    id => id !== message.sender_id
  );

  return (
    <View style={[
      styles.messageRow,
      isCurrentUser ? styles.sentMessageRow : styles.receivedMessageRow
    ]}>
      <View style={[
        styles.messageBubble,
        isCurrentUser ? styles.sentBubble : styles.receivedBubble,
        isOptimistic && styles.optimisticBubble
      ]}>
        <Text style={[
          styles.messageText,
          isCurrentUser ? styles.sentMessageText : styles.receivedMessageText
        ]}>
          {message.message_text}
        </Text>
        
        {showTimestamp && (
          <Text style={[
            styles.messageTime,
            isCurrentUser ? styles.sentMessageTime : styles.receivedMessageTime
          ]}>
            {formatTime(message.created_at)}
            {isCurrentUser && isRead && ' • Read'}
            {isOptimistic && ' • Sending...'}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  sentMessageRow: {
    justifyContent: 'flex-end',
  },
  receivedMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  sentBubble: {
    backgroundColor: '#FF6A00',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  optimisticBubble: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  sentMessageText: {
    color: '#FFFFFF',
  },
  receivedMessageText: {
    color: '#000000',
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  sentMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedMessageTime: {
    color: '#999',
  },
});

export default MessageBubble;
