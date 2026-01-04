import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import * as DocumentPicker from 'expo-document-picker';

const POSITIONS = ['Torwart', 'Innenverteidiger', 'Linker Verteidiger', 'Rechter Verteidiger', 'Defensives Mittelfeld', 'Offensives Mittelfeld', 'Linke Außenbahn', 'Rechte Außenbahn', 'Stürmer'];
const LISTINGS = ['Karl Herzog Sportmanagement', 'PM Sportmanagement'];
const COUNTRIES = ['Afghanistan', 'Ägypten', 'Albanien', 'Algerien', 'Andorra', 'Angola', 'Argentinien', 'Armenien', 'Aserbaidschan', 'Äthiopien', 'Australien', 'Belgien', 'Bosnien und Herzegowina', 'Brasilien', 'Bulgarien', 'Chile', 'China', 'Costa Rica', 'Dänemark', 'Deutschland', 'Dominikanische Republik', 'Ecuador', 'El Salvador', 'England', 'Estland', 'Finnland', 'Frankreich', 'Georgien', 'Ghana', 'Griechenland', 'Guatemala', 'Haiti', 'Honduras', 'Hongkong', 'Indien', 'Indonesien', 'Irak', 'Iran', 'Irland', 'Island', 'Israel', 'Italien', 'Jamaika', 'Japan', 'Jordanien', 'Kamerun', 'Kanada', 'Kasachstan', 'Katar', 'Kenia', 'Kolumbien', 'Kosovo', 'Kroatien', 'Kuba', 'Lettland', 'Libanon', 'Libyen', 'Liechtenstein', 'Litauen', 'Luxemburg', 'Marokko', 'Mexiko', 'Moldau', 'Monaco', 'Montenegro', 'Namibia', 'Neuseeland', 'Niederlande', 'Nigeria', 'Nordmazedonien', 'Norwegen', 'Österreich', 'Pakistan', 'Palästina', 'Panama', 'Paraguay', 'Peru', 'Philippinen', 'Polen', 'Portugal', 'Rumänien', 'Russland', 'Saudi-Arabien', 'Schottland', 'Schweden', 'Schweiz', 'Senegal', 'Serbien', 'Singapur', 'Slowakei', 'Slowenien', 'Spanien', 'Südafrika', 'Südkorea', 'Syrien', 'Taiwan', 'Thailand', 'Tschechien', 'Tunesien', 'Türkei', 'Uganda', 'Ukraine', 'Ungarn', 'Uruguay', 'USA', 'Usbekistan', 'Venezuela', 'Vereinigte Arabische Emirate', 'Vietnam', 'Wales', 'Weißrussland', 'Zypern'];
const HEIGHTS = Array.from({ length: 101 }, (_, i) => 120 + i);
const COUNTRY_CODES = [
  { code: '+49', country: 'Deutschland' }, { code: '+43', country: 'Österreich' }, { code: '+41', country: 'Schweiz' },
  { code: '+33', country: 'Frankreich' }, { code: '+31', country: 'Niederlande' }, { code: '+32', country: 'Belgien' },
  { code: '+39', country: 'Italien' }, { code: '+34', country: 'Spanien' }, { code: '+44', country: 'England' },
  { code: '+48', country: 'Polen' }, { code: '+420', country: 'Tschechien' }, { code: '+45', country: 'Dänemark' },
  { code: '+46', country: 'Schweden' }, { code: '+47', country: 'Norwegen' }, { code: '+90', country: 'Türkei' },
  { code: '+385', country: 'Kroatien' }, { code: '+381', country: 'Serbien' }, { code: '+30', country: 'Griechenland' },
  { code: '+351', country: 'Portugal' }, { code: '+1', country: 'USA/Kanada' },
];

const InstagramIcon = require('../../../assets/instagram.png.webp');
const LinkedInIcon = require('../../../assets/linkedin.png');
const TikTokIcon = require('../../../assets/tiktok.png');
const TransfermarktIcon = require('../../../assets/transfermarkt-logo.png');
const ArbeitsamtIcon = require('../../../assets/arbeitsamt.png');

interface Player {
  id: string; first_name: string; last_name: string; nationality: string; birth_date: string; club: string; league: string; position: string; contract_end: string; photo_url: string; strong_foot: string; height: number; secondary_position: string; salary_month: string; point_bonus: string; appearance_bonus: string; contract_option: string; contract_scope: string; fixed_fee: string; contract_notes: string; u23_player: boolean; provision: string; transfer_commission: string; mandate_until: string; responsibility: string; listing: string; phone: string; phone_country_code: string; email: string; education: string; training: string; instagram: string; linkedin: string; tiktok: string; transfermarkt_url: string; interests: string; father_name: string; father_phone: string; father_phone_country_code: string; father_job: string; mother_name: string; mother_phone: string; mother_phone_country_code: string; mother_job: string; siblings: string; other_notes: string; injuries: string; street: string; postal_code: string; city: string; internat: boolean; future_club: string; future_contract_end: string; contract_documents: any[]; provision_documents: any[]; transfer_commission_documents: any[]; strengths: string; potentials: string;
}

interface ClubLogo {
  club_name: string;
  logo_url: string;
}

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
}

