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
}

// ---------------------------------------------------------------------------
//  Conversation functions
// ---------------------------------------------------------------------------

/**
 * Try to find an existing one-to-one (direct) conversation between two users.
 * @param userA First user id
 * @param userB Second user id
 * @returns conversation id or null if none exists
 */
export const findDirectConversation = async (
  userA: string,
  userB: string
): Promise<string | null> => {
  try {
    // Try to find in conversation_participants table (preferred approach)
    const { data: convoData, error: convoError } = await supabase
      .from('conversations')
      .select(`
        id,
        type,
        conversation_participants!inner(user_id)
      `)
      .eq('type', 'direct')
      .in('conversation_participants.user_id', [userA, userB]);

    if (convoError) {
      console.error('[messagingService/findDirectConversation] advanced lookup error', convoError);
      // Fall back to legacy approach
    } else {
      // Group results by conversation_id and count participants
      const conversationMatches = convoData
        .filter(convo => convo.conversation_participants.length === 2)
        .filter(convo => {
          // Check if both users are in this conversation
          const userIds = convo.conversation_participants.map((p: any) => p.user_id);
          return userIds.includes(userA) && userIds.includes(userB);
        });
      
      if (conversationMatches.length > 0) {
        return conversationMatches[0].id;
      }
    }

    // Legacy fallback: Look in messages table
    const { data: legacyData, error: legacyError } = await supabase
      .from('messages')
      .select('conversation_id')
      .or(`and(sender_id.eq.${userA},recipient_id.eq.${userB}),and(sender_id.eq.${userB},recipient_id.eq.${userA})`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (legacyError) {
      console.error('[messagingService/findDirectConversation] legacy error', legacyError);
      return null;
    }

    if (legacyData && legacyData.length > 0) {
      return legacyData[0].conversation_id;
    }

    return null;
  } catch (error) {
    console.error('[messagingService/findDirectConversation] exception', error);
    return null;
  }
};

/**
 * Create a direct conversation between two users.
 * This function creates the conversation record, adds participants,
 * but does NOT send any messages.
 * @param userA First user id
 * @param userB Second user id
 * @returns The conversation ID
 */
export const createDirectConversation = async (
  userA: string,
  userB: string
): Promise<string> => {
  try {
    // First check if conversation already exists
    const existingConversationId = await findDirectConversation(userA, userB);
    if (existingConversationId) {
      return existingConversationId;
    }
    
    // Create a new conversation
    const { data: conversationData, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        type: 'direct',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (conversationError || !conversationData) {
      console.error('[messagingService/createDirectConversation] conversation error', conversationError);
      throw new Error('Failed to create conversation');
    }
    
    const conversationId = conversationData.id;
    
    // Add participants
    const participants = [
      { conversation_id: conversationId, user_id: userA },
      { conversation_id: conversationId, user_id: userB }
    ];
    
    // Fetch user profiles to get display names and photos
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', [userA, userB]);
      
    if (profiles) {
      participants.forEach((p, i) => {
        const profile = profiles.find(prof => prof.id === p.user_id);
        if (profile) {
          participants[i] = {
            ...p,
            display_name: profile.full_name,
            photo_url: profile.avatar_url
          };
        }
      });
    }
    
    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert(participants);
      
    if (participantsError) {
      console.error('[messagingService/createDirectConversation] participants error', participantsError);
      // We created the conversation but failed to add participants
      // This is a partial failure, but we still return the conversation ID
      // A cleanup job could remove orphaned conversations
    }
    
    return conversationId;
  } catch (error) {
    console.error('[messagingService/createDirectConversation] exception', error);
    throw error;
  }
};

/**
 * Creates a group conversation for broadcasting messages.
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
    // Create a new group conversation
    const { data: conversationData, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        type: showId ? 'show' : 'group',
        show_id: showId || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (conversationError || !conversationData) {
      console.error('[messagingService/createGroupConversation] conversation error', conversationError);
      throw new Error('Failed to create group conversation');
    }
    
    const conversationId = conversationData.id;
    
    // Always include the creator in the participants list
    const allParticipantIds = [...new Set([creatorId, ...participants])];
    
    // Fetch user profiles for all participants
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', allParticipantIds);
    
    // Create participant records
    const participantRecords = allParticipantIds.map(userId => {
      const profile = profiles?.find(p => p.id === userId);
      return {
        conversation_id: conversationId,
        user_id: userId,
        display_name: profile?.full_name,
        photo_url: profile?.avatar_url,
        // Only the creator has read all messages initially
        unread_count: userId === creatorId ? 0 : 1
      };
    });
    
    // Insert all participants
    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert(participantRecords);
    
    if (participantsError) {
      console.error('[messagingService/createGroupConversation] participants error', participantsError);
      // Continue despite partial failure
    }
    
    return conversationId;
  } catch (error) {
    console.error('[messagingService/createGroupConversation] exception', error);
    throw error;
  }
};

/**
 * Start a new conversation from a profile view.
 * Creates the conversation if needed, sends the initial message,
 * and returns the conversation ID for navigation.
 * 
 * @param currentUserId The ID of the current user initiating the conversation
 * @param profileUserId The ID of the user whose profile is being viewed
 * @param initialMessage The first message to send
 * @returns Conversation ID for navigation
 */
export const startConversationFromProfile = async (
  currentUserId: string,
  profileUserId: string,
  initialMessage: string
): Promise<string> => {
  try {
    // Check if the recipient can receive messages
    const recipientRole = await userRoleService.getUserRole(profileUserId);
    if (!recipientRole) {
      throw new Error('User not found');
    }
    
    if (!userRoleService.IS_TEST_MODE && !userRoleService.canUserReceiveMessage(recipientRole)) {
      throw new Error('This user cannot receive messages due to their role');
    }
    
    // Create or find conversation
    const conversationId = await createDirectConversation(currentUserId, profileUserId);
    
    // Send initial message
    await sendMessage(currentUserId, profileUserId, initialMessage, conversationId);
    
    return conversationId;
  } catch (error) {
    console.error('[messagingService/startConversationFromProfile]', error);
    throw error;
  }
};

/**
 * Get all conversations for the current user
 * @param userId The ID of the current user
 * @returns Array of conversations with last message and unread count
 */
export const getConversations = async (userId: string): Promise<Conversation[]> => {
  try {
    // Try to use the RPC function first (most efficient)
    const { data: conversationsData, error: conversationsError } = await supabase
      .rpc('get_user_conversations', { user_id: userId });
      
    if (!conversationsError && conversationsData) {
      // console.log('Got conversations from RPC:', conversationsData);
      return conversationsData;
    }
    
    console.error('Error fetching conversations with RPC, falling back to query:', conversationsError);
    
    // Fallback to querying directly
    const { data: participationsData, error: participationsError } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        unread_count,
        conversations!inner(
          id, 
          type, 
          show_id, 
          last_message_text, 
          last_message_timestamp
        )
      `)
      .eq('user_id', userId);
      
    if (participationsError) {
      console.error('Error fetching conversations', participationsError);
      throw new Error('Failed to fetch conversations');
    }
    
    if (!participationsData || participationsData.length === 0) {
      return [];
    }
    
    // Get all conversation IDs
    const conversationIds = participationsData.map(p => p.conversation_id);
    
    // Get all participants for these conversations
    const { data: allParticipantsData, error: allParticipantsError } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        user_id,
        display_name,
        photo_url
      `)
      .in('conversation_id', conversationIds)
      .neq('user_id', userId);
      
    if (allParticipantsError) {
      console.error('Error fetching participants', allParticipantsError);
      // Continue with partial data
    }
    
    // Group participants by conversation
    const participantsByConversation: Record<string, any[]> = {};
    
    if (allParticipantsData) {
      allParticipantsData.forEach(participant => {
        if (!participantsByConversation[participant.conversation_id]) {
          participantsByConversation[participant.conversation_id] = [];
        }
        participantsByConversation[participant.conversation_id].push({
          user_id: participant.user_id,
          display_name: participant.display_name,
          photo_url: participant.photo_url
        });
      });
    }
    
    // Build conversations data structure
    const conversations: Conversation[] = participationsData.map(p => {
      const convo = p.conversations;
      return {
        id: convo.id,
        type: convo.type,
        show_id: convo.show_id,
        participant_count: (participantsByConversation[convo.id]?.length || 0) + 1, // +1 for self
        last_message_text: convo.last_message_text,
        last_message_timestamp: convo.last_message_timestamp,
        unread_count: p.unread_count || 0,
        participants: participantsByConversation[convo.id] || []
      };
    });
    
    // Sort by most recent message
    return conversations.sort((a, b) => {
      const timeA = a.last_message_timestamp ? new Date(a.last_message_timestamp).getTime() : 0;
      const timeB = b.last_message_timestamp ? new Date(b.last_message_timestamp).getTime() : 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error('Error in getConversations:', error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
//  Message functions
// ---------------------------------------------------------------------------

/**
 * Get messages for a specific conversation
 * @param conversationId The ID of the conversation
 * @returns Array of messages in the conversation
 */
export const getMessages = async (conversationId: string): Promise<Message[]> => {
  try {
    // Get messages with joined profiles
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        message_text,
        created_at,
        read_by_user_ids,
        profiles!sender_profile:sender_id(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('Error fetching messages:', error);
      throw new Error('Failed to fetch messages');
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getMessages:', error);
    throw error;
  }
};

/**
 * Send a new message in a conversation
 * @param senderId The ID of the sender
 * @param recipientId The ID of the recipient (for direct messages)
 * @param messageText The message content
 * @param conversationId The existing conversation ID (optional)
 * @returns The newly created message
 */
export const sendMessage = async (
  senderId: string,
  recipientId: string,
  messageText: string,
  conversationId?: string
): Promise<Message> => {
  try {
    // Ensure we have a conversation ID
    const finalConversationId = conversationId || await createDirectConversation(senderId, recipientId);
    
    // Insert the message
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: finalConversationId,
        sender_id: senderId,
        message_text: messageText,
        read_by_user_ids: [senderId] // Sender has automatically read their own message
      })
      .select()
      .single();
      
    if (messageError) {
      console.error('Error sending message:', messageError);
      throw new Error('Failed to send message');
    }
    
    // The conversation last message update and participant unread count
    // update should happen via database triggers, but we'll update manually
    // as a fallback in case the trigger fails
    try {
      // Update the conversation's last message info
      await supabase
        .from('conversations')
        .update({
          last_message_text: messageText,
          last_message_timestamp: new Date().toISOString()
        })
        .eq('id', finalConversationId);
        
      // Increment unread count for recipients
      await supabase
        .from('conversation_participants')
        .update({ unread_count: supabase.rpc('increment_unread') })
        .eq('conversation_id', finalConversationId)
        .neq('user_id', senderId);
    } catch (updateError) {
      console.error('Failed to update conversation metadata:', updateError);
      // Continue since the message was sent successfully
    }
    
    return newMessage;
  } catch (error) {
    console.error('Error in sendMessage:', error);
    throw error;
  }
};

/**
 * Send a message to a group conversation
 * @param senderId The ID of the sender
 * @param conversationId The ID of the group conversation
 * @param messageText The message content
 * @returns The newly created message
 */
export const sendGroupMessage = async (
  senderId: string,
  conversationId: string,
  messageText: string
): Promise<Message> => {
  try {
    // Check if the user is part of this conversation
    const { data: participantCheck, error: participantCheckError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', senderId)
      .single();
    
    if (participantCheckError || !participantCheck) {
      throw new Error('You are not a participant in this conversation');
    }
    
    // Insert the message
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message_text: messageText,
        read_by_user_ids: [senderId] // Sender has automatically read their own message
      })
      .select()
      .single();
      
    if (messageError) {
      console.error('Error sending group message:', messageError);
      throw new Error('Failed to send message');
    }
    
    // Update the conversation's last message info
    await supabase
      .from('conversations')
      .update({
        last_message_text: messageText,
        last_message_timestamp: new Date().toISOString()
      })
      .eq('id', conversationId);
      
    // Increment unread count for all other participants
    await supabase
      .from('conversation_participants')
      .update({ unread_count: supabase.rpc('increment_unread') })
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId);
    
    return newMessage;
  } catch (error) {
    console.error('Error in sendGroupMessage:', error);
    throw error;
  }
};

/**
 * Send a broadcast message to multiple recipients based on their roles.
 * This creates a group conversation and sends the initial message.
 * 
 * @param params Object containing senderId, message, recipientRoles, and optional showId
 * @returns The conversation ID of the newly created group
 */
export const sendBroadcastMessage = async (
  params: BroadcastMessageParams
): Promise<string> => {
  const { senderId, message, recipientRoles, showId } = params;
  
  try {
    // Check if sender has permission to broadcast
    const senderProfile = await userRoleService.getUserProfile(senderId);
    if (!senderProfile) {
      throw new Error('Sender profile not found');
    }
    
    const senderRole = senderProfile.role as UserRole;
    const canBroadcast = userRoleService.IS_TEST_MODE || 
                        senderRole === UserRole.SHOW_ORGANIZER || 
                        senderRole === UserRole.MVP_DEALER;
    
    if (!canBroadcast) {
      throw new Error('You do not have permission to send broadcast messages');
    }
    
    // Find all users with the specified roles
    const { data: recipients, error: recipientsError } = await supabase
      .from('profiles')
      .select('id, role')
      .in('role', recipientRoles);
    
    if (recipientsError) {
      throw new Error('Failed to find recipients');
    }
    
    if (!recipients || recipients.length === 0) {
      throw new Error('No recipients found for the selected roles');
    }
    
    // Filter out the sender from recipients to avoid duplicates
    const recipientIds = recipients
      .filter(user => user.id !== senderId)
      .map(user => user.id);
    
    if (recipientIds.length === 0) {
      throw new Error('No recipients to broadcast to after excluding yourself');
    }
    
    // Create a group conversation for the broadcast
    const conversationType = showId ? 'show' : 'group';
    const conversationName = showId ? 'Show Announcement' : 'Broadcast Message';
    
    const conversationId = await createGroupConversation(
      senderId,
      recipientIds,
      showId
    );
    
    // Send the initial message
    await sendGroupMessage(senderId, conversationId, message);
    
    return conversationId;
  } catch (error) {
    console.error('Error in sendBroadcastMessage:', error);
    throw error;
  }
};

/**
 * Mark a single message as read
 * @param messageId The ID of the message
 * @param userId The ID of the current user
 * @returns Boolean indicating success
 */
export const markMessageAsRead = async (
  messageId: string,
  userId: string
): Promise<boolean> => {
  try {
    // Check if the user is already in read_by_user_ids
    const { data: message } = await supabase
      .from('messages')
      .select('read_by_user_ids')
      .eq('id', messageId)
      .single();
      
    if (!message) {
      return false;
    }
    
    if (message.read_by_user_ids && message.read_by_user_ids.includes(userId)) {
      // Already marked as read
      return true;
    }
    
    // Update read_by_user_ids
    const { error } = await supabase
      .from('messages')
      .update({
        read_by_user_ids: [...(message.read_by_user_ids || []), userId]
      })
      .eq('id', messageId);
      
    if (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
    
    // Try to update unread count in conversation_participants
    try {
      const { data: msgData } = await supabase
        .from('messages')
        .select('conversation_id')
        .eq('id', messageId)
        .single();
        
      if (msgData) {
        await decrementUnreadCount(msgData.conversation_id, userId);
      }
    } catch (error) {
      console.error('Error updating unread count:', error);
      // Continue since the message was marked as read
    }
    
    return true;
  } catch (error) {
    console.error('Error in markMessageAsRead:', error);
    return false;
  }
};

/**
 * Mark all messages in a conversation as read
 * @param conversationId The ID of the conversation
 * @param userId The ID of the current user
 * @returns Number of messages marked as read
 */
export const markConversationAsRead = async (
  conversationId: string,
  userId: string
): Promise<number> => {
  try {
    // First get all unread messages in the conversation
    const { data: messages } = await supabase
      .from('messages')
      .select('id, read_by_user_ids')
      .eq('conversation_id', conversationId)
      .not('read_by_user_ids', 'cs', `{${userId}}`);
      
    if (!messages || messages.length === 0) {
      return 0;
    }
    
    // Update each message
    let updatedCount = 0;
    
    for (const message of messages) {
      const { error } = await supabase
        .from('messages')
        .update({
          read_by_user_ids: [...(message.read_by_user_ids || []), userId]
        })
        .eq('id', message.id);
        
      if (!error) {
        updatedCount++;
      }
    }
    
    // Reset unread count in conversation_participants
    if (updatedCount > 0) {
      await supabase
        .from('conversation_participants')
        .update({ unread_count: 0 })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
    }
    
    return updatedCount;
  } catch (error) {
    console.error('Error in markConversationAsRead:', error);
    throw error;
  }
};

/**
 * Helper function to decrement unread count for a user in a conversation
 */
const decrementUnreadCount = async (conversationId: string, userId: string): Promise<void> => {
  try {
    await supabase
      .from('conversation_participants')
      .update({ 
        unread_count: supabase.rpc('decrement_unread') 
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error decrementing unread count:', error);
  }
};

/**
 * Subscribe to realtime messages for a conversation
 * @param conversationId The conversation to monitor
 * @param onNewMessage Callback function when new messages arrive
 * @returns Supabase channel subscription that caller should unsubscribe from
 */
export const subscribeToMessages = (
  conversationId: string,
  onNewMessage: (message: Message) => void
) => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      onNewMessage(payload.new as unknown as Message);
    })
    .subscribe();
    
  return channel;
};

/**
 * Get total unread message count across all conversations
 * @param userId User ID to check for
 * @returns Total number of unread messages
 */
export const getTotalUnreadCount = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('conversation_participants')
      .select('unread_count')
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
    
    return data.reduce((total, item) => total + (item.unread_count || 0), 0);
  } catch (error) {
    console.error('Error in getTotalUnreadCount:', error);
    return 0;
  }
};
