import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Pressable, Modal } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';

const POSITIONS = ['Torwart', 'Innenverteidiger', 'Linker Verteidiger', 'Rechter Verteidiger', 'Defensives Mittelfeld', 'Offensives Mittelfeld', 'Linke Außenbahn', 'Rechte Außenbahn', 'Stürmer'];
const POSITION_SHORT: Record<string, string> = {
  'Torwart': 'TW',
  'Innenverteidiger': 'IV',
  'Linker Verteidiger': 'LV',
  'Rechter Verteidiger': 'RV',
  'Defensives Mittelfeld': 'DM',
  'Offensives Mittelfeld': 'OM',
  'Linke Außenbahn': 'LA',
  'Rechte Außenbahn': 'RA',
  'Stürmer': 'ST',
};
const LISTINGS = ['Karl Herzog Sportmanagement', 'PM Sportmanagement'];

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

interface SearchingClub {
  id: string;
  club_name: string;
  league: string;
  position_needed: string;
  year_range: string;
  contact_person: string;
  notes: string;
  created_at: string;
}

export function TransfersScreen({ navigation }: any) {
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
  const [showClubPositionDropdown, setShowClubPositionDropdown] = useState(false);
  const [showClubYearDropdown, setShowClubYearDropdown] = useState(false);
  
  // Club Detail Modal
  const [selectedClub, setSelectedClub] = useState<SearchingClub | null>(null);
  const [showClubDetailModal, setShowClubDetailModal] = useState(false);
  
  // Form Position Picker (für neuen Verein)
  const [formPositions, setFormPositions] = useState<string[]>([]);
  
  // Club Form Dropdown
  const [formClubSearch, setFormClubSearch] = useState('');
  const [showFormClubDropdown, setShowFormClubDropdown] = useState(false);
  
  // Editing State
  const [editingClub, setEditingClub] = useState<SearchingClub | null>(null);
  
  // Liste aller Vereine für Dropdown
  const [allClubNames, setAllClubNames] = useState<string[]>([]);

  const [searchText, setSearchText] = useState('');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  
  // Separate Dropdown States wie in Scouting
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [showListingDropdown, setShowListingDropdown] = useState(false);
  const [showResponsibilityDropdown, setShowResponsibilityDropdown] = useState(false);

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

  useEffect(() => {
    fetchCurrentUser();
    fetchPlayers();
    fetchClubLogos();
    fetchAdvisors();
    fetchSearchingClubs();
  }, []);

  useEffect(() => { 
    filterTransferPlayers(); 
  }, [allPlayers]);

  useEffect(() => { 
    applyFilters(); 
  }, [searchText, transferPlayers, selectedYears, selectedPositions, selectedListings, selectedResponsibilities, sortField, sortDirection]);
  
  useEffect(() => {
    applyClubFilters();
  }, [clubSearchText, searchingClubs, selectedClubPositions, selectedClubYears]);

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
  
  const getFilteredClubsForForm = () => {
    if (!formClubSearch.trim()) return allClubNames.slice(0, 10);
    return allClubNames.filter(name => name.toLowerCase().includes(formClubSearch.toLowerCase())).slice(0, 10);
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
    const { data } = await supabase.from('advisors').select('id, first_name, last_name').order('last_name');
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
    
    const { data } = await supabase
      .from('player_access')
      .select('player_id')
      .eq('advisor_id', uid)
      .in('access_type', ['owner', 'viewer']);
    
    if (data) setMyPlayerIds(data.map(d => d.player_id));
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

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  const renderListingBadge = (listing: string | null) => {
    if (!listing) return <Text style={styles.tableCell}>-</Text>;
    const isKMH = listing === 'Karl Herzog Sportmanagement';
    return <View style={[styles.listingBadge, isKMH ? styles.listingKMH : styles.listingPM]}><Text style={styles.listingBadgeText}>{isKMH ? 'KMH' : 'PM'}</Text></View>;
  };

  const renderSortableHeader = (label: string, field: SortField, style: any) => (
    <TouchableOpacity onPress={() => handleSort(field)} style={style}>
      <Text style={styles.tableHeaderText}>{label} {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</Text>
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
        <Text style={[styles.tableCell, expired && styles.clubTextRed]} numberOfLines={1}>{displayClub}</Text>
      </View>
    );
  };

  const renderBirthDateCell = (player: Player) => {
    const birthday = isBirthday(player.birth_date);
    return (
      <View style={[styles.colBirthDate, styles.birthDateCell]}>
        <Text style={styles.tableCell}>{formatDate(player.birth_date)}</Text>
        {birthday && <Text style={styles.birthdayIcon}>🎉</Text>}
      </View>
    );
  };

  const renderContractCell = (player: Player) => {
    const expired = isContractExpired(player.contract_end);
    
    if (expired) {
      return (
        <View style={styles.colContract}>
          <View style={styles.contractBadgeExpired}>
            <Text style={styles.contractBadgeTextExpired}>Vereinslos</Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.colContract}>
        <View style={styles.contractBadge}>
          <Text style={styles.contractBadgeText}>{formatDate(player.contract_end)}</Text>
        </View>
      </View>
    );
  };

  const renderPlayerRow = (player: Player) => {
    const hasAccess = hasAccessToPlayer(player.id);
    // Position in Kürzel umwandeln
    const positionDisplay = player.position 
      ? player.position.split(', ').map(p => POSITION_SHORT[p.trim()] || p).join(', ')
      : '-';
    return (
      <TouchableOpacity 
        key={player.id} 
        style={[styles.tableRow, !hasAccess && styles.tableRowLocked]} 
        onPress={() => handlePlayerClick(player)}
      >
        <View style={[styles.colName, styles.nameContainer]}>
          <Text style={[styles.tableCell, styles.nameCell]} numberOfLines={1}>
            {player.last_name}, {player.first_name}
          </Text>
          {!hasAccess && <Text style={styles.lockIcon}>🔒</Text>}
        </View>
        {renderBirthDateCell(player)}
        <Text style={[styles.tableCell, styles.colPosition]} numberOfLines={1}>{positionDisplay}</Text>
        {renderClubCell(player)}
        <Text style={[styles.tableCell, styles.colLeague]} numberOfLines={1}>{player.league || '-'}</Text>
        {renderContractCell(player)}
        <View style={styles.colListing}>{renderListingBadge(player.listing)}</View>
        <Text style={[styles.tableCell, styles.colResponsibility]} numberOfLines={1}>{getResponsibilityInitials(player.responsibility)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <Sidebar navigation={navigation} activeScreen="transfers" profile={profile} />

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Header Banner */}
        <Pressable style={styles.headerBanner} onPress={closeAllDropdowns}>
          <TouchableOpacity style={styles.filterButton} onPress={() => navigation.navigate('AdvisorDashboard')}>
            <Text style={styles.filterButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.headerBannerCenter}>
            <Text style={styles.headerTitle}>Transfers</Text>
            <Text style={styles.headerSubtitle}>
              Spieler mit auslaufendem Vertrag und Vereine auf der Suche
            </Text>
          </View>
          <View style={styles.headerTabs}>
            <TouchableOpacity style={[styles.filterButton, activeTab === 'spieler' && styles.filterButtonActive]} onPress={() => { closeAllDropdowns(); setActiveTab('spieler'); }}>
              <Text style={[styles.filterButtonText, activeTab === 'spieler' && styles.filterButtonTextActive]}>Spieler ({transferPlayers.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterButton, activeTab === 'vereine' && styles.filterButtonActive]} onPress={() => { closeAllDropdowns(); setActiveTab('vereine'); }}>
              <Text style={[styles.filterButtonText, activeTab === 'vereine' && styles.filterButtonTextActive]}>Vereine auf der Suche...</Text>
            </TouchableOpacity>
          </View>
        </Pressable>

        {activeTab === 'spieler' && (
        /* Toolbar wie Scouting */
        <Pressable style={styles.toolbar} onPress={closeAllDropdowns}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput style={styles.searchInput} placeholder="Spieler, Verein suchen..." placeholderTextColor="#9ca3af" value={searchText} onChangeText={setSearchText} onFocus={closeAllDropdowns} />
          </View>
          
          <View style={styles.filterContainer}>
            {/* Position Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 40 }]}>
              <TouchableOpacity 
                style={[styles.filterButton, selectedPositions.length > 0 && styles.filterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowPositionDropdown(!showPositionDropdown); }}
              >
                <Text style={[styles.filterButtonText, selectedPositions.length > 0 && styles.filterButtonTextActive]}>{getPositionFilterLabel()} ▼</Text>
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
                style={[styles.filterButton, selectedYears.length > 0 && styles.filterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowYearDropdown(!showYearDropdown); }}
              >
                <Text style={[styles.filterButtonText, selectedYears.length > 0 && styles.filterButtonTextActive]}>{getYearFilterLabel()} ▼</Text>
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
                style={[styles.filterButton, selectedListings.length > 0 && styles.filterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowListingDropdown(!showListingDropdown); }}
              >
                <Text style={[styles.filterButtonText, selectedListings.length > 0 && styles.filterButtonTextActive]}>{getListingFilterLabel()} ▼</Text>
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
                style={[styles.filterButton, selectedResponsibilities.length > 0 && styles.filterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowResponsibilityDropdown(!showResponsibilityDropdown); }}
              >
                <Text style={[styles.filterButtonText, selectedResponsibilities.length > 0 && styles.filterButtonTextActive]}>{getResponsibilityFilterLabel()} ▼</Text>
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
        </Pressable>
        )}

        {/* Dropdown Overlay - schließt alle Dropdowns beim Klicken */}
        {isAnyDropdownOpen && activeTab === 'spieler' && (
          <Pressable style={styles.dropdownOverlay} onPress={closeAllDropdowns} />
        )}

        {activeTab === 'spieler' ? (
          <ScrollView style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              {renderSortableHeader('Name', 'name', styles.colName)}
              {renderSortableHeader('Geb.-Datum', 'birth_date', styles.colBirthDate)}
              {renderSortableHeader('Position', 'position', styles.colPosition)}
              {renderSortableHeader('Verein', 'club', styles.colClub)}
              {renderSortableHeader('Liga', 'league', styles.colLeague)}
              {renderSortableHeader('Vertragsende', 'contract_end', styles.colContract)}
              {renderSortableHeader('Listung', 'listing', styles.colListing)}
              {renderSortableHeader('Zuständigkeit', 'responsibility', styles.colResponsibility)}
            </View>

            <View style={styles.tableBody}>
              {loading ? <Text style={styles.loadingText}>Laden...</Text> : filteredPlayers.length === 0 ? <Text style={styles.emptyText}>Keine Spieler mit auslaufendem Vertrag gefunden</Text> : (
                filteredPlayers.map((player) => renderPlayerRow(player))
              )}
            </View>
          </ScrollView>
        ) : (
          renderVereineTab()
        )}
      </View>
      
      {/* Add Club Modal */}
      <Modal visible={showAddClubModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowFormClubDropdown(false)}>
          <Pressable style={styles.modalContent} onPress={() => setShowFormClubDropdown(false)}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingClub ? 'Verein bearbeiten' : 'Neuen suchenden Verein anlegen'}</Text>
              <TouchableOpacity onPress={() => { setShowAddClubModal(false); resetClubForm(); }} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.formField, { zIndex: 1000 }]}>
                <Text style={styles.formLabel}>Verein *</Text>
                <View style={styles.clubSelectorContainer}>
                  <TextInput 
                    style={styles.formInput} 
                    value={formClubSearch} 
                    onChangeText={(t) => { setFormClubSearch(t); setShowFormClubDropdown(true); }}
                    onFocus={() => setShowFormClubDropdown(true)}
                    placeholder="Verein suchen oder eingeben..."
                    placeholderTextColor="#9ca3af"
                  />
                  {showFormClubDropdown && formClubSearch.length > 0 && (
                    <View style={styles.clubDropdown}>
                      <ScrollView style={styles.clubDropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {getFilteredClubsForForm().map((club) => (
                          <TouchableOpacity key={club} style={styles.clubDropdownItem} onPress={() => { setFormClubSearch(club); setNewClub({...newClub, club_name: club}); setShowFormClubDropdown(false); }}>
                            {clubLogos[club] && <Image source={{ uri: clubLogos[club] }} style={styles.clubDropdownLogo} />}
                            <Text style={styles.clubDropdownText}>{club}</Text>
                          </TouchableOpacity>
                        ))}
                        {!getFilteredClubsForForm().includes(formClubSearch) && formClubSearch.trim() !== '' && (
                          <TouchableOpacity style={[styles.clubDropdownItem, styles.clubDropdownCustom]} onPress={() => { setNewClub({...newClub, club_name: formClubSearch}); setShowFormClubDropdown(false); }}>
                            <Text style={styles.clubDropdownCustomText}>"{formClubSearch}" verwenden</Text>
                          </TouchableOpacity>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
              
              <View style={[styles.formField, { zIndex: 1 }]}>
                <Text style={styles.formLabel}>Liga</Text>
                <TextInput 
                  style={styles.formInput} 
                  value={newClub.league || ''} 
                  onChangeText={(t) => setNewClub({...newClub, league: t})} 
                  placeholder="z.B. Bundesliga, 2. Liga"
                  placeholderTextColor="#9ca3af"
                  onFocus={() => setShowFormClubDropdown(false)}
                />
              </View>
              
              <View style={[styles.formField, { zIndex: 1 }]}>
                <Text style={styles.formLabel}>Gesuchte Position</Text>
                <Pressable style={styles.positionPickerRow} onPress={() => setShowFormClubDropdown(false)}>
                  {POSITIONS.map(pos => {
                    const isSelected = formPositions.includes(pos);
                    return (
                      <TouchableOpacity 
                        key={pos} 
                        style={[styles.positionOption, isSelected && styles.positionOptionSelected]} 
                        onPress={() => { setShowFormClubDropdown(false); toggleFormPosition(pos); }}
                      >
                        <Text style={[styles.positionOptionText, isSelected && styles.positionOptionTextSelected]}>{POSITION_SHORT[pos]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </Pressable>
              </View>
              
              <View style={[styles.formField, { zIndex: 1 }]}>
                <Text style={styles.formLabel}>Alter/Jahrgang</Text>
                <TextInput 
                  style={styles.formInput} 
                  value={newClub.year_range || ''} 
                  onChangeText={(t) => setNewClub({...newClub, year_range: t})} 
                  placeholder="z.B. 2005-2007"
                  placeholderTextColor="#9ca3af"
                  onFocus={() => setShowFormClubDropdown(false)}
                />
              </View>
              
              <View style={[styles.formField, { zIndex: 1 }]}>
                <Text style={styles.formLabel}>Ansprechpartner</Text>
                <TextInput 
                  style={styles.formInput} 
                  value={newClub.contact_person || ''} 
                  onChangeText={(t) => setNewClub({...newClub, contact_person: t})} 
                  placeholder="Name des Kontakts"
                  placeholderTextColor="#9ca3af"
                  onFocus={() => setShowFormClubDropdown(false)}
                />
              </View>
              
              <View style={[styles.formField, { zIndex: 1 }]}>
                <Text style={styles.formLabel}>Notizen</Text>
                <TextInput 
                  style={[styles.formInput, { minHeight: 80 }]} 
                  value={newClub.notes || ''} 
                  onChangeText={(t) => setNewClub({...newClub, notes: t})} 
                  placeholder="Weitere Informationen..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  onFocus={() => setShowFormClubDropdown(false)}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalButtonsSpaced}>
              {editingClub && (
                <TouchableOpacity style={styles.deleteButton} onPress={deleteSearchingClub}>
                  <Text style={styles.deleteButtonText}>Löschen</Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.saveButton} onPress={saveSearchingClub}>
                <Text style={styles.saveButtonText}>Speichern</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      
      {/* Club Detail Modal */}
      <Modal visible={showClubDetailModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContent}>
            {/* Header mit Name, Liga und Logo */}
            <View style={styles.detailModalHeader}>
              <View style={styles.detailHeaderInfo}>
                <View style={styles.detailHeaderNameRow}>
                  <Text style={styles.detailModalTitle}>{selectedClub?.club_name}</Text>
                  {selectedClub?.club_name && getClubLogo(selectedClub.club_name) && (
                    <Image source={{ uri: getClubLogo(selectedClub.club_name)! }} style={styles.detailHeaderLogo} />
                  )}
                </View>
                {selectedClub?.league && <Text style={styles.detailModalSubtitle}>{selectedClub.league}</Text>}
              </View>
              <TouchableOpacity onPress={() => { setShowClubDetailModal(false); setSelectedClub(null); }} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedClub && (
              <ScrollView style={styles.detailModalBody} showsVerticalScrollIndicator={false}>
                {/* Zwei-Spalten-Layout mit hellblauer Füllung */}
                <View style={styles.detailCardsRow}>
                  {/* Linke Spalte */}
                  <View style={styles.detailCard}>
                    <View style={styles.detailCardField}>
                      <Text style={styles.detailCardLabel}>Gesuchte Position</Text>
                      <View style={styles.detailPositions}>
                        {selectedClub.position_needed ? selectedClub.position_needed.split(', ').map((p, idx) => (
                          <View key={idx} style={styles.positionBadgeDetail}>
                            <Text style={styles.positionBadgeDetailText}>{POSITION_SHORT[p.trim()] || p}</Text>
                          </View>
                        )) : <Text style={styles.detailCardValue}>-</Text>}
                      </View>
                    </View>
                    
                    <View style={styles.detailCardField}>
                      <Text style={styles.detailCardLabel}>Alter/Jahrgang</Text>
                      <Text style={styles.detailCardValue}>{selectedClub.year_range || '-'}</Text>
                    </View>
                    
                    <View style={styles.detailCardField}>
                      <Text style={styles.detailCardLabel}>Ansprechpartner</Text>
                      <Text style={styles.detailCardValue}>{selectedClub.contact_person || '-'}</Text>
                    </View>
                    
                    <View style={styles.detailCardFieldLast}>
                      <Text style={styles.detailCardLabel}>Aktualität</Text>
                      <Text style={styles.detailCardValue}>{formatDate(selectedClub.created_at)}</Text>
                    </View>
                  </View>
                  
                </View>
                
                {/* Notizen Box - hellgelber Hintergrund */}
                <View style={styles.detailNotesCard}>
                  <Text style={styles.detailCardLabel}>Notizen</Text>
                  <View style={styles.detailNotesBox}>
                    <Text style={styles.detailNotesBoxText}>{selectedClub.notes || '-'}</Text>
                  </View>
                </View>
                
                {/* Action Buttons */}
                <View style={styles.detailModalActions}>
                  <TouchableOpacity style={styles.detailEditButton} onPress={() => openEditClubModal(selectedClub)}>
                    <Text style={styles.detailEditButtonText}>Bearbeiten</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
  
  function renderVereineTab() {
    return (
      <Pressable style={{ flex: 1 }} onPress={closeAllDropdowns}>
        {/* Vereine Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Verein, Liga suchen..." 
              placeholderTextColor="#9ca3af"
              value={clubSearchText} 
              onChangeText={setClubSearchText} 
            />
          </View>
          
          <View style={styles.filterContainer}>
            {/* Position Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 40 }]}>
              <TouchableOpacity 
                style={[styles.filterButton, selectedClubPositions.length > 0 && styles.filterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowClubPositionDropdown(!showClubPositionDropdown); }}
              >
                <Text style={[styles.filterButtonText, selectedClubPositions.length > 0 && styles.filterButtonTextActive]}>{getClubPositionFilterLabel()} ▼</Text>
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

            {/* Jahrgang Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 30 }]}>
              <TouchableOpacity 
                style={[styles.filterButton, selectedClubYears.length > 0 && styles.filterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowClubYearDropdown(!showClubYearDropdown); }}
              >
                <Text style={[styles.filterButtonText, selectedClubYears.length > 0 && styles.filterButtonTextActive]}>{getClubYearFilterLabel()} ▼</Text>
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
          
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddClubModal(true)}>
            <Text style={styles.addButtonText}>+ neuen Verein anlegen</Text>
          </TouchableOpacity>
        </View>
        
        {/* Vereine Tabelle */}
        <ScrollView style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDate]}>Aktualität</Text>
            <Text style={[styles.tableHeaderText, styles.colClubName]}>Verein</Text>
            <Text style={[styles.tableHeaderText, styles.colLeagueName]}>Liga</Text>
            <Text style={[styles.tableHeaderText, styles.colPositionNeeded]}>Position</Text>
            <Text style={[styles.tableHeaderText, styles.colYearRange]}>Alter/Jahrgang</Text>
            <Text style={[styles.tableHeaderText, styles.colContactPerson]}>Ansprechpartner</Text>
          </View>

          <View style={styles.tableBody}>
            {filteredSearchingClubs.length === 0 ? (
              <Text style={styles.emptyText}>Keine suchenden Vereine gefunden</Text>
            ) : (
              filteredSearchingClubs.map((club) => (
                <TouchableOpacity key={club.id} style={styles.tableRow} onPress={() => handleClubClick(club)}>
                  <Text style={[styles.tableCell, styles.colDate]}>{formatDate(club.created_at)}</Text>
                  <View style={[styles.colClubName, styles.clubCell]}>
                    {clubLogos[club.club_name] && <Image source={{ uri: clubLogos[club.club_name] }} style={styles.clubLogo} />}
                    <Text style={styles.tableCell} numberOfLines={1}>{club.club_name}</Text>
                  </View>
                  <Text style={[styles.tableCell, styles.colLeagueName]} numberOfLines={1}>{club.league || '-'}</Text>
                  <View style={[styles.colPositionNeeded, { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }]}>
                    {club.position_needed ? club.position_needed.split(', ').map((p, idx) => (
                      <View key={idx} style={styles.positionBadge}>
                        <Text style={styles.positionBadgeText}>{POSITION_SHORT[p.trim()] || p}</Text>
                      </View>
                    )) : <Text style={styles.tableCell}>-</Text>}
                  </View>
                  <Text style={[styles.tableCell, styles.colYearRange]} numberOfLines={1}>{club.year_range || '-'}</Text>
                  <Text style={[styles.tableCell, styles.colContactPerson]} numberOfLines={1}>{club.contact_person || '-'}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  mainContent: { flex: 1, backgroundColor: '#f8fafc' },
  
  // Header Banner
  headerBanner: { flexDirection: 'row', alignItems: 'center', padding: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerBannerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  
  // Toolbar - wie Scouting
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 100 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  filterContainer: { flexDirection: 'row', gap: 8 },
  dropdownContainer: { position: 'relative' },
  
  // Filter Buttons - wie Scouting
  filterButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  filterButtonActive: { backgroundColor: '#e0f2fe', borderColor: '#3b82f6' },
  filterButtonText: { fontSize: 14, color: '#64748b' },
  filterButtonTextActive: { color: '#0369a1' },
  
  // Filter Dropdown - wie Scouting
  filterDropdownMulti: { position: 'absolute', top: '100%', left: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, minWidth: 220, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, zIndex: 1000, overflow: 'hidden' },
  filterDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  filterDropdownTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  filterClearText: { fontSize: 12, color: '#ef4444' },
  filterCheckboxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  filterCheckboxText: { flex: 1, fontSize: 14, color: '#333' },
  filterCountBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 12, color: '#64748b', overflow: 'hidden' },
  filterDoneButton: { padding: 12, backgroundColor: '#f8fafc', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  filterDoneText: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  
  // Dropdown Overlay
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: 'transparent' },

  // Table Container - scrollbar
  tableContainer: { flex: 1 },
  
  // Tabelle
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableHeaderText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  tableBody: { flex: 1, backgroundColor: '#fff' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableRowLocked: { backgroundColor: '#fafafa' },
  tableCell: { fontSize: 14, color: '#334155' },
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
  colBirthDate: { flex: 1, minWidth: 90 },
  colPosition: { flex: 1.3, minWidth: 85 },
  colClub: { flex: 1.6, minWidth: 120 },
  colLeague: { flex: 1.2, minWidth: 90 },
  colContract: { flex: 1.2, minWidth: 100 },
  colListing: { flex: 0.7, minWidth: 50 },
  colResponsibility: { flex: 1.3, minWidth: 100 },
  
  // Contract Badges
  contractBadge: { backgroundColor: '#fef2f2', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  contractBadgeText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  contractBadgeExpired: { backgroundColor: '#fef2f2', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  contractBadgeTextExpired: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  
  // Listing Badges
  listingBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  listingKMH: { backgroundColor: '#1e293b' },
  listingPM: { backgroundColor: '#0ea5e9' },
  listingBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  
  loadingText: { padding: 20, textAlign: 'center', color: '#64748b' },
  emptyText: { padding: 20, textAlign: 'center', color: '#64748b' },
  
  // Header Tabs
  headerTabs: { flexDirection: 'row', gap: 8 },
  
  // Add Button
  addButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#1a1a1a' },
  addButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  
  // Vereine Tab Spalten
  colDate: { flex: 0.8, minWidth: 80 },
  colClubName: { flex: 1.5, minWidth: 150 },
  colLeagueName: { flex: 1.2, minWidth: 100 },
  colPositionNeeded: { flex: 1.2, minWidth: 120 },
  colYearRange: { flex: 1, minWidth: 100 },
  colContactPerson: { flex: 1.2, minWidth: 100 },
  
  // Position Badge (Liste)
  positionBadge: { backgroundColor: '#e0f2fe', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  positionBadgeText: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
  
  // Modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 500, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { fontSize: 18, color: '#64748b' },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: '500' },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  modalButtonsRight: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  modalButtonsSpaced: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#64748b', fontWeight: '600' },
  saveButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#10b981' },
  saveButtonText: { color: '#10b981', fontWeight: '600' },
  deleteButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ef4444' },
  deleteButtonText: { color: '#ef4444', fontWeight: '600' },
  
  // Position Picker (Form)
  positionPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  positionOption: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  positionOptionSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  positionOptionText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  positionOptionTextSelected: { color: '#fff' },
  
  // Detail Modal - Neues Layout wie Spieler-Detail
  detailHeaderLeft: { flex: 1 },
  detailSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  detailContent: { marginTop: 8 },
  detailRow: { marginBottom: 16 },
  detailRowNotes: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  detailLabel: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: '500' },
  detailValue: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  detailPositions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailNotesText: { fontSize: 14, color: '#334155', lineHeight: 20, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
  detailActions: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'flex-end' },
  editButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  editButtonText: { color: '#64748b', fontWeight: '600' },
  
  // Detail Modal - Neues Karten-Layout
  detailModalContent: { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 550, maxHeight: '85%', overflow: 'hidden' },
  detailModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingBottom: 16 },
  detailHeaderInfo: { flex: 1 },
  detailHeaderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailModalTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  detailModalSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  detailHeaderLogo: { width: 32, height: 32, resizeMode: 'contain' },
  detailModalBody: { paddingHorizontal: 20, paddingBottom: 20 },
  
  // Karten-Layout - volle Breite
  detailCardsRow: { marginBottom: 16 },
  detailCard: { backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', padding: 20 },
  detailCardField: { marginBottom: 16 },
  detailCardFieldLast: { marginBottom: 0 },
  detailCardLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  detailCardValue: { fontSize: 15, color: '#1a1a1a', fontWeight: '600' },
  
  // Position Badge im Detail Modal - hellblau ohne Rahmen wie in Liste
  positionBadgeDetail: { backgroundColor: '#e0f2fe', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  positionBadgeDetailText: { fontSize: 13, fontWeight: '600', color: '#0369a1' },
  
  // Notizen Card - hellblau wie die anderen Karten
  detailNotesCard: { marginBottom: 20 },
  detailNotesBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#bfdbfe', marginTop: 6 },
  detailNotesBoxText: { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  
  // Action Buttons im Detail Modal - nur Bearbeiten rechts
  detailModalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  detailDeleteButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fca5a5' },
  detailDeleteButtonText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  detailEditButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#3b82f6' },
  detailEditButtonText: { color: '#3b82f6', fontWeight: '600', fontSize: 14 },
  
  // Club Selector in Form
  clubSelectorContainer: { position: 'relative', zIndex: 100 },
  clubDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, zIndex: 9999, elevation: 9999 },
  clubDropdownScroll: { maxHeight: 200 },
  clubDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  clubDropdownLogo: { width: 24, height: 24, resizeMode: 'contain', marginRight: 10 },
  clubDropdownText: { fontSize: 14, color: '#333' },
  clubDropdownCustom: { backgroundColor: '#f0fdf4' },
  clubDropdownCustomText: { fontSize: 14, color: '#16a34a', fontWeight: '500' },
});
