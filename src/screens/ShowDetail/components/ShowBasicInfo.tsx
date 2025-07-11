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
  const renderContent = () => {
    if (children === undefined || children === null) {
      return <Text style={styles.infoText}>{text}</Text>;
    }
    if (typeof children === 'string' || typeof children === 'number') {
      return <Text style={styles.infoText}>{children}</Text>;
    }
    return children;
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
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{show.title}</Text>
      
      <InfoRow 
        icon="location" 
        text={show.address || show.location || 'Location not specified'} 
      />
      
      {show.entry_fee && (
        <InfoRow
          icon="cash"
          text={`Entry Fee: $${Number(show.entry_fee).toFixed(2)}`}
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
