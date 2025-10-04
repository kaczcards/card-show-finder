import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DaySchedule {
  date: string;
  startTime: string;
  endTime: string;
  timezone?: string;
}

interface ShowDailyScheduleProps {
  dailySchedule?: DaySchedule[] | null;
}

const ShowDailySchedule: React.FC<ShowDailyScheduleProps> = ({ dailySchedule }) => {
  if (!dailySchedule || !Array.isArray(dailySchedule) || dailySchedule.length === 0) {
    return null;
  }

  // Don't show if all days have the same time (already shown in Hours section)
  const allSameTime = dailySchedule.every(day => 
    day.startTime === dailySchedule[0].startTime && 
    day.endTime === dailySchedule[0].endTime
  );

  if (allSameTime && dailySchedule.length === 1) {
    return null; // Single day with one time, already shown above
  }

  const formatTime = (timeString: string): string => {
    try {
      const date = new Date(`2000-01-01T${timeString}`);
      if (isNaN(date.getTime())) {
        return timeString;
      }
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return timeString;
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>📅 Daily Schedule</Text>
      {dailySchedule.map((day, index) => (
        <View key={index} style={styles.dayRow}>
          <View style={styles.dateColumn}>
            <Ionicons name="calendar-outline" size={16} color="#FF6A00" />
            <Text style={styles.dateText}>{formatDate(day.date)}</Text>
          </View>
          <View style={styles.timeColumn}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.timeText}>
              {formatTime(day.startTime)} - {formatTime(day.endTime)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dateColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  timeColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  timeText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#666',
  },
});

export default ShowDailySchedule;
