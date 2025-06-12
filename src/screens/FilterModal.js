import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const FilterModal = ({ 
  visible, 
  onClose, 
  onApply, 
  initialFilters = {} 
}) => {
  // Default filter values
  const defaultFilters = {
    dateRange: {
      start: new Date(),
      end: (() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      })()
    },
    distance: 25,
    categories: [],
    features: {
      onSiteGrading: false,
      autographGuests: false,
      freeAdmission: false
    }
  };

  // Merge initial filters with defaults
  const [filters, setFilters] = useState({
    ...defaultFilters,
    ...initialFilters
  });
  
  // Date picker state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Reset filters when modal opens with new initial filters
  useEffect(() => {
    if (visible) {
      setFilters({
        ...defaultFilters,
        ...initialFilters
      });
    }
  }, [visible, initialFilters]);

  // Distance options
  const distanceOptions = [10, 25, 50, 100, 200];
  
  // Category options
  const categoryOptions = [
    'Sports Cards',
    'Baseball Cards',
    'Basketball Cards',
    'Football Cards',
    'Hockey Cards',
    'Pokemon Cards',
    'Magic: The Gathering',
    'Yu-Gi-Oh!',
    'Other TCGs'
  ];

  // Handle category selection
  const toggleCategory = (category) => {
    setFilters(prevFilters => {
      const updatedCategories = [...prevFilters.categories];
      
      if (updatedCategories.includes(category)) {
        return {
          ...prevFilters,
          categories: updatedCategories.filter(c => c !== category)
        };
      } else {
        return {
          ...prevFilters,
          categories: [...updatedCategories, category]
        };
      }
    });
  };

  // Handle distance selection
  const setDistance = (distance) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      distance
    }));
  };

  // Handle date changes
  const handleStartDateChange = (event, selectedDate) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setFilters(prevFilters => ({
        ...prevFilters,
        dateRange: {
          ...prevFilters.dateRange,
          start: selectedDate
        }
      }));
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setFilters(prevFilters => ({
        ...prevFilters,
        dateRange: {
          ...prevFilters.dateRange,
          end: selectedDate
        }
      }));
    }
  };

  // Handle feature toggle
  const toggleFeature = (feature) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      features: {
        ...prevFilters.features,
        [feature]: !prevFilters.features[feature]
      }
    }));
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Apply filters and close modal
  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6c757d" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Filter Shows</Text>
            <TouchableOpacity onPress={() => setFilters(defaultFilters)}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Content */}
          <ScrollView style={styles.content}>
            {/* Date Range Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Date Range</Text>
              
              <View style={styles.dateContainer}>
                <View style={styles.dateField}>
                  <Text style={styles.dateLabel}>From</Text>
                  <TouchableOpacity 
                    style={styles.dateButton}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {formatDate(filters.dateRange.start)}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#3498db" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.dateField}>
                  <Text style={styles.dateLabel}>To</Text>
                  <TouchableOpacity 
                    style={styles.dateButton}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {formatDate(filters.dateRange.end)}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#3498db" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date Pickers (hidden until triggered) */}
              {showStartDatePicker && (
                <DateTimePicker
                  value={filters.dateRange.start}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleStartDateChange}
                />
              )}
              
              {showEndDatePicker && (
                <DateTimePicker
                  value={filters.dateRange.end}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleEndDateChange}
                  minimumDate={filters.dateRange.start}
                />
              )}
            </View>

            {/* Distance Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Distance</Text>
              <Text style={styles.sectionSubtitle}>Shows within {filters.distance} miles</Text>
              
              <View style={styles.distanceButtons}>
                {distanceOptions.map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.distanceButton,
                      filters.distance === option && styles.distanceButtonActive
                    ]}
                    onPress={() => setDistance(option)}
                  >
                    <Text 
                      style={[
                        styles.distanceButtonText,
                        filters.distance === option && styles.distanceButtonTextActive
                      ]}
                    >
                      {option} mi
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Categories Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <Text style={styles.sectionSubtitle}>Select all that apply</Text>
              
              <View style={styles.categoriesContainer}>
                {categoryOptions.map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      filters.categories.includes(category) && styles.categoryChipActive
                    ]}
                    onPress={() => toggleCategory(category)}
                  >
                    <Text 
                      style={[
                        styles.categoryChipText,
                        filters.categories.includes(category) && styles.categoryChipTextActive
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
              
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>On-site Grading</Text>
                <Switch
                  value={filters.features.onSiteGrading}
                  onValueChange={() => toggleFeature('onSiteGrading')}
                  trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
                  thumbColor={filters.features.onSiteGrading ? '#3498db' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>Autograph Guests</Text>
                <Switch
                  value={filters.features.autographGuests}
                  onValueChange={() => toggleFeature('autographGuests')}
                  trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
                  thumbColor={filters.features.autographGuests ? '#3498db' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>Free Admission</Text>
                <Switch
                  value={filters.features.freeAdmission}
                  onValueChange={() => toggleFeature('freeAdmission')}
                  trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
                  thumbColor={filters.features.freeAdmission ? '#3498db' : '#f4f3f4'}
                />
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
            >
              <Text style={styles.applyButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalView: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529'
  },
  closeButton: {
    padding: 4
  },
  resetText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '500'
  },
  content: {
    paddingHorizontal: 16,
    maxHeight: '70%'
  },
  section: {
    marginTop: 20,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 12
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  dateField: {
    width: '48%'
  },
  dateLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  dateButtonText: {
    fontSize: 14,
    color: '#212529'
  },
  distanceButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8
  },
  distanceButton: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8
  },
  distanceButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db'
  },
  distanceButtonText: {
    fontSize: 14,
    color: '#495057'
  },
  distanceButtonTextActive: {
    color: 'white'
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8
  },
  categoryChipActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db'
  },
  categoryChipText: {
    fontSize: 14,
    color: '#495057'
  },
  categoryChipTextActive: {
    color: 'white'
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5'
  },
  featureText: {
    fontSize: 16,
    color: '#212529'
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5'
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ced4da'
  },
  cancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '500'
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#3498db',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center'
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500'
  }
});

export default FilterModal;