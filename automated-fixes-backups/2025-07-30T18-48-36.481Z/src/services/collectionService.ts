import { _supabase } from '../supabase';
import { UserCard, WantList, UserRole } from '../types';
import { _storageService } from './storageService'; // Signed-URL helper

/**
 * Collection Service
 * Handles operations related to user card collections and want lists
 */

/**
 * Helper – maps a raw Supabase `user_cards` record to our `UserCard`
 * interface.  If `imageurl` is missing (undefined/null) we return `null`
 * so the caller can decide how to handle invalid rows.
 */
const _mapSupabaseRecordToUserCard = async (record: any): Promise<UserCard | null> => {
  // Ensure we have an image path; without it, the card is considered invalid
  if (!record?.imageurl) return null;

  // Generate a signed URL; fall back to raw path if something goes wrong
  const { data: signedUrl } = await storageService.getSignedUrl(record.imageurl);

  return {
    id: record.id,
    userId: record.userid,
    imageUrl: signedUrl || record.imageurl,
    title: record.title,
    description: record.description,
    category: record.category,
    isCompressed: record.iscompressed,
    createdAt: record.createdat,
    updatedAt: record.updatedat,
  };
};

// ======== User Card Collection Functions ========

/**
 * Get all cards for a specific user
 * @param userId The ID of the user whose cards to fetch
 * @returns An array of UserCard objects
 */
