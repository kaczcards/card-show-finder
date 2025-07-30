import { supabase } from '../supabase';
import * as userRoleService from './userRoleService';
import { UserRole } from './userRoleService';

// TypeScript interfaces for Messages and Conversations
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
  read_by_user_ids: string[];
  sender_profile?: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'show';
  show_id?: string;
  participant_count: number;
  last_message_text?: string;
  last_message_timestamp?: string;
  unread_count: number;
  participants: {
    user_id: string;
    display_name?: string;
    photo_url?: string;
  }[];
}

// Broadcast message parameters
export interface BroadcastMessageParams {
  senderId: string;
  message: string;
  recipientRoles: UserRole[];
  showId?: string;
  /**
   * Optional override to explicitly mark the broadcast
   * as pre-show (TRUE) or post-show (FALSE).  When omitted
   * the edge-function infers this from current date vs show date.
   */
  isPreShow?: boolean;
}

// ---------------------------------------------------------------------------
//  Conversation functions
// ---------------------------------------------------------------------------

/**
 * Try to find an existing one-to-one (direct) conversation between two users.
 * Uses the RPC function 'find_direct_conversation' for efficient database query.
 * 
 * @param userA First user id
 * @param userB Second user id
 * @returns conversation id or null if none exists
 */
export const findDirectConversation = async (
  userA: string,
  userB: string
): Promise<string | null> => {
  try {
    // Call the RPC function to find direct conversation
    const { data, error } = await supabase
      .rpc('find_direct_conversation', { 
        user_a: userA, 
        user_b: userB 
      });

    if (error) {
      console.error('[messagingService/findDirectConversation] RPC error:', error);
      return null;
    }

    // The RPC function returns the conversation ID or null
    return data;
  } catch (error) {
    console.error('[messagingService/findDirectConversation] exception:', error);
    return null;
  }
};

/**
 * Create a direct conversation between two users.
 * Uses the RPC function 'create_direct_conversation' to handle the complex transaction.
 * 
 * @param userA First user id
 * @param userB Second user id
 * @returns The new conversation id
 */
export const createDirectConversation = async (
  userA: string,
  userB: string
): Promise<string> => {
  try {
    // Call the RPC function to create direct conversation
    const { data, error } = await supabase
      .rpc('create_direct_conversation', {
        user_a: userA,
        user_b: userB
      });

    if (error) {
      console.error('[messagingService/createDirectConversation] RPC error:', error);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create conversation: No ID returned');
    }

    return data;
  } catch (error) {
    console.error('[messagingService/createDirectConversation] exception:', error);
    throw error;
  }
};

/**
 * Creates a group conversation for broadcasting messages.
 * Uses the RPC function 'create_group_conversation' to handle the complex transaction.
 * 
 * @param creatorId The ID of the user creating the group
 * @param participants Array of user IDs to include in the group 
 * @param showId Optional Show ID if this is a show-specific group
 * @returns The conversation ID
 */
