import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

// Tab type definition
type TabName = 'shows' | 'claim' | 'recurring' | 'reviews' | 'broadcast';

const OrganizerDashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabName>('shows');

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'shows':
        return (
          <ScrollView style={styles.tabContent}>
            <Text style={styles.sectionTitle}>My Shows</Text>
            <Text style={styles.description}>
              This tab will display all shows you have claimed ownership of. You'll be able to:
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• View all your claimed shows</Text>
              <Text style={styles.featureItem}>• Edit show details</Text>
              <Text style={styles.featureItem}>• Add extra information like parking details, table counts, etc.</Text>
              <Text style={styles.featureItem}>• Monitor show attendance and reviews</Text>
            </View>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Show listings will appear here</Text>
              <Ionicons name="calendar" size={48} color="#ccc" />
            </View>
          </ScrollView>
        );
        
      case 'claim':
        return (
          <ScrollView style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Claim Shows</Text>
            <Text style={styles.description}>
              This tab will allow you to claim ownership of shows. Once claimed, you can:
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• Respond to reviews</Text>
              <Text style={styles.featureItem}>• Send broadcast messages to attendees and dealers</Text>
              <Text style={styles.featureItem}>• Manage show details and extra information</Text>
              <Text style={styles.featureItem}>• Create recurring series</Text>
            </View>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Show claim form will appear here</Text>
              <Ionicons name="flag" size={48} color="#ccc" />
            </View>
          </ScrollView>
        );
        
      case 'recurring':
        return (
          <ScrollView style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Recurring Shows</Text>
            <Text style={styles.description}>
              This tab will help you manage recurring show series. You'll be able to:
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• Mark a show as a series parent</Text>
              <Text style={styles.featureItem}>• Add child shows to the series</Text>
              <Text style={styles.featureItem}>• Remove shows from a series</Text>
              <Text style={styles.featureItem}>• View aggregate reviews across all shows in a series</Text>
            </View>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Series management tools will appear here</Text>
              <Ionicons name="repeat" size={48} color="#ccc" />
            </View>
          </ScrollView>
        );
        
      case 'reviews':
        return (
          <ScrollView style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Manage Reviews</Text>
            <Text style={styles.description}>
              This tab will allow you to respond to reviews of your shows. You'll be able to:
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• View all reviews for your shows</Text>
              <Text style={styles.featureItem}>• Respond to reviews with official comments</Text>
              <Text style={styles.featureItem}>• Edit or remove your responses</Text>
              <Text style={styles.featureItem}>• Track review metrics and trends</Text>
            </View>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Reviews will appear here</Text>
              <Ionicons name="star" size={48} color="#ccc" />
            </View>
          </ScrollView>
        );
        
      case 'broadcast':
        return (
          <ScrollView style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Broadcast Messages</Text>
            <Text style={styles.description}>
              This tab will let you send broadcast messages to show attendees and dealers. You'll be able to:
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• Send messages to all attendees, dealers, or both</Text>
              <Text style={styles.featureItem}>• View your broadcast history</Text>
              <Text style={styles.featureItem}>• Track your monthly broadcast quota</Text>
              <Text style={styles.featureItem}>• Target messages to specific shows</Text>
            </View>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Broadcast tools will appear here</Text>
              <Ionicons name="megaphone" size={48} color="#ccc" />
            </View>
            <View style={styles.quotaCard}>
              <Text style={styles.quotaTitle}>Monthly Broadcast Quota</Text>
              <Text style={styles.quotaText}>0/10 messages used</Text>
              <Text style={styles.quotaNote}>Quota resets on the 1st of each month</Text>
            </View>
          </ScrollView>
        );
        
      default:
        return null;
    }
  };

  // Render tabs
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(['shows', 'claim', 'recurring', 'reviews', 'broadcast'] as TabName[]).map(tab => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.activeTab]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Check if user is a show organizer
  if (!user || user.role !== 'SHOW_ORGANIZER') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Show Organizer Dashboard</Text>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF6A00" />
          <Text style={styles.errorText}>
            You need to have a SHOW_ORGANIZER role to access this dashboard.
          </Text>
          <Text style={styles.errorSubtext}>
            Please upgrade your account to access organizer features.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Show Organizer Dashboard</Text>
      <Text style={styles.subtitle}>Phase 1 - Coming Soon</Text>
      
      {renderTabs()}
      
      <View style={styles.contentContainer}>
        {renderTabContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    color: '#FF6A00',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF6A00',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
  },
  activeTabText: {
    color: '#FF6A00',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  featureList: {
    marginBottom: 24,
  },
  featureItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    paddingLeft: 8,
  },
  placeholderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    height: 150,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 12,
  },
  quotaCard: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  quotaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#0057B8',
  },
  quotaText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  quotaNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
  },
});

export default OrganizerDashboardScreen;
