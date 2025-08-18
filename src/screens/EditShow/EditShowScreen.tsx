import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getShowById, updateShow } from '../../services/showService';

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
    console.error('[geocodeAddress] Failed to geocode:', err);
    throw err;
  }
};

type EditShowScreenRouteProp = RouteProp<{ EditShow: { showId: string } }, 'EditShow'>;

const EditShowScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<EditShowScreenRouteProp>();
  const { authState } = useAuth();
  const { showId } = route.params || {};
  const userId = authState?.user?.id;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  // ─────────────────────────  Structured address  ──────────────────────────
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');   // 2–letter state / province
  const [zipCode, setZipCode] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startDateText, setStartDateText] = useState('');
  const [endDateText, setEndDateText] = useState('');
  // Time state – hours (1-12), minutes (0-59), period (AM/PM)
  const [startHour, setStartHour] = useState<string>('10');
  const [startMinute, setStartMinute] = useState<string>('00');
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [endHour, setEndHour] = useState<string>('4');
  const [endMinute, setEndMinute] = useState<string>('00');
  const [endPeriod, setEndPeriod] = useState<'AM' | 'PM'>('PM');

  // Calendar-modal visibility
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  // Categories and features (optional)
  const [categories, setCategories] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);

  // Original values for comparison
  const [originalAddress, setOriginalAddress] = useState('');
  const [originalCoordinates, setOriginalCoordinates] = useState<{latitude: number, longitude: number} | null>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper function to compare only the date part (not time)
  const areSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

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

  // Normalize address for comparison
  const normalizeAddress = (address: string): string => {
    return address.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // Parse time from a date or date string (e.g. "2025-04-24T10:00:00+00")
  const parseTimeFromDate = (dt: string | Date): { hour: string; minute: string; period: 'AM' | 'PM' } => {
    try {
      const date = dt instanceof Date ? dt : new Date(dt);
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      
      // Convert to 12-hour format
      hours = hours % 12;
      hours = hours ? hours : 12; // Convert 0 to 12
      
      return {
        hour: hours.toString(),
        minute: minutes.toString().padStart(2, '0'),
        period
      };
    } catch {
      return { hour: '12', minute: '00', period: 'PM' };
    }
  };

  // Load show data on mount
  useEffect(() => {
    const loadShowData = async () => {
      if (!showId) {
        Alert.alert('Error', 'No show ID provided');
        navigation.goBack();
        return;
      }

      try {
        const { data: show, error } = await getShowById(showId);
        
        if (error || !show) {
          Alert.alert('Error', error || 'Failed to load show details');
          navigation.goBack();
          return;
        }

        // Set form values from show data
        setTitle(show.title || '');
        setDescription(show.description || '');
        setLocation(show.location || '');
        
        // Parse address into components
        const address = show.address || '';
        setOriginalAddress(normalizeAddress(address));
        
        // Try to parse address into components (Street, City, ST ZIP)
        const addressMatch = address.match(/^(.*),\s*(.*),\s*([A-Z]{2})\s*(\d{5}(-\d{4})?)$/);
        if (addressMatch) {
          setStreet(addressMatch[1].trim());
          setCity(addressMatch[2].trim());
          setStateProv(addressMatch[3].trim());
          setZipCode(addressMatch[4].trim());
        } else {
          // If address doesn't match expected format, just put it all in street
          setStreet(address);
          setCity('');
          setStateProv('');
          setZipCode('');
        }
        
        // Set entry fee
        setEntryFee(show.entryFee ? show.entryFee.toString() : '0');
        
        // Compute concrete Date objects once
        const startDt = show.startDate ? new Date(show.startDate) : new Date();
        const endDt   = show.endDate   ? new Date(show.endDate)   : new Date();

        // Set date state
        setStartDate(startDt);
        setEndDate(endDt);
        
        // Set times from dates
        const startTimeInfo = parseTimeFromDate(startDt);
        setStartHour(startTimeInfo.hour);
        setStartMinute(startTimeInfo.minute);
        setStartPeriod(startTimeInfo.period);
        
        const endTimeInfo = parseTimeFromDate(endDt);
        setEndHour(endTimeInfo.hour);
        setEndMinute(endTimeInfo.minute);
        setEndPeriod(endTimeInfo.period);
        
        // Update date text displays using the same local Date objects
        setStartDateText(formatDateTime(
          startDt, 
          startTimeInfo.hour, 
          startTimeInfo.minute, 
          startTimeInfo.period
        ));
        
        setEndDateText(formatDateTime(
          endDt, 
          endTimeInfo.hour, 
          endTimeInfo.minute, 
          endTimeInfo.period
        ));
        
        // Set categories and features
        setCategories(show.categories || []);
        
        // Convert features object to array of keys where value is true
        if (show.features) {
          const featureArray = Object.entries(show.features)
            .filter(([_, value]) => value === true)
            .map(([key]) => key);
          setFeatures(featureArray);
        }
        
        // Store original coordinates for comparison
        if (show.coordinates) {
          setOriginalCoordinates(show.coordinates);
        }
        
      } catch (error) {
        console.error('Error loading show:', error);
        Alert.alert('Error', 'Failed to load show details');
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    loadShowData();
  }, [showId, navigation]);

  // Set navigation title
  useEffect(() => {
    navigation.setOptions({
      title: 'Edit Show',
    });
  }, [navigation]);

  /**
   * Attempt to parse a user entered date string.
   * Falls back to current value if parsing fails.
   */
  const tryParseDate = (value: string, current: Date): Date => {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? current : parsed;
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

  // Validate address format more thoroughly
  const validateAddress = (): { isValid: boolean; message?: string } => {
    // Check if all required fields are filled
    if (!street.trim() || !city.trim() || !stateProv.trim() || !zipCode.trim()) {
      return { 
        isValid: false, 
        message: 'All address fields are required (street, city, state, ZIP)' 
      };
    }

    // Validate state code format (2 letters)
    if (!/^[A-Z]{2}$/.test(stateProv)) {
      return { 
        isValid: false, 
        message: 'State must be a valid 2-letter state code (e.g., CA, NY, TX)' 
      };
    }

    // Validate ZIP code format (5 digits or 5+4)
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
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
    } else if (!/^[A-Z]{2}$/.test(stateProv)) {
      newErrors.stateProv = 'State must be a valid 2-letter code (e.g., CA)';
    }
    
    if (!zipCode.trim()) {
      newErrors.zipCode = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      newErrors.zipCode = 'ZIP code is invalid (must be 5 digits or 5+4 format)';
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

  // Check if geocoding result is accurate enough
  const isGeocodingAccurate = (coords: { latitude: number; longitude: number; confidence?: number }) => {
    // If the geocoding service provides a confidence score, use it
    if (coords.confidence !== undefined) {
      return coords.confidence >= 0.7; // 70% confidence minimum
    }

    // Basic validation - check if coordinates are not at (0,0) or other obvious invalid values
    if (Math.abs(coords.latitude) < 0.01 && Math.abs(coords.longitude) < 0.01) {
      return false; // Coordinates near (0,0) are likely invalid
    }

    // Check if coordinates are within reasonable bounds for US
    if (coords.latitude < 24 || coords.latitude > 50 || 
        coords.longitude < -125 || coords.longitude > -66) {
      // Outside continental US bounds (rough check)
      console.warn('[EditShowScreen] Coordinates outside continental US bounds:', coords);
      // Still return true as the show might be outside the US
      return true;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'You must be logged in to update a show');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create full datetime objects with time components
      const fullStartDate = getFullDateForPostgres(startDate, startHour, startMinute, startPeriod);
      const fullEndDate = getFullDateForPostgres(endDate, endHour, endMinute, endPeriod);
      
      // Combine address components
      const fullAddress = `${street}, ${city}, ${stateProv} ${zipCode}`;
      const normalizedNewAddress = normalizeAddress(fullAddress);
      
      // Check if address has changed
      const addressChanged = normalizedNewAddress !== originalAddress;
      
      // Initialize coordinates
      let coords = originalCoordinates;
      
      // Only geocode if address has changed
      if (addressChanged) {
        /* -----------------------------------------------------------
         * 1. Validate address format before geocoding
         * --------------------------------------------------------- */
        const addressValidation = validateAddress();
        if (!addressValidation.isValid) {
          Alert.alert('Invalid Address', addressValidation.message || 'Please check your address format and try again.');
          setIsSubmitting(false);
          return;
        }

        /* -----------------------------------------------------------
         * 2. Geocode the full street address → coordinates
         * --------------------------------------------------------- */
        try {
          coords = await geocodeAddress(fullAddress);
        } catch (geoErr) {
          console.warn('[EditShowScreen] Geocoding threw:', geoErr);
          Alert.alert(
            'Address Not Found',
            'We could not find this address on the map. Please check that:\n\n' +
            '• The street number and name are correct\n' +
            '• The city name is spelled correctly\n' +
            '• The state code is valid (e.g., CA, NY, TX)\n' +
            '• The ZIP code matches the city and state'
          );
          setIsSubmitting(false);
          return;
        }

        /* -----------------------------------------------------------
         * 3. Verify geocoding accuracy
         * --------------------------------------------------------- */
        if (!isGeocodingAccurate(coords)) {
          const continueWithInaccurate = await new Promise<boolean>((resolve) => {
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
      }

      // Convert features array to object map
      const featuresMap: Record<string, boolean> = {};
      features.forEach(feature => {
        featuresMap[feature] = true;
      });

      // Prepare update payload
      const updates: {
        title: string;
        description: string | null;
        location: string;
        address: string;
        startDate: string;
        endDate: string;
        entryFee: number;
        features: Record<string, boolean>;
        categories: string[];
        latitude?: number;
        longitude?: number;
      } = {
        title,
        description: description || null,
        location,
        address: fullAddress,
        startDate: fullStartDate,
        endDate: fullEndDate,
        entryFee: entryFee ? Number(entryFee) : 0,
        features: featuresMap,
        categories,
      };

      // Only include coordinates if they were geocoded or already exist
      if (coords) {
        updates.latitude = coords.latitude;
        updates.longitude = coords.longitude;
      }

      // Call update service
      const { data: _data, error } = await updateShow({
        id: showId,
        updates,
      });

      if (error) {
        throw new Error(error);
      }

      Alert.alert(
        'Success',
        'Your show has been updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('[EditShowScreen] Error updating show:', error);
      Alert.alert(
        'Error Updating Show',
        error instanceof Error 
          ? error.message 
          : 'There was a problem updating your show. Please try again.'
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

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>Loading show details...</Text>
      </View>
    );
  }

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

                  /* -----------------------------------------------------------------
                   * If the new start date is after the current endDate (by calendar
                   * day) we keep UX simple by bumping endDate to the same day.
                   * ----------------------------------------------------------------*/
                  if (
                    !areSameDay(selected, endDate) &&
                    selected.getTime() > endDate.getTime()
                  ) {
                    setEndDate(selected);
                    setEndDateText(
                      formatDateTime(selected, endHour, endMinute, endPeriod),
                    );
                  }
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
              minimumDate={startDate}
              onChange={(_, selected) => {
                setShowEndPicker(false);
                if (selected) {
                  // Ensure the picked end date is not before the start date
                  let newEndDate = new Date(selected);
                  if (
                    newEndDate.getTime() < startDate.getTime() &&
                    !areSameDay(newEndDate, startDate)
                  ) {
                    newEndDate = new Date(startDate);
                  }
                  setEndDate(newEndDate);
                  setEndDateText(formatDateTime(newEndDate, endHour, endMinute, endPeriod));
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
                <Ionicons name="save-outline" size={20} color="#FFFFFF" style={styles.submitIcon} />
                <Text style={styles.submitText}>Save Changes</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
});

export default EditShowScreen;
