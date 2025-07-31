import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator as _ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EditShowScreenProps {
  route: any;
  navigation: any;
}

const EditShowScreen: React.FC<EditShowScreenProps> = ({ route, navigation }) => {
  const { showId } = route.params;

  // Add title to navigation
  React.useEffect(() => {
    navigation.setOptions({
      title: 'Edit Show',
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Ionicons name="construct" size={48} color="#FF6A00" />
      <Text style={styles.title}>Show Editing Coming Soon</Text>
      <Text style={styles.description}>
        This feature is currently under development. Soon you'll be able to edit show details,
        update information, and manage all aspects of your show.
      </Text>
      <Text style={styles.showId}>Show ID: {showId}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  showId: {
    fontSize: 14,
    color: '#999',
    marginTop: 20,
  },
});

export default EditShowScreen;
