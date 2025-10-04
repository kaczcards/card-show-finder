import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ShowFeaturesProps {
  features?: string[] | null;
}

const featureIcons: { [key: string]: string } = {
  'On-Site Grading': '🔍',
  'Autograph Guests': '✍️',
  'Food Vendors': '🍕',
  'Door Prizes': '🎁',
  'Auction': '🔨',
  'Card Breakers': '📦',
};

const ShowFeatures: React.FC<ShowFeaturesProps> = ({ features }) => {
  if (!features || !Array.isArray(features) || features.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>✨ Show Features</Text>
      <View style={styles.tagsContainer}>
        {features.map((feature, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>
              {featureIcons[feature] || '•'} {feature}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#FF6A00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ShowFeatures;
