/**
 * Filter Service
 * 
 * This service handles filter persistence, management, and synchronization
 * between local storage (_AsyncStorage) and server storage (_Supabase).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { ShowFilters, CardCategory, ShowFeature } from '../types';

/**
 * -------------------------------------------------------------
 * User-scoped AsyncStorage keys
 * -------------------------------------------------------------
 * We namespace each key with the Supabase `userId` so that
 * filters/presets saved by one user are never shown to another
 * user on the same device.
 * ------------------------------------------------------------*/
const getTempFiltersKey = (userId: string) => `homeFilters_${userId}`;
const getFilterPresetsKey = (userId: string) => `filterPresets_${userId}`;

// Default filters
export const DEFAULT_FILTERS: ShowFilters = {
  radius: 25,
  startDate: new Date(),
  endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
  features: [],
  categories: [],
};

// Interface for filter presets
export interface FilterPreset {
  id?: string;
  userId: string;
  name: string;
  filters: ShowFilters;
  isDefault?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * Save temporary filters to AsyncStorage
 */
export const saveTemporaryFilters = async (
  userId: string,
  filters: ShowFilters
): Promise<void> => {
  try {
    // Convert dates to ISO strings for storage
    const filtersToStore = {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate).toISOString() : null,
      endDate: filters.endDate ? new Date(filters.endDate).toISOString() : null,
    };
    
    await AsyncStorage.setItem(
      getTempFiltersKey(userId), 
      JSON.stringify(filtersToStore)
    );
     
console.warn('Temporary filters saved to AsyncStorage');
  } catch (error) {
    console.error('Error saving temporary filters:', error);
    throw new Error('Failed to save temporary filters');
  }
};

/**
 * Load temporary filters from AsyncStorage
 */
export const loadTemporaryFilters = async (userId: string): Promise<ShowFilters | null> => {
  try {
    const storedFilters = await AsyncStorage.getItem(getTempFiltersKey(userId));
    
    if (!storedFilters) {
      return null;
    }
    
    const parsedFilters = JSON.parse(storedFilters);
    
    // Convert ISO date strings back to Date objects
    return {
      ...parsedFilters,
      startDate: parsedFilters.startDate ? new Date(parsedFilters.startDate) : null,
      endDate: parsedFilters.endDate ? new Date(parsedFilters.endDate) : null,
    };
  } catch (error) {
    console.error('Error loading temporary filters:', error);
    return null;
  }
};

/**
 * Save filter presets to AsyncStorage (for offline access)
 */
export const saveFilterPresetsToAsyncStorage = async (
  userId: string,
  presets: FilterPreset[]
): Promise<void> => {
  try {
    const presetsToStore = presets.map((preset: FilterPreset) => ({
      ...preset,
      filters: {
        ...preset.filters,
        startDate: preset.filters.startDate ? new Date(preset.filters.startDate).toISOString() : null,
        endDate: preset.filters.endDate ? new Date(preset.filters.endDate).toISOString() : null,
      }
    }));
    
    await AsyncStorage.setItem(
      getFilterPresetsKey(userId), 
      JSON.stringify(presetsToStore)
    );
  } catch (error) {
    console.error('Error saving filter presets to AsyncStorage:', error);
    throw new Error('Failed to save filter presets locally');
  }
};

/**
 * Load filter presets from AsyncStorage
 */
export const loadFilterPresetsFromAsyncStorage = async (
  userId: string
): Promise<FilterPreset[]> => {
  try {
    const storedPresets = await AsyncStorage.getItem(getFilterPresetsKey(userId));
    
    if (!storedPresets) {
      return [];
    }
    
    const parsedPresets = JSON.parse(storedPresets);
    
    // Convert ISO date strings back to Date objects in filters
    return parsedPresets.map((preset: FilterPreset) => ({
      ...preset,
      filters: {
        ...preset.filters,
        startDate: preset.filters.startDate ? new Date(preset.filters.startDate) : null,
        endDate: preset.filters.endDate ? new Date(preset.filters.endDate) : null,
      }
    }));
  } catch (error) {
    console.error('Error loading filter presets from AsyncStorage:', error);
    return [];
  }
};

/**
 * Create a new filter preset in Supabase
 */
