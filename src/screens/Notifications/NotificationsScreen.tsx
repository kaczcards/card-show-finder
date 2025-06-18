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

const NotificationsScreen: React.FC = () => {
  // Sample empty state - in a real implementation, this would be controlled by state
  const hasNotifications = false;

  // Render empty state when there are no notifications
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyText}>
        You don't have any notifications yet. We'll notify you about important updates,
        new badges earned, and when it's time to review shows you've attended.
      </Text>
    </View>
  );

  // Render a sample notification item (placeholder)
  const renderNotificationItem = () => (
    <TouchableOpacity style={styles.notificationItem}>
      <View style={styles.notificationIcon}>
        <Ionicons name="star-outline" size={24} color="#FFD700" />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>How was the show?</Text>
        <Text style={styles.notificationMessage}>
          Please rate and review the East Coast Card Show to help other collectors!
        </Text>
        <Text style={styles.notificationTime}>2 hours ago</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasNotifications && (
          <TouchableOpacity style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {hasNotifications ? (
          <View>
            {/* This would be a FlatList in a real implementation */}
            {renderNotificationItem()}
            {renderNotificationItem()}
            {renderNotificationItem()}
          </View>
        ) : (
          renderEmptyState()
        )}
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
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f7ff',
    borderRadius: 16,
  },
  markAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  notificationItem: {
    flexDirection: 'row',
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
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
});

export default NotificationsScreen;
