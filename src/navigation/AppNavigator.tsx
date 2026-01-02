import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { AdvisorDashboard } from '../screens/advisor/AdvisorDashboard';
import { PlayerOverviewScreen } from '../screens/advisor/PlayerOverviewScreen';
import { PlayerDetailScreen } from '../screens/advisor/PlayerDetailScreen';
import { MyProfileScreen } from '../screens/advisor/MyProfileScreen';
import { AdminPanelScreen } from '../screens/advisor/AdminPanelScreen';
import { TermineScreen } from '../screens/advisor/TermineScreen';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <Stack.Navigator 
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="AdvisorDashboard" component={AdvisorDashboard} />
      <Stack.Screen name="PlayerOverview" component={PlayerOverviewScreen} />
      <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
      <Stack.Screen name="MyProfile" component={MyProfileScreen} />
      <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
      <Stack.Screen name="Calendar" component={TermineScreen} />
    </Stack.Navigator>
  );
}
