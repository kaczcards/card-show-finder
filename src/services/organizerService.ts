/**
 * Organizer Service
 *
 * This service handles operations related to show organizers, including:
 * - Claiming and managing shows
 * - Managing recurring show series
 * - Responding to reviews
 * - Sending broadcast messages to attendees/dealers
 */

import { supabase } from '../supabase';
import { Show } from '../types';
import { addOrganizerResponse, updateOrganizerResponse, removeOrganizerResponse } from './reviewService';
import { showSeriesService } from './showSeriesService';

/**
 * Interface for broadcast message details
 */
export interface BroadcastMessage {
  showId: string;
  content: string;
  recipients: ('attendees' | 'dealers' | 'all')[];
}

/**
 * Interface for broadcast message history item
 */
export interface BroadcastHistoryItem {
  id: string;
  showId: string;
  showTitle?: string;
  messageContent: string;
  sentAt: Date | string;
  recipients: string[];
}

/**
 * Interface for broadcast quota information
 */
export interface BroadcastQuota {
  used: number;
  limit: number;
  remaining: number;
  resetDate: Date | string | null;
}

/**
 * Interface for recurring show creation
 */
export interface RecurringShowDetails {
  parentShowId: string;
  childShows: Partial<Show>[];
}

/**
 * Claim ownership of a show
 * This function now handles both individual shows and shows that are part of a series
 */
