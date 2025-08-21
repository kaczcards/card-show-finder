import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  // Removed unused imports 'Linking' and 'Platform as _Platform'
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import SocialLinksRow from '../../ui/SocialLinksRow';

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
const formatDate = (value: Date | string) => {
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Unknown date';
    }
    // convert to UTC for consistent display
    const utc = new Date(parsed.getTime() + parsed.getTimezoneOffset() * 60 * 1000);
    return utc.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Unknown date';
  }
};

// -------------------------------------------------
// Component
// -------------------------------------------------

const CalloutContent: React.FC<CalloutContentProps> = ({
  showId,
  title,
  startDate,
  endDate,
  address,
  entryFee,
  organizer,
  onPressViewDetails,
}) => {
  const navigation = useNavigation<any>();

  const handleViewDetails = () => {
    if (onPressViewDetails) {
      onPressViewDetails(showId);
    } else {
      // Fallback navigation if consumer didn't supply a handler
      navigation.navigate('ShowDetail', { showId });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.dates}>
        {formatDate(startDate)} – {formatDate(endDate)}
      </Text>
      <Text style={styles.address}>{address}</Text>
      {entryFee ? (
        <Text style={styles.entryFee}>Entry: ${entryFee}</Text>
      ) : null}

      {/* Social links */}
      {organizer ? (
        <View style={{ marginBottom: 6 }}>
          <SocialLinksRow
            variant="icons"
            iconSize={20}
            urls={{
              facebookUrl: organizer.facebookUrl,
              instagramUrl: organizer.instagramUrl,
              twitterUrl: organizer.twitterUrl,
              whatnotUrl: organizer.whatnotUrl,
              ebayStoreUrl: organizer.ebayStoreUrl,
            }}
          />
        </View>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={handleViewDetails}>
        <Text style={styles.buttonText}>View Details</Text>
      </TouchableOpacity>
    </View>
  );
};

// -------------------------------------------------
// Styles
// -------------------------------------------------

const styles = StyleSheet.create({
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
