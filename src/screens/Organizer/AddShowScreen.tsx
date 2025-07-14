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
import { showSeriesService } from '../../services/showSeriesService';
import { OrganizerStackParamList } from '../../navigation/OrganizerNavigator';
import { useAuth } from '../../contexts/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  // ─────────────────────────  Structured address  ──────────────────────────
  const [street,     setStreet]     = useState('');
  const [city,       setCity]       = useState('');
  const [stateProv,  setStateProv]  = useState('');   // 2–letter state / province
  const [zipCode,    setZipCode]    = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startDateText, setStartDateText] = useState('');
  const [endDateText, setEndDateText] = useState('');
  // Time state – hours (1-12), minutes (0-59), period (AM/PM)
  const [startHour, setStartHour]   = useState<string>('10');
  const [startMinute, setStartMinute] = useState<string>('00');
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [endHour, setEndHour]     = useState<string>('4');
  const [endMinute, setEndMinute]   = useState<string>('00');
  const [endPeriod, setEndPeriod]   = useState<'AM' | 'PM'>('PM');

  // Calendar-modal visibility (actual UI to be added in follow-up patch)
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker,   setShowEndPicker]   = useState(false);
  
  // Categories and features (optional)
  const [categories, setCategories] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Format date & time for display (e.g. "Wed, Apr 24 2025  10:00 AM")
  const formatDateTime = (date: Date, hr: string, min: string, period: 'AM' | 'PM'): string => {
    const datePart = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = `${hr.padStart(2, '0')}:${min.padStart(2, '0')} ${period}`;
    return `${datePart}  ${timePart}`;
  };

  // When component mounts, initialise text fields
  React.useEffect(() => {
    setStartDateText(formatDateTime(startDate, startHour, startMinute, startPeriod));
    setEndDateText(formatDateTime(endDate, endHour, endMinute, endPeriod));
  }, []);

  /**
   * Attempt to parse a user entered date string.
   * Falls back to current value if parsing fails.
   */
  const tryParseDate = (value: string, current: Date): Date => {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? current : parsed;
  };

  // Format a date for PostgreSQL (YYYY-MM-DD format)
  const formatDateForPostgres = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Combine date and time into a full datetime string for PostgreSQL
  const getFullDateForPostgres = (
    date: Date,
    hr: string,
    min: string,
    period: 'AM' | 'PM'
  ): string => {
    const h = parseInt(hr, 10) % 12 + (period === 'PM' ? 12 : 0);
    const m = parseInt(min, 10) || 0;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(h).padStart(2, '0');
    const minute = String(m).padStart(2, '0');
    
    // Format: YYYY-MM-DD HH:MM:SS+00 (UTC)
    return `${year}-${month}-${day} ${hour}:${minute}:00+00`;
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

    if (!street.trim()) {
      newErrors.street = 'Street address is required';
    }
    if (!city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!stateProv.trim()) {
      newErrors.stateProv = 'State is required';
    }
    if (!zipCode.trim()) {
      newErrors.zipCode = 'ZIP code is required';
    } else if (!/^[0-9]{5}(-[0-9]{4})?$/.test(zipCode)) {
      newErrors.zipCode = 'ZIP code is invalid';
    }

    // Combine date+time for proper comparison
    const getFullDate = (
      base: Date,
      hr: string,
      min: string,
      period: 'AM' | 'PM'
    ): Date => {
      const h = parseInt(hr, 10) % 12 + (period === 'PM' ? 12 : 0);
      const m = parseInt(min, 10) || 0;
      return new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        h,
        m,
        0,
        0
      );
    };

    const fullStart = getFullDate(startDate, startHour, startMinute, startPeriod);
    const fullEnd   = getFullDate(endDate,   endHour,   endMinute,   endPeriod);

    // Allow same-day events as long as end time is after start time
    if (fullStart.getTime() >= fullEnd.getTime()) {
      newErrors.dates = 'End time must be after start time';
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
      // Create full datetime objects with time components
      const fullStartDate = getFullDateForPostgres(startDate, startHour, startMinute, startPeriod);
      const fullEndDate = getFullDateForPostgres(endDate, endHour, endMinute, endPeriod);
      
      console.log('[AddShowScreen] Date values being sent:');
      console.log('  - Start Date:', fullStartDate);
      console.log('  - End Date:', fullEndDate);
      
      /**
       * IMPORTANT:
       * showSeriesService.createStandaloneShow(...) expects camel-case keys that
       * match the `Show` interface.  It then converts to the snake_case column
       * names internally.  Passing snake_case keys from this screen caused
       * `start_date` / `end_date` to be overwritten with **undefined**, which
       * the DB rejected with the NOT-NULL constraint error you are seeing.
       *
       * Therefore we build the payload using *camelCase* keys only .
       */
      const showData = {
        title,
        description,
        location,
        address: `${street}, ${city}, ${stateProv} ${zipCode}`,
        organizerId: userId,
        status: 'ACTIVE',
        entryFee: entryFee ? Number(entryFee) : 0,
        // camelCase date props – the service will map them to start_date/end_date
        startDate: fullStartDate,
        endDate: fullEndDate,
        // Optional JSON/array columns
        features: features.length > 0
          ? features.reduce<Record<string, boolean>>((obj, feat) => ({ ...obj, [feat]: true }), {})
          : null,
        categories: categories.length > 0 ? categories : null,
        // For standalone shows pass null so the service adds series_id: null
        seriesId: seriesId || null,
      };
      
      console.log('[AddShowScreen] Sending payload to server:', JSON.stringify(showData, null, 2));

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
            <Text style={styles.label}>Street Address*</Text>
            <TextInput
              style={[styles.input, errors.street && styles.inputError]}
              value={street}
              onChangeText={setStreet}
              placeholder="123 Main St."
              placeholderTextColor="#999"
            />
            {errors.street && <Text style={styles.errorText}>{errors.street}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>City*</Text>
            <TextInput
              style={[styles.input, errors.city && styles.inputError]}
              value={city}
              onChangeText={setCity}
              placeholder="Anytown"
              placeholderTextColor="#999"
            />
            {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>State*</Text>
            <TextInput
              style={[styles.input, errors.stateProv && styles.inputError]}
              value={stateProv}
              onChangeText={txt => setStateProv(txt.toUpperCase())}
              placeholder="CA"
              placeholderTextColor="#999"
              maxLength={2}
              autoCapitalize="characters"
            />
            {errors.stateProv && <Text style={styles.errorText}>{errors.stateProv}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>ZIP Code*</Text>
            <TextInput
              style={[styles.input, errors.zipCode && styles.inputError]}
              value={zipCode}
              onChangeText={setZipCode}
              placeholder="90210"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={10}
            />
            {errors.zipCode && <Text style={styles.errorText}>{errors.zipCode}</Text>}
          </View>

          {/* Dates */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Event Dates*</Text>
            
            {/* ------------ DATE + TIME (Start) ------------- */}
            <View style={styles.dateInputWrapper}>
              <Ionicons name="calendar-outline" size={20} color="#0057B8" style={styles.dateIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={startDateText}
                onChangeText={(text) => {
                  setStartDateText(text);
                  setStartDate(tryParseDate(text, startDate));
                }}
                placeholder="Start date (e.g., 2025-04-22)"
                placeholderTextColor="#999"
              />
              <TouchableOpacity onPress={() => setShowStartPicker(true)}>
                <Ionicons name="chevron-down" size={20} color="#0057B8" />
              </TouchableOpacity>
            </View>
            {/* TIME PICKERS – start */}
            <View style={styles.timeRow}>
              {['Hour', 'Min', 'AM/PM'].map((lbl) => (
                <Text key={lbl} style={styles.timeLabel}>{lbl}</Text>
              ))}
            </View>
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.timeInput]}
                keyboardType="number-pad"
                maxLength={2}
                value={startHour}
                onChangeText={txt => setStartHour(txt.replace(/[^0-9]/g, ''))}
              />
              <TextInput
                style={[styles.timeInput]}
                keyboardType="number-pad"
                maxLength={2}
                value={startMinute}
                onChangeText={txt => setStartMinute(txt.replace(/[^0-9]/g, ''))}
              />
              <TouchableOpacity
                style={styles.amPmToggle}
                onPress={() => setStartPeriod(prev => (prev === 'AM' ? 'PM' : 'AM'))}
              >
                <Text style={styles.amPmText}>{startPeriod}</Text>
              </TouchableOpacity>
            </View>
            
            {/* ------------ DATE + TIME (End) ------------- */}
            <View style={styles.dateInputWrapper}>
              <Ionicons name="calendar-outline" size={20} color="#0057B8" style={styles.dateIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={endDateText}
                onChangeText={(text) => {
                  setEndDateText(text);
                  setEndDate(tryParseDate(text, endDate));
                }}
                placeholder="End date (e.g., 2025-04-24)"
                placeholderTextColor="#999"
              />
              <TouchableOpacity onPress={() => setShowEndPicker(true)}>
                <Ionicons name="chevron-down" size={20} color="#0057B8" />
              </TouchableOpacity>
            </View>
            {/* TIME PICKERS – end */}
            <View style={styles.timeRow}>
              {['Hour', 'Min', 'AM/PM'].map((lbl) => (
                <Text key={lbl} style={styles.timeLabel}>{lbl}</Text>
              ))}
            </View>
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.timeInput]}
                keyboardType="number-pad"
                maxLength={2}
                value={endHour}
                onChangeText={txt => setEndHour(txt.replace(/[^0-9]/g, ''))}
              />
              <TextInput
                style={[styles.timeInput]}
                keyboardType="number-pad"
                maxLength={2}
                value={endMinute}
                onChangeText={txt => setEndMinute(txt.replace(/[^0-9]/g, ''))}
              />
              <TouchableOpacity
                style={styles.amPmToggle}
                onPress={() => setEndPeriod(prev => (prev === 'AM' ? 'PM' : 'AM'))}
              >
                <Text style={styles.amPmText}>{endPeriod}</Text>
              </TouchableOpacity>
            </View>
            
            {errors.dates && <Text style={styles.errorText}>{errors.dates}</Text>}
          </View>

          {/* ----- DateTimePicker (cross-platform) ----- */}
          {showStartPicker && (
            <DateTimePicker
              testID="startDatePicker"
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, selected) => {
                setShowStartPicker(false);
                if (selected) {
                  setStartDate(selected);
                  setStartDateText(
                    formatDateTime(selected, startHour, startMinute, startPeriod),
                  );
                }
              }}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              testID="endDatePicker"
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, selected) => {
                setShowEndPicker(false);
                if (selected) {
                  setEndDate(selected);
                  setEndDateText(formatDateTime(selected, endHour, endMinute, endPeriod));
                }
              }}
            />
          )}

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
  /**
   * Wrapper used for the icon + TextInput date fields
   * Very similar to `dateButton` but purpose-built for editable inputs.
   */
  dateInputWrapper: {
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
  /* ---------- Time row styles ---------- */
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeLabel: {
    flex: 1,
    fontSize: 12,
    color: '#666666',
  },
  timeInput: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: 6,
    textAlign: 'center',
    color: '#333333',
  },
  amPmToggle: {
    flex: 1,
    backgroundColor: '#0057B8',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  amPmText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  /* ---------- Modal backdrop (calendar placeholder) ---------- */
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
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
