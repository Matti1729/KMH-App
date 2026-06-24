import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { AdvisorBackground } from '../../components/AdvisorBackground';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';

const HEADER_IMAGE = require('../../../assets/scouting-header-bg.jpg');
const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Dashboard-Startseite für den Athletiktrainer (wie das Berater-Dashboard),
// aktuell mit der Karte „Meine Spieler".
export function TrainerHomeScreen() {
  const navigation = useNavigation<any>();
  const { session, viewAsTrainerId } = useAuth();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const { width: windowWidth } = useWindowDimensions();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; photo_url?: string; role?: string } | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const currentWeekday = WEEKDAYS_DE[new Date().getDay()];
  const cardWidth = Math.max(180, Math.floor((windowWidth - (isMobile ? 0 : 240) - 48 - 32) / 3));

  useEffect(() => {
    if (loadedRef.current || !session?.user?.id) return;
    loadedRef.current = true;
    const effId = viewAsTrainerId || session.user.id;
    (async () => {
      const { data } = await supabase.from('advisors').select('first_name, last_name, photo_url, role').eq('id', effId).single();
      if (data) setProfile(data);
      const { count } = await supabase.from('player_trainer_assignments').select('*', { count: 'exact', head: true }).eq('trainer_id', effId);
      setPlayerCount(count || 0);
    })();
  }, [session?.user?.id, viewAsTrainerId]);

  const renderDashCard = (id: string, title: string, subtitle: string, screen: string, count?: number) => {
    const hov = hoveredCard === id;
    return (
      <Pressable
        key={id}
        onPress={() => navigation.navigate(screen)}
        onHoverIn={() => setHoveredCard(id)}
        onHoverOut={() => setHoveredCard(null)}
        style={[
          styles.card,
          styles.uniformCard,
          { width: isMobile ? '100%' : cardWidth, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
          hov && Platform.OS === 'web' ? ({ backdropFilter: 'none', WebkitBackdropFilter: 'none' } as any) : null,
          hov && { backgroundColor: 'transparent' },
        ]}
      >
        <View style={styles.uniformCardHeader}>
          <View style={{ flex: 1 }} />
          {typeof count === 'number' && <Text style={styles.uniformCardCount}>{count}</Text>}
        </View>
        <View style={[styles.uniformCardFooter, hov && { backgroundColor: 'transparent' }]}>
          <Text style={styles.uniformCardTitle}>{title}</Text>
          <Text style={styles.uniformCardSubtitle}>{subtitle}</Text>
        </View>
      </Pressable>
    );
  };

  const cards = [
    renderDashCard('players', 'Meine Spieler', 'Zugewiesene Spieler & Performance', 'TrainerPlayers', playerCount),
    renderDashCard('termine', 'Spieltage', 'Spiele deiner Spieler', 'Calendar'),
  ];

  const Content = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
      <View style={styles.uniformGrid}>
        <View style={styles.uniformGridRow}>
          {cards}
        </View>
      </View>
    </ScrollView>
  );

  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: 'transparent' }]}>
        <AdvisorBackground />
        <MobileSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} navigation={navigation} activeScreen="dashboard" profile={profile as any} trainerMode />
        <MobileHeader title="Dashboard" backgroundImage={HEADER_IMAGE} onMenuPress={() => setShowMobileSidebar(true)}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Schönen {currentWeekday}, {profile?.first_name || 'Trainer'}!</Text>
        </MobileHeader>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {cards}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AdvisorBackground />
      <Sidebar navigation={navigation} activeScreen="dashboard" profile={profile as any} trainerMode />
      <View style={styles.mainContent}>
        <View style={styles.header}>
          <Image source={HEADER_IMAGE} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.85 }} resizeMode="cover" />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }} />
            <Text style={styles.headerTitle}>KARL HERZOG SPORTMANAGEMENT</Text>
          </View>
          <View style={styles.headerDivider} />
          <Text style={styles.greeting}>Einen schönen {currentWeekday}, {profile?.first_name || 'Trainer'}.</Text>
        </View>
        {Content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  containerMobile: { flex: 1, flexDirection: 'column' },
  mainContent: { flex: 1 },
  header: {
    paddingHorizontal: 28, paddingTop: 24, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginHorizontal: 24, marginTop: 16, marginBottom: 0, overflow: 'hidden',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingBottom: 4 },
  headerTitle: { fontFamily: 'Josefin Sans', fontSize: 26, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' },
  headerDivider: { height: 1, marginTop: 16, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.3)' },
  greeting: { fontFamily: 'Josefin Sans', fontSize: 22, fontWeight: '300', letterSpacing: 1, color: '#fff' },
  uniformGrid: { gap: 16 },
  uniformGridRow: { flexDirection: 'row', gap: 16 },
  // 3D-Lift-Basis (identisch zum Berater-Dashboard)
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.2s ease',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    borderLeftColor: 'rgba(255,255,255,0.12)',
    borderRightColor: 'rgba(255,255,255,0.12)',
    borderBottomColor: 'rgba(0,0,0,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 22px 44px rgba(0,0,0,0.6), 0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)',
    } as any : {}),
  },
  uniformCard: {
    height: 160,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as any : {}),
  },
  uniformCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  uniformCardCount: { fontFamily: 'Josefin Sans', fontSize: 32, fontWeight: '300', letterSpacing: 2, color: '#fff' },
  uniformCardFooter: { position: 'absolute', bottom: 14, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 20, paddingVertical: 12 },
  uniformCardTitle: { fontFamily: 'Josefin Sans', fontSize: 14, fontWeight: '400', letterSpacing: 2, textTransform: 'uppercase', color: '#fff' },
  uniformCardSubtitle: { fontFamily: 'Josefin Sans', fontSize: 12, fontWeight: '300', letterSpacing: 1, marginTop: 4, lineHeight: 18, color: 'rgba(255,255,255,0.7)' },
});
