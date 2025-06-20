import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Show, Review } from '../../types';
import ReviewForm from '../../components/ReviewForm';
import ReviewsList from '../../components/ReviewsList';

/**
 * MyShowsScreen – replaces the old Notifications screen.
 * Displays Upcoming shows the user plans to attend, and Past shows the user attended.
 * Past shows allow leaving a review (opens ReviewForm modal).
 */
const MyShowsScreen: React.FC = () => {
  /* ------------------------------------------------------------------
   * Placeholder data – replace with real data via context / API later
   * ------------------------------------------------------------------ */
  const dummyUpcoming: Show[] = [
    {
      id: '1',
      title: 'Indy Card Expo',
      location: 'Fairgrounds Hall',
      address: '123 Main St, Indianapolis, IN',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      entryFee: 5,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const dummyPast: Show[] = [
    {
      id: '2',
      title: 'East Coast Card Show',
      location: 'Boston Convention Ctr.',
      address: '1 Seaport Ln, Boston, MA',
      startDate: new Date(Date.now() - 864e5 * 5).toISOString(),
      endDate: new Date(Date.now() - 864e5 * 4).toISOString(),
      entryFee: 0,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  /* ------------------------------------------------------------------ */
  const [currentTab, setCurrentTab] = useState<'upcoming' | 'past'>('upcoming');
  const [upcomingShows, setUpcomingShows] = useState<Show[]>(dummyUpcoming);
  const [pastShows] = useState<Show[]>(dummyPast);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [reviewFormVisible, setReviewFormVisible] = useState(false);

  /* -------------------------  Helpers  ----------------------------- */
  const renderEmptyState = (message: string, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Shows Found</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const removeUpcoming = (id: string) =>
    setUpcomingShows((prev) => prev.filter((s) => s.id !== id));

  const openReviewForm = (show: Show) => {
    setSelectedShow(show);
    setReviewFormVisible(true);
  };

  const submitReview = (rating: number, comment: string) => {
    if (selectedShow) {
      const newReview: Review = {
        id: Date.now().toString(),
        showId: selectedShow.id,
        userId: 'currentUser',
        userName: 'You',
        rating,
        comment,
        date: new Date().toISOString(),
      };
      setReviews((prev) => [...prev, newReview]);
      setReviewFormVisible(false);
      setSelectedShow(null);
    }
  };

  // Format date with timezone adjustment to ensure correct date display
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    // Shift by the local TZ offset so the calendar day matches the stored value
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    return utcDate.toLocaleDateString();
  };

  /* --------------------  FlatList Item Renderers  ------------------- */
  const renderUpcomingItem = ({ item }: { item: Show }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <TouchableOpacity onPress={() => removeUpcoming(item.id)}>
          <Ionicons name="remove-circle-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>
      <Text style={styles.cardSubtitle}>
        {formatDate(item.startDate)} • {item.location}
      </Text>
    </View>
  );

  const renderPastItem = ({ item }: { item: Show }) => {
    const alreadyReviewed = reviews.some((r) => r.showId === item.id);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {!alreadyReviewed && (
            <TouchableOpacity onPress={() => openReviewForm(item)}>
              <Ionicons name="create-outline" size={22} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardSubtitle}>
          {formatDate(item.startDate)} • {item.location}
        </Text>
        {alreadyReviewed && (
          <ReviewsList
            reviews={reviews.filter((r) => r.showId === item.id)}
            emptyMessage="No reviews yet."
          />
        )}
      </View>
    );
  };

  /* -----------------------------  UI  ------------------------------- */
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Shows</Text>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segmentButton, currentTab === 'upcoming' && styles.segmentSelected]}
          onPress={() => setCurrentTab('upcoming')}
        >
          <Text
            style={[
              styles.segmentText,
              currentTab === 'upcoming' && styles.segmentTextSelected,
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, currentTab === 'past' && styles.segmentSelected]}
          onPress={() => setCurrentTab('past')}
        >
          <Text
            style={[
              styles.segmentText,
              currentTab === 'past' && styles.segmentTextSelected,
            ]}
          >
            Past Shows
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <FlatList
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        data={currentTab === 'upcoming' ? upcomingShows : pastShows}
        keyExtractor={(item) => item.id}
        renderItem={currentTab === 'upcoming' ? renderUpcomingItem : renderPastItem}
        ListEmptyComponent={
          currentTab === 'upcoming'
            ? renderEmptyState(
                "You haven't added any upcoming shows to your list.",
                'calendar-outline'
              )
            : renderEmptyState(
                'No past shows yet. Shows you attend will appear here.',
                'time-outline'
              )
        }
      />

      {reviewFormVisible && selectedShow && (
        <ReviewForm
          showId={selectedShow.id}
          onSubmit={submitReview}
          onCancel={() => {
            setReviewFormVisible(false);
            setSelectedShow(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    margin: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  segmentTextSelected: {
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 400,
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

export default MyShowsScreen;
