import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';

const POSITIONS = ['Torwart', 'Innenverteidiger', 'Linker Verteidiger', 'Rechter Verteidiger', 'Defensives Mittelfeld', 'Offensives Mittelfeld', 'Linke Außenbahn', 'Rechte Außenbahn', 'Stürmer'];
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
  const [profile, setProfile] = useState<Advisor | null>(null);
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const [searchText, setSearchText] = useState('');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [selectedContractYears, setSelectedContractYears] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const yearOptions = Array.from({ length: 46 }, (_, i) => (2025 - i).toString());
  const contractYearOptions = Array.from({ length: 26 }, (_, i) => (2025 + i).toString());

  useEffect(() => {
    fetchCurrentUser();
    fetchPlayers();
    fetchClubLogos();
    fetchAdvisors();
    const unsubscribe = navigation.addListener('focus', () => { fetchPlayers(); fetchMyPlayerAccess(); });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => { applyFilters(); }, [searchText, players, selectedYears, selectedPositions, selectedListings, selectedResponsibilities, selectedContractYears, sortField, sortDirection]);

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
        setCurrentUserName(`${advisor.first_name || ''} ${advisor.last_name || ''}`.trim());
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
      data.forEach((item: ClubLogo) => {
        logoMap[item.club_name] = item.logo_url;
        const simplified = item.club_name.replace(' II', '').replace(' U23', '').replace(' U21', '').replace(' U19', '');
        if (simplified !== item.club_name) logoMap[simplified] = item.logo_url;
      });
      setClubLogos(logoMap);
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

  const hasAccessToPlayer = (playerId: string): boolean => {
    if (userRole === 'admin') return true;
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
    
    const { error } = await supabase.from('player_access').insert({
      player_id: selectedPlayer.id,
      advisor_id: currentUserId,
      access_type: 'requested'
    });
    
    if (error) {
      if (error.code === '23505') {
        alert('Sie haben bereits eine Anfrage für diesen Spieler gestellt.');
      } else {
        alert('Fehler: ' + error.message);
      }
    } else {
      alert('Zuständigkeit wurde beantragt. Ein Admin wird Ihre Anfrage prüfen.');
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
      filtered = filtered.filter(player => player.responsibility && selectedResponsibilities.some(resp => player.responsibility.includes(resp)));
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
    const { data, error } = await supabase.from('player_details').select('id, first_name, last_name, birth_date, position, club, league, contract_end, listing, responsibility, future_club').order('last_name', { ascending: true });
    if (!error) setPlayers(data || []);
    setLoading(false);
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
      await supabase.from('player_access').insert({
        player_id: newPlayer.id,
        advisor_id: currentUserId,
        access_type: 'owner',
        approved_at: new Date().toISOString(),
        approved_by: currentUserId
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

  const toggleMultiSelect = (value: string, selected: string[], setSelected: (arr: string[]) => void) => {
    setSelected(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  const clearAllFilters = () => { setSearchText(''); setSelectedYears([]); setSelectedPositions([]); setSelectedListings([]); setSelectedResponsibilities([]); setSelectedContractYears([]); };

  const hasActiveFilters = searchText || selectedYears.length > 0 || selectedPositions.length > 0 || selectedListings.length > 0 || selectedResponsibilities.length > 0 || selectedContractYears.length > 0;

  const renderFilterButton = (id: string, label: string, selected: string[]) => (
    <TouchableOpacity style={[styles.filterButton, selected.length > 0 && styles.filterButtonActive]} onPress={() => setActiveDropdown(activeDropdown === id ? null : id)}>
      <Text style={[styles.filterButtonText, selected.length > 0 && styles.filterButtonTextActive]}>{label} {selected.length > 0 ? `(${selected.length})` : ''}</Text>
      <Text style={[styles.filterArrow, selected.length > 0 && styles.filterButtonTextActive]}>{activeDropdown === id ? '▲' : '▼'}</Text>
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
        <Text style={[styles.tableCell, styles.colPosition]} numberOfLines={1}>{player.position || '-'}</Text>
        {renderClubCell(player)}
        <Text style={[styles.tableCell, styles.colLeague]} numberOfLines={1}>{player.league || '-'}</Text>
        {renderContractCell(player)}
        <View style={styles.colListing}>{renderListingBadge(player.listing)}</View>
        <Text style={[styles.tableCell, styles.colResponsibility]} numberOfLines={1}>{player.responsibility || '-'}</Text>
      </TouchableOpacity>
    );
  };

  const renderDropdownItems = () => {
    if (activeDropdown === 'year') {
      return yearOptions.map((opt) => (
        <TouchableOpacity key={opt} style={[styles.dropdownItem, selectedYears.includes(opt) && styles.dropdownItemSelected]} onPress={() => toggleMultiSelect(opt, selectedYears, setSelectedYears)}>
          <Text style={[styles.dropdownItemText, selectedYears.includes(opt) && styles.dropdownItemTextSelected]}>{selectedYears.includes(opt) ? '✓ ' : ''}{opt}</Text>
        </TouchableOpacity>
      ));
    }
    if (activeDropdown === 'position') {
      return POSITIONS.map((opt) => (
        <TouchableOpacity key={opt} style={[styles.dropdownItem, selectedPositions.includes(opt) && styles.dropdownItemSelected]} onPress={() => toggleMultiSelect(opt, selectedPositions, setSelectedPositions)}>
          <Text style={[styles.dropdownItemText, selectedPositions.includes(opt) && styles.dropdownItemTextSelected]}>{selectedPositions.includes(opt) ? '✓ ' : ''}{opt}</Text>
        </TouchableOpacity>
      ));
    }
    if (activeDropdown === 'listing') {
      return LISTINGS.map((opt) => (
        <TouchableOpacity key={opt} style={[styles.dropdownItem, selectedListings.includes(opt) && styles.dropdownItemSelected]} onPress={() => toggleMultiSelect(opt, selectedListings, setSelectedListings)}>
          <Text style={[styles.dropdownItemText, selectedListings.includes(opt) && styles.dropdownItemTextSelected]}>{selectedListings.includes(opt) ? '✓ ' : ''}{opt === 'Karl Herzog Sportmanagement' ? 'KMH' : 'PM'}</Text>
        </TouchableOpacity>
      ));
    }
    if (activeDropdown === 'responsibility') {
      return advisors.map((advisor) => {
        const name = `${advisor.first_name} ${advisor.last_name}`.trim();
        return (
          <TouchableOpacity key={advisor.id} style={[styles.dropdownItem, selectedResponsibilities.includes(name) && styles.dropdownItemSelected]} onPress={() => toggleMultiSelect(name, selectedResponsibilities, setSelectedResponsibilities)}>
            <Text style={[styles.dropdownItemText, selectedResponsibilities.includes(name) && styles.dropdownItemTextSelected]}>{selectedResponsibilities.includes(name) ? '✓ ' : ''}{name}</Text>
          </TouchableOpacity>
        );
      });
    }
    if (activeDropdown === 'contract') {
      return contractYearOptions.map((opt) => (
        <TouchableOpacity key={opt} style={[styles.dropdownItem, selectedContractYears.includes(opt) && styles.dropdownItemSelected]} onPress={() => toggleMultiSelect(opt, selectedContractYears, setSelectedContractYears)}>
          <Text style={[styles.dropdownItemText, selectedContractYears.includes(opt) && styles.dropdownItemTextSelected]}>{selectedContractYears.includes(opt) ? '✓ ' : ''}{opt}</Text>
        </TouchableOpacity>
      ));
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <Sidebar navigation={navigation} activeScreen="players" profile={profile} />

      {/* Main Content */}
      <View style={styles.mainContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>KMH Spieler-Übersicht</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}><Text style={styles.addButtonText}>+ Neuer Spieler</Text></TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <TextInput style={styles.searchInput} placeholder="Suchen..." value={searchText} onChangeText={setSearchText} onFocus={() => setActiveDropdown(null)} />
            {renderFilterButton('year', 'Jahrgang', selectedYears)}
            {renderFilterButton('position', 'Position', selectedPositions)}
            {renderFilterButton('listing', 'Listung', selectedListings)}
            {renderFilterButton('responsibility', 'Zuständigkeit', selectedResponsibilities)}
            {renderFilterButton('contract', 'Vertragsende', selectedContractYears)}
            {hasActiveFilters && <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}><Text style={styles.clearButtonText}>✕</Text></TouchableOpacity>}
          </View>
        </View>

        {activeDropdown && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={styles.dropdownBackdrop} onPress={() => setActiveDropdown(null)} />
            <View style={[styles.dropdownList, activeDropdown === 'year' && { left: 200 }, activeDropdown === 'position' && { left: 300 }, activeDropdown === 'listing' && { left: 400 }, activeDropdown === 'responsibility' && { left: 490 }, activeDropdown === 'contract' && { left: 620 }]}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {renderDropdownItems()}
              </ScrollView>
            </View>
          </View>
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
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f5f5' },
  mainContent: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  addButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#000' },
  addButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  filterContainer: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  searchInput: { width: 180, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 14 },
  filterButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f0f0f0', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  filterButtonActive: { backgroundColor: '#000', borderColor: '#000' },
  filterButtonText: { fontSize: 13, color: '#333', marginRight: 4 },
  filterButtonTextActive: { color: '#fff' },
  filterArrow: { fontSize: 10, color: '#666' },
  clearButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ff4444', justifyContent: 'center', alignItems: 'center' },
  clearButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  dropdownOverlay: { position: 'absolute', top: 130, left: 240, right: 0, bottom: 0, zIndex: 1000 },
  dropdownBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dropdownList: { position: 'absolute', top: 0, minWidth: 160, maxHeight: 250, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10 },
  dropdownScroll: { maxHeight: 250 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dropdownItemSelected: { backgroundColor: '#000' },
  dropdownItemText: { fontSize: 14, color: '#333' },
  dropdownItemTextSelected: { color: '#fff' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#333', paddingVertical: 12, paddingHorizontal: 16 },
  tableHeaderText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  tableBody: { flex: 1, backgroundColor: '#fff' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  tableRowLocked: { backgroundColor: '#f9f9f9' },
  tableCell: { fontSize: 14, color: '#333' },
  nameContainer: { flexDirection: 'row', alignItems: 'center' },
  nameCell: { fontWeight: '500', flex: 1 },
  lockIcon: { fontSize: 12, marginLeft: 4 },
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
  contractBadge: { backgroundColor: '#f8d7da', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  contractBadgeText: { color: '#721c24', fontSize: 14, fontWeight: '600' },
  contractBadgeGreen: { backgroundColor: '#d4edda', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  contractBadgeTextGreen: { color: '#155724', fontSize: 14, fontWeight: '600' },
  listingBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  listingKMH: { backgroundColor: '#000' },
  listingPM: { backgroundColor: '#5bc0de' },
  listingBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  emptyText: { padding: 20, textAlign: 'center', color: '#666' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  modalText: { fontSize: 15, color: '#333', textAlign: 'center', marginBottom: 8 },
  modalPlayerName: { fontWeight: 'bold' },
  modalSubText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  modalHint: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  modalCancelButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#eee', marginRight: 8, alignItems: 'center' },
  modalCancelButtonText: { color: '#666', fontWeight: '600' },
  modalSaveButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#000', marginLeft: 8, alignItems: 'center' },
  modalSaveButtonText: { color: '#fff', fontWeight: '600' },
});
