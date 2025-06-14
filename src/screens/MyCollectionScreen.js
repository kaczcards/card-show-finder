
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import * as ImagePicker from 'expo-image-picker';
// New service utility (implemented separately) that handles Firebase work
import {
  uploadCardPhoto,
  saveCardToCollection,
  saveListItem,
} from '../services/collectionService';

const MAX_PHOTOS = 10; // hard cap

const MyCollectionScreen = () => {
  const navigation = useNavigation();
  const { currentUser, userProfile } = useUser();
  const [activeTab, setActiveTab] = useState('showcase');
  const [loading, setLoading] = useState(false);
  const [showcaseCards, setShowcaseCards] = useState([]);
  const [wantList, setWantList] = useState([]);
  const [forSale, setForSale] = useState([]);
  const [newItemText, setNewItemText] = useState('');

  // Mock data - in real app, this would come from Firebase
  useEffect(() => {
    setShowcaseCards([
      { id: 1, title: '1986 Fleer Michael Jordan RC', image: 'https://via.placeholder.com/150', condition: 'PSA 9' },
      { id: 2, title: '1989 Upper Deck Ken Griffey Jr RC', image: 'https://via.placeholder.com/150', condition: 'BGS 9.5' }
    ]);
    setWantList([
      { id: 1, title: '1952 Topps Mickey Mantle', notes: 'Looking for any condition' },
      { id: 2, title: '2009 Bowman Chrome Mike Trout', notes: 'Rookie card preferred' }
    ]);
    setForSale([
      { id: 1, title: '2020 Topps Chrome Ronald Acuna Jr', price: '$45', condition: 'Mint' }
    ]);
  }, []);

  const pickImage = async () => {
    try {
      if (showcaseCards.length >= MAX_PHOTOS) {
        Alert.alert(
          'Photo Limit Reached',
          `You can only add up to ${MAX_PHOTOS} photos to your showcase.`
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled) {
        setLoading(true);

        // Upload to Firebase Storage
        const uploadRes = await uploadCardPhoto(
          currentUser.uid,
          result.assets[0].uri
        );

        if (uploadRes.error) {
          throw new Error(uploadRes.error);
        }

        // Persist metadata to Firestore (collection)
        const cardMeta = {
          id: Date.now(),
          title: 'Untitled Card',
          image: uploadRes.url,
          condition: '',
        };

        await saveCardToCollection(currentUser.uid, cardMeta);

        // Update local UI
        setShowcaseCards((prev) => [...prev, cardMeta]);
        Alert.alert('Success', 'Card added to your showcase!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setLoading(false);
    }
  };

  const addToList = (listType) => {
    if (!newItemText.trim()) return;
    
    const newItem = {
      id: Date.now(),
      title: newItemText,
      notes: listType === 'want' ? 'Added from mobile' : '',
      price: listType === 'sale' ? '$0' : undefined,
      condition: listType === 'sale' ? 'Mint' : undefined
    };

    if (listType === 'want') {
      setWantList([...wantList, newItem]);
    } else if (listType === 'sale') {
      setForSale([...forSale, newItem]);
    }

    // Persist to backend
    saveListItem(currentUser.uid, listType, newItem).catch((e) =>
      console.log('Failed to persist list item', e)
    );
    
    setNewItemText('');
  };

  if (!currentUser) {
    return (
      <View style={styles.loginContainer}>
        <Ionicons name="albums-outline" size={80} color="#3498db" />
        <Text style={styles.loginTitle}>Sign in to access your collection</Text>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'showcase' && styles.activeTab]}
          onPress={() => setActiveTab('showcase')}
        >
          <Text style={[styles.tabText, activeTab === 'showcase' && styles.activeTabText]}>
            Showcase
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'want' && styles.activeTab]}
          onPress={() => setActiveTab('want')}
        >
          <Text style={[styles.tabText, activeTab === 'want' && styles.activeTabText]}>
            Want List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'sale' && styles.activeTab]}
          onPress={() => setActiveTab('sale')}
        >
          <Text style={[styles.tabText, activeTab === 'sale' && styles.activeTabText]}>
            For Sale
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'showcase' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Card Showcase</Text>
              <TouchableOpacity
                style={[
                  styles.addButton,
                  showcaseCards.length >= MAX_PHOTOS && styles.disabledAddButton,
                ]}
                onPress={pickImage}
                disabled={showcaseCards.length >= MAX_PHOTOS || loading}
              >
                {loading ? (
                  <ActivityIndicator size={20} color="#3498db" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={24} color="#3498db" />
                    <Text style={styles.addButtonText}>Add Card</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.photoCount}>
              {showcaseCards.length}/{MAX_PHOTOS} photos
            </Text>
            
            <View style={styles.cardGrid}>
              {showcaseCards.map((card) => (
                <View key={card.id} style={styles.showcaseCard}>
                  <Image source={{ uri: card.image }} style={styles.cardImage} />
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardCondition}>{card.condition}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'want' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Cards I'm Looking For</Text>
              <Text style={styles.sectionSubtitle}>
                Dealers at shows you're attending can see this list
              </Text>
            </View>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Add card to want list..."
                value={newItemText}
                onChangeText={setNewItemText}
              />
              <TouchableOpacity 
                style={styles.addItemButton}
                onPress={() => addToList('want')}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {wantList.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{item.title}</Text>
                  <Text style={styles.listItemNotes}>{item.notes}</Text>
                </View>
                <Ionicons name="search-outline" size={24} color="#6c757d" />
              </View>
            ))}
          </View>
        )}

        {activeTab === 'sale' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Cards For Sale</Text>
              <Text style={styles.sectionSubtitle}>
                Dealers at shows you're attending can see these items
              </Text>
            </View>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Add card for sale..."
                value={newItemText}
                onChangeText={setNewItemText}
              />
              <TouchableOpacity 
                style={styles.addItemButton}
                onPress={() => addToList('sale')}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {forSale.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{item.title}</Text>
                  <View style={styles.saleDetails}>
                    <Text style={styles.price}>{item.price}</Text>
                    <Text style={styles.condition}>{item.condition}</Text>
                  </View>
                </View>
                <Ionicons name="pricetag-outline" size={24} color="#2ecc71" />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 30,
    textAlign: 'center',
    color: '#212529',
  },
  loginButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: 16,
    color: '#6c757d',
  },
  activeTabText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  addButtonText: {
    color: '#3498db',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  showcaseCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#212529',
  },
  cardCondition: {
    fontSize: 11,
    color: '#6c757d',
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginRight: 10,
  },
  addItemButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  listItemNotes: {
    fontSize: 14,
    color: '#6c757d',
  },
  saleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginRight: 10,
  },
  condition: {
    fontSize: 14,
    color: '#6c757d',
  },
});

export default MyCollectionScreen;
