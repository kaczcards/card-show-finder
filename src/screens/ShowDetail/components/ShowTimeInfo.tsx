import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Define strict types for the show object with optional properties
interface ShowTimeInfoProps {
  show: {
    start_date?: string | null;
    end_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    time?: string | null;
    description?: string | null;
    [key: string]: any; // Allow for additional properties
  };
}

// InfoRow component for consistent "icon + text" rows
type InfoRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string | null;
};

/**
 * A robust InfoRow component that ensures all text is properly wrapped
 * in Text components and handles all edge cases.
 */
const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value }) => {
  // Safe value with fallback
  const safeValue = value || 'Not specified';

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color="#666666" style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{safeValue}</Text>
      </View>
    </View>
  );
};

/**
 * A super-robust ShowTimeInfo component that ensures all text is properly
 * wrapped in Text components and all data access is safely guarded.
 */
const ShowTimeInfo: React.FC<ShowTimeInfoProps> = ({ show }) => {
  // Ensure show object exists
  const safeShow = show || {};
  
  // Format a date for display with comprehensive error handling
  const formatDate = (date?: string | null): string => {
    if (!date) return '';
    
    try {
      const dateObj = new Date(date);
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn(`Invalid date format: ${date}`);
        return date; // Return original string if parsing fails
      }
      
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return date || ''; // Return original string or empty string
    }
  };

  // Check if dates are the same with robust error handling
  const areSameDates = (date1?: string | null, date2?: string | null): boolean => {
    if (!date1 || !date2) return false;
    
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      
      // Check if dates are valid
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        return false;
      }
      
      return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );
    } catch (e) {
      console.error('Error comparing dates:', e);
      return false;
    }
  };

  // Format date range for display with comprehensive error handling
  const formatDateRange = (): string => {
    const startDate = safeShow.start_date;
    const endDate = safeShow.end_date;
    
    if (!startDate) return 'Date not specified';
    
    // For single-day shows
    if (!endDate || areSameDates(startDate, endDate)) {
      return formatDate(startDate);
    }
    
    // For multi-day shows
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  };

  // Format time with comprehensive error handling
  const formatTime = (timeString?: string | null): string => {
    if (!timeString) return '';
    
    try {
      // Try parsing as a full ISO date first
      let date;
      if (typeof timeString === 'string' && timeString.includes('T')) {
        date = new Date(timeString);
      } else {
        // If it's just a time string, add a dummy date
        date = new Date(`2000-01-01T${timeString}`);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return timeString; // Return original string if parsing fails
      }
      
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error('Error formatting time:', e);
      return timeString; // Return original string if parsing fails
    }
  };

  // Get formatted show hours with comprehensive error handling
  const getFormattedShowHours = (): string => {
    // Try all possible time fields with safe access
    const startTime = safeShow.start_time || safeShow.startTime || safeShow.time;
    const endTime = safeShow.end_time || safeShow.endTime;
    
    // Format both times if available
    if (startTime && endTime) {
      const formattedStart = formatTime(startTime);
      const formattedEnd = formatTime(endTime);
      
      // Only show range if times are different
      if (formattedStart && formattedEnd && formattedStart !== formattedEnd) {
        return `${formattedStart} - ${formattedEnd}`;
      }
    }
    
    // Show single time if only start time is available
    if (startTime) {
      return formatTime(startTime);
    }
    
    // Show single time if only end time is available
    if (endTime) {
      return formatTime(endTime);
    }
    
    // Try to extract time from description as last resort
    const description = safeShow.description;
    if (description && typeof description === 'string') {
      // Look for common time patterns
      const timePattern = /(\d{1,2})(:\d{2})?\s*(am|pm)\s*[-–]?\s*(\d{1,2})(:\d{2})?\s*(am|pm)/i;
      const match = description.match(timePattern);
      
      if (match) {
        return `${match[1]}${match[2] || ''}${match[3]} - ${match[4]}${match[5] || ''}${match[6]}`;
      }
    }
    
    // Default fallback
    return 'Time not specified';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Show Details</Text>
      
      {/* Date row with calendar icon */}
      <InfoRow 
        icon="calendar" 
        label="Date"
        value={formatDateRange()} 
      />
      
      {/* Time row with time icon */}
      <InfoRow 
        icon="time" 
        label="Hours"
        value={getFormattedShowHours()} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333333',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#333333',
  }
});

export default ShowTimeInfo;
