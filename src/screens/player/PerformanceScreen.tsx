import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { useDialog } from '../../components/DialogProvider';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { supabase } from '../../config/supabase';
import { ComposedChart, Bar, Line, LineChart, BarChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TextInput } from 'react-native';
import { PrototypePoster } from '../../components/PrototypePoster';
import { Prototype, PrototypePositionField, protoPositions } from '../../utils/prototypes';
import { PerformanceImportModal, ImportRow, PreparedInsert } from './PerformanceImportModal';

const TransfermarktIcon = require('../../../assets/transfermarkt-logo.png');
const BACKGROUND_IMAGE = require('../../../assets/stadion-bg.jpeg');

const POSITION_DESCRIPTIONS: Record<string, { title: string; tasks: string[] }> = {
  'TW': { title: 'Torwart', tasks: ['Strafraumbeherrschung und Flankenabwehr', 'Aufbauspiel mit dem Fuß', 'Eins-gegen-eins-Situationen entschärfen', 'Kommunikation und Organisation der Abwehr', 'Reaktionsschnelligkeit bei Schüssen'] },
  'IV': { title: 'Innenverteidiger', tasks: ['Zweikampfführung und Kopfballstärke', 'Spieleröffnung aus der Abwehr', 'Positionierung und Raumdeckung', 'Antizipation und Passunterbindung', 'Führungsqualitäten und Kommunikation'] },
  'LV': { title: 'Linker Verteidiger', tasks: ['Offensive Flügelläufe und Flanken', 'Defensives Eins-gegen-eins', 'Umschaltspiel nach Ballgewinn', 'Überlappende Läufe im Angriff', 'Rückwärtsbewegung und Absicherung'] },
  'RV': { title: 'Rechter Verteidiger', tasks: ['Offensive Flügelläufe und Flanken', 'Defensives Eins-gegen-eins', 'Umschaltspiel nach Ballgewinn', 'Überlappende Läufe im Angriff', 'Rückwärtsbewegung und Absicherung'] },
  'DM': { title: 'Defensives Mittelfeld', tasks: ['Absicherung vor der Abwehr', 'Balleroberung und Pressing', 'Spielverlagerung und Aufbauspiel', 'Positionstreue und taktische Disziplin', 'Verbindungsspieler zwischen Abwehr und Angriff'] },
  'ZM': { title: 'Zentrales Mittelfeld', tasks: ['Box-to-Box-Bewegung und Laufarbeit', 'Ballverteilung und Spielrhythmus', 'Unterstützung in Offensive und Defensive', 'Pässe in die Tiefe und Spielverlagerung', 'Dynamik im Umschaltspiel'] },
  'OM': { title: 'Offensives Mittelfeld', tasks: ['Kreativität und Schlüsselpässe', 'Torschüsse aus der zweiten Reihe', 'Kombinationsspiel im letzten Drittel', 'Freilaufbewegung zwischen den Linien', 'Spielgestaltung und Tempo bestimmen'] },
  'LA': { title: 'Linke Außenbahn', tasks: ['Tiefgang und Tempo auf dem Flügel', 'Dribblings und Eins-gegen-eins', 'Flanken und Hereingaben', 'Schnittstellenläufe in den Strafraum', 'Rückwärtsbewegung bei Ballverlust'] },
  'RA': { title: 'Rechte Außenbahn', tasks: ['Tiefgang und Tempo auf dem Flügel', 'Dribblings und Eins-gegen-eins', 'Flanken und Hereingaben', 'Schnittstellenläufe in den Strafraum', 'Rückwärtsbewegung bei Ballverlust'] },
  'ST': { title: 'Stürmer', tasks: ['Torabschluss und Chancenverwertung', 'Kopfballspiel und Strafraumbesetzung', 'Anlaufverhalten und Pressing', 'Wandspiel und Ballbehauptung', 'Timing bei Tiefenläufen'] },
};

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
  strengths: string;
  potentials: string;
}

const HEADER_FIELDS = 'id, first_name, last_name, birth_date, nationality, club, league, position, secondary_position, photo_url, transfermarkt_url, height, strong_foot, contract_end, strengths, potentials';

const COUNTRY_TO_ISO: Record<string, string> = {
  'Deutschland': 'DE', 'Österreich': 'AT', 'Schweiz': 'CH', 'Frankreich': 'FR',
  'Italien': 'IT', 'Spanien': 'ES', 'Portugal': 'PT', 'Niederlande': 'NL',
  'Belgien': 'BE', 'England': 'GB', 'Polen': 'PL', 'Kroatien': 'HR',
  'Serbien': 'RS', 'Türkei': 'TR', 'Brasilien': 'BR', 'Argentinien': 'AR',
  'USA': 'US', 'Kanada': 'CA', 'Dänemark': 'DK', 'Schweden': 'SE', 'Norwegen': 'NO',
  'Finnland': 'FI', 'Island': 'IS', 'Irland': 'IE', 'Schottland': 'GB',
  'Wales': 'GB', 'Griechenland': 'GR', 'Tschechien': 'CZ', 'Slowakei': 'SK',
  'Ungarn': 'HU', 'Rumänien': 'RO', 'Bulgarien': 'BG', 'Slowenien': 'SI',
  'Bosnien und Herzegowina': 'BA', 'Bosnien-Herzegowina': 'BA', 'Montenegro': 'ME',
  'Nordmazedonien': 'MK', 'Albanien': 'AL', 'Kosovo': 'XK', 'Ukraine': 'UA',
  'Russland': 'RU', 'Japan': 'JP', 'Südkorea': 'KR', 'China': 'CN',
  'Australien': 'AU', 'Mexiko': 'MX', 'Kolumbien': 'CO', 'Chile': 'CL',
  'Peru': 'PE', 'Uruguay': 'UY', 'Paraguay': 'PY', 'Ecuador': 'EC',
  'Ghana': 'GH', 'Nigeria': 'NG', 'Kamerun': 'CM', 'Senegal': 'SN',
  'Elfenbeinküste': 'CI', 'Marokko': 'MA', 'Tunesien': 'TN', 'Ägypten': 'EG',
  'Südafrika': 'ZA', 'Israel': 'IL', 'Iran': 'IR', 'Irak': 'IQ',
  'Saudi-Arabien': 'SA', 'Vereinigte Arabische Emirate': 'AE', 'Indien': 'IN',
  'Luxemburg': 'LU', 'Litauen': 'LT', 'Lettland': 'LV', 'Estland': 'EE',
  'Georgien': 'GE', 'Armenien': 'AM', 'Aserbaidschan': 'AZ',
  'Syrien': 'SY', 'Libanon': 'LB', 'Jordanien': 'JO', 'Afghanistan': 'AF',
  'Pakistan': 'PK', 'Kongo': 'CD', 'Eritrea': 'ER', 'Somalia': 'SO',
  'Äthiopien': 'ET', 'Guinea': 'GN', 'Mali': 'ML', 'Gambia': 'GM',
  'Sierra Leone': 'SL', 'Togo': 'TG', 'Benin': 'BJ', 'Burkina Faso': 'BF',
};

function countryToFlag(country: string): string {
  const iso = COUNTRY_TO_ISO[country];
  if (iso && iso.length === 2) {
    const cp1 = 0x1F1E6 + iso.charCodeAt(0) - 65;
    const cp2 = 0x1F1E6 + iso.charCodeAt(1) - 65;
    return String.fromCodePoint(cp1, cp2);
  }
  return '🏳️';
}

const COUNTRY_FLAGS: Record<string, string> = {};
for (const [name] of Object.entries(COUNTRY_TO_ISO)) {
  COUNTRY_FLAGS[name] = countryToFlag(name);
}

function formatGermanDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
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
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
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

const CLUB_UMLAUT_MAP: Array<[RegExp, string]> = [
  [/saarbrucken/gi, 'Saarbrücken'],
  [/munchen/gi, 'München'],
  [/nurnberg/gi, 'Nürnberg'],
  [/dusseldorf/gi, 'Düsseldorf'],
  [/monchengladbach/gi, 'Mönchengladbach'],
  [/furth/gi, 'Fürth'],
  [/koln\b/gi, 'Köln'],
  [/wurzburg/gi, 'Würzburg'],
  [/hombug/gi, 'Homburg'],
  [/osnabruck/gi, 'Osnabrück'],
];

