import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ShowBasicInfoProps {
  show: {
    title: string;
    address?: string;
    location?: string;
    entry_fee?: number | string;
  };
}

// InfoRow component for consistent "icon + text" rows
type InfoRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text?: string;
  children?: React.ReactNode;
};

const InfoRow: React.FC<InfoRowProps> = ({ icon, text, children }) => {
  // Enhanced renderContent to safely handle all text cases
  const renderContent = () => {
    // If no children are provided, use the text prop
    if (children === undefined || children === null) {
      return <Text style={styles.infoText}>{text || ''}</Text>;
    }
    
    // If children is a string or number, wrap it in a Text component
    if (typeof children === 'string' || typeof children === 'number') {
      return <Text style={styles.infoText}>{children}</Text>;
    }
    
    // If children is already a React element, return it
    if (React.isValidElement(children)) {
      return children;
    }
    
    // For any other case (like arrays of elements), wrap in a fragment
    // This ensures we don't accidentally render raw strings
    return <>{children}</>;
  };

  return (
    <View style={styles.infoRow}>
      <Ionicons
        name={icon}
        size={20}
        color="#666666"
        style={styles.infoIcon}
      />
      {renderContent()}
    </View>
  );
};

const ShowBasicInfo: React.FC<ShowBasicInfoProps> = ({ show }) => {
  // Safe entry fee formatting
  const formatEntryFee = (fee?: number | string) => {
    if (fee === undefined || fee === null) return '';
    try {
      return `Entry Fee: $${Number(fee).toFixed(2)}`;
    } catch (e) {
      return `Entry Fee: ${fee}`;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{show.title || 'Untitled Show'}</Text>
      
      <InfoRow 
        icon="location" 
        text={show.address || show.location || 'Location not specified'} 
      />
      
      {show.entry_fee && (
        <InfoRow
          icon="cash"
          text={formatEntryFee(show.entry_fee)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoText: {
    fontSize: 16,
    flex: 1,
  },
});

export default ShowBasicInfo;
