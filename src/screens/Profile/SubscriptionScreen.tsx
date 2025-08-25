import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext'; // Using useAuth for refreshUserRole
import { useUserSubscriptions } from '../../hooks/useUserSubscriptions';
import { useStripe } from '@stripe/stripe-react-native'; // Stripe hooks
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
import { supabase } from '../../supabase';

const SubscriptionScreen: React.FC = () => {
  const { authState, refreshUserRole } = useAuth(); // Destructure refreshUserRole from useAuth
  const { user } = authState;
  const navigation = useNavigation();
  const { width: _width } = useWindowDimensions();
  // Stripe helpers for PaymentSheet
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<{ days: number, hours: number } | null>(null);
  // Default to monthly billing
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  
  // Promo code states
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoStatus, setPromoStatus] = useState<'idle'|'valid'|'invalid'|'expired'|'applied'|'error'|'checking'>('idle');
  const [promoMessage, setPromoMessage] = useState<string>('');
  
  // Colors
  const ORANGE = '#FF6A00';
  const _BLUE = '#0057B8';
  const _LIGHT_GRAY = '#f0f0f0';
  const DARK_GRAY = '#666666';
  
  /* ------------------------------------------------------------------
   * Subscriptions – fetch via dedicated hook
   * ------------------------------------------------------------------ */
  const {
    subscriptions,
    isLoading: subsLoading,
    error: subsError,
  } = useUserSubscriptions();

  // Extract the current subscription from the array (there will be only one item)
  const currentSubscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

  useEffect(() => {
    if (user) {
      loadSubscriptionDetails();
    }
  }, [user]);
  
  // Refresh time remaining every minute
  useEffect(() => {
    if (!user) return;
    
    const timer = setInterval(() => {
      if (user.subscriptionExpiry) {
        setTimeRemaining(getSubscriptionTimeRemaining(user));
      }
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, [user]);
  
  const loadSubscriptionDetails = () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const details = getSubscriptionDetails(user);
      setSubscriptionDetails(details);
      setTimeRemaining(getSubscriptionTimeRemaining(user));
      
      // Pre-select the appropriate plan based on user's account type
      if (details?.accountType) {
        const planType = details.accountType === 'dealer' 
          ? SubscriptionPlanType.DEALER 
          : SubscriptionPlanType.ORGANIZER;
          
        const duration = billingCycle === 'monthly' 
          ? SubscriptionDuration.MONTHLY 
          : SubscriptionDuration.ANNUAL;
          
        const plan = SUBSCRIPTION_PLANS.find(p => 
          p.type === planType && p.duration === duration
        );
        
        setSelectedPlan(plan || null);
      }
    } catch (error) {
      console.error('Error loading subscription details:', error);
      Alert.alert('Error', 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };
  
  const handleValidatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoStatus('invalid');
      setPromoMessage('Please enter a promo code');
      return;
    }
    
    if (promoStatus === 'applied') {
      return; // Already applied, do nothing
    }
    
    setPromoStatus('checking');
    setPromoMessage('Validating code...');
    
    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: promoCode.trim(),
        p_plan_type: selectedPlan?.type?.toLowerCase() || null,
        preview_only: true
      });
      
      if (error) {
        throw error;
      }
      
      if (data && data.valid) {
        setPromoStatus('valid');
        setPromoMessage('Valid code! First month free.');
      } else if (data && data.expired) {
        setPromoStatus('expired');
        setPromoMessage('This code has expired.');
      } else if (data && !data.valid) {
        setPromoStatus('invalid');
        setPromoMessage(data.message || 'Invalid promo code.');
      } else {
        setPromoStatus('error');
        setPromoMessage('Could not validate code. Please try again.');
      }
    } catch (error: any) {
      console.error('Error validating promo code:', error);
      setPromoStatus('error');
      setPromoMessage(error.message || 'Error validating code. Please try again.');
    }
  };
  
  const handleApplyPromoCode = () => {
    if (promoStatus === 'valid') {
      setPromoStatus('applied');
      setPromoMessage('First month free applied!');
    } else {
      handleValidatePromoCode();
    }
  };
  
  const handleClearPromoCode = () => {
    setPromoCode('');
    setPromoStatus('idle');
    setPromoMessage('');
  };
  
  const handlePurchase = async () => {
    // Guard: subscription data must be ready
    if (subsLoading) {
      Alert.alert('Please wait', 'Subscription data is still loading. Try again shortly.');
      return;
    }
    if (!user || !selectedPlan) return;
    
    setProcessingPayment(true);
    try {
      const result = await initiateSubscriptionPurchase(
        user.id,
        selectedPlan.id,
        { initPaymentSheet, presentPaymentSheet },
        promoStatus === 'applied' ? promoCode : undefined
      );
      
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
      console.error('Error purchasing subscription:', error);
      Alert.alert('Error', error.message || 'Failed to process payment');
    } finally {
      setProcessingPayment(false);
    }
  };
  
  const handleRenewal = async () => {
    if (subsLoading) {
      Alert.alert('Please wait', 'Subscription data is still loading. Try again shortly.');
      return;
    }
    if (!user || !selectedPlan) return;
    
    setProcessingPayment(true);
    try {
      const result = await renewSubscription(
        user.id,
        selectedPlan.id,
        promoStatus === 'applied' ? promoCode : undefined
      );
      
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
      console.error('Error renewing subscription:', error);
      Alert.alert('Error', error.message || 'Failed to renew subscription');
    } finally {
      setProcessingPayment(false);
    }
  };
  
  const handleCancel = async () => {
    if (subsLoading) {
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
            setLoading(true);
            try {
              const result = await cancelSubscription(user.id);
              
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
              console.error('Error cancelling subscription:', error);
              Alert.alert('Error', error.message || 'Failed to cancel subscription');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  const toggleBillingCycle = () => {
    const newCycle = billingCycle === 'monthly' ? 'annual' : 'monthly';
    setBillingCycle(newCycle);
    
    // Update selected plan based on new billing cycle
    if (selectedPlan) {
      const duration = newCycle === 'monthly' 
        ? SubscriptionDuration.MONTHLY 
        : SubscriptionDuration.ANNUAL;
        
      const plan = SUBSCRIPTION_PLANS.find(p => 
        p.type === selectedPlan.type && p.duration === duration
      );
      
      setSelectedPlan(plan || null);
    }
  };
  
  const renderCurrentSubscription = () => {
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
  
  const renderPlanSelector = () => {
    const dealerMonthlyPlan = SUBSCRIPTION_PLANS.find(
      p => p.type === SubscriptionPlanType.DEALER && p.duration === SubscriptionDuration.MONTHLY
    );
    
    const dealerAnnualPlan = SUBSCRIPTION_PLANS.find(
      p => p.type === SubscriptionPlanType.DEALER && p.duration === SubscriptionDuration.ANNUAL
    );
    
    const organizerMonthlyPlan = SUBSCRIPTION_PLANS.find(
      p => p.type === SubscriptionPlanType.ORGANIZER && p.duration === SubscriptionDuration.MONTHLY
    );
    
    const organizerAnnualPlan = SUBSCRIPTION_PLANS.find(
      p => p.type === SubscriptionPlanType.ORGANIZER && p.duration === SubscriptionDuration.ANNUAL
    );
    
    const dealerPlan = billingCycle === 'monthly' ? dealerMonthlyPlan : dealerAnnualPlan;
    const organizerPlan = billingCycle === 'monthly' ? organizerMonthlyPlan : organizerAnnualPlan;
    
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
            onPress={toggleBillingCycle}
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
            
            {promoStatus === 'applied' && billingCycle === 'monthly' && (
              <Text style={styles.promoAppliedText}>First month free with code</Text>
            )}
            
            <View style={styles.planFeatures}>
              {dealerPlan?.features.slice(0, 3).map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{feature}</Text>
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
            
            {promoStatus === 'applied' && billingCycle === 'monthly' && (
              <Text style={styles.promoAppliedText}>First month free with code</Text>
            )}
            
            <View style={styles.planFeatures}>
              {organizerPlan?.features.slice(0, 3).map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
              <Text style={styles.moreFeatures}>+{(organizerPlan?.features.length || 0) - 3} more features</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const renderPlanComparison = () => {
    // Get one plan of each type to compare features
    const dealerPlan = SUBSCRIPTION_PLANS.find(p => p.type === SubscriptionPlanType.DEALER);
    const organizerPlan = SUBSCRIPTION_PLANS.find(p => p.type === SubscriptionPlanType.ORGANIZER);
    
    if (!dealerPlan || !organizerPlan) return null;
    
    // Combine all features for comparison
    const allFeatures = new Set<string>();
    dealerPlan.features.forEach(feature => allFeatures.add(feature));
    organizerPlan.features.forEach(feature => allFeatures.add(feature));
    
    return (
      <View style={styles.comparisonContainer}>
        <Text style={styles.sectionTitle}>Plan Comparison</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
            {Array.from(allFeatures).map((feature, index) => {
              const dealerHas = dealerPlan.features.includes(feature);
              const organizerHas = organizerPlan.features.includes(feature);
              // Free account has basic features only
              const freeHas = feature.includes('view') || feature.includes('browse');
              
              return (
                <View key={index} style={[
                  styles.comparisonRow,
                  index % 2 === 0 ? styles.comparisonRowEven : {}
                ]}>
                  <View style={[styles.comparisonCell, { width: 180 }]}>
                    <Text style={styles.featureText}>{feature}</Text>
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
  
  const renderPromoCodeSection = () => {
    return (
      <View style={styles.promoCodeContainer}>
        <Text style={styles.promoCodeLabel}>Have a promo code?</Text>
        
        <View style={styles.promoCodeInputRow}>
          <TextInput
            style={[
              styles.promoCodeInput,
              promoStatus === 'applied' && styles.promoCodeInputDisabled
            ]}
            placeholder="Enter promo code"
            value={promoCode}
            onChangeText={setPromoCode}
            autoCapitalize="characters"
            editable={promoStatus !== 'applied'}
          />
          
          {promoStatus !== 'applied' ? (
            <TouchableOpacity 
              style={styles.promoCodeButton}
              onPress={handleApplyPromoCode}
              disabled={promoStatus === 'checking'}
            >
              {promoStatus === 'checking' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.promoCodeButtonText}>Apply</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.promoClearButton}
              onPress={handleClearPromoCode}
            >
              <Text style={styles.promoClearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {promoStatus !== 'idle' && promoMessage && (
          <View style={[
            styles.promoMessageContainer,
            promoStatus === 'valid' || promoStatus === 'applied' 
              ? styles.promoMessageSuccess
              : promoStatus === 'invalid' || promoStatus === 'error'
                ? styles.promoMessageError
                : promoStatus === 'expired'
                  ? styles.promoMessageWarning
                  : {}
          ]}>
            <Text style={[
              styles.promoMessageText,
              promoStatus === 'valid' || promoStatus === 'applied'
                ? styles.promoMessageTextSuccess
                : promoStatus === 'invalid' || promoStatus === 'error'
                  ? styles.promoMessageTextError
                  : promoStatus === 'expired'
                    ? styles.promoMessageTextWarning
                    : {}
            ]}>
              {promoMessage}
            </Text>
          </View>
        )}
        
        {promoStatus === 'applied' && (
          <View style={styles.promoAppliedBadge}>
            <Text style={styles.promoAppliedBadgeText}>First month free</Text>
          </View>
        )}
      </View>
    );
  };
  
  const renderActionButtons = () => {
    if (!user) return null;
    if (subsLoading) {
      return (
        <View style={styles.actionButtonsContainer}>
          <ActivityIndicator color={ORANGE} />
        </View>
      );
    }
    
    // Use the currentSubscription from our mapped data if available
    const activeStatus = currentSubscription?.status === 'active' || subscriptionDetails?.status === 'active';
    const expiredStatus = currentSubscription?.status === 'expired' || subscriptionDetails?.status === 'expired';
    
    const isUpgrade = user.accountType === 'collector' || 
      (user.accountType === 'dealer' && selectedPlan?.type === SubscriptionPlanType.ORGANIZER);
      
    const isDowngrade = user.accountType === 'organizer' && 
      selectedPlan?.type === SubscriptionPlanType.DEALER;
      
    const isRenewal = user.accountType !== 'collector' && 
      ((user.accountType === 'dealer' && selectedPlan?.type === SubscriptionPlanType.DEALER) ||
       (user.accountType === 'organizer' && selectedPlan?.type === SubscriptionPlanType.ORGANIZER));
       
    const hasExpired = expiredStatus;
    
    let buttonText = 'Select a Plan';
    if (selectedPlan) {
      if (isUpgrade) buttonText = 'Upgrade';
      else if (isDowngrade) buttonText = 'Downgrade';
      else if (isRenewal) buttonText = hasExpired ? 'Reactivate' : 'Renew';
      else buttonText = 'Subscribe';
    }
    
    return (
      <View style={styles.actionButtonsContainer}>
        {user.accountType !== 'collector' && activeStatus && (
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={handleCancel}
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
            <Text style={styles.primaryButtonText}>{buttonText}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };
  
  const combinedLoading = loading || subsLoading;

  if (combinedLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ORANGE} />
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
      {renderPromoCodeSection()}
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

const styles = StyleSheet.create({
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
  promoAppliedText: {
    fontSize: 14,
    color: '#00AA00',
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
  },
  // Promo code styles
  promoCodeContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  promoCodeLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  promoCodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoCodeInput: {
    flex: 1,
    height: 48,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginRight: 8,
  },
  promoCodeInputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  promoCodeButton: {
    backgroundColor: '#0057B8',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoCodeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  promoClearButton: {
    backgroundColor: '#f0f0f0',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoClearButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  promoMessageContainer: {
    marginTop: 12,
    padding: 8,
    borderRadius: 4,
  },
  promoMessageSuccess: {
    backgroundColor: '#e6f7e6',
  },
  promoMessageError: {
    backgroundColor: '#ffe5e5',
  },
  promoMessageWarning: {
    backgroundColor: '#fff9e6',
  },
  promoMessageText: {
    fontSize: 14,
  },
  promoMessageTextSuccess: {
    color: '#00AA00',
  },
  promoMessageTextError: {
    color: '#cc0000',
  },
  promoMessageTextWarning: {
    color: '#cc7700',
  },
  promoAppliedBadge: {
    marginTop: 12,
    backgroundColor: '#00AA00',
    borderRadius: 4,
    padding: 8,
    alignSelf: 'flex-start',
  },
  promoAppliedBadgeText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default SubscriptionScreen;
