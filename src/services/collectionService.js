// src/services/collectionService.js
import { getFirestore, doc, collection, addDoc, updateDoc, getDocs, query, where, arrayUnion } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Get Firebase instances
const db = getFirestore();
const storage = getStorage();

/**
 * Upload a card photo to Firebase Storage
 * @param {string} userId - The user's ID
 * @param {string} uri - The local URI of the image to upload
 * @returns {Promise<Object>} - Object with success status, URL, and any error
 */
export const uploadCardPhoto = async (userId, uri) => {
  try {
    // Convert URI to blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Create a unique filename
    const filename = `card_${Date.now()}`;
    const storageRef = ref(storage, `users/${userId}/cards/${filename}`);
    
    // Upload to Firebase Storage
    await uploadBytes(storageRef, blob);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    
    return { success: true, url: downloadURL, error: null };
  } catch (error) {
    console.error('Error uploading card photo:', error);
    return { success: false, url: null, error: error.message };
  }
};

/**
 * Save card metadata to Firestore
 * @param {string} userId - The user's ID
 * @param {Object} cardData - The card metadata
 * @returns {Promise<Object>} - Object with success status and any error
 */
export const saveCardToCollection = async (userId, cardData) => {
  try {
    // Add to the user's cards collection
    const cardsCollectionRef = collection(db, 'users', userId, 'cards');
    await addDoc(cardsCollectionRef, {
      ...cardData,
      createdAt: new Date()
    });
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error saving card to collection:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all cards in a user's collection
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Object with success status, cards array, and any error
 */
export const getUserCards = async (userId) => {
  try {
    const cardsCollectionRef = collection(db, 'users', userId, 'cards');
    const querySnapshot = await getDocs(cardsCollectionRef);
    
    const cards = [];
    querySnapshot.forEach((doc) => {
      cards.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, cards, error: null };
  } catch (error) {
    console.error('Error getting user cards:', error);
    return { success: false, cards: [], error: error.message };
  }
};

/**
 * Save an item to either the want list or for sale list
 * @param {string} userId - The user's ID
 * @param {string} listType - Either 'want' or 'sale'
 * @param {Object} item - The item data to save
 * @returns {Promise<Object>} - Object with success status and any error
 */
export const saveListItem = async (userId, listType, item) => {
  try {
    const collectionName = listType === 'want' ? 'wantList' : 'forSale';
    const listCollectionRef = collection(db, 'users', userId, collectionName);
    
    await addDoc(listCollectionRef, {
      ...item,
      createdAt: new Date()
    });
    
    return { success: true, error: null };
  } catch (error) {
    console.error(`Error saving item to ${listType} list:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all items in a user's want list
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Object with success status, items array, and any error
 */
export const getUserWantList = async (userId) => {
  try {
    const wantListRef = collection(db, 'users', userId, 'wantList');
    const querySnapshot = await getDocs(wantListRef);
    
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, items, error: null };
  } catch (error) {
    console.error('Error getting user want list:', error);
    return { success: false, items: [], error: error.message };
  }
};

/**
 * Get all items in a user's for sale list
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Object with success status, items array, and any error
 */
export const getUserForSaleList = async (userId) => {
  try {
    const forSaleRef = collection(db, 'users', userId, 'forSale');
    const querySnapshot = await getDocs(forSaleRef);
    
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, items, error: null };
  } catch (error) {
    console.error('Error getting user for sale list:', error);
    return { success: false, items: [], error: error.message };
  }
};

/**
 * Get all items a user is looking for or selling that are visible to dealers
 * at a specific show the user is attending
 * @param {string} showId - The ID of the show
 * @param {string} listType - Either 'want' or 'sale'
 * @returns {Promise<Object>} - Object with success status, items array, and any error
 */
export const getAttendeeListForShow = async (showId, listType) => {
  try {
    // Get all users who have favorited this show (indicating attendance)
    const usersRef = collection(db, 'users');
    const attendingQuery = query(
      usersRef, 
      where('favoriteShows', 'array-contains', showId)
    );
    
    const attendingUsers = await getDocs(attendingQuery);
    
    // For each attending user, get their want/sale list
    const allItems = [];
    
    for (const userDoc of attendingUsers.docs) {
      const userId = userDoc.id;
      const userName = userDoc.data().firstName || 'Anonymous User';
      
      const collectionName = listType === 'want' ? 'wantList' : 'forSale';
      const listRef = collection(db, 'users', userId, collectionName);
      const itemsSnapshot = await getDocs(listRef);
      
      itemsSnapshot.forEach((doc) => {
        allItems.push({
          id: doc.id,
          userId,
          userName,
          ...doc.data()
        });
      });
    }
    
    return { success: true, items: allItems, error: null };
  } catch (error) {
    console.error(`Error getting ${listType} list for show:`, error);
    return { success: false, items: [], error: error.message };
  }
};

/**
 * Delete an item from a user's list
 * @param {string} userId - The user's ID
 * @param {string} listType - Either 'want', 'sale', or 'cards'
 * @param {string} itemId - The ID of the item to delete
 * @returns {Promise<Object>} - Object with success status and any error
 */
export const deleteListItem = async (userId, listType, itemId) => {
  try {
    let collectionName;
    
    switch (listType) {
      case 'want':
        collectionName = 'wantList';
        break;
      case 'sale':
        collectionName = 'forSale';
        break;
      case 'cards':
        collectionName = 'cards';
        break;
      default:
        throw new Error('Invalid list type');
    }
    
    const itemRef = doc(db, 'users', userId, collectionName, itemId);
    await updateDoc(itemRef, { deleted: true });
    
    return { success: true, error: null };
  } catch (error) {
    console.error(`Error deleting item from ${listType} list:`, error);
    return { success: false, error: error.message };
  }
};
