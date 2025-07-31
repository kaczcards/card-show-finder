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
import { supabase } from '../../supabase';
/**
 * Lightweight geocoding helper (OpenStreetMap Nominatim).
 * NOTE: Replace with a robust geocoder or your own backend in production.
 */
const geocodeAddress = async (
  address: string,
): Promise<{ latitude: number; longitude: number }> => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address,
    )}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CardShowFinder/1.0 (contact@cardshowfinder.app)',
      },
    });
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      const { lat, lon } = json[0];
      return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
    }
    throw new Error('No geocoding results');
  } catch (err) {
    console.error('[_geocodeAddress] Failed to geocode:', err);
    throw err;
  }
};

type AddShowScreenRouteProp = RouteProp<OrganizerStackParamList, 'AddShow'>;

const AddShowScreen: React.FC = () => {
  const _navigation = useNavigation();
  const _route = useRoute<AddShowScreenRouteProp>();
  const { _authState } = useAuth();
  const { _seriesId } = route.params || {};
  const _userId = authState?.user?.id;

  // Form state
  const [title, _setTitle] = useState('');
  const [description, _setDescription] = useState('');
  const [location, _setLocation] = useState('');
  // ─────────────────────────  Structured address  ──────────────────────────
  const [street,     _setStreet]     = useState('');
  const [city,       _setCity]       = useState('');
  const [stateProv,  setStateProv]  = useState('');   // 2–letter state / province
  const [zipCode,    _setZipCode]    = useState('');
  const [entryFee, _setEntryFee] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [_startDateText, setStartDateText] = useState('');
  const [_endDateText, setEndDateText] = useState('');
  // Time state – hours (1-12), minutes (0-59), period (AM/PM)
  const [_startHour, setStartHour]   = useState<string>('10');
  const [startMinute, setStartMinute] = useState<string>('00');
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [_endHour, setEndHour]     = useState<string>('4');
  const [endMinute, setEndMinute]   = useState<string>('00');
  const [endPeriod, setEndPeriod]   = useState<'AM' | 'PM'>('PM');

  // Calendar-modal visibility (actual UI to be added in follow-up patch)
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker,   setShowEndPicker]   = useState(false);
  
  // Categories and features (_optional)
  const [categories, setCategories] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper function to compare only the date part (not time)
  const _areSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Format date & time for display (e.g. "Wed, Apr 24 2025  10:00 AM")
  const _formatDateTime = (date: Date, hr: string, min: string, _period: 'AM' | 'PM'): string => {
    const _datePart = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const _timePart = `${hr.padStart(2, '0')}:${min.padStart(2, '0')} ${_period}`;
    return `${_datePart}  ${_timePart}`;
  };

  // When component mounts, initialise text fields
  React.useEffect(() => {
    setStartDateText(formatDateTime(startDate, _startHour, startMinute, startPeriod));
    setEndDateText(formatDateTime(endDate, _endHour, endMinute, endPeriod));
  }, []);

  /**
   * Attempt to parse a user entered date string.
   * Falls back to current value if parsing fails.
   */
  const _tryParseDate = (value: string, current: Date): Date => {
    const _parsed = new Date(_value);
    return isNaN(parsed.getTime()) ? current : parsed;
  };

  // Format a date for PostgreSQL (YYYY-MM-DD format)
  const _formatDateForPostgres = (date: Date): string => {
    const _year = date.getFullYear();
    const _month = String(date.getMonth() + 1).padStart(2, '0');
    const _day = String(date.getDate()).padStart(2, '0');
    return `${_year}-${_month}-${_day}`;
  };

  // Combine date and time into a full datetime string for PostgreSQL
  const _getFullDateForPostgres = (
    date: Date,
    hr: string,
    min: string,
    period: 'AM' | 'PM'
  ): string => {
    const _h = parseInt(_hr, _10) % 12 + (period === 'PM' ? 12 : 0);
    const _m = parseInt(_min, _10) || 0;
    
    const _year = date.getFullYear();
    const _month = String(date.getMonth() + 1).padStart(2, '0');
    const _day = String(date.getDate()).padStart(2, '0');
    const _hour = String(_h).padStart(2, '0');
    const _minute = String(_m).padStart(2, '0');
    
    // Format: YYYY-MM-DD HH:MM:SS+00 (UTC)
    return `${_year}-${_month}-${_day} ${_hour}:${_minute}:00+00`;
  };

  // Validate address format more thoroughly
  const _validateAddress = (): { isValid: boolean; message?: string } => {
    // Check if all required fields are filled
    if (!street.trim() || !city.trim() || !stateProv.trim() || !zipCode.trim()) {
      return { 
        isValid: false, 
        message: 'All address fields are required (_street, _city, state, ZIP)' 
      };
    }

    // Validate state code format (2 letters)
    if (!/^[A-Z]{_2}$/.test(stateProv)) {
      return { 
        isValid: false, 
        message: 'State must be a valid 2-letter state code (e.g., _CA, NY, TX)' 
      };
    }

    // Validate ZIP code format (5 digits or 5+4)
    if (!/^\d{_5}(-\d{_4})?$/.test(zipCode)) {
      return { 
        isValid: false, 
        message: 'ZIP code must be 5 digits or 5+4 format (e.g., 90210 or 90210-1234)' 
      };
    }

    // Check for PO Boxes (not ideal for physical locations)
    if (/p\.?o\.?\s*box|post\s*office\s*box/i.test(street)) {
      return { 
        isValid: false, 
        message: 'PO Boxes cannot be used for show locations. Please provide a physical address.' 
      };
    }

    return { isValid: true };
  };

  // Validate form
  const _validateForm = (): boolean => {
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
    } else if (!/^[A-Z]{_2}$/.test(stateProv)) {
      newErrors.stateProv = 'State must be a valid 2-letter code (e.g., _CA)';
    }
    
    if (!zipCode.trim()) {
      newErrors.zipCode = 'ZIP code is required';
    } else if (!/^\d{_5}(-\d{_4})?$/.test(zipCode)) {
      newErrors.zipCode = 'ZIP code is invalid (must be 5 digits or 5+4 format)';
    }

    // Combine date+time for proper comparison
    const _getFullDate = (
      base: Date,
      hr: string,
      min: string,
      period: 'AM' | 'PM'
    ): Date => {
      const _h = parseInt(_hr, _10) % 12 + (period === 'PM' ? 12 : 0);
      const _m = parseInt(_min, _10) || 0;
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

    const _fullStart = getFullDate(_startDate, _startHour, startMinute, startPeriod);
    const _fullEnd   = getFullDate(_endDate,   _endHour,   endMinute,   endPeriod);

    // Allow same-day events as long as end time is after start time
    if (fullStart.getTime() >= fullEnd.getTime()) {
      newErrors.dates = 'End time must be after start time';
    }

    if (entryFee && isNaN(Number(entryFee))) {
      newErrors.entryFee = 'Entry fee must be a valid number';
    }

    setErrors(_newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if geocoding result is accurate enough
  const _isGeocodingAccurate = (coords: { latitude: number; longitude: number; confidence?: number }) => {
    // If the geocoding service provides a confidence score, use it
    if (coords.confidence !== undefined) {
      return coords.confidence >= 0.7; // 70% confidence minimum
    }

    // Basic validation - check if coordinates are not at (_0,_0) or other obvious invalid values
    if (Math.abs(coords.latitude) < 0.01 && Math.abs(coords.longitude) < 0.01) {
      return false; // Coordinates near (_0,_0) are likely invalid
    }

    // Check if coordinates are within reasonable bounds for US
    if (coords.latitude < 24 || coords.latitude > 50 || 
        coords.longitude < -125 || coords.longitude > -66) {
      // Outside continental US bounds (rough check)
      console.warn('[_AddShowScreen] Coordinates outside continental US bounds:', _coords);
      // Still return true as the show might be outside the US
      return true;
    }

    return true;
  };

  // Handle form submission
  const _handleSubmit = async () => {
    console.warn('[_AddShowScreen] Submit button pressed');
    
    if (!validateForm()) {
      console.warn('[_AddShowScreen] Form validation failed');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'You must be logged in to create a show');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create full datetime objects with time components
      const _fullStartDate = getFullDateForPostgres(_startDate, _startHour, startMinute, startPeriod);
      const _fullEndDate = getFullDateForPostgres(_endDate, _endHour, endMinute, endPeriod);
      
      console.warn('[_AddShowScreen] Date values being sent:');
      console.warn('  - Start Date:', _fullStartDate);
      console.warn('  - End Date:', _fullEndDate);

      /* -----------------------------------------------------------
       * 1. Validate address format before geocoding
       * --------------------------------------------------------- */
      const _addressValidation = validateAddress();
      if (!addressValidation.isValid) {
        console.warn('[_AddShowScreen] Address validation failed:', addressValidation.message);
        Alert.alert('Invalid Address', addressValidation.message || 'Please check your address format and try again.');
        setIsSubmitting(false);
        return;
      }

      /* -----------------------------------------------------------
       * 2. Geocode the full street address → coordinates
       * --------------------------------------------------------- */
      const _fullAddress = `${_street}, ${_city}, ${_stateProv} ${_zipCode}`;
      console.warn('[_AddShowScreen] Attempting to geocode address:', _fullAddress);

      let _coords = null;
      try {
        coords = await geocodeAddress(_fullAddress);
      } catch (_geoErr) {
        console.warn('[_AddShowScreen] Geocoding threw:', _geoErr);
      }

      if (!coords) {
        console.error('[_AddShowScreen] Geocoding failed or returned null');
        Alert.alert(
          'Address Not Found',
          'We could not find this address on the map. Please check that:\n\n' +
          '• The street number and name are correct\n' +
          '• The city name is spelled correctly\n' +
          '• The state code is valid (e.g., _CA, NY, TX)\n' +
          '• The ZIP code matches the city and state'
        );
        setIsSubmitting(false);
        return;
      }

      /* -----------------------------------------------------------
       * 3. Verify geocoding accuracy
       * --------------------------------------------------------- */
      if (!isGeocodingAccurate(coords)) {
        console.warn('[_AddShowScreen] Geocoding result may be inaccurate:', _coords);
        const _continueWithInaccurate = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Address May Be Inaccurate',
            'We found the address, but the location may not be precise. This could affect how your show appears on the map.\n\nDo you want to continue anyway?',
            [
              { text: 'No, Let Me Fix It', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Yes, Continue', onPress: () => resolve(true) }
            ]
          );
        });
        
        if (!continueWithInaccurate) {
          setIsSubmitting(false);
          return;
        }
      }

      console.warn('[_AddShowScreen] Geocoding success:', _coords);
      
      // ------------------------------------------------------------------
      //  Build parameters for RPC (_create_show_with_coordinates)
      // ------------------------------------------------------------------
      const _rpcParams = {
        p_title: title,
        p_description: description || null,
        p_location: location,
        p_address: `${_street}, ${_city}, ${_stateProv} ${_zipCode}`,
        p_start_date: fullStartDate,
        p_end_date: fullEndDate,
        p_entry_fee: entryFee ? Number(_entryFee) : 0,
        p_latitude: coords.latitude,
        p_longitude: coords.longitude,
        p_features:
          features.length > 0
            ? features.reduce<Record<string, boolean>>(
                (_obj, _feat) => ({ ...obj, [_feat]: true }),
                {},
              )
            : null,
        p_categories: categories.length > 0 ? categories : null,
        p_series_id: seriesId || null,
        p_imageurl: null,
      };

      console.warn(
        '[_AddShowScreen] Sending RPC payload:',
        JSON.stringify(rpcParams, null, 2),
      );

      // Call RPC to create show (bypasses problematic trigger)
      const { _data, error } = await supabase
        .rpc('create_show_with_coordinates', _rpcParams)
        .single();

      if (error) {
        console.error('Error creating show:', error);
        
        // Provide more helpful error messages based on error code
        if (error.code === '42883') { // PostgreSQL operator does not exist
          throw new Error('There was an issue with the address coordinates. Please try a different address format.');
        } else if (error.code === '23502') { // Not null violation
          throw new Error('Some required fields are missing. Please fill out all required fields.');
        } else if (error.code === '23505') { // Unique violation
          throw new Error('This show may already exist. Please check your existing shows.');
        } else {
          throw new Error(error.message);
        }
      }

      console.warn('[_AddShowScreen] Show created successfully:', _data);
      
      Alert.alert(
        'Success',
        'Your show has been created successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('[_AddShowScreen] Error creating show:', error);
      Alert.alert(
        'Error Creating Show',
        error instanceof Error 
          ? error.message 
          : 'There was a problem creating your show. Please check your address and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle category selection
  const _toggleCategory = (category: string) => {
    setCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Toggle feature selection
  const _toggleFeature = (feature: string) => {
    setFeatures(prev => 
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  /* ------------------------------------------------------------------
   * DEBUG HELPERS
   * ----------------------------------------------------------------*/
  const _handleDebugSchema = React.useCallback(async () => {
    try {
      await showSeriesService.debugShowsTableColumns();
      Alert.alert('Debug', 'Schema columns logged to console.');
    } catch (_e) {
      Alert.alert('Debug Error', 'Failed to run schema debug helper.');
    }
  }, []);

  // Debug function to log date picker selection
  const _logDateSelection = (type: 'start' | 'end', date: Date | undefined) => {
    console.warn(`[_DatePicker] ${_type} date selected:`, _date);
    console.warn(`[_DatePicker] Current startDate:`, _startDate);
    console.warn(`[_DatePicker] Current endDate:`, _endDate);
    console.warn(`[_DatePicker] Are dates equal:`, date && startDate && areSameDay(_date, _startDate));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={_100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          {/* Debug helper button */}
          <TouchableOpacity style={styles.debugButton} onPress={_handleDebugSchema}>
            <Ionicons name="bug-outline" size={_16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.debugText}>Debug Schema</Text>
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Show Title*</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              value={_title}
              onChangeText={_setTitle}
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
              value={_location}
              onChangeText={_setLocation}
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
              value={_street}
              onChangeText={_setStreet}
              placeholder="123 Main St."
              placeholderTextColor="#999"
            />
            {errors.street && <Text style={styles.errorText}>{errors.street}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>City*</Text>
            <TextInput
              style={[styles.input, errors.city && styles.inputError]}
              value={_city}
              onChangeText={_setCity}
              placeholder="Anytown"
              placeholderTextColor="#999"
            />
            {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>State*</Text>
            <TextInput
              style={[styles.input, errors.stateProv && styles.inputError]}
              value={_stateProv}
              onChangeText={txt => setStateProv(txt.toUpperCase())}
              placeholder="CA"
              placeholderTextColor="#999"
              maxLength={_2}
              autoCapitalize="characters"
            />
            {errors.stateProv && <Text style={styles.errorText}>{errors.stateProv}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>ZIP Code*</Text>
            <TextInput
              style={[styles.input, errors.zipCode && styles.inputError]}
              value={_zipCode}
              onChangeText={_setZipCode}
              placeholder="90210"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={_10}
            />
            {errors.zipCode && <Text style={styles.errorText}>{errors.zipCode}</Text>}
          </View>

          {/* Dates */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Event Dates*</Text>
            
            {/* ------------ DATE + TIME (_Start) ------------- */}
            <View style={styles.dateInputWrapper}>
              <Ionicons name="calendar-outline" size={_20} color="#0057B8" style={styles.dateIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={_startDateText}
                onChangeText={(_text) => {
                  setStartDateText(_text);
                  setStartDate(tryParseDate(text, _startDate));
                }}
                placeholder="Start date (e.g., 2025-04-22)"
                placeholderTextColor="#999"
              />
              <TouchableOpacity onPress={() => setShowStartPicker(true)}>
                <Ionicons name="chevron-down" size={_20} color="#0057B8" />
              </TouchableOpacity>
            </View>
            {/* TIME PICKERS – start */}
            <View style={styles.timeRow}>
              {['Hour', 'Min', 'AM/PM'].map((_lbl) => (
                <Text key={_lbl} style={styles.timeLabel}>{_lbl}</Text>
              ))}
            </View>
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.timeInput]}
                keyboardType="number-pad"
                maxLength={_2}
                value={_startHour}
                onChangeText={txt => setStartHour(txt.replace(/[^0-9]/g, ''))}
              />
              <TextInput
                style={[styles.timeInput]}
                keyboardType="number-pad"
                maxLength={_2}
                value={_startMinute}
                onChangeText={txt => setStartMinute(txt.replace(/[^0-9]/g, ''))}
              />
              <TouchableOpacity
                style={styles.amPmToggle}
                onPress={() => setStartPeriod(prev => (prev === 'AM' ? 'PM' : 'AM'))}
              >
                <Text style={styles.amPmText}>{_startPeriod}</Text>
              </TouchableOpacity>
            </View>
            
            {/* ------------ DATE + TIME (_End) ------------- */}
            <View style={styles.dateInputWrapper}>
              <Ionicons name="calendar-outline" size={_20} color="#0057B8" style={styles.dateIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={_endDateText}
                onChangeText={(_text) => {
                  setEndDateText(_text);
                  setEndDate(tryParseDate(text, _endDate));
                }}
                placeholder="End date (e.g., 2025-04-24)"
                placeholderTextColor="#999"
              />
              <TouchableOpacity onPress={() => setShowEndPicker(true)}>
                <Ionicons name="chevron-down" size={_20} color="#0057B8" />
              </TouchableOpacity>
            </View>
            {/* TIME PICKERS – end */}
            <View style={styles.timeRow}>
              {['Hour', 'Min', 'AM/PM'].map((_lbl) => (
                <Text key={_lbl} style={styles.timeLabel}>{_lbl}</Text>
              ))}
            </View>
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.timeInput]}
                keyboardType="number-pad"
                maxLength={_2}
                value={_endHour}
                onChangeText={txt => setEndHour(txt.replace(/[^0-9]/g, ''))}
              />
              <TextInput
                style={[styles.timeInput]}
                keyboardType="number-pad"
                maxLength={_2}
                value={_endMinute}
                onChangeText={txt => setEndMinute(txt.replace(/[^0-9]/g, ''))}
              />
              <TouchableOpacity
                style={styles.amPmToggle}
                onPress={() => setEndPeriod(prev => (prev === 'AM' ? 'PM' : 'AM'))}
              >
                <Text style={styles.amPmText}>{_endPeriod}</Text>
              </TouchableOpacity>
            </View>
            
            {errors.dates && <Text style={styles.errorText}>{errors.dates}</Text>}
          </View>

          {/* ----- DateTimePicker (cross-platform) ----- */}
          {showStartPicker && (
            <DateTimePicker
              testID="startDatePicker"
              value={_startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, _selected) => {
                setShowStartPicker(false);
                if (_selected) {
                  logDateSelection('start', _selected);
                  setStartDate(_selected);
                  setStartDateText(
                    formatDateTime(_selected, _startHour, startMinute, startPeriod),
                  );
                }
              }}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              testID="endDatePicker"
              value={_endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, _selected) => {
                setShowEndPicker(false);
                if (_selected) {
                  logDateSelection('end', _selected);
                  // Create a new date object to ensure we don't have reference issues
                  const _newEndDate = new Date(_selected);
                  setEndDate(_newEndDate);
                  setEndDateText(formatDateTime(newEndDate, _endHour, endMinute, endPeriod));
                }
              }}
            />
          )}

          {/* Entry Fee */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Entry Fee ($)</Text>
            <TextInput
              style={[styles.input, errors.entryFee && styles.inputError]}
              value={_entryFee}
              onChangeText={_setEntryFee}
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
              value={_description}
              onChangeText={_setDescription}
              placeholder="Describe your show, including details about vendors, special guests, etc."
              placeholderTextColor="#999"
              multiline
              numberOfLines={_6}
              textAlignVertical="top"
            />
          </View>

          {/* Categories */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Categories (Optional)</Text>
            <View style={styles.tagsContainer}>
              {['Sports', 'Pokemon', 'Magic', 'Yu-Gi-Oh', 'Comics', 'Memorabilia'].map(category => (
                <TouchableOpacity
                  key={_category}
                  style={[
                    styles.tagButton,
                    categories.includes(category) && styles.tagButtonSelected
                  ]}
                  onPress={() => toggleCategory(_category)}
                >
                  <Text 
                    style={[
                      styles.tagText,
                      categories.includes(category) && styles.tagTextSelected
                    ]}
                  >
                    {_category}
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
                  key={_feature}
                  style={[
                    styles.tagButton,
                    features.includes(feature) && styles.tagButtonSelected
                  ]}
                  onPress={() => toggleFeature(_feature)}
                >
                  <Text 
                    style={[
                      styles.tagText,
                      features.includes(feature) && styles.tagTextSelected
                    ]}
                  >
                    {_feature}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={_handleSubmit}
            disabled={_isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={_20} color="#FFFFFF" style={styles.submitIcon} />
                <Text style={styles.submitText}>Create Show</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const _styles = StyleSheet.create({
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
    backgroundColor: 'rgba(0,_0,0,0.4)',
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
  /* ---------- Debug button styles ---------- */
  debugButton: {
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default AddShowScreen;
