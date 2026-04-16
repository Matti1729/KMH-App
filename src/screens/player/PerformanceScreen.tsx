import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { supabase } from '../../config/supabase';

const TransfermarktIcon = require('../../../assets/transfermarkt-logo.png');

const POSITION_MAP: Record<string, string> = {
  'TW': 'Torwart',
  'IV': 'Innenverteidiger',
  'LV': 'Linker Verteidiger',
  'RV': 'Rechter Verteidiger',
  'DM': 'Defensives Mittelfeld',
  'ZM': 'Zentrales Mittelfeld',
  'OM': 'Offensives Mittelfeld',
  'LA': 'Linke Außenbahn',
  'RA': 'Rechte Außenbahn',
  'ST': 'Stürmer',
};

interface PlayerHeaderData {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  nationality: string;
  club: string;
  league: string;
  position: string;
  secondary_position: string;
  photo_url: string;
  transfermarkt_url: string;
  height: number | null;
  strong_foot: string;
  contract_end: string;
}

const HEADER_FIELDS = 'id, first_name, last_name, birth_date, nationality, club, league, position, secondary_position, photo_url, transfermarkt_url, height, strong_foot, contract_end';

const COUNTRY_FLAGS: Record<string, string> = {
  'Deutschland': '🇩🇪', 'Österreich': '🇦🇹', 'Schweiz': '🇨🇭', 'Frankreich': '🇫🇷',
  'Italien': '🇮🇹', 'Spanien': '🇪🇸', 'Portugal': '🇵🇹', 'Niederlande': '🇳🇱',
  'Belgien': '🇧🇪', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Polen': '🇵🇱', 'Kroatien': '🇭🇷',
  'Serbien': '🇷🇸', 'Türkei': '🇹🇷', 'Brasilien': '🇧🇷', 'Argentinien': '🇦🇷',
  'USA': '🇺🇸', 'Dänemark': '🇩🇰', 'Schweden': '🇸🇪', 'Norwegen': '🇳🇴',
};

function formatGermanDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

function formatContractEnd(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  } catch {
    return iso;
  }
}

function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  try {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  } catch {
    return null;
  }
}

function formatBirthYear(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  try {
    return String(new Date(birthDate).getFullYear());
  } catch {
    return null;
  }
}

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

function renderPosition(code: string): string {
  if (!code) return '';
  return POSITION_MAP[code] || code;
}

// ---------- Mock-Daten (Impect-inspiriert) ----------

const MOCK_SEASONS = [
  { flag: '🇩🇪', league: 'U17 DFB-Nachwuchsliga', games: '14,4 Spiele' },
  { flag: '🇩🇪', league: 'U19 DFB-Nachwuchsliga', games: '3,8 Spiele' },
];

const MOCK_SCORES = [
  { label: 'IMPECT', value: 90, sub: 'Top' },
  { label: 'Offensiv-IMPECT', value: 92, sub: 'Top' },
  { label: 'Defensiv-IMPECT', value: 38, sub: 'Unterdurchschn.' },
  { label: 'Top-Profil', value: 84, sub: 'Flügelstürmer Tiefgang rechts' },
];

const MOCK_STRENGTHS = [
  'Tiefgang & Tempo auf dem Flügel',
  'Hohe Ballsicherheit unter Druck',
  'Effektivität im letzten Drittel',
  'Anspielbarkeit zwischen den Linien',
];
const MOCK_POTENTIALS = [
  'Defensive Rückwärtsbewegung',
  'Kopfballspiel',
  'Entscheidungsfindung im Strafraum',
];

const MOCK_GAMES = [
  { date: '12.04.26', opponent: 'RB Leipzig U19', position: 'RA', note: 1 },
  { date: '05.04.26', opponent: 'Hertha BSC U19', position: 'RA', note: 2 },
  { date: '29.03.26', opponent: 'Union Berlin U19', position: 'OM', note: 3 },
  { date: '22.03.26', opponent: 'Werder Bremen U19', position: 'RA', note: 2 },
  { date: '15.03.26', opponent: 'VfB Stuttgart U19', position: 'RA', note: 1 },
];

// ---------- Screen ----------

