import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import navigators and screens
import MainTabNavigator from './MainTabNavigator';
import ShowDetailScreen from '../screens/ShowDetail';

// Define navigation types for main stack
export type MainStackParamList = {
  MainTabs: undefined;
  ShowDetail: { showId: string; showReviewForm?: boolean };
};

// Create navigation stack
const MainStack = createNativeStackNavigator<MainStackParamList>();

/**
 * MainNavigator - Main stack navigator that includes tabs and detail screens
 * Wraps the tab navigator and provides navigation to detail screens
 */
const MainNavigator: React.FC = () => {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="MainTabs" component={MainTabNavigator} />
      <MainStack.Screen 
        name="ShowDetail" 
        component={ShowDetailScreen} 
        options={{ 
          headerShown: true, 
          title: 'Show Details',
          animation: 'slide_from_right',
          headerBackTitle: 'Back'
        }}
      />
    </MainStack.Navigator>
  );
};

export default MainNavigator;
