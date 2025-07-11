import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import * as messagingService from '../services/messagingService';
import { Message } from '../services/messagingService';

/**
 * Custom hook for fetching and managing messages for a specific conversation with React Query
 * Includes real-time updates and optimized data fetching
 */
export const useConversationMessagesQuery = (
  conversationId: string | null,
  userId: string | null
) => {
  const queryClient = useQueryClient();
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Main query to fetch messages for the conversation
  const {
    data: messages,
    isLoading,
    error,
    refetch
  } = useQuery<Message[], Error>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      try {
        // Use the RPC function for optimized fetching
        const { data, error } = await supabase
          .rpc('get_conversation_messages', { p_conversation_id: conversationId });
          
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error fetching messages with RPC, falling back to service:', err);
        // Fallback to the service method if RPC fails
        return await messagingService.getMessages(conversationId);
      }
    },
    enabled: !!conversationId,
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
    cacheTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });

  // Setup real-time subscription for new messages in this conversation
  useEffect(() => {
    if (!conversationId || isSubscribed) return;

    // Subscribe to messages table for real-time updates for this conversation
    const channel = messagingService.subscribeToMessages(
      conversationId,
      (newMessage) => {
        // Update the messages cache when a new message arrives
        queryClient.setQueryData(['messages', conversationId], (oldData: Message[] | undefined) => {
          if (!oldData) return [newMessage];
          
          // Check if message already exists to prevent duplicates
          if (oldData.some(msg => msg.id === newMessage.id)) {
            return oldData;
          }
          
          return [...oldData, newMessage];
        });
        
        // If the message is from someone else, mark it as read
        if (userId && newMessage.sender_id !== userId) {
          messagingService.markMessageAsRead(newMessage.id, userId);
        }
      }
    );

    setIsSubscribed(true);

    // Cleanup subscription on unmount
    return () => {
      channel.unsubscribe();
      setIsSubscribed(false);
    };
  }, [conversationId, queryClient, userId, isSubscribed]);

  // Automatically mark conversation as read when viewing it
  useEffect(() => {
    if (conversationId && userId && messages && messages.length > 0) {
      messagingService.markConversationAsRead(conversationId, userId)
        .then(() => {
          // Update the conversations list to reflect read status
          queryClient.invalidateQueries({
            queryKey: ['conversations', userId],
          });
        })
        .catch(err => console.error('Error marking conversation as read:', err));
    }
  }, [conversationId, userId, messages, queryClient]);

  // Mutation for sending a new message
  const sendMessageMutation = useMutation({
    mutationFn: async ({ messageText }: { messageText: string }) => {
      if (!userId || !conversationId) throw new Error('Missing required parameters');
      
      // Get the conversation to find the recipient
      const conversation = queryClient.getQueryData<any>(['conversation', conversationId]);
      const recipientId = conversation?.participants?.[0]?.user_id || '';
      
      if (conversation?.type === 'direct' || !conversation?.type) {
        return await messagingService.sendMessage(userId, recipientId, messageText, conversationId);
      } else {
        return await messagingService.sendGroupMessage(userId, conversationId, messageText);
      }
    },
    onMutate: async ({ messageText }) => {
      if (!userId || !conversationId) return;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      
      // Create optimistic message
      const optimisticMessage: Partial<Message> = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: userId,
        message_text: messageText,
        created_at: new Date().toISOString(),
        read_by_user_ids: [userId],
        sender_profile: {
          id: userId
        }
      };
      
      // Add optimistic message to the messages list
      queryClient.setQueryData(['messages', conversationId], (oldData: Message[] | undefined) => {
        if (!oldData) return [optimisticMessage as Message];
        return [...oldData, optimisticMessage as Message];
      });
      
      return { optimisticMessage };
    },
    onSuccess: (newMessage, _, context) => {
      if (!conversationId) return;
      
      // Replace optimistic message with the real one
      queryClient.setQueryData(['messages', conversationId], (oldData: Message[] | undefined) => {
        if (!oldData) return [newMessage];
        
        return oldData.map(message => 
          message.id === (context?.optimisticMessage as Message)?.id ? newMessage : message
        );
      });
      
      // Update the conversations list with the new message
      queryClient.invalidateQueries({
        queryKey: ['conversations', userId],
      });
    },
    onError: (_, __, context) => {
      if (!conversationId) return;
      
      // Remove the optimistic message on error
      queryClient.setQueryData(['messages', conversationId], (oldData: Message[] | undefined) => {
        if (!oldData) return [];
        
        return oldData.filter(message => 
          message.id !== (context?.optimisticMessage as Message)?.id
        );
      });
    }
  });

  // Check if all messages have been read
  const allMessagesRead = messages?.every(message => 
    message.read_by_user_ids?.includes(userId || '')
  ) || false;

  return {
    messages: messages || [],
    isLoading,
    error,
    refetch,
    allMessagesRead,
    sendMessage: (messageText: string) => sendMessageMutation.mutate({ messageText }),
    isSending: sendMessageMutation.isPending
  };
};
