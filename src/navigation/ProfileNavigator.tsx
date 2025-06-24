import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens
import { ProfileScreen } from '../screens/Profile';
import SubscriptionScreen from '../screens/Profile/SubscriptionScreen';
import { DealerProfileScreen } from '../screens/Dealer';

// Define navigation types for profile stack
export type ProfileStackParamList = {
  ProfileMain: undefined;
  SubscriptionScreen: undefined;
};

// Create navigation stack
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

/**
 * ProfileNavigator - Stack navigator for the Profile section
 * Includes the main profile screen and subscription management
 */
const ProfileNavigator: React.FC = () => {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen 
        name="ProfileMain" 
        component={ProfileScreen} 
        options={{ 
          headerShown: true,
          title: 'My Profile',
        }}
      />
	<ProfileStack.Screen 
  name="DealerProfileScreen" 
  component={DealerProfileScreen} 
  options={{ 
    headerShown: true,
    title: 'Dealer Profile',
    animation: 'slide_from_right',
    headerBackTitle: 'Profile'
  }}
/>
      <ProfileStack.Screen 
        name="SubscriptionScreen" 
        component={SubscriptionScreen} 
        options={{ 
          headerShown: true,
          title: 'Subscription Management',
          animation: 'slide_from_right',
          headerBackTitle: 'Profile'
        }}
      />
    </ProfileStack.Navigator>
  );
};

export default ProfileNavigator;
