// src/services/storageService.js
import { initializeApp } from 'firebase/app';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { Alert } from 'react-native';

// Initialize Firebase (use your actual Firebase config)
const firebaseConfig = {
  apiKey: "AIzaSyBlEYZEDfYydaQw2FysfQIeroR_i6V5zuY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "card-show-finder",
  storageBucket: "card-show-finder.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase app if not already initialized
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  // App already initialized
  console.log("Firebase already initialized");
}

// Get Firebase Storage instance
const storage = getStorage(app);

/**
 * Convert a URI to a Blob
 * @param {string} uri - Image URI
 * @returns {Promise<Blob>} - Image Blob
 */
const uriToBlob = async (uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error('Error converting URI to Blob:', error);
    throw new Error('Failed to process image');
  }
};

/**
 * Generate a unique filename for an image
 * @param {string} userId - User ID
 * @param {string} prefix - Prefix for the filename
 * @returns {string} - Unique filename
 */
const generateUniqueFilename = (userId, prefix = 'image') => {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}_${userId}_${timestamp}_${random}.jpg`;
};

/**
 * Upload a show image to Firebase Storage
 * @param {string} imageUri - Image URI
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Success status and image URL or error
 */
export const uploadShowImage = async (imageUri, userId) => {
  try {
    if (!imageUri) {
      return { success: false, error: 'No image provided' };
    }

    // Generate a unique filename
    const filename = generateUniqueFilename(userId, 'show');
    
    // Create a reference to the file location
    const storageRef = ref(storage, `shows/${userId}/${filename}`);
    
    // Convert URI to Blob
    const blob = await uriToBlob(imageUri);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, blob);
    
    // Get the download URL
    const imageUrl = await getDownloadURL(snapshot.ref);
    
    return { success: true, imageUrl };
  } catch (error) {
    console.error('Error uploading show image:', error);
    return { success: false, error: error.message || 'Failed to upload image' };
  }
};

/**
 * Upload a profile image to Firebase Storage
 * @param {string} imageUri - Image URI
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Success status and image URL or error
 */
export const uploadProfileImage = async (imageUri, userId) => {
  try {
    if (!imageUri) {
      return { success: false, error: 'No image provided' };
    }

    // Generate a unique filename
    const filename = generateUniqueFilename(userId, 'profile');
    
    // Create a reference to the file location
    const storageRef = ref(storage, `profiles/${userId}/${filename}`);
    
    // Convert URI to Blob
    const blob = await uriToBlob(imageUri);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, blob);
    
    // Get the download URL
    const imageUrl = await getDownloadURL(snapshot.ref);
    
    return { success: true, imageUrl };
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return { success: false, error: error.message || 'Failed to upload image' };
  }
};

/**
 * Delete an image from Firebase Storage
 * @param {string} imageUrl - Image URL to delete
 * @returns {Promise<Object>} - Success status or error
 */
export const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl) {
      return { success: false, error: 'No image URL provided' };
    }

    // Create a reference to the file
    const imageRef = ref(storage, imageUrl);
    
    // Delete the file
    await deleteObject(imageRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting image:', error);
    return { success: false, error: error.message || 'Failed to delete image' };
  }
};

/**
 * Get a reference to a file in Firebase Storage
 * @param {string} path - Path to the file
 * @returns {Object} - Firebase Storage reference
 */
export const getStorageRef = (path) => {
  return ref(storage, path);
};
