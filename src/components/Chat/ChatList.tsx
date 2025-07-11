import React, { useState, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation, Message } from '../../services/messagingService';
import { useConversationsQuery, useConversationMessagesQuery } from '../../hooks';
import {
  ChatItem,
  EmptyState,
  ErrorState,
  LoadingState,
  MessageBubble,
  ConversationHeader
} from './components';

interface ChatListProps {
  userId: string | null;
  onSelectConversation?: (conversation: Conversation) => void;
  onCreateNewConversation?: () => void;
  initialConversationId?: string;
}

const ChatList: React.FC<ChatListProps> = ({
  userId,
  onSelectConversation,
  onCreateNewConversation,
  initialConversationId
}) => {
  // State for managing UI
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');

  // Use React Query hooks for data fetching
  const {
    conversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
    refetch: refetchConversations,
    markConversationAsRead,
    sendMessage,
    isSending
  } = useConversationsQuery(userId);

  // Find initial conversation if provided
  // Track which initialConversationId we have already processed so we don't trigger
  // handleSelectConversation on every render (which caused an infinite loop).
  const processedInitialIdRef = useRef<string | null>(null);

  React.useEffect(() => {
    if (
      initialConversationId &&
      conversations.length > 0 &&
      processedInitialIdRef.current !== initialConversationId
    ) {
      const conversation = conversations.find(
        (c) => c.id === initialConversationId
      );
      if (conversation) {
        handleSelectConversation(conversation);
        // Set the ref to prevent infinite loop
        processedInitialIdRef.current = initialConversationId;
      }
    }
  }, [initialConversationId, conversations]);

  // Fetch messages for the selected conversation
  const {
    messages,
    isLoading: isLoadingMessages,
    error: messagesError,
    sendMessage: sendConversationMessage,
    isSending: isSendingMessage
  } = useConversationMessagesQuery(
    selectedConversation?.id || null,
    userId
  );

  // Handle selecting a conversation
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Mark conversation as read
    if (userId) {
      markConversationAsRead(conversation.id);
    }
    
    // Call external handler if provided
    if (onSelectConversation) {
      onSelectConversation(conversation);
    }
  };

  // Handle going back to the conversation list
  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  // Handle sending a message
  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversation || !userId) return;
    
    // Send the message
    sendConversationMessage(messageText.trim());
    
    // Clear the input
    setMessageText('');
  };

  // Render conversation list view
  const renderConversationList = () => {
    if (isLoadingConversations && conversations.length === 0) {
      return <LoadingState />;
    }

    if (conversationsError) {
      return (
        <ErrorState 
          error={conversationsError.message} 
          onRetry={conversationsError.retry ?? refetchConversations}
        />
      );
    }

    return (
      <View style={styles.container}>
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <ChatItem
              conversation={item}
              onSelect={handleSelectConversation}
              isSelected={selectedConversation?.id === item.id}
            />
          )}
          keyExtractor={(item) => item.id}
          refreshing={isLoadingConversations && conversations.length > 0}
          onRefresh={refetchConversations}
          ListEmptyComponent={
            <EmptyState 
              title="No conversations yet"
              subtitle="When you message a dealer or show organizer, your conversations will appear here"
            />
          }
          contentContainerStyle={
            conversations.length === 0 ? styles.fullScreenContainer : styles.listContainer
          }
        />
        
        {onCreateNewConversation && (
          <TouchableOpacity
            style={styles.newConversationButton}
            onPress={onCreateNewConversation}
          >
            <Ionicons name="create" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render conversation detail view
  const renderConversationDetail = () => {
    if (!selectedConversation) return null;

    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ConversationHeader
          conversation={selectedConversation}
          onBack={handleBackToList}
        />
        
        {isLoadingMessages && messages.length === 0 ? (
          <LoadingState message="Loading messages..." />
        ) : messagesError ? (
          <ErrorState 
            error={messagesError.message}
            title="Couldn't load messages" 
            onRetry={messagesError.retry}
          />
        ) : messages.length === 0 ? (
          <EmptyState 
            title="No messages yet"
            subtitle="Start the conversation by sending a message"
            iconName="chatbubbles-outline"
          />
        ) : (
          <FlatList
            data={messages}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isCurrentUser={userId === item.sender_id}
                isOptimistic={item.id.startsWith('temp-')}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            inverted={false}
          />
        )}
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            editable={!isSendingMessage}
            accessible
            accessibilityLabel="Message input field"
            accessibilityHint="Enter the message you want to send"
            returnKeyType="send"
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || isSendingMessage) && styles.disabledButton
            ]}
            disabled={!messageText.trim() || isSendingMessage}
            onPress={handleSendMessage}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !messageText.trim() || isSendingMessage, busy: isSendingMessage }}
          >
            {isSendingMessage ? (
              <Ionicons name="hourglass-outline" size={20} color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  };

  // Main render
  return selectedConversation ? renderConversationDetail() : renderConversationList();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  fullScreenContainer: {
    flexGrow: 1,
    paddingBottom: 100, // Extra padding at bottom for scroll effect
  },
  listContainer: {
    paddingBottom: 20,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
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
});

export default ChatList;
