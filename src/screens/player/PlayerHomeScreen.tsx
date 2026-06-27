import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  Linking,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { AutoFitText } from '../../components/AutoFitText';
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
  listing: string;
  welcome_seen: boolean;
}

const HOME_HEADER_FIELDS = 'id, first_name, last_name, club, photo_url, transfermarkt_url, listing, welcome_seen';

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

const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface DashboardCardDef {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  screen: string;
  hidden?: boolean; // noch nicht fertig: für Spieler verstecken, für Berater rot zeigen
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
    hidden: true,
  },
  {
    id: 'beratung',
    title: 'Was bedeutet Beratung',
    subtitle: 'Unsere Leistungen für dich',
    icon: '💡',
    screen: 'Beratung',
    hidden: true,
  },
  {
    id: 'news',
    title: 'News',
    subtitle: 'Updates & Mitteilungen',
    icon: '📰',
    screen: 'News',
    hidden: true,
  },
];

export function PlayerHomeScreen() {
  const navigation = useNavigation<any>();
  const { session, profile, viewAsPlayer, viewAsPlayerId, setViewAsPlayer } = useAuth();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [player, setPlayer] = useState<PlayerHomeData | null>(null);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [showWelcome, setShowWelcome] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const fetchPlayer = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      let playerDetailsId = viewAsPlayerId || null;

      // Kanonische Verknüpfung: player_details.linked_user_id == eingeloggter User.
      if (!playerDetailsId) {
        const { data: linkedRow } = await supabase
          .from('player_details')
          .select('id')
          .eq('linked_user_id', session.user.id)
          .limit(1)
          .maybeSingle();
        playerDetailsId = linkedRow?.id || null;
      }

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
  }, [session?.user?.id, profile?.first_name, profile?.last_name, viewAsPlayerId]);

  const fetchClubLogos = useCallback(async () => {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const map: Record<string, string> = {};
      for (const row of data) map[row.club_name] = row.logo_url;
      setClubLogos(map);
    }
  }, []);

  useEffect(() => { fetchPlayer(); fetchClubLogos(); }, [fetchPlayer, fetchClubLogos]);

  // Einmalige Willkommensnachricht beim ersten Login (welcome_seen === false).
  // Wird auch in der Berater-Impersonation angezeigt (zur Vorschau), das Flag wird
  // dann aber NICHT gesetzt — so sieht der echte Spieler die Begrüßung weiterhin.
  const isAdvisorViewing = profile?.role === 'admin' || profile?.role === 'advisor';
  const isImpersonating = isAdvisorViewing || !!viewAsPlayerId;
  useEffect(() => {
    if (player && player.welcome_seen === false) {
      setShowWelcome(true);
    }
  }, [player]);

  const dismissWelcome = async () => {
    setShowWelcome(false);
    if (!player?.id || isImpersonating) return; // Vorschau: Flag nicht persistieren
    setPlayer(prev => prev ? { ...prev, welcome_seen: true } : prev);
    try { await supabase.from('player_details').update({ welcome_seen: true }).eq('id', player.id); } catch (e) { console.warn('welcome_seen update', e); }
  };

  const { width: windowWidth } = useWindowDimensions();
  const SIDEBAR_WIDTH = isMobile ? 0 : 240;
  const CONTENT_PADDING = 48; // 24 left + 24 right
  const GAP = 16;
  const cardWidth = Math.max(160, Math.floor((windowWidth - SIDEBAR_WIDTH - CONTENT_PADDING - GAP * 2) / 3));
  const CARD_HEIGHT = 160;
  const GRID_COLS = 3;
  // Noch nicht fertige Screens: für echte Spieler ausblenden, für Berater (Spieleransicht) rot zeigen.
  // (isAdvisorViewing ist weiter oben für die Willkommensnachricht definiert.)
  const visibleCards = CARDS.filter(c => !c.hidden || isAdvisorViewing);
  const GRID_ROWS = Math.ceil(visibleCards.length / GRID_COLS);
  const HEADER_HEIGHT = isMobile ? 300 : 330;
  const HEADER_GAP = 24;
  const canvasWidth = Math.max(480, windowWidth - SIDEBAR_WIDTH - CONTENT_PADDING);
  const canvasHeight = HEADER_HEIGHT + HEADER_GAP + GRID_ROWS * CARD_HEIGHT + (GRID_ROWS - 1) * GAP;
  const MOBILE_CARD_HEIGHT = 76;
  const mobileCanvasHeight = HEADER_HEIGHT + visibleCards.length * MOBILE_CARD_HEIGHT;

  const renderCard = (card: DashboardCardDef, colIdx: number, rowIdx: number) => {
    const isHovered = hoveredCard === card.id;
    return (
      <Pressable
        key={card.id}
        onHoverIn={() => setHoveredCard(card.id)}
        onHoverOut={() => setHoveredCard(null)}
        style={[
          styles.gridCard,
          { width: cardWidth },
          // Beim Hovern wird die Karte durchsichtig: Rasen-Bild blendet aus, der
          // Seitenhintergrund scheint klar durch — identisch zum Berater-View.
          isHovered && { backgroundColor: 'transparent' },
        ]}
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
            opacity: isHovered ? 0 : 1,
          }}
        />
        <View style={[styles.cardTextBand, isHovered && { backgroundColor: 'transparent' }]}>
          <Text style={[styles.cardTitle, card.hidden && { color: '#ef4444' }]}>{card.title}</Text>
          <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
        </View>
      </Pressable>
    );
  };

  const firstName = (player?.first_name || profile?.first_name || '').toUpperCase();
  const lastName = (player?.last_name || profile?.last_name || '').toUpperCase();
  const currentWeekday = WEEKDAYS_DE[new Date().getDay()];
  const greetingName = player?.first_name || profile?.first_name || 'Spieler';

  const WelcomeModal = (
    <Modal visible={showWelcome} transparent animationType="fade" onRequestClose={dismissWelcome}>
      <View style={styles.welcomeOverlay}>
        <View style={styles.welcomeBox}>
          <Image source={require('../../../assets/scouting-header-bg.jpg')} style={styles.welcomeBg} resizeMode="cover" />
          <View style={styles.welcomeBgOverlay} />
          <View style={{ zIndex: 1 }}>
            <View style={styles.welcomeTitleRow}>
              <Text style={styles.welcomeTitle}>WILLKOMMEN</Text>
              <TouchableOpacity onPress={dismissWelcome} style={styles.welcomeClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.welcomeCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: isMobile ? 360 : 440 }} contentContainerStyle={{ paddingBottom: 4 }}>
              <Text style={styles.welcomeText}>
                Hallo {greetingName},{'\n\n'}
                schön, dass wir dich auf deinem Weg unterstützen dürfen.{'\n\n'}
                Um die Zusammenarbeit so gut wie möglich zu gestalten und dich sportlich sowie persönlich weiter voranzubringen, haben wir diesen Bereich für dich eingerichtet. Hier findest du alle wichtigen Informationen rund um deine persönlichen Daten, deine sportliche Entwicklung und alles, was die Beratung betrifft.{'\n\n'}
                Unser Ziel ist es, dich bestmöglich zu begleiten, deine Stärken weiter auszubauen und gemeinsam an den Themen zu arbeiten, die dich auf das nächste Level bringen.{'\n\n'}
                Bitte nimm dir kurz Zeit, dein Profil vollständig auszufüllen und deine Angaben aktuell zu halten. So können wir dich noch gezielter unterstützen und die Zusammenarbeit optimal auf dich abstimmen.{'\n\n'}
                Sollten Fehlermeldungen auftreten oder etwas nicht funktionieren, gib uns bitte über den Feedback-Button (unten in der Seitenleiste) eine kurze Rückmeldung.{'\n\n'}
                Wir freuen uns auf den gemeinsamen Weg mit dir.{'\n\n'}
                Dein KMH Team
              </Text>
            </ScrollView>
            <TouchableOpacity onPress={dismissWelcome} style={styles.welcomeButton}>
              <Text style={styles.welcomeButtonText}>Los geht's</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const clubLogo = player?.club ? resolveClubLogo(player.club, clubLogos) : null;
  const photoWidth = isMobile ? 90 : 150;
  const photoHeight = isMobile ? 120 : 190;
  const nameFontSize = isMobile ? 48 : 72;
  const nameLineHeight = isMobile ? 52 : 76;

  const Header = (
    <View style={[styles.headerCard, { minHeight: HEADER_HEIGHT }]}>
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
            <Text style={[styles.photoInitials, isMobile && { fontSize: 30 }, { color: colors.primaryText }]}>
              {firstName[0] || ''}{lastName[0] || ''}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, justifyContent: 'space-between', minHeight: photoHeight, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <AutoFitText
              lines={[firstName, lastName]}
              maxFontSize={isMobile ? 34 : 72}
              letterSpacing={2}
              lineHeightRatio={1.06}
              textStyle={styles.playerNameHuge}
            />
            {!isMobile && <Text style={[styles.headerScreenLabel, { textAlign: 'left' }]}>{player?.listing === 'PM Sportmanagement' ? 'PM Sportmanagement' : 'Karl Herzog Sportmanagement'}</Text>}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={[styles.clubRow, { flex: 1, minWidth: 0 }, isMobile && { gap: 8 }]}>
              {clubLogo ? (
                <Image source={{ uri: clubLogo }} style={[styles.clubLogoLarge, isMobile && { width: 32, height: 32 }]} />
              ) : null}
              <AutoFitText
                lines={[player?.club || 'VEREINSLOS']}
                maxFontSize={isMobile ? 15 : 30}
                letterSpacing={3}
                textStyle={[styles.clubName, isMobile && { marginTop: 0 }]}
              />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.headerDivider} />

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={styles.quoteText}>
          „{PLAYER_QUOTE}"
        </Text>
      </View>
    </View>
  );

  const Content = (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {Header}

      <View style={styles.grid}>
        {Array.from({ length: Math.ceil(visibleCards.length / 3) }).map((_, rowIdx) => {
          const rowCards = visibleCards.slice(rowIdx * 3, rowIdx * 3 + 3);
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
        {Header}

        <View style={styles.mobileCardsContainer}>
          {visibleCards.map((card, idx) => (
            <TouchableOpacity
              key={card.id}
              activeOpacity={0.85}
              style={[styles.mobileCard, { overflow: 'hidden', height: MOBILE_CARD_HEIGHT, padding: 0 }]}
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
              <View style={[styles.cardTextBand, { position: 'relative', bottom: 0 }]}>
                <Text style={[styles.cardTitle, card.hidden && { color: '#ef4444' }]}>{card.title}</Text>
                <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
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
        <MobileHeader title="Mein Dashboard" onMenuPress={() => setShowMobileSidebar(true)}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
            Schönen {currentWeekday}, {greetingName}!
          </Text>
        </MobileHeader>
        <View style={{ flex: 1, position: 'relative' }}>
          <Image
            source={BACKGROUND_IMAGE}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectPosition: 'center 75%' } as any}
            resizeMode="cover"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
          {MobileContent}
        </View>
        {WelcomeModal}
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
      {WelcomeModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDesktop: { flex: 1, flexDirection: 'row' },
  mainContent: { flex: 1 },

  // Willkommens-Modal (Design-System: Skyline-BG, Josefin-Titel, grüner Button)
  welcomeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  welcomeBox: { width: '100%', maxWidth: 480, backgroundColor: '#000', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', padding: 24 },
  welcomeBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.85, ...(Platform.OS === 'web' ? ({ objectFit: 'cover', objectPosition: 'center' } as any) : {}) },
  welcomeBgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)' },
  welcomeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' },
  welcomeTitle: { fontFamily: 'Josefin Sans', fontSize: 18, lineHeight: 24, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  welcomeClose: { position: 'absolute', right: 0, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  welcomeCloseText: { fontSize: 20, color: 'rgba(255,255,255,0.7)' },
  welcomeText: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.85)', textAlign: 'left' },
  welcomeButton: { backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 18 },
  welcomeButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
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

  // Header
  headerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 0,
    marginBottom: 16,
    overflow: 'hidden',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoInitials: { fontSize: 42, fontWeight: '700', color: '#fff' },
  playerNameHuge: { fontFamily: 'Josefin Sans', fontWeight: '400', letterSpacing: 2, textTransform: 'uppercase', color: '#fff' },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubLogoLarge: { width: 44, height: 44, resizeMode: 'contain' },
  clubName: { fontFamily: 'Josefin Sans', fontSize: 30, lineHeight: 38, fontWeight: '300', letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: 4, fontVariant: ['lining-nums'] },
  headerScreenLabel: { fontFamily: 'Josefin Sans', fontSize: 26, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' },
  tmButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.92)' },
  tmIcon: { width: 14, height: 14 },
  tmButtonText: { fontSize: 12, fontWeight: '600', color: '#111' },
  headerDivider: { height: 1, marginTop: 20, marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.3)' },
  quoteText: { fontFamily: 'Josefin Sans', fontSize: 18, fontStyle: 'italic', lineHeight: 28, textAlign: 'center', fontWeight: '300', letterSpacing: 1, color: 'rgba(255,255,255,0.8)' },

  // Grid
  grid: { gap: 16 },
  gridRow: { flexDirection: 'row', gap: 16 },
  gridCard: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },

  // Card text band
  cardTextBand: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cardTitle: { fontFamily: 'Josefin Sans', fontSize: 14, fontWeight: '400', letterSpacing: 2, textTransform: 'uppercase', color: '#fff' },
  cardSubtitle: { fontFamily: 'Josefin Sans', fontSize: 12, fontWeight: '300', letterSpacing: 1, marginTop: 4, lineHeight: 18, color: 'rgba(255,255,255,0.7)' },
});
