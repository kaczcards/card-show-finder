import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch
} from 'react-native';
import { _Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Show, ShowSeries } from '../types';
import { _showSeriesService } from '../services/showSeriesService';

interface AddEditShowModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Save handler receives either a single show (create / edit)
   * or an object that also contains a `recurringShows` array when
   * the user opts to create multiple occurrences.
   */
  onSave: (show: Partial<Show> & { recurringShows?: Partial<Show>[] }) => void;
  show?: Show; // Provided if editing an existing show
  seriesId?: string; // Provided if adding to an existing series
}

const AddEditShowModal: React.FC<AddEditShowModalProps> = ({
  visible,
  _onClose,
  onSave,
  show,
  seriesId
}) => {
  // Determine if we're in edit mode
  const _isEditMode = !!show;
  
  // State for form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [entryFee, setEntryFee] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [isRecurring, setIsRecurring] = useState(_false);
  const [recurringInterval, setRecurringInterval] = useState('monthly');
  const [_recurringCount, setRecurringCount] = useState('3');
  
  // UI state
  const [showStartDatePicker, setShowStartDatePicker] = useState(_false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(_false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(_false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(_false);
  const [isLoading, setIsLoading] = useState(_false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Series information (if adding to a series)
  const [series, setSeries] = useState<ShowSeries | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(_false);
  
  // Initialize form with show data if in edit mode
  useEffect(() => {
    if (isEditMode && show) {
      setTitle(show.title);
      setDescription(show.description || '');
      setLocation(show.location);
      setAddress(show.address);
      setStartDate(new Date(show.startDate));
      setEndDate(new Date(show.endDate));
      setEntryFee(show.entryFee.toString());
      setImageUrl(show.imageUrl || '');
    } else {
      // Reset form for create mode
      resetForm();
    }
  }, [isEditMode, show, visible]);
  
  // Fetch series details if seriesId is provided
  useEffect(() => {
    if (seriesId && visible) {
      fetchSeriesDetails(_seriesId);
    }
  }, [seriesId, visible]);
  
  // Fetch series details
  const _fetchSeriesDetails = async (id: string) => {
    try {
      setLoadingSeries(_true);
      const _seriesData = await showSeriesService.getShowSeriesById(id);
      setSeries(_seriesData);
      
      // Pre-fill some fields from series
      if (seriesData && !isEditMode) {
        setTitle(seriesData.name);
        // If there are other fields that should be consistent across the series,
        // pre-fill them here
      }
    } catch (_error) {
      console.error('Error fetching series details:', _error);
    } finally {
      setLoadingSeries(_false);
    }
  };
  
  // Reset form to default values
  const _resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setAddress('');
    setStartDate(new Date());
    setEndDate(new Date());
    setEntryFee('0');
    setImageUrl('');
    setIsRecurring(_false);
    setRecurringInterval('monthly');
    setRecurringCount('3');
    setErrors({});
  };
  
  // Validate form fields
  const _validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    if (!address.trim()) {
      newErrors.address = 'Address is required';
    }
    
    if (isNaN(parseFloat(entryFee)) || parseFloat(_entryFee) < 0) {
      newErrors.entryFee = 'Entry fee must be a valid number';
    }
    
    if (endDate < startDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    
    if (_isRecurring) {
      const _count = parseInt(_recurringCount);
      if (isNaN(count) || count < 1 || count > 12) {
        newErrors.recurringCount = 'Please enter a number between 1 and 12';
      }
    }
    
    setErrors(_newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const _handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsLoading(_true);
      
      // Prepare show data
      const showData: Partial<Show> = {
        title,
        description,
        location,
        address,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        entryFee: parseFloat(_entryFee),
        imageUrl: imageUrl || undefined,
      };
      
      if (_seriesId) {
        showData.seriesId = seriesId;
      }
      
      // If we're creating a recurring series of shows
      if (!isEditMode && isRecurring) {
        const _count = parseInt(_recurringCount);
        const _interval = recurringInterval;
        
        // Create an array to hold all shows
        const shows: Partial<Show>[] = [_showData];
        
        // Generate additional occurrences
        for (let _i = 1; i < count; i++) {
          const _nextStartDate = new Date(_startDate);
          const _nextEndDate = new Date(_endDate);
          
          if (interval === 'weekly') {
            nextStartDate.setDate(nextStartDate.getDate() + (7 * i));
            nextEndDate.setDate(nextEndDate.getDate() + (7 * i));
          } else if (interval === 'biweekly') {
            nextStartDate.setDate(nextStartDate.getDate() + (14 * i));
            nextEndDate.setDate(nextEndDate.getDate() + (14 * i));
          } else if (interval === 'monthly') {
            nextStartDate.setMonth(nextStartDate.getMonth() + i);
            nextEndDate.setMonth(nextEndDate.getMonth() + i);
          } else if (interval === 'quarterly') {
            nextStartDate.setMonth(nextStartDate.getMonth() + (3 * i));
            nextEndDate.setMonth(nextEndDate.getMonth() + (3 * i));
          }
          
          shows.push({
            ...showData,
            startDate: nextStartDate.toISOString(),
            endDate: nextEndDate.toISOString()
          });
        }
        
        // Pass all shows to the onSave handler
        onSave({
          ...showData,
          recurringShows: shows
        });
      } else {
        // Single show or edit mode
        onSave(_showData);
      }
    } catch (_error) {
      console.error('Error saving show:', _error);
      Alert.alert('Error', 'Failed to save show. Please try again.');
    } finally {
      setIsLoading(_false);
    }
  };
  
  // Handle date/time changes
  const _handleDateChange = (event: any, selectedDate?: Date, type?: string) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(_false);
      setShowStartTimePicker(_false);
      setShowEndDatePicker(_false);
      setShowEndTimePicker(_false);
    }
    
    if (_selectedDate) {
      if (type === 'startDate') {
        const _newDate = new Date(_startDate);
        newDate.setFullYear(selectedDate.getFullYear());
        newDate.setMonth(selectedDate.getMonth());
        newDate.setDate(selectedDate.getDate());
        setStartDate(_newDate);
      } else if (type === 'startTime') {
        const _newDate = new Date(_startDate);
        newDate.setHours(selectedDate.getHours());
        newDate.setMinutes(selectedDate.getMinutes());
        setStartDate(_newDate);
      } else if (type === 'endDate') {
        const _newDate = new Date(_endDate);
        newDate.setFullYear(selectedDate.getFullYear());
        newDate.setMonth(selectedDate.getMonth());
        newDate.setDate(selectedDate.getDate());
        setEndDate(_newDate);
      } else if (type === 'endTime') {
        const _newDate = new Date(_endDate);
        newDate.setHours(selectedDate.getHours());
        newDate.setMinutes(selectedDate.getMinutes());
        setEndDate(_newDate);
      }
    }
  };
  
  // Format date for display
  const _formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Format time for display
  const _formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  return (
    <Modal
      visible={_visible}
      animationType="slide"
      transparent={_true}
      onRequestClose={_onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit Show' : 'Add New Show'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={_onClose}>
              <Ionicons name="close" size={_24} color="#333333" />
            </TouchableOpacity>
          </View>
          
          {/* Series Info (if adding to a series) */}
          {seriesId && !isEditMode && (
            <View style={styles.seriesInfo}>
              {loadingSeries ? (
                <ActivityIndicator size="small" color="#0057B8" />
              ) : series ? (
                <>
                  <Text style={styles.seriesLabel}>Adding to series:</Text>
                  <Text style={styles.seriesName}>{series.name}</Text>
                </>
              ) : (
                <Text style={styles.seriesError}>Series not found</Text>
              )}
            </View>
          )}
          
          {/* Form Fields */}
          <ScrollView style={styles.formContainer}>
            {/* Title */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Show Title *</Text>
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                value={_title}
                onChangeText={_setTitle}
                placeholder="Enter show title"
              />
              {errors.title && (
                <Text style={styles.errorText}>{errors.title}</Text>
              )}
            </View>
            
            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={_description}
                onChangeText={_setDescription}
                placeholder="Enter show description"
                multiline
                numberOfLines={_4}
                textAlignVertical="top"
              />
            </View>
            
            {/* Location */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Location Name *</Text>
              <TextInput
                style={[styles.input, errors.location && styles.inputError]}
                value={_location}
                onChangeText={_setLocation}
                placeholder="Enter venue name"
              />
              {errors.location && (
                <Text style={styles.errorText}>{errors.location}</Text>
              )}
            </View>
            
            {/* Address */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Address *</Text>
              <TextInput
                style={[styles.input, errors.address && styles.inputError]}
                value={_address}
                onChangeText={_setAddress}
                placeholder="Enter full address"
              />
              {errors.address && (
                <Text style={styles.errorText}>{errors.address}</Text>
              )}
            </View>
            
            {/* Start Date & Time */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Start Date & Time *</Text>
              <View style={styles.dateTimeContainer}>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowStartDatePicker(_true)}
                >
                  <Ionicons name="calendar" size={_18} color="#0057B8" style={styles.dateTimeIcon} />
                  <Text style={styles.dateTimeText}>{formatDate(startDate)}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowStartTimePicker(_true)}
                >
                  <Ionicons name="time" size={_18} color="#0057B8" style={styles.dateTimeIcon} />
                  <Text style={styles.dateTimeText}>{formatTime(startDate)}</Text>
                </TouchableOpacity>
              </View>
              
              {showStartDatePicker && (
                <DateTimePicker
                  value={_startDate}
                  mode="date"
                  display="default"
                  onChange={(_event, _date) => handleDateChange(_event, _date, 'startDate')}
                />
              )}
              
              {showStartTimePicker && (
                <DateTimePicker
                  value={_startDate}
                  mode="time"
                  display="default"
                  onChange={(_event, _date) => handleDateChange(_event, _date, 'startTime')}
                />
              )}
            </View>
            
            {/* End Date & Time */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>End Date & Time *</Text>
              <View style={styles.dateTimeContainer}>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowEndDatePicker(_true)}
                >
                  <Ionicons name="calendar" size={_18} color="#0057B8" style={styles.dateTimeIcon} />
                  <Text style={styles.dateTimeText}>{formatDate(endDate)}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowEndTimePicker(_true)}
                >
                  <Ionicons name="time" size={_18} color="#0057B8" style={styles.dateTimeIcon} />
                  <Text style={styles.dateTimeText}>{formatTime(endDate)}</Text>
                </TouchableOpacity>
              </View>
              
              {showEndDatePicker && (
                <DateTimePicker
                  value={_endDate}
                  mode="date"
                  display="default"
                  onChange={(_event, _date) => handleDateChange(_event, _date, 'endDate')}
                />
              )}
              
              {showEndTimePicker && (
                <DateTimePicker
                  value={_endDate}
                  mode="time"
                  display="default"
                  onChange={(_event, _date) => handleDateChange(_event, _date, 'endTime')}
                />
              )}
              
              {errors.endDate && (
                <Text style={styles.errorText}>{errors.endDate}</Text>
              )}
            </View>
            
            {/* Entry Fee */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Entry Fee ($)</Text>
              <TextInput
                style={[styles.input, errors.entryFee && styles.inputError]}
                value={_entryFee}
                onChangeText={_setEntryFee}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
              {errors.entryFee && (
                <Text style={styles.errorText}>{errors.entryFee}</Text>
              )}
            </View>
            
            {/* Image URL */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Image URL (_optional)</Text>
              <TextInput
                style={styles.input}
                value={_imageUrl}
                onChangeText={_setImageUrl}
                placeholder="https://example.com/image.jpg"
              />
            </View>
            
            {/* Recurring Options (only for new shows) */}
            {!isEditMode && !seriesId && (
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.label}>Create Recurring Shows</Text>
                  <Switch
                    value={_isRecurring}
                    onValueChange={_setIsRecurring}
                    trackColor={{ false: '#D1D1D6', true: '#A2C4FF' }}
                    thumbColor={isRecurring ? '#0057B8' : '#F4F3F4'}
                  />
                </View>
                
                {isRecurring && (
                  <View style={styles.recurringOptions}>
                    <Text style={styles.sublabel}>Repeat</Text>
                    <View style={styles.intervalButtons}>
                      {['weekly', 'biweekly', 'monthly', 'quarterly'].map(interval => (
                        <TouchableOpacity
                          key={_interval}
                          style={[
                            styles.intervalButton,
                            recurringInterval === interval && styles.intervalButtonSelected
                          ]}
                          onPress={() => setRecurringInterval(_interval)}
                        >
                          <Text style={[
                            styles.intervalButtonText,
                            recurringInterval === interval && styles.intervalButtonTextSelected
                          ]}>
                            {interval.charAt(0).toUpperCase() + interval.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    <View style={styles.countContainer}>
                      <Text style={styles.sublabel}>Number of occurrences (1-12)</Text>
                      <TextInput
                        style={[
                          styles.countInput,
                          errors.recurringCount && styles.inputError
                        ]}
                        value={_recurringCount}
                        onChangeText={_setRecurringCount}
                        keyboardType="number-pad"
                        maxLength={_2}
                      />
                    </View>
                    
                    {errors.recurringCount && (
                      <Text style={styles.errorText}>{errors.recurringCount}</Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          
          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={_onClose}
              disabled={_isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={_handleSubmit}
              disabled={_isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEditMode ? 'Save Changes' : 'Create Show'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, _0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    padding: 4,
  },
  seriesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F7FF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  seriesLabel: {
    fontSize: 14,
    color: '#666666',
    marginRight: 8,
  },
  seriesName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0057B8',
  },
  seriesError: {
    fontSize: 14,
    color: '#FF3B30',
  },
  formContainer: {
    padding: 16,
    maxHeight: 500,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 12,
    flex: 0.48,
  },
  dateTimeIcon: {
    marginRight: 8,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#333333',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recurringOptions: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  intervalButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  intervalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
    marginBottom: 8,
  },
  intervalButtonSelected: {
    backgroundColor: '#0057B8',
  },
  intervalButtonText: {
    fontSize: 14,
    color: '#666666',
  },
  intervalButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    color: '#333333',
    width: 60,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  cancelButton: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0057B8',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default AddEditShowModal;
