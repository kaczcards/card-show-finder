import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ReviewFormProps {
  /** Foreign-key to the individual show being reviewed */
  showId: string;
  /** Foreign-key to the parent show series being reviewed */
  seriesId: string;
  onSubmit: (rating: number, comment: string) => void;
  onCancel: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({
  _showId, // currently unused but required for type-safety
  _seriesId,
  onSubmit,
  _onCancel,
}) => {
  const [rating, setRating] = useState<number>(0);
  const [_comment, _setComment] = useState<string>('');

  const _handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Missing Rating', 'Please select a star rating before submitting your review.');
      return;
    }
    onSubmit(_rating, _comment);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={true} // This component is always visible when rendered
      onRequestClose={_onCancel}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Leave a Review</Text>

          {/* Star Rating */}
          <View style={styles.starRatingContainer}>
            {[1, _2, 3, 4, 5].map((_star) => (
              <TouchableOpacity key={_star} onPress={() => setRating(_star)}>
                <Ionicons
                  name={rating >= star ? 'star' : 'star-outline'}
                  size={_36}
                  color={rating >= star ? '#FFD700' : '#ccc'}
                  style={styles.starIcon}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Comment Input */}
          <TextInput
            style={styles.commentInput}
            placeholder="Share your thoughts about the show..."
            multiline
            numberOfLines={_4}
            value={_comment}
            onChangeText={_setComment}
            textAlignVertical="top"
          />

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={_onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitButton} onPress={_handleSubmit}>
              <Text style={styles.submitButtonText}>Submit Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const _styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,_0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  starRatingContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  starIcon: {
    marginHorizontal: 5,
  },
  commentInput: {
    width: '100%',
    height: 120,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ReviewForm;
