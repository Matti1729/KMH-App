import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen, RegisterScreen, RegisterAdvisorScreen } from '../screens/auth';
import { PlayerHomeScreen } from '../screens/player';
import { AdvisorHomeScreen } from '../screens/advisor';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="RegisterAdvisor" component={RegisterAdvisorScreen} />
          </>
        ) : profile?.role === 'advisor' ? (
          <Stack.Screen name="AdvisorHome" component={AdvisorHomeScreen} />
        ) : (
          <Stack.Screen name="PlayerHome" component={PlayerHomeScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