export function PlayerDetailScreen({ route, navigation }: any) {
  const { playerId } = route.params;
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Player | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedSecondaryPositions, setSelectedSecondaryPositions] = useState<string[]>([]);
  const [selectedNationalities, setSelectedNationalities] = useState<string[]>([]);
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [showNationalityPicker, setShowNationalityPicker] = useState(false);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [allClubs, setAllClubs] = useState<string[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSpielplanModal, setShowSpielplanModal] = useState(false);
  
  // Berechtigung zum Löschen
  const [canDelete, setCanDelete] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Club autocomplete state
  const [clubSearch, setClubSearch] = useState('');
  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [futureClubSearch, setFutureClubSearch] = useState('');
  const [showFutureClubSuggestions, setShowFutureClubSuggestions] = useState(false);

  // Generate Spielplan URL based on club and league
  const generateSpielplanUrl = (club: string, league: string): string => {
    if (!club) return '';
    
    // Extract team level from league (e.g., "U17 Bundesliga" -> "U17")
    const teamMatch = league?.match(/U\d+/i);
    const team = teamMatch ? teamMatch[0] : '';
    
    // Create search query for fussball.de
    const searchQuery = encodeURIComponent(`${club} ${team} Spielplan fussball.de`.trim());
    return `https://www.google.com/search?q=${searchQuery}&btnI=1`;
  };

  const openSpielplan = () => {
    if (!player?.club) {
      Alert.alert('Fehler', 'Kein Verein eingetragen');
      return;
    }
    const url = generateSpielplanUrl(player.club, player.league);
    Linking.openURL(url);
  };

  useEffect(() => { 
    fetchPlayer(); 
    fetchClubLogos(); 
    fetchAdvisors(); 
    checkDeletePermission();
  }, []);
  
  useEffect(() => {
    if (player) {
      setSelectedPositions(player.position ? player.position.split(', ').filter(p => POSITIONS.includes(p)) : []);
      setSelectedSecondaryPositions(player.secondary_position ? player.secondary_position.split(', ').filter(p => POSITIONS.includes(p)) : []);
      setSelectedNationalities(player.nationality ? player.nationality.split(', ').filter(n => COUNTRIES.includes(n)) : []);
      const playerResp = player.responsibility ? player.responsibility.split(', ') : [];
      setSelectedResponsibilities(playerResp);
      setClubSearch(player.club || '');
      setFutureClubSearch(player.future_club || '');
      checkAndApplyFutureClub(player);
    }
  }, [player]);

  // Prüfen ob User löschen darf (Admin oder Zuständiger)
  const checkDeletePermission = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setCurrentUserId(user.id);
    
    // Prüfen ob Admin
    const { data: advisorData } = await supabase
      .from('advisors')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (advisorData?.role === 'admin') {
      setIsAdmin(true);
      setCanDelete(true);
      return;
    }
    
    // Prüfen ob Zuständiger (owner in player_access)
    const { data: accessData } = await supabase
      .from('player_access')
      .select('access_type')
      .eq('player_id', playerId)
      .eq('advisor_id', user.id)
      .eq('access_type', 'owner')
      .single();
    
    if (accessData) {
      setCanDelete(true);
    }
  };

  const fetchAdvisors = async () => {
    const { data } = await supabase.from('advisors').select('id, first_name, last_name').order('last_name');
    if (data) setAdvisors(data);
  };

  const checkAndApplyFutureClub = async (p: Player) => {
    if (!p.future_club || !p.contract_end) return;
    const today = new Date();
    const contractEnd = new Date(p.contract_end);
    if (today > contractEnd) {
      const updateData: any = {
        club: p.future_club,
        future_club: null,
        contract_end: p.future_contract_end || null,
        future_contract_end: null,
      };
      await supabase.from('player_details').update(updateData).eq('id', p.id);
      fetchPlayer();
    }
  };

  const fetchClubLogos = async () => {
    const { data, error } = await supabase.from('club_logos').select('club_name, logo_url');
    if (!error && data) {
      const logoMap: Record<string, string> = {};
      const clubs: string[] = [];
      data.forEach((item: ClubLogo) => {
        logoMap[item.club_name] = item.logo_url;
        clubs.push(item.club_name);
        const simplified = item.club_name.replace(' II', '').replace(' U23', '').replace(' U21', '').replace(' U19', '');
        if (simplified !== item.club_name) logoMap[simplified] = item.logo_url;
      });
      setClubLogos(logoMap);
      setAllClubs(clubs.sort());
    }
  };

  const getClubLogo = (clubName: string): string | null => {
    if (!clubName) return null;
    if (clubLogos[clubName]) return clubLogos[clubName];
    const variations = [clubName, clubName.replace('FC ', '').replace(' FC', ''), clubName.replace('1. ', ''), clubName.replace('SV ', '').replace(' SV', ''), clubName.replace('VfB ', '').replace(' VfB', ''), clubName.replace('VfL ', '').replace(' VfL', ''), clubName.replace('TSG ', '').replace(' TSG', ''), clubName.replace('SC ', '').replace(' SC', '')];
    for (const variation of variations) { if (clubLogos[variation]) return clubLogos[variation]; }
    for (const [logoClub, logoUrl] of Object.entries(clubLogos)) {
      if (clubName.toLowerCase().includes(logoClub.toLowerCase()) || logoClub.toLowerCase().includes(clubName.toLowerCase())) return logoUrl;
    }
    return null;
  };

  const getFilteredClubs = (search: string): string[] => {
    if (!search || search.length < 2) return [];
    const searchLower = search.toLowerCase();
    return allClubs.filter(club => club.toLowerCase().includes(searchLower)).slice(0, 10);
  };

  const fetchPlayer = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('player_details').select('*').eq('id', playerId).single();
    if (error) { Alert.alert('Fehler', 'Spieler konnte nicht geladen werden'); }
    else { setPlayer(data); setEditData(data); }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  const convertToInputDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '-';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age.toString();
  };

  const isBirthday = (birthDate: string): boolean => {
    if (!birthDate) return false;
    const today = new Date();
    const birth = new Date(birthDate);
    return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate();
  };

  const isContractExpired = (contractEnd: string): boolean => {
    if (!contractEnd) return false;
    const today = new Date();
    const endDate = new Date(contractEnd);
    return today > endDate;
  };

  const isYouthPlayer = (birthDate: string): boolean => {
    if (!birthDate) return false;
    const age = parseInt(calculateAge(birthDate));
    return age <= 19;
  };

  const hasFutureClubAndExpiringContract = (p: Player | null): boolean => {
    if (!p || !p.future_club || !p.contract_end) return false;
    return isContractInCurrentSeason(p.contract_end);
  };

  const calculateU23Status = (birthDate: string): { isU23: boolean; seasonsText: string } => {
    if (!birthDate) return { isU23: false, seasonsText: '' };
    const birth = new Date(birthDate);
    const birthYear = birth.getFullYear();
    const birthMonth = birth.getMonth();
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    let currentSeasonStartYear = todayMonth >= 6 ? todayYear : todayYear - 1;
    
    const getAgeOnJune30 = (year: number): number => {
      let age = year - birthYear;
      if (birthMonth > 5) age--;
      return age;
    };
    
    const ageOnJune30BeforeCurrentSeason = getAgeOnJune30(currentSeasonStartYear);
    if (ageOnJune30BeforeCurrentSeason > 22) return { isU23: false, seasonsText: '' };
    
    let seasonsLeft = 0;
    for (let i = 0; i < 15; i++) {
      const checkYear = currentSeasonStartYear + i;
      const ageOnDate = getAgeOnJune30(checkYear);
      if (ageOnDate <= 22) seasonsLeft++; else break;
    }
    
    let seasonsText = seasonsLeft === 1 ? 'nur noch diese Saison' : seasonsLeft === 2 ? 'noch eine weitere Saison' : `noch ${seasonsLeft - 1} weitere Saisons`;
    return { isU23: true, seasonsText };
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

  const uploadDocument = async (field: 'contract_documents' | 'provision_documents' | 'transfer_commission_documents') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled) return;
      
      const file = result.assets[0];
      const fileName = `${playerId}/${field}/${Date.now()}_${file.name}`;
      
      const response = await fetch(file.uri);
      const blob = await response.blob();
      
      const { error: uploadError } = await supabase.storage.from('contracts').upload(fileName, blob);
      if (uploadError) { Alert.alert('Fehler', uploadError.message); return; }
      
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(fileName);
      const currentDocs = editData?.[field] || [];
      const newDocs = [...currentDocs, { name: file.name, url: urlData.publicUrl, path: fileName }];
      updateField(field, newDocs);
      Alert.alert('Erfolg', 'Dokument hochgeladen');
    } catch (error) { Alert.alert('Fehler', 'Dokument konnte nicht hochgeladen werden'); }
  };

  const openDocument = (url: string) => { Linking.openURL(url); };

  const deleteDocumentFromField = async (path: string, field: 'contract_documents' | 'provision_documents' | 'transfer_commission_documents') => {
    const { error } = await supabase.storage.from('contracts').remove([path]);
    if (!error) {
      const newDocs = (editData?.[field] || []).filter((doc: any) => doc.path !== path);
      updateField(field, newDocs);
    }
  };

  const togglePosition = (pos: string) => { const newPositions = selectedPositions.includes(pos) ? selectedPositions.filter(p => p !== pos) : [...selectedPositions, pos]; setSelectedPositions(newPositions); updateField('position', newPositions.join(', ')); };
  const toggleSecondaryPosition = (pos: string) => { const newPositions = selectedSecondaryPositions.includes(pos) ? selectedSecondaryPositions.filter(p => p !== pos) : [...selectedSecondaryPositions, pos]; setSelectedSecondaryPositions(newPositions); updateField('secondary_position', newPositions.join(', ')); };
  const toggleNationality = (country: string) => { const newNationalities = selectedNationalities.includes(country) ? selectedNationalities.filter(c => c !== country) : [...selectedNationalities, country]; setSelectedNationalities(newNationalities); updateField('nationality', newNationalities.join(', ')); };
  const toggleResponsibility = (name: string) => { 
    const newResponsibilities = selectedResponsibilities.includes(name) 
      ? selectedResponsibilities.filter(p => p !== name) 
      : [...selectedResponsibilities, name]; 
    setSelectedResponsibilities(newResponsibilities); 
    updateField('responsibility', newResponsibilities.join(', ')); 
  };
  const updateField = (field: string, value: any) => { if (editData) setEditData({ ...editData, [field]: value }); };

  const handleSave = async () => {
    if (!editData) return;
    const u23Status = calculateU23Status(editData.birth_date);
    const updateData: any = {
      first_name: editData.first_name, last_name: editData.last_name, nationality: selectedNationalities.join(', ') || null, birth_date: editData.birth_date || null, club: editData.club || null, league: editData.league || null, position: selectedPositions.join(', ') || null, contract_end: editData.contract_end || null, photo_url: editData.photo_url || null, strong_foot: editData.strong_foot || null, height: editData.height || null, secondary_position: selectedSecondaryPositions.join(', ') || null, salary_month: editData.salary_month || null, point_bonus: editData.point_bonus || null, appearance_bonus: editData.appearance_bonus || null, contract_option: editData.contract_option || null, contract_scope: editData.contract_scope || null, fixed_fee: editData.fixed_fee || null, contract_notes: editData.contract_notes || null, u23_player: u23Status.isU23, provision: editData.provision || null, transfer_commission: editData.transfer_commission || null, mandate_until: editData.mandate_until || null, responsibility: selectedResponsibilities.join(', ') || null, listing: editData.listing || null, phone: editData.phone || null, phone_country_code: editData.phone_country_code || '+49', email: editData.email || null, education: editData.education || null, training: editData.training || null, instagram: editData.instagram || null, linkedin: editData.linkedin || null, tiktok: editData.tiktok || null, transfermarkt_url: editData.transfermarkt_url || null, interests: editData.interests || null, father_name: editData.father_name || null, father_phone: editData.father_phone || null, father_phone_country_code: editData.father_phone_country_code || '+49', father_job: editData.father_job || null, mother_name: editData.mother_name || null, mother_phone: editData.mother_phone || null, mother_phone_country_code: editData.mother_phone_country_code || '+49', mother_job: editData.mother_job || null, siblings: editData.siblings || null, other_notes: editData.other_notes || null, injuries: editData.injuries || null, street: editData.street || null, postal_code: editData.postal_code || null, city: editData.city || null, internat: editData.internat || false, future_club: editData.future_club || null, future_contract_end: editData.future_contract_end || null, contract_documents: editData.contract_documents || [], provision_documents: editData.provision_documents || [], transfer_commission_documents: editData.transfer_commission_documents || [], strengths: editData.strengths || null, potentials: editData.potentials || null,
    };
    const { error } = await supabase.from('player_details').update(updateData).eq('id', playerId);
    if (error) Alert.alert('Fehler', error.message);
    else { Alert.alert('Erfolg', 'Spieler wurde gespeichert'); setEditing(false); fetchPlayer(); }
  };

  const confirmDelete = async () => {
    try {
      // Erst player_access löschen
      const { error: accessError } = await supabase
        .from('player_access')
        .delete()
        .eq('player_id', playerId);
      
      if (accessError) {
        console.log('player_access Fehler:', accessError);
      }
      
      // Dann player_details löschen
      const { error, data } = await supabase
        .from('player_details')
        .delete()
        .eq('id', playerId)
        .select();
      
      console.log('Delete Ergebnis:', { error, data, playerId });
      
      if (error) { 
        Alert.alert('Fehler beim Löschen', `${error.message}\n\nCode: ${error.code}\nDetails: ${error.details || 'keine'}`); 
        setShowDeleteModal(false); 
      } else { 
        setShowDeleteModal(false); 
        // Zurück zur Spielerübersicht navigieren
        navigation.navigate('PlayerOverview');
      }
    } catch (err: any) { 
      console.log('Catch Fehler:', err);
      Alert.alert('Fehler', `Spieler konnte nicht gelöscht werden: ${err?.message || err}`); 
      setShowDeleteModal(false); 
    }
  };

  const renderField = (label: string, field: keyof Player, placeholder?: string) => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      {editing ? <TextInput style={styles.input} value={editData?.[field]?.toString() || ''} onChangeText={(text) => updateField(field, text)} placeholder={placeholder || label} /> : <Text style={styles.value}>{player?.[field]?.toString() || '-'}</Text>}
    </View>
  );

  const renderSpielplanButton = () => {
    if (!player?.club || editing) return null;
    
    // Extract team info from league
    const teamMatch = player.league?.match(/U\d+/i);
    const teamInfo = teamMatch ? teamMatch[0] : '';
    
    return (
      <View style={styles.infoRow}>
        <Text style={styles.label}>Spielplan</Text>
        <TouchableOpacity 
          style={styles.spielplanButton} 
          onPress={openSpielplan}
        >
          <Text style={styles.spielplanButtonText}>
            📅 {player.club} {teamInfo} Spielplan öffnen
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderClubField = () => {
    const filteredClubs = getFilteredClubs(clubSearch);
    const logoUrl = getClubLogo(clubSearch);
    const contractExpired = isContractExpired(player?.contract_end || '');
    const displayClub = contractExpired ? 'Vereinslos' : player?.club;
    
    return (
      <View style={[styles.infoRow, { zIndex: 200 }]}>
        <Text style={styles.label}>Verein</Text>
        {editing ? (
          <View style={styles.autocompleteContainer}>
            <View style={styles.clubInputRow}>
              {logoUrl && <Image source={{ uri: logoUrl }} style={styles.clubLogoInput} />}
              <TextInput 
                style={[styles.input, styles.clubInput]} 
                value={clubSearch} 
                onChangeText={(text) => { 
                  setClubSearch(text); 
                  updateField('club', text); 
                  setShowClubSuggestions(true);
                  setShowFutureClubSuggestions(false);
                }} 
                onFocus={() => { setShowClubSuggestions(true); setShowFutureClubSuggestions(false); }}
                onBlur={() => setTimeout(() => setShowClubSuggestions(false), 200)}
                placeholder="Verein eingeben..." 
              />
            </View>
            {showClubSuggestions && filteredClubs.length > 0 && (
              <View style={styles.suggestionsList}>
                <ScrollView style={styles.suggestionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredClubs.map((club) => (
                    <TouchableOpacity 
                      key={club} 
                      style={styles.suggestionItem}
                      onPress={() => { 
                        setClubSearch(club); 
                        updateField('club', club); 
                        setShowClubSuggestions(false); 
                      }}
                    >
                      <Text style={styles.suggestionText}>{club}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.clubRowSmall}>
            {contractExpired ? (
              <Image source={ArbeitsamtIcon} style={styles.clubLogoSmall} />
            ) : getClubLogo(player?.club || '') ? (
              <Image source={{ uri: getClubLogo(player?.club || '')! }} style={styles.clubLogoSmall} />
            ) : null}
            <Text style={[styles.value, contractExpired && styles.clubTextRed]}>{displayClub || '-'}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFutureClubField = () => {
    const showField = editing || player?.future_club;
    if (!showField) return null;
    
    const filteredClubs = getFilteredClubs(futureClubSearch);
    const logoUrl = getClubLogo(futureClubSearch || player?.future_club || '');
    
    return (
      <View style={[styles.infoRow, { zIndex: 100 }]}>
        <Text style={styles.label}>Zukünftiger Verein</Text>
        {editing ? (
          <View style={styles.autocompleteContainer}>
            <View style={styles.clubInputRow}>
              {logoUrl && <Image source={{ uri: logoUrl }} style={styles.clubLogoInput} />}
              <TextInput 
                style={[styles.input, styles.clubInput]} 
                value={futureClubSearch} 
                onChangeText={(text) => { 
                  setFutureClubSearch(text); 
                  updateField('future_club', text); 
                  setShowFutureClubSuggestions(true);
                  setShowClubSuggestions(false);
                }}
                onFocus={() => { setShowFutureClubSuggestions(true); setShowClubSuggestions(false); }}
                onBlur={() => setTimeout(() => setShowFutureClubSuggestions(false), 200)}
                placeholder="Zukünftiger Verein eingeben..." 
              />
            </View>
            {showFutureClubSuggestions && filteredClubs.length > 0 && (
              <View style={styles.suggestionsList}>
                <ScrollView style={styles.suggestionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredClubs.map((club) => (
                    <TouchableOpacity 
                      key={club} 
                      style={styles.suggestionItem}
                      onPress={() => { 
                        setFutureClubSearch(club); 
                        updateField('future_club', club); 
                        setShowFutureClubSuggestions(false); 
                      }}
                    >
                      <Text style={styles.suggestionText}>{club}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {(futureClubSearch || editData?.future_club) && (
              <View style={styles.futureContractRow}>
                <Text style={styles.smallLabel}>Zukünftiges Vertragsende:</Text>
                <input type="date" style={{ padding: 8, fontSize: 14, borderRadius: 8, border: '1px solid #ddd', flex: 1, boxSizing: 'border-box' as const }} value={convertToInputDate(editData?.future_contract_end || '')} onChange={(e) => updateField('future_contract_end', e.target.value)} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.clubRowSmall}>
            {logoUrl && <Image source={{ uri: logoUrl }} style={styles.clubLogoSmall} />}
            <Text style={styles.value}>{player?.future_club || '-'}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFieldWithDocuments = (label: string, field: keyof Player, docField: 'provision_documents' | 'transfer_commission_documents') => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      {editing ? (
        <View>
          <TextInput style={styles.input} value={editData?.[field]?.toString() || ''} onChangeText={(text) => updateField(field, text)} placeholder={label} />
          <TouchableOpacity style={styles.smallUploadButton} onPress={() => uploadDocument(docField)}>
            <Text style={styles.smallUploadButtonText}>+ PDF</Text>
          </TouchableOpacity>
          {(editData?.[docField] || []).map((doc: any, index: number) => (
            <View key={index} style={styles.smallDocItem}>
              <TouchableOpacity onPress={() => openDocument(doc.url)} style={styles.documentLink}>
                <Text style={styles.smallDocName}>📄 {doc.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteDocumentFromField(doc.path, docField)} style={styles.documentDelete}>
                <Text style={styles.documentDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <View>
          <Text style={styles.value}>{player?.[field]?.toString() || '-'}</Text>
          {(player?.[docField] || []).map((doc: any, index: number) => (
            <TouchableOpacity key={index} onPress={() => openDocument(doc.url)}>
              <Text style={styles.docLink}>📄 {doc.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderPhoneField = (label: string, phoneField: keyof Player, codeField: keyof Player) => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      {editing ? (
        <View style={styles.phoneContainer}>
          <View style={styles.phoneCodePicker}>
            <select style={{ padding: 10, fontSize: 14, borderRadius: 8, border: '1px solid #ddd', width: '100%' }} value={editData?.[codeField]?.toString() || '+49'} onChange={(e) => updateField(codeField, e.target.value)}>
              {COUNTRY_CODES.map((c) => (<option key={c.code} value={c.code}>{c.code} ({c.country})</option>))}
            </select>
          </View>
          <TextInput style={[styles.input, styles.phoneInput]} value={editData?.[phoneField]?.toString() || ''} onChangeText={(text) => updateField(phoneField, text)} placeholder="Telefonnummer" keyboardType="phone-pad" />
        </View>
      ) : (<Text style={styles.value}>{player?.[phoneField] ? `${player?.[codeField] || '+49'} ${player?.[phoneField]}` : '-'}</Text>)}
    </View>
  );

  const renderDateField = (label: string, field: keyof Player) => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      {editing ? <input type="date" style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' as const }} value={convertToInputDate(editData?.[field] as string || '')} onChange={(e) => updateField(field, e.target.value)} /> : <Text style={styles.value}>{player?.[field] ? formatDate(player[field] as string) : '-'}</Text>}
    </View>
  );

  const renderBirthDateField = () => {
    const birthday = isBirthday(player?.birth_date || '');
    return (
      <View style={styles.infoRow}>
        <Text style={styles.label}>Geburtsdatum</Text>
        {editing ? (
          <input type="date" style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' as const }} value={convertToInputDate(editData?.birth_date || '')} onChange={(e) => updateField('birth_date', e.target.value)} />
        ) : (
          <View style={styles.birthdayRow}>
            <Text style={styles.value}>{player?.birth_date ? formatDate(player.birth_date) : '-'}</Text>
            {birthday && <Text style={styles.birthdayIcon}>🎉</Text>}
          </View>
        )}
      </View>
    );
  };

  const renderContractEndField = () => {
    const inCurrentSeason = isContractInCurrentSeason(player?.contract_end || '');
    const hasSecuredFuture = hasFutureClubAndExpiringContract(player);
    return (
      <View style={styles.infoRow}>
        <Text style={styles.label}>Vertragsende</Text>
        {editing ? (<input type="date" style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' as const }} value={convertToInputDate(editData?.contract_end || '')} onChange={(e) => updateField('contract_end', e.target.value)} />
        ) : player?.contract_end ? (<View style={[styles.statusBadge, hasSecuredFuture ? styles.statusBadgeGreen : (inCurrentSeason ? styles.statusBadgeRed : styles.statusBadgeNormal)]}><Text style={[styles.statusBadgeText, hasSecuredFuture ? styles.statusTextGreen : (inCurrentSeason ? styles.statusTextRed : styles.statusTextNormal)]}>{formatDate(player.contract_end)}</Text></View>) : <Text style={styles.value}>-</Text>}
      </View>
    );
  };

  const renderAddressField = () => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>Adresse</Text>
      {editing ? (
        <View style={styles.addressRow}>
          <TextInput style={[styles.input, styles.addressStreet]} value={editData?.street || ''} onChangeText={(text) => updateField('street', text)} placeholder="Straße" />
          <TextInput style={[styles.input, styles.addressPLZ]} value={editData?.postal_code || ''} onChangeText={(text) => updateField('postal_code', text)} placeholder="PLZ" />
          <TextInput style={[styles.input, styles.addressCity]} value={editData?.city || ''} onChangeText={(text) => updateField('city', text)} placeholder="Wohnort" />
        </View>
      ) : (
        <Text style={styles.value}>
          {player?.street || player?.postal_code || player?.city 
            ? `${player?.street || ''}${player?.street && (player?.postal_code || player?.city) ? ', ' : ''}${player?.postal_code || ''} ${player?.city || ''}`.trim() 
            : '-'}
        </Text>
      )}
    </View>
  );

  const renderPositionSelector = (label: string, selected: string[], toggle: (pos: string) => void) => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      {editing ? (<View style={styles.chipGrid}>{POSITIONS.map((pos) => (<TouchableOpacity key={pos} style={[styles.chip, selected.includes(pos) && styles.chipSelected]} onPress={() => toggle(pos)}><Text style={[styles.chipText, selected.includes(pos) && styles.chipTextSelected]}>{selected.includes(pos) ? '✓ ' : ''}{pos}</Text></TouchableOpacity>))}</View>) : <Text style={styles.value}>{selected.length > 0 ? selected.join(', ') : '-'}</Text>}
    </View>
  );

  const renderResponsibilitySelector = () => {
    const advisorNames = advisors.map(a => `${a.first_name} ${a.last_name}`.trim());
    return (
      <View style={styles.infoRow}>
        <Text style={styles.label}>Zuständigkeit</Text>
        {editing ? (
          <View style={styles.chipGrid}>
            {advisorNames.map((name) => (
              <TouchableOpacity 
                key={name} 
                style={[styles.chip, selectedResponsibilities.includes(name) && styles.chipSelected]} 
                onPress={() => toggleResponsibility(name)}
              >
                <Text style={[styles.chipText, selectedResponsibilities.includes(name) && styles.chipTextSelected]}>
                  {selectedResponsibilities.includes(name) ? '✓ ' : ''}{name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.value}>{selectedResponsibilities.length > 0 ? selectedResponsibilities.join(', ') : '-'}</Text>
        )}
      </View>
    );
  };

  const renderNationalitySelector = () => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>Nationalität</Text>
      {editing ? (<View><TouchableOpacity style={styles.dropdownButton} onPress={() => setShowNationalityPicker(!showNationalityPicker)}><Text style={styles.dropdownButtonText}>{selectedNationalities.length > 0 ? selectedNationalities.join(', ') : 'Nationalität wählen...'}</Text><Text>{showNationalityPicker ? '▲' : '▼'}</Text></TouchableOpacity>{showNationalityPicker && (<View style={styles.pickerList}><ScrollView style={styles.pickerScroll} nestedScrollEnabled>{COUNTRIES.map((country) => (<TouchableOpacity key={country} style={[styles.pickerItem, selectedNationalities.includes(country) && styles.pickerItemSelected]} onPress={() => toggleNationality(country)}><Text style={[styles.pickerItemText, selectedNationalities.includes(country) && styles.pickerItemTextSelected]}>{selectedNationalities.includes(country) ? '✓ ' : ''}{country}</Text></TouchableOpacity>))}</ScrollView></View>)}</View>) : <Text style={styles.value}>{selectedNationalities.length > 0 ? selectedNationalities.join(', ') : '-'}</Text>}
    </View>
  );

  const renderStrongFootSelector = () => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>Starker Fuß</Text>
      {editing ? (<View style={styles.footSelector}>{['Links', 'Rechts', 'Beidfüßig'].map((foot) => (<TouchableOpacity key={foot} style={[styles.footOption, editData?.strong_foot === foot && styles.footOptionSelected]} onPress={() => updateField('strong_foot', foot)}><Text style={[styles.footOptionText, editData?.strong_foot === foot && styles.footOptionTextSelected]}>{foot}</Text></TouchableOpacity>))}</View>) : <Text style={styles.value}>{player?.strong_foot || '-'}</Text>}
    </View>
  );

  const renderHeightSelector = () => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>Größe</Text>
      {editing ? (<View><TouchableOpacity style={styles.dropdownButton} onPress={() => setShowHeightPicker(!showHeightPicker)}><Text style={styles.dropdownButtonText}>{editData?.height ? `${editData.height} cm` : 'Größe wählen...'}</Text><Text>{showHeightPicker ? '▲' : '▼'}</Text></TouchableOpacity>{showHeightPicker && (<View style={styles.pickerList}><ScrollView style={styles.pickerScroll} nestedScrollEnabled>{HEIGHTS.map((h) => (<TouchableOpacity key={h} style={[styles.pickerItem, editData?.height === h && styles.pickerItemSelected]} onPress={() => { updateField('height', h); setShowHeightPicker(false); }}><Text style={[styles.pickerItemText, editData?.height === h && styles.pickerItemTextSelected]}>{h} cm</Text></TouchableOpacity>))}</ScrollView></View>)}</View>) : <Text style={styles.value}>{player?.height ? `${player.height} cm` : '-'}</Text>}
    </View>
  );

  const renderU23Status = () => {
    const u23Status = calculateU23Status(player?.birth_date || '');
    return (<View style={styles.infoRow}><Text style={styles.label}>U23-Spieler</Text><View style={[styles.statusBadge, u23Status.isU23 ? styles.statusBadgeGreen : styles.statusBadgeRed]}><Text style={[styles.statusBadgeText, u23Status.isU23 ? styles.statusTextGreen : styles.statusTextRed]}>{u23Status.isU23 ? `Ja (${u23Status.seasonsText})` : 'Nein'}</Text></View></View>);
  };

  const renderInternatField = () => {
    if (!isYouthPlayer(player?.birth_date || '')) return null;
    return (
      <View style={styles.infoRow}>
        <Text style={styles.label}>Internat</Text>
        {editing ? (
          <View style={styles.footSelector}>
            {['Ja', 'Nein'].map((opt) => (
              <TouchableOpacity key={opt} style={[styles.footOption, (editData?.internat ? 'Ja' : 'Nein') === opt && styles.footOptionSelected]} onPress={() => updateField('internat', opt === 'Ja')}>
                <Text style={[styles.footOptionText, (editData?.internat ? 'Ja' : 'Nein') === opt && styles.footOptionTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : <Text style={styles.value}>{player?.internat ? 'Ja' : 'Nein'}</Text>}
      </View>
    );
  };

  const renderSocialLinks = () => {
    const hasAnySocial = player?.instagram || player?.linkedin || player?.tiktok;
    if (!hasAnySocial && !editing) return null;
    return (
      <View style={styles.infoRow}>
        <Text style={styles.label}>Social Media</Text>
        {editing ? (<View><View style={styles.socialInputRow}><Image source={InstagramIcon} style={styles.socialIconSmall} /><TextInput style={[styles.input, styles.socialInput]} value={editData?.instagram || ''} onChangeText={(text) => updateField('instagram', text)} placeholder="Instagram @username" /></View><View style={styles.socialInputRow}><Image source={LinkedInIcon} style={styles.socialIconSmall} /><TextInput style={[styles.input, styles.socialInput]} value={editData?.linkedin || ''} onChangeText={(text) => updateField('linkedin', text)} placeholder="LinkedIn URL" /></View><View style={styles.socialInputRow}><Image source={TikTokIcon} style={styles.socialIconSmall} /><TextInput style={[styles.input, styles.socialInput]} value={editData?.tiktok || ''} onChangeText={(text) => updateField('tiktok', text)} placeholder="TikTok @username" /></View></View>
        ) : (<View style={styles.socialIconsRow}>{player?.instagram && <TouchableOpacity onPress={() => Linking.openURL(player.instagram.startsWith('http') ? player.instagram : `https://instagram.com/${player.instagram.replace('@', '')}`)}><Image source={InstagramIcon} style={styles.socialIcon} /></TouchableOpacity>}{player?.linkedin && <TouchableOpacity onPress={() => Linking.openURL(player.linkedin.startsWith('http') ? player.linkedin : `https://linkedin.com/in/${player.linkedin}`)}><Image source={LinkedInIcon} style={styles.socialIcon} /></TouchableOpacity>}{player?.tiktok && <TouchableOpacity onPress={() => Linking.openURL(player.tiktok.startsWith('http') ? player.tiktok : `https://tiktok.com/@${player.tiktok.replace('@', '')}`)}><Image source={TikTokIcon} style={styles.socialIcon} /></TouchableOpacity>}</View>)}
      </View>
    );
  };

  const renderDocuments = () => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>Vertragsunterlagen</Text>
      {editing && (<TouchableOpacity style={styles.uploadButton} onPress={() => uploadDocument('contract_documents')}><Text style={styles.uploadButtonText}>+ PDF hochladen</Text></TouchableOpacity>)}
      <View style={styles.documentList}>
        {(player?.contract_documents || []).map((doc: any, index: number) => (
          <View key={index} style={styles.documentItem}>
            <TouchableOpacity onPress={() => openDocument(doc.url)} style={styles.documentLink}>
              <Text style={styles.documentIcon}>📄</Text>
              <Text style={styles.documentName}>{doc.name}</Text>
            </TouchableOpacity>
            {editing && (<TouchableOpacity onPress={() => deleteDocumentFromField(doc.path, 'contract_documents')} style={styles.documentDelete}><Text style={styles.documentDeleteText}>✕</Text></TouchableOpacity>)}
          </View>
        ))}
      </View>
    </View>
  );

  const renderDeleteModal = () => (
    <Modal visible={showDeleteModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Spieler löschen</Text>
          <Text style={styles.modalText}>Möchten Sie {player?.first_name} {player?.last_name} wirklich löschen?</Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowDeleteModal(false)}>
              <Text style={styles.modalCancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalDeleteButton} onPress={confirmDelete}>
              <Text style={styles.modalDeleteButtonText}>Löschen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) return <SafeAreaView style={styles.container}><Text style={styles.loadingText}>Laden...</Text></SafeAreaView>;
  if (!player || !editData) return <SafeAreaView style={styles.container}><Text style={styles.loadingText}>Spieler nicht gefunden</Text></SafeAreaView>;

  const contractExpired = isContractExpired(player.contract_end);
  const displayClub = contractExpired ? 'Vereinslos' : player.club;
  const birthday = isBirthday(player.birth_date);
  const futureClubLogo = getClubLogo(player.future_club || '');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Spielerinfo</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}><Text style={styles.closeButtonText}>✕</Text></TouchableOpacity>
      </View>
      <ScrollView style={styles.content}>
        {/* Top Section - 2 getrennte Karten */}
        <View style={styles.topSectionContainer}>
          {/* Linke Karte: Foto + Name */}
          <View style={styles.topCardLeft}>
            <View style={styles.topLeft}>
              <View style={styles.photoContainer}>
                {player.photo_url ? <Image source={{ uri: player.photo_url }} style={styles.photo} /> : <View style={styles.photoPlaceholder}><Text style={styles.photoPlaceholderText}>Foto</Text></View>}
              </View>
              {editing && <TextInput style={styles.photoInput} placeholder="Foto-URL" value={editData.photo_url || ''} onChangeText={(text) => updateField('photo_url', text)} />}
            </View>
            
            <View style={styles.topCenter}>
              {editing ? (
                <>
                  <TextInput style={styles.nameInput} value={editData.first_name} onChangeText={(text) => updateField('first_name', text)} placeholder="Vorname" />
                  <TextInput style={styles.nameInput} value={editData.last_name} onChangeText={(text) => updateField('last_name', text)} placeholder="Nachname" />
                </>
              ) : (
                <>
                  <Text style={styles.playerFirstName}>{player.first_name}</Text>
                  <Text style={styles.playerLastName}>{player.last_name}</Text>
                  <View style={styles.ageRow}>
                    <Text style={styles.ageText}>{calculateAge(player.birth_date)} Jahre</Text>
                    {birthday && <Text style={styles.birthdayIconLarge}>🎉</Text>}
                  </View>
                </>
              )}
            </View>
          </View>
          
          {/* Rechte Karte: Vereinslogo */}
          <View style={styles.topCardRight}>
            <View style={styles.clubSection}>
              {contractExpired ? (
                <Image source={ArbeitsamtIcon} style={styles.clubLogoHeader} />
              ) : getClubLogo(player.club) ? (
                <Image source={{ uri: getClubLogo(player.club)! }} style={styles.clubLogoHeader} />
              ) : (
                <Text style={styles.clubNameHeaderNoLogo}>{displayClub || '-'}</Text>
              )}
              {/* Zukünftiger Verein mit grünem Pfeil */}
              {player.future_club && !editing && (
                <View style={styles.futureClubHeader}>
                  <Text style={styles.greenArrow}>→</Text>
                  {futureClubLogo ? (
                    <Image source={{ uri: futureClubLogo }} style={styles.futureClubLogoHeader} />
                  ) : (
                    <Text style={styles.futureClubNameHeader}>{player.future_club}</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.twoColumnContainer}>
          <View style={styles.halfColumn}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Allgemein</Text>
              <View style={styles.splitContainer}>
                <View style={styles.splitColumn}>
                  {renderPositionSelector('Position', selectedPositions, togglePosition)}
                  {renderPositionSelector('Nebenposition', selectedSecondaryPositions, toggleSecondaryPosition)}
                  {renderNationalitySelector()}
                  {renderStrongFootSelector()}
                  {renderHeightSelector()}
                  {/* Transfermarkt Link */}
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Transfermarkt</Text>
                    {editing ? (
                      <TextInput 
                        style={styles.input} 
                        value={editData?.transfermarkt_url || ''} 
                        onChangeText={(text) => updateField('transfermarkt_url', text)} 
                        placeholder="https://www.transfermarkt.de/..." 
                      />
                    ) : player?.transfermarkt_url ? (
                      <TouchableOpacity onPress={() => Linking.openURL(player.transfermarkt_url)}>
                        <Image source={TransfermarktIcon} style={styles.transfermarktIconMedium} />
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.value}>-</Text>
                    )}
                  </View>
                </View>
                <View style={styles.splitColumn}>
                  {/* Stärken auf Höhe von Position */}
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Stärken</Text>
                    {editing ? (
                      <TextInput 
                        style={[styles.input, styles.smallTextArea]} 
                        value={editData?.strengths || ''} 
                        onChangeText={(text) => updateField('strengths', text)} 
                        placeholder="Stärken des Spielers..." 
                        multiline 
                      />
                    ) : (
                      <Text style={styles.value}>{player?.strengths || '-'}</Text>
                    )}
                  </View>
                  {/* Platzhalter für Nebenposition */}
                  <View style={styles.infoRow}><Text style={styles.label}> </Text><Text style={styles.value}> </Text></View>
                  {/* Platzhalter für Nationalität */}
                  <View style={styles.infoRow}><Text style={styles.label}> </Text><Text style={styles.value}> </Text></View>
                  {/* Potentiale auf Höhe von Starker Fuß */}
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Potentiale</Text>
                    {editing ? (
                      <TextInput 
                        style={[styles.input, styles.smallTextArea]} 
                        value={editData?.potentials || ''} 
                        onChangeText={(text) => updateField('potentials', text)} 
                        placeholder="Entwicklungspotentiale..." 
                        multiline 
                      />
                    ) : (
                      <Text style={styles.value}>{player?.potentials || '-'}</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Beratung</Text>
              <View style={styles.splitContainer}>
                <View style={styles.splitColumn}>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Listung</Text>
                    {editing ? (<View style={styles.chipGrid}>{LISTINGS.map((opt) => (<TouchableOpacity key={opt} style={[styles.chip, editData?.listing === opt && styles.chipSelected]} onPress={() => updateField('listing', editData?.listing === opt ? null : opt)}><Text style={[styles.chipText, editData?.listing === opt && styles.chipTextSelected]}>{editData?.listing === opt ? '✓ ' : ''}{opt}</Text></TouchableOpacity>))}</View>
                    ) : player?.listing ? (<View style={[styles.listingBadge, player.listing === 'Karl Herzog Sportmanagement' ? styles.listingKMH : styles.listingPM]}><Text style={styles.listingBadgeText}>{player.listing}</Text></View>) : <Text style={styles.value}>-</Text>}
                  </View>
                  {renderFieldWithDocuments('Provision', 'provision', 'provision_documents')}
                  {renderFieldWithDocuments('Weg-Vermittlung', 'transfer_commission', 'transfer_commission_documents')}
                </View>
                <View style={styles.splitColumn}>
                  {renderResponsibilitySelector()}
                  {renderDateField('Mandat gültig bis', 'mandate_until')}
                  {/* Platzhalter für Weg-Vermittlung */}
                  <View style={styles.infoRow}><Text style={styles.label}> </Text><Text style={styles.value}> </Text></View>
                </View>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Privat</Text>
              <View style={styles.splitContainer}>
                <View style={styles.splitColumn}>
                  {renderBirthDateField()}
                  {renderPhoneField('Telefon', 'phone', 'phone_country_code')}
                  {renderField('E-Mail', 'email')}
                  {renderAddressField()}
                  {renderInternatField()}
                </View>
                <View style={styles.splitColumn}>
                  {renderField('Schulabschluss', 'education')}
                  {renderField('Ausbildung/Studium', 'training')}
                  {renderSocialLinks()}
                  {renderField('Weitere Interessen', 'interests')}
                </View>
              </View>
            </View>
          </View>
          <View style={[styles.halfColumn, { zIndex: 100 }]}>
            <View style={[styles.card, { zIndex: 100, overflow: 'visible' }]}>
              <Text style={styles.cardTitle}>Vertrag</Text>
              <View style={[styles.splitContainer, { overflow: 'visible' }]}>
                <View style={[styles.splitColumn, { overflow: 'visible', zIndex: 100 }]}>
                  {renderClubField()}
                  {renderFutureClubField()}
                  {renderField('Liga', 'league')}
                  {renderU23Status()}
                  {renderContractEndField()}
                  {renderField('Vertrag gilt für', 'contract_scope')}
                  {renderField('Option', 'contract_option')}
                  {renderField('Fixe Ablöse / Ausbildungsentschädigung', 'fixed_fee')}
                </View>
                <View style={styles.splitColumn}>
                  {renderField('Gehalt/Monat', 'salary_month')}
                  {renderField('Punktprämie', 'point_bonus')}
                  {renderField('Auflaufprämie', 'appearance_bonus')}
                  <View style={styles.infoRow}><Text style={styles.label}>Sonstiges</Text>{editing ? <TextInput style={[styles.input, styles.smallTextArea]} value={editData.contract_notes || ''} onChangeText={(text) => updateField('contract_notes', text)} placeholder="Sonstiges..." multiline /> : <Text style={styles.value}>{player.contract_notes || '-'}</Text>}</View>
                  {renderDocuments()}
                  {renderSpielplanButton()}
                </View>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Familie</Text>
              <View style={styles.familyContainer}>
                <View style={styles.familyColumn}>
                  <Text style={styles.sectionSubtitle}>Vater</Text>
                  {renderField('Name', 'father_name')}
                  {renderPhoneField('Telefon', 'father_phone', 'father_phone_country_code')}
                  {renderField('Job', 'father_job')}
                  <Text style={styles.sectionSubtitle}>Mutter</Text>
                  {renderField('Name', 'mother_name')}
                  {renderPhoneField('Telefon', 'mother_phone', 'mother_phone_country_code')}
                  {renderField('Job', 'mother_job')}
                </View>
                <View style={styles.familyColumn}>
                  <Text style={styles.sectionSubtitle}>Geschwister</Text>
                  {renderField('Name', 'siblings')}
                  <View style={styles.infoRow}><Text style={styles.label}> </Text><Text style={styles.value}> </Text></View>
                  <View style={styles.infoRow}><Text style={styles.label}> </Text><Text style={styles.value}> </Text></View>
                  <Text style={styles.sectionSubtitle}>Sonstiges</Text>
                  <View style={styles.infoRow}>{editing ? <TextInput style={[styles.input, styles.smallTextArea]} value={editData.other_notes || ''} onChangeText={(text) => updateField('other_notes', text)} placeholder="Sonstiges..." multiline /> : <Text style={styles.value}>{player.other_notes || '-'}</Text>}</View>
                </View>
              </View>
            </View>
          </View>
        </View>
        
        {/* Verletzungen */}
        <View style={styles.cardFullWidth}>
          <Text style={styles.cardTitle}>Verletzungen & Krankheiten</Text>
          <View style={styles.infoRow}>
            {editing ? (
              <TextInput 
                style={[styles.input, styles.textArea]} 
                value={editData.injuries || ''} 
                onChangeText={(text) => updateField('injuries', text)} 
                placeholder="Verletzungshistorie..." 
                multiline 
              />
            ) : (
              <Text style={styles.value}>{player.injuries || '-'}</Text>
            )}
          </View>
        </View>
      </ScrollView>
      <View style={styles.bottomButtons}>
        {editing ? (
          <>
            {canDelete && (
              <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteModal(true)}>
                <Text style={styles.deleteButtonText}>Löschen</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={() => { setEditing(false); setEditData(player); setClubSearch(player.club || ''); setFutureClubSearch(player.future_club || ''); fetchPlayer(); }}>
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Speichern</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
            <Text style={styles.editButtonText}>Bearbeiten</Text>
          </TouchableOpacity>
        )}
      </View>
      {renderDeleteModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 18 },
  content: { flex: 1, padding: 16 },
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  // Top Section - 2 getrennte Karten
  topSectionContainer: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  topCardLeft: { flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  topCardRight: { width: 140, backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', justifyContent: 'center' },
  topLeft: { alignItems: 'center', marginRight: 20 },
  photoContainer: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', marginBottom: 8, borderWidth: 3, borderColor: '#000' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderText: { color: '#999', fontSize: 16 },
  photoInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 12, width: 120, textAlign: 'center' },
  topCenter: { flex: 1, justifyContent: 'center' },
  playerFirstName: { fontSize: 28, color: '#666' },
  playerLastName: { fontSize: 36, fontWeight: 'bold', color: '#000' },
  ageRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ageText: { fontSize: 18, color: '#666' },
  birthdayIconLarge: { fontSize: 24, marginLeft: 8 },
  nameInput: { fontSize: 24, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: '#000', marginBottom: 8, padding: 4 },
  tmInputTop: { fontSize: 14, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, marginTop: 8 },
  clubSection: { alignItems: 'center' },
  clubLogoHeader: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 8 },
  clubNameHeaderNoLogo: { fontSize: 16, fontWeight: '600', textAlign: 'center', maxWidth: 120 },
  clubTextRed: { color: '#dc3545' },
  futureClubHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  greenArrow: { fontSize: 24, color: '#28a745', fontWeight: 'bold', marginRight: 8 },
  futureClubLogoHeader: { width: 40, height: 40, resizeMode: 'contain' },
  futureClubNameHeader: { fontSize: 14, color: '#28a745', fontWeight: '500' },
  tmButton: { marginTop: 12 },
  transfermarktIcon: { width: 40, height: 40, resizeMode: 'contain' },
  transfermarktIconSmall: { width: 28, height: 28, resizeMode: 'contain' },
  transfermarktIconMedium: { width: 38, height: 38, resizeMode: 'contain' },
  twoColumnContainer: { flexDirection: 'row', gap: 16 },
  halfColumn: { flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardFullWidth: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#f0f0f0', paddingBottom: 12 },
  infoRow: { marginBottom: 12 },
  label: { fontSize: 13, color: '#999', marginBottom: 4 },
  value: { fontSize: 15, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  smallTextArea: { minHeight: 60 },
  textArea: { minHeight: 100 },
  textAreaMedium: { minHeight: 80 },
  textAreaLarge: { minHeight: 200 },
  splitContainer: { flexDirection: 'row', gap: 20 },
  splitColumn: { flex: 1 },
  familyContainer: { flexDirection: 'row', gap: 20 },
  familyColumn: { flex: 1 },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 8 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  chipSelected: { backgroundColor: '#000', borderColor: '#000' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextSelected: { color: '#fff' },
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
  dropdownButtonText: { fontSize: 15, color: '#333' },
  pickerList: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: 4, maxHeight: 200 },
  pickerScroll: { maxHeight: 200 },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerItemSelected: { backgroundColor: '#000' },
  pickerItemText: { fontSize: 14, color: '#333' },
  pickerItemTextSelected: { color: '#fff' },
  footSelector: { flexDirection: 'row', gap: 8 },
  footOption: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center' },
  footOptionSelected: { backgroundColor: '#000' },
  footOptionText: { fontSize: 14, color: '#333' },
  footOptionTextSelected: { color: '#fff' },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  statusBadgeNormal: { backgroundColor: '#e9ecef' },
  statusBadgeGreen: { backgroundColor: '#d4edda' },
  statusBadgeRed: { backgroundColor: '#f8d7da' },
  statusBadgeText: { fontSize: 14, fontWeight: '600' },
  statusTextNormal: { color: '#495057' },
  statusTextGreen: { color: '#155724' },
  statusTextRed: { color: '#721c24' },
  listingBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  listingKMH: { backgroundColor: '#000' },
  listingPM: { backgroundColor: '#5bc0de' },
  listingBadgeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  clubRowSmall: { flexDirection: 'row', alignItems: 'center' },
  clubLogoSmall: { width: 24, height: 24, resizeMode: 'contain', marginRight: 8 },
  birthdayRow: { flexDirection: 'row', alignItems: 'center' },
  birthdayIcon: { fontSize: 16, marginLeft: 8 },
  phoneContainer: { flexDirection: 'row', gap: 8 },
  phoneCodePicker: { width: 120 },
  phoneInput: { flex: 1 },
  addressRow: { flexDirection: 'row', gap: 8 },
  addressStreet: { flex: 2 },
  addressPLZ: { flex: 0.5, minWidth: 70 },
  addressCity: { flex: 1 },
  socialIconsRow: { flexDirection: 'row', gap: 12 },
  socialIcon: { width: 28, height: 28, resizeMode: 'contain' },
  socialInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  socialIconSmall: { width: 24, height: 24, resizeMode: 'contain', marginRight: 8 },
  socialInput: { flex: 1 },
  futureContractRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  smallLabel: { fontSize: 12, color: '#666' },
  uploadButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#000', borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8 },
  uploadButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  smallUploadButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#000', borderRadius: 6, alignSelf: 'flex-start', marginTop: 6 },
  smallUploadButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  documentList: { marginTop: 8 },
  documentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', padding: 10, borderRadius: 8, marginBottom: 6 },
  documentLink: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  documentIcon: { fontSize: 18, marginRight: 8 },
  documentName: { fontSize: 14, color: '#333' },
  documentDelete: { padding: 4 },
  documentDeleteText: { color: '#ff4444', fontSize: 16, fontWeight: 'bold' },
  smallDocItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', padding: 6, borderRadius: 6, marginTop: 4 },
  smallDocName: { fontSize: 12, color: '#333', flex: 1 },
  docLink: { fontSize: 13, color: '#007bff', marginTop: 4 },
  bottomButtons: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', justifyContent: 'flex-end', gap: 8 },
  deleteButton: { backgroundColor: '#ff4444', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginRight: 'auto' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  editButton: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { backgroundColor: '#eee', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  cancelButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalText: { fontSize: 16, color: '#333', textAlign: 'center', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalCancelButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#eee', marginRight: 8, alignItems: 'center' },
  modalCancelButtonText: { color: '#666', fontWeight: '600' },
  modalDeleteButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#ff4444', marginLeft: 8, alignItems: 'center' },
  modalDeleteButtonText: { color: '#fff', fontWeight: '600' },
  autocompleteContainer: { position: 'relative' },
  clubInputRow: { flexDirection: 'row', alignItems: 'center' },
  clubLogoInput: { width: 28, height: 28, resizeMode: 'contain', marginRight: 8 },
  clubInput: { flex: 1 },
  suggestionsList: { 
    position: 'absolute', 
    top: '100%', 
    left: 0, 
    right: 0, 
    backgroundColor: '#fff', 
    borderWidth: 2, 
    borderColor: '#000', 
    borderRadius: 8, 
    maxHeight: 200, 
    zIndex: 9999,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 10,
  },
  suggestionsScroll: { maxHeight: 200 },
  suggestionItem: { 
    padding: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  suggestionText: { fontSize: 15, color: '#000', fontWeight: '500' },
  // Spielplan Button Styles
  spielplanButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  spielplanButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});