export const claimShow = async (
  showId: string,
  organizerId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // First, check if the show is part of a series
    const { data: showData, error: showError } = await supabase
      .from('shows')
      .select('series_id')
      .eq('id', showId)
      .single();

    if (showError) {
      console.error('Error fetching show details:', showError);
      return { success: false, error: showError.message };
    }

    // If the show is part of a series, claim the entire series
    if (showData.series_id) {
       
console.warn(`Show ${showId} is part of series ${showData.series_id}, claiming series instead`);
      const result = await showSeriesService.claimShowSeries(showData.series_id);
      
      return { 
        success: result.success, 
        error: result.success ? null : (result.message || 'Failed to claim show series') 
      };
    }

    // If the show is not part of a series, just update its organizer_id directly
    const { error: updateError } = await supabase
      .from('shows')
      .update({ organizer_id: organizerId })
      .eq('id', showId);

    if (updateError) {
      console.error('Error claiming individual show:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error claiming show:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Get shows owned by an organizer
 */
export const getOrganizerShows = async (
  organizerId: string,
  options: { includeSeriesChildren?: boolean } = {}
): Promise<{ data: Show[] | null; error: string | null }> => {
  try {
    let query = supabase
      .from('shows')
      .select('*')
      .eq('organizer_id', organizerId);

    // If we don't want to include series children, filter them out
    if (!options.includeSeriesChildren) {
      query = query.is('parent_show_id', null);
    }

    // Order by date, with series parents first
    query = query.order('is_series_parent', { ascending: false })
                .order('start_date', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching organizer shows:', error);
      return { data: null, error: error.message };
    }

    // Map the database response to our Show interface
    const shows = data.map(row => ({
      id: row.id,
      title: row.title,
      location: row.location,
      address: row.address,
      startDate: row.start_date,
      endDate: row.end_date,
      entryFee: row.entry_fee,
      description: row.description ?? undefined,
      imageUrl: row.image_url ?? undefined,
      rating: row.rating ?? undefined,
      coordinates: row.coordinates && 
        row.coordinates.coordinates && 
        Array.isArray(row.coordinates.coordinates) && 
        row.coordinates.coordinates.length >= 2
        ? {
            latitude: row.coordinates.coordinates[1],
            longitude: row.coordinates.coordinates[0],
          }
        : undefined,
      status: row.status,
      organizerId: row.organizer_id,
      features: row.features ?? {},
      categories: row.categories ?? [],
      parentShowId: row.parent_show_id,
      isSeriesParent: row.is_series_parent,
      extraDetails: row.extra_details ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { data: shows, error: null };
  } catch (err: any) {
    console.error('Unexpected error fetching organizer shows:', err);
    return { data: null, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Mark a show as a recurring series parent
 */
export const markShowAsSeriesParent = async (
  showId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('shows')
      .update({ is_series_parent: true })
      .eq('id', showId);

    if (error) {
      console.error('Error marking show as series parent:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error marking show as series parent:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Add a show to a recurring series
 */
export const addShowToSeries = async (
  childShowId: string,
  parentShowId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // First check if the parent show is marked as a series parent
    const { data: parentData, error: parentError } = await supabase
      .from('shows')
      .select('is_series_parent')
      .eq('id', parentShowId)
      .single();

    if (parentError) {
      console.error('Error checking parent show:', parentError);
      return { success: false, error: parentError.message };
    }

    // If the parent is not marked as a series parent, mark it
    if (!parentData.is_series_parent) {
      const { error: updateError } = await supabase
        .from('shows')
        .update({ is_series_parent: true })
        .eq('id', parentShowId);

      if (updateError) {
        console.error('Error marking parent show as series parent:', updateError);
        return { success: false, error: updateError.message };
      }
    }

    // Now update the child show to link to the parent
    const { error } = await supabase
      .from('shows')
      .update({ parent_show_id: parentShowId })
      .eq('id', childShowId);

    if (error) {
      console.error('Error adding show to series:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error adding show to series:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Remove a show from a recurring series
 */
export const removeShowFromSeries = async (
  childShowId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('shows')
      .update({ parent_show_id: null })
      .eq('id', childShowId);

    if (error) {
      console.error('Error removing show from series:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error removing show from series:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Get aggregate review score for a show series
 */
export const getSeriesReviewScore = async (
  seriesParentId: string
): Promise<{ data: { averageRating: number; totalReviews: number } | null; error: string | null }> => {
  try {
    const { data, error } = await supabase.rpc('get_aggregate_review_score', {
      series_parent_id: seriesParentId
    });

    if (error) {
      console.error('Error getting series review score:', error);
      return { data: null, error: error.message };
    }

    return { 
      data: {
        averageRating: data.average_rating || 0,
        totalReviews: data.total_reviews || 0
      }, 
      error: null 
    };
  } catch (err: any) {
    console.error('Unexpected error getting series review score:', err);
    return { data: null, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Update extra details for a show
 */
export const updateShowExtraDetails = async (
  showId: string,
  extraDetails: Record<string, any>
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('shows')
      .update({ extra_details: extraDetails })
      .eq('id', showId);

    if (error) {
      console.error('Error updating show extra details:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error updating show extra details:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Respond to a review as a show organizer
 * This is a wrapper around the existing reviewService functions
 */
export const respondToReview = async (
  reviewId: string,
  response: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Check if there's an existing response
    const { data: review, error: getError } = await supabase
      .from('reviews')
      .select('organizer_response')
      .eq('id', reviewId)
      .single();

    if (getError) {
      console.error('Error checking review:', getError);
      return { success: false, error: getError.message };
    }

    let result;
    
    // If there's an existing response, update it; otherwise, add a new one
    if (review.organizer_response) {
      result = await updateOrganizerResponse(reviewId, response);
    } else {
      result = await addOrganizerResponse(reviewId, { reviewId, comment: response });
    }

    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error responding to review:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Remove an organizer's response to a review
 */
export const deleteReviewResponse = async (
  reviewId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const result = await removeOrganizerResponse(reviewId);
    return result;
  } catch (err: any) {
    console.error('Unexpected error deleting review response:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Send a broadcast message to attendees/dealers of a show
 */
export const sendBroadcastMessage = async (
  organizerId: string,
  message: BroadcastMessage
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // First check if the organizer has reached their monthly limit
    const { data: quotaData, error: quotaError } = await getBroadcastQuota(organizerId);
    
    if (quotaError) {
      return { success: false, error: quotaError };
    }
    
    if (quotaData && quotaData.remaining <= 0) {
      return { success: false, error: 'You have reached your monthly broadcast message limit' };
    }

    // Validate message content
    if (!message.content || message.content.trim().length === 0) {
      return { success: false, error: 'Message content cannot be empty' };
    }
    
    if (message.content.length > 1000) {
      return { success: false, error: 'Message content cannot exceed 1000 characters' };
    }

    // Convert recipients array to string array
    const recipientsArray = message.recipients.map(r => r.toString());

    // Insert the broadcast log
    const { error: insertError } = await supabase
      .from('broadcast_logs')
      .insert([{
        organizer_id: organizerId,
        show_id: message.showId,
        message_content: message.content,
        recipients: recipientsArray
      }]);

    if (insertError) {
      console.error('Error logging broadcast message:', insertError);
      return { success: false, error: insertError.message };
    }

    // Increment the broadcast count for the organizer
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        broadcast_message_count: quotaData!.used + 1 
      })
      .eq('id', organizerId);

    if (updateError) {
      console.error('Error updating broadcast count:', updateError);
      // Don't return error here, as the message was already sent
    }

    // TODO: Actual message delivery logic would go here
    // This could involve push notifications, emails, etc.

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error sending broadcast message:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Get broadcast message history for an organizer
 */
export const getBroadcastHistory = async (
  organizerId: string,
  options: { limit?: number; offset?: number; showId?: string } = {}
): Promise<{ data: BroadcastHistoryItem[] | null; error: string | null; count: number }> => {
  try {
    // First, get the count for pagination
    let countQuery = supabase
      .from('broadcast_logs')
      .select('id', { count: 'exact', head: true })
      .eq('organizer_id', organizerId);
      
    if (options.showId) {
      countQuery = countQuery.eq('show_id', options.showId);
    }
    
    const countResponse = await countQuery;
    const count = countResponse.count || 0;

    // Then fetch the broadcast logs with pagination
    let query = supabase
      .from('broadcast_logs')
      .select('*, shows:show_id(title)')
      .eq('organizer_id', organizerId)
      .order('sent_at', { ascending: false });
      
    if (options.showId) {
      query = query.eq('show_id', options.showId);
    }

    // Apply pagination if specified
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching broadcast history:', error);
      return { data: null, error: error.message, count: 0 };
    }

    // Map the database response to our BroadcastHistoryItem interface
    const history: BroadcastHistoryItem[] = data.map(item => ({
      id: item.id,
      showId: item.show_id,
      showTitle: item.shows?.title,
      messageContent: item.message_content,
      sentAt: item.sent_at,
      recipients: item.recipients || []
    }));

    return { data: history, error: null, count };
  } catch (err: any) {
    console.error('Unexpected error fetching broadcast history:', err);
    return { data: null, error: err.message || 'An unexpected error occurred', count: 0 };
  }
};

/**
 * Get broadcast quota information for an organizer
 */
export const getBroadcastQuota = async (
  organizerId: string
): Promise<{ data: BroadcastQuota | null; error: string | null }> => {
  try {
    // Reset the broadcast count if we're in a new month
    await supabase.rpc('reset_broadcast_count', {
      p_organizer_id: organizerId
    });
    
    // Get the current broadcast count
    const { data, error } = await supabase
      .from('profiles')
      .select('broadcast_message_count, last_broadcast_reset_date')
      .eq('id', organizerId)
      .single();

    if (error) {
      console.error('Error fetching broadcast quota:', error);
      return { data: null, error: error.message };
    }

    // The monthly limit is currently hardcoded, but could be based on subscription tier
    const MONTHLY_LIMIT = 10;
    const used = data.broadcast_message_count || 0;
    
    return { 
      data: {
        used,
        limit: MONTHLY_LIMIT,
        remaining: Math.max(0, MONTHLY_LIMIT - used),
        resetDate: data.last_broadcast_reset_date
      }, 
      error: null 
    };
  } catch (err: any) {
    console.error('Unexpected error fetching broadcast quota:', err);
    return { data: null, error: err.message || 'An unexpected error occurred' };
  }
};
