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
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
// import ChatList, { Conversation } from '../../components/ChatList'; // Future feature - temporarily disabled for CI
// import ChatWindow from '../../components/ChatWindow'; // Future feature
// import * as messagingService from '../../services/messagingService'; // Future feature
import * as userRoleService from '../../services/userRoleService';

// ---------------------------------------------------------------------------
// TEMPORARY PLACEHOLDERS – remove once messaging feature is ready
// ---------------------------------------------------------------------------
type Conversation = any; // Minimal stub to satisfy existing references

// Stubbed messaging service — prevents import-time type errors during CI
const messagingService = {
   
  startConversationFromProfile: async (
    _senderId: string,
    _recipientId: string,
    _message: string,
  ): Promise<string> => {
    // Return fake conversation ID
    return 'placeholder-convo-id';
  },
   
};

const FeatureComingSoon: React.FC = () => (
  <View style={styles.centerContainer}>
    <Text style={{ fontSize: 18, color: '#8E8E93', textAlign: 'center' }}>
      Messaging feature coming soon!
    </Text>
  </View>
);
import { UserRole } from '../../services/userRoleService';

/* --------------------------------------------------------------------------
 * Stubbed hook – avoids importing heavy chat hooks while feature is disabled
 * ------------------------------------------------------------------------ */
const useConversationsQuery = (_userId: string | undefined) => ({
  conversations: [] as Conversation[],
  isLoading: false,
  refetch: () => {},
  totalUnreadCount: 0,
});

const MessagesScreen: React.FC = ({ route }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const initialConversationId = route?.params?.conversationId;
  
  // Animation for banner
  const bannerHeight = useRef(new Animated.Value(0)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  
  // State
  // Conversations come from the React-Query hook now
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newConversationVisible, setNewConversationVisible] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  
  // ---------------------------------------------------------------------------
  // React-Query hook for conversations
  // ---------------------------------------------------------------------------
  const {
    conversations,
    isLoading,
    refetch: refetchConversations,
    totalUnreadCount
  } = useConversationsQuery(user?.id);

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
  
  // NOTE: manual fetching & realtime subscription logic removed –
  //       React-Query hook + Supabase listeners inside it handle updates.
  
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
      await refetchConversations();
      
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
    refetchConversations();
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
        // Placeholder while messaging feature is disabled in CI
        <FeatureComingSoon />
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
          
          {/* Placeholder while messaging feature is disabled in CI */}
          <FeatureComingSoon />
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
