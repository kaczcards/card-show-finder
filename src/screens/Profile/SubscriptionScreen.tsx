import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, _Image, useWindowDimensions,  } from 'react-native';
import { _useNavigation } from '@react-navigation/native';
import { _useAuth } from '../../contexts/AuthContext'; // Using useAuth for refreshUserRole
import { _useUserSubscriptions } from '../../hooks/useUserSubscriptions';
/* -------------------------------------------------------------
 * Subscription service – functions that act on the database
 * ----------------------------------------------------------- */
import {
  getSubscriptionDetails,
  getSubscriptionTimeRemaining,
  initiateSubscriptionPurchase,
  renewSubscription,
  cancelSubscription,
  formatExpiryDate,
} from '../../services/subscriptionService';

/* -------------------------------------------------------------
 * Subscription constants / enums – exported from subscriptionTypes
 * ----------------------------------------------------------- */
import {
  SUBSCRIPTION_PLANS,
  SubscriptionPlan,
  SubscriptionPlanType,
  SubscriptionDuration,
} from '../../services/subscriptionTypes';

const SubscriptionScreen: React.FC = () => {
  const { authState, refreshUserRole } = useAuth(); // Destructure refreshUserRole from useAuth
  const { _user } = authState;
  const _navigation = useNavigation();
  const { _width } = useWindowDimensions();
  
  const [loading, setLoading] = useState(_false);
  const [processingPayment, setProcessingPayment] = useState(_false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<{ days: number, hours: number } | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  
  // Colors
  const _ORANGE = '#FF6A00';
  const _BLUE = '#0057B8';
  const _LIGHT_GRAY = '#f0f0f0';
  const _DARK_GRAY = '#666666';
  
  /* ------------------------------------------------------------------
   * Subscriptions – fetch via dedicated hook
   * ------------------------------------------------------------------ */
  const {
    subscriptions,
    isLoading: subsLoading,
    error: subsError,
  } = useUserSubscriptions();

  // Extract the current subscription from the array (there will be only one item)
  const _currentSubscription = subscriptions && subscriptions.length > 0 ? subscriptions[_0] : null;

  useEffect(() => {
    if (_user) {
      loadSubscriptionDetails();
    }
  }, [_user]);
  
  // Refresh time remaining every minute
  useEffect(() => {
    if (!user) return;
    
    const _timer = setInterval(() => {
      if (user.subscriptionExpiry) {
        setTimeRemaining(getSubscriptionTimeRemaining(user));
      }
    }, 60000); // Update every minute
    
    return () => clearInterval(_timer);
  }, [_user]);
  
  const _loadSubscriptionDetails = () => {
    if (!user) return;
    
    setLoading(_true);
    try {
      const _details = getSubscriptionDetails(_user);
      setSubscriptionDetails(_details);
      setTimeRemaining(getSubscriptionTimeRemaining(user));
      
      // Pre-select the appropriate plan based on user's account type
      if (details?.accountType) {
        const _planType = details.accountType === 'dealer' 
          ? SubscriptionPlanType.DEALER 
          : SubscriptionPlanType.ORGANIZER;
          
        const _duration = billingCycle === 'monthly' 
          ? SubscriptionDuration.MONTHLY 
          : SubscriptionDuration.ANNUAL;
          
        const _plan = SUBSCRIPTION_PLANS.find(p => 
          p.type === planType && p.duration === duration
        );
        
        setSelectedPlan(plan || null);
      }
    } catch (_error) {
      console.error('Error loading subscription details:', _error);
      Alert.alert('Error', 'Failed to load subscription details');
    } finally {
      setLoading(_false);
    }
  };
  
  const _handlePurchase = async () => {
    // Guard: subscription data must be ready
    if (_subsLoading) {
      Alert.alert('Please wait', 'Subscription data is still loading. Try again shortly.');
      return;
    }
    if (!user || !selectedPlan) return;
    
    setProcessingPayment(_true);
    try {
      const _result = await initiateSubscriptionPurchase(user.id, selectedPlan.id);
      
      if (result.success) {
        await refreshUserRole(); // Call to refresh user's role and state after successful purchase
        Alert.alert(
          'Success',
          `Your subscription has been activated! It will expire on ${formatExpiryDate(result.subscriptionExpiry as Date)}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to process payment');
      }
    } catch (error: any) {
      console.error('Error purchasing subscription:', _error);
      Alert.alert('Error', error.message || 'Failed to process payment');
    } finally {
      setProcessingPayment(_false);
    }
  };
  
  const _handleRenewal = async () => {
    if (_subsLoading) {
      Alert.alert('Please wait', 'Subscription data is still loading. Try again shortly.');
      return;
    }
    if (!user || !selectedPlan) return;
    
    setProcessingPayment(_true);
    try {
      const _result = await renewSubscription(user.id, selectedPlan.id);
      
      if (result.success) {
        await refreshUserRole(); // Call to refresh user's role and state after successful renewal
        Alert.alert(
          'Success',
          `Your subscription has been renewed! It will now expire on ${formatExpiryDate(result.subscriptionExpiry as Date)}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to renew subscription');
      }
    } catch (error: any) {
      console.error('Error renewing subscription:', _error);
      Alert.alert('Error', error.message || 'Failed to renew subscription');
    } finally {
      setProcessingPayment(_false);
    }
  };
  
  const _handleCancel = async () => {
    if (_subsLoading) {
      Alert.alert('Please wait', 'Subscription data is still loading. Try again shortly.');
      return;
    }
    if (!user) return;
    
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will still have access until your current billing period ends.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setLoading(_true);
            try {
              const _result = await cancelSubscription(user.id);
              
              if (result.success) {
                await refreshUserRole(); // Call to refresh user's role and state after successful cancellation
                Alert.alert(
                  'Subscription Cancelled',
                  'Your subscription has been cancelled. You will have access until the end of your current billing period.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel subscription');
              }
            } catch (error: any) {
              console.error('Error cancelling subscription:', _error);
              Alert.alert('Error', error.message || 'Failed to cancel subscription');
            } finally {
              setLoading(_false);
            }
          }
        }
      ]
    );
  };
  
  const _toggleBillingCycle = () => {
    const _newCycle = billingCycle === 'monthly' ? 'annual' : 'monthly';
    setBillingCycle(_newCycle);
    
    // Update selected plan based on new billing cycle
    if (_selectedPlan) {
      const _duration = newCycle === 'monthly' 
        ? SubscriptionDuration.MONTHLY 
        : SubscriptionDuration.ANNUAL;
        
      const _plan = SUBSCRIPTION_PLANS.find(p => 
        p.type === selectedPlan.type && p.duration === duration
      );
      
      setSelectedPlan(plan || null);
    }
  };
  
  const _renderCurrentSubscription = () => {
    if (!user || user.accountType === 'collector') {
      return (
        <View style={styles.currentSubscriptionContainer}>
          <Text style={styles.sectionTitle}>Current Subscription</Text>
          <Text style={styles.freeAccountText}>
            You are currently on a free collector account.
          </Text>
          <Text style={styles.upgradePrompt}>
            Upgrade to a paid plan to access dealer and organizer features!
          </Text>
        </View>
      );
    }
    
    if (!subscriptionDetails) return null;
    
    const { status, expiry, isActive, isTrialPeriod } = subscriptionDetails;
    
    return (
      <View style={styles.currentSubscriptionContainer}>
        <Text style={styles.sectionTitle}>Current Subscription</Text>
        
        <View style={styles.subscriptionInfoRow}>
          <Text style={styles.subscriptionLabel}>Account Type:</Text>
          <Text style={styles.subscriptionValue}>
            {user.accountType === 'dealer'
              ? // Distinguish regular Dealers from MVP Dealers
                (user.role?.toLowerCase?.() === 'mvp_dealer' ? 'MVP Dealer' : 'Dealer')
              : 'Show Organizer'}
          </Text>
        </View>
        
        <View style={styles.subscriptionInfoRow}>
          <Text style={styles.subscriptionLabel}>Status:</Text>
          <Text style={[
            styles.subscriptionValue,
            { color: status === 'active' ? 'green' : status === 'expired' ? 'red' : DARK_GRAY }
          ]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </View>
        
        {expiry && (
          <View style={styles.subscriptionInfoRow}>
            <Text style={styles.subscriptionLabel}>Expires:</Text>
            <Text style={styles.subscriptionValue}>{formatExpiryDate(expiry)}</Text>
          </View>
        )}
        
        {isActive && timeRemaining && (
          <View style={styles.timeRemainingContainer}>
            <Text style={styles.timeRemainingLabel}>
              {isTrialPeriod ? 'Trial Ends In:' : 'Subscription Ends In:'}
            </Text>
            <Text style={styles.timeRemainingValue}>
              {timeRemaining.days} days, {timeRemaining.hours} hours
            </Text>
          </View>
        )}
        
        {/* Trial period countdown badge */}
        {isActive && isTrialPeriod && timeRemaining && status === 'active' && (
          <View style={styles.trialBadgeContainer}>
            <Text style={styles.trialBadgeText}>
              {timeRemaining.days === 0 
                ? 'Trial ends today!' 
                : `${timeRemaining.days} days left in trial`}
            </Text>
          </View>
        )}
      </View>
    );
  };
  
  const _renderPlanSelector = () => {
    const _dealerMonthlyPlan = SUBSCRIPTION_PLANS.find(
      p => p.type === SubscriptionPlanType.DEALER && p.duration === SubscriptionDuration.MONTHLY
    );
    
    const _dealerAnnualPlan = SUBSCRIPTION_PLANS.find(
      p => p.type === SubscriptionPlanType.DEALER && p.duration === SubscriptionDuration.ANNUAL
    );
    
    const _organizerMonthlyPlan = SUBSCRIPTION_PLANS.find(
      p => p.type === SubscriptionPlanType.ORGANIZER && p.duration === SubscriptionDuration.MONTHLY
    );
    
    const _organizerAnnualPlan = SUBSCRIPTION_PLANS.find(
      p => p.type === SubscriptionPlanType.ORGANIZER && p.duration === SubscriptionDuration.ANNUAL
    );
    
    const _dealerPlan = billingCycle === 'monthly' ? dealerMonthlyPlan : dealerAnnualPlan;
    const _organizerPlan = billingCycle === 'monthly' ? organizerMonthlyPlan : organizerAnnualPlan;
    
    return (
      <View style={styles.planSelectorContainer}>
        <Text style={styles.sectionTitle}>Choose a Plan</Text>
        
        <View style={styles.billingToggleContainer}>
          <Text style={[
            styles.billingToggleText,
            billingCycle === 'monthly' ? styles.billingToggleActive : {}
          ]}>
            Monthly
          </Text>
          
          <TouchableOpacity 
            style={[
              styles.billingToggleSwitch,
              billingCycle === 'annual' ? styles.billingToggleSwitchRight : {}
            ]}
            onPress={_toggleBillingCycle}
          >
            <View style={styles.billingToggleKnob} />
          </TouchableOpacity>
          
          <View style={styles.billingToggleRightContainer}>
            <Text style={[
              styles.billingToggleText,
              billingCycle === 'annual' ? styles.billingToggleActive : {}
            ]}>
              Annual
            </Text>
            <Text style={styles.savingsText}>Save 25%</Text>
          </View>
        </View>
        
        <View style={styles.plansRow}>
          {/* MVP Dealer Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan?.id === dealerPlan?.id ? styles.selectedPlanCard : {}
            ]}
            onPress={() => setSelectedPlan(dealerPlan || null)}
          >
            <Text style={styles.planName}>MVP Dealer</Text>
            <Text style={styles.planPrice}>${dealerPlan?.price}</Text>
            <Text style={styles.planBillingCycle}>
              {billingCycle === 'monthly' ? '/month' : '/year'}
            </Text>
            
            {dealerPlan?.trialDays && (
              <Text style={styles.trialText}>
                {dealerPlan.trialDays}-day free trial
              </Text>
            )}
            
            <View style={styles.planFeatures}>
              {dealerPlan?.features.slice(0, _3).map((_feature, _index) => (
                <View key={_index} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{_feature}</Text>
                </View>
              ))}
              <Text style={styles.moreFeatures}>+{(dealerPlan?.features.length || 0) - 3} more features</Text>
            </View>
          </TouchableOpacity>
          
          {/* Show Organizer Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan?.id === organizerPlan?.id ? styles.selectedPlanCard : {},
              styles.recommendedPlan
            ]}
            onPress={() => setSelectedPlan(organizerPlan || null)}
          >
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>RECOMMENDED</Text>
            </View>
            
            <Text style={styles.planName}>Show Organizer</Text>
            <Text style={styles.planPrice}>${organizerPlan?.price}</Text>
            <Text style={styles.planBillingCycle}>
              {billingCycle === 'monthly' ? '/month' : '/year'}
            </Text>
            
            {organizerPlan?.trialDays && (
              <Text style={styles.trialText}>
                {organizerPlan.trialDays}-day free trial
              </Text>
            )}
            
            <View style={styles.planFeatures}>
              {organizerPlan?.features.slice(0, _3).map((_feature, _index) => (
                <View key={_index} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{_feature}</Text>
                </View>
              ))}
              <Text style={styles.moreFeatures}>+{(organizerPlan?.features.length || 0) - 3} more features</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const _renderPlanComparison = () => {
    // Get one plan of each type to compare features
    const _dealerPlan = SUBSCRIPTION_PLANS.find(p => p.type === SubscriptionPlanType.DEALER);
    const _organizerPlan = SUBSCRIPTION_PLANS.find(p => p.type === SubscriptionPlanType.ORGANIZER);
    
    if (!dealerPlan || !organizerPlan) return null;
    
    // Combine all features for comparison
    const _allFeatures = new Set<string>();
    dealerPlan.features.forEach(feature => allFeatures.add(feature));
    organizerPlan.features.forEach(feature => allFeatures.add(feature));
    
    return (
      <View style={styles.comparisonContainer}>
        <Text style={styles.sectionTitle}>Plan Comparison</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={_false}>
          <View style={styles.comparisonTable}>
            {/* Header Row */}
            <View style={styles.comparisonRow}>
              <View style={[styles.comparisonCell, styles.comparisonHeaderCell, { width: 180 }]}>
                <Text style={styles.comparisonHeaderText}>Features</Text>
              </View>
              <View style={[styles.comparisonCell, styles.comparisonHeaderCell]}>
                <Text style={styles.comparisonHeaderText}>Free</Text>
              </View>
              <View style={[styles.comparisonCell, styles.comparisonHeaderCell]}>
                <Text style={styles.comparisonHeaderText}>MVP Dealer</Text>
              </View>
              <View style={[styles.comparisonCell, styles.comparisonHeaderCell]}>
                <Text style={styles.comparisonHeaderText}>Show Organizer</Text>
              </View>
            </View>
            
            {/* Feature Rows */}
            {Array.from(allFeatures).map((_feature, _index) => {
              const _dealerHas = dealerPlan.features.includes(feature);
              const _organizerHas = organizerPlan.features.includes(feature);
              // Free account has basic features only
              const _freeHas = feature.includes('view') || feature.includes('browse');
              
              return (
                <View key={_index} style={[
                  styles.comparisonRow,
                  index % 2 === 0 ? styles.comparisonRowEven : {}
                ]}>
                  <View style={[styles.comparisonCell, { width: 180 }]}>
                    <Text style={styles.featureText}>{_feature}</Text>
                  </View>
                  <View style={styles.comparisonCell}>
                    <Text style={styles.checkmark}>{freeHas ? '✓' : ''}</Text>
                  </View>
                  <View style={styles.comparisonCell}>
                    <Text style={styles.checkmark}>{dealerHas ? '✓' : ''}</Text>
                  </View>
                  <View style={styles.comparisonCell}>
                    <Text style={styles.checkmark}>{organizerHas ? '✓' : ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };
  
  const _renderActionButtons = () => {
    if (!user) return null;
    if (_subsLoading) {
      return (
        <View style={styles.actionButtonsContainer}>
          <ActivityIndicator color={_ORANGE} />
        </View>
      );
    }
    
    // Use the currentSubscription from our mapped data if available
    const _activeStatus = currentSubscription?.status === 'active' || subscriptionDetails?.status === 'active';
    const _expiredStatus = currentSubscription?.status === 'expired' || subscriptionDetails?.status === 'expired';
    
    const _isUpgrade = user.accountType === 'collector' || 
      (user.accountType === 'dealer' && selectedPlan?.type === SubscriptionPlanType.ORGANIZER);
      
    const _isDowngrade = user.accountType === 'organizer' && 
      selectedPlan?.type === SubscriptionPlanType.DEALER;
      
    const _isRenewal = user.accountType !== 'collector' && 
      ((user.accountType === 'dealer' && selectedPlan?.type === SubscriptionPlanType.DEALER) ||
       (user.accountType === 'organizer' && selectedPlan?.type === SubscriptionPlanType.ORGANIZER));
       
    const _hasExpired = expiredStatus;
    
    let _buttonText = 'Select a Plan';
    if (_selectedPlan) {
      if (_isUpgrade) buttonText = 'Upgrade';
      else if (_isDowngrade) buttonText = 'Downgrade';
      else if (_isRenewal) buttonText = hasExpired ? 'Reactivate' : 'Renew';
      else buttonText = 'Subscribe';
    }
    
    return (
      <View style={styles.actionButtonsContainer}>
        {user.accountType !== 'collector' && activeStatus && (
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={_handleCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[
            styles.primaryButton,
            !selectedPlan ? styles.disabledButton : {},
            processingPayment ? styles.processingButton : {}
          ]}
          onPress={isRenewal ? handleRenewal : handlePurchase}
          disabled={!selectedPlan || processingPayment}
        >
          {processingPayment ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>{_buttonText}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };
  
  const _combinedLoading = loading || subsLoading;

  if (_combinedLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={_ORANGE} />
        <Text style={styles.loadingText}>Loading subscription details...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.screenTitle}>Subscription Management</Text>

      {/* Error banner if subscription fetch failed */}
      {subsError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            Failed to load subscription data. Some actions may be unavailable.
          </Text>
        </View>
      )}
      
      {renderCurrentSubscription()}
      {renderPlanSelector()}
      {renderPlanComparison()}
      {renderActionButtons()}
      
      <View style={styles.disclaimerContainer}>
        <Text style={styles.disclaimerText}>
          By subscribing, you agree to our Terms of Service and Privacy Policy.
          Subscriptions will automatically renew unless canceled at least 24 hours before the end of the current period.
        </Text>
      </View>
    </ScrollView>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#0057B8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  currentSubscriptionContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  freeAccountText: {
    fontSize: 16,
    marginBottom: 8,
  },
  upgradePrompt: {
    fontSize: 14,
    color: '#0057B8',
    fontStyle: 'italic',
  },
  subscriptionInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subscriptionLabel: {
    fontSize: 16,
    color: '#666',
  },
  subscriptionValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeRemainingContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 4,
  },
  timeRemainingLabel: {
    fontSize: 14,
    color: '#0057B8',
    marginBottom: 4,
  },
  timeRemainingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0057B8',
  },
  trialBadgeContainer: {
    marginTop: 12,
    backgroundColor: '#FF6A00',
    borderRadius: 4,
    padding: 8,
    alignSelf: 'flex-start',
  },
  trialBadgeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  planSelectorContainer: {
    marginBottom: 24,
  },
  billingToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  billingToggleText: {
    fontSize: 16,
    color: '#666',
  },
  billingToggleActive: {
    fontWeight: 'bold',
    color: '#0057B8',
  },
  billingToggleSwitch: {
    width: 50,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e0e0e0',
    padding: 3,
    marginHorizontal: 10,
  },
  billingToggleSwitchRight: {
    backgroundColor: '#0057B8',
  },
  billingToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  billingToggleRightContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  savingsText: {
    fontSize: 12,
    color: '#FF6A00',
    fontWeight: 'bold',
  },
  plansRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedPlanCard: {
    borderColor: '#0057B8',
    borderWidth: 2,
    backgroundColor: '#f0f8ff',
  },
  recommendedPlan: {
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FF6A00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recommendedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0057B8',
  },
  planBillingCycle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  trialText: {
    fontSize: 14,
    color: '#FF6A00',
    fontWeight: '500',
    marginBottom: 12,
  },
  planFeatures: {
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  featureCheck: {
    color: '#0057B8',
    fontWeight: 'bold',
    marginRight: 6,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  moreFeatures: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  comparisonContainer: {
    marginBottom: 24,
  },
  comparisonTable: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  comparisonRow: {
    flexDirection: 'row',
  },
  comparisonRowEven: {
    backgroundColor: '#f9f9f9',
  },
  comparisonCell: {
    width: 100,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  comparisonHeaderCell: {
    backgroundColor: '#0057B8',
    borderColor: '#0057B8',
  },
  comparisonHeaderText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0057B8',
  },
  actionButtonsContainer: {
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#0057B8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  processingButton: {
    backgroundColor: '#666666',
  },
  errorBanner: {
    backgroundColor: '#ffe5e5',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  errorBannerText: {
    color: '#cc0000',
    textAlign: 'center',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  cancelButtonText: {
    color: '#FF0000',
    fontSize: 16,
  },
  disclaimerContainer: {
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  }
});

export default SubscriptionScreen;