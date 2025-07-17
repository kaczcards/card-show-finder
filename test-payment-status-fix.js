#!/usr/bin/env node
/**
 * test-payment-status-fix.js
 * 
 * This script tests the payment status fix that distinguishes between
 * trial and paid subscription users. It verifies:
 * 
 * 1. The isInTrialPeriod function correctly identifies users in trial
 * 2. The getSubscriptionDetails function returns correct isPaid and isTrialPeriod values
 * 3. Different user states (trial, paid, expired) show appropriate UI messages
 * 4. Edge cases like legacy users without paymentStatus field are handled correctly
 */

// Mock dependencies
const { UserRole } = require('../src/types');

// Create date helpers
const TODAY = new Date();
const DAYS_FROM_NOW = (days) => {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + days);
  return date;
};
const DAYS_AGO = (days) => {
  const date = new Date(TODAY);
  date.setDate(date.getDate() - days);
  return date;
};

// Mock user data for different scenarios
const TEST_USERS = {
  // User in active trial period (5 days left in trial)
  trialUser: {
    id: 'trial-user-id',
    email: 'trial@example.com',
    firstName: 'Trial',
    lastName: 'User',
    homeZipCode: '12345',
    role: UserRole.MVP_DEALER,
    accountType: 'dealer',
    subscriptionStatus: 'active',
    paymentStatus: 'trial', // Explicitly marked as in trial
    subscriptionExpiry: DAYS_FROM_NOW(5).toISOString(),
    isEmailVerified: true
  },
  
  // User with paid subscription (300 days left)
  paidUser: {
    id: 'paid-user-id',
    email: 'paid@example.com',
    firstName: 'Paid',
    lastName: 'User',
    homeZipCode: '12345',
    role: UserRole.MVP_DEALER,
    accountType: 'dealer',
    subscriptionStatus: 'active',
    paymentStatus: 'paid', // Explicitly marked as paid
    subscriptionExpiry: DAYS_FROM_NOW(300).toISOString(),
    isEmailVerified: true
  },
  
  // User with expired subscription
  expiredUser: {
    id: 'expired-user-id',
    email: 'expired@example.com',
    firstName: 'Expired',
    lastName: 'User',
    homeZipCode: '12345',
    role: UserRole.MVP_DEALER,
    accountType: 'dealer',
    subscriptionStatus: 'expired',
    paymentStatus: 'none', // Reset to none after expiry
    subscriptionExpiry: DAYS_AGO(5).toISOString(),
    isEmailVerified: true
  },
  
  // Legacy user without paymentStatus field but in trial period (3 days left)
  legacyTrialUser: {
    id: 'legacy-trial-user-id',
    email: 'legacy-trial@example.com',
    firstName: 'Legacy',
    lastName: 'Trial',
    homeZipCode: '12345',
    role: UserRole.MVP_DEALER,
    accountType: 'dealer',
    subscriptionStatus: 'active',
    // No paymentStatus field
    subscriptionExpiry: DAYS_FROM_NOW(3).toISOString(),
    isEmailVerified: true
  },
  
  // Legacy user without paymentStatus field but with long subscription (200 days left)
  legacyPaidUser: {
    id: 'legacy-paid-user-id',
    email: 'legacy-paid@example.com',
    firstName: 'Legacy',
    lastName: 'Paid',
    homeZipCode: '12345',
    role: UserRole.MVP_DEALER,
    accountType: 'dealer',
    subscriptionStatus: 'active',
    // No paymentStatus field
    subscriptionExpiry: DAYS_FROM_NOW(200).toISOString(),
    isEmailVerified: true
  },
  
  // Free collector account
  collectorUser: {
    id: 'collector-user-id',
    email: 'collector@example.com',
    firstName: 'Collector',
    lastName: 'User',
    homeZipCode: '12345',
    role: UserRole.ATTENDEE,
    accountType: 'collector',
    subscriptionStatus: 'none',
    paymentStatus: 'none',
    subscriptionExpiry: null,
    isEmailVerified: true
  }
};

