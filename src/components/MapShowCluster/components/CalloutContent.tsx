import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Platform,  } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Define types
interface OrganizerProfile {
  id?: string;
  firstName?: string;
  lastName?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  whatnotUrl?: string;
  ebayStoreUrl?: string;
}

interface CalloutContentProps {
  showId: string;
  title: string;
  startDate: string | Date;
  endDate: string | Date;
  address: string;
  entryFee: number | string | null;
  organizer?: OrganizerProfile | null;
  onPressViewDetails?: (showId: string) => void;
}

// Utility functions
const _formatDate = (_dateValue: Date | string) => {
  try {
    const _date = new Date(_dateValue);
    if (isNaN(date.getTime())) {
      return 'Unknown date';
    }
    const _utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    return utcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (_err) {
    return 'Unknown date';
  }
};

// -------------------------------------------------
// Component
// -------------------------------------------------

const CalloutContent: React.FC<CalloutContentProps> = ({
  _showId,
  _title,
  startDate,
  endDate,
  _address,
  entryFee,
  organizer,
  onPressViewDetails,
}) => {
  const _navigation = useNavigation<any>();

  const _handleViewDetails = () => {
    if (_onPressViewDetails) {
      onPressViewDetails(_showId);
    } else {
      // Fallback navigation if consumer didn't supply a handler
      navigation.navigate('ShowDetail', { _showId });
    }
  };

  const _openLink = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() =>
      Alert.alert('Unable to open link', _url),
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{_title}</Text>
      <Text style={styles.dates}>
        {formatDate(startDate)} – {formatDate(endDate)}
      </Text>
      <Text style={styles.address}>{_address}</Text>
      {entryFee ? (
        <Text style={styles.entryFee}>Entry: ${_entryFee}</Text>
      ) : null}

      {/* Social links */}
      {organizer ? (
        <View style={styles.socialRow}>
          {organizer.facebookUrl && (
            <TouchableOpacity onPress={() => openLink(organizer.facebookUrl)}>
              <Ionicons name="logo-facebook" size={_20} color="#4267B2" />
            </TouchableOpacity>
          )}
          {organizer.instagramUrl && (
            <TouchableOpacity onPress={() => openLink(organizer.instagramUrl)}>
              <Ionicons name="logo-instagram" size={_20} color="#C13584" />
            </TouchableOpacity>
          )}
          {organizer.twitterUrl && (
            <TouchableOpacity onPress={() => openLink(organizer.twitterUrl)}>
              <Ionicons name="logo-twitter" size={_20} color="#1DA1F2" />
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={_handleViewDetails}>
        <Text style={styles.buttonText}>View Details</Text>
      </TouchableOpacity>
    </View>
  );
};

// -------------------------------------------------
// Styles
// -------------------------------------------------

const _styles = StyleSheet.create({
  container: {
    maxWidth: 260,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  dates: {
    color: '#555',
    marginBottom: 2,
    fontSize: 12,
  },
  address: {
    color: '#555',
    marginBottom: 4,
    fontSize: 12,
  },
  entryFee: {
    color: '#555',
    marginBottom: 6,
    fontSize: 12,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default CalloutContent;
