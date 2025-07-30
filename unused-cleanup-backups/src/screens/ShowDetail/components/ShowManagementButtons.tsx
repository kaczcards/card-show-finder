import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ShowManagementButtonsProps {
  isShowOrganizer: boolean;
  isCurrentUserOrganizer: boolean;
  isClaimingShow: boolean;
  onClaimShow: () => void;
  onEditShow: () => void;
}

const ShowManagementButtons: React.FC<ShowManagementButtonsProps> = ({
  isShowOrganizer,
  isCurrentUserOrganizer,
  isClaimingShow,
  onClaimShow,
  onEditShow,
}) => {
  return (
    <View style={styles.container}>
      {isShowOrganizer && !isCurrentUserOrganizer && (
        <TouchableOpacity 
          style={styles.claimShowButton} 
          onPress={onClaimShow} 
          disabled={isClaimingShow}
        >
          {isClaimingShow ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="flag" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Claim This Show</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {isCurrentUserOrganizer && (
        <TouchableOpacity style={styles.editShowButton} onPress={onEditShow}>
          <Ionicons name="create" size={20} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Edit Show Details</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  claimShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6A00',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  editShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0057B8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ShowManagementButtons;
