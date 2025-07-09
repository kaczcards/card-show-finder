import AuthNavigator, { AuthStackParamList } from './AuthNavigator';
import MainTabNavigator, { MainTabParamList } from './MainTabNavigator';
import MainNavigator, { MainStackParamList } from './MainNavigator';
import AdminNavigator, { AdminStackParamList } from './AdminNavigator';
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
