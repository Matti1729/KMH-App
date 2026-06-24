import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Pressable, Modal, Alert, Platform, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { AdvisorBackground } from '../../components/AdvisorBackground';
import { AdvisorHeroHeader, heroCardAttachedToolbar } from '../../components/AdvisorHeroHeader';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ColumnDef } from '../../types/tableColumns';
import { useTableColumns } from '../../hooks/useTableColumns';
import { TableHeader } from '../../components/table/TableHeader';
import { TableRow } from '../../components/table/TableRow';

const POSITIONS = ['Torwart', 'Innenverteidiger', 'Linker Verteidiger', 'Rechter Verteidiger', 'Defensives Mittelfeld', 'Offensives Mittelfeld', 'Linke Außenbahn', 'Rechte Außenbahn', 'Stürmer'];
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

const ArbeitsamtIcon = require('../../../assets/arbeitsamt.png');

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

const CLUB_COLUMNS: ColumnDef[] = [
  { key: 'date', label: 'Aktualität', defaultFlex: 0.8, minWidth: 80 },
  { key: 'club_name', label: 'Verein', defaultFlex: 1.5, minWidth: 150 },
  { key: 'league', label: 'Liga', defaultFlex: 1.2, minWidth: 100 },
  { key: 'position_needed', label: 'Position', defaultFlex: 1.2, minWidth: 120 },
  { key: 'year_range', label: 'Alter/Jahrgang', defaultFlex: 1, minWidth: 100 },
  { key: 'contact_person', label: 'Ansprechpartner', defaultFlex: 1.2, minWidth: 100 },
];

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
  in_transfer_list: boolean;
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
type ActiveTab = 'spieler' | 'vereine';

interface OfferDocument {
  name: string;
  url: string;
  path: string;
  uploaded_at: string;
}

interface SearchingClub {
  id: string;
  club_name: string;
  league: string;
  position_needed: string;
  year_range: string;
  contact_person: string;
  notes: string;
  created_at: string;
  offer_documents: OfferDocument[];
}