export function PerformanceScreen() {
  const navigation = useNavigation<any>();
  const { session, profile } = useAuth();
  const { colors, isDark } = useTheme();
  const isMobile = useIsMobile();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [player, setPlayer] = useState<PlayerHeaderData | null>(null);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchPlayer = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return; }
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
          .select(HEADER_FIELDS)
          .eq('id', playerDetailsId)
          .single();
        if (data) setPlayer(data as PlayerHeaderData);
      }
    } catch (err) {
      console.warn('fetchPlayer error', err);
    } finally {
      setLoading(false);
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

  const age = calculateAge(player?.birth_date);
  const birthYear = formatBirthYear(player?.birth_date);
  const clubLogo = player?.club ? resolveClubLogo(player.club, clubLogos) : null;
  const positionLabel = player?.position ? renderPosition(player.position) : '';
  const secondaryPositions = player?.secondary_position
    ? player.secondary_position.split(',').map(s => renderPosition(s.trim())).filter(Boolean)
    : [];

  // ---------- Section: Header ----------
  const firstName = (player?.first_name || profile?.first_name || '').toUpperCase();
  const lastName = (player?.last_name || profile?.last_name || '').toUpperCase();
  const nationalityFlag = player?.nationality ? COUNTRY_FLAGS[player.nationality] : null;
  const positionShort = player?.position || '';
  const positionFull = positionShort ? renderPosition(positionShort).toUpperCase() : '';

  const HeaderBar = (
    <View style={[styles.headerCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      {/* Top Row: Name links — TM Button rechts */}
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1 }}>
          {firstName ? <Text style={[styles.playerNameHuge, { color: colors.text }]}>{firstName}</Text> : null}
          {lastName ? <Text style={[styles.playerNameHuge, { color: colors.text }]}>{lastName}</Text> : null}
        </View>
        {player?.transfermarkt_url ? (
          <TouchableOpacity
            style={[styles.tmButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            onPress={() => Linking.openURL(player.transfermarkt_url)}
          >
            <Image source={TransfermarktIcon} style={styles.tmIcon} resizeMode="contain" />
            <Text style={[styles.tmButtonText, { color: colors.text }]}>Transfermarkt</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Sub-Row: Verein · Position · Form-Badge */}
      <View style={styles.headerSubRow}>
        <View style={styles.clubRow}>
          {clubLogo ? (
            <Image source={{ uri: clubLogo }} style={styles.clubLogoLarge} />
          ) : (
            <View style={[styles.clubLogoLarge, { backgroundColor: colors.surfaceSecondary, borderRadius: 4 }]} />
          )}
          <Text style={[styles.metaLabelBold, { color: colors.text }]}>{player?.club || 'VEREINSLOS'}</Text>
        </View>
        {positionFull ? (
          <Text style={[styles.metaLabelBold, { color: colors.text }]}>
            {positionFull}{positionShort && positionFull !== positionShort ? ` (${positionShort})` : ''}
          </Text>
        ) : null}
        <View style={styles.formBadge}>
          <Text style={styles.formBadgeText}>TOP FORM</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.headerDivider, { backgroundColor: colors.border }]} />

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>NATIONALITÄT</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {nationalityFlag ? `${nationalityFlag} ` : ''}{player?.nationality || '-'}
          </Text>
        </View>
        <View style={styles.statCol}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>GEBURTSDATUM</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatGermanDate(player?.birth_date)}
            {age !== null ? <Text style={[styles.statValueSuffix, { color: colors.textMuted }]}>{`  (${age}J)`}</Text> : null}
          </Text>
        </View>
        <View style={styles.statCol}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>GRÖSSE</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{player?.height ? `${player.height} cm` : '-'}</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>STARKER FUSS</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{player?.strong_foot || '-'}</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>VERTRAG</Text>
          <Text style={[styles.statValue, styles.statValueItalic, { color: colors.text }]}>{formatContractEnd(player?.contract_end)}</Text>
        </View>
      </View>
    </View>
  );

  // ---------- Section: Saison ----------
  const SaisonCard = (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Saison 25/26 · Anzahl Spiele</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>Alle Positionen</Text>
      </View>
      <View style={{ gap: 8, marginTop: 8 }}>
        {MOCK_SEASONS.map((s, i) => (
          <View key={i} style={styles.saisonRow}>
            <Text style={{ fontSize: 18 }}>{s.flag}</Text>
            <Text style={[styles.saisonLeague, { color: colors.text }]} numberOfLines={1}>{s.league}</Text>
            <Text style={[styles.saisonGames, { color: colors.textMuted }]}>{s.games}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ---------- Section: Gesamt-Leistung ----------
  const scoreColor = (v: number) => (v >= 70 ? '#22c55e' : v >= 50 ? '#3b82f6' : '#f59e0b');

  const GesamtCard = (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Gesamt-Leistung</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>Mock-Daten</Text>
      </View>
      <View style={[styles.scoreGrid, isMobile && { flexDirection: 'column' }]}>
        {MOCK_SCORES.map((s, i) => (
          <View key={i} style={[styles.scoreBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>{s.label}</Text>
            <Text style={[styles.scoreValue, { color: scoreColor(s.value) }]}>{s.value}%</Text>
            <View style={[styles.scoreBar, { backgroundColor: colors.border }]}>
              <View style={[styles.scoreBarFill, { width: `${s.value}%`, backgroundColor: scoreColor(s.value) }]} />
            </View>
            <Text style={[styles.scoreSub, { color: colors.textSecondary }]}>{s.sub}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ---------- Section: Stärken & Potenziale ----------
  const StrengthsCard = (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Stärken & Potenziale</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>Mock-Daten</Text>
      </View>
      <View style={[styles.twoColumn, isMobile && { flexDirection: 'column' }]}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[styles.columnHeader, { color: '#16a34a' }]}>✅ Stärken</Text>
          {MOCK_STRENGTHS.map((s, i) => (
            <Text key={i} style={[styles.listItem, { color: colors.text }]}>• {s}</Text>
          ))}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[styles.columnHeader, { color: '#ca8a04' }]}>🔶 Potenziale</Text>
          {MOCK_POTENTIALS.map((p, i) => (
            <Text key={i} style={[styles.listItem, { color: colors.text }]}>• {p}</Text>
          ))}
        </View>
      </View>
    </View>
  );

  // ---------- Section: Aktuelle Spiele ----------
  const noteColor = (n: number) => (n <= 2 ? '#22c55e' : n === 3 ? '#3b82f6' : '#ef4444');

  const GamesCard = (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Letzte Spiele</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>Mock-Daten</Text>
      </View>
      <View style={{ marginTop: 8 }}>
        {MOCK_GAMES.map((g, i) => (
          <View key={i} style={[styles.gameRow, i < MOCK_GAMES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={[styles.gameDate, { color: colors.textMuted }]}>{g.date}</Text>
            <Text style={[styles.gameOpponent, { color: colors.text }]} numberOfLines={1}>{g.opponent}</Text>
            <View style={[styles.gamePositionBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.gamePositionText, { color: colors.textSecondary }]}>{g.position}</Text>
            </View>
            <View style={[styles.noteBadge, { backgroundColor: noteColor(g.note) + '22' }]}>
              <Text style={[styles.noteText, { color: noteColor(g.note) }]}>{g.note}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const Content = (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>Performance</Text>
      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          {HeaderBar}
          <View style={[styles.gridRow, isMobile && { flexDirection: 'column' }]}>
            <View style={{ flex: 1 }}>{SaisonCard}</View>
            <View style={{ flex: 2 }}>{GesamtCard}</View>
          </View>
          {StrengthsCard}
          {GamesCard}
          <Text style={[styles.footerNote, { color: colors.textMuted }]}>
            Hinweis: Die Leistungsdaten auf dieser Seite sind derzeit Platzhalter. Echte Analytics folgen in einer späteren Version.
          </Text>
        </>
      )}
    </ScrollView>
  );

  if (isMobile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="performance"
          profile={profile as any}
          playerMode
        />
        <MobileHeader title="Performance" onMenuPress={() => setShowMobileSidebar(true)} />
        {Content}
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.containerDesktop, { backgroundColor: colors.background }]}>
      <Sidebar navigation={navigation} activeScreen="performance" profile={profile as any} playerMode />
      <View style={[styles.mainContent, { backgroundColor: colors.background }]}>{Content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDesktop: { flex: 1, flexDirection: 'row' },
  mainContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, gap: 16 },
  screenTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },

  // Header
  headerCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  playerNameHuge: { fontSize: 56, fontWeight: '900', letterSpacing: -1.5, lineHeight: 58 },
  tmButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  tmIcon: { width: 20, height: 20 },
  tmButtonText: { fontSize: 13, fontWeight: '600' },

  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginTop: 12 },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clubLogoLarge: { width: 24, height: 24, resizeMode: 'contain' },
  metaLabelBold: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  formBadge: { borderWidth: 1.5, borderColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  formBadgeText: { fontSize: 11, fontWeight: '800', color: '#22c55e', letterSpacing: 1 },

  headerDivider: { height: 1, marginVertical: 20 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  statCol: { minWidth: 120, gap: 6 },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  statValue: { fontSize: 14, fontWeight: '700' },
  statValueSuffix: { fontSize: 11, fontWeight: '500' },
  statValueItalic: { fontStyle: 'italic' },

  // Cards
  card: { borderRadius: 12, borderWidth: 1, padding: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardSubtitle: { fontSize: 11 },
  gridRow: { flexDirection: 'row', gap: 16 },

  // Saison
  saisonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  saisonLeague: { flex: 1, fontSize: 13, fontWeight: '500' },
  saisonGames: { fontSize: 12 },

  // Scores
  scoreGrid: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  scoreBox: { flex: 1, minWidth: 120, padding: 12, borderRadius: 10, gap: 6 },
  scoreLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  scoreValue: { fontSize: 24, fontWeight: '700' },
  scoreBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  scoreBarFill: { height: 4, borderRadius: 2 },
  scoreSub: { fontSize: 10, fontWeight: '500' },

  // Strengths
  twoColumn: { flexDirection: 'row', gap: 16, marginTop: 12 },
  columnHeader: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  listItem: { fontSize: 13, lineHeight: 18 },

  // Games
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  gameDate: { fontSize: 11, width: 64 },
  gameOpponent: { flex: 1, fontSize: 13, fontWeight: '500' },
  gamePositionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  gamePositionText: { fontSize: 11, fontWeight: '600' },
  noteBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  noteText: { fontSize: 13, fontWeight: '700' },

  footerNote: { fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
});
