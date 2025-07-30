import React from 'react';
import { View, Text, _StyleSheet } from 'react-native';

interface ShowDescriptionProps {
  description?: string;
}

// Section header helper for consistent typography
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const ShowDescription: React.FC<ShowDescriptionProps> = ({ description }) => {
  return (
    <View style={styles.descriptionContainer}>
      <SectionHeader>About this show</SectionHeader>
      <Text style={styles.description}>
        {description || 'No description available'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  descriptionContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
});

export default ShowDescription;