export function TransfersScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { session, loading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const dataLoadedRef = useRef(false);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [transferPlayers, setTransferPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('contract_end');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('berater');
  const [myPlayerIds, setMyPlayerIds] = useState<string[]>([]);
  const [profile, setProfile] = useState<Advisor | null>(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>('spieler');
  
  // Searching Clubs State
  const [searchingClubs, setSearchingClubs] = useState<SearchingClub[]>([]);
  const [filteredSearchingClubs, setFilteredSearchingClubs] = useState<SearchingClub[]>([]);
  const [showAddClubModal, setShowAddClubModal] = useState(false);
  const [newClub, setNewClub] = useState<Partial<SearchingClub>>({
    club_name: '',
    league: '',
    position_needed: '',
    year_range: '',
    contact_person: '',
    notes: '',
  });
  
  // Club Search States
  const [clubSearchText, setClubSearchText] = useState('');
  const [selectedClubPositions, setSelectedClubPositions] = useState<string[]>([]);
  const [selectedClubYears, setSelectedClubYears] = useState<string[]>([]);
  const [showMobileClubFilters, setShowMobileClubFilters] = useState(false);
  const [showClubPositionDropdown, setShowClubPositionDropdown] = useState(false);
  const [showClubYearDropdown, setShowClubYearDropdown] = useState(false);
  
  // Club Detail Modal
  const [selectedClub, setSelectedClub] = useState<SearchingClub | null>(null);
  const [showClubDetailModal, setShowClubDetailModal] = useState(false);
  
  // Form Position Picker (für neuen Verein)
  const [formPositions, setFormPositions] = useState<string[]>([]);
  const [showFormPositionDropdown, setShowFormPositionDropdown] = useState(false);
  // Football-Network-Kontakte des aktuell ausgewählten Vereins für den Ansprechpartner-Picker
  const [formClubContacts, setFormClubContacts] = useState<Array<{ id: string; vorname: string; nachname: string; position: string; bereich: string; mannschaft: string }>>([]);
  const [showFormAdvisorSuggestions, setShowFormAdvisorSuggestions] = useState(false);
  
  // Club Form Dropdown
  const [formClubSearch, setFormClubSearch] = useState('');
  const [showFormClubDropdown, setShowFormClubDropdown] = useState(false);

  // Club Search (remote Transfermarkt)
  const [clubSearchResults, setClubSearchResults] = useState<Array<{ name: string; logoUrl: string; liga: string; country: string }>>([]);
  const [clubSearching, setClubSearching] = useState(false);
  const clubSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Editing State
  const [editingClub, setEditingClub] = useState<SearchingClub | null>(null);

  // Offer Documents State
  const [clubOfferDocuments, setClubOfferDocuments] = useState<OfferDocument[]>([]);
  const [uploadingOffer, setUploadingOffer] = useState(false);
  
  // Liste aller Vereine für Dropdown
  const [allClubNames, setAllClubNames] = useState<string[]>([]);

  const [searchText, setSearchText] = useState('');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null);

  // Click-outside-Handler für Mobile-Filter-Dropdowns (Skill-Pattern)
  useEffect(() => {
    if (!openFilterDropdown || typeof document === 'undefined') return;
    const handler = (e: any) => {
      const target = e.target;
      if (target && target.closest && target.closest('[data-kmh-dropdown]')) return;
      setOpenFilterDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openFilterDropdown]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);

  // Mobile States
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Separate Dropdown States wie in Scouting
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [showListingDropdown, setShowListingDropdown] = useState(false);
  const [showResponsibilityDropdown, setShowResponsibilityDropdown] = useState(false);

  // Table columns (drag & drop + resize)
  const [playerTableWidth, setPlayerTableWidth] = useState(0);
  const playerTable = useTableColumns(PLAYER_COLUMNS, playerTableWidth, 'transfers_players');
  const [clubTableWidth, setClubTableWidth] = useState(0);
  const clubTable = useTableColumns(CLUB_COLUMNS, clubTableWidth, 'transfers_clubs');

  // Dynamische Jahrgänge aus den vorhandenen Spielerdaten
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    transferPlayers.forEach(p => {
      if (p.birth_date) {
        const year = new Date(p.birth_date).getFullYear().toString();
        if (!isNaN(parseInt(year))) years.add(year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [transferPlayers]);
  
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
  
  // Clear Funktionen
  const clearPositions = () => setSelectedPositions([]);
  const clearYears = () => setSelectedYears([]);
  const clearListings = () => setSelectedListings([]);
  const clearResponsibilities = () => setSelectedResponsibilities([]);
  
  // Prüfen ob ein Dropdown offen ist
  const isAnyDropdownOpen = showYearDropdown || showPositionDropdown || showListingDropdown || showResponsibilityDropdown || showClubPositionDropdown || showClubYearDropdown;
  
  // Alle Dropdowns schließen
  const closeAllDropdowns = () => {
    setShowYearDropdown(false);
    setShowPositionDropdown(false);
    setShowListingDropdown(false);
    setShowResponsibilityDropdown(false);
    setShowClubPositionDropdown(false);
    setShowClubYearDropdown(false);
  };

  // Daten nur laden wenn Auth bereit ist
  useEffect(() => {
    if (authLoading) return;
    if (!session) return;
    if (dataLoadedRef.current) return;

    dataLoadedRef.current = true;
    fetchCurrentUser();
    fetchPlayers();
    fetchClubLogos();
    fetchAdvisors();
    fetchSearchingClubs();
  }, [authLoading, session]);

  useEffect(() => { 
    filterTransferPlayers(); 
  }, [allPlayers]);

  useEffect(() => { 
    applyFilters(); 
  }, [searchText, transferPlayers, selectedYears, selectedPositions, selectedListings, selectedResponsibilities, sortField, sortDirection]);
  
  useEffect(() => {
    applyClubFilters();
  }, [clubSearchText, searchingClubs, selectedClubPositions, selectedClubYears]);

  // Football-Network-Kontakte des im Formular gewählten Vereins laden,
  // damit sie als Ansprechpartner-Vorschläge angezeigt werden.
  useEffect(() => {
    const club = (newClub.club_name || formClubSearch || '').trim();
    if (!club) { setFormClubContacts([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('football_network_contacts')
        .select('id, vorname, nachname, position, bereich, mannschaft')
        .eq('verein', club)
        .order('nachname', { ascending: true });
      if (!cancelled) setFormClubContacts(data || []);
    })();
    return () => { cancelled = true; };
  }, [newClub.club_name, formClubSearch]);

  const fetchSearchingClubs = async () => {
    const { data } = await supabase
      .from('searching_clubs')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setSearchingClubs(data);
      setFilteredSearchingClubs(data);
    }
  };
  
  const applyClubFilters = () => {
    let filtered = [...searchingClubs];
    
    if (clubSearchText.trim() !== '') {
      const search = clubSearchText.toLowerCase();
      filtered = filtered.filter(club => 
        club.club_name?.toLowerCase().includes(search) ||
        club.league?.toLowerCase().includes(search) ||
        club.position_needed?.toLowerCase().includes(search) ||
        club.year_range?.toLowerCase().includes(search) ||
        club.contact_person?.toLowerCase().includes(search) ||
        club.notes?.toLowerCase().includes(search)
      );
    }
    
    if (selectedClubPositions.length > 0) {
      filtered = filtered.filter(club => 
        club.position_needed && selectedClubPositions.some(pos => club.position_needed.includes(pos))
      );
    }
    
    if (selectedClubYears.length > 0) {
      filtered = filtered.filter(club => 
        club.year_range && selectedClubYears.some(year => club.year_range.includes(year))
      );
    }
    
    setFilteredSearchingClubs(filtered);
  };
  
  const toggleFormPosition = (pos: string) => {
    setFormPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };
  
  const handleClubClick = (club: SearchingClub) => {
    setSelectedClub(club);
    setShowClubDetailModal(true);
  };
  
  const resetClubForm = () => {
    setNewClub({ club_name: '', league: '', position_needed: '', year_range: '', contact_person: '', notes: '' });
    setFormPositions([]);
    setFormClubSearch('');
    setShowFormClubDropdown(false);
    setEditingClub(null);
    setClubOfferDocuments([]);
    setClubSearchResults([]);
    setClubSearching(false);
    if (clubSearchTimeout.current) clearTimeout(clubSearchTimeout.current);
  };
  
  const openEditClubModal = (club: SearchingClub) => {
    setEditingClub(club);
    setNewClub({
      club_name: club.club_name,
      league: club.league,
      position_needed: club.position_needed,
      year_range: club.year_range,
      contact_person: club.contact_person,
      notes: club.notes,
    });
    setFormClubSearch(club.club_name);
    setFormPositions(club.position_needed ? club.position_needed.split(', ').filter(p => p.trim()) : []);
    setClubOfferDocuments(club.offer_documents || []);
    setShowClubDetailModal(false);
    setShowAddClubModal(true);
  };
  
  const saveSearchingClub = async () => {
    const clubName = newClub.club_name || formClubSearch;
    if (!clubName?.trim()) return;
    
    const clubData = {
      club_name: clubName,
      league: newClub.league || '',
      position_needed: formPositions.join(', '),
      year_range: newClub.year_range || '',
      contact_person: newClub.contact_person || '',
      notes: newClub.notes || '',
      offer_documents: clubOfferDocuments,
    };
    
    if (editingClub) {
      // Update existing - auch created_at aktualisieren für "Aktualität"
      const { error } = await supabase.from('searching_clubs').update({
        ...clubData,
        created_at: new Date().toISOString(),
      }).eq('id', editingClub.id);
      if (!error) {
        fetchSearchingClubs();
        setShowAddClubModal(false);
        resetClubForm();
      }
    } else {
      // Insert new
      const { error } = await supabase.from('searching_clubs').insert(clubData);
      if (!error) {
        fetchSearchingClubs();
        setShowAddClubModal(false);
        resetClubForm();
      }
    }
  };
  
  const deleteSearchingClub = async () => {
    if (!editingClub) return;
    const { error } = await supabase.from('searching_clubs').delete().eq('id', editingClub.id);
    if (!error) {
      fetchSearchingClubs();
      setShowAddClubModal(false);
      resetClubForm();
    }
  };
  
  const uploadOfferDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled) return;
      setUploadingOffer(true);

      const file = result.assets[0];
      const sanitizedName = file.name
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
        .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      const clubId = editingClub?.id || 'new';
      const fileName = `${clubId}/${Date.now()}_${sanitizedName}`;

      let fileData: Blob | ArrayBuffer;
      if (file.file) {
        fileData = file.file;
      } else {
        const response = await fetch(file.uri);
        fileData = await response.blob();
      }

      const { error: uploadError } = await supabase.storage
        .from('offers')
        .upload(fileName, fileData, { contentType: 'application/pdf', upsert: false });

      if (uploadError) {
        Alert.alert('Fehler', uploadError.message);
        setUploadingOffer(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('offers').getPublicUrl(fileName);
      setClubOfferDocuments(prev => [...prev, {
        name: file.name,
        url: urlData.publicUrl,
        path: fileName,
        uploaded_at: new Date().toISOString(),
      }]);
      setUploadingOffer(false);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Fehler', 'Dokument konnte nicht hochgeladen werden');
      setUploadingOffer(false);
    }
  };

  const deleteOfferDocument = async (path: string) => {
    await supabase.storage.from('offers').remove([path]);
    setClubOfferDocuments(prev => prev.filter(doc => doc.path !== path));
  };

  const openOfferDocument = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const getFilteredClubsForForm = () => {
    if (!formClubSearch.trim()) return allClubNames.slice(0, 10);
    return allClubNames.filter(name => name.toLowerCase().includes(formClubSearch.toLowerCase())).slice(0, 10);
  };

  const searchClubsRemote = async (query: string) => {
    if (query.trim().length < 2) { setClubSearchResults([]); return; }
    setClubSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-club', { body: { query } });
      if (error) { setClubSearchResults([]); return; }
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.results && Array.isArray(parsed.results)) {
        setClubSearchResults(parsed.results);
      } else {
        setClubSearchResults([]);
      }
    } catch (e) {
      console.error('Club search exception:', e);
      setClubSearchResults([]);
    } finally {
      setClubSearching(false);
    }
  };

  const handleFormClubSearchChange = (text: string) => {
    setFormClubSearch(text);
    setShowFormClubDropdown(true);
    if (clubSearchTimeout.current) clearTimeout(clubSearchTimeout.current);
    clubSearchTimeout.current = setTimeout(() => searchClubsRemote(text), 500);
  };

  const selectRemoteClub = (club: { name: string; logoUrl: string; liga?: string; country?: string }) => {
    setFormClubSearch(club.name);
    setNewClub(prev => ({ ...prev, club_name: club.name, league: club.liga || prev.league }));
    setShowFormClubDropdown(false);
    setClubSearchResults([]);
    if (club.name) {
      setClubLogos(prev => ({ ...prev, [club.name]: club.logoUrl }));
      if (!allClubNames.includes(club.name)) {
        setAllClubNames(prev => [...prev, club.name].sort());
      }
    }
  };

  const selectFreitextClub = () => {
    if (formClubSearch.trim()) {
      setNewClub(prev => ({ ...prev, club_name: formClubSearch.trim() }));
      if (!allClubNames.includes(formClubSearch.trim())) {
        setAllClubNames(prev => [...prev, formClubSearch.trim()].sort());
      }
      setShowFormClubDropdown(false);
      setClubSearchResults([]);
    }
  };

  const toggleClubPosition = (pos: string) => {
    setSelectedClubPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };
  
  const toggleClubYear = (year: string) => {
    setSelectedClubYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };
  
  const clearClubPositions = () => setSelectedClubPositions([]);
  const clearClubYears = () => setSelectedClubYears([]);
  
  const getClubPositionFilterLabel = () => {
    if (selectedClubPositions.length === 0) return 'Position';
    if (selectedClubPositions.length === 1) return POSITION_SHORT[selectedClubPositions[0]] || selectedClubPositions[0];
    return `${selectedClubPositions.length} Positionen`;
  };
  
  const getClubYearFilterLabel = () => {
    if (selectedClubYears.length === 0) return 'Jahrgang';
    if (selectedClubYears.length === 1) return `Jg. ${selectedClubYears[0]}`;
    return `${selectedClubYears.length} Jahrgänge`;
  };
  
  // Verfügbare Jahrgänge für Club-Filter
  const availableClubYears = React.useMemo(() => {
    const years = new Set<string>();
    searchingClubs.forEach(club => {
      if (club.year_range) {
        // Extrahiere Jahre aus dem Range (z.B. "2005-2007" -> ["2005", "2006", "2007"])
        const match = club.year_range.match(/\d{4}/g);
        if (match) match.forEach(y => years.add(y));
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [searchingClubs]);

  const fetchAdvisors = async () => {
    const { data } = await supabase.from('advisors').select('id, first_name, last_name').neq('role', 'athletiktrainer').order('last_name');
    if (data) setAdvisors(data);
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: advisor } = await supabase.from('advisors').select('role, first_name, last_name').eq('id', user.id).single();
      if (advisor) {
        setUserRole(advisor.role || 'berater');
        setProfile({ id: user.id, ...advisor });
      }
      fetchMyPlayerAccess(user.id);
    }
  };

  const fetchMyPlayerAccess = async (userId?: string) => {
    const uid = userId || currentUserId;
    if (!uid) return;

    // 1. Hole IDs aus advisor_access (OHNE access_type Filter)
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
  };

  const fetchClubLogos = async () => {
    const { data, error } = await supabase.from('club_logos').select('club_name, logo_url');
    if (!error && data) {
      const logoMap: Record<string, string> = {};
      const clubNames: string[] = [];
      data.forEach((item: ClubLogo) => {
        logoMap[item.club_name] = item.logo_url;
        clubNames.push(item.club_name);
        const simplified = item.club_name.replace(' II', '').replace(' U23', '').replace(' U21', '').replace(' U19', '');
        if (simplified !== item.club_name) logoMap[simplified] = item.logo_url;
      });
      setClubLogos(logoMap);
      setAllClubNames(clubNames.sort());
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

  const isContractExpired = (contractEnd: string): boolean => {
    if (!contractEnd) return false; // Kein Vertragsende = nicht als abgelaufen betrachten
    const today = new Date();
    const contractDate = new Date(contractEnd);
    // Vertrag gilt als abgelaufen erst NACH dem Vertragsende (also ab 01.07. wenn Vertrag am 30.06. endet)
    return today > contractDate;
  };

  // Gleiche Logik wie im Spielerprofil - prüft ob Vertrag in der aktuellen Saison endet
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

  const hasFutureClub = (player: Player): boolean => {
    return player.future_club && player.future_club.trim() !== '';
  };

  // Zeigt aktuellen Verein an - nur "Vereinslos" wenn Vertrag abgelaufen UND kein Verein
  const getDisplayClub = (player: Player): string => {
    // Wenn Verein eingetragen ist, immer anzeigen
    if (player.club && player.club.trim() !== '') {
      // Nur "Vereinslos" wenn Vertrag wirklich abgelaufen ist
      if (isContractExpired(player.contract_end)) return 'Vereinslos';
      return player.club;
    }
    return '-';
  };

  const isBirthday = (birthDate: string): boolean => {
    if (!birthDate) return false;
    const today = new Date();
    const birth = new Date(birthDate);
    return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate();
  };

  const hasAccessToPlayer = (playerId: string): boolean => {
    if (userRole === 'admin') return true;
    return myPlayerIds.includes(playerId);
  };

  const handlePlayerClick = (player: Player) => {
    if (hasAccessToPlayer(player.id)) {
      navigation.navigate('TransferDetail', { playerId: player.id });
    }
  };

  // Filtere nur Spieler die:
  // 1. Manuell zur Transfer-Liste hinzugefügt (in_transfer_list = true) ODER
  // 2. Vereinslos sind (Vertrag bereits abgelaufen) ODER
  // 3. Vertrag läuft in der aktuellen Saison aus (gleiche Logik wie im Spielerprofil)
  // UND: Kein zukünftiger Verein eingetragen (außer manuell hinzugefügt)
  const filterTransferPlayers = () => {
    const transfers = allPlayers.filter(player => {
      // Manuell zur Transfer-Liste hinzugefügt? -> Immer anzeigen
      if (player.in_transfer_list) return true;
      
      // Hat bereits zukünftigen Verein? -> Nicht in Transfers
      if (hasFutureClub(player)) return false;
      
      // Vereinslos (Vertrag abgelaufen) oder Vertrag läuft in aktueller Saison aus?
      const expired = isContractExpired(player.contract_end);
      const inCurrentSeason = isContractInCurrentSeason(player.contract_end);
      
      return expired || inCurrentSeason;
    });
    
    setTransferPlayers(transfers);
  };

  const applyFilters = () => {
    let filtered = [...transferPlayers];
    
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
      filtered = filtered.filter(player => player.responsibility && selectedResponsibilities.some(resp => player.responsibility.includes(resp)));
    }
    
    filtered.sort((a, b) => {
      let valueA: any, valueB: any;
      switch (sortField) {
        case 'name': valueA = `${a.last_name} ${a.first_name}`.toLowerCase(); valueB = `${b.last_name} ${b.first_name}`.toLowerCase(); break;
        case 'birth_date': valueA = a.birth_date ? new Date(a.birth_date).getTime() : 0; valueB = b.birth_date ? new Date(b.birth_date).getTime() : 0; break;
        case 'contract_end': valueA = a.contract_end ? new Date(a.contract_end).getTime() : 0; valueB = b.contract_end ? new Date(b.contract_end).getTime() : 0; break;
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

  const fetchPlayers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('player_details').select('id, first_name, last_name, birth_date, position, club, league, contract_end, listing, responsibility, future_club, in_transfer_list').order('last_name', { ascending: true });
    if (!error) setAllPlayers(data || []);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlayers();
    await fetchSearchingClubs();
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
    // Immer versuchen Logo zu laden, auch bei auslaufendem Vertrag (solange noch nicht abgelaufen)
    const logoUrl = getClubLogo(player.club);
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
    const expired = isContractExpired(player.contract_end);
    if (expired) {
      return <Text style={[styles.tableCell, styles.colContract, { color: '#ef4444' }]}>Vereinslos</Text>;
    }
    return <Text style={[styles.tableCell, styles.colContract, { color: '#ef4444' }]}>{formatDate(player.contract_end)}</Text>;
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
          <Text style={[styles.tableCell, styles.nameCell, { color: colors.text }]} numberOfLines={1}>
            {player.last_name}, {player.first_name}{birthday && ' 🎉'}
          </Text>
          {!hasAccess && <Text style={styles.lockIcon}>🔒</Text>}
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

  // Mobile Player Card - identisch zu PlayerOverviewScreen
  const renderMobilePlayerCard = (player: Player) => {
    const hasAccess = userRole === 'admin' || myPlayerIds.includes(player.id);
    const positionsList = player.position
      ? player.position.split(',').map(p => POSITION_SHORT[p.trim()] || p.trim()).filter(Boolean)
      : [];
    const expired = isContractExpired(player.contract_end);
    const displayClub = getDisplayClub(player);
    const logoUrl = expired ? null : getClubLogo(player.club);
    const inCurrentSeason = isContractInCurrentSeason(player.contract_end);
    const hasSecuredFuture = hasFutureClub(player) && inCurrentSeason;
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
            {/* Reihe 1: Name + Position-Badge | Vertragslaufzeit rechtsbündig */}
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

  // Active filter count for mobile
  const activeFilterCount = selectedPositions.length + selectedYears.length + selectedListings.length + selectedResponsibilities.length;

  // Profile initials for header
  const profileInitials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}` : '?';

  // Mobile View
  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: 'transparent' }]}>
        <AdvisorBackground />
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="transfers"
          profile={profile}
        />

        <View style={[styles.mainContentMobile, { backgroundColor: 'transparent' }]}>
          {/* Mobile Header — Skill-Pattern: Tabs + Search + Filter alle als children */}
          <MobileHeader
            title="Transfers"
            subtitle={activeTab === 'spieler' ? `${filteredPlayers.length} aktive Spieler` : `${filteredSearchingClubs.length} Vereine`}
            backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
            onMenuPress={() => setShowMobileSidebar(true)}
          >
            <View style={{ flex: 1, flexDirection: 'column', alignItems: 'stretch' }}>
              {/* Main Tabs: Spieler / Vereine */}
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'spieler' ? '#22c55e' : 'transparent' }}
                  onPress={() => setActiveTab('spieler')}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: activeTab === 'spieler' ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                    Spieler ({transferPlayers.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'vereine' ? '#22c55e' : 'transparent' }}
                  onPress={() => setActiveTab('vereine')}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: activeTab === 'vereine' ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                    Vereine ({searchingClubs.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Search + Filter — direkt unter Tabs */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 6, paddingHorizontal: 10, height: 28 }}>
                  <Ionicons name="search" size={12} color="rgba(255,255,255,0.5)" />
                  <TextInput
                    style={{ flex: 1, paddingVertical: 0, fontSize: 12, color: '#fff', marginLeft: 6 }}
                    placeholder={activeTab === 'spieler' ? "Spieler suchen..." : "Verein suchen..."}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={activeTab === 'spieler' ? searchText : clubSearchText}
                    onChangeText={activeTab === 'spieler' ? setSearchText : setClubSearchText}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    { width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
                    ((activeTab === 'spieler' && activeFilterCount > 0) || (activeTab === 'vereine' && (selectedClubPositions.length > 0 || selectedClubYears.length > 0))) && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => activeTab === 'spieler' ? setShowMobileFilters(true) : setShowMobileClubFilters(true)}
                >
                  <Ionicons name="filter" size={14} color={((activeTab === 'spieler' && activeFilterCount > 0) || (activeTab === 'vereine' && (selectedClubPositions.length > 0 || selectedClubYears.length > 0))) ? colors.primaryText : 'rgba(255,255,255,0.85)'} />
                  {activeTab === 'spieler' && activeFilterCount > 0 && (
                    <View style={styles.filterCountBubble}><Text style={styles.filterCountText}>{activeFilterCount}</Text></View>
                  )}
                  {activeTab === 'vereine' && (selectedClubPositions.length + selectedClubYears.length) > 0 && (
                    <View style={styles.filterCountBubble}><Text style={styles.filterCountText}>{selectedClubPositions.length + selectedClubYears.length}</Text></View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </MobileHeader>

          {/* Content */}
          <ScrollView style={styles.mobileCardList} contentContainerStyle={styles.mobileCardListContent}>
            {loading ? (
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Laden...</Text>
            ) : activeTab === 'spieler' ? (
              filteredPlayers.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Spieler gefunden</Text>
              ) : (
                filteredPlayers.map(player => renderMobilePlayerCard(player))
              )
            ) : (
              filteredSearchingClubs.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Vereine gefunden</Text>
              ) : (
                filteredSearchingClubs.map(club => (
                  <TouchableOpacity
                    key={club.id}
                    style={[styles.mobileCard, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}
                    onPress={() => { setSelectedClub(club); setShowClubDetailModal(true); }}
                  >
                    {/* Header-Row: Logo + [Vereinsname · Liga / Ansprechpartner darunter] | Position-Badges */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {clubLogos[club.club_name] && (
                        <Image source={{ uri: clubLogos[club.club_name] }} style={styles.mobileCardClubLogo} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1}>
                          <Text style={[styles.mobileCardName, { color: colors.text }]}>{club.club_name}</Text>
                          {club.league ? <Text style={{ fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.5)' }}>  ·  {club.league}</Text> : null}
                        </Text>
                        {club.contact_person ? (
                          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }} numberOfLines={1}>
                            👤 {club.contact_person}{club.year_range ? ` · ${club.year_range}` : ''}
                          </Text>
                        ) : club.year_range ? (
                          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Jahrgang: {club.year_range}</Text>
                        ) : null}
                      </View>
                      {(() => {
                        const positions = (club.position_needed || '').split(',').map(p => p.trim()).filter(Boolean);
                        if (positions.length === 0) return null;
                        return (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: 120 }}>
                            {positions.map((pos, idx) => (
                              <View key={idx} style={{ backgroundColor: 'rgba(59,130,246,0.18)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)' }}>
                                <Text style={{ fontSize: 9, fontWeight: '600', color: '#60a5fa', letterSpacing: 0.3 }}>{POSITION_SHORT[pos] || pos}</Text>
                              </View>
                            ))}
                          </View>
                        );
                      })()}
                    </View>

                    {/* Trennstrich + Notiz mit Sprechblase darunter */}
                    {club.notes ? (
                      <>
                        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 10, marginBottom: 8 }} />
                        <Text style={{ fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }} numberOfLines={1}>
                          💬 "{club.notes}"
                        </Text>
                      </>
                    ) : null}
                  </TouchableOpacity>
                ))
              )
            )}
          </ScrollView>

          {/* Floating Add Button for Vereine */}
          {activeTab === 'vereine' && (
            <TouchableOpacity style={[styles.fab, { backgroundColor: '#1a1a1a' }]} onPress={() => setShowAddClubModal(true)}>
              <Text style={[styles.fabText, { color: '#fff' }]}>+</Text>
            </TouchableOpacity>
          )}

          {/* Mobile Filter Modal — Skill-Pattern */}
          <Modal visible={showMobileFilters} transparent animationType="slide">
            <View style={{ flex: 1, marginTop: 60, backgroundColor: '#000', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
              <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%', opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any) }]} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', zIndex: 1 }}>
                <Text style={{ fontFamily: 'Josefin Sans', fontSize: 20, lineHeight: 26, fontWeight: '300', letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Filter</Text>
                <TouchableOpacity onPress={() => setShowMobileFilters(false)} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1, zIndex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
                {[
                  { key: 'position', label: 'Position', values: selectedPositions.map(p => POSITION_SHORT[p] || p), options: POSITIONS.map(p => POSITION_SHORT[p] || p), onChange: (arr: string[]) => setSelectedPositions(arr.map(s => POSITIONS.find(p => POSITION_SHORT[p] === s) || s)), placeholder: 'Position auswählen', zi: 60 },
                  { key: 'year', label: 'Jahrgang', values: selectedYears, options: availableYears.map(String), onChange: (arr: string[]) => setSelectedYears(arr), placeholder: 'Jahrgang auswählen', zi: 50 },
                  { key: 'listing', label: 'Listung', values: selectedListings.map(l => l === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM'), options: LISTINGS.map(l => l === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM'), onChange: (arr: string[]) => setSelectedListings(arr.map(s => s === 'KMH' ? 'Karl Herzog Sportmanagement' : 'PM Sportmanagement')), placeholder: 'Listung auswählen', zi: 40 },
                  { key: 'responsibility', label: 'Zuständigkeit', values: selectedResponsibilities, options: advisors.map(a => `${a.first_name} ${a.last_name}`.trim()).filter(Boolean), onChange: (arr: string[]) => setSelectedResponsibilities(arr), placeholder: 'Berater auswählen', zi: 30 },
                ].map((cfg) => {
                  const open = openFilterDropdown === cfg.key;
                  return (
                    <View key={cfg.key} {...({ 'data-kmh-dropdown': 'true' } as any)} style={{ marginBottom: 14, maxWidth: 280, zIndex: cfg.zi, position: 'relative' }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{cfg.label}</Text>
                      <TouchableOpacity
                        style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        onPress={() => setOpenFilterDropdown(open ? null : cfg.key)}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 13, color: cfg.values.length ? '#fff' : 'rgba(255,255,255,0.3)', flex: 1 }}>{cfg.values.length === 0 ? cfg.placeholder : cfg.values.join(', ')}</Text>
                        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.5)" />
                      </TouchableOpacity>
                      {open ? (
                        <View style={{ position: 'absolute', top: '100%', left: 0, minWidth: 220, marginTop: 2, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 12 }}>
                          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                            <TouchableOpacity style={{ paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => cfg.onChange([])}>
                              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Leeren</Text>
                            </TouchableOpacity>
                            {cfg.options.map((opt) => {
                              const checked = cfg.values.includes(opt);
                              return (
                                <TouchableOpacity
                                  key={opt}
                                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                  onPress={() => cfg.onChange(checked ? cfg.values.filter(v => v !== opt) : [...cfg.values, opt])}
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
                })}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => { clearPositions(); clearYears(); clearListings(); clearResponsibilities(); }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Alle löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#22c55e', backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setShowMobileFilters(false)}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>Anwenden ({filteredPlayers.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Mobile Club Filter Modal */}
          <Modal visible={showMobileClubFilters} transparent animationType="slide">
            <View style={[styles.mobileFilterModal, { backgroundColor: colors.surface }]}>
              <View style={[styles.mobileFilterHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.mobileFilterTitle, { color: colors.text }]}>Filter</Text>
                <TouchableOpacity onPress={() => setShowMobileClubFilters(false)}>
                  <Text style={[styles.mobileFilterClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.mobileFilterContent}>
                {/* Position Filter */}
                <Text style={[styles.mobileFilterSectionTitle, { color: colors.text }]}>Position</Text>
                <View style={styles.mobileChipContainer}>
                  {POSITIONS.map(pos => {
                    const isSelected = selectedClubPositions.includes(pos);
                    return (
                      <TouchableOpacity
                        key={pos}
                        style={[styles.mobileChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setSelectedClubPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos])}
                      >
                        <Text style={[styles.mobileChipText, { color: colors.textSecondary }, isSelected && { color: colors.primaryText }]}>
                          {POSITION_SHORT[pos]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Year Filter */}
                <Text style={[styles.mobileFilterSectionTitle, { color: colors.text }]}>Jahrgang</Text>
                <View style={styles.mobileChipContainer}>
                  {availableYears.map(year => {
                    const isSelected = selectedClubYears.includes(year);
                    return (
                      <TouchableOpacity
                        key={year}
                        style={[styles.mobileChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setSelectedClubYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year])}
                      >
                        <Text style={[styles.mobileChipText, { color: colors.textSecondary }, isSelected && { color: colors.primaryText }]}>
                          {year}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={[styles.mobileFilterFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.mobileFilterClearButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setSelectedClubPositions([]);
                    setSelectedClubYears([]);
                  }}
                >
                  <Text style={[styles.mobileFilterClearText, { color: colors.textSecondary }]}>Alle löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mobileFilterApplyButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowMobileClubFilters(false)}
                >
                  <Text style={[styles.mobileFilterApplyText, { color: colors.primaryText }]}>Anwenden</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Add Club Modal — Skill-Pattern */}
          <Modal visible={showAddClubModal} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setShowAddClubModal(false); resetClubForm(); }} />
              <View style={{ height: '80%', backgroundColor: '#000', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderBottomWidth: 0, overflow: 'hidden' }}>
                <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%', opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any) }]} resizeMode="cover" />
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />

                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', position: 'relative', zIndex: 1 }}>
                  <Text style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }} numberOfLines={1}>{editingClub ? 'Verein bearbeiten' : 'Neuen Verein anlegen'}</Text>
                  <TouchableOpacity onPress={() => { setShowAddClubModal(false); resetClubForm(); }} style={{ position: 'absolute', right: 16, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, lineHeight: 22 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1, zIndex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Verein *</Text>
                    <TextInput style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, fontSize: 13, color: '#fff' }} value={formClubSearch} onChangeText={(t) => { setFormClubSearch(t); setNewClub({...newClub, club_name: t}); }} placeholder="Vereinsname" placeholderTextColor="rgba(255,255,255,0.3)" />
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Liga</Text>
                    <TextInput style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, fontSize: 13, color: '#fff' }} value={newClub.league || ''} onChangeText={(t) => setNewClub({...newClub, league: t})} placeholder="z.B. Bundesliga" placeholderTextColor="rgba(255,255,255,0.3)" />
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Position</Text>
                    <TextInput style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, fontSize: 13, color: '#fff' }} value={newClub.position_needed || ''} onChangeText={(t) => setNewClub({...newClub, position_needed: t})} placeholder="z.B. IV, ST" placeholderTextColor="rgba(255,255,255,0.3)" />
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Jahrgang</Text>
                    <TextInput style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, fontSize: 13, color: '#fff' }} value={newClub.year_range || ''} onChangeText={(t) => setNewClub({...newClub, year_range: t})} placeholder="z.B. 2005-2007" placeholderTextColor="rgba(255,255,255,0.3)" />
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Ansprechpartner</Text>
                    <TextInput style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, fontSize: 13, color: '#fff' }} value={newClub.contact_person || ''} onChangeText={(t) => setNewClub({...newClub, contact_person: t})} placeholder="Name" placeholderTextColor="rgba(255,255,255,0.3)" />
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Notizen</Text>
                    <TextInput style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: '#fff', minHeight: 60, textAlignVertical: 'top' }} value={newClub.notes || ''} onChangeText={(t) => setNewClub({...newClub, notes: t})} placeholder="Weitere Infos..." placeholderTextColor="rgba(255,255,255,0.3)" multiline />
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Angebote / Dokumente</Text>
                    <TouchableOpacity
                      style={{ height: 28, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', opacity: uploadingOffer ? 0.5 : 1 }}
                      onPress={uploadOfferDocument}
                      disabled={uploadingOffer}
                    >
                      <Ionicons name="cloud-upload-outline" size={12} color="rgba(255,255,255,0.85)" />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>{uploadingOffer ? 'Lädt hoch...' : 'PDF hochladen'}</Text>
                    </TouchableOpacity>
                    {clubOfferDocuments.map((doc, index) => (
                      <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <TouchableOpacity onPress={() => openOfferDocument(doc.url)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 14 }}>📄</Text>
                          <Text style={{ fontSize: 12, color: '#22c55e', textDecorationLine: 'underline' }} numberOfLines={1}>{doc.name}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteOfferDocument(doc.path)} style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', zIndex: 1 }}>
                  <TouchableOpacity style={{ height: 28, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#22c55e', backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }} onPress={saveSearchingClub}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>Speichern</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Club Detail Modal — Skill-Pattern */}
          <Modal visible={showClubDetailModal} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setShowClubDetailModal(false); setSelectedClub(null); }} />
              <View style={{ height: '80%', backgroundColor: '#000', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderBottomWidth: 0, overflow: 'hidden' }}>
                <Image source={require('../../../assets/scouting-header-bg.jpg')} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%', opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any) }]} resizeMode="cover" />
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />

                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', zIndex: 1, gap: 8 }}>
                  {selectedClub && clubLogos[selectedClub.club_name] ? (
                    <Image source={{ uri: clubLogos[selectedClub.club_name] }} style={{ width: 32, height: 32 }} resizeMode="contain" />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '600', color: '#fff' }} numberOfLines={1}>{selectedClub?.club_name}</Text>
                    {selectedClub?.league ? (
                      <Text style={{ fontFamily: 'Josefin Sans', fontSize: 12, fontWeight: '300', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: 4 }} numberOfLines={1}>{selectedClub.league}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity style={{ height: 28, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }} onPress={() => selectedClub && openEditClubModal(selectedClub)}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Bearbeiten</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowClubDetailModal(false); setSelectedClub(null); }} style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, lineHeight: 22 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1, zIndex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
                  {selectedClub && (
                    <>
                      <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Position</Text>
                          {(() => {
                            const positions = (selectedClub.position_needed || '').split(',').map(p => p.trim()).filter(Boolean);
                            if (positions.length === 0) return <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff' }}>-</Text>;
                            return (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {positions.map((pos, idx) => (
                                  <View key={idx} style={{ backgroundColor: 'rgba(59,130,246,0.18)', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)' }}>
                                    <Text style={{ fontSize: 9, fontWeight: '600', color: '#60a5fa', letterSpacing: 0.3 }}>{POSITION_SHORT[pos] || pos}</Text>
                                  </View>
                                ))}
                              </View>
                            );
                          })()}
                        </View>
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Jahrgang</Text>
                          <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff' }}>{selectedClub.year_range || '-'}</Text>
                        </View>
                        <View>
                          <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Ansprechpartner</Text>
                          <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff' }}>{selectedClub.contact_person || '-'}</Text>
                        </View>
                      </View>

                      {selectedClub.notes ? (
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Notizen</Text>
                          <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff', lineHeight: 18 }}>{selectedClub.notes}</Text>
                        </View>
                      ) : null}

                      {(selectedClub.offer_documents || []).length > 0 ? (
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Angebote</Text>
                          {(selectedClub.offer_documents || []).map((doc, index) => (
                            <TouchableOpacity key={index} onPress={() => openOfferDocument(doc.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
                              <Text style={{ fontSize: 14 }}>📄</Text>
                              <Text style={{ fontSize: 13, color: '#22c55e', textDecorationLine: 'underline' }}>{doc.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    );
  }

  // Desktop View
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Sidebar */}
      <AdvisorBackground />
      <Sidebar navigation={navigation} activeScreen="transfers" profile={profile} />

      {/* Main Content */}
      <View style={[styles.mainContent, { backgroundColor: 'transparent' }]}>
        {/* Header Banner */}
        {/* Header mit Filter als children im AdvisorHeroHeader (durchgehender BG) */}
        {(() => {
          const filterToolbarContent = (
            <>
          <TouchableOpacity style={{ height: 28, paddingVertical: 0, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' }} onPress={() => navigation.navigate('AdvisorDashboard')}><Ionicons name="arrow-back" size={13} color={colors.textSecondary} /></TouchableOpacity>

          {activeTab === 'vereine' && (<>
            <View style={[styles.searchContainer, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)', height: 28, borderRadius: 6, paddingVertical: 0, flex: 1 }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput style={[styles.searchInput, { color: colors.text, paddingVertical: 0 }]} placeholder="Verein, Liga suchen..." placeholderTextColor={colors.textMuted} value={clubSearchText} onChangeText={setClubSearchText} />
            </View>
            <View style={styles.filterContainer}>
              <View style={[styles.dropdownContainer, { zIndex: 40 }]} {...({ dataSet: { 'filter-dropdown': 'true' } } as any)}>
                <TouchableOpacity
                  style={[styles.filterButton, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)' }, selectedClubPositions.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                  onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowClubPositionDropdown(!showClubPositionDropdown); }}
                >
                  <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedClubPositions.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>{getClubPositionFilterLabel()} ▼</Text>
                </TouchableOpacity>
                {showClubPositionDropdown && (
                  <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.filterDropdownHeader}>
                      <Text style={styles.filterDropdownTitle}>Position wählen</Text>
                      {selectedClubPositions.length > 0 && <TouchableOpacity onPress={clearClubPositions}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                    </View>
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                      {POSITIONS.map(pos => {
                        const isSelected = selectedClubPositions.includes(pos);
                        const count = searchingClubs.filter(c => c.position_needed?.includes(pos)).length;
                        return (
                          <TouchableOpacity key={pos} style={styles.filterCheckboxItem} onPress={() => toggleClubPosition(pos)}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                            <Text style={styles.filterCheckboxText}>{POSITION_SHORT[pos]}</Text>
                            <Text style={styles.filterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowClubPositionDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                  </Pressable>
                )}
              </View>
              <View style={[styles.dropdownContainer, { zIndex: 30 }]} {...({ dataSet: { 'filter-dropdown': 'true' } } as any)}>
                <TouchableOpacity
                  style={[styles.filterButton, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)' }, selectedClubYears.length > 0 && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe', borderColor: '#3b82f6' }]}
                  onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowClubYearDropdown(!showClubYearDropdown); }}
                >
                  <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedClubYears.length > 0 && { color: isDark ? '#93c5fd' : '#0369a1' }]}>{getClubYearFilterLabel()} ▼</Text>
                </TouchableOpacity>
                {showClubYearDropdown && (
                  <Pressable style={styles.filterDropdownMulti} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.filterDropdownHeader}>
                      <Text style={styles.filterDropdownTitle}>Jahrgang wählen</Text>
                      {selectedClubYears.length > 0 && <TouchableOpacity onPress={clearClubYears}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}
                    </View>
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                      {availableClubYears.map(year => {
                        const isSelected = selectedClubYears.includes(year);
                        const count = searchingClubs.filter(c => c.year_range?.includes(year)).length;
                        return (
                          <TouchableOpacity key={year} style={styles.filterCheckboxItem} onPress={() => toggleClubYear(year)}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected && <Text style={styles.checkmark}>✓</Text>}</View>
                            <Text style={styles.filterCheckboxText}>Jg. {year}</Text>
                            <Text style={styles.filterCountBadge}>{count}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowClubYearDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                  </Pressable>
                )}
              </View>
            </View>
            <TouchableOpacity style={[styles.filterButton, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)', flexDirection: 'row', gap: 4, paddingHorizontal: 8 }]} onPress={() => setShowAddClubModal(true)}>
              <Ionicons name="add" size={12} color={colors.textSecondary} />
              <Ionicons name="shield-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </>)}

          {activeTab === 'spieler' && (<>
          <View style={[styles.searchContainer, { backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.25)', height: 28, borderRadius: 6, paddingVertical: 0, flex: 1 }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput style={[styles.searchInput, { color: colors.text, paddingVertical: 0 }]} placeholder="Spieler, Verein suchen..." placeholderTextColor={colors.textMuted} value={searchText} onChangeText={setSearchText} onFocus={closeAllDropdowns} />
          </View>
          
          <View style={styles.filterContainer}>
            {/* Position Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 40 }]}>
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
                      const count = transferPlayers.filter(p => p.position?.includes(pos)).length;
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
            <View style={[styles.dropdownContainer, { zIndex: 30 }]}>
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
                      const count = transferPlayers.filter(p => getYearFromDate(p.birth_date) === year).length;
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
            <View style={[styles.dropdownContainer, { zIndex: 20 }]}>
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
                      const count = transferPlayers.filter(p => p.listing === listing).length;
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
            <View style={[styles.dropdownContainer, { zIndex: 10 }]}>
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
                      const isSelected = selectedResponsibilities.includes(name);
                      const count = transferPlayers.filter(p => p.responsibility?.includes(name)).length;
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
          </View>
          </>)}

          {/* Segmented Control: Spieler / Vereine — ganz rechts in der Toolbar */}
          <View style={{ height: 28, flexDirection: 'row', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            {([
              { key: 'spieler' as ActiveTab, icon: 'person' as const, count: transferPlayers.length },
              { key: 'vereine' as ActiveTab, icon: 'shield' as const, count: searchingClubs.length },
            ]).map((tab, idx) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={{
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: active ? 'rgba(59, 130, 246, 0.25)' : 'rgba(0,0,0,0.7)',
                    borderLeftWidth: idx > 0 ? 1 : 0,
                    borderLeftColor: 'rgba(255,255,255,0.25)',
                  }}
                  onPress={() => { closeAllDropdowns(); setActiveTab(tab.key); }}
                >
                  <Ionicons name={tab.icon} size={13} color={active ? '#93c5fd' : colors.textSecondary} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#93c5fd' : colors.textSecondary }}>{tab.count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
            </>
          );
          return (
            <Pressable onPress={closeAllDropdowns} style={{ zIndex: 1000, position: 'relative' }}>
              <AdvisorHeroHeader
                title="TRANSFERS"
                subtitle={activeTab === 'vereine' ? 'VEREINE AUF DER SUCHE' : 'SPIELER MIT AUSLAUFENDEM VERTRAG'}
                backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
                backgroundImageOpacity={0.45}
              >
                {filterToolbarContent}
              </AdvisorHeroHeader>
            </Pressable>
          );
        })()}

        {/* Dropdown Overlay - schließt alle Dropdowns beim Klicken */}
        {isAnyDropdownOpen && activeTab === 'spieler' && (
          <Pressable style={styles.dropdownOverlay} onPress={closeAllDropdowns} />
        )}

        {activeTab === 'spieler' ? (
          <View style={styles.content}>
            <View style={[styles.tableWrapper, { backgroundColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.15)' }]} onLayout={(e) => setPlayerTableWidth(e.nativeEvent.layout.width - 32)}>
              {playerTableWidth > 0 && (
                <TableHeader
                  columnDefs={PLAYER_COLUMNS}
                  backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
                  columnOrder={playerTable.columnOrder}
                  getColumnWidth={playerTable.getColumnWidth}
                  onResizeStart={playerTable.onResizeStart}
                  onDragStart={playerTable.onDragStart}
                  resizingKey={playerTable.resizingKey}
                  draggingKey={playerTable.draggingKey}
                  dragOverKey={playerTable.dragOverKey}
                  onSort={(key) => handleSort(key as SortField)}
                  sortKey={sortField}
                  sortAsc={sortDirection === 'asc'}
                  colors={colors}
                  setHeaderRef={playerTable.setHeaderRef}
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16 }}
                />
              )}

              <ScrollView style={styles.tableBody}>
                {loading ? <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Laden...</Text> : filteredPlayers.length === 0 ? <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Spieler mit auslaufendem Vertrag gefunden</Text> : (
                  filteredPlayers.map((player) => {
                    const hasAccess = hasAccessToPlayer(player.id);
                    const birthday = isBirthday(player.birth_date);
                    const positionDisplay = player.position
                      ? player.position.split(', ').map(p => POSITION_SHORT[p.trim()] || p).join(', ')
                      : '-';
                    const expired = isContractExpired(player.contract_end);
                    const displayClub = getDisplayClub(player);
                    const logoUrl = getClubLogo(player.club);

                    return (
                      <TableRow
                        key={player.id}
                        columnOrder={playerTable.columnOrder}
                        getColumnWidth={playerTable.getColumnWidth}
                        onPress={() => handlePlayerClick(player)}
                        style={[
                          styles.tableRow, { borderBottomColor: colors.border },
                          !hasAccess && [styles.tableRowLocked, { backgroundColor: colors.surfaceSecondary }],
                          birthday && styles.birthdayRow,
                        ]}
                        renderCell={(key) => {
                          switch (key) {
                            case 'name':
                              return (
                                <View style={[styles.nameContainer]}>
                                  <Text style={[styles.tableCell, styles.nameCell, { color: colors.text }]} numberOfLines={1}>
                                    {player.last_name}{birthday && ' 🎉'}
                                  </Text>
                                  {!hasAccess && <Text style={styles.lockIcon}>🔒</Text>}
                                </View>
                              );
                            case 'vorname':
                              return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{player.first_name || '-'}</Text>;
                            case 'birth_date':
                              return <Text style={[styles.tableCell, { color: colors.text }]}>{formatDate(player.birth_date)}</Text>;
                            case 'position':
                              return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{positionDisplay}</Text>;
                            case 'club':
                              return (
                                <View style={[styles.clubCell]}>
                                  {expired ? <Image source={ArbeitsamtIcon} style={styles.clubLogo} /> : logoUrl ? <Image source={{ uri: logoUrl }} style={styles.clubLogo} /> : null}
                                  <Text style={[styles.tableCell, { color: colors.text }, expired && styles.clubTextRed]} numberOfLines={1}>{displayClub}</Text>
                                </View>
                              );
                            case 'league':
                              return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{player.league || '-'}</Text>;
                            case 'contract_end':
                              if (expired) {
                                return <Text style={[styles.tableCell, { color: '#ef4444' }]}>Vereinslos</Text>;
                              }
                              return <Text style={[styles.tableCell, { color: '#ef4444' }]}>{formatDate(player.contract_end)}</Text>;
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
        ) : (
          renderVereineTab()
        )}
      </View>
      
      {/* Add Club Modal — KMH-Skill Style */}
      <Modal visible={showAddClubModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowFormClubDropdown(false)}>
          <Pressable style={[styles.modalContent, { overflow: 'visible', backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', padding: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.7, shadowRadius: 30, elevation: 24 }]} onPress={() => setShowFormClubDropdown(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, overflow: 'hidden' }} pointerEvents="none">
              <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any) }} resizeMode="cover" />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
            </View>
            <View style={{ padding: 24, zIndex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, position: 'relative' }}>
              <Text style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{editingClub ? 'Verein bearbeiten' : 'Neuen suchenden Verein anlegen'}</Text>
              <TouchableOpacity onPress={() => { setShowAddClubModal(false); resetClubForm(); }} style={{ position: 'absolute', right: 0, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.formField, { zIndex: 1000 }]}>
                <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Verein *</Text>
                <View style={styles.clubSelectorContainer}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                    value={formClubSearch}
                    onChangeText={handleFormClubSearchChange}
                    onFocus={() => setShowFormClubDropdown(true)}
                    placeholder="Verein suchen oder eingeben..."
                    placeholderTextColor={colors.textMuted}
                  />
                  {showFormClubDropdown && formClubSearch.length > 0 && (
                    <View style={[styles.clubDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <ScrollView style={styles.clubDropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {/* Leeren option */}
                        <TouchableOpacity style={[styles.clubDropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setFormClubSearch(''); setNewClub({...newClub, club_name: '', league: ''}); setShowFormClubDropdown(false); setClubSearchResults([]); }}>
                          <Text style={[styles.clubDropdownText, { color: colors.textMuted, fontStyle: 'italic' }]}>— Leeren</Text>
                        </TouchableOpacity>
                        {/* Local clubs */}
                        {getFilteredClubsForForm().map((club) => (
                          <TouchableOpacity key={club} style={[styles.clubDropdownItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} onPress={() => { setFormClubSearch(club); setNewClub({...newClub, club_name: club}); setShowFormClubDropdown(false); setClubSearchResults([]); }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                              {clubLogos[club] ? <Image source={{ uri: clubLogos[club] }} style={styles.clubDropdownLogo} /> : null}
                              <Text style={[styles.clubDropdownText, { color: colors.text }]}>{club}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                        {/* Transfermarkt loading */}
                        {clubSearching && (
                          <View style={[styles.clubDropdownItem, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.clubDropdownText, { color: colors.textMuted }]}>Suche auf Transfermarkt...</Text>
                          </View>
                        )}
                        {/* Transfermarkt results */}
                        {clubSearchResults.length > 0 && (
                          <>
                            <View style={[styles.clubDropdownItem, { borderBottomColor: colors.border, backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff' }]}>
                              <Text style={[styles.clubDropdownText, { color: colors.textSecondary, fontWeight: '700', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Transfermarkt-Ergebnisse</Text>
                            </View>
                            {clubSearchResults.map(club => (
                              <TouchableOpacity key={club.name} style={[styles.clubDropdownItem, { borderBottomColor: colors.border }]} onPress={() => selectRemoteClub(club)}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                  {club.logoUrl ? <Image source={{ uri: club.logoUrl }} style={styles.clubDropdownLogo} /> : null}
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.clubDropdownText, { color: colors.text }]}>{club.name}</Text>
                                    {club.liga ? <Text style={{ fontSize: 10, color: colors.textMuted }}>{club.liga}{club.country ? ` · ${club.country}` : ''}</Text> : null}
                                  </View>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </>
                        )}
                        {/* Freitext option */}
                        {formClubSearch.trim() && !getFilteredClubsForForm().includes(formClubSearch) && !clubSearching && (
                          <TouchableOpacity style={[styles.clubDropdownItem, styles.clubDropdownCustom, { borderBottomColor: colors.border, backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4' }]} onPress={selectFreitextClub}>
                            <Text style={styles.clubDropdownCustomText}>+ "{formClubSearch}" als Freitext übernehmen</Text>
                          </TouchableOpacity>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              <View style={[styles.formField, { zIndex: 1 }]}>
                <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Liga</Text>
                <TextInput
                  style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: '#fff' }}
                  value={newClub.league || ''}
                  onChangeText={(t) => setNewClub({...newClub, league: t})}
                  placeholder="z.B. Bundesliga, 2. Liga"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  onFocus={() => setShowFormClubDropdown(false)}
                />
              </View>

              <View style={[styles.formField, { zIndex: 80, position: 'relative' }]}>
                <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Gesuchte Position</Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  onPress={() => { setShowFormClubDropdown(false); setShowFormPositionDropdown(!showFormPositionDropdown); }}
                >
                  <Text style={{ flex: 1, color: formPositions.length > 0 ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                    {formPositions.length > 0 ? formPositions.map(p => POSITION_SHORT[p] || p).join(', ') : 'Positionen wählen…'}
                  </Text>
                  <Ionicons name={showFormPositionDropdown ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
                {showFormPositionDropdown && (
                  <Pressable style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 12, zIndex: 1000 }} onPress={(e) => e.stopPropagation()}>
                    <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
                      {POSITIONS.map(pos => {
                        const isSelected = formPositions.includes(pos);
                        return (
                          <TouchableOpacity
                            key={pos}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
                            onPress={() => toggleFormPosition(pos)}
                          >
                            <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={16} color={isSelected ? '#22c55e' : 'rgba(255,255,255,0.5)'} />
                            <Text style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: '500' }}>{POSITION_SHORT[pos]} <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>· {pos}</Text></Text>
                            {isSelected ? <Ionicons name="checkmark" size={14} color="#22c55e" /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <TouchableOpacity style={{ padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', backgroundColor: '#000' }} onPress={() => setShowFormPositionDropdown(false)}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#22c55e', letterSpacing: 0.5 }}>Fertig</Text>
                    </TouchableOpacity>
                  </Pressable>
                )}
              </View>

              <View style={[styles.formField, { zIndex: 1 }]}>
                <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Alter/Jahrgang</Text>
                <TextInput
                  style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: '#fff' }}
                  value={newClub.year_range || ''}
                  onChangeText={(t) => setNewClub({...newClub, year_range: t})}
                  placeholder="z.B. 2005-2007"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  onFocus={() => setShowFormClubDropdown(false)}
                />
              </View>

              <View style={[styles.formField, { zIndex: 60, position: 'relative' }]}>
                <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Ansprechpartner</Text>
                <TextInput
                  style={{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: '#fff' }}
                  value={newClub.contact_person || ''}
                  onChangeText={(t) => { setNewClub({...newClub, contact_person: t}); setShowFormAdvisorSuggestions(true); }}
                  placeholder="z.B. Max Müller · Sportdirektor"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  onFocus={() => { setShowFormClubDropdown(false); setShowFormPositionDropdown(false); if (formClubContacts.length > 0) setShowFormAdvisorSuggestions(true); }}
                />
                {showFormAdvisorSuggestions && formClubContacts.length > 0 ? (() => {
                  const q = (newClub.contact_person || '').toLowerCase().trim();
                  const matches = q
                    ? formClubContacts.filter(c =>
                        `${c.vorname} ${c.nachname}`.toLowerCase().includes(q) ||
                        (c.position || '').toLowerCase().includes(q) ||
                        (c.mannschaft || '').toLowerCase().includes(q)
                      )
                    : formClubContacts;
                  if (matches.length === 0) return null;
                  return (
                    <Pressable style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 12, zIndex: 1000 }} onPress={(e) => e.stopPropagation()}>
                      <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {matches.map(c => {
                          const fullName = [c.vorname, c.nachname].filter(Boolean).join(' ').trim();
                          const display = c.position ? `${fullName} · ${c.position}` : fullName;
                          return (
                            <TouchableOpacity
                              key={c.id}
                              style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
                              onPress={() => { setNewClub({...newClub, contact_person: display}); setShowFormAdvisorSuggestions(false); }}
                            >
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{display}</Text>
                              {c.mannschaft || c.bereich ? (
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }} numberOfLines={1}>{[c.mannschaft, c.bereich].filter(Boolean).join(' · ')}</Text>
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </Pressable>
                  );
                })() : null}
              </View>

              <View style={[styles.formField, { zIndex: 1 }]}>
                <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Notizen</Text>
                <TextInput
                  style={{ minHeight: 80, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, color: '#fff', textAlignVertical: 'top' }}
                  value={newClub.notes || ''}
                  onChangeText={(t) => setNewClub({...newClub, notes: t})}
                  placeholder="Weitere Informationen..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  onFocus={() => setShowFormClubDropdown(false)}
                />
              </View>

              <View style={[styles.formField, { zIndex: 1 }]}>
                <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Angebote / Dokumente</Text>
                <TouchableOpacity
                  style={[styles.uploadOfferButton, { backgroundColor: colors.primary }, uploadingOffer && { opacity: 0.5 }]}
                  onPress={uploadOfferDocument}
                  disabled={uploadingOffer}
                >
                  <Ionicons name="cloud-upload-outline" size={16} color={colors.primaryText || '#fff'} />
                  <Text style={[styles.uploadOfferButtonText, { color: colors.primaryText || '#fff' }]}>{uploadingOffer ? 'Lädt hoch...' : 'PDF hochladen'}</Text>
                </TouchableOpacity>
                {clubOfferDocuments.map((doc, index) => (
                  <View key={index} style={[styles.offerDocItem, { backgroundColor: colors.surfaceSecondary }]}>
                    <TouchableOpacity onPress={() => openOfferDocument(doc.url)} style={styles.offerDocLink}>
                      <Text style={styles.offerDocIcon}>📄</Text>
                      <Text style={[styles.offerDocName, { color: colors.text }]} numberOfLines={1}>{doc.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteOfferDocument(doc.path)} style={styles.offerDocDelete}>
                      <Text style={styles.offerDocDeleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' }}>
              {editingClub && (
                <TouchableOpacity style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 }} onPress={deleteSearchingClub}>
                  <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Löschen</Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={{ backgroundColor: '#22c55e', borderWidth: 1, borderColor: '#22c55e', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 6 }} onPress={saveSearchingClub}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Speichern</Text>
              </TouchableOpacity>
            </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Club Detail Modal */}
      <Modal visible={showClubDetailModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalContent, { overflow: 'visible', backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', padding: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.7, shadowRadius: 30, elevation: 24 }]}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, overflow: 'hidden' }} pointerEvents="none">
              <Image source={require('../../../assets/scouting-header-bg.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.85, ...({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any) }} resizeMode="cover" />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
            </View>
            <View style={{ padding: 24, zIndex: 1 }}>
              {/* Header mit Name, Liga und Logo */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontFamily: 'Josefin Sans', fontSize: 22, fontWeight: '300', letterSpacing: 2, textTransform: 'uppercase', color: '#fff' }}>{selectedClub?.club_name}</Text>
                    {selectedClub?.club_name && getClubLogo(selectedClub.club_name) && (
                      <Image source={{ uri: getClubLogo(selectedClub.club_name)! }} style={{ width: 36, height: 36 }} resizeMode="contain" />
                    )}
                  </View>
                  {selectedClub?.league && <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{selectedClub.league}</Text>}
                </View>
                <TouchableOpacity onPress={() => { setShowClubDetailModal(false); setSelectedClub(null); }} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedClub && (
                <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
                  {/* Card mit Stamm-Daten */}
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Gesuchte Position</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {selectedClub.position_needed ? selectedClub.position_needed.split(', ').map((p, idx) => (
                          <View key={idx} style={{ backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '600' }}>{POSITION_SHORT[p.trim()] || p}</Text>
                          </View>
                        )) : <Text style={{ fontSize: 13, color: '#fff' }}>-</Text>}
                      </View>
                    </View>

                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Alter/Jahrgang</Text>
                      <Text style={{ fontSize: 13, color: '#fff', fontWeight: '500' }}>{selectedClub.year_range || '-'}</Text>
                    </View>

                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Ansprechpartner</Text>
                      <Text style={{ fontSize: 13, color: '#fff', fontWeight: '500' }}>{selectedClub.contact_person || '-'}</Text>
                    </View>

                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Aktualität</Text>
                      <Text style={{ fontSize: 13, color: '#fff', fontWeight: '500' }}>{formatDate(selectedClub.created_at)}</Text>
                    </View>
                  </View>

                  {/* Notizen */}
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Notizen</Text>
                    <Text style={{ fontSize: 13, color: '#fff', lineHeight: 18 }}>{selectedClub.notes || '-'}</Text>
                  </View>

                  {/* Angebote / Dokumente */}
                  {(selectedClub.offer_documents || []).length > 0 && (
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Angebote / Dokumente</Text>
                      {(selectedClub.offer_documents || []).map((doc, index) => (
                        <TouchableOpacity key={index} onPress={() => openOfferDocument(doc.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                          <Text style={{ fontSize: 14 }}>📄</Text>
                          <Text style={{ color: '#22c55e', fontSize: 13, textDecorationLine: 'underline' }}>{doc.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                    <TouchableOpacity style={{ backgroundColor: '#22c55e', borderWidth: 1, borderColor: '#22c55e', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 6 }} onPress={() => openEditClubModal(selectedClub)}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Bearbeiten</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
  
  function renderVereineTab() {
    return (
      <Pressable style={{ flex: 1 }} onPress={closeAllDropdowns}>
        {/* Vereine Tabelle (Toolbar ist im Hero-Header integriert) */}
        <View style={styles.content}>
          <View style={[styles.tableWrapper, { backgroundColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.15)' }]} onLayout={(e) => setClubTableWidth(e.nativeEvent.layout.width - 32)}>
            {clubTableWidth > 0 && (
              <TableHeader
                columnDefs={CLUB_COLUMNS}
                backgroundImage={require('../../../assets/scouting-header-bg.jpg')}
                columnOrder={clubTable.columnOrder}
                getColumnWidth={clubTable.getColumnWidth}
                onResizeStart={clubTable.onResizeStart}
                onDragStart={clubTable.onDragStart}
                resizingKey={clubTable.resizingKey}
                draggingKey={clubTable.draggingKey}
                dragOverKey={clubTable.dragOverKey}
                colors={colors}
                setHeaderRef={clubTable.setHeaderRef}
                style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16 }}
              />
            )}

            <ScrollView style={styles.tableBody}>
              {filteredSearchingClubs.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine suchenden Vereine gefunden</Text>
              ) : (
                filteredSearchingClubs.map((club) => (
                  <TableRow
                    key={club.id}
                    columnOrder={clubTable.columnOrder}
                    getColumnWidth={clubTable.getColumnWidth}
                    onPress={() => handleClubClick(club)}
                    style={[styles.tableRow, { borderBottomColor: colors.border }]}
                    renderCell={(key) => {
                      switch (key) {
                        case 'date':
                          return <Text style={[styles.tableCell, { color: colors.text }]}>{formatDate(club.created_at)}</Text>;
                        case 'club_name':
                          return (
                            <View style={[styles.clubCell]}>
                              {clubLogos[club.club_name] && <Image source={{ uri: clubLogos[club.club_name] }} style={styles.clubLogo} />}
                              <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{club.club_name}</Text>
                            </View>
                          );
                        case 'league':
                          return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{club.league || '-'}</Text>;
                        case 'position_needed':
                          return (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                              {club.position_needed ? club.position_needed.split(', ').map((p, idx) => (
                                <View key={idx} style={{ backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#60a5fa' }}>{POSITION_SHORT[p.trim()] || p}</Text>
                                </View>
                              )) : <Text style={[styles.tableCell, { color: colors.text }]}>-</Text>}
                            </View>
                          );
                        case 'year_range':
                          return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{club.year_range || '-'}</Text>;
                        case 'contact_person':
                          return <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>{club.contact_person || '-'}</Text>;
                        default:
                          return null;
                      }
                    }}
                  />
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)' },
  containerMobile: { flexDirection: 'column' },
  mainContent: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  
  // Header Banner
  headerBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1 },
  headerBannerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 11, color: '#64748b', marginTop: 4 },
  
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
  
  // Filter Dropdown - wie Scouting
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
  content: { flex: 1, padding: 24 },

  // Table Wrapper with rounded borders
  tableWrapper: { flex: 1, borderRadius: 12, borderWidth: 1, overflow: 'hidden', zIndex: 1, position: 'relative' },

  // Table Container - scrollbar
  tableContainer: { flex: 1 },

  // Tabelle
  tableHeader: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  tableHeaderText: { color: '#64748b', fontWeight: '600', fontSize: 11 },
  tableBody: { flex: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableRowLocked: { backgroundColor: '#fafafa' },
  birthdayRow: { backgroundColor: 'rgba(255, 215, 0, 0.2)' },
  tableCell: { fontSize: 11, color: '#334155' },
  nameContainer: { flexDirection: 'row', alignItems: 'center' },
  nameCell: { fontWeight: '500', flex: 1 },
  lockIcon: { fontSize: 12, marginLeft: 4 },
  clubCell: { flexDirection: 'row', alignItems: 'center' },
  clubTextRed: { color: '#dc3545' },
  clubLogo: { width: 22, height: 22, resizeMode: 'contain', marginRight: 8 },
  birthDateCell: { flexDirection: 'row', alignItems: 'center' },
  birthdayIcon: { fontSize: 14, marginLeft: 6 },
  
  // Spalten
  colName: { flex: 1.5, minWidth: 100 },
  colBirthDate: { flex: 1, minWidth: 85 },
  colPosition: { flex: 0.9, minWidth: 70 },
  colClub: { flex: 2.2, minWidth: 150 },
  colLeague: { flex: 1.8, minWidth: 120 },
  colContract: { flex: 1.2, minWidth: 100 },
  colListing: { flex: 0.7, minWidth: 50 },
  colResponsibility: { flex: 1, minWidth: 85 },
  
  // Contract Badges
  contractBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  contractBadgeText: { color: '#dc2626', fontSize: 11, fontWeight: '600' },
  contractBadgeExpired: { backgroundColor: 'rgba(239,68,68,0.15)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  contractBadgeTextExpired: { color: '#dc2626', fontSize: 11, fontWeight: '600' },

  // Listing Badges
  listingBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  listingKMH: { backgroundColor: '#1e293b' },
  listingPM: { backgroundColor: '#0ea5e9' },
  listingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  
  loadingText: { padding: 20, textAlign: 'center', color: '#64748b' },
  emptyText: { padding: 20, textAlign: 'center', color: '#64748b' },
  
  // Header Tabs
  headerTabs: { flexDirection: 'row', gap: 8 },
  
  // Add Button
  addButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  addButtonText: { fontSize: 11, fontWeight: '600' },
  
  // Vereine Tab Spalten
  colDate: { flex: 0.8, minWidth: 80 },
  colClubName: { flex: 1.5, minWidth: 150 },
  colLeagueName: { flex: 1.2, minWidth: 100 },
  colPositionNeeded: { flex: 1.2, minWidth: 120 },
  colYearRange: { flex: 1, minWidth: 100 },
  colContactPerson: { flex: 1.2, minWidth: 100 },
  
  // Position Badge (Liste)
  positionBadge: { backgroundColor: 'rgba(59,130,246,0.2)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  positionBadgeText: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
  
  // Modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { borderRadius: 12, padding: 20, width: '90%', maxWidth: 500, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  closeButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { fontSize: 16, color: '#64748b' },
  formField: { marginBottom: 12 },
  formLabel: { fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: '500' },
  formInput: { borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 11 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalButtonsRight: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  modalButtonsSpaced: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  cancelButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.45)' },
  cancelButtonText: { color: '#64748b', fontWeight: '600', fontSize: 11 },
  saveButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: '#10b981' },
  saveButtonText: { color: '#10b981', fontWeight: '600', fontSize: 11 },
  deleteButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#ef4444' },
  deleteButtonText: { color: '#ef4444', fontWeight: '600', fontSize: 11 },
  
  // Position Picker (Form)
  positionPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  positionOption: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  positionOptionSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  positionOptionText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  positionOptionTextSelected: { color: '#fff' },
  
  // Detail Modal - Neues Layout wie Spieler-Detail
  detailHeaderLeft: { flex: 1 },
  detailSubtitle: { fontSize: 11, color: '#64748b', marginTop: 4 },
  detailContent: { marginTop: 8 },
  detailRow: { marginBottom: 16 },
  detailRowNotes: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  detailLabel: { fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: '500' },
  detailValue: { fontSize: 11, color: '#1a1a1a', fontWeight: '500' },
  detailPositions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailNotesText: { fontSize: 11, color: '#334155', lineHeight: 18, backgroundColor: 'rgba(0,0,0,0.45)', padding: 12, borderRadius: 8 },
  detailActions: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'flex-end' },
  editButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  editButtonText: { color: '#64748b', fontWeight: '600' },
  
  // Detail Modal - Neues Karten-Layout
  detailModalContent: { borderRadius: 16, width: '90%', maxWidth: 550, maxHeight: '85%', overflow: 'hidden' },
  detailModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingBottom: 16 },
  detailHeaderInfo: { flex: 1 },
  detailHeaderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailModalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  detailModalSubtitle: { fontSize: 11, color: '#64748b', marginTop: 4 },
  detailHeaderLogo: { width: 32, height: 32, resizeMode: 'contain' },
  detailModalBody: { paddingHorizontal: 20, paddingBottom: 20 },
  
  // Karten-Layout - volle Breite
  detailCardsRow: { marginBottom: 16 },
  detailCard: { backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', padding: 20 },
  detailCardField: { marginBottom: 16 },
  detailCardFieldLast: { marginBottom: 0 },
  detailCardLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  detailCardValue: { fontSize: 11, color: '#1a1a1a', fontWeight: '600' },
  
  // Position Badge im Detail Modal - hellblau ohne Rahmen wie in Liste
  positionBadgeDetail: { backgroundColor: 'rgba(59,130,246,0.2)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  positionBadgeDetailText: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
  
  // Notizen Card - hellblau wie die anderen Karten
  detailNotesCard: { marginBottom: 20 },
  detailNotesBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#bfdbfe', marginTop: 6 },
  detailNotesBoxText: { fontSize: 11, color: '#1a1a1a', lineHeight: 18 },
  
  // Action Buttons im Detail Modal - nur Bearbeiten rechts
  detailModalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  detailDeleteButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' },
  detailDeleteButtonText: { color: '#ef4444', fontWeight: '600', fontSize: 11 },
  detailEditButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3b82f6' },
  detailEditButtonText: { color: '#3b82f6', fontWeight: '600', fontSize: 11 },
  
  // Club Selector in Form
  clubSelectorContainer: { position: 'relative', zIndex: 100 },
  clubDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, borderRadius: 6, borderWidth: 1, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, zIndex: 9999, elevation: 9999 },
  clubDropdownScroll: { maxHeight: 250 },
  clubDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1 },
  clubDropdownLogo: { width: 20, height: 20, resizeMode: 'contain', marginRight: 8 },
  clubDropdownText: { fontSize: 11, color: '#333' },
  clubDropdownCustom: { backgroundColor: 'rgba(34,197,94,0.15)' },
  clubDropdownCustomText: { fontSize: 11, color: '#16a34a', fontWeight: '500' },

  // ==================== MOBILE STYLES ====================
  containerMobile: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)' },
  mainContentMobile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },

  // Mobile Tabs
  mobileTabs: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.55)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12 },
  mobileTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  mobileTabActive: { borderBottomWidth: 2, borderBottomColor: '#1a1a1a' },
  mobileTabText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  mobileTabTextActive: { color: '#1a1a1a', fontWeight: '600' },

  // Mobile Toolbar
  mobileToolbar: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)' },
  mobileSearchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, paddingHorizontal: 10, height: 40 },
  mobileSearchInput: { flex: 1, fontSize: 11, color: '#1a1a1a', marginLeft: 8 },
  mobileFilterButton: { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  mobileFilterButtonActive: { backgroundColor: '#1a1a1a' },
  mobileAddButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  mobileAddButtonText: { color: '#fff', fontSize: 24, fontWeight: '300' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { fontSize: 24, fontWeight: '300', lineHeight: 26 },
  filterCountBubble: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  filterCountText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Mobile Subheader
  mobileSubheader: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.45)' },
  mobileSubheaderText: { fontSize: 11, color: '#64748b' },

  // Mobile Card List
  mobileCardList: { flex: 1 },
  mobileCardListContent: { paddingHorizontal: 12, paddingVertical: 8 },

  // Mobile Player Card
  mobileCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', ...(Platform.OS === 'web' ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as any : {}) },
  mobileCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  mobileCardNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  mobileCardClubLogo: { width: 32, height: 32, resizeMode: 'contain', marginRight: 10 },
  mobileCardNameContainer: { flex: 1 },
  mobileCardName: { fontSize: 11, fontWeight: '600', color: '#1a1a1a' },
  mobileCardClub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  mobileCardLock: { fontSize: 14, marginLeft: 8 },
  mobileListingBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4 },
  mobileListingText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  mobileCardDetails: { gap: 6 },
  mobileCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mobileCardLabel: { fontSize: 11, color: '#64748b' },
  mobileCardValue: { fontSize: 11, color: '#1a1a1a', fontWeight: '500' },
  mobileCardPositions: { flexDirection: 'row', gap: 4 },
  mobilePositionBadge: { backgroundColor: 'rgba(59,130,246,0.2)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  mobilePositionText: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
  mobileContractBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  mobileContractText: { fontSize: 11, fontWeight: '600', color: '#dc2626' },

  // Mobile Filter Modal
  mobileFilterModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', marginTop: 50, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10 },
  mobileFilterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)' },
  mobileFilterTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  mobileFilterClose: { fontSize: 24, color: '#64748b' },
  mobileFilterContent: { flex: 1, padding: 16 },
  mobileFilterSectionTitle: { fontSize: 11, fontWeight: '600', color: '#1a1a1a', marginBottom: 10, marginTop: 16 },
  mobileChipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mobileChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  mobileChipSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  mobileChipText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  mobileChipTextSelected: { color: '#fff' },
  mobileFilterFooter: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  mobileFilterClearButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center' },
  mobileFilterClearText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  mobileFilterApplyButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#1a1a1a', alignItems: 'center' },
  mobileFilterApplyText: { fontSize: 11, color: '#fff', fontWeight: '600' },

  // Sidebar Overlay
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, flexDirection: 'row' },
  sidebarMobile: { width: 280, height: '100%', backgroundColor: 'rgba(0,0,0,0.55)' },

  // Player Card (identisch zu PlayerOverviewScreen)
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
    marginRight: 8,
  },
  playerCardClubText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
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

  // Offer Document Styles
  uploadOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  uploadOfferButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  offerDocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  offerDocLink: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  offerDocIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  offerDocName: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  offerDocDelete: {
    padding: 4,
    marginLeft: 8,
  },
  offerDocDeleteText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  offerDocDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  offerDocDetailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  offerDocDetailName: {
    fontSize: 11,
    color: '#2563eb',
    marginLeft: 6,
  },
});
