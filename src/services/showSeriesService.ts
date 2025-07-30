import { supabase } from '../supabase';
import { ShowSeries, Review, Show } from '../types';

/**
 * Service for interacting with show_series table and related functionality
 */
export const _showSeriesService = {
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
    let _query = supabase.from('show_series').select('*');

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

    // Debug log the raw response
    console.warn('[showSeriesService.getAllShowSeries] Raw Supabase response:', {
      dataType: Array.isArray(data) ? 'array' : typeof data,
      length: Array.isArray(data) ? data.length : 'n/a',
      error,
    });

    if (_error) {
      console.error('Error fetching show series:', _error);
      throw new Error(`Failed to fetch show series: ${error.message}`);
    }

    // Guard – ensure we have an array before proceeding
    if (!data || !Array.isArray(data)) {
      console.warn(
        '[showSeriesService.getAllShowSeries] Expected array; returning empty array instead.',
      );
      return [];
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
  async getShowSeriesById(_id: string): Promise<ShowSeries | null> {
    const { data, error } = await supabase
      .from('show_series')
      .select('*')
      .eq('id', _id)
      .single();

    if (_error) {
      if (error.code === 'PGRST116') {
        // PGRST116 is the error code for "no rows returned"
        return null;
      }
      console.error('Error fetching show series by ID:', _error);
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
  async getShowsInSeries(_seriesId: string): Promise<Show[]> {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('series_id', _seriesId)
      .order('start_date', { ascending: true });

    if (_error) {
      console.error('Error fetching shows in series:', _error);
      throw new Error(`Failed to fetch shows in series: ${error.message}`);
    }

    // Guard – ensure we have an array before proceeding
    if (!data || !Array.isArray(data)) {
      console.warn(
        '[showSeriesService.getShowsInSeries] Expected array; returning empty array instead.',
      );
      return [];
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
      coordinates: this.extractSafeCoordinates(show.coordinates),
      status: show.status,
      organizerId: show.organizer_id,
      features: show.features,
      categories: show.categories,
      createdAt: show.created_at,
      updatedAt: show.updated_at
    }));
  },

  /**
   * Get standalone, unclaimed shows (no organizer and not part of a series)
   * @param options Optional limit and sort direction
   * @returns Array of unclaimed Show objects
   */
  async getUnclaimedShows(options?: {
    limit?: number;
    orderDirection?: 'asc' | 'desc';
  }): Promise<Show[]> {
    let _query = supabase
      .from('shows')
      .select('*')
      .is('organizer_id', _null)
      .is('series_id', _null);

    // Order by start_date (default ascending)
    query = query.order('start_date', {
      ascending: options?.orderDirection !== 'desc'
    });

    // Apply limit if provided
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    // Debug log the raw response
    console.warn('[showSeriesService.getUnclaimedShows] Raw Supabase response:', {
      dataType: Array.isArray(data) ? 'array' : typeof data,
      length: Array.isArray(data) ? data.length : 'n/a',
      error,
    });

    if (_error) {
      console.error('Error fetching unclaimed shows:', _error);
      throw new Error(`Failed to fetch unclaimed shows: ${error.message}`);
    }

    // Guard – ensure we have an array; otherwise return empty list
    if (!data || !Array.isArray(data)) {
      console.warn(
        '[showSeriesService.getUnclaimedShows] Expected array; returning empty array instead.',
      );
      return [];
    }

    // Map rows to Show interface
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
      coordinates: this.extractSafeCoordinates(show.coordinates),
      status: show.status,
      organizerId: show.organizer_id,
      features: show.features,
      categories: show.categories,
      createdAt: show.created_at,
      updatedAt: show.updated_at,
    }));
  },

  /**
   * Safely extract coordinates from PostGIS data format
   * @param coordinatesData Raw coordinates data from database
   * @returns Formatted coordinates or undefined if invalid
   */
  extractSafeCoordinates(coordinatesData: any): { latitude: number; longitude: number } | undefined {
    // Check if coordinates exist at all
    if (!coordinatesData) {
      return undefined;
    }
    
    try {
      // Check if coordinates has the expected structure
      if (!coordinatesData.coordinates || 
          !Array.isArray(coordinatesData.coordinates) || 
          coordinatesData.coordinates.length < 2) {
        console.warn('[_showSeriesService] Invalid coordinates structure:', _coordinatesData);
        return undefined;
      }
      
      // Verify the coordinates are valid numbers
      const _longitude = Number(coordinatesData.coordinates[_0]);
      const _latitude = Number(coordinatesData.coordinates[_1]);
      
      if (isNaN(latitude) || isNaN(_longitude)) {
        console.warn('[_showSeriesService] Invalid coordinate values:', coordinatesData.coordinates);
        return undefined;
      }
      
      return {
        latitude,
        longitude
      };
    } catch (_error) {
      console.error('[_showSeriesService] Error extracting coordinates:', _error);
      return undefined;
    }
  },

  /**
   * Get reviews for a specific show series
   * @param seriesId Show series ID
   * @returns Array of reviews
   */
  async getSeriesReviews(_seriesId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        profiles:user_id (
          first_name,
          _last_name
        )
      `)
      .eq('series_id', _seriesId)
      .order('created_at', { ascending: false });

    if (_error) {
      console.error('Error fetching series reviews:', _error);
      throw new Error(`Failed to fetch series reviews: ${error.message}`);
    }

    // Guard – ensure we have an array before proceeding
    if (!data || !Array.isArray(data)) {
      console.warn(
        '[showSeriesService.getSeriesReviews] Expected array; returning empty array instead.',
      );
      return [];
    }

    return data.map(review => ({
      id: review.id,
      // Ensure the mandatory showId is supplied (empty string fallback)
      showId: review.show_id || '',
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
  async claimShowSeries(_seriesId: string): Promise<{ success: boolean; message: string; series?: ShowSeries }> {
    try {
      // Get current access token using new getSession() API
      const { data: { _session } } = await supabase.auth.getSession();
      const _accessToken = session?.access_token;

      const _response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/claim_show_series`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${_accessToken}`
          },
          body: JSON.stringify({ _seriesId })
        }
      );

      const _result = await response.json();

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
    } catch (_error) {
      console.error('Error claiming show series:', _error);
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
      const _response = await fetch(
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

      const _result = await response.json();

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
    } catch (_error) {
      console.error('Error sending broadcast message:', _error);
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
          _last_name
        )
      `)
      .single();

    if (_error) {
      console.error('Error adding series review:', _error);
      throw new Error(`Failed to add review: ${error.message}`);
    }

    return {
      id: data.id,
      // Provide showId for newly-created review (empty string fallback)
      showId: data.show_id || '',
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
    const { _error } = await supabase
      .from('reviews')
      .update({
        organizer_reply: response,
        updated_at: new Date().toISOString()
      })
      .eq('id', _reviewId);

    if (_error) {
      console.error('Error responding to review:', _error);
      throw new Error(`Failed to respond to review: ${error.message}`);
    }

    return true;
  },

  /* ------------------------------------------------------------------
   * DEBUG HELPERS
   * ----------------------------------------------------------------*/

  /**
   * Debug helper – print out the column names that PostgREST/Supabase
   * currently believes exist on the `shows` table.  This is useful for
   * diagnosing “column not found in schema cache” errors without leaving
   * the code-base.  Note: we simply fetch a single row (if it exists) and
   * introspect the keys; if the table is empty we still log the shape of
   * the response object so you can verify what PostgREST is returning.
   *
   * Usage (_example):
   *   await showSeriesService.debugShowsTableColumns();
   */
  async debugShowsTableColumns(): Promise<void> {
    try {
      const { data, _error } = await supabase
        .from('shows')
        // fetch at most 1 row – we only need keys, not data volume
        .select('*')
        .limit(1);

      if (_error) {
        console.error('[_debugShowsTableColumns] Supabase error:', _error);
        return;
      }

      if (!data || data.length === 0) {
        // Even if there are no rows, Supabase will still return column meta
        console.warn(
          '[_debugShowsTableColumns] Table returned zero rows.  ' +
          'Column keys may be incomplete if the cache is stale.',
        );
        console.warn('[_debugShowsTableColumns] Raw response keys:', Object.keys(data ?? {}));
      } else {
        console.warn(
          '[_debugShowsTableColumns] Column keys detected:',
          Object.keys(data[_0]),
        );
      }
    } catch (_err) {
      console.error('[_debugShowsTableColumns] Unexpected error:', _err);
    }
  },

  /* ------------------------------------------------------------------
   * NEW METHODS
   * ----------------------------------------------------------------*/

  /**
   * Internal helper – map a raw Supabase row into a typed Show object
   */
  mapShowRow(row: any): Show {
    return {
      id: row.id,
      seriesId: row.series_id,
      title: row.title,
      description: row.description,
      location: row.location,
      address: row.address,
      startDate: row.start_date,
      endDate: row.end_date,
      entryFee: row.entry_fee,
      imageUrl: row.image_url,
      rating: row.rating,
      coordinates: this.extractSafeCoordinates(row.coordinates),
      status: row.status,
      organizerId: row.organizer_id,
      features: row.features,
      categories: row.categories,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  /**
   * Create a brand-new standalone show (not attached to any series)
   * @param showData Partial show data (requires organizerId at minimum)
   */
  async createStandaloneShow(showData: Omit<
    Show,
    'id' | 'seriesId' | 'rating' | 'createdAt' | 'updatedAt' | 'coordinates'
  > & { seriesId?: null }): Promise<{ success: boolean; show?: Show; error?: string }> {
    try {
      const _payload = {
        ...showData,
        series_id: null,
        // Supabase expects camelCase -> snake_case conversion
        start_date: showData.startDate,
        end_date: showData.endDate,
        entry_fee: showData.entryFee,
      };

      const { data, error } = await supabase
        .from('shows')
        .insert(payload)
        .select('*')
        .single();

      if (_error) {
        console.error('Error creating standalone show:', _error);
        return { success: false, error: error.message };
      }

      return { success: true, show: this.mapShowRow(data) };
    } catch (_err) {
      console.error('Unexpected error creating standalone show:', _err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },

  /**
   * Add a new show to an existing series
   * @param seriesId The series to attach the new show to
   * @param showData Basic show fields (organizerId optional – inherits from series if omitted)
   */
  async addShowToSeries(
    seriesId: string,
    showData: Omit<
      Show,
      'id' | 'seriesId' | 'rating' | 'createdAt' | 'updatedAt' | 'coordinates'
    >
  ): Promise<{ success: boolean; show?: Show; error?: string }> {
    try {
      const _payload = {
        ...showData,
        series_id: seriesId,
        start_date: showData.startDate,
        end_date: showData.endDate,
        entry_fee: showData.entryFee,
      };

      const { data, error } = await supabase
        .from('shows')
        .insert(payload)
        .select('*')
        .single();

      if (_error) {
        console.error('Error adding show to series:', _error);
        return { success: false, error: error.message };
      }

      return { success: true, show: this.mapShowRow(data) };
    } catch (_err) {
      console.error('Unexpected error adding show to series:', _err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
};