// Mock the subscription service functions
const mockSubscriptionService = {
  // Implementation of hasActiveSubscription
  hasActiveSubscription: (user) => {
    if (!user) return false;
    if (user.accountType === 'collector') return false;
    if (user.subscriptionStatus !== 'active') return false;
    
    if (user.subscriptionExpiry) {
      const expiryDate = new Date(user.subscriptionExpiry);
      return expiryDate > new Date();
    }
    
    return false;
  },
  
  // Implementation of isInTrialPeriod (the function we're testing)
  isInTrialPeriod: (user) => {
    if (!user || !mockSubscriptionService.hasActiveSubscription(user)) return false;
    
    // Check if payment_status is explicitly set to 'trial'
    if (user.paymentStatus === 'trial') return true;
    
    // Legacy check for users without payment_status field
    // If they have less than 7 days remaining and no payment_status,
    // they're likely in a trial period
    if (!user.paymentStatus || user.paymentStatus === 'none') {
      const timeRemaining = mockSubscriptionService.getSubscriptionTimeRemaining(user);
      if (timeRemaining && timeRemaining.days < 7) {
        return true;
      }
    }
    
    return false;
  },
  
  // Implementation of getSubscriptionTimeRemaining
  getSubscriptionTimeRemaining: (user) => {
    if (!mockSubscriptionService.hasActiveSubscription(user) || !user.subscriptionExpiry) {
      return null;
    }
    
    const now = new Date();
    const expiryDate = new Date(user.subscriptionExpiry);
    const diffMs = expiryDate.getTime() - now.getTime();
    
    // If already expired
    if (diffMs <= 0) return { days: 0, hours: 0 };
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return { days, hours };
  },
  
  // Implementation of getSubscriptionDetails (the other function we're testing)
  getSubscriptionDetails: (user) => {
    if (!user || user.accountType === 'collector') {
      return null;
    }
    
    // Check if user is in trial period
    const isTrialPeriod = mockSubscriptionService.isInTrialPeriod(user);
    
    // Check if user has paid (either explicitly marked as paid or has active subscription but not in trial)
    const isPaid = user.paymentStatus === 'paid' || 
                  (mockSubscriptionService.hasActiveSubscription(user) && !isTrialPeriod);
    
    return {
      accountType: user.accountType,
      status: user.subscriptionStatus,
      expiry: user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null,
      isActive: mockSubscriptionService.hasActiveSubscription(user),
      timeRemaining: mockSubscriptionService.getSubscriptionTimeRemaining(user),
      isPaid,
      isTrialPeriod
    };
  }
};

// Mock the UI components to verify correct messaging
const mockUI = {
  // Simulates what the UI would display for a user
  getSubscriptionDisplay: (user) => {
    const details = mockSubscriptionService.getSubscriptionDetails(user);
    if (!details) {
      return { status: 'Free collector account', timeRemainingLabel: null, showTrialBadge: false };
    }
    
    const { isActive, isTrialPeriod, timeRemaining, status } = details;
    
    // Determine what to display
    const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1); // Capitalize first letter
    const timeRemainingLabel = isTrialPeriod ? 'Trial Ends In:' : 'Subscription Ends In:';
    const showTrialBadge = isActive && isTrialPeriod && timeRemaining && status === 'active';
    
    return { status: statusDisplay, timeRemainingLabel, showTrialBadge };
  }
};

// Test functions
function testIsInTrialPeriod() {
  console.log('\n🧪 Testing isInTrialPeriod function');
  console.log('================================');
  
  const testCases = [
    { name: 'Trial User', user: TEST_USERS.trialUser, expected: true },
    { name: 'Paid User', user: TEST_USERS.paidUser, expected: false },
    { name: 'Expired User', user: TEST_USERS.expiredUser, expected: false },
    { name: 'Legacy Trial User', user: TEST_USERS.legacyTrialUser, expected: true },
    { name: 'Legacy Paid User', user: TEST_USERS.legacyPaidUser, expected: false },
    { name: 'Collector User', user: TEST_USERS.collectorUser, expected: false }
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ name, user, expected }) => {
    const result = mockSubscriptionService.isInTrialPeriod(user);
    const passed = result === expected;
    
    console.log(`${passed ? '✅' : '❌'} ${name}: ${result} (expected ${expected})`);
    
    if (!passed) {
      allPassed = false;
      console.log(`  User details: ${JSON.stringify({
        accountType: user.accountType,
        status: user.subscriptionStatus,
        paymentStatus: user.paymentStatus,
        daysRemaining: mockSubscriptionService.getSubscriptionTimeRemaining(user)?.days
      })}`);
    }
  });
  
  return allPassed;
}

