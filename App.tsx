import React, { useEffect } from 'react';
import { StatusBar, View, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { GameSyncProvider } from './src/contexts/GameSyncContext';
import { DialogProvider } from './src/components/DialogProvider';
import { RootNavigator } from './src/navigation';

// Wrapper component to apply theme to StatusBar
function ThemedApp() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    // Scrollbar global stylen.
    // Bisher waren Scrollbars per CSS komplett ausgeblendet — auf Mac mit Trackpad
    // kein Problem, auf Windows mit Maus aber UX-blockierend (User sieht nicht, wo
    // er scrollen kann/muss). Jetzt: schlanker, theme-passender Balken auf Desktop
    // (≥ 768 px), Mobile-Web bleibt System-Default.
    // ID umbenannt, damit alte Hot-Reload-Caches mit "kmh-scrollbar-hide" überschrieben werden.
    document.getElementById('kmh-scrollbar-hide')?.remove();
    if (!document.getElementById('kmh-scrollbar-style')) {
      const style = document.createElement('style');
      style.id = 'kmh-scrollbar-style';
      style.textContent = `
        @media (min-width: 768px) {
          *::-webkit-scrollbar { width: 10px; height: 10px; }
          *::-webkit-scrollbar-track { background: transparent; }
          *::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.22);
            border-radius: 8px;
            border: 2px solid transparent;
            background-clip: padding-box;
          }
          *::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.4);
            background-clip: padding-box;
          }
          * {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Josefin Sans (Google Fonts)
    if (!document.getElementById('kmh-google-fonts')) {
      const link = document.createElement('link');
      link.id = 'kmh-google-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@100;200;300;400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

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
        <GameSyncProvider>
          <DialogProvider>
            <RootNavigator />
          </DialogProvider>
        </GameSyncProvider>
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
