import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { supabase } from '../../config/supabase';

const TransfermarktIcon = require('../../../assets/transfermarkt-logo.png');
const BACKGROUND_IMAGE = require('../../../assets/stadion-bg.jpeg');
const FIELD_IMAGE = require('../../../assets/player-home-bg.png');


const PLAYER_QUOTE = 'Only you can change your life. No one can do it for you.';

interface PlayerHomeData {
  id: string;
  first_name: string;
  last_name: string;
  club: string;
  photo_url: string;
  transfermarkt_url: string;
}

const HOME_HEADER_FIELDS = 'id, first_name, last_name, club, photo_url, transfermarkt_url';

function resolveClubLogo(clubName: string, clubLogos: Record<string, string>): string | null {
  if (!clubName) return null;
  if (clubLogos[clubName]) return clubLogos[clubName];
  const variations = [
    clubName,
    clubName.replace('FC ', '').replace(' FC', ''),
    clubName.replace('1. ', ''),
    clubName.replace('SV ', '').replace(' SV', ''),
    clubName.replace('VfB ', '').replace(' VfB', ''),
    clubName.replace('VfL ', '').replace(' VfL', ''),
    clubName.replace('TSG ', '').replace(' TSG', ''),
    clubName.replace('SC ', '').replace(' SC', ''),
  ];
  for (const v of variations) if (clubLogos[v]) return clubLogos[v];
  for (const [logoClub, logoUrl] of Object.entries(clubLogos)) {
    if (clubName.toLowerCase().includes(logoClub.toLowerCase()) || logoClub.toLowerCase().includes(clubName.toLowerCase())) return logoUrl;
  }
  return null;
}

interface DashboardCardDef {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  screen: string;
}

const CARDS: DashboardCardDef[] = [
  {
    id: 'personalData',
    title: 'Persönliche Daten',
    subtitle: 'Kontaktdaten & Familieninformationen',
    icon: '👤',
    screen: 'PersonalData',
  },
  {
    id: 'performance',
    title: 'Performance',
    subtitle: 'Statistiken & Leistungsdaten',
    icon: '📈',
    screen: 'Performance',
  },
  {
    id: 'kmhTeam',
    title: 'Unser KMH-Team',
    subtitle: 'Berater & Ansprechpartner',
    icon: '🤝',
    screen: 'KmhTeam',
  },
  {
    id: 'news',
    title: 'News',
    subtitle: 'Updates & Mitteilungen',
    icon: '📰',
    screen: 'News',
  },
  {
    id: 'beratung',
    title: 'Was bedeutet Beratung',
    subtitle: 'Unsere Leistungen für dich',
    icon: '💡',
    screen: 'Beratung',
  },
];

