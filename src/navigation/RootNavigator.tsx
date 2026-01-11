import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen, RegisterScreen, RegisterAdvisorScreen } from '../screens/auth';
import { PlayerHomeScreen } from '../screens/player';
import { AdvisorHomeScreen, PlayerOverviewScreen, MyProfileScreen, AdminPanelScreen } from '../screens/advisor';
import { PlayerDetailScreen } from '../screens/advisor/PlayerDetailScreen';
import { TermineScreen } from '../screens/advisor/TermineScreen';
import { ScoutingScreen } from '../screens/advisor/ScoutingScreen';
import { TransfersScreen } from '../screens/advisor/TransfersScreen';
import { TransferDetailScreen } from '../screens/advisor/TransferDetailScreen';
import { TasksRemindersScreen } from '../screens/advisor/TasksRemindersScreen';
import { FootballNetworkScreen } from '../screens/advisor/FootballNetworkScreen';

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
        ) : (profile?.role === 'advisor' || profile?.role === 'admin') ? (
          <>
            <Stack.Screen name="AdvisorHome" component={AdvisorHomeScreen} />
            <Stack.Screen name="AdvisorDashboard" component={AdvisorHomeScreen} />
            <Stack.Screen name="PlayerOverview" component={PlayerOverviewScreen} />
            <Stack.Screen 
              name="PlayerDetail" 
              component={PlayerDetailScreen} 
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
              }}
            />
            <Stack.Screen name="MyProfile" component={MyProfileScreen} />
            <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
            <Stack.Screen name="Calendar" component={TermineScreen} />
            <Stack.Screen name="Scouting" component={ScoutingScreen} />
            <Stack.Screen name="Transfers" component={TransfersScreen} />
            <Stack.Screen 
              name="TransferDetail" 
              component={TransferDetailScreen} 
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
              }}
            />
            <Stack.Screen name="Tasks" component={TasksRemindersScreen} />
            <Stack.Screen name="FootballNetwork" component={FootballNetworkScreen} />
          </>
        ) : (
          <Stack.Screen name="PlayerHome" component={PlayerHomeScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
