import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import MessagesScreen from './MessagesScreen';
import DirectMessagesScreen from './DirectMessagesScreen';

const Stack = createStackNavigator();

const MessagesNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessagesScreen" component={MessagesScreen} />
      <Stack.Screen name="DirectMessages" component={DirectMessagesScreen} />
    </Stack.Navigator>
  );
};

export default MessagesNavigator;
