import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import ChatList, { Conversation } from '../../components/ChatList';
import ChatWindow from '../../components/ChatWindow';
import * as messagingService from '../../services/messagingService';
import * as userRoleService from '../../services/userRoleService';
import { UserRole } from '../../services/userRoleService';

const MessagesScreen: React.FC = ({ route }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const initialConversationId = route?.params?.conversationId;
  
  // Animation for banner
  const bannerHeight = useRef(new Animated.Value(0)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newConversationVisible, setNewConversationVisible] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  
  // Handle direct navigation to a conversation
  useEffect(() => {
    if (initialConversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === initialConversationId);
      if (conversation) {
        setSelectedConversation(conversation);
      }
    }
  }, [initialConversationId, conversations]);
  
  // Update navigation bar badge when unread count changes
  useEffect(() => {
    if (totalUnreadCount > 0) {
      navigation.setOptions({
        tabBarBadge: totalUnreadCount > 99 ? '99+' : totalUnreadCount
      });
    } else {
      navigation.setOptions({
        tabBarBadge: undefined
      });
    }
  }, [totalUnreadCount]);
  
  // Fetch conversations when screen focuses
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchConversations();
        fetchTotalUnreadCount();
      } else {
        setIsLoading(false);
        setConversations([]);
      }
    }, [user])
  );
  
  // Set up real-time subscription for new messages and conversations
  useEffect(() => {
    if (!user) return;
    
    // Subscribe to messages for all conversations
    const messagesSubscription = supabase
      .channel('messages_updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}` // Only messages where user is recipient
      }, () => {
        // Refresh conversations on any new message
        fetchConversations();
        fetchTotalUnreadCount();
      })
      .subscribe();
    
    // Subscribe to conversation updates
    const conversationsSubscription = supabase
      .channel('conversations_updates')
      .on('postgres_changes', {
        event: '*', // ALL, INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${user.id}` // Only user's conversations
      }, () => {
        // Refresh conversations on any change
        fetchConversations();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(messagesSubscription);
      supabase.removeChannel(conversationsSubscription);
    };
  }, [user]);
  
  // Fetch conversations from API
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const fetchedConversations = await messagingService.getConversations(user.id);
      
      setConversations(fetchedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      showTemporaryBanner('Failed to load conversations. Pull down to retry.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);
  
  // Fetch total unread message count
  const fetchTotalUnreadCount = async () => {
    if (!user) return;
    
    try {
      const count = await messagingService.getTotalUnreadCount(user.id);
      setTotalUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };
  
  // Show temporary error/success banner
  const showTemporaryBanner = (message: string, duration = 3000) => {
    setShowBanner(true);
    setBannerMessage(message);
    
    // Animate banner in
    Animated.parallel([
      Animated.timing(bannerHeight, {
        toValue: 40,
        duration: 300,
        useNativeDriver: false
      }),
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false
      })
    ]).start();
    
    // Hide after duration
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(bannerHeight, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false
        }),
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false
        })
      ]).start(() => {
        setShowBanner(false);
      });
    }, duration);
  };
  
  // Start a new conversation
  const handleStartConversation = async () => {
    if (!user || !recipientId.trim() || !initialMessage.trim()) {
      return;
    }
    
    try {
      setSending(true);
      
      // Check if recipient exists and can receive messages
      const recipientRole = await userRoleService.getUserRole(recipientId);
      
      if (!recipientRole) {
        Alert.alert('Error', 'User not found. Please check the recipient ID.');
        return;
      }
      
      if (!userRoleService.IS_TEST_MODE && !userRoleService.canUserReceiveMessage(recipientRole)) {
        Alert.alert(
          'Cannot Send Message',
          'This user cannot receive messages due to their role. Only MVP dealers and show organizers can receive messages.'
        );
        return;
      }
      
      // Create a new conversation and send the message
      const conversationId = await messagingService.startConversationFromProfile(
        user.id,
        recipientId,
        initialMessage.trim()
      );
      
      // Close modal and reset fields
      setNewConversationVisible(false);
      setRecipientId('');
      setInitialMessage('');
      
      // Refresh conversations list
      await fetchConversations();
      
      // Find and select the new conversation
      const newConversation = conversations.find(c => c.id === conversationId);
      if (newConversation) {
        setSelectedConversation(newConversation);
      }
      
      showTemporaryBanner('Conversation started successfully!');
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    } finally {
      setSending(false);
    }
  };
  
  // Handle message sent callback
  const handleMessageSent = () => {
    // Refresh conversations to update last message info
    fetchConversations();
  };
  
  // Reset current conversation view
  const handleBackToList = () => {
    setSelectedConversation(null);
  };
  
  // Render new conversation modal
  const renderNewConversationModal = () => (
    <Modal
      visible={newConversationVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setNewConversationVisible(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Conversation</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setNewConversationVisible(false)}
            >
              <Ionicons name="close" size={24} color="#0057B8" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalScrollContent}>
            <Text style={styles.inputLabel}>Recipient ID (UUID)</Text>
            <TextInput
              style={styles.input}
              value={recipientId}
              onChangeText={setRecipientId}
              placeholder="Enter user ID"
            />
            
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={initialMessage}
              onChangeText={setInitialMessage}
              placeholder="Type your message here..."
              multiline
              maxLength={1000}
            />
            
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!recipientId.trim() || !initialMessage.trim() || sending) && styles.disabledButton
              ]}
              onPress={handleStartConversation}
              disabled={!recipientId.trim() || !initialMessage.trim() || sending}
            >
              <Text style={styles.sendButtonText}>
                {sending ? 'Starting Conversation...' : 'Start Conversation'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.selfTestButton}
              onPress={() => {
                setRecipientId(user?.id || '');
                setInitialMessage(`Test message sent at ${new Date().toLocaleTimeString()}`);
              }}
            >
              <Text style={styles.selfTestButtonText}>Use Self ID (Test)</Text>
            </TouchableOpacity>
            
            <Text style={styles.testModeIndicator}>
              {userRoleService.IS_TEST_MODE ? 'Test Mode: ON (Role checks bypassed)' : 'Test Mode: OFF (Role checks active)'}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
  
  // Render temporary banner
  const renderBanner = () => {
    if (!showBanner) return null;
    
    return (
      <Animated.View style={[
        styles.banner,
        { height: bannerHeight, opacity: bannerOpacity }
      ]}>
        <Text style={styles.bannerText}>{bannerMessage}</Text>
      </Animated.View>
    );
  };
  
  // If no user is logged in
  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-closed-outline" size={60} color="#C7C7CC" />
        <Text style={styles.signInText}>Please sign in to use messages</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Test mode banner */}
      {userRoleService.IS_TEST_MODE && (
        <View style={styles.testModeBanner}>
          <Text style={styles.testModeBannerText}>
            TEST MODE: All messages visible to all roles
          </Text>
        </View>
      )}
      
      {/* Temporary banner for errors/success messages */}
      {renderBanner()}
      
      {selectedConversation ? (
        // Chat window for selected conversation
        <ChatWindow
          conversationId={selectedConversation.id}
          userId={user.id}
          recipientId={selectedConversation.participants[0]?.user_id}
          headerTitle={
            selectedConversation.type === 'direct'
              ? selectedConversation.participants[0]?.display_name || 'Chat'
              : selectedConversation.type === 'group'
              ? 'Group Chat'
              : 'Show Announcement'
          }
          conversationType={selectedConversation.type}
          onBack={handleBackToList}
          onMessageSent={handleMessageSent}
        />
      ) : (
        // Show list of conversations
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Messages</Text>
            <TouchableOpacity 
              style={styles.newButton}
              onPress={() => setNewConversationVisible(true)}
            >
              <Ionicons name="add" size={24} color="#FF6A00" />
            </TouchableOpacity>
          </View>
          
          <ChatList
            conversations={conversations}
            isLoading={isLoading}
            onRefresh={fetchConversations}
            onSelectConversation={setSelectedConversation}
            onNewConversation={() => setNewConversationVisible(true)}
            currentUserId={user.id}
          />
        </>
      )}
      
      {/* New conversation modal */}
      {renderNewConversationModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  signInText: {
    fontSize: 18,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
  },
  testModeBanner: {
    backgroundColor: '#FF9800',
    padding: 8,
  },
  testModeBannerText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  banner: {
    backgroundColor: '#4CAF50', // Success green by default
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bannerText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  newButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
  },
  modalScrollContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#FF6A00',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  selfTestButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  selfTestButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  testModeIndicator: {
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    color: userRoleService.IS_TEST_MODE ? '#4CAF50' : '#FF6A00',
    fontWeight: 'bold',
  },
});

export default MessagesScreen;
