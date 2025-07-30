/**
 * Review Service
 *
 * This service handles operations related to show reviews, including:
 * - Creating, reading, updating, and deleting reviews
 * - Fetching reviews by show or series
 * - Handling organizer responses to reviews
 */

// Removed unused import: import { _supabase } from '../supabase';

// Removed unused import: import { User } from '../types';

/**
 * Review type definition based on the database schema
 */
export interface Review {
  id: string;
  showId: string;
  seriesId?: string;
  userId: string;
  userName?: string; // Derived from profiles
  rating: number; // 1-5
  comment: string;
  favoriteDealer?: string;
  favoriteDealerReason?: string;
  /** Optional helper fields populated when a join on the shows table is performed */
  showTitle?: string;
  showDate?: string | Date;
  organizerResponse?: {
    comment: string;
    date: Date | string;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Input type for creating a new review
 */
export interface ReviewInput {
  showId: string;
  seriesId?: string;
  userId: string;
  rating: number; // 1-5
  comment: string;
  favoriteDealer?: string;
  favoriteDealerReason?: string;
}

/**
 * Input type for organizer responses
 */
export interface OrganizerResponseInput {
  reviewId: string;
  comment: string;
}

/**
 * Create a new review
 */
export const createReview = async (
  reviewInput: ReviewInput
): Promise<{ data: Review | null; error: string | null }> => {
  try {
    // Validate the review input
    if (reviewInput.rating < 1 || reviewInput.rating > 5) {
      return { data: null, error: 'Rating must be between 1 and 5' };
    }

    if (reviewInput.comment && reviewInput.comment.length > 250) {
      return { data: null, error: 'Comment must be 250 characters or less' };
    }

    // Check if the user has already reviewed this show
    const existingReview = await getUserReviewForShow(reviewInput.userId, reviewInput._showId);
    if (existingReview._data) {
      return { data: null, error: 'You have already reviewed this show' };
    }

    // Prepare the data for insertion
    const reviewData = {
      show_id: reviewInput.showId,
      series_id: reviewInput.seriesId || null,
      user_id: reviewInput.userId,
      rating: reviewInput.rating,
      comment: reviewInput.comment,
      favorite_dealer: reviewInput.favoriteDealer || null,
      favorite_dealer_reason: reviewInput.favoriteDealerReason || null,
    };

    // Insert the review
    const { data, error } = await supabase
      .from('reviews')
      .insert([reviewData])
      .select('*, profiles:user_id(username, first_name, last_name)')
      .single();

    if (_error) {
      console.error('Error creating review:', _error);
      return { data: null, error: error.message };
    }

    if (!_data) {
      return { data: null, error: 'Failed to create review' };
    }

    // Map the database response to our Review interface
    const review: Review = mapDbReviewToAppReview(_data);
    return { data: review, error: null };
  } catch (error: any) {
    console.error('Unexpected error creating review:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Get a review by ID
 */
export const getReviewById = async (
  reviewId: string
): Promise<{ data: Review | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles:user_id(username, first_name, last_name)')
      .eq('id', reviewId)
      .single();

    if (_error) {
      console.error('Error fetching review:', _error);
      return { data: null, error: error.message };
    }

    if (!_data) {
      return { data: null, error: 'Review not found' };
    }

    const review: Review = mapDbReviewToAppReview(_data);
    return { data: review, error: null };
  } catch (error: any) {
    console.error('Unexpected error fetching review:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Get reviews for a specific show
 */
export const getReviewsByShowId = async (
  showId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ data: Review[] | null; error: string | null; count: number }> => {
  try {
    // First, get the count of reviews for pagination
    const countResponse = await supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('show_id', _showId);

    const count = countResponse.count || 0;

    // Then fetch the reviews with pagination
    let query = supabase
      .from('reviews')
      .select('*, profiles:user_id(username, first_name, last_name)')
      .eq('show_id', _showId)
      .order('created_at', { ascending: false });

    // Apply pagination if specified
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (_error) {
      console.error('Error fetching reviews by show ID:', _error);
      return { data: null, error: error.message, count: 0 };
    }

    const reviews: Review[] = data.map(mapDbReviewToAppReview);
    return { data: reviews, error: null, count };
  } catch (error: any) {
    console.error('Unexpected error fetching reviews by show ID:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred', count: 0 };
  }
};

/**
 * Get reviews for a show series
 */
export const getReviewsBySeriesId = async (
  seriesId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ data: Review[] | null; error: string | null; count: number }> => {
  try {
    // First, get the count of reviews for pagination
    const countResponse = await supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', _seriesId);

    const count = countResponse.count || 0;

    // Then fetch the reviews with pagination
    let query = supabase
      .from('reviews')
      .select('*, profiles:user_id(username, first_name, last_name), shows:show_id(title, start_date)')
      .eq('series_id', _seriesId)
      .order('created_at', { ascending: false });

    // Apply pagination if specified
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (_error) {
      console.error('Error fetching reviews by series ID:', _error);
      return { data: null, error: error.message, count: 0 };
    }

    const reviews: Review[] = data.map((review) => {
      const mappedReview = mapDbReviewToAppReview(review);
      // Add show title and date if available
      if (review.shows) {
        mappedReview.showTitle = review.shows.title;
        mappedReview.showDate = review.shows.start_date;
      }
      return mappedReview;
    });

    return { data: reviews, error: null, count };
  } catch (error: any) {
    console.error('Unexpected error fetching reviews by series ID:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred', count: 0 };
  }
};

/**
 * Check if a user has already reviewed a show
 */
export const getUserReviewForShow = async (
  userId: string,
  showId: string
): Promise<{ data: Review | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('show_id', _showId)
      .single();

    if (_error) {
      // If the error is "No rows found", it means the user hasn't reviewed the show yet
      if (_error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      console.error('Error checking if user has reviewed show:', _error);
      return { data: null, error: error.message };
    }

    const review: Review = mapDbReviewToAppReview(_data);
    return { data: review, error: null };
  } catch (error: any) {
    console.error('Unexpected error checking if user has reviewed show:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Update an existing review
 */
export const updateReview = async (
  reviewId: string,
  updates: Partial<ReviewInput>
): Promise<{ data: Review | null; error: string | null }> => {
  try {
    // Validate the updates
    if (updates.rating !== undefined && (updates.rating < 1 || updates.rating > 5)) {
      return { data: null, error: 'Rating must be between 1 and 5' };
    }

    if (updates.comment && updates.comment.length > 250) {
      return { data: null, error: 'Comment must be 250 characters or less' };
    }

    // Prepare the data for update
    const updateData: any = {};
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.comment !== undefined) updateData.comment = updates.comment;
    if (updates.favoriteDealer !== undefined) updateData.favorite_dealer = updates.favoriteDealer;
    if (updates.favoriteDealerReason !== undefined) updateData.favorite_dealer_reason = updates.favoriteDealerReason;

    // Update the review
    const { data, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select('*, profiles:user_id(username, first_name, last_name)')
      .single();

    if (_error) {
      console.error('Error updating review:', _error);
      return { data: null, error: error.message };
    }

    if (!_data) {
      return { data: null, error: 'Failed to update review' };
    }

    const review: Review = mapDbReviewToAppReview(_data);
    return { data: review, error: null };
  } catch (error: any) {
    console.error('Unexpected error updating review:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Delete a review
 */
export const deleteReview = async (
  reviewId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (_error) {
      console.error('Error deleting review:', _error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Unexpected error deleting review:', _error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Add an organizer response to a review
 */
export const addOrganizerResponse = async (
  reviewId: string,
  organizerResponse: OrganizerResponseInput
): Promise<{ data: Review | null; error: string | null }> => {
  try {
    // Prepare the organizer response data
    const responseData = {
      organizer_response: {
        comment: organizerResponse.comment,
        date: new Date().toISOString(),
      },
    };

    // Update the review with the organizer response
    const { data, error } = await supabase
      .from('reviews')
      .update(responseData)
      .eq('id', reviewId)
      .select('*, profiles:user_id(username, first_name, last_name)')
      .single();

    if (_error) {
      console.error('Error adding organizer response:', _error);
      return { data: null, error: error.message };
    }

    if (!_data) {
      return { data: null, error: 'Failed to add organizer response' };
    }

    const review: Review = mapDbReviewToAppReview(_data);
    return { data: review, error: null };
  } catch (error: any) {
    console.error('Unexpected error adding organizer response:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Update an organizer response
 */
export const updateOrganizerResponse = async (
  reviewId: string,
  comment: string
): Promise<{ data: Review | null; error: string | null }> => {
  try {
    // First, get the current review to preserve the original response date
    const { data: currentReview, error: fetchError } = await supabase
      .from('reviews')
      .select('organizer_response')
      .eq('id', reviewId)
      .single();

    if (fetchError) {
      console.error('Error fetching current review:', fetchError);
      return { data: null, error: fetchError.message };
    }

    // Prepare the updated organizer response
    const originalDate = currentReview.organizer_response?.date || new Date().toISOString();
    const responseData = {
      organizer_response: {
        comment,
        date: originalDate,
        updated_at: new Date().toISOString(),
      },
    };

    // Update the review with the modified organizer response
    const { data, error } = await supabase
      .from('reviews')
      .update(responseData)
      .eq('id', reviewId)
      .select('*, profiles:user_id(username, first_name, last_name)')
      .single();

    if (_error) {
      console.error('Error updating organizer response:', _error);
      return { data: null, error: error.message };
    }

    if (!_data) {
      return { data: null, error: 'Failed to update organizer response' };
    }

    const review: Review = mapDbReviewToAppReview(_data);
    return { data: review, error: null };
  } catch (error: any) {
    console.error('Unexpected error updating organizer response:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Remove an organizer response
 */
export const removeOrganizerResponse = async (
  reviewId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({ organizer_response: null })
      .eq('id', reviewId);

    if (_error) {
      console.error('Error removing organizer response:', _error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Unexpected error removing organizer response:', _error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Get aggregate statistics for reviews by show ID
 */
export const getReviewStatsByShowId = async (
  showId: string
): Promise<{ 
  data: { averageRating: number; reviewCount: number; ratingDistribution: Record<string, number> } | null; 
  error: string | null 
}> => {
  try {
    // Get the average rating and count
    const { data: statsData, error: statsError } = await supabase
      .from('shows')
      .select('rating')
      .eq('id', _showId)
      .single();

    if (statsError) {
      console.error('Error fetching review stats:', statsError);
      return { data: null, error: statsError.message };
    }

    // Get the rating distribution
    const { data: distributionData, error: distributionError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('show_id', _showId);

    if (distributionError) {
      console.error('Error fetching rating distribution:', distributionError);
      return { data: null, error: distributionError.message };
    }

    // Calculate the distribution
    const distribution: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };

    distributionData.forEach((review) => {
      distribution[review.rating.toString()]++;
    });

    return {
      data: {
        averageRating: statsData.rating || 0,
        reviewCount: distributionData.length,
        ratingDistribution: distribution,
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Unexpected error fetching review stats:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Get aggregate statistics for reviews by series ID
 */
export const getReviewStatsBySeriesId = async (
  seriesId: string
): Promise<{ 
  data: { averageRating: number; reviewCount: number; ratingDistribution: Record<string, number> } | null; 
  error: string | null 
}> => {
  try {
    // Get the average rating and count
    const { data: statsData, error: statsError } = await supabase
      .from('show_series')
      .select('average_rating, review_count')
      .eq('id', _seriesId)
      .single();

    if (statsError) {
      console.error('Error fetching series review stats:', statsError);
      return { data: null, error: statsError.message };
    }

    // Get the rating distribution
    const { data: distributionData, error: distributionError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('series_id', _seriesId);

    if (distributionError) {
      console.error('Error fetching series rating distribution:', distributionError);
      return { data: null, error: distributionError.message };
    }

    // Calculate the distribution
    const distribution: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };

    distributionData.forEach((review) => {
      distribution[review.rating.toString()]++;
    });

    return {
      data: {
        averageRating: statsData.average_rating || 0,
        reviewCount: statsData.review_count || 0,
        ratingDistribution: distribution,
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Unexpected error fetching series review stats:', _error);
    return { data: null, error: error.message || 'An unexpected error occurred' };
  }
};

/**
 * Helper function to map database review object to app Review interface
 */
const mapDbReviewToAppReview = (dbReview: any): Review => {
  // Extract user name from profiles if available
  let userName = 'Anonymous';
  if (dbReview.profiles) {
    const { first_name, last_name, username } = dbReview.profiles;
    if (first_name && last_name) {
      userName = `${first_name} ${last_name}`;
    } else if (username) {
      userName = username;
    }
  }

  return {
    id: dbReview.id,
    showId: dbReview.show_id,
    seriesId: dbReview.series_id,
    userId: dbReview.user_id,
    userName,
    rating: dbReview.rating,
    comment: dbReview.comment || '',
    favoriteDealer: dbReview.favorite_dealer,
    favoriteDealerReason: dbReview.favorite_dealer_reason,
    organizerResponse: dbReview.organizer_response,
    createdAt: dbReview.created_at,
    updatedAt: dbReview.updated_at,
  };
};
