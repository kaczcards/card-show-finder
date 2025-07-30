import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { _Ionicons } from '@expo/vector-icons';
import { ShowFilters, _CardCategory, _ShowFeature } from '../types';

// Constants
const _PRIMARY_COLOR = '#FF6A00'; // Orange
const _SECONDARY_COLOR = '#0057B8'; // Blue

interface FilterChipsProps {
  filters: ShowFilters;
  onRemoveFilter: (key: string, value?: string) => void;
  style?: object;
}

const FilterChips: React.FC<FilterChipsProps> = ({
  filters,
  _onRemoveFilter,
  style,
}) => {
  // Default filters for comparison
  const defaultFilters: ShowFilters = {
    radius: 25,
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
  };

  // Format date for display
  const _formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '';
    const _dateObj = new Date(_date);
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Generate chips based on active filters
  const _generateFilterChips = () => {
    const _chips = [];

    // Radius chip
    if (filters.radius && filters.radius !== defaultFilters.radius) {
      chips.push({
        key: 'radius',
        label: `${filters.radius} miles`,
      });
    }

    // Date range chip
    if (
      (filters.startDate &&
        new Date(filters.startDate).toDateString() !==
          new Date(defaultFilters.startDate!).toDateString()) ||
      (filters.endDate &&
        new Date(filters.endDate).toDateString() !==
          new Date(defaultFilters.endDate!).toDateString())
    ) {
      const _startDateStr = filters.startDate ? formatDate(filters.startDate) : 'Any';
      const _endDateStr = filters.endDate ? formatDate(filters.endDate) : 'Any';
      chips.push({
        key: 'dateRange',
        label: `${_startDateStr} - ${_endDateStr}`,
      });
    }

    // Max entry fee chip
    if (filters.maxEntryFee !== undefined) {
      chips.push({
        key: 'maxEntryFee',
        label: `$${filters.maxEntryFee} max`,
      });
    }

    // Category chips
    if (filters.categories && filters.categories.length > 0) {
      filters.categories.forEach(category => {
        chips.push({
          key: 'category',
          value: category,
          label: category,
        });
      });
    }

    // Feature chips
    if (filters.features && filters.features.length > 0) {
      filters.features.forEach(feature => {
        chips.push({
          key: 'feature',
          value: feature,
          label: feature,
        });
      });
    }

    return chips;
  };

  const _filterChips = generateFilterChips();

  // If no active filters, don't render anything
  if (filterChips.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={_false}
        contentContainerStyle={styles.scrollContent}
      >
        {filterChips.map((_chip, _index) => (
          <TouchableOpacity
            key={`${chip.key}-${_index}`}
            style={styles.chip}
            onPress={() => onRemoveFilter(chip.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.chipText}>{chip.label}</Text>
            <View style={styles.removeIcon}>
              <Ionicons name="close" size={_14} color="white" />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const _styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingVertical: 4,
  },
  chip: {
    backgroundColor: SECONDARY_COLOR,
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 28,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  chipText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  removeIcon: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 24,
    backgroundColor: 'rgba(0,_0,0,0.15)',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FilterChips;
