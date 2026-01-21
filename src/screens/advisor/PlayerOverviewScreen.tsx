import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';

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

export function PlayerOverviewScreen({ navigation }: any) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('berater');
  const [myPlayerIds, setMyPlayerIds] = useState<string[]>([]);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [profile, setProfile] = useState<Advisor | null>(null);
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const [searchText, setSearchText] = useState('');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [selectedContractYears, setSelectedContractYears] = useState<string[]>([]);
  
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

  useEffect(() => {
    fetchCurrentUser();
    fetchPlayers();
    fetchClubLogos();
    fetchAdvisors();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchPlayers();
    }, [])
  );

  useEffect(() => { applyFilters(); }, [searchText, players, selectedYears, selectedPositions, selectedListings, selectedResponsibilities, selectedContractYears, sortField, sortDirection]);

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

  const hasAccessToPlayer = (playerId: string): boolean => {
    if (userRole === 'admin') return true;
    // Solange accessLoaded false ist, zeige kein Schloss (verhindert Flackern)
    if (!accessLoaded) return true;
    return myPlayerIds.includes(playerId);
  };

  const handlePlayerClick = (player: Player) => {
    if (hasAccessToPlayer(player.id)) {
      navigation.navigate('PlayerDetail', { playerId: player.id });
    } else {
      setSelectedPlayer(player);
      setShowRequestModal(true);
    }
  };

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

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('player_details').select('id, first_name, last_name, birth_date, position, club, league, contract_end, listing, responsibility, future_club').order('last_name', { ascending: true });
      if (!error) setPlayers(data || []);
      else console.error('Fehler beim Laden der Spieler:', error);
    } catch (err) {
      console.error('Netzwerkfehler beim Laden der Spieler:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!newFirstName.trim() || !newLastName.trim() || !currentUserId) return;
    
    const { data: newPlayer, error } = await supabase
      .from('player_details')
      .insert([{ 
        first_name: newFirstName.trim(), 
        last_name: newLastName.trim(),
        responsibility: currentUserName
      }])
      .select()
      .single();
    
    if (!error && newPlayer) {
      await supabase.from('advisor_access').insert({
        player_id: newPlayer.id,
        advisor_id: currentUserId,
        granted_by: currentUserId,
        granted_at: new Date().toISOString()
      });
      
      setNewFirstName('');
      setNewLastName('');
      setShowAddModal(false);
      fetchPlayers();
      fetchMyPlayerAccess();
    }
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
    const logoUrl = expired ? null : getClubLogo(player.club);
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
    const inCurrentSeason = isContractInCurrentSeason(player.contract_end);
    const hasSecuredFuture = hasFutureClubAndExpiringContract(player);
    
    if (hasSecuredFuture) {
      return (
        <View style={styles.colContract}>
          <View style={styles.contractBadgeGreen}>
            <Text style={styles.contractBadgeTextGreen}>{formatDate(player.contract_end)}</Text>
          </View>
        </View>
      );
    } else if (inCurrentSeason && player.contract_end) {
      return (
        <View style={styles.colContract}>
          <View style={styles.contractBadge}>
            <Text style={styles.contractBadgeText}>{formatDate(player.contract_end)}</Text>
          </View>
        </View>
      );
    }
    return <Text style={[styles.tableCell, styles.colContract]}>{formatDate(player.contract_end)}</Text>;
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
          {!hasAccess && <Text style={styles.lockIcon}>🔒 </Text>}
          <Text style={[styles.tableCell, styles.nameCell]} numberOfLines={1}>
            {player.last_name}, {player.first_name}
          </Text>
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
      <Sidebar navigation={navigation} activeScreen="players" profile={profile} />

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Header Banner - weiß mit Titel mittig und Zurück links */}
        <View style={styles.headerBanner}>
          <TouchableOpacity onPress={() => navigation.navigate('AdvisorDashboard')} style={styles.filterButton}>
            <Text style={styles.filterButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.headerBannerCenter}>
            <Text style={styles.headerTitle}>KMH-Spieler</Text>
            <Text style={styles.headerSubtitle}>Verwaltung aller Daten unserer {players.length} aktiven Spieler und Trainer</Text>
          </View>
          <View style={{ width: 80 }} />
        </View>

        {/* Toolbar wie Scouting */}
        <Pressable style={styles.toolbar} onPress={closeAllDropdowns}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput style={styles.searchInput} placeholder="Spieler, Verein suchen..." placeholderTextColor="#9ca3af" value={searchText} onChangeText={setSearchText} onFocus={closeAllDropdowns} />
          </View>
          
          <View style={styles.filterContainer}>
            {/* Position Filter */}
            <View style={[styles.dropdownContainer, { zIndex: 50 }]}>
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
            <View style={[styles.dropdownContainer, { zIndex: 40 }]}>
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
            <View style={[styles.dropdownContainer, { zIndex: 30 }]}>
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
            <View style={[styles.dropdownContainer, { zIndex: 20 }]}>
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
            <View style={[styles.dropdownContainer, { zIndex: 10 }]}>
              <TouchableOpacity 
                style={[styles.filterButton, selectedContractYears.length > 0 && styles.filterButtonActive]} 
                onPress={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowContractDropdown(!showContractDropdown); }}
              >
                <Text style={[styles.filterButtonText, selectedContractYears.length > 0 && styles.filterButtonTextActive]}>{getContractFilterLabel()} ▼</Text>
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
          
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Spieler anlegen</Text>
          </TouchableOpacity>
        </Pressable>

        {/* Dropdown Overlay - schließt alle Dropdowns beim Klicken */}
        {isAnyDropdownOpen && (
          <Pressable style={styles.dropdownOverlay} onPress={closeAllDropdowns} />
        )}

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

        <ScrollView style={styles.tableBody}>
          {loading ? <Text style={styles.loadingText}>Laden...</Text> : filteredPlayers.length === 0 ? <Text style={styles.emptyText}>Keine Spieler gefunden</Text> : (
            filteredPlayers.map((player) => renderPlayerRow(player))
          )}
        </ScrollView>

        {/* Add Player Modal */}
        <Modal visible={showAddModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Neuen Spieler anlegen</Text>
              <TextInput style={styles.modalInput} placeholder="Vorname" value={newFirstName} onChangeText={setNewFirstName} />
              <TextInput style={styles.modalInput} placeholder="Nachname" value={newLastName} onChangeText={setNewLastName} />
              <Text style={styles.modalHint}>Zuständigkeit: {currentUserName || 'Sie'}</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowAddModal(false)}><Text style={styles.modalCancelButtonText}>Abbrechen</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveButton} onPress={handleAddPlayer}><Text style={styles.modalSaveButtonText}>Speichern</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Request Access Modal */}
        <Modal visible={showRequestModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Zuständigkeit beantragen</Text>
              <Text style={styles.modalText}>
                Sie haben keinen Zugriff auf das Profil von{'\n'}
                <Text style={styles.modalPlayerName}>{selectedPlayer?.first_name} {selectedPlayer?.last_name}</Text>
              </Text>
              <Text style={styles.modalSubText}>
                Möchten Sie die Zuständigkeit beantragen?{'\n'}Ein Admin wird Ihre Anfrage prüfen.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => { setShowRequestModal(false); setSelectedPlayer(null); }}>
                  <Text style={styles.modalCancelButtonText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveButton} onPress={handleRequestAccess}>
                  <Text style={styles.modalSaveButtonText}>Ja, beantragen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  mainContent: { flex: 1, backgroundColor: '#f8fafc' },
  
  // Header Banner - weiß mit Titel mittig
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
  
  // Add Button
  addButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#1a1a1a' },
  addButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  
  // Tabelle wie Scouting
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableHeaderText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  tableBody: { flex: 1, backgroundColor: '#fff' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableRowLocked: { backgroundColor: '#fafafa' },
  tableCell: { fontSize: 14, color: '#334155' },
  nameContainer: { flexDirection: 'row', alignItems: 'center' },
  nameCell: { fontWeight: '500', flex: 1 },
  lockIcon: { fontSize: 12, marginRight: 4 },
  clubCell: { flexDirection: 'row', alignItems: 'center' },
  clubTextRed: { color: '#dc3545' },
  clubLogo: { width: 22, height: 22, resizeMode: 'contain', marginRight: 8 },
  birthDateCell: { flexDirection: 'row', alignItems: 'center' },
  birthdayIcon: { fontSize: 14, marginLeft: 6 },
  colName: { flex: 1.5, minWidth: 100 },
  colBirthDate: { flex: 1.1, minWidth: 95 },
  colPosition: { flex: 1.4, minWidth: 90 },
  colClub: { flex: 1.8, minWidth: 130 },
  colLeague: { flex: 1.3, minWidth: 100 },
  colContract: { flex: 1.4, minWidth: 115 },
  colListing: { flex: 0.8, minWidth: 55 },
  colResponsibility: { flex: 1.3, minWidth: 100 },
  contractBadge: { backgroundColor: '#fef2f2', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  contractBadgeText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  contractBadgeGreen: { backgroundColor: '#f0fdf4', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  contractBadgeTextGreen: { color: '#16a34a', fontSize: 14, fontWeight: '600' },
  listingBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  listingKMH: { backgroundColor: '#1e293b' },
  listingPM: { backgroundColor: '#0ea5e9' },
  listingBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  loadingText: { padding: 20, textAlign: 'center', color: '#64748b' },
  emptyText: { padding: 20, textAlign: 'center', color: '#64748b' },
  
  // Modal - dezente Buttons
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  modalText: { fontSize: 15, color: '#334155', textAlign: 'center', marginBottom: 8 },
  modalPlayerName: { fontWeight: 'bold' },
  modalSubText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  modalHint: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
  modalInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  modalCancelButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  modalCancelButtonText: { color: '#64748b', fontWeight: '600' },
  modalSaveButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#10b981', alignItems: 'center' },
  modalSaveButtonText: { color: '#10b981', fontWeight: '600' },
});