export const createGroupConversation = async (
  creatorId: string,
  participants: string[],
  showId?: string
): Promise<string> => {
  try {
    // Call the RPC function to create group conversation
    const { data, error } = await supabase
      .rpc('create_group_conversation', {
        creator_id: creatorId,
        participant_ids: participants,
        show_id: showId || null
      });

    if (error) {
      console.error('[messagingService/createGroupConversation] RPC error:', error);
      throw new Error(`Failed to create group conversation: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create group conversation: No ID returned');
    }

    return data;
  } catch (error) {
    console.error('[messagingService/createGroupConversation] exception:', error);
    throw error;
  }
};

/**
 * Mark all messages in a conversation as read by a specific user.
 * Uses the RPC function 'mark_conversation_read' for efficient updates.
 * 
 * @param conversationId The conversation ID
 * @param userId The user ID marking messages as read
 * @returns Number of messages marked as read
 */
export const markConversationAsRead = async (
  conversationId: string,
  userId: string
): Promise<number> => {
  try {
    // Call the RPC function to mark conversation as read
    const { data, error } = await supabase
      .rpc('mark_conversation_read', {
        conversation_id: conversationId,
        user_id: userId
      });

    if (error) {
      console.error('[messagingService/markConversationAsRead] RPC error:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('[messagingService/markConversationAsRead] exception:', error);
    return 0;
  }
};

/**
 * Get detailed information about a conversation including participants and latest message.
 * Uses the RPC function 'get_conversation_with_participants' for efficient data retrieval.
 * 
 * @param conversationId The conversation ID
 * @param userId The current user ID requesting the details
 * @returns Conversation details or null if not found
 */
export const getConversationDetails = async (
  conversationId: string,
  userId: string
): Promise<Conversation | null> => {
  try {
    // Call the RPC function to get conversation details
    const { data, error } = await supabase
      .rpc('get_conversation_with_participants', {
        conversation_id: conversationId,
        current_user_id: userId
      });

    if (error) {
      console.error('[messagingService/getConversationDetails] RPC error:', error);
      return null;
    }

    if (!data || data.error) {
      console.error('[messagingService/getConversationDetails] Data error:', data?.error || 'No data returned');
      return null;
    }

    // Convert the JSONB response to our Conversation interface
    return data as Conversation;
  } catch (error) {
    console.error('[messagingService/getConversationDetails] exception:', error);
    return null;
  }
};

/**
 * Send a message in a conversation.
 * Uses query builder for simple insert operation.
 * 
 * @param conversationId The conversation ID
 * @param senderId The sender's user ID
 * @param messageText The message content
 * @returns The created message or null if failed
 */
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  messageText: string
): Promise<Message | null> => {
  try {
    // Create a new message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message_text: messageText,
        read_by_user_ids: [senderId]
      })
      .select('*')
      .single();

    if (error) {
      console.error('[messagingService/sendMessage] error:', error);
      return null;
    }

    // Update the conversation's updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data as Message;
  } catch (error) {
    console.error('[messagingService/sendMessage] exception:', error);
    return null;
  }
};

/**
 * Get messages for a specific conversation.
 * Uses query builder for simple select operation with pagination.
 * 
 * @param conversationId The conversation ID
 * @param limit Maximum number of messages to return
 * @param page Page number (1-based)
 * @returns Array of messages
 */
export const getMessages = async (
  conversationId: string,
  limit: number = 20,
  page: number = 1
): Promise<Message[]> => {
  try {
    const offset = (page - 1) * limit;
    
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[messagingService/getMessages] error:', error);
      return [];
    }

    // Map the result to our Message interface
    return data.map(item => ({
      id: item.id,
      conversation_id: item.conversation_id,
      sender_id: item.sender_id,
      message_text: item.message_text,
      created_at: item.created_at,
      read_by_user_ids: item.read_by_user_ids || [],
      sender_profile: item.sender
    }));
  } catch (error) {
    console.error('[messagingService/getMessages] exception:', error);
    return [];
  }
};

/**
 * Get all conversations for a user.
 * Uses query builder for simple select operation.
 * 
 * @param userId The user ID
 * @returns Array of conversations
 */
export const getConversations = async (
  userId: string
): Promise<Conversation[]> => {
  try {
    // This is a fallback if the RPC method fails
    // Normally, you should use the useConversationsQuery hook which uses the RPC function
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        conversation_participants!inner (
          user_id,
          display_name,
          photo_url
        )
      `)
      .eq('conversation_participants.user_id', userId);

    if (error) {
      console.error('[messagingService/getConversations] error:', error);
      return [];
    }

    // Process conversations to match our interface
    return data.map(convo => ({
      id: convo.id,
      type: convo.type,
      show_id: convo.show_id,
      participant_count: convo.conversation_participants.length,
      unread_count: 0, // Would need another query to get this accurately
      participants: convo.conversation_participants,
      last_message_text: '', // Would need another query to get this
      last_message_timestamp: convo.updated_at
    }));
  } catch (error) {
    console.error('[messagingService/getConversations] exception:', error);
    return [];
  }
};

/**
 * Send a broadcast message to multiple users based on their roles.
 * Uses edge function for complex processing.
 * 
 * @param params Broadcast message parameters
 * @returns Success status
 */
export const sendBroadcastMessage = async (
  params: BroadcastMessageParams
): Promise<boolean> => {
  try {
    // Call the edge function to handle broadcast message
    const { data, error } = await supabase.functions.invoke('broadcast-message', {
      body: params
    });

    if (error) {
      console.error('[messagingService/sendBroadcastMessage] error:', error);
      return false;
    }

    return data?.success || false;
  } catch (error) {
    console.error('[messagingService/sendBroadcastMessage] exception:', error);
    return false;
  }
};
