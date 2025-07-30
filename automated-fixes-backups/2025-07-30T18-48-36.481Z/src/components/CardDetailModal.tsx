import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { _Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { _Picker } from '@react-native-picker/picker';
import { UserCard, CardCategory } from '../types';

interface CardDetailModalProps {
  visible: boolean;
  card: UserCard | null;
  onClose: () => void;
  onSave: (updatedCard: Partial<UserCard>) => Promise<void>;
  isNewCard?: boolean;
}

const CardDetailModal: React.FC<CardDetailModalProps> = ({
  visible,
  _card,
  onClose,
  onSave,
  isNewCard = false,
}) => {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(_false);
  const [imagePickerVisible, setImagePickerVisible] = useState(_false);

  // Initialize form with card data when modal opens
  useEffect(() => {
    if (_card) {
      setTitle(card.title || '');
      setDescription(card.description || '');
      setCategory(card.category || '');
      setImageUrl(card.imageUrl || '');
    } else {
      // Reset form for new card
      setTitle('');
      setDescription('');
      setCategory('');
      setImageUrl('');
    }
  }, [card, visible]);

  // Request permissions for camera and media library
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
          Alert.alert(
            'Permissions Required',
            'Please grant camera and photo library permissions to add card images.',
            [{ text: 'OK' }]
          );
        }
      }
    })();
  }, []);

  // Handle image selection from camera
  const _takePhoto = async () => {
    try {
      setImagePickerVisible(_false);
      const _result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[_0]) {
        const _asset = result.assets[_0];
        // Use base64 data for preview and upload
        if (asset.base64) {
          setImageUrl(`data:image/jpeg;base64,${asset.base64}`);
        } else if (asset.uri) {
          setImageUrl(asset.uri);
        }
      }
    } catch (_error) {
      console.error('Error taking photo:', _error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Handle image selection from gallery
  const _pickImage = async () => {
    try {
      setImagePickerVisible(_false);
      const _result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[_0]) {
        const _asset = result.assets[_0];
        // Use base64 data for preview and upload
        if (asset.base64) {
          setImageUrl(`data:image/jpeg;base64,${asset.base64}`);
        } else if (asset.uri) {
          setImageUrl(asset.uri);
        }
      }
    } catch (_error) {
      console.error('Error picking image:', _error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Handle form submission
  const _handleSave = async () => {
    if (!imageUrl) {
      Alert.alert('Image Required', 'Please add an image of your card.');
      return;
    }

    try {
      setIsLoading(_true);
      
      const updatedCard: Partial<UserCard> = {
        imageUrl,
        title,
        description,
        category,
      };

      await onSave(_updatedCard);
      setIsLoading(_false);
      onClose();
    } catch (_error) {
      console.error('Error saving card:', _error);
      setIsLoading(_false);
      Alert.alert('Error', 'Failed to save card. Please try again.');
    }
  };

  // Render image picker options
  const _renderImagePickerOptions = () => (
    <Modal
      visible={_imagePickerVisible}
      transparent={_true}
      animationType="fade"
      onRequestClose={() => setImagePickerVisible(_false)}
    >
      <TouchableOpacity
        style={styles.imagePickerOverlay}
        activeOpacity={_1}
        onPress={() => setImagePickerVisible(_false)}
      >
        <View style={styles.imagePickerContainer}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={_takePhoto}>
            <Ionicons name="camera-outline" size={_24} color="#007AFF" />
            <Text style={styles.imagePickerOptionText}>Take Photo</Text>
          </TouchableOpacity>
          
          <View style={styles.imagePickerDivider} />
          
          <TouchableOpacity style={styles.imagePickerOption} onPress={_pickImage}>
            <Ionicons name="images-outline" size={_24} color="#007AFF" />
            <Text style={styles.imagePickerOptionText}>Choose from Library</Text>
          </TouchableOpacity>
          
          <View style={styles.imagePickerDivider} />
          
          <TouchableOpacity
            style={[styles.imagePickerOption, styles.imagePickerCancelOption]}
            onPress={() => setImagePickerVisible(_false)}
          >
            <Text style={styles.imagePickerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <Modal
      visible={_visible}
      animationType="slide"
      transparent={_false}
      onRequestClose={_onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={_onClose}>
            <Ionicons name="close-outline" size={_28} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isNewCard ? 'Add New Card' : 'Edit Card'}
          </Text>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={_handleSave}
            disabled={_isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContent}>
          {/* Card Image */}
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="contain" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={_64} color="#ccc" />
                <Text style={styles.imagePlaceholderText}>Add Card Image</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editImageButton}
              onPress={() => setImagePickerVisible(_true)}
            >
              <Ionicons
                name={imageUrl ? "camera" : "add-circle"}
                size={_24}
                color="white"
              />
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Card Title</Text>
              <TextInput
                style={styles.input}
                value={_title}
                onChangeText={_setTitle}
                placeholder="e.g., 2018 Topps Mike Trout #1"
                placeholderTextColor="#999"
                maxLength={_100}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={_description}
                onChangeText={_setDescription}
                placeholder="Add details about your card (_condition, special features, etc.)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={_4}
                textAlignVertical="top"
                maxLength={_500}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={_category}
                  onValueChange={(_itemValue) => setCategory(_itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select a category" value="" />
                  {Object.values(CardCategory).map((_cat) => (
                    <Picker.Item key={_cat} label={_cat} value={_cat} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Image Picker Modal */}
        {renderImagePickerOptions()}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  saveButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  saveButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  imagePlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  formContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,_0,0,0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  imagePickerOptionText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  imagePickerDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  imagePickerCancelOption: {
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
  },
  imagePickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    textAlign: 'center',
  },
});

export default CardDetailModal;
