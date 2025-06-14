// src/screens/ConversationDetailScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import {
  getMessages,
  sendMessage,
  subscribeToMessages,
  markMessagesAsRead,
  canSendMessages,
} from '../services/messagingService';

const ConversationDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser, userProfile } = useUser();
  const flatListRef = useRef(null);
  
  // Get conversation ID and other user info from route params
  const { conversationId, otherUser } = route.params || {};
  
  // State variables
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [canReply, setCanReply] = useState(false);
  const [error, setError] = useState(null);
  
  // Check if current user is a dealer or show organizer (MVP user)
  const isMvpUser = userProfile?.role === 'dealer' || userProfile?.role === 'showOrganizer';
  
  // Set navigation title
  useEffect(() => {
    navigation.setOptions({
      title: otherUser?.name || 'Conversation',
      headerRight: () => (
        <View style={styles.headerRight}>
          {otherUser?.role === 'dealer' && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>DEALER</Text>
            </View>
          )}
          {otherUser?.role === 'showOrganizer' && (
            <View style={[styles.roleBadge, styles.organizerBadge]}>
              <Text style={styles.roleBadgeText}>ORGANIZER</Text>
            </View>
          )}
        </View>
      ),
    });
  }, [navigation, otherUser]);
  
  // Format timestamp to readable time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = messageDate.toDateString() === today.toDateString();
    const isYesterday = messageDate.toDateString() === yesterday.toDateString();
    
    const timeString = messageDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (isToday) return timeString;
    if (isYesterday) return `Yesterday, ${timeString}`;
    
    return `${messageDate.toLocaleDateString()} ${timeString}`;
  };
  
  // Load initial messages and check permissions
  useEffect(() => {
    const loadInitialData = async () => {
      if (!conversationId || !currentUser) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Get message history
        const { messages: messageHistory, error: messagesError } = await getMessages(conversationId);
        
        if (messagesError) {
          setError(`Failed to load messages: ${messagesError}`);
          return;
        }
        
        setMessages(messageHistory);
        
        // Check if user can reply (based on role)
        const { canSend, error: permissionError } = await canSendMessages(currentUser.uid);
        
        if (permissionError) {
          console.error('Error checking message permissions:', permissionError);
        } else {
          setCanReply(canSend);
        }
        
        // Mark messages as read
        await markMessagesAsRead(conversationId, currentUser.uid);
        
      } catch (err) {
        console.error('Error loading conversation:', err);
        setError('Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [conversationId, currentUser]);
  
  // Subscribe to real-time message updates
  useEffect(() => {
    if (!conversationId) return;
    
    // Set up subscription to new messages
    const unsubscribe = subscribeToMessages(conversationId, (updatedMessages) => {
      setMessages(updatedMessages);
      
      // Mark messages as read when received
      if (currentUser) {
        markMessagesAsRead(conversationId, currentUser.uid).catch((err) => {
          console.error('Error marking messages as read:', err);
        });
      }
    });
    
    // Clean up subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [conversationId, currentUser]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);
  
  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !conversationId || !currentUser) return;
    
    // Check if user is attendee and this is not their first message
    if (!isMvpUser && messages.length > 0) {
      const userMessages = messages.filter(msg => msg.senderId === currentUser.uid);
      if (userMessages.length > 0) {
        Alert.alert(
          'MVP Feature Required',
          'Only dealers and show organizers can send follow-up messages. Would you like to upgrade your account?',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Learn More', onPress: () => navigation.navigate('Profile') }
          ]
        );
        return;
      }
    }
    
    try {
      setSending(true);
      
      const { success, error: sendError } = await sendMessage(
        conversationId,
        currentUser.uid,
        messageText
      );
      
      if (!success) {
        Alert.alert('Error', sendError || 'Failed to send message');
        return;
      }
      
      // Clear input
      setMessageText('');
      
    } catch (err) {
      console.error('Error sending message:', err);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };
  
  // Render message item
  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === currentUser?.uid;
    
    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.sentMessageContainer : styles.receivedMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isCurrentUser ? styles.sentMessageBubble : styles.receivedMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isCurrentUser ? styles.sentMessageText : styles.receivedMessageText
          ]}>
            {item.text}
          </Text>
        </View>
        
        <View style={[
          styles.messageFooter,
          isCurrentUser ? styles.sentMessageFooter : styles.receivedMessageFooter
        ]}>
          <Text style={styles.messageTime}>
            {formatTime(item.timestamp)}
          </Text>
          
          {isCurrentUser && (
            <View style={styles.messageStatus}>
              {item.read ? (
                <Ionicons name="checkmark-done" size={14} color="#3498db" />
              ) : (
                <Ionicons name="checkmark" size={14} color="#adb5bd" />
              )}
            </View>
          )}
        </View>
      </View>
    );
  };
  
  // Render date separator
  const renderDateSeparator = (date) => {
    return (
      <View style={styles.dateSeparator}>
        <View style={styles.dateSeparatorLine} />
        <Text style={styles.dateSeparatorText}>{date}</Text>
        <View style={styles.dateSeparatorLine} />
      </View>
    );
  };
  
  // Process messages to add date separators
  const processedMessages = () => {
    if (!messages.length) return [];
    
    const result = [];
    let currentDate = null;
    
    messages.forEach((message) => {
      if (!message.timestamp) return;
      
      const messageDate = new Date(message.timestamp);
      const dateString = messageDate.toDateString();
      
      if (dateString !== currentDate) {
        currentDate = dateString;
        result.push({
          id: `date-${dateString}`,
          type: 'date',
          date: messageDate.toLocaleDateString(undefined, { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })
        });
      }
      
      result.push({
        ...message,
        type: 'message'
      });
    });
    
    return result;
  };
  
  // Render item based on type (message or date separator)
  const renderItem = ({ item }) => {
    if (item.type === 'date') {
      return renderDateSeparator(item.date);
    }
    return renderMessage({ item });
  };
  
  // Empty conversation state
  const renderEmptyComponent = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={60} color="#adb5bd" />
        <Text style={styles.emptyTitle}>No Messages Yet</Text>
        <Text style={styles.emptySubtitle}>
          Start the conversation by sending a message below
        </Text>
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={processedMessages()}
        renderItem={renderItem}
        keyExtractor={(item) => item.id || `${item.timestamp}-${item.senderId}`}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={renderEmptyComponent}
        onContentSizeChange={() => {
          if (flatListRef.current && messages.length > 0) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }}
      />
      
      {/* Message input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={
            canReply || messages.length === 0 || isMvpUser
              ? "Type a message..."
              : "Upgrade to MVP to reply"
          }
          value={messageText}
          onChangeText={setMessageText}
          multiline
          editable={canReply || messages.length === 0 || isMvpUser}
        />
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!messageText.trim() || sending) && styles.disabledSendButton
          ]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      
      {/* MVP upgrade prompt for attendees */}
      {!isMvpUser && messages.length > 0 && (
        <View style={styles.mvpPrompt}>
          <Ionicons name="star" size={16} color="#f39c12" />
          <Text style={styles.mvpPromptText}>
            Upgrade to MVP Dealer to continue this conversation
          </Text>
          <TouchableOpacity
            style={styles.mvpPromptButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.mvpPromptButtonText}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  roleBadge: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  organizerBadge: {
    backgroundColor: '#9b59b6',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  messagesList: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  sentMessageContainer: {
    alignSelf: 'flex-end',
  },
  receivedMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sentMessageBubble: {
    backgroundColor: '#3498db',
    borderBottomRightRadius: 4,
  },
  receivedMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  sentMessageText: {
    color: '#fff',
  },
  receivedMessageText: {
    color: '#212529',
  },
  messageFooter: {
    flexDirection: 'row',
    marginTop: 4,
  },
  sentMessageFooter: {
    justifyContent: 'flex-end',
  },
  receivedMessageFooter: {
    justifyContent: 'flex-start',
  },
  messageTime: {
    fontSize: 12,
    color: '#6c757d',
    marginRight: 4,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e9ecef',
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#6c757d',
    marginHorizontal: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f3f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#3498db',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledSendButton: {
    backgroundColor: '#bdc3c7',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
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
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  errorBanner: {
    padding: 12,
    backgroundColor: '#fee2e2',
    borderBottomWidth: 1,
    borderBottomColor: '#fca5a5',
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
  },
  mvpPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff8e1',
    borderTopWidth: 1,
    borderTopColor: '#ffe082',
  },
  mvpPromptText: {
    flex: 1,
    color: '#f39c12',
    marginLeft: 8,
    fontSize: 14,
  },
  mvpPromptButton: {
    backgroundColor: '#f39c12',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  mvpPromptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default ConversationDetailScreen;
