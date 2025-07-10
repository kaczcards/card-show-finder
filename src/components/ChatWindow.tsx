import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
  Alert,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as messagingService from '../services/messagingService';
import { supabase } from '../supabase';
import * as Haptics from 'expo-haptics';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
  read_by_user_ids: string[];
  sender_profile?: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

interface ChatWindowProps {
  conversationId: string;
  userId: string;
  recipientId?: string;
  onBack?: () => void;
  headerTitle?: string;
  conversationType?: 'direct' | 'group' | 'show';
  onMessageSent?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  userId,
  recipientId,
  onBack,
  headerTitle = 'Chat',
  conversationType = 'direct',
  onMessageSent
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false); // For pull-to-refresh
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedMessages, setFailedMessages] = useState<{ text: string, retries: number }[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  
  // Animation for new message notification
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  
  // Fetch messages when component mounts or conversation changes
  useEffect(() => {
    fetchMessages();
    
    // Mark messages as read when opening conversation
    const markAsRead = async () => {
      try {
        await messagingService.markConversationAsRead(conversationId, userId);
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };
    
    markAsRead();
    
    // Set up real-time subscription for new messages
    const subscription = messagingService.subscribeToMessages(
      conversationId,
      handleNewMessage
    );
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [conversationId, userId]);
  
  // Handle new incoming message from subscription
  const handleNewMessage = useCallback((newMessage: Message) => {
    setMessages(prevMessages => {
      // Check if message already exists (prevent duplicates)
      const exists = prevMessages.some(m => m.id === newMessage.id);
      if (exists) return prevMessages;
      
      const updatedMessages = [...prevMessages, newMessage];
      
      // If the new message is from someone else
      if (newMessage.sender_id !== userId) {
        // Mark it as read
        messagingService.markMessageAsRead(newMessage.id, userId);
        
        // Trigger haptic feedback
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
      
      // Check if we're scrolled near the bottom to determine auto-scrolling
      if (isNearBottom()) {
        // Delay scrolling to ensure the new message is rendered
        setTimeout(() => scrollToBottom(), 100);
      } else {
        // Show new message notification
        setNewMessageCount(prev => prev + 1);
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.7,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
      
      return updatedMessages;
    });
  }, [userId]);
  
  // Check if we're near the bottom of the message list
  const isNearBottom = () => {
    // Logic to determine if we're near the bottom
    // This is a placeholder - in a real implementation you'd check the scroll position
    return true;
  };
  
  // Fetch messages from the API
  const fetchMessages = async (isFetchingMore = false) => {
    try {
      if (!isFetchingMore) {
        setIsLoading(true);
      } else {
        setIsFetching(true);
      }
      setError(null);
      
      const fetchedMessages = await messagingService.getMessages(conversationId);
      setMessages(fetchedMessages);
      
      // Mark messages as read
      if (fetchedMessages.length > 0) {
        await messagingService.markConversationAsRead(conversationId, userId);
      }
      
      // Scroll to bottom after messages load
      setTimeout(() => scrollToBottom(), 100);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      setError(`Failed to load messages: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  };
  
  // Send a new message
  const handleSendMessage = async () => {
    if (!messageText.trim() || isSending) return;
    
    // Store message text before clearing input
    const trimmedMessage = messageText.trim();
    setMessageText('');
    
    // Clear new message badge when sending a message
    setNewMessageCount(0);
    
    // Hide keyboard after sending
    Keyboard.dismiss();
    
    try {
      setIsSending(true);
      
      if (conversationType === 'direct' && recipientId) {
        // Direct message
        await messagingService.sendMessage(userId, recipientId, trimmedMessage, conversationId);
      } else {
        // Group/show message
        await messagingService.sendGroupMessage(userId, conversationId, trimmedMessage);
      }
      
      // Notify parent component that a message was sent
      if (onMessageSent) {
        onMessageSent();
      }
      
      // Don't need to update messages manually, the subscription will handle it
      
      // Focus the input again
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add to failed messages queue
      setFailedMessages(prev => [...prev, { text: trimmedMessage, retries: 0 }]);
      
      // Show error toast
      Alert.alert(
        'Failed to Send',
        'Your message was not sent. Tap "Retry" in the failed messages section to try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSending(false);
    }
  };
  
  // Retry sending a failed message
  const handleRetryMessage = async (index: number) => {
    const failedMessage = failedMessages[index];
    
    // Remove from failed messages
    setFailedMessages(prev => prev.filter((_, i) => i !== index));
    
    try {
      if (conversationType === 'direct' && recipientId) {
        // Direct message
        await messagingService.sendMessage(userId, recipientId, failedMessage.text, conversationId);
      } else {
        // Group/show message
        await messagingService.sendGroupMessage(userId, conversationId, failedMessage.text);
      }
      
      // Notify parent component that a message was sent
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      console.error('Error retrying message:', error);
      
      // Increment retry count and add back to queue
      const newRetryCount = failedMessage.retries + 1;
      
      if (newRetryCount >= 3) {
        Alert.alert(
          'Send Failed',
          'We could not send your message after multiple attempts. Please check your connection and try again later.',
          [{ text: 'OK' }]
        );
      } else {
        setFailedMessages(prev => [...prev, { text: failedMessage.text, retries: newRetryCount }]);
        Alert.alert(
          'Retry Failed',
          'Your message could not be sent. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    }
  };
  
  // Scroll to the bottom of the message list
  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
      setShowScrollButton(false);
      setNewMessageCount(0);
    }
  };
  
  // Handle scroll events
  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    setShowScrollButton(!isCloseToBottom);
    
    if (isCloseToBottom) {
      setNewMessageCount(0);
    }
  };
  
  // Format date for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Group messages by date for display
  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const date = new Date(message.created_at).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return Object.entries(groups).map(([date, messages]) => ({ date, messages }));
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
      displayDate = messageDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
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
    const isSentByMe = item.sender_id === userId;
    const hasRead = item.read_by_user_ids?.some(id => id !== userId) || false;
    
    return (
      <View style={[
        styles.messageRow,
        isSentByMe ? styles.sentMessageRow : styles.receivedMessageRow
      ]}>
        {!isSentByMe && item.sender_profile?.avatar_url && (
          <Image 
            source={{ uri: item.sender_profile.avatar_url }}
            style={styles.avatar}
          />
        )}
        
        {!isSentByMe && !item.sender_profile?.avatar_url && (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {(item.sender_profile?.full_name?.[0] || 
                item.sender_profile?.username?.[0] || 
                'U').toUpperCase()}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isSentByMe ? styles.sentBubble : styles.receivedBubble
        ]}>
          {!isSentByMe && conversationType !== 'direct' && (
            <Text style={styles.senderName}>
              {item.sender_profile?.full_name || 
               item.sender_profile?.username || 
               'User'}
            </Text>
          )}
          <Text style={[
            styles.messageText,
            isSentByMe ? styles.sentMessageText : styles.receivedMessageText
          ]}>
            {item.message_text}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isSentByMe ? styles.sentMessageTime : styles.receivedMessageTime
            ]}>
              {formatTime(item.created_at)}
            </Text>
            {isSentByMe && (
              hasRead ? (
                <Ionicons name="checkmark-done" size={14} color="#4CAF50" style={styles.readIcon} />
              ) : (
                <Ionicons name="checkmark" size={14} color="#8E8E93" style={styles.readIcon} />
              )
            )}
          </View>
        </View>
      </View>
    );
  };
  
  // Render failed messages
  const renderFailedMessages = () => {
    if (failedMessages.length === 0) return null;
    
    return (
      <View style={styles.failedMessagesContainer}>
        <Text style={styles.failedMessagesTitle}>Failed Messages</Text>
        {failedMessages.map((message, index) => (
          <View key={index} style={styles.failedMessageRow}>
            <View style={styles.failedMessageBubble}>
              <Text style={styles.failedMessageText}>
                {message.text.length > 30 ? message.text.substring(0, 30) + '...' : message.text}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => handleRetryMessage(index)}
            >
              <Text style={styles.retryText}>Retry</Text>
              <Ionicons name="refresh" size={14} color="#FF6A00" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };
  
  // Render loading state
  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#FF6A00" />
      <Text style={styles.loadingText}>Loading messages...</Text>
    </View>
  );
  
  // Render error state
  const renderError = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="alert-circle" size={40} color="#FF3B30" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryLoadButton} onPress={fetchMessages}>
        <Text style={styles.retryLoadText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render empty state
  const renderEmpty = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="chatbubble-outline" size={60} color="#C7C7CC" />
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
    </View>
  );
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#0057B8" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
      </View>
      
      <View style={styles.messagesList}>
        {isLoading ? renderLoading() : (
          error ? renderError() : (
            messages.length === 0 ? renderEmpty() : (
              <FlatList
                ref={flatListRef}
                data={groupMessagesByDate()}
                keyExtractor={(item) => item.date}
                removeClippedSubviews={false}
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
                onContentSizeChange={scrollToBottom}
                onLayout={scrollToBottom}
                onScroll={handleScroll}
                scrollEventThrottle={400}
              />
            )
          )
        )}
        
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Animated.View 
            style={[
              styles.scrollToBottomButton,
              { opacity: fadeAnim }
            ]}
          >
            <TouchableOpacity
              style={styles.scrollToBottomButtonInner}
              onPress={scrollToBottom}
            >
              <Ionicons name="arrow-down" size={20} color="white" />
              {newMessageCount > 0 && (
                <View style={styles.newMessageBadge}>
                  <Text style={styles.newMessageCount}>
                    {newMessageCount > 99 ? '99+' : newMessageCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
      
      {/* Failed messages section */}
      {renderFailedMessages()}
      
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!messageText.trim() || isSending) && styles.disabledButton
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // To center the text properly when back button is present
  },
  messagesList: {
    flex: 1,
    position: 'relative',
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
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryLoadButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FF6A00',
    borderRadius: 8,
  },
  retryLoadText: {
    color: 'white',
    fontWeight: 'bold',
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
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 14,
    color: '#8E8E93',
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  sentMessageRow: {
    justifyContent: 'flex-end',
  },
  receivedMessageRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 18, // Adjust to align with the bottom of the message
  },
  avatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 18, // Adjust to align with the bottom of the message
    backgroundColor: '#0057B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
  },
  sentBubble: {
    backgroundColor: '#FF6A00',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  senderName: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#0057B8',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  sentMessageText: {
    color: 'white',
  },
  receivedMessageText: {
    color: '#000000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  messageTime: {
    fontSize: 12,
  },
  sentMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedMessageTime: {
    color: '#8E8E93',
  },
  readIcon: {
    marginLeft: 4,
  },
  failedMessagesContainer: {
    backgroundColor: '#FFF0F0',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFD0D0',
  },
  failedMessagesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 8,
  },
  failedMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  failedMessageBubble: {
    flex: 1,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  failedMessageText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF6A00',
  },
  retryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF6A00',
    marginRight: 4,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 10,
  },
  scrollToBottomButtonInner: {
    backgroundColor: '#0057B8',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  newMessageBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'white',
  },
  newMessageCount: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 40,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6A00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
});

export default ChatWindow;
