import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorStateProps {
  error: string | null;
  onRetry?: () => void;
  title?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onRetry,
  title = 'Something went wrong'
}) => {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="alert-circle" size={48} color="#FF3B30" />
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorText}>{error || 'Failed to load content'}</Text>
      
      {onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
    color: '#333333',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginVertical: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF6A00',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ErrorState;
