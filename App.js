import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import your existing screens
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import ShowDetailsScreen from './src/screens/ShowDetailsScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Import new auth screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';

// Import the UserProvider
import { UserProvider } from './src/context/UserContext';

// Import the StripeProvider
import StripeProvider from './src/components/StripeProvider';

// Create navigators - only once
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main tab navigator
function MainTabNavigator() {
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
    </Tab.Navigator>
  );
}

// SINGLE App function with merged functionality
export default function App() {
  return (
    <UserProvider>
      <StripeProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Main">
              {/* Auth screens */}
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
                options={{ headerShown: false }}
              />
              
              {/* Main app */}
              <Stack.Screen 
                name="Main" 
                component={MainTabNavigator}
                options={{ headerShown: false }}
              />
              
              {/* Other screens */}
              <Stack.Screen 
                name="ShowDetails" 
                component={ShowDetailsScreen}
                options={{ title: "Show Details" }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </StripeProvider>
    </UserProvider>
  );
}
