import AuthNavigator, { _AuthStackParamList } from './AuthNavigator';
import MainTabNavigator, { _MainTabParamList } from './MainTabNavigator';
import MainNavigator, { _MainStackParamList } from './MainNavigator';
import AdminNavigator, { _AdminStackParamList } from './AdminNavigator';
import RootNavigator from './RootNavigator';

// Export all navigators
export {
  AuthNavigator,
  MainTabNavigator,
  MainNavigator,
  AdminNavigator,
  RootNavigator
};

// Export navigation types
export type {
  AuthStackParamList,
  MainTabParamList,
  MainStackParamList,
  AdminStackParamList
};

// Default export for the root navigator
export default RootNavigator;
