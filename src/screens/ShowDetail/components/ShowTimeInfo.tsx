import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ShowTimeInfoProps {
  show: {
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    startTime?: string;
    endTime?: string;
    time?: string;
    description?: string;
  };
}

// InfoRow component for consistent "icon + text" rows
const InfoRow: React.FC<{ 
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={20} color="#666666" style={styles.infoIcon} />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const ShowTimeInfo: React.FC<ShowTimeInfoProps> = ({ show }) => {
  // Format a date for display
  const formatDate = (date?: string) => {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return date;
    }
  };

  // Check if dates are the same
  const areSameDates = (date1?: string, date2?: string) => {
    if (!date1 || !date2) return false;
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return d1.toDateString() === d2.toDateString();
    } catch (e) {
      return false;
    }
  };

  // Format date range for display
  const formatDateRange = () => {
    if (!show.start_date) return 'Date not specified';
    
    // For single-day shows
    if (!show.end_date || areSameDates(show.start_date, show.end_date)) {
      return formatDate(show.start_date);
    }
    
    // For multi-day shows
    return `${formatDate(show.start_date)} to ${formatDate(show.end_date)}`;
  };

  // Format time
  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    try {
      // Try parsing as a full ISO date first
      let date;
      if (timeString.includes('T')) {
        date = new Date(timeString);
      } else {
        // If it's just a time string, add a dummy date
        date = new Date(`2000-01-01T${timeString}`);
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      // If parsing fails, return the original string
      return timeString;
    }
  };

  // Get formatted show hours
  const getFormattedShowHours = () => {
    // Try all possible time fields
    const startTime = show.start_time || show.startTime || show.time;
    const endTime = show.end_time || show.endTime;
    
    if (startTime && endTime) {
      return `${formatTime(startTime)} - ${formatTime(endTime)}`;
    }
    
    if (startTime) {
      return formatTime(startTime);
    }
    
    if (endTime) {
      return formatTime(endTime);
    }
    
    // Try to extract time from description
    if (show.description) {
      const timePattern = /(\d{1,2})(:\d{2})?\s*(am|pm)\s*[-–]?\s*(\d{1,2})(:\d{2})?\s*(am|pm)/i;
      const match = show.description.match(timePattern);
      if (match) {
        return `${match[1]}${match[2] || ''}${match[3]} - ${match[4]}${match[5] || ''}${match[6]}`;
      }
    }
    
    return 'Time not specified';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Show Details</Text>
      
      <InfoRow 
        icon="calendar" 
        label="Date"
        value={formatDateRange()} 
      />
      
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
