import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ChatList from '../../../src/components/Chat/ChatList';

// Mock the hooks
jest.mock('../../../src/hooks', () => ({
  useConversationsQuery: jest.fn(),
  useConversationMessagesQuery: jest.fn(),
}));

// Import the mocked hooks
import { useConversationsQuery, useConversationMessagesQuery } from '../../../src/hooks';

describe('ChatList Component', () => {
  // Mock data
  const mockConversations = [
    {
      id: 'convo-1',
      title: 'Conversation 1',
      last_message_text: 'Hello there',
      last_message_timestamp: '2025-07-11T10:00:00Z',
      unread_count: 2,
      participants: [
        {
          user_id: 'user-2',
          display_name: 'John Doe',
          avatar_url: null,
        },
      ],
      type: 'direct',
    },
    {
      id: 'convo-2',
      title: 'Conversation 2',
      last_message_text: 'How are you?',
      last_message_timestamp: '2025-07-10T15:30:00Z',
      unread_count: 0,
      participants: [
        {
          user_id: 'user-3',
          display_name: 'Jane Smith',
          avatar_url: null,
        },
      ],
      type: 'direct',
    },
  ];

  const mockMessages = [
    {
      id: 'msg-1',
      conversation_id: 'convo-1',
      sender_id: 'user-2',
      message_text: 'Hello there',
      created_at: '2025-07-11T10:00:00Z',
      read_by_user_ids: ['user-1'],
      sender_profile: {
        id: 'user-2',
        display_name: 'John Doe',
      },
    },
    {
      id: 'msg-2',
      conversation_id: 'convo-1',
      sender_id: 'user-1',
      message_text: 'Hi! How are you?',
      created_at: '2025-07-11T10:01:00Z',
      read_by_user_ids: ['user-1', 'user-2'],
      sender_profile: {
        id: 'user-1',
        display_name: 'Current User',
      },
    },
  ];

  // Mock implementations
  const mockMarkConversationAsRead = jest.fn();
  const mockSendMessage = jest.fn();
  const mockRefetchConversations = jest.fn();
  const mockSendConversationMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useConversationsQuery hook
    (useConversationsQuery as jest.Mock).mockReturnValue({
      conversations: mockConversations,
      isLoading: false,
      error: null,
      refetch: mockRefetchConversations,
      markConversationAsRead: mockMarkConversationAsRead,
      sendMessage: mockSendMessage,
      isSending: false,
    });

    // Mock useConversationMessagesQuery hook
    (useConversationMessagesQuery as jest.Mock).mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      error: null,
      sendMessage: mockSendConversationMessage,
      isSending: false,
    });
  });

  test('renders conversation list when no conversation is selected', () => {
    const { getByText } = render(<ChatList userId="user-1" />);
    
    expect(getByText('Conversation 1')).toBeTruthy();
    expect(getByText('Conversation 2')).toBeTruthy();
  });

  test('selects conversation when clicked', () => {
    const onSelectConversationMock = jest.fn();
    const { getByText } = render(
      <ChatList 
        userId="user-1" 
        onSelectConversation={onSelectConversationMock}
      />
    );
    
    fireEvent.press(getByText('Conversation 1'));
    
    // Check if the handler was called with the correct conversation
    expect(onSelectConversationMock).toHaveBeenCalledWith(mockConversations[0]);
    
    // Check if markConversationAsRead was called
    expect(mockMarkConversationAsRead).toHaveBeenCalledWith('convo-1');
  });

  test('processes initialConversationId only once', async () => {
    // Spy on React.useRef to track how it's used
    const useRefSpy = jest.spyOn(React, 'useRef');
    
    // Render component with initialConversationId
    render(
      <ChatList 
        userId="user-1" 
        initialConversationId="convo-1"
      />
    );
    
    // Wait for component to process initialConversationId
    await waitFor(() => {
      // Verify markConversationAsRead was called exactly once
      expect(mockMarkConversationAsRead).toHaveBeenCalledTimes(1);
      expect(mockMarkConversationAsRead).toHaveBeenCalledWith('convo-1');
    });
    
    // Verify useRef was called (for the processedInitialIdRef)
    expect(useRefSpy).toHaveBeenCalled();
    
    // Force a re-render to see if it processes initialConversationId again
    const { rerender } = render(
      <ChatList 
        userId="user-1" 
        initialConversationId="convo-1"
      />
    );
    
    // Re-render with the same props
    rerender(
      <ChatList 
        userId="user-1" 
        initialConversationId="convo-1"
      />
    );
    
    // Verify markConversationAsRead was still only called once
    expect(mockMarkConversationAsRead).toHaveBeenCalledTimes(1);
    
    useRefSpy.mockRestore();
  });

  test('handles different initialConversationId correctly', async () => {
    // First render with one initialConversationId
    const { rerender } = render(
      <ChatList 
        userId="user-1" 
        initialConversationId="convo-1"
      />
    );
    
    // Wait for first conversation to be processed
    await waitFor(() => {
      expect(mockMarkConversationAsRead).toHaveBeenCalledWith('convo-1');
    });
    
    // Reset mock to track new calls
    mockMarkConversationAsRead.mockClear();
    
    // Re-render with a different initialConversationId
    rerender(
      <ChatList 
        userId="user-1" 
        initialConversationId="convo-2"
      />
    );
    
    // Verify second conversation is processed
    await waitFor(() => {
      expect(mockMarkConversationAsRead).toHaveBeenCalledWith('convo-2');
    });
  });

  test('does not cause infinite loop with initialConversationId', async () => {
    // Mock console.error to catch any potential maximum update depth exceeded errors
    const originalError = console.error;
    console.error = jest.fn();
    
    // Render with initialConversationId
    render(
      <ChatList 
        userId="user-1" 
        initialConversationId="convo-1"
      />
    );
    
    // Wait for any async operations
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Check if there were any maximum update depth exceeded errors
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );
    
    // Restore console.error
    console.error = originalError;
  });

  test('handles empty conversations array with initialConversationId', () => {
    // Mock empty conversations
    (useConversationsQuery as jest.Mock).mockReturnValueOnce({
      conversations: [],
      isLoading: false,
      error: null,
      refetch: mockRefetchConversations,
      markConversationAsRead: mockMarkConversationAsRead,
      sendMessage: mockSendMessage,
      isSending: false,
    });
    
    render(
      <ChatList 
        userId="user-1" 
        initialConversationId="convo-1"
      />
    );
    
    // Verify markConversationAsRead was not called since conversation doesn't exist
    expect(mockMarkConversationAsRead).not.toHaveBeenCalled();
  });

  test('handles null userId with initialConversationId', () => {
    render(
      <ChatList 
        userId={null} 
        initialConversationId="convo-1"
      />
    );
    
    // Verify markConversationAsRead was not called when userId is null
    expect(mockMarkConversationAsRead).not.toHaveBeenCalled();
  });

  test('sends message correctly', () => {
    // First select a conversation
    const { getByText, getByPlaceholderText } = render(
      <ChatList userId="user-1" />
    );
    
    // Select conversation
    fireEvent.press(getByText('Conversation 1'));
    
    // Find input and send button
    const messageInput = getByPlaceholderText('Type a message...');
    
    // Type a message
    fireEvent.changeText(messageInput, 'Hello, this is a test message');
    
    // Send the message
    fireEvent(messageInput, 'submitEditing');
    
    // Check if sendConversationMessage was called with the correct text
    expect(mockSendConversationMessage).toHaveBeenCalledWith('Hello, this is a test message');
  });
});