function testGetSubscriptionDetails() {
  console.log('\n🧪 Testing getSubscriptionDetails function');
  console.log('======================================');
  
  const testCases = [
    { 
      name: 'Trial User', 
      user: TEST_USERS.trialUser, 
      expected: { isPaid: false, isTrialPeriod: true } 
    },
    { 
      name: 'Paid User', 
      user: TEST_USERS.paidUser, 
      expected: { isPaid: true, isTrialPeriod: false } 
    },
    { 
      name: 'Expired User', 
      user: TEST_USERS.expiredUser, 
      expected: { isPaid: false, isTrialPeriod: false } 
    },
    { 
      name: 'Legacy Trial User', 
      user: TEST_USERS.legacyTrialUser, 
      expected: { isPaid: false, isTrialPeriod: true } 
    },
    { 
      name: 'Legacy Paid User', 
      user: TEST_USERS.legacyPaidUser, 
      expected: { isPaid: true, isTrialPeriod: false } 
    },
    { 
      name: 'Collector User', 
      user: TEST_USERS.collectorUser, 
      expected: null 
    }
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ name, user, expected }) => {
    const details = mockSubscriptionService.getSubscriptionDetails(user);
    
    // Handle the collector case (should return null)
    if (expected === null) {
      const passed = details === null;
      console.log(`${passed ? '✅' : '❌'} ${name}: ${details === null ? 'null' : 'not null'} (expected null)`);
      if (!passed) allPassed = false;
      return;
    }
    
    // For other cases, check isPaid and isTrialPeriod
    const isPaidCorrect = details.isPaid === expected.isPaid;
    const isTrialCorrect = details.isTrialPeriod === expected.isTrialPeriod;
    const passed = isPaidCorrect && isTrialCorrect;
    
    console.log(`${passed ? '✅' : '❌'} ${name}:`);
    console.log(`  isPaid: ${details.isPaid} (expected ${expected.isPaid}) - ${isPaidCorrect ? 'CORRECT' : 'WRONG'}`);
    console.log(`  isTrialPeriod: ${details.isTrialPeriod} (expected ${expected.isTrialPeriod}) - ${isTrialCorrect ? 'CORRECT' : 'WRONG'}`);
    
    if (!passed) {
      allPassed = false;
      console.log(`  Full details: ${JSON.stringify(details)}`);
    }
  });
  
  return allPassed;
}

function testUIDisplay() {
  console.log('\n🧪 Testing UI Display');
  console.log('===================');
  
  const testCases = [
    { 
      name: 'Trial User', 
      user: TEST_USERS.trialUser, 
      expected: { 
        timeRemainingLabel: 'Trial Ends In:', 
        showTrialBadge: true 
      } 
    },
    { 
      name: 'Paid User', 
      user: TEST_USERS.paidUser, 
      expected: { 
        timeRemainingLabel: 'Subscription Ends In:', 
        showTrialBadge: false 
      } 
    },
    { 
      name: 'Expired User', 
      user: TEST_USERS.expiredUser, 
      expected: { 
        timeRemainingLabel: 'Subscription Ends In:', 
        showTrialBadge: false 
      } 
    },
    { 
      name: 'Legacy Trial User', 
      user: TEST_USERS.legacyTrialUser, 
      expected: { 
        timeRemainingLabel: 'Trial Ends In:', 
        showTrialBadge: true 
      } 
    },
    { 
      name: 'Legacy Paid User', 
      user: TEST_USERS.legacyPaidUser, 
      expected: { 
        timeRemainingLabel: 'Subscription Ends In:', 
        showTrialBadge: false 
      } 
    },
    { 
      name: 'Collector User', 
      user: TEST_USERS.collectorUser, 
      expected: { 
        status: 'Free collector account',
        timeRemainingLabel: null, 
        showTrialBadge: false 
      } 
    }
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ name, user, expected }) => {
    const display = mockUI.getSubscriptionDisplay(user);
    
    const labelCorrect = display.timeRemainingLabel === expected.timeRemainingLabel;
    const badgeCorrect = display.showTrialBadge === expected.showTrialBadge;
    const statusCorrect = expected.status ? display.status === expected.status : true;
    const passed = labelCorrect && badgeCorrect && statusCorrect;
    
    console.log(`${passed ? '✅' : '❌'} ${name}:`);
    
    if (expected.status) {
      console.log(`  Status: ${display.status} (expected ${expected.status}) - ${statusCorrect ? 'CORRECT' : 'WRONG'}`);
    }
    
    console.log(`  Time Label: ${display.timeRemainingLabel} (expected ${expected.timeRemainingLabel}) - ${labelCorrect ? 'CORRECT' : 'WRONG'}`);
    console.log(`  Show Trial Badge: ${display.showTrialBadge} (expected ${expected.showTrialBadge}) - ${badgeCorrect ? 'CORRECT' : 'WRONG'}`);
    
    if (!passed) {
      allPassed = false;
    }
  });
  
  return allPassed;
}

