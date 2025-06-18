import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

enum TabType {
  CARDS = 'cards',
  WANT_LIST = 'wantlist',
}

const CollectionScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>(TabType.CARDS);

  // Button handlers
  const handleAddCard = () => {
    Alert.alert(
      "Add Card",
      "This feature will allow you to add a card to your collection. Coming soon!",
      [{ text: "OK", onPress: () => console.log("Add Card pressed") }]
    );
  };

  const handleCreateWantList = () => {
    Alert.alert(
      "Create Want List",
      "This feature will allow you to create a want list. Coming soon!",
      [{ text: "OK", onPress: () => console.log("Create Want List pressed") }]
    );
  };

  // Render cards tab content
  const renderCardsTab = () => (
    <View style={styles.tabContent}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Cards Yet</Text>
          <Text style={styles.emptyText}>
            Add your favorite cards to your collection.
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddCard}>
            <Ionicons name="add-circle-outline" size={20} color="white" />
            <Text style={styles.addButtonText}>Add Card</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  // Render want list tab content
  const renderWantListTab = () => (
    <View style={styles.tabContent}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.emptyContainer}>
          <Ionicons name="list-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Want List Yet</Text>
          <Text style={styles.emptyText}>
            Create a list of cards you're looking to add to your collection.
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={handleCreateWantList}>
            <Ionicons name="create-outline" size={20} color="white" />
            <Text style={styles.addButtonText}>Create Want List</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Collection</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === TabType.CARDS && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab(TabType.CARDS)}
        >
          <Ionicons
            name={activeTab === TabType.CARDS ? 'images' : 'images-outline'}
            size={20}
            color={activeTab === TabType.CARDS ? '#007AFF' : '#666'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === TabType.CARDS && styles.activeTabButtonText,
            ]}
          >
            My Cards
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === TabType.WANT_LIST && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab(TabType.WANT_LIST)}
        >
          <Ionicons
            name={activeTab === TabType.WANT_LIST ? 'list' : 'list-outline'}
            size={20}
            color={activeTab === TabType.WANT_LIST ? '#007AFF' : '#666'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === TabType.WANT_LIST && styles.activeTabButtonText,
            ]}
          >
            Want List
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === TabType.CARDS ? renderCardsTab() : renderWantListTab()}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 4,
  },
  activeTabButtonText: {
    color: '#007AFF',
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
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
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default CollectionScreen;
