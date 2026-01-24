import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { SlideUpModal } from '../../components/SlideUpModal';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const LEAGUES = ['1. Bundesliga', '2. Bundesliga', '3. Liga', 'Regionalliga Nordost', 'Regionalliga Südwest', 'Regionalliga West', 'Regionalliga Nord', 'Regionalliga Bayern', 'Oberliga'];
const BEREICHE = ['Herren', 'Nachwuchs'];
const POSITIONS_HERREN = ['Trainer', 'Co-Trainer', 'Torwarttrainer', 'Sportdirektor', 'Präsident', 'Vorstand', 'Geschäftsführer', 'Scout'];
const POSITIONS_NACHWUCHS = ['NLZ-Leiter', 'Trainer', 'Scout'];
const ALL_POSITIONS = [...new Set([...POSITIONS_HERREN, ...POSITIONS_NACHWUCHS])];
const MANNSCHAFTEN_HERREN = ['1. Mannschaft', 'U23'];
const MANNSCHAFTEN_NACHWUCHS = ['U19', 'U17', 'U16', 'U15', 'U14', 'U13'];
const COUNTRY_CODES = [
  { code: '+49', country: 'Deutschland' }, { code: '+43', country: 'Österreich' }, { code: '+41', country: 'Schweiz' },
  { code: '+31', country: 'Niederlande' }, { code: '+32', country: 'Belgien' }, { code: '+33', country: 'Frankreich' },
  { code: '+44', country: 'UK' }, { code: '+39', country: 'Italien' }, { code: '+34', country: 'Spanien' },
  { code: '+48', country: 'Polen' }, { code: '+90', country: 'Türkei' },
];

interface Contact {
  id: string; vorname: string; nachname: string; verein: string; liga: string;
  bereich: string; position: string; mannschaft: string; telefon_code: string; telefon: string;
  email: string; notes?: string; created_at: string;
}

type SortField = 'verein' | 'name' | 'bereich' | 'position' | 'mannschaft' | 'telefon' | 'email';
type SortDirection = 'asc' | 'desc';