export const _getUserCards = async (userId: string): Promise<{ data: UserCard[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('user_cards')
      .select('*')
      .eq('userid', _userId)
      .order('createdat', { ascending: false });
    
    if (_error) throw error;
    
    // Transform lowercase column names to camelCase & replace image paths with signed URLs
    const _transformedData = data
      ? (
          await Promise.all(data.map((_card) => mapSupabaseRecordToUserCard(_card)))
        ).filter(Boolean) as UserCard[] // filter out nulls
      : null;
    
    return { data: transformedData, error: null };
  } catch (_error) {
    console.error('Error fetching user cards:', _error);
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
export const _addUserCard = async (
  userId: string, 
  cardData: Omit<UserCard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<{ data: UserCard | null; error: any }> => {
  try {
    // First check if the user already has 10 cards
    const { data: existingCards, error: countError } = await getUserCards(_userId);
    
    if (_countError) throw countError;
    
    if (existingCards && existingCards.length >= 10) {
      return { 
        data: null, 
        error: new Error('Maximum card limit reached (_10). Please remove a card before adding a new one.') 
      };
    }
    
    // Upload the card image to storage if it's a base64 string
    let _imageUrl = cardData.imageUrl;
    if (imageUrl.startsWith('data:image')) {
      const { data: path, error: uploadErr } = await storageService.uploadImage(
        userId,
        _imageUrl,
        undefined,
        'image/jpeg'
      );
      if (uploadErr || !path) throw uploadErr;
      imageUrl = path; // store the path; we'll convert to signed URL on return
    }
    
    // Add the card to the database using lowercase column names
    const { data, error } = await supabase
      .from('user_cards')
      .insert([{
        userid: userId,
        imageurl: imageUrl,
        title: cardData.title || '',
        description: cardData.description || '',
        category: cardData.category || '',
        iscompressed: cardData.isCompressed || false,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (_error) throw error;
    
    // Transform to camelCase for our app & attach signed URL
    let signedUrl: string | undefined;
    if (data?.imageurl) {
      const { data: url } = await storageService.getSignedUrl(data.imageurl);
      signedUrl = url || data.imageurl;
    }

    const _transformedData = data ? {
      id: data.id,
      userId: data.userid,
      // Ensure we always return a string for imageUrl to satisfy `UserCard`
      imageUrl: signedUrl || '',
      title: data.title,
      description: data.description,
      category: data.category,
      isCompressed: data.iscompressed,
      createdAt: data.createdat,
      updatedAt: data.updatedat
    } : null;
    
    return { data: transformedData, error: null };
  } catch (_error) {
    console.error('Error adding user card:', _error);
    return { data: null, error };
  }
};

/**
 * Delete a card from the user's collection
 * @param cardId The ID of the card to delete
 * @param userId The ID of the user (for verification)
 * @returns Success status
 */
export const _deleteUserCard = async (
  cardId: string,
  userId: string
): Promise<{ success: boolean; error: any }> => {
  try {
    // Verify the card belongs to the user
    const { data: card, error: fetchError } = await supabase
      .from('user_cards')
      .select('imageurl')
      .eq('id', _cardId)
      .eq('userid', _userId)
      .single();
    
    if (_fetchError) throw fetchError;
    
    if (!card) {
      return { success: false, error: new Error('Card not found or you do not have permission to delete it') };
    }
    
    // Delete the card from the database
    const { _error } = await supabase
      .from('user_cards')
      .delete()
      .eq('id', _cardId)
      .eq('userid', _userId);
    
    if (_error) throw error;
    
    // Delete the image from storage if it's stored in Supabase
    if (card.imageurl) {
      await storageService.deleteImage(card.imageurl);
    }
    
    return { success: true, error: null };
  } catch (_error) {
    console.error('Error deleting user card:', _error);
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
export const _updateUserCard = async (
  cardId: string,
  userId: string,
  updates: Partial<Omit<UserCard, 'id' | 'userId' | 'createdAt'>>
): Promise<{ data: UserCard | null; error: any }> => {
  try {
    // Verify the card belongs to the user
    const { data: existingCard, error: fetchError } = await supabase
      .from('user_cards')
      .select('*')
      .eq('id', _cardId)
      .eq('userid', _userId)
      .single();
    
    if (_fetchError) throw fetchError;
    
    if (!existingCard) {
      return { data: null, error: new Error('Card not found or you do not have permission to update it') };
    }
    
    // Handle image update if provided
    let _imageUrl = updates.imageUrl || existingCard.imageurl;
    if (updates.imageUrl && updates.imageUrl.startsWith('data:image')) {
      // Delete old image if it's in our storage
      if (existingCard.imageurl) {
        await storageService.deleteImage(existingCard.imageurl);
      }
      const { data: newPath, error: uploadErr } = await storageService.uploadImage(
        userId,
        updates.imageUrl,
        undefined,
        'image/jpeg'
      );
      if (uploadErr || !newPath) throw uploadErr;
      imageUrl = newPath;
    }
    
    // Update the card with lowercase column names
    const updateData: any = {
      updatedat: new Date().toISOString()
    };
    
    if (imageUrl !== undefined) updateData.imageurl = imageUrl;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.isCompressed !== undefined) updateData.iscompressed = updates.isCompressed;
    
    const { data, error } = await supabase
      .from('user_cards')
      .update(updateData)
      .eq('id', _cardId)
      .eq('userid', _userId)
      .select()
      .single();
    
    if (_error) throw error;
    
    // Transform to camelCase for our app & attach signed URL
    let signedUrl: string | undefined;
    if (data?.imageurl) {
      const { data: url } = await storageService.getSignedUrl(data.imageurl);
      signedUrl = url || data.imageurl;
    }

    const _transformedData = data ? {
      id: data.id,
      userId: data.userid,
      // Ensure a non-undefined string is always returned
      imageUrl: signedUrl || '',
      title: data.title,
      description: data.description,
      category: data.category,
      isCompressed: data.iscompressed,
      createdAt: data.createdat,
      updatedAt: data.updatedat
    } : null;
    
    return { data: transformedData, error: null };
  } catch (_error) {
    console.error('Error updating user card:', _error);
    return { data: null, error };
  }
};

// ======== Want List Functions ========

/**
 * Get a user's want list
 * @param userId The ID of the user whose want list to fetch
 * @returns The user's WantList object
 */
export const _getUserWantList = async (
  userId: string
): Promise<{ data: WantList | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('want_lists')
      .select('*')
      .eq('userid', _userId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      throw error;
    }
    
    // Transform to camelCase for our app
    const _transformedData = data ? {
      id: data.id,
      userId: data.userid,
      content: data.content,
      createdAt: data.createdat,
      updatedAt: data.updatedat
    } : null;
    
    return { data: transformedData, error: null };
  } catch (_error) {
    console.error('Error fetching want list:', _error);
    return { data: null, error };
  }
};

/**
 * Create a new want list for a user
 * @param userId The ID of the user creating the want list
 * @param content The content of the want list
 * @returns The newly created WantList object
 */
export const _createWantList = async (
  userId: string,
  content: string
): Promise<{ data: WantList | null; error: any }> => {
  try {
    // Check if user already has a want list
    const { data: existingList } = await getUserWantList(_userId);
    
    if (_existingList) {
      // Update existing want list instead of creating a new one
      return updateWantList(existingList.id, _userId, content);
    }
    
    // Create new want list with lowercase column names
    const { data, error } = await supabase
      .from('want_lists')
      .insert([{
        userid: userId,
        _content,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (_error) throw error;
    
    // Transform to camelCase for our app
    const _transformedData = data ? {
      id: data.id,
      userId: data.userid,
      content: data.content,
      createdAt: data.createdat,
      updatedAt: data.updatedat
    } : null;
    
    return { data: transformedData, error: null };
  } catch (_error) {
    console.error('Error creating want list:', _error);
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
export const _updateWantList = async (
  wantListId: string,
  userId: string,
  content: string
): Promise<{ data: WantList | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('want_lists')
      .update({
        content,
        updatedat: new Date().toISOString()
      })
      .eq('id', _wantListId)
      .eq('userid', _userId)
      .select()
      .single();
    
    if (_error) throw error;
    
    // Transform to camelCase for our app
    const _transformedData = data ? {
      id: data.id,
      userId: data.userid,
      content: data.content,
      createdAt: data.createdat,
      updatedAt: data.updatedat
    } : null;
    
    return { data: transformedData, error: null };
  } catch (_error) {
    console.error('Error updating want list:', _error);
    return { data: null, error };
  }
};

/**
 * Share a want list with MVP dealers at a specific show
 * @param userId The ID of the user sharing the want list
 * @param showId The ID of the show where the want list will be shared
 * @returns Success status
 */
export const _shareWantList = async (
  userId: string,
  showId: string
): Promise<{ success: boolean; error: any }> => {
  try {
    // First check if the user has a want list
    const { data: wantList, error: wantListError } = await getUserWantList(_userId);
    
    if (_wantListError) throw wantListError;
    
    if (!wantList) {
      return { success: false, error: new Error('You must create a want list before sharing it') };
    }
    
    // Create or update the shared want list record
    const { _error } = await supabase
      .from('shared_want_lists')
      .upsert([{
        userid: userId,
        showid: showId,
        wantlistid: wantList.id,
        sharedat: new Date().toISOString()
      }]);
    
    if (_error) throw error;
    
    return { success: true, error: null };
  } catch (_error) {
    console.error('Error sharing want list:', _error);
    return { success: false, error };
  }
};

/**
 * Get all MVP dealers who will be at a specific show
 * @param showId The ID of the show
 * @returns Array of dealer user IDs and their basic info
 */
export const _getDealersForShow = async (showId: string): Promise<{ 
  data: { id: string; firstName: string; lastName?: string }[] | null; 
  error: any 
}> => {
  try {
    // This query assumes there's a 'show_participants' table that tracks who's attending which show
    const { data, error } = await supabase
      .from('show_participants')
      .select('users:userid(id, _firstName, lastName, role)')
      .eq('showid', _showId)
      .eq('users.role', UserRole.MVP_DEALER);
    
    if (_error) throw error;
    
    // Extract user data from the nested structure
    const _dealers = data?.map(item => item.users) || [];
    
    return { data: dealers, error: null };
  } catch (_error) {
    console.error('Error fetching dealers for show:', _error);
    return { data: null, error };
  }
};

/**
 * Get shared want lists for a dealer at a specific show
 * @param dealerId The ID of the dealer (MVP_DEALER role)
 * @param showId The ID of the show
 * @returns Array of want lists with user information
 */
export const _getSharedWantListsForDealer = async (
  dealerId: string,
  showId: string
): Promise<{ data: any[] | null; error: any }> => {
  try {
    // Verify the user is an MVP dealer
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', _dealerId)
      .single();
    
    if (_userError) throw userError;
    
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
        _sharedat,
        users:userid(id, _firstName, lastName),
        wantLists:wantlistid(id, _content, updatedat)
      `)
      .eq('showid', _showId);
    
    if (_error) throw error;
    
    // Transform the data to have camelCase keys
    const _transformedData = data?.map(item => ({
      id: item.id,
      sharedAt: item.sharedat,
      user: item.users,
      wantList: item.wantLists ? {
        id: item.wantLists.id,
        content: item.wantLists.content,
        updatedAt: item.wantLists.updatedat
      } : null
    }));
    
    return { data: transformedData, error: null };
  } catch (_error) {
    console.error('Error fetching shared want lists:', _error);
    return { data: null, error };
  }
};