export const createFilterPreset = async (
  preset: Omit<FilterPreset, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FilterPreset | null> => {
  try {
    // Validate required fields
    if (!preset.userId || !preset.name || !preset.filters) {
      throw new Error('Missing required fields for filter preset');
    }
    
    // Prepare the data for insertion
    const newPreset = {
      user_id: preset.userId,
      name: preset.name,
      filters: {
        ...preset.filters,
        // Convert Date objects to ISO strings for storage
        startDate: preset.filters.startDate ? new Date(preset.filters.startDate).toISOString() : null,
        endDate: preset.filters.endDate ? new Date(preset.filters.endDate).toISOString() : null,
      },
      is_default: preset.isDefault || false,
    };
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('filter_presets')
      .insert([newPreset])
      .select('*')
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    // Map the database response to our FilterPreset interface
    const createdPreset: FilterPreset = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      filters: {
        ...data.filters,
        // Convert ISO strings back to Date objects
        startDate: data.filters.startDate ? new Date(data.filters.startDate) : null,
        endDate: data.filters.endDate ? new Date(data.filters.endDate) : null,
      },
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    // Update local cache
    const localPresets = await loadFilterPresetsFromAsyncStorage(preset.userId);
    await saveFilterPresetsToAsyncStorage(preset.userId, [...localPresets, createdPreset]);
    
    return createdPreset;
  } catch (error) {
    console.error('Error creating filter preset:', error);
    throw new Error('Failed to create filter preset');
  }
};

/**
 * Load all filter presets for a user from Supabase
 */
export const loadFilterPresetsFromSupabase = async (userId: string): Promise<FilterPreset[]> => {
  try {
    const { data, error } = await supabase
      .from('filter_presets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Map database response to our FilterPreset interface
    const presets: FilterPreset[] = data.map(item => ({
      id: item.id,
      userId: item.user_id,
      name: item.name,
      filters: {
        ...item.filters,
        // Convert ISO strings to Date objects
        startDate: item.filters.startDate ? new Date(item.filters.startDate) : null,
        endDate: item.filters.endDate ? new Date(item.filters.endDate) : null,
      },
      isDefault: item.is_default,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
    
    // Update local cache
    await saveFilterPresetsToAsyncStorage(userId, presets);
    
    return presets;
  } catch (error) {
    console.error('Error loading filter presets from Supabase:', error);
    
    // Fall back to local cache if server request fails
    return await loadFilterPresetsFromAsyncStorage(userId);
  }
};

/**
 * Update an existing filter preset in Supabase
 */
export const updateFilterPreset = async (
  presetId: string,
  updates: Partial<Omit<FilterPreset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<FilterPreset | null> => {
  try {
    // Prepare the data for update
    const updateData: Record<string, any> = {};
    
    if (updates.name) {
      updateData.name = updates.name;
    }
    
    if (updates.isDefault !== undefined) {
      updateData.is_default = updates.isDefault;
    }
    
    if (updates.filters) {
      updateData.filters = {
        ...updates.filters,
        // Convert Date objects to ISO strings
        startDate: updates.filters.startDate ? new Date(updates.filters.startDate).toISOString() : null,
        endDate: updates.filters.endDate ? new Date(updates.filters.endDate).toISOString() : null,
      };
    }
    
    // Update in Supabase
    const { data, error } = await supabase
      .from('filter_presets')
      .update(updateData)
      .eq('id', presetId)
      .select('*')
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    // Map the database response to our FilterPreset interface
    const updatedPreset: FilterPreset = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      filters: {
        ...data.filters,
        // Convert ISO strings back to Date objects
        startDate: data.filters.startDate ? new Date(data.filters.startDate) : null,
        endDate: data.filters.endDate ? new Date(data.filters.endDate) : null,
      },
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    // Update local cache
    const localPresets = await loadFilterPresetsFromAsyncStorage(updatedPreset.userId);
    const updatedLocalPresets = localPresets.map(preset => 
      preset.id === presetId ? updatedPreset : preset
    );
    await saveFilterPresetsToAsyncStorage(updatedPreset.userId, updatedLocalPresets);
    
    return updatedPreset;
  } catch (error) {
    console.error('Error updating filter preset:', error);
    throw new Error('Failed to update filter preset');
  }
};

/**
 * Delete a filter preset from Supabase
 */
export const deleteFilterPreset = async (presetId: string): Promise<boolean> => {
  try {
    // Delete from Supabase
    const { error } = await supabase
      .from('filter_presets')
      .delete()
      .eq('id', presetId);
    
    if (error) {
      throw error;
    }
    
    /**
     * We don't know the userId from the caller, so we do a best-effort:
     * 1. Try to find the preset in *any* cached preset list
     * 2. Use that userId for cache update
     */
    const allKeys = await AsyncStorage.getAllKeys();
    const presetKeys = allKeys.filter(k => k.startsWith('filterPresets_'));
    for (const key of presetKeys) {
      const presetsStr = await AsyncStorage.getItem(key);
      if (!presetsStr) continue;
      const presets: FilterPreset[] = JSON.parse(presetsStr);
      if (presets.some(p => p.id === presetId)) {
        const remaining = presets.filter(p => p.id !== presetId);
        await AsyncStorage.setItem(key, JSON.stringify(remaining));
        break;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting filter preset:', error);
    throw new Error('Failed to delete filter preset');
  }
};

/**
 * Set a filter preset as the default
 */
export const setDefaultFilterPreset = async (userId: string, presetId: string): Promise<boolean> => {
  try {
    // First, clear any existing default
    await supabase
      .from('filter_presets')
      .update({ is_default: false })
      .eq('user_id', userId);
    
    // Then set the new default
    const { error } = await supabase
      .from('filter_presets')
      .update({ is_default: true })
      .eq('id', presetId)
      .eq('user_id', userId);
    
    if (error) {
      throw error;
    }
    
    // Update local cache
    const _presets = await loadFilterPresetsFromSupabase(userId);
    
    return true;
  } catch (error) {
    console.error('Error setting default filter preset:', error);
    throw new Error('Failed to set default filter preset');
  }
};

/**
 * Get the default filter preset for a user
 */
export const getDefaultFilterPreset = async (userId: string): Promise<FilterPreset | null> => {
  try {
    const { data, error } = await supabase
      .from('filter_presets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      filters: {
        ...data.filters,
        startDate: data.filters.startDate ? new Date(data.filters.startDate) : null,
        endDate: data.filters.endDate ? new Date(data.filters.endDate) : null,
      },
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error getting default filter preset:', error);
    return null;
  }
};

/**
 * Synchronize filters between local storage and server
 * This is useful when coming back online after being offline
 */
export const syncFilters = async (userId: string): Promise<void> => {
  try {
    // Get server presets
    const { data: serverPresets, error } = await supabase
      .from('filter_presets')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      throw error;
    }
    
    // Get local presets
    const _localPresets = await loadFilterPresetsFromAsyncStorage(userId);
    
    // Map server presets to our format
    const mappedServerPresets: FilterPreset[] = serverPresets.map(item => ({
      id: item.id,
      userId: item.user_id,
      name: item.name,
      filters: {
        ...item.filters,
        startDate: item.filters.startDate ? new Date(item.filters.startDate) : null,
        endDate: item.filters.endDate ? new Date(item.filters.endDate) : null,
      },
      isDefault: item.is_default,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
    
    // Update local cache with server data
    await saveFilterPresetsToAsyncStorage(userId, mappedServerPresets);
  } catch (error) {
    console.error('Error syncing filters:', error);
    throw new Error('Failed to sync filters');
  }
};

/**
 * Check if a filter matches the default filter values
 */
export const isDefaultFilter = (filter: ShowFilters): boolean => {
  // Check radius
  if (filter.radius !== DEFAULT_FILTERS.radius) {
    return false;
  }
  
  // Check start date (only compare date portion, not time)
  if (filter.startDate && DEFAULT_FILTERS.startDate) {
    const filterDate = new Date(filter.startDate);
    const defaultDate = new Date(DEFAULT_FILTERS.startDate);
    
    if (
      filterDate.getFullYear() !== defaultDate.getFullYear() ||
      filterDate.getMonth() !== defaultDate.getMonth() ||
      filterDate.getDate() !== defaultDate.getDate()
    ) {
      return false;
    }
  } else if ((filter.startDate && !DEFAULT_FILTERS.startDate) || 
             (!filter.startDate && DEFAULT_FILTERS.startDate)) {
    return false;
  }
  
  // Check end date (only compare date portion, not time)
  if (filter.endDate && DEFAULT_FILTERS.endDate) {
    const filterDate = new Date(filter.endDate);
    const defaultDate = new Date(DEFAULT_FILTERS.endDate);
    
    if (
      filterDate.getFullYear() !== defaultDate.getFullYear() ||
      filterDate.getMonth() !== defaultDate.getMonth() ||
      filterDate.getDate() !== defaultDate.getDate()
    ) {
      return false;
    }
  } else if ((filter.endDate && !DEFAULT_FILTERS.endDate) || 
             (!filter.endDate && DEFAULT_FILTERS.endDate)) {
    return false;
  }
  
  // Check max entry fee
  if (filter.maxEntryFee !== DEFAULT_FILTERS.maxEntryFee) {
    return false;
  }
  
  // Check categories
  const filterCategories = filter.categories || [];
  const defaultCategories = DEFAULT_FILTERS.categories || [];
  if (filterCategories.length !== defaultCategories.length) {
    return false;
  }
  for (const category of filterCategories) {
    if (!defaultCategories.includes(category)) {
      return false;
    }
  }
  
  // Check features
  const filterFeatures = filter.features || [];
  const defaultFeatures = DEFAULT_FILTERS.features || [];
  if (filterFeatures.length !== defaultFeatures.length) {
    return false;
  }
  for (const feature of filterFeatures) {
    if (!defaultFeatures.includes(feature)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Count the number of active (non-default) filters
 */
export const countActiveFilters = (filters: ShowFilters): number => {
  let count = 0;
  
  // Check radius
  if (filters.radius !== DEFAULT_FILTERS.radius) {
    count++;
  }
  
  // Check dates (if either start or end date is different, count as one filter)
  const defaultStartDate = DEFAULT_FILTERS.startDate 
    ? new Date(DEFAULT_FILTERS.startDate).toDateString() 
    : null;
  const defaultEndDate = DEFAULT_FILTERS.endDate 
    ? new Date(DEFAULT_FILTERS.endDate).toDateString() 
    : null;
  const filterStartDate = filters.startDate 
    ? new Date(filters.startDate).toDateString() 
    : null;
  const filterEndDate = filters.endDate 
    ? new Date(filters.endDate).toDateString() 
    : null;
  
  if (filterStartDate !== defaultStartDate || filterEndDate !== defaultEndDate) {
    count++;
  }
  
  // Check max entry fee
  if (filters.maxEntryFee !== undefined && filters.maxEntryFee !== DEFAULT_FILTERS.maxEntryFee) {
    count++;
  }
  
  // Check categories (each selected category counts as one filter)
  if (filters.categories && filters.categories.length > 0) {
    count += filters.categories.length;
  }
  
  // Check features (each selected feature counts as one filter)
  if (filters.features && filters.features.length > 0) {
    count += filters.features.length;
  }
  
  return count;
};

/**
 * Merge two filter objects, with the second taking precedence
 */
export const mergeFilters = (base: ShowFilters, override: Partial<ShowFilters>): ShowFilters => {
  return {
    ...base,
    ...override,
    // Special handling for arrays to ensure they're properly merged
    features: override.features !== undefined ? override.features : base.features,
    categories: override.categories !== undefined ? override.categories : base.categories,
  };
};

/**
 * Get a list of all available card categories
 */
export const getAllCardCategories = (): string[] => {
  return Object.values(CardCategory);
};

/**
 * Get a list of all available show features
 */
export const getAllShowFeatures = (): string[] => {
  return Object.values(ShowFeature);
};

/**
 * Format a filter for display (e.g., for filter chips or summaries)
 */
export const formatFilterForDisplay = (filter: ShowFilters): Record<string, string> => {
  const display: Record<string, string> = {};
  
  // Format radius
  if (filter.radius) {
    display.radius = `Within ${filter.radius} miles`;
  }
  
  // Format dates
  if (filter.startDate && filter.endDate) {
    const startDate = new Date(filter.startDate);
    const endDate = new Date(filter.endDate);
    display.dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  } else if (filter.startDate) {
    const startDate = new Date(filter.startDate);
    display.startDate = `From ${startDate.toLocaleDateString()}`;
  } else if (filter.endDate) {
    const endDate = new Date(filter.endDate);
    display.endDate = `Until ${endDate.toLocaleDateString()}`;
  }
  
  // Format entry fee
  if (filter.maxEntryFee !== undefined) {
    display.maxEntryFee = `Up to $${filter.maxEntryFee}`;
  }
  
  return display;
};
