import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';

const BACKGROUND_IMAGE = require('../../../assets/stadion-bg.jpeg');

// Phase 0: Platzhalter-Dashboard für den Athletiktrainer. Die zugewiesene
// Spielerliste folgt in Phase 1 (Reuse von PlayerOverviewScreen im trainerMode).
export function TrainerHomeScreen() {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const Content = (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Meine Spieler</Text>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', maxWidth: 420 }}>
        Hier erscheinen die Spieler, die dir von den Beratern zugewiesen werden. Die Liste folgt in Kürze.
      </Text>
    </View>
  );

  if (isMobile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="trainerPlayers"
          profile={profile as any}
          trainerMode
        />
        <MobileHeader title="Meine Spieler" onMenuPress={() => setShowMobileSidebar(true)} />
        <View style={{ flex: 1, position: 'relative' }}>
          <Image source={BACKGROUND_IMAGE} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectPosition: 'center 75%' } as any} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
          {Content}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.containerDesktop, { backgroundColor: colors.background }]}>
      <Sidebar navigation={navigation} activeScreen="trainerPlayers" profile={profile as any} trainerMode />
      <View style={[styles.mainContent, { position: 'relative' }]}>
        <Image source={BACKGROUND_IMAGE} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectPosition: 'center 75%' } as any} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
        {Content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDesktop: { flex: 1, flexDirection: 'row' },
  mainContent: { flex: 1 },
});
