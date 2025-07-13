import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { showSeriesService } from '../../services/showSeriesService';
import { OrganizerStackParamList } from '../../navigation/OrganizerNavigator';
import { useAuth } from '../../contexts/AuthContext';

type AddShowScreenRouteProp = RouteProp<OrganizerStackParamList, 'AddShow'>;

const AddShowScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<AddShowScreenRouteProp>();
  const { authState } = useAuth();
  const { seriesId } = route.params || {};
  const userId = authState?.user?.id;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Categories and features (optional)
  const [categories, setCategories] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle date changes
  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
      
      // If end date is before the new start date, update it
      if (endDate < selectedDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Show title is required';
    }

    if (!location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (startDate > endDate) {
      newErrors.dates = 'End date cannot be before start date';
    }

    if (entryFee && isNaN(Number(entryFee))) {
      newErrors.entryFee = 'Entry fee must be a valid number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    console.log('[AddShowScreen] Submit button pressed');
    
    if (!validateForm()) {
      console.log('[AddShowScreen] Form validation failed');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'You must be logged in to create a show');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('[AddShowScreen] Creating new show...');
      
      const showData = {
        title,
        description,
        location,
        address,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        entryFee: entryFee ? Number(entryFee) : 0,
        organizerId: userId,
        seriesId: seriesId || null,
        categories: categories.length > 0 ? categories : null,
        features: features.length > 0 ? features : null,
      };

      // Call the appropriate service method
      const result = seriesId 
        ? await showSeriesService.addShowToSeries(seriesId, showData)
        : await showSeriesService.createStandaloneShow(showData);

      if (result.error) {
        throw new Error(result.error);
      }

      console.log('[AddShowScreen] Show created successfully:', result);
      
      Alert.alert(
        'Success',
        'Your show has been created successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('[AddShowScreen] Error creating show:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create show. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle category selection
  const toggleCategory = (category: string) => {
    setCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Toggle feature selection
  const toggleFeature = (feature: string) => {
    setFeatures(prev => 
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          {/* Title */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Show Title*</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter show title"
              placeholderTextColor="#999"
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
          </View>

          {/* Location */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location Name*</Text>
            <TextInput
              style={[styles.input, errors.location && styles.inputError]}
              value={location}
              onChangeText={setLocation}
              placeholder="Convention center, hotel, etc."
              placeholderTextColor="#999"
            />
            {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
          </View>

          {/* Address */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Address*</Text>
            <TextInput
              style={[styles.input, errors.address && styles.inputError]}
              value={address}
              onChangeText={setAddress}
              placeholder="Street address, city, state, zip"
              placeholderTextColor="#999"
              multiline
            />
            {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
          </View>

          {/* Dates */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Event Dates*</Text>
            
            {/* Start Date */}
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#0057B8" style={styles.dateIcon} />
              <Text style={styles.dateText}>Start: {formatDate(startDate)}</Text>
            </TouchableOpacity>
            
            {/* End Date */}
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#0057B8" style={styles.dateIcon} />
              <Text style={styles.dateText}>End: {formatDate(endDate)}</Text>
            </TouchableOpacity>
            
            {errors.dates && <Text style={styles.errorText}>{errors.dates}</Text>}
            
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={onStartDateChange}
                minimumDate={new Date()}
              />
            )}
            
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={onEndDateChange}
                minimumDate={startDate}
              />
            )}
          </View>

          {/* Entry Fee */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Entry Fee ($)</Text>
            <TextInput
              style={[styles.input, errors.entryFee && styles.inputError]}
              value={entryFee}
              onChangeText={setEntryFee}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
            {errors.entryFee && <Text style={styles.errorText}>{errors.entryFee}</Text>}
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.textArea, errors.description && styles.inputError]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your show, including details about vendors, special guests, etc."
              placeholderTextColor="#999"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          {/* Categories */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Categories (Optional)</Text>
            <View style={styles.tagsContainer}>
              {['Sports', 'Pokemon', 'Magic', 'Yu-Gi-Oh', 'Comics', 'Memorabilia'].map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.tagButton,
                    categories.includes(category) && styles.tagButtonSelected
                  ]}
                  onPress={() => toggleCategory(category)}
                >
                  <Text 
                    style={[
                      styles.tagText,
                      categories.includes(category) && styles.tagTextSelected
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Features */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Features (Optional)</Text>
            <View style={styles.tagsContainer}>
              {['Grading', 'Autographs', 'Raffles', 'Tournaments', 'Food'].map(feature => (
                <TouchableOpacity
                  key={feature}
                  style={[
                    styles.tagButton,
                    features.includes(feature) && styles.tagButtonSelected
                  ]}
                  onPress={() => toggleFeature(feature)}
                >
                  <Text 
                    style={[
                      styles.tagText,
                      features.includes(feature) && styles.tagTextSelected
                    ]}
                  >
                    {feature}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={styles.submitIcon} />
                <Text style={styles.submitText}>Create Show</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 16,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    height: 120,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  dateIcon: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#333333',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
  },
  tagButtonSelected: {
    backgroundColor: '#0057B8',
  },
  tagText: {
    fontSize: 14,
    color: '#666666',
  },
  tagTextSelected: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#FF6A00',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitIcon: {
    marginRight: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddShowScreen;
