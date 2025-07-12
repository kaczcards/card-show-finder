import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform
} from 'react-native';
import { supabase } from '../../supabase';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { ChatList } from '../../components/Chat';
import { Conversation } from '../../services/messagingService';

const DirectMessagesScreen: React.FC = ({ route, navigation }) => {
  // Get user from auth context
  const authContext = useAuth();
  const user = authContext.authState?.user || null;
  
  // State for UI
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Check if we have an initial conversation to open (from navigation)
  const initialConversationId = route.params?.conversationId;
  const recipientId = route.params?.recipientId;
  const recipientName = route.params?.recipientName;
  const isNewConversation = route.params?.isNewConversation;
  
  // Check user session on component mount
  useEffect(() => {
    if (user) {
      fetchUserProfile(user.id);
    }
    
    // Handle navigation params
    if (isNewConversation && recipientId) {
      setShowNewConversation(true);
    }
  }, [user?.id, recipientId, isNewConversation]); // depend on stable user id

  // Fetch user profile
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (!error && data) {
        setUserProfile(data);
      } else if (error) {
        console.log('[Profile error]', error.message);
      }
    } catch (err) {
      console.log('[Profile fetch error]', String(err));
    }
  };

  // Handle creating a new conversation
  // Stable reference (prevents ChatList re-render loop)
  const handleCreateNewConversation = useCallback(() => {
    setShowNewConversation(true);
  }, []);

  // Handle selecting a conversation
  // Stable reference (prevents ChatList re-render loop)
  const handleSelectConversation = useCallback(
    (conversation: Conversation) => {
      // Update navigation title
      const otherParticipant = conversation.participants?.[0];
      const displayName = otherParticipant?.display_name || 'Conversation';

      navigation.setOptions({
        title: displayName,
      });
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {showNewConversation ? 'New Message' : 'Messages'}
        </Text>
        
      </View>
      
      {!user ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.noticeText}>Please sign in to use messages</Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : showNewConversation ? (
        // New conversation form - this could be extracted to a separate component
        <View style={styles.newMessageContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowNewConversation(false)}
          >
            <Ionicons name="arrow-back" size={24} color="#0057B8" />
          </TouchableOpacity>
          
          <Text style={styles.newMessageTitle}>New Message</Text>
          <Text style={styles.newMessageSubtitle}>
            This feature is coming soon. For now, you can message dealers and organizers from their profiles.
          </Text>
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowNewConversation(false)}
          >
            <Text style={styles.buttonText}>Back to Messages</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Main chat list using our new component
        <ChatList
          userId={user?.id}
          onSelectConversation={handleSelectConversation}
          onCreateNewConversation={handleCreateNewConversation}
          initialConversationId={initialConversationId}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
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
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noticeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#0057B8',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  newMessageContainer: {
    flex: 1,
    padding: 16,
  },
  newMessageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  newMessageSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
});

export default DirectMessagesScreen;
