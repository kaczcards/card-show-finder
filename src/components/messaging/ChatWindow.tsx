import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as messagingService from '../../services/messagingService';
import * as userRoleService from '../../services/userRoleService';
import { Message } from '../../services/messagingService';
import { UserRole } from '../../services/userRoleService';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import Avatar from '../common/Avatar';
import { formatRelativeTime } from '../../utils/dateUtils';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatWindowProps {
  conversationId: string;
  showId?: string;
  isBroadcast?: boolean;
  onBackPress?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  showId,
  isBroadcast = false,
  onBackPress,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [canReply, setCanReply] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isModeratorView, setIsModeratorView] = useState(false);
  const messagesEndRef = useRef<FlatList>(null);
  const realtimeChannel = useRef<RealtimeChannel | null>(null);
  const isV2Enabled = useFeatureFlag('messaging_v2_enabled');

  // Fetch messages and set up realtime subscription
  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      try {
        const fetchedMessages = await messagingService.getMessages(conversationId);
        if (isMounted) {
          setMessages(fetchedMessages);
          setLoading(false);
          
          // Mark conversation as read
          if (user?.id) {
            await messagingService.markConversationAsRead(conversationId, user.id);
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const fetchParticipants = async () => {
      try {
        const { data: participantsData } = await messagingService.getConversationParticipants(conversationId);
        if (isMounted && participantsData) {
          setParticipants(participantsData);
        }
      } catch (error) {
        console.error('Error fetching participants:', error);
      }
    };

    fetchMessages();
    fetchParticipants();

    // Set up realtime subscription
    if (user?.id) {
      realtimeChannel.current = messagingService.subscribeToMessages(
        conversationId,
        (newMsg) => {
          setMessages((prevMessages) => {
            // Check if message already exists to prevent duplicates
            if (prevMessages.some(msg => msg.id === newMsg.id)) {
              return prevMessages;
            }
            return [...prevMessages, newMsg];
          });
          
          // Mark new message as read if it's not from the current user
          if (newMsg.sender_id !== user.id) {
            messagingService.markMessageAsRead(newMsg.id, user.id);
          }
        }
      );
    }

    return () => {
      isMounted = false;
      if (realtimeChannel.current) {
        realtimeChannel.current.unsubscribe();
      }
    };
  }, [conversationId, user?.id]);

  // Get user role and check permissions
  useEffect(() => {
    const getUserRoleAndPermissions = async () => {
      if (user?.id) {
        const role = await userRoleService.getUserRole(user.id);
        setUserRole(role);
        
        if (role) {
          // In v2, use the new permission system
          if (isV2Enabled) {
            setCanReply(userRoleService.canReplyToMessage(role));
          } else {
            // Legacy permission check
            setCanReply(role !== userRoleService.UserRole.DEALER);
          }
          
          // Check if user is a moderator (Show Organizer)
          setIsModeratorView(userRoleService.canModerateMessages(role));
        }
      }
    };
    
    getUserRoleAndPermissions();
  }, [user?.id, isV2Enabled]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!user?.id || !newMessage.trim() || sending) {
      return;
    }

    try {
      setSending(true);
      
      // Find the other participant for direct messages
      const otherParticipant = participants.find(p => p.user_id !== user.id);
      const recipientId = otherParticipant?.user_id;
      
      if (isBroadcast) {
        // For broadcasts, use the group message function
        await messagingService.sendGroupMessage(user.id, conversationId, newMessage.trim());
      } else if (recipientId) {
        // For direct messages
        await messagingService.sendMessage(user.id, recipientId, newMessage.trim(), conversationId);
      } else {
        throw new Error('Recipient not found');
      }
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleReportMessage = (messageId: string) => {
    setSelectedMessageId(messageId);
    setReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!selectedMessageId || !reportReason.trim() || !user?.id) {
      return;
    }

    try {
      const success = await messagingService.reportMessage(
        user.id,
        selectedMessageId,
        reportReason.trim()
      );

      if (success) {
        Alert.alert('Report Submitted', 'Thank you for your report. Our moderators will review it.');
      } else {
        Alert.alert('Error', 'Failed to submit report. Please try again.');
      }
    } catch (error) {
      console.error('Error reporting message:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setReportModalVisible(false);
      setReportReason('');
      setSelectedMessageId(null);
    }
  };

  const handleModerateMessage = async (messageId: string) => {
    if (!user?.id || !isModeratorView) {
      return;
    }

    Alert.alert(
      'Moderate Message',
      'Do you want to remove this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await messagingService.moderateMessage(
                user.id,
                messageId,
                'Content violation'
              );

              if (success) {
                // Refresh messages to show the moderated state
                const updatedMessages = await messagingService.getMessages(conversationId);
                setMessages(updatedMessages);
              } else {
                Alert.alert('Error', 'Failed to moderate message. Please try again.');
              }
            } catch (error) {
              console.error('Error moderating message:', error);
              Alert.alert('Error', 'Failed to moderate message. Please try again.');
            }
          }
        }
      ]
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isCurrentUser = item.sender_id === user?.id;
    const senderName = item.sender_profile?.full_name || 'Unknown User';
    const avatarUrl = item.sender_profile?.avatar_url;
    
    // Handle deleted/moderated messages
    if (item.is_deleted) {
      return (
        <View style={styles.deletedMessageContainer}>
          <Text style={styles.deletedMessageText}>
            <Ionicons name="alert-circle-outline" size={16} /> 
            This message has been removed by a moderator.
          </Text>
        </View>
      );
    }

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && (
          <View style={styles.avatarContainer}>
            <Avatar uri={avatarUrl} size={32} />
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
        ]}>
          {!isCurrentUser && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          
          <Text style={styles.messageText}>{item.message_text}</Text>
          
          <Text style={styles.messageTime}>
            {formatRelativeTime(new Date(item.created_at))}
          </Text>
          
          {/* Message actions */}
          {!isCurrentUser && !isBroadcast && (
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => handleReportMessage(item.id)}
            >
              <MaterialIcons name="report" size={16} color="#888" />
            </TouchableOpacity>
          )}
          
          {/* Moderation button for show organizers */}
          {isModeratorView && !isCurrentUser && (
            <TouchableOpacity
              style={styles.moderateButton}
              onPress={() => handleModerateMessage(item.id)}
            >
              <MaterialIcons name="delete-outline" size={16} color="#d32f2f" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render broadcast header for show announcements
  const renderBroadcastHeader = () => {
    if (!isBroadcast) return null;
    
    return (
      <View style={styles.broadcastHeader}>
        <MaterialIcons name="campaign" size={24} color="#4CAF50" />
        <Text style={styles.broadcastHeaderText}>
          Show Announcement
        </Text>
        <Text style={styles.broadcastSubtext}>
          {showId ? 'This is an official announcement for this show' : 'Broadcast message'}
        </Text>
      </View>
    );
  };

  // Report modal
  const renderReportModal = () => (
    <Modal
      visible={reportModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setReportModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Report Message</Text>
          
          <Text style={styles.modalLabel}>
            Please tell us why you're reporting this message:
          </Text>
          
          <TextInput
            style={styles.reportInput}
            value={reportReason}
            onChangeText={setReportReason}
            placeholder="Reason for reporting..."
            multiline
            numberOfLines={3}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setReportModalVisible(false);
                setReportReason('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalButton, 
                styles.submitButton,
                !reportReason.trim() && styles.disabledButton
              ]}
              onPress={submitReport}
              disabled={!reportReason.trim()}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header with back button */}
      {onBackPress && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0066cc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isBroadcast ? 'Announcement' : 'Message'}
          </Text>
        </View>
      )}
      
      {renderBroadcastHeader()}
      
      {/* Messages list */}
      <FlatList
        ref={messagesEndRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onLayout={() => messagesEndRef.current?.scrollToEnd({ animated: false })}
      />
      
      {/* Input area - hidden for broadcasts or if user can't reply */}
      {!isBroadcast && canReply && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.disabledButton
            ]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}
      
      {/* For users who can't reply, show upgrade message */}
      {!isBroadcast && !canReply && userRole === userRoleService.UserRole.DEALER && (
        <View style={styles.upgradeContainer}>
          <Text style={styles.upgradeText}>
            Upgrade to MVP Dealer to send messages
          </Text>
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* For broadcasts, show info message */}
      {isBroadcast && (
        <View style={styles.broadcastFooter}>
          <Text style={styles.broadcastFooterText}>
            This is a one-way announcement. Replies are disabled.
          </Text>
        </View>
      )}
      
      {renderReportModal()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageContainer: {
    marginBottom: 16,
    flexDirection: 'row',
    maxWidth: '80%',
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '100%',
  },
  currentUserBubble: {
    backgroundColor: '#0066cc',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#555',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    color: '#888',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 120,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Broadcast styles
  broadcastHeader: {
    backgroundColor: '#e8f5e9',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
  },
  broadcastHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2e7d32',
    marginTop: 8,
  },
  broadcastSubtext: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
    textAlign: 'center',
  },
  broadcastFooter: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  broadcastFooterText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Upgrade container
  upgradeContainer: {
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  upgradeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  upgradeButton: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Report and moderation
  reportButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  moderateButton: {
    position: 'absolute',
    top: 8,
    right: 32,
    padding: 4,
  },
  // Deleted message
  deletedMessageContainer: {
    alignSelf: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxWidth: '80%',
  },
  deletedMessageText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
  },
  reportInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#555',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#d32f2f',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ChatWindow;
