import React from 'react';
import { StatusBar, View, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { RootNavigator } from './src/navigation';

// Wrapper component to apply theme to StatusBar
function ThemedApp() {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={Platform.OS === 'android'}
      />
      {/* Extra View for iOS status bar background */}
      {Platform.OS === 'ios' && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 50,
          backgroundColor: colors.background,
          zIndex: -1
        }} />
      )}
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
