import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ShowHeaderActionsProps {
  isFavorite: boolean;
  isCurrentUserOrganizer: boolean;
  onToggleFavorite: () => void;
  onOpenMap: () => void;
  onShare: () => void;
  onReview: () => void;
}

const ShowHeaderActions: React.FC<ShowHeaderActionsProps> = ({
  isFavorite,
  isCurrentUserOrganizer,
  onToggleFavorite,
  onOpenMap,
  onShare,
  onReview,
}) => {
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
      
      <TouchableOpacity style={styles.actionButton} onPress={onReview}>
        <Ionicons name="star-outline" size={24} color="#333333" />
        <Text style={styles.actionText}>Review</Text>
      </TouchableOpacity>
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
