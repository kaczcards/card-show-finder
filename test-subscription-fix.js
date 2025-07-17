#!/usr/bin/env node
/**
 * test-subscription-fix.js
 * 
 * This script tests the subscription expiry date calculation to ensure:
 * - Annual plans add exactly 365 days
 * - Monthly plans add exactly 30 days
 * - Free trials are properly ignored during upgrades
 */

// Import required modules
const { SUBSCRIPTION_PLANS, calculateExpiryDate } = require('../src/services/subscriptionTypes');

// Helper function to calculate days between two dates
function daysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.round(diffMs / oneDay);
}

// Test function to verify expiry date calculation
function testExpiryCalculation(planId) {
  console.log(`\n🧪 Testing plan: ${planId}`);
  
  // Find the plan
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
  if (!plan) {
    console.error(`❌ Plan not found: ${planId}`);
    return false;
  }
  
  // Get current date (for baseline)
  const now = new Date();
  console.log(`   Current date: ${now.toISOString().split('T')[0]}`);
  
  // Calculate expiry date
  const expiryDate = calculateExpiryDate(plan);
  console.log(`   Expiry date:  ${expiryDate.toISOString().split('T')[0]}`);
  
  // Calculate actual days added
  const daysAdded = daysBetween(now, expiryDate);
  console.log(`   Days added:   ${daysAdded}`);
  
  // Verify the calculation based on plan duration
  let expectedDays = 0;
  let isCorrect = false;
  
  if (plan.id.includes('annual')) {
    expectedDays = 365;
    isCorrect = daysAdded === 365;
  } else if (plan.id.includes('monthly')) {
    expectedDays = 30;
    isCorrect = daysAdded === 30;
  }
  
  // Display result
  if (isCorrect) {
    console.log(`   ✅ PASS: Added exactly ${expectedDays} days as expected`);
  } else {
    console.log(`   ❌ FAIL: Expected ${expectedDays} days, but got ${daysAdded}`);
  }
  
  // Check if trial days were ignored (they should be)
  if (plan.trialDays && plan.trialDays > 0) {
    console.log(`   ℹ️ Plan has ${plan.trialDays} trial days, which should be ignored`);
    if (daysAdded !== plan.trialDays) {
      console.log(`   ✅ PASS: Trial days were correctly ignored`);
    } else {
      console.log(`   ❌ FAIL: Expiry matches trial days (${plan.trialDays}) instead of subscription duration`);
    }
  }
  
  return isCorrect;
}

// Main test function
function runTests() {
  console.log('🔍 SUBSCRIPTION EXPIRY DATE CALCULATION TEST');
  console.log('===========================================');
  
  // Test all subscription plans
  const testPlans = [
    'mvp-dealer-monthly',
    'mvp-dealer-annual',
    'show-organizer-monthly',
    'show-organizer-annual'
  ];
  
  // Run tests and collect results
  const results = testPlans.map(planId => ({
    planId,
    passed: testExpiryCalculation(planId)
  }));
  
  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('=============');
  
  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.planId}`);
  });
  
  const passedCount = results.filter(r => r.passed).length;
  console.log(`\n${passedCount} of ${results.length} tests passed`);
  
  // Verification of specific requirements
  console.log('\n🔍 VERIFICATION OF REQUIREMENTS');
  console.log('===========================');
  
  // Check Annual plans (365 days)
  const annualPlans = results.filter(r => r.planId.includes('annual'));
  const annualPassed = annualPlans.every(r => r.passed);
  console.log(`Annual plans (365 days): ${annualPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  // Check Monthly plans (30 days)
  const monthlyPlans = results.filter(r => r.planId.includes('monthly'));
  const monthlyPassed = monthlyPlans.every(r => r.passed);
  console.log(`Monthly plans (30 days): ${monthlyPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  // Overall result
  const allPassed = results.every(r => r.passed);
  console.log(`\nOverall result: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  return allPassed;
}

// Run the tests
const success = runTests();
process.exit(success ? 0 : 1);
