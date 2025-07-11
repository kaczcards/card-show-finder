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
  
  // State for UI and debug
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any[]>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Check if we have an initial conversation to open (from navigation)
  const initialConversationId = route.params?.conversationId;
  const recipientId = route.params?.recipientId;
  const recipientName = route.params?.recipientName;
  const isNewConversation = route.params?.isNewConversation;
  
  // Add debug log
  const addDebugLog = (title: string, data: any) => {
    setDebugInfo(prev => [{ title, data, timestamp: new Date().toISOString() }, ...prev]);
    console.log(`[DEBUG] ${title}:`, data);
  };

  // Check user session on component mount
  useEffect(() => {
    if (user) {
      fetchUserProfile(user.id);
    }
    
    // Handle navigation params
    if (isNewConversation && recipientId) {
      setShowNewConversation(true);
    }
  }, [user, recipientId, isNewConversation]);

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
        
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={() => setShowDebug(!showDebug)}
        >
          <Ionicons name="bug" size={20} color="#999" />
        </TouchableOpacity>
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
      
      {showDebug && (
        <View style={styles.debugPanel}>
          <View style={styles.debugHeader}>
            <Text style={styles.debugTitle}>Debug Info</Text>
            <TouchableOpacity onPress={() => setShowDebug(false)}>
              <Ionicons name="close" size={20} color="#333" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.debugInfo}>
            User: {user ? user.id : 'Not logged in'}
          </Text>
          <Text style={styles.debugInfo}>
            Role: {userProfile?.role || 'Unknown'}
          </Text>
          
          <ScrollView style={styles.debugScroll}>
            {debugInfo.map((log, index) => (
              <View key={`${log.timestamp}-${index}`} style={styles.logItem}>
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
  debugButton: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
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
  }
});

export default DirectMessagesScreen;
