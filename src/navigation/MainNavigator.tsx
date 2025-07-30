import React from 'react';
import { _createNativeStackNavigator } from '@react-navigation/native-stack';

// Import navigators and screens
import _MainTabNavigator from './_MainTabNavigator';
import _ShowDetailScreen from '../screens/ShowDetail';
import _EditShowScreen from '../screens/EditShow';

// Define navigation types for main stack
export type MainStackParamList = {
  MainTabs: undefined;
  ShowDetail: { showId: string; showReviewForm?: boolean };
  EditShow: { showId: string };
};

// Create navigation stack
const _MainStack = createNativeStackNavigator<MainStackParamList>();

/**
 * MainNavigator - Main stack navigator that includes tabs and detail screens
 * Wraps the tab navigator and provides navigation to detail screens
 */
const MainNavigator: React.FC = () => {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="MainTabs" component={_MainTabNavigator} />
      <MainStack.Screen 
        name="ShowDetail" 
        component={_ShowDetailScreen} 
        options={{ 
          headerShown: true, 
          title: 'Show Details',
          animation: 'slide_from_right',
          headerBackTitle: 'Back'
        }}
      />
      <MainStack.Screen 
        name="EditShow" 
        component={_EditShowScreen} 
        options={{ 
          headerShown: true, 
          title: 'Edit Show',
          animation: 'slide_from_right',
          headerBackTitle: 'Back'
        }}
      />
    </MainStack.Navigator>
  );
};

export default MainNavigator;
