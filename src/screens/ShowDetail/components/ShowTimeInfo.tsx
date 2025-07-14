import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDateRange } from '../../../utils/dateUtils';

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

// Section header helper for consistent typography
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const ShowTimeInfo: React.FC<ShowTimeInfoProps> = ({ show }) => {
  /* ---------- Date helpers ---------- */
  const formattedDate = formatDateRange(show.start_date, show.end_date);

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return '';
    try {
      return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return timeString ?? '';
    }
  };

  const getFormattedShowHours = (show: any): string => {
    if (!show) return 'Time not specified';
    const start = show.start_time ?? show.startTime ?? show.time ?? null;
    const end = show.end_time ?? show.endTime ?? null;

    if (start && end && start !== end) return `${formatTime(start)} - ${formatTime(end)}`;
    if (start) return formatTime(start);
    if (end) return formatTime(end);

    if (show.description) {
      return extractTimeFromDescription(show.description) || 'Time not specified';
    }
    return 'Time not specified';
  };

  const extractTimeFromDescription = (description: string): string | null => {
    if (!description) return null;
    const timePattern1 = /(\d{1,2})(:\d{2})?\s*(am|pm)\s*[-–—to]\s*(\d{1,2})(:\d{2})?\s*(am|pm)/i;
    const match1 = description.match(timePattern1);
    if (match1) return `${match1[1]}${match1[2] || ''}${match1[3].toLowerCase()} - ${match1[4]}${match1[5] || ''}${match1[6].toLowerCase()}`;

    const timePattern2 = /\b(\d{1,2})\s*[-–—to]\s*(\d{1,2})(\s*[ap]m)?\b/i;
    const match2 = description.match(timePattern2);
    if (match2) {
      if (match2[3]) return `${match2[1]}${match2[3].toLowerCase()} - ${match2[2]}${match2[3].toLowerCase()}`;
      return `${match2[1]}am - ${match2[2]}pm`;
    }
    return null;
  };

  return (
    <View style={styles.timeContainer}>
      {/* Show Date Section */}
      <SectionHeader>Show Date</SectionHeader>
      <Text style={styles.timeText}>
        {formattedDate || 'Date not specified'}
      </Text>

      {/* Show Hours Section */}
      <SectionHeader>Show Hours</SectionHeader>
      <Text style={styles.timeText}>{getFormattedShowHours(show)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  timeContainer: {
    marginVertical: 10,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  timeText: {
    fontSize: 16,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});

export default ShowTimeInfo;
