// src/components/FilterPanel.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';

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
  { id: 'onSiteGrading', label: 'On-site Grading Service' },
  { id: 'autographGuests', label: 'Autograph Guests' }
];

const FilterPanel = ({ onFiltersChange, initialFilters = {} }) => {
  // Get current date and one month from now for default date range
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(today.getMonth() + 1);
  
  // Ensure initialFilters dates are Date objects
  const getValidDate = (dateValue) => {
    if (!dateValue) return new Date();
    
    try {
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
      console.error("Invalid date:", error);
      return new Date();
    }
  };
  
  // Filter state
  const [filters, setFilters] = useState({
    startDate: getValidDate(initialFilters.startDate) || today,
    endDate: getValidDate(initialFilters.endDate) || nextMonth,
    categories: Array.isArray(initialFilters.categories) ? initialFilters.categories : [],
    features: initialFilters.features || {
      onSiteGrading: false,
      autographGuests: false
    },
    priceRange: Array.isArray(initialFilters.priceRange) ? initialFilters.priceRange : [0, 100], // [min, max] in dollars
    showDatePicker: null, // 'start' or 'end' when showing date picker
  });
  
  // Format date for display
  const formatDate = (date) => {
    try {
      const validDate = getValidDate(date);
      const options = { month: 'short', day: 'numeric', year: 'numeric' };
      return validDate.toLocaleDateString(undefined, options);
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };
  
  // Toggle date picker visibility
  const toggleDatePicker = (pickerType) => {
    console.log(`Toggling date picker: ${filters.showDatePicker} -> ${pickerType}`);
    setFilters(prev => ({
      ...prev,
      showDatePicker: prev.showDatePicker === pickerType ? null : pickerType
    }));
  };
  
  // Handle date change
  const handleDateChange = (event, selectedDate) => {
    try {
      console.log(`Date change event: ${event?.type}, selected date: ${selectedDate}`);
      
      // On Android, the picker is dismissed automatically on selection
      // On iOS, we keep it open until user explicitly dismisses it
      const shouldDismissPicker = Platform.OS === 'android' || event?.type === 'dismissed';
      
      if (shouldDismissPicker) {
        setFilters(prev => ({ ...prev, showDatePicker: null }));
      }
      
      if (!selectedDate) {
        console.log("No date selected, keeping current value");
        return; // User canceled
      }
      
      const updatedFilters = { ...filters };
      
      if (filters.showDatePicker === 'start') {
        console.log(`Updating start date: ${filters.startDate} -> ${selectedDate}`);
        updatedFilters.startDate = selectedDate;
        // Ensure start date is not after end date
        if (selectedDate > filters.endDate) {
          updatedFilters.endDate = new Date(selectedDate);
          updatedFilters.endDate.setDate(selectedDate.getDate() + 7);
        }
      } else {
        console.log(`Updating end date: ${filters.endDate} -> ${selectedDate}`);
        updatedFilters.endDate = selectedDate;
        // Ensure end date is not before start date
        if (selectedDate < filters.startDate) {
          updatedFilters.startDate = new Date(selectedDate);
          updatedFilters.startDate.setDate(selectedDate.getDate() - 7);
        }
      }
      
      // Keep picker open on iOS unless dismissed
      if (!shouldDismissPicker) {
        updatedFilters.showDatePicker = filters.showDatePicker;
      } else {
        updatedFilters.showDatePicker = null;
      }
      
      setFilters(updatedFilters);
      
      // Notify parent of filter changes
      if (onFiltersChange) {
        const { showDatePicker, ...filtersToEmit } = updatedFilters;
        onFiltersChange(filtersToEmit);
      }
    } catch (error) {
      console.error("Error handling date change:", error);
    }
  };
  
  // Toggle category selection
  const toggleCategory = (category) => {
    try {
      const updatedCategories = [...filters.categories];
      const categoryIndex = updatedCategories.indexOf(category);
      
      if (categoryIndex >= 0) {
        updatedCategories.splice(categoryIndex, 1);
      } else {
        updatedCategories.push(category);
      }
      
      const updatedFilters = { ...filters, categories: updatedCategories };
      setFilters(updatedFilters);
      
      // Notify parent of filter changes
      if (onFiltersChange) {
        const { showDatePicker, ...filtersToEmit } = updatedFilters;
        onFiltersChange(filtersToEmit);
      }
    } catch (error) {
      console.error("Error toggling category:", error);
    }
  };
  
  // Toggle feature
  const toggleFeature = (featureId) => {
    try {
      const updatedFeatures = { 
        ...filters.features, 
        [featureId]: !filters.features[featureId] 
      };
      
      const updatedFilters = { ...filters, features: updatedFeatures };
      setFilters(updatedFilters);
      
      // Notify parent of filter changes
      if (onFiltersChange) {
        const { showDatePicker, ...filtersToEmit } = updatedFilters;
        onFiltersChange(filtersToEmit);
      }
    } catch (error) {
      console.error("Error toggling feature:", error);
    }
  };
  
  // Handle price range change
  const handlePriceChange = (value) => {
    try {
      // Ensure value is within valid range
      const safeValue = Math.max(0, Math.min(100, value));
      const updatedFilters = { ...filters, priceRange: [0, safeValue] };
      setFilters(updatedFilters);
      
      // Notify parent of filter changes
      if (onFiltersChange) {
        const { showDatePicker, ...filtersToEmit } = updatedFilters;
        onFiltersChange(filtersToEmit);
      }
    } catch (error) {
      console.error("Error handling price change:", error);
    }
  };
  
  // Reset all filters
  const resetFilters = () => {
    try {
      const resetFilters = {
        startDate: today,
        endDate: nextMonth,
        categories: [],
        features: {
          onSiteGrading: false,
          autographGuests: false
        },
        priceRange: [0, 100],
        showDatePicker: null
      };
      
      setFilters(resetFilters);
      
      // Notify parent of filter changes
      if (onFiltersChange) {
        const { showDatePicker, ...filtersToEmit } = resetFilters;
        onFiltersChange(filtersToEmit);
      }
    } catch (error) {
      console.error("Error resetting filters:", error);
    }
  };
  
  // Format price display
  const formatPrice = (value) => {
    if (value === 0) return 'Free';
    if (value >= 100) return '$100+';
    return `$${value}`;
  };
  
  // Sync with initialFilters if they change externally
  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      setFilters(prev => ({
        ...prev,
        startDate: getValidDate(initialFilters.startDate) || prev.startDate,
        endDate: getValidDate(initialFilters.endDate) || prev.endDate,
        categories: Array.isArray(initialFilters.categories) ? initialFilters.categories : prev.categories,
        features: initialFilters.features || prev.features,
        priceRange: Array.isArray(initialFilters.priceRange) ? initialFilters.priceRange : prev.priceRange
      }));
    }
  }, [initialFilters]);
  
  // Render date picker based on platform
  const renderDatePicker = () => {
    if (!filters.showDatePicker) return null;
    
    console.log(`Rendering DateTimePicker for ${filters.showDatePicker} on ${Platform.OS}`);
    
    const currentDate = filters.showDatePicker === 'start' ? filters.startDate : filters.endDate;
    
    if (Platform.OS === 'ios') {
      return (
        <View style={styles.datePickerIOSContainer}>
          <DateTimePicker
            testID={filters.showDatePicker === 'start' ? "startDatePicker" : "endDatePicker"}
            value={currentDate}
            mode="date"
            display="inline"
            onChange={handleDateChange}
            minimumDate={filters.showDatePicker === 'end' ? filters.startDate : undefined}
            style={styles.datePickerIOS}
          />
          <TouchableOpacity 
            style={styles.datePickerDoneButton}
            onPress={() => setFilters(prev => ({ ...prev, showDatePicker: null }))}
          >
            <Text style={styles.datePickerDoneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <DateTimePicker
          testID={filters.showDatePicker === 'start' ? "startDatePicker" : "endDatePicker"}
          value={currentDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={filters.showDatePicker === 'end' ? filters.startDate : undefined}
        />
      );
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Filter Shows</Text>
        <TouchableOpacity onPress={resetFilters} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollContainer}>
        {/* Date Range Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Range</Text>
          
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>From</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => toggleDatePicker('start')}
            >
              <Text style={styles.dateText}>{formatDate(filters.startDate)}</Text>
              <Ionicons name="calendar-outline" size={20} color="#3498db" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>To</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => toggleDatePicker('end')}
            >
              <Text style={styles.dateText}>{formatDate(filters.endDate)}</Text>
              <Ionicons name="calendar-outline" size={20} color="#3498db" />
            </TouchableOpacity>
          </View>
          
          {/* Render date picker */}
          {renderDatePicker()}
        </View>
        
        {/* Categories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categoriesContainer}>
            {CARD_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  filters.categories.includes(category) && styles.selectedCategory
                ]}
                onPress={() => toggleCategory(category)}
                accessibilityLabel={`Toggle ${category} category`}
              >
                <Text
                  style={[
                    styles.categoryText,
                    filters.categories.includes(category) && styles.selectedCategoryText
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          
          {SHOW_FEATURES.map((feature) => (
            <View key={feature.id} style={styles.featureRow}>
              <Text style={styles.featureText}>{feature.label}</Text>
              <Switch
                value={filters.features[feature.id] || false}
                onValueChange={() => toggleFeature(feature.id)}
                trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
                thumbColor={filters.features[feature.id] ? '#3498db' : '#f4f3f4'}
                accessibilityLabel={`Toggle ${feature.label} feature`}
              />
            </View>
          ))}
        </View>
        
        {/* Price Range Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admission Price</Text>
          
          <View style={styles.priceLabels}>
            <Text style={styles.priceLabel}>Free</Text>
            <Text style={styles.priceLabel}>$100+</Text>
          </View>
          
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            step={5}
            value={filters.priceRange[1]}
            minimumTrackTintColor="#3498db"
            maximumTrackTintColor="#e9ecef"
            thumbTintColor="#3498db"
            onValueChange={handlePriceChange}
            accessibilityLabel="Adjust maximum price"
          />
          
          <Text style={styles.currentPrice}>
            Max Price: {formatPrice(filters.priceRange[1])}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    margin: 10,
    maxHeight: Platform.OS === 'ios' ? '80%' : '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  resetButton: {
    padding: 8,
  },
  resetText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateLabel: {
    width: 50,
    fontSize: 16,
    color: '#495057',
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
  },
  dateText: {
    fontSize: 16,
    color: '#212529',
  },
  datePickerIOSContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ced4da',
    zIndex: 1000,
  },
  datePickerIOS: {
    height: 200,
    marginTop: 10,
    marginBottom: 10,
  },
  datePickerDoneButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 10,
  },
  datePickerDoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  featureText: {
    fontSize: 16,
    color: '#212529',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  priceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3498db',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default FilterPanel;
