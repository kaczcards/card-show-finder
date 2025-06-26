import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Text, 
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import MessageList from '../../components/MessageList';
import MessageDetail from '../../components/MessageDetail';
import { 
  Conversation, 
  getConversations, 
  getUnreadMessageCount,
  canSendMessages
} from '../../services/messagingService';
import { supabase } from '../../supabase';

const MessagesScreen: React.FC = () => {
  const { user, userProfile } = useAuth();
  const navigation = useNavigation<StackNavigationProp<any>>();
  const isFocused = useIsFocused();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Force loading state to end after 5 seconds to prevent infinite loading
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.log('[MessagesScreen] Forcing loading state to end after timeout');
        setIsLoading(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Set up navigation options
  useEffect(() => {
    navigation.setOptions({
      headerTitle: selectedConversation 
        ? selectedConversation.participant_profile?.full_name || 'Conversation' 
        : 'Messages',
      headerLeft: selectedConversation 
        ? () => (
            <TouchableOpacity 
              style={styles.headerButton} 
              onPress={() => setSelectedConversation(null)}
            >
              <Ionicons name="arrow-back" size={24} color="#333333" />
            </TouchableOpacity>
          ) 
        : undefined,
    });
  }, [navigation, selectedConversation]);

  // Fetch conversations when the screen is focused
  useEffect(() => {
    console.log('[MessagesScreen] Screen focus or user changed. isFocused:', isFocused, 'hasUser:', !!user);
    if (isFocused && user) {
      fetchConversations();
      fetchUnreadCount();
    }
  }, [isFocused, user]);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!user) {
      console.log('[MessagesScreen] Skipping message subscription - no user');
      return;
    }

    console.log('[MessagesScreen] Setting up message subscription for user:', user.id);
    const setupSubscription = async () => {
      // Subscribe to new messages
      const messageSubscription = supabase
        .from('messages')
        .on('INSERT', (payload) => {
          // If this is a message for the current user, update conversations
          if (payload.new.sender_id === user.id || payload.new.recipient_id === user.id) {
            console.log('[MessagesScreen] Received new message via subscription:', payload.new.id);
            fetchConversations();
            fetchUnreadCount();
          }
        })
        .subscribe();

      return () => {
        console.log('[MessagesScreen] Cleaning up message subscription');
        supabase.removeSubscription(messageSubscription);
      };
    };

    const subscription = setupSubscription();
    
    return () => {
      subscription.then(cleanup => cleanup());
    };
  }, [user]);

  // Fetch conversations from the API
  const fetchConversations = useCallback(async () => {
    if (!user) {
      console.log('[MessagesScreen] fetchConversations: No user, skipping');
      return;
    }
    
    console.log('[MessagesScreen] fetchConversations called for user:', user.id);
    try {
      setIsLoading(true);
      setError(null);

      console.log('[MessagesScreen] Calling getConversations service method');
      const fetchedConversations = await getConversations(user.id);

      console.log('[MessagesScreen] Conversations fetched:', 
        fetchedConversations ? `${fetchedConversations.length} conversations` : 'none');
      console.log('[MessagesScreen] First conversation:', 
        fetchedConversations && fetchedConversations.length > 0 ? 
        JSON.stringify(fetchedConversations[0]) : 'N/A');

      setConversations(fetchedConversations);
      
      // If a conversation was selected, update it with the latest data
      if (selectedConversation) {
        const updatedConversation = fetchedConversations.find(
          conv => conv.id === selectedConversation.id
        );
        if (updatedConversation) {
          setSelectedConversation(updatedConversation);
        }
      }
    } catch (error) {
      console.error('[MessagesScreen] Error fetching conversations:', error);
      setError('Failed to load conversations');
    } finally {
      console.log('[MessagesScreen] Setting isLoading to false');
      setIsLoading(false);
    }
  }, [user, selectedConversation]);

  // Fetch unread message count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const count = await getUnreadMessageCount(user.id);
      setUnreadCount(count);
      console.log('[MessagesScreen] Unread message count:', count);
    } catch (error) {
      console.error('[MessagesScreen] Error fetching unread count:', error);
    }
  }, [user]);

  // Handle selecting a conversation
  const handleSelectConversation = (conversation: Conversation) => {
    console.log('[MessagesScreen] Selected conversation:', conversation.id);
    setSelectedConversation(conversation);
  };

  // Handle message sent callback
  const handleMessageSent = () => {
    console.log('[MessagesScreen] Message sent, refreshing conversations');
    fetchConversations();
  };

  // Handle login button press
  const handleLoginPress = () => {
    // Instead of trying to navigate to 'Auth' directly, show an alert
    // explaining the issue and how to log in
    Alert.alert(
      'Login Required',
      'Please go to the Profile tab and log in to access messages.',
      [
        {
          text: 'OK',
          style: 'default'
        }
      ]
    );
  };

  // Check if user can send messages
  const userCanSendMessages = userProfile ? canSendMessages(userProfile.role) : false;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.warningBanner}>
        <Text style={styles.warningText}>
          NEW MESSAGING SYSTEM - Created on {new Date().toLocaleDateString()}
        </Text>
      </View>
      
      {selectedConversation ? (
        // Show message detail when a conversation is selected
        <MessageDetail
          conversationId={selectedConversation.id}
          userId={user?.id || ''}
          recipientId={selectedConversation.participant_id}
          recipientName={selectedConversation.participant_profile?.full_name || 'User'}
          recipientAvatar={selectedConversation.participant_profile?.avatar_url}
          onMessageSent={handleMessageSent}
        />
      ) : (
        // Show conversation list when no conversation is selected
        <View style={styles.listContainer}>
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              User: {user ? user.id.substring(0, 8) + '...' : 'Not logged in'}
            </Text>
            <Text style={styles.statusText}>
              Role: {userProfile?.role || 'Unknown'}
            </Text>
            <Text style={styles.statusText}>
              Can send messages: {userCanSendMessages ? 'Yes' : 'No'}
            </Text>
          </View>
          
          {!userCanSendMessages && user && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                Note: Only MVP Dealers and Show Organizers can respond to messages
              </Text>
            </View>
          )}
          
          {isLoading ? (
            <View style={styles.centeredContainer}>
              <ActivityIndicator size="large" color="#FF6A00" />
              <Text style={styles.loadingText}>Loading conversations...</Text>
            </View>
          ) : error ? (
            <View style={styles.centeredContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchConversations}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !user ? (
            <View style={styles.centeredContainer}>
              <Text style={styles.errorText}>Please log in to view messages</Text>
              <TouchableOpacity 
                style={styles.loginButton} 
                onPress={handleLoginPress}
              >
                <Text style={styles.loginButtonText}>Log In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MessageList
              conversations={conversations}
              isLoading={false}
              onSelectConversation={handleSelectConversation}
            />
          )}

          {/* Test message button for quick testing */}
          {user && (
            <TouchableOpacity
              style={styles.testButton}
              onPress={async () => {
                try {
                  if (!user) return;
                  const conversationId = crypto.randomUUID();
                  const { error } = await supabase
                    .from('messages')
                    .insert([{
                      conversation_id: conversationId,
                      sender_id: user.id,
                      recipient_id: user.id,
                      content: `Test message at ${new Date().toISOString()}`
                    }]);
                  if (error) {
                    alert(`Error: ${error.message}`);
                  } else {
                    setTimeout(fetchConversations, 500);
                  }
                } catch (err) {
                  alert(`Error: ${String(err)}`);
                }
              }}
            >
              <Text style={styles.testButtonText}>Send Test Message to Self</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  statusContainer: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    marginBottom: 4,
  },
  listContainer: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
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
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0057B8',
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  headerButton: {
    paddingHorizontal: 16,
  },
  warningBanner: {
    backgroundColor: '#FFF9C4',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#5D4037',
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default MessagesScreen;
