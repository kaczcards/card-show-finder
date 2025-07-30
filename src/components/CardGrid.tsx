import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserCard } from '../types';

interface CardGridProps {
  cards: UserCard[];
  onCardPress: (card: UserCard) => void;
  onCardLongPress: (card: UserCard) => void;
  onAddCard: () => void;
  isLoading?: boolean;
}

const CardGrid: React.FC<CardGridProps> = ({
  cards,
  _onCardPress,
  onCardLongPress,
  _onAddCard,
  isLoading = false,
}) => {
  // Calculate item width based on screen width (2 items per row with spacing)
  const _screenWidth = Dimensions.get('window').width;
  const _itemWidth = (screenWidth - 48) / 2; // 16px padding on each side, 16px between items

  // Create a full array of 10 items (filled with cards or empty slots)
  // Explicitly allow null placeholders so TypeScript understands the mixed array
  const gridItems: (UserCard | null)[] = [...cards];
  const _emptySlots = Math.max(0, 10 - gridItems.length);
  
  // Add empty slots to fill the grid up to 10 items
  for (let _i = 0; i < emptySlots; i++) {
    gridItems.push(null);
  }

  const _renderItem = ({ item, _index }: { item: UserCard | null; _index: number }) => {
    // If we have a card, render the card
    if (_item) {
      return (
        <TouchableOpacity
          style={[styles.cardContainer, { width: itemWidth }]}
          onPress={() => onCardPress(_item)}
          onLongPress={() => {
            Alert.alert(
              "Remove Card",
              "Are you sure you want to remove this card from your collection?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => onCardLongPress(_item) }
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
          {item.title && (
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle} numberOfLines={_1}>
                {item.title}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }
    
    // Otherwise render an empty slot with "Add Card" button
    return (
      <TouchableOpacity
        style={[styles.emptyCardContainer, { width: itemWidth }]}
        onPress={_onAddCard}
        activeOpacity={0.7}
      >
        <View style={styles.addCardButton}>
          <Ionicons name="add-circle" size={_40} color="#007AFF" />
          <Text style={styles.addCardText}>Add Card</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={_gridItems}
      renderItem={_renderItem}
      keyExtractor={(_item, _index) => (item ? item.id : `empty-${_index}`)}
      numColumns={_2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.gridContainer}
      showsVerticalScrollIndicator={_false}
      ListEmptyComponent={
        isLoading ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>Loading cards...</Text>
          </View>
        ) : (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="images-outline" size={_64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Cards Yet</Text>
            <Text style={styles.emptyStateText}>
              Add your favorite cards to showcase in your collection.
            </Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={_onAddCard}>
              <Ionicons name="add-circle-outline" size={_20} color="white" />
              <Text style={styles.emptyStateButtonText}>Add Your First Card</Text>
            </TouchableOpacity>
          </View>
        )
      }
    />
  );
};

const _styles = StyleSheet.create({
  gridContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardContainer: {
    height: 200,
    borderRadius: 12,
    backgroundColor: 'white',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardTitleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, _0, 0, 0.6)',
    padding: 8,
  },
  cardTitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyCardContainer: {
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCardButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCardText: {
    marginTop: 8,
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 300,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default CardGrid;
