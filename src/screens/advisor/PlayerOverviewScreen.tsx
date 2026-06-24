import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Pressable, RefreshControl, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { AdvisorBackground } from '../../components/AdvisorBackground';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { SlideUpModal } from '../../components/SlideUpModal';
import { useDialog } from '../../components/DialogProvider';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ColumnDef } from '../../types/tableColumns';
import { useTableColumns } from '../../hooks/useTableColumns';
import * as ImagePicker from 'expo-image-picker';
import { TableHeader } from '../../components/table/TableHeader';
import { TableRow } from '../../components/table/TableRow';
import { protoPositions as protoPositionsUtil, displayPrototypeName } from '../../utils/prototypes';

const POSITIONS = ['Torwart', 'Innenverteidiger', 'Linker Verteidiger', 'Rechter Verteidiger', 'Defensives Mittelfeld', 'Zentrales Mittelfeld', 'Offensives Mittelfeld', 'Linke Außenbahn', 'Rechte Außenbahn', 'Stürmer'];
const POSITION_SHORT: Record<string, string> = {
  'Torwart': 'TW',
  'Innenverteidiger': 'IV',
  'Linker Verteidiger': 'LV',
  'Rechter Verteidiger': 'RV',
  'Defensives Mittelfeld': 'DM',
  'Zentrales Mittelfeld': 'ZM',
  'Offensives Mittelfeld': 'OM',
  'Linke Außenbahn': 'LA',
  'Rechte Außenbahn': 'RA',
  'Stürmer': 'ST',
};
const LISTINGS = ['Karl Herzog Sportmanagement', 'PM Sportmanagement'];

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
  [/lubeck/gi, 'Lübeck'],
  [/munster/gi, 'Münster'],
  [/zurich/gi, 'Zürich'],
];

function normalizeGermanClubName(club: string | null | undefined): string {
  if (!club) return '';
  let out = club;
  for (const [regex, replacement] of CLUB_UMLAUT_MAP) out = out.replace(regex, replacement);
  return out;
}

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

const nationalityToFlags = (nationality: string | null | undefined): string => {
  if (!nationality) return '';
  return nationality.split(/[,\/]+/).map(n => n.trim()).filter(Boolean).map(n => COUNTRY_FLAGS[n] || countryToFlag(n)).join(' ');
};

// Position-Feld (read-only) — identisch zu PerformanceScreen
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

const POSITION_LONG_TO_SHORT: Record<string, string> = Object.entries(POSITION_SHORT).reduce(
  (acc, [long, short]) => ({ ...acc, [long]: short }),
  {} as Record<string, string>
);

function positionToShort(pos: string | null | undefined): string {
  if (!pos) return '';
  const trimmed = pos.trim();
  if (ALL_FIELD_POSITIONS.includes(trimmed.toUpperCase())) return trimmed.toUpperCase();
  return POSITION_LONG_TO_SHORT[trimmed] || '';
}

function splitPositions(positions: string | null | undefined): string[] {
  if (!positions) return [];
  return positions.split(/[,;/]+/).map(p => positionToShort(p.trim())).filter(Boolean);
}

