// src/screens/CreateShowScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { createCardShow, updateCardShow } from '../services/firebaseApi';
import { uploadShowImage } from '../services/storageService';

// Same categories as in ProfileSetupScreen
const CARD_CATEGORIES = [
  'Sports Cards',
  'Baseball Cards',
  'Basketball Cards',
  'Football Cards',
  'Hockey Cards',
  'Pokemon Cards',
  'Magic: The Gathering',
  'Yu-Gi-Oh!',
  'Other TCGs',
  'Vintage Cards',
  'Modern Cards',
  'Autographs',
  'Memorabilia'
];

// Features that can be toggled
const SHOW_FEATURES = [
  { id: 'hasOnsiteGrading', label: 'On-site Grading Service' },
  { id: 'hasAutographGuests', label: 'Autograph Guests' },
  { id: 'hasRefreshments', label: 'Food & Refreshments' },
  { id: 'hasWifi', label: 'Free WiFi' },
  { id: 'hasDoorPrizes', label: 'Door Prizes' }
];

// Form steps
const FORM_STEPS = [
  'Basic Info',
  'Location',
  'Features',
  'Categories',
  'Details',
  'Image'
];

const CreateShowScreen = ({ route }) => {
  const navigation = useNavigation();
  const { currentUser, userProfile } = useUser();
  const editMode = route.params?.editMode || false;
  const existingShow = route.params?.show || null;
  
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    date: new Date(),
    startTime: new Date(),
    endTime: new Date(new Date().setHours(new Date().getHours() + 5)),
    location: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    coordinate: {
      latitude: 41.8781,
      longitude: -87.6298
    },
    entryFee: '',
    description: '',
    categories: [],
    hasOnsiteGrading: false,
    hasAutographGuests: false,
    hasRefreshments: false,
    hasWifi: false,
    hasDoorPrizes: false,
    image: null,
    imageUrl: '',
    promoterId: currentUser?.uid || '',
    promoterName: userProfile?.firstName || 'Card Show Promoter',
    createdAt: new Date(),
  });
  
  // Form validation state
  const [errors, setErrors] = useState({});
  
  // Initialize form with existing data if in edit mode
  useEffect(() => {
    if (editMode && existingShow) {
      // Convert any date strings to Date objects
      const showDate = existingShow.date instanceof Date 
        ? existingShow.date 
        : new Date(existingShow.date);
      
      setFormData({
        ...formData,
        ...existingShow,
        date: showDate,
        startTime: existingShow.startTime instanceof Date 
          ? existingShow.startTime 
          : new Date(existingShow.startTime || showDate),
        endTime: existingShow.endTime instanceof Date 
          ? existingShow.endTime 
          : new Date(existingShow.endTime || new Date(showDate).setHours(showDate.getHours() + 5)),
      });
    }
  }, [editMode, existingShow]);
  
  // Check if user is a promoter
  useEffect(() => {
    if (userProfile && userProfile.role !== 'promoter') {
      Alert.alert(
        'Promoter Access Only',
        'You need to be a promoter to create or edit shows. Would you like to upgrade your account?',
        [
          { text: 'Not Now', onPress: () => navigation.goBack() },
          { text: 'Upgrade', onPress: () => navigation.navigate('Profile') }
        ]
      );
    }
  }, [userProfile, navigation]);
  
  // Update title based on mode
  useEffect(() => {
    navigation.setOptions({
      title: editMode ? 'Edit Card Show' : 'Create Card Show',
    });
  }, [navigation, editMode]);
  
  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    
    // Clear error when field is updated
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };
  
  // Toggle category selection
  const toggleCategory = (category) => {
    const updatedCategories = [...formData.categories];
    const categoryIndex = updatedCategories.indexOf(category);
    
    if (categoryIndex >= 0) {
      updatedCategories.splice(categoryIndex, 1);
    } else {
      updatedCategories.push(category);
    }
    
    handleInputChange('categories', updatedCategories);
  };
  
  // Toggle feature
  const toggleFeature = (featureId) => {
    handleInputChange(featureId, !formData[featureId]);
  };
  
  // Format date for display
  const formatDate = (date) => {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };
  
  // Format time for display
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Handle date selection
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      handleInputChange('date', selectedDate);
    }
  };
  
  // Handle time selection
  const handleTimeChange = (type, event, selectedTime) => {
    if (Platform.OS === 'android') {
      setFormData(prev => ({ ...prev, showTimePicker: null }));
    }
    
    if (selectedTime) {
      handleInputChange(type, selectedTime);
    }
  };
  
  // Pick image from library
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'You need to grant access to your photo library to upload an image.'
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        handleInputChange('image', selectedAsset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };
  
  // Validate current step
  const validateStep = () => {
    const newErrors = {};
    
    switch (currentStep) {
      case 0: // Basic Info
        if (!formData.title.trim()) {
          newErrors.title = 'Show title is required';
        }
        break;
        
      case 1: // Location
        if (!formData.location.trim()) {
          newErrors.location = 'Venue name is required';
        }
        if (!formData.address.trim()) {
          newErrors.address = 'Address is required';
        }
        if (!formData.city.trim()) {
          newErrors.city = 'City is required';
        }
        if (!formData.state.trim()) {
          newErrors.state = 'State is required';
        }
        if (!formData.zipCode.trim()) {
          newErrors.zipCode = 'ZIP code is required';
        } else if (!/^\d{5}(-\d{4})?$/.test(formData.zipCode.trim())) {
          newErrors.zipCode = 'Please enter a valid ZIP code';
        }
        break;
        
      case 3: // Categories
        if (formData.categories.length === 0) {
          newErrors.categories = 'Please select at least one category';
        }
        break;
        
      case 4: // Details
        if (formData.entryFee.trim() && !/^\$?\d+(\.\d{1,2})?$|^Free$/i.test(formData.entryFee.trim())) {
          newErrors.entryFee = 'Please enter a valid price or "Free"';
        }
        if (!formData.description.trim()) {
          newErrors.description = 'Description is required';
        } else if (formData.description.length < 20) {
          newErrors.description = 'Description should be at least 20 characters';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Move to next step
  const nextStep = () => {
    if (validateStep()) {
      if (currentStep < FORM_STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };
  
  // Move to previous step
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      // Confirm exit
      Alert.alert(
        'Discard Changes?',
        'Are you sure you want to exit? All your changes will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    }
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Prepare data for submission
      const showData = { ...formData };
      
      // Upload image if selected
      if (formData.image && formData.image !== existingShow?.imageUrl) {
        const { success, imageUrl, error } = await uploadShowImage(formData.image, currentUser.uid);
        
        if (!success) {
          Alert.alert('Upload Error', error || 'Failed to upload image');
          setLoading(false);
          return;
        }
        
        showData.imageUrl = imageUrl;
      }
      
      // Create or update show
      const { success, error, showId } = editMode
        ? await updateCardShow(existingShow.id, showData)
        : await createCardShow(showData);
      
      if (!success) {
        Alert.alert('Error', error || 'Failed to save card show');
        setLoading(false);
        return;
      }
      
      // Show success message
      Alert.alert(
        'Success!',
        editMode
          ? 'Your card show has been updated.'
          : 'Your card show has been created and is now visible to attendees.',
        [{ text: 'OK', onPress: () => navigation.navigate('MyShows') }]
      );
    } catch (error) {
      console.error('Error saving show:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Render step indicator
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {FORM_STEPS.map((step, index) => (
        <View key={step} style={styles.stepItem}>
          <View 
            style={[
              styles.stepCircle,
              currentStep === index && styles.activeStepCircle,
              currentStep > index && styles.completedStepCircle
            ]}
          >
            {currentStep > index ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={[
                styles.stepNumber,
                currentStep === index && styles.activeStepNumber
              ]}>
                {index + 1}
              </Text>
            )}
          </View>
          <Text style={[
            styles.stepLabel,
            currentStep === index && styles.activeStepLabel
          ]}>
            {step}
          </Text>
        </View>
      ))}
    </View>
  );
  
  // Render form based on current step
  const renderFormStep = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          <View style={styles.formStep}>
            <Text style={styles.stepTitle}>Basic Information</Text>
            <Text style={styles.stepDescription}>
              Let's start with the essential details about your card show.
            </Text>
            
            <Text style={styles.inputLabel}>Show Title</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="Enter show title"
              value={formData.title}
              onChangeText={(text) => handleInputChange('title', text)}
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            
            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>{formatDate(formData.date)}</Text>
              <Ionicons name="calendar-outline" size={24} color="#3498db" />
            </TouchableOpacity>
            
            {showDatePicker && (
              <DateTimePicker
                value={formData.date}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}
            
            <View style={styles.timeContainer}>
              <View style={styles.timeField}>
                <Text style={styles.inputLabel}>Start Time</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setFormData(prev => ({ ...prev, showTimePicker: 'startTime' }))}
                >
                  <Text style={styles.timeButtonText}>{formatTime(formData.startTime)}</Text>
                  <Ionicons name="time-outline" size={24} color="#3498db" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.timeField}>
                <Text style={styles.inputLabel}>End Time</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setFormData(prev => ({ ...prev, showTimePicker: 'endTime' }))}
                >
                  <Text style={styles.timeButtonText}>{formatTime(formData.endTime)}</Text>
                  <Ionicons name="time-outline" size={24} color="#3498db" />
                </TouchableOpacity>
              </View>
            </View>
            
            {formData.showTimePicker && (
              <DateTimePicker
                value={formData[formData.showTimePicker]}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedTime) => 
                  handleTimeChange(formData.showTimePicker, event, selectedTime)
                }
              />
            )}
          </View>
        );
        
      case 1: // Location
        return (
          <View style={styles.formStep}>
            <Text style={styles.stepTitle}>Location Details</Text>
            <Text style={styles.stepDescription}>
              Tell collectors where your card show will be held.
            </Text>
            
            <Text style={styles.inputLabel}>Venue Name</Text>
            <TextInput
              style={[styles.input, errors.location && styles.inputError]}
              placeholder="Convention center, hotel, etc."
              value={formData.location}
              onChangeText={(text) => handleInputChange('location', text)}
            />
            {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
            
            <Text style={styles.inputLabel}>Street Address</Text>
            <TextInput
              style={[styles.input, errors.address && styles.inputError]}
              placeholder="123 Main St"
              value={formData.address}
              onChangeText={(text) => handleInputChange('address', text)}
            />
            {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
            
            <View style={styles.rowFields}>
              <View style={styles.cityField}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={[styles.input, errors.city && styles.inputError]}
                  placeholder="City"
                  value={formData.city}
                  onChangeText={(text) => handleInputChange('city', text)}
                />
                {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
              </View>
              
              <View style={styles.stateField}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={[styles.input, errors.state && styles.inputError]}
                  placeholder="State"
                  value={formData.state}
                  onChangeText={(text) => handleInputChange('state', text)}
                  maxLength={2}
                />
                {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
              </View>
              
              <View style={styles.zipField}>
                <Text style={styles.inputLabel}>ZIP Code</Text>
                <TextInput
                  style={[styles.input, errors.zipCode && styles.inputError]}
                  placeholder="12345"
                  value={formData.zipCode}
                  onChangeText={(text) => handleInputChange('zipCode', text)}
                  keyboardType="numeric"
                  maxLength={10}
                />
                {errors.zipCode && <Text style={styles.errorText}>{errors.zipCode}</Text>}
              </View>
            </View>
            
            <Text style={styles.mapNote}>
              <Ionicons name="information-circle-outline" size={16} color="#6c757d" /> 
              Map location will be automatically determined from the address.
            </Text>
          </View>
        );
        
      case 2: // Features
        return (
          <View style={styles.formStep}>
            <Text style={styles.stepTitle}>Show Features</Text>
            <Text style={styles.stepDescription}>
              Select the features that will be available at your card show.
            </Text>
            
            {SHOW_FEATURES.map((feature) => (
              <View key={feature.id} style={styles.featureRow}>
                <Text style={styles.featureText}>{feature.label}</Text>
                <Switch
                  value={formData[feature.id] || false}
                  onValueChange={() => toggleFeature(feature.id)}
                  trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
                  thumbColor={formData[feature.id] ? '#3498db' : '#f4f3f4'}
                />
              </View>
            ))}
            
            <Text style={styles.featureNote}>
              <Ionicons name="bulb-outline" size={16} color="#6c757d" /> 
              Shows with more features typically attract more attendees.
            </Text>
          </View>
        );
        
      case 3: // Categories
        return (
          <View style={styles.formStep}>
            <Text style={styles.stepTitle}>Card Categories</Text>
            <Text style={styles.stepDescription}>
              Select all card types that will be featured at your show.
            </Text>
            
            <View style={styles.categoriesContainer}>
              {CARD_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    formData.categories.includes(category) && styles.selectedCategory
                  ]}
                  onPress={() => toggleCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      formData.categories.includes(category) && styles.selectedCategoryText
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {errors.categories && <Text style={styles.errorText}>{errors.categories}</Text>}
          </View>
        );
        
      case 4: // Details
        return (
          <View style={styles.formStep}>
            <Text style={styles.stepTitle}>Show Details</Text>
            <Text style={styles.stepDescription}>
              Provide additional information about your card show.
            </Text>
            
            <Text style={styles.inputLabel}>Admission Price</Text>
            <TextInput
              style={[styles.input, errors.entryFee && styles.inputError]}
              placeholder="$5.00 or Free"
              value={formData.entryFee}
              onChangeText={(text) => handleInputChange('entryFee', text)}
              keyboardType="default"
            />
            {errors.entryFee && <Text style={styles.errorText}>{errors.entryFee}</Text>}
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textArea, errors.description && styles.inputError]}
              placeholder="Describe your card show, including details about dealers, special guests, and any other important information..."
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            
            <Text style={styles.characterCount}>
              {formData.description.length} / 500 characters
            </Text>
          </View>
        );
        
      case 5: // Image
        return (
          <View style={styles.formStep}>
            <Text style={styles.stepTitle}>Show Image</Text>
            <Text style={styles.stepDescription}>
              Upload a promotional image or flyer for your card show.
            </Text>
            
            <TouchableOpacity style={styles.imageUploadArea} onPress={pickImage}>
              {formData.image || formData.imageUrl ? (
                <Image
                  source={{ uri: formData.image || formData.imageUrl }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="image-outline" size={48} color="#adb5bd" />
                  <Text style={styles.uploadText}>Tap to select an image</Text>
                  <Text style={styles.uploadSubtext}>
                    Use a high-quality image in landscape orientation
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            {(formData.image || formData.imageUrl) && (
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={pickImage}
              >
                <Text style={styles.changeImageText}>Change Image</Text>
              </TouchableOpacity>
            )}
            
            <Text style={styles.imageNote}>
              <Ionicons name="information-circle-outline" size={16} color="#6c757d" /> 
              Shows with images get up to 3x more interest from collectors.
            </Text>
          </View>
        );
    }
  };
  
  // If not a promoter, don't render the form
  if (userProfile && userProfile.role !== 'promoter') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {renderStepIndicator()}
        {renderFormStep()}
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={prevStep}
        >
          <Ionicons name="arrow-back" size={20} color="#3498db" />
          <Text style={styles.backButtonText}>
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.nextButton}
          onPress={nextStep}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {currentStep === FORM_STEPS.length - 1 ? 'Submit' : 'Next'}
              </Text>
              {currentStep < FORM_STEPS.length - 1 && (
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  stepItem: {
    alignItems: 'center',
    width: 50,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeStepCircle: {
    backgroundColor: '#3498db',
  },
  completedStepCircle: {
    backgroundColor: '#28a745',
  },
  stepNumber: {
    color: '#6c757d',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeStepNumber: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  activeStepLabel: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  formStep: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#212529',
  },
  stepDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    color: '#495057',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#dc3545',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: -12,
    marginBottom: 16,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#212529',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeField: {
    width: '48%',
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#212529',
  },
  rowFields: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cityField: {
    width: '48%',
  },
  stateField: {
    width: '20%',
  },
  zipField: {
    width: '28%',
  },
  mapNote: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  featureText: {
    fontSize: 16,
    color: '#212529',
  },
  featureNote: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
    backgroundColor: '#f8f9fa',
  },
  selectedCategory: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  categoryText: {
    fontSize: 14,
    color: '#495057',
  },
  selectedCategoryText: {
    color: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    height: 120,
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'right',
    marginBottom: 16,
  },
  imageUploadArea: {
    borderWidth: 2,
    borderColor: '#ced4da',
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadText: {
    fontSize: 16,
    color: '#495057',
    marginTop: 12,
    fontWeight: '500',
  },
  uploadSubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changeImageButton: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  changeImageText: {
    color: '#3498db',
    fontSize: 16,
  },
  imageNote: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  backButtonText: {
    color: '#3498db',
    fontSize: 16,
    marginLeft: 8,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default CreateShowScreen;
