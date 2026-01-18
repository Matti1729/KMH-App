import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
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
  selected: boolean;
  player?: {
    id: string;
    first_name: string;
    last_name: string;
    club: string;
    responsibility: string;
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
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [showResponsibilityDropdown, setShowResponsibilityDropdown] = useState(false);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [syncingGames, setSyncingGames] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; playerName: string } | null>(null);
  const [gameSyncResult, setGameSyncResult] = useState<{ added: number; updated: number; errors: string[] } | null>(null);
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
  useEffect(() => { 
    fetchProfile(); 
    fetchAdvisors(); 
    fetchTermine(); 
    fetchClubLogos(); 
    fetchPlayersWithUrl();
    fetchPlayerGames();
  }, []);

  const fetchPlayersWithUrl = async () => {
    const players = await getPlayersWithFussballDeUrl(supabase);
    setPlayersWithUrl(players);
  };

  const fetchPlayerGames = async () => {
    const games = await loadUpcomingGames(supabase);
    setPlayerGames(games.map(g => ({
      ...g,
      player_name: g.player ? `${g.player.first_name} ${g.player.last_name}` : g.player_name || '-'
    })));
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
    // Teilübereinstimmung
    for (const [name, url] of Object.entries(clubLogos)) {
      if (clubName.toLowerCase().includes(name.toLowerCase()) || 
          name.toLowerCase().includes(clubName.toLowerCase())) {
        return url;
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
    const now = new Date();
    const oneDayAgo = new Date(); 
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data, error } = await supabase
      .from('termine')
      .select('*')
      .or(`datum.gte.${oneDayAgo.toISOString()},datum_ende.gte.${now.toISOString()}`)
      .order('datum', { ascending: true });
    
    if (!error && data) setTermine(data);
    setLoading(false);
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
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
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
    const endDate = termin.datum_ende ? new Date(termin.datum_ende) : startDate;
    // Setze endDate auf Ende des Tages
    endDate.setHours(23, 59, 59, 999);
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

  const toggleGameSelection = async (gameId: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('player_games')
      .update({ selected: !currentValue })
      .eq('id', gameId);
    
    if (!error) {
      setPlayerGames(prev => prev.map(g => 
        g.id === gameId ? { ...g, selected: !currentValue } : g
      ));
    }
  };

  const getSelectedGamesCount = () => playerGames.filter(g => g.selected).length;

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
      
      icsContent += `BEGIN:VEVENT\r\nDTSTART:${dateStr}T${timeStr}\r\nDTEND:${dateStr}T${endTimeStr}\r\nSUMMARY:${game.home_team} vs ${game.away_team}\r\nDESCRIPTION:Spieler: ${playerNames}\r\nLOCATION:${game.location || ''}\r\nEND:VEVENT\r\n`;
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
  const toggleSelectAllFiltered = async () => {
    const allSelected = filteredGames.every(g => g.selected);
    
    for (const game of filteredGames) {
      if (allSelected !== game.selected) continue; // Nur ändern wenn nötig
      
      await supabase
        .from('player_games')
        .update({ selected: !allSelected })
        .eq('id', game.id);
    }
    
    // State aktualisieren
    setPlayerGames(prev => prev.map(g => {
      const isFiltered = filteredGames.some(fg => fg.id === g.id);
      if (isFiltered) {
        return { ...g, selected: !allSelected };
      }
      return g;
    }));
  };

  const areAllFilteredSelected = () => {
    if (filteredGames.length === 0) return false;
    return filteredGames.every(g => g.selected);
  };

  // Filter Logic
  const availableResponsibilities = useMemo(() => {
    const responsibilities = new Set<string>();
    playerGames.forEach(g => { 
      if (g.player?.responsibility) responsibilities.add(g.player.responsibility); 
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
      games = games.filter(g => selectedResponsibilities.includes(g.player?.responsibility || ''));
    }
    
    if (selectedPlayers.length > 0) {
      games = games.filter(g => selectedPlayers.includes(g.player_id));
    }
    
    // Duplikate zusammenführen: gleiche Spiele (Datum + Teams) mit mehreren Spielern
    const gameMap = new Map<string, PlayerGame & { playerNames: string[], playerResponsibilities: string[] }>();
    
    games.forEach(game => {
      const key = `${game.date}_${game.home_team}_${game.away_team}`;
      
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
          playerResponsibilities: game.player?.responsibility ? [game.player.responsibility] : []
        });
      }
    });
    
    return Array.from(gameMap.values());
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
      style={[styles.card, style, hoveredCard === id && (hoverStyle || styles.cardHovered)]}
    >
      {children}
    </Pressable>
  );

  const SortableHeader = ({ field, label, style }: { field: SortField; label: string; style: any }) => (
    <TouchableOpacity onPress={() => handleSort(field)} style={[style, styles.sortableHeader]}>
      <Text style={styles.termineTableHeaderText}>{label} {getSortIndicator(field)}</Text>
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

  const isGameToday = (dateStr: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const isGameThisWeek = (dateStr: string): boolean => {
    const today = new Date();
    const gameDate = new Date(dateStr);
    const diffTime = gameDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  // Heutige Spiele zählen
  const getTodayGamesCount = (): number => {
    const today = new Date().toISOString().split('T')[0];
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

  const renderDashboard = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.gridContainer}>
        <View style={styles.row}>
          <DashboardCard id="spiele" style={styles.mainCard} onPress={() => setViewMode('spiele')} hoverStyle={styles.mainCardHovered}>
            <Text style={styles.todayCountTopRight}>{getTodayGamesCount()}</Text>
            <View style={styles.mainCardContent}>
              <View style={styles.mainCardLeft}>
                <Text style={styles.mainCardTitle}>Spiele unserer Spieler</Text>
                <Text style={styles.mainCardSubtitle}>
                  {playerGames.length > 0 
                    ? `${playerGames.length} Spiele in den nächsten 5 Wochen`
                    : 'Alle Partien deiner Mandanten\nim Überblick'
                  }
                </Text>
                <View style={styles.mainCardFooter}>
                  <Text style={styles.mainCardLink}>Zur Übersicht</Text>
                  <Text style={styles.mainCardArrow}>→</Text>
                </View>
              </View>
              <View style={styles.mainCardRight}>
              </View>
            </View>
          </DashboardCard>
          <DashboardCard id="termine" style={styles.termineCardFull} onPress={() => setViewMode('termine')} hoverStyle={styles.lightCardHovered}>
            <Text style={styles.todayCountTopRight}>{getTodayTermineCount()}</Text>
            <View style={styles.termineHeader}>
              <View style={styles.termineIcon}><Text style={styles.termineIconText}>📋</Text></View>
            </View>
            <View style={styles.termineFooter}>
              <Text style={styles.termineTitle}>Weitere Termine</Text>
              <Text style={styles.termineSubtitle}>Lehrgänge, Sichtungen und Turniere</Text>
            </View>
          </DashboardCard>
        </View>
      </View>
    </ScrollView>
  );

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
    
    return (
      <View style={styles.scoutingMainContent}>
        {/* Header Banner */}
        <Pressable style={styles.scoutingHeaderBanner} onPress={closeAllGameDropdowns}>
          <TouchableOpacity style={styles.backButton} onPress={() => setViewMode('dashboard')}>
            <Text style={styles.backButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.scoutingHeaderBannerCenter}>
            <Text style={styles.scoutingTitle}>Spiele unserer Spieler</Text>
            <Text style={styles.scoutingSubtitle}>
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
              style={[styles.scoutingFilterButton, syncingGames && { opacity: 0.6 }]} 
              onPress={handleSyncGames}
              disabled={syncingGames}
            >
              <Text style={styles.scoutingFilterButtonText}>
                {syncingGames 
                  ? (syncProgress ? `⏳ ${syncProgress.current}/${syncProgress.total}` : '⏳ Lädt...') 
                  : 'Aktualisieren'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>

        {/* Sync Progress */}
        {syncingGames && syncProgress && (
          <View style={styles.syncProgressBar}>
            <View style={[styles.syncProgressFill, { width: `${(syncProgress.current / syncProgress.total) * 100}%` }]} />
            <Text style={styles.syncProgressText}>
              Lade Spiele für: {syncProgress.playerName}
            </Text>
          </View>
        )}

        {/* Sync Result */}
        {gameSyncResult && !syncingGames && (
          <View style={[styles.syncResultBanner, gameSyncResult.errors.length > 0 ? styles.syncResultWarning : styles.syncResultSuccess]}>
            <Text style={styles.syncResultText}>
              ✓ {gameSyncResult.added} neue Spiele • {gameSyncResult.updated} aktualisiert
              {gameSyncResult.errors.length > 0 && ` • ${gameSyncResult.errors.length} Fehler`}
            </Text>
            <TouchableOpacity onPress={() => setGameSyncResult(null)}>
              <Text style={styles.syncResultClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Toolbar */}
        <Pressable style={styles.scoutingToolbar} onPress={closeAllGameDropdowns}>
          <Pressable style={styles.spieleSearchContainer} onPress={closeAllGameDropdowns}>
            <Text style={styles.scoutingSearchIcon}>🔍</Text>
            <TextInput 
              style={styles.scoutingSearchInput} 
              placeholder="Spieler, Verein suchen..." 
              placeholderTextColor="#9ca3af"
              value={gamesSearchText} 
              onChangeText={setGamesSearchText}
              onFocus={closeAllGameDropdowns}
            />
          </Pressable>
          
          <View style={styles.scoutingFilterContainer}>
            {/* Spieler Filter */}
            <View style={[styles.scoutingDropdownContainer, { zIndex: 40 }]}>
              <TouchableOpacity 
                style={[styles.scoutingFilterButton, selectedPlayers.length > 0 && styles.scoutingFilterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); setShowPlayerDropdown(!showPlayerDropdown); setShowResponsibilityDropdown(false); }}
              >
                <Text style={[styles.scoutingFilterButtonText, selectedPlayers.length > 0 && styles.scoutingFilterButtonTextActive]}>
                  {getPlayerFilterLabel()} ▼
                </Text>
              </TouchableOpacity>
              {showPlayerDropdown && (
                <Pressable style={styles.scoutingFilterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.scoutingFilterDropdownHeader}>
                    <Text style={styles.scoutingFilterDropdownTitle}>Spieler wählen</Text>
                    {selectedPlayers.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedPlayers([])}>
                        <Text style={styles.scoutingFilterClearText}>Alle löschen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availablePlayers.length === 0 ? (
                      <Text style={styles.scoutingNoDataText}>Keine Spieler mit Spielen</Text>
                    ) : (
                      availablePlayers.map(player => {
                        const isSelected = selectedPlayers.includes(player.id);
                        const count = playerGames.filter(g => g.player_id === player.id).length;
                        return (
                          <TouchableOpacity key={player.id} style={styles.scoutingFilterCheckboxItem} onPress={() => togglePlayer(player.id)}>
                            <View style={[styles.scoutingCheckbox, isSelected && styles.scoutingCheckboxSelected]}>
                              {isSelected && <Text style={styles.scoutingCheckmark}>✓</Text>}
                            </View>
                            <Text style={styles.scoutingFilterCheckboxText}>{player.name}</Text>
                            <Text style={styles.scoutingFilterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  <TouchableOpacity style={styles.scoutingFilterDoneButton} onPress={() => setShowPlayerDropdown(false)}>
                    <Text style={styles.scoutingFilterDoneText}>Fertig</Text>
                  </TouchableOpacity>
                </Pressable>
              )}
            </View>

            {/* Zuständigkeit Filter */}
            <View style={[styles.scoutingDropdownContainer, { zIndex: 30 }]}>
              <TouchableOpacity 
                style={[styles.scoutingFilterButton, selectedResponsibilities.length > 0 && styles.scoutingFilterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); setShowResponsibilityDropdown(!showResponsibilityDropdown); setShowPlayerDropdown(false); }}
              >
                <Text style={[styles.scoutingFilterButtonText, selectedResponsibilities.length > 0 && styles.scoutingFilterButtonTextActive]}>
                  {getResponsibilityFilterLabel()} ▼
                </Text>
              </TouchableOpacity>
              {showResponsibilityDropdown && (
                <Pressable style={styles.scoutingFilterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.scoutingFilterDropdownHeader}>
                    <Text style={styles.scoutingFilterDropdownTitle}>Zuständigkeit wählen</Text>
                    {selectedResponsibilities.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedResponsibilities([])}>
                        <Text style={styles.scoutingFilterClearText}>Alle löschen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availableResponsibilities.length === 0 ? (
                      <Text style={styles.scoutingNoDataText}>Keine Zuständigkeiten</Text>
                    ) : (
                      availableResponsibilities.map(resp => {
                        const isSelected = selectedResponsibilities.includes(resp);
                        const count = playerGames.filter(g => g.player?.responsibility === resp).length;
                        return (
                          <TouchableOpacity key={resp} style={styles.scoutingFilterCheckboxItem} onPress={() => toggleResponsibility(resp)}>
                            <View style={[styles.scoutingCheckbox, isSelected && styles.scoutingCheckboxSelected]}>
                              {isSelected && <Text style={styles.scoutingCheckmark}>✓</Text>}
                            </View>
                            <Text style={styles.scoutingFilterCheckboxText}>{resp}</Text>
                            <Text style={styles.scoutingFilterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  <TouchableOpacity style={styles.scoutingFilterDoneButton} onPress={() => setShowResponsibilityDropdown(false)}>
                    <Text style={styles.scoutingFilterDoneText}>Fertig</Text>
                  </TouchableOpacity>
                </Pressable>
              )}
            </View>
          </View>
        </Pressable>

        {/* Tabelle */}
        <Pressable style={styles.scoutingContent} onPress={closeAllGameDropdowns}>
          <View style={styles.scoutingGamesContainer}>
            <View style={styles.scoutingTableHeader}>
              <TouchableOpacity 
                style={[styles.scoutingTableHeaderCell, { width: 40 }]} 
                onPress={toggleSelectAllFiltered}
              >
                <View style={[styles.gameCheckbox, areAllFilteredSelected() && styles.gameCheckboxSelected]}>
                  {areAllFilteredSelected() && <Text style={styles.gameCheckmark}>✓</Text>}
                </View>
              </TouchableOpacity>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 0.8 }]}>Datum</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 0.5 }]}>Zeit</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 2 }]}>Spiel</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1 }]}>Art</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1 }]}>Spieler</Text>
              <Text style={[styles.scoutingTableHeaderCell, { flex: 1 }]}>Zuständigkeit</Text>
            </View>
            <ScrollView onScrollBeginDrag={closeAllGameDropdowns}>
              {filteredGames.length === 0 ? (
                <View style={styles.scoutingEmptyState}>
                  {playersWithUrl.length === 0 ? (
                    <>
                      <Text style={styles.scoutingEmptyIcon}>👤</Text>
                      <Text style={styles.scoutingEmptyTitle}>Keine Spieler mit fussball.de URL</Text>
                      <Text style={styles.scoutingEmptyText}>
                        Trage zuerst im Spielerprofil die fussball.de URL ein.{'\n'}
                        Die URL findest du auf fussball.de bei der Mannschaft deines Spielers.
                      </Text>
                    </>
                  ) : playerGames.length === 0 ? (
                    <>
                      <Text style={styles.scoutingEmptyIcon}>⚽</Text>
                      <Text style={styles.scoutingEmptyTitle}>Noch keine Spiele geladen</Text>
                      <Text style={styles.scoutingEmptyText}>
                        Klicke auf "Aktualisieren" um die Spielpläne{'\n'}von fussball.de zu synchronisieren.
                      </Text>
                      <TouchableOpacity style={styles.emptyStateButton} onPress={handleSyncGames}>
                        <Text style={styles.emptyStateButtonText}>Jetzt aktualisieren</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.scoutingEmptyIcon}>🔍</Text>
                      <Text style={styles.scoutingEmptyTitle}>Keine Spiele gefunden</Text>
                      <Text style={styles.scoutingEmptyText}>Ändere die Filterkriterien</Text>
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
                      isToday && styles.gameRowToday
                    ]}>
                      <TouchableOpacity 
                        style={[styles.scoutingTableCell, { width: 40 }]}
                        onPress={() => toggleGameSelection(game.id, game.selected)}
                      >
                        <View style={[styles.gameCheckbox, game.selected && styles.gameCheckboxSelected]}>
                          {game.selected && <Text style={styles.gameCheckmark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                      <Text style={[styles.scoutingTableCell, { flex: 0.8 }, isToday && styles.textBold]}>
                        {formatGameDate(game.date)}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 0.5 }]}>
                        {game.time || '-'}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 2 }]} numberOfLines={1}>
                        {game.home_team} vs {game.away_team}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 1 }]} numberOfLines={1}>
                        {getGameArt(game.league)}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 1, fontWeight: '600' }]} numberOfLines={2}>
                        {(game as any).playerNames?.join(', ') || game.player_name}
                      </Text>
                      <Text style={[styles.scoutingTableCell, { flex: 1 }]} numberOfLines={1}>
                        {(game as any).playerResponsibilities?.join(', ') || game.player?.responsibility || '-'}
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
    
    return (
      <View style={styles.scoutingMainContent}>
        <View style={styles.scoutingHeaderBanner}>
          <TouchableOpacity style={styles.backButton} onPress={() => setViewMode('dashboard')}>
            <Text style={styles.backButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.scoutingHeaderBannerCenter}>
            <Text style={styles.scoutingTitle}>Weitere Termine</Text>
            <Text style={styles.scoutingSubtitle}>{dfbCount} Lehrgänge & Sichtungen • {hallenCount} Turniere</Text>
          </View>
          <View style={styles.termineHeaderButtons}>
            <TouchableOpacity onPress={() => setShowSyncModal(true)} style={styles.scoutingFilterButton}>
              <Text style={styles.scoutingFilterButtonText}>Aktualisieren</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Suchleiste mit Jahrgang-Filter, Archiv und Neuer Termin */}
        <Pressable style={styles.scoutingToolbar} onPress={() => setShowTermineJahrgangDropdown(false)}>
          <View style={styles.spieleSearchContainer}>
            <Text style={styles.scoutingSearchIcon}>🔍</Text>
            <TextInput 
              style={styles.scoutingSearchInput} 
              placeholder="Event, Ort, Art suchen..." 
              placeholderTextColor="#9ca3af"
              value={termineSearchText} 
              onChangeText={setTermineSearchText}
              onFocus={() => setShowTermineJahrgangDropdown(false)}
            />
          </View>
          
          <View style={styles.scoutingFilterContainer}>
            {/* Jahrgang Filter */}
            <View style={[styles.scoutingDropdownContainer, { zIndex: 40 }]}>
              <TouchableOpacity 
                style={[styles.scoutingFilterButton, termineJahrgangFilter.length > 0 && styles.scoutingFilterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); setShowTermineJahrgangDropdown(!showTermineJahrgangDropdown); }}
              >
                <Text style={[styles.scoutingFilterButtonText, termineJahrgangFilter.length > 0 && styles.scoutingFilterButtonTextActive]}>
                  {getJahrgangFilterLabel()} ▼
                </Text>
              </TouchableOpacity>
              {showTermineJahrgangDropdown && (
                <Pressable style={styles.scoutingFilterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.scoutingFilterDropdownHeader}>
                    <Text style={styles.scoutingFilterDropdownTitle}>Jahrgang wählen</Text>
                    {termineJahrgangFilter.length > 0 && (
                      <TouchableOpacity onPress={() => setTermineJahrgangFilter([])}>
                        <Text style={styles.scoutingFilterClearText}>Alle löschen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                    {availableJahrgaenge.length === 0 ? (
                      <Text style={styles.scoutingNoDataText}>Keine Jahrgänge vorhanden</Text>
                    ) : (
                      availableJahrgaenge.sort().map(jg => {
                        const isSelected = termineJahrgangFilter.includes(jg);
                        const count = displayTermine.filter(t => t.jahrgang === jg).length;
                        return (
                          <TouchableOpacity key={jg} style={styles.scoutingFilterCheckboxItem} onPress={() => toggleJahrgangFilter(jg)}>
                            <View style={[styles.scoutingCheckbox, isSelected && styles.scoutingCheckboxSelected]}>
                              {isSelected && <Text style={styles.scoutingCheckmark}>✓</Text>}
                            </View>
                            <Text style={styles.scoutingFilterCheckboxText}>{jg}</Text>
                            <Text style={styles.scoutingFilterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  <TouchableOpacity style={styles.scoutingFilterDoneButton} onPress={() => setShowTermineJahrgangDropdown(false)}>
                    <Text style={styles.scoutingFilterDoneText}>Fertig</Text>
                  </TouchableOpacity>
                </Pressable>
              )}
            </View>

            {/* Anstehend / Archiv Toggle + Neuer Termin */}
            <TouchableOpacity 
              onPress={() => setShowTermineArchiv(false)} 
              style={[styles.scoutingFilterButton, !showTermineArchiv && styles.scoutingFilterButtonActive]}
            >
              <Text style={[styles.scoutingFilterButtonText, !showTermineArchiv && styles.scoutingFilterButtonTextActive]}>
                Anstehend ({filteredTermine.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setShowTermineArchiv(true)} 
              style={[styles.scoutingFilterButton, showTermineArchiv && styles.scoutingFilterButtonActive]}
            >
              <Text style={[styles.scoutingFilterButtonText, showTermineArchiv && styles.scoutingFilterButtonTextActive]}>
                Archiv ({archivTermine.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openAddModal} style={styles.scoutingFilterButton}>
              <Text style={styles.scoutingFilterButtonText}>+ Neuer Termin</Text>
            </TouchableOpacity>
          </View>
        </Pressable>

        <View style={styles.scoutingContent}>
          <View style={styles.scoutingGamesContainer}>
            <View style={styles.termineTableHeader}>
              <SortableHeader field="datum" label="Datum" style={styles.termineColDatum} />
              <View style={styles.termineColZeit}><Text style={styles.termineTableHeaderText}>Zeit</Text></View>
              <SortableHeader field="art" label="Art" style={styles.termineColArt} />
              <SortableHeader field="titel" label="Beschreibung" style={styles.termineColTitel} />
              <SortableHeader field="jahrgang" label="Jahrgang" style={styles.termineColJahrgang} />
              <SortableHeader field="ort" label="Ort" style={styles.termineColOrt} />
              <SortableHeader field="uebernahme" label="Übernahme" style={styles.termineColUebernahme} />
            </View>
            
            <ScrollView>
              {loading ? (
                <Text style={styles.loadingText}>Laden...</Text>
              ) : displayTermine.length === 0 ? (
                <View style={styles.scoutingEmptyState}>
                  <Text style={styles.scoutingEmptyText}>
                    {termineSearchText || termineJahrgangFilter.length > 0 
                      ? 'Keine Treffer gefunden' 
                      : showTermineArchiv 
                        ? 'Keine vergangenen Termine' 
                        : 'Keine Termine vorhanden'
                    }
                  </Text>
                  {!termineSearchText && !showTermineArchiv && termineJahrgangFilter.length === 0 && (
                    <TouchableOpacity onPress={() => setShowSyncModal(true)} style={[styles.scoutingFilterButton, { marginTop: 16 }]}>
                      <Text style={styles.scoutingFilterButtonText}>DFB & Hallen-Termine laden</Text>
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
                        isRunning && !isPast && styles.termineTableRowRunning,
                        isPast && styles.termineTableRowArchiv
                      ]} 
                      onPress={() => openEditModal(termin)}
                    >
                      <Text style={[styles.termineTableCell, styles.termineColDatum, isPast && styles.termineCellArchiv]}>{formatDate(termin)}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColZeit, isPast && styles.termineCellArchiv]}>{time || '-'}</Text>
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
                      <Text style={[styles.termineTableCell, styles.termineColTitel, isPast && styles.termineCellArchiv]} numberOfLines={1}>{termin.titel}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColJahrgang, isPast && styles.termineCellArchiv]}>{termin.jahrgang || '-'}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColOrt, isPast && styles.termineCellArchiv]} numberOfLines={1}>{termin.ort || '-'}</Text>
                      <Text style={[styles.termineTableCell, styles.termineColUebernahme, isPast && styles.termineCellArchiv]}>{getAdvisorName(termin.uebernahme_advisor_id)}</Text>
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
    <View style={styles.placeholderContainer}>
      <TouchableOpacity onPress={() => setViewMode('dashboard')} style={styles.backButtonTop}>
        <Ionicons name="arrow-back" size={20} color="#666" />
      </TouchableOpacity>
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderIcon}>📅</Text>
        <Text style={styles.placeholderTitle}>Kalenderansicht</Text>
        <Text style={styles.placeholderText}>Übersichtliche Monatsansicht mit allen Terminen{'\n'}und Export-Funktion.</Text>
        <View style={styles.comingSoonLarge}><Text style={styles.comingSoonLargeText}>COMING SOON</Text></View>
      </View>
    </View>
  );

  const renderAddEditModal = (isEdit: boolean) => {
    const showModal = isEdit ? showEditModal : showAddModal;
    const datumParts = parseDateToParts(formDatum);
    const datumEndeParts = parseDateToParts(formDatumEnde);
    
    return (
      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => { closeAllModalDropdowns(); }}>
          <Pressable style={styles.modalContent} onPress={() => closeAllModalDropdowns()}>
            <Text style={styles.modalTitle}>{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</Text>
            
            {/* Datum Von */}
            <Text style={styles.formLabel}>Datum von *</Text>
            <View style={[styles.formRow, { zIndex: 100 }]}>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity 
                  style={styles.dropdownButton} 
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumDropdown(showDatumDropdown === 'day' ? null : 'day'); }}
                >
                  <Text style={styles.dropdownButtonText}>{datumParts?.day || 'Tag'}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
                {showDatumDropdown === 'day' && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {DAYS.map(d => (
                      <TouchableOpacity key={d} style={styles.dropdownItem} onPress={() => updateFormDatumPart('day', d)}>
                        <Text style={styles.dropdownItemText}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity 
                  style={styles.dropdownButton} 
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumDropdown(showDatumDropdown === 'month' ? null : 'month'); }}
                >
                  <Text style={styles.dropdownButtonText}>{datumParts ? MONTHS[datumParts.month] : 'Monat'}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
                {showDatumDropdown === 'month' && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {MONTHS.map((m, i) => (
                      <TouchableOpacity key={m} style={styles.dropdownItem} onPress={() => updateFormDatumPart('month', i)}>
                        <Text style={styles.dropdownItemText}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity 
                  style={styles.dropdownButton} 
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumDropdown(showDatumDropdown === 'year' ? null : 'year'); }}
                >
                  <Text style={styles.dropdownButtonText}>{datumParts?.year || 'Jahr'}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
                {showDatumDropdown === 'year' && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {FORM_YEARS.map(y => (
                      <TouchableOpacity key={y} style={styles.dropdownItem} onPress={() => updateFormDatumPart('year', y)}>
                        <Text style={styles.dropdownItemText}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>

            {/* Datum Bis */}
            <Text style={styles.formLabel}>Datum bis</Text>
            <View style={[styles.formRow, { zIndex: 90 }]}>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity 
                  style={styles.dropdownButton} 
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumEndeDropdown(showDatumEndeDropdown === 'day' ? null : 'day'); }}
                >
                  <Text style={styles.dropdownButtonText}>{datumEndeParts?.day || 'Tag'}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
                {showDatumEndeDropdown === 'day' && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => { setFormDatumEnde(''); setShowDatumEndeDropdown(null); }}>
                      <Text style={[styles.dropdownItemText, { color: '#999' }]}>- Kein Enddatum -</Text>
                    </TouchableOpacity>
                    {DAYS.map(d => (
                      <TouchableOpacity key={d} style={styles.dropdownItem} onPress={() => updateFormDatumEndePart('day', d)}>
                        <Text style={styles.dropdownItemText}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity 
                  style={styles.dropdownButton} 
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumEndeDropdown(showDatumEndeDropdown === 'month' ? null : 'month'); }}
                >
                  <Text style={styles.dropdownButtonText}>{datumEndeParts ? MONTHS[datumEndeParts.month] : 'Monat'}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
                {showDatumEndeDropdown === 'month' && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {MONTHS.map((m, i) => (
                      <TouchableOpacity key={m} style={styles.dropdownItem} onPress={() => updateFormDatumEndePart('month', i)}>
                        <Text style={styles.dropdownItemText}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={[styles.formThird, styles.dropdownWrapper]}>
                <TouchableOpacity 
                  style={styles.dropdownButton} 
                  onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowDatumEndeDropdown(showDatumEndeDropdown === 'year' ? null : 'year'); }}
                >
                  <Text style={styles.dropdownButtonText}>{datumEndeParts?.year || 'Jahr'}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
                {showDatumEndeDropdown === 'year' && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {FORM_YEARS.map(y => (
                      <TouchableOpacity key={y} style={styles.dropdownItem} onPress={() => updateFormDatumEndePart('year', y)}>
                        <Text style={styles.dropdownItemText}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>

            {/* Zeit */}
            <Text style={styles.formLabel}>Zeit</Text>
            <TextInput style={styles.formInput} value={formZeit} onChangeText={setFormZeit} placeholder="HH:MM" placeholderTextColor="#999" onFocus={closeAllModalDropdowns} />

            {/* Art */}
            <Text style={styles.formLabel}>Art *</Text>
            <Pressable style={styles.artSelector} onPress={closeAllModalDropdowns}>
              {TERMIN_ARTEN.map((art) => (
                <TouchableOpacity key={art} style={[styles.artOption, formArt === art && styles.artOptionSelected]} onPress={() => setFormArt(art)}>
                  <Text style={[styles.artOptionText, formArt === art && styles.artOptionTextSelected]}>{art}</Text>
                </TouchableOpacity>
              ))}
            </Pressable>

            {/* Beschreibung */}
            <Text style={styles.formLabel}>Beschreibung *</Text>
            <TextInput style={styles.formInput} value={formTitel} onChangeText={setFormTitel} placeholder="z.B. Lehrgang, Meeting, ..." placeholderTextColor="#999" onFocus={closeAllModalDropdowns} />

            {/* Jahrgang Dropdown */}
            <Text style={styles.formLabel}>Jahrgang</Text>
            <View style={[styles.dropdownWrapper, { zIndex: 80 }]}>
              <TouchableOpacity 
                style={styles.dropdownButton} 
                onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowJahrgangDropdown(!showJahrgangDropdown); }}
              >
                <Text style={styles.dropdownButtonText}>{formJahrgang || '- Kein Jahrgang -'}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              {showJahrgangDropdown && (
                <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => { setFormJahrgang(''); setShowJahrgangDropdown(false); }}>
                    <Text style={[styles.dropdownItemText, { color: '#999' }]}>- Kein Jahrgang -</Text>
                  </TouchableOpacity>
                  {JAHRGAENGE.map(jg => (
                    <TouchableOpacity key={jg} style={styles.dropdownItem} onPress={() => { setFormJahrgang(jg); setShowJahrgangDropdown(false); }}>
                      <Text style={styles.dropdownItemText}>{jg}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Ort */}
            <Text style={styles.formLabel}>Ort</Text>
            <TextInput style={styles.formInput} value={formOrt} onChangeText={setFormOrt} placeholder="z.B. Frankfurt, DFB-Campus..." placeholderTextColor="#999" onFocus={closeAllModalDropdowns} />

            {/* Übernahme Dropdown */}
            <Text style={styles.formLabel}>Übernahme durch</Text>
            <View style={[styles.dropdownWrapper, { zIndex: 70 }]}>
              <TouchableOpacity 
                style={styles.dropdownButton} 
                onPress={(e) => { e.stopPropagation(); closeAllModalDropdowns(); setShowUebernahmeDropdown(!showUebernahmeDropdown); }}
              >
                <Text style={styles.dropdownButtonText}>
                  {formUebernahme 
                    ? advisors.find(a => a.id === formUebernahme)?.first_name + ' ' + advisors.find(a => a.id === formUebernahme)?.last_name 
                    : '- Keine Auswahl -'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              {showUebernahmeDropdown && (
                <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => { setFormUebernahme(''); setShowUebernahmeDropdown(false); }}>
                    <Text style={[styles.dropdownItemText, { color: '#999' }]}>- Keine Auswahl -</Text>
                  </TouchableOpacity>
                  {advisors.map(adv => (
                    <TouchableOpacity key={adv.id} style={styles.dropdownItem} onPress={() => { setFormUebernahme(adv.id); setShowUebernahmeDropdown(false); }}>
                      <Text style={styles.dropdownItemText}>{adv.first_name} {adv.last_name}</Text>
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
              <TouchableOpacity style={styles.cancelButton} onPress={() => { isEdit ? setShowEditModal(false) : setShowAddModal(false); resetForm(); closeAllModalDropdowns(); }}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={isEdit ? handleUpdateTermin : handleSaveTermin}>
                <Text style={styles.saveButtonText}>Speichern</Text>
              </TouchableOpacity>
            </View>

            {/* Delete Confirmation Modal */}
            <Modal visible={showDeleteConfirm} transparent animationType="fade">
              <View style={styles.modalOverlay}>
                <View style={styles.deleteConfirmModal}>
                  <Text style={styles.deleteConfirmTitle}>Termin löschen?</Text>
                  <Text style={styles.deleteConfirmText}>Möchtest du diesen Termin wirklich löschen?</Text>
                  <Text style={styles.deleteConfirmTermin}>{selectedTermin?.titel}</Text>
                  <View style={styles.deleteConfirmButtons}>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDeleteConfirm(false)}>
                      <Text style={styles.cancelButtonText}>Abbrechen</Text>
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
        <View style={styles.syncModalContent}>
          <Text style={styles.modalTitle}>🇩🇪 Termine synchronisieren</Text>
          <Text style={styles.syncDescription}>
            Lädt {getDFBTermineCount()} DFB-Nationalmannschaftstermine und {getHallenTermineCount()} Hallenturniere.{'\n'}
            Bereits vorhandene Termine werden übersprungen.
          </Text>
          <Text style={styles.syncStand}>Stand: {getLastUpdateDisplay()}</Text>
          {syncLoading ? (
            <View style={styles.syncLoadingContainer}>
              <ActivityIndicator size="large" color="#000" />
              <Text style={styles.syncLoadingText}>Synchronisiere...</Text>
            </View>
          ) : syncResult ? (
            <View style={styles.syncResultContainer}>
              <Text style={styles.syncResultTitle}>✓ Synchronisierung abgeschlossen</Text>
              <Text style={styles.syncResultText}>{syncResult.added} neue Termine hinzugefügt</Text>
              <Text style={styles.syncResultText}>{syncResult.skipped} bereits vorhanden (übersprungen)</Text>
            </View>
          ) : null}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowSyncModal(false); setSyncResult(null); }}>
              <Text style={styles.cancelButtonText}>{syncResult ? 'Schließen' : 'Abbrechen'}</Text>
            </TouchableOpacity>
            {!syncResult && (
              <TouchableOpacity style={styles.saveButton} onPress={handleDFBSync} disabled={syncLoading}>
                <Text style={styles.saveButtonText}>Jetzt synchronisieren</Text>
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
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>🔑 API Token einrichten</Text>
          <Text style={styles.syncDescription}>
            Um Spiele von fussball.de zu laden, wird ein API Token benötigt.{'\n\n'}
            1. Gehe zu api-fussball.de/token{'\n'}
            2. Registriere dich mit deiner E-Mail{'\n'}
            3. Kopiere den Token und füge ihn hier ein
          </Text>
          <Text style={styles.formLabel}>API Token</Text>
          <TextInput 
            style={styles.formInput} 
            value={apiToken} 
            onChangeText={setApiToken} 
            placeholder="Dein API Token..." 
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowTokenModal(false); setApiToken(''); }}>
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveToken}>
              <Text style={styles.saveButtonText}>Speichern</Text>
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

  return (
    <View style={styles.container}>
      <Sidebar navigation={navigation} activeScreen="termine" profile={profile} />
      <View style={styles.mainContent}>
        {viewMode === 'dashboard' && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('AdvisorDashboard')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Zurück</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Spieltage</Text>
              <Text style={styles.headerSubtitle}>Übersicht über Spieltage unserer Spieler und weitere Lehrgänge und Termine</Text>
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
  mainContent: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  backButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  backButtonText: { fontSize: 14, color: '#64748b' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  gridContainer: { maxWidth: 1000, width: '100%' },
  row: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  card: { borderRadius: 20, overflow: 'hidden', cursor: 'pointer' as any },
  cardHovered: { transform: [{ scale: 1.02 }], shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
  lightCardHovered: { backgroundColor: '#f0f0f0', transform: [{ scale: 1.01 }] },
  darkCardHovered: { backgroundColor: '#2a2a2a', transform: [{ scale: 1.02 }] },
  mainCardHovered: { backgroundColor: '#fafafa', transform: [{ scale: 1.005 }] },
  mainCard: { flex: 2, backgroundColor: '#fff', padding: 28, minHeight: 280, borderWidth: 1, borderColor: '#eee', position: 'relative' },
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
  termineCard: { flex: 1, backgroundColor: '#fff', padding: 20, borderWidth: 1, borderColor: '#eee', justifyContent: 'space-between' },
  termineCardFull: { flex: 1, backgroundColor: '#fff', padding: 28, minHeight: 280, borderWidth: 1, borderColor: '#eee', borderRadius: 20, justifyContent: 'space-between', position: 'relative' },
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
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600 },
  syncModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 450 },
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
  selectInput: { padding: 12, fontSize: 15, border: 'none', width: '100%', backgroundColor: '#fff' },
  
  // Dropdown Styles
  dropdownWrapper: { position: 'relative' as any, marginBottom: 4 },
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  dropdownButtonText: { fontSize: 15, color: '#333' },
  dropdownArrow: { fontSize: 12, color: '#999' },
  dropdownList: { position: 'absolute' as any, top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, maxHeight: 200, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownItemText: { fontSize: 15, color: '#333' },
  
  artSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  artOption: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  artOptionSelected: { backgroundColor: '#000', borderColor: '#000' },
  artOptionText: { fontSize: 13, color: '#333' },
  artOptionTextSelected: { color: '#fff' },
  modalButtons: { flexDirection: 'row', marginTop: 24, gap: 8 },
  deleteButton: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#ff4444', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  deleteButtonText: { color: '#ff4444', fontWeight: '600' },
  deleteConfirmModal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400, alignItems: 'center' },
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
  scoutingHeaderBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  scoutingHeaderBannerCenter: { alignItems: 'center', flex: 1 },
  scoutingTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  scoutingSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  headerButtonsRow: { flexDirection: 'row', gap: 8 },
  scoutingToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 100 },
  spieleSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, flex: 1, maxWidth: 600 },
  scoutingSearchIcon: { fontSize: 16, marginRight: 8 },
  scoutingSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, outlineStyle: 'none' as any },
  scoutingFilterContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 },
  scoutingDropdownContainer: { position: 'relative' as any },
  scoutingFilterButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  scoutingFilterButtonActive: { backgroundColor: '#e0f2fe', borderColor: '#3b82f6' },
  scoutingFilterButtonText: { fontSize: 14, color: '#64748b' },
  scoutingFilterButtonTextActive: { color: '#0369a1' },
  scoutingFilterDropdownMulti: { position: 'absolute' as any, top: '100%', right: 0, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, minWidth: 220, marginTop: 4, zIndex: 1002, borderWidth: 1, borderColor: '#e5e7eb' },
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
  scoutingGamesContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  scoutingTableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  scoutingTableHeaderCell: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' as any },
  scoutingTableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  scoutingTableCell: { fontSize: 14, color: '#1a1a1a' },
  scoutingClubLogo: { width: 20, height: 20, resizeMode: 'contain' as any, marginHorizontal: 4 },
  scoutingMatchText: { fontWeight: '500', marginHorizontal: 4 },
  scoutingEmptyState: { padding: 60, alignItems: 'center' },
  scoutingEmptyIcon: { fontSize: 48, marginBottom: 16 },
  scoutingEmptyTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  scoutingEmptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  emptyStateButton: { marginTop: 20, backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  emptyStateButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  
  // Game specific styles
  gameCheckbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
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
  syncResultWarning: { backgroundColor: '#fef3c7' },
  syncResultText: { fontSize: 14, color: '#1a1a1a' },
  syncResultClose: { fontSize: 18, color: '#64748b', paddingHorizontal: 8 },
  
  // Termine styles
  termineHeaderButtons: { flexDirection: 'row', gap: 8 },
  termineTableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  termineTableHeaderText: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' as any },
  sortableHeader: { cursor: 'pointer' as any },
  termineTableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', backgroundColor: '#fff' },
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
});
