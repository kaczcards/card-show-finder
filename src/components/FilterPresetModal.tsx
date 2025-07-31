import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  FilterPreset, 
  createFilterPreset, 
  loadFilterPresetsFromSupabase,
  deleteFilterPreset,
  setDefaultFilterPreset,
  updateFilterPreset
} from '../services/filterService';
import { ShowFilters } from '../types';

// Constants
const PRIMARY_COLOR = '#FF6A00'; // Orange
const SECONDARY_COLOR = '#0057B8'; // Blue

interface FilterPresetModalProps {
  visible: boolean;
  onClose: () => void;
  currentFilters: ShowFilters;
  onApplyPreset: (filters: ShowFilters) => void;
  userId: string;
}

const FilterPresetModal: React.FC<FilterPresetModalProps> = ({
  visible,
  onClose,
  currentFilters,
  onApplyPreset,
  userId,
}) => {
  // State
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load presets when modal becomes visible
  useEffect(() => {
    if (!visible) return;

    // Guard: If userId is missing we can't fetch presets
    if (!userId) {
      setError('You must be logged in to use filter presets.');
      setPresets([]);
      return;
    }

    // Fetch user presets
      loadPresets();
  }, [visible, userId]);

  // Load presets from Supabase
  const _loadPresets = async () => {
    try {
      if (!userId) return;
      setLoading(true);
      setError(null);
      const _userPresets = await loadFilterPresetsFromSupabase(_userId);
      setPresets(_userPresets);
    } catch (err: any) {
      setError('Failed to load saved presets');
      console.error('Error loading presets:', _err);
    } finally {
      setLoading(false);
    }
  };

  // Save a new preset
  const _handleSavePreset = async () => {
    if (!userId) {
      Alert.alert('Login Required', 'Please sign in to save filter presets.');
      return;
    }

    if (!newPresetName.trim()) {
      Alert.alert('Error', 'Please enter a name for your preset');
      return;
    }

    try {
      setSavingPreset(true);
      setError(null);

      // Check if a preset with this name already exists
      const _existingPreset = presets.find(
        (_preset) => preset.name.toLowerCase() === newPresetName.trim().toLowerCase()
      );

      if (_existingPreset) {
        // Ask user if they want to overwrite
        Alert.alert(
          'Preset Exists',
          `A preset named "${_newPresetName}" already exists. Do you want to update it?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Update',
              onPress: async () => {
                // Update existing preset
                const _updated = await updateFilterPreset(existingPreset.id!, {
                  name: newPresetName.trim(),
                  filters: currentFilters,
                });

                if (_updated) {
                  setNewPresetName('');
                  loadPresets();
                  Alert.alert('Success', 'Preset updated successfully');
                }
              },
            },
          ]
        );
        setSavingPreset(false);
        return;
      }

      // Create new preset
      const _newPreset = await createFilterPreset({
        userId,
        name: newPresetName.trim(),
        filters: currentFilters,
        isDefault: presets.length === 0, // Make it default if it's the first preset
      });

      if (_newPreset) {
        setNewPresetName('');
        loadPresets();
        Alert.alert('Success', 'Preset saved successfully');
      }
    } catch (err: any) {
      setError('Failed to save preset');
      console.error('Error saving preset:', _err);
    } finally {
      setSavingPreset(false);
    }
  };

  // Delete a preset
  const _handleDeletePreset = (preset: FilterPreset) => {
    if (!userId) return;
    Alert.alert(
      'Delete Preset',
      `Are you sure you want to delete "${preset.name}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteFilterPreset(preset.id!);
              loadPresets();
            } catch (err: any) {
              setError('Failed to delete preset');
              console.error('Error deleting preset:', _err);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Set a preset as default
  const _handleSetDefaultPreset = async (preset: FilterPreset) => {
    if (!userId) return;
    try {
      setLoading(true);
      await setDefaultFilterPreset(_userId, preset.id!);
      loadPresets();
      Alert.alert('Success', `"${preset.name}" set as default`);
    } catch (err: any) {
      setError('Failed to set default preset');
      console.error('Error setting default preset:', _err);
    } finally {
      setLoading(false);
    }
  };

  // Apply a preset
  const _handleApplyPreset = (preset: FilterPreset) => {
    onApplyPreset(preset.filters);
    onClose();
  };

  // Render a preset item
  const _renderPresetItem = ({ _item }: { item: FilterPreset }) => (
    <View style={styles.presetItem}>
      <TouchableOpacity
        style={styles.presetNameContainer}
        onPress={() => handleApplyPreset(_item)}
      >
        <Text style={styles.presetName}>{item.name}</Text>
        {item.isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <View style={styles.presetActions}>
        {!item.isDefault && (
          <TouchableOpacity
            style={[styles.presetAction, styles.defaultAction]}
            onPress={() => handleSetDefaultPreset(_item)}
          >
            <Ionicons name="star-outline" size={_20} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.presetAction, styles.deleteAction]}
          onPress={() => handleDeletePreset(_item)}
        >
          <Ionicons name="trash-outline" size={_20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={_visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filter Presets</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={_24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* New Preset Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={_newPresetName}
              onChangeText={_setNewPresetName}
              placeholder="Name your filter preset"
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!newPresetName.trim() || savingPreset) && styles.saveButtonDisabled,
              ]}
              onPress={_handleSavePreset}
              disabled={!newPresetName.trim() || savingPreset}
            >
              {savingPreset ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error && <Text style={styles.errorText}>{_error}</Text>}

          {/* Presets List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} />
              <Text style={styles.loadingText}>Loading presets...</Text>
            </View>
          ) : presets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmarks-outline" size={_50} color={SECONDARY_COLOR} />
              <Text style={styles.emptyText}>No saved presets</Text>
              <Text style={styles.emptySubtext}>
                Save your current filters as a preset to quickly apply them later
              </Text>
            </View>
          ) : (
            <FlatList
              data={_presets}
              renderItem={_renderPresetItem}
              keyExtractor={(_item) => item.id || item.name}
              contentContainerStyle={styles.presetList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const _styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,_0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginVertical: 10,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  presetList: {
    paddingHorizontal: 20,
  },
  presetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  presetNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetName: {
    fontSize: 16,
    color: '#333',
  },
  defaultBadge: {
    backgroundColor: SECONDARY_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 10,
  },
  defaultBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  presetActions: {
    flexDirection: 'row',
  },
  presetAction: {
    padding: 8,
    marginLeft: 5,
  },
  defaultAction: {
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    borderRadius: 4,
  },
  deleteAction: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 4,
  },
});

export default FilterPresetModal;
