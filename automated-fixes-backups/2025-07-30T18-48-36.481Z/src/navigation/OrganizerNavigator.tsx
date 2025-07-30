import React from 'react';
import { _createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens
import OrganizerDashboardScreen from '../screens/Organizer/OrganizerDashboardScreen';
import OrganizerReviewsScreen from '../screens/Organizer/OrganizerReviewsScreen';
import AddShowScreen from '../screens/Organizer/AddShowScreen';

// These screens will be implemented later
// Declaring them as placeholders for navigation
const _SeriesDetailScreen = () => null;
const _EditShowScreen = () => null;

// Define navigation types for organizer stack
export type OrganizerStackParamList = {
  Dashboard: undefined;
  Reviews: undefined;
  SeriesDetail: { seriesId: string };
  AddShow: { seriesId?: string };
  EditShow: { showId: string };
  /**
   * Screen for sending a pre- or post-show broadcast message.
   * Optional seriesId when triggered from a Show Series context.
   */
  SendBroadcast: { showId: string; seriesId?: string };
};

const _OrganizerStack = createNativeStackNavigator<OrganizerStackParamList>();

/**
 * OrganizerNavigator - Handles navigation between organizer screens
 */
const OrganizerNavigator: React.FC = () => {
  return (
    <OrganizerStack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0057B8',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        // Use `contentStyle` for the default background of screens
        contentStyle: {
          backgroundColor: '#F5F5F5',
        },
      }}
    >
      <OrganizerStack.Screen
        name="Dashboard"
        component={_OrganizerDashboardScreen}
        options={{
          title: 'Organizer Dashboard',
          headerShown: false, // Hide header as the screen has its own header
        }}
      />
      <OrganizerStack.Screen
        name="Reviews"
        component={_OrganizerReviewsScreen}
        options={{
          title: 'Manage Reviews',
        }}
      />
      <OrganizerStack.Screen
        name="SeriesDetail"
        component={_SeriesDetailScreen}
        options={{
          title: 'Series Details',
        }}
      />
      <OrganizerStack.Screen
        name="AddShow"
        component={_AddShowScreen}
        options={{
          title: 'Add New Show',
        }}
      />
      <OrganizerStack.Screen
        name="EditShow"
        component={_EditShowScreen}
        options={{
          title: 'Edit Show',
        }}
      />
    </OrganizerStack.Navigator>
  );
};

export default OrganizerNavigator;