export function PlayerHomeScreen() {
  const navigation = useNavigation<any>();
  const { session, profile, viewAsPlayer, setViewAsPlayer } = useAuth();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [player, setPlayer] = useState<PlayerHomeData | null>(null);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});

  const fetchPlayer = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('player_details_id')
        .eq('id', session.user.id)
        .single();

      let playerDetailsId = profileData?.player_details_id;

      if (!playerDetailsId && profile?.first_name && profile?.last_name) {
        const { data: matchData } = await supabase
          .from('player_details')
          .select('id')
          .eq('first_name', profile.first_name)
          .eq('last_name', profile.last_name)
          .limit(1)
          .single();
        if (matchData) playerDetailsId = matchData.id;
      }

      if (playerDetailsId) {
        const { data } = await supabase
          .from('player_details')
          .select(HOME_HEADER_FIELDS)
          .eq('id', playerDetailsId)
          .single();
        if (data) setPlayer(data as PlayerHomeData);
      }
    } catch (err) {
      console.warn('fetchPlayer error', err);
    }
  }, [session?.user?.id, profile?.first_name, profile?.last_name]);

  const fetchClubLogos = useCallback(async () => {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const map: Record<string, string> = {};
      for (const row of data) map[row.club_name] = row.logo_url;
      setClubLogos(map);
    }
  }, []);

  useEffect(() => { fetchPlayer(); fetchClubLogos(); }, [fetchPlayer, fetchClubLogos]);

  const { width: windowWidth } = useWindowDimensions();
  const SIDEBAR_WIDTH = isMobile ? 0 : 240;
  const CONTENT_PADDING = 48; // 24 left + 24 right
  const GAP = 24;
  const cardWidth = Math.max(160, Math.floor((windowWidth - SIDEBAR_WIDTH - CONTENT_PADDING - GAP * 2) / 3));
  const CARD_HEIGHT = 220;
  const GRID_COLS = 3;
  const GRID_ROWS = Math.ceil(CARDS.length / GRID_COLS);
  const HEADER_HEIGHT = isMobile ? 290 : 320;
  const HEADER_GAP = 24;
  const canvasWidth = Math.max(480, windowWidth - SIDEBAR_WIDTH - CONTENT_PADDING);
  const canvasHeight = HEADER_HEIGHT + HEADER_GAP + GRID_ROWS * CARD_HEIGHT + (GRID_ROWS - 1) * GAP;
  const MOBILE_CARD_HEIGHT = 76;
  const mobileCanvasHeight = HEADER_HEIGHT + CARDS.length * MOBILE_CARD_HEIGHT;

  const renderCard = (card: DashboardCardDef, colIdx: number, rowIdx: number) => (
    <TouchableOpacity
      key={card.id}
      activeOpacity={0.85}
      style={[styles.gridCard, { width: cardWidth, borderColor: colors.cardBorder, overflow: 'hidden' }]}
      onPress={() => navigation.navigate(card.screen)}
    >
      <Image
        source={FIELD_IMAGE}
        style={{
          position: 'absolute',
          width: canvasWidth,
          height: canvasHeight,
          left: -(colIdx * (cardWidth + GAP)),
          top: -(HEADER_HEIGHT + HEADER_GAP + rowIdx * (CARD_HEIGHT + GAP)),
        }}
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      <View style={styles.cardFooter}>
        <Text style={[styles.cardTitle, { color: '#fff' }]}>{card.title}</Text>
        <Text style={[styles.cardSubtitle, { color: 'rgba(255,255,255,0.85)' }]}>{card.subtitle}</Text>
      </View>
    </TouchableOpacity>
  );

  const firstName = (player?.first_name || profile?.first_name || '').toUpperCase();
  const lastName = (player?.last_name || profile?.last_name || '').toUpperCase();
  const clubLogo = player?.club ? resolveClubLogo(player.club, clubLogos) : null;
  const photoWidth = isMobile ? 110 : 150;
  const photoHeight = isMobile ? 140 : 190;
  const nameFontSize = isMobile ? 48 : 72;
  const nameLineHeight = isMobile ? 52 : 76;

  const Header = (
    <View style={[styles.headerCard, { borderColor: colors.cardBorder, overflow: 'hidden', height: HEADER_HEIGHT }]}>
      <Image
        source={FIELD_IMAGE}
        style={isMobile ? {
          position: 'absolute',
          width: '100%',
          height: mobileCanvasHeight,
          left: 0,
          top: 0,
        } : {
          position: 'absolute',
          width: canvasWidth,
          height: canvasHeight,
          left: 0,
          top: 0,
        }}
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
      <View style={styles.headerTopRow}>
        {player?.photo_url ? (
          <Image source={{ uri: player.photo_url }} style={{ width: photoWidth, height: photoHeight, borderRadius: 8 }} />
        ) : (
          <View style={[styles.photoPlaceholder, { width: photoWidth, height: photoHeight, borderRadius: 8, backgroundColor: colors.primary }]}>
            <Text style={[styles.photoInitials, { color: colors.primaryText }]}>
              {firstName[0] || ''}{lastName[0] || ''}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, justifyContent: 'space-between', minHeight: photoHeight }}>
          <View>
            {firstName ? <Text style={[styles.playerNameHuge, { color: '#fff', fontSize: nameFontSize, lineHeight: nameLineHeight }]}>{firstName}</Text> : null}
            {lastName ? <Text style={[styles.playerNameHuge, { color: '#fff', fontSize: nameFontSize, lineHeight: nameLineHeight }]}>{lastName}</Text> : null}
          </View>
          <View style={styles.clubRow}>
            {clubLogo ? (
              <Image source={{ uri: clubLogo }} style={styles.clubLogoLarge} />
            ) : null}
            <Text style={[styles.clubName, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
              {player?.club || 'VEREINSLOS'}
            </Text>
          </View>
        </View>
        {player?.transfermarkt_url ? (
          <TouchableOpacity
            style={[styles.tmButton, { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(255,255,255,0.4)' }]}
            onPress={() => Linking.openURL(player.transfermarkt_url)}
          >
            <Image source={TransfermarktIcon} style={styles.tmIcon} resizeMode="contain" />
            <Text style={[styles.tmButtonText, { color: '#111' }]}>Transfermarkt</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.headerDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />

      <Text style={[styles.quoteText, { color: '#fff' }]}>
        „{PLAYER_QUOTE}"
      </Text>
    </View>
  );

  const Content = (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Zurück zur Berater-Ansicht */}
      {viewAsPlayer && (
        <TouchableOpacity
          style={styles.backToAdvisorButton}
          onPress={() => setViewAsPlayer(false)}
        >
          <Text style={styles.backToAdvisorText}>{'\u2190'} Zur{'\u00FC'}ck zur Berater-Ansicht</Text>
        </TouchableOpacity>
      )}

      {Header}

      <View style={styles.grid}>
        {Array.from({ length: Math.ceil(CARDS.length / 3) }).map((_, rowIdx) => {
          const rowCards = CARDS.slice(rowIdx * 3, rowIdx * 3 + 3);
          return (
            <View key={rowIdx} style={styles.gridRow}>
              {rowCards.map((card, colIdx) => renderCard(card, colIdx, rowIdx))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  if (isMobile) {
    const MobileContent = (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentMobile}>
        {viewAsPlayer && (
          <TouchableOpacity
            style={styles.backToAdvisorButton}
            onPress={() => setViewAsPlayer(false)}
          >
            <Text style={styles.backToAdvisorText}>{'\u2190'} Zur{'\u00FC'}ck zur Berater-Ansicht</Text>
          </TouchableOpacity>
        )}

        {Header}

        <View style={styles.mobileCardsContainer}>
          {CARDS.map((card, idx) => (
            <TouchableOpacity
              key={card.id}
              activeOpacity={0.85}
              style={[styles.mobileCard, { borderColor: colors.cardBorder, overflow: 'hidden', height: MOBILE_CARD_HEIGHT, padding: 0 }]}
              onPress={() => navigation.navigate(card.screen)}
            >
              <Image
                source={FIELD_IMAGE}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: mobileCanvasHeight,
                  top: -(HEADER_HEIGHT + idx * MOBILE_CARD_HEIGHT),
                }}
              />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
              <View style={[styles.mobileCardContent, { padding: 16 }]}>
                <View style={styles.mobileCardText}>
                  <Text style={[styles.mobileCardTitle, { color: '#fff' }]}>{card.title}</Text>
                  <Text style={[styles.mobileCardSubtitle, { color: 'rgba(255,255,255,0.85)' }]}>{card.subtitle}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="dashboard"
          profile={profile as any}
          playerMode
        />
        <MobileHeader title="Mein Dashboard" onMenuPress={() => setShowMobileSidebar(true)} />
        <View style={{ flex: 1, position: 'relative' }}>
          <Image
            source={BACKGROUND_IMAGE}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectPosition: 'center 75%' } as any}
            resizeMode="cover"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
          {MobileContent}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.containerDesktop, { backgroundColor: colors.background }]}>
      <Sidebar navigation={navigation} activeScreen="dashboard" profile={profile as any} playerMode />
      <View style={[styles.mainContent, { position: 'relative' }]}>
        <Image
          source={BACKGROUND_IMAGE}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectPosition: 'center 75%' } as any}
          resizeMode="cover"
        />
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
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  scrollContentMobile: { padding: 16 },
  gridFiller: { flex: 1 },
  mobileCardsContainer: {},
  mobileCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  mobileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  mobileCardIconText: { fontSize: 20 },
  mobileCardText: { flex: 1 },
  mobileCardTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  mobileCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  backToAdvisorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backToAdvisorText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Neuer Header
  headerCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 28,
    marginBottom: 24,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoInitials: { fontSize: 42, fontWeight: '700' },
  playerNameHuge: { fontWeight: '900', letterSpacing: -1.5 },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  clubLogoLarge: { width: 44, height: 44, resizeMode: 'contain' },
  clubName: { fontSize: 26, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  tmButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  tmIcon: { width: 20, height: 20 },
  tmButtonText: { fontSize: 13, fontWeight: '600' },
  headerDivider: { height: 1, marginVertical: 20 },
  quoteText: { fontSize: 22, fontStyle: 'italic', lineHeight: 32, textAlign: 'center', fontWeight: '500' },
  grid: {
    gap: 24,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 24,
  },
  gridCard: {
    height: 220,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconText: { fontSize: 18 },
  cardFooter: { marginTop: 'auto' },
  cardTitle: { fontSize: 13, fontWeight: '700' },
  cardSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
});
