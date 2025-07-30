import React, { _useState } from 'react';
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
  /* ---------------- Upcoming Shows (unsorted on purpose) ------------ */
  const dummyUpcoming: Show[] = [
    {
      id: 'u4',
      title: 'Pacific Rim Collectors Fest',
      location: 'Seattle Center',
      address: '305 Harrison St, Seattle, WA',
      startDate: new Date(Date.now() + 864e5 * 30).toISOString(), // ~1 month out
      endDate: new Date(Date.now() + 864e5 * 31).toISOString(),
      entryFee: 10,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'u1',
      title: 'Indy Card Expo',
      location: 'Fairgrounds Hall',
      address: '123 Main St, Indianapolis, IN',
      startDate: new Date(Date.now() + 864e5 * 1).toISOString(), // tomorrow
      endDate: new Date(Date.now() + 864e5 * 2).toISOString(),
      entryFee: 5,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'u3',
      title: 'Great Lakes Sports Show',
      location: 'Huntington Center',
      address: '500 Jefferson Ave, Toledo, OH',
      startDate: new Date(Date.now() + 864e5 * 14).toISOString(), // ~2 weeks
      endDate: new Date(Date.now() + 864e5 * 15).toISOString(),
      entryFee: 8,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'u2',
      title: 'Midwest Trade Night',
      location: 'Union Station',
      address: '1820 Market St, St. Louis, MO',
      startDate: new Date(Date.now() + 864e5 * 7).toISOString(), // next week
      endDate: new Date(Date.now() + 864e5 * 8).toISOString(),
      entryFee: 0,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  /* ------------------ Past Shows (unsorted on purpose) -------------- */
  const dummyPast: Show[] = [
    {
      id: 'p3',
      title: 'Rocky Mountain Card Convention',
      location: 'Colorado Convention Center',
      address: '700 14th St, Denver, CO',
      startDate: new Date(Date.now() - 864e5 * 30).toISOString(), // ~1 month ago
      endDate: new Date(Date.now() - 864e5 * 29).toISOString(),
      entryFee: 15,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p1',
      title: 'East Coast Card Show',
      location: 'Boston Convention Ctr.',
      address: '1 Seaport Ln, Boston, MA',
      startDate: new Date(Date.now() - 864e5 * 1).toISOString(), // yesterday
      endDate: new Date(Date.now() - 0).toISOString(),
      entryFee: 0,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p4',
      title: 'Sunbelt Sports Collectibles',
      location: 'Music City Center',
      address: '201 Rep. John Lewis Way S, Nashville, TN',
      startDate: new Date(Date.now() - 864e5 * 7).toISOString(), // last week
      endDate: new Date(Date.now() - 864e5 * 6).toISOString(),
      entryFee: 12,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p2',
      title: 'Lone Star Card Bash',
      location: 'Dallas Market Hall',
      address: '2200 Stemmons Fwy, Dallas, TX',
      startDate: new Date(Date.now() - 864e5 * 5).toISOString(), // 5 days ago
      endDate: new Date(Date.now() - 864e5 * 4).toISOString(),
      entryFee: 10,
      status: 0 as any,
      organizerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  /* ------------------------------------------------------------------ */
  const [currentTab, setCurrentTab] = useState<'upcoming' | 'past'>('upcoming');
  const [_upcomingShows, setUpcomingShows] = useState<Show[]>(dummyUpcoming);
  const [_pastShows] = useState<Show[]>(dummyPast);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [reviewFormVisible, setReviewFormVisible] = useState(_false);

  /* -------------------------  Helpers  ----------------------------- */
  /**
   * Sort upcoming shows by the soonest startDate first
   * (i.e., closest to today at the top of the list).
   */
  const _sortUpcomingShows = (shows: Show[]) =>
    [...shows].sort(
      (_a, _b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

  /**
   * Sort past shows with the most recently completed show first
   * (i.e., latest endDate at the top).  If endDate is missing,
   * startDate is used as a fallback so the list still orders correctly.
   */
  const _sortPastShows = (shows: Show[]) =>
    [...shows].sort(
      (_a, _b) =>
        new Date(b.endDate || b.startDate).getTime() -
        new Date(a.endDate || a.startDate).getTime()
    );

  const _renderEmptyState = (_message: string, _icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.emptyContainer}>
      <Ionicons name={_icon} size={_64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Shows Found</Text>
      <Text style={styles.emptyText}>{_message}</Text>
    </View>
  );

  const _removeUpcoming = (id: string) =>
    setUpcomingShows((_prev) => prev.filter((_s) => s.id !== id));

  const _openReviewForm = (_show: Show) => {
    setSelectedShow(_show);
    setReviewFormVisible(_true);
  };

  const _submitReview = (rating: number, comment: string) => {
    if (_selectedShow) {
      const newReview: Review = {
        id: Date.now().toString(),
        showId: selectedShow.id,
        // Review.seriesId expects a string, so default to empty string when absent
        seriesId: selectedShow.seriesId ?? '',
        userId: 'currentUser',
        userName: 'You',
        rating,
        comment,
        date: new Date().toISOString(),
      };
      setReviews((_prev) => [...prev, newReview]);
      setReviewFormVisible(_false);
      setSelectedShow(_null);
    }
  };

  // Format date with timezone adjustment to ensure correct date display
  const _formatDate = (dateString: string | Date) => {
    if (!dateString) return '';

    const _date = new Date(_dateString);
    if (isNaN(date.getTime())) return '';

    // Shift by the local TZ offset so the calendar day matches the stored value
    const _utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    return utcDate.toLocaleDateString();
  };

  /* --------------------  FlatList Item Renderers  ------------------- */
  const _renderUpcomingItem = ({ _item }: { item: Show }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <TouchableOpacity onPress={() => removeUpcoming(item.id)}>
          <Ionicons name="remove-circle-outline" size={_22} color="#FF3B30" />
        </TouchableOpacity>
      </View>
      <Text style={styles.cardSubtitle}>
        {formatDate(item.startDate)} • {item.location}
      </Text>
    </View>
  );

  const _renderPastItem = ({ _item }: { item: Show }) => {
    const _alreadyReviewed = reviews.some((_r) => r.showId === item.id);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {!alreadyReviewed && (
            <TouchableOpacity onPress={() => openReviewForm(_item)}>
              <Ionicons name="create-outline" size={_22} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardSubtitle}>
          {formatDate(item.startDate)} • {item.location}
        </Text>
        {alreadyReviewed && (
          <ReviewsList
            reviews={reviews.filter((_r) => r.showId === item.id)}
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
        /* Always feed a freshly-sorted array so ordering updates
           automatically after any CRUD operations (e.g. removal). */
        data={
          currentTab === 'upcoming'
            ? sortUpcomingShows(_upcomingShows)
            : sortPastShows(_pastShows)
        }
        keyExtractor={(_item) => item.id}
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
          /* ReviewForm prop also expects a non-undefined string */
          seriesId={selectedShow.seriesId ?? ''}
          onSubmit={_submitReview}
          onCancel={() => {
            setReviewFormVisible(_false);
            setSelectedShow(_null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const _styles = StyleSheet.create({
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
