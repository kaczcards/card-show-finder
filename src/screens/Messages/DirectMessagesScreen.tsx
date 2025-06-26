import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  FlatList,
  Alert,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '../../supabase';
import { Ionicons } from '@expo/vector-icons';
import * as messagingService from '../../services/messagingService';

// Function to generate a UUID without using crypto.randomUUID()
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Interface definitions
interface User {
  id: string;
  email?: string;
}

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

const DirectMessagesScreen: React.FC = () => {
  // State for user and UI
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any[]>([]);
  
  // State for messages
  const [conversations, setConversations] = useState<messagingService.Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<messagingService.Conversation | null>(null);
  const [messages, setMessages] = useState<messagingService.Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  
  // Add debug log
  const addDebugLog = (title: string, data: any) => {
    setDebugInfo(prev => [{ title, data, timestamp: new Date().toISOString() }, ...prev]);
    console.log(`[DEBUG] ${title}:`, data);
  };

  // Check user session on component mount
  useEffect(() => {
    checkSession();
    
    // Set up subscription for real-time messages
    const setupMessagesSubscription = async () => {
      const subscription = supabase
        .from('messages')
        .on('INSERT', (payload) => {
          const newMessage = payload.new;
          addDebugLog('New message received via subscription', { messageId: newMessage.id });
          
          // If message is for current conversation, add it to messages list
          if (selectedConversation && newMessage.conversation_id === selectedConversation.id) {
            setMessages(prev => [...prev, newMessage]);
            
            // Mark as read
            if (currentUser) {
              messagingService.markMessageAsRead(newMessage.id, currentUser.id);
            }
          }
          
          // Refresh conversations list to update unread counts and last messages
          if (currentUser) {
            fetchConversations(currentUser.id);
          }
        })
        .subscribe();
        
      return () => {
        supabase.removeSubscription(subscription);
      };
    };
    
    const subscription = setupMessagesSubscription();
    return () => {
      subscription.then(cleanup => cleanup());
    };
  }, []);

  // Reload conversations periodically when the screen is focused
  useEffect(() => {
    if (currentUser) {
      // Initial fetch
      fetchConversations(currentUser.id);
      
      // Set up periodic refresh every 10 seconds
      const refreshInterval = setInterval(() => {
        if (currentUser) {
          fetchConversations(currentUser.id);
        }
      }, 10000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [currentUser]);

  // Reload messages when selected conversation changes
  useEffect(() => {
    if (selectedConversation && currentUser) {
      fetchMessages(selectedConversation.id);
      messagingService.markConversationAsRead(selectedConversation.id, currentUser.id);
    }
  }, [selectedConversation]);

  // Get current Supabase session
  const checkSession = async () => {
    try {
      setIsLoading(true);
      addDebugLog('Checking session', 'Starting authentication check');
      
      // Check auth session
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        addDebugLog('Auth error', error.message);
        return;
      }

      if (data?.user) {
        setCurrentUser(data.user);
        addDebugLog('User authenticated', { 
          id: data.user.id,
          email: data.user.email
        });
        
        // Get user profile
        await fetchUserProfile(data.user.id);
        
        // Get conversations
        await fetchConversations(data.user.id);
      } else {
        addDebugLog('No authenticated user', null);
      }
    } catch (err) {
      addDebugLog('Session check error', String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user profile
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) {
        addDebugLog('Profile error', error.message);
      } else if (data) {
        setUserProfile(data);
        addDebugLog('Profile found', { 
          id: data.id, 
          username: data.username,
          role: data.role
        });
      }
    } catch (err) {
      addDebugLog('Profile fetch error', String(err));
    }
  };

  // Fetch user's conversations
  const fetchConversations = async (userId: string) => {
    try {
      addDebugLog('Fetching conversations', { userId });
      
      // Use our service to fetch conversations
      const conversationsData = await messagingService.getConversations(userId);
      
      setConversations(conversationsData);
      addDebugLog('Conversations fetched', { count: conversationsData.length });
      
      // If we're viewing a conversation, update its data
      if (selectedConversation) {
        const updatedConversation = conversationsData.find(c => c.id === selectedConversation.id);
        if (updatedConversation) {
          setSelectedConversation(updatedConversation);
        }
      }
    } catch (error) {
      addDebugLog('Fetch conversations error', String(error));
    }
  };

  // Fetch messages for a conversation
  const fetchMessages = async (conversationId: string) => {
    try {
      addDebugLog('Fetching messages', { conversationId });
      
      const messagesData = await messagingService.getMessages(conversationId);
      
      setMessages(messagesData);
      addDebugLog('Messages fetched', { count: messagesData.length });
    } catch (error) {
      addDebugLog('Messages error', String(error));
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!currentUser || !messageText.trim()) return;
    
    try {
      setIsSending(true);
      const trimmedMessage = messageText.trim();
      setMessageText('');
      
      if (selectedConversation) {
        // Send in existing conversation
        await messagingService.sendMessage(
          selectedConversation.id,
          currentUser.id,
          trimmedMessage
        );
        
        // Refresh messages
        fetchMessages(selectedConversation.id);
      } else if (recipientId.trim()) {
        // Create new conversation with the recipient
        const conversationId = await messagingService.createConversation(
          'direct',
          [currentUser.id, recipientId.trim()],
          trimmedMessage
        );
        
        // Refresh conversations and select the new one
        await fetchConversations(currentUser.id);
        const newConversation = conversations.find(c => c.id === conversationId);
        if (newConversation) {
          setSelectedConversation(newConversation);
          setShowNewConversation(false);
        }
      }
    } catch (error) {
      addDebugLog('Send message exception', String(error));
      Alert.alert('Error', 'Failed to send message: ' + String(error));
      // Restore message text if sending failed
      setMessageText(trimmedMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Render a conversation list item
  const renderConversationItem = ({ item }: { item: messagingService.Conversation }) => {
    // Get first participant for direct conversations
    const otherParticipant = item.participants && item.participants.length > 0 
      ? item.participants[0] 
      : null;
      
    // For group chats, show count instead
    const isGroupChat = item.type !== 'direct' || item.participant_count > 2;
    const displayName = isGroupChat 
      ? `Group (${item.participant_count})` 
      : otherParticipant?.display_name || `User ${otherParticipant?.user_id.substring(0, 8)}`;
      
    const photoUrl = !isGroupChat && otherParticipant?.photo_url;
    
    return (
      <TouchableOpacity 
        style={[
          styles.conversationItem,
          selectedConversation?.id === item.id && styles.selectedConversation
        ]}
        onPress={() => setSelectedConversation(item)}
      >
        <View style={styles.avatarContainer}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, isGroupChat && styles.groupAvatar]}>
              <Text style={styles.avatarText}>
                {isGroupChat ? `${item.participant_count}` : displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.participantName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.timestamp}>
              {formatDate(item.last_message_timestamp)}
            </Text>
          </View>
          
          <View style={styles.messagePreviewContainer}>
            <Text 
              style={[
                styles.messagePreview, 
                item.unread_count > 0 && styles.unreadPreview
              ]}
              numberOfLines={1}
            >
              {item.last_message_text || 'No messages yet'}
            </Text>
            
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render a message bubble
  const renderMessage = ({ item }: { item: messagingService.Message }) => {
    const isSentByMe = currentUser && item.sender_id === currentUser.id;
    const isRead = currentUser && item.read_by_user_ids && item.read_by_user_ids.some(
      id => id !== currentUser.id
    );
    
    return (
      <View style={[
        styles.messageRow,
        isSentByMe ? styles.sentMessageRow : styles.receivedMessageRow
      ]}>
        <View style={[
          styles.messageBubble,
          isSentByMe ? styles.sentBubble : styles.receivedBubble
        ]}>
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
            {formatDate(item.created_at)}
            {isSentByMe && isRead && ' • Read'}
          </Text>
        </View>
      </View>
    );
  };

  // Main render function
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {selectedConversation 
            ? selectedConversation.participants?.[0]?.display_name || 'Conversation' 
            : showNewConversation ? 'New Message' : 'Messages'}
        </Text>
        
        {(selectedConversation || showNewConversation) && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setSelectedConversation(null);
              setShowNewConversation(false);
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#0057B8" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={() => setShowDebug(!showDebug)}
        >
          <Ionicons name="bug" size={20} color="#999" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          TEST MODE: All messages visible to all roles
        </Text>
      </View>
      
      {!currentUser ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.noticeText}>Please sign in to use messages</Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={checkSession}
          >
            <Text style={styles.buttonText}>Check Session</Text>
          </TouchableOpacity>
        </View>
      ) : selectedConversation ? (
        // Message detail view
        <KeyboardAvoidingView 
          style={styles.flex} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            inverted={false}
            removeClippedSubviews={false}
          />
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!messageText.trim() || isSending) && styles.disabledButton
              ]}
              disabled={!messageText.trim() || isSending}
              onPress={sendMessage}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : showNewConversation ? (
        // New conversation form
        <KeyboardAvoidingView 
          style={styles.flex} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.newMessageForm}>
            <Text style={styles.formLabel}>Recipient ID</Text>
            <TextInput
              style={styles.recipientInput}
              placeholder="Enter user UUID"
              value={recipientId}
              onChangeText={setRecipientId}
            />
            
            <Text style={styles.formLabel}>Message</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Type your message here..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
            />
            
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!recipientId.trim() || !messageText.trim() || isSending) && styles.disabledButton
              ]}
              disabled={!recipientId.trim() || !messageText.trim() || isSending}
              onPress={sendMessage}
            >
              <Text style={styles.buttonText}>
                {isSending ? 'Sending...' : 'Send Message'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setRecipientId(currentUser.id);
              }}
            >
              <Text style={styles.buttonText}>Use Self ID (Test)</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        // Conversations list view
        <View style={styles.flex}>
          {isLoading ? (
            <View style={styles.centeredContainer}>
              <ActivityIndicator size="large" color="#0057B8" />
              <Text style={styles.loadingText}>Loading conversations...</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.centeredContainer}>
              <Text style={styles.noticeText}>No conversations yet</Text>
              <Text style={styles.subText}>
                Start a new conversation by pressing the + button
              </Text>
              
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 20 }]}
                onPress={() => setShowNewConversation(true)}
              >
                <Text style={styles.buttonText}>New Message</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={conversations}
              renderItem={renderConversationItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.conversationsList}
              refreshing={isLoading}
              onRefresh={() => currentUser && fetchConversations(currentUser.id)}
              removeClippedSubviews={false}
            />
          )}
          
          {!showNewConversation && (
            <TouchableOpacity
              style={styles.newConversationButton}
              onPress={() => setShowNewConversation(true)}
            >
              <Ionicons name="create" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {showDebug && (
        <View style={styles.debugPanel}>
          <View style={styles.debugHeader}>
            <Text style={styles.debugTitle}>Debug Info</Text>
            <TouchableOpacity onPress={() => setShowDebug(false)}>
              <Ionicons name="close" size={20} color="#333" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.debugInfo}>
            User: {currentUser ? currentUser.id : 'Not logged in'}
          </Text>
          <Text style={styles.debugInfo}>
            Role: {userProfile?.role || 'Unknown'}
          </Text>
          
          <ScrollView style={styles.debugScroll}>
            {debugInfo.map((log, index) => (
              <View key={index} style={styles.logItem}>
                <Text style={styles.logTitle}>
                  {log.title} - {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
                <Text style={styles.logData}>
                  {typeof log.data === 'object' 
                    ? JSON.stringify(log.data, null, 2) 
                    : String(log.data)
                  }
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      
      {isLoading && !selectedConversation && !showNewConversation && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0057B8" />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  debugButton: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
  },
  banner: {
    backgroundColor: '#FF9800',
    padding: 8,
  },
  bannerText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noticeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  
  // Conversations List
  conversationsList: {
    padding: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
  },
  selectedConversation: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0057B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatar: {
    backgroundColor: '#FF6A00',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
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
    color: '#666',
  },
  messagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messagePreview: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadPreview: {
    fontWeight: 'bold',
    color: '#000',
  },
  unreadBadge: {
    backgroundColor: '#FF6A00',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Messages List
  messagesList: {
    padding: 8,
    flexGrow: 1,
  },
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

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#FF6A00',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  
  // New Message Form
  newMessageForm: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFF',
  },
  formLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
  },
  recipientInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 150,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#0057B8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // New conversation floating button
  newConversationButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6A00',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },

  // Debug Panel
  debugPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
    height: 200,
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  debugTitle: {
    fontWeight: 'bold',
  },
  debugInfo: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
  },
  debugScroll: {
    flex: 1,
  },
  logItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  logTitle: {
    fontWeight: 'bold',
    fontSize: 11,
  },
  logData: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default DirectMessagesScreen;
