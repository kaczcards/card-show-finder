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

  /**
   * React Query sometimes infers the `conversations` result as
   * `never[] | NonNullable<NoInfer<TQueryFnData>>` which causes all of the
   * downstream `length`, `find`, etc. property accesses to error out. We know
   * that our hook always returns an array of `Conversation` objects (defaulting
   * to an empty array), so cast it once here and use the strongly-typed alias
   * everywhere else. This keeps the rest of the component code clean while
   * satisfying TypeScript.
   */
  const conversationsList: Conversation[] = conversations as Conversation[];

  // Find initial conversation if provided
  // Track which initialConversationId we have already processed so we don't trigger
  // handleSelectConversation on every render (which caused an infinite loop).
  const processedInitialIdRef = useRef<string | null>(null);

  React.useEffect(() => {
    if (
      initialConversationId &&
      conversationsList.length > 0 &&
      processedInitialIdRef.current !== initialConversationId
    ) {
      const conversation = conversationsList.find(
        (c: Conversation) => c.id === initialConversationId
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

  /**
   * Similar to the conversations cast above, React Query occasionally infers
   * the `messages` result as `never[] | NonNullable<NoInfer<TQueryFnData>>`
   * which breaks downstream type-safety.  We know the hook always returns an
   * array of `Message` objects (defaulting to []), so cast once here and use
   * the strongly-typed alias everywhere else.
   */
  const messagesList: Message[] = messages as Message[];

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
    if (isLoadingConversations && conversationsList.length === 0) {
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
          data={conversationsList}
          renderItem={({ item }) => (
            <ChatItem
              conversation={item}
              onSelect={handleSelectConversation}
              isSelected={selectedConversation?.id === item.id}
            />
          )}
          keyExtractor={(item) => item.id}
          refreshing={isLoadingConversations && conversationsList.length > 0}
          onRefresh={refetchConversations}
          ListEmptyComponent={
            <EmptyState 
              title="No conversations yet"
              subtitle="When you message a dealer or show organizer, your conversations will appear here"
            />
          }
          contentContainerStyle={
            conversationsList.length === 0 ? styles.fullScreenContainer : styles.listContainer
            /**
             * We intentionally keep the original `conversations` prop for
             * FlatList `data` above to avoid unnecessary re-renders caused by
             * a new reference.  The style computation, however, only needs the
             * array length so we reference the typed alias here.
             */
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
        
        {isLoadingMessages && messagesList.length === 0 ? (
          <LoadingState message="Loading messages..." />
        ) : messagesError ? (
          <ErrorState 
            error={messagesError.message}
            title="Couldn't load messages" 
            onRetry={messagesError.retry}
          />
        ) : messagesList.length === 0 ? (
          <EmptyState 
            title="No messages yet"
            subtitle="Start the conversation by sending a message"
            iconName="chatbubbles-outline"
          />
        ) : (
          <FlatList
            data={messagesList}
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
