import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Switch,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShowFilters, ShowFeature, CardCategory } from '../types';
// Temporarily commenting out DatePicker import to fix the crash
// import DatePicker from 'react-native-date-picker';

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: ShowFilters;
  onApplyFilters: (filters: ShowFilters) => void;
}

const { height } = Dimensions.get('window');

const RADIUS_OPTIONS = [25, 50, 100, 200];

const FilterSheet: React.FC<FilterSheetProps> = ({
  visible,
  onClose,
  filters,
  onApplyFilters,
}) => {
  // Animation for the bottom sheet
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Local state for filter values
  const [localFilters, setLocalFilters] = useState<ShowFilters>(filters);
  
  // Date inputs
  const [startDateText, setStartDateText] = useState('');
  const [endDateText, setEndDateText] = useState('');
  const [maxEntryFeeText, setMaxEntryFeeText] = useState('');

  // Date picker state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end'>('start');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Reset local filters when the component becomes visible
  useEffect(() => {
    setLocalFilters(filters);
    
    // Format dates for display
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      setStartDateText(startDate.toISOString().split('T')[0]);
    } else {
      setStartDateText('');
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      setEndDateText(endDate.toISOString().split('T')[0]);
    } else {
      setEndDateText('');
    }

    if (filters.maxEntryFee !== undefined) {
      setMaxEntryFeeText(filters.maxEntryFee.toString());
    } else {
      setMaxEntryFeeText('');
    }
  }, [filters, visible]);

  // Animate the bottom sheet when visibility changes
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  // Pan responder for dragging the sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > height * 0.2) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Handle radius selection
  const handleRadiusChange = (radius: number) => {
    setLocalFilters((prev) => ({
      ...prev,
      radius,
    }));
  };

  // Handle date changes
  const handleStartDateChange = (text: string) => {
    setStartDateText(text);
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const date = new Date(text);
        if (!isNaN(date.getTime())) {
          setLocalFilters((prev) => ({
            ...prev,
            startDate: date,
          }));
        }
      } else if (text === '') {
        setLocalFilters((prev) => ({
          ...prev,
          startDate: null,
        }));
      }
    } catch (error) {
      console.error('Invalid start date format:', error);
    }
  };

  const handleEndDateChange = (text: string) => {
    setEndDateText(text);
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const date = new Date(text);
        if (!isNaN(date.getTime())) {
          setLocalFilters((prev) => ({
            ...prev,
            endDate: date,
          }));
        }
      } else if (text === '') {
        setLocalFilters((prev) => ({
          ...prev,
          endDate: null,
        }));
      }
    } catch (error) {
      console.error('Invalid end date format:', error);
    }
  };

  // Handle max entry fee change
  const handleMaxEntryFeeChange = (text: string) => {
    setMaxEntryFeeText(text);
    const fee = parseFloat(text);
    setLocalFilters((prev) => ({
      ...prev,
      maxEntryFee: isNaN(fee) ? undefined : fee,
    }));
  };

  // Handle feature toggle
  const handleFeatureToggle = (feature: ShowFeature) => {
    setLocalFilters((prev) => {
      const features = prev.features || [];
      if (features.includes(feature)) {
        return {
          ...prev,
          features: features.filter((f) => f !== feature),
        };
      } else {
        return {
          ...prev,
          features: [...features, feature],
        };
      }
    });
  };

  // Handle category toggle
  const handleCategoryToggle = (category: CardCategory) => {
    setLocalFilters((prev) => {
      const categories = prev.categories || [];
      if (categories.includes(category)) {
        return {
          ...prev,
          categories: categories.filter((c) => c !== category),
        };
      } else {
        return {
          ...prev,
          categories: [...categories, category],
        };
      }
    });
  };

  // Apply filters and close the sheet
  const handleApplyFilters = () => {
    onApplyFilters(localFilters);
  };

  // Reset filters to defaults
  const handleResetFilters = () => {
    const defaultFilters: ShowFilters = {
      radius: 25,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
      maxEntryFee: undefined,
      features: [],
      categories: [],
    };
    
    setLocalFilters(defaultFilters);
    
    // Update date text inputs
    setStartDateText(defaultFilters.startDate!.toISOString().split('T')[0]);
    setEndDateText(defaultFilters.endDate!.toISOString().split('T')[0]);
    setMaxEntryFeeText('');
  };

  // Check if a feature is selected
  const isFeatureSelected = (feature: ShowFeature) => {
    return localFilters.features?.includes(feature) || false;
  };

  // Check if a category is selected
  const isCategorySelected = (category: CardCategory) => {
    return localFilters.categories?.includes(category) || false;
  };

  // Temporarily handle showing the date picker - just update the text fields manually
  const handleShowDatePicker = (type: 'start' | 'end') => {
    console.log(`Would show date picker for ${type} date`);
    // Simply provide a text field instruction instead of showing the date picker
    alert(`Please enter the ${type === 'start' ? 'Start' : 'End'} date manually in YYYY-MM-DD format`);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity },
          ]}
          onTouchEnd={onClose}
        />

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filter Card Shows</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content}>
            {/* Distance Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Distance</Text>
              <Text style={styles.sectionSubtitle}>Show card shows within:</Text>
              <View style={styles.radiusOptions}>
                {RADIUS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.radiusOption,
                      localFilters.radius === option && styles.radiusOptionSelected,
                    ]}
                    onPress={() => handleRadiusChange(option)}
                  >
                    <Text
                      style={[
                        styles.radiusOptionText,
                        localFilters.radius === option && styles.radiusOptionTextSelected,
                      ]}
                    >
                      {option} miles
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Range Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Date Range</Text>
              <Text style={styles.sectionSubtitle}>Show card shows between:</Text>
              
              <View style={styles.dateInputContainer}>
                <Text style={styles.dateLabel}>Start Date:</Text>
                <View style={styles.dateInputRow}>
                  <TextInput
                    style={styles.dateInput}
                    value={startDateText}
                    onChangeText={handleStartDateChange}
                    placeholder="YYYY-MM-DD"
                    keyboardType="default"
                  />
                </View>
              </View>
              
              <View style={styles.dateInputContainer}>
                <Text style={styles.dateLabel}>End Date:</Text>
                <View style={styles.dateInputRow}>
                  <TextInput
                    style={styles.dateInput}
                    value={endDateText}
                    onChangeText={handleEndDateChange}
                    placeholder="YYYY-MM-DD"
                    keyboardType="default"
                  />
                </View>
              </View>
            </View>

            {/* Max Entry Fee Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Max Entry Fee</Text>
              <Text style={styles.sectionSubtitle}>Only show events with entry fee up to:</Text>
              <TextInput
                style={styles.textInput}
                value={maxEntryFeeText}
                onChangeText={handleMaxEntryFeeChange}
                placeholder="e.g., 10.00 (leave blank for any fee)"
                keyboardType="numeric"
              />
            </View>

            {/* Features Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Show Features</Text>
              <Text style={styles.sectionSubtitle}>Filter by special features:</Text>
              
              {Object.values(ShowFeature).map((feature) => (
                <View key={feature} style={styles.toggleOption}>
                  <Text style={styles.toggleOptionText}>{feature}</Text>
                  <Switch
                    value={isFeatureSelected(feature)}
                    onValueChange={() => handleFeatureToggle(feature)}
                    trackColor={{ false: '#d1d1d1', true: '#b3d9ff' }}
                    thumbColor={isFeatureSelected(feature) ? '#007AFF' : '#f4f3f4'}
                    ios_backgroundColor="#d1d1d1"
                  />
                </View>
              ))}
            </View>

            {/* Categories Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Card Categories</Text>
              <Text style={styles.sectionSubtitle}>Filter by card types:</Text>
              
              {Object.values(CardCategory).map((category) => (
                <View key={category} style={styles.toggleOption}>
                  <Text style={styles.toggleOptionText}>{category}</Text>
                  <Switch
                    value={isCategorySelected(category)}
                    onValueChange={() => handleCategoryToggle(category)}
                    trackColor={{ false: '#d1d1d1', true: '#b3d9ff' }}
                    thumbColor={isCategorySelected(category) ? '#007AFF' : '#f4f3f4'}
                    ios_backgroundColor="#d1d1d1"
                  />
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetFilters}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApplyFilters}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>

          {/* DatePicker has been removed and replaced with TextInput */}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  bottomSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: height * 0.85,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    paddingHorizontal: 20,
    maxHeight: height * 0.65,
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  radiusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  radiusOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    margin: 4,
  },
  radiusOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  radiusOptionText: {
    color: '#333',
    fontSize: 14,
  },
  radiusOptionTextSelected: {
    color: 'white',
  },
  dateInputContainer: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dateInputRow: {
    flexDirection: 'row',
  },
  dateInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  toggleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  toggleOptionText: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  resetButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  applyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default FilterSheet;
