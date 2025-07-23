import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  // Accept any valid Ionicons glyph as well as arbitrary strings for flexibility
  iconName?: keyof typeof Ionicons.glyphMap | string;
  iconSize?: number;
  iconColor?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No conversations yet',
  subtitle = 'When you message a dealer or show organizer, your conversations will appear here',
  iconName = 'chatbubble-ellipses-outline',
  iconSize = 64,
  iconColor = '#C7C7CC'
}) => {
  return (
    <View style={styles.centerContainer}>
      {/* Type assertion keeps TS happy while still allowing dynamic strings */}
      <Ionicons name={iconName as any} size={iconSize} color={iconColor} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>
        {subtitle}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
    color: '#333333',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default EmptyState;
