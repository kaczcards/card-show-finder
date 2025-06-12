// src/services/filterPreferencesService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key for storing filter preferences in AsyncStorage
const FILTER_PREFERENCES_KEY = '@CardShowFinder:filterPreferences';

/**
 * Save filter preferences to AsyncStorage
 * @param {Object} filters - The filter preferences to save
 * @returns {Promise<boolean>} - Success status
 */
export const saveFilterPreferences = async (filters) => {
  try {
    // Convert dates to ISO strings for storage
    const filtersToSave = {
      ...filters,
      startDate: filters.startDate?.toISOString(),
      endDate: filters.endDate?.toISOString(),
    };
    
    await AsyncStorage.setItem(
      FILTER_PREFERENCES_KEY, 
      JSON.stringify(filtersToSave)
    );
    
    console.log('Filter preferences saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving filter preferences:', error);
    return false;
  }
};

/**
 * Load filter preferences from AsyncStorage
 * @returns {Promise<Object>} - The saved filter preferences or default values
 */
export const loadFilterPreferences = async () => {
  try {
    const savedPreferences = await AsyncStorage.getItem(FILTER_PREFERENCES_KEY);
    
    if (!savedPreferences) {
      return getDefaultFilters();
    }
    
    const parsedPreferences = JSON.parse(savedPreferences);
    
    // Convert ISO date strings back to Date objects
    return {
      ...parsedPreferences,
      startDate: parsedPreferences.startDate ? new Date(parsedPreferences.startDate) : new Date(),
      endDate: parsedPreferences.endDate ? new Date(parsedPreferences.endDate) : getDefaultEndDate(),
    };
  } catch (error) {
    console.error('Error loading filter preferences:', error);
    return getDefaultFilters();
  }
};

/**
 * Clear saved filter preferences from AsyncStorage
 * @returns {Promise<boolean>} - Success status
 */
export const clearFilterPreferences = async () => {
  try {
    await AsyncStorage.removeItem(FILTER_PREFERENCES_KEY);
    console.log('Filter preferences cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing filter preferences:', error);
    return false;
  }
};

/**
 * Get default filter values
 * @returns {Object} - Default filter values
 */
const getDefaultFilters = () => {
  const today = new Date();
  
  return {
    startDate: today,
    endDate: getDefaultEndDate(),
    categories: [],
    features: {
      onSiteGrading: false,
      autographGuests: false
    },
    priceRange: [0, 100]
  };
};

/**
 * Get default end date (1 month from today)
 * @returns {Date} - Default end date
 */
const getDefaultEndDate = () => {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return nextMonth;
};
