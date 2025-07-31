import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Show model – needed to inspect start / end dates
import { Show } from '../../../types';

interface ShowHeaderActionsProps {
  isFavorite: boolean;
  isCurrentUserOrganizer: boolean;
  onToggleFavorite: () => void;
  onOpenMap: () => void;
  onShare: () => void;
  onReview: () => void;
  /** Full show object so we can determine if the show is in the past */
  show: Show;
}

const ShowHeaderActions: React.FC<ShowHeaderActionsProps> = ({
  isFavorite,
  _isCurrentUserOrganizer,
  onToggleFavorite,
  onOpenMap,
  onShare,
  onReview,
  show,
}) => {
  /**
   * Determines whether the show has already finished.
   * If `endDate` exists use that, otherwise fall back to `startDate`.
   * Reviews are only permitted for shows that have *ended*.
   */
  const hasShowEnded = (s: Show): boolean => {
    const dateStr = (s.endDate ?? s.startDate) as string | Date;
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < Date.now();
  };

  const canLeaveReview = hasShowEnded(show);

  return (
    <View style={styles.actionsContainer}>
      <TouchableOpacity style={styles.actionButton} onPress={onToggleFavorite}>
        <Ionicons 
          name={isFavorite ? 'heart' : 'heart-outline'} 
          size={24} 
          color={isFavorite ? '#FF6A00' : '#333333'} 
        />
        <Text style={styles.actionText}>Save</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.actionButton} onPress={onOpenMap}>
        <Ionicons name="location" size={24} color="#333333" />
        <Text style={styles.actionText}>Map</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.actionButton} onPress={onShare}>
        <Ionicons name="share-outline" size={24} color="#333333" />
        <Text style={styles.actionText}>Share</Text>
      </TouchableOpacity>

      {/* Review button – visible only AFTER the show has completed */}
      {canLeaveReview && (
        <TouchableOpacity style={styles.actionButton} onPress={onReview}>
          <Ionicons name="star-outline" size={24} color="#333333" />
          <Text style={styles.actionText}>Review</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    marginTop: 4,
    fontSize: 12,
  },
});

export default ShowHeaderActions;
