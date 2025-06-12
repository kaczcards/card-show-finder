// src/components/StripeProvider.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StripeProvider as StripeProviderNative } from '@stripe/stripe-react-native';
import { initializeStripe } from '../services/paymentService';

// Replace with your actual Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_yourStripePublishableKey';

const StripeProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const setupStripe = async () => {
      try {
        setLoading(true);
        const { success, error } = await initializeStripe();
        
        if (!success) {
          console.error('Failed to initialize Stripe:', error);
          setError(error);
        }
      } catch (err) {
        console.error('Error initializing Stripe:', err);
        setError('Failed to initialize payment system');
      } finally {
        setLoading(false);
      }
    };

    setupStripe();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Setting up payment system...</Text>
      </View>
    );
  }

  if (error) {
    // Continue showing the app even if Stripe fails to initialize
    // Payment features will be disabled
    console.warn('Stripe initialization failed, payment features will be disabled');
  }

  return (
    <StripeProviderNative
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.cardshowfinder"
      urlScheme="cardshowfinder"
    >
      {children}
    </StripeProviderNative>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});

export default StripeProvider;
