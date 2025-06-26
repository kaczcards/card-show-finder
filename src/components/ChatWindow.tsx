import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as messagingService from '../services/messagingService';
import { supabase } from '../supabase';

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
  onMessageSent?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  userId,
  recipientId,
  onBack,
  headerTitle = 'Chat',
  onMessageSent
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
    const subscription = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        const newMessage = payload.new as Message;
        
        // Add the new message to state
        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // Mark message as read if from another user
        if (newMessage.sender_id !== userId) {
          messagingService.markMessageAsRead(newMessage.id, userId);
        }
        
        // Scroll to bottom
        setTimeout(() => scrollToBottom(), 100);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [conversationId, userId]);
  
  // Fetch messages from the API
  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const fetchedMessages = await messagingService.getMessages(conversationId);
      setMessages(fetchedMessages);
      
      // Scroll to bottom after messages load
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Send a new message
  const handleSendMessage = async () => {
    if (!messageText.trim() || isSending) return;
    
    try {
      setIsSending(true);
      const trimmedMessage = messageText.trim();
      setMessageText('');
      Keyboard.dismiss();
      
      if (recipientId) {
        await messagingService.sendMessage(userId, recipientId, trimmedMessage, conversationId);
      } else {
        // If no explicit recipient ID provided, this is sending within an existing conversation
        const recipient = messages.find(m => m.sender_id !== userId)?.sender_id;
        if (!recipient) {
          throw new Error('No recipient found in this conversation');
        }
        await messagingService.sendMessage(userId, recipient, trimmedMessage, conversationId);
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
      setMessageText(trimmedMessage); // Restore the message if sending failed
      setError('Failed to send message. Please try again.');
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
          {!isSentByMe && (
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
          <Text style={[
            styles.messageTime,
            isSentByMe ? styles.sentMessageTime : styles.receivedMessageTime
          ]}>
            {formatTime(item.created_at)}
            {isSentByMe && hasRead && ' • Read'}
          </Text>
        </View>
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
      <TouchableOpacity style={styles.retryButton} onPress={fetchMessages}>
        <Text style={styles.retryText}>Retry</Text>
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
        <Text style={styles.headerTitle}>{headerTitle}</Text>
      </View>
      
      <View style={styles.messagesList}>
        {isLoading ? renderLoading() : (
          error ? renderError() : (
            messages.length === 0 ? renderEmpty() : (
              <FlatList
                ref={flatListRef}
                data={groupMessagesByDate()}
                keyExtractor={(item) => item.date}
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
              />
            )
          )
        )}
      </View>
      
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
    padding: 16,
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
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FF6A00',
    borderRadius: 8,
  },
  retryText: {
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
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 8,
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
    paddingVertical: 8,
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
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  sentMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedMessageTime: {
    color: '#8E8E93',
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
