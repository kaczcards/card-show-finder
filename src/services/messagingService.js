// src/services/messagingService.js
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  updateDoc,
  arrayUnion,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Get Firestore instance
const db = getFirestore();
const auth = getAuth();

/**
 * Create a new conversation or get an existing one between two users
 * @param {string} userId - The current user's ID
 * @param {string} recipientId - The recipient's ID
 * @param {string} showId - Optional ID of the show this conversation is about
 * @returns {Promise<Object>} - Object with conversation ID and any error
 */
export const getOrCreateConversation = async (userId, recipientId, showId = null) => {
  try {
    // Check if conversation already exists
    const conversationsRef = collection(db, 'conversations');
    
    // Query for conversations where both users are participants
    const q1 = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      where('participantIds', 'array-contains', recipientId)
    );
    
    const querySnapshot = await getDocs(q1);
    
    // If conversation exists, return it
    if (!querySnapshot.empty) {
      // If multiple conversations exist (shouldn't happen), return the first one
      const conversationDoc = querySnapshot.docs[0];
      return { 
        conversationId: conversationDoc.id, 
        conversation: conversationDoc.data(),
        error: null 
      };
    }
    
    // Get user data for both participants
    const userDoc = await getDoc(doc(db, 'users', userId));
    const recipientDoc = await getDoc(doc(db, 'users', recipientId));
    
    if (!userDoc.exists() || !recipientDoc.exists()) {
      return { conversationId: null, error: 'One or both users not found' };
    }
    
    const userData = userDoc.data();
    const recipientData = recipientDoc.data();
    
    // Create new conversation
    const newConversation = {
      participants: [
        {
          id: userId,
          name: userData.firstName || 'User',
          role: userData.role || 'attendee',
          photoURL: userData.photoURL || null
        },
        {
          id: recipientId,
          name: recipientData.firstName || 'User',
          role: recipientData.role || 'attendee',
          photoURL: recipientData.photoURL || null
        }
      ],
      participantIds: [userId, recipientId], // For easier querying
      lastMessage: null,
      lastMessageTimestamp: null,
      unreadCount: {
        [userId]: 0,
        [recipientId]: 0
      },
      createdAt: Timestamp.now(),
      showId: showId, // Can be null if not related to a specific show
    };
    
    const conversationRef = await addDoc(conversationsRef, newConversation);
    
    return { 
      conversationId: conversationRef.id, 
      conversation: newConversation,
      error: null 
    };
  } catch (error) {
    console.error('Error creating conversation:', error);
    return { conversationId: null, error: error.message };
  }
};

/**
 * Send a message in a conversation
 * @param {string} conversationId - The ID of the conversation
 * @param {string} senderId - The sender's user ID
 * @param {string} text - The message text
 * @param {Object} additionalData - Optional additional data for the message
 * @returns {Promise<Object>} - Object with success status and any error
 */
export const sendMessage = async (conversationId, senderId, text, additionalData = {}) => {
  try {
    // Get the conversation to find recipient
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      return { success: false, error: 'Conversation not found' };
    }
    
    const conversation = conversationDoc.data();
    
    // Find the recipient (the other user in the conversation)
    const recipientParticipant = conversation.participants.find(p => p.id !== senderId);
    if (!recipientParticipant) {
      return { success: false, error: 'Recipient not found in conversation' };
    }
    
    // Check if recipient is a dealer or show organizer (MVP users)
    // If not, we need to check if the sender is, as only MVP users can send messages
    const senderParticipant = conversation.participants.find(p => p.id === senderId);
    const recipientRole = recipientParticipant.role;
    const senderRole = senderParticipant.role;
    
    // If neither user is a dealer or show organizer, don't allow messaging
    // (except for initial message from attendee to dealer)
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    const isFirstMessage = messagesSnapshot.empty;
    
    if (!isFirstMessage && 
        recipientRole !== 'dealer' && 
        recipientRole !== 'showOrganizer' && 
        senderRole !== 'dealer' && 
        senderRole !== 'showOrganizer') {
      return { 
        success: false, 
        error: 'Messaging is only available for MVP Dealers and Show Organizers' 
      };
    }
    
    // Create the message
    const message = {
      senderId,
      text,
      timestamp: Timestamp.now(),
      read: false,
      ...additionalData
    };
    
    // Add message to the conversation's messages subcollection
    const messageRef = await addDoc(
      collection(db, 'conversations', conversationId, 'messages'),
      message
    );
    
    // Update the conversation with the last message
    await updateDoc(conversationRef, {
      lastMessage: text,
      lastMessageTimestamp: message.timestamp,
      [`unreadCount.${recipientParticipant.id}`]: conversation.unreadCount[recipientParticipant.id] + 1
    });
    
    // Send notification to recipient (implementation depends on notification system)
    await sendMessageNotification(recipientParticipant.id, senderParticipant.name, text);
    
    return { success: true, messageId: messageRef.id, error: null };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all messages for a conversation
 * @param {string} conversationId - The ID of the conversation
 * @param {number} limit - Optional limit on the number of messages to retrieve
 * @returns {Promise<Object>} - Object with messages array and any error
 */
export const getMessages = async (conversationId, messageLimit = 50) => {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(messageLimit));
    
    const querySnapshot = await getDocs(q);
    
    const messages = [];
    querySnapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() // Convert Firestore timestamp to JS Date
      });
    });
    
    // Return in chronological order (oldest first)
    return { messages: messages.reverse(), error: null };
  } catch (error) {
    console.error('Error getting messages:', error);
    return { messages: [], error: error.message };
  }
};

