import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../../../services/messagingService';

interface ConversationHeaderProps {
  conversation: Conversation | null;
  onBack: () => void;
  title?: string;
}

const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  onBack,
  title
}) => {
  // Get the other user's profile from the conversation
  const otherParticipant = conversation?.participants && conversation.participants.length > 0 
    ? conversation.participants[0] 
    : null;
  
  // For group chats, show count instead
  const isGroupChat = conversation?.type !== 'direct' || (conversation?.participant_count || 0) > 2;
  
  // Determine display name with fallbacks
  let displayName = title || '';
  if (!displayName) {
    if (isGroupChat) {
      displayName = `Group (${conversation?.participant_count || 0})`;
    } else if (otherParticipant?.display_name) {
      displayName = otherParticipant.display_name;
    } else {
      displayName = 'Conversation';
    }
  }
  
  const photoUrl = !isGroupChat && otherParticipant?.photo_url;

  return (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={onBack}
      >
        <Ionicons name="arrow-back" size={24} color="#0057B8" />
      </TouchableOpacity>
      
      <View style={styles.profileContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[
            styles.avatarFallback, 
            isGroupChat && styles.groupAvatar
          ]}>
            <Text style={styles.avatarText}>
              {isGroupChat 
                ? `${conversation?.participant_count || 0}` 
                : displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {displayName}
          </Text>
          {otherParticipant && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {isGroupChat 
                ? `${conversation?.participant_count || 0} participants` 
                : 'Tap for details'}
            </Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity style={styles.actionButton}>
        <Ionicons name="ellipsis-vertical" size={20} color="#0057B8" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    padding: 12,
    height: 60,
  },
  backButton: {
    marginRight: 8,
  },
  profileContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0057B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  groupAvatar: {
    backgroundColor: '#FF6A00',
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  subtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
  actionButton: {
    padding: 8,
  },
});

export default ConversationHeader;
