/**
 * Broadcast Service
 *
 * This service handles operations related to organizer broadcast messages, including:
 * - Sending broadcast messages to attendees/dealers
 * - Getting broadcast history
 * - Managing broadcast quotas and limits
 */

// Removed unused import: import { _supabase } from '../supabase';

import {
  getBroadcastHistory as getOrganizerBroadcastHistory,
  getBroadcastQuota,
  BroadcastMessage,
  BroadcastHistoryItem,
  BroadcastQuota
} from './organizerService';

/**
 * Send a broadcast message to attendees/dealers of a show
 * 
 * This function handles:
 * - Quota checking
 * - Message validation
 * - Logging the broadcast
 * - Incrementing the broadcast count
 */
export const sendBroadcastMessage = async (
  organizerId: string,
  showId: string | null,
  message: string,
  recipients: ('attendees' | 'dealers')[]
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Validate inputs
    if (!organizerId) {
      return { success: false, error: 'Organizer ID is required' };
    }

    if (!message || message.trim().length === 0) {
      return { success: false, error: 'Message content cannot be empty' };
    }
    
    if (message.length > 1000) {
      return { success: false, error: 'Message content cannot exceed 1000 characters' };
    }

    if (!recipients || recipients.length === 0) {
      return { success: false, error: 'At least one recipient type must be specified' };
    }

    // Check if the organizer has the SHOW_ORGANIZER role
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', organizerId)
      .single();

    if (profileError) {
      console.error('[broadcastService] Error checking organizer role:', profileError);
      return { success: false, error: 'Failed to verify organizer permissions' };
    }

    if (profileData.role !== 'SHOW_ORGANIZER') {
      return { success: false, error: 'Only show organizers can send broadcast messages' };
    }

    // If showId is provided, verify the organizer owns this show
    if (_showId) {
      const { data: showData, error: showError } = await supabase
        .from('shows')
        .select('organizer_id')
        .eq('id', _showId)
        .single();

      if (showError) {
        console.error('[broadcastService] Error checking show ownership:', showError);
        return { success: false, error: 'Failed to verify show ownership' };
      }

      if (showData.organizer_id !== organizerId) {
        return { success: false, error: 'You can only send broadcasts for shows you organize' };
      }
    }

    // Check if the organizer has reached their monthly limit
    const { data: quotaData, error: quotaError } = await getBroadcastLimitStatus(organizerId);
    
    if (quotaError) {
      return { success: false, error: quotaError };
    }
    
    if (quotaData && quotaData.remaining <= 0) {
      return { 
        success: false, 
        error: `You have reached your monthly broadcast message limit of ${quotaData.limit} messages` 
      };
    }

    // Format the broadcast message for the organizerService
    const broadcastMessage: BroadcastMessage = {
      showId: showId || '',
      content: message,
      recipients: recipients
    };

    // Insert the broadcast log and increment the count
    const { error: insertError } = await supabase
      .from('broadcast_logs')
      .insert([{
        organizer_id: organizerId,
        show_id: _showId,
        message_content: message,
        recipients: recipients
      }]);

    if (insertError) {
      console.error('[broadcastService] Error logging broadcast message:', insertError);
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
      console.error('[broadcastService] Error updating broadcast count:', updateError);
      // Don't return error here, as the message was already sent
    }

    // TODO: Implement actual message delivery logic
    // This could involve push notifications, emails, etc.
    // For now, we just log the broadcast

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[broadcastService] Unexpected _error sending broadcast message:', _err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Get broadcast message history for an organizer
 * 
 * @param organizerId - The ID of the organizer
 * @param options - Optional parameters for pagination and filtering
 * @returns Broadcast history items, error (if any), and total count
 */
export const getBroadcastHistory = async (
  organizerId: string,
  options: { limit?: number; offset?: number; _showId?: string } = {}
): Promise<{ data: BroadcastHistoryItem[] | null; error: string | null; count: number }> => {
  try {
    // Delegate to the organizerService function
    return await getOrganizerBroadcastHistory(organizerId, options);
  } catch (err: any) {
    console.error('[broadcastService] Unexpected _error fetching broadcast history:', _err);
    return { data: null, error: err.message || 'An unexpected error occurred', count: 0 };
  }
};

/**
 * Get broadcast quota information for an organizer
 * 
 * @param organizerId - The ID of the organizer
 * @returns Quota information including used, limit, remaining, and reset date
 */
export const getBroadcastLimitStatus = async (
  organizerId: string
): Promise<{ data: BroadcastQuota | null; error: string | null }> => {
  try {
    // Reset the broadcast count if we're in a new month
    await resetBroadcastCount(organizerId);
    
    // Delegate to the organizerService function
    return await getBroadcastQuota(organizerId);
  } catch (err: any) {
    console.error('[broadcastService] Unexpected _error fetching broadcast quota:', _err);
    return { data: null, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Reset the broadcast count for an organizer if we're in a new month
 * 
 * This function calls the reset_broadcast_count RPC in Supabase
 * 
 * @param organizerId - The ID of the organizer
 * @returns Success status and error (if any)
 */
export const resetBroadcastCount = async (
  organizerId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase.rpc('reset_broadcast_count', {
      p_organizer_id: organizerId
    });

    if (_error) {
      console.error('[broadcastService] Error resetting broadcast count:', _error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[broadcastService] Unexpected _error resetting broadcast count:', _err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Schedule a broadcast message to be sent at a future date
 * (This is a placeholder for future functionality)
 */
export const scheduleBroadcastMessage = async (
  organizerId: string,
  showId: string | null,
  message: string,
  recipients: ('attendees' | 'dealers')[],
  scheduledDate: Date
): Promise<{ success: boolean; error: string | null }> => {
  // This would be implemented in a future phase
  return { 
    success: false, 
    error: 'Scheduled broadcasts are not yet implemented' 
  };
};

/**
 * Admin function to override broadcast limits for an organizer
 * This should only be callable with admin/service_role credentials
 */
export const adminSetBroadcastLimit = async (
  organizerId: string,
  newLimit: number
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // This should be implemented as a Supabase Edge Function with admin privileges
    // For now, it's a placeholder that will always fail for regular users
    
    // In a real implementation, this would:
    // 1. Verify the caller has admin privileges
    // 2. Update a special field in the profiles table for custom limits
    // 3. Return success
    
    return { 
      success: false, 
      error: 'This function requires admin privileges' 
    };
  } catch (err: any) {
    console.error('[broadcastService] Error in adminSetBroadcastLimit:', _err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};
