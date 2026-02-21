import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, ActivityIndicator, Image, Alert, Linking } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getRelevantTermine, convertToDbFormat, getLastUpdateDisplay, getDFBTermineCount, getHallenTermineCount } from '../../services/dfbTermine';
import { 
  syncAllPlayerGames, 
  getApiToken, 
  saveApiToken, 
  loadUpcomingGames,
  extractTeamId,
  getPlayersWithFussballDeUrl
} from '../../services/fussballDeApi';
import { Ionicons } from '@expo/vector-icons';

interface Termin {
  id: string;
  datum: string;
  datum_ende?: string;
  art: string;
  titel: string;
  jahrgang: string;
  ort: string;
  uebernahme_advisor_id: string;
  erstellt_von: string;
  quelle?: string;
  created_at: string;
}

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
  role?: string;
}

interface PlayerGame {
  id: string;
  player_id: string;
  player_name: string;
  date: string;
  time: string;
  home_team: string;
  away_team: string;
  home_team_logo?: string;
  away_team_logo?: string;
  location: string;
  league: string;
  matchday: string;
  result?: string;
  game_url?: string;
  selected: boolean;
  player?: {
    id: string;
    first_name: string;
    last_name: string;
    club: string;
    responsibility: string;
    league: string;
    fussball_de_url?: string;
  };
}

interface ClubLogo {
  club_name: string;
  logo_url: string;
}

type ViewMode = 'dashboard' | 'spiele' | 'termine' | 'kalender';
type SortField = 'datum' | 'art' | 'titel' | 'jahrgang' | 'ort' | 'uebernahme';
type SortDirection = 'asc' | 'desc';

const TERMIN_ARTEN = ['Nationalmannschaft', 'Hallenturnier', 'Sonstiges'];
const JAHRGAENGE = ['U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U20', 'U21', 'U23', 'Herren', 'Sonstige'];