/**
 * Set up a real-time listener for new messages in a conversation
 * @param {string} conversationId - The ID of the conversation
 * @param {Function} callback - Callback function to handle new messages
 * @returns {Function} - Unsubscribe function to stop listening
 */
export const subscribeToMessages = (conversationId, callback) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(30));
  
  return onSnapshot(q, (querySnapshot) => {
    const messages = [];
    querySnapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      });
    });
    
    callback(messages.reverse());
  }, (error) => {
    console.error('Error subscribing to messages:', error);
    callback([]);
  });
};

/**
 * Get all conversations for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Object with conversations array and any error
 */
export const getConversations = async (userId) => {
  try {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participantIds', 'array-contains', userId),
      orderBy('lastMessageTimestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const conversations = [];
    querySnapshot.forEach((doc) => {
      conversations.push({
        id: doc.id,
        ...doc.data(),
        lastMessageTimestamp: doc.data().lastMessageTimestamp?.toDate()
      });
    });
    
    return { conversations, error: null };
  } catch (error) {
    console.error('Error getting conversations:', error);
    return { conversations: [], error: error.message };
  }
};

/**
 * Mark messages in a conversation as read
 * @param {string} conversationId - The ID of the conversation
 * @param {string} userId - The ID of the user marking messages as read
 * @returns {Promise<Object>} - Object with success status and any error
 */
export const markMessagesAsRead = async (conversationId, userId) => {
  try {
    // Update the conversation's unread count for this user
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      [`unreadCount.${userId}`]: 0
    });
    
    // Get all unread messages sent to this user
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef,
      where('senderId', '!=', userId),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Mark each message as read
    const batch = [];
    querySnapshot.forEach((doc) => {
      const messageRef = doc.ref;
      batch.push(updateDoc(messageRef, { read: true }));
    });
    
    // Execute all updates
    await Promise.all(batch);
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get the total number of unread messages for a user across all conversations
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Object with unread count and any error
 */
export const getUnreadMessageCount = async (userId) => {
  try {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participantIds', 'array-contains', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    let totalUnread = 0;
    querySnapshot.forEach((doc) => {
      const conversation = doc.data();
      if (conversation.unreadCount && conversation.unreadCount[userId]) {
        totalUnread += conversation.unreadCount[userId];
      }
    });
    
    return { count: totalUnread, error: null };
  } catch (error) {
    console.error('Error getting unread message count:', error);
    return { count: 0, error: error.message };
  }
};

/**
 * Send a notification when a message is received
 * @param {string} userId - The recipient's user ID
 * @param {string} senderName - The sender's name
 * @param {string} messageText - The message text (preview)
 * @returns {Promise<Object>} - Object with success status and any error
 */
export const sendMessageNotification = async (userId, senderName, messageText) => {
  try {
    // Get the user's notification preferences
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { success: false, error: 'User not found' };
    }
    
    const userData = userDoc.data();
    
    // Check if the user has enabled message notifications
    if (!userData.notificationPreferences?.showAlerts) {
      return { success: true, notificationSent: false, error: null };
    }
    
    // Create a notification in the user's notifications collection
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    await addDoc(notificationsRef, {
      type: 'message',
      title: `New message from ${senderName}`,
      body: messageText.length > 50 ? `${messageText.substring(0, 50)}...` : messageText,
      timestamp: Timestamp.now(),
      read: false,
      data: {
        senderName
      }
    });
    
    // TODO: Implement push notification using Firebase Cloud Messaging
    // This would require additional setup and a separate cloud function
    
    return { success: true, notificationSent: true, error: null };
  } catch (error) {
    console.error('Error sending message notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if a user can send messages (only dealers and show organizers can respond)
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Object with canSend status and any error
 */
export const canSendMessages = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { canSend: false, error: 'User not found' };
    }
    
    const userData = userDoc.data();
    const role = userData.role;
    
    // Only dealers and show organizers can send messages (after the initial message)
    const canSend = role === 'dealer' || role === 'showOrganizer';
    
    return { canSend, error: null };
  } catch (error) {
    console.error('Error checking message permissions:', error);
    return { canSend: false, error: error.message };
  }
};

/**
 * Get all dealers for a specific show that an attendee can message
 * @param {string} showId - The ID of the show
 * @returns {Promise<Object>} - Object with dealers array and any error
 */
export const getDealersForShow = async (showId) => {
  try {
    // Get all users who are dealers and have favorited this show
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', 'in', ['dealer', 'showOrganizer']),
      where('favoriteShows', 'array-contains', showId)
    );
    
    const querySnapshot = await getDocs(q);
    
    const dealers = [];
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      dealers.push({
        id: doc.id,
        name: userData.firstName || 'Dealer',
        role: userData.role,
        photoURL: userData.photoURL || null
      });
    });
    
    return { dealers, error: null };
  } catch (error) {
    console.error('Error getting dealers for show:', error);
    return { dealers: [], error: error.message };
  }
};
