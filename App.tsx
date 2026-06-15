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
      // -webkit-appearance:none + min-height am Thumb + overflow:scroll-Erzwingung
      // verhindern, dass Chrome auf macOS den Bar als Overlay rendert und beim
      // Scroll-Stopp ausblendet. Damit ist der Balken IMMER sichtbar — egal ob
      // gerade gescrollt wird oder nicht.
      style.textContent = `
        @media (min-width: 768px) {
          *::-webkit-scrollbar {
            width: 10px;
            height: 10px;
            -webkit-appearance: none;
          }
          *::-webkit-scrollbar-track { background: transparent; }
          *::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.22);
            border-radius: 8px;
            border: 2px solid transparent;
            background-clip: padding-box;
            min-height: 30px;
          }
          *::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.4);
            background-clip: padding-box;
          }
          * {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
          }
          /* RN-Web ScrollViews setzen per Inline-Style overflow:auto auf den scroll-
             baren Container. Auf macOS Chrome triggert das die Overlay-Variante mit
             Auto-Hide — selbst trotz Custom-::-webkit-scrollbar. overflow:scroll
             zwingt den klassischen, immer reservierten Balken. */
          [style*="overflow-y: auto"] { overflow-y: scroll !important; }
          [style*="overflow-x: auto"] { overflow-x: scroll !important; }
          [style*="overflow: auto"] { overflow: scroll !important; }
        }
      `;
      document.head.appendChild(style);
    }

    // Mac-Chrome ignoriert Custom-::-webkit-scrollbar weiterhin, wenn der Container
    // overflow:auto hat (Overlay-Modus aus dem OS). RN-Web setzt overflow via generierte
    // CSS-Klassen, nicht inline — der Attribut-Selektor oben greift nicht. Daher hier
    // einmalig + per MutationObserver alle Scroll-Container hart auf overflow:scroll
    // zwingen. Das deaktiviert den Overlay-Modus zuverlässig und der Balken bleibt
    // immer sichtbar.
    const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
    let scheduled = false;
    let isWriting = false; // verhindert Endlosschleife mit dem MutationObserver
    const forceScrollOnContainers = () => {
      scheduled = false;
      if (!isDesktop()) return;
      isWriting = true;
      try {
        const all = document.querySelectorAll<HTMLElement>('div, section, main, ul, ol, article, nav');
        for (const el of Array.from(all)) {
          const cs = window.getComputedStyle(el);
          if (cs.overflowY === 'auto' && el.style.overflowY !== 'scroll') el.style.overflowY = 'scroll';
          if (cs.overflowX === 'auto' && el.style.overflowX !== 'scroll') el.style.overflowX = 'scroll';
        }
      } finally {
        isWriting = false;
      }
    };
    const scheduleSweep = () => {
      if (scheduled || isWriting) return;
      scheduled = true;
      requestAnimationFrame(forceScrollOnContainers);
    };
    forceScrollOnContainers();
    const observer = new MutationObserver(scheduleSweep);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

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
