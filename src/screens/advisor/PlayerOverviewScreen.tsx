import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

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
  const isMobile = useIsMobile();
  const { session, loading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const dataLoadedRef = useRef(false);
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
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

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
        fetchPlayers();
      }
    }, [authLoading, session])
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

  // Mobile Card Rendering
  const renderPlayerCard = (player: Player) => {
    const hasAccess = hasAccessToPlayer(player.id);
    const positionDisplay = player.position
      ? player.position.split(', ').map(p => POSITION_SHORT[p.trim()] || p).join(', ')
      : '-';
    const expired = isContractExpired(player.contract_end);
    const displayClub = getDisplayClub(player);
    const logoUrl = expired ? null : getClubLogo(player.club);
    const inCurrentSeason = isContractInCurrentSeason(player.contract_end);
    const hasSecuredFuture = hasFutureClubAndExpiringContract(player);
    const birthday = isBirthday(player.birth_date);

    return (
      <TouchableOpacity
        key={player.id}
        style={[styles.playerCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }, !hasAccess && { backgroundColor: colors.surfaceSecondary }]}
        onPress={() => handlePlayerClick(player)}
      >
        <View style={styles.playerCardHeader}>
          <View style={styles.playerCardNameRow}>
            {!hasAccess && <Text style={styles.lockIconMobile}>🔒</Text>}
            <Text style={[styles.playerCardName, { color: colors.text }]} numberOfLines={1}>
              {player.last_name}, {player.first_name}
            </Text>
            {birthday && <Text style={styles.birthdayIconMobile}>🎉</Text>}
          </View>
          <View style={styles.playerCardBadges}>
            {player.listing && (
              <View style={[styles.listingBadgeMobile, player.listing === 'Karl Herzog Sportmanagement' ? styles.listingKMH : styles.listingPM]}>
                <Text style={styles.listingBadgeTextMobile}>{player.listing === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM'}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.playerCardBody}>
          <View style={styles.playerCardRow}>
            <View style={styles.playerCardClub}>
              {expired ? (
                <Image source={ArbeitsamtIcon} style={styles.clubLogoMobile} />
              ) : logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.clubLogoMobile} />
              ) : null}
              <Text style={[styles.playerCardClubText, { color: colors.textSecondary }, expired && styles.clubTextRed]} numberOfLines={1}>
                {displayClub}
              </Text>
            </View>
            <Text style={[styles.playerCardPosition, { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary }]}>{positionDisplay}</Text>
          </View>

          <View style={styles.playerCardRow}>
            <Text style={[styles.playerCardLeague, { color: colors.textMuted }]} numberOfLines={1}>{player.league || '-'}</Text>
            {player.contract_end && (
              <View style={[
                styles.contractBadgeMobile,
                hasSecuredFuture ? styles.contractBadgeMobileGreen :
                inCurrentSeason ? styles.contractBadgeMobileRed : null
              ]}>
                <Text style={[
                  styles.contractTextMobile,
                  { color: colors.textMuted },
                  hasSecuredFuture ? styles.contractTextMobileGreen :
                  inCurrentSeason ? styles.contractTextMobileRed : null
                ]}>
                  Vertrag bis {formatDate(player.contract_end)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Anzahl aktiver Filter
  const activeFilterCount = selectedPositions.length + selectedYears.length + selectedListings.length + selectedResponsibilities.length + selectedContractYears.length;

  // Profile initials for header
  const profileInitials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}` : '?';

  // Mobile View
  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: colors.background }]}>
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="players"
          profile={profile}
        />

        <View style={[styles.mainContentMobile, { backgroundColor: colors.background }]}>
          {/* Mobile Header */}
          <MobileHeader
            title="Spielerübersicht"
            onMenuPress={() => setShowMobileSidebar(true)}
            onProfilePress={() => navigation.navigate('MyProfile')}
            profileInitials={profileInitials}
          />

          {/* Mobile Toolbar */}
          <View style={[styles.mobileToolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={[styles.mobileSearchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.mobileSearchInput, { color: colors.text }]}
                placeholder="Spieler suchen..."
                placeholderTextColor={colors.textMuted}
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
            <TouchableOpacity
              style={[styles.mobileFilterButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, activeFilterCount > 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setShowMobileFilters(true)}
            >
              <Ionicons name="filter" size={20} color={activeFilterCount > 0 ? colors.primaryText : colors.textSecondary} />
              {activeFilterCount > 0 && (
                <View style={styles.filterCountBubble}>
                  <Text style={styles.filterCountText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobileAddButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.mobileAddButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Player Count */}
          <View style={[styles.mobileSubheader, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.mobileSubheaderText, { color: colors.textSecondary }]}>{filteredPlayers.length} Spieler</Text>
          </View>

          {/* Player Cards */}
          <ScrollView
            style={styles.mobileCardList}
            contentContainerStyle={styles.mobileCardListContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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

          {/* Mobile Filter Modal */}
          <Modal visible={showMobileFilters} transparent animationType="slide">
            <View style={[styles.mobileFilterModal, { backgroundColor: colors.surface }]}>
              <View style={[styles.mobileFilterHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.mobileFilterTitle, { color: colors.text }]}>Filter</Text>
                <TouchableOpacity onPress={() => setShowMobileFilters(false)}>
                  <Text style={[styles.mobileFilterClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.mobileFilterContent}>
                {/* Position Filter */}
                <Text style={[styles.mobileFilterLabel, { color: colors.text }]}>Position</Text>
                <View style={styles.mobileFilterChips}>
                  {POSITIONS.map(pos => (
                    <TouchableOpacity
                      key={pos}
                      style={[styles.mobileChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, selectedPositions.includes(pos) && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => togglePosition(pos)}
                    >
                      <Text style={[styles.mobileChipText, { color: colors.textSecondary }, selectedPositions.includes(pos) && { color: colors.primaryText }]}>
                        {POSITION_SHORT[pos]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Jahrgang Filter */}
                <Text style={[styles.mobileFilterLabel, { color: colors.text }]}>Jahrgang</Text>
                <View style={styles.mobileFilterChips}>
                  {availableYears.map(year => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.mobileChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, selectedYears.includes(year) && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => toggleYear(year)}
                    >
                      <Text style={[styles.mobileChipText, { color: colors.textSecondary }, selectedYears.includes(year) && { color: colors.primaryText }]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Listung Filter */}
                <Text style={[styles.mobileFilterLabel, { color: colors.text }]}>Listung</Text>
                <View style={styles.mobileFilterChips}>
                  {LISTINGS.map(listing => (
                    <TouchableOpacity
                      key={listing}
                      style={[styles.mobileChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, selectedListings.includes(listing) && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => toggleListing(listing)}
                    >
                      <Text style={[styles.mobileChipText, { color: colors.textSecondary }, selectedListings.includes(listing) && { color: colors.primaryText }]}>
                        {listing === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Zuständigkeit Filter */}
                <Text style={[styles.mobileFilterLabel, { color: colors.text }]}>Zuständigkeit</Text>
                <View style={styles.mobileFilterChips}>
                  {advisors.map(advisor => {
                    const name = `${advisor.first_name} ${advisor.last_name}`.trim();
                    return (
                      <TouchableOpacity
                        key={advisor.id}
                        style={[styles.mobileChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, selectedResponsibilities.includes(name) && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => toggleResponsibility(name)}
                      >
                        <Text style={[styles.mobileChipText, { color: colors.textSecondary }, selectedResponsibilities.includes(name) && { color: colors.primaryText }]}>
                          {advisor.first_name?.[0]}{advisor.last_name?.[0]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Vertragsende Filter */}
                <Text style={[styles.mobileFilterLabel, { color: colors.text }]}>Vertragsende</Text>
                <View style={styles.mobileFilterChips}>
                  {contractYearOptions.map(year => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.mobileChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, selectedContractYears.includes(year) && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => toggleContractYear(year)}
                    >
                      <Text style={[styles.mobileChipText, { color: colors.textSecondary }, selectedContractYears.includes(year) && { color: colors.primaryText }]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={[styles.mobileFilterFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.mobileFilterClearButton, { borderColor: colors.border }]}
                  onPress={() => {
                    clearPositions();
                    clearYears();
                    clearListings();
                    clearResponsibilities();
                    clearContractYears();
                  }}
                >
                  <Text style={[styles.mobileFilterClearText, { color: colors.textSecondary }]}>Alle löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mobileFilterApplyButton, { backgroundColor: colors.primary }]} onPress={() => setShowMobileFilters(false)}>
                  <Text style={[styles.mobileFilterApplyText, { color: colors.primaryText }]}>Anwenden ({filteredPlayers.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

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

  // Desktop View
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sidebar / Mobile Header */}
      <Sidebar navigation={navigation} activeScreen="players" profile={profile} />

      {/* Main Content */}
      <View style={[styles.mainContent, { backgroundColor: colors.background }]}>
        {/* Header Banner - weiß mit Titel mittig und Zurück links */}
        <View style={[styles.headerBanner, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.navigate('AdvisorDashboard')} style={[styles.filterButton, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.filterButtonText, { color: colors.text }]}>← Zurück</Text>
          </TouchableOpacity>
          <View style={styles.headerBannerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>KMH-Spieler</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Verwaltung aller Daten unserer {players.length} aktiven Spieler und Trainer</Text>
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
          {(authLoading || loading) ? (
            <Text style={styles.loadingText}>Laden...</Text>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchPlayers}>
                <Text style={styles.retryButtonText}>Erneut versuchen</Text>
              </TouchableOpacity>
            </View>
          ) : filteredPlayers.length === 0 ? (
            <Text style={styles.emptyText}>Keine Spieler gefunden</Text>
          ) : (
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
  containerMobile: { flex: 1, flexDirection: 'column', backgroundColor: '#f8fafc' },
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, flexDirection: 'row' },
  sidebarMobile: { width: 280, height: '100%', backgroundColor: '#fff' },
  mainContent: { flex: 1, backgroundColor: '#f8fafc' },
  mainContentMobile: { flex: 1, backgroundColor: '#f8fafc' },

  // Mobile Toolbar
  mobileToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mobileSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  mobileSearchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  mobileFilterButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    position: 'relative',
  },
  mobileFilterButtonActive: {
    backgroundColor: '#e0f2fe',
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
  mobileAddButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileAddButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '500',
  },

  // Mobile Subheader
  mobileSubheader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  mobileSubheaderText: {
    fontSize: 13,
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
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  playerCardLocked: {
    backgroundColor: '#fafafa',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
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
    width: 18,
    height: 18,
    resizeMode: 'contain',
    marginRight: 6,
  },
  playerCardClubText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  playerCardPosition: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playerCardLeague: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  contractBadgeMobile: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  contractBadgeMobileRed: {
    backgroundColor: '#fef2f2',
  },
  contractBadgeMobileGreen: {
    backgroundColor: '#f0fdf4',
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
    backgroundColor: '#fff',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  mobileFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mobileFilterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  mobileFilterClose: {
    fontSize: 20,
    color: '#64748b',
    padding: 4,
  },
  mobileFilterContent: {
    flex: 1,
    padding: 16,
  },
  mobileFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
    marginTop: 16,
  },
  mobileFilterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mobileChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    marginBottom: 8,
  },
  mobileChipActive: {
    backgroundColor: '#1a1a1a',
  },
  mobileChipText: {
    fontSize: 14,
    color: '#334155',
  },
  mobileChipTextActive: {
    color: '#fff',
  },
  mobileFilterFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  mobileFilterClearButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 8,
  },
  mobileFilterClearText: {
    fontSize: 15,
    color: '#ef4444',
    fontWeight: '500',
  },
  mobileFilterApplyButton: {
    flex: 2,
    paddingVertical: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    alignItems: 'center',
  },
  mobileFilterApplyText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  
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
  errorContainer: { padding: 20, alignItems: 'center' },
  errorText: { color: '#dc2626', textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#1a1a1a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },

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
