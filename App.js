import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import ShowDetailsScreen from './src/screens/ShowDetailsScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MyShowsScreen from './src/screens/MyShowsScreen';
import CreateShowScreen from './src/screens/CreateShowScreen';

// Auth screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';

// Import the UserProvider and hooks
import { UserProvider, useUser } from './src/context/UserContext';

// Import the StripeProvider
import StripeProvider from './src/components/StripeProvider';

// Create navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main tab navigator
function MainTabNavigator() {
  // Access user profile to determine dealer role
  const { userProfile } = useUser();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Favorites') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'MyShows') {
            iconName = focused ? 'albums' : 'albums-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          display: 'flex'
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      {/* Dealer-only tab (previously Promoter) */}
      {userProfile?.role === 'dealer' && (
        <Tab.Screen
          name="MyShows"
          component={MyShowsScreen}
          options={{ title: 'My Shows' }}
        />
      )}
    </Tab.Navigator>
  );
}

// Auth stack navigator
const AuthStack = () => (
  <Stack.Navigator initialRouteName="Register">
    <Stack.Screen
      name="Login"
      component={LoginScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Register"
      component={RegisterScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="ProfileSetup"
      component={ProfileSetupScreen}
      initialParams={{ userId: null }}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

// Main stack navigator
const MainStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Main"
      component={MainTabNavigator}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="ShowDetails"
      component={ShowDetailsScreen}
      options={{ title: 'Show Details' }}
    />
    <Stack.Screen
      name="CreateShow"
      component={CreateShowScreen}
      options={{ title: 'Create / Edit Show' }}
    />
  </Stack.Navigator>
);

// App with authentication flow
function AppWithAuth() {
  const { currentUser, userProfile, loading } = useUser();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!currentUser ? (
        // Not logged in - show auth stack
        <AuthStack />
      ) : !userProfile?.profileCompleted ? (
        // Logged in but profile not completed - show profile setup
        <Stack.Navigator initialRouteName="ProfileSetup">
          <Stack.Screen
            name="ProfileSetup"
            component={ProfileSetupScreen}
            initialParams={{ userId: currentUser.uid }}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      ) : (
        // Logged in with completed profile - show main app
        <MainStack />
      )}
    </NavigationContainer>
  );
}

// Main App component
export default function App() {
  return (
    <UserProvider>
      <StripeProvider>
        <SafeAreaProvider>
          <AppWithAuth />
        </SafeAreaProvider>
      </StripeProvider>
    </UserProvider>
  );
}
