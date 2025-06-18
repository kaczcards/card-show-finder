import AuthNavigator, { AuthStackParamList } from './AuthNavigator';
import MainTabNavigator, { MainTabParamList } from './MainTabNavigator';
import MainNavigator, { MainStackParamList } from './MainNavigator';
import RootNavigator from './RootNavigator';

// Export all navigators
export {
  AuthNavigator,
  MainTabNavigator,
  MainNavigator,
  RootNavigator
};

// Export navigation types
export type {
  AuthStackParamList,
  MainTabParamList,
  MainStackParamList
};

// Default export for the root navigator
export default RootNavigator;