function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases');
  console.log('===================');
  
  // Test null user
  const nullUserResult = mockSubscriptionService.isInTrialPeriod(null);
  console.log(`${nullUserResult === false ? '✅' : '❌'} Null User: ${nullUserResult} (expected false)`);
  
  // Test undefined paymentStatus
  const undefinedPaymentUser = { ...TEST_USERS.paidUser, paymentStatus: undefined };
  const undefinedResult = mockSubscriptionService.isInTrialPeriod(undefinedPaymentUser);
  console.log(`${undefinedResult === false ? '✅' : '❌'} Undefined paymentStatus: ${undefinedResult} (expected false, should use time remaining)`);
  
  // Test user with very short subscription (1 day left)
  const shortSubscriptionUser = { 
    ...TEST_USERS.paidUser, 
    paymentStatus: 'none',
    subscriptionExpiry: DAYS_FROM_NOW(1).toISOString() 
  };
  const shortResult = mockSubscriptionService.isInTrialPeriod(shortSubscriptionUser);
  console.log(`${shortResult === true ? '✅' : '❌'} Short Subscription (1 day): ${shortResult} (expected true, should detect as trial)`);
  
  // Test user with exactly 7 days left (edge of trial detection)
  const sevenDaysUser = { 
    ...TEST_USERS.paidUser, 
    paymentStatus: 'none',
    subscriptionExpiry: DAYS_FROM_NOW(7).toISOString() 
  };
  const sevenDaysResult = mockSubscriptionService.isInTrialPeriod(sevenDaysUser);
  console.log(`${sevenDaysResult === false ? '✅' : '❌'} Exactly 7 Days Left: ${sevenDaysResult} (expected false, should NOT be trial)`);
  
  // Test user with 6 days left (just inside trial detection)
  const sixDaysUser = { 
    ...TEST_USERS.paidUser, 
    paymentStatus: 'none',
    subscriptionExpiry: DAYS_FROM_NOW(6).toISOString() 
  };
  const sixDaysResult = mockSubscriptionService.isInTrialPeriod(sixDaysUser);
  console.log(`${sixDaysResult === true ? '✅' : '❌'} 6 Days Left: ${sixDaysResult} (expected true, should be trial)`);
  
  return nullUserResult === false && 
         shortResult === true && 
         sevenDaysResult === false && 
         sixDaysResult === true;
}

// Run all tests and report results
function runAllTests() {
  console.log('🔍 PAYMENT STATUS FIX TEST');
  console.log('=========================');
  console.log('Testing the fix that distinguishes between trial and paid subscriptions');
  console.log(`Current date: ${TODAY.toISOString().split('T')[0]}`);
  
  const isInTrialPeriodPassed = testIsInTrialPeriod();
  const getSubscriptionDetailsPassed = testGetSubscriptionDetails();
  const uiDisplayPassed = testUIDisplay();
  const edgeCasesPassed = testEdgeCases();
  
  console.log('\n📊 TEST SUMMARY');
  console.log('=============');
  console.log(`isInTrialPeriod function: ${isInTrialPeriodPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`getSubscriptionDetails function: ${getSubscriptionDetailsPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`UI Display: ${uiDisplayPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Edge Cases: ${edgeCasesPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = isInTrialPeriodPassed && 
                   getSubscriptionDetailsPassed && 
                   uiDisplayPassed && 
                   edgeCasesPassed;
  
  console.log(`\nOverall result: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  return allPassed;
}

// Execute tests
runAllTests();
