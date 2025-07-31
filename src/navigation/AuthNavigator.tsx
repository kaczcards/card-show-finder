import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import auth screens
import {
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  ResetPasswordScreen,
} from '../screens/Auth';

// Define navigation types for auth flow
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
};

// Create navigation stack
const _AuthStack = createNativeStackNavigator<AuthStackParamList>();

/**
 * AuthNavigator - Handles navigation between authentication screens
 * Includes Login, Register, and Forgot Password screens
 */
const AuthNavigator: React.FC = () => {
  return (
    <AuthStack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'white' },
        animation: 'slide_from_right',
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      {/* Use a render callback so TypeScript infers the correct prop types */}
      <AuthStack.Screen name="ResetPassword">
        {props => <ResetPasswordScreen {...props} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
};

export default AuthNavigator;
