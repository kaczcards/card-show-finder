import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ShowCategoriesProps {
  categories?: string[] | null;
}

const categoryIcons: { [key: string]: string } = {
  'Sports Cards': '⚾',
  'Pokemon': '⚡',
  'Magic: The Gathering': '🔮',
  'Yu-Gi-Oh': '🎴',
  'Comics': '💥',
  'Memorabilia': '🏆',
  'Vintage': '📜',
};

const ShowCategories: React.FC<ShowCategoriesProps> = ({ categories }) => {
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>🃏 What's Available</Text>
      <View style={styles.tagsContainer}>
        {categories.map((category, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>
              {categoryIcons[category] || '•'} {category}
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
    backgroundColor: '#4CAF50',
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

export default ShowCategories;
