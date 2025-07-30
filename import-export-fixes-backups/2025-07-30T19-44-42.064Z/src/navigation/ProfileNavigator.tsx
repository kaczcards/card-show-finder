import React from 'react';
import { _createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens
import { _ProfileScreen } from '../screens/Profile';
import _SubscriptionScreen from '../screens/Profile/_SubscriptionScreen';
import _ShowParticipationScreen from '../screens/Dealer/_ShowParticipationScreen';

// Define navigation types for profile stack
export type ProfileStackParamList = {
  ProfileMain: undefined;
  SubscriptionScreen: undefined;
  ShowParticipationScreen: undefined;
};

// Create navigation stack
const _ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

/**
 * ProfileNavigator - Stack navigator for the Profile section
 * Includes the main profile screen and subscription management
 */
const ProfileNavigator: React.FC = () => {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen 
        name="ProfileMain" 
        component={_ProfileScreen} 
        options={{ 
          headerShown: true,
          title: 'My Profile',
        }}
      />
      <ProfileStack.Screen
        name="ShowParticipationScreen"
        component={_ShowParticipationScreen}
        options={{
          headerShown: true,
          title: 'Dealer Show Registration',
          animation: 'slide_from_right',
          headerBackTitle: 'Profile',
        }}
      />
      <ProfileStack.Screen 
        name="SubscriptionScreen" 
        component={_SubscriptionScreen} 
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