function normalizeGermanClubName(club: string | null | undefined): string {
  if (!club) return '';
  let out = club;
  for (const [regex, replacement] of CLUB_UMLAUT_MAP) out = out.replace(regex, replacement);
  return out;
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

const playerStrengths = [
  'Tiefgang & Tempo auf dem Flügel',
  'Hohe Ballsicherheit unter Druck',
  'Effektivität im letzten Drittel',
  'Anspielbarkeit zwischen den Linien',
];
const playerPotentials = [
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

// ---------- Positionsfeld ----------

const POSITION_COORDS = {
  ST: { left: '50%', top: '18%' },
  LA: { left: '18%', top: '33%' },
  OM: { left: '50%', top: '33%' },
  RA: { left: '82%', top: '33%' },
  ZM: { left: '50%', top: '46%' },
  DM: { left: '50%', top: '59%' },
  LV: { left: '18%', top: '75%' },
  IV: { left: '50%', top: '75%' },
  RV: { left: '82%', top: '75%' },
  TW: { left: '50%', top: '92%' },
} as const;

const ALL_FIELD_POSITIONS = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'];

const POSITION_LONG_TO_SHORT: Record<string, string> = Object.entries(POSITION_MAP).reduce(
  (acc, [short, long]) => ({ ...acc, [long]: short }),
  {} as Record<string, string>
);

function toPositionShort(pos: string | null | undefined): string {
  if (!pos) return '';
  const trimmed = pos.trim();
  if (POSITION_DESCRIPTIONS[trimmed]) return trimmed;
  const upper = trimmed.toUpperCase();
  if (POSITION_DESCRIPTIONS[upper]) return upper;
  return POSITION_LONG_TO_SHORT[trimmed] || '';
}

// ---------- Analysen ----------

interface AnalysisEntry {
  id: string;
  player_id: string;
  advisor_id: string | null;
  analysis_date: string;
  topics: string[];
  todos: string[];
  video_path: string | null;
  created_at: string;
  updated_at: string;
}

function formatAnalysisDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return '-';
  const parts = dateStr.substring(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

const ANALYSIS_VIDEOS_BUCKET = 'player-analysis-videos';

function getAnalysisVideoUrl(videoPath: string | null | undefined): string | null {
  if (!videoPath) return null;
  const { data } = supabase.storage.from(ANALYSIS_VIDEOS_BUCKET).getPublicUrl(videoPath);
  return data?.publicUrl || null;
}

interface PositionFieldProps {
  primaryPosition: string;
  secondaryPositions: string[];
  activePosition: string;
  onSelectPosition: (pos: string) => void;
  maxWidth?: number;
  circleSize?: number;
}

function PositionField({ primaryPosition, secondaryPositions, activePosition, onSelectPosition, maxWidth = 280, circleSize = 44 }: PositionFieldProps) {
  const playable = new Set([primaryPosition, ...secondaryPositions].filter(Boolean));
  const half = circleSize / 2;
  const fontSize = Math.max(7, Math.round(circleSize * 0.3));
  return (
    <View style={[posStyles.fieldWrapper, { maxWidth }]}>
      <View style={posStyles.field}>
        <View style={posStyles.halfLine} />
        <View style={posStyles.centerCircle} />
        <View style={[posStyles.penaltyBox, posStyles.penaltyBoxTop]} />
        <View style={[posStyles.goalBox, posStyles.goalBoxTop]} />
        <View style={[posStyles.penaltyBox, posStyles.penaltyBoxBottom]} />
        <View style={[posStyles.goalBox, posStyles.goalBoxBottom]} />

        {ALL_FIELD_POSITIONS.map((pos) => {
          const coords = POSITION_COORDS[pos as keyof typeof POSITION_COORDS];
          const isPlayable = playable.has(pos);
          const isActive = isPlayable && pos === activePosition;
          const bg = !isPlayable ? 'rgba(255,255,255,0.08)' : isActive ? '#22c55e' : '#3b82f6';
          const textColor = !isPlayable ? 'rgba(255,255,255,0.3)' : '#fff';
          const circle = (
            <View
              style={[
                {
                  width: circleSize,
                  height: circleSize,
                  borderRadius: half,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: bg,
                },
                isActive && { borderWidth: 2, borderColor: '#fff' },
              ]}
            >
              <Text style={{ fontSize, fontWeight: '700', color: textColor }}>{pos}</Text>
            </View>
          );
          return (
            <View
              key={pos}
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: coords.left,
                top: coords.top,
                transform: [{ translateX: -half }, { translateY: -half }],
              }}
            >
              {isPlayable ? (
                <Pressable onPress={() => onSelectPosition(pos)}>{circle}</Pressable>
              ) : (
                circle
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const posStyles = StyleSheet.create({
  fieldWrapper: { width: '100%', alignSelf: 'flex-start' },
  field: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
    overflow: 'hidden',
  },
  halfLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  centerCircle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 70,
    height: 70,
    marginLeft: -35,
    marginTop: -35,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  penaltyBox: {
    position: 'absolute',
    left: '15%',
    width: '70%',
    height: '16%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  penaltyBoxTop: { top: 0, borderTopWidth: 0 },
  penaltyBoxBottom: { bottom: 0, borderBottomWidth: 0 },
  goalBox: {
    position: 'absolute',
    left: '30%',
    width: '40%',
    height: '6%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  goalBoxTop: { top: 0, borderTopWidth: 0 },
  goalBoxBottom: { bottom: 0, borderBottomWidth: 0 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

// ---------- Portrait-Styles ----------

const PHOTO_WIDTH = 220;
const PHOTO_HEIGHT = 280;
const CORNER_SIZE = 14;
const CORNER_COLOR = 'rgba(255,255,255,0.5)';

const portraitStyles = StyleSheet.create({
  frame: {
    flex: 1,
    minWidth: 220,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 20,
  },
  frameLabel: {
    fontFamily: 'Josefin Sans',
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  photoFrame: {
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
    position: 'relative',
    backgroundColor: '#000',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoCornerTL: {
    position: 'absolute',
    top: -1,
    left: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: CORNER_COLOR,
  },
  photoCornerTR: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: CORNER_COLOR,
  },
  photoCornerBL: {
    position: 'absolute',
    bottom: -1,
    left: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: CORNER_COLOR,
  },
  photoCornerBR: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: CORNER_COLOR,
  },
  nameText: {
    fontFamily: 'Josefin Sans',
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: '#fff',
    marginTop: 12,
    lineHeight: 28,
  },
  clubText: {
    fontFamily: 'Josefin Sans',
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },

  // Scouting-Poster-Elements
  posterTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: 6,
    textTransform: 'uppercase',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 42,
  },
  titleAccent: {
    width: 80,
    height: 2,
    backgroundColor: '#22c55e',
    marginTop: 10,
    marginBottom: 10,
  },
  posterSubtitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },

  // Voll umrahmte Boxen mit 3D-Lift (Shadow unten + Top-Highlight)
  hexFrame: {
    flex: 1,
    minWidth: 220,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    borderLeftColor: 'rgba(255,255,255,0.14)',
    borderRightColor: 'rgba(255,255,255,0.14)',
    borderBottomColor: 'rgba(0,0,0,0.35)',
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 22,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
  },
  // L-Ecken ausgeblendet (werden noch im JSX referenziert)
  frameCornerTL: { width: 0, height: 0 },
  frameCornerTR: { width: 0, height: 0 },
  frameCornerBL: { width: 0, height: 0 },
  frameCornerBR: { width: 0, height: 0 },
  hexLabel: {
    fontFamily: 'Josefin Sans',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
  },
  labelAccent: {
    width: 24,
    height: 1,
    backgroundColor: '#22c55e',
    marginTop: 8,
    marginBottom: 8,
  },

  // Weapons-Box: grün akzentuiert, Highlight-Box mit 3D-Lift + grünem Glow
  weaponsFrame: {
    flex: 1,
    minWidth: 220,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderTopColor: 'rgba(34,197,94,0.55)',
    borderLeftColor: 'rgba(34,197,94,0.35)',
    borderRightColor: 'rgba(34,197,94,0.35)',
    borderBottomColor: 'rgba(0,0,0,0.4)',
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 22,
    position: 'relative',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  weaponsCornerTL: { width: 0, height: 0 },
  weaponsCornerTR: { width: 0, height: 0 },
  weaponsCornerBL: { width: 0, height: 0 },
  weaponsCornerBR: { width: 0, height: 0 },
  weaponIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Kompakte Stats unter dem Foto
  statValue: {
    fontFamily: 'Josefin Sans',
    fontSize: 22,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});

// ---------- Screen ----------

export function PerformanceScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // Athletiktrainer öffnet einen zugewiesenen Spieler per Route-Param (ohne globalen viewAsPlayer-Switch).
  const routePlayerId: string | undefined = route.params?.playerId;
  const isTrainerView: boolean = route.params?.trainerMode === true;
  const { session, profile, viewAsPlayerId } = useAuth();
  const { colors, isDark } = useTheme();
  const { confirm: confirmDialog } = useDialog();
  const isMobile = useIsMobile();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [player, setPlayer] = useState<PlayerHeaderData | null>(null);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showNatTooltip, setShowNatTooltip] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandHover, setExpandHover] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Array<{ id: string; type: string; value: number; measured_at: string; created_by: string; note?: string | null }>>([]);
  const [playerPrototype, setPlayerPrototype] = useState<Prototype | null>(null);
  // Video-Library: pro Spieler die zugewiesenen Videos mit Label + Type + Phase
  const [playerVideos, setPlayerVideos] = useState<Array<{ id: string; video_path: string | null; video_url: string | null; label: string; description: string | null; role_model_name: string | null; role_model_club: string | null; phase: 'negative' | 'positive' | 'neutral'; type: 'strength' | 'potential' }>>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDay, setAddDay] = useState('');
  const [addMonth, setAddMonth] = useState('');
  const [addYear, setAddYear] = useState('');
  const [dateOpen, setDateOpen] = useState<null | 'day' | 'month' | 'year'>(null);
  // Datei-Import
  const [importExtracting, setImportExtracting] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importUnmapped, setImportUnmapped] = useState<{ header: string; sample: string }[]>([]);
  const [importSourceLabel, setImportSourceLabel] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addValue2, setAddValue2] = useState('');
  const [addValue3, setAddValue3] = useState('');
  const [addValue4, setAddValue4] = useState('');
  const [addValue5, setAddValue5] = useState('');
  const [addValue6, setAddValue6] = useState('');
  const [addNote, setAddNote] = useState('');
  const [editingMeasurement, setEditingMeasurement] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editNote, setEditNote] = useState('');

  // Analysen-State
  const [playerAnalyses, setPlayerAnalyses] = useState<AnalysisEntry[]>([]);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [editingAnalysis, setEditingAnalysis] = useState<AnalysisEntry | null>(null);
  const [analysisDate, setAnalysisDate] = useState(''); // YYYY-MM-DD
  const [analysisTopics, setAnalysisTopics] = useState<string[]>(['']);
  const [analysisTodos, setAnalysisTodos] = useState<string[]>(['']);
  const [analysisVideoFile, setAnalysisVideoFile] = useState<{ uri: string; name: string; type: string; file?: File } | null>(null);
  const [analysisVideoPath, setAnalysisVideoPath] = useState<string | null>(null);
  const [analysisVideoRemove, setAnalysisVideoRemove] = useState(false);
  const [analysisUploading, setAnalysisUploading] = useState(false);
  const [analysisSaving, setAnalysisSaving] = useState(false);

  const isAdvisor = profile?.role === 'advisor' || profile?.role === 'admin';

  const fetchMeasurements = useCallback(async () => {
    if (!player?.id) return;
    const { data } = await supabase
      .from('player_measurements')
      .select('*')
      .eq('player_id', player.id)
      .order('measured_at', { ascending: true });
    if (data) setMeasurements(data);
  }, [player?.id]);

  useEffect(() => { if (player?.id) fetchMeasurements(); }, [player?.id, fetchMeasurements]);

  // Click-Outside schließt das Datums-Dropdown (nur Web).
  useEffect(() => {
    if (!dateOpen || typeof document === 'undefined') return;
    const handler = (e: any) => {
      const t = e.target;
      if (t && t.closest && t.closest('[data-kmhdropdown]')) return;
      setDateOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dateOpen]);

  const fetchAnalyses = useCallback(async () => {
    if (!player?.id) return;
    const { data, error } = await supabase
      .from('player_analyses')
      .select('*')
      .eq('player_id', player.id)
      .order('analysis_date', { ascending: false });
    if (!error && data) setPlayerAnalyses(data as AnalysisEntry[]);
  }, [player?.id]);

  useEffect(() => { if (player?.id) fetchAnalyses(); }, [player?.id, fetchAnalyses]);

  const latestValue = (type: string): string => {
    const filtered = measurements.filter(m => m.type === type).sort((a, b) => b.measured_at.localeCompare(a.measured_at));
    if (filtered.length === 0) return '-';
    return String(filtered[0].value);
  };

  // Bestwert einer Kategorie: Sprints = schnellste (kleinste) Zeit,
  // sonst (Vmax, Sprünge, RSI) = höchster Wert.
  const bestValue = (type: string): string => {
    const vals = measurements.filter(m => m.type === type).map(m => Number(m.value)).filter(v => !isNaN(v));
    if (vals.length === 0) return '-';
    const lowerIsBetter = type.startsWith('sprint');
    const best = lowerIsBetter ? Math.min(...vals) : Math.max(...vals);
    return String(best);
  };

  const getTypesForMetric = (metric: string): string[] => {
    if (metric === 'koerper') return ['height', 'weight'];
    if (metric === 'sprint') return ['sprint_10m', 'sprint_20m', 'sprint_30m', 'vmax'];
    if (metric === 'cmj') return ['cmj'];
    if (metric === 'sj') return ['sj'];
    if (metric === 'dj') return ['dj', 'dj_rsi'];
    if (metric === 'ht') return ['ht', 'ht_rsi'];
    if (metric === 'jumps') return ['cmj', 'sj', 'dj', 'dj_rsi', 'ht', 'ht_rsi'];
    return [];
  };

  // Sprünge werden – wie das Sprintprofil – als EIN Block dargestellt: alle
  // Sprung-Graphen + Einträge untereinander, egal welcher Sprung links gewählt ist.
  // (Die Eingabe neuer Werte bleibt je Sprung über die linke Auswahl.)
  const JUMP_METRICS = ['cmj', 'sj', 'dj', 'ht'];
  const JUMP_TYPES = ['cmj', 'sj', 'dj', 'dj_rsi', 'ht', 'ht_rsi'];
  const DAY_OPTS = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const MONTH_OPTS = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const YEAR_OPTS = (() => { const cy = new Date().getFullYear(); return Array.from({ length: cy - 2015 + 1 }, (_, i) => String(cy - i)); })();
  const getDisplayTypes = (metric: string | null): string[] => {
    if (metric && JUMP_METRICS.includes(metric)) return JUMP_TYPES;
    return metric ? getTypesForMetric(metric) : [];
  };

  const parseNum = (v: string) => parseFloat(v.replace(',', '.'));

  const saveMeasurement = async () => {
    if (!player?.id || !selectedMetric || !addDay || !addMonth || !addYear) return;
    const date = `${addYear}-${addMonth.padStart(2, '0')}-${addDay.padStart(2, '0')}`;
    const types = getTypesForMetric(selectedMetric);

    if (editingMeasurement) {
      await supabase.from('player_measurements').update({ value: parseNum(addValue), measured_at: date }).eq('id', editingMeasurement);
    } else {
      if (selectedMetric === 'koerper') {
        if (addValue) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'weight', value: parseNum(addValue), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue2) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'height', value: parseNum(addValue2), measured_at: date, created_by: profile?.first_name || '' });
      } else if (selectedMetric === 'sprint') {
        if (addValue) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'sprint_10m', value: parseNum(addValue), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue2) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'sprint_20m', value: parseNum(addValue2), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue3) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'sprint_30m', value: parseNum(addValue3), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue4) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'vmax', value: parseNum(addValue4), measured_at: date, created_by: profile?.first_name || '' });
      } else if (selectedMetric === 'jumps') {
        if (addValue) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'cmj', value: parseNum(addValue), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue2) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'sj', value: parseNum(addValue2), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue3) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'dj', value: parseNum(addValue3), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue4) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'dj_rsi', value: parseNum(addValue4), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue5) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'ht', value: parseNum(addValue5), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue6) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'ht_rsi', value: parseNum(addValue6), measured_at: date, created_by: profile?.first_name || '' });
      } else if (selectedMetric === 'dj') {
        if (addValue) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'dj', value: parseNum(addValue), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue2) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'dj_rsi', value: parseNum(addValue2), measured_at: date, created_by: profile?.first_name || '' });
      } else if (selectedMetric === 'ht') {
        if (addValue) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'ht', value: parseNum(addValue), measured_at: date, created_by: profile?.first_name || '' });
        if (addValue2) await supabase.from('player_measurements').insert({ player_id: player.id, type: 'ht_rsi', value: parseNum(addValue2), measured_at: date, created_by: profile?.first_name || '' });
      } else {
        if (addValue) await supabase.from('player_measurements').insert({ player_id: player.id, type: types[0], value: parseNum(addValue), measured_at: date, created_by: profile?.first_name || '' });
      }
    }
    // Notiz/Ort gilt für die gesamte Test-Session (Datum) -> auf alle Zeilen setzen.
    if (addNote.trim()) {
      await supabase.from('player_measurements').update({ note: addNote.trim() }).eq('player_id', player.id).eq('measured_at', date);
    }
    setShowAddForm(false);
    setEditingMeasurement(null);
    setAddDay(''); setAddMonth(''); setAddYear(''); setAddValue(''); setAddValue2(''); setAddValue3(''); setAddValue4(''); setAddValue5(''); setAddValue6(''); setAddNote('');
    fetchMeasurements();
  };

  // Datei auswählen -> auslesen lassen -> Vorschau-Modal öffnen (kein DB-Write).
  const handleImportFile = () => {
    if (Platform.OS !== 'web') return; // Web-first
    if (!player?.id) { alert('Kein Spielerprofil geladen.'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls,.pdf,image/*';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) { alert('Datei zu groß (max. 15 MB).'); return; }
      setImportExtracting(true);
      try {
        const fileBase64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
          reader.readAsDataURL(file);
        });

        // Originaldatei zur Nachvollziehbarkeit ablegen (best effort).
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `performance/${player.id}/${Date.now()}_${safeName}`;
          await supabase.storage.from('performance-imports').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        } catch (storeErr) { console.warn('Import-Datei konnte nicht abgelegt werden', storeErr); }

        const { data, error } = await supabase.functions.invoke('extract-performance-data', {
          body: { fileBase64, fileName: file.name, mimeType: file.type || '' },
        });
        if (error) { alert('Auslesen fehlgeschlagen: ' + error.message); return; }
        if (data?.error) { alert(data.error); return; }
        const rows: ImportRow[] = Array.isArray(data?.rows) ? data.rows : [];
        if (rows.length === 0) { alert('In der Datei wurden keine bekannten Messwerte gefunden.'); return; }
        setImportRows(rows);
        setImportUnmapped(Array.isArray(data?.unmapped) ? data.unmapped : []);
        setImportSourceLabel(file.name);
        setShowImportModal(true);
      } catch (err: any) {
        alert('Fehler: ' + (err?.message || String(err)));
      } finally {
        setImportExtracting(false);
      }
    };
    input.click();
  };

  // Bestätigte Werte übernehmen: existierende (Typ+Datum) updaten, sonst inserten.
  const confirmImport = async (inserts: PreparedInsert[], note: string) => {
    if (!player?.id || inserts.length === 0) return;
    setImportSaving(true);
    try {
      for (const ins of inserts) {
        const existing = measurements.find(m => m.type === ins.type && (m.measured_at || '').substring(0, 10) === ins.measured_at);
        if (existing) {
          await supabase.from('player_measurements').update({ value: ins.value }).eq('id', existing.id);
        } else {
          await supabase.from('player_measurements').insert({ player_id: player.id, type: ins.type, value: ins.value, measured_at: ins.measured_at, created_by: profile?.first_name || '', note: note ? `Import: ${note}` : null });
        }
      }
      setShowImportModal(false);
      setImportRows([]);
      setImportUnmapped([]);
      await fetchMeasurements();
    } catch (err: any) {
      alert('Übernahme fehlgeschlagen: ' + (err?.message || String(err)));
    } finally {
      setImportSaving(false);
    }
  };

  const saveEditedValues = async (groupDate: string, items: typeof measurements) => {
    if (!player?.id || !selectedMetric) return;
    const types = getDisplayTypes(selectedMetric);
    for (const type of types) {
      const existing = items.find(e => e.type === type);
      const rawVal = editValues[type];
      const val = rawVal !== undefined ? parseFloat(rawVal.replace(',', '.')) : undefined;

      if (existing && rawVal !== undefined && (rawVal === '' || isNaN(val!))) {
        await supabase.from('player_measurements').delete().eq('id', existing.id);
      } else if (existing && val !== undefined && !isNaN(val) && val !== existing.value) {
        await supabase.from('player_measurements').update({ value: val }).eq('id', existing.id);
      } else if (!existing && val !== undefined && !isNaN(val)) {
        await supabase.from('player_measurements').insert({ player_id: player.id, type, value: val, measured_at: groupDate, created_by: profile?.first_name || '' });
      }
    }
    // Notiz/Ort der Session aktualisieren (auf alle Zeilen des Datums).
    await supabase.from('player_measurements').update({ note: editNote.trim() || null }).eq('player_id', player.id).eq('measured_at', groupDate);
    setEditingMeasurement(null);
    setEditValues({});
    setEditNote('');
    fetchMeasurements();
  };

  // Ganzen Eintrag (alle Werte dieses Datums in der gewählten Kategorie) löschen.
  const deleteEntryGroup = async (groupDate: string, items: typeof measurements) => {
    const confirmed = await confirmDialog({ title: 'Eintrag löschen', message: `Den gesamten Eintrag vom ${groupDate.split('-').reverse().join('.')} wirklich löschen? Das kann nicht rückgängig gemacht werden.`, danger: true, confirmLabel: 'Löschen' });
    if (!confirmed) return;
    const ids = items.map(e => e.id);
    if (ids.length) await supabase.from('player_measurements').delete().in('id', ids);
    setEditingMeasurement(null);
    fetchMeasurements();
  };

  const deleteMeasurement = async (id: string) => {
    await supabase.from('player_measurements').delete().eq('id', id);
    fetchMeasurements();
  };

  const getChartData = (metric: string) => {
    const types = getTypesForMetric(metric);
    const filtered = measurements.filter(m => types.includes(m.type));
    const grouped: Record<string, any> = {};
    for (const m of filtered) {
      const d = new Date(m.measured_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][d.getMonth()]} ${d.getFullYear()}`;
      if (!grouped[key]) grouped[key] = { date: label, sortKey: key };
      grouped[key][m.type] = m.value;
    }
    return Object.values(grouped).sort((a: any, b: any) => a.sortKey.localeCompare(b.sortKey));
  };

  // Pro Kategorie ein eigener Graph: ein Punkt je Messung/Datum (X = Datum TT.MM.JJ).
  const getCategoryChartData = (type: string) => {
    const grouped: Record<string, any> = {};
    for (const m of measurements.filter(x => x.type === type)) {
      const iso = (m.measured_at || '').substring(0, 10);
      if (!iso) continue;
      const [y, mo, dd] = iso.split('-');
      grouped[iso] = { sortKey: iso, date: `${dd}.${mo}.${y.substring(2)}`, [type]: m.value, note: m.note || '' };
    }
    return Object.values(grouped).sort((a: any, b: any) => a.sortKey.localeCompare(b.sortKey));
  };

  const CATEGORY_LABELS: Record<string, string> = {
    weight: 'Gewicht', height: 'Größe',
    sprint_10m: 'Sprint 10m', sprint_20m: 'Sprint 20m', sprint_30m: 'Sprint 30m', vmax: 'Vmax',
    cmj: 'Countermovement Jump', sj: 'Squat Jump',
    dj: 'Drop Jump (Höhe)', dj_rsi: 'Drop Jump RSI',
    ht: 'Hop Test (Höhe)', ht_rsi: 'Hop Test RSI',
  };
  const categoryUnit = (type: string): string => {
    if (type.startsWith('sprint')) return 'Sek';
    if (type === 'vmax') return 'km/h';
    if (type === 'weight') return 'kg';
    if (type === 'cmj' || type === 'sj' || type === 'dj' || type === 'ht' || type === 'height') return 'cm';
    return '';
  };
  const categoryColor = (type: string): string => {
    const map: Record<string, string> = {
      sprint_10m: '#3b82f6', sprint_20m: '#f59e0b', sprint_30m: '#22c55e', vmax: '#ef4444',
      weight: 'rgba(255,255,255,0.7)', height: '#fff',
      cmj: '#3b82f6', sj: '#22c55e', dj: '#f59e0b', dj_rsi: '#ef4444', ht: '#a855f7', ht_rsi: '#ef4444',
    };
    return map[type] || '#3b82f6';
  };
  // Einheit fürs Tooltip (kompakt). Wert wird mit Komma-Dezimal dargestellt.
  const tooltipUnit = (type: string): string => {
    if (type.startsWith('sprint')) return 's';
    if (type === 'vmax') return ' km/h';
    if (type === 'weight') return ' kg';
    if (type === 'cmj' || type === 'sj' || type === 'dj' || type === 'ht' || type === 'height') return ' cm';
    return '';
  };

  const renderCategoryChart = (type: string) => {
    const data = getCategoryChartData(type);
    const unit = categoryUnit(type);
    return (
      <View key={type} style={{ marginBottom: 20 }}>
        <Text style={[styles.subLabel, { marginBottom: 6 }]}>{CATEGORY_LABELS[type] || type}{unit ? ` (${unit})` : ''}</Text>
        {data.length === 0 ? (
          <View style={{ height: 80, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>Noch keine Daten</Text>
          </View>
        ) : (() => {
          // Fester Abstand zwischen Punkten (statt über die volle Breite zu strecken).
          const POINT_SPACING = 80;
          const Y_AXIS_W = 56;
          const RIGHT_PAD = 24;
          const chartWidth = Math.max(220, Y_AXIS_W + Math.max(1, data.length - 1) * POINT_SPACING + RIGHT_PAD);
          return (
            <View style={{ borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart data={data} width={chartWidth} height={180}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} padding={{ left: 12, right: 12 }} />
                  <YAxis width={Y_AXIS_W} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} label={unit ? { value: unit, position: 'insideTopLeft', fill: 'rgba(255,255,255,0.4)', fontSize: 10 } : undefined} domain={[0, 'auto']} />
                  <Tooltip
                    content={(props: any) => {
                      const { active, payload } = props || {};
                      if (!active || !payload || !payload.length) return null;
                      const p = payload[0].payload || {};
                      const iso = String(p.sortKey || '');
                      const [yy, mm, dd] = iso.split('-');
                      const dateStr = iso ? `${dd}.${mm}.${yy}` : '';
                      const valStr = `${String(payload[0].value).replace('.', ',')}${tooltipUnit(type)}`;
                      return (
                        <div style={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12, color: '#fff', padding: '6px 10px' } as any}>
                          {dateStr ? <div style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 2 } as any}>Datum: {dateStr}</div> : null}
                          <div style={{ color: categoryColor(type) } as any}>{CATEGORY_LABELS[type] || type}: {valStr}</div>
                          {p.note ? <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: 3 } as any}>Notiz: {p.note}</div> : null}
                        </div>
                      ) as any;
                    }}
                  />
                  <Line dataKey={type} name={CATEGORY_LABELS[type] || type} stroke={categoryColor(type)} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ScrollView>
            </View>
          );
        })()}
      </View>
    );
  };

  const fetchPlayer = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return; }
    try {
      let playerDetailsId = routePlayerId || viewAsPlayerId || null;

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
  }, [session?.user?.id, profile?.first_name, profile?.last_name, viewAsPlayerId, routePlayerId]);

  const fetchClubLogos = useCallback(async () => {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const map: Record<string, string> = {};
      for (const row of data) map[row.club_name] = row.logo_url;
      setClubLogos(map);
    }
  }, []);

  useEffect(() => { fetchPlayer(); fetchClubLogos(); }, [fetchPlayer, fetchClubLogos]);

  useEffect(() => {
    if (!player?.id) { setPlayerPrototype(null); return; }
    (async () => {
      const { data: assignment } = await supabase
        .from('player_prototype_assignments')
        .select('prototype_id')
        .eq('player_id', player.id)
        .maybeSingle();
      if (!assignment?.prototype_id) { setPlayerPrototype(null); return; }
      const { data: proto } = await supabase.from('player_prototypes').select('*').eq('id', assignment.prototype_id).maybeSingle();
      setPlayerPrototype((proto as Prototype | null) ?? null);
    })();
  }, [player?.id]);

  // CSS-Injection für Fullscreen-Styling + JS-Fallback: Badge-Styles direkt setzen bei Fullscreen-Enter
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // 1) CSS für Wrapper-Fullscreen-Layout
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      [data-video-wrapper="true"]:fullscreen,
      [data-video-wrapper="true"]:-webkit-full-screen {
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        aspect-ratio: unset !important;
        background: #000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      [data-video-wrapper="true"]:fullscreen video,
      [data-video-wrapper="true"]:-webkit-full-screen video {
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
      }
    `;
    document.head.appendChild(styleEl);

    // 2) JS-Fallback: Badge-Styles bei Fullscreen-Enter/Exit direkt am DOM-Element setzen
    const applyBadgeStyles = () => {
      const fsEl = (document as any).fullscreenElement || (document as any).webkitFullscreenElement;
      const badges = document.querySelectorAll('[data-phase-badge="true"]');
      badges.forEach((b) => {
        const badge = b as HTMLElement;
        const inFullscreen = !!(fsEl && fsEl.contains(badge));
        if (inFullscreen) {
          badge.style.setProperty('position', 'absolute', 'important');
          badge.style.setProperty('top', '24px', 'important');
          badge.style.setProperty('right', '24px', 'important');
          badge.style.setProperty('z-index', '2147483647', 'important');
          badge.style.setProperty('padding', '8px 16px', 'important');
          badge.style.setProperty('background-color', 'rgba(0,0,0,0.85)', 'important');
          // Text im Badge vergrößern
          const texts = badge.querySelectorAll('*');
          texts.forEach((t) => {
            (t as HTMLElement).style.setProperty('font-size', '14px', 'important');
          });
        } else {
          badge.style.removeProperty('position');
          badge.style.removeProperty('top');
          badge.style.removeProperty('right');
          badge.style.removeProperty('z-index');
          badge.style.removeProperty('padding');
          badge.style.removeProperty('background-color');
          const texts = badge.querySelectorAll('*');
          texts.forEach((t) => {
            (t as HTMLElement).style.removeProperty('font-size');
          });
        }
      });
    };
    document.addEventListener('fullscreenchange', applyBadgeStyles);
    document.addEventListener('webkitfullscreenchange', applyBadgeStyles as any);

    return () => {
      try { document.head.removeChild(styleEl); } catch {}
      document.removeEventListener('fullscreenchange', applyBadgeStyles);
      document.removeEventListener('webkitfullscreenchange', applyBadgeStyles as any);
    };
  }, []);

  // Fullscreen-Hijack: intercept pointer-down auf dem <video> im Bereich des nativen Fullscreen-Buttons (bottom-right)
  // → direkter requestFullscreen auf den Wrapper (mit Badge), bevor native Controls feuern
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPointerDown = (e: any) => {
      const target = e.target as HTMLElement | null;
      if (!target || (target.tagName !== 'VIDEO')) return;
      const video = target as HTMLVideoElement;
      const rect = video.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      // Nativer Fullscreen-Button liegt in der Controls-Bar (bottom), ~40px von rechts, ~40px hoch
      const isInControlBar = relY > rect.height - 44;
      const isInFullscreenBtnArea = relX > rect.width - 56 && relX < rect.width - 12;
      if (!isInControlBar || !isInFullscreenBtnArea) return;
      const wrapper = video.closest('[data-video-wrapper="true"]') as HTMLElement | null;
      if (!wrapper || wrapper === video) return;
      // Native Fullscreen verhindern, Wrapper stattdessen fullscreenen
      e.preventDefault();
      e.stopImmediatePropagation();
      try {
        (wrapper as any).requestFullscreen?.() || (wrapper as any).webkitRequestFullscreen?.();
      } catch {}
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  // Video-Library: zugewiesene Videos für den Spieler laden
  useEffect(() => {
    if (!player?.id) { setPlayerVideos([]); return; }
    (async () => {
      const { data: assignRows } = await supabase
        .from('player_video_assignments')
        .select('video_id, type')
        .eq('player_id', player.id);
      if (!assignRows || assignRows.length === 0) { setPlayerVideos([]); return; }
      const videoIds = assignRows.map((a: any) => a.video_id);
      const { data: videos } = await supabase
        .from('player_videos')
        .select('id, video_path, video_url, label, description, role_model_name, role_model_club, phase')
        .in('id', videoIds);
      if (!videos) { setPlayerVideos([]); return; }
      const merged = videos.flatMap((v: any) => {
        const types = assignRows.filter((a: any) => a.video_id === v.id).map((a: any) => a.type);
        return types.map((t: 'strength' | 'potential') => ({ ...v, type: t }));
      });
      setPlayerVideos(merged);
    })();
  }, [player?.id]);

  useEffect(() => {
    if (expandedCard === 'staerken' && player?.position) {
      setSelectedMetric('position');
    }
  }, [expandedCard, player?.position]);

  // ---------- Analysen: Modal-Logik ----------

  const openNewAnalysisModal = () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setEditingAnalysis(null);
    setAnalysisDate(iso);
    setAnalysisTopics(['']);
    setAnalysisTodos(['']);
    setAnalysisVideoFile(null);
    setAnalysisVideoPath(null);
    setAnalysisVideoRemove(false);
    setShowAnalysisModal(true);
  };

  const openEditAnalysisModal = (entry: AnalysisEntry) => {
    setEditingAnalysis(entry);
    setAnalysisDate(entry.analysis_date ? entry.analysis_date.substring(0, 10) : '');
    setAnalysisTopics(entry.topics && entry.topics.length > 0 ? [...entry.topics] : ['']);
    setAnalysisTodos(entry.todos && entry.todos.length > 0 ? [...entry.todos] : ['']);
    setAnalysisVideoFile(null);
    setAnalysisVideoPath(entry.video_path || null);
    setAnalysisVideoRemove(false);
    setShowAnalysisModal(true);
  };

  const closeAnalysisModal = () => {
    setShowAnalysisModal(false);
    setEditingAnalysis(null);
    setAnalysisVideoFile(null);
    setAnalysisVideoPath(null);
    setAnalysisVideoRemove(false);
  };

  const pickAnalysisVideo = () => {
    if (Platform.OS !== 'web') return; // MVP: Web-first
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/quicktime,video/webm,video/*';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        setAnalysisVideoFile({ uri: URL.createObjectURL(file), name: file.name, type: file.type || 'video/mp4', file });
        setAnalysisVideoRemove(false);
      }
    };
    input.click();
  };

  const saveAnalysis = async () => {
    if (!player?.id) return;
    if (!analysisDate) return;
    setAnalysisSaving(true);
    try {
      const topicsClean = analysisTopics.map(t => t.trim()).filter(Boolean);
      const todosClean = analysisTodos.map(t => t.trim()).filter(Boolean);

      let videoPath: string | null = analysisVideoPath;

      if (editingAnalysis) {
        // Update
        if (analysisVideoRemove && editingAnalysis.video_path) {
          await supabase.storage.from(ANALYSIS_VIDEOS_BUCKET).remove([editingAnalysis.video_path]);
          videoPath = null;
        }
        if (analysisVideoFile?.file) {
          setAnalysisUploading(true);
          const ext = (analysisVideoFile.name.split('.').pop() || 'mp4').toLowerCase();
          const fileName = `${player.id}/${editingAnalysis.id}_${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from(ANALYSIS_VIDEOS_BUCKET).upload(fileName, analysisVideoFile.file, { contentType: analysisVideoFile.type || 'video/mp4', upsert: false });
          setAnalysisUploading(false);
          if (upErr) { console.error('Video upload error:', upErr); alert('Video-Upload fehlgeschlagen: ' + upErr.message); return; }
          if (editingAnalysis.video_path) {
            await supabase.storage.from(ANALYSIS_VIDEOS_BUCKET).remove([editingAnalysis.video_path]);
          }
          videoPath = fileName;
        }

        const { error } = await supabase.from('player_analyses').update({
          analysis_date: analysisDate,
          topics: topicsClean,
          todos: todosClean,
          video_path: videoPath,
          updated_at: new Date().toISOString(),
        }).eq('id', editingAnalysis.id);
        if (error) { console.error('Update error:', error); return; }
      } else {
        // Insert
        const { data: inserted, error } = await supabase.from('player_analyses').insert({
          player_id: player.id,
          advisor_id: profile?.id || null,
          analysis_date: analysisDate,
          topics: topicsClean,
          todos: todosClean,
          video_path: null,
        }).select().single();
        if (error || !inserted) { console.error('Insert error:', error); return; }

        if (analysisVideoFile?.file) {
          setAnalysisUploading(true);
          const ext = (analysisVideoFile.name.split('.').pop() || 'mp4').toLowerCase();
          const fileName = `${player.id}/${inserted.id}_${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from(ANALYSIS_VIDEOS_BUCKET).upload(fileName, analysisVideoFile.file, { contentType: analysisVideoFile.type || 'video/mp4', upsert: false });
          setAnalysisUploading(false);
          if (!upErr) {
            await supabase.from('player_analyses').update({ video_path: fileName }).eq('id', inserted.id);
          } else {
            console.error('Video upload error:', upErr);
          }
        }
      }

      await fetchAnalyses();
      closeAnalysisModal();
    } finally {
      setAnalysisSaving(false);
    }
  };

  const deleteAnalysis = async (entry: AnalysisEntry) => {
    if (!entry.id) return;
    const confirmed = await confirmDialog({ title: 'Analyse löschen', message: 'Analyse wirklich löschen?', danger: true, confirmLabel: 'Löschen' });
    if (!confirmed) return;
    if (entry.video_path) {
      await supabase.storage.from(ANALYSIS_VIDEOS_BUCKET).remove([entry.video_path]);
    }
    await supabase.from('player_analyses').delete().eq('id', entry.id);
    await fetchAnalyses();
  };

  const age = calculateAge(player?.birth_date);
  const birthYear = formatBirthYear(player?.birth_date);
  const clubLogo = player?.club ? resolveClubLogo(player.club, clubLogos) : null;
  const positionLabel = player?.position ? renderPosition(player.position) : '';
  const playerStrengths = player?.strengths ? player.strengths.split(';').map(s => s.trim()).filter(Boolean) : [];
  const playerPotentials = player?.potentials ? player.potentials.split(';').map(s => s.trim()).filter(Boolean) : [];
  const secondaryPositions = player?.secondary_position
    ? player.secondary_position.split(',').map(s => renderPosition(s.trim())).filter(Boolean)
    : [];

  // ---------- Section: Header ----------
  const firstName = (player?.first_name || profile?.first_name || '').toUpperCase();
  const lastName = (player?.last_name || profile?.last_name || '').toUpperCase();
  const photoW = isMobile ? 110 : 150;
  const photoH = isMobile ? 140 : 190;
  const nameSize = isMobile ? 48 : 72;
  const nameLH = isMobile ? 52 : 76;

  const HeaderBar = (
    <View style={[styles.headerCard, { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={styles.headerTopRow}>
        {player?.photo_url ? (
          <Image source={{ uri: player.photo_url }} style={{ width: photoW, height: photoH, borderRadius: 8 }} resizeMode="contain" />
        ) : (
          <View style={[styles.photoPlaceholder, { width: photoW, height: photoH, borderRadius: 8, backgroundColor: colors.primary }]}>
            <Text style={{ fontSize: 42, fontWeight: '700', color: colors.primaryText }}>
              {firstName[0] || ''}{lastName[0] || ''}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, justifyContent: 'space-between', minHeight: photoH, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              {firstName ? <Text style={[styles.playerNameHuge, { fontSize: nameSize, lineHeight: nameLH }]}>{firstName}</Text> : null}
              {lastName ? <Text style={[styles.playerNameHuge, { fontSize: nameSize, lineHeight: nameLH }]}>{lastName}</Text> : null}
            </View>
            <Text style={styles.headerScreenLabel}>Performance</Text>
          </View>
          <View style={styles.clubRow}>
            {clubLogo ? (
              <Image source={{ uri: clubLogo }} style={styles.clubLogoLarge} />
            ) : null}
            <Text style={styles.clubName} numberOfLines={1}>{normalizeGermanClubName(player?.club || 'VEREINSLOS').toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.headerDivider} />

      <View style={styles.statsRow}>
        <Pressable style={styles.statCol} onHoverIn={() => setShowNatTooltip(true)} onHoverOut={() => setShowNatTooltip(false)}>
          <Text style={styles.statLabel}>NATIONALITÄT</Text>
          <Text style={[styles.statValue, { fontSize: 18, lineHeight: 20 }]}>
            {player?.nationality ? player.nationality.split(/[,\/]+/).map(n => n.trim()).filter(Boolean).map(n => COUNTRY_FLAGS[n] || countryToFlag(n)).join(' ') : '-'}
          </Text>
          {showNatTooltip && player?.nationality ? (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>{player.nationality}</Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>GEBURTSDATUM</Text>
          <Text style={styles.statValue}>
            {formatGermanDate(player?.birth_date)}{age !== null ? `  (${age})` : ''}
          </Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>POSITION</Text>
          <Text style={styles.statValue}>{positionLabel || '-'}</Text>
        </View>
        {!isTrainerView && (
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>VERTRAGSENDE</Text>
            <Text style={styles.statValue}>{formatContractEnd(player?.contract_end)}</Text>
          </View>
        )}
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>TRANSFERMARKT-PROFIL</Text>
          {player?.transfermarkt_url ? (
            <TouchableOpacity onPress={() => Linking.openURL(player.transfermarkt_url)}>
              <Ionicons name="link" size={16} color="#fff" />
            </TouchableOpacity>
          ) : (
            <Text style={styles.statValue}>-</Text>
          )}
        </View>
      </View>
    </View>
  );

  // ---------- Bereiche ----------

  const Content = (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          {HeaderBar}

          {/* Erweiterte Ansicht */}
          {expandedCard === 'athletik' && (
              <View style={styles.expandedCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Athletik & Physis</Text>
                  <Pressable
                    onPress={() => setExpandedCard(null)}
                    onHoverIn={() => setExpandHover(true)}
                    onHoverOut={() => setExpandHover(false)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="resize-outline" size={expandHover ? 22 : 16} color={expandHover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'} />
                  </Pressable>
                </View>
                {/* Obere Reihe: Metrik-Kategorien nebeneinander */}
                <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 16, alignItems: 'flex-start' }}>
                  <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? '100%' : undefined }}>
                    <Text style={[styles.subLabel, { marginBottom: 8 }]}>Körperliche Entwicklung</Text>
                    <Pressable
                      onPress={() => setSelectedMetric(selectedMetric === 'koerper' ? null : 'koerper')}
                      style={[styles.metricRow, { paddingHorizontal: 0, borderLeftWidth: 0 }, selectedMetric === 'koerper' && styles.metricRowActive]}
                    >
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Größe</Text><Text style={styles.infoValue}>{latestValue('height') !== '-' ? `${latestValue('height')} cm` : (player?.height ? `${player.height} cm` : '-')}</Text></View>
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Gewicht</Text><Text style={styles.infoValue}>{latestValue('weight') !== '-' ? `${latestValue('weight')} kg` : '-'}</Text></View>
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Starker Fuß</Text><Text style={styles.infoValue}>{player?.strong_foot || '-'}</Text></View>
                    </Pressable>
                  </View>

                  <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? '100%' : undefined }}>
                    <Text style={[styles.subLabel, { marginBottom: 8 }]}>Sprintprofil</Text>
                    <Pressable
                      onPress={() => setSelectedMetric(selectedMetric === 'sprint' ? null : 'sprint')}
                      style={[styles.metricRow, { paddingHorizontal: 0, borderLeftWidth: 0 }, selectedMetric === 'sprint' && styles.metricRowActive]}
                    >
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Sprint (10m)</Text><Text style={styles.infoValue}>{bestValue('sprint_10m') !== '-' ? `${bestValue('sprint_10m')}s` : '-'}</Text></View>
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Sprint (20m)</Text><Text style={styles.infoValue}>{bestValue('sprint_20m') !== '-' ? `${bestValue('sprint_20m')}s` : '-'}</Text></View>
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Sprint (30m)</Text><Text style={styles.infoValue}>{bestValue('sprint_30m') !== '-' ? `${bestValue('sprint_30m')}s` : '-'}</Text></View>
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Vmax</Text><Text style={styles.infoValue}>{bestValue('vmax') !== '-' ? `${bestValue('vmax')} km/h` : '-'}</Text></View>
                    </Pressable>
                  </View>

                  <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? '100%' : undefined }}>
                    <Text style={[styles.subLabel, { marginBottom: 8 }]}>Sprünge</Text>
                    <Pressable
                      onPress={() => setSelectedMetric(selectedMetric === 'jumps' ? null : 'jumps')}
                      style={[styles.metricRow, { paddingHorizontal: 0, borderLeftWidth: 0 }, selectedMetric === 'jumps' && styles.metricRowActive]}
                    >
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Countermovement Jump</Text><Text style={styles.infoValue}>{bestValue('cmj') !== '-' ? `${bestValue('cmj')} cm` : '-'}</Text></View>
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Squat Jump</Text><Text style={styles.infoValue}>{bestValue('sj') !== '-' ? `${bestValue('sj')} cm` : '-'}</Text></View>
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Drop Jump</Text><Text style={styles.infoValue}>{bestValue('dj') !== '-' ? `${bestValue('dj')} cm${bestValue('dj_rsi') !== '-' ? ` · RSI ${bestValue('dj_rsi')}` : ''}` : '-'}</Text></View>
                      <View style={styles.infoRow}><Text style={styles.infoLabel}>Hop Test</Text><Text style={styles.infoValue}>{bestValue('ht') !== '-' ? `${bestValue('ht')} cm${bestValue('ht_rsi') !== '-' ? ` · RSI ${bestValue('ht_rsi')}` : ''}` : '-'}</Text></View>
                    </Pressable>
                  </View>
                </View>

                {/* Unten: Chart + Einträge */}
                <View style={{ marginTop: 20 }}>
                    {/* Charts — pro Kategorie ein eigener Graph (X = Datum, ein Punkt je Messung) */}
                    {!selectedMetric ? (
                      <View style={{ minHeight: 120, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Klicke links auf eine Kategorie</Text>
                      </View>
                    ) : !measurements.some(m => getDisplayTypes(selectedMetric).includes(m.type)) ? (
                      <View style={{ minHeight: 120, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Noch keine Daten vorhanden</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                          <TouchableOpacity onPress={() => { const t = new Date(); setAddDay(String(t.getDate())); setAddMonth(String(t.getMonth()+1)); setAddYear(String(t.getFullYear())); setAddValue(''); setAddValue2(''); setAddValue3(''); setAddValue4(''); setAddValue5(''); setAddValue6(''); setAddNote(''); setShowAddForm(true); }} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Ersten Eintrag hinzufügen</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={handleImportFile} disabled={importExtracting} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                            {importExtracting ? <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" /> : <Ionicons name="cloud-upload-outline" size={13} color="rgba(255,255,255,0.6)" />}
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{importExtracting ? 'Liest …' : 'Datei importieren'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View>
                        {getDisplayTypes(selectedMetric).map(t => renderCategoryChart(t))}
                      </View>
                    )}

                    {/* Einträge-Liste (gruppiert nach Datum) */}
                    {selectedMetric && (() => {
                      const types = getDisplayTypes(selectedMetric);
                      const entries = measurements.filter(m => types.includes(m.type)).sort((a, b) => b.measured_at.localeCompare(a.measured_at));
                      if (entries.length === 0 && !showAddForm) return null;
                      const typeLabels: Record<string, string> = { height: 'Größe', weight: 'Gewicht', sprint_10m: '10m', sprint_20m: '20m', sprint_30m: '30m', vmax: 'Vmax', cmj: 'CMJ', sj: 'SJ', dj: 'DJ', dj_rsi: 'DJ RSI', ht: 'HT', ht_rsi: 'HT RSI' };
                      const formatVal = (val: number, type: string) => {
                        if (type.startsWith('sprint')) return val.toFixed(2) + 's';
                        if (type === 'vmax') return val.toFixed(1) + ' km/h';
                        if (type === 'cmj' || type === 'sj' || type === 'dj' || type === 'ht') return val.toFixed(1) + ' cm';
                        if (type === 'dj_rsi' || type === 'ht_rsi') return val.toFixed(2);
                        if (type === 'height') return val % 1 === 0 ? String(val) + ' cm' : val.toFixed(1) + ' cm';
                        if (type === 'weight') return val % 1 === 0 ? String(val) + ' kg' : val.toFixed(1) + ' kg';
                        return String(val);
                      };

                      const grouped: Array<{ date: string; items: typeof entries }> = [];
                      for (const e of entries) {
                        const existing = grouped.find(g => g.date === e.measured_at);
                        if (existing) { existing.items.push(e); }
                        else { grouped.push({ date: e.measured_at, items: [e] }); }
                      }

                      return (
                        <View style={{ marginTop: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={styles.subLabel}>Einträge</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TouchableOpacity onPress={handleImportFile} disabled={importExtracting} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                                {importExtracting ? <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" /> : <Ionicons name="cloud-upload-outline" size={12} color="rgba(255,255,255,0.5)" />}
                                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{importExtracting ? 'Liest …' : 'Datei importieren'}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => { const t = new Date(); setAddDay(String(t.getDate())); setAddMonth(String(t.getMonth()+1)); setAddYear(String(t.getFullYear())); setAddValue(''); setAddValue2(''); setAddValue3(''); setAddValue4(''); setAddValue5(''); setAddValue6(''); setAddNote(''); setEditingMeasurement(null); setShowAddForm(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                                <Ionicons name="add" size={12} color="rgba(255,255,255,0.5)" />
                                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Eintrag</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Inline-Formular (oben bei Einträgen) */}
                          {showAddForm && (
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                              {/* Datum als Dropdowns (Design-System) */}
                              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, zIndex: 20 }}>
                                {([
                                  { key: 'day' as const, label: 'TAG', value: addDay, set: setAddDay, opts: DAY_OPTS, w: 70 },
                                  { key: 'month' as const, label: 'MONAT', value: addMonth, set: setAddMonth, opts: MONTH_OPTS, w: 80 },
                                  { key: 'year' as const, label: 'JAHR', value: addYear, set: setAddYear, opts: YEAR_OPTS, w: 88 },
                                ]).map(f => (
                                  <View key={f.key} style={{ zIndex: dateOpen === f.key ? 30 : 1 }} {...({ dataSet: { kmhdropdown: 'true' } } as any)}>
                                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{f.label}</Text>
                                    <Pressable onPress={() => setDateOpen(o => o === f.key ? null : f.key)} style={[styles.chartInput, { width: f.w, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                                      <Text style={{ color: f.value ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13 }}>{f.value || '–'}</Text>
                                      <Ionicons name={dateOpen === f.key ? 'chevron-up' : 'chevron-down'} size={12} color="rgba(255,255,255,0.5)" />
                                    </Pressable>
                                    {dateOpen === f.key && (
                                      <View style={{ position: 'absolute', top: 44, left: 0, width: Math.max(f.w, 70), maxHeight: 168, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden', zIndex: 40 }}>
                                        <ScrollView showsVerticalScrollIndicator nestedScrollEnabled>
                                          {f.opts.map(opt => (
                                            <TouchableOpacity key={opt} onPress={() => { f.set(opt); setDateOpen(null); }} style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: f.value === opt ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                                              <Text style={{ color: '#fff', fontSize: 13 }}>{opt}</Text>
                                            </TouchableOpacity>
                                          ))}
                                        </ScrollView>
                                      </View>
                                    )}
                                  </View>
                                ))}
                              </View>

                              <View style={{ flexDirection: 'row', gap: 8, rowGap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <View>
                                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{selectedMetric === 'koerper' ? 'GEWICHT (KG)' : selectedMetric === 'sprint' ? '10M (SEK)' : selectedMetric === 'cmj' ? 'WERT (CM)' : selectedMetric === 'jumps' ? 'CMJ (CM)' : (selectedMetric === 'sj' || selectedMetric === 'dj' || selectedMetric === 'ht') ? 'HÖHE (CM)' : 'WERT'}</Text>
                                  <TextInput style={styles.chartInput} value={addValue} onChangeText={setAddValue} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                </View>
                                {selectedMetric === 'koerper' && (
                                  <View>
                                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>GRÖSSE (CM)</Text>
                                    <TextInput style={styles.chartInput} value={addValue2} onChangeText={setAddValue2} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                  </View>
                                )}
                                {selectedMetric === 'sprint' && (
                                  <>
                                    <View>
                                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>20M (SEK)</Text>
                                      <TextInput style={styles.chartInput} value={addValue2} onChangeText={setAddValue2} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                    </View>
                                    <View>
                                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>30M (SEK)</Text>
                                      <TextInput style={styles.chartInput} value={addValue3} onChangeText={setAddValue3} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                    </View>
                                    <View>
                                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>VMAX (KM/H)</Text>
                                      <TextInput style={styles.chartInput} value={addValue4} onChangeText={setAddValue4} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                    </View>
                                  </>
                                )}
                                {(selectedMetric === 'dj' || selectedMetric === 'ht') && (
                                  <View>
                                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>RSI</Text>
                                    <TextInput style={styles.chartInput} value={addValue2} onChangeText={setAddValue2} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                  </View>
                                )}
                                {selectedMetric === 'jumps' && (
                                  <>
                                    <View>
                                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>SJ (CM)</Text>
                                      <TextInput style={styles.chartInput} value={addValue2} onChangeText={setAddValue2} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                    </View>
                                    <View>
                                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>DJ (CM)</Text>
                                      <TextInput style={styles.chartInput} value={addValue3} onChangeText={setAddValue3} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                    </View>
                                    <View>
                                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>DJ RSI</Text>
                                      <TextInput style={styles.chartInput} value={addValue4} onChangeText={setAddValue4} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                    </View>
                                    <View>
                                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>HT (CM)</Text>
                                      <TextInput style={styles.chartInput} value={addValue5} onChangeText={setAddValue5} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                    </View>
                                    <View>
                                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>HT RSI</Text>
                                      <TextInput style={styles.chartInput} value={addValue6} onChangeText={setAddValue6} placeholder="-" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                                    </View>
                                  </>
                                )}
                                <View style={{ flex: 1 }} />
                                <TouchableOpacity onPress={() => setShowAddForm(false)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Abbrechen</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={saveMeasurement} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 1, borderColor: '#22c55e' }}>
                                  <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>Speichern</Text>
                                </TouchableOpacity>
                              </View>
                              <View style={{ marginTop: 8 }}>
                                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>ORT / NOTIZ</Text>
                                <TextInput style={[styles.chartInput, { width: '100%' }]} value={addNote} onChangeText={setAddNote} placeholder="z.B. Stadion, Halle, Bedingungen …" placeholderTextColor="rgba(255,255,255,0.2)" />
                              </View>
                            </View>
                          )}

                          {grouped.map((group, gi) => {
                            const d = new Date(group.date);
                            const dateStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
                            const isEditing = editingMeasurement === group.date;
                            const groupNote = (group.items.find(e => e.note && String(e.note).trim())?.note) || '';
                            return (
                              <View key={gi} style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingVertical: 4 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 90 }}>{dateStr}</Text>
                                  <View style={{ flex: 1, flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                    {isEditing ? (
                                      types.map(type => {
                                        const existing = group.items.find(e => e.type === type);
                                        return (
                                          <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{typeLabels[type] || type}:</Text>
                                            <TextInput
                                              style={[styles.chartInput, { width: 55 }]}
                                              defaultValue={existing ? String(existing.value) : ''}
                                              placeholder="-"
                                              placeholderTextColor="rgba(255,255,255,0.2)"
                                              onChangeText={(text) => setEditValues(prev => ({ ...prev, [type]: text }))}
                                              keyboardType="numeric"
                                            />
                                            {existing && (
                                              <TouchableOpacity onPress={() => { setEditValues(prev => ({ ...prev, [type]: '' })); deleteMeasurement(existing.id); }} style={{ padding: 2 }}>
                                                <Ionicons name="close-circle-outline" size={12} color="rgba(255,255,255,0.3)" />
                                              </TouchableOpacity>
                                            )}
                                          </View>
                                        );
                                      })
                                    ) : (
                                      [...group.items].sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type)).map(e => (
                                        <Text key={e.id} style={{ fontSize: 11, color: '#fff' }}>
                                          <Text style={{ color: 'rgba(255,255,255,0.5)' }}>{typeLabels[e.type] || e.type}: </Text>
                                          {formatVal(e.value, e.type)}
                                        </Text>
                                      ))
                                    )}
                                  </View>
                                  {!isEditing ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                      <TouchableOpacity onPress={() => {
                                        const vals: Record<string, string> = {};
                                        for (const e of group.items) vals[e.type] = String(e.value);
                                        setEditValues(vals);
                                        setEditNote(groupNote);
                                        setEditingMeasurement(group.date);
                                      }} style={{ padding: 4 }}>
                                        <Ionicons name="pencil-outline" size={13} color="rgba(255,255,255,0.3)" />
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => deleteEntryGroup(group.date, group.items)} style={{ padding: 4 }}>
                                        <Ionicons name="trash-outline" size={13} color="rgba(239,68,68,0.55)" />
                                      </TouchableOpacity>
                                    </View>
                                  ) : (
                                    <TouchableOpacity onPress={() => saveEditedValues(group.date, group.items)} style={{ padding: 4 }}>
                                      <Ionicons name="checkmark" size={14} color="#22c55e" />
                                    </TouchableOpacity>
                                  )}
                                </View>
                                {isEditing ? (
                                  <View style={{ marginLeft: 90, marginTop: 4 }}>
                                    <TextInput style={[styles.chartInput, { width: '100%' }]} defaultValue={groupNote} onChangeText={setEditNote} placeholder="Ort / Notiz …" placeholderTextColor="rgba(255,255,255,0.2)" />
                                  </View>
                                ) : groupNote ? (
                                  <View style={{ marginLeft: 90, marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.35)" />
                                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{groupNote}</Text>
                                  </View>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })()}
                </View>
              </View>
          )}

          {!expandedCard && (
          <View style={styles.dataGrid}>
            {/* Karte: Spielerprofil */}
            <View style={styles.dataGridCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Spielerprofil</Text>
                <Pressable
                  onPress={() => setExpandedCard('staerken')}
                  onHoverIn={() => setExpandHover(true)}
                  onHoverOut={() => setExpandHover(false)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="resize-outline" size={expandHover ? 22 : 16} color={expandHover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {/* Position */}
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.subLabel}>Position</Text>
                  <PositionField
                    primaryPosition={toPositionShort(player?.position)}
                    secondaryPositions={(player?.secondary_position || '').split(',').map(sp => toPositionShort(sp)).filter(Boolean)}
                    activePosition={toPositionShort(player?.position)}
                    onSelectPosition={() => {}}
                    maxWidth={100}
                    circleSize={18}
                  />
                </View>

                {/* Stärken */}
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.subLabel}>Stärken</Text>
                  {playerStrengths.map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="chevron-forward-outline" size={10} color="#22c55e" />
                      <Text style={styles.listItem}>{s}</Text>
                    </View>
                  ))}
                </View>

                {/* Potenziale */}
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.subLabel}>Potenziale</Text>
                  {playerPotentials.map((p, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="chevron-forward-outline" size={10} color="#ef4444" />
                      <Text style={styles.listItem}>{p}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Karte: Athletik & Physis */}
            <View style={styles.dataGridCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Athletik & Physis</Text>
                <Pressable
                  onPress={() => setExpandedCard('athletik')}
                  onHoverIn={() => setExpandHover(true)}
                  onHoverOut={() => setExpandHover(false)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="resize-outline" size={expandHover ? 22 : 16} color={expandHover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Größe</Text><Text style={styles.infoValue}>{latestValue('height') !== '-' ? `${latestValue('height')} cm` : (player?.height ? `${player.height} cm` : '-')}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Gewicht</Text><Text style={styles.infoValue}>{latestValue('weight') !== '-' ? `${latestValue('weight')} kg` : '-'}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Starker Fuß</Text><Text style={styles.infoValue}>{player?.strong_foot || '-'}</Text></View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Sprint (10m)</Text><Text style={styles.infoValue}>{bestValue('sprint_10m') !== '-' ? `${bestValue('sprint_10m')}s` : '-'}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Sprint (20m)</Text><Text style={styles.infoValue}>{bestValue('sprint_20m') !== '-' ? `${bestValue('sprint_20m')}s` : '-'}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Sprint (30m)</Text><Text style={styles.infoValue}>{bestValue('sprint_30m') !== '-' ? `${bestValue('sprint_30m')}s` : '-'}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Vmax</Text><Text style={styles.infoValue}>{bestValue('vmax') !== '-' ? `${bestValue('vmax')} km/h` : '-'}</Text></View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Countermovement Jump</Text><Text style={styles.infoValue}>{bestValue('cmj') !== '-' ? `${bestValue('cmj')} cm` : '-'}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Squat Jump</Text><Text style={styles.infoValue}>{bestValue('sj') !== '-' ? `${bestValue('sj')} cm` : '-'}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Drop Jump</Text><Text style={styles.infoValue}>{bestValue('dj') !== '-' ? `${bestValue('dj')} cm` : '-'}{bestValue('dj_rsi') !== '-' ? `  ·  RSI ${bestValue('dj_rsi')}` : ''}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Hop Test</Text><Text style={styles.infoValue}>{bestValue('ht') !== '-' ? `${bestValue('ht')} cm` : '-'}{bestValue('ht_rsi') !== '-' ? `  ·  RSI ${bestValue('ht_rsi')}` : ''}</Text></View>
                </View>
              </View>
            </View>

            {/* Karte: Analysen */}
            <View style={styles.dataGridCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Analysen</Text>
                <Pressable
                  onPress={() => setExpandedCard('analysen')}
                  onHoverIn={() => setExpandHover(true)}
                  onHoverOut={() => setExpandHover(false)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="resize-outline" size={expandHover ? 22 : 16} color={expandHover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'} />
                </Pressable>
              </View>
              {playerAnalyses.length === 0 ? (
                <View style={{ paddingVertical: 8 }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Noch keine Analysen vorhanden.</Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {playerAnalyses.slice(0, 3).map((a) => (
                    <View key={a.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Ionicons name="chevron-forward-outline" size={10} color="rgba(255,255,255,0.5)" style={{ marginTop: 4 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoValue, { marginBottom: 2 }]}>{formatAnalysisDate(a.analysis_date)}</Text>
                        {a.topics && a.topics.length > 0 && (
                          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }} numberOfLines={2}>
                            {a.topics.slice(0, 3).join(' · ')}
                          </Text>
                        )}
                      </View>
                      {a.video_path && (
                        <Ionicons name="play-circle-outline" size={14} color="rgba(255,255,255,0.35)" style={{ marginTop: 3 }} />
                      )}
                    </View>
                  ))}
                  {playerAnalyses.length > 3 && (
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>+{playerAnalyses.length - 3} weitere</Text>
                  )}
                </View>
              )}
            </View>

          </View>
          )}

          {/* Erweiterte Ansicht: Spielerprofil */}
          {expandedCard === 'staerken' && (
            <View style={styles.expandedCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Spielerprofil</Text>
                <Pressable
                  onPress={() => setExpandedCard(null)}
                  onHoverIn={() => setExpandHover(true)}
                  onHoverOut={() => setExpandHover(false)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="resize-outline" size={expandHover ? 22 : 16} color={expandHover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'} />
                </Pressable>
              </View>
              {/* Prototyp-Poster zuerst */}
              {playerPrototype && (
                <View style={{ marginBottom: 32 }}>
                  <PrototypePoster prototype={playerPrototype} />
                </View>
              )}

              {/* Trenner zwischen Rolle (oben) und eigenem Profil (unten) */}
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 32 }} />

              {/* Untere Reihe: (Stärken + Potenziale) | Video-Detail — 2 Gruppen */}
              <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 32, alignItems: 'flex-start' }}>
                {/* Sub-Gruppe links: Stärken + Potenziale nebeneinander mit engem Gap */}
                <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 16, flex: isMobile ? undefined : 1, minWidth: isMobile ? undefined : 280, width: isMobile ? '100%' : undefined, alignItems: 'flex-start' }}>
                  {/* Deine Stärken */}
                  <View style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? undefined : 130, width: isMobile ? '100%' : undefined }}>
                    <Text style={[styles.subLabel, { marginBottom: 8 }]}>Deine Stärken</Text>
                    {playerStrengths.map((s, i) => {
                      const count = playerVideos.filter(v => v.type === 'strength' && v.label.trim().toLowerCase() === s.trim().toLowerCase()).length;
                      return (
                        <Pressable
                          key={`s-${i}`}
                          onPress={() => setSelectedMetric(selectedMetric === `staerke-${i}` ? null : `staerke-${i}`)}
                          style={[styles.metricRow, { paddingHorizontal: 0, borderLeftWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, selectedMetric === `staerke-${i}` && styles.metricRowActive]}
                        >
                          <Ionicons name="chevron-forward-outline" size={12} color="#22c55e" style={{ marginTop: 3 }} />
                          <Text style={[styles.infoValue, { flex: 1 }]}>
                            {s}<Text style={{ color: '#fff' }}> ({count})</Text>
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Deine Potenziale */}
                  <View style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? undefined : 130, width: isMobile ? '100%' : undefined }}>
                    <Text style={[styles.subLabel, { marginBottom: 8 }]}>Deine Potenziale</Text>
                    {playerPotentials.map((p, i) => {
                      const count = playerVideos.filter(v => v.type === 'potential' && v.label.trim().toLowerCase() === p.trim().toLowerCase()).length;
                      return (
                        <Pressable
                          key={`p-${i}`}
                          onPress={() => setSelectedMetric(selectedMetric === `potenzial-${i}` ? null : `potenzial-${i}`)}
                          style={[styles.metricRow, { paddingHorizontal: 0, borderLeftWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, selectedMetric === `potenzial-${i}` && styles.metricRowActive]}
                        >
                          <Ionicons name="chevron-forward-outline" size={12} color="#ef4444" style={{ marginTop: 3 }} />
                          <Text style={[styles.infoValue, { flex: 1 }]}>
                            {p}<Text style={{ color: '#fff' }}> ({count})</Text>
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Video-Detail-Panel */}
                <View style={{ flex: isMobile ? undefined : 2.4, minWidth: isMobile ? undefined : 360, width: isMobile ? '100%' : undefined }}>
                  {(() => {
                    if (!selectedMetric || selectedMetric.startsWith('position')) {
                      return (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed', padding: 28, alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
                          <Ionicons name="play-circle-outline" size={48} color="rgba(255,255,255,0.12)" />
                          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 12, lineHeight: 18, maxWidth: 260 }}>
                            Klicke auf eine Stärke oder ein Potenzial, um Video und Beschreibung zu sehen.
                          </Text>
                        </View>
                      );
                    }
                    // Label + Typ aus selectedMetric ableiten
                    const isStrength = selectedMetric.startsWith('staerke-');
                    const idx = parseInt(selectedMetric.split('-')[1], 10);
                    const label = isStrength ? playerStrengths[idx] : playerPotentials[idx];
                    const type: 'strength' | 'potential' = isStrength ? 'strength' : 'potential';
                    const phaseOrder: Record<string, number> = { negative: 0, positive: 1, neutral: 2 };
                    const matchingVideos = label
                      ? playerVideos
                          .filter(v => v.type === type && v.label.trim().toLowerCase() === label.trim().toLowerCase())
                          .sort((a, b) => (phaseOrder[a.phase] ?? 2) - (phaseOrder[b.phase] ?? 2))
                      : [];
                    if (matchingVideos.length === 0) {
                      return (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed', padding: 28, alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
                          <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.12)" />
                          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 12, lineHeight: 18, maxWidth: 260 }}>
                            Dein Berater hat für "{label}" noch kein Video hinterlegt.
                          </Text>
                        </View>
                      );
                    }
                    return (
                      <View style={{ gap: 16 }}>
                        {matchingVideos.map((video, vi) => {
                          const videoSrc = video.video_path
                            ? supabase.storage.from('player-videos').getPublicUrl(video.video_path).data?.publicUrl
                            : video.video_url;
                          const phaseColor = video.phase === 'negative' ? '#ef4444' : video.phase === 'positive' ? '#22c55e' : null;
                          const phaseLabel = video.phase === 'negative' ? 'NEGATIV' : video.phase === 'positive' ? 'POSITIV' : null;
                          return (
                            <View key={video.id} style={{ gap: 12 }}>
                              <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View
                                  {...({ dataSet: { videoWrapper: 'true' } } as any)}
                                  style={{ flex: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                                >
                                  {videoSrc && Platform.OS === 'web' ? (
                                    // @ts-ignore — HTML video element on web
                                    <video
                                      src={videoSrc}
                                      controls
                                      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                                    />
                                  ) : (
                                    <>
                                      <Ionicons name="play-circle-outline" size={42} color="rgba(255,255,255,0.3)" />
                                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 8 }}>Video</Text>
                                    </>
                                  )}
                                  {phaseLabel && phaseColor && (
                                    <View
                                      pointerEvents="none"
                                      {...({ dataSet: { phaseBadge: 'true' } } as any)}
                                      style={{ position: 'absolute', top: 8, right: 8, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: phaseColor, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2 }}
                                    >
                                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: phaseColor }}>{phaseLabel}</Text>
                                    </View>
                                  )}
                                </View>
                                <View style={{ flex: 1, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12, alignItems: 'center', justifyContent: 'center' }}>
                                  <View style={{ width: 56, height: 72, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                    <Ionicons name="person-outline" size={24} color="rgba(255,255,255,0.15)" />
                                  </View>
                                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', textAlign: 'center' }}>{video.role_model_name || 'Role Model'}</Text>
                                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 2 }}>{video.role_model_club || '—'}</Text>
                                </View>
                              </View>
                              {video.description ? (
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                                  <Text style={styles.subLabel}>Beschreibung</Text>
                                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 18, marginTop: 6 }}>
                                    {video.description}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}
                </View>
              </View>
            </View>
          )}


          {/* Erweiterte Ansicht: Analysen */}
          {expandedCard === 'analysen' && (
            <View style={styles.expandedCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Analysen</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {isAdvisor && (
                    <TouchableOpacity
                      onPress={openNewAnalysisModal}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                      <Ionicons name="add" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Neue Analyse</Text>
                    </TouchableOpacity>
                  )}
                  <Pressable
                    onPress={() => setExpandedCard(null)}
                    onHoverIn={() => setExpandHover(true)}
                    onHoverOut={() => setExpandHover(false)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="resize-outline" size={expandHover ? 22 : 16} color={expandHover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'} />
                  </Pressable>
                </View>
              </View>

              {playerAnalyses.length === 0 ? (
                <View style={{ borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                  <Ionicons name="document-text-outline" size={40} color="rgba(255,255,255,0.2)" />
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                    {isAdvisor ? 'Noch keine Analysen. Klicke oben auf "Neue Analyse".' : 'Noch keine Analysen vorhanden.'}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {playerAnalyses.map((a) => {
                    const videoUrl = getAnalysisVideoUrl(a.video_path);
                    return (
                      <View key={a.id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{formatAnalysisDate(a.analysis_date)}</Text>
                          {isAdvisor && (
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity onPress={() => openEditAnalysisModal(a)} style={{ padding: 4 }}>
                                <Ionicons name="pencil-outline" size={15} color="rgba(255,255,255,0.5)" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => deleteAnalysis(a)} style={{ padding: 4 }}>
                                <Ionicons name="trash-outline" size={15} color="rgba(239,68,68,0.7)" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 24 }}>
                          <View style={{ flex: 1 }}>
                            {a.topics && a.topics.length > 0 && (
                              <View style={{ marginBottom: 14 }}>
                                <Text style={[styles.subLabel, { marginBottom: 8 }]}>Themen</Text>
                                <View style={{ gap: 6 }}>
                                  {a.topics.map((t, i) => (
                                    <View key={`t-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                                      <Ionicons name="chevron-forward-outline" size={10} color="rgba(255,255,255,0.5)" style={{ marginTop: 4 }} />
                                      <Text style={[styles.infoValue, { flex: 1 }]}>{t}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}

                            {a.todos && a.todos.length > 0 && (
                              <View>
                                <Text style={[styles.subLabel, { marginBottom: 8 }]}>To-Dos</Text>
                                <View style={{ gap: 6 }}>
                                  {a.todos.map((t, i) => (
                                    <View key={`d-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                                      <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(34,197,94,0.5)', backgroundColor: 'rgba(34,197,94,0.15)', marginTop: 3 }} />
                                      <Text style={[styles.infoValue, { flex: 1 }]}>{t}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}
                          </View>

                          {videoUrl && (
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.subLabel, { marginBottom: 8 }]}>Highlight</Text>
                              {Platform.OS === 'web' ? (
                                // @ts-ignore — Web-only
                                <video src={videoUrl} controls style={{ width: '100%', maxHeight: 280, borderRadius: 8, backgroundColor: '#000' }} />
                              ) : (
                                <View style={{ borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, alignItems: 'center' }}>
                                  <Ionicons name="play-circle-outline" size={40} color="rgba(255,255,255,0.4)" />
                                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>Video nur im Web verfügbar</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

        </>
      )}

      {/* Analyse-Modal (Neu / Bearbeiten) */}
      <Modal visible={showAnalysisModal} animationType="fade" transparent onRequestClose={closeAnalysisModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 640, maxHeight: '90%', backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>{editingAnalysis ? 'Analyse bearbeiten' : 'Neue Analyse'}</Text>
              <TouchableOpacity onPress={closeAnalysisModal}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              {/* Datum */}
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.subLabel, { marginBottom: 8 }]}>Datum</Text>
                {Platform.OS === 'web' ? (
                  // @ts-ignore — Web native input
                  <input
                    type="date"
                    value={analysisDate}
                    onChange={(e: any) => setAnalysisDate(e.target.value)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
                  />
                ) : (
                  <TextInput
                    value={analysisDate}
                    onChangeText={setAnalysisDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 13 }}
                  />
                )}
              </View>

              {/* Themen */}
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.subLabel, { marginBottom: 8 }]}>Themen</Text>
                <View style={{ gap: 8 }}>
                  {analysisTopics.map((t, i) => (
                    <View key={`topic-${i}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TextInput
                        value={t}
                        onChangeText={(val) => {
                          const arr = [...analysisTopics];
                          arr[i] = val;
                          setAnalysisTopics(arr);
                        }}
                        placeholder="z.B. Positionsspiel im Zentrum"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 13 }}
                      />
                      {analysisTopics.length > 1 && (
                        <TouchableOpacity onPress={() => setAnalysisTopics(analysisTopics.filter((_, idx) => idx !== i))} style={{ padding: 6 }}>
                          <Ionicons name="close-circle-outline" size={18} color="rgba(255,255,255,0.4)" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setAnalysisTopics([...analysisTopics, ''])} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="add" size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Thema hinzufügen</Text>
                </TouchableOpacity>
              </View>

              {/* To-Dos */}
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.subLabel, { marginBottom: 8 }]}>To-Dos für den Spieler</Text>
                <View style={{ gap: 8 }}>
                  {analysisTodos.map((t, i) => (
                    <View key={`todo-${i}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TextInput
                        value={t}
                        onChangeText={(val) => {
                          const arr = [...analysisTodos];
                          arr[i] = val;
                          setAnalysisTodos(arr);
                        }}
                        placeholder="z.B. 3× pro Woche Wandpass links/rechts"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 13 }}
                      />
                      {analysisTodos.length > 1 && (
                        <TouchableOpacity onPress={() => setAnalysisTodos(analysisTodos.filter((_, idx) => idx !== i))} style={{ padding: 6 }}>
                          <Ionicons name="close-circle-outline" size={18} color="rgba(255,255,255,0.4)" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setAnalysisTodos([...analysisTodos, ''])} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="add" size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>To-Do hinzufügen</Text>
                </TouchableOpacity>
              </View>

              {/* Video */}
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.subLabel, { marginBottom: 8 }]}>Highlight-Video (optional)</Text>
                {analysisVideoFile ? (
                  <View style={{ padding: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="videocam-outline" size={16} color="rgba(255,255,255,0.7)" />
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }} numberOfLines={1}>{analysisVideoFile.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setAnalysisVideoFile(null)}>
                      <Ionicons name="close-circle-outline" size={18} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  </View>
                ) : analysisVideoPath && !analysisVideoRemove ? (
                  <View style={{ padding: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="videocam" size={16} color="rgba(34,197,94,0.8)" />
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Video hochgeladen</Text>
                    </View>
                    <TouchableOpacity onPress={() => setAnalysisVideoRemove(true)}>
                      <Text style={{ fontSize: 12, color: 'rgba(239,68,68,0.9)' }}>Entfernen</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={pickAnalysisVideo} style={{ padding: 12, borderRadius: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Ionicons name="cloud-upload-outline" size={18} color="rgba(255,255,255,0.5)" />
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Video auswählen (MP4/MOV/WebM)</Text>
                  </TouchableOpacity>
                )}
                {analysisUploading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Video wird hochgeladen…</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
              <TouchableOpacity onPress={closeAnalysisModal} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveAnalysis}
                disabled={analysisSaving || analysisUploading || !analysisDate}
                style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 6, backgroundColor: (analysisSaving || analysisUploading || !analysisDate) ? 'rgba(34,197,94,0.3)' : '#22c55e' }}
              >
                {analysisSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{editingAnalysis ? 'Speichern' : 'Erstellen'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PerformanceImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        rows={importRows}
        unmapped={importUnmapped}
        sourceLabel={importSourceLabel}
        existing={measurements.map(m => ({ type: m.type, measured_at: (m.measured_at || '').substring(0, 10) }))}
        importing={importSaving}
        onConfirm={confirmImport}
      />
    </ScrollView>
  );

  if (isMobile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen={isTrainerView ? 'trainerPlayers' : 'performance'}
          profile={profile as any}
          playerMode={!isTrainerView}
          trainerMode={isTrainerView}
        />
        <MobileHeader title="Performance" onMenuPress={() => setShowMobileSidebar(true)} />
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
      <Sidebar navigation={navigation} activeScreen={isTrainerView ? 'trainerPlayers' : 'performance'} profile={profile as any} playerMode={!isTrainerView} trainerMode={isTrainerView} />
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
  scroll: { flex: 1 },
  scrollContent: { padding: 24, gap: 16 },
  screenTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },

  // Header
  headerCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  playerNameHuge: { fontFamily: 'Josefin Sans', fontWeight: '400', letterSpacing: 2, textTransform: 'uppercase', color: '#fff' },
  headerScreenLabel: { fontFamily: 'Josefin Sans', fontSize: 26, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubLogoLarge: { width: 44, height: 44, resizeMode: 'contain' },
  clubName: { fontFamily: 'Josefin Sans', fontSize: 30, lineHeight: 38, fontWeight: '300', letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  tmButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.92)' },
  tmIcon: { width: 14, height: 14 },
  tmButtonText: { fontSize: 12, fontWeight: '600', color: '#111' },
  headerDivider: { height: 1, marginTop: 20, marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.3)' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 16, justifyContent: 'center', paddingHorizontal: 40 },
  statCol: { minWidth: 110, gap: 4, flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  statValue: { fontSize: 13, fontWeight: '500', color: '#fff', textAlign: 'center' },
  tooltip: { position: 'absolute', bottom: '100%', marginBottom: 4, backgroundColor: 'rgba(0,0,0,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, zIndex: 10 },
  tooltipText: { fontSize: 11, color: '#fff' },

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

  // Games
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  gameDate: { fontSize: 11, width: 64 },
  gameOpponent: { flex: 1, fontSize: 13, fontWeight: '500' },
  gamePositionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  gamePositionText: { fontSize: 11, fontWeight: '600' },
  noteBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  noteText: { fontSize: 13, fontWeight: '700' },

  footerNote: { fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 8 },

  // Data Grid (identisch zu PersonalData)
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dataGridCard: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 280,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
  },
  sectionLabel: {
    fontFamily: 'Josefin Sans',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  infoRow: { marginBottom: 14 },
  infoLabel: { fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  infoValue: { fontSize: 13, fontWeight: '500', color: '#fff' },
  infoEntryLabel: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, fontVariant: ['lining-nums'] },
  listItem: { fontSize: 13, fontWeight: '500', lineHeight: 18, color: '#fff' },
  expandBtn: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  metricRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  metricRowActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderLeftColor: '#22c55e',
  },
  chartInput: {
    width: 45,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 11,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  expandedCard: {
    backgroundColor: '#000',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
});
