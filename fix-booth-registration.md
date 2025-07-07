# Fix for Dealer Booth Registration

This document provides a solution for the issue where booth information doesn't save when registering for a show.

## Problem Description

When a user with the MVP_DEALER role tries to register for a show and fill in booth information, the form doesn't save the information correctly. The user appears as registered for the show, but when clicking on their name, the booth information is blank.

## Root Causes Identified

We found two issues:

1. **Role Case Sensitivity**: The dealer service was checking for lowercase role values (`dealer` and `mvp_dealer`), but our UserRole enum was using uppercase (`DEALER` and `MVP_DEALER`).

2. **Missing Booth Information in Registration**: The `registerForShow` function in `dealerService.ts` was only inserting the basic columns (userid and showid) but not any of the dealer-specific information like booth details, card types, etc.

## Solutions Applied

### 1. Added Role Case Normalization

We added a `normalizeRole` helper function to convert any role string to the proper UserRole enum value, handling both uppercase and lowercase roles correctly:

```typescript
const normalizeRole = (role: string | null | undefined): UserRole | null => {
  if (!role) return null;
  const upper = role.toUpperCase() as UserRole;
  return Object.values(UserRole).includes(upper) ? upper : null;
};
```

### 2. Fixed Booth Information Registration

We updated the `registerForShow` function to include all the booth information fields when creating a new participation record:

```typescript
// Insert new participation record
const insertData: Record<string, any> = {
  userid: userId,
  showid: participationData.showId,
  status: 'registered',
};

// Map optional fields if provided
if (participationData.cardTypes !== undefined) insertData.card_types = participationData.cardTypes;
if (participationData.specialty !== undefined) insertData.specialty = participationData.specialty;
if (participationData.priceRange !== undefined) insertData.price_range = participationData.priceRange;
if (participationData.notableItems !== undefined) insertData.notable_items = participationData.notableItems;
if (participationData.boothLocation !== undefined) insertData.booth_location = participationData.boothLocation;
if (participationData.paymentMethods !== undefined) insertData.payment_methods = participationData.paymentMethods;
if (participationData.openToTrades !== undefined) insertData.open_to_trades = participationData.openToTrades;
if (participationData.buyingCards !== undefined) insertData.buying_cards = participationData.buyingCards;
```

### 3. Removed Validation That May Be Blocking Registration

The registration form has validation that requires selecting at least one card type and payment method. If your database doesn't have these columns yet, this validation might be blocking registration.

To fix this, you have two options:

#### Option A: Update Database Schema
Make sure your database has the necessary columns by running the migration script:

```sql
-- Run this in Supabase SQL Editor if you haven't already
-- Make sure your show_participants table has these columns
ALTER TABLE public.show_participants 
ADD COLUMN IF NOT EXISTS card_types TEXT[] DEFAULT '{}';

ALTER TABLE public.show_participants 
ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT '{}';

ALTER TABLE public.show_participants 
ADD COLUMN IF NOT EXISTS specialty TEXT;

ALTER TABLE public.show_participants 
ADD COLUMN IF NOT EXISTS price_range VARCHAR(20);

ALTER TABLE public.show_participants 
ADD COLUMN IF NOT EXISTS notable_items TEXT;

ALTER TABLE public.show_participants 
ADD COLUMN IF NOT EXISTS booth_location TEXT;

ALTER TABLE public.show_participants 
ADD COLUMN IF NOT EXISTS open_to_trades BOOLEAN DEFAULT FALSE;

ALTER TABLE public.show_participants 
ADD COLUMN IF NOT EXISTS buying_cards BOOLEAN DEFAULT FALSE;

ALTER TABLE public.show_participants 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'registered';
```

#### Option B: Make Validation Conditional

Update the `handleRegister` function in `ShowParticipationScreen.tsx` to only validate if the form data is being used:

```typescript
// Submit registration
const handleRegister = async () => {
  if (!user || !selectedShow) return;
  
  try {
    // Skip validation if the data isn't required
    const requireValidation = true; // Set this based on your app's requirements
    
    if (requireValidation) {
      if (formData.cardTypes && formData.cardTypes.length === 0) {
        Alert.alert('Error', 'Please select at least one card type');
        return;
      }
      
      if (formData.paymentMethods && formData.paymentMethods.length === 0) {
        Alert.alert('Error', 'Please select at least one payment method');
        return;
      }
    }
    
    const { data, error } = await registerForShow(user.id, formData);
    
    if (error) {
      Alert.alert('Registration Failed', error);
      return;
    }
    
    Alert.alert('Success', 'You have successfully registered for this show');
    setRegistrationModalVisible(false);
    loadDealerShows();
    loadAvailableShows();
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Failed to register for show');
  }
};
```

## Testing the Fix

After applying these fixes:

1. Try registering for a show as an MVP Dealer
2. Fill out all the booth information fields
3. Save the registration
4. Go to the show details and click on your name to verify the booth information is displayed correctly

If you're still having issues, check for any console errors and make sure the database has the necessary columns.
