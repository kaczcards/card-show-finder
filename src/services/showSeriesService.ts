import { supabase } from '../supabase';
import { ShowSeries, Review, Show } from '../types';

/**
 * Service for interacting with show_series table and related functionality
 */
export const showSeriesService = {
  /**
   * Get all show series with optional filtering
   * @param options Filter options
   * @returns Array of show series
   */
  async getAllShowSeries(options?: {
    organizerId?: string;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }): Promise<ShowSeries[]> {
    let query = supabase.from('show_series').select('*');

    // Apply filters
    if (options?.organizerId) {
      query = query.eq('organizer_id', options.organizerId);
    }

    // Apply ordering
    if (options?.orderBy) {
      query = query.order(options.orderBy, { 
        ascending: options.orderDirection !== 'desc' 
      });
    } else {
      // Default ordering by name
      query = query.order('name', { ascending: true });
    }

    // Apply limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching show series:', error);
      throw new Error(`Failed to fetch show series: ${error.message}`);
    }

    return data.map(series => ({
      id: series.id,
      name: series.name,
      organizerId: series.organizer_id,
      description: series.description,
      averageRating: series.average_rating,
      reviewCount: series.review_count,
      createdAt: series.created_at,
      updatedAt: series.updated_at
    }));
  },

  /**
   * Get a single show series by ID
   * @param id Show series ID
   * @returns Show series object or null if not found
   */
  async getShowSeriesById(id: string): Promise<ShowSeries | null> {
    const { data, error } = await supabase
      .from('show_series')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // PGRST116 is the error code for "no rows returned"
        return null;
      }
      console.error('Error fetching show series by ID:', error);
      throw new Error(`Failed to fetch show series: ${error.message}`);
    }

    return {
      id: data.id,
      name: data.name,
      organizerId: data.organizer_id,
      description: data.description,
      averageRating: data.average_rating,
      reviewCount: data.review_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  /**
   * Get all shows belonging to a specific series
   * @param seriesId Show series ID
   * @returns Array of shows in the series
   */
  async getShowsInSeries(seriesId: string): Promise<Show[]> {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('series_id', seriesId)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching shows in series:', error);
      throw new Error(`Failed to fetch shows in series: ${error.message}`);
    }

    // Map the data to match the Show interface
    return data.map(show => ({
      id: show.id,
      seriesId: show.series_id,
      title: show.title,
      description: show.description,
      location: show.location,
      address: show.address,
      startDate: show.start_date,
      endDate: show.end_date,
      entryFee: show.entry_fee,
      imageUrl: show.image_url,
      rating: show.rating,
      coordinates: show.coordinates ? {
        latitude: show.coordinates.coordinates[1],
        longitude: show.coordinates.coordinates[0]
      } : undefined,
      status: show.status,
      organizerId: show.organizer_id,
      features: show.features,
      categories: show.categories,
      createdAt: show.created_at,
      updatedAt: show.updated_at
    }));
  },

  /**
   * Get reviews for a specific show series
   * @param seriesId Show series ID
   * @returns Array of reviews
   */
  async getSeriesReviews(seriesId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name
        )
      `)
      .eq('series_id', seriesId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching series reviews:', error);
      throw new Error(`Failed to fetch series reviews: ${error.message}`);
    }

    return data.map(review => ({
      id: review.id,
      seriesId: review.series_id,
      userId: review.user_id,
      userName: `${review.profiles.first_name} ${review.profiles.last_name?.charAt(0) || ''}`.trim(),
      rating: review.rating,
      comment: review.comment || '',
      date: review.created_at,
      organizerResponse: review.organizer_reply ? {
        comment: review.organizer_reply,
        date: review.updated_at
      } : undefined
    }));
  },

  /**
   * Claim a show series as an organizer
   * @param seriesId Show series ID to claim
   * @returns Updated show series object
   */
  async claimShowSeries(seriesId: string): Promise<{ success: boolean; message: string; series?: ShowSeries }> {
    try {
      // Get current access token using new getSession() API
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/claim_show_series`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ seriesId })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: result.error || 'Failed to claim show series'
        };
      }

      return {
        success: true,
        message: result.message || 'Show series claimed successfully',
        series: result.series ? {
          id: result.series.id,
          name: result.series.name,
          organizerId: result.series.organizer_id,
          description: result.series.description,
          createdAt: result.series.created_at
        } : undefined
      };
    } catch (error) {
      console.error('Error claiming show series:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  /**
   * Send a broadcast message to show attendees/favorites
   * @param params Broadcast message parameters
   * @returns Result of the broadcast operation
   */
  async sendBroadcastMessage(params: {
    seriesId: string;
    showId?: string;
    messageType: 'pre_show' | 'post_show';
    subject: string;
    content: string;
    includeAttendees?: boolean;
    includeFavorites?: boolean;
  }): Promise<{ success: boolean; message: string; recipientCount?: number; quotaRemaining?: number }> {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send_broadcast_message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Fetch access token using new getSession() API
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify(params)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: result.error || 'Failed to send broadcast message'
        };
      }

      return {
        success: true,
        message: result.message || 'Broadcast message sent successfully',
        recipientCount: result.recipientCount,
        quotaRemaining: result.quotaRemaining
      };
    } catch (error) {
      console.error('Error sending broadcast message:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  /**
   * Add a review for a show series
   * @param review Review data to add
   * @returns The created review
   */
  async addSeriesReview(review: {
    seriesId: string;
    rating: number;
    comment: string;
  }): Promise<Review> {
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData.user) {
      throw new Error('User must be authenticated to submit a review');
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        series_id: review.seriesId,
        user_id: userData.user.id,
        rating: review.rating,
        comment: review.comment,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name
        )
      `)
      .single();

    if (error) {
      console.error('Error adding series review:', error);
      throw new Error(`Failed to add review: ${error.message}`);
    }

    return {
      id: data.id,
      seriesId: data.series_id,
      userId: data.user_id,
      userName: `${data.profiles.first_name} ${data.profiles.last_name?.charAt(0) || ''}`.trim(),
      rating: data.rating,
      comment: data.comment || '',
      date: data.created_at
    };
  },

  /**
   * Respond to a review as a show organizer
   * @param reviewId Review ID to respond to
   * @param response Organizer's response text
   * @returns Success status
   */
  async respondToReview(reviewId: string, response: string): Promise<boolean> {
    const { error } = await supabase
      .from('reviews')
      .update({
        organizer_reply: response,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId);

    if (error) {
      console.error('Error responding to review:', error);
      throw new Error(`Failed to respond to review: ${error.message}`);
    }

    return true;
  }
};
