import { renderHook, act } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as messagingService from '../../src/services/messagingService';
import { useConversationMessagesQuery } from '../../src/hooks/useConversationMessagesQuery';
import React from 'react';

// Mock dependencies
jest.mock('../../src/services/messagingService');
jest.mock('../../src/supabase', () => ({
  supabase: {
    rpc: jest.fn().mockReturnValue({
      data: null,
      error: { message: 'Test error' }
    }),
    removeChannel: jest.fn()
  }
}));

describe('useConversationMessagesQuery', () => {
  // Set up test environment
  let queryClient: QueryClient;
  const mockMessages = [
    { 
      id: 'msg-1', 
      conversation_id: 'convo-1', 
      sender_id: 'user-2',
      message_text: 'Hello',
      created_at: '2025-07-11T10:00:00Z',
      read_by_user_ids: []
    },
    {
      id: 'msg-2',
      conversation_id: 'convo-1',
      sender_id: 'user-1',
      message_text: 'Hi there',
      created_at: '2025-07-11T10:01:00Z',
      read_by_user_ids: ['user-1']
    }
  ];

  // Mock implementation of markConversationAsRead
  const mockMarkAsRead = jest.fn().mockResolvedValue(true);
  
  // Mock implementation of getMessages
  const mockGetMessages = jest.fn().mockResolvedValue(mockMessages);
  
  // Mock implementation of subscribeToMessages
  const mockSubscribe = jest.fn().mockReturnValue({
    unsubscribe: jest.fn()
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Set up mock implementations
    (messagingService.markConversationAsRead as jest.Mock).mockImplementation(mockMarkAsRead);
    (messagingService.getMessages as jest.Mock).mockImplementation(mockGetMessages);
    (messagingService.subscribeToMessages as jest.Mock).mockImplementation(mockSubscribe);
    
    // Create a fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0
        }
      }
    });
  });

  // Wrapper component for providing query client context
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  test('should not mark conversation as read when messages are loading', async () => {
    // Mock loading state
    mockGetMessages.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
    
    // Render the hook with loading state
    renderHook(
      () => useConversationMessagesQuery('convo-1', 'user-1'),
      { wrapper }
    );
    
    // Verify markConversationAsRead is not called during loading
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });

  test('should not mark conversation as read when messages array is empty', async () => {
    // Mock empty messages array
    mockGetMessages.mockResolvedValueOnce([]);
    
    // Render the hook with empty messages
    const { waitForNextUpdate } = renderHook(
      () => useConversationMessagesQuery('convo-1', 'user-1'),
      { wrapper }
    );
    
    await waitForNextUpdate();
    
    // Verify markConversationAsRead is not called with empty messages
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });

  test('should mark conversation as read only once', async () => {
    // Render the hook with messages
    const { waitForNextUpdate, rerender } = renderHook(
      () => useConversationMessagesQuery('convo-1', 'user-1'),
      { wrapper }
    );
    
    await waitForNextUpdate();
    
    // Verify markConversationAsRead is called once
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1);
    expect(mockMarkAsRead).toHaveBeenCalledWith('convo-1', 'user-1');
    
    // Clear mock to check if it's called again
    mockMarkAsRead.mockClear();
    
    // Rerender the hook (simulating a component update)
    rerender();
    
    // Verify markConversationAsRead is not called again
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });

  test('should handle switching between conversations correctly', async () => {
    // Render the hook with first conversation
    const { waitForNextUpdate, rerender } = renderHook(
      ({ conversationId, userId }) => useConversationMessagesQuery(conversationId, userId),
      { 
        wrapper,
        initialProps: { conversationId: 'convo-1', userId: 'user-1' }
      }
    );
    
    await waitForNextUpdate();
    
    // Verify markConversationAsRead is called for first conversation
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1);
    expect(mockMarkAsRead).toHaveBeenCalledWith('convo-1', 'user-1');
    
    // Mock different messages for second conversation
    const convo2Messages = [
      { 
        id: 'msg-3', 
        conversation_id: 'convo-2', 
        sender_id: 'user-3',
        message_text: 'Hey',
        created_at: '2025-07-11T11:00:00Z',
        read_by_user_ids: []
      }
    ];
    mockGetMessages.mockResolvedValueOnce(convo2Messages);
    
    // Switch to second conversation
    rerender({ conversationId: 'convo-2', userId: 'user-1' });
    
    await waitForNextUpdate();
    
    // Verify markConversationAsRead is called for second conversation
    expect(mockMarkAsRead).toHaveBeenCalledTimes(2);
    expect(mockMarkAsRead).toHaveBeenCalledWith('convo-2', 'user-1');
    
    // Clear mock to check if it's called again
    mockMarkAsRead.mockClear();
    
    // Switch back to first conversation
    mockGetMessages.mockResolvedValueOnce(mockMessages);
    rerender({ conversationId: 'convo-1', userId: 'user-1' });
    
    await waitForNextUpdate();
    
    // Verify markConversationAsRead is called for first conversation again
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1);
    expect(mockMarkAsRead).toHaveBeenCalledWith('convo-1', 'user-1');
  });

  test('should not attempt to mark as read when userId is null', async () => {
    // Render the hook with null userId
    const { waitForNextUpdate } = renderHook(
      () => useConversationMessagesQuery('convo-1', null),
      { wrapper }
    );
    
    await waitForNextUpdate();
    
    // Verify markConversationAsRead is not called
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });

  test('should not attempt to mark as read when conversationId is null', async () => {
    // Render the hook with null conversationId
    renderHook(
      () => useConversationMessagesQuery(null, 'user-1'),
      { wrapper }
    );
    
    // No need to wait for update as query won't run with null conversationId
    
    // Verify markConversationAsRead is not called
    expect(mockMarkAsRead).not.toHaveBeenCalled();
    // Also verify getMessages is not called
    expect(mockGetMessages).not.toHaveBeenCalled();
  });

  test('should properly handle errors when marking conversation as read', async () => {
    // Mock error when marking as read
    const mockError = new Error('Failed to mark as read');
    mockMarkAsRead.mockRejectedValueOnce(mockError);
    
    // Spy on console.error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Render the hook
    const { waitForNextUpdate } = renderHook(
      () => useConversationMessagesQuery('convo-1', 'user-1'),
      { wrapper }
    );
    
    await waitForNextUpdate();
    
    // Verify markConversationAsRead was called
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1);
    
    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error marking conversation as read:',
      mockError
    );
    
    // Restore console.error
    consoleSpy.mockRestore();
  });
});
