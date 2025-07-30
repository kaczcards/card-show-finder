import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  _StyleSheet,
  _TouchableOpacity,
  FlatList,
  _ActivityIndicator,
  _Alert,
  LayoutAnimation,
  UIManager,
  _Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSharedWantListsForDealer } from '../services/collectionService';
// Removed unused import: import { _useAuth } from '../contexts/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SharedWantListsProps {
  showId: string;
}

interface SharedWantList {
  id: string;
  sharedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName?: string;
  };
  wantList: {
    id: string;
    content: string;
    updatedAt: string;
  } | null;
}

const SharedWantLists: React.FC<SharedWantListsProps> = ({ _showId }) => {
  const { user } = useAuth().authState;
  const [lists, setLists] = useState<SharedWantList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchWantLists = useCallback(async () => {
    if (!user) {
      setError('You must be logged in to view want lists.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await getSharedWantListsForDealer(user.id, _showId);

      if (fetchError) {
        throw fetchError;
      }

      setLists(_data || []);
    } catch (err: any) {
      console.error('Error fetching shared want lists:', _err);
      setError('Failed to load want lists. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, showId]);

  useEffect(() => {
    fetchWantLists();
  }, [fetchWantLists]);

  const handleToggleExpand = (listId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prevId => (prevId === listId ? null : listId));
  };

  const handlePrintAll = () => {
    Alert.alert(
      'Print All Want Lists',
      'This feature would compile all want lists into a single printable document. (This is a placeholder for future implementation).',
      [{ text: 'OK' }]
    );
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderListItem = ({ item }: { item: SharedWantList }) => {
    const isExpanded = expandedId === item.id;
    const userName = `${item.user.firstName} ${item.user.lastName ? item.user.lastName[0] + '.' : ''}`;

    return (
      <View style={styles.listItemContainer}>
        <TouchableOpacity style={styles.listItemHeader} onPress={() => handleToggleExpand(_item.id)}>
          <View style={styles.userInfo}>
            <Ionicons name="person-circle-outline" size={24} color="#0057B8" />
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <View style={styles.metaInfo}>
            <Text style={styles.dateText}>Shared: {formatDate(_item.sharedAt)}</Text>
            <Ionicons name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={22} color="#666" />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.wantListContent}>{_item.wantList?.content || 'No content available.'}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>Loading Shared Want Lists...</Text>
      </View>
    );
  }

  if (_error) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="red" />
        <Text style={styles.errorText}>{_error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchWantLists}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>
          <Text style={styles.summaryCount}>{lists.length}</Text> collector(s) have shared their want lists.
        </Text>
        <TouchableOpacity style={styles.printButton} onPress={handlePrintAll}>
          <Ionicons name="print-outline" size={20} color="white" />
          <Text style={styles.printButtonText}>Print All</Text>
        </TouchableOpacity>
      </View>

      {lists.length === 0 ? (
        <View style={styles.centeredContainer}>
          <Ionicons name="document-text-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No want lists have been shared for this show yet.</Text>
        </View>
      ) : (
        <FlatList
          _data={lists}
          renderItem={renderListItem}
          keyExtractor={_item => _item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#0057B8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  summaryText: {
    fontSize: 16,
    color: '#343A40',
  },
  summaryCount: {
    fontWeight: 'bold',
    color: '#0057B8',
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6A00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  printButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  list: {
    padding: 8,
  },
  listItemContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginVertical: 6,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginLeft: 10,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#6C757D',
    marginRight: 8,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  wantListContent: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 22,
    paddingTop: 12,
  },
});

export default SharedWantLists;
