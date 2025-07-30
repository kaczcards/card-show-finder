import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  TextInput,
  Switch,
  Modal,
  Platform,
} from 'react-native';
import { _SafeAreaView } from 'react-native-safe-area-context';
import { _Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { _useAuth } from '../../contexts/AuthContext';
import { 
  getDealerShows, 
  getAvailableShowsForDealer, 
  registerForShow,
  updateShowParticipation,
  cancelShowParticipation,
  DealerParticipationInput
} from '../../services/dealerService';
import { Show, UserRole } from '../../types';

// Card type options for dealers to select
const _CARD_TYPE_OPTIONS = [
  'Vintage Cards',
  'Modern Cards',
  'Baseball',
  'Basketball',
  'Football',
  'Hockey',
  'Soccer',
  'Pokémon',
  'Magic: The Gathering',
  'Yu-Gi-Oh',
  'Graded Cards',
  'Raw Cards',
  'Sealed Wax',
  'Memorabilia',
  'Comics',
  'Other'
];

// Payment method options
const _PAYMENT_METHOD_OPTIONS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'PayPal',
  'Venmo',
  'Zelle',
  'Apple Pay',
  'Google Pay',
  'Check',
  'Cryptocurrency',
  'Other'
];

// Price range options
const _PRICE_RANGE_OPTIONS = [
  { label: 'Budget-Friendly', value: 'budget' },
  { label: 'Mid-Range', value: 'mid-range' },
  { label: 'High-End', value: 'high-end' }
];

