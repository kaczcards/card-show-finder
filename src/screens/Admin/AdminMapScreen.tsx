import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert as _Alert, ScrollView, SafeAreaView, Dimensions,  } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Use fallback map components that gracefully degrade when the native
// react-native-maps module isn't available (e.g. running in Expo Go).
import { Region, Marker as _Marker } from '../../components/MapFallback';
import { useNavigation } from '@react-navigation/native';
import { Show, Coordinates } from '../../types';
import { checkAdminStatus, getAllShowsForValidation, updateShowCoordinates } from '../../services/adminService';
import MapShowCluster from '../../components/MapShowCluster';

/**
 * Admin Map Screen for validating and correcting show coordinates
 * 
 * This screen is only accessible to users with admin privileges.
 * It displays all shows on a map and allows admins to update incorrect coordinates.
 */
const AdminMapScreen: React.FC = () => {
  // State variables
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [newCoordinates, setNewCoordinates] = useState<Coordinates>({ latitude: 0, longitude: 0 });
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 39.8283,  // Center of US
    longitude: -98.5795,
    latitudeDelta: 60,
    longitudeDelta: 60,
  });
  const [updateSuccess, setUpdateSuccess] = useState<boolean | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  // References
  const mapRef = useRef<any>(null);
  const navigation = useNavigation();

  // Check admin status on component mount
  useEffect(() => {
    const verifyAdminStatus = async () => {
      setIsLoading(true);
      const { isAdmin: adminStatus, error: adminError } = await checkAdminStatus();
      
      if (adminError) {
        setError(adminError);
        setIsAdmin(false);
      } else {
        setIsAdmin(adminStatus);
        
        if (adminStatus) {
          await fetchAllShows();
        } else {
          setError('Unauthorized: Admin privileges required');
        }
      }
      setIsLoading(false);
    };
    
    verifyAdminStatus();
  }, []);

  // Fetch all shows from the database
  const fetchAllShows = async () => {
    const { shows: allShows, error: showsError } = await getAllShowsForValidation();
    
    if (showsError) {
      setError(showsError);
    } else {
      setShows(allShows);
      
      // Adjust map region if shows are available
      if (allShows.length > 0) {
        // Find the center of all shows
        const validCoordinates = allShows
          .filter(show => show.coordinates && 
            typeof show.coordinates.latitude === 'number' && 
            typeof show.coordinates.longitude === 'number')
          .map(show => show.coordinates as Coordinates);
        
        if (validCoordinates.length > 0) {
          const avgLat = validCoordinates.reduce((sum, coord) => sum + coord.latitude, 0) / validCoordinates.length;
          const avgLng = validCoordinates.reduce((sum, coord) => sum + coord.longitude, 0) / validCoordinates.length;
          
          setMapRegion({
            latitude: avgLat,
            longitude: avgLng,
            latitudeDelta: 30,  // Zoom out to see more shows
            longitudeDelta: 30,
          });
        }
      }
    }
  };

  // Handle show selection
  const handleShowPress = (showId: string) => {
    const show = shows.find(s => s.id === showId);
    if (show) {
      setSelectedShow(show);
      
      // If the show has coordinates, center the map on it
      if (show.coordinates) {
        const region = {
          latitude: show.coordinates.latitude,
          longitude: show.coordinates.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };
        
        setMapRegion(region);
        
        if (mapRef.current && mapRef.current.animateToRegion) {
          mapRef.current.animateToRegion(region, 500);
        }
      }
    }
  };

  // Open edit modal for selected show
  const openEditModal = () => {
    if (selectedShow && selectedShow.coordinates) {
      setNewCoordinates({
        latitude: selectedShow.coordinates.latitude,
        longitude: selectedShow.coordinates.longitude,
      });
      setEditModalVisible(true);
    } else if (selectedShow) {
      // If show has no coordinates, initialize with default values
      setNewCoordinates({ latitude: 0, longitude: 0 });
      setEditModalVisible(true);
    }
  };

  // Update show coordinates
  const handleUpdateCoordinates = async () => {
    if (!selectedShow) return;
    
    setIsLoading(true);
    const { success: _success, error: updateError } = await updateShowCoordinates(
      selectedShow.id,
      newCoordinates
    );
    
    if (updateError) {
      setUpdateSuccess(false);
      setUpdateMessage(`Failed to update coordinates: ${updateError}`);
    } else {
      setUpdateSuccess(true);
      setUpdateMessage('Coordinates updated successfully');
      
      // Update the local state to reflect the change
      setShows(prevShows => 
        prevShows.map(show => 
          show.id === selectedShow.id 
            ? { ...show, coordinates: newCoordinates } 
            : show
        )
      );
      
      // Update selected show with new coordinates
      setSelectedShow(prev => 
        prev ? { ...prev, coordinates: newCoordinates } : null
      );
    }
    
    setEditModalVisible(false);
    setIsLoading(false);
    
    // Clear the success/error message after 3 seconds
    setTimeout(() => {
      setUpdateSuccess(null);
      setUpdateMessage(null);
    }, 3000);
  };

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Render unauthorized state
  if (!isAdmin) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="lock-closed" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Unauthorized Access</Text>
        <Text style={styles.errorMessage}>
          {error || 'You do not have permission to access this page. Please contact an administrator.'}
        </Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="alert-circle" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchAllShows}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButtonHeader} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin: Coordinate Validation</Text>
      </View>

      {/* Status message */}
      {updateMessage && (
        <View style={[
          styles.statusMessage, 
          updateSuccess ? styles.successMessage : styles.errorMessageBanner
        ]}>
          <Text style={styles.statusMessageText}>{updateMessage}</Text>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapShowCluster
          ref={mapRef}
          shows={shows}
          onCalloutPress={handleShowPress}
          region={mapRegion}
          showsUserLocation={false}
          loadingEnabled={true}
          showsCompass={true}
          showsScale={true}
          provider="google"
          onRegionChangeComplete={setMapRegion}
        />
      </View>

      {/* Show details panel */}
      {selectedShow && (
        <View style={styles.detailsPanel}>
          <ScrollView style={styles.detailsScroll}>
            <Text style={styles.detailsTitle}>{selectedShow.title}</Text>
            <Text style={styles.detailsAddress}>{selectedShow.address}</Text>
            
            <View style={styles.coordinatesContainer}>
              <Text style={styles.coordinatesLabel}>Current Coordinates:</Text>
              <Text style={styles.coordinatesValue}>
                {selectedShow.coordinates 
                  ? `${selectedShow.coordinates.latitude.toFixed(6)}, ${selectedShow.coordinates.longitude.toFixed(6)}`
                  : 'No coordinates available'}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.editButton}
              onPress={openEditModal}
            >
              <Text style={styles.editButtonText}>Edit Coordinates</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Edit coordinates modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Coordinates</Text>
            <Text style={styles.modalSubtitle}>{selectedShow?.title}</Text>
            
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Latitude:</Text>
              <TextInput
                style={styles.input}
                value={newCoordinates.latitude.toString()}
                onChangeText={(text) => {
                  const value = parseFloat(text);
                  if (!isNaN(value)) {
                    setNewCoordinates(prev => ({ ...prev, latitude: value }));
                  }
                }}
                keyboardType="numeric"
                placeholder="Latitude (e.g., 40.7128)"
              />
            </View>
            
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Longitude:</Text>
              <TextInput
                style={styles.input}
                value={newCoordinates.longitude.toString()}
                onChangeText={(text) => {
                  const value = parseFloat(text);
                  if (!isNaN(value)) {
                    setNewCoordinates(prev => ({ ...prev, longitude: value }));
                  }
                }}
                keyboardType="numeric"
                placeholder="Longitude (e.g., -74.0060)"
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleUpdateCoordinates}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stats footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {shows.length === 0
            ? 'No shows found'
            : shows.length === 1
            ? '1 show loaded'
            : `${shows.length} shows loaded`}
          {' • '}
          {shows.filter(show => !show.coordinates).length} missing coordinates
        </Text>
      </View>
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 20,
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  backButtonHeader: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusMessage: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  successMessage: {
    backgroundColor: '#e6f7ed',
    borderColor: '#34c759',
    borderWidth: 1,
  },
  errorMessageBanner: {
    backgroundColor: '#ffeeee',
    borderColor: '#ff3b30',
    borderWidth: 1,
  },
  statusMessageText: {
    fontSize: 14,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  detailsPanel: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: height * 0.3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  detailsScroll: {
    maxHeight: height * 0.25,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  detailsAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  coordinatesContainer: {
    marginVertical: 8,
  },
  coordinatesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  coordinatesValue: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  editButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: width * 0.85,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  inputRow: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default AdminMapScreen;
