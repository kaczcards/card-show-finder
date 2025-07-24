import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Define strict types for the show object
interface ShowBasicInfoProps {
  show: {
    title?: string;
    address?: string;
    location?: string;
    entry_fee?: number | string | null;
    [key: string]: any; // Allow for additional properties
  };
}

// InfoRow component for consistent "icon + text" rows
type InfoRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text?: string | null;
  children?: React.ReactNode;
};

/**
 * A robust InfoRow component that ensures all text is properly wrapped
 * in Text components and handles all edge cases.
 */
const InfoRow: React.FC<InfoRowProps> = ({ icon, text, children }) => {
  // Function to safely render content based on type
  const renderContent = () => {
    // If children are provided, handle them based on type
    if (children !== undefined && children !== null) {
      /* ------------------------------------------------------------------
       * Always ensure `children` is wrapped in a fragment so the return
       * value is guaranteed to be a valid React node regardless of the
       * type passed in. This covers strings, numbers, elements, arrays,
       * and other renderable primitives without additional branching.
       * ----------------------------------------------------------------*/
      return <>{children}</>;
    }
    
    // If no children but text is provided, render it safely
    if (text !== undefined && text !== null) {
      return <Text style={styles.infoText}>{text}</Text>;
    }
    
    // Fallback for no content
    return <Text style={styles.infoText}>Not specified</Text>;
  };

  return (
    <View style={styles.infoRow}>
      <Ionicons
        name={icon}
        size={20}
        color="#666666"
        style={styles.infoIcon}
      />
      <View style={styles.textContainer}>
        {renderContent()}
      </View>
    </View>
  );
};

/**
 * A super-robust ShowBasicInfo component that ensures all text is properly
 * wrapped in Text components and all data access is safely guarded.
 */
const ShowBasicInfo: React.FC<ShowBasicInfoProps> = ({ show }) => {
  // Ensure show object exists
  const safeShow = show || {};
  
  // Safe getters for show properties with fallbacks
  const getTitle = () => {
    if (typeof safeShow.title === 'string') return safeShow.title;
    if (typeof safeShow.title === 'number') return safeShow.title.toString();
    return 'Untitled Show';
  };
  
  const getLocation = () => {
    // Try address first, then location, with fallback
    if (typeof safeShow.address === 'string' && safeShow.address.trim() !== '') {
      return safeShow.address;
    }
    if (typeof safeShow.location === 'string' && safeShow.location.trim() !== '') {
      return safeShow.location;
    }
    return 'Location not specified';
  };
  
  // Safe entry fee formatting with comprehensive type checking
  const formatEntryFee = () => {
    const fee = safeShow.entry_fee;
    
    // Handle undefined or null
    if (fee === undefined || fee === null) {
      return 'Entry fee not specified';
    }
    
    // Handle numeric values
    if (typeof fee === 'number') {
      return `Entry Fee: $${fee.toFixed(2)}`;
    }
    
    // Handle string values that might be numeric
    if (typeof fee === 'string') {
      if (fee.trim() === '') {
        return 'Entry fee not specified';
      }
      
      // Try to parse as number if it looks like one
      const parsed = parseFloat(fee);
      if (!isNaN(parsed)) {
        return `Entry Fee: $${parsed.toFixed(2)}`;
      }
      
      // Otherwise return as is
      return `Entry Fee: ${fee}`;
    }
    
    // Fallback for unexpected types
    return 'Entry fee not specified';
  };
  
  // Check if entry fee exists and should be displayed
  const shouldShowEntryFee = () => {
    const fee = safeShow.entry_fee;
    return fee !== undefined && fee !== null && fee !== '';
  };

  return (
    <View style={styles.container}>
      {/* Title with fallback */}
      <Text style={styles.title}>{getTitle()}</Text>
      
      {/* Location with icon */}
      <InfoRow icon="location">
        <Text style={styles.infoText}>{getLocation()}</Text>
      </InfoRow>
      
      {/* Entry fee with icon - only shown if it exists */}
      {shouldShowEntryFee() && (
        <InfoRow icon="cash">
          <Text style={styles.infoText}>{formatEntryFee()}</Text>
        </InfoRow>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333333',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
});

export default ShowBasicInfo;
