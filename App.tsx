import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import { RootNavigator } from './src/navigation';
import { supabase } from './src/config/supabase';

// Globaler Event-Emitter für Tab-Visibility
export const TabVisibilityEvent = {
  listeners: new Set<() => void>(),
  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },
  emit() {
    this.listeners.forEach(callback => callback());
  }
};

// Hook um Tab-Visibility zu überwachen
function useTabVisibility() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let wasHidden = false;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
      } else if (document.visibilityState === 'visible' && wasHidden) {
        console.log('Tab wieder aktiv, erneuere Verbindung...');
        wasHidden = false;
        
        try {
          // Supabase Session refreshen
          const { data } = await supabase.auth.getSession();
          
          if (data.session) {
            await supabase.auth.refreshSession();
            console.log('Session erfolgreich erneuert');
          }
          
          // Alle Screens benachrichtigen dass sie neu laden sollen
          TabVisibilityEvent.emit();
          
        } catch (e) {
          console.log('Session-Refresh fehlgeschlagen:', e);
          // Bei Fehler: Seite neu laden als Fallback
          window.location.reload();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', () => {
      if (wasHidden) {
        handleVisibilityChange();
      }
    });
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

export default function App() {
  useTabVisibility();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
