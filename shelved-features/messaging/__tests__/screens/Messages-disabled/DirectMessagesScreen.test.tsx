import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DirectMessagesScreen from '../../../src/screens/Messages/DirectMessagesScreen';
import { useAuth } from '../../../src/contexts/AuthContext';
import { ChatList } from '../../../src/components/Chat';

// Mock the dependencies
jest.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../src/components/Chat', () => ({
  ChatList: jest.fn(() => null),
}));

jest.mock('../../../src/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'user-1', username: 'testuser', role: 'attendee' }, error: null })),
        })),
      })),
    })),
  },
}));

// Navigation mock
const mockNavigation = {
  navigate: jest.fn(),
  setOptions: jest.fn(),
};

// Route params mock
const mockRoute = {
  params: {},
};

describe('DirectMessagesScreen', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default auth mock implementation
    (useAuth as jest.Mock).mockReturnValue({
      authState: {
        user: { id: 'user-1', email: 'test@example.com' },
      },
    });
    
    // Reset route params
    mockRoute.params = {};
  });

  test('renders correctly when user is logged in', () => {
    const { getByText } = render(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    expect(getByText('Messages')).toBeTruthy();
  });

  test('renders sign in message when user is not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      authState: { user: null },
    });
    
    const { getByText } = render(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    expect(getByText('Please sign in to use messages')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });

  test('navigates to Profile when Sign In button is pressed', () => {
    (useAuth as jest.Mock).mockReturnValue({
      authState: { user: null },
    });
    
    const { getByText } = render(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    fireEvent.press(getByText('Sign In'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Profile');
  });

  test('renders new conversation UI when showNewConversation is true', async () => {
    const { getByText } = render(
      <DirectMessagesScreen navigation={mockNavigation} route={{ params: { isNewConversation: true } }} />
    );
    
    await waitFor(() => {
      expect(getByText('New Message')).toBeTruthy();
      expect(getByText('Back to Messages')).toBeTruthy();
    });
  });

  test('passes stable function props to ChatList (wrapped in useCallback)', () => {
    // First render
    const { rerender } = render(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    // Get the props passed to ChatList on first render
    const firstRenderProps = (ChatList as jest.Mock).mock.calls[0][0];
    const firstHandleSelectConversation = firstRenderProps.onSelectConversation;
    const firstHandleCreateNewConversation = firstRenderProps.onCreateNewConversation;
    
    // Force a re-render
    rerender(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    // Get the props passed to ChatList on second render
    const secondRenderProps = (ChatList as jest.Mock).mock.calls[1][0];
    const secondHandleSelectConversation = secondRenderProps.onSelectConversation;
    const secondHandleCreateNewConversation = secondRenderProps.onCreateNewConversation;
    
    // If the functions are wrapped in useCallback, they should maintain referential equality
    expect(secondHandleSelectConversation).toBe(firstHandleSelectConversation);
    expect(secondHandleCreateNewConversation).toBe(firstHandleCreateNewConversation);
  });

  test('handleSelectConversation updates navigation title correctly', () => {
    // Render the component
    render(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    // Get the onSelectConversation function passed to ChatList
    const chatListProps = (ChatList as jest.Mock).mock.calls[0][0];
    const handleSelectConversation = chatListProps.onSelectConversation;
    
    // Call the function with a mock conversation
    const mockConversation = {
      id: 'convo-1',
      participants: [
        {
          user_id: 'user-2',
          display_name: 'John Doe',
        },
      ],
    };
    handleSelectConversation(mockConversation);
    
    // Check if navigation.setOptions was called with the correct title
    expect(mockNavigation.setOptions).toHaveBeenCalledWith({
      title: 'John Doe',
    });
  });

  test('handleSelectConversation uses fallback title when display_name is missing', () => {
    // Render the component
    render(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    // Get the onSelectConversation function passed to ChatList
    const chatListProps = (ChatList as jest.Mock).mock.calls[0][0];
    const handleSelectConversation = chatListProps.onSelectConversation;
    
    // Call the function with a mock conversation that has no display_name
    const mockConversation = {
      id: 'convo-1',
      participants: [
        {
          user_id: 'user-2',
          // No display_name
        },
      ],
    };
    handleSelectConversation(mockConversation);
    
    // Check if navigation.setOptions was called with the fallback title
    expect(mockNavigation.setOptions).toHaveBeenCalledWith({
      title: 'Conversation',
    });
  });

  test('handleCreateNewConversation sets showNewConversation to true', () => {
    // Render the component
    const { queryByText } = render(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    // Initially, the new message UI should not be visible
    expect(queryByText('New Message')).toBeFalsy();
    
    // Get the onCreateNewConversation function passed to ChatList
    const chatListProps = (ChatList as jest.Mock).mock.calls[0][0];
    const handleCreateNewConversation = chatListProps.onCreateNewConversation;
    
    // Call the function
    handleCreateNewConversation();
    
    // Now the new message UI should be visible
    expect(queryByText('New Message')).toBeTruthy();
  });

  test('functions remain stable even when props change', () => {
    // First render with initial route
    const { rerender } = render(
      <DirectMessagesScreen 
        navigation={mockNavigation} 
        route={mockRoute} 
      />
    );
    
    // Get the props passed to ChatList on first render
    const firstRenderProps = (ChatList as jest.Mock).mock.calls[0][0];
    const firstHandleSelectConversation = firstRenderProps.onSelectConversation;
    
    // Change the navigation prop
    const updatedNavigation = {
      ...mockNavigation,
      addListener: jest.fn(),
    };
    
    // Re-render with different navigation prop
    rerender(
      <DirectMessagesScreen 
        navigation={updatedNavigation} 
        route={mockRoute} 
      />
    );
    
    // Get the props passed to ChatList on second render
    const secondRenderProps = (ChatList as jest.Mock).mock.calls[1][0];
    const secondHandleSelectConversation = secondRenderProps.onSelectConversation;
    
    // The onCreateNewConversation function should remain stable (no dependencies)
    expect(secondRenderProps.onCreateNewConversation).toBe(firstRenderProps.onCreateNewConversation);
    
    // The onSelectConversation function might change because it depends on navigation
    // But this test verifies our implementation is correct either way
    if (updatedNavigation === mockNavigation) {
      // If navigation reference is the same, function should be the same
      expect(secondHandleSelectConversation).toBe(firstHandleSelectConversation);
    } else {
      // If navigation reference changed, function might change too (due to dependency)
      // This is expected behavior with useCallback when dependencies change
      expect(secondHandleSelectConversation).not.toBe(firstHandleSelectConversation);
    }
  });

  test('initialConversationId is passed correctly to ChatList', () => {
    // Set up route with initialConversationId
    const conversationId = 'test-conversation-id';
    mockRoute.params = { conversationId };
    
    // Render the component
    render(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    // Check if initialConversationId was passed to ChatList
    const chatListProps = (ChatList as jest.Mock).mock.calls[0][0];
    expect(chatListProps.initialConversationId).toBe(conversationId);
  });

  test('debug panel toggles when debug button is pressed', () => {
    // Render the component
    const { getByText, queryByText } = render(
      <DirectMessagesScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    // Debug panel should not be visible initially
    expect(queryByText('Debug Info')).toBeFalsy();
    
    // Find and press the debug button (it has an icon, so we'll need to find it by its role)
    const debugButton = getByText('Messages').parentElement?.querySelector('TouchableOpacity');
    fireEvent.press(debugButton);
    
    // Debug panel should now be visible
    expect(queryByText('Debug Info')).toBeTruthy();
    
    // Press the debug button again
    fireEvent.press(debugButton);
    
    // Debug panel should be hidden again
    expect(queryByText('Debug Info')).toBeFalsy();
  });
});
