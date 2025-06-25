import { supabase } from '../supabase';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
  read_by_user_ids: string[];
}

export type ConversationType = 'direct' | 'group' | 'show';

export interface ConversationParticipant {
  user_id: string;
  display_name?: string;
  photo_url?: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  show_id?: string;
  participant_count: number;
  last_message_text?: string;
  last_message_timestamp?: string;
  unread_count: number;
  participants: ConversationParticipant[];
}

/**
 * Get all conversations for the current user
 */
export const getConversations = async (userId: string): Promise<Conversation[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_conversations', { user_id: userId });

    if (error) {
      console.error('Error getting conversations:', error);
      throw new Error(error.message);
    }

    return data || [];
  } catch (error) {
    console.error('Exception in getConversations:', error);
    throw error;
  }
};

/**
 * Get messages for a specific conversation
 */
export const getMessages = async (conversationId: string): Promise<Message[]> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error getting messages:', error);
      throw new Error(error.message);
    }

    return data || [];
  } catch (error) {
    console.error('Exception in getMessages:', error);
    throw error;
  }
};

/**
 * Send a new message in an existing conversation
 */
export const sendMessage = async (
  conversationId: string, 
  senderId: string, 
  messageText: string
): Promise<Message> => {
  try {
    // Insert the message
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: senderId,
        message_text: messageText
      }])
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      throw new Error(error.message);
    }
    
    // Update the conversation's last message
    await supabase
      .from('conversations')
      .update({
        last_message_text: messageText,
        last_message_timestamp: new Date().toISOString()
      })
      .eq('id', conversationId);
    
    // Update unread counts for all participants except sender
    await supabase.rpc('update_participant_unread_counts', { 
      p_conversation_id: conversationId,
      p_sender_id: senderId
    });

    return data;
  } catch (error) {
    console.error('Exception in sendMessage:', error);
    throw error;
  }
};

/**
 * Create a new conversation with an initial message
 */
export const createConversation = async (
  type: ConversationType,
  userIds: string[],
  messageText: string,
  showId?: string
): Promise<string> => {
  try {
    const { data, error } = await supabase
      .rpc('create_conversation', {
        p_type: type,
        p_show_id: showId || null,
        p_user_ids: userIds,
        p_message_text: messageText
      });

    if (error) {
      console.error('Error creating conversation:', error);
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Exception in createConversation:', error);
    throw error;
  }
};

/**
 * Mark a single message as read
 */
export const markMessageAsRead = async (
  messageId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('mark_message_as_read', {
        p_message_id: messageId,
        p_user_id: userId
      });

    if (error) {
      console.error('Error marking message as read:', error);
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Exception in markMessageAsRead:', error);
    throw error;
  }
};

/**
 * Mark all messages in a conversation as read
 */
export const markConversationAsRead = async (
  conversationId: string,
  userId: string
): Promise<number> => {
  try {
    const { data, error } = await supabase
      .rpc('mark_conversation_as_read', {
        p_conversation_id: conversationId,
        p_user_id: userId
      });

    if (error) {
      console.error('Error marking conversation as read:', error);
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Exception in markConversationAsRead:', error);
    throw error;
  }
};

/**
 * Get all participants in a conversation
 */
export const getConversationParticipants = async (
  conversationId: string
): Promise<ConversationParticipant[]> => {
  try {
    const { data, error } = await supabase
      .from('conversation_participants')
      .select('user_id, display_name, photo_url')
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('Error getting conversation participants:', error);
      throw new Error(error.message);
    }

    return data || [];
  } catch (error) {
    console.error('Exception in getConversationParticipants:', error);
    throw error;
  }
};

/**
 * Add a participant to a conversation
 */
export const addParticipantToConversation = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('conversation_participants')
      .insert([{
        conversation_id: conversationId,
        user_id: userId
      }]);

    if (error) {
      console.error('Error adding participant:', error);
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Exception in addParticipantToConversation:', error);
    throw error;
  }
};

/**
 * Check if a user can send messages based on their role
 */
export const canSendMessages = async (userId: string): Promise<boolean> => {
  // All users can send messages in the current system
  return true;
};

/**
 * Check if a user can receive messages based on their role
 */
export const canReceiveMessages = async (userId: string): Promise<boolean> => {
  try {
    // Get the user's role from their profile
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error checking user role:', error);
      return false;
    }

    // In test mode, all users can receive messages
    const testMode = true;
    if (testMode) return true;

    // Only MVP_DEALER and SHOW_ORGANIZER can receive messages
    const role = data?.role?.toUpperCase() || '';
    return role === 'MVP_DEALER' || role === 'SHOW_ORGANIZER';
  } catch (error) {
    console.error('Exception in canReceiveMessages:', error);
    return false;
  }
};
