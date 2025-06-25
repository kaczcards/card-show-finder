import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import * as userRoleService from '../services/userRoleService';
import * as messagingService from '../services/messagingService';
import { UserRole } from '../services/userRoleService';

interface MessageButtonProps {
  profileId: string;
  profileRole?: string;
  profileName?: string;
  buttonStyle?: 'default' | 'compact' | 'icon';
  color?: string;
  disabled?: boolean;
}

const MessageButton: React.FC<MessageButtonProps> = ({
  profileId,
  profileRole = '',
  profileName = 'User',
  buttonStyle = 'default',
  color = '#FF6A00',
  disabled = false
}) => {
  const { user, userProfile } = useAuth();
  const navigation = useNavigation<any>();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Check if messaging is disabled
  const isDisabled = disabled || !user || user.id === profileId;
  
  // Check if recipient can receive messages based on role
  const canReceive = !userRoleService.IS_TEST_MODE && 
                    profileRole && 
                    !userRoleService.canUserReceiveMessage(profileRole as UserRole);
  
  // Handle message button press
  const handlePress = () => {
    if (isDisabled) return;
    
    // Check if current user is logged in
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to send messages',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Auth') }
        ]
      );
      return;
    }
    
    // Check if recipient can receive messages
    if (canReceive) {
      Alert.alert(
        'Cannot Message User',
        'This user cannot receive messages due to their role.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Open message composer
    setModalVisible(true);
  };
  
  // Send message and navigate to conversation
  const sendMessage = async () => {
    if (!user || !message.trim()) return;
    
    try {
      setSending(true);
      
      // Start conversation
      const conversationId = await messagingService.startConversationFromProfile(
        user.id,
        profileId,
        message.trim()
      );
      
      // Reset and close modal
      setMessage('');
      setModalVisible(false);
      
      // Navigate to Messages screen with this conversation
      navigation.navigate('Messages', { 
        screen: 'MessagesScreen',
        params: { conversationId }
      });
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', String(error));
    } finally {
      setSending(false);
    }
  };
  
  // Render button based on style prop
  const renderButton = () => {
    switch (buttonStyle) {
      case 'compact':
        return (
          <TouchableOpacity
            style={[
              styles.compactButton,
              { backgroundColor: color },
              isDisabled && styles.disabledButton
            ]}
            onPress={handlePress}
            disabled={isDisabled}
          >
            <Ionicons name="chatbubble" size={14} color="white" />
            <Text style={styles.compactButtonText}>Message</Text>
          </TouchableOpacity>
        );
        
      case 'icon':
        return (
          <TouchableOpacity
            style={[
              styles.iconButton,
              { backgroundColor: color },
              isDisabled && styles.disabledButton
            ]}
            onPress={handlePress}
            disabled={isDisabled}
          >
            <Ionicons name="chatbubble" size={18} color="white" />
          </TouchableOpacity>
        );
        
      default:
        return (
          <TouchableOpacity
            style={[
              styles.defaultButton,
              { backgroundColor: color },
              isDisabled && styles.disabledButton
            ]}
            onPress={handlePress}
            disabled={isDisabled}
          >
            <Ionicons name="chatbubble" size={16} color="white" style={styles.buttonIcon} />
            <Text style={styles.defaultButtonText}>Message</Text>
          </TouchableOpacity>
        );
    }
  };
  
  return (
    <>
      {renderButton()}
      
      {/* Message Composer Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Message to {profileName}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.messageInput}
              placeholder="Type your message here..."
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              autoFocus
            />
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.sendButton, 
                  { backgroundColor: color },
                  (!message.trim() || sending) && styles.disabledButton
                ]}
                onPress={sendMessage}
                disabled={!message.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="white" style={styles.buttonIcon} />
                    <Text style={styles.sendButtonText}>Send</Text>
                  </>
                )}
              </TouchableOpacity>
              
              {userRoleService.IS_TEST_MODE && (
                <Text style={styles.testModeText}>TEST MODE: Role checks bypassed</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Default button style
  defaultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  defaultButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Compact button style
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  compactButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  
  // Icon only button style
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Common styles
  disabledButton: {
    opacity: 0.5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    padding: 4,
  },
  messageInput: {
    height: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  modalFooter: {
    marginTop: 16,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  testModeText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#FF9800',
    fontStyle: 'italic',
  },
});

export default MessageButton;
