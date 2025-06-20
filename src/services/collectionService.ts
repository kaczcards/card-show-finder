import { supabase } from '../supabase';
import { UserCard, WantList, UserRole } from '../types';

/**
 * Collection Service
 * Handles operations related to user card collections and want lists
 */

// ======== User Card Collection Functions ========

/**
 * Get all cards for a specific user
 * @param userId The ID of the user whose cards to fetch
 * @returns An array of UserCard objects
 */
export const getUserCards = async (userId: string): Promise<{ data: UserCard[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('user_cards')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching user cards:', error);
    return { data: null, error };
  }
};

/**
 * Add a new card to the user's collection
 * Enforces a maximum of 10 cards per user
 * @param userId The ID of the user adding the card
 * @param cardData The card data to add
 * @returns The newly created UserCard object
 */
export const addUserCard = async (
  userId: string, 
  cardData: Omit<UserCard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<{ data: UserCard | null; error: any }> => {
  try {
    // First check if the user already has 10 cards
    const { data: existingCards, error: countError } = await getUserCards(userId);
    
    if (countError) throw countError;
    
    if (existingCards && existingCards.length >= 10) {
      return { 
        data: null, 
        error: new Error('Maximum card limit reached (10). Please remove a card before adding a new one.') 
      };
    }
    
    // Upload the card image to storage if it's a base64 string
    let imageUrl = cardData.imageUrl;
    if (imageUrl.startsWith('data:image')) {
      const fileName = `card_${userId}_${Date.now()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('card_images')
        .upload(fileName, Buffer.from(imageUrl.split(',')[1], 'base64'), {
          contentType: 'image/jpeg'
        });
      
      if (uploadError) throw uploadError;
      
      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('card_images')
        .getPublicUrl(fileName);
      
      imageUrl = publicUrlData.publicUrl;
    }
    
    // Add the card to the database
    const { data, error } = await supabase
      .from('user_cards')
      .insert([{
        userId,
        imageUrl,
        title: cardData.title || '',
        description: cardData.description || '',
        category: cardData.category || '',
        isCompressed: cardData.isCompressed || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error adding user card:', error);
    return { data: null, error };
  }
};

/**
 * Delete a card from the user's collection
 * @param cardId The ID of the card to delete
 * @param userId The ID of the user (for verification)
 * @returns Success status
 */
export const deleteUserCard = async (
  cardId: string,
  userId: string
): Promise<{ success: boolean; error: any }> => {
  try {
    // Verify the card belongs to the user
    const { data: card, error: fetchError } = await supabase
      .from('user_cards')
      .select('imageUrl')
      .eq('id', cardId)
      .eq('userId', userId)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (!card) {
      return { success: false, error: new Error('Card not found or you do not have permission to delete it') };
    }
    
    // Delete the card from the database
    const { error } = await supabase
      .from('user_cards')
      .delete()
      .eq('id', cardId)
      .eq('userId', userId);
    
    if (error) throw error;
    
    // Delete the image from storage if it's stored in Supabase
    if (card.imageUrl && card.imageUrl.includes('card_images')) {
      const fileName = card.imageUrl.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('card_images')
          .remove([fileName]);
      }
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting user card:', error);
    return { success: false, error };
  }
};

/**
 * Update a card's details
 * @param cardId The ID of the card to update
 * @param userId The ID of the user (for verification)
 * @param updates The fields to update
 * @returns The updated UserCard object
 */
export const updateUserCard = async (
  cardId: string,
  userId: string,
  updates: Partial<Omit<UserCard, 'id' | 'userId' | 'createdAt'>>
): Promise<{ data: UserCard | null; error: any }> => {
  try {
    // Verify the card belongs to the user
    const { data: existingCard, error: fetchError } = await supabase
      .from('user_cards')
      .select('*')
      .eq('id', cardId)
      .eq('userId', userId)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (!existingCard) {
      return { data: null, error: new Error('Card not found or you do not have permission to update it') };
    }
    
    // Handle image update if provided
    let imageUrl = updates.imageUrl || existingCard.imageUrl;
    if (updates.imageUrl && updates.imageUrl.startsWith('data:image')) {
      // Delete old image if it's in our storage
      if (existingCard.imageUrl && existingCard.imageUrl.includes('card_images')) {
        const oldFileName = existingCard.imageUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('card_images')
            .remove([oldFileName]);
        }
      }
      
      // Upload new image
      const fileName = `card_${userId}_${Date.now()}`;
      const { error: uploadError } = await supabase.storage
        .from('card_images')
        .upload(fileName, Buffer.from(updates.imageUrl.split(',')[1], 'base64'), {
          contentType: 'image/jpeg'
        });
      
      if (uploadError) throw uploadError;
      
      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('card_images')
        .getPublicUrl(fileName);
      
      imageUrl = publicUrlData.publicUrl;
    }
    
    // Update the card
    const { data, error } = await supabase
      .from('user_cards')
      .update({
        ...updates,
        imageUrl,
        updatedAt: new Date().toISOString()
      })
      .eq('id', cardId)
      .eq('userId', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error updating user card:', error);
    return { data: null, error };
  }
};

// ======== Want List Functions ========

/**
 * Get a user's want list
 * @param userId The ID of the user whose want list to fetch
 * @returns The user's WantList object
 */
export const getUserWantList = async (userId: string): Promise<{ data: WantList | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('want_lists')
      .select('*')
      .eq('userId', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      throw error;
    }
    
    return { data: data || null, error: null };
  } catch (error) {
    console.error('Error fetching want list:', error);
    return { data: null, error };
  }
};

/**
 * Create a new want list for a user
 * @param userId The ID of the user creating the want list
 * @param content The content of the want list
 * @returns The newly created WantList object
 */
export const createWantList = async (
  userId: string,
  content: string
): Promise<{ data: WantList | null; error: any }> => {
  try {
    // Check if user already has a want list
    const { data: existingList } = await getUserWantList(userId);
    
    if (existingList) {
      // Update existing want list instead of creating a new one
      return updateWantList(existingList.id, userId, content);
    }
    
    // Create new want list
    const { data, error } = await supabase
      .from('want_lists')
      .insert([{
        userId,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error creating want list:', error);
    return { data: null, error };
  }
};

/**
 * Update an existing want list
 * @param wantListId The ID of the want list to update
 * @param userId The ID of the user (for verification)
 * @param content The new content for the want list
 * @returns The updated WantList object
 */
export const updateWantList = async (
  wantListId: string,
  userId: string,
  content: string
): Promise<{ data: WantList | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('want_lists')
      .update({
        content,
        updatedAt: new Date().toISOString()
      })
      .eq('id', wantListId)
      .eq('userId', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error updating want list:', error);
    return { data: null, error };
  }
};

/**
 * Share a want list with MVP dealers at a specific show
 * @param userId The ID of the user sharing the want list
 * @param showId The ID of the show where the want list will be shared
 * @returns Success status
 */
export const shareWantList = async (
  userId: string,
  showId: string
): Promise<{ success: boolean; error: any }> => {
  try {
    // First check if the user has a want list
    const { data: wantList, error: wantListError } = await getUserWantList(userId);
    
    if (wantListError) throw wantListError;
    
    if (!wantList) {
      return { success: false, error: new Error('You must create a want list before sharing it') };
    }
    
    // Create or update the shared want list record
    const { error } = await supabase
      .from('shared_want_lists')
      .upsert([{
        userId,
        showId,
        wantListId: wantList.id,
        sharedAt: new Date().toISOString()
      }]);
    
    if (error) throw error;
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error sharing want list:', error);
    return { success: false, error };
  }
};

/**
 * Get all MVP dealers who will be at a specific show
 * @param showId The ID of the show
 * @returns Array of dealer user IDs and their basic info
 */
export const getDealersForShow = async (showId: string): Promise<{ 
  data: { id: string; firstName: string; lastName?: string }[] | null; 
  error: any 
}> => {
  try {
    // This query assumes there's a 'show_participants' table that tracks who's attending which show
    const { data, error } = await supabase
      .from('show_participants')
      .select('users:userId(id, firstName, lastName, role)')
      .eq('showId', showId)
      .eq('users.role', UserRole.MVP_DEALER);
    
    if (error) throw error;
    
    // Extract user data from the nested structure
    const dealers = data?.map(item => item.users) || [];
    
    return { data: dealers, error: null };
  } catch (error) {
    console.error('Error fetching dealers for show:', error);
    return { data: null, error };
  }
};

/**
 * Get shared want lists for a dealer at a specific show
 * @param dealerId The ID of the dealer (MVP_DEALER role)
 * @param showId The ID of the show
 * @returns Array of want lists with user information
 */
export const getSharedWantListsForDealer = async (
  dealerId: string,
  showId: string
): Promise<{ data: any[] | null; error: any }> => {
  try {
    // Verify the user is an MVP dealer
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', dealerId)
      .single();
    
    if (userError) throw userError;
    
    if (!userData || userData.role !== UserRole.MVP_DEALER) {
      return { 
        data: null, 
        error: new Error('Only MVP dealers can access shared want lists') 
      };
    }
    
    // Get shared want lists for this show
    const { data, error } = await supabase
      .from('shared_want_lists')
      .select(`
        id,
        sharedAt,
        users:userId(id, firstName, lastName),
        wantLists:wantListId(id, content, updatedAt)
      `)
      .eq('showId', showId);
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching shared want lists:', error);
    return { data: null, error };
  }
};
