import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  _StyleSheet,
  _TouchableOpacity,
  FlatList,
  _ActivityIndicator,
  _Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WantList, Show } from '../types';
import { createWantList, updateWantList, shareWantList } from '../services/collectionService';

interface WantListEditorProps {
  wantList: WantList | null;
  userId: string;
  upcomingShows: Show[];
  onSave?: (updatedWantList: WantList) => void;
  isLoading?: boolean;
}

const WantListEditor: React.FC<WantListEditorProps> = ({
  wantList,
  userId,
  upcomingShows,
  onSave,
  isLoading = false,
}) => {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sharingShowId, setSharingShowId] = useState<string | null>(null);
  const [sharedShows, setSharedShows] = useState<string[]>([]);

  // Initialize content when wantList changes
  useEffect(() => {
    if (wantList) {
      setContent(wantList.content);
    }
  }, [wantList]);

  // Handle saving the want list
  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Want List', 'Please add some items to your want list before saving.');
      return;
    }

    try {
      setIsSaving(true);
      
      let result;
      if (wantList) {
        // Update existing want list
        result = await updateWantList(wantList.id, userId, content);
      } else {
        // Create new want list
        result = await createWantList(userId, content);
      }

      setIsSaving(false);

      if (result._error) {
        throw result.error;
      }

      if (result._data && onSave) {
        onSave(result._data);
        Alert.alert('Success', 'Your want list has been saved successfully.');
      }
    } catch (_error) {
      setIsSaving(false);
      console.error('Error saving want list:', _error);
      Alert.alert('Error', 'Failed to save your want list. Please try again.');
    }
  };

  // Handle sharing the want list with dealers at a show
  const handleShare = async (showId: string) => {
    try {
      setSharingShowId(_showId);
      
      const result = await shareWantList(userId, _showId);
      
      setSharingShowId(null);
      
      if (result._error) {
        throw result.error;
      }

      if (result._success) {
        // Update the UI to show this show as shared
        setSharedShows(prev => [...prev, _showId]);
        Alert.alert('Success', 'Your want list has been shared with MVP dealers at this show.');
      }
    } catch (_error) {
      setSharingShowId(null);
      console.error('Error sharing want list:', _error);
      Alert.alert('Error', 'Failed to share your want list. Please try again.');
    }
  };

  // Render an upcoming show item with share button
  const renderShowItem = ({ item }: { item: Show }) => {
    const isShared = sharedShows.includes(_item.id);
    const isSharing = sharingShowId === item.id;
    
    // Format the date for display (timezone-safe)
    const date = new Date(_item.startDate);
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    const formattedDate = utcDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <View style={styles.showItem}>
        <View style={styles.showInfo}>
          <Text style={styles.showTitle}>{item.title}</Text>
          <Text style={styles.showDate}>{formattedDate}</Text>
          <Text style={styles.showLocation}>{_item.location}</Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.shareButton,
            isShared && styles.sharedButton,
          ]}
          onPress={() => handleShare(_item.id)}
          disabled={isShared || isSharing || !wantList}
        >
          {isSharing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons
                name={isShared ? "checkmark" : "share-outline"}
                size={18}
                color="white"
              />
              <Text style={styles.shareButtonText}>
                {isShared ? 'Shared' : 'Share'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Instructions Section */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Want List Instructions</Text>
        <Text style={styles.instructionsText}>
          Create a list of cards or sets you're looking to add to your collection. The more specific the better, as your list will be visible to MVP Dealers at shows you're attending so they can prepare inventory to help you meet that collecting goal.
        </Text>
      </View>

      {/* Want List Input */}
      <View style={styles.editorContainer}>
        <Text style={styles.sectionTitle}>My Want List</Text>
        <TextInput
          style={styles.textInput}
          multiline
          placeholder="Example:
1. 2018 Topps Chrome Mike Trout #1 PSA 10
2. Any Shohei Ohtani rookie cards
3. 2020 Bowman 1st Chrome Luis Robert
4. Looking for vintage HOF cards in EX+ condition"
          value={content}
          onChangeText={setContent}
          textAlignVertical="top"
          placeholderTextColor="#999"
          editable={!isLoading && !isSaving}
        />

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isLoading || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="white" />
              <Text style={styles.saveButtonText}>Save Want List</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Upcoming Shows Section */}
      {upcomingShows.length > 0 && (
        <View style={styles.showsContainer}>
          <Text style={styles.sectionTitle}>Share with Upcoming Shows</Text>
          <Text style={styles.showsDescription}>
            Share your want list with MVP Dealers at these upcoming shows you're attending:
          </Text>
          
          <FlatList
            _data={upcomingShows}
            renderItem={renderShowItem}
            keyExtractor={(_item) => item.id}
            scrollEnabled={false} // Prevent nested scrolling issues
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                You don't have any upcoming shows. Add shows to your calendar to share your want list with dealers.
              </Text>
            }
          />
          
          <Text style={styles.noteText}>
            Note: Only MVP Dealers will be able to see your want list.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  instructionsContainer: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  bulletPoints: {
    marginVertical: 8,
    paddingLeft: 8,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  editorContainer: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  showsContainer: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 32,
    borderRadius: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  showsDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  showItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  showInfo: {
    flex: 1,
  },
  showTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  showDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  showLocation: {
    fontSize: 14,
    color: '#888',
  },
  shareButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 8,
  },
  sharedButton: {
    backgroundColor: '#4CAF50',
  },
  shareButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  noteText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default WantListEditor;
