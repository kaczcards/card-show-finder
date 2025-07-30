import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BadgesScreen: React.FC = () => {
  // Badge tiers
  const badgeTiers = [
    {
      tier: 'bronze',
      name: 'Bronze',
      color: '#CD7F32',
      description: 'Earned by attending your first card show',
      icon: 'trophy-outline',
    },
    {
      tier: 'silver',
      name: 'Silver',
      color: '#C0C0C0',
      description: 'Earned by attending 5 card shows',
      icon: 'trophy-outline',
    },
    {
      tier: 'gold',
      name: 'Gold',
      color: '#FFD700',
      description: 'Earned by attending 25 card shows',
      icon: 'trophy-outline',
    },
    {
      tier: 'platinum',
      name: 'Platinum',
      color: '#E5E4E2',
      description: 'Earned by attending 100 card shows',
      icon: 'trophy-outline',
    },
  ];

  // Render a badge tier section
  const renderBadgeTier = (tier: {
    tier: string;
    name: string;
    color: string;
    description: string;
    icon: string;
  }) => (
    <View key={tier.tier} style={styles.tierContainer}>
      <View style={styles.tierHeader}>
        <View style={[styles.tierBadge, { backgroundColor: tier.color }]}>
          <Text style={styles.tierBadgeText}>{tier.name[0]}</Text>
        </View>
        <Text style={styles.tierName}>{tier.name} Badges</Text>
      </View>
      
      <View style={styles.tierDescription}>
        <Text style={styles.tierDescriptionText}>{tier.description}</Text>
      </View>
      
      <View style={styles.badgesRow}>
        <View style={styles.emptyBadge}>
          <Ionicons name={tier.icon as any} size={32} color="#ccc" />
          <Text style={styles.emptyBadgeText}>Not yet earned</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Badges</Text>
      </View>
      
      {/* Badge Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryCount}>0</Text>
          <Text style={styles.summaryLabel}>Total Badges</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryCount}>0</Text>
          <Text style={styles.summaryLabel}>Shows Attended</Text>
        </View>
      </View>
      
      {/* Badge List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Badge Collection</Text>
        <Text style={styles.sectionDescription}>
          Earn badges by attending card shows and interacting with the app.
        </Text>
        
        {/* Badge Tiers */}
        {badgeTiers.map(renderBadgeTier)}
        
        {/* Next Badge */}
        <View style={styles.nextBadgeContainer}>
          <Text style={styles.nextBadgeTitle}>Next Badge</Text>
          <View style={styles.nextBadgeContent}>
            <View style={[styles.nextBadgeIcon, { backgroundColor: '#CD7F32' }]}>
              <Ionicons name="trophy-outline" size={24} color="white" />
            </View>
            <View style={styles.nextBadgeInfo}>
              <Text style={styles.nextBadgeName}>First Show</Text>
              <Text style={styles.nextBadgeDescription}>
                Attend your first card show to earn this badge!
              </Text>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View style={[styles.progressBar, { width: '0%' }]} />
                </View>
                <Text style={styles.progressText}>0/1 shows attended</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 16,
  },
  tierContainer: {
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
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tierBadgeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tierDescription: {
    marginBottom: 16,
  },
  tierDescriptionText: {
    fontSize: 14,
    color: '#666',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 12,
  },
  emptyBadgeText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  nextBadgeContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  nextBadgeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  nextBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextBadgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  nextBadgeInfo: {
    flex: 1,
  },
  nextBadgeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  nextBadgeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBarContainer: {
    marginTop: 4,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
});

export default BadgesScreen;