function MiniPositionField({ primary, secondaries, maxWidth = 180, circleSize = 28 }: {
  primary: string;
  secondaries: string[];
  maxWidth?: number;
  circleSize?: number;
}) {
  const half = circleSize / 2;
  const fontSize = Math.max(7, Math.round(circleSize * 0.32));
  const playable = new Set([primary, ...secondaries].filter(Boolean));
  return (
    <View style={[miniFieldStyles.wrapper, { maxWidth }]}>
      <View style={miniFieldStyles.field}>
        <View style={miniFieldStyles.halfLine} />
        <View style={miniFieldStyles.centerCircle} />
        <View style={[miniFieldStyles.penaltyBox, miniFieldStyles.penaltyBoxTop]} />
        <View style={[miniFieldStyles.goalBox, miniFieldStyles.goalBoxTop]} />
        <View style={[miniFieldStyles.penaltyBox, miniFieldStyles.penaltyBoxBottom]} />
        <View style={[miniFieldStyles.goalBox, miniFieldStyles.goalBoxBottom]} />
        {ALL_FIELD_POSITIONS.map((pos) => {
          const coords = POSITION_COORDS[pos as keyof typeof POSITION_COORDS];
          const isPlayable = playable.has(pos);
          const isPrimary = pos === primary;
          const bg = !isPlayable ? 'rgba(255,255,255,0.08)' : isPrimary ? '#22c55e' : '#3b82f6';
          const textColor = !isPlayable ? 'rgba(255,255,255,0.3)' : '#fff';
          return (
            <View
              key={pos}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: coords.left,
                top: coords.top,
                transform: [{ translateX: -half }, { translateY: -half }],
                width: circleSize,
                height: circleSize,
                borderRadius: half,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: bg,
              }}
            >
              <Text style={{ fontSize, fontWeight: '700', color: textColor }}>{pos}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const miniFieldStyles = StyleSheet.create({
  wrapper: { width: '100%', alignSelf: 'flex-start' },
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
  halfLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  centerCircle: { position: 'absolute', left: '50%', top: '50%', width: 50, height: 50, marginLeft: -25, marginTop: -25, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  penaltyBox: { position: 'absolute', left: '15%', width: '70%', height: '16%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  penaltyBoxTop: { top: 0, borderTopWidth: 0 },
  penaltyBoxBottom: { bottom: 0, borderBottomWidth: 0 },
  goalBox: { position: 'absolute', left: '30%', width: '40%', height: '6%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  goalBoxTop: { top: 0, borderTopWidth: 0 },
  goalBoxBottom: { bottom: 0, borderBottomWidth: 0 },
});

const ArbeitsamtIcon = require('../../../assets/arbeitsamt.png');

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  position: string;
  club: string;
  league: string;
  contract_end: string;
  listing: string;
  responsibility: string;
  future_club: string;
}

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
  role?: string;
}

interface ClubLogo {
  club_name: string;
  logo_url: string;
}

type SortField = 'name' | 'birth_date' | 'position' | 'club' | 'league' | 'contract_end' | 'listing' | 'responsibility';
type SortDirection = 'asc' | 'desc';

const PLAYER_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', defaultFlex: 1.2, minWidth: 100 },
  { key: 'vorname', label: 'Vorname', defaultFlex: 1, minWidth: 70 },
  { key: 'birth_date', label: 'Geb.-Datum', defaultFlex: 1, minWidth: 85 },
  { key: 'position', label: 'Position', defaultFlex: 0.9, minWidth: 70 },
  { key: 'club', label: 'Verein', defaultFlex: 2.2, minWidth: 150 },
  { key: 'league', label: 'Liga', defaultFlex: 1.8, minWidth: 120 },
  { key: 'contract_end', label: 'Vertragsende', defaultFlex: 1.2, minWidth: 100 },
  { key: 'listing', label: 'Listung', defaultFlex: 0.7, minWidth: 50 },
  { key: 'responsibility', label: 'Zuständigkeit', defaultFlex: 1, minWidth: 85 },
];

// Liste aller persönlich-bezogenen Felder, die als advisor+player-Spalten existieren.
// Wird genutzt um zu entscheiden ob ein Feld den split-mode mit Spieler-Pille bekommt.
const SPLIT_FIELDS = new Set<string>([
  'phone', 'phone_country_code', 'email', 'street', 'postal_code', 'city',
  'father_name', 'father_phone', 'father_phone_country_code', 'father_job',
  'mother_name', 'mother_phone', 'mother_phone_country_code', 'mother_job', 'siblings',
  'education', 'training', 'job',
  'instagram', 'tiktok', 'linkedin',
  'injuries', 'internat',
  'birth_date', 'nationality',
]);

// Außerhalb des Component-Scopes definiert, damit die Component-Type-Identität
// zwischen Re-Renders stabil bleibt — sonst unmounted React den TextInput bei jedem
// Tastendruck (weil sich die Funktionsreferenz beim Re-Render ändert) und der Fokus
// geht verloren.
type EditableValueProps = {
  field: string;
  displayValue?: string | null;
  playerValue?: string | null;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  isEditing: boolean;
  editData: any;
  setEditData: (v: any) => void;
  fullPlayer?: any;  // optionaler Zugriff auf alle Werte für split-field Pille
};
const EditableValue = React.memo(({ field, displayValue, playerValue, placeholder, multiline, numeric, isEditing, editData, setEditData, fullPlayer }: EditableValueProps) => {
  const isSplit = SPLIT_FIELDS.has(field);
  const editKey = isSplit ? `${field}_advisor` : field;
  // Auto-Resolve playerValue aus fullPlayer wenn nicht explizit übergeben
  const resolvedPlayerValue = playerValue !== undefined ? playerValue : (isSplit && fullPlayer ? fullPlayer[`${field}_player`] : null);
  const hasPlayerValue = resolvedPlayerValue !== null && resolvedPlayerValue !== undefined && String(resolvedPlayerValue).trim() !== '';

  if (isEditing) {
    return (
      <TextInput
        style={[styles.detailEditInput, multiline ? { minHeight: 60, textAlignVertical: 'top' } : { paddingVertical: 4 }]}
        value={(editData[editKey] ?? '').toString()}
        onChangeText={(v) => setEditData({ ...editData, [editKey]: numeric ? v.replace(/\D/g, '') : v })}
        placeholder={placeholder || ''}
        placeholderTextColor="rgba(255,255,255,0.3)"
        multiline={multiline}
        keyboardType={numeric ? 'numeric' : 'default'}
      />
    );
  }
  const showVal = hasPlayerValue ? resolvedPlayerValue : displayValue;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Text style={styles.detailFieldValue}>{(showVal ?? '') !== '' ? String(showVal) : '-'}</Text>
      {hasPlayerValue ? (
        <View style={{ backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 }}>
          <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>VOM SPIELER</Text>
        </View>
      ) : null}
    </View>
  );
});

export function PlayerOverviewScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { session, loading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const dataLoadedRef = useRef(false);
  const scrollRef = useRef<any>(null);
  const scrollRestoredRef = useRef(false);
  const saveScrollY = (y: number) => {
    try { if (typeof window !== 'undefined') window.sessionStorage?.setItem('playerListScrollY', String(y)); } catch {}
  };

  // Scroll-Position nach Focus-Refresh wiederherstellen
  const pendingScrollRestore = useRef(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [tmSuggestions, setTmSuggestions] = useState<any[]>([]);
  const [tmSearching, setTmSearching] = useState(false);
  const [tmLoading, setTmLoading] = useState(false);
  const [tmSelected, setTmSelected] = useState<any>(null);
  const tmDebounceRef = useRef<any>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('berater');
  const [myPlayerIds, setMyPlayerIds] = useState<string[]>([]);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [profile, setProfile] = useState<Advisor | null>(null);
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showPlayerDetailModal, setShowPlayerDetailModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [fullPlayer, setFullPlayer] = useState<any | null>(null);
  const [fullPlayerLoading, setFullPlayerLoading] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [inviteCodeLoading, setInviteCodeLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showNatTooltip, setShowNatTooltip] = useState(false);
  const [showCardNatTooltip, setShowCardNatTooltip] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [allPrototypes, setAllPrototypes] = useState<Array<{ id: string; name: string; position_code: string; position_codes: string[] }>>([]);
  const [playerPrototypeId, setPlayerPrototypeId] = useState<string | null>(null);
  const [internatJa, setInternatJa] = useState(false);
  const [uploadingAdvisorPhoto, setUploadingAdvisorPhoto] = useState(false);
  // Photo-Editor State: WYSIWYG-Crop/Pan/Zoom
  const [showAdvisorPhotoEditor, setShowAdvisorPhotoEditor] = useState(false);
  const [advisorPhotoPreviewUri, setAdvisorPhotoPreviewUri] = useState<string | null>(null);
  const [advisorPhotoScale, setAdvisorPhotoScale] = useState(1.0);
  const [advisorPhotoOffsetX, setAdvisorPhotoOffsetX] = useState(0);
  const [advisorPhotoOffsetY, setAdvisorPhotoOffsetY] = useState(0);
  // TM-Vereinssuche für Verein + Zukünftiger Verein im Edit-Modus
  const [tmClubSearchField, setTmClubSearchField] = useState<'club' | 'future_club' | 'loan_from_club' | null>(null);
  const [tmClubResults, setTmClubResults] = useState<Array<{ name: string; logoUrl?: string; liga?: string; country?: string }>>([]);
  const [tmClubSearching, setTmClubSearching] = useState(false);
  const tmClubSearchTimeout = useRef<any>(null);

  const [searchText, setSearchText] = useState('');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [selectedContractYears, setSelectedContractYears] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [createdPlayerCode, setCreatedPlayerCode] = useState<string | null>(null);
  const [createdPlayerName, setCreatedPlayerName] = useState<string>('');
  const [showCodeModal, setShowCodeModal] = useState(false);

  // Table columns
  const [tableWidth, setTableWidth] = useState(0);
  const table = useTableColumns(PLAYER_COLUMNS, tableWidth, 'players');

  // Separate Dropdown States wie in Scouting
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [showListingDropdown, setShowListingDropdown] = useState(false);
  const [showResponsibilityDropdown, setShowResponsibilityDropdown] = useState(false);
  const [showContractDropdown, setShowContractDropdown] = useState(false);

  // Dynamische Jahrgänge aus den vorhandenen Spielerdaten
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    players.forEach(p => {
      if (p.birth_date) {
        const year = new Date(p.birth_date).getFullYear().toString();
        if (!isNaN(parseInt(year))) years.add(year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [players]);
  
  // Dynamische Vertragsende-Optionen aus den vorhandenen Spielerdaten
  const contractYearOptions = React.useMemo(() => {
    const years = new Set<string>();
    players.forEach(p => {
      if (p.contract_end) {
        const year = new Date(p.contract_end).getFullYear().toString();
        if (!isNaN(parseInt(year))) years.add(year);
      }
    });
    return Array.from(years).sort();
  }, [players]);
  
  // Helper Funktionen für Filter Labels
  const getYearFromDate = (dateStr: string) => dateStr ? new Date(dateStr).getFullYear().toString() : '';
  
  const getPositionFilterLabel = () => {
    if (selectedPositions.length === 0) return 'Position';
    if (selectedPositions.length === 1) return POSITION_SHORT[selectedPositions[0]] || selectedPositions[0];
    return `${selectedPositions.length} Positionen`;
  };
  
  const getYearFilterLabel = () => {
    if (selectedYears.length === 0) return 'Jahrgang';
    if (selectedYears.length === 1) return `Jg. ${selectedYears[0]}`;
    return `${selectedYears.length} Jahrgänge`;
  };
  
  const getListingFilterLabel = () => {
    if (selectedListings.length === 0) return 'Listung';
    if (selectedListings.length === 1) return selectedListings[0] === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM';
    return `${selectedListings.length} Listungen`;
  };
  
  const getResponsibilityFilterLabel = () => {
    if (selectedResponsibilities.length === 0) return 'Zuständigkeit';
    if (selectedResponsibilities.length === 1) return selectedResponsibilities[0].split(' ')[0];
    return `${selectedResponsibilities.length} Zuständige`;
  };
  
  const getContractFilterLabel = () => {
    if (selectedContractYears.length === 0) return 'Vertragsende';
    if (selectedContractYears.length === 1) return selectedContractYears[0];
    return `${selectedContractYears.length} Jahre`;
  };
  
  // Toggle Funktionen
  const togglePosition = (pos: string) => {
    setSelectedPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };
  const toggleYear = (year: string) => {
    setSelectedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };
  const toggleListing = (listing: string) => {
    setSelectedListings(prev => prev.includes(listing) ? prev.filter(l => l !== listing) : [...prev, listing]);
  };
  const toggleResponsibility = (resp: string) => {
    setSelectedResponsibilities(prev => prev.includes(resp) ? prev.filter(r => r !== resp) : [...prev, resp]);
  };
  const toggleContractYear = (year: string) => {
    setSelectedContractYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };
  
  // Clear Funktionen
  const clearPositions = () => setSelectedPositions([]);
  const clearYears = () => setSelectedYears([]);
  const clearListings = () => setSelectedListings([]);
  const clearResponsibilities = () => setSelectedResponsibilities([]);
  const clearContractYears = () => setSelectedContractYears([]);
  
  // Prüfen ob ein Dropdown offen ist
  const isAnyDropdownOpen = showYearDropdown || showPositionDropdown || showListingDropdown || showResponsibilityDropdown || showContractDropdown;
  
  // Alle Dropdowns schließen
  const closeAllDropdowns = () => {
    setShowYearDropdown(false);
    setShowPositionDropdown(false);
    setShowListingDropdown(false);
    setShowResponsibilityDropdown(false);
    setShowContractDropdown(false);
  };

  // Daten nur laden wenn Auth bereit ist
  useEffect(() => {
    if (authLoading) return; // Warte auf Auth
    if (!session) return; // Keine Session = nicht eingeloggt

    // Initiales Laden
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true;
      fetchCurrentUser();
      fetchPlayers();
      fetchClubLogos();
      fetchAdvisors();
    }
  }, [authLoading, session]);

  // Refresh data when screen comes into focus (nur wenn Auth bereit)
  useFocusEffect(
    useCallback(() => {
      if (!authLoading && session && dataLoadedRef.current) {
        // Scroll-Position merken vor dem Refresh
        pendingScrollRestore.current = true;
        fetchPlayers();
      }
    }, [authLoading, session])
  );

  useEffect(() => {
    applyFilters();
    // Scroll-Position wiederherstellen nach Daten-Refresh
    if (pendingScrollRestore.current && players.length > 0) {
      pendingScrollRestore.current = false;
      const y = (() => { try { return parseFloat(window.sessionStorage?.getItem('playerListScrollY') || '0'); } catch { return 0; } })();
      if (y > 0 && scrollRef.current?.scrollTo) {
        setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 150);
      }
    }
  }, [searchText, players, selectedYears, selectedPositions, selectedListings, selectedResponsibilities, selectedContractYears, sortField, sortDirection]);

  const fetchAdvisors = async () => {
    try {
      const { data } = await supabase.from('advisors').select('id, first_name, last_name').order('last_name');
      if (data) setAdvisors(data);
    } catch (err) {
      console.error('Fehler beim Laden der Berater:', err);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: advisor } = await supabase.from('advisors').select('role, first_name, last_name').eq('id', user.id).single();
        if (advisor) {
          setUserRole(advisor.role || 'berater');
          setCurrentUserName(`${advisor.first_name || ''} ${advisor.last_name || ''}`.trim());
          setProfile({ id: user.id, ...advisor });
        }
        fetchMyPlayerAccess(user.id);
      }
    } catch (err) {
      console.error('Fehler beim Laden des Benutzers:', err);
    }
  };

  const fetchMyPlayerAccess = async (userId?: string) => {
    const uid = userId || currentUserId;
    if (!uid) {
      setAccessLoaded(true);
      return;
    }

    try {
      // 1. Hole IDs aus advisor_access
      const { data: accessData } = await supabase
        .from('advisor_access')
        .select('player_id')
        .eq('advisor_id', uid);

      // 2. Hole IDs aus access_requests (approved)
      const { data: requestData } = await supabase
        .from('access_requests')
        .select('player_id')
        .eq('requester_id', uid)
        .eq('status', 'approved');

      // 3. Kombiniere beide Listen (ohne Duplikate)
      const accessIds = accessData?.map(d => d.player_id) || [];
      const requestIds = requestData?.map(d => d.player_id) || [];
      const allIds = [...new Set([...accessIds, ...requestIds])];

      setMyPlayerIds(allIds);
    } catch (err) {
      console.error('Fehler beim Laden der Spieler-Zugriffsrechte:', err);
    } finally {
      setAccessLoaded(true);
    }
  };

  const fetchClubLogos = async () => {
    try {
      const { data, error } = await supabase.from('club_logos').select('club_name, logo_url');
      if (!error && data) {
        const logoMap: Record<string, string> = {};
        data.forEach((item: ClubLogo) => {
          logoMap[item.club_name] = item.logo_url;
          const simplified = item.club_name.replace(' II', '').replace(' U23', '').replace(' U21', '').replace(' U19', '');
          if (simplified !== item.club_name) logoMap[simplified] = item.logo_url;
        });
        setClubLogos(logoMap);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Club-Logos:', err);
    }
  };

  const getClubLogo = (clubName: string): string | null => {
    if (!clubName) return null;
    if (clubLogos[clubName]) return clubLogos[clubName];
    const variations = [clubName, clubName.replace('FC ', '').replace(' FC', ''), clubName.replace('1. ', ''), clubName.replace('SV ', '').replace(' SV', ''), clubName.replace('VfB ', '').replace(' VfB', ''), clubName.replace('VfL ', '').replace(' VfL', ''), clubName.replace('TSG ', '').replace(' TSG', ''), clubName.replace('SC ', '').replace(' SC', '')];
    for (const v of variations) { if (clubLogos[v]) return clubLogos[v]; }
    for (const [logoClub, logoUrl] of Object.entries(clubLogos)) {
      if (clubName.toLowerCase().includes(logoClub.toLowerCase()) || logoClub.toLowerCase().includes(clubName.toLowerCase())) return logoUrl;
    }
    return null;
  };

  const isContractExpired = (contractEnd: string): boolean => {
    if (!contractEnd) return false;
    return new Date() > new Date(contractEnd);
  };

  const calculateAge = (birthDate: string | null | undefined): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const calculateU23Status = (birthDate: string | null | undefined): { isU23: boolean; seasonsText: string } => {
    if (!birthDate) return { isU23: false, seasonsText: '' };
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return { isU23: false, seasonsText: '' };
    const birthYear = birth.getFullYear();
    const birthMonth = birth.getMonth();
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const currentSeasonStartYear = todayMonth >= 6 ? todayYear : todayYear - 1;
    const getAgeOnJune30 = (year: number): number => {
      let age = year - birthYear;
      if (birthMonth > 5) age--;
      return age;
    };
    if (getAgeOnJune30(currentSeasonStartYear) > 22) return { isU23: false, seasonsText: '' };
    let seasonsLeft = 0;
    for (let i = 0; i < 15; i++) {
      if (getAgeOnJune30(currentSeasonStartYear + i) <= 22) seasonsLeft++; else break;
    }
    const seasonsText = seasonsLeft === 1 ? 'nur noch diese Saison' : seasonsLeft === 2 ? 'noch eine weitere Saison' : `noch ${seasonsLeft - 1} weitere Saisons`;
    return { isU23: true, seasonsText };
  };

  const formatListing = (listing: string | null | undefined): string => {
    if (!listing) return '-';
    if (listing === 'Karl Herzog Sportmanagement') return 'KMH';
    if (listing === 'PM Sportmanagement') return 'PM';
    return listing;
  };

  const getDisplayClub = (player: Player): string => {
    if (isContractExpired(player.contract_end)) return 'Vereinslos';
    return player.club || '-';
  };

  const isBirthday = (birthDate: string): boolean => {
    if (!birthDate) return false;
    const today = new Date();
    const birth = new Date(birthDate);
    return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate();
  };

  const isContractInCurrentSeason = (contractEnd: string): boolean => {
    if (!contractEnd) return false;
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    let seasonStartYear = todayMonth >= 6 ? todayYear : todayYear - 1;
    let seasonEndYear = seasonStartYear + 1;
    const contractDate = new Date(contractEnd);
    const contractYear = contractDate.getFullYear();
    const contractMonth = contractDate.getMonth();
    const contractDay = contractDate.getDate();
    const afterStart = (contractYear > seasonStartYear) || (contractYear === seasonStartYear && contractMonth >= 6);
    const beforeEnd = (contractYear < seasonEndYear) || (contractYear === seasonEndYear && contractMonth < 5) || (contractYear === seasonEndYear && contractMonth === 5 && contractDay <= 30);
    return afterStart && beforeEnd;
  };

  const hasFutureClubAndExpiringContract = (player: Player): boolean => {
    if (!player.future_club || !player.contract_end) return false;
    return isContractInCurrentSeason(player.contract_end);
  };

  // Konvertiert "Magnus Klemm, Matti Langer" zu "MK, ML"
  const getResponsibilityInitials = (responsibility: string): string => {
    if (!responsibility) return '-';
    return responsibility.split(', ').map(name => {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }).join(', ');
  };

  const hasAccessToPlayer = (_playerId: string): boolean => {
    // Alle Berater haben Zugriff auf alle Spieler — keine Schlösser mehr.
    return true;
  };

  const handlePlayerClick = (player: Player) => {
    if (hasAccessToPlayer(player.id)) {
      setSelectedPlayer(player);
      setShowPlayerDetailModal(true);
    } else {
      setSelectedPlayer(player);
      setShowRequestModal(true);
    }
  };

  // Click-Outside: schließt das aktuell offene Dropdown wenn der User außerhalb klickt
  useEffect(() => {
    if (!openDropdown || typeof document === 'undefined') return;
    const handler = (e: any) => {
      const target = e.target;
      if (target && target.closest && target.closest('[data-kmh-dropdown]')) return;
      setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  // Click-Outside für Filter-Dropdowns (Position, Jahrgang, Listung, Zuständigkeit, Vertragsende)
  useEffect(() => {
    if (!isAnyDropdownOpen || typeof document === 'undefined') return;
    const handler = (e: any) => {
      const target = e.target;
      if (target && target.closest && target.closest('[data-filter-dropdown]')) return;
      closeAllDropdowns();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isAnyDropdownOpen]);

  // TM-Vereinssuche Click-Outside
  useEffect(() => {
    if (!tmClubSearchField || typeof document === 'undefined') return;
    const handler = (e: any) => {
      const target = e.target;
      if (target && target.closest && target.closest('[data-tm-club-dropdown]')) return;
      setTmClubSearchField(null);
      setTmClubResults([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tmClubSearchField]);

  // Debounced TM-Vereinssuche via search-club Edge Function
  const triggerTmClubSearch = (query: string) => {
    if (tmClubSearchTimeout.current) clearTimeout(tmClubSearchTimeout.current);
    if (!query || query.trim().length < 2) {
      setTmClubResults([]);
      setTmClubSearching(false);
      return;
    }
    tmClubSearchTimeout.current = setTimeout(async () => {
      setTmClubSearching(true);
      try {
        const { data } = await supabase.functions.invoke('search-club', { body: { query: query.trim() } });
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        setTmClubResults(parsed?.results && Array.isArray(parsed.results) ? parsed.results : []);
      } catch (e) {
        console.error('TM club search error:', e);
        setTmClubResults([]);
      } finally {
        setTmClubSearching(false);
      }
    }, 400);
  };

  // Renders a TextInput + TM-Vereinssuche-Dropdown für Felder vom Typ Verein.
  // editData[fieldKey] ist die Quelle; bei Klick auf einen TM-Treffer wird Name + Logo (in club_logos) übernommen.
  const renderClubSearchField = (fieldKey: 'club' | 'loan_from_club' | 'future_club', placeholder: string) => {
    const value = (editData[fieldKey] ?? '').toString();
    const isActive = tmClubSearchField === fieldKey;
    return (
      <View style={{ position: 'relative' }}>
        <TextInput
          style={[styles.detailEditInput, { paddingVertical: 4 }]}
          value={value}
          onChangeText={(v) => {
            setEditData({ ...editData, [fieldKey]: v });
            setTmClubSearchField(fieldKey);
            triggerTmClubSearch(v);
          }}
          onFocus={() => {
            setTmClubSearchField(fieldKey);
            if (value) triggerTmClubSearch(value);
          }}
          placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.3)"
        />
        {isActive && (tmClubSearching || tmClubResults.length > 0) ? (
          <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, zIndex: 1000, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 12, maxHeight: 260 }}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {tmClubSearching && tmClubResults.length === 0 ? (
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, paddingHorizontal: 12, paddingVertical: 8 }}>Suche…</Text>
              ) : null}
              {tmClubResults.length > 0 ? (
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, textTransform: 'uppercase' }}>Transfermarkt-Ergebnisse</Text>
              ) : null}
              {tmClubResults.map((club, idx) => (
                <TouchableOpacity
                  key={`${club.name}-${idx}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
                  onPress={() => {
                    const next: any = { ...editData, [fieldKey]: club.name };
                    // Liga aus TM mitnehmen: für `club` → `league`, für `loan_from_club` → `loan_from_club_league`
                    if (club.liga) {
                      if (fieldKey === 'club') next.league = club.liga;
                      else if (fieldKey === 'loan_from_club') next.loan_from_club_league = club.liga;
                    }
                    setEditData(next);
                    if (club.logoUrl) setClubLogos(prev => ({ ...prev, [club.name]: club.logoUrl! }));
                    setTmClubSearchField(null);
                    setTmClubResults([]);
                  }}
                >
                  {club.logoUrl ? <Image source={{ uri: club.logoUrl }} style={{ width: 18, height: 18 }} resizeMode="contain" /> : <View style={{ width: 18, height: 18 }} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{club.name}</Text>
                    {club.liga ? <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }} numberOfLines={1}>{club.liga}{club.country ? ` · ${club.country}` : ''}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  };

  useEffect(() => {
    if (!showPlayerDetailModal || !selectedPlayer?.id) {
      setFullPlayer(null);
      setPlayerPrototypeId(null);
      return;
    }
    setFullPlayerLoading(true);
    supabase
      .from('player_details')
      .select('*')
      .eq('id', selectedPlayer.id)
      .single()
      .then(({ data }) => {
        setFullPlayer(data);
        setFullPlayerLoading(false);
      });
    supabase
      .from('player_prototype_assignments')
      .select('prototype_id')
      .eq('player_id', selectedPlayer.id)
      .maybeSingle()
      .then(({ data }) => {
        setPlayerPrototypeId(data?.prototype_id ?? null);
      });
    supabase
      .from('player_prototypes')
      .select('id, name, position_code, position_codes')
      .order('position_code')
      .order('name')
      .then(({ data }) => {
        setAllPrototypes((data as any[]) || []);
      });
  }, [showPlayerDetailModal, selectedPlayer?.id]);

  const handleRequestAccess = async () => {
    if (!selectedPlayer || !currentUserId) return;
    
    // Prüfe ob bereits eine Anfrage existiert
    const { data: existing } = await supabase
      .from('access_requests')
      .select('*')
      .eq('player_id', selectedPlayer.id)
      .eq('requester_id', currentUserId)
      .single();
    
    if (existing) {
      if (existing.status === 'rejected') {
        // Erneut beantragen
        await supabase
          .from('access_requests')
          .update({ status: 'pending', created_at: new Date().toISOString() })
          .eq('id', existing.id);
        alert('Zugriff wurde erneut beantragt.');
      } else if (existing.status === 'pending') {
        alert('Sie haben bereits eine Anfrage für diesen Spieler gestellt.');
      } else {
        alert('Sie haben bereits Zugriff auf diesen Spieler.');
      }
    } else {
      const { error } = await supabase.from('access_requests').insert({
        player_id: selectedPlayer.id,
        requester_id: currentUserId,
        status: 'pending'
      });
      
      if (error) {
        alert('Fehler: ' + error.message);
      } else {
        alert('Zuständigkeit wurde beantragt. Ein Admin wird Ihre Anfrage prüfen.');
      }
    }
    setShowRequestModal(false);
    setSelectedPlayer(null);
  };

  const applyFilters = () => {
    let filtered = [...players];
    if (searchText.trim() !== '') {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(player => {
        const displayClub = getDisplayClub(player);
        return `${player.first_name} ${player.last_name}`.toLowerCase().includes(search) ||
          displayClub.toLowerCase().includes(search) ||
          player.position?.toLowerCase().includes(search) ||
          player.league?.toLowerCase().includes(search);
      });
    }
    if (selectedYears.length > 0) {
      filtered = filtered.filter(player => {
        if (!player.birth_date) return false;
        return selectedYears.includes(new Date(player.birth_date).getFullYear().toString());
      });
    }
    if (selectedPositions.length > 0) {
      filtered = filtered.filter(player => player.position && selectedPositions.some(pos => player.position.includes(pos)));
    }
    if (selectedListings.length > 0) {
      filtered = filtered.filter(player => player.listing && selectedListings.includes(player.listing));
    }
    if (selectedResponsibilities.length > 0) {
      filtered = filtered.filter(player => {
        if (!player.responsibility) return false;
        return selectedResponsibilities.some(resp => {
          // Prüfe auf vollen Namen ODER nur Nachnamen
          const lastName = resp.split(' ').pop() || resp;
          return player.responsibility.includes(resp) || player.responsibility.includes(lastName);
        });
      });
    }
    if (selectedContractYears.length > 0) {
      filtered = filtered.filter(player => player.contract_end && selectedContractYears.includes(new Date(player.contract_end).getFullYear().toString()));
    }
    
    filtered.sort((a, b) => {
      let valueA: any, valueB: any;
      switch (sortField) {
        case 'name': valueA = `${a.last_name} ${a.first_name}`.toLowerCase(); valueB = `${b.last_name} ${b.first_name}`.toLowerCase(); break;
        case 'birth_date': valueA = a.birth_date ? new Date(a.birth_date).getTime() : 0; valueB = b.birth_date ? new Date(b.birth_date).getTime() : 0; break;
        case 'contract_end': valueA = a.contract_end ? new Date(a.contract_end).getTime() : Infinity; valueB = b.contract_end ? new Date(b.contract_end).getTime() : Infinity; break;
        case 'club': valueA = getDisplayClub(a).toLowerCase(); valueB = getDisplayClub(b).toLowerCase(); break;
        default: valueA = (a[sortField] || '').toString().toLowerCase(); valueB = (b[sortField] || '').toString().toLowerCase();
      }
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredPlayers(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const fetchPlayers = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 Sekunden

    if (retryCount === 0) {
      setLoading(true);
      setError(null);
    }

    try {
      const { data, error: queryError } = await supabase
        .from('player_details')
        .select('id, first_name, last_name, birth_date, position, club, league, contract_end, listing, responsibility, future_club')
        .order('last_name', { ascending: true });

      if (queryError) {
        console.warn(`Spieler laden fehlgeschlagen (Versuch ${retryCount + 1}/${MAX_RETRIES}):`, queryError);

        // Automatisch retry bei Auth-Fehlern oder Netzwerk-Problemen
        if (retryCount < MAX_RETRIES - 1) {
          setTimeout(() => fetchPlayers(retryCount + 1), RETRY_DELAY);
          return;
        }

        setError(`Fehler beim Laden: ${queryError.message}`);
        setLoading(false);
        return;
      }

      setPlayers(data || []);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      console.warn(`Netzwerkfehler (Versuch ${retryCount + 1}/${MAX_RETRIES}):`, err);

      // Automatisch retry
      if (retryCount < MAX_RETRIES - 1) {
        setTimeout(() => fetchPlayers(retryCount + 1), RETRY_DELAY);
        return;
      }

      setError('Verbindungsproblem - bitte erneut versuchen');
      setLoading(false);
    }
  };

  const searchTmPlayers = async (query: string) => {
    if (query.trim().length < 2) { setTmSuggestions([]); return; }
    setTmSearching(true);
    try {
      const { data } = await supabase.functions.invoke('search-transfermarkt', { body: { name: query, type: 'player' } });
      const results = data?.results || [];
      // Sortieren: exakte Namens-Matches zuerst, dann mit Verein, dann Rest
      const q = query.toLowerCase().trim();
      results.sort((a: any, b: any) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aExact = aName === q || aName.startsWith(q) ? 0 : 1;
        const bExact = bName === q || bName.startsWith(q) ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aClub = a.verein ? 0 : 1;
        const bClub = b.verein ? 0 : 1;
        if (aClub !== bClub) return aClub - bClub;
        return 0;
      });
      setTmSuggestions(results.slice(0, 30));
    } catch { setTmSuggestions([]); }
    setTmSearching(false);
  };

  const triggerTmSearch = (lastName: string, firstName: string) => {
    if (tmDebounceRef.current) clearTimeout(tmDebounceRef.current);
    const query = firstName.trim() ? `${firstName.trim()} ${lastName.trim()}` : lastName.trim();
    tmDebounceRef.current = setTimeout(() => searchTmPlayers(query), 500);
  };

  const handleLastNameChange = (text: string) => {
    setNewLastName(text);
    setTmSelected(null);
    triggerTmSearch(text, newFirstName);
  };

  const handleFirstNameChange = (text: string) => {
    setNewFirstName(text);
    setTmSelected(null);
    triggerTmSearch(newLastName, text);
  };

  const selectTmPlayer = async (suggestion: any) => {
    setTmSuggestions([]);
    setTmLoading(true);
    try {
      // Name splitten
      const parts = suggestion.name.split(' ');
      const firstName = parts.slice(0, -1).join(' ');
      const lastName = parts[parts.length - 1];
      setNewFirstName(firstName);
      setNewLastName(lastName);

      // Detaillierte Daten von TM-Profil fetchen (ohne Browserless)
      const { data } = await supabase.functions.invoke('search-transfermarkt', { body: { profileUrl: suggestion.url } });
      const p = data?.profile;
      if (p && Object.keys(p).length > 0) {
        setTmSelected({
          transfermarkt_url: suggestion.url,
          verein: p.currentClub || suggestion.verein || '',
          clubLogoUrl: p.clubLogoUrl || suggestion.logoUrl || '',
          dateOfBirth: p.dateOfBirth || '',
          position: p.position || suggestion.position || '',
          nationality: p.nationality || suggestion.nationality || '',
          height: p.height || '',
          preferredFoot: p.preferredFoot || '',
          contractUntil: p.contractUntil || '',
          league: p.league || '',
          loanFromClub: p.loanFromClub || '',
          tmPosition: suggestion.position || '',
          tmAge: suggestion.age || '',
        });
      } else {
        setTmSelected({ transfermarkt_url: suggestion.url, verein: suggestion.verein || '', clubLogoUrl: suggestion.logoUrl || '', tmPosition: suggestion.position || '', tmAge: suggestion.age || '', nationality: suggestion.nationality || '', position: suggestion.position || '' });
      }
    } catch (err) {
      console.error('TM profile fetch error:', err);
      setTmSelected({ transfermarkt_url: suggestion.url, verein: suggestion.verein || '', tmPosition: suggestion.position || '', tmAge: suggestion.age || '', nationality: suggestion.nationality || '', position: suggestion.position || '' });
    }
    setTmLoading(false);
  };

  const handleAddPlayer = async () => {
    console.log('[AddPlayer] firstName:', newFirstName, 'lastName:', newLastName, 'userId:', currentUserId, 'tmLoading:', tmLoading);
    if (!newLastName.trim()) { await alertDialog({ title: 'Eingabe fehlt', message: 'Bitte Nachname eingeben.' }); return; }
    if (!currentUserId) { await alertDialog({ title: 'Nicht eingeloggt', message: 'Bitte zuerst anmelden.' }); return; }

    // Duplikat-Prüfung
    const existing = players.filter(p =>
      p.last_name?.toLowerCase() === newLastName.trim().toLowerCase() &&
      p.first_name?.toLowerCase() === newFirstName.trim().toLowerCase()
    );
    if (existing.length > 0) {
      const confirmed = await confirmDialog({
        title: 'Spieler existiert bereits',
        message: `Ein Spieler mit dem Namen "${newFirstName.trim()} ${newLastName.trim()}" existiert bereits in der Kartei. Trotzdem anlegen?`,
        confirmLabel: 'Trotzdem anlegen',
      });
      if (!confirmed) return;
    }

    const insertData: any = {
      first_name: newFirstName.trim(),
      last_name: newLastName.trim(),
      responsibility: currentUserName,
    };

    // DD.MM.YYYY → YYYY-MM-DD konvertieren
    const toIsoDate = (d: string) => {
      const m = d?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
    };

    // TM-Position → DB-Kurzform
    const tmPosMap: Record<string, string> = {
      'Torwart': 'TW', 'Innenverteidiger': 'IV', 'Linker Verteidiger': 'LV', 'Rechter Verteidiger': 'RV',
      'Defensives Mittelfeld': 'DM', 'Zentrales Mittelfeld': 'ZM', 'Offensives Mittelfeld': 'OM',
      'Linkes Mittelfeld': 'LA', 'Rechtes Mittelfeld': 'RA', 'Linksaußen': 'LA', 'Rechtsaußen': 'RA',
      'Hängende Spitze': 'OM', 'Mittelstürmer': 'ST', 'Sturm': 'ST',
      'Abwehr': 'IV', 'Mittelfeld': 'ZM',
    };
    const mapTmPosition = (pos: string): string | null => {
      if (!pos) return null;
      // Direkt-Match
      if (tmPosMap[pos]) return tmPosMap[pos];
      // Teilstring-Match (z.B. "Mittelfeld - Defensives Mittelfeld")
      for (const [key, val] of Object.entries(tmPosMap)) {
        if (pos.includes(key)) return val;
      }
      return null;
    };

    // TM-Daten einfügen falls vorhanden. Stamm-Daten (Geburtsdatum + Nationalität) gehen
    // sowohl in die unsuffixed Spalte (Backwards-Compat für Listen-Queries) als auch in
    // `_advisor` (damit der Spieler-View sie über die Fallback-Kette findet).
    if (tmSelected) {
      if (tmSelected.transfermarkt_url) insertData.transfermarkt_url = tmSelected.transfermarkt_url;
      if (tmSelected.verein) insertData.club = tmSelected.verein;
      if (tmSelected.loanFromClub) insertData.loan_from_club = tmSelected.loanFromClub;
      const dob = tmSelected.dateOfBirth ? toIsoDate(tmSelected.dateOfBirth) : null;
      if (dob) {
        insertData.birth_date = dob;
        insertData.birth_date_advisor = dob;
      }
      const pos = mapTmPosition(tmSelected.position);
      if (pos) insertData.position = pos;
      if (tmSelected.nationality) {
        insertData.nationality = tmSelected.nationality;
        insertData.nationality_advisor = tmSelected.nationality;
      }
      if (tmSelected.height) {
        // "1,86 m" → 186 (cm als Integer)
        const hMatch = tmSelected.height.match(/(\d)[,.](\d+)/);
        if (hMatch) insertData.height = parseInt(hMatch[1] + hMatch[2]);
      }
      if (tmSelected.preferredFoot) insertData.strong_foot = tmSelected.preferredFoot;
      const contractEnd = tmSelected.contractUntil ? toIsoDate(tmSelected.contractUntil) : null;
      if (contractEnd) insertData.contract_end = contractEnd;
      if (tmSelected.league) insertData.league = tmSelected.league;
    }

    const { data: newPlayer, error } = await supabase
      .from('player_details')
      .insert([insertData])
      .select()
      .single();

    if (!error && newPlayer) {
      const { error: accessError } = await supabase.from('advisor_access').insert({
        player_id: newPlayer.id,
        advisor_id: currentUserId,
        granted_by: currentUserId,
        granted_at: new Date().toISOString()
      });
      if (accessError) {
        console.error('advisor_access insert failed:', accessError);
      }

      // Logo in club_logos speichern (wenn Verein + Logo vorhanden)
      if (tmSelected?.verein && tmSelected?.clubLogoUrl) {
        try { await supabase.from('club_logos').upsert({ club_name: tmSelected.verein, logo_url: tmSelected.clubLogoUrl }, { onConflict: 'club_name' }); } catch {}
      }

      // Generate personal invitation code
      const generateCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 to avoid confusion
        let code = 'KMH-';
        for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
      };

      const invitationCode = generateCode();

      // Save code to player_details (kein Ablaufdatum)
      await supabase.from('player_details').update({
        invitation_code: invitationCode,
      }).eq('id', newPlayer.id);

      const playerFullName = `${newFirstName.trim()} ${newLastName.trim()}`.trim();
      setCreatedPlayerCode(invitationCode);
      setCreatedPlayerName(playerFullName);

      setNewFirstName('');
      setNewLastName('');
      setTmSelected(null);
      setTmSuggestions([]);
      setShowAddModal(false);
      setShowCodeModal(true);
      fetchPlayers();
      fetchMyPlayerAccess();
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlayers();
    setRefreshing(false);
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  const renderListingBadge = (listing: string | null) => {
    if (!listing) return <Text style={[styles.tableCell, { color: colors.text }]}>-</Text>;
    const isKMH = listing === 'Karl Herzog Sportmanagement';
    return <View style={[styles.listingBadge, isKMH ? styles.listingKMH : styles.listingPM]}><Text style={styles.listingBadgeText}>{isKMH ? 'KMH' : 'PM'}</Text></View>;
  };

  const renderSortableHeader = (label: string, field: SortField, style: any) => (
    <TouchableOpacity onPress={() => handleSort(field)} style={style}>
      <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>{label} {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</Text>
    </TouchableOpacity>
  );

  const renderClubCell = (player: Player) => {
    const expired = isContractExpired(player.contract_end);
    const displayClub = getDisplayClub(player);
    const logoUrl = expired ? null : getClubLogo(player.club);
    return (
      <View style={[styles.colClub, styles.clubCell]}>
        {expired ? <Image source={ArbeitsamtIcon} style={styles.clubLogo} /> : logoUrl ? <Image source={{ uri: logoUrl }} style={styles.clubLogo} /> : null}
        <Text style={[styles.tableCell, { color: colors.text }, expired && styles.clubTextRed]} numberOfLines={1}>{displayClub}</Text>
      </View>
    );
  };

  const renderBirthDateCell = (player: Player) => {
    return (
      <View style={[styles.colBirthDate, styles.birthDateCell]}>
        <Text style={[styles.tableCell, { color: colors.text }]}>{formatDate(player.birth_date)}</Text>
      </View>
    );
  };

  const renderContractCell = (player: Player) => {
    const inCurrentSeason = isContractInCurrentSeason(player.contract_end);
    const hasSecuredFuture = hasFutureClubAndExpiringContract(player);
    const textColor = hasSecuredFuture ? '#22c55e' : (inCurrentSeason && player.contract_end ? '#ef4444' : colors.text);
    return <Text style={[styles.tableCell, styles.colContract, { color: textColor }]}>{formatDate(player.contract_end)}</Text>;
  };

  const renderPlayerRow = (player: Player) => {
    const hasAccess = hasAccessToPlayer(player.id);
    const birthday = isBirthday(player.birth_date);
    // Position in Kürzel umwandeln
    const positionDisplay = player.position
      ? player.position.split(', ').map(p => POSITION_SHORT[p.trim()] || p).join(', ')
      : '-';
    return (
      <TouchableOpacity
        key={player.id}
        style={[styles.tableRow, { borderBottomColor: colors.border }, !hasAccess && [styles.tableRowLocked, { backgroundColor: colors.surfaceSecondary }], birthday && styles.birthdayRow]}
        onPress={() => handlePlayerClick(player)}
      >
        <View style={[styles.colName, styles.nameContainer]}>
          {!hasAccess && <Text style={styles.lockIcon}>🔒 </Text>}
          <Text style={[styles.tableCell, styles.nameCell, { color: colors.text }]} numberOfLines={1}>
            {player.last_name}, {player.first_name}{birthday && ' 🎉'}
          </Text>
        </View>
        {renderBirthDateCell(player)}
        <Text style={[styles.tableCell, styles.colPosition, { color: colors.text }]} numberOfLines={1}>{positionDisplay}</Text>
        {renderClubCell(player)}
        <Text style={[styles.tableCell, styles.colLeague, { color: colors.text }]} numberOfLines={1}>{player.league || '-'}</Text>
        {renderContractCell(player)}
        <View style={styles.colListing}>{renderListingBadge(player.listing)}</View>
        <Text style={[styles.tableCell, styles.colResponsibility, { color: colors.text }]} numberOfLines={1}>{getResponsibilityInitials(player.responsibility)}</Text>
      </TouchableOpacity>
    );
  };

  // Mobile Card Rendering
  const renderPlayerCard = (player: Player) => {
    const hasAccess = hasAccessToPlayer(player.id);
    const positionsList = player.position
      ? player.position.split(',').map(p => POSITION_SHORT[p.trim()] || p.trim()).filter(Boolean)
      : [];
    const expired = isContractExpired(player.contract_end);
    const displayClub = getDisplayClub(player);
    const logoUrl = expired ? null : getClubLogo(player.club);
    const inCurrentSeason = isContractInCurrentSeason(player.contract_end);
    const hasSecuredFuture = hasFutureClubAndExpiringContract(player);
    const birthday = isBirthday(player.birth_date);

    return (
      <TouchableOpacity
        key={player.id}
        style={[styles.playerCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }, !hasAccess && { backgroundColor: colors.surfaceSecondary }, birthday && styles.birthdayCard]}
        onPress={() => handlePlayerClick(player)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {expired ? (
            <Image source={ArbeitsamtIcon} style={styles.clubLogoMobile} />
          ) : logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.clubLogoMobile} />
          ) : <View style={styles.clubLogoMobile} />}
          <View style={{ flex: 1 }}>
            {/* Reihe 1: Name + Position-Badges | Vertragslaufzeit rechtsbündig */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {!hasAccess && <Text style={styles.lockIconMobile}>🔒</Text>}
              <Text style={[styles.playerCardName, { color: colors.text }]} numberOfLines={1}>
                {player.last_name}, {player.first_name}{birthday && ' 🎉'}
              </Text>
              {positionsList.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                  {positionsList.map((pos, idx) => (
                    <Text key={idx} style={styles.playerCardPosition}>{pos}</Text>
                  ))}
                </View>
              ) : null}
              {player.contract_end ? (
                <Text style={[
                  styles.contractTextMobile,
                  { color: hasSecuredFuture ? '#22c55e' : (inCurrentSeason ? '#ef4444' : colors.textMuted), marginLeft: 'auto' }
                ]} numberOfLines={1}>
                  Vertrag bis {formatDate(player.contract_end)}
                </Text>
              ) : null}
            </View>
            {/* Reihe 2: Club · Liga | Agentur-Badge rechtsbündig */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text numberOfLines={1} style={{ flex: 1 }}>
                <Text style={[styles.playerCardClubText, { color: colors.textSecondary }, expired && styles.clubTextRed]}>{displayClub}</Text>
                {player.league ? <Text style={[styles.playerCardLeague, { color: colors.textMuted }]}>{'  ·  '}{player.league}</Text> : null}
              </Text>
              {player.listing ? (
                <View style={[styles.listingBadgeMobile, player.listing === 'Karl Herzog Sportmanagement' ? styles.listingKMH : styles.listingPM]}>
                  <Text style={styles.listingBadgeTextMobile}>{player.listing === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM'}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Anzahl aktiver Filter
  const activeFilterCount = selectedPositions.length + selectedYears.length + selectedListings.length + selectedResponsibilities.length + selectedContractYears.length;

  // Profile initials for header
  const profileInitials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}` : '?';

  const closePlayerDetailModal = () => { setShowPlayerDetailModal(false); setSelectedPlayer(null); setFullPlayer(null); setIsEditing(false); setEditData({}); };

  const parseList = (raw: any): string[] => {
    let items: string[] = [];
    if (Array.isArray(raw)) items = raw.map((s: any) => String(s).trim()).filter(Boolean);
    else if (typeof raw === 'string') items = raw.split(';').map((s: string) => s.trim()).filter(Boolean);
    return items;
  };
  const padSlots = (items: string[], n = 6): string[] => {
    const out = items.slice(0, n);
    while (out.length < n) out.push('');
    return out;
  };
  const splitToArray = (raw: string | null | undefined): string[] => raw ? raw.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];

  const todayIsoDate = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });

  const startEditAll = () => {
    if (!fullPlayer) return;
    setEditData({
      position: fullPlayer.position || '',
      secondary_positions: padSlots(splitToArray(fullPlayer.secondary_position), 3),
      nationality: fullPlayer.nationality || '',
      strong_foot: fullPlayer.strong_foot || '',
      height: fullPlayer.height?.toString() || '',
      strengthSlots: padSlots(parseList(fullPlayer.strengths)),
      potentialSlots: padSlots(parseList(fullPlayer.potentials)),
      club: fullPlayer.club || '',
      loan_from_club: fullPlayer.loan_from_club || '',
      loan_from_club_league: fullPlayer.loan_from_club_league || '',
      future_club: fullPlayer.future_club || '',
      league: fullPlayer.league || '',
      contract_end: fullPlayer.contract_end || '',
      contract_scope: fullPlayer.contract_scope || '',
      contract_option: fullPlayer.contract_option || '',
      fixed_fee: fullPlayer.fixed_fee || '',
      salary_month: fullPlayer.salary_month || '',
      point_bonus: fullPlayer.point_bonus || '',
      appearance_bonus: fullPlayer.appearance_bonus || '',
      contract_notes: fullPlayer.contract_notes || '',
      fussball_de_url: fullPlayer.fussball_de_url || '',
      // SPLIT-FIELDS: Berater editiert ausschließlich `_advisor`-Spalten,
      // Spieler-Werte (`_player`) werden zur Anzeige der "VOM SPIELER"-Pille mitgeführt
      phone_country_code_advisor: fullPlayer.phone_country_code_advisor || fullPlayer.phone_country_code || '',
      phone_country_code_player: fullPlayer.phone_country_code_player ?? null,
      phone_advisor: fullPlayer.phone_advisor || fullPlayer.phone || '',
      phone_player: fullPlayer.phone_player ?? null,
      email_advisor: fullPlayer.email_advisor || fullPlayer.email || '',
      email_player: fullPlayer.email_player ?? null,
      street_advisor: fullPlayer.street_advisor || fullPlayer.street || '',
      street_player: fullPlayer.street_player ?? null,
      postal_code_advisor: fullPlayer.postal_code_advisor || fullPlayer.postal_code || '',
      postal_code_player: fullPlayer.postal_code_player ?? null,
      city_advisor: fullPlayer.city_advisor || fullPlayer.city || '',
      city_player: fullPlayer.city_player ?? null,
      listing: fullPlayer.listing || '',
      responsibility: fullPlayer.responsibility || '',
      mandate_until: fullPlayer.mandate_until || '',
      provision: fullPlayer.provision || '',
      transfer_commission: fullPlayer.transfer_commission || '',
      father_name_advisor: fullPlayer.father_name_advisor || fullPlayer.father_name || '',
      father_name_player: fullPlayer.father_name_player ?? null,
      father_phone_country_code_advisor: fullPlayer.father_phone_country_code_advisor || fullPlayer.father_phone_country_code || '',
      father_phone_country_code_player: fullPlayer.father_phone_country_code_player ?? null,
      father_phone_advisor: fullPlayer.father_phone_advisor || fullPlayer.father_phone || '',
      father_phone_player: fullPlayer.father_phone_player ?? null,
      father_job_advisor: fullPlayer.father_job_advisor || fullPlayer.father_job || '',
      father_job_player: fullPlayer.father_job_player ?? null,
      mother_name_advisor: fullPlayer.mother_name_advisor || fullPlayer.mother_name || '',
      mother_name_player: fullPlayer.mother_name_player ?? null,
      mother_phone_country_code_advisor: fullPlayer.mother_phone_country_code_advisor || fullPlayer.mother_phone_country_code || '',
      mother_phone_country_code_player: fullPlayer.mother_phone_country_code_player ?? null,
      mother_phone_advisor: fullPlayer.mother_phone_advisor || fullPlayer.mother_phone || '',
      mother_phone_player: fullPlayer.mother_phone_player ?? null,
      mother_job_advisor: fullPlayer.mother_job_advisor || fullPlayer.mother_job || '',
      mother_job_player: fullPlayer.mother_job_player ?? null,
      siblings_advisor: fullPlayer.siblings_advisor || fullPlayer.siblings || '',
      siblings_player: fullPlayer.siblings_player ?? null,
      education_advisor: fullPlayer.education_advisor || fullPlayer.education || '',
      education_player: fullPlayer.education_player ?? null,
      training_advisor: fullPlayer.training_advisor || fullPlayer.training || '',
      training_player: fullPlayer.training_player ?? null,
      job_advisor: fullPlayer.job_advisor || fullPlayer.job || '',
      job_player: fullPlayer.job_player ?? null,
      instagram_advisor: fullPlayer.instagram_advisor || fullPlayer.instagram || '',
      instagram_player: fullPlayer.instagram_player ?? null,
      tiktok_advisor: fullPlayer.tiktok_advisor || fullPlayer.tiktok || '',
      tiktok_player: fullPlayer.tiktok_player ?? null,
      linkedin_advisor: fullPlayer.linkedin_advisor || fullPlayer.linkedin || '',
      linkedin_player: fullPlayer.linkedin_player ?? null,
      transfermarkt_url: fullPlayer.transfermarkt_url || '',
      // `interests` (Berater) bleibt einfach, `additional_info_player` (Spieler) für Pille-Anzeige
      interests: fullPlayer.interests || '',
      additional_info_player: fullPlayer.additional_info_player ?? null,
      // `other_notes` ist ab jetzt Berater-private Notizen
      other_notes: fullPlayer.other_notes || '',
      // SPLIT-FIELDS für Sport/Stamm
      injuries_advisor: fullPlayer.injuries_advisor || fullPlayer.injuries || '',
      injuries_player: fullPlayer.injuries_player ?? null,
      internat_advisor: fullPlayer.internat_advisor ?? fullPlayer.internat ?? false,
      internat_player: fullPlayer.internat_player ?? null,
      birth_date_advisor: fullPlayer.birth_date_advisor || fullPlayer.birth_date || '',
      birth_date_player: fullPlayer.birth_date_player ?? null,
      nationality_advisor: fullPlayer.nationality_advisor || fullPlayer.nationality || '',
      nationality_player: fullPlayer.nationality_player ?? null,
      prototype_id: playerPrototypeId,
    });
    setInternatJa(Boolean(fullPlayer.internat));
    setIsEditing(true);
  };

  // Photo-Editor (WYSIWYG): Berater wählt Bild → Live-Preview im Foto-Frame
  // mit Toolbar (Zoom/Position) → Speichern rendert das Bild via Canvas exakt
  // im Frame-Aspect-Ratio und lädt es hoch.
  // Editor öffnen: nutzt das bestehende Foto wenn vorhanden, sonst öffnet den Bild-Picker.
  const openAdvisorPhotoEditor = async () => {
    if (!fullPlayer?.id || uploadingAdvisorPhoto) return;
    if (fullPlayer.photo_url) {
      setAdvisorPhotoPreviewUri(fullPlayer.photo_url);
      setAdvisorPhotoScale(1.0);
      setAdvisorPhotoOffsetX(0);
      setAdvisorPhotoOffsetY(0);
      setShowAdvisorPhotoEditor(true);
      return;
    }
    await pickAdvisorPhoto();
  };

  // Bild-Picker explizit aufrufen (vom Editor aus über "Neues Bild" oder initial wenn kein Foto da ist).
  const pickAdvisorPhoto = async () => {
    if (!fullPlayer?.id || uploadingAdvisorPhoto) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setAdvisorPhotoPreviewUri(result.assets[0].uri);
    setAdvisorPhotoScale(1.0);
    setAdvisorPhotoOffsetX(0);
    setAdvisorPhotoOffsetY(0);
    setShowAdvisorPhotoEditor(true);
  };

  const cancelAdvisorPhoto = () => {
    setShowAdvisorPhotoEditor(false);
    setAdvisorPhotoPreviewUri(null);
    setAdvisorPhotoScale(1.0);
    setAdvisorPhotoOffsetX(0);
    setAdvisorPhotoOffsetY(0);
  };

  const saveAdvisorPhoto = async () => {
    if (!fullPlayer?.id || !advisorPhotoPreviewUri || uploadingAdvisorPhoto) return;
    setUploadingAdvisorPhoto(true);
    try {
      const previewW = isMobile ? 110 : 140;
      const previewH = isMobile ? 150 : 190;
      const dpr = 2;
      const targetW = previewW * dpr;
      const targetH = previewH * dpr;
      let blob: Blob;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d')!;
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = advisorPhotoPreviewUri;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });
        // "cover"-Logik: Bild füllt das Frame komplett, übersteht ggf. links/rechts oder oben/unten.
        // Der überstehende Bereich wird durch das Frame (overflow:hidden) abgeschnitten.
        // Identisch zum Live-Preview mit resizeMode="cover" + transform.
        const imgAspect = img.width / img.height;
        const frameAspect = targetW / targetH;
        let fitW: number, fitH: number;
        if (imgAspect > frameAspect) { fitH = targetH; fitW = targetH * imgAspect; }
        else { fitW = targetW; fitH = targetW / imgAspect; }
        const drawW = fitW * advisorPhotoScale;
        const drawH = fitH * advisorPhotoScale;
        const drawX = (targetW - drawW) / 2 + advisorPhotoOffsetX * dpr;
        const drawY = (targetH - drawH) / 2 + advisorPhotoOffsetY * dpr;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
      } else {
        // Native-Fallback: kein Editor, direkter Upload des Originals
        const response = await fetch(advisorPhotoPreviewUri);
        blob = await response.blob();
      }

      const fileName = `${fullPlayer.id}/photo.png`;
      await supabase.storage.from('player-photos').remove([fileName]);
      const { error: uploadErr } = await supabase.storage.from('player-photos').upload(fileName, blob, { contentType: 'image/png', upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('player-photos').getPublicUrl(fileName);
      const photoUrl = urlData.publicUrl + '?t=' + Date.now();
      const { error: updateErr } = await supabase.from('player_details').update({ photo_url: photoUrl }).eq('id', fullPlayer.id);
      if (updateErr) throw updateErr;
      setFullPlayer({ ...fullPlayer, photo_url: photoUrl });
      cancelAdvisorPhoto();
    } catch (e: any) {
      console.error('Photo save failed:', e);
      alertDialog({ title: 'Fehler', message: 'Foto konnte nicht gespeichert werden: ' + (e?.message || '') });
    } finally {
      setUploadingAdvisorPhoto(false);
    }
  };

  const saveAll = async () => {
    if (!fullPlayer?.id) return;
    setCardSaving(true);
    const updates: Record<string, any> = { ...editData };
    // Slots → joined string
    if (Array.isArray(updates.strengthSlots)) {
      updates.strengths = updates.strengthSlots.map((s: string) => s.trim()).filter(Boolean).join('; ');
      delete updates.strengthSlots;
    }
    if (Array.isArray(updates.potentialSlots)) {
      updates.potentials = updates.potentialSlots.map((s: string) => s.trim()).filter(Boolean).join('; ');
      delete updates.potentialSlots;
    }
    // Sekundärpositionen → kommagetrennter String
    if (Array.isArray(updates.secondary_positions)) {
      updates.secondary_position = updates.secondary_positions.filter(Boolean).join(', ');
      delete updates.secondary_positions;
    }
    // Height als Number
    if (updates.height !== undefined) updates.height = updates.height ? parseInt(updates.height, 10) : null;
    // Prototype-Zuweisung separat verarbeiten (genau 1 Row pro Spieler)
    const pendingProtoId: string | null | undefined = updates.prototype_id;
    delete updates.prototype_id;
    // SPLIT-FIELDS: `_player`-Spalten DARF der Berater NICHT überschreiben.
    // Die wurden in editData nur für die Pille-Anzeige mitgeführt — nicht persistieren.
    SPLIT_FIELDS.forEach(f => { delete updates[`${f}_player`]; });
    // Auch: das aus dem Spieler-View gespeiste `additional_info_player` darf nicht
    // vom Berater überschrieben werden.
    delete updates.additional_info_player;
    // Backwards-Compat: alte unsuffixed Spalten (phone, email, etc.) in einem Sweep
    // mit dem advisor-Wert synchron halten, damit Screens, die noch die alten Spalten
    // lesen, weiterhin den aktuellsten Berater-Wert sehen.
    SPLIT_FIELDS.forEach(f => {
      const advisorKey = `${f}_advisor`;
      if (advisorKey in updates) updates[f] = updates[advisorKey];
    });
    // Leere Strings zu null
    Object.keys(updates).forEach(k => { if (updates[k] === '') updates[k] = null; });
    const { error } = await supabase.from('player_details').update(updates).eq('id', fullPlayer.id);
    if (error) { setCardSaving(false); alertDialog({ title: 'Fehler beim Speichern', message: error.message }); return; }

    // Single-Assignment: alte Row löschen, neue anlegen (nur wenn !== null)
    if (pendingProtoId !== undefined) {
      await supabase.from('player_prototype_assignments').delete().eq('player_id', fullPlayer.id);
      if (pendingProtoId) {
        await supabase.from('player_prototype_assignments').insert({ player_id: fullPlayer.id, prototype_id: pendingProtoId, is_primary: true });
      }
      setPlayerPrototypeId(pendingProtoId);
    }

    setCardSaving(false);
    setFullPlayer({ ...fullPlayer, ...updates });
    // selectedPlayer + die Liste nachziehen, damit Header-Felder (Position, Verein,
    // Geburtsdatum, Vertragsende) und die Tabelle außerhalb des Modals nicht stale bleiben.
    setSelectedPlayer(prev => prev ? { ...prev, ...updates } as any : prev);
    setPlayers(prev => prev.map(p => p.id === fullPlayer.id ? { ...p, ...updates } as any : p));
    setIsEditing(false);
    setEditData({});
  };

  const toggleTransferList = async () => {
    if (!fullPlayer || transferBusy) return;
    setTransferBusy(true);
    const newValue = !fullPlayer.in_transfer_list;
    const { error } = await supabase.from('player_details').update({ in_transfer_list: newValue }).eq('id', fullPlayer.id);
    setTransferBusy(false);
    if (error) { alertDialog({ title: 'Fehler', message: error.message }); return; }
    setFullPlayer({ ...fullPlayer, in_transfer_list: newValue });
  };

  const handleInviteCode = async () => {
    if (!fullPlayer) return;
    setInviteCodeLoading(true);
    try {
      const { data } = await supabase.from('player_details').select('invitation_code, linked_user_id').eq('id', fullPlayer.id).single();
      if (data?.linked_user_id) { alertDialog({ title: 'Bereits registriert', message: 'Dieser Spieler hat sich bereits registriert.' }); setInviteCodeLoading(false); return; }
      if (data?.invitation_code) { setInviteCode(data.invitation_code); setShowInviteCodeModal(true); setInviteCodeLoading(false); return; }
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = 'KMH-';
      for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
      await supabase.from('player_details').update({ invitation_code: code }).eq('id', fullPlayer.id);
      setInviteCode(code);
      setShowInviteCodeModal(true);
    } catch (err) {
      console.error('Invite code error:', err);
    }
    setInviteCodeLoading(false);
  };

  const handleGeneratePdf = async () => {
    if (!fullPlayer || pdfGenerating) return;
    setPdfGenerating(true);
    setShowPdfPreview(true);
    if (pdfPreviewUrl) {
      try { URL.revokeObjectURL(pdfPreviewUrl); } catch {}
      setPdfPreviewUrl(null);
    }
    try {
      // Karriereverlauf + PDF-Beschreibung aus DB nachladen — diese werden im
      // PDF-Editor (PlayerDetailScreen) gespeichert, müssen aber beim Generieren
      // des PDFs aus PlayerOverview ebenfalls übergeben werden, sonst rendert die
      // Edge Function den Karriere-Block leer.
      const [{ data: careerRows }, { data: detailsRow }] = await Promise.all([
        supabase.from('player_career').select('*').eq('player_id', fullPlayer.id),
        supabase.from('player_details').select('pdf_description, pdf_additional_info, pdf_highlight_video_id, pdf_highlight_video_url, pdf_language').eq('id', fullPlayer.id).single(),
      ]);
      const careerEntries = (careerRows || []).map((d: any) => {
        let games = '', goals = '', assists = '';
        if (d.stats) {
          const sp = d.stats.match(/(\d+)\s*(?:Spiele|Spiel|Sp\b)/i);
          const tg = d.stats.match(/(\d+)\s*(?:Tore|Tor\b|T(?!\w))/i);
          const as = d.stats.match(/(\d+)\s*(?:Assists|Assist|A(?!\w))/i);
          if (sp) games = sp[1];
          if (tg) goals = tg[1];
          if (as) assists = as[1];
        }
        return {
          ...d,
          from_date: d.from_date || d.from_year || '',
          to_date: d.to_date || d.to_year || '',
          is_current: d.is_current || false,
          games,
          goals,
          assists,
        };
      });
      const playerDescription = detailsRow?.pdf_description || '';
      const additionalInfo = detailsRow?.pdf_additional_info || '';

      // Highlight-Video resolven. Vorrang: direkte URL > Library-Video.
      let highlightVideoUrl: string | undefined;
      let highlightVideoTitle: string | undefined;
      const directUrl = (detailsRow?.pdf_highlight_video_url || '').trim();
      if (directUrl) {
        highlightVideoUrl = directUrl;
      } else if (detailsRow?.pdf_highlight_video_id) {
        const { data: vid } = await supabase
          .from('player_videos')
          .select('label, description, video_url, video_path')
          .eq('id', detailsRow.pdf_highlight_video_id)
          .single();
        if (vid) {
          highlightVideoUrl = vid.video_url || (vid.video_path
            ? supabase.storage.from('player-videos').getPublicUrl(vid.video_path).data.publicUrl
            : undefined);
          highlightVideoTitle = vid.label || vid.description || undefined;
        }
      }

      // PDF startet immer auf Deutsch beim Öffnen. Wechsel zu English passiert
      // erst manuell im Edit-Mode (PlayerDetailScreen).
      const lang = 'de';
      const clubLogoUrl = getClubLogo(fullPlayer.club || '') || undefined;
      const loanFromClubLogoUrl = fullPlayer.loan_from_club ? (getClubLogo(fullPlayer.loan_from_club) || undefined) : undefined;
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: { player: fullPlayer, careerEntries, playerDescription, additionalInfo, highlightVideoUrl, highlightVideoTitle, clubLogoUrl, loanFromClubLogoUrl, lang }
      });
      if (error) {
        alertDialog({ title: 'PDF-Fehler', message: 'PDF konnte nicht erstellt werden.' });
        setPdfGenerating(false);
        setShowPdfPreview(false);
        return;
      }
      if (data?.pdf && typeof window !== 'undefined') {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob) + '#toolbar=0&navpanes=0';
        setPdfPreviewUrl(url);
      }
    } catch (err) {
      console.error('PDF error:', err);
    }
    setPdfGenerating(false);
  };

  const handlePdfDownload = () => {
    if (!fullPlayer || !pdfPreviewUrl || typeof window === 'undefined') return;
    const link = document.createElement('a');
    link.href = pdfPreviewUrl;
    const langSuffix = (fullPlayer as any)?.pdf_language === 'en' ? '_english' : '';
    link.download = `Expose_${fullPlayer.last_name}_${fullPlayer.first_name}${langSuffix}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClosePdfPreview = () => {
    if (pdfPreviewUrl) {
      try { URL.revokeObjectURL(pdfPreviewUrl); } catch {}
    }
    setPdfPreviewUrl(null);
    setShowPdfPreview(false);
  };

  const handleEditPdf = () => {
    if (!fullPlayer) return;
    const pid = fullPlayer.id;
    handleClosePdfPreview();
    // Spielerprofil-Modal NICHT schließen — beim Zurückkehren vom PDF-Editor soll es noch offen sein
    navigation.navigate('PlayerDetail', { playerId: pid, openPdfEditor: true });
  };

  const renderDetailField = (label: string, value: React.ReactNode, full: boolean = false) => (
    <View style={[styles.detailField, full && styles.detailFieldFull]}>
      <Text style={styles.detailFieldLabel}>{label}</Text>
      <Text style={styles.detailFieldValue}>{value || '-'}</Text>
    </View>
  );

  const DetailDropdown = ({ value, options, onChange, placeholder, dropdownKey, minWidth = 220, defaultScrollValue, formatValue }: {
    value: string;
    options: string[];
    onChange: (v: string) => void;
    placeholder?: string;
    dropdownKey: string;
    minWidth?: number;
    defaultScrollValue?: string;
    formatValue?: (v: string) => string;
  }) => {
    const open = openDropdown === dropdownKey;
    const displayed = value ? (formatValue ? (formatValue(value) || value) : value) : '';
    return (
      <View {...({ 'data-kmh-dropdown': 'true', dataSet: { kmhDropdown: 'true' } } as any)} style={{ position: 'relative', zIndex: open ? 1000 : 1 }}>
        <TouchableOpacity
          style={[styles.detailEditInput, { paddingVertical: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
          onPress={() => setOpenDropdown(open ? null : dropdownKey)}
        >
          <Text numberOfLines={1} style={{ fontSize: 13, color: value ? '#fff' : 'rgba(255,255,255,0.3)', flex: 1 }}>{displayed || placeholder || '-'}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
        {open ? (
          <View style={[styles.detailDropdownList, { minWidth }]}>
            <ScrollView
              ref={(ref: any) => {
                if (!ref) return;
                const target = value || defaultScrollValue;
                if (!target) return;
                const idx = options.indexOf(target);
                if (idx < 0) return;
                const ITEM_HEIGHT = 34;
                const MAX_HEIGHT = 260;
                const offset = (idx + 1) * ITEM_HEIGHT;
                const centered = Math.max(0, offset - MAX_HEIGHT / 2 + ITEM_HEIGHT / 2);
                requestAnimationFrame(() => ref.scrollTo?.({ y: centered, animated: false }));
              }}
              style={{ maxHeight: 260 }}
              nestedScrollEnabled
            >
              <TouchableOpacity style={styles.detailDropdownItem} onPress={() => { onChange(''); setOpenDropdown(null); }}>
                <Text numberOfLines={1} style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Leeren</Text>
              </TouchableOpacity>
              {options.map(opt => (
                <TouchableOpacity key={opt} style={styles.detailDropdownItem} onPress={() => { onChange(opt); setOpenDropdown(null); }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, color: '#fff' }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  };

  const MultiSelectDropdown = ({ values, options, onChange, placeholder, dropdownKey, minWidth = 260 }: {
    values: string[];
    options: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    dropdownKey: string;
    minWidth?: number;
  }) => {
    const open = openDropdown === dropdownKey;
    const displayText = values.length === 0 ? (placeholder || '-') : values.join(', ');
    return (
      <View {...({ 'data-kmh-dropdown': 'true', dataSet: { kmhDropdown: 'true' } } as any)} style={{ position: 'relative', zIndex: open ? 1000 : 1 }}>
        <TouchableOpacity
          style={[styles.detailEditInput, { paddingVertical: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
          onPress={() => setOpenDropdown(open ? null : dropdownKey)}
        >
          <Text numberOfLines={1} style={{ fontSize: 13, color: values.length ? '#fff' : 'rgba(255,255,255,0.3)', flex: 1 }}>{displayText}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
        {open ? (
          <View style={[styles.detailDropdownList, { minWidth }]}>
            <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
              <TouchableOpacity style={styles.detailDropdownItem} onPress={() => onChange([])}>
                <Text numberOfLines={1} style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Leeren</Text>
              </TouchableOpacity>
              {options.map(opt => {
                const checked = values.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.detailDropdownItem, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                    onPress={() => {
                      if (checked) onChange(values.filter(v => v !== opt));
                      else onChange([...values, opt]);
                    }}
                  >
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={16} color={checked ? '#22c55e' : 'rgba(255,255,255,0.5)'} />
                    <Text numberOfLines={1} style={{ fontSize: 13, color: '#fff', flex: 1 }}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  };

  const DateDropdown = ({ field, dropdownKeyPrefix }: { field: string; dropdownKeyPrefix: string }) => {
    const raw: string = editData[field] || '';
    const today = new Date();
    const parts = raw.length >= 10 ? raw.substring(0, 10).split('-') : ['', '', ''];
    const year = parts[0] || '';
    const month = parts[1] || '';
    const day = parts[2] || '';

    const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
    const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const currentYear = today.getFullYear();
    const YEARS = Array.from({ length: 40 }, (_, i) => String(currentYear - 10 + i));

    const todayY = String(today.getFullYear());
    const todayM = String(today.getMonth() + 1).padStart(2, '0');
    const todayD = String(today.getDate()).padStart(2, '0');

    const updatePart = (partKey: 'y' | 'm' | 'd', newVal: string) => {
      if (!newVal) {
        setEditData({ ...editData, [field]: '' });
        return;
      }
      const y = partKey === 'y' ? newVal : (year || todayY);
      const m = partKey === 'm' ? newVal : (month || todayM);
      const d = partKey === 'd' ? newVal : (day || todayD);
      setEditData({ ...editData, [field]: `${y}-${m}-${d}` });
    };

    return (
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ width: 72 }}>
          <DetailDropdown
            value={day}
            options={DAYS}
            onChange={(v) => updatePart('d', v)}
            placeholder="Tag"
            dropdownKey={`${dropdownKeyPrefix}_day`}
            minWidth={100}
            defaultScrollValue="30"
          />
        </View>
        <View style={{ width: 80 }}>
          <DetailDropdown
            value={month}
            options={MONTHS}
            onChange={(v) => updatePart('m', v)}
            placeholder="Monat"
            dropdownKey={`${dropdownKeyPrefix}_month`}
            minWidth={100}
            defaultScrollValue="06"
          />
        </View>
        <View style={{ width: 90 }}>
          <DetailDropdown
            value={year}
            options={YEARS}
            onChange={(v) => updatePart('y', v)}
            placeholder="Jahr"
            dropdownKey={`${dropdownKeyPrefix}_year`}
            minWidth={110}
            defaultScrollValue={String(currentYear)}
          />
        </View>
      </View>
    );
  };

  // EditableValue ist jetzt außerhalb des Component-Scopes definiert (siehe oben),
  // damit der TextInput beim Tippen nicht unmounted wird.

  const playerDetailModalJsx = selectedPlayer && (
    <Modal visible={showPlayerDetailModal} transparent animationType={isMobile ? 'slide' : 'fade'} onRequestClose={closePlayerDetailModal}>
      <View style={[styles.detailModalBackdrop, isMobile && { paddingHorizontal: 0, paddingVertical: 0, justifyContent: 'flex-end', alignItems: 'stretch' }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closePlayerDetailModal} />
        <View style={[styles.detailModalBox, isMobile && { maxHeight: '80%', borderRadius: 0, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomWidth: 0 }]}>
        <Image source={require('../../../assets/scouting-header-bg.jpg')} style={styles.detailBgImage} resizeMode="cover" />
        <View style={styles.detailBgOverlay} />

        {/* Toolbar */}
        <View style={[styles.detailToolbar, isMobile && { paddingHorizontal: 10, gap: 6 }]}>
          <View style={[styles.detailToolbarLeft, isMobile && { gap: 6 }]}>
            {!(isMobile && isEditing) && (
              <>
                <TouchableOpacity
                  style={[styles.detailToolbarBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                  onPress={handleInviteCode}
                  disabled={!fullPlayer || inviteCodeLoading}
                >
                  {inviteCodeLoading ? (
                    <Text style={[styles.detailToolbarBtnText, { color: '#fbbf24' }]}>...</Text>
                  ) : (
                    <>
                      <Ionicons name="key-outline" size={11} color="#fbbf24" />
                      <Text style={[styles.detailToolbarBtnText, { color: '#fbbf24' }]}>Code</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailToolbarBtn, fullPlayer?.in_transfer_list && { backgroundColor: '#dc3545', borderColor: '#dc3545' }, isMobile && { flexDirection: 'row', alignItems: 'center', gap: 2 }]}
                  onPress={toggleTransferList}
                  disabled={!fullPlayer || transferBusy}
                >
                  {isMobile ? (
                    fullPlayer?.in_transfer_list ? (
                      <Ionicons name="close" size={14} color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="arrow-up" size={12} color="#22c55e" />
                        <Ionicons name="arrow-down" size={12} color="#ef4444" />
                      </>
                    )
                  ) : (
                    <Text style={[styles.detailToolbarBtnText, fullPlayer?.in_transfer_list && { color: '#fff' }]}>
                      {fullPlayer?.in_transfer_list ? 'Von Transfer entfernen' : 'Zu Transfer hinzufügen'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailToolbarBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                  onPress={handleGeneratePdf}
                  disabled={!fullPlayer || pdfGenerating}
                >
                  {pdfGenerating ? (
                    <Text style={[styles.detailToolbarBtnText, { color: colors.textSecondary }]}>...</Text>
                  ) : (
                    <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={[styles.detailToolbarRight, isMobile && { gap: 6 }]}>
            {isEditing ? (
              <>
                <TouchableOpacity
                  style={[styles.detailToolbarBtn, { borderColor: '#dc2626' }, isMobile && { paddingHorizontal: 8 }]}
                  onPress={async () => {
                    if (!fullPlayer) return;
                    const ok = await confirmDialog({
                      title: 'Spieler löschen',
                      message: `"${fullPlayer.first_name} ${fullPlayer.last_name}" wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
                      danger: true,
                      confirmLabel: 'Endgültig löschen',
                    });
                    if (!ok) return;
                    setCardSaving(true);
                    const { error } = await supabase.from('player_details').delete().eq('id', fullPlayer.id);
                    setCardSaving(false);
                    if (error) {
                      alertDialog({ title: 'Fehler beim Löschen', message: error.message });
                      return;
                    }
                    closePlayerDetailModal();
                    fetchPlayers();
                  }}
                  disabled={cardSaving}
                >
                  {isMobile ? (
                    <Ionicons name="trash-outline" size={14} color="#dc2626" />
                  ) : (
                    <Text style={[styles.detailToolbarBtnText, { color: '#dc2626' }]}>Löschen</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detailToolbarBtn, { backgroundColor: '#22c55e', borderColor: '#22c55e' }]} onPress={saveAll} disabled={cardSaving}>
                  <Text style={[styles.detailToolbarBtnText, { color: '#fff' }]}>{cardSaving ? 'Speichern…' : 'Speichern'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.detailToolbarBtn} onPress={startEditAll} disabled={!fullPlayer}>
                <Text style={styles.detailToolbarBtnText}>Bearbeiten</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.detailToolbarCloseBtn} onPress={closePlayerDetailModal}>
              <Text style={styles.detailCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
          {/* Header */}
          <View style={[styles.detailHeader, isEditing && { zIndex: 100, position: 'relative' }]}>
            <View style={styles.detailHeaderTop}>
              {/* Foto — im Edit-Mode klickbar (nur Berater darf das Foto verwalten) */}
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  onPress={isEditing && !showAdvisorPhotoEditor ? openAdvisorPhotoEditor : undefined}
                  disabled={!isEditing || uploadingAdvisorPhoto || showAdvisorPhotoEditor}
                  activeOpacity={isEditing && !showAdvisorPhotoEditor ? 0.7 : 1}
                  style={[styles.detailPhoto, { width: isMobile ? 90 : 140, height: isMobile ? 120 : 190, position: 'relative', overflow: 'hidden', flexShrink: 0, flexGrow: 0 }]}
                >
                  {showAdvisorPhotoEditor && advisorPhotoPreviewUri ? (
                    <Image
                      source={{ uri: advisorPhotoPreviewUri }}
                      style={{
                        width: '100%',
                        height: '100%',
                        transform: [
                          { scale: advisorPhotoScale },
                          { translateX: advisorPhotoOffsetX },
                          { translateY: advisorPhotoOffsetY },
                        ],
                      }}
                      resizeMode="cover"
                    />
                  ) : fullPlayer?.photo_url ? (
                    <Image source={{ uri: fullPlayer.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={[styles.detailPhotoPlaceholder, { width: '100%', height: '100%' }]}>
                      <Text style={styles.detailPhotoInitial}>{(selectedPlayer.first_name?.[0] || '') + (selectedPlayer.last_name?.[0] || '')}</Text>
                    </View>
                  )}
                  {uploadingAdvisorPhoto ? (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 11 }}>Lädt…</Text>
                    </View>
                  ) : null}
                  {isEditing && !uploadingAdvisorPhoto && !showAdvisorPhotoEditor ? (
                    <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="camera-outline" size={14} color="#fff" />
                    </View>
                  ) : null}
                </TouchableOpacity>

                {/* Photo-Editor-Toolbar direkt unter dem Foto. Block-Element (nicht absolute),
                    damit das Layout der Stats-Row darunter ungestört bleibt und Klicks
                    nicht durch andere Elemente blockiert werden. */}
                {showAdvisorPhotoEditor ? (
                  <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', padding: 10, zIndex: 200, elevation: 12, flexDirection: 'column', gap: 8, alignSelf: 'flex-start', minWidth: isMobile ? 220 : 260, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12 }}>
                    {/* Zoom */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 0.6, width: 50 }}>ZOOM</Text>
                      <TouchableOpacity
                        style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setAdvisorPhotoScale(s => Math.max(0.3, Math.round((s - 0.05) * 100) / 100))}
                      >
                        <Text style={{ fontSize: 14, color: '#fff' }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 11, color: '#fff', flex: 1, textAlign: 'center', fontWeight: '500' }}>{Math.round(advisorPhotoScale * 100)}%</Text>
                      <TouchableOpacity
                        style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setAdvisorPhotoScale(s => Math.min(3.0, Math.round((s + 0.05) * 100) / 100))}
                      >
                        <Text style={{ fontSize: 14, color: '#fff' }}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Position */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 0.6, width: 50 }}>POS</Text>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setAdvisorPhotoOffsetX(x => x - 3)}>
                        <Text style={{ fontSize: 12, color: '#fff' }}>←</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setAdvisorPhotoOffsetY(y => y - 3)}>
                        <Text style={{ fontSize: 12, color: '#fff' }}>↑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setAdvisorPhotoOffsetY(y => y + 3)}>
                        <Text style={{ fontSize: 12, color: '#fff' }}>↓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setAdvisorPhotoOffsetX(x => x + 3)}>
                        <Text style={{ fontSize: 12, color: '#fff' }}>→</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Neues Bild wählen */}
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.05)' }}
                      onPress={pickAdvisorPhoto}
                      disabled={uploadingAdvisorPhoto}
                    >
                      <Ionicons name="image-outline" size={12} color="rgba(255,255,255,0.85)" />
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>Neues Bild wählen</Text>
                    </TouchableOpacity>
                    {/* Buttons */}
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center' }}
                        onPress={cancelAdvisorPhoto}
                        disabled={uploadingAdvisorPhoto}
                      >
                        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>Abbrechen</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 6, borderRadius: 6, backgroundColor: '#22c55e', alignItems: 'center', opacity: uploadingAdvisorPhoto ? 0.5 : 1 }}
                        onPress={saveAdvisorPhoto}
                        disabled={uploadingAdvisorPhoto}
                      >
                        <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>Speichern</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Name + Club */}
              <View style={styles.detailHeaderCenter}>
                <Text style={[styles.detailHeaderName, { fontSize: isMobile ? 34 : 72, lineHeight: isMobile ? 38 : 76 }]}>
                  {selectedPlayer.first_name}
                </Text>
                <Text style={[styles.detailHeaderName, { fontSize: isMobile ? 34 : 72, lineHeight: isMobile ? 38 : 76 }]}>
                  {selectedPlayer.last_name}
                </Text>
                <View style={styles.detailHeaderClubRow}>
                  {getClubLogo(selectedPlayer.club) && (
                    <Image source={{ uri: getClubLogo(selectedPlayer.club)! }} style={{ width: isMobile ? 32 : 44, height: isMobile ? 32 : 44 }} resizeMode="contain" />
                  )}
                  <Text numberOfLines={1} style={[styles.detailHeaderClubText, { fontSize: isMobile ? 15 : 30, flexShrink: 1 }]}>{normalizeGermanClubName(selectedPlayer.club) || '-'}</Text>
                  {fullPlayer?.loan_from_club ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                      <Text numberOfLines={1} style={[styles.detailHeaderClubText, { fontSize: isMobile ? 10 : 13, color: 'rgba(255,255,255,0.55)', fontWeight: '400' }]}>
                        (ausgeliehen von
                      </Text>
                      {getClubLogo(fullPlayer.loan_from_club) ? (
                        <Image source={{ uri: getClubLogo(fullPlayer.loan_from_club)! }} style={{ width: isMobile ? 16 : 20, height: isMobile ? 16 : 20 }} resizeMode="contain" />
                      ) : null}
                      <Text numberOfLines={1} style={[styles.detailHeaderClubText, { fontSize: isMobile ? 10 : 13, color: 'rgba(255,255,255,0.55)', fontWeight: '400', flexShrink: 1 }]}>
                        {fullPlayer.loan_from_club})
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* SPIELER-PROFIL-Label */}
              {!isMobile && (
                <View style={{ alignSelf: 'flex-start', paddingRight: 12, paddingTop: 4 }}>
                  <Text style={styles.detailHeaderTitle}>Persönliche Daten</Text>
                </View>
              )}
            </View>

            <View style={styles.detailDivider} />
            <View style={styles.detailStatsRow}>
              <Pressable style={styles.detailStatCol} onHoverIn={() => setShowNatTooltip(true)} onHoverOut={() => setShowNatTooltip(false)}>
                <Text style={styles.detailStatLabel}>Nationalität</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.detailEditInput, { paddingVertical: 4, fontSize: 11, width: '100%', minWidth: 120, textAlign: 'center' }]}
                    value={(editData.nationality_advisor as string) || ''}
                    onChangeText={(v) => setEditData({ ...editData, nationality_advisor: v })}
                    placeholder="z.B. Deutschland"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                ) : (() => {
                  // Stamm-Daten: Spieler-Wert ?? Berater-Wert ?? alte Spalte
                  const nat = fullPlayer?.nationality_player || fullPlayer?.nationality_advisor || fullPlayer?.nationality;
                  return (
                    <Text style={[styles.detailStatValue, { fontSize: 18, lineHeight: 20 }]}>
                      {nat ? nationalityToFlags(nat) : '-'}
                    </Text>
                  );
                })()}
                {!isEditing && showNatTooltip && (fullPlayer?.nationality_player || fullPlayer?.nationality_advisor || fullPlayer?.nationality) ? (
                  <View style={styles.detailTooltip}>
                    <Text style={styles.detailTooltipText}>{fullPlayer?.nationality_player || fullPlayer?.nationality_advisor || fullPlayer?.nationality}</Text>
                  </View>
                ) : null}
              </Pressable>
              <View style={[styles.detailStatCol, isEditing && { zIndex: 50, position: 'relative' }]}>
                <Text style={styles.detailStatLabel}>Geburtsdatum</Text>
                {isEditing ? (
                  <DateDropdown field="birth_date_advisor" dropdownKeyPrefix="birth_date" />
                ) : (() => {
                  const bd = fullPlayer?.birth_date_player || fullPlayer?.birth_date_advisor || selectedPlayer.birth_date;
                  return (
                    <Text style={styles.detailStatValue}>
                      {bd ? `${formatDate(bd)}${calculateAge(bd) !== null ? `  (${calculateAge(bd)})` : ''}` : '-'}
                    </Text>
                  );
                })()}
              </View>
              <View style={styles.detailStatCol}>
                <Text style={styles.detailStatLabel}>Position</Text>
                {(() => {
                  // Nur die Hauptposition; Nebenpositionen werden hier bewusst nicht angezeigt.
                  // Fallback auf selectedPlayer falls fullPlayer noch nicht geladen ist
                  // (z.B. unmittelbar nach dem Öffnen, vor der Detail-Fetch).
                  const primary = (fullPlayer?.position ?? selectedPlayer.position ?? '').toString().trim();
                  return (
                    <Text style={styles.detailStatValue}>{primary || '-'}</Text>
                  );
                })()}
              </View>
              <View style={styles.detailStatCol}>
                <Text style={styles.detailStatLabel}>Vertragsende</Text>
                <Text style={[styles.detailStatValue, isContractInCurrentSeason(selectedPlayer.contract_end || '') && { color: '#ef4444' }]}>
                  {formatDate(selectedPlayer.contract_end)}
                </Text>
              </View>
              <View style={styles.detailStatCol}>
                <Text style={styles.detailStatLabel}>Transfermarkt</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.detailEditInput, { paddingVertical: 4, fontSize: 11, width: '100%', minWidth: 120 }]}
                    value={(editData.transfermarkt_url as string) || ''}
                    onChangeText={(v) => setEditData({ ...editData, transfermarkt_url: v })}
                    placeholder="https://…"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                  />
                ) : fullPlayer?.transfermarkt_url ? (
                  <TouchableOpacity onPress={() => { if (typeof window !== 'undefined') window.open(fullPlayer.transfermarkt_url, '_blank'); }}>
                    <Ionicons name="link-outline" size={16} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.detailStatValue}>-</Text>
                )}
              </View>
            </View>
          </View>

          {/* Karten-Grid */}
          {fullPlayerLoading ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Laden...</Text>
            </View>
          ) : (
            <View style={[styles.detailCardGrid, isMobile && { padding: 12, gap: 12 }]}>
              {/* Spielerprofil — 3 Spalten */}
              <View style={[styles.detailCard, { position: 'relative', zIndex: 100 }, isMobile && { minWidth: 0, flexBasis: '100%', padding: 12 }]}>
                <Text style={styles.detailCardTitle}>Spielerprofil</Text>
                <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap', zIndex: isEditing ? 200 : undefined, position: 'relative' }}>
                  {/* Spalte 1: Position + Starker Fuß + Größe */}
                  <View style={{ minWidth: 110, flexBasis: 120, flexGrow: 0, gap: 14, zIndex: isEditing ? 200 : undefined, position: 'relative' }}>
                    <View style={{ zIndex: 30, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Position</Text>
                      {isEditing ? (
                        <>
                          <DetailDropdown
                            value={editData.position || ''}
                            options={POSITIONS}
                            onChange={(v) => setEditData({ ...editData, position: v })}
                            placeholder="Hauptposition"
                            dropdownKey="position"
                            formatValue={positionToShort}
                          />
                          <Text style={[styles.detailFieldLabel, { fontSize: 9, marginTop: 14 }]}>Nebenposition</Text>
                          <View style={{ gap: 4 }}>
                            {((editData.secondary_positions as string[]) || []).map((sp: string, i: number) => (
                              <View key={i} style={{ zIndex: 100 - i, position: 'relative' }}>
                                <DetailDropdown
                                  value={sp}
                                  options={POSITIONS.filter(p => p !== editData.position && !(editData.secondary_positions as string[]).includes(p) || p === sp)}
                                  onChange={(v) => {
                                    const arr = [...(editData.secondary_positions as string[])];
                                    arr[i] = v;
                                    setEditData({ ...editData, secondary_positions: arr });
                                  }}
                                  dropdownKey={`secondary_${i}`}
                                  formatValue={positionToShort}
                                />
                              </View>
                            ))}
                          </View>
                        </>
                      ) : (
                        <MiniPositionField
                          primary={positionToShort(fullPlayer?.position)}
                          secondaries={splitPositions(fullPlayer?.secondary_position)}
                          maxWidth={100}
                          circleSize={18}
                        />
                      )}
                    </View>
                    <View style={{ zIndex: 20, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Starker Fuß</Text>
                      {isEditing ? (
                        <DetailDropdown
                          value={editData.strong_foot || ''}
                          options={['Rechts', 'Links', 'Beidfüßig']}
                          onChange={(v) => setEditData({ ...editData, strong_foot: v })}
                          placeholder="Auswählen"
                          dropdownKey="strong_foot"
                        />
                      ) : (
                        <Text style={styles.detailFieldValue}>{fullPlayer?.strong_foot || '-'}</Text>
                      )}
                    </View>
                    <View style={{ zIndex: 10, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Größe (in cm)</Text>
                      {isEditing ? (
                        <TextInput style={[styles.detailEditInput, { paddingVertical: 4 }]} value={editData.height?.toString() || ''} onChangeText={(v) => setEditData({ ...editData, height: v.replace(/\D/g, '') })} placeholder="cm" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
                      ) : (
                        <Text style={styles.detailFieldValue}>{fullPlayer?.height ? `${fullPlayer.height} cm` : '-'}</Text>
                      )}
                    </View>
                  </View>

                  {/* Spalte 2: Stärken */}
                  <View style={{ flexBasis: 120, flexGrow: 0, flexShrink: 1, minWidth: 100, gap: 6 }}>
                    <Text style={[styles.detailFieldLabel, { marginBottom: 0 }]}>Stärken</Text>
                    {isEditing ? (
                      (editData.strengthSlots as string[] || []).map((val: string, i: number) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="chevron-forward-outline" size={10} color="#22c55e" />
                          <TextInput
                            style={[styles.detailEditInput, { flex: 1, minWidth: 0, paddingVertical: 4, paddingHorizontal: 10 }]}
                            value={val}
                            onChangeText={(v) => {
                              const arr = [...(editData.strengthSlots as string[])];
                              arr[i] = v;
                              setEditData({ ...editData, strengthSlots: arr });
                            }}
                            placeholder={`Stärke ${i + 1}`}
                            placeholderTextColor="rgba(255,255,255,0.3)"
                          />
                        </View>
                      ))
                    ) : (() => {
                      const items: string[] = parseList(fullPlayer?.strengths);
                      return items.length === 0 ? (
                        <Text style={styles.detailFieldValue}>-</Text>
                      ) : items.map((s, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="chevron-forward-outline" size={10} color="#22c55e" />
                          <Text style={styles.detailListItem}>{s}</Text>
                        </View>
                      ));
                    })()}
                  </View>

                  {/* Spalte 3: Potenziale */}
                  <View style={{ flexBasis: 120, flexGrow: 0, flexShrink: 1, minWidth: 100, gap: 6 }}>
                    <Text style={[styles.detailFieldLabel, { marginBottom: 0 }]}>Potenziale</Text>
                    {isEditing ? (
                      (editData.potentialSlots as string[] || []).map((val: string, i: number) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="chevron-forward-outline" size={10} color="#ef4444" />
                          <TextInput
                            style={[styles.detailEditInput, { flex: 1, minWidth: 0, paddingVertical: 4, paddingHorizontal: 10 }]}
                            value={val}
                            onChangeText={(v) => {
                              const arr = [...(editData.potentialSlots as string[])];
                              arr[i] = v;
                              setEditData({ ...editData, potentialSlots: arr });
                            }}
                            placeholder={`Potenzial ${i + 1}`}
                            placeholderTextColor="rgba(255,255,255,0.3)"
                          />
                        </View>
                      ))
                    ) : (() => {
                      const items: string[] = parseList(fullPlayer?.potentials);
                      return items.length === 0 ? (
                        <Text style={styles.detailFieldValue}>-</Text>
                      ) : items.map((p, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="chevron-forward-outline" size={10} color="#ef4444" />
                          <Text style={styles.detailListItem}>{p}</Text>
                        </View>
                      ));
                    })()}
                  </View>
                </View>

                {/* Prototyp-Zuordnung — genau 1 pro Spieler (DetailDropdown im KMH-Pattern) */}
                <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', zIndex: 50, position: 'relative' }}>
                  <Text style={styles.detailFieldLabel}>Prototyp</Text>
                  {isEditing ? (() => {
                    const currentId: string | null = editData.prototype_id ?? null;
                    const currentProto = currentId ? allPrototypes.find(p => p.id === currentId) : null;
                    const currentName = currentProto ? displayPrototypeName(currentProto.name) : '';
                    const options = allPrototypes.map(p => displayPrototypeName(p.name));
                    return (
                      <DetailDropdown
                        value={currentName}
                        options={options}
                        onChange={(displayName) => {
                          if (!displayName) {
                            setEditData({ ...editData, prototype_id: null });
                            return;
                          }
                          const found = allPrototypes.find(p => displayPrototypeName(p.name) === displayName);
                          setEditData({ ...editData, prototype_id: found?.id ?? null });
                        }}
                        placeholder="Prototyp wählen…"
                        dropdownKey="prototype_assignment"
                        minWidth={320}
                      />
                    );
                  })() : (() => {
                    if (!playerPrototypeId) return <Text style={[styles.detailFieldValue, { color: 'rgba(255,255,255,0.4)' }]}>Keine zugewiesen</Text>;
                    const proto = allPrototypes.find(p => p.id === playerPrototypeId);
                    if (!proto) return <Text style={[styles.detailFieldValue, { color: 'rgba(255,255,255,0.4)' }]}>—</Text>;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="chevron-forward-outline" size={10} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.detailListItem}>{displayPrototypeName(proto.name)}</Text>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Vertrag — 2 Spalten */}
              <View style={[styles.detailCard, { position: 'relative', zIndex: 90 }, isMobile && { minWidth: 0, flexBasis: '100%', padding: 12 }]}>
                <Text style={styles.detailCardTitle}>Vertrag</Text>
                <View style={{ flexDirection: isMobile && isEditing ? 'column' : 'row', gap: isMobile && isEditing ? 14 : 24, flexWrap: 'wrap' }}>
                  {/* Spalte 1 */}
                  <View style={isMobile && isEditing ? { width: '100%', gap: 14 } : { flex: 1, minWidth: 180, gap: 14 }}>
                    <View style={{ zIndex: 80, position: 'relative' }} {...({ dataSet: { tmClubDropdown: 'true' } } as any)}>
                      <Text style={styles.detailFieldLabel}>Verein</Text>
                      {isEditing ? renderClubSearchField('club', 'z.B. Hertha BSC II') : (
                        <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="club" displayValue={fullPlayer?.club} />
                      )}
                    </View>
                    <View style={{ zIndex: 78, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Liga</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="league" displayValue={fullPlayer?.league} />
                    </View>
                    {(isEditing || fullPlayer?.loan_from_club) ? (
                      <View style={{ zIndex: 75, position: 'relative' }} {...({ dataSet: { tmClubDropdown: 'true' } } as any)}>
                        <Text style={styles.detailFieldLabel}>Ausgeliehen von</Text>
                        {isEditing ? renderClubSearchField('loan_from_club', 'z.B. FC Ingolstadt 04') : (
                          <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="loan_from_club" displayValue={fullPlayer?.loan_from_club} />
                        )}
                      </View>
                    ) : null}
                    {(isEditing || fullPlayer?.loan_from_club_league) && (isEditing || fullPlayer?.loan_from_club) ? (
                      <View style={{ zIndex: 73, position: 'relative' }}>
                        <Text style={styles.detailFieldLabel}>Liga (Stammverein)</Text>
                        <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="loan_from_club_league" displayValue={fullPlayer?.loan_from_club_league} placeholder="z.B. 3. Liga" />
                      </View>
                    ) : null}
                    {(isEditing || fullPlayer?.future_club) ? (
                      <View style={{ zIndex: 70, position: 'relative' }} {...({ dataSet: { tmClubDropdown: 'true' } } as any)}>
                        <Text style={styles.detailFieldLabel}>Zukünftiger Verein</Text>
                        {isEditing ? renderClubSearchField('future_club', 'Name') : (
                          <Text style={styles.detailFieldValue}>{fullPlayer.future_club}</Text>
                        )}
                      </View>
                    ) : null}
                    <View style={{ zIndex: 50, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>U23-Spieler</Text>
                      {(() => {
                        const u23 = calculateU23Status(fullPlayer?.birth_date);
                        if (!u23.isU23) return <Text style={[styles.detailFieldValue, { color: '#ef4444' }]}>Nein</Text>;
                        return (
                          <Text style={[styles.detailFieldValue, { color: '#22c55e' }]}>
                            Ja <Text style={{ color: '#fff', fontWeight: '500' }}>— {u23.seasonsText}</Text>
                          </Text>
                        );
                      })()}
                    </View>
                    <View style={{ zIndex: 40, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Vertragsende</Text>
                      {isEditing ? (
                        <DateDropdown field="contract_end" dropdownKeyPrefix="contract_end" />
                      ) : (
                        <Text style={[styles.detailFieldValue, isContractInCurrentSeason(fullPlayer?.contract_end || '') && { color: '#ef4444' }]}>
                          {formatDate(fullPlayer?.contract_end)}
                        </Text>
                      )}
                    </View>
                    <View style={{ zIndex: 30, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Vertrag gilt für</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="contract_scope" displayValue={fullPlayer?.contract_scope} />
                    </View>
                    <View style={{ zIndex: 20, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Option</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="contract_option" displayValue={fullPlayer?.contract_option} />
                    </View>
                    <View style={{ zIndex: 10, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Fixe Ablöse</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="fixed_fee" displayValue={fullPlayer?.fixed_fee} />
                    </View>
                  </View>
                  {/* Spalte 2 */}
                  <View style={isMobile && isEditing ? { width: '100%', gap: 14 } : { flex: 1, minWidth: 180, gap: 14 }}>
                    <View>
                      <Text style={styles.detailFieldLabel}>Gehalt/Monat</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="salary_month" displayValue={fullPlayer?.salary_month} />
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Punktprämie</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="point_bonus" displayValue={fullPlayer?.point_bonus} />
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Auflaufprämie</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="appearance_bonus" displayValue={fullPlayer?.appearance_bonus} />
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Sonstiges</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="contract_notes" displayValue={fullPlayer?.contract_notes} multiline />
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Vertragsunterlagen</Text>
                      {(() => {
                        const docs = Array.isArray(fullPlayer?.contract_documents) ? fullPlayer.contract_documents : [];
                        if (docs.length === 0) return <Text style={styles.detailFieldValue}>-</Text>;
                        return docs.map((doc: any, i: number) => {
                          const name = typeof doc === 'string' ? doc : (doc?.name || doc?.file_name || `Dokument ${i + 1}`);
                          const url = typeof doc === 'string' ? doc : doc?.url;
                          return (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TouchableOpacity
                                onPress={() => { if (url && typeof window !== 'undefined') window.open(url, '_blank'); }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                              >
                                <Ionicons name="document-outline" size={12} color="rgba(255,255,255,0.7)" />
                                <Text style={[styles.detailListItem, { textDecorationLine: url ? 'underline' : 'none' }]}>{name}</Text>
                              </TouchableOpacity>
                              {isEditing ? (
                                <TouchableOpacity
                                  onPress={async () => {
                                    if (!fullPlayer?.id) return;
                                    const ok = await confirmDialog({
                                      title: 'Dokument löschen',
                                      message: `"${name}" wirklich löschen? Das Dokument wird aus der Vertragsunterlagen-Liste entfernt.`,
                                      danger: true,
                                      confirmLabel: 'Löschen',
                                    });
                                    if (!ok) return;
                                    const next = (fullPlayer.contract_documents || []).filter((_: any, idx: number) => idx !== i);
                                    const { error } = await supabase.from('player_details').update({ contract_documents: next }).eq('id', fullPlayer.id);
                                    if (error) {
                                      alertDialog({ title: 'Fehler beim Löschen', message: error.message });
                                      return;
                                    }
                                    setFullPlayer({ ...fullPlayer, contract_documents: next });
                                  }}
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  style={{ padding: 4 }}
                                >
                                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          );
                        });
                      })()}
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Spielplan</Text>
                      {isEditing ? (
                        <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="fussball_de_url" placeholder="https://www.fussball.de/..." />
                      ) : fullPlayer?.fussball_de_url ? (
                        <TouchableOpacity
                          onPress={() => { if (typeof window !== 'undefined') window.open(fullPlayer.fussball_de_url, '_blank'); }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' }}
                        >
                          <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.85)" />
                          <Text style={[styles.detailFieldValue, { fontSize: 12 }]}>fussball.de öffnen</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.detailFieldValue}>-</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* Mobile: Beratung VOR Kontaktdaten; Desktop: Reihenfolge wie im Source */}
              <View style={isMobile ? { display: 'flex', flexDirection: 'column-reverse', gap: 12, width: '100%', flexBasis: '100%' } : ({ display: 'contents' } as any)}>
              {/* Kontaktdaten — 2 Spalten */}
              <View style={[styles.detailCard, { position: 'relative', zIndex: 80 }, isMobile && { minWidth: 0, width: '100%', flexBasis: 'auto', flexGrow: 0, padding: 12 }]}>
                <Text style={styles.detailCardTitle}>Kontaktdaten</Text>
                <View style={{ flexDirection: isMobile && isEditing ? 'column' : 'row', gap: isMobile && isEditing ? 14 : 24, flexWrap: 'wrap' }}>
                  {/* Spalte 1: Telefon, E-Mail */}
                  <View style={isMobile && isEditing ? { width: '100%', gap: 14 } : { flex: 1, minWidth: 180, gap: 14 }}>
                    <View>
                      <Text style={styles.detailFieldLabel}>Telefon</Text>
                      {isEditing ? (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <View style={{ width: 70 }}>
                            <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="phone_country_code" placeholder="+49" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="phone" placeholder="Nummer" />
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.detailFieldValue}>
                          {fullPlayer?.phone ? `${fullPlayer.phone_country_code || ''} ${fullPlayer.phone}`.trim() : '-'}
                        </Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>E-Mail</Text>
                      {isEditing ? (
                        <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="email" placeholder="name@example.com" />
                      ) : fullPlayer?.email ? (
                        <TouchableOpacity onPress={() => { if (typeof window !== 'undefined') window.open(`mailto:${fullPlayer.email}`, '_blank'); }}>
                          <Text style={[styles.detailFieldValue, { textDecorationLine: 'underline' }]}>{fullPlayer.email}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.detailFieldValue}>-</Text>
                      )}
                    </View>
                  </View>
                  {/* Spalte 2: Adresse, Internat */}
                  <View style={isMobile && isEditing ? { width: '100%', gap: 14 } : { flex: 1, minWidth: 180, gap: 14 }}>
                    <View>
                      <Text style={styles.detailFieldLabel}>Adresse</Text>
                      {isEditing ? (
                        <>
                          <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="street" placeholder="Straße + Hausnummer" />
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                            <View style={{ width: 80 }}>
                              <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="postal_code" placeholder="PLZ" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="city" placeholder="Ort" />
                            </View>
                          </View>
                        </>
                      ) : (
                        <Text style={styles.detailFieldValue}>
                          {[fullPlayer?.street, [fullPlayer?.postal_code, fullPlayer?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '-'}
                        </Text>
                      )}
                    </View>
                    <View style={{ zIndex: 20, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Internat</Text>
                      {isEditing ? (
                        <>
                          <DetailDropdown
                            value={internatJa ? 'Ja' : ''}
                            options={['Ja', 'Nein']}
                            onChange={(v) => {
                              if (v === 'Ja') {
                                setInternatJa(true);
                              } else {
                                setInternatJa(false);
                                setEditData({ ...editData, internat: '' });
                              }
                            }}
                            placeholder="Auswählen"
                            dropdownKey="internat_choice"
                          />
                          {internatJa ? (
                            <View style={{ marginTop: 6 }}>
                              <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="internat" placeholder="Adresse des Internats" multiline />
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <Text style={styles.detailFieldValue}>
                          {fullPlayer?.internat ? `Ja — ${fullPlayer.internat}` : 'Nein'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* Beratung — 2 Spalten */}
              <View style={[styles.detailCard, { position: 'relative', zIndex: 70 }, isMobile && { minWidth: 0, width: '100%', flexBasis: 'auto', flexGrow: 0, padding: 12 }]}>
                <Text style={styles.detailCardTitle}>Beratung</Text>
                <View style={{ flexDirection: isMobile && isEditing ? 'column' : 'row', gap: isMobile && isEditing ? 14 : 24, flexWrap: 'wrap' }}>
                  {/* Spalte 1: Listung, Zuständigkeit, Mandat gültig bis */}
                  <View style={isMobile && isEditing ? { width: '100%', gap: 14 } : { flex: 1, minWidth: 180, gap: 14 }}>
                    <View style={{ zIndex: 30, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Listung</Text>
                      {isEditing ? (
                        <DetailDropdown
                          value={editData.listing || ''}
                          options={LISTINGS}
                          onChange={(v) => setEditData({ ...editData, listing: v })}
                          placeholder="Auswählen"
                          dropdownKey="listing"
                          minWidth={260}
                        />
                      ) : (
                        <Text style={styles.detailFieldValue}>{formatListing(fullPlayer?.listing)}</Text>
                      )}
                    </View>
                    <View style={{ zIndex: 20, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Zuständigkeit</Text>
                      {isEditing ? (
                        <MultiSelectDropdown
                          values={(editData.responsibility || '').split(',').map((s: string) => s.trim()).filter(Boolean)}
                          options={advisors.map(a => `${a.first_name} ${a.last_name}`.trim()).filter(Boolean)}
                          onChange={(arr) => setEditData({ ...editData, responsibility: arr.join(', ') })}
                          placeholder="Auswählen"
                          dropdownKey="responsibility"
                        />
                      ) : (() => {
                        const items: string[] = typeof fullPlayer?.responsibility === 'string'
                          ? fullPlayer.responsibility.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
                          : [];
                        return items.length === 0 ? (
                          <Text style={styles.detailFieldValue}>-</Text>
                        ) : items.map((name, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="chevron-forward-outline" size={10} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.detailListItem}>{name}</Text>
                          </View>
                        ));
                      })()}
                    </View>
                    <View style={{ zIndex: 10, position: 'relative' }}>
                      <Text style={styles.detailFieldLabel}>Mandat gültig bis</Text>
                      {isEditing ? (
                        <DateDropdown field="mandate_until" dropdownKeyPrefix="mandate_until" />
                      ) : (
                        <Text style={styles.detailFieldValue}>{formatDate(fullPlayer?.mandate_until)}</Text>
                      )}
                    </View>
                  </View>
                  {/* Spalte 2: Provision, Weg-Vermittlung */}
                  <View style={isMobile && isEditing ? { width: '100%', gap: 14 } : { flex: 1, minWidth: 180, gap: 14 }}>
                    <View>
                      <Text style={styles.detailFieldLabel}>Provision</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="provision" displayValue={fullPlayer?.provision} />
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Weg-Vermittlung</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="transfer_commission" displayValue={fullPlayer?.transfer_commission} />
                    </View>
                  </View>
                </View>
              </View>
              </View>

              {/* Familie — 3 Spalten (Papa | Mama | Geschwister) */}
              <View style={[styles.detailCard, { position: 'relative', zIndex: 60 }, isMobile && { minWidth: 0, flexBasis: '100%', padding: 12 }]}>
                <Text style={styles.detailCardTitle}>Familie</Text>
                <View style={{ flexDirection: isMobile && isEditing ? 'column' : 'row', gap: isMobile && isEditing ? 14 : 24, flexWrap: 'wrap' }}>
                  {/* Spalte 1: Papa */}
                  <View style={isMobile && isEditing ? { width: '100%', gap: 14 } : { flex: 1, minWidth: 160, gap: 14 }}>
                    <View>
                      <Text style={styles.detailFieldLabel}>Papa</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="father_name" displayValue={fullPlayer?.father_name} />
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Telefon</Text>
                      {isEditing ? (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <View style={{ width: 60 }}>
                            <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="father_phone_country_code" placeholder="+49" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="father_phone" placeholder="Nummer" />
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.detailFieldValue}>
                          {fullPlayer?.father_phone ? `${fullPlayer.father_phone_country_code || ''} ${fullPlayer.father_phone}`.trim() : '-'}
                        </Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Job</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="father_job" displayValue={fullPlayer?.father_job} />
                    </View>
                  </View>

                  {/* Spalte 2: Mama */}
                  <View style={isMobile && isEditing ? { width: '100%', gap: 14 } : { flex: 1, minWidth: 160, gap: 14 }}>
                    <View>
                      <Text style={styles.detailFieldLabel}>Mama</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="mother_name" displayValue={fullPlayer?.mother_name} />
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Telefon</Text>
                      {isEditing ? (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <View style={{ width: 60 }}>
                            <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="mother_phone_country_code" placeholder="+49" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="mother_phone" placeholder="Nummer" />
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.detailFieldValue}>
                          {fullPlayer?.mother_phone ? `${fullPlayer.mother_phone_country_code || ''} ${fullPlayer.mother_phone}`.trim() : '-'}
                        </Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.detailFieldLabel}>Job</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="mother_job" displayValue={fullPlayer?.mother_job} />
                    </View>
                  </View>

                  {/* Spalte 3: Geschwister */}
                  <View style={isMobile && isEditing ? { width: '100%', gap: 14 } : { flex: 1, minWidth: 160, gap: 14 }}>
                    <View>
                      <Text style={styles.detailFieldLabel}>Geschwister</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="siblings" displayValue={fullPlayer?.siblings} multiline />
                    </View>
                  </View>
                </View>
              </View>

              {/* Sonstiges */}
              <View style={[styles.detailCard, { position: 'relative', zIndex: 50 }, isMobile && { minWidth: 0, flexBasis: '100%', padding: 12 }]}>
                <Text style={styles.detailCardTitle}>Sonstiges</Text>
                <View style={{ gap: 14 }}>
                  <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                    <View style={isMobile && isEditing ? { width: '100%' } : { flex: 1, minWidth: 120 }}>
                      <Text style={styles.detailFieldLabel}>Instagram</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="instagram" displayValue={fullPlayer?.instagram} />
                    </View>
                    <View style={isMobile && isEditing ? { width: '100%' } : { flex: 1, minWidth: 120 }}>
                      <Text style={styles.detailFieldLabel}>TikTok</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="tiktok" displayValue={fullPlayer?.tiktok} />
                    </View>
                    <View style={isMobile && isEditing ? { width: '100%' } : { flex: 1, minWidth: 120 }}>
                      <Text style={styles.detailFieldLabel}>LinkedIn</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="linkedin" displayValue={fullPlayer?.linkedin} />
                    </View>
                  </View>
                  <View>
                    <Text style={styles.detailFieldLabel}>Weitere Informationen</Text>
                    {/* Im Read-Mode: zeigt Spieler-Beitrag wenn vorhanden + "VOM SPIELER"-Pille,
                        sonst Berater-Wert (`interests`). Im Edit-Mode: Berater editiert `interests`. */}
                    <EditableValue
                      editData={editData}
                      setEditData={setEditData}
                      isEditing={isEditing}
                      fullPlayer={fullPlayer}
                      field="interests"
                      displayValue={fullPlayer?.interests}
                      playerValue={fullPlayer?.additional_info_player}
                      multiline
                    />
                  </View>
                  {(isEditing || fullPlayer?.other_notes) ? (
                    <View>
                      <Text style={styles.detailFieldLabel}>Beraterfeld — eigene Notizen zum Spieler</Text>
                      <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="other_notes" displayValue={fullPlayer?.other_notes} multiline />
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Ausbildung — 3 Spalten */}
              <View style={[styles.detailCard, { position: 'relative', zIndex: 40 }, isMobile && { minWidth: 0, flexBasis: '100%', padding: 12 }]}>
                <Text style={styles.detailCardTitle}>Ausbildung</Text>
                <View style={{ flexDirection: isMobile && isEditing ? 'column' : 'row', gap: isMobile && isEditing ? 14 : 24, flexWrap: 'wrap' }}>
                  <View style={isMobile && isEditing ? { width: '100%' } : { flex: 1, minWidth: 140 }}>
                    <Text style={styles.detailFieldLabel}>Schulabschluss</Text>
                    <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="education" displayValue={fullPlayer?.education} />
                  </View>
                  <View style={isMobile && isEditing ? { width: '100%' } : { flex: 1, minWidth: 140 }}>
                    <Text style={styles.detailFieldLabel}>Ausbildung/Studium</Text>
                    <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="training" displayValue={fullPlayer?.training} />
                  </View>
                  <View style={isMobile && isEditing ? { width: '100%' } : { flex: 1, minWidth: 140 }}>
                    <Text style={styles.detailFieldLabel}>Job</Text>
                    <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="job" displayValue={fullPlayer?.job} />
                  </View>
                </View>
              </View>

              {/* Verletzungen & Krankheiten */}
              <View style={[styles.detailCard, { position: 'relative', zIndex: 30 }, isMobile && { minWidth: 0, flexBasis: '100%', padding: 12 }]}>
                <Text style={styles.detailCardTitle}>Verletzungen & Krankheiten</Text>
                <View>
                  <Text style={styles.detailFieldLabel}>Historie</Text>
                  <EditableValue editData={editData} setEditData={setEditData} isEditing={isEditing} fullPlayer={fullPlayer} field="injuries" displayValue={fullPlayer?.injuries} multiline />
                </View>
              </View>

            </View>
          )}

        </ScrollView>

        {/* Invite-Code Overlay — als Geschwister der ScrollView, damit es am Viewport
            (Modal-Höhe) zentriert wird und nicht innerhalb des langen Scroll-Inhalts. */}
        {showInviteCodeModal ? (
          <View style={styles.detailInviteOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setShowInviteCodeModal(false); setInviteCode(null); }} />
            <View style={styles.detailInviteCodeBox}>
              <Text style={styles.detailInviteCodeTitle}>Einladungs-Code</Text>
              <Text style={styles.detailInviteCodeSubtitle}>
                Gib diesen Code an {selectedPlayer?.first_name} {selectedPlayer?.last_name} weiter
              </Text>
              <View style={styles.detailInviteCodePill}>
                <Text style={styles.detailInviteCodeText}>{inviteCode || '—'}</Text>
              </View>
              <Text style={styles.detailInviteCodeHint}>Gültig bis zur Registrierung</Text>
              <TouchableOpacity
                style={styles.detailInviteCodeCloseBtn}
                onPress={() => { setShowInviteCodeModal(false); setInviteCode(null); }}
              >
                <Text style={styles.detailInviteCodeCloseText}>Schließen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        </View>

        {/* PDF Vorschau-Overlay (innerhalb Spielerprofil-Modal, damit es darüberliegt) */}
        {showPdfPreview && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: isMobile ? 'flex-end' : 'center', alignItems: isMobile ? 'stretch' : 'center', padding: isMobile ? 0 : 20, zIndex: 9999 }}>
            <View style={[
              { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
              isMobile
                ? { width: '100%', maxHeight: '98%', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomWidth: 0 }
                : { width: '98%', maxWidth: 900, maxHeight: '98%', borderRadius: 16 }
            ]}>
              <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 }} resizeMode="cover" />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)', zIndex: 2, gap: 8 }}>
                <Text style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', flex: 1 }} numberOfLines={1}>CV</Text>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', opacity: pdfGenerating ? 0.5 : 1 }}
                  onPress={handleEditPdf}
                  disabled={pdfGenerating}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' }}>Bearbeiten</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', opacity: (pdfGenerating || !pdfPreviewUrl) ? 0.5 : 1, alignItems: 'center', justifyContent: 'center' }}
                  onPress={handlePdfDownload}
                  disabled={pdfGenerating || !pdfPreviewUrl}
                  accessibilityLabel="Als PDF downloaden"
                >
                  <Ionicons name="download-outline" size={14} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClosePdfPreview} style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, lineHeight: 22 }}>✕</Text>
                </TouchableOpacity>
              </View>
              {Platform.OS === 'web' ? (
                <div style={{ flexShrink: 1, overflow: 'auto', paddingLeft: 16, paddingRight: 16, paddingTop: 32, paddingBottom: 16, position: 'relative', zIndex: 2 }}>
                  {pdfGenerating || !pdfPreviewUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'rgba(255,255,255,0.85)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>PDF wird generiert...</span>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  ) : (
                    <iframe
                      src={pdfPreviewUrl}
                      style={{ border: 'none', width: '100%', aspectRatio: 0.75, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)', display: 'block' }}
                    />
                  )}
                </div>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 2 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>PDF-Vorschau nur auf Web verfügbar.</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );

  // Mobile View
  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: 'transparent' }]}>
        <AdvisorBackground />
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="players"
          profile={profile}
        />

        <View style={[styles.mainContentMobile, { backgroundColor: 'transparent' }]}>
          {/* Mobile Header (Hero-Card-Stil wie Desktop) */}
          <MobileHeader
            title="KMH-Spieler"
            subtitle={`${filteredPlayers.length} aktive Profile`}
            backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
            backgroundImageOpacity={0.45}
            onMenuPress={() => setShowMobileSidebar(true)}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 6, paddingHorizontal: 10, height: 28 }}>
              <Ionicons name="search" size={12} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={{ flex: 1, paddingVertical: 0, fontSize: 12, color: '#fff', marginLeft: 6 }}
                placeholder="Spieler suchen..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
            <TouchableOpacity
              style={[
                { width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
                activeFilterCount > 0 && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setShowMobileFilters(true)}
            >
              <Ionicons name="filter" size={14} color={activeFilterCount > 0 ? colors.primaryText : 'rgba(255,255,255,0.85)'} />
              {activeFilterCount > 0 && (
                <View style={styles.filterCountBubble}>
                  <Text style={styles.filterCountText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </MobileHeader>

          {/* Player Cards */}
          <ScrollView
            ref={scrollRef}
            style={styles.mobileCardList}
            contentContainerStyle={styles.mobileCardListContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onScroll={(e: any) => { savedScrollY.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={100}
            onLayout={() => { if (savedScrollY.current > 0 && scrollRef.current?.scrollTo) { scrollRef.current.scrollTo({ y: savedScrollY.current, animated: false }); } }}
          >
            {(authLoading || loading) ? (
              <Text style={styles.loadingText}>Laden...</Text>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => fetchPlayers()}>
                  <Text style={styles.retryButtonText}>Erneut versuchen</Text>
                </TouchableOpacity>
              </View>
            ) : filteredPlayers.length === 0 ? (
              <Text style={styles.emptyText}>Keine Spieler gefunden</Text>
            ) : (
              filteredPlayers.map(player => renderPlayerCard(player))
            )}
          </ScrollView>

          {/* FAB Button */}
          <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowAddModal(true)}>
            <Text style={[styles.fabText, { color: colors.primaryText }]}>+</Text>
          </TouchableOpacity>

          {/* Mobile Filter Modal */}
          <Modal visible={showMobileFilters} transparent animationType="slide">
            <View style={styles.mobileFilterModal}>
              <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[StyleSheet.absoluteFillObject, { opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center' } as any) }]} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />

              <View style={styles.mobileFilterHeader}>
                <Text style={styles.mobileFilterTitle}>Filter</Text>
                <TouchableOpacity onPress={() => setShowMobileFilters(false)} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.mobileFilterContent} contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={{ zIndex: 60, position: 'relative', maxWidth: 280 }}>
                  <Text style={styles.mobileFilterLabel}>Position</Text>
                  <MultiSelectDropdown
                    values={selectedPositions.map(p => POSITION_SHORT[p] || p)}
                    options={POSITIONS.map(p => POSITION_SHORT[p] || p)}
                    onChange={(arr) => {
                      const longs = arr.map(short => POSITIONS.find(p => POSITION_SHORT[p] === short) || short);
                      setSelectedPositions(longs);
                    }}
                    placeholder="Position auswählen"
                    dropdownKey="filter_position"
                  />
                </View>

                <View style={{ zIndex: 50, position: 'relative', marginTop: 14, maxWidth: 280 }}>
                  <Text style={styles.mobileFilterLabel}>Jahrgang</Text>
                  <MultiSelectDropdown
                    values={selectedYears}
                    options={availableYears.map(String)}
                    onChange={(arr) => setSelectedYears(arr)}
                    placeholder="Jahrgang auswählen"
                    dropdownKey="filter_year"
                  />
                </View>

                <View style={{ zIndex: 40, position: 'relative', marginTop: 14, maxWidth: 280 }}>
                  <Text style={styles.mobileFilterLabel}>Listung</Text>
                  <MultiSelectDropdown
                    values={selectedListings.map(l => l === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM')}
                    options={LISTINGS.map(l => l === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM')}
                    onChange={(arr) => {
                      const longs = arr.map(short => short === 'KMH' ? 'Karl Herzog Sportmanagement' : 'PM Sportmanagement');
                      setSelectedListings(longs);
                    }}
                    placeholder="Listung auswählen"
                    dropdownKey="filter_listing"
                  />
                </View>

                <View style={{ zIndex: 30, position: 'relative', marginTop: 14, maxWidth: 280 }}>
                  <Text style={styles.mobileFilterLabel}>Zuständigkeit</Text>
                  <MultiSelectDropdown
                    values={selectedResponsibilities}
                    options={advisors.map(a => `${a.first_name} ${a.last_name}`.trim()).filter(Boolean)}
                    onChange={(arr) => setSelectedResponsibilities(arr)}
                    placeholder="Berater auswählen"
                    dropdownKey="filter_responsibility"
                  />
                </View>

                <View style={{ zIndex: 20, position: 'relative', marginTop: 14, maxWidth: 280 }}>
                  <Text style={styles.mobileFilterLabel}>Vertragsende</Text>
                  <MultiSelectDropdown
                    values={selectedContractYears}
                    options={contractYearOptions.map(String)}
                    onChange={(arr) => setSelectedContractYears(arr)}
                    placeholder="Jahr auswählen"
                    dropdownKey="filter_contract_year"
                  />
                </View>
              </ScrollView>

              <View style={styles.mobileFilterFooter}>
                <TouchableOpacity
                  style={styles.mobileFilterClearButton}
                  onPress={() => {
                    clearPositions();
                    clearYears();
                    clearListings();
                    clearResponsibilities();
                    clearContractYears();
                  }}
                >
                  <Text style={styles.mobileFilterClearText}>Alle löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mobileFilterApplyButton} onPress={() => setShowMobileFilters(false)}>
                  <Text style={styles.mobileFilterApplyText}>Anwenden ({filteredPlayers.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Add Player Modal — analog Desktop */}
          <Modal visible={showAddModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { overflow: 'visible', backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', maxHeight: '90%', width: '92%', maxWidth: 540, padding: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.7, shadowRadius: 30, elevation: 24 }]}>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, overflow: 'hidden' }} pointerEvents="none">
                  <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any) }} resizeMode="cover" />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
                </View>
                <View style={{ padding: 24, zIndex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, position: 'relative' }}>
                    <Text style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Neuen Spieler anlegen</Text>
                    <TouchableOpacity onPress={() => { setShowAddModal(false); setTmSuggestions([]); setTmSelected(null); setNewFirstName(''); setNewLastName(''); }} style={{ position: 'absolute', right: 0, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Nachname</Text>
                      <TextInput
                        style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: '#fff' }}
                        placeholder="z.B. Mustermann" placeholderTextColor="rgba(255,255,255,0.3)"
                        value={newLastName} onChangeText={handleLastNameChange} autoFocus
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Vorname</Text>
                      <TextInput
                        style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: '#fff' }}
                        placeholder="z.B. Maximilian" placeholderTextColor="rgba(255,255,255,0.3)"
                        value={newFirstName} onChangeText={handleFirstNameChange}
                      />
                    </View>
                  </View>
                  {tmSearching && <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>Suche auf Transfermarkt...</Text>}
                  {tmSuggestions.length > 0 && (
                    <ScrollView style={{ maxHeight: 240, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, marginBottom: 8, backgroundColor: '#1a1a1a' }}>
                      {tmSuggestions.map((s, i) => (
                        <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: i < tmSuggestions.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => selectTmPlayer(s)}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{s.name}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginLeft: 6 }}>{[s.verein, s.position, s.age ? s.age + 'J' : ''].filter(Boolean).join(' · ')}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  {tmLoading && <Text style={{ color: '#22c55e', fontSize: 11, marginBottom: 6 }}>Lade Spielerdaten von Transfermarkt...</Text>}
                  {tmSelected && (
                    <View style={{ backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 6, padding: 8, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>
                      <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600', marginBottom: 3 }}>Transfermarkt-Daten übernommen</Text>
                      <Text style={{ fontSize: 12 }} numberOfLines={1}><Text style={{ color: '#fff', fontWeight: '600' }}>{newFirstName} {newLastName}</Text>{'  '}<Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{[tmSelected.verein, tmSelected.tmPosition, tmSelected.tmAge ? tmSelected.tmAge + 'J' : ''].filter(Boolean).join(' · ')}</Text>
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Zuständigkeit: {currentUserName || 'Sie'}</Text>
                    <TouchableOpacity style={{ backgroundColor: '#22c55e', borderWidth: 1, borderColor: '#22c55e', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, opacity: tmLoading ? 0.5 : 1 }} onPress={handleAddPlayer} disabled={tmLoading}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{tmLoading ? 'Laden...' : 'Spieler anlegen'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>

          {/* Invitation Code Success Modal */}
          <Modal visible={showCodeModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface, maxWidth: 400, width: '90%', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 }]}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="checkmark" size={28} color="#10b981" />
                </View>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Spieler erstellt!</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>{createdPlayerName}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>Persönlicher Einladungscode:</Text>
                <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, marginBottom: 10, alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', fontFamily: Platform.OS === 'web' ? "'SF Mono', 'Fira Code', 'Courier New', monospace" : undefined, letterSpacing: 3 }}>{createdPlayerCode}</Text>
                </View>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)', marginBottom: 12 }}
                  onPress={() => {
                    if (createdPlayerCode) {
                      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(createdPlayerCode);
                      }
                    }
                  }}
                >
                  <Ionicons name="copy-outline" size={14} color="#10b981" />
                  <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Code kopieren</Text>
                </TouchableOpacity>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 20 }}>Gültig bis zur Registrierung</Text>
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 32 }}
                  onPress={() => { setShowCodeModal(false); setCreatedPlayerCode(null); setCreatedPlayerName(''); }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Schließen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Request Access Modal */}
          <Modal visible={showRequestModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Zuständigkeit beantragen</Text>
                <Text style={[styles.modalText, { color: colors.text }]}>
                  Sie haben keinen Zugriff auf das Profil von{'\n'}
                  <Text style={styles.modalPlayerName}>{selectedPlayer?.first_name} {selectedPlayer?.last_name}</Text>
                </Text>
                <Text style={[styles.modalSubText, { color: colors.textSecondary }]}>
                  Möchten Sie die Zuständigkeit beantragen?{'\n'}Ein Admin wird Ihre Anfrage prüfen.
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalCancelButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => { setShowRequestModal(false); setSelectedPlayer(null); }}>
                    <Text style={[styles.modalCancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalSaveButton, { backgroundColor: colors.surface }]} onPress={handleRequestAccess}>
                    <Text style={styles.modalSaveButtonText}>Ja, beantragen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {playerDetailModalJsx}
        </View>
      </View>
    );
  }

  // Desktop View
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Sidebar / Mobile Header */}
      <AdvisorBackground />
      <Sidebar navigation={navigation} activeScreen="players" profile={profile} />

      {/* Main Content */}
      <View style={[styles.mainContent, { backgroundColor: 'transparent' }]}>
        {/* Hero-Card im Spieler-Header-Stil */}
        <View style={styles.heroCard}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, overflow: 'hidden' }} pointerEvents="none">
            <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 }} resizeMode="cover" />
          </View>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.heroScreenLabel}>KMH-SPIELER</Text>
              <Text style={styles.heroScreenSubLabel}>{players.length} AKTIVE PROFILE</Text>
            </View>
          </View>
          <View style={styles.heroDivider} />

          {/* Toolbar als Bottom-Row im Hero */}
          <Pressable style={styles.heroToolbar} onPress={closeAllDropdowns}>
          <TouchableOpacity style={{ height: 28, paddingVertical: 0, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' }} onPress={() => navigation.navigate('AdvisorDashboard')}><Ionicons name="arrow-back" size={13} color={colors.textSecondary} /></TouchableOpacity>
          <View style={[styles.searchContainer, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)', height: 28, borderRadius: 6, paddingVertical: 0 }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput style={[styles.searchInput, { color: colors.text, paddingVertical: 0 }]} placeholder="Spieler, Verein suchen..." placeholderTextColor={colors.textMuted} value={searchText} onChangeText={setSearchText} onFocus={closeAllDropdowns} />
          </View>
          
          <View style={styles.filterContainer}>
            {/* Position Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 50 }]} {...({ dataSet: { filterDropdown: 'true' } } as any)}>
              <TouchableOpacity
                style={[styles.filterButton, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)' }, selectedPositions.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowPositionDropdown(!showPositionDropdown); }}
              >
                <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedPositions.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>{getPositionFilterLabel()} ▼</Text>
              </TouchableOpacity>
              {showPositionDropdown && (
                <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.filterDropdownHeader}>
                    <Text style={styles.filterDropdownTitle}>Positionen wählen</Text>
                    {selectedPositions.length > 0 && <TouchableOpacity onPress={clearPositions}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {POSITIONS.map(pos => {
                      const isSelected = selectedPositions.includes(pos);
                      const count = players.filter(p => p.position?.includes(pos)).length;
                      return (
                        <TouchableOpacity key={pos} style={styles.filterCheckboxItem} onPress={() => togglePosition(pos)}>
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                          <Text style={styles.filterCheckboxText}>{POSITION_SHORT[pos]}</Text>
                          <Text style={styles.filterCountBadge}>{count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowPositionDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </Pressable>
              )}
            </View>

            {/* Jahrgang Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 40 }]} {...({ dataSet: { filterDropdown: 'true' } } as any)}>
              <TouchableOpacity
                style={[styles.filterButton, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)' }, selectedYears.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowYearDropdown(!showYearDropdown); }}
              >
                <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedYears.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>{getYearFilterLabel()} ▼</Text>
              </TouchableOpacity>
              {showYearDropdown && (
                <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.filterDropdownHeader}>
                    <Text style={styles.filterDropdownTitle}>Jahrgänge wählen</Text>
                    {selectedYears.length > 0 && <TouchableOpacity onPress={clearYears}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availableYears.map(year => {
                      const isSelected = selectedYears.includes(year);
                      const count = players.filter(p => getYearFromDate(p.birth_date) === year).length;
                      return (
                        <TouchableOpacity key={year} style={styles.filterCheckboxItem} onPress={() => toggleYear(year)}>
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                          <Text style={styles.filterCheckboxText}>Jg. {year}</Text>
                          <Text style={styles.filterCountBadge}>{count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowYearDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </Pressable>
              )}
            </View>

            {/* Listung Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 30 }]} {...({ dataSet: { filterDropdown: 'true' } } as any)}>
              <TouchableOpacity
                style={[styles.filterButton, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)' }, selectedListings.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowListingDropdown(!showListingDropdown); }}
              >
                <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedListings.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>{getListingFilterLabel()} ▼</Text>
              </TouchableOpacity>
              {showListingDropdown && (
                <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.filterDropdownHeader}>
                    <Text style={styles.filterDropdownTitle}>Listung wählen</Text>
                    {selectedListings.length > 0 && <TouchableOpacity onPress={clearListings}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {LISTINGS.map(listing => {
                      const isSelected = selectedListings.includes(listing);
                      const count = players.filter(p => p.listing === listing).length;
                      return (
                        <TouchableOpacity key={listing} style={styles.filterCheckboxItem} onPress={() => toggleListing(listing)}>
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                          <Text style={styles.filterCheckboxText}>{listing === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM'}</Text>
                          <Text style={styles.filterCountBadge}>{count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowListingDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </Pressable>
              )}
            </View>

            {/* Zuständigkeit Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 20 }]} {...({ dataSet: { filterDropdown: 'true' } } as any)}>
              <TouchableOpacity
                style={[styles.filterButton, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)' }, selectedResponsibilities.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowResponsibilityDropdown(!showResponsibilityDropdown); }}
              >
                <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedResponsibilities.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>{getResponsibilityFilterLabel()} ▼</Text>
              </TouchableOpacity>
              {showResponsibilityDropdown && (
                <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.filterDropdownHeader}>
                    <Text style={styles.filterDropdownTitle}>Zuständigkeit wählen</Text>
                    {selectedResponsibilities.length > 0 && <TouchableOpacity onPress={clearResponsibilities}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {advisors.map(advisor => {
                      const name = `${advisor.first_name} ${advisor.last_name}`.trim();
                      const lastName = advisor.last_name || '';
                      const isSelected = selectedResponsibilities.includes(name);
                      const count = players.filter(p => p.responsibility?.includes(name) || p.responsibility?.includes(lastName)).length;
                      return (
                        <TouchableOpacity key={advisor.id} style={styles.filterCheckboxItem} onPress={() => toggleResponsibility(name)}>
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                          <Text style={styles.filterCheckboxText}>{name}</Text>
                          <Text style={styles.filterCountBadge}>{count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowResponsibilityDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </Pressable>
              )}
            </View>

            {/* Vertragsende Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 10 }]} {...({ dataSet: { filterDropdown: 'true' } } as any)}>
              <TouchableOpacity
                style={[styles.filterButton, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)' }, selectedContractYears.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowContractDropdown(!showContractDropdown); }}
              >
                <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedContractYears.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>{getContractFilterLabel()} ▼</Text>
              </TouchableOpacity>
              {showContractDropdown && (
                <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.filterDropdownHeader}>
                    <Text style={styles.filterDropdownTitle}>Vertragsende wählen</Text>
                    {selectedContractYears.length > 0 && <TouchableOpacity onPress={clearContractYears}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {contractYearOptions.map(year => {
                      const isSelected = selectedContractYears.includes(year);
                      const count = players.filter(p => p.contract_end && new Date(p.contract_end).getFullYear().toString() === year).length;
                      return (
                        <TouchableOpacity key={year} style={styles.filterCheckboxItem} onPress={() => toggleContractYear(year)}>
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                          <Text style={styles.filterCheckboxText}>{year}</Text>
                          <Text style={styles.filterCountBadge}>{count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowContractDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </Pressable>
              )}
            </View>
          </View>
          
          <TouchableOpacity style={[styles.filterButton, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)' }]} onPress={() => setShowAddModal(true)}><Ionicons name="person-add-outline" size={12} color={colors.textSecondary} /></TouchableOpacity>
          </Pressable>
        </View>

        {/* Dropdown Overlay - schließt alle Dropdowns beim Klicken */}
        {isAnyDropdownOpen && (
          <Pressable style={styles.dropdownOverlay} onPress={closeAllDropdowns} />
        )}

        <View style={styles.content}>
          <View style={[styles.tableWrapper, { backgroundColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.15)' }]} onLayout={(e) => setTableWidth(e.nativeEvent.layout.width - 32)}>
            {tableWidth > 0 && (
              <TableHeader
                columnDefs={PLAYER_COLUMNS}
                backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
                columnOrder={table.columnOrder}
                getColumnWidth={table.getColumnWidth}
                onResizeStart={table.onResizeStart}
                onDragStart={table.onDragStart}
                resizingKey={table.resizingKey}
                draggingKey={table.draggingKey}
                dragOverKey={table.dragOverKey}
                onSort={(key) => handleSort(key as SortField)}
                sortKey={sortField}
                sortAsc={sortDirection === 'asc'}
                colors={colors}
                setHeaderRef={table.setHeaderRef}
                style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16 }}
              />
            )}

            <ScrollView
              ref={scrollRef}
              style={styles.tableBody}
              onScroll={(e: any) => { saveScrollY(e.nativeEvent.contentOffset.y); }}
              scrollEventThrottle={100}
            >
              {(authLoading || loading) ? (
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Laden...</Text>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={fetchPlayers}>
                    <Text style={styles.retryButtonText}>Erneut versuchen</Text>
                  </TouchableOpacity>
                </View>
              ) : filteredPlayers.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Spieler gefunden</Text>
              ) : (
                filteredPlayers.map((player) => {
                  const hasAccess = hasAccessToPlayer(player.id);
                  const birthday = isBirthday(player.birth_date);
                  const positionDisplay = player.position
                    ? player.position.split(', ').map(p => POSITION_SHORT[p.trim()] || p).join(', ')
                    : '-';
                  return (
                    <TableRow
                      key={player.id}
                      columnOrder={table.columnOrder}
                      getColumnWidth={table.getColumnWidth}
                      onPress={() => handlePlayerClick(player)}
                      style={[
                        { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
                        !hasAccess && { backgroundColor: colors.surfaceSecondary },
                        birthday && styles.birthdayRow,
                      ]}
                      renderCell={(key) => {
                        switch (key) {
                          case 'name':
                            return (
                              <View style={styles.nameContainer}>
                                {!hasAccess && <Text style={styles.lockIcon}>🔒 </Text>}
                                <Text style={[styles.tableCell, styles.nameCell, { color: colors.text }]} numberOfLines={1}>
                                  {player.last_name}{birthday && ' 🎉'}
                                </Text>
                              </View>
                            );
                          case 'vorname':
                            return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{player.first_name || '-'}</Text>;
                          case 'birth_date':
                            return (
                              <View style={styles.birthDateCell}>
                                <Text style={[styles.tableCell, { color: colors.text }]}>{formatDate(player.birth_date)}</Text>
                              </View>
                            );
                          case 'position':
                            return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{positionDisplay}</Text>;
                          case 'club': {
                            const expired = isContractExpired(player.contract_end);
                            const displayClub = getDisplayClub(player);
                            const logoUrl = expired ? null : getClubLogo(player.club);
                            return (
                              <View style={styles.clubCell}>
                                {expired ? <Image source={ArbeitsamtIcon} style={styles.clubLogo} /> : logoUrl ? <Image source={{ uri: logoUrl }} style={styles.clubLogo} /> : null}
                                <Text style={[styles.tableCell, { color: colors.text }, expired && styles.clubTextRed]} numberOfLines={1}>{displayClub}</Text>
                              </View>
                            );
                          }
                          case 'league':
                            return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{player.league || '-'}</Text>;
                          case 'contract_end': {
                            const inCurrentSeason = isContractInCurrentSeason(player.contract_end);
                            const hasSecuredFuture = hasFutureClubAndExpiringContract(player);
                            const textColor = hasSecuredFuture ? '#22c55e' : (inCurrentSeason && player.contract_end ? '#ef4444' : colors.text);
                            return <Text style={[styles.tableCell, { color: textColor }]}>{formatDate(player.contract_end)}</Text>;
                          }
                          case 'listing':
                            return renderListingBadge(player.listing);
                          case 'responsibility':
                            return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{getResponsibilityInitials(player.responsibility)}</Text>;
                          default:
                            return null;
                        }
                      }}
                    />
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>

        {/* Add Player Modal — KMH-Skill Style: schwarzer BG mit scouting-header BG-Image */}
        <Modal visible={showAddModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { overflow: 'visible', backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', maxHeight: '90%', width: '92%', maxWidth: 540, padding: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.7, shadowRadius: 30, elevation: 24 }]}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, overflow: 'hidden' }} pointerEvents="none">
                <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any) }} resizeMode="cover" />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
              </View>
              <View style={{ padding: 24, zIndex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, position: 'relative' }}>
                  <Text style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Neuen Spieler anlegen</Text>
                  <TouchableOpacity onPress={() => { setShowAddModal(false); setTmSuggestions([]); setTmSelected(null); setNewFirstName(''); setNewLastName(''); }} style={{ position: 'absolute', right: 0, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Nachname</Text>
                    <TextInput
                      style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: '#fff' }}
                      placeholder="z.B. Mustermann" placeholderTextColor="rgba(255,255,255,0.3)"
                      value={newLastName} onChangeText={handleLastNameChange} autoFocus
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Vorname</Text>
                    <TextInput
                      style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: '#fff' }}
                      placeholder="z.B. Maximilian" placeholderTextColor="rgba(255,255,255,0.3)"
                      value={newFirstName} onChangeText={handleFirstNameChange}
                    />
                  </View>
                </View>
                {tmSearching && <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>Suche auf Transfermarkt...</Text>}
                {tmSuggestions.length > 0 && (
                  <ScrollView style={{ maxHeight: 280, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, marginBottom: 8, backgroundColor: '#1a1a1a' }}>
                    {tmSuggestions.map((s, i) => (
                      <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: i < tmSuggestions.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => selectTmPlayer(s)}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{s.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginLeft: 6 }}>{[s.verein, s.position, s.age ? s.age + 'J' : ''].filter(Boolean).join(' · ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {tmLoading && <Text style={{ color: '#22c55e', fontSize: 11, marginBottom: 6 }}>Lade Spielerdaten von Transfermarkt...</Text>}
                {tmSelected && (
                  <View style={{ backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 6, padding: 8, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>
                    <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600', marginBottom: 3 }}>Transfermarkt-Daten übernommen</Text>
                    <Text style={{ fontSize: 12 }} numberOfLines={1}><Text style={{ color: '#fff', fontWeight: '600' }}>{newFirstName} {newLastName}</Text>{'  '}<Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{[tmSelected.verein, tmSelected.tmPosition, tmSelected.tmAge ? tmSelected.tmAge + 'J' : ''].filter(Boolean).join(' · ')}</Text>
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Zuständigkeit: {currentUserName || 'Sie'}</Text>
                  <TouchableOpacity style={{ backgroundColor: '#22c55e', borderWidth: 1, borderColor: '#22c55e', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, opacity: tmLoading ? 0.5 : 1 }} onPress={handleAddPlayer} disabled={tmLoading}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{tmLoading ? 'Laden...' : 'Spieler anlegen'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Invitation Code Success Modal */}
        <Modal visible={showCodeModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, maxWidth: 400, width: '90%', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 }]}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="checkmark" size={28} color="#10b981" />
              </View>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Spieler erstellt!</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>{createdPlayerName}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>Persönlicher Einladungscode:</Text>
              <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, marginBottom: 10, alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', fontFamily: Platform.OS === 'web' ? "'SF Mono', 'Fira Code', 'Courier New', monospace" : undefined, letterSpacing: 3 }}>{createdPlayerCode}</Text>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)', marginBottom: 12 }}
                onPress={() => {
                  if (createdPlayerCode) {
                    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(createdPlayerCode);
                    }
                  }
                }}
              >
                <Ionicons name="copy-outline" size={14} color="#10b981" />
                <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Code kopieren</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 20 }}>Gültig bis zur Registrierung</Text>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 32 }}
                onPress={() => { setShowCodeModal(false); setCreatedPlayerCode(null); setCreatedPlayerName(''); }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Schließen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Request Access Modal */}
        <Modal visible={showRequestModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Zuständigkeit beantragen</Text>
              <Text style={[styles.modalText, { color: colors.text }]}>
                Sie haben keinen Zugriff auf das Profil von{'\n'}
                <Text style={styles.modalPlayerName}>{selectedPlayer?.first_name} {selectedPlayer?.last_name}</Text>
              </Text>
              <Text style={[styles.modalSubText, { color: colors.textSecondary }]}>
                Möchten Sie die Zuständigkeit beantragen?{'\n'}Ein Admin wird Ihre Anfrage prüfen.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalCancelButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => { setShowRequestModal(false); setSelectedPlayer(null); }}>
                  <Text style={[styles.modalCancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSaveButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleRequestAccess}>
                  <Text style={[styles.modalSaveButtonText, { color: '#10b981' }]}>Ja, beantragen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {playerDetailModalJsx}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)' },
  containerMobile: { flex: 1, flexDirection: 'column', backgroundColor: 'rgba(0,0,0,0.45)' },
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, flexDirection: 'row' },
  sidebarMobile: { width: 280, height: '100%', backgroundColor: 'rgba(0,0,0,0.55)' },
  // minHeight: 0 + overflow hidden ist nötig, damit verschachtelte ScrollViews auf
  // Chromium/Edge/Windows ihre Höhe korrekt berechnen — sonst wird der Container so
  // groß wie sein Inhalt und der innere ScrollView scrollt nicht.
  mainContent: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.45)' },
  mainContentMobile: { flex: 1, minHeight: 0, backgroundColor: 'rgba(0,0,0,0.45)' },

  // Mobile Toolbar
  mobileToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  mobileSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  mobileSearchInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 11,
  },
  mobileFilterButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    position: 'relative',
  },
  mobileFilterButtonActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  mobileFilterIcon: {
    fontSize: 18,
  },
  filterCountBubble: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    fontSize: 18,
    fontWeight: '300',
    lineHeight: 20,
  },

  // Mobile Subheader
  mobileSubheader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  mobileSubheaderText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },

  // Mobile Card List
  mobileCardList: {
    flex: 1,
  },
  mobileCardListContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // Player Card
  playerCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as any : {}),
  },
  playerCardLocked: {
    backgroundColor: '#fafafa',
  },
  birthdayCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  playerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  playerCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerCardName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
    flexShrink: 1,
  },
  lockIconMobile: {
    fontSize: 14,
    marginRight: 6,
  },
  birthdayIconMobile: {
    fontSize: 16,
    marginLeft: 6,
  },
  playerCardBadges: {
    flexDirection: 'row',
  },
  listingBadgeMobile: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  listingBadgeTextMobile: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  playerCardBody: {},
  playerCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerCardClub: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clubLogoMobile: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  playerCardClubText: {
    fontSize: 11,
    color: '#334155',
  },
  playerCardPosition: {
    fontSize: 9,
    color: '#60a5fa',
    fontWeight: '600',
    letterSpacing: 0.3,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playerCardLeague: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  contractBadgeMobile: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  contractBadgeMobileRed: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  contractBadgeMobileGreen: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  contractTextMobile: {
    fontSize: 11,
    color: '#64748b',
  },
  contractTextMobileRed: {
    color: '#dc2626',
    fontWeight: '600',
  },
  contractTextMobileGreen: {
    color: '#16a34a',
    fontWeight: '600',
  },

  // Mobile Filter Modal
  mobileFilterModal: {
    flex: 1,
    backgroundColor: '#000',
    marginTop: 60,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  mobileFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  mobileFilterTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  mobileFilterClose: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.7)',
    padding: 4,
  },
  mobileFilterContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  mobileFilterLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  mobileFilterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mobileChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    marginRight: 8,
    marginBottom: 8,
  },
  mobileChipActive: {
    backgroundColor: '#1a1a1a',
  },
  mobileChipText: {
    fontSize: 11,
    color: '#334155',
  },
  mobileChipTextActive: {
    color: '#fff',
  },
  mobileFilterFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  mobileFilterClearButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileFilterClearText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  mobileFilterApplyButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#22c55e',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileFilterApplyText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  
  // Header Banner - weiß mit Titel mittig
  headerBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1 },
  headerBannerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 11, color: '#64748b', marginTop: 4 },
  heroCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 0,
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 0,
    zIndex: 1000,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 60, paddingBottom: 4 },
  heroScreenLabel: { fontFamily: 'Josefin Sans', fontSize: 26, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' },
  heroScreenSubLabel: { fontFamily: 'Josefin Sans', fontSize: 11, fontWeight: '300', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  heroDivider: { height: 1, marginTop: 16, marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.3)' },
  heroToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, zIndex: 100 },
  
  // Toolbar - wie Scouting
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, zIndex: 100 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 6, fontSize: 11 },
  filterContainer: { flexDirection: 'row', gap: 8 },
  dropdownContainer: { position: 'relative' },
  
  // Filter Buttons - wie Scouting
  filterButton: { height: 28, paddingVertical: 0, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  filterButtonText: { fontSize: 11 },
  
  // Filter Dropdown — KMH-Skill: schwarzer Modal-Style, öffnet sich nach LINKS (right: 0)
  // weil rechts der Bildschirmrand ist; minWidth groß genug für lange Labels.
  filterDropdownMulti: { position: 'absolute', top: '100%', right: 0, backgroundColor: '#000', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginTop: 4, minWidth: 260, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 12, zIndex: 1000, overflow: 'hidden' },
  filterDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', backgroundColor: '#000' },
  filterDropdownTitle: { fontFamily: 'Josefin Sans', fontSize: 11, fontWeight: '300', letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' },
  filterClearText: { fontSize: 11, color: '#ef4444', fontWeight: '500' },
  filterCheckboxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: '#000' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  filterCheckboxText: { flex: 1, fontSize: 13, color: '#fff', fontWeight: '500' },
  filterCountBadge: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 11, color: 'rgba(255,255,255,0.6)', overflow: 'hidden' },
  filterDoneButton: { padding: 12, backgroundColor: '#000', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  filterDoneText: { fontSize: 12, fontWeight: '600', color: '#22c55e', letterSpacing: 0.5 },
  
  // Dropdown Overlay
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: 'transparent' },

  // Content with padding
  content: { flex: 1, minHeight: 0, padding: 24 },

  // Table Wrapper with rounded borders
  tableWrapper: { flex: 1, minHeight: 0, borderRadius: 12, borderWidth: 1, overflow: 'hidden', zIndex: 1, position: 'relative' },

  // Add Button
  addButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1 },
  addButtonText: { fontSize: 11, fontWeight: '600' },

  // Tabelle wie Scouting
  tableHeader: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  tableHeaderText: { color: '#64748b', fontWeight: '600', fontSize: 11, textTransform: 'uppercase' },
  tableBody: { flex: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableRowLocked: { backgroundColor: '#fafafa' },
  birthdayRow: { backgroundColor: 'rgba(255, 215, 0, 0.2)' },
  tableCell: { fontSize: 11, color: '#334155' },
  nameContainer: { flexDirection: 'row', alignItems: 'center' },
  nameCell: { fontWeight: '500', flex: 1 },
  lockIcon: { fontSize: 12, marginRight: 4 },
  clubCell: { flexDirection: 'row', alignItems: 'center' },
  clubTextRed: { color: '#dc3545' },
  clubLogo: { width: 22, height: 22, resizeMode: 'contain', marginRight: 8 },
  birthDateCell: { flexDirection: 'row', alignItems: 'center' },
  birthdayIcon: { fontSize: 14, marginLeft: 6 },
  colName: { flex: 1.5, minWidth: 100 },
  colBirthDate: { flex: 1, minWidth: 85 },
  colPosition: { flex: 0.9, minWidth: 70 },
  colClub: { flex: 2.2, minWidth: 150 },
  colLeague: { flex: 1.8, minWidth: 120 },
  colContract: { flex: 1.2, minWidth: 100 },
  colListing: { flex: 0.7, minWidth: 50 },
  colResponsibility: { flex: 1, minWidth: 85 },
  contractBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  contractBadgeText: { color: '#dc2626', fontSize: 11, fontWeight: '600' },
  contractBadgeGreen: { backgroundColor: 'rgba(34,197,94,0.15)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  contractBadgeTextGreen: { color: '#16a34a', fontSize: 11, fontWeight: '600' },
  listingBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  listingKMH: { backgroundColor: '#1e293b' },
  listingPM: { backgroundColor: '#0ea5e9' },
  listingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  loadingText: { padding: 20, textAlign: 'center', color: '#64748b' },
  emptyText: { padding: 20, textAlign: 'center', color: '#64748b' },
  errorContainer: { padding: 20, alignItems: 'center' },
  errorText: { color: '#dc2626', textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#1a1a1a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  retryButtonText: { color: '#fff', fontWeight: '600' },

  // Modal - dezente Buttons
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: 16, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 12, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalText: { fontSize: 13, color: '#334155', textAlign: 'center', marginBottom: 8 },
  modalPlayerName: { fontWeight: 'bold' },
  modalSubText: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  modalHint: { fontSize: 11, color: '#64748b', textAlign: 'left', marginBottom: 0, fontStyle: 'italic' },
  modalInput: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 10 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2, gap: 8 },
  modalCancelButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 5, backgroundColor: 'transparent', alignItems: 'center' },
  modalCancelButtonText: { color: '#64748b', fontWeight: '500', fontSize: 12 },
  modalSaveButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 5, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#10b981', alignItems: 'center' },
  modalSaveButtonText: { color: '#10b981', fontWeight: '600', fontSize: 12 },

  // Player Detail Modal Styles (PlayerPersonalDataScreen-Stil)
  detailModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 32,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalBox: {
    width: '100%',
    maxWidth: 1400,
    flex: 1,
    maxHeight: '100%',
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  detailModalContainer: { flex: 1, backgroundColor: '#000' },
  detailBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.6 },
  detailBgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  detailHeader: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    flexDirection: 'column',
  },
  detailHeaderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailPhoto: { borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  detailPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  detailPhotoInitial: { fontSize: 42, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  detailHeaderCenter: { flex: 1, justifyContent: 'center' },
  detailHeaderName: {
    fontFamily: 'Josefin Sans',
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#fff',
  },
  detailHeaderClubRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  detailHeaderClubText: {
    fontFamily: 'Josefin Sans',
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  detailHeaderTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'right',
  },
  detailDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 16 },
  detailStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 16, paddingHorizontal: 40 },
  detailStatCol: { minWidth: 110, gap: 4, flex: 1, alignItems: 'center' },
  detailStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  detailStatValue: { fontSize: 13, fontWeight: '500', color: '#fff', textAlign: 'center' },
  detailCloseText: { fontSize: 20, color: 'rgba(255,255,255,0.7)' },
  detailToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    gap: 10,
    zIndex: 2,
  },
  detailToolbarLeft: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  detailToolbarRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  detailToolbarBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  detailToolbarBtnText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  detailToolbarCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  detailCardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 16 },
  detailCard: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 280,
  },
  detailCardTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  detailFieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, rowGap: 14 },
  detailField: { minWidth: 120, flex: 1 },
  detailFieldFull: { width: '100%' },
  detailFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  detailFieldValue: { fontSize: 13, fontWeight: '500', color: '#fff' },
  detailListItem: { fontSize: 13, fontWeight: '500', lineHeight: 18, color: '#fff' },
  detailEditInput: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    color: '#fff',
  },
  detailCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  detailCardEditBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  detailCardEditText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  detailCardCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  detailCardCancelText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  detailCardSaveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  detailCardSaveText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  detailDropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 2,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  detailDropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailInviteOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  detailInviteCodeBox: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 320,
    maxWidth: 420,
  },
  detailInviteCodeTitle: { fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '400', letterSpacing: 3, textTransform: 'uppercase', color: '#fff', marginBottom: 8 },
  detailInviteCodeSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20, textAlign: 'center' },
  detailInviteCodePill: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingVertical: 16, paddingHorizontal: 36, borderRadius: 10, marginBottom: 12 },
  detailInviteCodeText: { color: '#22c55e', fontSize: 32, fontWeight: '700', letterSpacing: 6 },
  detailInviteCodeHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 20 },
  detailInviteCodeCloseBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 32 },
  detailInviteCodeCloseText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  detailTooltip: { position: 'absolute', bottom: '100%', marginBottom: 4, backgroundColor: 'rgba(0,0,0,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, zIndex: 10 },
  detailTooltipText: { fontSize: 11, color: '#fff' },
  detailFooter: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  detailFooterButton: { backgroundColor: '#22c55e', borderRadius: 8, padding: 14, alignItems: 'center' },
  detailFooterButtonText: { fontSize: 14, fontWeight: '600', color: '#fff', letterSpacing: 1, textTransform: 'uppercase' },
});
