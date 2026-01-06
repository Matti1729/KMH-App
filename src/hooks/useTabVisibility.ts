import { useEffect, useRef, useState } from 'react';
import { Platform, AppState } from 'react-native';

export function useTabVisibility() {
  const [refreshKey, setRefreshKey] = useState(0);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Native: Use AppState
      const subscription = AppState.addEventListener('change', nextAppState => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          setRefreshKey(k => k + 1);
        }
        appState.current = nextAppState;
      });
      return () => subscription.remove();
    } else {
      // Web: Use visibilitychange + focus events
      let wasHidden = false;
      
      const handleVisibility = () => {
        if (document.hidden) {
          wasHidden = true;
        } else if (wasHidden) {
          wasHidden = false;
          // Force React to re-render by triggering state update
          setRefreshKey(k => k + 1);
          // Also dispatch events to restore handlers
          setTimeout(() => {
            document.body.click();
            window.dispatchEvent(new Event('focus'));
          }, 50);
        }
      };

      const handleFocus = () => {
        if (wasHidden) {
          setRefreshKey(k => k + 1);
        }
      };

      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('focus', handleFocus);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, []);

  return refreshKey;
}
