import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import * as messagingService from '../services/messagingService';
import { Conversation, Message } from '../services/messagingService';

/**
 * Custom hook for fetching and managing user conversations with React Query
 * Includes real-time updates and optimized data fetching
 * 
 * Integration with PostgreSQL RPC functions:
 * - Uses 'get_user_conversations' RPC function with 'input_user_id' parameter
 * - Defined in migration: 20250711121000_create_conversations_rpc.sql
 * - Falls back to messagingService.getConversations() if RPC fails
 */
export const useConversationsQuery = (userId: string | null) => {
  const queryClient = useQueryClient();
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Main query to fetch conversations
  const {
    data: conversations,
    isLoading,
    error: rawError,
    refetch
  } = useQuery<Conversation[], Error>({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        // 1. Attempt optimized RPC
        // This calls the PostgreSQL function 'get_user_conversations' defined in
        // migration 20250711121000_create_conversations_rpc.sql
        const { data, error } = await supabase
          .rpc('get_user_conversations', { 
            // Parameter name must match the SQL function parameter
            input_user_id: userId 
          });

        if (error) {
          console.warn('[useConversationsQuery] RPC error:', error.message);
          throw error;
        }

        // Validate returned data structure
        if (data && Array.isArray(data)) {
          // Verify the data has the expected structure
          if (data.length > 0 && !data[0].id) {
            console.warn('[useConversationsQuery] RPC returned unexpected data structure:', data[0]);
            throw new Error('Invalid data structure returned from RPC');
          }
          return data as Conversation[];
        }

        // Defensive fallback (should not typically run)
        console.warn('[useConversationsQuery] RPC returned no data, falling back to service');
        return await messagingService.getConversations(userId);
      } catch (err) {
        // Log and fallback to legacy service
        /* eslint-disable no-console */
        console.warn(
          '[useConversationsQuery] RPC failed, falling back to service:',
          err,
        );
        /* eslint-enable no-console */
        return await messagingService.getConversations(userId);
      }
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    cacheTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    // Automatically retry (with exponential back-off) a few times
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30_000),
    // Log the error for observability
    onError: (err) => {
      /* eslint-disable no-console */
      console.error('[useConversationsQuery] fetch error:', err);
      /* eslint-enable no-console */
    },
  });

  /**
   * Provide a simplified / structured error for consumers
   * while also allowing access to the raw Error object.
   */
  const formattedError = rawError
    ? {
        message: rawError.message,
        retry: () => refetch(),
      }
    : null;

  // Setup real-time subscription for new messages
  useEffect(() => {
    if (!userId || isSubscribed) return;

    // Subscribe to messages table for real-time updates
    const subscription = supabase
      .channel('public:messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const newMessage = payload.new as unknown as Message;
        
        // Update the conversations cache when a new message arrives
        queryClient.invalidateQueries({
          queryKey: ['conversations', userId],
        });
        
        // If we're viewing a specific conversation, also update its messages
        queryClient.invalidateQueries({
          queryKey: ['messages', newMessage.conversation_id],
        });
      })
      .subscribe();

    setIsSubscribed(true);

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(subscription);
      setIsSubscribed(false);
    };
  }, [userId, queryClient, isSubscribed]);

  // Mutation for marking a conversation as read
  const markAsReadMutation = useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      if (!userId) throw new Error('User not authenticated');
      return await messagingService.markConversationAsRead(conversationId, userId);
    },
    onSuccess: (_, variables) => {
      // Update the conversations cache to reflect read status
      queryClient.setQueryData(['conversations', userId], (oldData: Conversation[] | undefined) => {
        if (!oldData) return [];
        
        return oldData.map(conversation => {
          if (conversation.id === variables.conversationId) {
            return {
              ...conversation,
              unread_count: 0
            };
          }
          return conversation;
        });
      });
    }
  });

  // Mutation for sending a new message
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      conversationId,
      messageText
    }: {
      conversationId: string;
      messageText: string;
    }) => {
      if (!userId) throw new Error('User not authenticated');
      
      // Get the conversation to find the recipient
      const conversation = conversations?.find(c => c.id === conversationId);
      if (!conversation) throw new Error('Conversation not found');
      
      // For direct messages, find the other participant
      const recipientId = conversation.participants?.[0]?.user_id || '';
      
      if (conversation.type === 'direct') {
        return await messagingService.sendMessage(userId, recipientId, messageText, conversationId);
      } else {
        return await messagingService.sendGroupMessage(userId, conversationId, messageText);
      }
    },
    onSuccess: (_, variables) => {
      // Optimistically update the conversations list with the new message
      queryClient.setQueryData(['conversations', userId], (oldData: Conversation[] | undefined) => {
        if (!oldData) return [];
        
        return oldData.map(conversation => {
          if (conversation.id === variables.conversationId) {
            return {
              ...conversation,
              last_message_text: variables.messageText,
              last_message_timestamp: new Date().toISOString()
            };
          }
          return conversation;
        }).sort((a, b) => {
          // Sort by most recent message
          const timeA = a.last_message_timestamp ? new Date(a.last_message_timestamp).getTime() : 0;
          const timeB = b.last_message_timestamp ? new Date(b.last_message_timestamp).getTime() : 0;
          return timeB - timeA;
        });
      });
      
      // Also update the messages for this conversation
      queryClient.invalidateQueries({
        queryKey: ['messages', variables.conversationId],
      });
    }
  });

  // Mutation for creating a new conversation
  const createConversationMutation = useMutation({
    mutationFn: async ({
      recipientId,
      initialMessage
    }: {
      recipientId: string;
      initialMessage: string;
    }) => {
      if (!userId) throw new Error('User not authenticated');
      return await messagingService.startConversationFromProfile(userId, recipientId, initialMessage);
    },
    onSuccess: () => {
      // Refresh the conversations list
      refetch();
    }
  });

  // Get total unread count across all conversations
  const totalUnreadCount = conversations?.reduce(
    (total, conversation) => total + (conversation.unread_count || 0),
    0
  ) || 0;

  return {
    conversations: conversations || [],
    isLoading,
    error: formattedError,
    refetch,
    totalUnreadCount,
    markConversationAsRead: (conversationId: string) => 
      markAsReadMutation.mutate({ conversationId }),
    sendMessage: (conversationId: string, messageText: string) => 
      sendMessageMutation.mutate({ conversationId, messageText }),
    createConversation: (recipientId: string, initialMessage: string) => 
      createConversationMutation.mutate({ recipientId, initialMessage }),
    isSending: sendMessageMutation.isPending,
    isCreating: createConversationMutation.isPending
  };
};
