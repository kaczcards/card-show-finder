import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from 'react-native';
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
const formatDate = (dateValue: Date | string) => {
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return 'Unknown date';
    }
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    return utcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (err) {
    return 'Unknown date';
  }
};