const ShowParticipationScreen: React.FC = () => {
  const { _authState } = useAuth();
  const { _user } = authState;
  const _navigation = useNavigation();
  
  // State for tab selection
  const [activeTab, setActiveTab] = useState<'myShows' | 'availableShows'>('myShows');
  
  // State for dealer shows
  const [dealerShows, setDealerShows] = useState<Array<Show & { participation: any }>>([]);
  const [availableShows, setAvailableShows] = useState<Array<Show>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for registration modal
  const [registrationModalVisible, setRegistrationModalVisible] = useState<boolean>(false);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  
  // State for edit modal
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [selectedParticipation, setSelectedParticipation] = useState<any>(null);
  
  // Form state for registration and editing
  const [formData, setFormData] = useState<DealerParticipationInput>({
    showId: '',
    cardTypes: [],
    specialty: '',
    priceRange: undefined,
    notableItems: '',
    boothLocation: '',
    paymentMethods: [],
    openToTrades: false,
    buyingCards: false
  });
  
  // Function to load dealer shows
  const _loadDealerShows = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(_true);
      setError(_null);
      
      const { data, error } = await getDealerShows(user.id);
      
      if (_error) {
        setError(_error);
        return;
      }
      
      setDealerShows(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load dealer shows');
    } finally {
      setIsLoading(_false);
      setIsRefreshing(_false);
    }
  }, [_user]);
  
  // Function to load available shows
  const _loadAvailableShows = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(_true);
      setError(_null);
      
      const { data, error } = await getAvailableShowsForDealer(user.id);
      
      if (_error) {
        setError(_error);
        return;
      }
      
      setAvailableShows(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load available shows');
    } finally {
      setIsLoading(_false);
      setIsRefreshing(_false);
    }
  }, [_user]);
  
  /* ------------------------------------------------------------------
   * Sorting Helpers
   * ------------------------------------------------------------------
   * 1. Upcoming shows   – closest to TODAY first  (ascending startDate)
   * 2. Past shows       – most recently finished (descending endDate /
   *                       startDate fallback)
   * The combined array always renders upcoming first, then past shows.
   * ------------------------------------------------------------------ */
  const _sortShowsByDate = useCallback(
    <T extends Show>(shows: Array<T>): Array<T> => {
      const _now = Date.now();

      // Partition upcoming vs past
      const _upcoming = shows.filter(
        (_s) => new Date(s.startDate).getTime() >= now
      );
      const _past = shows.filter(
        (_s) => new Date(s.startDate).getTime() < now
      );

      // Ascending for upcoming (soonest first)
      upcoming.sort(
        (_a, _b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      // Descending for past (most recent first)
      past.sort(
        (_a, _b) =>
          new Date(b.endDate || b.startDate).getTime() -
          new Date(a.endDate || a.startDate).getTime()
      );

      return [...upcoming, ...past];
    },
    []
  );

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'myShows') {
        loadDealerShows();
      } else {
        loadAvailableShows();
      }
    }, [activeTab, loadDealerShows, loadAvailableShows])
  );
  
  // Handle refresh
  const _handleRefresh = () => {
    setIsRefreshing(_true);
    if (activeTab === 'myShows') {
      loadDealerShows();
    } else {
      loadAvailableShows();
    }
  };
  
  // Handle tab change
  const _handleTabChange = (tab: 'myShows' | 'availableShows') => {
    setActiveTab(_tab);
    setIsLoading(_true);
  };
  
  // Open registration modal
  const _handleOpenRegistration = (show: Show) => {
    setSelectedShow(_show);
    setFormData({
      showId: show.id,
      cardTypes: [],
      specialty: '',
      priceRange: undefined,
      notableItems: '',
      boothLocation: '',
      paymentMethods: [],
      openToTrades: false,
      buyingCards: false
    });
    setRegistrationModalVisible(_true);
  };
  
  // Open edit modal
  const _handleOpenEdit = (show: Show & { participation?: any }) => {
    setSelectedShow(_show);
    setSelectedParticipation(show.participation);
    setFormData({
      showId: show.id,
      cardTypes: show.participation?.cardTypes || [],
      specialty: show.participation?.specialty || '',
      priceRange: show.participation?.priceRange,
      notableItems: show.participation?.notableItems || '',
      boothLocation: show.participation?.boothLocation || '',
      paymentMethods: show.participation?.paymentMethods || [],
      openToTrades: show.participation?.openToTrades || false,
      buyingCards: show.participation?.buyingCards || false
    });
    setEditModalVisible(_true);
  };
  
  // Handle form field changes
  const _handleFormChange = (field: keyof DealerParticipationInput, value: any) => {
    setFormData(prev => ({ ...prev, [_field]: value }));
  };
  
  // Toggle card type selection
  const _toggleCardType = (type: string) => {
    setFormData(prev => {
      const _cardTypes = [...(prev.cardTypes || [])];
      const _index = cardTypes.indexOf(type);
      
      if (index > -1) {
        cardTypes.splice(index, _1);
      } else {
        cardTypes.push(type);
      }
      
      return { ...prev, cardTypes };
    });
  };
  
  // Toggle payment method selection
  const _togglePaymentMethod = (method: string) => {
    setFormData(prev => {
      const _paymentMethods = [...(prev.paymentMethods || [])];
      const _index = paymentMethods.indexOf(method);
      
      if (index > -1) {
        paymentMethods.splice(index, _1);
      } else {
        paymentMethods.push(method);
      }
      
      return { ...prev, paymentMethods };
    });
  };
  
  // Submit registration
  const _handleRegister = async () => {
    if (!user || !selectedShow) return;
    
    try {
      // Basic validation - only if we're using the fields in the database
      // If the migration hasn't been run, we'll skip this validation
      if (formData.cardTypes && formData.cardTypes.length === 0) {
        Alert.alert('Error', 'Please select at least one card type');
        return;
      }
      
      if (formData.paymentMethods && formData.paymentMethods.length === 0) {
        Alert.alert('Error', 'Please select at least one payment method');
        return;
      }
      
      const { data, error } = await registerForShow(user.id, _formData);
      
      if (_error) {
        Alert.alert('Registration Failed', _error);
        return;
      }
      
      Alert.alert('Success', 'You have successfully registered for this show');
      setRegistrationModalVisible(_false);
      loadDealerShows();
      loadAvailableShows();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to register for show');
    }
  };
  
  // Submit edit
  const _handleUpdateParticipation = async () => {
    if (!user || !selectedShow || !selectedParticipation) return;
    
    try {
      // Basic validation
      if (formData.cardTypes && formData.cardTypes.length === 0) {
        Alert.alert('Error', 'Please select at least one card type');
        return;
      }
      
      if (formData.paymentMethods && formData.paymentMethods.length === 0) {
        Alert.alert('Error', 'Please select at least one payment method');
        return;
      }
      
      const { data, error } = await updateShowParticipation(
        user.id,
        selectedParticipation.id,
        formData
      );
      
      if (_error) {
        Alert.alert('Update Failed', _error);
        return;
      }
      
      Alert.alert('Success', 'Your booth information has been updated');
      setEditModalVisible(_false);
      loadDealerShows();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update booth information');
    }
  };
  
  // Handle cancellation
  const _handleCancelParticipation = async (participationId: string) => {
    if (!user) return;
    
    Alert.alert(
      'Cancel Participation',
      'Are you sure you want to cancel your participation in this show?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              const { success, error } = await cancelShowParticipation(user.id, _participationId);
              
              if (_error) {
                Alert.alert('Cancellation Failed', _error);
                return;
              }
              
              Alert.alert('Success', 'Your participation has been cancelled');
              loadDealerShows();
              loadAvailableShows();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel participation');
            }
          }
        }
      ]
    );
  };
  
  // Format date range for display
  const _formatDateRange = (startDate: Date | string, endDate: Date | string) => {
    const _start = new Date(_startDate);
    const _end = new Date(_endDate);
    
    const _startMonth = start.toLocaleString('default', { month: 'short' });
    const _endMonth = end.toLocaleString('default', { month: 'short' });
    
    if (startMonth === endMonth && start.getDate() === end.getDate()) {
      // Same day
      return `${_startMonth} ${start.getDate()}, ${start.getFullYear()}`;
    } else if (startMonth === endMonth) {
      // Same month
      return `${_startMonth} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
    } else {
      // Different months
      return `${_startMonth} ${start.getDate()} - ${_endMonth} ${end.getDate()}, ${start.getFullYear()}`;
    }
  };
  
  // Check if user is a dealer
  /**
   * Users allowed to access this screen:
   *   • Regular dealers
   *   • MVP dealers
   *   • Show organizers (who may also sell as dealers)
   */
  const _isDealer =
    user &&
    (user.role === UserRole.DEALER ||
      user.role === UserRole.MVP_DEALER ||
      user.role === UserRole.SHOW_ORGANIZER);
  
  if (!isDealer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notDealerContainer}>
          <Ionicons name="alert-circle-outline" size={_64} color="#FF6A00" />
          <Text style={styles.notDealerTitle}>Dealer Access Only</Text>
          <Text style={styles.notDealerText}>
            This section is only available to users with a dealer subscription.
          </Text>
          <TouchableOpacity
            style={styles.subscriptionButton}
            onPress={() => navigation.navigate('SubscriptionScreen' as never)}
          >
            <Text style={styles.subscriptionButtonText}>Manage Subscription</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render a show item in the list
  const _renderShowItem = ({ _item }: { item: Show & { participation?: any } }) => {
    const _isRegistered = activeTab === 'myShows';
    
    // Determine status for badge display - default to 'registered' if undefined
    const _participationStatus = item.participation?.status || 'registered';
    
    return (
      <View style={styles.showCard}>
        <View style={styles.showHeader}>
          <Text style={styles.showTitle}>{item.title}</Text>
          <View style={styles.showDateContainer}>
            <Ionicons name="calendar-outline" size={_16} color="#666" />
            <Text style={styles.showDate}>
              {formatDateRange(item.startDate, item.endDate)}
            </Text>
          </View>
        </View>
        
        <View style={styles.showInfo}>
          <View style={styles.showInfoRow}>
            <Ionicons name="location-outline" size={_16} color="#666" />
            <Text style={styles.showLocation}>{item.location}</Text>
          </View>
          <Text style={styles.showAddress}>{item.address}</Text>
        </View>
        
        {isRegistered && item.participation && (
          <View style={styles.participationSection}>
            <View style={styles.participationHeader}>
              <Text style={styles.participationTitle}>Your Booth Information</Text>
              <View style={[
                styles.statusBadge,
                participationStatus === 'confirmed' ? styles.confirmedBadge : 
                participationStatus === 'cancelled' ? styles.cancelledBadge : 
                styles.registeredBadge
              ]}>
                <Text style={styles.statusText}>
                  {participationStatus.charAt(0).toUpperCase() + participationStatus.slice(1)}
                </Text>
              </View>
            </View>
            
            {item.participation.boothLocation && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Booth Location:</Text>
                <Text style={styles.infoValue}>{item.participation.boothLocation}</Text>
              </View>
            )}
            
            {item.participation.cardTypes && Array.isArray(item.participation.cardTypes) && item.participation.cardTypes.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Card Types:</Text>
                <Text style={styles.infoValue}>{item.participation.cardTypes.join(', ')}</Text>
              </View>
            )}
            
            {item.participation.specialty && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Specialty:</Text>
                <Text style={styles.infoValue}>{item.participation.specialty}</Text>
              </View>
            )}
            
            {item.participation.priceRange && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Price Range:</Text>
                <Text style={styles.infoValue}>
                  {PRICE_RANGE_OPTIONS.find(opt => opt.value === item.participation.priceRange)?.label || item.participation.priceRange}
                </Text>
              </View>
            )}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => handleOpenEdit(_item)}
                disabled={participationStatus === 'cancelled'}
              >
                <Ionicons name="create-outline" size={_16} color="white" />
                <Text style={styles.buttonText}>Edit Info</Text>
              </TouchableOpacity>
              
              {participationStatus !== 'cancelled' && (
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => handleCancelParticipation(item.participation.id)}
                >
                  <Ionicons name="close-circle-outline" size={_16} color="white" />
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        
        {!isRegistered && (
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={() => handleOpenRegistration(_item)}
          >
            <Ionicons name="add-circle-outline" size={_18} color="white" />
            <Text style={styles.registerButtonText}>Register as Dealer</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Tab selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'myShows' && styles.activeTab]}
          onPress={() => handleTabChange('myShows')}
        >
          <Text style={[styles.tabText, activeTab === 'myShows' && styles.activeTabText]}>
            My Shows
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'availableShows' && styles.activeTab]}
          onPress={() => handleTabChange('availableShows')}
        >
          <Text style={[styles.tabText, activeTab === 'availableShows' && styles.activeTabText]}>
            Available Shows
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Content area */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.loadingText}>Loading shows...</Text>
        </View>
      ) : (
        <>
          {activeTab === 'myShows' && (
            <FlatList
              data={sortShowsByDate(dealerShows)}
              renderItem={_renderShowItem}
              keyExtractor={(_item) => item.id}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl refreshing={_isRefreshing} onRefresh={_handleRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={_64} color="#ccc" />
                  <Text style={styles.emptyText}>
                    You haven't registered for any shows yet.
                  </Text>
                  <TouchableOpacity 
                    style={styles.emptyButton}
                    onPress={() => setActiveTab('availableShows')}
                  >
                    <Text style={styles.emptyButtonText}>Find Shows</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
          
          {activeTab === 'availableShows' && (
            <FlatList
              data={sortShowsByDate(availableShows)}
              renderItem={_renderShowItem}
              keyExtractor={(_item) => item.id}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl refreshing={_isRefreshing} onRefresh={_handleRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={_64} color="#ccc" />
                  <Text style={styles.emptyText}>
                    No upcoming shows available for registration.
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}
      
      {/* Registration Modal */}
      <Modal
        animationType="slide"
        transparent={_true}
        visible={_registrationModalVisible}
        onRequestClose={() => setRegistrationModalVisible(_false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register as Dealer</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setRegistrationModalVisible(_false)}
              >
                <Ionicons name="close" size={_24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedShow && (
              <View style={styles.selectedShowInfo}>
                <Text style={styles.selectedShowTitle}>{selectedShow.title}</Text>
                <Text style={styles.selectedShowDate}>
                  {formatDateRange(selectedShow.startDate, selectedShow.endDate)}
                </Text>
                <Text style={styles.selectedShowLocation}>{selectedShow.location}</Text>
              </View>
            )}
            
            <ScrollView style={styles.formContainer}>
              {/* MVP upgrade banner - show ONLY to regular dealers */}
              {user?.role === UserRole.DEALER && (
                <View style={styles.infoMessageContainer}>
                  <Text style={styles.infoMessageText}>
                    By registering for this show, your name will appear on the list of participating dealers for this show.
                    Upgrade to an MVP Dealer subscription to unlock your full booth information
                    being searchable and accessible to all attendees and collectors!
                  </Text>
                  <TouchableOpacity
                    style={styles.infoUpgradeButton}
                    onPress={() => {
                      setRegistrationModalVisible(_false); // Close current modal
                      navigation.navigate('SubscriptionScreen' as never); // Navigate to subscription
                    }}
                  >
                    <Text style={styles.infoUpgradeButtonText}>Learn More about MVP</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.formSectionTitle}>Booth Information</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Booth Location (if known)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.boothLocation}
                  onChangeText={(_text) => handleFormChange('boothLocation', _text)}
                  placeholder="e.g., Table 12, Corner booth, etc."
                />
              </View>
              
              <Text style={styles.formSectionTitle}>Inventory Information</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Card Types You Sell *</Text>
                <View style={styles.checkboxGroup}>
                  {CARD_TYPE_OPTIONS.map((_type) => (
                    <TouchableOpacity
                      key={_type}
                      style={[
                        styles.checkbox,
                        formData.cardTypes?.includes(type) && styles.checkboxSelected
                      ]}
                      onPress={() => toggleCardType(_type)}
                    >
                      <Text style={[
                        styles.checkboxText,
                        formData.cardTypes?.includes(type) && styles.checkboxTextSelected
                      ]}>
                        {_type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Specialty/Niche</Text>
                <TextInput
                  style={styles.input}
                  value={formData.specialty}
                  onChangeText={(_text) => handleFormChange('specialty', _text)}
                  placeholder="e.g., Pre-war baseball, Basketball rookies, etc."
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Price Range</Text>
                <View style={styles.radioGroup}>
                  {PRICE_RANGE_OPTIONS.map((_option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.radioButton,
                        formData.priceRange === option.value && styles.radioSelected
                      ]}
                      onPress={() => handleFormChange('priceRange', option.value)}
                    >
                      <View style={styles.radioCircle}>
                        {formData.priceRange === option.value && (
                          <View style={styles.radioInner} />
                        )}
                      </View>
                      <Text style={styles.radioText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notable Items</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notableItems}
                  onChangeText={(_text) => handleFormChange('notableItems', _text)}
                  placeholder="Describe any hot or hard-to-find items you'll have"
                  multiline={_true}
                  numberOfLines={_3}
                />
              </View>
              
              <Text style={styles.formSectionTitle}>Payment & Trading</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Methods Accepted *</Text>
                <View style={styles.checkboxGroup}>
                  {PAYMENT_METHOD_OPTIONS.map((_method) => (
                    <TouchableOpacity
                      key={_method}
                      style={[
                        styles.checkbox,
                        formData.paymentMethods?.includes(method) && styles.checkboxSelected
                      ]}
                      onPress={() => togglePaymentMethod(_method)}
                    >
                      <Text style={[
                        styles.checkboxText,
                        formData.paymentMethods?.includes(method) && styles.checkboxTextSelected
                      ]}>
                        {_method}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.switchGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Open to Trades</Text>
                  <Switch
                    value={formData.openToTrades}
                    onValueChange={(_value) => handleFormChange('openToTrades', _value)}
                    trackColor={{ false: '#d3d3d3', true: '#0057B8' }}
                    thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                  />
                </View>
                
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Buying Cards</Text>
                  <Switch
                    value={formData.buyingCards}
                    onValueChange={(_value) => handleFormChange('buyingCards', _value)}
                    trackColor={{ false: '#d3d3d3', true: '#0057B8' }}
                    thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                  />
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.submitButton}
                onPress={_handleRegister}
              >
                <Text style={styles.submitButtonText}>Register for Show</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent={_true}
        visible={_editModalVisible}
        onRequestClose={() => setEditModalVisible(_false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Booth Information</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setEditModalVisible(_false)}
              >
                <Ionicons name="close" size={_24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedShow && (
              <View style={styles.selectedShowInfo}>
                <Text style={styles.selectedShowTitle}>{selectedShow.title}</Text>
                <Text style={styles.selectedShowDate}>
                  {formatDateRange(selectedShow.startDate, selectedShow.endDate)}
                </Text>
                <Text style={styles.selectedShowLocation}>{selectedShow.location}</Text>
              </View>
            )}
            
            <ScrollView style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>Booth Information</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Booth Location (if known)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.boothLocation}
                  onChangeText={(_text) => handleFormChange('boothLocation', _text)}
                  placeholder="e.g., Table 12, Corner booth, etc."
                />
              </View>
              
              <Text style={styles.formSectionTitle}>Inventory Information</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Card Types You Sell *</Text>
                <View style={styles.checkboxGroup}>
                  {CARD_TYPE_OPTIONS.map((_type) => (
                    <TouchableOpacity
                      key={_type}
                      style={[
                        styles.checkbox,
                        formData.cardTypes?.includes(type) && styles.checkboxSelected
                      ]}
                      onPress={() => toggleCardType(_type)}
                    >
                      <Text style={[
                        styles.checkboxText,
                        formData.cardTypes?.includes(type) && styles.checkboxTextSelected
                      ]}>
                        {_type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Specialty/Niche</Text>
                <TextInput
                  style={styles.input}
                  value={formData.specialty}
                  onChangeText={(_text) => handleFormChange('specialty', _text)}
                  placeholder="e.g., Pre-war baseball, Basketball rookies, etc."
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Price Range</Text>
                <View style={styles.radioGroup}>
                  {PRICE_RANGE_OPTIONS.map((_option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.radioButton,
                        formData.priceRange === option.value && styles.radioSelected
                      ]}
                      onPress={() => handleFormChange('priceRange', option.value)}
                    >
                      <View style={styles.radioCircle}>
                        {formData.priceRange === option.value && (
                          <View style={styles.radioInner} />
                        )}
                      </View>
                      <Text style={styles.radioText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notable Items</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notableItems}
                  onChangeText={(_text) => handleFormChange('notableItems', _text)}
                  placeholder="Describe any hot or hard-to-find items you'll have"
                  multiline={_true}
                  numberOfLines={_3}
                />
              </View>
              
              <Text style={styles.formSectionTitle}>Payment & Trading</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Methods Accepted *</Text>
                <View style={styles.checkboxGroup}>
                  {PAYMENT_METHOD_OPTIONS.map((_method) => (
                    <TouchableOpacity
                      key={_method}
                      style={[
                        styles.checkbox,
                        formData.paymentMethods?.includes(method) && styles.checkboxSelected
                      ]}
                      onPress={() => togglePaymentMethod(_method)}
                    >
                      <Text style={[
                        styles.checkboxText,
                        formData.paymentMethods?.includes(method) && styles.checkboxTextSelected
                      ]}>
                        {_method}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.switchGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Open to Trades</Text>
                  <Switch
                    value={formData.openToTrades}
                    onValueChange={(_value) => handleFormChange('openToTrades', _value)}
                    trackColor={{ false: '#d3d3d3', true: '#0057B8' }}
                    thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                  />
                </View>
                
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Buying Cards</Text>
                  <Switch
                    value={formData.buyingCards}
                    onValueChange={(_value) => handleFormChange('buyingCards', _value)}
                    trackColor={{ false: '#d3d3d3', true: '#0057B8' }}
                    thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                  />
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.submitButton}
                onPress={_handleUpdateParticipation}
              >
                <Text style={styles.submitButtonText}>Update Information</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  notDealerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notDealerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  notDealerText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  subscriptionButton: {
    backgroundColor: '#0057B8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  subscriptionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#FF6A00',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FF6A00',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#0057B8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  showCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  showHeader: {
    marginBottom: 12,
  },
  showTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  showDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showDate: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  showInfo: {
    marginBottom: 16,
  },
  showInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  showLocation: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
    fontWeight: '500',
  },
  showAddress: {
    fontSize: 14,
    color: '#666',
    marginLeft: 22,
  },
  participationSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 8,
  },
  participationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  participationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  registeredBadge: {
    backgroundColor: '#e6f2ff',
  },
  confirmedBadge: {
    backgroundColor: '#e6ffe6',
  },
  cancelledBadge: {
    backgroundColor: '#ffe6e6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  editButton: {
    backgroundColor: '#0057B8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  registerButton: {
    backgroundColor: '#FF6A00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, _0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  selectedShowInfo: {
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedShowTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  selectedShowDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  selectedShowLocation: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    padding: 16,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  checkboxGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checkbox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 4,
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#0057B8',
    borderColor: '#0057B8',
  },
  checkboxText: {
    fontSize: 14,
    color: '#666',
  },
  checkboxTextSelected: {
    color: 'white',
  },
  radioGroup: {
    marginBottom: 8,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0057B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioSelected: {},
  radioInner: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#0057B8',
  },
  radioText: {
    fontSize: 16,
    color: '#333',
  },
  switchGroup: {
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#FF6A00',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // New styles for the informational message in the modal
  infoMessageContainer: {
    backgroundColor: '#e6f0ff', // Light blue background
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#0057B8',
  },
  infoMessageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  infoUpgradeButton: {
    backgroundColor: '#0057B8',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    alignSelf: 'center', // Center the button
  },
  infoUpgradeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ShowParticipationScreen;