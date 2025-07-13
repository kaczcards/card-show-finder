import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SectionList,
  SectionListData
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { showSeriesService } from '../../services/showSeriesService';
import { supabase } from '../../supabase';
import OrganizerShowsList from '../../components/OrganizerShowsList';
import UnclaimedShowsList from '../../components/UnclaimedShowsList';

// Define the tab names
type TabName = 'shows' | 'claim' | 'recurring' | 'reviews' | 'broadcast';

// Dashboard metrics interface
interface DashboardMetrics {
  totalShows: number;
  upcomingShows: number;
  totalReviews: number;
  averageRating: number | null;
  preShowBroadcastsRemaining: number;
  postShowBroadcastsRemaining: number;
}

// Section types for our SectionList
type SectionType = 'header' | 'metrics' | 'tabs' | 'content';

// Interface for our section data
interface DashboardSection {
  type: SectionType;
  data: Array<any>;
}

const OrganizerDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { authState } = useAuth();
  const user = authState?.user;
  
  // State variables
  const [activeTab, setActiveTab] = useState<TabName>('shows');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalShows: 0,
    upcomingShows: 0,
    totalReviews: 0,
    averageRating: null,
    preShowBroadcastsRemaining: 2, // Default values
    postShowBroadcastsRemaining: 1  // Default values
  });
  
  // Check if user is a show organizer
  const isShowOrganizer = user?.role === UserRole.SHOW_ORGANIZER;
  
  // Fetch dashboard metrics
  const fetchDashboardMetrics = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Get series owned by this organizer
      const mySeries = await showSeriesService.getAllShowSeries({ 
        organizerId: user.id 
      });
      
      // Get all shows in these series
      let allShows = [];
      let upcomingCount = 0;
      const now = new Date();
      
      for (const series of mySeries) {
        const showsInSeries = await showSeriesService.getShowsInSeries(series.id);
        allShows = [...allShows, ...showsInSeries];
        
        // Count upcoming shows (start date is in the future)
        upcomingCount += showsInSeries.filter(show => 
          new Date(show.startDate) > now
        ).length;
      }
      
      // Get reviews for all series
      let totalReviews = 0;
      let ratingSum = 0;
      
      for (const series of mySeries) {
        if (series.reviewCount) {
          totalReviews += series.reviewCount;
        }
        
        if (series.averageRating && series.reviewCount) {
          ratingSum += series.averageRating * series.reviewCount;
        }
      }
      
      // Calculate overall average rating
      const averageRating = totalReviews > 0 ? ratingSum / totalReviews : null;
      
      // Get broadcast quotas from user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('pre_show_broadcasts_remaining, post_show_broadcasts_remaining')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }
      
      // Update metrics
      setMetrics({
        totalShows: allShows.length,
        upcomingShows: upcomingCount,
        totalReviews,
        averageRating,
        preShowBroadcastsRemaining: profile?.pre_show_broadcasts_remaining ?? 2,
        postShowBroadcastsRemaining: profile?.post_show_broadcasts_remaining ?? 1
      });
      
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
      setError('Failed to load dashboard metrics. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    if (isShowOrganizer) {
      fetchDashboardMetrics();
    } else {
      setIsLoading(false);
    }
  }, [isShowOrganizer, user?.id]);
  
  // Handle refresh
  const refreshShows = () => {
    setIsRefreshing(true);
    fetchDashboardMetrics();
  };

  // Refresh metrics every time the screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      if (isShowOrganizer) {
        fetchDashboardMetrics();
      }
    }, [isShowOrganizer, user?.id])
  );
  
  // Render metrics card
  const renderMetricsCard = () => {
    return (
      <View style={styles.metricsCard}>
        <Text style={styles.metricsTitle}>Dashboard Overview</Text>
        
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{metrics.totalShows}</Text>
            <Text style={styles.metricLabel}>Total Shows</Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{metrics.upcomingShows}</Text>
            <Text style={styles.metricLabel}>Upcoming</Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {metrics.averageRating !== null ? metrics.averageRating.toFixed(1) : '-'}
            </Text>
            <Text style={styles.metricLabel}>Avg Rating</Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{metrics.totalReviews}</Text>
            <Text style={styles.metricLabel}>Reviews</Text>
          </View>
        </View>
        
        <View style={styles.quotaContainer}>
          <View style={styles.quotaItem}>
            <Ionicons name="megaphone-outline" size={16} color="#0057B8" style={styles.quotaIcon} />
            <Text style={styles.quotaText}>
              Pre-show broadcasts: <Text style={styles.quotaValue}>{metrics.preShowBroadcastsRemaining}</Text> remaining
            </Text>
          </View>
          
          <View style={styles.quotaItem}>
            <Ionicons name="chatbubble-outline" size={16} color="#0057B8" style={styles.quotaIcon} />
            <Text style={styles.quotaText}>
              Post-show broadcasts: <Text style={styles.quotaValue}>{metrics.postShowBroadcastsRemaining}</Text> remaining
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Render tabs navigation
  const renderTabsNavigation = () => {
    return (
      <View style={styles.tabsContainer}>
        {(['shows', 'claim', 'recurring', 'reviews', 'broadcast'] as TabName[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'shows' && 'My Shows'}
              {tab === 'claim' && 'Unclaimed'}
              {tab === 'recurring' && 'Recurring'}
              {tab === 'reviews' && 'Reviews'}
              {tab === 'broadcast' && 'Broadcast'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'shows':
        return (
          <OrganizerShowsList
            organizerId={user?.id || ''}
            onRefresh={refreshShows}
            isRefreshing={isRefreshing}
          />
        );
        
      case 'claim':
        return (
          <UnclaimedShowsList
            organizerId={user?.id || ''}
            onRefresh={refreshShows}
            isRefreshing={isRefreshing}
            onClaimSuccess={refreshShows}
          />
        );
        
      case 'recurring':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Recurring Shows</Text>
            <Text style={styles.sectionDescription}>
              Manage your recurring show series and create new occurrences.
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• View all your recurring show series</Text>
              <Text style={styles.featureItem}>• Add new dates to existing series</Text>
              <Text style={styles.featureItem}>• Edit or cancel specific occurrences</Text>
              <Text style={styles.featureItem}>• View aggregate reviews across all shows in a series</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Alert.alert('Coming Soon', 'This feature is under development.')}
            >
              <Ionicons name="calendar" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Manage Recurring Shows</Text>
            </TouchableOpacity>
          </View>
        );
        
      case 'reviews':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <Text style={styles.sectionDescription}>
              This tab will allow you to respond to reviews of your shows. You'll be able to:
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• View all reviews for your shows</Text>
              <Text style={styles.featureItem}>• Respond to reviews with official comments</Text>
              <Text style={styles.featureItem}>• Track your average rating over time</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Alert.alert('Coming Soon', 'This feature is under development.')}
            >
              <Ionicons name="star" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>View All Reviews</Text>
            </TouchableOpacity>
          </View>
        );
        
      case 'broadcast':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Broadcast Messages</Text>
            <Text style={styles.sectionDescription}>
              Send pre-show and post-show messages to attendees of your events.
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• Send announcements before your show</Text>
              <Text style={styles.featureItem}>• Follow up with attendees after the show</Text>
              <Text style={styles.featureItem}>• View message history and engagement</Text>
              <Text style={styles.featureItem}>• Target specific groups (attendees, dealers, etc.)</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Alert.alert('Coming Soon', 'This feature is under development.')}
            >
              <Ionicons name="megaphone" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Compose Broadcast</Text>
            </TouchableOpacity>
          </View>
        );
        
      default:
        return null;
    }
  };

  // Generate sections for SectionList
  const sections = useMemo(() => {
    if (!isShowOrganizer && !isLoading) {
      return [];
    }

    const dashboardSections: DashboardSection[] = [
      {
        type: 'header',
        data: [{ key: 'header' }]
      },
      {
        type: 'metrics',
        data: [{ key: 'metrics' }]
      },
      {
        type: 'tabs',
        data: [{ key: 'tabs' }]
      },
      {
        type: 'content',
        data: [{ key: 'content' }]
      }
    ];

    return dashboardSections;
  }, [isShowOrganizer, isLoading, activeTab]);

  // Render section items
  const renderSectionItem = ({ item, section }: { item: any, section: SectionListData<any> }) => {
    const sectionType = section.type;

    switch (sectionType) {
      case 'header':
        return (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Organizer Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              Manage your shows, reviews, and messages
            </Text>
          </View>
        );

      case 'metrics':
        if (isLoading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6A00" />
              <Text style={styles.loadingText}>Loading dashboard...</Text>
            </View>
          );
        } else if (error) {
          return (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={40} color="#FF6A00" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchDashboardMetrics}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          );
        } else {
          return renderMetricsCard();
        }

      case 'tabs':
        return renderTabsNavigation();

      case 'content':
        if (!isLoading) {
          return (
            <View style={styles.contentContainer}>
              {renderTabContent()}
            </View>
          );
        }
        return null;

      default:
        return null;
    }
  };

  // If user is not a show organizer, show upgrade prompt
  if (!isShowOrganizer && !isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.upgradeContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#FF6A00" />
          <Text style={styles.upgradeTitle}>Show Organizer Access Required</Text>
          <Text style={styles.upgradeText}>
            This dashboard is only available to users with a Show Organizer account.
            Upgrade your account to access tools for managing your card shows.
          </Text>
          <TouchableOpacity 
            style={styles.upgradeButton}
            onPress={() => Alert.alert('Upgrade Account', 'Contact support to upgrade your account to Show Organizer.')}
          >
            <Text style={styles.upgradeButtonText}>Upgrade Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        renderItem={renderSectionItem}
        renderSectionHeader={() => null}
        keyExtractor={(item) => item.key}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshShows} />
        }
        contentContainerStyle={styles.sectionListContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  sectionListContent: {
    paddingBottom: 20,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: '#0057B8',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 4,
  },
  metricsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333333',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricItem: {
    width: '48%',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0057B8',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  quotaContainer: {
    marginTop: 8,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 12,
  },
  quotaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaIcon: {
    marginRight: 8,
  },
  quotaText: {
    fontSize: 14,
    color: '#333333',
  },
  quotaValue: {
    fontWeight: 'bold',
    color: '#0057B8',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  activeTab: {
    backgroundColor: '#0057B8',
  },
  tabText: {
    fontSize: 14,
    color: '#666666',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  tabContent: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 16,
  },
  featureList: {
    marginBottom: 20,
  },
  featureItem: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 24,
  },
  actionButton: {
    backgroundColor: '#FF6A00',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
  },
  loadingText: {
    marginTop: 12,
    color: '#666666',
    fontSize: 14,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
  },
  errorText: {
    marginTop: 12,
    marginBottom: 16,
    color: '#FF6A00',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0057B8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  upgradeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333333',
    textAlign: 'center',
  },
  upgradeText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#FF6A00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default OrganizerDashboardScreen;