export function FootballNetworkScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { session, loading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const dataLoadedRef = useRef(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [clubs, setClubs] = useState<string[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [searchText, setSearchText] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [selectedBereiche, setSelectedBereiche] = useState<string[]>([]);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [showLeagueDropdown, setShowLeagueDropdown] = useState(false);
  const [showBereichDropdown, setShowBereichDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState({ vorname: '', nachname: '', verein: '', liga: '', bereich: '', position: '', mannschaft: '', telefon_code: '+49', telefon: '', email: '', notes: '' });
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [vereinSearch, setVereinSearch] = useState('');
  const [ligaSearch, setLigaSearch] = useState('');
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; role?: string } | null>(null);

  // Mobile States
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContactDetailModal, setShowContactDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDesktopDetailModal, setShowDesktopDetailModal] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('verein');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Daten nur laden wenn Auth bereit ist
  useEffect(() => {
    if (authLoading) return;
    if (!session) return;
    if (dataLoadedRef.current) return;

    dataLoadedRef.current = true;
    fetchContacts(); fetchClubs(); fetchProfile();
  }, [authLoading, session]);

  const fetchContacts = async () => {
    const { data } = await supabase.from('football_network_contacts').select('*').order('nachname', { ascending: true });
    if (data) setContacts(data);
  };

  const fetchClubs = async () => {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const logoMap: Record<string, string> = {};
      const names: string[] = [];
      data.forEach(item => { logoMap[item.club_name] = item.logo_url; names.push(item.club_name); });
      setClubLogos(logoMap);
      setClubs(names.sort());
    }
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('advisors').select('first_name, last_name, role').eq('id', user.id).single();
      if (data) setProfile(data);
    }
  };

  const getClubLogo = (clubName: string): string | null => {
    if (!clubName) return null;
    if (clubLogos[clubName]) return clubLogos[clubName];
    for (const [logoClub, logoUrl] of Object.entries(clubLogos)) {
      if (clubName.toLowerCase().includes(logoClub.toLowerCase()) || logoClub.toLowerCase().includes(clubName.toLowerCase())) return logoUrl;
    }
    return null;
  };

  const addContact = async () => {
    if (!newContact.nachname.trim()) return;
    await supabase.from('football_network_contacts').insert({ ...newContact });
    closeModal(); fetchContacts();
  };

  const updateContact = async () => {
    if (!editingContact) return;
    await supabase.from('football_network_contacts').update({ ...newContact }).eq('id', editingContact.id);
    closeModal(); fetchContacts();
  };

  const deleteContact = async (id: string) => {
    await supabase.from('football_network_contacts').delete().eq('id', id);
    fetchContacts();
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setNewContact({ vorname: contact.vorname || '', nachname: contact.nachname || '', verein: contact.verein || '', liga: contact.liga || '', bereich: contact.bereich || '', position: contact.position || '', mannschaft: contact.mannschaft || '', telefon_code: contact.telefon_code || '+49', telefon: contact.telefon || '', email: contact.email || '', notes: contact.notes || '' });
    setVereinSearch(contact.verein || '');
    setLigaSearch(contact.liga || '');
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false); setEditingContact(null);
    setNewContact({ vorname: '', nachname: '', verein: '', liga: '', bereich: '', position: '', mannschaft: '', telefon_code: '+49', telefon: '', email: '', notes: '' });
    setVereinSearch(''); setLigaSearch(''); setActiveDropdown(null);
  };

  const getAvailablePositions = () => newContact.bereich === 'Herren' ? POSITIONS_HERREN : newContact.bereich === 'Nachwuchs' ? POSITIONS_NACHWUCHS : [];
  const getAvailableMannschaften = () => newContact.bereich === 'Herren' ? MANNSCHAFTEN_HERREN : newContact.bereich === 'Nachwuchs' ? MANNSCHAFTEN_NACHWUCHS : [];
  const filteredClubs = useMemo(() => !vereinSearch.trim() ? clubs : clubs.filter(c => c.toLowerCase().includes(vereinSearch.toLowerCase())), [clubs, vereinSearch]);
  const filteredLeagues = useMemo(() => !ligaSearch.trim() ? LEAGUES : LEAGUES.filter(l => l.toLowerCase().includes(ligaSearch.toLowerCase())), [ligaSearch]);

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(c => c.vorname?.toLowerCase().includes(q) || c.nachname?.toLowerCase().includes(q) || c.verein?.toLowerCase().includes(q) || c.liga?.toLowerCase().includes(q));
    }
    if (selectedPositions.length > 0) result = result.filter(c => selectedPositions.includes(c.position));
    if (selectedLeagues.length > 0) result = result.filter(c => selectedLeagues.includes(c.liga));
    if (selectedBereiche.length > 0) result = result.filter(c => selectedBereiche.includes(c.bereich));

    // Sorting
    result = [...result].sort((a, b) => {
      let valueA: string, valueB: string;
      switch (sortField) {
        case 'verein': valueA = a.verein?.toLowerCase() || ''; valueB = b.verein?.toLowerCase() || ''; break;
        case 'name': valueA = formatName(a).toLowerCase(); valueB = formatName(b).toLowerCase(); break;
        case 'bereich': valueA = a.bereich?.toLowerCase() || ''; valueB = b.bereich?.toLowerCase() || ''; break;
        case 'position': valueA = a.position?.toLowerCase() || ''; valueB = b.position?.toLowerCase() || ''; break;
        case 'mannschaft': valueA = a.mannschaft?.toLowerCase() || ''; valueB = b.mannschaft?.toLowerCase() || ''; break;
        case 'telefon': valueA = formatPhone(a).toLowerCase(); valueB = formatPhone(b).toLowerCase(); break;
        case 'email': valueA = a.email?.toLowerCase() || ''; valueB = b.email?.toLowerCase() || ''; break;
        default: return 0;
      }
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [contacts, searchText, selectedPositions, selectedLeagues, selectedBereiche, sortField, sortDirection]);

  const togglePosition = (p: string) => setSelectedPositions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const toggleLeague = (l: string) => setSelectedLeagues(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleBereich = (b: string) => setSelectedBereiche(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  const closeAllDropdowns = () => { setShowPositionDropdown(false); setShowLeagueDropdown(false); setShowBereichDropdown(false); };
  const formatPhone = (c: Contact) => c.telefon ? `${c.telefon_code || ''} ${c.telefon}`.trim() : '-';
  const formatName = (c: Contact) => c.nachname && c.vorname ? `${c.nachname}, ${c.vorname}` : c.nachname || c.vorname || '-';

  // Sorting functions
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIndicator = (field: SortField): string => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  // Profile initials for header
  const profileInitials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}` : '?';

  // Active filter count for mobile
  const activeFilterCount = selectedPositions.length + selectedLeagues.length + selectedBereiche.length;

  // Handle contact click for mobile detail modal
  const handleContactClick = (contact: Contact) => {
    if (isMobile) {
      setSelectedContact(contact);
      setShowContactDetailModal(true);
    } else {
      openEditModal(contact);
    }
  };

  // Open edit from detail modal
  const openEditFromDetail = () => {
    if (selectedContact) {
      setShowContactDetailModal(false);
      openEditModal(selectedContact);
    }
  };

  // Mobile Contact Card
  const renderMobileContactCard = (contact: Contact) => {
    const logoUrl = getClubLogo(contact.verein);
    return (
      <TouchableOpacity
        key={contact.id}
        style={[styles.mobileCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
        onPress={() => handleContactClick(contact)}
      >
        {/* Row 1: Name (left) | Position badges (right) */}
        <View style={styles.mobileCardRow}>
          <Text style={[styles.mobileCardName, { color: colors.text }]}>{formatName(contact)}</Text>
          <View style={styles.mobileCardBadgesRow}>
            {(contact.position || contact.mannschaft) && (
              <View style={[styles.mobilePositionBadge, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : '#e0f2fe', borderColor: isDark ? 'rgba(14, 165, 233, 0.4)' : '#bae6fd' }]}>
                <Text style={[styles.mobilePositionText, { color: isDark ? '#38bdf8' : '#0369a1' }]}>{[contact.position, contact.mannschaft].filter(Boolean).join(' · ')}</Text>
              </View>
            )}
          </View>
        </View>
        {/* Row 2: Club with logo (left) | Bereich badge (right) */}
        <View style={styles.mobileCardRow}>
          <View style={styles.mobileCardClubRow}>
            {logoUrl && <Image source={{ uri: logoUrl }} style={styles.mobileCardClubLogo} />}
            <Text style={[styles.mobileCardClub, { color: colors.textSecondary }]} numberOfLines={1}>{contact.verein || '-'}</Text>
          </View>
          {contact.bereich && (
            <View style={[
              styles.mobileBereichBadge,
              {
                backgroundColor: contact.bereich === 'Nachwuchs'
                  ? (isDark ? 'rgba(251, 191, 36, 0.2)' : '#fef3c7')
                  : (isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4'),
                borderColor: contact.bereich === 'Nachwuchs'
                  ? (isDark ? 'rgba(251, 191, 36, 0.4)' : '#fde68a')
                  : (isDark ? 'rgba(34, 197, 94, 0.4)' : '#bbf7d0')
              }
            ]}>
              <Text style={[
                styles.mobileBereichText,
                { color: contact.bereich === 'Nachwuchs' ? (isDark ? '#fbbf24' : '#92400e') : (isDark ? '#4ade80' : '#166534') }
              ]}>{contact.bereich}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Mobile View
  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: colors.background }]}>
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="network"
          profile={profile}
        />

        <View style={[styles.mainContentMobile, { backgroundColor: colors.background }]}>
          <MobileHeader
            title="Football Network"
            onMenuPress={() => setShowMobileSidebar(true)}
            onProfilePress={() => navigation.navigate('MyProfile')}
            profileInitials={profileInitials}
          />

          {/* Mobile Toolbar */}
          <View style={[styles.mobileToolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={[styles.mobileSearchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <Text style={styles.mobileSearchIcon}>🔍</Text>
              <TextInput
                style={[styles.mobileSearchInput, { color: colors.text }]}
                placeholder="Name, Verein suchen..."
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
          </View>

          {/* Contact Count */}
          <View style={[styles.mobileSubheader, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.mobileSubheaderText, { color: colors.textSecondary }]}>{filteredContacts.length} Kontakte</Text>
          </View>

          {/* Contact Cards */}
          <ScrollView style={styles.mobileCardList} contentContainerStyle={styles.mobileCardListContent}>
            {filteredContacts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {contacts.length === 0 ? 'Noch keine Kontakte vorhanden' : 'Keine Kontakte gefunden'}
              </Text>
            ) : (
              filteredContacts.map(contact => renderMobileContactCard(contact))
            )}
          </ScrollView>

          {/* FAB Button */}
          <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowAddModal(true)}>
            <Text style={[styles.fabText, { color: colors.primaryText }]}>+</Text>
          </TouchableOpacity>
        </View>

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
              {/* Bereich Filter */}
              <Text style={[styles.mobileFilterSectionTitle, { color: colors.text }]}>Bereich</Text>
              <View style={styles.mobileChipContainer}>
                {BEREICHE.map(bereich => {
                  const isSelected = selectedBereiche.includes(bereich);
                  return (
                    <TouchableOpacity
                      key={bereich}
                      style={[styles.mobileChip, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => toggleBereich(bereich)}
                    >
                      <Text style={[styles.mobileChipText, { color: colors.textSecondary }, isSelected && { color: colors.primaryText }]}>
                        {bereich}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Position Filter */}
              <Text style={[styles.mobileFilterSectionTitle, { color: colors.text }]}>Position</Text>
              <View style={styles.mobileChipContainer}>
                {ALL_POSITIONS.map(position => {
                  const isSelected = selectedPositions.includes(position);
                  return (
                    <TouchableOpacity
                      key={position}
                      style={[styles.mobileChip, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => togglePosition(position)}
                    >
                      <Text style={[styles.mobileChipText, { color: colors.textSecondary }, isSelected && { color: colors.primaryText }]}>
                        {position}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Liga Filter */}
              <Text style={[styles.mobileFilterSectionTitle, { color: colors.text }]}>Liga</Text>
              <View style={styles.mobileChipContainer}>
                {LEAGUES.map(league => {
                  const isSelected = selectedLeagues.includes(league);
                  return (
                    <TouchableOpacity
                      key={league}
                      style={[styles.mobileChip, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => toggleLeague(league)}
                    >
                      <Text style={[styles.mobileChipText, { color: colors.textSecondary }, isSelected && { color: colors.primaryText }]}>
                        {league}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Filter Actions */}
            <View style={[styles.mobileFilterActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.mobileFilterClearButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={() => { setSelectedBereiche([]); setSelectedPositions([]); setSelectedLeagues([]); }}
              >
                <Text style={[styles.mobileFilterClearText, { color: colors.textSecondary }]}>Zurücksetzen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mobileFilterApplyButton, { backgroundColor: colors.primary }]} onPress={() => setShowMobileFilters(false)}>
                <Text style={[styles.mobileFilterApplyText, { color: colors.primaryText }]}>Anwenden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Mobile Contact Detail Modal */}
        <SlideUpModal visible={showContactDetailModal} onClose={() => setShowContactDetailModal(false)}>
          {selectedContact && (
            <>
              <View style={[styles.mobileDetailHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mobileDetailName, { color: colors.text }]}>{formatName(selectedContact)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    {getClubLogo(selectedContact.verein) && (
                      <Image source={{ uri: getClubLogo(selectedContact.verein)! }} style={{ width: 18, height: 18, marginRight: 6 }} />
                    )}
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{selectedContact.verein || '-'}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowContactDetailModal(false)}>
                  <Text style={[styles.mobileDetailClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

                  <ScrollView style={styles.mobileDetailContent}>
                    {/* Bereich | Position | Mannschaft */}
                    <View style={[styles.mobileDetailBox, { backgroundColor: colors.surfaceSecondary }]}>
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.mobileDetailLabel, { color: colors.textMuted }]}>Bereich</Text>
                          {selectedContact.bereich ? (
                            <View style={[
                              styles.mobileBereichBadge,
                              {
                                alignSelf: 'flex-start',
                                backgroundColor: selectedContact.bereich === 'Nachwuchs'
                                  ? (isDark ? 'rgba(251, 191, 36, 0.2)' : '#fef3c7')
                                  : (isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4'),
                                borderColor: selectedContact.bereich === 'Nachwuchs'
                                  ? (isDark ? 'rgba(251, 191, 36, 0.4)' : '#fde68a')
                                  : (isDark ? 'rgba(34, 197, 94, 0.4)' : '#bbf7d0')
                              }
                            ]}>
                              <Text style={[
                                styles.mobileBereichText,
                                { color: selectedContact.bereich === 'Nachwuchs' ? (isDark ? '#fbbf24' : '#92400e') : (isDark ? '#4ade80' : '#166534') }
                              ]}>{selectedContact.bereich}</Text>
                            </View>
                          ) : <Text style={[styles.mobileDetailValue, { color: colors.text }]}>-</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.mobileDetailLabel, { color: colors.textMuted }]}>Position</Text>
                          {selectedContact.position ? (
                            <View style={[styles.mobilePositionBadge, { alignSelf: 'flex-start', backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : '#e0f2fe', borderColor: isDark ? 'rgba(14, 165, 233, 0.4)' : '#bae6fd' }]}>
                              <Text style={[styles.mobilePositionText, { color: isDark ? '#38bdf8' : '#0369a1' }]}>{selectedContact.position}</Text>
                            </View>
                          ) : <Text style={[styles.mobileDetailValue, { color: colors.text }]}>-</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.mobileDetailLabel, { color: colors.textMuted }]}>Mannschaft</Text>
                          {selectedContact.mannschaft ? (
                            <View style={[styles.mobilePositionBadge, { alignSelf: 'flex-start', backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : '#e0f2fe', borderColor: isDark ? 'rgba(14, 165, 233, 0.4)' : '#bae6fd' }]}>
                              <Text style={[styles.mobilePositionText, { color: isDark ? '#38bdf8' : '#0369a1' }]}>{selectedContact.mannschaft}</Text>
                            </View>
                          ) : <Text style={[styles.mobileDetailValue, { color: colors.text }]}>-</Text>}
                        </View>
                      </View>
                    </View>

                    {/* Telefon | E-Mail */}
                    <View style={[styles.mobileDetailBox, { backgroundColor: colors.surfaceSecondary }]}>
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.mobileDetailLabel, { color: colors.textMuted }]}>Telefon</Text>
                          <Text style={[styles.mobileDetailValue, { color: colors.text }]}>{formatPhone(selectedContact)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.mobileDetailLabel, { color: colors.textMuted }]}>E-Mail</Text>
                          <Text style={[styles.mobileDetailValue, { color: selectedContact.email ? '#3b82f6' : colors.text }]} numberOfLines={1}>{selectedContact.email || '-'}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Liga */}
                    <View style={[styles.mobileDetailBox, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.mobileDetailLabel, { color: colors.textMuted }]}>Liga (Zugehörigkeit 1. Mannschaft)</Text>
                      <Text style={[styles.mobileDetailValue, { color: colors.text }]}>{selectedContact.liga || '-'}</Text>
                    </View>

                    {/* Weitere Informationen */}
                    {selectedContact.notes && (
                      <View style={[styles.mobileDetailBox, { marginBottom: 0, backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.mobileDetailLabel, { color: colors.textMuted }]}>Weitere Informationen</Text>
                        <Text style={[styles.mobileDetailValue, { color: colors.text }]}>{selectedContact.notes}</Text>
                      </View>
                    )}
                  </ScrollView>

                  <View style={[styles.mobileDetailFooter, { borderTopColor: colors.border }]}>
                    <TouchableOpacity style={[styles.mobileEditButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={openEditFromDetail}>
                      <Text style={[styles.mobileEditText, { color: colors.textSecondary }]}>Bearbeiten</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
        </SlideUpModal>

        {/* Add/Edit Modal for Mobile */}
        <Modal visible={showAddModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
            <TouchableOpacity style={[styles.mobileFormModal, { backgroundColor: colors.surface }]} activeOpacity={1} onPress={() => setActiveDropdown(null)}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editingContact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}><Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text></TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <View style={styles.formField}><Text style={[styles.formLabel, { color: colors.textSecondary }]}>Vorname</Text><TextInput style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.vorname} onChangeText={(t) => setNewContact({...newContact, vorname: t})} placeholder="Vorname" placeholderTextColor={colors.textMuted} onFocus={() => setActiveDropdown(null)} /></View>
                <View style={styles.formField}><Text style={[styles.formLabel, { color: colors.textSecondary }]}>Nachname *</Text><TextInput style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.nachname} onChangeText={(t) => setNewContact({...newContact, nachname: t})} placeholder="Nachname" placeholderTextColor={colors.textMuted} onFocus={() => setActiveDropdown(null)} /></View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Verein</Text>
                  <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => setActiveDropdown(activeDropdown === 'verein' ? null : 'verein')}>
                    <Text style={newContact.verein ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.verein || 'Verein auswählen...'}</Text>
                    <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'verein' && (
                    <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <TextInput style={[styles.dropdownSearch, { borderBottomColor: colors.border, color: colors.text }]} value={vereinSearch} onChangeText={setVereinSearch} placeholder="Verein suchen..." placeholderTextColor={colors.textMuted} autoFocus />
                      <ScrollView style={styles.dropdownScroll}>
                        {filteredClubs.map(club => (
                          <TouchableOpacity key={club} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, verein: club}); setVereinSearch(''); setActiveDropdown(null); }}>
                            <View style={styles.clubItemRow}>{getClubLogo(club) && <Image source={{ uri: getClubLogo(club)! }} style={styles.clubLogo} />}<Text style={[styles.dropdownItemText, { color: colors.text }]}>{club}</Text></View>
                          </TouchableOpacity>
                        ))}
                        {vereinSearch.trim() && !clubs.includes(vereinSearch) && (
                          <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemNew, { borderBottomColor: colors.border, backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4' }]} onPress={() => { setNewContact({...newContact, verein: vereinSearch}); setVereinSearch(''); setActiveDropdown(null); }}>
                            <Text style={[styles.dropdownItemText, { color: colors.text }]}>+ "{vereinSearch}" hinzufügen</Text>
                          </TouchableOpacity>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Bereich</Text>
                  <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => setActiveDropdown(activeDropdown === 'bereich' ? null : 'bereich')}>
                    <Text style={newContact.bereich ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.bereich || 'Bereich auswählen...'}</Text>
                    <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'bereich' && (
                    <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <ScrollView style={styles.dropdownScroll}>
                        {BEREICHE.map(b => (<TouchableOpacity key={b} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, bereich: b, position: '', mannschaft: ''}); setActiveDropdown(null); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{b}</Text></TouchableOpacity>))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Position</Text>
                  <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, !newContact.bereich && { backgroundColor: colors.surfaceSecondary }]} onPress={() => newContact.bereich && setActiveDropdown(activeDropdown === 'position' ? null : 'position')}>
                    <Text style={newContact.position ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.position || (newContact.bereich ? 'Position auswählen...' : 'Erst Bereich wählen')}</Text>
                    <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'position' && newContact.bereich && (
                    <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <ScrollView style={styles.dropdownScroll}>
                        {getAvailablePositions().map(p => (<TouchableOpacity key={p} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, position: p}); setActiveDropdown(null); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{p}</Text></TouchableOpacity>))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Mannschaft</Text>
                  <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, !newContact.bereich && { backgroundColor: colors.surfaceSecondary }]} onPress={() => newContact.bereich && setActiveDropdown(activeDropdown === 'mannschaft' ? null : 'mannschaft')}>
                    <Text style={newContact.mannschaft ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.mannschaft || (newContact.bereich ? 'Mannschaft auswählen...' : 'Erst Bereich wählen')}</Text>
                    <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'mannschaft' && newContact.bereich && (
                    <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <ScrollView style={styles.dropdownScroll}>
                        {getAvailableMannschaften().map(m => (<TouchableOpacity key={m} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, mannschaft: m}); setActiveDropdown(null); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{m}</Text></TouchableOpacity>))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Liga (Zugehörigkeit 1. Mannschaft)</Text>
                  <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => setActiveDropdown(activeDropdown === 'liga' ? null : 'liga')}>
                    <Text style={newContact.liga ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.liga || 'Liga auswählen...'}</Text>
                    <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'liga' && (
                    <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <TextInput style={[styles.dropdownSearch, { borderBottomColor: colors.border, color: colors.text }]} value={ligaSearch} onChangeText={setLigaSearch} placeholder="Liga suchen..." placeholderTextColor={colors.textMuted} autoFocus />
                      <ScrollView style={styles.dropdownScroll}>
                        {filteredLeagues.map(league => (
                          <TouchableOpacity key={league} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, liga: league}); setLigaSearch(''); setActiveDropdown(null); }}>
                            <Text style={[styles.dropdownItemText, { color: colors.text }]}>{league}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Telefon</Text>
                  <View style={styles.phoneRow}>
                    <TouchableOpacity style={[styles.countryCodeButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => setActiveDropdown(activeDropdown === 'country' ? null : 'country')}>
                      <Text style={[styles.countryCodeText, { color: colors.text }]}>{newContact.telefon_code}</Text><Text style={[styles.countryCodeArrow, { color: colors.textSecondary }]}>▼</Text>
                    </TouchableOpacity>
                    <TextInput style={[styles.formInput, styles.phoneInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.telefon} onChangeText={(t) => setNewContact({...newContact, telefon: t})} placeholder="123 456789" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" onFocus={() => setActiveDropdown(null)} />
                  </View>
                  {activeDropdown === 'country' && (
                    <View style={[styles.dropdownList, { width: 200, backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <ScrollView style={styles.dropdownScroll}>
                        {COUNTRY_CODES.map(cc => (<TouchableOpacity key={cc.code} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, telefon_code: cc.code}); setActiveDropdown(null); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{cc.code} {cc.country}</Text></TouchableOpacity>))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}><Text style={[styles.formLabel, { color: colors.textSecondary }]}>E-Mail</Text><TextInput style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.email} onChangeText={(t) => setNewContact({...newContact, email: t})} placeholder="email@beispiel.de" placeholderTextColor={colors.textMuted} keyboardType="email-address" onFocus={() => setActiveDropdown(null)} /></View>
                <View style={styles.formField}><Text style={[styles.formLabel, { color: colors.textSecondary }]}>Weitere Informationen</Text><TextInput style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.notes} onChangeText={(t) => setNewContact({...newContact, notes: t})} placeholder="Zusätzliche Informationen..." placeholderTextColor={colors.textMuted} multiline numberOfLines={3} onFocus={() => setActiveDropdown(null)} /></View>
              </ScrollView>
              <View style={[styles.modalButtonsSpaced, { borderTopColor: colors.border }]}>
                {editingContact && (
                  <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
                    <Text style={styles.deleteButtonText}>Löschen</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.modalButtonsRight}>
                  <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={closeModal}><Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={editingContact ? updateContact : addContact}><Text style={[styles.saveButtonText, { color: colors.primaryText }]}>{editingContact ? 'Speichern' : 'Hinzufügen'}</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Delete Confirmation Modal - Mobile */}
        <Modal visible={showDeleteConfirm} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteConfirm(false)}>
            <View style={[styles.deleteConfirmModal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.deleteConfirmTitle, { color: colors.text }]}>Kontakt löschen</Text>
              <Text style={styles.deleteConfirmText}>Möchten Sie {editingContact ? `${editingContact.vorname} ${editingContact.nachname}`.trim() : 'diesen Kontakt'} wirklich löschen?</Text>
              <View style={styles.deleteConfirmButtons}>
                <TouchableOpacity style={[styles.deleteConfirmCancelBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => setShowDeleteConfirm(false)}>
                  <Text style={[styles.deleteConfirmCancelText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteConfirmDeleteBtn} onPress={() => { if (editingContact) { deleteContact(editingContact.id); setShowDeleteConfirm(false); setShowContactDetailModal(false); closeModal(); } }}>
                  <Text style={styles.deleteConfirmDeleteText}>Löschen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // Desktop View
  return (
    <View style={[styles.container, { backgroundColor: colors.background }, isMobile && styles.containerMobile]}>
      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="network"
          profile={profile}
        />
      )}

      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar navigation={navigation} activeScreen="network" profile={profile} />}

      <TouchableOpacity style={[styles.mainContent, { backgroundColor: colors.background }]} activeOpacity={1} onPress={closeAllDropdowns}>
        {/* Mobile Header */}
        {isMobile && (
          <MobileHeader
            title="Football Network"
            onMenuPress={() => setShowMobileSidebar(true)}
            onProfilePress={() => navigation.navigate('MyProfile')}
            profileInitials={profileInitials}
          />
        )}

        {/* Desktop Header */}
        {!isMobile && (
          <View style={[styles.headerBanner, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => navigation.navigate('AdvisorDashboard')}><Text style={[styles.backButtonText, { color: colors.textSecondary }]}>← Zurück</Text></TouchableOpacity>
            <View style={styles.headerBannerCenter}><Text style={[styles.title, { color: colors.text }]}>Football Network</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>Kontakte zu Vereinen und Entscheidern</Text></View>
            <View style={{ width: 100 }} />
          </View>
        )}

        <View style={[styles.toolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Verein, Namen suchen..." placeholderTextColor={colors.textMuted} value={searchText} onChangeText={setSearchText} />
          </View>
          <View style={styles.filterContainer}>
            <View style={[styles.dropdownContainer, { zIndex: 40 }]}>
              <TouchableOpacity style={[styles.filterButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, selectedBereiche.length > 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={(e) => { e.stopPropagation(); setShowBereichDropdown(!showBereichDropdown); setShowPositionDropdown(false); setShowLeagueDropdown(false); }}>
                <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedBereiche.length > 0 && { color: colors.primaryText }]}>{selectedBereiche.length === 0 ? 'Bereich' : selectedBereiche.length === 1 ? selectedBereiche[0] : `${selectedBereiche.length} Bereiche`} ▼</Text>
              </TouchableOpacity>
              {showBereichDropdown && (
                <View style={[styles.filterDropdownMulti, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.filterDropdownHeader, { borderBottomColor: colors.border }]}><Text style={[styles.filterDropdownTitle, { color: colors.text }]}>Bereich wählen</Text>{selectedBereiche.length > 0 && <TouchableOpacity onPress={() => setSelectedBereiche([])}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}</View>
                  <ScrollView style={{ maxHeight: 200 }}>{BEREICHE.map(b => (<TouchableOpacity key={b} style={[styles.filterCheckboxItem, { borderBottomColor: colors.border }]} onPress={() => toggleBereich(b)}><View style={[styles.checkbox, { borderColor: colors.border }, selectedBereiche.includes(b) && { backgroundColor: colors.primary, borderColor: colors.primary }]}>{selectedBereiche.includes(b) && <Text style={[styles.checkmark, { color: colors.primaryText }]}>✓</Text>}</View><Text style={[styles.filterCheckboxText, { color: colors.text }]}>{b}</Text><Text style={[styles.filterCountBadge, { color: colors.textSecondary, backgroundColor: colors.surfaceSecondary }]}>{contacts.filter(c => c.bereich === b).length}</Text></TouchableOpacity>))}</ScrollView>
                  <TouchableOpacity style={[styles.filterDoneButton, { borderTopColor: colors.border }]} onPress={() => setShowBereichDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </View>
              )}
            </View>
            <View style={[styles.dropdownContainer, { zIndex: 30 }]}>
              <TouchableOpacity style={[styles.filterButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, selectedPositions.length > 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={(e) => { e.stopPropagation(); setShowPositionDropdown(!showPositionDropdown); setShowLeagueDropdown(false); setShowBereichDropdown(false); }}>
                <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedPositions.length > 0 && { color: colors.primaryText }]}>{selectedPositions.length === 0 ? 'Position' : selectedPositions.length === 1 ? selectedPositions[0] : `${selectedPositions.length} Positionen`} ▼</Text>
              </TouchableOpacity>
              {showPositionDropdown && (
                <View style={[styles.filterDropdownMulti, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.filterDropdownHeader, { borderBottomColor: colors.border }]}><Text style={[styles.filterDropdownTitle, { color: colors.text }]}>Position wählen</Text>{selectedPositions.length > 0 && <TouchableOpacity onPress={() => setSelectedPositions([])}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}</View>
                  <ScrollView style={{ maxHeight: 250 }}>{ALL_POSITIONS.map(p => (<TouchableOpacity key={p} style={[styles.filterCheckboxItem, { borderBottomColor: colors.border }]} onPress={() => togglePosition(p)}><View style={[styles.checkbox, { borderColor: colors.border }, selectedPositions.includes(p) && { backgroundColor: colors.primary, borderColor: colors.primary }]}>{selectedPositions.includes(p) && <Text style={[styles.checkmark, { color: colors.primaryText }]}>✓</Text>}</View><Text style={[styles.filterCheckboxText, { color: colors.text }]}>{p}</Text><Text style={[styles.filterCountBadge, { color: colors.textSecondary, backgroundColor: colors.surfaceSecondary }]}>{contacts.filter(c => c.position === p).length}</Text></TouchableOpacity>))}</ScrollView>
                  <TouchableOpacity style={[styles.filterDoneButton, { borderTopColor: colors.border }]} onPress={() => setShowPositionDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </View>
              )}
            </View>
            <View style={[styles.dropdownContainer, { zIndex: 20 }]}>
              <TouchableOpacity style={[styles.filterButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, selectedLeagues.length > 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={(e) => { e.stopPropagation(); setShowLeagueDropdown(!showLeagueDropdown); setShowPositionDropdown(false); setShowBereichDropdown(false); }}>
                <Text style={[styles.filterButtonText, { color: colors.textSecondary }, selectedLeagues.length > 0 && { color: colors.primaryText }]}>{selectedLeagues.length === 0 ? 'Liga' : selectedLeagues.length === 1 ? selectedLeagues[0] : `${selectedLeagues.length} Ligen`} ▼</Text>
              </TouchableOpacity>
              {showLeagueDropdown && (
                <View style={[styles.filterDropdownMulti, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.filterDropdownHeader, { borderBottomColor: colors.border }]}><Text style={[styles.filterDropdownTitle, { color: colors.text }]}>Liga wählen</Text>{selectedLeagues.length > 0 && <TouchableOpacity onPress={() => setSelectedLeagues([])}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}</View>
                  <ScrollView style={{ maxHeight: 250 }}>{LEAGUES.map(l => (<TouchableOpacity key={l} style={[styles.filterCheckboxItem, { borderBottomColor: colors.border }]} onPress={() => toggleLeague(l)}><View style={[styles.checkbox, { borderColor: colors.border }, selectedLeagues.includes(l) && { backgroundColor: colors.primary, borderColor: colors.primary }]}>{selectedLeagues.includes(l) && <Text style={[styles.checkmark, { color: colors.primaryText }]}>✓</Text>}</View><Text style={[styles.filterCheckboxText, { color: colors.text }]}>{l}</Text><Text style={[styles.filterCountBadge, { color: colors.textSecondary, backgroundColor: colors.surfaceSecondary }]}>{contacts.filter(c => c.liga === l).length}</Text></TouchableOpacity>))}</ScrollView>
                  <TouchableOpacity style={[styles.filterDoneButton, { borderTopColor: colors.border }]} onPress={() => setShowLeagueDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setShowAddModal(true)}><Text style={[styles.addButtonText, { color: colors.primaryText }]}>+ neuen Kontakt anlegen</Text></TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={[styles.tableContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.tableHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => handleSort('verein')} style={[styles.sortableHeaderCell, { flex: 1.3 }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.textSecondary }]}>Verein {getSortIndicator('verein')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSort('name')} style={[styles.sortableHeaderCell, { flex: 1.2 }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.textSecondary }]}>Name {getSortIndicator('name')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSort('bereich')} style={[styles.sortableHeaderCell, { flex: 0.7 }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.textSecondary }]}>Bereich {getSortIndicator('bereich')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSort('position')} style={[styles.sortableHeaderCell, { flex: 0.8, marginRight: -8 }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.textSecondary }]}>Position {getSortIndicator('position')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSort('mannschaft')} style={[styles.sortableHeaderCell, { flex: 0.7 }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.textSecondary }]}>Mannschaft {getSortIndicator('mannschaft')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSort('telefon')} style={[styles.sortableHeaderCell, { flex: 1 }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.textSecondary }]}>Telefon {getSortIndicator('telefon')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSort('email')} style={[styles.sortableHeaderCell, { flex: 1.2 }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.textSecondary }]}>E-Mail {getSortIndicator('email')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {filteredContacts.length === 0 ? (
                <View style={styles.emptyState}><Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>{contacts.length === 0 ? 'Noch keine Kontakte vorhanden' : 'Keine Kontakte gefunden'}</Text></View>
              ) : (
                filteredContacts.map(contact => (
                  <TouchableOpacity key={contact.id} style={[styles.tableRow, { borderBottomColor: colors.border }]} onPress={() => { setSelectedContact(contact); setShowDesktopDetailModal(true); }}>
                    <View style={[styles.tableCellView, { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }]}>
                      {getClubLogo(contact.verein) && <Image source={{ uri: getClubLogo(contact.verein)! }} style={styles.tableClubLogo} />}
                      <Text style={[styles.tableCell, styles.tableCellBold, { color: colors.text }]} numberOfLines={1}>{contact.verein || '-'}</Text>
                    </View>
                    <Text style={[styles.tableCell, styles.tableCellBold, { flex: 1.2, color: colors.text }]}>{formatName(contact)}</Text>
                    <View style={[styles.tableCellView, { flex: 0.7 }]}>
                      {contact.bereich ? <View style={[styles.bereichBadge, { backgroundColor: contact.bereich === 'Nachwuchs' ? (isDark ? 'rgba(251, 191, 36, 0.2)' : '#fef3c7') : (isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4') }]}><Text style={[styles.bereichText, { color: contact.bereich === 'Nachwuchs' ? (isDark ? '#fbbf24' : '#92400e') : (isDark ? '#4ade80' : '#166534') }]}>{contact.bereich}</Text></View> : <Text style={[styles.tableCell, { color: colors.text }]}>-</Text>}
                    </View>
                    <View style={[styles.tableCellView, { flex: 0.8, marginRight: -8 }]}>
                      {contact.position ? <View style={[styles.positionBadge, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : '#e0f2fe' }]}><Text style={[styles.positionText, { color: isDark ? '#38bdf8' : '#0369a1' }]}>{contact.position}</Text></View> : <Text style={[styles.tableCell, { color: colors.text }]}>-</Text>}
                    </View>
                    <Text style={[styles.tableCell, { flex: 0.7, color: colors.text }]}>{contact.mannschaft || '-'}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: colors.text }]}>{formatPhone(contact)}</Text>
                    <Text style={[styles.tableCell, { flex: 1.2, color: '#3b82f6' }]}>{contact.email || '-'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </TouchableOpacity>

      {/* Desktop Detail Modal */}
      <Modal visible={showDesktopDetailModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDesktopDetailModal(false)}>
          <Pressable style={[styles.detailModalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            {selectedContact && (
              <>
                <View style={[styles.detailModalHeader, { borderBottomColor: colors.border }]}>
                  <View style={styles.detailModalNameRow}>
                    {getClubLogo(selectedContact.verein) && (
                      <Image source={{ uri: getClubLogo(selectedContact.verein)! }} style={styles.detailModalLogo} />
                    )}
                    <View>
                      <Text style={[styles.detailModalName, { color: colors.text }]}>{formatName(selectedContact)}</Text>
                      <Text style={[styles.detailModalClub, { color: colors.textSecondary }]}>{selectedContact.verein || '-'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowDesktopDetailModal(false)}>
                    <Text style={[styles.detailModalClose, { color: colors.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailModalBody}>
                  {/* Bereich, Position, Mannschaft - grouped */}
                  <View style={[styles.detailModalBox, { backgroundColor: colors.surfaceSecondary }]}>
                    <View style={styles.detailModalRow}>
                      <View style={styles.detailModalField}>
                        <Text style={[styles.detailModalLabel, { color: colors.textMuted }]}>Bereich</Text>
                        {selectedContact.bereich ? (
                          <View style={[styles.bereichBadge, { alignSelf: 'flex-start', backgroundColor: selectedContact.bereich === 'Nachwuchs' ? (isDark ? 'rgba(251, 191, 36, 0.2)' : '#fef3c7') : (isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4') }]}>
                            <Text style={[styles.bereichText, { color: selectedContact.bereich === 'Nachwuchs' ? (isDark ? '#fbbf24' : '#92400e') : (isDark ? '#4ade80' : '#166534') }]}>{selectedContact.bereich}</Text>
                          </View>
                        ) : <Text style={[styles.detailModalValue, { color: colors.text }]}>-</Text>}
                      </View>
                      <View style={styles.detailModalField}>
                        <Text style={[styles.detailModalLabel, { color: colors.textMuted }]}>Position</Text>
                        {selectedContact.position ? (
                          <View style={[styles.positionBadge, { alignSelf: 'flex-start', backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : '#e0f2fe' }]}>
                            <Text style={[styles.positionText, { color: isDark ? '#38bdf8' : '#0369a1' }]}>{selectedContact.position}</Text>
                          </View>
                        ) : <Text style={[styles.detailModalValue, { color: colors.text }]}>-</Text>}
                      </View>
                      <View style={styles.detailModalField}>
                        <Text style={[styles.detailModalLabel, { color: colors.textMuted }]}>Mannschaft</Text>
                        <Text style={[styles.detailModalValue, { color: colors.text }]}>{selectedContact.mannschaft || '-'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Telefon, E-Mail - grouped */}
                  <View style={[styles.detailModalBox, { backgroundColor: colors.surfaceSecondary }]}>
                    <View style={styles.detailModalRow}>
                      <View style={styles.detailModalField}>
                        <Text style={[styles.detailModalLabel, { color: colors.textMuted }]}>Telefon</Text>
                        <Text style={[styles.detailModalValue, { color: colors.text }]}>{formatPhone(selectedContact)}</Text>
                      </View>
                      <View style={styles.detailModalField}>
                        <Text style={[styles.detailModalLabel, { color: colors.textMuted }]}>E-Mail</Text>
                        <Text style={[styles.detailModalValue, { color: selectedContact.email ? '#3b82f6' : colors.text }]}>{selectedContact.email || '-'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Liga - separate at bottom */}
                  <View style={[styles.detailModalBox, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.detailModalLabel, { color: colors.textMuted }]}>Liga (Zugehörigkeit 1. Mannschaft)</Text>
                    <Text style={[styles.detailModalValue, { color: colors.text }]}>{selectedContact.liga || '-'}</Text>
                  </View>

                  {selectedContact.notes && (
                    <View style={[styles.detailModalBox, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.detailModalLabel, { color: colors.textMuted }]}>Weitere Informationen</Text>
                      <Text style={[styles.detailModalValue, { color: colors.text }]}>{selectedContact.notes}</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.detailModalFooter, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => { setShowDesktopDetailModal(false); openEditModal(selectedContact); }}>
                    <Text style={[styles.editButtonText, { color: colors.text }]}>Bearbeiten</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showAddModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
          <TouchableOpacity style={[styles.modalContent, { backgroundColor: colors.surface }]} activeOpacity={1} onPress={() => setActiveDropdown(null)}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editingContact ? 'Kontakt bearbeiten' : 'Neuen Kontakt anlegen'}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}><Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.formField}><Text style={[styles.formLabel, { color: colors.textSecondary }]}>Vorname</Text><TextInput style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.vorname} onChangeText={(t) => setNewContact({...newContact, vorname: t})} placeholder="Vorname" placeholderTextColor={colors.textMuted} onFocus={() => setActiveDropdown(null)} /></View>
              <View style={styles.formField}><Text style={[styles.formLabel, { color: colors.textSecondary }]}>Nachname *</Text><TextInput style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.nachname} onChangeText={(t) => setNewContact({...newContact, nachname: t})} placeholder="Nachname" placeholderTextColor={colors.textMuted} onFocus={() => setActiveDropdown(null)} /></View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Verein</Text>
                <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => setActiveDropdown(activeDropdown === 'verein' ? null : 'verein')}>
                  <Text style={newContact.verein ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.verein || 'Verein auswählen...'}</Text>
                  <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'verein' && (
                  <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput style={[styles.dropdownSearch, { borderBottomColor: colors.border, color: colors.text }]} value={vereinSearch} onChangeText={setVereinSearch} placeholder="Verein suchen..." placeholderTextColor={colors.textMuted} autoFocus />
                    <ScrollView style={styles.dropdownScroll}>
                      {filteredClubs.map(club => (
                        <TouchableOpacity key={club} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, verein: club}); setVereinSearch(''); setActiveDropdown(null); }}>
                          <View style={styles.clubItemRow}>{getClubLogo(club) && <Image source={{ uri: getClubLogo(club)! }} style={styles.clubLogo} />}<Text style={[styles.dropdownItemText, { color: colors.text }]}>{club}</Text></View>
                        </TouchableOpacity>
                      ))}
                      {vereinSearch.trim() && !clubs.includes(vereinSearch) && (
                        <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemNew, { borderBottomColor: colors.border, backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4' }]} onPress={() => { setNewContact({...newContact, verein: vereinSearch}); setVereinSearch(''); setActiveDropdown(null); }}>
                          <Text style={[styles.dropdownItemText, { color: colors.text }]}>+ "{vereinSearch}" hinzufügen</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Bereich</Text>
                <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => setActiveDropdown(activeDropdown === 'bereich' ? null : 'bereich')}>
                  <Text style={newContact.bereich ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.bereich || 'Bereich auswählen...'}</Text>
                  <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'bereich' && (
                  <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={styles.dropdownScroll}>
                      {BEREICHE.map(b => (<TouchableOpacity key={b} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, bereich: b, position: '', mannschaft: ''}); setActiveDropdown(null); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{b}</Text></TouchableOpacity>))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Position</Text>
                <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, !newContact.bereich && { backgroundColor: colors.surfaceSecondary }]} onPress={() => newContact.bereich && setActiveDropdown(activeDropdown === 'position' ? null : 'position')}>
                  <Text style={newContact.position ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.position || (newContact.bereich ? 'Position auswählen...' : 'Erst Bereich wählen')}</Text>
                  <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'position' && newContact.bereich && (
                  <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={styles.dropdownScroll}>
                      {getAvailablePositions().map(p => (<TouchableOpacity key={p} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, position: p}); setActiveDropdown(null); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{p}</Text></TouchableOpacity>))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Mannschaft</Text>
                <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, !newContact.bereich && { backgroundColor: colors.surfaceSecondary }]} onPress={() => newContact.bereich && setActiveDropdown(activeDropdown === 'mannschaft' ? null : 'mannschaft')}>
                  <Text style={newContact.mannschaft ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.mannschaft || (newContact.bereich ? 'Mannschaft auswählen...' : 'Erst Bereich wählen')}</Text>
                  <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'mannschaft' && newContact.bereich && (
                  <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={styles.dropdownScroll}>
                      {getAvailableMannschaften().map(m => (<TouchableOpacity key={m} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, mannschaft: m}); setActiveDropdown(null); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{m}</Text></TouchableOpacity>))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Liga (Zugehörigkeit 1. Mannschaft)</Text>
                <TouchableOpacity style={[styles.formSelect, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => setActiveDropdown(activeDropdown === 'liga' ? null : 'liga')}>
                  <Text style={newContact.liga ? [styles.formSelectText, { color: colors.text }] : [styles.formSelectPlaceholder, { color: colors.textMuted }]}>{newContact.liga || 'Liga auswählen...'}</Text>
                  <Text style={[styles.formSelectArrow, { color: colors.textSecondary }]}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'liga' && (
                  <View style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput style={[styles.dropdownSearch, { borderBottomColor: colors.border, color: colors.text }]} value={ligaSearch} onChangeText={setLigaSearch} placeholder="Liga suchen..." placeholderTextColor={colors.textMuted} autoFocus />
                    <ScrollView style={styles.dropdownScroll}>
                      {filteredLeagues.map(league => (
                        <TouchableOpacity key={league} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, liga: league}); setLigaSearch(''); setActiveDropdown(null); }}>
                          <Text style={[styles.dropdownItemText, { color: colors.text }]}>{league}</Text>
                        </TouchableOpacity>
                      ))}
                      {ligaSearch.trim() && !LEAGUES.includes(ligaSearch) && (
                        <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemNew, { borderBottomColor: colors.border, backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4' }]} onPress={() => { setNewContact({...newContact, liga: ligaSearch}); setLigaSearch(''); setActiveDropdown(null); }}>
                          <Text style={[styles.dropdownItemText, { color: colors.text }]}>+ "{ligaSearch}" hinzufügen</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Telefon</Text>
                <View style={styles.phoneRow}>
                  <TouchableOpacity style={[styles.countryCodeButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]} onPress={() => setActiveDropdown(activeDropdown === 'country' ? null : 'country')}>
                    <Text style={[styles.countryCodeText, { color: colors.text }]}>{newContact.telefon_code}</Text><Text style={[styles.countryCodeArrow, { color: colors.textSecondary }]}>▼</Text>
                  </TouchableOpacity>
                  <TextInput style={[styles.formInput, styles.phoneInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.telefon} onChangeText={(t) => setNewContact({...newContact, telefon: t})} placeholder="123 456789" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" onFocus={() => setActiveDropdown(null)} />
                </View>
                {activeDropdown === 'country' && (
                  <View style={[styles.dropdownList, { width: 200, backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={styles.dropdownScroll}>
                      {COUNTRY_CODES.map(cc => (<TouchableOpacity key={cc.code} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setNewContact({...newContact, telefon_code: cc.code}); setActiveDropdown(null); }}><Text style={[styles.dropdownItemText, { color: colors.text }]}>{cc.code} {cc.country}</Text></TouchableOpacity>))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}><Text style={[styles.formLabel, { color: colors.textSecondary }]}>E-Mail</Text><TextInput style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.email} onChangeText={(t) => setNewContact({...newContact, email: t})} placeholder="email@beispiel.de" placeholderTextColor={colors.textMuted} keyboardType="email-address" onFocus={() => setActiveDropdown(null)} /></View>
              <View style={styles.formField}><Text style={[styles.formLabel, { color: colors.textSecondary }]}>Weitere Informationen</Text><TextInput style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]} value={newContact.notes} onChangeText={(t) => setNewContact({...newContact, notes: t})} placeholder="Zusätzliche Informationen..." placeholderTextColor={colors.textMuted} multiline numberOfLines={3} onFocus={() => setActiveDropdown(null)} /></View>
            </ScrollView>
            <View style={[styles.modalButtonsSpaced, { borderTopColor: colors.border }]}>
              {editingContact && (
                <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
                  <Text style={styles.deleteButtonText}>Löschen</Text>
                </TouchableOpacity>
              )}
              <View style={styles.modalButtonsRight}>
                <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={closeModal}><Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={editingContact ? updateContact : addContact}><Text style={[styles.saveButtonText, { color: colors.primaryText }]}>{editingContact ? 'Speichern' : 'Hinzufügen'}</Text></TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteConfirm(false)}>
          <View style={[styles.deleteConfirmModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.deleteConfirmTitle, { color: colors.text }]}>Kontakt löschen</Text>
            <Text style={styles.deleteConfirmText}>Möchten Sie {editingContact ? `${editingContact.vorname} ${editingContact.nachname}`.trim() : 'diesen Kontakt'} wirklich löschen?</Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity style={[styles.deleteConfirmCancelBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={[styles.deleteConfirmCancelText, { color: colors.textSecondary }]}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmDeleteBtn} onPress={() => { if (editingContact) { deleteContact(editingContact.id); setShowDeleteConfirm(false); closeModal(); } }}>
                <Text style={styles.deleteConfirmDeleteText}>Löschen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  containerMobile: { flexDirection: 'column' },

  // Sidebar Overlay (Mobile)
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, flexDirection: 'row' },
  sidebarMobile: { width: 280, height: '100%', backgroundColor: '#fff' },

  mainContent: { flex: 1, backgroundColor: '#f8fafc' },
  headerBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerBannerCenter: { alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  backButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  backButtonText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 100 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  filterContainer: { flexDirection: 'row', gap: 8 },
  dropdownContainer: { position: 'relative' },
  filterButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  filterButtonText: { fontSize: 14, fontWeight: '500' },
  addButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  addButtonText: { fontSize: 14, fontWeight: '500' },
  filterDropdownMulti: { position: 'absolute', top: '100%', left: 0, minWidth: 220, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, zIndex: 1000 },
  filterDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterDropdownTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  filterClearText: { fontSize: 12, color: '#3b82f6' },
  filterCheckboxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#e2e8f0', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterCheckboxText: { flex: 1, fontSize: 14, color: '#1a1a1a' },
  filterCountBadge: { fontSize: 12, color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  filterDoneButton: { paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  filterDoneText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  content: { flex: 1, padding: 24 },
  tableContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableHeaderCell: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  sortableHeaderCell: { cursor: 'pointer' as any },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableCell: { fontSize: 14, color: '#1a1a1a' },
  tableCellBold: { fontWeight: '500' },
  tableCellView: { justifyContent: 'center' },
  positionBadge: { backgroundColor: '#e0f2fe', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start' },
  positionText: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
  bereichBadge: { backgroundColor: '#f0fdf4', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start' },
  bereichBadgeNachwuchs: { backgroundColor: '#fef3c7' },
  bereichText: { fontSize: 11, fontWeight: '600', color: '#166534' },
  bereichTextNachwuchs: { color: '#92400e' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyStateText: { fontSize: 14, color: '#64748b' },
  tableClubLogo: { width: 20, height: 20, borderRadius: 3, marginRight: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 500, maxHeight: '90%' },

  // Desktop Detail Modal
  detailModalContent: { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 550, maxHeight: '90%' },
  detailModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  detailModalNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  detailModalLogo: { width: 48, height: 48, borderRadius: 8, marginRight: 16 },
  detailModalName: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  detailModalClub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  detailModalClose: { fontSize: 24, color: '#64748b', padding: 4 },
  detailModalBody: { padding: 24 },
  detailModalBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 12 },
  detailModalRow: { flexDirection: 'row', gap: 24 },
  detailModalField: { flex: 1 },
  detailModalFieldFull: { marginBottom: 20 },
  detailModalLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: '500', textTransform: 'uppercase' },
  detailModalValue: { fontSize: 15, color: '#1a1a1a' },
  detailModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  editButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  editButtonText: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  closeButton: { padding: 8 },
  closeButtonText: { fontSize: 20, color: '#64748b' },
  modalScroll: { maxHeight: 450 },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: '500' },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff' },
  formSelect: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formSelectDisabled: { backgroundColor: '#f8fafc' },
  formSelectText: { fontSize: 14, color: '#1a1a1a' },
  formSelectPlaceholder: { fontSize: 14, color: '#9ca3af' },
  formSelectArrow: { fontSize: 12, color: '#64748b' },
  dropdownList: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  dropdownSearch: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 12, fontSize: 14 },
  dropdownScroll: { maxHeight: 180 },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemNew: { backgroundColor: '#f0fdf4' },
  dropdownItemText: { fontSize: 14, color: '#1a1a1a' },
  clubItemRow: { flexDirection: 'row', alignItems: 'center' },
  clubLogo: { width: 24, height: 24, borderRadius: 4, marginRight: 10 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  phoneRow: { flexDirection: 'row', gap: 8 },
  countryCodeButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff', minWidth: 85 },
  countryCodeText: { fontSize: 14, color: '#1a1a1a', marginRight: 4 },
  countryCodeArrow: { fontSize: 10, color: '#64748b' },
  phoneInput: { flex: 1 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  modalButtonsSpaced: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  modalButtonsRight: { flexDirection: 'row', gap: 12 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  cancelButtonText: { fontSize: 14, color: '#64748b' },
  saveButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#1a1a1a' },
  saveButtonText: { fontSize: 14, color: '#fff', fontWeight: '500' },
  deleteButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  deleteButtonText: { fontSize: 14, color: '#ef4444', fontWeight: '500' },

  // Delete Confirmation Modal
  deleteConfirmModal: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '85%', maxWidth: 280, alignItems: 'center' },
  deleteConfirmTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  deleteConfirmText: { fontSize: 13, color: '#ef4444', textAlign: 'center', marginBottom: 16 },
  deleteConfirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  deleteConfirmCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  deleteConfirmCancelText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  deleteConfirmDeleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center' },
  deleteConfirmDeleteText: { fontSize: 14, color: '#fff', fontWeight: '500' },

  // Mobile Styles
  containerMobile: { flex: 1, backgroundColor: '#f8fafc' },
  mainContentMobile: { flex: 1 },

  // Mobile Toolbar
  mobileToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  mobileSearchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  mobileSearchIcon: { marginRight: 8, fontSize: 14 },
  mobileSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  mobileFilterButton: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  mobileFilterButtonActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  mobileFilterIcon: { fontSize: 18, color: '#64748b' },
  mobileFilterIconActive: { color: '#fff' },
  filterCountBubble: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  filterCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Mobile Subheader
  mobileSubheader: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f8fafc' },
  mobileSubheaderText: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  // Mobile Card List
  mobileCardList: { flex: 1 },
  mobileCardListContent: { padding: 16 },

  // Mobile Card (matching Scouting style)
  mobileCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  mobileCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mobileCardName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  mobileCardClubRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  mobileCardClubLogo: { width: 18, height: 18, marginRight: 6 },
  mobileCardClub: { fontSize: 13, color: '#64748b', flex: 1 },
  mobileCardBadgesRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' },

  // Mobile Badges (matching Scouting style with borders)
  mobileBereichBadge: { backgroundColor: '#f0fdf4', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, borderColor: '#bbf7d0' },
  mobileBereichBadgeNachwuchs: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  mobileBereichText: { fontSize: 10, fontWeight: '500', color: '#166534' },
  mobileBereichTextNachwuchs: { color: '#92400e' },
  mobilePositionBadge: { backgroundColor: '#e0f2fe', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, borderColor: '#bae6fd' },
  mobilePositionText: { fontSize: 10, fontWeight: '500', color: '#0369a1' },

  // FAB
  fab: { position: 'absolute', bottom: 20, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { fontSize: 24, color: '#fff', fontWeight: '300', lineHeight: 26 },

  // Mobile Filter Modal
  mobileFilterModal: { flex: 1, backgroundColor: '#fff', marginTop: 60 },
  mobileFilterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  mobileFilterTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  mobileFilterClose: { fontSize: 24, color: '#64748b' },
  mobileFilterContent: { flex: 1, padding: 20 },
  mobileFilterSectionTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 12, marginTop: 16 },
  mobileChipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mobileChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  mobileChipSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  mobileChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  mobileChipTextSelected: { color: '#fff' },
  mobileFilterActions: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  mobileFilterClearButton: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  mobileFilterClearText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  mobileFilterApplyButton: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: '#1a1a1a', alignItems: 'center' },
  mobileFilterApplyText: { fontSize: 14, color: '#fff', fontWeight: '600' },

  // Mobile Detail Modal (matching Scouting sizes)
  mobileModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  mobileModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  mobileDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  mobileDetailNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  mobileDetailLogo: { width: 40, height: 40, borderRadius: 8, marginRight: 12 },
  mobileDetailName: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  mobileDetailClub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  mobileDetailClose: { fontSize: 20, color: '#64748b' },
  mobileDetailContent: { paddingHorizontal: 20, paddingVertical: 16 },
  mobileDetailBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 12 },
  mobileDetailLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  mobileDetailValue: { fontSize: 13, color: '#1a1a1a' },
  mobileDetailFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  mobileDeleteButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' },
  mobileDeleteText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  mobileEditButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#64748b', alignItems: 'center' },
  mobileEditText: { fontSize: 16, color: '#64748b', fontWeight: '600' },

  // Mobile Form Modal
  mobileFormModal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '95%', maxHeight: '95%' },

  // Empty State
  emptyText: { textAlign: 'center', color: '#64748b', fontSize: 14, paddingVertical: 40 },
});
