import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  searchOrganizers,
  generateRandomCode,
  createReferralCodeForOrganizer,
  getExistingCodesForOrganizer,
} from '../../services/referralService';

// Define the type for organizer search results
type OrganizerResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const GenerateReferralCodeScreen: React.FC = () => {
  // State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrganizerResult[]>([]);
  const [selectedOrganizer, setSelectedOrganizer] = useState<OrganizerResult | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [existingCodes, setExistingCodes] = useState<string[]>([]);
  const [newlyCreatedCode, setNewlyCreatedCode] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingCode, setIsCreatingCode] = useState(false);
  const [isFetchingCodes, setIsFetchingCodes] = useState(false);

  // Colors
  const ORANGE = '#FF6A00';
  const BLUE = '#0057B8';
  const _LIGHT_GRAY = '#f0f0f0'; // prefixed with underscore to mark as intentionally unused
  const DARK_GRAY = '#666666';

  // Handle search query changes
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchOrganizers(searchQuery.trim());
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching organizers:', error);
      Alert.alert('Error', 'Failed to search organizers. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle organizer selection
  const handleSelectOrganizer = async (organizer: OrganizerResult) => {
    setSelectedOrganizer(organizer);
    setCustomCode('');
    setNewlyCreatedCode(null);
    
    // Fetch existing codes for the selected organizer
    setIsFetchingCodes(true);
    try {
      const codes = await getExistingCodesForOrganizer(organizer.id);
      setExistingCodes(codes);
    } catch (error) {
      console.error('Error fetching existing codes:', error);
      Alert.alert('Error', 'Failed to fetch existing codes for this organizer.');
      setExistingCodes([]);
    } finally {
      setIsFetchingCodes(false);
    }
  };

  // Generate a random code
  const handleGenerateRandomCode = () => {
    const randomCode = generateRandomCode();
    setCustomCode(randomCode);
  };

  // Create a referral code
  const handleCreateCode = async () => {
    if (!selectedOrganizer) {
      Alert.alert('Error', 'Please select an organizer first.');
      return;
    }

    // Normalise the custom code: send **undefined** when empty so the
    // service knows it should auto-generate a random code instead of
    // explicitly passing `null` (which can trip type checks).
    const trimmed = customCode.trim();
    const codeToUse: string | undefined = trimmed.length ? trimmed : undefined;
    
    setIsCreatingCode(true);
    try {
      const result = await createReferralCodeForOrganizer(
        selectedOrganizer.id,
        codeToUse
      );
      
      setNewlyCreatedCode(result.code);
      
      // Refresh the list of existing codes
      const codes = await getExistingCodesForOrganizer(selectedOrganizer.id);
      setExistingCodes(codes);
      
      Alert.alert('Success', `Referral code created: ${result.code}`);
    } catch (error) {
      console.error('Error creating referral code:', error);
      Alert.alert('Error', 'Failed to create referral code. Please try again.');
    } finally {
      setIsCreatingCode(false);
    }
  };

  // Copy code to clipboard
  const copyToClipboard = (code: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(code)
        .then(() => {
          Alert.alert('Success', 'Code copied to clipboard!');
        })
        .catch((err) => {
          console.error('Could not copy text: ', err);
          Alert.alert('Error', 'Failed to copy to clipboard');
        });
    } else {
      Clipboard.setString(code);
      Alert.alert('Success', 'Code copied to clipboard!');
    }
  };

  // Debounced search effect
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      }
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  // Render an organizer item in the search results
  const renderOrganizerItem = ({ item }: { item: OrganizerResult }) => {
    const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim();
    const isSelected = selectedOrganizer?.id === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.organizerItem,
          isSelected && styles.selectedOrganizerItem
        ]}
        onPress={() => handleSelectOrganizer(item)}
      >
        <View style={styles.organizerInfo}>
          <Text style={styles.organizerName}>{fullName || 'Unknown'}</Text>
          {item.email && <Text style={styles.organizerEmail}>{item.email}</Text>}
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={BLUE} />
        )}
      </TouchableOpacity>
    );
  };

  // Render an existing code item
  const renderExistingCodeItem = ({ item }: { item: string }) => {
    const isNewlyCreated = item === newlyCreatedCode;
    
    return (
      <View style={[
        styles.codeItem,
        isNewlyCreated && styles.highlightedCodeItem
      ]}>
        <Text style={styles.codeText}>{item}</Text>
        <TouchableOpacity
          style={styles.copyButton}
          onPress={() => copyToClipboard(item)}
        >
          <Ionicons name="copy-outline" size={20} color={BLUE} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Generate Referral Code</Text>
      
      {/* Search Section */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>Find Organizer</Text>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={ORANGE} style={styles.searchIcon} />
          ) : (
            <Ionicons name="search" size={24} color={DARK_GRAY} style={styles.searchIcon} />
          )}
        </View>
      </View>
      
      {/* Results Section */}
      {searchResults.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>Results</Text>
          <FlatList
            data={searchResults}
            renderItem={renderOrganizerItem}
            keyExtractor={(item) => item.id}
            style={styles.resultsList}
          />
        </View>
      )}
      
      {/* Selected Organizer Section */}
      {selectedOrganizer && (
        <View style={styles.selectedOrganizerSection}>
          <Text style={styles.sectionTitle}>Selected Organizer</Text>
          <View style={styles.selectedOrganizerInfo}>
            <Text style={styles.selectedOrganizerName}>
              {`${selectedOrganizer.first_name || ''} ${selectedOrganizer.last_name || ''}`.trim() || 'Unknown'}
            </Text>
            {selectedOrganizer.email && (
              <Text style={styles.selectedOrganizerEmail}>{selectedOrganizer.email}</Text>
            )}
          </View>
        </View>
      )}
      
      {/* Code Generation Section */}
      {selectedOrganizer && (
        <View style={styles.codeGenerationSection}>
          <Text style={styles.sectionTitle}>Generate Code</Text>
          <View style={styles.codeInputContainer}>
            <TextInput
              style={styles.codeInput}
              placeholder="Custom code (optional)"
              value={customCode}
              onChangeText={setCustomCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.generateButton}
              onPress={handleGenerateRandomCode}
            >
              <Text style={styles.generateButtonText}>Generate Random</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[
              styles.createButton,
              isCreatingCode && styles.disabledButton
            ]}
            onPress={handleCreateCode}
            disabled={isCreatingCode}
          >
            {isCreatingCode ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Code</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      
      {/* Existing Codes Section */}
      {selectedOrganizer && (
        <View style={styles.existingCodesSection}>
          <View style={styles.existingCodesTitleRow}>
            <Text style={styles.sectionTitle}>Existing Codes</Text>
            {isFetchingCodes && (
              <ActivityIndicator size="small" color={ORANGE} />
            )}
          </View>
          
          {existingCodes.length > 0 ? (
            <FlatList
              data={existingCodes}
              renderItem={renderExistingCodeItem}
              keyExtractor={(item) => item}
              style={styles.codesList}
            />
          ) : (
            <Text style={styles.noCodesText}>
              {isFetchingCodes ? 'Loading codes...' : 'No codes found for this organizer.'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#0057B8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  searchSection: {
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  searchIcon: {
    padding: 10,
  },
  resultsSection: {
    marginBottom: 20,
  },
  resultsList: {
    maxHeight: 200,
  },
  organizerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedOrganizerItem: {
    backgroundColor: '#e6f2ff',
    borderColor: '#0057B8',
  },
  organizerInfo: {
    flex: 1,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  organizerEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  selectedOrganizerSection: {
    marginBottom: 20,
  },
  selectedOrganizerInfo: {
    padding: 16,
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0057B8',
  },
  selectedOrganizerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedOrganizerEmail: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  codeGenerationSection: {
    marginBottom: 20,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  generateButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 14,
  },
  createButton: {
    backgroundColor: '#0057B8',
    paddingVertical: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  existingCodesSection: {
    flex: 1,
  },
  existingCodesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  codesList: {
    flex: 1,
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  highlightedCodeItem: {
    backgroundColor: '#e6f7e6',
    borderColor: '#00AA00',
  },
  codeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  copyButton: {
    padding: 8,
  },
  noCodesText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default GenerateReferralCodeScreen;
