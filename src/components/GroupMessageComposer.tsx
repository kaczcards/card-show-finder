import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import * as userRoleService from '../services/userRoleService';
import * as messagingService from '../services/messagingService';
import { UserRole } from '../services/userRoleService';

interface GroupMessageComposerProps {
  visible: boolean;
  onClose: () => void;
  showId?: string;
  showTitle?: string;
  onMessageSent?: () => void;
}

const GroupMessageComposer: React.FC<GroupMessageComposerProps> = ({
  visible,
  onClose,
  showId,
  showTitle = 'Show',
  onMessageSent
}) => {
  // Access authentication information from context
  const { authState } = useAuth();
  
  // State
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [targetGroups, setTargetGroups] = useState({
    attendees: true,
    dealers: true,
    mvpDealers: true
  });
  
  // Role validation
  const [canBroadcast, setCanBroadcast] = useState(false);
  
  // Check if current user can broadcast messages
  useEffect(() => {
    // Guard: no authenticated user → cannot broadcast
    if (!authState.user) {
      setCanBroadcast(false);
      return;
    }
    
    // Only show organizers or MVP dealers can broadcast
    const userRole = authState.user.role as UserRole;
    const hasPermission = userRoleService.IS_TEST_MODE || 
                         userRole === UserRole.SHOW_ORGANIZER ||
                         userRole === UserRole.MVP_DEALER;
    
    setCanBroadcast(hasPermission);
  }, [authState.user]);
  
  // Reset form when modal is opened
  useEffect(() => {
    if (visible) {
      setMessageText('');
      setTargetGroups({
        attendees: true,
        dealers: true,
        mvpDealers: true
      });
    }
  }, [visible]);
  
  // Handle sending broadcast message
  const handleBroadcast = async () => {
    if (!authState.user || !messageText.trim() || sending) return;
    
    // Validate target groups (at least one must be selected)
    if (!targetGroups.attendees && !targetGroups.dealers && !targetGroups.mvpDealers) {
      Alert.alert('Error', 'Please select at least one recipient group');
      return;
    }
    
    try {
      setSending(true);
      
      // Prepare recipient roles array
      const recipientRoles: UserRole[] = [];
      if (targetGroups.attendees) recipientRoles.push(UserRole.ATTENDEE);
      if (targetGroups.dealers) recipientRoles.push(UserRole.DEALER);
      if (targetGroups.mvpDealers) recipientRoles.push(UserRole.MVP_DEALER);
      
      // Send broadcast
      await messagingService.sendBroadcastMessage({
        senderId: authState.user.id,
        message: messageText.trim(),
        recipientRoles,
        showId
      });
      
      // Success!
      Alert.alert(
        'Message Sent',
        'Your broadcast message has been sent successfully.',
        [{ text: 'OK', onPress: onClose }]
      );
      
      // Call callback if provided
      if (onMessageSent) {
        onMessageSent();
      }
      
    } catch (error) {
      console.error('Error sending broadcast message:', error);
      Alert.alert('Error', String(error));
    } finally {
      setSending(false);
    }
  };
  
  // Render target group toggles
  const renderTargetGroups = () => (
    <View style={styles.targetGroups}>
      <Text style={styles.groupsTitle}>Send To:</Text>
      
      <View style={styles.groupToggle}>
        <Text style={styles.groupLabel}>Attendees</Text>
        <Switch
          value={targetGroups.attendees}
          onValueChange={(value) => setTargetGroups({...targetGroups, attendees: value})}
          trackColor={{ false: '#D1D1D6', true: '#4CD964' }}
          thumbColor="#FFFFFF"
        />
      </View>
      
      <View style={styles.groupToggle}>
        <Text style={styles.groupLabel}>Dealers</Text>
        <Switch
          value={targetGroups.dealers}
          onValueChange={(value) => setTargetGroups({...targetGroups, dealers: value})}
          trackColor={{ false: '#D1D1D6', true: '#4CD964' }}
          thumbColor="#FFFFFF"
        />
      </View>
      
      <View style={styles.groupToggle}>
        <Text style={styles.groupLabel}>MVP Dealers</Text>
        <Switch
          value={targetGroups.mvpDealers}
          onValueChange={(value) => setTargetGroups({...targetGroups, mvpDealers: value})}
          trackColor={{ false: '#D1D1D6', true: '#4CD964' }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  );
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              Broadcast Message {showTitle ? `for ${showTitle}` : ''}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
            {!canBroadcast ? (
              <View style={styles.permissionWarning}>
                <Ionicons name="alert-circle" size={24} color="#FF3B30" style={styles.warningIcon} />
                <Text style={styles.warningText}>
                  You don't have permission to broadcast messages.
                  Only show organizers and MVP dealers can send broadcast messages.
                </Text>
              </View>
            ) : (
              <>
                {renderTargetGroups()}
                
                <Text style={styles.inputLabel}>Message</Text>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Type your broadcast message here..."
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  maxLength={1000}
                  editable={!sending && canBroadcast}
                />
                
                <Text style={styles.recipientCount}>
                  This message will be sent to {
                    (targetGroups.attendees ? 'attendees' : '') +
                    (targetGroups.dealers ? (targetGroups.attendees ? ', dealers' : 'dealers') : '') +
                    (targetGroups.mvpDealers ? 
                      ((targetGroups.attendees || targetGroups.dealers) ? ', MVP dealers' : 'MVP dealers') 
                      : '')
                  }.
                </Text>
                
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!messageText.trim() || !canBroadcast || sending) && styles.disabledButton
                  ]}
                  onPress={handleBroadcast}
                  disabled={!messageText.trim() || !canBroadcast || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.sendButtonText}>
                      <Ionicons name="megaphone" size={18} />  Send Broadcast
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
  },
  scrollContent: {
    maxHeight: '80%',
  },
  scrollInner: {
    padding: 16,
  },
  permissionWarning: {
    backgroundColor: '#FFEEEE',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
  },
  warningIcon: {
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    color: '#FF3B30',
    lineHeight: 20,
  },
  targetGroups: {
    marginBottom: 16,
  },
  groupsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  groupToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  groupLabel: {
    fontSize: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  messageInput: {
    height: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  recipientCount: {
    marginTop: 8,
    color: '#666666',
    fontStyle: 'italic',
  },
  sendButton: {
    backgroundColor: '#FF6A00',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default GroupMessageComposer;
