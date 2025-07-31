import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Review } from '../types';

interface ReviewsListProps {
  reviews: Review[];
  emptyMessage: string;
}

const ReviewsList: React.FC<ReviewsListProps> = ({ reviews, emptyMessage }) => {
  /* ------------------------------------------------------------------
   * Helper: Render star icons for a given rating (1–5)
   * ------------------------------------------------------------------ */
  const renderStarRating = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={rating >= i ? 'star' : 'star-outline'}
          size={16}
          color="#FFD700" // Gold color for stars
          style={styles.starIcon}
        />
      );
    }
    return <View style={styles.starRatingContainer}>{stars}</View>;
  };

  /* ------------------------------------------------------------------
   * Render a single review row
   * ------------------------------------------------------------------ */
  const renderReviewItem = ({ item }: { item: Review }) => {
    /* ---------------------------------------------------------------
     * Fix timezone-offset issue so the calendar day shown matches
     * the value stored in the DB (assumed UTC).
     * ------------------------------------------------------------- */
    const date        = new Date(item.date);
    const utcDate     = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    const reviewDate  = utcDate.toLocaleDateString('en-US', {
      year : 'numeric',
      month: 'long',
      day  : 'numeric',
    });

    return (
      <View style={styles.reviewItem}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewerName}>{item.userName}</Text>
          {renderStarRating(item.rating)}
        </View>
        <Text style={styles.reviewComment}>{item.comment}</Text>
        <Text style={styles.reviewDate}>{reviewDate}</Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubble-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Reviews Yet</Text>
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    </View>
  );

  return (
    <FlatList
      data={reviews}
      keyExtractor={(item) => item.id}
      renderItem={renderReviewItem}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={reviews.length === 0 ? styles.listEmptyContent : styles.listContent}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reviewItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  starRatingContainer: {
    flexDirection: 'row',
  },
  starIcon: {
    marginHorizontal: 1,
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default ReviewsList;