export function TermineScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { session, loading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const dataLoadedRef = useRef(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [profile, setProfile] = useState<Advisor | null>(null);
  const [termine, setTermine] = useState<Termin[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; skipped: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTermin, setSelectedTermin] = useState<Termin | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // Spiele unserer Spieler State
  const [playerGames, setPlayerGames] = useState<PlayerGame[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [gamesSearchText, setGamesSearchText] = useState('');
  const [termineSearchText, setTermineSearchText] = useState('');
  const [showTermineArchiv, setShowTermineArchiv] = useState(false);
  const [termineJahrgangFilter, setTermineJahrgangFilter] = useState<string[]>([]);
  const [showTermineJahrgangDropdown, setShowTermineJahrgangDropdown] = useState(false);
  const [selectedTermineIds, setSelectedTermineIds] = useState<string[]>([]);
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [showResponsibilityDropdown, setShowResponsibilityDropdown] = useState(false);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [syncingGames, setSyncingGames] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; playerName: string } | null>(null);
  const [gameSyncResult, setGameSyncResult] = useState<{ added: number; updated: number; deleted: number; errors: string[] } | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [playersWithUrl, setPlayersWithUrl] = useState<any[]>([]);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('datum');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Form state
  const [formDatum, setFormDatum] = useState('');
  const [formDatumEnde, setFormDatumEnde] = useState('');
  const [formZeit, setFormZeit] = useState('');
  const [formArt, setFormArt] = useState('Sonstiges');
  const [formTitel, setFormTitel] = useState('');
  const [formJahrgang, setFormJahrgang] = useState('');
  const [formOrt, setFormOrt] = useState('');
  const [formUebernahme, setFormUebernahme] = useState('');
  
  // Modal Dropdown States
  const [showDatumDropdown, setShowDatumDropdown] = useState<'day' | 'month' | 'year' | null>(null);
  const [showDatumEndeDropdown, setShowDatumEndeDropdown] = useState<'day' | 'month' | 'year' | null>(null);
  const [showJahrgangDropdown, setShowJahrgangDropdown] = useState(false);
  const [showUebernahmeDropdown, setShowUebernahmeDropdown] = useState(false);

  const closeAllModalDropdowns = () => {
    setShowDatumDropdown(null);
    setShowDatumEndeDropdown(null);
    setShowJahrgangDropdown(false);
    setShowUebernahmeDropdown(false);
  };

  // Datum Helper-Funktionen
  const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const FORM_YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i);

  const parseDateToParts = (dateString: string): { day: number; month: number; year: number } | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return { day: date.getDate(), month: date.getMonth(), year: date.getFullYear() };
  };

  const buildDateFromParts = (day: number, month: number, year: number): string => {
    if (!day || month === undefined || month === null || !year) return '';
    const paddedMonth = (month + 1).toString().padStart(2, '0');
    const paddedDay = day.toString().padStart(2, '0');
    return `${year}-${paddedMonth}-${paddedDay}`;
  };

  const updateFormDatumPart = (part: 'day' | 'month' | 'year', value: number) => {
    const current = parseDateToParts(formDatum) || { day: 1, month: 0, year: new Date().getFullYear() };
    if (part === 'day') current.day = value;
    if (part === 'month') current.month = value;
    if (part === 'year') current.year = value;
    setFormDatum(buildDateFromParts(current.day, current.month, current.year));
    setShowDatumDropdown(null);
  };

  const updateFormDatumEndePart = (part: 'day' | 'month' | 'year', value: number) => {
    const current = parseDateToParts(formDatumEnde) || { day: 1, month: 0, year: new Date().getFullYear() };
    if (part === 'day') current.day = value;
    if (part === 'month') current.month = value;
    if (part === 'year') current.year = value;
    setFormDatumEnde(buildDateFromParts(current.day, current.month, current.year));
    setShowDatumEndeDropdown(null);
  };
  // Daten nur laden wenn Auth bereit ist
  useEffect(() => {
    if (authLoading) return;
    if (!session) return;
    if (dataLoadedRef.current) return;

    dataLoadedRef.current = true;
    fetchProfile();
    fetchAdvisors();
    fetchTermine();
    fetchClubLogos();
    fetchPlayersWithUrl();
    fetchPlayerGames();
  }, [authLoading, session]);

  const fetchPlayersWithUrl = async () => {
    const players = await getPlayersWithFussballDeUrl(supabase);
    setPlayersWithUrl(players);
  };

  const fetchPlayerGames = async () => {
    try {
      const games = await loadUpcomingGames(supabase);
      setPlayerGames(games.map(g => ({
        ...g,
        player_name: g.player ? `${g.player.first_name} ${g.player.last_name}` : g.player_name || '-'
      })));
    } catch (err) {
      console.error('Fehler beim Laden der Spieler-Spiele:', err);
    }
  };

  const fetchClubLogos = async () => {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const logos: Record<string, string> = {};
      data.forEach(cl => { logos[cl.club_name] = cl.logo_url; });
      setClubLogos(logos);
    }
  };

  const getClubLogo = (clubName: string): string | null => {
    if (!clubName) return null;
    // Exakte Übereinstimmung
    if (clubLogos[clubName]) return clubLogos[clubName];

    const searchName = clubName.toLowerCase();

    // Bekannte Abkürzungen/Varianten normalisieren
    const normalizeClubName = (name: string): string[] => {
      const n = name.toLowerCase();
      const variants = [n];
      // RB = Rasenball/Rasenballsport
      if (n.includes('rb ')) {
        variants.push(n.replace('rb ', 'rasenball '));
        variants.push(n.replace('rb ', 'rasenballsport '));
      }
      if (n.includes('rasenball')) {
        variants.push(n.replace('rasenballsport ', 'rb ').replace('rasenball ', 'rb '));
      }
      // TSG mit/ohne 1899
      if (n.includes('tsg ') && !n.includes('1899')) {
        variants.push(n.replace('tsg ', 'tsg 1899 '));
      }
      if (n.includes('tsg 1899 ')) {
        variants.push(n.replace('tsg 1899 ', 'tsg '));
      }
      // Barockstadt = SG Barockstadt Fulda
      if (n.includes('barockstadt')) {
        variants.push('sg barockstadt fulda');
        variants.push('barockstadt fulda');
        variants.push('sg barockstadt');
      }
      return variants;
    };

    const searchVariants = normalizeClubName(clubName);

    // Teilübereinstimmung mit Varianten
    for (const [name, url] of Object.entries(clubLogos)) {
      const dbVariants = normalizeClubName(name);
      for (const sv of searchVariants) {
        for (const dv of dbVariants) {
          if (sv.includes(dv) || dv.includes(sv)) {
            return url;
          }
        }
      }
    }
    return null;
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('advisors').select('id, first_name, last_name, role').eq('id', user.id).single();
      if (data) setProfile(data);
    }
  };

  const fetchAdvisors = async () => {
    const { data } = await supabase.from('advisors').select('id, first_name, last_name').order('last_name');
    if (data) setAdvisors(data);
  };

  const fetchTermine = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data, error } = await supabase
        .from('termine')
        .select('*')
        .or(`datum.gte.${oneDayAgo.toISOString()},datum_ende.gte.${now.toISOString()}`)
        .order('datum', { ascending: true });

      if (!error && data) setTermine(data);
      else if (error) console.error('Fehler beim Laden der Termine:', error);
    } catch (err) {
      console.error('Netzwerkfehler beim Laden der Termine:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAdvisorName = (advisorId: string): string => {
    const advisor = advisors.find(a => a.id === advisorId);
    return advisor ? `${advisor.first_name} ${advisor.last_name}` : '-';
  };

  const resetForm = () => { 
    setFormDatum(''); setFormDatumEnde(''); setFormZeit(''); 
    setFormArt('Sonstiges'); setFormTitel(''); setFormJahrgang(''); 
    setFormOrt(''); setFormUebernahme(''); 
  };
  
  const openAddModal = () => { resetForm(); setShowAddModal(true); };

  const openEditModal = (termin: Termin) => {
    setSelectedTermin(termin);
    const date = new Date(termin.datum);
    setFormDatum(date.toISOString().split('T')[0]);
    const hours = date.getHours(), minutes = date.getMinutes();
    setFormZeit((hours !== 0 || minutes !== 0) ? date.toTimeString().slice(0, 5) : '');
    setFormDatumEnde(termin.datum_ende ? new Date(termin.datum_ende).toISOString().split('T')[0] : '');
    setFormArt(termin.art); setFormTitel(termin.titel); setFormJahrgang(termin.jahrgang || '');
    setFormOrt(termin.ort || ''); setFormUebernahme(termin.uebernahme_advisor_id || '');
    setShowEditModal(true);
  };

  const handleSaveTermin = async () => {
    if (!formDatum || !formTitel || !formArt) { alert('Bitte Datum, Art und Beschreibung ausfüllen'); return; }
    const datum = formZeit ? `${formDatum}T${formZeit}:00` : `${formDatum}T00:00:00`;
    const terminData = { 
      datum, datum_ende: formDatumEnde || null, art: formArt, titel: formTitel, 
      jahrgang: formJahrgang || null, ort: formOrt || null, 
      uebernahme_advisor_id: formUebernahme || null, erstellt_von: profile?.id 
    };
    const { error } = await supabase.from('termine').insert([terminData]);
    if (error) { alert('Fehler: ' + error.message); } 
    else { setShowAddModal(false); resetForm(); fetchTermine(); }
  };

  const handleUpdateTermin = async () => {
    if (!selectedTermin || !formDatum || !formTitel || !formArt) { alert('Bitte Datum, Art und Beschreibung ausfüllen'); return; }
    const datum = formZeit ? `${formDatum}T${formZeit}:00` : `${formDatum}T00:00:00`;
    const { error } = await supabase.from('termine').update({ 
      datum, datum_ende: formDatumEnde || null, art: formArt, titel: formTitel, 
      jahrgang: formJahrgang || null, ort: formOrt || null, 
      uebernahme_advisor_id: formUebernahme || null 
    }).eq('id', selectedTermin.id);
    if (error) { alert('Fehler: ' + error.message); } 
    else { setShowEditModal(false); setSelectedTermin(null); resetForm(); fetchTermine(); }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteTermin = async () => {
    if (!selectedTermin) return;
    const { error } = await supabase.from('termine').delete().eq('id', selectedTermin.id);
    if (error) { alert('Fehler: ' + error.message); } 
    else { setShowDeleteConfirm(false); setShowEditModal(false); setSelectedTermin(null); fetchTermine(); }
  };

  const handleDFBSync = async () => {
    if (!profile?.id) { alert('Bitte zuerst anmelden'); return; }
    setSyncLoading(true); setSyncResult(null);
    try {
      const relevantTermine = getRelevantTermine();
      let added = 0, skipped = 0;
      const { data: existingTermine } = await supabase.from('termine').select('datum, jahrgang, titel').in('quelle', ['DFB', 'Hallenturnier']);
      const existingKeys = new Set((existingTermine || []).map(t => { 
        const date = new Date(t.datum).toISOString().split('T')[0]; 
        return `${date}_${t.jahrgang}_${t.titel}`; 
      }));
      for (const dfbTermin of relevantTermine) {
        const dbData = convertToDbFormat(dfbTermin, profile.id);
        const key = `${dfbTermin.datumStart}_${dfbTermin.jahrgang}_${dbData.titel}`;
        if (existingKeys.has(key)) { skipped++; continue; }
        const { error } = await supabase.from('termine').insert([dbData]);
        if (!error) { added++; } else { console.error('Fehler:', error); }
      }
      setSyncResult({ added, skipped }); fetchTermine();
    } catch (error) { console.error('Sync Fehler:', error); alert('Fehler beim Synchronisieren'); }
    finally { setSyncLoading(false); }
  };

  // Sorting functions
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const isNationalmannschaft = (termin: Termin): boolean => {
    return termin.quelle === 'DFB' || termin.art === 'DFB-Maßnahme' || termin.art === 'DFB-Spiel' || termin.art === 'Nationalmannschaft';
  };
  
  const isHallenturnier = (termin: Termin): boolean => {
    return termin.quelle === 'Hallenturnier' || termin.art === 'Hallenturnier';
  };

  const getSortedTermine = (): Termin[] => {
    return [...termine].sort((a, b) => {
      let valueA: any, valueB: any;
      switch (sortField) {
        case 'datum':
          valueA = new Date(a.datum).getTime();
          valueB = new Date(b.datum).getTime();
          break;
        case 'art':
          const artA = isNationalmannschaft(a) ? 'Nationalmannschaft' : isHallenturnier(a) ? 'Hallenturnier' : a.art;
          const artB = isNationalmannschaft(b) ? 'Nationalmannschaft' : isHallenturnier(b) ? 'Hallenturnier' : b.art;
          valueA = artA?.toLowerCase() || '';
          valueB = artB?.toLowerCase() || '';
          break;
        case 'titel':
          valueA = a.titel?.toLowerCase() || '';
          valueB = b.titel?.toLowerCase() || '';
          break;
        case 'jahrgang':
          valueA = a.jahrgang?.toLowerCase() || '';
          valueB = b.jahrgang?.toLowerCase() || '';
          break;
        case 'ort':
          valueA = a.ort?.toLowerCase() || '';
          valueB = b.ort?.toLowerCase() || '';
          break;
        case 'uebernahme':
          valueA = getAdvisorName(a.uebernahme_advisor_id).toLowerCase();
          valueB = getAdvisorName(b.uebernahme_advisor_id).toLowerCase();
          break;
        default:
          return 0;
      }
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getSortIndicator = (field: SortField): string => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const formatDate = (termin: Termin): string => {
    const startDate = new Date(termin.datum);
    const formatShort = (d: Date) => {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    };
    
    if (termin.datum_ende) {
      const endDate = new Date(termin.datum_ende);
      const startDay = startDate.getDate().toString().padStart(2, '0');
      const startMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
      if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
        return `${startDay}.-${formatShort(endDate)}`;
      }
      return `${startDay}.${startMonth}.-${formatShort(endDate)}`;
    }
    return formatShort(startDate);
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if ((hours === 0 || hours === 1 || hours === 2) && minutes === 0) return '';
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  // Namen zu Kürzeln umwandeln (z.B. "Matti Langer" -> "ML")
  const getInitials = (name: string): string => {
    return name.split(' ').map(part => part.charAt(0).toUpperCase()).join('');
  };

  // Zuständigkeiten als Kürzel formatieren
  const formatResponsibilityInitials = (responsibility: string | undefined): string => {
    if (!responsibility) return '-';
    const parts = responsibility.split(/,\s*|&\s*/).map(s => s.trim()).filter(s => s);
    return parts.map(name => getInitials(name)).join(', ');
  };

  const isTerminPast = (dateString: string, datumEnde?: string): boolean => {
    // Termine sollen den ganzen Tag sichtbar bleiben (bis Mitternacht)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (datumEnde) {
      const endDate = new Date(datumEnde);
      endDate.setHours(23, 59, 59, 999);
      return endDate < today;
    }
    
    const terminDate = new Date(dateString);
    terminDate.setHours(23, 59, 59, 999);
    return terminDate < today;
  };
  
  const isTerminCurrentlyRunning = (termin: Termin): boolean => {
    const now = new Date();
    const startDate = new Date(termin.datum);
    startDate.setHours(0, 0, 0, 0); // Tagesbeginn
    const endDate = termin.datum_ende ? new Date(termin.datum_ende) : new Date(termin.datum);
    endDate.setHours(23, 59, 59, 999); // Tagesende
    return startDate <= now && endDate >= now;
  };
  
  const isTerminToday = (termin: Termin): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startDate = new Date(termin.datum);
    const endDate = termin.datum_ende ? new Date(termin.datum_ende) : startDate;
    
    return (startDate >= today && startDate < tomorrow) || 
           (startDate <= today && endDate >= today);
  };
  
  const getUpcomingTermineCount = (): number => termine.filter(t => !isTerminPast(t.datum, t.datum_ende)).length;
  const getUrgentTermineCount = (): number => { 
    const now = new Date(); 
    const in7Days = new Date(now.getTime() + 7*24*60*60*1000); 
    return termine.filter(t => { const d = new Date(t.datum); return d >= now && d <= in7Days; }).length; 
  };
  
  const getLocalDFBCount = (): number => termine.filter(t => 
    !isTerminPast(t.datum, t.datum_ende) && 
    (t.art === 'DFB-Maßnahme' || t.art === 'DFB-Spiel' || t.art === 'DFB' || t.art === 'Nationalmannschaft')
  ).length;
  
  const getLocalHallenCount = (): number => termine.filter(t => 
    !isTerminPast(t.datum, t.datum_ende) && 
    (t.art === 'Hallenturnier' || t.art === 'Hallen')
  ).length;

  const getDisplayArt = (art: string): string => {
    if (art === 'DFB-Maßnahme' || art === 'DFB-Spiel' || art === 'DFB' || art === 'Nationalmannschaft') {
      return 'Nationalmannschaft';
    }
    return art;
  };

  // === SPIELE SYNC FUNCTIONS ===
  
  const handleSyncGames = async () => {
    // Prüfen ob Token vorhanden
    const token = await getApiToken(supabase);
    if (!token) {
      setShowTokenModal(true);
      return;
    }
    
    if (playersWithUrl.length === 0) {
      Alert.alert('Hinweis', 'Keine Spieler mit fussball.de URL gefunden.\n\nBitte trage zuerst im Spielerprofil die fussball.de URL ein.');
      return;
    }
    
    setSyncingGames(true);
    setGameSyncResult(null);
    setSyncProgress({ current: 0, total: playersWithUrl.length, playerName: '' });
    
    try {
      const result = await syncAllPlayerGames(
        supabase,
        (current, total, playerName) => {
          setSyncProgress({ current, total, playerName });
        }
      );
      
      setGameSyncResult(result);
      
      // Spiele neu laden
      await fetchPlayerGames();
      
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Fehler', 'Fehler bei der Synchronisierung: ' + error.message);
    } finally {
      setSyncingGames(false);
      setSyncProgress(null);
    }
  };

  const handleSaveToken = async () => {
    if (!apiToken.trim()) {
      Alert.alert('Fehler', 'Bitte Token eingeben');
      return;
    }
    
    const success = await saveApiToken(supabase, apiToken.trim());
    if (success) {
      setShowTokenModal(false);
      setApiToken('');
      Alert.alert('Erfolg', 'API Token gespeichert. Du kannst jetzt synchronisieren.');
    } else {
      Alert.alert('Fehler', 'Token konnte nicht gespeichert werden');
    }
  };

  const toggleGameSelection = (gameId: string, currentValue: boolean) => {
    // Sofort UI updaten (optimistic update)
    setPlayerGames(prev => prev.map(g =>
      g.id === gameId ? { ...g, selected: !currentValue } : g
    ));
    // DB im Hintergrund updaten
    supabase
      .from('player_games')
      .update({ selected: !currentValue })
      .eq('id', gameId)
      .then(({ error }) => {
        if (error) {
          // Bei Fehler: zurücksetzen
          setPlayerGames(prev => prev.map(g =>
            g.id === gameId ? { ...g, selected: currentValue } : g
          ));
        }
      });
  };

  const getSelectedGamesCount = () => playerGames.filter(g => g.selected).length;

  // Hilfsfunktion: Teamnamen bereinigen
  const cleanTeamName = (name: string, isHerren: boolean = false): string => {
    if (!name) return '';

    // Prüfen ob 2. Mannschaft (II, 2 am Ende)
    const isSecondTeam = /\s+(II|2)$/i.test(name);

    let cleaned = name
      // RasenBallsport / RasenBall zu RB
      .replace(/RasenBallsport/gi, 'RB')
      .replace(/RasenBall/gi, 'RB')
      // U-Klassen entfernen (U15, U17, U19, etc.)
      .replace(/\s*U[\s-]?\d{2}\b/gi, '')
      // Mannschaftsnummern am Ende entfernen (II, III, IV, 2, 3, 4)
      .replace(/\s+(II|III|IV|V|2|3|4|5)$/i, '')
      .trim();

    // Großbuchstaben-Wörter korrigieren (DYNAMO → Dynamo, aber nicht FC, SV, VfL, RB etc.)
    cleaned = cleaned.replace(/\b([A-ZÄÖÜ]{4,})\b/g, (match) => {
      // Behalte kurze Abkürzungen groß
      if (match.length <= 3) return match;
      // Wandle lange Wörter in Title Case um
      return match.charAt(0) + match.slice(1).toLowerCase();
    });

    // Bei Herren 2. Mannschaften als U23 kennzeichnen
    if (isHerren && isSecondTeam) {
      cleaned += ' U23';
    }

    return cleaned;
  };

  // Hilfsfunktion: Spieltitel für Kalender formatieren
  const formatGameTitle = (game: PlayerGame): string => {
    const gameLeague = (game.league || '').toLowerCase();

    // Mannschaft aus Spielerprofil-Liga (playerLeague) extrahieren
    const playerLeague = (game as any).playerLeague || game.player?.league || '';
    const ageMatch = playerLeague.match(/\bU[\s-]?(\d{2})\b/i);
    const ageCategory = ageMatch ? 'U' + ageMatch[1] : '';
    const isJugend = !!ageCategory;
    const isHerren = !isJugend;

    const homeTeam = cleanTeamName(game.home_team || '', isHerren);
    const awayTeam = cleanTeamName(game.away_team || '', isHerren);
    const teams = `${homeTeam} - ${awayTeam}`;

    // Spielart bestimmen
    const isPokal = gameLeague.includes('pokal') || gameLeague.includes('cup');
    const isFreundschaft = gameLeague.includes('freundschaft') || gameLeague.includes('friendly') || gameLeague.includes('testspiel');

    // Liga-Name für Herren aus Spielerprofil extrahieren
    let leagueShort = '';
    if (!isJugend && playerLeague) {
      const pl = playerLeague.toLowerCase();
      if (pl.includes('1. bundesliga') || pl.includes('1.bundesliga') || (pl.includes('bundesliga') && !pl.includes('2.') && !pl.includes('2 '))) {
        leagueShort = '1.Liga';
      } else if (pl.includes('2. bundesliga') || pl.includes('2.bundesliga')) {
        leagueShort = '2.Liga';
      } else if (pl.includes('3. liga') || pl.includes('3.liga')) {
        leagueShort = '3.Liga';
      } else if (pl.includes('regionalliga')) {
        leagueShort = 'RL';
      } else if (pl.includes('oberliga')) {
        leagueShort = 'OL';
      }
    }

    // Titel formatieren nach neuem Schema
    if (isPokal && isJugend) {
      return `Pokal ${ageCategory} ${teams}`;
    } else if (isPokal) {
      return `Pokal ${teams}`;
    } else if (isFreundschaft && isJugend) {
      return `FS ${ageCategory} ${teams}`;
    } else if (isFreundschaft) {
      return `FS ${teams}`;
    } else if (isJugend) {
      return `${ageCategory} ${teams}`;
    } else if (leagueShort) {
      return `${leagueShort} ${teams}`;
    }

    // Standard: nur Teams
    return teams;
  };

  const exportSelectedToCalendar = () => {
    const selectedGames = playerGames.filter(g => g.selected);
    if (selectedGames.length === 0) {
      Alert.alert('Hinweis', 'Bitte wähle mindestens ein Spiel aus.');
      return;
    }

    // ICS Datei erstellen
    let icsContent = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//KMH-App//Spielplan//DE\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n`;

    selectedGames.forEach(game => {
      const dateStr = game.date.replace(/-/g, '');
      // Zeit formatieren: HH:MM -> HHMMSS
      let timeStr = '120000'; // Default 12:00
      if (game.time) {
        const timeParts = game.time.split(':');
        timeStr = timeParts[0].padStart(2, '0') + (timeParts[1] || '00').padStart(2, '0') + '00';
      }

      // Ende: 2 Stunden nach Start
      const startHour = parseInt(timeStr.substring(0, 2));
      const endHour = (startHour + 2) % 24;
      const endTimeStr = endHour.toString().padStart(2, '0') + timeStr.substring(2);

      // Spielernamen für Description
      const playerNames = (game as any).playerNames?.join(', ') || game.player_name || '';

      // Formatierten Titel verwenden
      const gameTitle = formatGameTitle(game);

      icsContent += `BEGIN:VEVENT\r\nDTSTART:${dateStr}T${timeStr}\r\nDTEND:${dateStr}T${endTimeStr}\r\nSUMMARY:${gameTitle}\r\nDESCRIPTION:Spieler: ${playerNames}\r\nLOCATION:${game.location || ''}\r\nEND:VEVENT\r\n`;
    });

    icsContent += 'END:VCALENDAR';
    
    // Download
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spielplan_${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    Alert.alert('Erfolg', `${selectedGames.length} Spiele wurden exportiert.`);
  };

  // Alle gefilterten Spiele auswählen/abwählen
  const toggleSelectAllFiltered = () => {
    const allSelected = filteredGames.every(g => g.selected);
    const newValue = !allSelected;
    const gameIds = filteredGames.filter(g => g.selected !== newValue).map(g => g.id);

    if (gameIds.length === 0) return;

    // Sofort UI updaten
    setPlayerGames(prev => prev.map(g => {
      const isFiltered = filteredGames.some(fg => fg.id === g.id);
      return isFiltered ? { ...g, selected: newValue } : g;
    }));

    // Ein einziger DB-Update für alle IDs
    supabase
      .from('player_games')
      .update({ selected: newValue })
      .in('id', gameIds)
      .then(({ error }) => {
        if (error) {
          // Bei Fehler: zurücksetzen
          setPlayerGames(prev => prev.map(g =>
            gameIds.includes(g.id) ? { ...g, selected: !newValue } : g
          ));
        }
      });
  };

  const areAllFilteredSelected = () => {
    if (filteredGames.length === 0) return false;
    return filteredGames.every(g => g.selected);
  };

  // Termine Selection Functions
  const toggleTerminSelection = (terminId: string) => {
    setSelectedTermineIds(prev =>
      prev.includes(terminId)
        ? prev.filter(id => id !== terminId)
        : [...prev, terminId]
    );
  };

  const getSelectedTermineCount = () => selectedTermineIds.length;

  const exportSelectedTermineToCalendar = () => {
    const selectedTermine = termine.filter(t => selectedTermineIds.includes(t.id));
    if (selectedTermine.length === 0) {
      Alert.alert('Hinweis', 'Bitte wähle mindestens einen Termin aus.');
      return;
    }

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KMH App//Termine//DE
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    selectedTermine.forEach(termin => {
      const dateStr = termin.datum.split('T')[0].replace(/-/g, '');
      const endDateStr = termin.datum_ende ? termin.datum_ende.split('T')[0].replace(/-/g, '') : dateStr;

      // Zeit extrahieren falls vorhanden
      let timeStr = '120000';
      if (termin.datum.includes('T')) {
        const timePart = termin.datum.split('T')[1];
        if (timePart) {
          timeStr = timePart.replace(/:/g, '').substring(0, 6) || '120000';
        }
      }

      icsContent += `BEGIN:VEVENT
DTSTART:${dateStr}T${timeStr}
DTEND:${endDateStr}T235900
SUMMARY:${termin.titel}
LOCATION:${termin.ort || ''}
DESCRIPTION:${termin.art}${termin.jahrgang ? ' - ' + termin.jahrgang : ''}
UID:${termin.id}@kmh-app
END:VEVENT
`;
    });

    icsContent += 'END:VCALENDAR';

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `termine_${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Alert.alert('Erfolg', `${selectedTermine.length} Termine wurden exportiert.`);
  };

  // Filter Logic
  const availableResponsibilities = useMemo(() => {
    const responsibilities = new Set<string>();
    playerGames.forEach(g => {
      if (g.player?.responsibility) {
        // Aufteilen falls mehrere Berater (getrennt durch ", " oder " & " oder ",")
        const parts = g.player.responsibility.split(/,\s*|&\s*/).map(s => s.trim().replace(/\s+/g, ' ')).filter(s => s);
        parts.forEach(part => responsibilities.add(part));
      }
    });
    return Array.from(responsibilities).sort();
  }, [playerGames]);

  const availablePlayers = useMemo(() => {
    const players = new Map<string, { id: string; name: string; club: string }>();
    playerGames.forEach(g => {
      if (g.player_id && !players.has(g.player_id)) {
        players.set(g.player_id, {
          id: g.player_id,
          name: g.player_name || '-',
          club: g.player?.club || ''
        });
      }
    });
    return Array.from(players.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [playerGames]);

  const filteredGames = useMemo(() => {
    let games = [...playerGames];
    
    if (gamesSearchText) {
      const search = gamesSearchText.toLowerCase();
      games = games.filter(g => 
        g.home_team?.toLowerCase().includes(search) ||
        g.away_team?.toLowerCase().includes(search) ||
        g.player_name?.toLowerCase().includes(search) ||
        g.location?.toLowerCase().includes(search)
      );
    }
    
    if (selectedResponsibilities.length > 0) {
      games = games.filter(g => {
        const resp = g.player?.responsibility || '';
        // Prüfen ob einer der ausgewählten Berater im responsibility-String enthalten ist
        return selectedResponsibilities.some(selected => 
          resp.split(/,\s*|&\s*/).map(s => s.trim()).includes(selected)
        );
      });
    }
    
    if (selectedPlayers.length > 0) {
      games = games.filter(g => selectedPlayers.includes(g.player_id));
    }
    
    // Duplikate zusammenführen: gleiche Spiele (Datum + Zeit + Teams) mit mehreren Spielern
    const gameMap = new Map<string, PlayerGame & { playerNames: string[], playerResponsibilities: string[], playerLeague: string }>();

    // Hilfsfunktion: Teamnamen normalisieren (U17/U19 etc. entfernen für Vergleich)
    const normalizeTeam = (name: string) => (name || '').replace(/\s*U[\s-]?\d{2}\s*/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

    games.forEach(game => {
      const homeNorm = normalizeTeam(game.home_team);
      const awayNorm = normalizeTeam(game.away_team);
      // Sortiere Teams alphabetisch für konsistenten Key (A vs B = B vs A)
      const teams = [homeNorm, awayNorm].sort().join('_');
      const key = `${game.date}_${game.time || ''}_${teams}`;

      if (gameMap.has(key)) {
        const existing = gameMap.get(key)!;
        if (!existing.playerNames.includes(game.player_name)) {
          existing.playerNames.push(game.player_name);
        }
        const resp = game.player?.responsibility || '';
        if (resp && !existing.playerResponsibilities.includes(resp)) {
          existing.playerResponsibilities.push(resp);
        }
      } else {
        gameMap.set(key, {
          ...game,
          playerNames: [game.player_name],
          playerResponsibilities: game.player?.responsibility ? [game.player.responsibility] : [],
          playerLeague: game.player?.league || ''
        });
      }
    });
    
    return Array.from(gameMap.values()).sort((a, b) => {
      // 1. Datum aufsteigend
      const dateCompare = (a.date || '').localeCompare(b.date || '');
      if (dateCompare !== 0) return dateCompare;

      // 2. Uhrzeit aufsteigend (Spiele ohne Zeit ans Ende)
      const timeCompare = (a.time || '99:99').localeCompare(b.time || '99:99');
      if (timeCompare !== 0) return timeCompare;

      // 3. Mannschaft: Herren zuerst, dann U-Mannschaften absteigend (U19 > U17 > U15 > ...)
      const getTeamRank = (g: any): number => {
        const league = g.playerLeague || g.player?.league || '';
        const m = league.match(/\bU[\s-]?(\d{2})\b/i);
        if (!m) return 0; // Herren = höchste Priorität
        return parseInt(m[1]);
      };
      const rankA = getTeamRank(a);
      const rankB = getTeamRank(b);
      if (rankA === 0 && rankB !== 0) return -1;
      if (rankA !== 0 && rankB === 0) return 1;
      return rankB - rankA; // U19 vor U17 vor U15
    });
  }, [playerGames, gamesSearchText, selectedResponsibilities, selectedPlayers]);

  const toggleResponsibility = (resp: string) => {
    setSelectedResponsibilities(prev => 
      prev.includes(resp) ? prev.filter(r => r !== resp) : [...prev, resp]
    );
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId) ? prev.filter(p => p !== playerId) : [...prev, playerId]
    );
  };

  const closeAllGameDropdowns = () => {
    setShowResponsibilityDropdown(false);
    setShowPlayerDropdown(false);
  };

  const DashboardCard = ({ id, children, style, onPress, hoverStyle }: {
    id: string; children: React.ReactNode; style?: any; onPress?: () => void; hoverStyle?: any;
  }) => (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHoveredCard(id)}
      onHoverOut={() => setHoveredCard(null)}
      style={[styles.card, style, hoveredCard === id && [hoverStyle || styles.cardHovered, { backgroundColor: colors.surfaceSecondary }]]}
    >
      {children}
    </Pressable>
  );

  const SortableHeader = ({ field, label, style }: { field: SortField; label: string; style: any }) => (
    <TouchableOpacity onPress={() => handleSort(field)} style={[style, styles.sortableHeader]}>
      <Text style={[styles.termineTableHeaderText, { color: colors.textSecondary }]}>{label} {getSortIndicator(field)}</Text>
    </TouchableOpacity>
  );

  const formatGameDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const weekday = weekdays[date.getDay()];
    return `${weekday}, ${day}.${month}.`;
  };

  // Hilfsfunktion: Heutiges Datum in mitteleuropäischer Zeit
  const getGermanTodayString = (): string => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  };

  const isGameToday = (dateStr: string): boolean => {
    return dateStr === getGermanTodayString();
  };

  const isGameThisWeek = (dateStr: string): boolean => {
    const todayStr = getGermanTodayString();
    const today = new Date(todayStr);
    const gameDate = new Date(dateStr);
    const diffTime = gameDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  // Heutige Spiele zählen
  const getTodayGamesCount = (): number => {
    const today = getGermanTodayString();
    return playerGames.filter(g => g.date === today).length;
  };

  // Heutige Termine zählen
  const getTodayTermineCount = (): number => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return termine.filter(t => {
      const terminStart = new Date(t.datum);
      const terminEnde = t.datum_ende ? new Date(t.datum_ende) : terminStart;
      const terminStartDay = new Date(terminStart.getFullYear(), terminStart.getMonth(), terminStart.getDate());
      const terminEndeDay = new Date(terminEnde.getFullYear(), terminEnde.getMonth(), terminEnde.getDate());
      
      return terminStartDay <= today && today <= terminEndeDay;
    }).length;
  };

  const renderDashboard = () => {
    // Mobile Dashboard View
    if (isMobile) {
      return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentMobile}>
          <View style={styles.mobileCardsContainer}>
            {/* Spiele unserer Spieler */}
            <DashboardCard
              id="spiele"
              style={[styles.mobileCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
              onPress={() => setViewMode('spiele')}
              hoverStyle={styles.lightCardHovered}
            >
              <View style={styles.mobileCardContent}>
                <View style={[styles.mobileCardIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={styles.mobileCardIconText}>⚽</Text></View>
                <View style={styles.mobileCardText}>
                  <Text style={[styles.mobileCardTitle, { color: colors.text }]}>Spiele unserer Spieler</Text>
                  <Text style={[styles.mobileCardSubtitle, { color: colors.textSecondary }]}>
                    {playerGames.length > 0
                      ? `${playerGames.length} Spiele in 5 Wochen`
                      : 'Partien im Überblick'
                    }
                  </Text>
                </View>
                <Text style={[styles.mobileCardCount, { color: colors.text }]}>{getTodayGamesCount()}</Text>
              </View>
            </DashboardCard>

            {/* Weitere Termine */}
            <DashboardCard
              id="termine"
              style={[styles.mobileCardDark, { backgroundColor: isDark ? colors.surfaceSecondary : '#1a1a1a' }]}
              onPress={() => setViewMode('termine')}
              hoverStyle={styles.darkCardHovered}
            >
              <View style={styles.mobileCardContent}>
                <View style={styles.mobileCardIconDark}><Text style={styles.mobileCardIconText}>📋</Text></View>
                <View style={styles.mobileCardText}>
                  <Text style={styles.mobileCardTitleDark}>Weitere Termine</Text>
                  <Text style={styles.mobileCardSubtitleDark}>Lehrgänge & Turniere</Text>
                </View>
                <Text style={styles.mobileCardCountDark}>{getTodayTermineCount()}</Text>
              </View>
            </DashboardCard>
          </View>
        </ScrollView>
      );
    }

    // Desktop Dashboard View
    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.gridContainer}>
          <View style={styles.row}>
            <DashboardCard id="spiele" style={[styles.mainCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]} onPress={() => setViewMode('spiele')} hoverStyle={styles.mainCardHovered}>
              <Text style={[styles.todayCountTopRight, { color: colors.text }]}>{getTodayGamesCount()}</Text>
              <View style={styles.mainCardContent}>
                <View style={styles.mainCardLeft}>
                  <Text style={[styles.mainCardTitle, { color: colors.text }]}>Spiele unserer Spieler</Text>
                  <Text style={[styles.mainCardSubtitle, { color: colors.textSecondary }]}>
                    {playerGames.length > 0
                      ? `${playerGames.length} Spiele in den nächsten 5 Wochen`
                      : 'Alle Partien deiner Mandanten\nim Überblick'
                    }
                  </Text>
                  <View style={styles.mainCardFooter}>
                    <Text style={[styles.mainCardLink, { color: colors.text }]}>Zur Übersicht</Text>
                    <Text style={[styles.mainCardArrow, { color: colors.text }]}>→</Text>
                  </View>
                </View>
                <View style={styles.mainCardRight}>
                </View>
              </View>
            </DashboardCard>
            <DashboardCard id="termine" style={[styles.termineCardFull, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]} onPress={() => setViewMode('termine')} hoverStyle={styles.lightCardHovered}>
              <Text style={[styles.todayCountTopRight, { color: colors.text }]}>{getTodayTermineCount()}</Text>
              <View style={styles.termineHeader}>
                <View style={[styles.termineIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={styles.termineIconText}>📋</Text></View>
              </View>
              <View style={styles.termineFooter}>
                <Text style={[styles.termineTitle, { color: colors.text }]}>Weitere Termine</Text>
                <Text style={[styles.termineSubtitle, { color: colors.textSecondary }]}>Lehrgänge, Sichtungen und Turniere</Text>
              </View>
            </DashboardCard>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderSpieleUnsererSpieler = () => {
    const isAnyDropdownOpen = showResponsibilityDropdown || showPlayerDropdown;

    const handleContainerPress = () => {
      if (isAnyDropdownOpen) {
        closeAllGameDropdowns();
      }
    };

    const getResponsibilityFilterLabel = () => {
      if (selectedResponsibilities.length === 0) return 'Zuständigkeit';
      if (selectedResponsibilities.length === 1) return selectedResponsibilities[0];
      return `${selectedResponsibilities.length} Zuständigkeiten`;
    };

    const getPlayerFilterLabel = () => {
      if (selectedPlayers.length === 0) return 'Spieler';
      if (selectedPlayers.length === 1) {
        const player = availablePlayers.find(p => p.id === selectedPlayers[0]);
        return player?.name || 'Spieler';
      }
      return `${selectedPlayers.length} Spieler`;
    };

    // Helper: Get game type from league
    const getGameArt = (league: string): string => {
      if (!league) return 'Sonstiges';
      const l = league.toLowerCase();
      if (l.includes('hallenturnier') || l.includes('hallen')) return 'Hallenturnier';
      if (l.includes('pokal') || l.includes('cup')) return 'Pokalspiel';
      if (l.includes('nachwuchsliga') || l.includes('bundesliga') || l.includes('meisterschaft') || l.includes('liga') || l.includes('league') || l.includes('dnl')) return 'Punktspiel';
      if (l.includes('freundschaft') || l.includes('friendly') || l.includes('testspiel') || l.includes('turnier')) return 'Freundschaftsspiel';
      return 'Sonstiges';
    };

    // Helper: Get age category
    const getAgeCategory = (game: any): string => {
      const playerLeague = game.playerLeague || game.player?.league || '';
      const ageMatch = playerLeague.match(/\bU[\s-]?(\d{2})\b/i);
      return ageMatch ? 'U' + ageMatch[1] : 'Herren';
    };

    // Mobile View
    if (isMobile) {
      const activeFilterCount = selectedPlayers.length + selectedResponsibilities.length;

      return (
        <View style={[styles.mobileGamesContainer, { backgroundColor: colors.background }]}>
          {/* Toolbar mit Zurück, Filter und Sync */}
          <View style={[styles.mobileGamesToolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity style={[styles.mobileGamesToolbarBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => setViewMode('dashboard')}>
              <Text style={[styles.mobileGamesToolbarBtnText, { color: colors.textSecondary }]}>← Zurück</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            {/* Alle auswählen / abwählen */}
            <TouchableOpacity
              style={[styles.mobileGamesIconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, areAllFilteredSelected() && styles.mobileGamesToolbarBtnActive]}
              onPress={toggleSelectAllFiltered}
            >
              <Ionicons name={areAllFilteredSelected() ? "checkbox" : "checkbox-outline"} size={18} color={areAllFilteredSelected() ? "#fff" : colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mobileGamesIconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, activeFilterCount > 0 && styles.mobileGamesToolbarBtnActive]}
              onPress={() => setShowPlayerDropdown(true)}
            >
              <Ionicons name="filter" size={18} color={activeFilterCount > 0 ? "#fff" : colors.textSecondary} />
              {activeFilterCount > 0 && (
                <Text style={styles.mobileGamesFilterCount}>{activeFilterCount}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mobileGamesIconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, syncingGames && { opacity: 0.6 }]}
              onPress={handleSyncGames}
              disabled={syncingGames}
            >
              <Text style={[styles.mobileGamesIconBtnText, { color: colors.textSecondary }]}>{syncingGames ? '⏳' : '↻'}</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Modal */}
          <Modal visible={showPlayerDropdown} transparent animationType="slide">
            <View style={[styles.mobileGamesFilterModal, { backgroundColor: colors.surface }]}>
              <View style={[styles.mobileGamesFilterHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.mobileGamesFilterTitle, { color: colors.text }]}>Filter</Text>
                <TouchableOpacity onPress={() => setShowPlayerDropdown(false)}>
                  <Text style={[styles.mobileGamesFilterClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.mobileGamesFilterContent}>
                {/* Spieler Filter */}
                <Text style={[styles.mobileGamesFilterSectionTitle, { color: colors.text }]}>Spieler</Text>
                <View style={styles.mobileGamesFilterChips}>
                  {availablePlayers.map(player => {
                    const isSelected = selectedPlayers.includes(player.id);
                    return (
                      <TouchableOpacity
                        key={player.id}
                        style={[styles.mobileGamesFilterChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, isSelected && styles.mobileGamesFilterChipActive]}
                        onPress={() => togglePlayer(player.id)}
                      >
                        <Text style={[styles.mobileGamesFilterChipText, { color: colors.textSecondary }, isSelected && styles.mobileGamesFilterChipTextActive]}>
                          {player.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Zuständigkeit Filter */}
                <Text style={[styles.mobileGamesFilterSectionTitle, { color: colors.text }]}>Zuständigkeit</Text>
                <View style={styles.mobileGamesFilterChips}>
                  {availableResponsibilities.map(resp => {
                    const isSelected = selectedResponsibilities.includes(resp);
                    return (
                      <TouchableOpacity
                        key={resp}
                        style={[styles.mobileGamesFilterChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, isSelected && styles.mobileGamesFilterChipActive]}
                        onPress={() => toggleResponsibility(resp)}
                      >
                        <Text style={[styles.mobileGamesFilterChipText, { color: colors.textSecondary }, isSelected && styles.mobileGamesFilterChipTextActive]}>
                          {resp}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={[styles.mobileGamesFilterFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.mobileGamesFilterClearBtn, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => { setSelectedPlayers([]); setSelectedResponsibilities([]); }}
                >
                  <Text style={[styles.mobileGamesFilterClearText, { color: colors.textSecondary }]}>Alle löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mobileGamesFilterApplyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setShowPlayerDropdown(false)}
                >
                  <Text style={[styles.mobileGamesFilterApplyText, { color: colors.primaryText }]}>Anwenden</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Sync Progress */}
          {syncingGames && syncProgress && (
            <View style={[styles.mobileSyncProgress, { backgroundColor: colors.surfaceSecondary }]}>
              <View style={[styles.mobileSyncProgressFill, { width: `${(syncProgress.current / syncProgress.total) * 100}%` }]} />
              <Text style={[styles.mobileSyncProgressText, { color: colors.text }]}>{syncProgress.playerName}</Text>
            </View>
          )}

          {/* Games List */}
          <ScrollView style={styles.mobileGamesList} contentContainerStyle={styles.mobileGamesListContent}>
            {filteredGames.length === 0 ? (
              <View style={styles.mobileGamesEmpty}>
                <Text style={styles.mobileGamesEmptyIcon}>⚽</Text>
                <Text style={[styles.mobileGamesEmptyTitle, { color: colors.textSecondary }]}>
                  {playerGames.length === 0 ? 'Noch keine Spiele geladen' : 'Keine Spiele gefunden'}
                </Text>
                {playerGames.length === 0 && (
                  <TouchableOpacity style={[styles.mobileGamesEmptyButton, { backgroundColor: colors.primary }]} onPress={handleSyncGames}>
                    <Text style={[styles.mobileGamesEmptyButtonText, { color: colors.primaryText }]}>Jetzt aktualisieren</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredGames.map(game => {
                const isToday = isGameToday(game.date);
                const ageCategory = getAgeCategory(game);
                const gameArt = getGameArt(game.league);
                const isHerren = ageCategory === 'Herren';
                const homeTeam = cleanTeamName(game.home_team, isHerren);
                const awayTeam = cleanTeamName(game.away_team, isHerren);
                const playerNames = (game as any).playerNames?.join(', ') || game.player_name;
                const homeLogo = getClubLogo(game.home_team);
                const awayLogo = getClubLogo(game.away_team);

                return (
                  <TouchableOpacity
                    key={game.id}
                    style={[styles.mobileGameCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }, isToday && { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5', borderColor: '#10b981' }]}
                    onPress={() => toggleGameSelection(game.id, game.selected)}
                    activeOpacity={0.7}
                  >
                    {/* Header: Mannschaft • Art + Datum */}
                    <View style={styles.mobileGameCardHeader}>
                      <Text style={[styles.mobileGameCardLeague, { color: colors.textSecondary }]}>{ageCategory} • {gameArt}</Text>
                      <Text style={[styles.mobileGameCardDate, { color: colors.text }]}>
                        {isToday ? 'Heute' : formatGameDate(game.date)}{game.time ? `, ${game.time}` : ''}
                      </Text>
                    </View>

                    {/* Teams in einer Zeile */}
                    <View style={styles.mobileGameCardMatch}>
                      <Text style={[styles.mobileGameCardTeamName, { color: colors.text }]} numberOfLines={1}>{homeTeam}</Text>
                      {homeLogo && <Image source={{ uri: homeLogo }} style={styles.mobileGameCardLogoInner} />}
                      <Text style={[styles.mobileGameCardSeparator, { color: colors.textSecondary }]}>-</Text>
                      {awayLogo && <Image source={{ uri: awayLogo }} style={styles.mobileGameCardLogo} />}
                      <Text style={[styles.mobileGameCardTeamName, { color: colors.text }]} numberOfLines={1}>{awayTeam}</Text>
                    </View>

                    {/* Players + Checkbox */}
                    <View style={[styles.mobileGameCardPlayers, { borderTopColor: colors.border }]}>
                      <Text style={styles.mobileGameCardPlayersLabel}>👤</Text>
                      <Text style={[styles.mobileGameCardPlayersText, { color: colors.textSecondary }]}>{playerNames}</Text>
                      <View style={[styles.mobileGameCardCheckbox, { backgroundColor: colors.surface, borderColor: colors.border }, game.selected && styles.mobileGameCardCheckboxSelected]}>
                        {game.selected && <Text style={styles.mobileGameCardCheckmark}>✓</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Floating Export Button */}
          {getSelectedGamesCount() > 0 && (
            <TouchableOpacity style={styles.mobileGamesFloatingExport} onPress={exportSelectedToCalendar}>
              <Text style={styles.mobileGamesFloatingExportText}>📅 {getSelectedGamesCount()}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Desktop View
    return (
      <View style={[styles.scoutingMainContent, { backgroundColor: colors.background }]}>
        {/* Header Banner */}
        <Pressable style={[styles.scoutingHeaderBanner, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} onPress={closeAllGameDropdowns}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => setViewMode('dashboard')}>
            <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.scoutingHeaderBannerCenter}>
            <Text style={[styles.scoutingTitle, { color: colors.text }]}>Spiele unserer Spieler</Text>
            <Text style={[styles.scoutingSubtitle, { color: colors.textSecondary }]}>
              {playersWithUrl.length} Spieler • {playerGames.length} Spiele geladen
            </Text>
          </View>
          <View style={styles.headerButtonsRow}>
            {getSelectedGamesCount() > 0 && (
              <TouchableOpacity style={styles.exportButton} onPress={exportSelectedToCalendar}>
                <Text style={styles.exportButtonText}>📅 {getSelectedGamesCount()} exportieren</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.scoutingFilterButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, syncingGames && { opacity: 0.6 }]}
              onPress={handleSyncGames}
              disabled={syncingGames}
            >
              <Text style={[styles.scoutingFilterButtonText, { color: colors.textSecondary }]}>
                {syncingGames
                  ? (syncProgress ? `⏳ ${syncProgress.current}/${syncProgress.total}` : '⏳ Lädt...')
                  : 'Aktualisieren'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>

        {/* Sync Progress */}
        {syncingGames && syncProgress && (
          <View style={[styles.syncProgressBar, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={[styles.syncProgressFill, { width: `${(syncProgress.current / syncProgress.total) * 100}%` }]} />
            <Text style={[styles.syncProgressText, { color: colors.text }]}>
              Lade Spiele für: {syncProgress.playerName}
            </Text>
          </View>
        )}

        {/* Sync Result */}
        {gameSyncResult && !syncingGames && (
          <View style={[styles.syncResultBanner, gameSyncResult.errors.length > 0 ? styles.syncResultWarning : { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#bbf7d0' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.syncResultText, { color: gameSyncResult.errors.length > 0 ? '#991b1b' : colors.text }]}>
                ✓ {gameSyncResult.added > 0 ? `${gameSyncResult.added} neue Spiele` : 'Spiele aktualisiert'}
                {gameSyncResult.deleted > 0 && ` • ${gameSyncResult.deleted} Spiele entfernt`}
                {gameSyncResult.errors.length > 0 && ` • ${gameSyncResult.errors.length} Fehler`}
              </Text>
              {gameSyncResult.errors.map((err, i) => (
                <Text key={i} style={{ color: '#991b1b', fontSize: 12, marginTop: 2 }}>⚠ {err}</Text>
              ))}
            </View>
            <TouchableOpacity onPress={() => setGameSyncResult(null)}>
              <Text style={[styles.syncResultClose, { color: gameSyncResult.errors.length > 0 ? '#991b1b' : colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Toolbar */}
        <Pressable style={[styles.scoutingToolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} onPress={closeAllGameDropdowns}>
          <Pressable style={[styles.spieleSearchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={closeAllGameDropdowns}>
            <Text style={styles.scoutingSearchIcon}>🔍</Text>
            <TextInput
              style={[styles.scoutingSearchInput, { color: colors.text }]}
              placeholder="Spieler, Verein suchen..." 
              placeholderTextColor={colors.textMuted}
              value={gamesSearchText}
              onChangeText={setGamesSearchText}
              onFocus={closeAllGameDropdowns}
            />
          </Pressable>

          <View style={styles.scoutingFilterContainer}>
            {/* Spieler Filter */}
            <View style={[styles.scoutingDropdownContainer, { zIndex: 40 }]}>
              <TouchableOpacity
                style={[styles.scoutingFilterButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, selectedPlayers.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                onPress={(e) => { e.stopPropagation(); setShowPlayerDropdown(!showPlayerDropdown); setShowResponsibilityDropdown(false); }}
              >
                <Text style={[styles.scoutingFilterButtonText, { color: colors.textSecondary }, selectedPlayers.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>
                  {getPlayerFilterLabel()} ▼
                </Text>
              </TouchableOpacity>
              {showPlayerDropdown && (
                <Pressable style={[styles.scoutingFilterDropdownMulti, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
                  <View style={[styles.scoutingFilterDropdownHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
                    <Text style={[styles.scoutingFilterDropdownTitle, { color: colors.textSecondary }]}>Spieler wählen</Text>
                    {selectedPlayers.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedPlayers([])}>
                        <Text style={styles.scoutingFilterClearText}>Alle löschen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availablePlayers.length === 0 ? (
                      <Text style={[styles.scoutingNoDataText, { color: colors.textMuted }]}>Keine Spieler mit Spielen</Text>
                    ) : (
                      availablePlayers.map(player => {
                        const isSelected = selectedPlayers.includes(player.id);
                        const count = playerGames.filter(g => g.player_id === player.id).length;
                        return (
                          <TouchableOpacity key={player.id} style={[styles.scoutingFilterCheckboxItem, { borderBottomColor: colors.border }]} onPress={() => togglePlayer(player.id)}>
                            <View style={[styles.scoutingCheckbox, { borderColor: colors.border }, isSelected && styles.scoutingCheckboxSelected]}>
                              {isSelected && <Text style={styles.scoutingCheckmark}>✓</Text>}
                            </View>
                            <Text style={[styles.scoutingFilterCheckboxText, { color: colors.text }]}>{player.name}</Text>
                            <Text style={[styles.scoutingFilterCountBadge, { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary }]}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  <TouchableOpacity style={[styles.scoutingFilterDoneButton, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border }]} onPress={() => setShowPlayerDropdown(false)}>
                    <Text style={styles.scoutingFilterDoneText}>Fertig</Text>
                  </TouchableOpacity>
                </Pressable>
              )}
            </View>

            {/* Zuständigkeit Filter */}
            <View style={[styles.scoutingDropdownContainer, { zIndex: 30 }]}>
              <TouchableOpacity
                style={[styles.scoutingFilterButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, selectedResponsibilities.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                onPress={(e) => { e.stopPropagation(); setShowResponsibilityDropdown(!showResponsibilityDropdown); setShowPlayerDropdown(false); }}
              >
                <Text style={[styles.scoutingFilterButtonText, { color: colors.textSecondary }, selectedResponsibilities.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>
                  {getResponsibilityFilterLabel()} ▼
                </Text>
              </TouchableOpacity>
              {showResponsibilityDropdown && (
                <Pressable style={[styles.scoutingFilterDropdownMulti, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
                  <View style={[styles.scoutingFilterDropdownHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
                    <Text style={[styles.scoutingFilterDropdownTitle, { color: colors.textSecondary }]}>Zuständigkeit wählen</Text>
                    {selectedResponsibilities.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedResponsibilities([])}>
                        <Text style={styles.scoutingFilterClearText}>Alle löschen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availableResponsibilities.length === 0 ? (
                      <Text style={[styles.scoutingNoDataText, { color: colors.textMuted }]}>Keine Zuständigkeiten</Text>
                    ) : (
                      availableResponsibilities.map(resp => {
                        const isSelected = selectedResponsibilities.includes(resp);
                        // Zähle Spiele wo dieser Berater im responsibility-String enthalten ist
                        const count = playerGames.filter(g => {
                          const respStr = g.player?.responsibility || '';
                          return respStr.split(/,\s*|&\s*/).map(s => s.trim()).includes(resp);
                        }).length;
                        return (
                          <TouchableOpacity key={resp} style={[styles.scoutingFilterCheckboxItem, { borderBottomColor: colors.border }]} onPress={() => toggleResponsibility(resp)}>
                            <View style={[styles.scoutingCheckbox, { borderColor: colors.border }, isSelected && styles.scoutingCheckboxSelected]}>
                              {isSelected && <Text style={styles.scoutingCheckmark}>✓</Text>}
                            </View>
                            <Text style={[styles.scoutingFilterCheckboxText, { color: colors.text }]}>{resp}</Text>
                            <Text style={[styles.scoutingFilterCountBadge, { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary }]}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  <TouchableOpacity style={[styles.scoutingFilterDoneButton, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border }]} onPress={() => setShowResponsibilityDropdown(false)}>
                    <Text style={styles.scoutingFilterDoneText}>Fertig</Text>
                  </TouchableOpacity>
                </Pressable>
              )}
            </View>
          </View>
        </Pressable>

        {/* Tabelle */}
        <Pressable style={styles.scoutingContent} onPress={closeAllGameDropdowns}>
          <View style={[styles.scoutingGamesContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.scoutingTableHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.scoutingTableHeaderCell, { width: 40 }]}
                onPress={toggleSelectAllFiltered}
              >
                <View style={[styles.gameCheckbox, { backgroundColor: colors.surface, borderColor: colors.border }, areAllFilteredSelected() && styles.gameCheckboxSelected]}>
                  {areAllFilteredSelected() && <Text style={styles.gameCheckmark}>✓</Text>}
                </View>
              </TouchableOpacity>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 0.8, color: colors.textSecondary }]}>Datum</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 0.5, color: colors.textSecondary }]}>Zeit</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 0.8, color: colors.textSecondary }]}>Mannschaft</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 2.2, color: colors.textSecondary }]}>Spiel</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 0.7, color: colors.textSecondary }]}>Art</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 0.5, color: colors.textSecondary, textAlign: 'left' }]}>Link</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1.2, color: colors.textSecondary }]}>Spieler</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1.2, color: colors.textSecondary }]}>Zuständigkeit</Text>
            </View>
            <ScrollView onScrollBeginDrag={closeAllGameDropdowns}>
              {filteredGames.length === 0 ? (
                <View style={styles.scoutingEmptyState}>
                  {playersWithUrl.length === 0 ? (
                    <>
                      <Text style={styles.scoutingEmptyIcon}>👤</Text>
                      <Text style={[styles.scoutingEmptyTitle, { color: colors.text }]}>Keine Spieler mit fussball.de URL</Text>
                      <Text style={[styles.scoutingEmptyText, { color: colors.textSecondary }]}>
                        Trage zuerst im Spielerprofil die fussball.de URL ein.{'\n'}
                        Die URL findest du auf fussball.de bei der Mannschaft deines Spielers.
                      </Text>
                    </>
                  ) : playerGames.length === 0 ? (
                    <>
                      <Text style={styles.scoutingEmptyIcon}>⚽</Text>
                      <Text style={[styles.scoutingEmptyTitle, { color: colors.text }]}>Noch keine Spiele geladen</Text>
                      <Text style={[styles.scoutingEmptyText, { color: colors.textSecondary }]}>
                        Klicke auf "Aktualisieren" um die Spielpläne{'\n'}von fussball.de zu synchronisieren.
                      </Text>
                      <TouchableOpacity style={styles.emptyStateButton} onPress={handleSyncGames}>
                        <Text style={styles.emptyStateButtonText}>Jetzt aktualisieren</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.scoutingEmptyIcon}>🔍</Text>
                      <Text style={[styles.scoutingEmptyTitle, { color: colors.text }]}>Keine Spiele gefunden</Text>
                      <Text style={[styles.scoutingEmptyText, { color: colors.textSecondary }]}>Ändere die Filterkriterien</Text>
                    </>
                  )}
                </View>
              ) : (
                filteredGames.map(game => {
                  const isToday = isGameToday(game.date);

                  // Art aus dem League-Feld ableiten
                  const getGameArt = (league: string): string => {
                    if (!league) return 'Sonstiges';
                    const l = league.toLowerCase();
                    if (l.includes('hallenturnier') || l.includes('hallen')) return 'Hallenturnier';
                    if (l.includes('pokal') || l.includes('cup')) return 'Pokalspiel';
                    if (l.includes('nachwuchsliga') || l.includes('bundesliga') || l.includes('meisterschaft') || l.includes('liga') || l.includes('league') || l.includes('dnl')) return 'Punktspiel';
                    if (l.includes('freundschaft') || l.includes('friendly') || l.includes('testspiel') || l.includes('turnier')) return 'Freundschaftsspiel';
                    return 'Sonstiges';
                  };

                  return (
                    <View key={game.id} style={[
                      styles.scoutingTableRow,
                      { borderBottomColor: colors.border },
                      isToday && { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' }
                    ]}>
                      <TouchableOpacity
                        style={[styles.scoutingTableCell, { width: 40 }]}
                        onPress={() => toggleGameSelection(game.id, game.selected)}
                      >
                        <View style={[styles.gameCheckbox, { backgroundColor: colors.surface, borderColor: colors.border }, game.selected && styles.gameCheckboxSelected]}>
                          {game.selected && <Text style={styles.gameCheckmark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                      <Text style={[styles.scoutingTableCell, { flex: 0.8, color: colors.text }, isToday && styles.textBold]}>
                        {formatGameDate(game.date)}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 0.5, color: colors.text }]}>
                        {game.time || '-'}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 0.8, color: colors.text }]} numberOfLines={1}>
                        {(() => {
                          // Altersklasse aus Spielerprofil-Liga extrahieren (z.B. "U17 Bundesliga")
                          const playerLeague = (game as any).playerLeague || game.player?.league || '';

                          // U-Mannschaft aus Spielerprofil-Liga extrahieren
                          const ageMatch = playerLeague.match(/\bU[\s-]?(\d{2})\b/i);
                          if (ageMatch) return 'U' + ageMatch[1];

                          // Keine U-Mannschaft gefunden = Herren
                          return 'Herren';
                        })()}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 2.2, color: colors.text }]} numberOfLines={1}>
                        {(() => {
                          const pl = (game as any).playerLeague || game.player?.league || '';
                          const isHerren = !pl.match(/\bU[\s-]?\d{2}\b/i);
                          return `${cleanTeamName(game.home_team, isHerren)} - ${cleanTeamName(game.away_team, isHerren)}`;
                        })()}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 0.7, color: colors.text }]} numberOfLines={1}>
                        {getGameArt(game.league)}
                      </Text>
                      <TouchableOpacity
                        style={[styles.scoutingTableCell, { flex: 0.5, justifyContent: 'center', alignItems: 'flex-start' }]}
                        onPress={() => {
                          const url = game.game_url || game.player?.fussball_de_url;
                          if (url) {
                            const fullUrl = url.startsWith('http') ? url : `https://www.fussball.de${url}`;
                            const clean = fullUrl.includes('google.com/url')
                              ? decodeURIComponent(fullUrl.match(/[?&]q=([^&]+)/)?.[1] || fullUrl)
                              : fullUrl;
                            Linking.openURL(clean);
                          }
                        }}
                        disabled={!game.game_url && !game.player?.fussball_de_url}
                      >
                        <Text style={{ fontSize: 14, color: (game.game_url || game.player?.fussball_de_url) ? '#3b82f6' : colors.textMuted }}>
                          {(game.game_url || game.player?.fussball_de_url) ? '↗' : '-'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={[styles.scoutingTableCell, { flex: 1.2, fontWeight: '600', color: colors.text }]} numberOfLines={2}>
                        {(game as any).playerNames?.join(', ') || game.player_name}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 1.2, color: colors.text }]} numberOfLines={1}>
                        {(game as any).playerResponsibilities?.map((r: string) => formatResponsibilityInitials(r)).join(', ') || formatResponsibilityInitials(game.player?.responsibility)}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Pressable>
      </View>
    );
  };

  const renderWeitereTermine = () => {
    // Alle Termine holen
    const allTermine = getSortedTermine();

    // Vergangene Termine für Archiv
    const archivTermine = allTermine
      .filter(t => isTerminPast(t.datum, t.datum_ende))
      .filter(t => {
        if (!termineSearchText) return true;
        const search = termineSearchText.toLowerCase();
        return (
          t.titel?.toLowerCase().includes(search) ||
          t.ort?.toLowerCase().includes(search) ||
          t.art?.toLowerCase().includes(search) ||
          t.jahrgang?.toLowerCase().includes(search)
        );
      })
      .filter(t => {
        if (termineJahrgangFilter.length === 0) return true;
        return termineJahrgangFilter.includes(t.jahrgang || '');
      });

    // Aktuelle/zukünftige Termine
    const filteredTermine = allTermine
      .filter(t => !isTerminPast(t.datum, t.datum_ende))
      .filter(t => {
        if (!termineSearchText) return true;
        const search = termineSearchText.toLowerCase();
        return (
          t.titel?.toLowerCase().includes(search) ||
          t.ort?.toLowerCase().includes(search) ||
          t.art?.toLowerCase().includes(search) ||
          t.jahrgang?.toLowerCase().includes(search)
        );
      })
      .filter(t => {
        if (termineJahrgangFilter.length === 0) return true;
        return termineJahrgangFilter.includes(t.jahrgang || '');
      });

    const dfbCount = getLocalDFBCount();
    const hallenCount = getLocalHallenCount();

    // Verfügbare Jahrgänge aus allen Terminen
    const availableJahrgaenge = Array.from(new Set(allTermine.map(t => t.jahrgang).filter(Boolean))) as string[];

    const displayTermine = showTermineArchiv ? archivTermine : filteredTermine;

    const getJahrgangFilterLabel = () => {
      if (termineJahrgangFilter.length === 0) return 'Jahrgang';
      if (termineJahrgangFilter.length === 1) return termineJahrgangFilter[0];
      return `${termineJahrgangFilter.length} Jahrgänge`;
    };

    const toggleJahrgangFilter = (jg: string) => {
      setTermineJahrgangFilter(prev =>
        prev.includes(jg) ? prev.filter(j => j !== jg) : [...prev, jg]
      );
    };

    // Mobile View
    if (isMobile) {
      const activeFilterCount = termineJahrgangFilter.length;
      const areAllDisplayedTermineSelected = displayTermine.length > 0 && displayTermine.every(t => selectedTermineIds.includes(t.id));

      const toggleSelectAllTermine = () => {
        if (areAllDisplayedTermineSelected) {
          // Alle abwählen
          setSelectedTermineIds(prev => prev.filter(id => !displayTermine.some(t => t.id === id)));
        } else {
          // Alle auswählen
          setSelectedTermineIds(prev => [...new Set([...prev, ...displayTermine.map(t => t.id)])]);
        }
      };

      return (
        <View style={[styles.mobileTermineContainer, { backgroundColor: colors.background }]}>
          {/* Toolbar */}
          <View style={[styles.mobileTermineToolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity style={[styles.mobileGamesToolbarBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => setViewMode('dashboard')}>
              <Text style={[styles.mobileGamesToolbarBtnText, { color: colors.textSecondary }]}>← Zurück</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={[styles.mobileGamesIconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, areAllDisplayedTermineSelected && styles.mobileGamesToolbarBtnActive]}
              onPress={toggleSelectAllTermine}
            >
              <Ionicons name={areAllDisplayedTermineSelected ? "checkbox" : "checkbox-outline"} size={18} color={areAllDisplayedTermineSelected ? "#fff" : colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mobileGamesIconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, activeFilterCount > 0 && styles.mobileGamesToolbarBtnActive]}
              onPress={() => setShowTermineJahrgangDropdown(true)}
            >
              <Ionicons name="filter" size={18} color={activeFilterCount > 0 ? "#fff" : colors.textSecondary} />
              {activeFilterCount > 0 && (
                <Text style={styles.mobileGamesFilterCount}>{activeFilterCount}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.mobileGamesIconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => setShowSyncModal(true)}>
              <Text style={[styles.mobileGamesIconBtnText, { color: colors.textSecondary }]}>↻</Text>
            </TouchableOpacity>
          </View>

          {/* Anstehend / Archiv Toggle */}
          <View style={[styles.mobileTermineToggle, { backgroundColor: colors.surfaceSecondary }]}>
            <TouchableOpacity
              style={[styles.mobileTermineToggleBtn, !showTermineArchiv && [styles.mobileTermineToggleBtnActive, { backgroundColor: colors.surface }]]}
              onPress={() => setShowTermineArchiv(false)}
            >
              <Text style={[styles.mobileTermineToggleBtnText, { color: colors.textSecondary }, !showTermineArchiv && { color: colors.text }]}>
                Anstehend ({filteredTermine.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mobileTermineToggleBtn, showTermineArchiv && [styles.mobileTermineToggleBtnActive, { backgroundColor: colors.surface }]]}
              onPress={() => setShowTermineArchiv(true)}
            >
              <Text style={[styles.mobileTermineToggleBtnText, { color: colors.textSecondary }, showTermineArchiv && { color: colors.text }]}>
                Archiv ({archivTermine.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter Modal */}
          <Modal visible={showTermineJahrgangDropdown} transparent animationType="slide">
            <View style={[styles.mobileGamesFilterModal, { backgroundColor: colors.surface }]}>
              <View style={[styles.mobileGamesFilterHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.mobileGamesFilterTitle, { color: colors.text }]}>Filter</Text>
                <TouchableOpacity onPress={() => setShowTermineJahrgangDropdown(false)}>
                  <Text style={[styles.mobileGamesFilterClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.mobileGamesFilterContent}>
                <Text style={[styles.mobileGamesFilterSectionTitle, { color: colors.text }]}>Jahrgang</Text>
                <View style={styles.mobileGamesFilterChips}>
                  {availableJahrgaenge.sort().map(jg => {
                    const isSelected = termineJahrgangFilter.includes(jg);
                    return (
                      <TouchableOpacity
                        key={jg}
                        style={[styles.mobileGamesFilterChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, isSelected && styles.mobileGamesFilterChipActive]}
                        onPress={() => toggleJahrgangFilter(jg)}
                      >
                        <Text style={[styles.mobileGamesFilterChipText, { color: colors.textSecondary }, isSelected && styles.mobileGamesFilterChipTextActive]}>
                          {jg}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={[styles.mobileGamesFilterFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.mobileGamesFilterClearBtn, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => setTermineJahrgangFilter([])}
                >
                  <Text style={[styles.mobileGamesFilterClearText, { color: colors.textSecondary }]}>Alle löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mobileGamesFilterApplyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setShowTermineJahrgangDropdown(false)}
                >
                  <Text style={[styles.mobileGamesFilterApplyText, { color: colors.primaryText }]}>Anwenden</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Termine Liste */}
          <ScrollView style={styles.mobileTermineList} contentContainerStyle={styles.mobileTermineListContent}>
            {loading ? (
              <View style={styles.mobileGamesEmpty}>
                <Text style={[styles.mobileGamesEmptyTitle, { color: colors.textSecondary }]}>Laden...</Text>
              </View>
            ) : displayTermine.length === 0 ? (
              <View style={styles.mobileGamesEmpty}>
                <Text style={styles.mobileGamesEmptyIcon}>📋</Text>
                <Text style={[styles.mobileGamesEmptyTitle, { color: colors.textSecondary }]}>
                  {showTermineArchiv ? 'Keine vergangenen Termine' : 'Keine Termine vorhanden'}
                </Text>
                {!showTermineArchiv && (
                  <TouchableOpacity style={[styles.mobileGamesEmptyButton, { backgroundColor: colors.primary }]} onPress={() => setShowSyncModal(true)}>
                    <Text style={[styles.mobileGamesEmptyButtonText, { color: colors.primaryText }]}>Termine laden</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              displayTermine.map(termin => {
                const isRunning = isTerminCurrentlyRunning(termin);
                const isPast = showTermineArchiv;
                const isNM = isNationalmannschaft(termin);
                const isHT = isHallenturnier(termin);
                const time = formatTime(termin.datum);
                const isSelected = selectedTermineIds.includes(termin.id);

                return (
                  <TouchableOpacity
                    key={termin.id}
                    style={[
                      styles.mobileTerminCard,
                      { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                      isRunning && !isPast && { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7', borderColor: '#10b981' },
                      isPast && { backgroundColor: colors.surfaceSecondary }
                    ]}
                    onPress={() => toggleTerminSelection(termin.id)}
                    onLongPress={() => openEditModal(termin)}
                    activeOpacity={0.7}
                  >
                    {/* Header: Jahrgang • Art + Datum */}
                    <View style={styles.mobileTerminCardHeader}>
                      <Text style={[styles.mobileTerminCardCategory, { color: isPast ? colors.textMuted : colors.textSecondary }]}>
                        {termin.jahrgang || ''}{termin.jahrgang && ' • '}{isNM ? 'Nationalmannschaft' : isHT ? 'Hallenturnier' : getDisplayArt(termin.art)}
                      </Text>
                      <Text style={[styles.mobileTerminCardDate, { color: isPast ? colors.textMuted : colors.textSecondary }]}>
                        {formatDate(termin)}{time ? `, ${time}` : ''}
                      </Text>
                    </View>

                    {/* Mitte: Turniername */}
                    <View style={styles.mobileTerminCardCenter}>
                      <Text style={[styles.mobileTerminCardTitle, { color: isPast ? colors.textSecondary : colors.text }]} numberOfLines={2}>
                        {termin.titel}
                      </Text>
                    </View>

                    {/* Footer: Ort + Checkbox */}
                    <View style={[styles.mobileTerminCardFooter, { borderTopColor: colors.border }]}>
                      {termin.ort ? (
                        <>
                          <Text style={styles.mobileTerminCardOrtLabel}>📍</Text>
                          <Text style={[styles.mobileTerminCardOrt, { color: isPast ? colors.textMuted : colors.textSecondary }]} numberOfLines={1}>
                            {termin.ort}
                          </Text>
                        </>
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}
                      <View style={[styles.mobileGameCardCheckbox, { backgroundColor: colors.surface, borderColor: colors.border }, isSelected && styles.mobileGameCardCheckboxSelected]}>
                        {isSelected && <Text style={styles.mobileGameCardCheckmark}>✓</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Floating Export Button */}
          {getSelectedTermineCount() > 0 && (
            <TouchableOpacity style={styles.mobileGamesFloatingExport} onPress={exportSelectedTermineToCalendar}>
              <Text style={styles.mobileGamesFloatingExportText}>📅 {getSelectedTermineCount()}</Text>
            </TouchableOpacity>
          )}

          {/* Floating Add Button */}
          <TouchableOpacity style={[styles.mobileTermineAddBtn, { backgroundColor: colors.primary }, getSelectedTermineCount() > 0 && { bottom: 80 }]} onPress={openAddModal}>
            <Text style={[styles.mobileTermineAddBtnText, { color: colors.primaryText }]}>+</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Desktop View
    return (
      <View style={[styles.scoutingMainContent, { backgroundColor: colors.background }]}>
        <View style={[styles.scoutingHeaderBanner, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => setViewMode('dashboard')}>
            <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.scoutingHeaderBannerCenter}>
            <Text style={[styles.scoutingTitle, { color: colors.text }]}>Weitere Termine</Text>
            <Text style={[styles.scoutingSubtitle, { color: colors.textSecondary }]}>{dfbCount} Lehrgänge & Sichtungen • {hallenCount} Turniere</Text>
          </View>
          <View style={styles.termineHeaderButtons}>
            <TouchableOpacity onPress={() => setShowSyncModal(true)} style={[styles.scoutingFilterButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.scoutingFilterButtonText, { color: colors.textSecondary }]}>Aktualisieren</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Suchleiste mit Jahrgang-Filter, Archiv und Neuer Termin */}
        <Pressable style={[styles.scoutingToolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} onPress={() => setShowTermineJahrgangDropdown(false)}>
          <View style={[styles.spieleSearchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
            <Text style={styles.scoutingSearchIcon}>🔍</Text>
            <TextInput
              style={[styles.scoutingSearchInput, { color: colors.text }]}
              placeholder="Event, Ort, Art suchen..."
              placeholderTextColor={colors.textMuted}
              value={termineSearchText}
              onChangeText={setTermineSearchText}
              onFocus={() => setShowTermineJahrgangDropdown(false)}
            />
          </View>

          <View style={styles.scoutingFilterContainer}>
            {/* Jahrgang Filter */}
            <View style={[styles.scoutingDropdownContainer, { zIndex: 40 }]}>
              <TouchableOpacity
                style={[styles.scoutingFilterButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, termineJahrgangFilter.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                onPress={(e) => { e.stopPropagation(); setShowTermineJahrgangDropdown(!showTermineJahrgangDropdown); }}
              >
                <Text style={[styles.scoutingFilterButtonText, { color: colors.textSecondary }, termineJahrgangFilter.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>
                  {getJahrgangFilterLabel()} ▼
                </Text>
              </TouchableOpacity>
              {showTermineJahrgangDropdown && (
                <Pressable style={[styles.scoutingFilterDropdownMulti, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
                  <View style={[styles.scoutingFilterDropdownHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
                    <Text style={[styles.scoutingFilterDropdownTitle, { color: colors.textSecondary }]}>Jahrgang wählen</Text>
                    {termineJahrgangFilter.length > 0 && (
                      <TouchableOpacity onPress={() => setTermineJahrgangFilter([])}>
                        <Text style={styles.scoutingFilterClearText}>Alle löschen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availableJahrgaenge.length === 0 ? (
                      <Text style={[styles.scoutingNoDataText, { color: colors.textMuted }]}>Keine Jahrgänge vorhanden</Text>
                    ) : (
                      availableJahrgaenge.sort().map(jg => {
                        const isSelected = termineJahrgangFilter.includes(jg);
                        const count = displayTermine.filter(t => t.jahrgang === jg).length;
                        return (
                          <TouchableOpacity key={jg} style={[styles.scoutingFilterCheckboxItem, { borderBottomColor: colors.border }]} onPress={() => toggleJahrgangFilter(jg)}>
                            <View style={[styles.scoutingCheckbox, { borderColor: colors.border }, isSelected && styles.scoutingCheckboxSelected]}>
                              {isSelected && <Text style={styles.scoutingCheckmark}>✓</Text>}
                            </View>
                            <Text style={[styles.scoutingFilterCheckboxText, { color: colors.text }]}>{jg}</Text>
                            <Text style={[styles.scoutingFilterCountBadge, { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary }]}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  <TouchableOpacity style={[styles.scoutingFilterDoneButton, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border }]} onPress={() => setShowTermineJahrgangDropdown(false)}>
                    <Text style={styles.scoutingFilterDoneText}>Fertig</Text>
                  </TouchableOpacity>
                </Pressable>
              )}
            </View>

            {/* Anstehend / Archiv Toggle + Neuer Termin */}
            <TouchableOpacity
              onPress={() => setShowTermineArchiv(false)}
              style={[styles.scoutingFilterButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, !showTermineArchiv && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
            >
              <Text style={[styles.scoutingFilterButtonText, { color: colors.textSecondary }, !showTermineArchiv && { color: isDark ? '#93c5fd' : '#0369a1' }]}>
                Anstehend ({filteredTermine.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowTermineArchiv(true)}
              style={[styles.scoutingFilterButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, showTermineArchiv && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
            >
              <Text style={[styles.scoutingFilterButtonText, { color: colors.textSecondary }, showTermineArchiv && { color: isDark ? '#93c5fd' : '#0369a1' }]}>
                Archiv ({archivTermine.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openAddModal} style={[styles.scoutingFilterButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.scoutingFilterButtonText, { color: colors.textSecondary }]}>+ Neuer Termin</Text>
            </TouchableOpacity>
          </View>
        </Pressable>

        <View style={styles.scoutingContent}>
          <View style={[styles.scoutingGamesContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.termineTableHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
              <SortableHeader field="datum" label="Datum" style={styles.termineColDatum} />
              <View style={styles.termineColZeit}><Text style={[styles.termineTableHeaderText, { color: colors.textSecondary }]}>Zeit</Text></View>
              <SortableHeader field="art" label="Art" style={styles.termineColArt} />
              <SortableHeader field="titel" label="Beschreibung" style={styles.termineColTitel} />
              <SortableHeader field="jahrgang" label="Jahrgang" style={styles.termineColJahrgang} />
              <SortableHeader field="ort" label="Ort" style={styles.termineColOrt} />
              <SortableHeader field="uebernahme" label="Übernahme" style={styles.termineColUebernahme} />
            </View>

            <ScrollView>
              {loading ? (
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Laden...</Text>
              ) : displayTermine.length === 0 ? (
                <View style={styles.scoutingEmptyState}>
                  <Text style={[styles.scoutingEmptyText, { color: colors.textSecondary }]}>
                    {termineSearchText || termineJahrgangFilter.length > 0
                      ? 'Keine Treffer gefunden'
                      : showTermineArchiv
                        ? 'Keine vergangenen Termine'
                        : 'Keine Termine vorhanden'
                    }
                  </Text>
                  {!termineSearchText && !showTermineArchiv && termineJahrgangFilter.length === 0 && (
                    <TouchableOpacity onPress={() => setShowSyncModal(true)} style={[styles.scoutingFilterButton, { marginTop: 16, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      <Text style={[styles.scoutingFilterButtonText, { color: colors.textSecondary }]}>DFB & Hallen-Termine laden</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                displayTermine.map((termin) => {
                  const isRunning = isTerminCurrentlyRunning(termin);
                  const isPast = showTermineArchiv;
                  const isNM = isNationalmannschaft(termin);
                  const isHT = isHallenturnier(termin);
                  const time = formatTime(termin.datum);

                  return (
                    <TouchableOpacity
                      key={termin.id}
                      style={[
                        styles.termineTableRow,
                        { backgroundColor: colors.cardBackground, borderBottomColor: colors.border },
                        isRunning && !isPast && { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7' },
                        isPast && { backgroundColor: colors.surfaceSecondary }
                      ]}
                      onPress={() => openEditModal(termin)}
                    >
                      <Text style={[styles.termineTableCell, styles.termineColDatum, { color: isPast ? colors.textMuted : colors.text }]}>{formatDate(termin)}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColZeit, { color: isPast ? colors.textMuted : colors.text }]}>{time || '-'}</Text>
                      <View style={styles.termineColArt}>
                        <View style={[
                          styles.artBadge,
                          isNM ? styles.artNationalmannschaft : isHT ? styles.artHallenturnier : styles.artSonstige,
                          isPast && styles.artBadgeArchiv
                        ]}>
                          <Text style={[
                            styles.artBadgeText,
                            isNM ? styles.artNationalmannschaftText : isHT ? styles.artHallenturnierText : null
                          ]}>
                            {isNM ? 'Nationalmannschaft' : isHT ? 'Hallenturnier' : getDisplayArt(termin.art)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.termineTableCell, styles.termineColTitel, { color: isPast ? colors.textMuted : colors.text }]} numberOfLines={1}>{termin.titel}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColJahrgang, { color: isPast ? colors.textMuted : colors.text }]}>{termin.jahrgang || '-'}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColOrt, { color: isPast ? colors.textMuted : colors.text }]} numberOfLines={1}>{termin.ort || '-'}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColUebernahme, { color: isPast ? colors.textMuted : colors.text }]}>{getAdvisorName(termin.uebernahme_advisor_id)}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const renderKalenderPlaceholder = () => (
    <View style={[styles.placeholderContainer, { backgroundColor: colors.background }]}>
      <TouchableOpacity onPress={() => setViewMode('dashboard')} style={styles.backButtonTop}>
        <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderIcon}>📅</Text>
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>Kalenderansicht</Text>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>Übersichtliche Monatsansicht mit allen Terminen{'\n'}und Export-Funktion.</Text>
        <View style={[styles.comingSoonLarge, { backgroundColor: isDark ? 'rgba(255, 243, 205, 0.2)' : '#fff3cd' }]}><Text style={[styles.comingSoonLargeText, { color: isDark ? '#fbbf24' : '#856404' }]}>COMING SOON</Text></View>
      </View>
    </View>
  );

  const renderAddEditModal = (isEdit: boolean) => {
    const showModal = isEdit ? showEditModal : showAddModal;
    const datumParts = parseDateToParts(formDatum);
    const datumEndeParts = parseDateToParts(formDatumEnde);

    // Mobile Modal
    if (isMobile) {
      return (
        <Modal visible={showModal} transparent animationType="slide">
          <View style={styles.mobileModalOverlay}>
            <View style={[styles.mobileModalContent, { backgroundColor: colors.surface }]}>
              <View style={[styles.mobileModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.mobileModalTitle, { color: colors.text }]}>{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</Text>
                <TouchableOpacity onPress={() => { isEdit ? setShowEditModal(false) : setShowAddModal(false); resetForm(); closeAllModalDropdowns(); }}>
                  <Text style={[styles.mobileModalClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.mobileModalScroll} nestedScrollEnabled>
                {/* Datum Von */}
                <Text style={[styles.mobileFormLabel, { color: colors.textSecondary }]}>Datum von *</Text>
                <View style={[styles.mobileFormRow, { zIndex: 100 }]}>
                  <View style={[styles.mobileFormThird, styles.dropdownWrapper]}>
                    <TouchableOpacity style={[styles.mobileDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => { closeAllModalDropdowns(); setShowDatumDropdown(showDatumDropdown === 'day' ? null : 'day'); }}>
                      <Text style={[styles.mobileDropdownButtonText, { color: colors.text }]}>{datumParts?.day || 'Tag'}</Text>
                      <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                    </TouchableOpacity>
                    {showDatumDropdown === 'day' && (
                      <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>{DAYS.map(d => (
                        <TouchableOpacity key={d} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumPart('day', d)}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{d}</Text></TouchableOpacity>
                      ))}</ScrollView>
                    )}
                  </View>
                  <View style={[styles.mobileFormThird, styles.dropdownWrapper]}>
                    <TouchableOpacity style={[styles.mobileDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => { closeAllModalDropdowns(); setShowDatumDropdown(showDatumDropdown === 'month' ? null : 'month'); }}>
                      <Text style={[styles.mobileDropdownButtonText, { color: colors.text }]}>{datumParts ? MONTHS[datumParts.month] : 'Monat'}</Text>
                      <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                    </TouchableOpacity>
                    {showDatumDropdown === 'month' && (
                      <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>{MONTHS.map((m, i) => (
                        <TouchableOpacity key={m} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumPart('month', i)}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{m}</Text></TouchableOpacity>
                      ))}</ScrollView>
                    )}
                  </View>
                  <View style={[styles.mobileFormThird, styles.dropdownWrapper]}>
                    <TouchableOpacity style={[styles.mobileDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => { closeAllModalDropdowns(); setShowDatumDropdown(showDatumDropdown === 'year' ? null : 'year'); }}>
                      <Text style={[styles.mobileDropdownButtonText, { color: colors.text }]}>{datumParts?.year || 'Jahr'}</Text>
                      <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                    </TouchableOpacity>
                    {showDatumDropdown === 'year' && (
                      <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>{FORM_YEARS.map(y => (
                        <TouchableOpacity key={y} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumPart('year', y)}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{y}</Text></TouchableOpacity>
                      ))}</ScrollView>
                    )}
                  </View>
                </View>

                {/* Datum Bis */}
                <Text style={[styles.mobileFormLabel, { color: colors.textSecondary }]}>Datum bis</Text>
                <View style={[styles.mobileFormRow, { zIndex: 90 }]}>
                  <View style={[styles.mobileFormThird, styles.dropdownWrapper]}>
                    <TouchableOpacity style={[styles.mobileDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => { closeAllModalDropdowns(); setShowDatumEndeDropdown(showDatumEndeDropdown === 'day' ? null : 'day'); }}>
                      <Text style={[styles.mobileDropdownButtonText, { color: colors.text }]}>{datumEndeParts?.day || 'Tag'}</Text>
                      <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                    </TouchableOpacity>
                    {showDatumEndeDropdown === 'day' && (
                      <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                        <TouchableOpacity style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormDatumEnde(''); setShowDatumEndeDropdown(null); }}><Text style={[styles.dropdownItemText, { color: colors.textMuted }]}>- Leer -</Text></TouchableOpacity>
                        {DAYS.map(d => (<TouchableOpacity key={d} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumEndePart('day', d)}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{d}</Text></TouchableOpacity>))}
                      </ScrollView>
                    )}
                  </View>
                  <View style={[styles.mobileFormThird, styles.dropdownWrapper]}>
                    <TouchableOpacity style={[styles.mobileDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => { closeAllModalDropdowns(); setShowDatumEndeDropdown(showDatumEndeDropdown === 'month' ? null : 'month'); }}>
                      <Text style={[styles.mobileDropdownButtonText, { color: colors.text }]}>{datumEndeParts ? MONTHS[datumEndeParts.month] : 'Monat'}</Text>
                      <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                    </TouchableOpacity>
                    {showDatumEndeDropdown === 'month' && (
                      <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>{MONTHS.map((m, i) => (
                        <TouchableOpacity key={m} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumEndePart('month', i)}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{m}</Text></TouchableOpacity>
                      ))}</ScrollView>
                    )}
                  </View>
                  <View style={[styles.mobileFormThird, styles.dropdownWrapper]}>
                    <TouchableOpacity style={[styles.mobileDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => { closeAllModalDropdowns(); setShowDatumEndeDropdown(showDatumEndeDropdown === 'year' ? null : 'year'); }}>
                      <Text style={[styles.mobileDropdownButtonText, { color: colors.text }]}>{datumEndeParts?.year || 'Jahr'}</Text>
                      <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                    </TouchableOpacity>
                    {showDatumEndeDropdown === 'year' && (
                      <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>{FORM_YEARS.map(y => (
                        <TouchableOpacity key={y} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumEndePart('year', y)}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{y}</Text></TouchableOpacity>
                      ))}</ScrollView>
                    )}
                  </View>
                </View>

                {/* Zeit */}
                <Text style={[styles.mobileFormLabel, { color: colors.textSecondary }]}>Zeit</Text>
                <TextInput style={[styles.mobileFormInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={formZeit} onChangeText={setFormZeit} placeholder="HH:MM" placeholderTextColor={colors.textMuted} onFocus={closeAllModalDropdowns} />

                {/* Art */}
                <Text style={[styles.mobileFormLabel, { color: colors.textSecondary }]}>Art *</Text>
                <View style={styles.mobileArtSelector}>
                  {TERMIN_ARTEN.map((art) => (
                    <TouchableOpacity key={art} style={[styles.mobileArtOption, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, formArt === art && [styles.mobileArtOptionSelected, { backgroundColor: colors.primary, borderColor: colors.primary }]]} onPress={() => setFormArt(art)}>
                      <Text style={[styles.mobileArtOptionText, { color: colors.textSecondary }, formArt === art && { color: colors.primaryText }]}>{art}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Beschreibung */}
                <Text style={[styles.mobileFormLabel, { color: colors.textSecondary }]}>Beschreibung *</Text>
                <TextInput style={[styles.mobileFormInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={formTitel} onChangeText={setFormTitel} placeholder="z.B. Lehrgang, Meeting, ..." placeholderTextColor={colors.textMuted} onFocus={closeAllModalDropdowns} />

                {/* Jahrgang */}
                <Text style={[styles.mobileFormLabel, { color: colors.textSecondary }]}>Jahrgang</Text>
                <View style={[styles.dropdownWrapper, { zIndex: 80 }]}>
                  <TouchableOpacity style={[styles.mobileDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => { closeAllModalDropdowns(); setShowJahrgangDropdown(!showJahrgangDropdown); }}>
                    <Text style={[styles.mobileDropdownButtonText, { color: colors.text }]}>{formJahrgang || '- Kein Jahrgang -'}</Text>
                    <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                  </TouchableOpacity>
                  {showJahrgangDropdown && (
                    <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                      <TouchableOpacity style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormJahrgang(''); setShowJahrgangDropdown(false); }}><Text style={[styles.dropdownItemText, { color: colors.textMuted }]}>- Kein Jahrgang -</Text></TouchableOpacity>
                      {JAHRGAENGE.map(jg => (<TouchableOpacity key={jg} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormJahrgang(jg); setShowJahrgangDropdown(false); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{jg}</Text></TouchableOpacity>))}
                    </ScrollView>
                  )}
                </View>

                {/* Ort */}
                <Text style={[styles.mobileFormLabel, { color: colors.textSecondary }]}>Ort</Text>
                <TextInput style={[styles.mobileFormInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={formOrt} onChangeText={setFormOrt} placeholder="z.B. Frankfurt, DFB-Campus..." placeholderTextColor={colors.textMuted} onFocus={closeAllModalDropdowns} />

                {/* Übernahme */}
                <Text style={[styles.mobileFormLabel, { color: colors.textSecondary }]}>Übernahme durch</Text>
                <View style={[styles.dropdownWrapper, { zIndex: 70 }]}>
                  <TouchableOpacity style={[styles.mobileDropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => { closeAllModalDropdowns(); setShowUebernahmeDropdown(!showUebernahmeDropdown); }}>
                    <Text style={[styles.mobileDropdownButtonText, { color: colors.text }]}>
                      {formUebernahme ? advisors.find(a => a.id === formUebernahme)?.first_name + ' ' + advisors.find(a => a.id === formUebernahme)?.last_name : '- Keine Auswahl -'}
                    </Text>
                    <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                  </TouchableOpacity>
                  {showUebernahmeDropdown && (
                    <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                      <TouchableOpacity style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormUebernahme(''); setShowUebernahmeDropdown(false); }}><Text style={[styles.dropdownItemText, { color: colors.textMuted }]}>- Keine Auswahl -</Text></TouchableOpacity>
                      {advisors.map(adv => (<TouchableOpacity key={adv.id} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormUebernahme(adv.id); setShowUebernahmeDropdown(false); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{adv.first_name} {adv.last_name}</Text></TouchableOpacity>))}
                    </ScrollView>
                  )}
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>

              {/* Buttons */}
              <View style={[styles.mobileModalButtons, { borderTopColor: colors.border }]}>
                {isEdit && (
                  <TouchableOpacity style={styles.mobileModalDeleteBtn} onPress={() => setShowDeleteConfirm(true)}>
                    <Text style={styles.mobileModalDeleteText}>Löschen</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={[styles.mobileModalCancelBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { isEdit ? setShowEditModal(false) : setShowAddModal(false); resetForm(); closeAllModalDropdowns(); }}>
                  <Text style={[styles.mobileModalCancelText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mobileModalSaveBtn, { backgroundColor: colors.primary }]} onPress={isEdit ? handleUpdateTermin : handleSaveTermin}>
                  <Text style={[styles.mobileModalSaveText, { color: colors.primaryText }]}>Speichern</Text>
                </TouchableOpacity>
              </View>

              {/* Delete Confirmation Modal */}
              <Modal visible={showDeleteConfirm} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={[styles.deleteConfirmModal, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.deleteConfirmTitle, { color: colors.text }]}>Termin löschen?</Text>
                    <Text style={[styles.deleteConfirmText, { color: colors.textSecondary }]}>Möchtest du diesen Termin wirklich löschen?</Text>
                    <Text style={[styles.deleteConfirmTermin, { color: colors.text }]}>{selectedTermin?.titel}</Text>
                    <View style={styles.deleteConfirmButtons}>
                      <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setShowDeleteConfirm(false)}>
                        <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmDeleteButton} onPress={handleDeleteTermin}>
                        <Text style={styles.confirmDeleteButtonText}>Ja, löschen</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </View>
          </View>
        </Modal>
      );
    }

    // Desktop Modal
    return (
      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => { closeAllModalDropdowns(); }}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => closeAllModalDropdowns()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</Text>

            {/* Datum Von */}
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Datum von *</Text>
            <View style={[styles.formRow, { zIndex: 100 }]}>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumDropdown(showDatumDropdown === 'day' ? null : 'day'); }}
                >
                  <Text style={[styles.dropdownButtonText, { color: colors.text }]}>{datumParts?.day || 'Tag'}</Text>
                  <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                </TouchableOpacity>
                {showDatumDropdown === 'day' && (
                  <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                    {DAYS.map(d => (
                      <TouchableOpacity key={d} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumPart('day', d)}>
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumDropdown(showDatumDropdown === 'month' ? null : 'month'); }}
                >
                  <Text style={[styles.dropdownButtonText, { color: colors.text }]}>{datumParts ? MONTHS[datumParts.month] : 'Monat'}</Text>
                  <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                </TouchableOpacity>
                {showDatumDropdown === 'month' && (
                  <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                    {MONTHS.map((m, i) => (
                      <TouchableOpacity key={m} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumPart('month', i)}>
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumDropdown(showDatumDropdown === 'year' ? null : 'year'); }}
                >
                  <Text style={[styles.dropdownButtonText, { color: colors.text }]}>{datumParts?.year || 'Jahr'}</Text>
                  <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                </TouchableOpacity>
                {showDatumDropdown === 'year' && (
                  <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                    {FORM_YEARS.map(y => (
                      <TouchableOpacity key={y} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumPart('year', y)}>
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>

            {/* Datum Bis */}
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Datum bis</Text>
            <View style={[styles.formRow, { zIndex: 90 }]}>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumEndeDropdown(showDatumEndeDropdown === 'day' ? null : 'day'); }}
                >
                  <Text style={[styles.dropdownButtonText, { color: colors.text }]}>{datumEndeParts?.day || 'Tag'}</Text>
                  <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                </TouchableOpacity>
                {showDatumEndeDropdown === 'day' && (
                  <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                    <TouchableOpacity style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormDatumEnde(''); setShowDatumEndeDropdown(null); }}>
                      <Text style={[styles.dropdownItemText, { color: colors.textMuted }]}>- Kein Enddatum -</Text>
                    </TouchableOpacity>
                    {DAYS.map(d => (
                      <TouchableOpacity key={d} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumEndePart('day', d)}>
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumEndeDropdown(showDatumEndeDropdown === 'month' ? null : 'month'); }}
                >
                  <Text style={[styles.dropdownButtonText, { color: colors.text }]}>{datumEndeParts ? MONTHS[datumEndeParts.month] : 'Monat'}</Text>
                  <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                </TouchableOpacity>
                {showDatumEndeDropdown === 'month' && (
                  <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                    {MONTHS.map((m, i) => (
                      <TouchableOpacity key={m} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumEndePart('month', i)}>
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumEndeDropdown(showDatumEndeDropdown === 'year' ? null : 'year'); }}
                >
                  <Text style={[styles.dropdownButtonText, { color: colors.text }]}>{datumEndeParts?.year || 'Jahr'}</Text>
                  <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
                </TouchableOpacity>
                {showDatumEndeDropdown === 'year' && (
                  <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                    {FORM_YEARS.map(y => (
                      <TouchableOpacity key={y} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => updateFormDatumEndePart('year', y)}>
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>

            {/* Zeit */}
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Zeit</Text>
            <TextInput style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={formZeit} onChangeText={setFormZeit} placeholder="HH:MM" placeholderTextColor={colors.textMuted} onFocus={closeAllModalDropdowns} />

            {/* Art */}
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Art *</Text>
            <Pressable style={styles.artSelector} onPress={closeAllModalDropdowns}>
              {TERMIN_ARTEN.map((art) => (
                <TouchableOpacity key={art} style={[styles.artOption, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, formArt === art && [styles.artOptionSelected, { backgroundColor: colors.primary, borderColor: colors.primary }]]} onPress={() => setFormArt(art)}>
                  <Text style={[styles.artOptionText, { color: colors.textSecondary }, formArt === art && { color: colors.primaryText }]}>{art}</Text>
                </TouchableOpacity>
              ))}
            </Pressable>

            {/* Beschreibung */}
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Beschreibung *</Text>
            <TextInput style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={formTitel} onChangeText={setFormTitel} placeholder="z.B. Lehrgang, Meeting, ..." placeholderTextColor={colors.textMuted} onFocus={closeAllModalDropdowns} />

            {/* Jahrgang Dropdown */}
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Jahrgang</Text>
            <View style={[styles.dropdownWrapper, { zIndex: 80 }]}>
              <TouchableOpacity
                style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowJahrgangDropdown(!showJahrgangDropdown); }}
              >
                <Text style={[styles.dropdownButtonText, { color: colors.text }]}>{formJahrgang || '- Kein Jahrgang -'}</Text>
                <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
              </TouchableOpacity>
              {showJahrgangDropdown && (
                <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                  <TouchableOpacity style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormJahrgang(''); setShowJahrgangDropdown(false); }}>
                    <Text style={[styles.dropdownItemText, { color: colors.textMuted }]}>- Kein Jahrgang -</Text>
                  </TouchableOpacity>
                  {JAHRGAENGE.map(jg => (
                    <TouchableOpacity key={jg} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormJahrgang(jg); setShowJahrgangDropdown(false); }}>
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>{jg}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Ort */}
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Ort</Text>
            <TextInput style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={formOrt} onChangeText={setFormOrt} placeholder="z.B. Frankfurt, DFB-Campus..." placeholderTextColor={colors.textMuted} onFocus={closeAllModalDropdowns} />

            {/* Übernahme Dropdown */}
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Übernahme durch</Text>
            <View style={[styles.dropdownWrapper, { zIndex: 70 }]}>
              <TouchableOpacity
                style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowUebernahmeDropdown(!showUebernahmeDropdown); }}
              >
                <Text style={[styles.dropdownButtonText, { color: colors.text }]}>
                  {formUebernahme
                    ? advisors.find(a => a.id === formUebernahme)?.first_name + ' ' + advisors.find(a => a.id === formUebernahme)?.last_name
                    : '- Keine Auswahl -'}
                </Text>
                <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
              </TouchableOpacity>
              {showUebernahmeDropdown && (
                <ScrollView style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                  <TouchableOpacity style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormUebernahme(''); setShowUebernahmeDropdown(false); }}>
                    <Text style={[styles.dropdownItemText, { color: colors.textMuted }]}>- Keine Auswahl -</Text>
                  </TouchableOpacity>
                  {advisors.map(adv => (
                    <TouchableOpacity key={adv.id} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormUebernahme(adv.id); setShowUebernahmeDropdown(false); }}>
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>{adv.first_name} {adv.last_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              {isEdit && (
                <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
                  <Text style={styles.deleteButtonText}>Löschen</Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { isEdit ? setShowEditModal(false) : setShowAddModal(false); resetForm(); closeAllModalDropdowns(); }}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={isEdit ? handleUpdateTermin : handleSaveTermin}>
                <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>Speichern</Text>
              </TouchableOpacity>
            </View>

            {/* Delete Confirmation Modal */}
            <Modal visible={showDeleteConfirm} transparent animationType="fade">
              <View style={styles.modalOverlay}>
                <View style={[styles.deleteConfirmModal, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.deleteConfirmTitle, { color: colors.text }]}>Termin löschen?</Text>
                  <Text style={[styles.deleteConfirmText, { color: colors.textSecondary }]}>Möchtest du diesen Termin wirklich löschen?</Text>
                  <Text style={[styles.deleteConfirmTermin, { color: colors.text }]}>{selectedTermin?.titel}</Text>
                  <View style={styles.deleteConfirmButtons}>
                    <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setShowDeleteConfirm(false)}>
                      <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmDeleteButton} onPress={handleDeleteTermin}>
                      <Text style={styles.confirmDeleteButtonText}>Ja, löschen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const renderSyncModal = () => (
    <Modal visible={showSyncModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.syncModalContent, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Termine synchronisieren</Text>
          <Text style={[styles.syncDescription, { color: colors.textSecondary }]}>
            Lädt {getDFBTermineCount()} DFB-Nationalmannschaftstermine und {getHallenTermineCount()} Hallenturniere.{'\n'}
            Bereits vorhandene Termine werden übersprungen.
          </Text>
          <Text style={[styles.syncStand, { color: colors.textMuted }]}>Stand: {getLastUpdateDisplay()}</Text>
          {syncLoading ? (
            <View style={styles.syncLoadingContainer}>
              <ActivityIndicator size="large" color={colors.text} />
              <Text style={[styles.syncLoadingText, { color: colors.textSecondary }]}>Synchronisiere...</Text>
            </View>
          ) : syncResult ? (
            <View style={[styles.syncResultContainer, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d4edda' }]}>
              <Text style={[styles.syncResultTitle, { color: isDark ? '#10b981' : '#155724' }]}>Synchronisierung abgeschlossen</Text>
              <Text style={[styles.syncResultText, { color: isDark ? '#10b981' : '#155724' }]}>{syncResult.added} neue Termine hinzugefügt</Text>
              <Text style={[styles.syncResultText, { color: isDark ? '#10b981' : '#155724' }]}>{syncResult.skipped} bereits vorhanden (übersprungen)</Text>
            </View>
          ) : null}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { setShowSyncModal(false); setSyncResult(null); }}>
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>{syncResult ? 'Schließen' : 'Abbrechen'}</Text>
            </TouchableOpacity>
            {!syncResult && (
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleDFBSync} disabled={syncLoading}>
                <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>Jetzt synchronisieren</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderTokenModal = () => (
    <Modal visible={showTokenModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>API Token einrichten</Text>
          <Text style={[styles.syncDescription, { color: colors.textSecondary }]}>
            Um Spiele von fussball.de zu laden, wird ein API Token benötigt.{'\n\n'}
            1. Gehe zu api-fussball.de/token{'\n'}
            2. Registriere dich mit deiner E-Mail{'\n'}
            3. Kopiere den Token und füge ihn hier ein
          </Text>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>API Token</Text>
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
            value={apiToken}
            onChangeText={setApiToken}
            placeholder="Dein API Token..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { setShowTokenModal(false); setApiToken(''); }}>
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSaveToken}>
              <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderContent = () => {
    switch (viewMode) {
      case 'spiele': return renderSpieleUnsererSpieler();
      case 'termine': return renderWeitereTermine();
      case 'kalender': return renderKalenderPlaceholder();
      default: return renderDashboard();
    }
  };

  // Profile initials for header
  const profileInitials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}` : '?';

  return (
    <View style={[styles.container, isMobile && styles.containerMobile, { backgroundColor: colors.background }]}>
      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="termine"
          profile={profile}
        />
      )}

      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar navigation={navigation} activeScreen="termine" profile={profile} />}

      <View style={[styles.mainContent, { backgroundColor: colors.background }]}>
        {/* Mobile Header */}
        {isMobile && (
          <MobileHeader
            title={viewMode === 'spiele' ? 'Spiele unserer Spieler' : viewMode === 'termine' ? 'Weitere Termine' : 'Spieltage'}
            onMenuPress={() => setShowMobileSidebar(true)}
            onProfilePress={() => navigation.navigate('MyProfile')}
            profileInitials={profileInitials}
          />
        )}

        {/* Desktop Header */}
        {!isMobile && viewMode === 'dashboard' && (
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => navigation.navigate('AdvisorDashboard')} style={[styles.backButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>← Zurück</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Spieltage</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Übersicht über Spieltage unserer Spieler und weitere Lehrgänge und Termine</Text>
            </View>
            <View style={{ width: 80 }} />
          </View>
        )}
        {renderContent()}
      </View>
      {renderAddEditModal(false)}
      {renderAddEditModal(true)}
      {renderSyncModal()}
      {renderTokenModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f5f5' },
  containerMobile: { flexDirection: 'column' },

  // Sidebar Overlay (Mobile)
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, flexDirection: 'row' },
  sidebarMobile: { width: 280, height: '100%', backgroundColor: '#fff' },

  mainContent: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  backButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  backButtonText: { fontSize: 14, color: '#64748b' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  scrollContentMobile: { padding: 16 },

  // Mobile Cards
  mobileCardsContainer: {},
  mobileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  mobileCardDark: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
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
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  mobileCardIconDark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  mobileCardIconText: {
    fontSize: 20,
  },
  mobileCardText: {
    flex: 1,
  },
  mobileCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mobileCardTitleDark: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  mobileCardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  mobileCardSubtitleDark: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  mobileCardCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  mobileCardCountDark: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },

  // Mobile Games View
  mobileGamesContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  mobileGamesToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  mobileGamesToolbarBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileGamesToolbarBtnActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  mobileGamesToolbarBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  mobileGamesIconBtn: {
    width: 40,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileGamesIconBtnText: {
    fontSize: 18,
    color: '#64748b',
  },
  mobileGamesFilterCount: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    marginLeft: 4,
  },
  mobileGamesFloatingExport: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  mobileGamesFloatingExportText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  mobileGamesFilterModal: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  mobileGamesFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mobileGamesFilterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mobileGamesFilterClose: {
    fontSize: 24,
    color: '#64748b',
  },
  mobileGamesFilterContent: {
    flex: 1,
    padding: 16,
  },
  mobileGamesFilterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
    marginTop: 16,
  },
  mobileGamesFilterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mobileGamesFilterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mobileGamesFilterChipActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  mobileGamesFilterChipText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  mobileGamesFilterChipTextActive: {
    color: '#fff',
  },
  mobileGamesFilterFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  mobileGamesFilterClearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  mobileGamesFilterClearText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  mobileGamesFilterApplyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  mobileGamesFilterApplyText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  mobileSyncProgress: {
    height: 24,
    backgroundColor: '#e2e8f0',
    position: 'relative',
    justifyContent: 'center',
  },
  mobileSyncProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#10b981',
  },
  mobileSyncProgressText: {
    fontSize: 12,
    color: '#1a1a1a',
    textAlign: 'center',
    fontWeight: '500',
  },
  mobileGamesList: {
    flex: 1,
  },
  mobileGamesListContent: {
    padding: 12,
    gap: 8,
  },
  mobileGamesEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  mobileGamesEmptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  mobileGamesEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 16,
  },
  mobileGamesEmptyButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  mobileGamesEmptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  mobileGameCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mobileGameCardToday: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  mobileGameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mobileGameCardLeague: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  mobileGameCardDate: {
    fontSize: 12,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  mobileGameCardCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  mobileGameCardCheckboxSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  mobileGameCardCheckmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  mobileGameCardMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mobileGameCardLogo: {
    width: 18,
    height: 18,
    borderRadius: 3,
    marginRight: 4,
  },
  mobileGameCardLogoPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    marginRight: 4,
  },
  mobileGameCardLogoInner: {
    width: 18,
    height: 18,
    borderRadius: 3,
    marginLeft: 4,
  },
  mobileGameCardLogoPlaceholderInner: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    marginLeft: 4,
  },
  mobileGameCardTeamName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    flexShrink: 1,
  },
  mobileGameCardSeparator: {
    fontSize: 14,
    color: '#64748b',
    marginHorizontal: 6,
  },
  mobileGameCardPlayers: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  mobileGameCardPlayersLabel: {
    fontSize: 13,
  },
  mobileGameCardPlayersText: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },

  gridContainer: { maxWidth: 1000, width: '100%' },
  row: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  card: { borderRadius: 20, overflow: 'hidden', cursor: 'pointer' as any },
  cardHovered: { transform: [{ scale: 1.02 }], shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
  lightCardHovered: { transform: [{ scale: 1.01 }] },
  darkCardHovered: { transform: [{ scale: 1.02 }] },
  mainCardHovered: { transform: [{ scale: 1.005 }] },
  mainCard: { flex: 2, padding: 28, minHeight: 280, borderWidth: 1, position: 'relative' },
  todayCountTopRight: { position: 'absolute', top: 20, right: 24, fontSize: 48, fontWeight: '700', color: '#1a1a1a' },
  mainCardContent: { flex: 1, flexDirection: 'row' },
  mainCardLeft: { flex: 1, justifyContent: 'space-between' },
  mainCardRight: { width: 120, alignItems: 'center', justifyContent: 'center' },
  mainCardIcon: { fontSize: 80, opacity: 0.15 },
  playerCountBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  mainCardTitle: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  mainCardSubtitle: { fontSize: 14, color: '#888', lineHeight: 22 },
  mainCardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto' as any, paddingTop: 20 },
  mainCardLink: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  mainCardArrow: { fontSize: 16, marginLeft: 8, color: '#1a1a1a' },
  rightColumn: { flex: 1, gap: 16 },
  termineCard: { flex: 1, padding: 20, borderWidth: 1, justifyContent: 'space-between' },
  termineCardFull: { flex: 1, padding: 28, minHeight: 280, borderWidth: 1, borderRadius: 20, justifyContent: 'space-between', position: 'relative' },
  termineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  termineIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  termineIconText: { fontSize: 18 },
  termineCount: { fontSize: 32, fontWeight: '700', color: '#1a1a1a' },
  termineFooter: { marginTop: 'auto' as any },
  termineTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  termineSubtitle: { fontSize: 12, color: '#888', marginTop: 4 },
  kalenderCard: { flex: 1, backgroundColor: '#1a1a1a', padding: 20, position: 'relative', justifyContent: 'space-between' },
  urgentBadge: { position: 'absolute', top: 20, right: 20 },
  urgentBadgeText: { fontSize: 12, fontWeight: '600', color: '#ff6b6b' },
  kalenderIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  kalenderIconText: { fontSize: 18 },
  kalenderFooter: { marginTop: 'auto' as any },
  kalenderTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  kalenderSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  backButtonTop: { position: 'absolute', top: 20, left: 20 },
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  placeholderContainer: { flex: 1, position: 'relative' },
  placeholderContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  placeholderIcon: { fontSize: 80, marginBottom: 20 },
  placeholderTitle: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  placeholderText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  comingSoonLarge: { backgroundColor: '#fff3cd', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, marginTop: 30 },
  comingSoonLargeText: { fontSize: 16, fontWeight: '600', color: '#856404' },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 600 },
  syncModalContent: { borderRadius: 16, padding: 24, width: '90%', maxWidth: 450 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  syncDescription: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 12 },
  syncStand: { fontSize: 12, color: '#999', marginBottom: 20 },
  syncLoadingContainer: { alignItems: 'center', paddingVertical: 20 },
  syncLoadingText: { marginTop: 12, color: '#666' },
  syncResultContainer: { backgroundColor: '#d4edda', padding: 16, borderRadius: 10, marginBottom: 20 },
  syncResultTitle: { fontSize: 16, fontWeight: '600', color: '#155724', marginBottom: 8 },
  syncResultText: { fontSize: 14, color: '#155724' },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  formHalf: { flex: 1 },
  formThird: { flex: 1 },
  formLabel: { fontSize: 13, color: '#666', marginBottom: 6, marginTop: 12 },
  formInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15 },
  selectWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' },
  selectInput: { padding: 12, fontSize: 15, border: 'none', width: '100%' },

  // Dropdown Styles
  dropdownWrapper: { position: 'relative' as any, marginBottom: 4 },
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 12 },
  dropdownButtonText: { fontSize: 15, color: '#333' },
  dropdownArrow: { fontSize: 12, color: '#999' },
  dropdownList: { position: 'absolute' as any, top: '100%', left: 0, right: 0, borderWidth: 1, borderRadius: 8, maxHeight: 200, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownItemText: { fontSize: 15, color: '#333' },
  
  artSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  artOption: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  artOptionSelected: { backgroundColor: '#000', borderColor: '#000' },
  artOptionText: { fontSize: 13, color: '#333' },
  artOptionTextSelected: { color: '#fff' },
  modalButtons: { flexDirection: 'row', marginTop: 24, gap: 8 },
  deleteButton: { borderWidth: 2, borderColor: '#ff4444', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  deleteButtonText: { color: '#ff4444', fontWeight: '600' },
  deleteConfirmModal: { borderRadius: 16, padding: 24, width: '90%', maxWidth: 400, alignItems: 'center' },
  deleteConfirmTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },
  deleteConfirmText: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 8 },
  deleteConfirmTermin: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 20, textAlign: 'center' },
  deleteConfirmButtons: { flexDirection: 'row', gap: 12 },
  confirmDeleteButton: { backgroundColor: '#ff4444', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  confirmDeleteButtonText: { color: '#fff', fontWeight: '600' },
  cancelButton: { backgroundColor: '#eee', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  cancelButtonText: { color: '#666', fontWeight: '600' },
  saveButton: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  
  // Scouting-Style
  scoutingMainContent: { flex: 1, backgroundColor: '#f8fafc' },
  scoutingHeaderBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 24, borderBottomWidth: 1 },
  scoutingHeaderBannerCenter: { alignItems: 'center', flex: 1 },
  scoutingTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  scoutingSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  headerButtonsRow: { flexDirection: 'row', gap: 8 },
  scoutingToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, zIndex: 100 },
  spieleSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, flex: 1, maxWidth: 600 },
  scoutingSearchIcon: { fontSize: 16, marginRight: 8 },
  scoutingSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, outlineStyle: 'none' as any },
  scoutingFilterContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 },
  scoutingDropdownContainer: { position: 'relative' as any },
  scoutingFilterButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
  scoutingFilterButtonText: { fontSize: 14 },
  scoutingFilterDropdownMulti: { position: 'absolute' as any, top: '100%', right: 0, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, minWidth: 220, marginTop: 4, zIndex: 1002, borderWidth: 1 },
  scoutingFilterDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#f8fafc', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  scoutingFilterDropdownTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  scoutingFilterClearText: { fontSize: 12, color: '#ef4444', fontWeight: '500' },
  scoutingFilterCheckboxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  scoutingCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  scoutingCheckboxSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  scoutingCheckmark: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  scoutingFilterCheckboxText: { flex: 1, fontSize: 14, color: '#333' },
  scoutingFilterCountBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 12, color: '#64748b' },
  scoutingFilterDoneButton: { padding: 12, backgroundColor: '#f8fafc', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  scoutingFilterDoneText: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  scoutingNoDataText: { padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  scoutingDropdownOverlay: { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  scoutingContent: { flex: 1, padding: 16 },
  scoutingGamesContainer: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  scoutingTableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  scoutingTableHeaderCell: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' as any, paddingRight: 12 },
  scoutingTableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  scoutingTableCell: { fontSize: 14, color: '#1a1a1a', paddingRight: 12 },
  scoutingClubLogo: { width: 20, height: 20, resizeMode: 'contain' as any, marginHorizontal: 4 },
  scoutingMatchText: { fontWeight: '500', marginHorizontal: 4 },
  scoutingEmptyState: { padding: 60, alignItems: 'center' },
  scoutingEmptyIcon: { fontSize: 48, marginBottom: 16 },
  scoutingEmptyTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  scoutingEmptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  emptyStateButton: { marginTop: 20, backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  emptyStateButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  
  // Game specific styles
  gameCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  gameCheckboxSelected: { backgroundColor: '#10b981', borderColor: '#10b981' },
  gameCheckmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  gameRowToday: { backgroundColor: '#d1fae5' },
  textBold: { fontWeight: '700' },
  
  // Sync styles
  syncButton: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  syncButtonText: { color: '#fff', fontWeight: '600' },
  exportButton: { backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  exportButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  syncProgressBar: { height: 32, backgroundColor: '#e2e8f0', position: 'relative' as any },
  syncProgressFill: { height: '100%', backgroundColor: '#3b82f6' },
  syncProgressText: { position: 'absolute' as any, left: 16, top: 8, fontSize: 12, color: '#1a1a1a', fontWeight: '500' },
  syncResultBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16 },
  syncResultSuccess: { backgroundColor: '#d1fae5' },
  syncResultWarning: { backgroundColor: '#fecaca' },
  syncResultText: { fontSize: 14, color: '#1a1a1a' },
  syncResultClose: { fontSize: 18, color: '#64748b', paddingHorizontal: 8 },
  
  // Termine styles
  termineHeaderButtons: { flexDirection: 'row', gap: 8 },
  termineTableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  termineTableHeaderText: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' as any },
  sortableHeader: { cursor: 'pointer' as any },
  termineTableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, alignItems: 'center' },
  termineTableRowRunning: { backgroundColor: '#dcfce7' },
  termineTableRowArchiv: { backgroundColor: '#f8fafc' },
  termineCellArchiv: { color: '#94a3b8' },
  artBadgeArchiv: { opacity: 0.6 },
  termineTabButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'transparent' },
  termineTabButtonActive: { backgroundColor: '#1a1a1a' },
  termineTabButtonText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  termineTabButtonTextActive: { color: '#fff' },
  termineTableCell: { fontSize: 14, color: '#1a1a1a' },
  termineCellPast: { color: '#94a3b8' },
  termineColDatum: { flex: 1, minWidth: 90 },
  termineColZeit: { flex: 0.6, minWidth: 50 },
  termineColArt: { flex: 1.3, minWidth: 120 },
  termineColTitel: { flex: 2, minWidth: 150 },
  termineColJahrgang: { flex: 0.6, minWidth: 55 },
  termineColOrt: { flex: 1.1, minWidth: 90 },
  termineColUebernahme: { flex: 1.1, minWidth: 90 },
  
  // Art Badges
  artBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  artBadgePast: { opacity: 0.6 },
  artBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  artNationalmannschaft: { backgroundColor: '#f8d7da' },
  artNationalmannschaftText: { color: '#721c24' },
  artHallenturnier: { backgroundColor: '#d1ecf1' },
  artHallenturnierText: { color: '#0c5460' },
  artSonstige: { backgroundColor: '#6c757d' },

  // Mobile Termine Styles
  mobileTermineContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mobileTermineToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  mobileTermineToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
    marginHorizontal: 12,
    marginTop: 12,
  },
  mobileTermineToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  mobileTermineToggleBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  mobileTermineToggleBtnText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  mobileTermineToggleBtnTextActive: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  mobileTermineList: {
    flex: 1,
  },
  mobileTermineListContent: {
    padding: 12,
    paddingBottom: 80,
  },
  mobileTerminCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 80,
    justifyContent: 'space-between',
  },
  mobileTerminCardRunning: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  mobileTerminCardArchiv: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  mobileTerminCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileTerminCardCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  mobileTerminCardCategoryArchiv: {
    color: '#94a3b8',
  },
  mobileTerminCardDate: {
    fontSize: 12,
    color: '#64748b',
  },
  mobileTerminCardDateArchiv: {
    color: '#94a3b8',
  },
  mobileTerminCardCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  mobileTerminCardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  mobileTerminCardTitleArchiv: {
    color: '#64748b',
  },
  mobileTerminCardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  mobileTerminCardOrtLabel: {
    fontSize: 13,
  },
  mobileTerminCardOrt: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  mobileTerminCardOrtArchiv: {
    color: '#94a3b8',
  },
  mobileTermineAddBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  mobileTermineAddBtnText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '300',
  },

  // Mobile Modal Styles
  mobileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  mobileModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  mobileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mobileModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mobileModalClose: {
    fontSize: 20,
    color: '#64748b',
    padding: 4,
  },
  mobileModalScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  mobileModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  mobileModalDeleteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  mobileModalDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  mobileModalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  mobileModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  mobileModalSaveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  mobileModalSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  mobileFormLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    marginTop: 16,
  },
  mobileFormInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f8fafc',
  },
  mobileFormRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mobileFormThird: {
    flex: 1,
  },
  mobileDropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  mobileDropdownButtonText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  mobileArtSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mobileArtOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mobileArtOptionSelected: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  mobileArtOptionText: {
    fontSize: 13,
    color: '#64748b',
  },
  mobileArtOptionTextSelected: {
    color: '#fff',
  },
});
