import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  SafeAreaView
} from 'react-native';
import { Message, getMessages, sendMessage, markMessagesAsRead } from '../services/messagingService';
import { Ionicons } from '@expo/vector-icons';

interface MessageDetailProps {
  conversationId: string;
  userId: string;
  recipientId: string;
  recipientName?: string;
  recipientAvatar?: string;
  onMessageSent?: () => void;
}

// Helper function to format message time
const formatMessageTime = (dateString: string): string => {
  const messageDate = new Date(dateString);
  return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Helper to group messages by date
const groupMessagesByDate = (messages: Message[]): { date: string; messages: Message[] }[] => {
  const groups: { [key: string]: Message[] } = {};
  
  messages.forEach(message => {
    const date = new Date(message.created_at).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });
  
  return Object.keys(groups).map(date => ({
    date,
    messages: groups[date]
  }));
};

const MessageDetail: React.FC<MessageDetailProps> = ({
  conversationId,
  userId,
  recipientId,
  recipientName = 'User',
  recipientAvatar,
  onMessageSent
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Fetch messages when the component mounts or conversation changes
  useEffect(() => {
    fetchMessages();
    
    // Set up real-time subscription for new messages
    const setupSubscription = async () => {
      const subscription = supabase
        .from('messages')
        .on('INSERT', (payload) => {
          if (payload.new.conversation_id === conversationId) {
            // Add the new message to the state
            setMessages(prevMessages => [...prevMessages, payload.new]);
            // Mark as read if the user is the recipient
            if (payload.new.recipient_id === userId) {
              markMessagesAsRead(conversationId, userId);
            }
            // Scroll to bottom
            scrollToBottom();
          }
        })
        .subscribe();
      
      // Return cleanup function
      return () => {
        supabase.removeSubscription(subscription);
      };
    };
    
    const subscription = setupSubscription();
    
    // Cleanup subscription on unmount
    return () => {
      subscription.then(cleanup => cleanup());
    };
  }, [conversationId, userId]);

  // Mark messages as read when viewing the conversation
  useEffect(() => {
    if (messages.length > 0) {
      markMessagesAsRead(conversationId, userId);
    }
  }, [messages, conversationId, userId]);

  // Fetch messages from the API
  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedMessages = await getMessages(conversationId, userId);
      setMessages(fetchedMessages);
      
      // Mark messages as read
      if (fetchedMessages.length > 0) {
        await markMessagesAsRead(conversationId, userId);
      }
      
      // Scroll to bottom after messages load
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  // Send a new message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      setIsSending(true);
      const trimmedMessage = messageText.trim();
      setMessageText('');
      
      await sendMessage(userId, recipientId, trimmedMessage, conversationId);
      
      // Notify parent component that a message was sent (for updating lists)
      if (onMessageSent) {
        onMessageSent();
      }
      
      // Focus the input again
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      // Restore the message text if sending failed
      setMessageText(messageText);
    } finally {
      setIsSending(false);
    }
  };

  // Scroll to the bottom of the message list
  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  // Render a date separator
  const renderDateSeparator = (date: string) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let displayDate;
    if (messageDate.toDateString() === today.toDateString()) {
      displayDate = 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      displayDate = 'Yesterday';
    } else {
      displayDate = messageDate.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    return (
      <View style={styles.dateSeparator}>
        <Text style={styles.dateSeparatorText}>{displayDate}</Text>
      </View>
    );
  };

  // Render a message bubble
  const renderMessage = ({ item }: { item: Message }) => {
    const isUserMessage = item.sender_id === userId;
    
    return (
      <View style={[
        styles.messageContainer,
        isUserMessage ? styles.userMessageContainer : styles.otherMessageContainer
      ]}>
        {!isUserMessage && (
          <View style={styles.avatarContainer}>
            {recipientAvatar ? (
              <Image source={{ uri: recipientAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{recipientName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isUserMessage ? styles.userMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isUserMessage ? styles.userMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isUserMessage ? styles.userMessageTime : styles.otherMessageTime
          ]}>
            {formatMessageTime(item.created_at)}
            {isUserMessage && item.read_at && (
              <Text style={styles.readReceipt}> • Read</Text>
            )}
          </Text>
        </View>
        
        {isUserMessage && (
          <View style={styles.avatarContainer}>
            {/* Empty view for alignment */}
          </View>
        )}
      </View>
    );
  };

  // Render the list of messages grouped by date
  const renderMessageList = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchMessages}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    if (messages.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Send a message to start the conversation
          </Text>
        </View>
      );
    }
    
    const groupedMessages = groupMessagesByDate(messages);
    
    return (
      <FlatList
        ref={flatListRef}
        data={groupedMessages}
        keyExtractor={(item) = removeClippedSubviews={false}> item.date}
        renderItem={({ item }) => (
          <View>
            {renderDateSeparator(item.date)}
            {item.messages.map((message) => (
              <View key={message.id}>
                {renderMessage({ item: message })}
              </View>
            ))}
          </View>
        )}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={scrollToBottom}
        onLayout={scrollToBottom}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.messagesContainer}>
          {renderMessageList()}
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
            returnKeyType="default"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || isSending) && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  messageListContent: {
    paddingVertical: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    marginHorizontal: 8,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0057B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 2,
  },
  userMessageBubble: {
    backgroundColor: '#FF6A00',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  userMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#999999',
  },
  readReceipt: {
    fontSize: 10,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#666666',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: 'white',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6A00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FF6A00',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default MessageDetail;
