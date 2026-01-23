import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';

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

export function FootballNetworkScreen({ navigation }: any) {
  const isMobile = useIsMobile();
  const { session, loading: authLoading } = useAuth();
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
    return result;
  }, [contacts, searchText, selectedPositions, selectedLeagues, selectedBereiche]);

  const togglePosition = (p: string) => setSelectedPositions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const toggleLeague = (l: string) => setSelectedLeagues(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleBereich = (b: string) => setSelectedBereiche(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  const closeAllDropdowns = () => { setShowPositionDropdown(false); setShowLeagueDropdown(false); setShowBereichDropdown(false); };
  const formatPhone = (c: Contact) => c.telefon ? `${c.telefon_code || ''} ${c.telefon}`.trim() : '-';
  const formatName = (c: Contact) => c.nachname && c.vorname ? `${c.nachname}, ${c.vorname}` : c.nachname || c.vorname || '-';

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
        style={styles.mobileCard}
        onPress={() => handleContactClick(contact)}
      >
        {/* Row 1: Name (left) | Position badges (right) */}
        <View style={styles.mobileCardRow}>
          <Text style={styles.mobileCardName}>{formatName(contact)}</Text>
          <View style={styles.mobileCardBadgesRow}>
            {(contact.position || contact.mannschaft) && (
              <View style={styles.mobilePositionBadge}>
                <Text style={styles.mobilePositionText}>{[contact.position, contact.mannschaft].filter(Boolean).join(' · ')}</Text>
              </View>
            )}
          </View>
        </View>
        {/* Row 2: Club with logo (left) | Bereich badge (right) */}
        <View style={styles.mobileCardRow}>
          <View style={styles.mobileCardClubRow}>
            {logoUrl && <Image source={{ uri: logoUrl }} style={styles.mobileCardClubLogo} />}
            <Text style={styles.mobileCardClub} numberOfLines={1}>{contact.verein || '-'}</Text>
          </View>
          {contact.bereich && (
            <View style={[styles.mobileBereichBadge, contact.bereich === 'Nachwuchs' && styles.mobileBereichBadgeNachwuchs]}>
              <Text style={[styles.mobileBereichText, contact.bereich === 'Nachwuchs' && styles.mobileBereichTextNachwuchs]}>{contact.bereich}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Mobile View
  if (isMobile) {
    return (
      <View style={styles.containerMobile}>
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="network"
          profile={profile}
        />

        <View style={styles.mainContentMobile}>
          <MobileHeader
            title="Network"
            onMenuPress={() => setShowMobileSidebar(true)}
            onProfilePress={() => navigation.navigate('MyProfile')}
            profileInitials={profileInitials}
          />

          {/* Mobile Toolbar */}
          <View style={styles.mobileToolbar}>
            <View style={styles.mobileSearchContainer}>
              <Text style={styles.mobileSearchIcon}>🔍</Text>
              <TextInput
                style={styles.mobileSearchInput}
                placeholder="Name, Verein suchen..."
                placeholderTextColor="#9ca3af"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
            <TouchableOpacity
              style={[styles.mobileFilterButton, activeFilterCount > 0 && styles.mobileFilterButtonActive]}
              onPress={() => setShowMobileFilters(true)}
            >
              <Ionicons name="filter" size={20} color={activeFilterCount > 0 ? "#fff" : "#64748b"} />
              {activeFilterCount > 0 && (
                <View style={styles.filterCountBubble}>
                  <Text style={styles.filterCountText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Contact Count */}
          <View style={styles.mobileSubheader}>
            <Text style={styles.mobileSubheaderText}>{filteredContacts.length} Kontakte</Text>
          </View>

          {/* Contact Cards */}
          <ScrollView style={styles.mobileCardList} contentContainerStyle={styles.mobileCardListContent}>
            {filteredContacts.length === 0 ? (
              <Text style={styles.emptyText}>
                {contacts.length === 0 ? 'Noch keine Kontakte vorhanden' : 'Keine Kontakte gefunden'}
              </Text>
            ) : (
              filteredContacts.map(contact => renderMobileContactCard(contact))
            )}
          </ScrollView>

          {/* FAB Button */}
          <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Mobile Filter Modal */}
        <Modal visible={showMobileFilters} transparent animationType="slide">
          <View style={styles.mobileFilterModal}>
            <View style={styles.mobileFilterHeader}>
              <Text style={styles.mobileFilterTitle}>Filter</Text>
              <TouchableOpacity onPress={() => setShowMobileFilters(false)}>
                <Text style={styles.mobileFilterClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.mobileFilterContent}>
              {/* Bereich Filter */}
              <Text style={styles.mobileFilterSectionTitle}>Bereich</Text>
              <View style={styles.mobileChipContainer}>
                {BEREICHE.map(bereich => {
                  const isSelected = selectedBereiche.includes(bereich);
                  return (
                    <TouchableOpacity
                      key={bereich}
                      style={[styles.mobileChip, isSelected && styles.mobileChipSelected]}
                      onPress={() => toggleBereich(bereich)}
                    >
                      <Text style={[styles.mobileChipText, isSelected && styles.mobileChipTextSelected]}>
                        {bereich}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Position Filter */}
              <Text style={styles.mobileFilterSectionTitle}>Position</Text>
              <View style={styles.mobileChipContainer}>
                {ALL_POSITIONS.map(position => {
                  const isSelected = selectedPositions.includes(position);
                  return (
                    <TouchableOpacity
                      key={position}
                      style={[styles.mobileChip, isSelected && styles.mobileChipSelected]}
                      onPress={() => togglePosition(position)}
                    >
                      <Text style={[styles.mobileChipText, isSelected && styles.mobileChipTextSelected]}>
                        {position}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Liga Filter */}
              <Text style={styles.mobileFilterSectionTitle}>Liga</Text>
              <View style={styles.mobileChipContainer}>
                {LEAGUES.map(league => {
                  const isSelected = selectedLeagues.includes(league);
                  return (
                    <TouchableOpacity
                      key={league}
                      style={[styles.mobileChip, isSelected && styles.mobileChipSelected]}
                      onPress={() => toggleLeague(league)}
                    >
                      <Text style={[styles.mobileChipText, isSelected && styles.mobileChipTextSelected]}>
                        {league}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Filter Actions */}
            <View style={styles.mobileFilterActions}>
              <TouchableOpacity
                style={styles.mobileFilterClearButton}
                onPress={() => { setSelectedBereiche([]); setSelectedPositions([]); setSelectedLeagues([]); }}
              >
                <Text style={styles.mobileFilterClearText}>Zurücksetzen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileFilterApplyButton} onPress={() => setShowMobileFilters(false)}>
                <Text style={styles.mobileFilterApplyText}>Anwenden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Mobile Contact Detail Modal */}
        <Modal visible={showContactDetailModal} transparent animationType="slide">
          <View style={styles.mobileModalOverlay}>
            <View style={[styles.mobileModalContent, { maxHeight: '95%' }]}>
              {selectedContact && (
                <>
                  <View style={styles.mobileDetailHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mobileDetailName}>{formatName(selectedContact)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        {getClubLogo(selectedContact.verein) && (
                          <Image source={{ uri: getClubLogo(selectedContact.verein)! }} style={{ width: 18, height: 18, marginRight: 6 }} />
                        )}
                        <Text style={{ fontSize: 14, color: '#64748b' }}>{selectedContact.verein || '-'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setShowContactDetailModal(false)}>
                      <Text style={styles.mobileDetailClose}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.mobileDetailContent}>
                    {/* Bereich | Position | Mannschaft */}
                    <View style={styles.mobileDetailBox}>
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mobileDetailLabel}>Bereich</Text>
                          {selectedContact.bereich ? (
                            <View style={[styles.mobileBereichBadge, selectedContact.bereich === 'Nachwuchs' && styles.mobileBereichBadgeNachwuchs, { alignSelf: 'flex-start' }]}>
                              <Text style={[styles.mobileBereichText, selectedContact.bereich === 'Nachwuchs' && styles.mobileBereichTextNachwuchs]}>{selectedContact.bereich}</Text>
                            </View>
                          ) : <Text style={styles.mobileDetailValue}>-</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mobileDetailLabel}>Position</Text>
                          {selectedContact.position ? (
                            <View style={[styles.mobilePositionBadge, { alignSelf: 'flex-start' }]}>
                              <Text style={styles.mobilePositionText}>{selectedContact.position}</Text>
                            </View>
                          ) : <Text style={styles.mobileDetailValue}>-</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mobileDetailLabel}>Mannschaft</Text>
                          {selectedContact.mannschaft ? (
                            <View style={[styles.mobilePositionBadge, { alignSelf: 'flex-start' }]}>
                              <Text style={styles.mobilePositionText}>{selectedContact.mannschaft}</Text>
                            </View>
                          ) : <Text style={styles.mobileDetailValue}>-</Text>}
                        </View>
                      </View>
                    </View>

                    {/* Telefon | E-Mail */}
                    <View style={styles.mobileDetailBox}>
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mobileDetailLabel}>Telefon</Text>
                          <Text style={styles.mobileDetailValue}>{formatPhone(selectedContact)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mobileDetailLabel}>E-Mail</Text>
                          <Text style={[styles.mobileDetailValue, selectedContact.email && { color: '#3b82f6' }]} numberOfLines={1}>{selectedContact.email || '-'}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Liga */}
                    <View style={styles.mobileDetailBox}>
                      <Text style={styles.mobileDetailLabel}>Liga (Zugehörigkeit 1. Mannschaft)</Text>
                      <Text style={styles.mobileDetailValue}>{selectedContact.liga || '-'}</Text>
                    </View>

                    {/* Weitere Informationen */}
                    {selectedContact.notes && (
                      <View style={[styles.mobileDetailBox, { marginBottom: 0 }]}>
                        <Text style={styles.mobileDetailLabel}>Weitere Informationen</Text>
                        <Text style={styles.mobileDetailValue}>{selectedContact.notes}</Text>
                      </View>
                    )}
                  </ScrollView>

                  <View style={styles.mobileDetailFooter}>
                    <TouchableOpacity style={styles.mobileEditButton} onPress={openEditFromDetail}>
                      <Text style={styles.mobileEditText}>Bearbeiten</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Add/Edit Modal for Mobile */}
        <Modal visible={showAddModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
            <TouchableOpacity style={styles.mobileFormModal} activeOpacity={1} onPress={() => setActiveDropdown(null)}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingContact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}><Text style={styles.closeButtonText}>✕</Text></TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <View style={styles.formField}><Text style={styles.formLabel}>Vorname</Text><TextInput style={styles.formInput} value={newContact.vorname} onChangeText={(t) => setNewContact({...newContact, vorname: t})} placeholder="Vorname" placeholderTextColor="#9ca3af" onFocus={() => setActiveDropdown(null)} /></View>
                <View style={styles.formField}><Text style={styles.formLabel}>Nachname *</Text><TextInput style={styles.formInput} value={newContact.nachname} onChangeText={(t) => setNewContact({...newContact, nachname: t})} placeholder="Nachname" placeholderTextColor="#9ca3af" onFocus={() => setActiveDropdown(null)} /></View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Verein</Text>
                  <TouchableOpacity style={styles.formSelect} onPress={() => setActiveDropdown(activeDropdown === 'verein' ? null : 'verein')}>
                    <Text style={newContact.verein ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.verein || 'Verein auswählen...'}</Text>
                    <Text style={styles.formSelectArrow}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'verein' && (
                    <View style={styles.dropdownList}>
                      <TextInput style={styles.dropdownSearch} value={vereinSearch} onChangeText={setVereinSearch} placeholder="Verein suchen..." placeholderTextColor="#9ca3af" autoFocus />
                      <ScrollView style={styles.dropdownScroll}>
                        {filteredClubs.map(club => (
                          <TouchableOpacity key={club} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, verein: club}); setVereinSearch(''); setActiveDropdown(null); }}>
                            <View style={styles.clubItemRow}>{getClubLogo(club) && <Image source={{ uri: getClubLogo(club)! }} style={styles.clubLogo} />}<Text style={styles.dropdownItemText}>{club}</Text></View>
                          </TouchableOpacity>
                        ))}
                        {vereinSearch.trim() && !clubs.includes(vereinSearch) && (
                          <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemNew]} onPress={() => { setNewContact({...newContact, verein: vereinSearch}); setVereinSearch(''); setActiveDropdown(null); }}>
                            <Text style={styles.dropdownItemText}>+ "{vereinSearch}" hinzufügen</Text>
                          </TouchableOpacity>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Bereich</Text>
                  <TouchableOpacity style={styles.formSelect} onPress={() => setActiveDropdown(activeDropdown === 'bereich' ? null : 'bereich')}>
                    <Text style={newContact.bereich ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.bereich || 'Bereich auswählen...'}</Text>
                    <Text style={styles.formSelectArrow}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'bereich' && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={styles.dropdownScroll}>
                        {BEREICHE.map(b => (<TouchableOpacity key={b} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, bereich: b, position: '', mannschaft: ''}); setActiveDropdown(null); }}><Text style={styles.dropdownItemText}>{b}</Text></TouchableOpacity>))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Position</Text>
                  <TouchableOpacity style={[styles.formSelect, !newContact.bereich && styles.formSelectDisabled]} onPress={() => newContact.bereich && setActiveDropdown(activeDropdown === 'position' ? null : 'position')}>
                    <Text style={newContact.position ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.position || (newContact.bereich ? 'Position auswählen...' : 'Erst Bereich wählen')}</Text>
                    <Text style={styles.formSelectArrow}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'position' && newContact.bereich && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={styles.dropdownScroll}>
                        {getAvailablePositions().map(p => (<TouchableOpacity key={p} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, position: p}); setActiveDropdown(null); }}><Text style={styles.dropdownItemText}>{p}</Text></TouchableOpacity>))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Mannschaft</Text>
                  <TouchableOpacity style={[styles.formSelect, !newContact.bereich && styles.formSelectDisabled]} onPress={() => newContact.bereich && setActiveDropdown(activeDropdown === 'mannschaft' ? null : 'mannschaft')}>
                    <Text style={newContact.mannschaft ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.mannschaft || (newContact.bereich ? 'Mannschaft auswählen...' : 'Erst Bereich wählen')}</Text>
                    <Text style={styles.formSelectArrow}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'mannschaft' && newContact.bereich && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={styles.dropdownScroll}>
                        {getAvailableMannschaften().map(m => (<TouchableOpacity key={m} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, mannschaft: m}); setActiveDropdown(null); }}><Text style={styles.dropdownItemText}>{m}</Text></TouchableOpacity>))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Liga (Zugehörigkeit 1. Mannschaft)</Text>
                  <TouchableOpacity style={styles.formSelect} onPress={() => setActiveDropdown(activeDropdown === 'liga' ? null : 'liga')}>
                    <Text style={newContact.liga ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.liga || 'Liga auswählen...'}</Text>
                    <Text style={styles.formSelectArrow}>▼</Text>
                  </TouchableOpacity>
                  {activeDropdown === 'liga' && (
                    <View style={styles.dropdownList}>
                      <TextInput style={styles.dropdownSearch} value={ligaSearch} onChangeText={setLigaSearch} placeholder="Liga suchen..." placeholderTextColor="#9ca3af" autoFocus />
                      <ScrollView style={styles.dropdownScroll}>
                        {filteredLeagues.map(league => (
                          <TouchableOpacity key={league} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, liga: league}); setLigaSearch(''); setActiveDropdown(null); }}>
                            <Text style={styles.dropdownItemText}>{league}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Telefon</Text>
                  <View style={styles.phoneRow}>
                    <TouchableOpacity style={styles.countryCodeButton} onPress={() => setActiveDropdown(activeDropdown === 'country' ? null : 'country')}>
                      <Text style={styles.countryCodeText}>{newContact.telefon_code}</Text><Text style={styles.countryCodeArrow}>▼</Text>
                    </TouchableOpacity>
                    <TextInput style={[styles.formInput, styles.phoneInput]} value={newContact.telefon} onChangeText={(t) => setNewContact({...newContact, telefon: t})} placeholder="123 456789" placeholderTextColor="#9ca3af" keyboardType="phone-pad" onFocus={() => setActiveDropdown(null)} />
                  </View>
                  {activeDropdown === 'country' && (
                    <View style={[styles.dropdownList, { width: 200 }]}>
                      <ScrollView style={styles.dropdownScroll}>
                        {COUNTRY_CODES.map(cc => (<TouchableOpacity key={cc.code} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, telefon_code: cc.code}); setActiveDropdown(null); }}><Text style={styles.dropdownItemText}>{cc.code} {cc.country}</Text></TouchableOpacity>))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formField}><Text style={styles.formLabel}>E-Mail</Text><TextInput style={styles.formInput} value={newContact.email} onChangeText={(t) => setNewContact({...newContact, email: t})} placeholder="email@beispiel.de" placeholderTextColor="#9ca3af" keyboardType="email-address" onFocus={() => setActiveDropdown(null)} /></View>
                <View style={styles.formField}><Text style={styles.formLabel}>Weitere Informationen</Text><TextInput style={[styles.formInput, styles.textArea]} value={newContact.notes} onChangeText={(t) => setNewContact({...newContact, notes: t})} placeholder="Zusätzliche Informationen..." placeholderTextColor="#9ca3af" multiline numberOfLines={3} onFocus={() => setActiveDropdown(null)} /></View>
              </ScrollView>
              <View style={styles.modalButtonsSpaced}>
                {editingContact && (
                  <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
                    <Text style={styles.deleteButtonText}>Löschen</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.modalButtonsRight}>
                  <TouchableOpacity style={styles.cancelButton} onPress={closeModal}><Text style={styles.cancelButtonText}>Abbrechen</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={editingContact ? updateContact : addContact}><Text style={styles.saveButtonText}>{editingContact ? 'Speichern' : 'Hinzufügen'}</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Delete Confirmation Modal - Mobile */}
        <Modal visible={showDeleteConfirm} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteConfirm(false)}>
            <View style={styles.deleteConfirmModal}>
              <Text style={styles.deleteConfirmTitle}>Kontakt löschen</Text>
              <Text style={styles.deleteConfirmText}>Möchten Sie {editingContact ? `${editingContact.vorname} ${editingContact.nachname}`.trim() : 'diesen Kontakt'} wirklich löschen?</Text>
              <View style={styles.deleteConfirmButtons}>
                <TouchableOpacity style={styles.deleteConfirmCancelBtn} onPress={() => setShowDeleteConfirm(false)}>
                  <Text style={styles.deleteConfirmCancelText}>Abbrechen</Text>
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
    <View style={[styles.container, isMobile && styles.containerMobile]}>
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

      <TouchableOpacity style={styles.mainContent} activeOpacity={1} onPress={closeAllDropdowns}>
        {/* Mobile Header */}
        {isMobile && (
          <MobileHeader
            title="Network"
            onMenuPress={() => setShowMobileSidebar(true)}
            onProfilePress={() => navigation.navigate('MyProfile')}
            profileInitials={profileInitials}
          />
        )}

        {/* Desktop Header */}
        {!isMobile && (
          <View style={styles.headerBanner}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('AdvisorDashboard')}><Text style={styles.backButtonText}>← Zurück</Text></TouchableOpacity>
            <View style={styles.headerBannerCenter}><Text style={styles.title}>Football Network</Text><Text style={styles.subtitle}>Kontakte zu Vereinen und Entscheidern</Text></View>
            <View style={{ width: 100 }} />
          </View>
        )}

        <View style={styles.toolbar}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput style={styles.searchInput} placeholder="Verein, Namen suchen..." placeholderTextColor="#9ca3af" value={searchText} onChangeText={setSearchText} />
          </View>
          <View style={styles.filterContainer}>
            <View style={[styles.dropdownContainer, { zIndex: 40 }]}>
              <TouchableOpacity style={[styles.filterButton, selectedBereiche.length > 0 && styles.filterButtonActive]} onPress={(e) => { e.stopPropagation(); setShowBereichDropdown(!showBereichDropdown); setShowPositionDropdown(false); setShowLeagueDropdown(false); }}>
                <Text style={[styles.filterButtonText, selectedBereiche.length > 0 && styles.filterButtonTextActive]}>{selectedBereiche.length === 0 ? 'Bereich' : selectedBereiche.length === 1 ? selectedBereiche[0] : `${selectedBereiche.length} Bereiche`} ▼</Text>
              </TouchableOpacity>
              {showBereichDropdown && (
                <View style={styles.filterDropdownMulti}>
                  <View style={styles.filterDropdownHeader}><Text style={styles.filterDropdownTitle}>Bereich wählen</Text>{selectedBereiche.length > 0 && <TouchableOpacity onPress={() => setSelectedBereiche([])}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}</View>
                  <ScrollView style={{ maxHeight: 200 }}>{BEREICHE.map(b => (<TouchableOpacity key={b} style={styles.filterCheckboxItem} onPress={() => toggleBereich(b)}><View style={[styles.checkbox, selectedBereiche.includes(b) && styles.checkboxSelected]}>{selectedBereiche.includes(b) && <Text style={styles.checkmark}>✓</Text>}</View><Text style={styles.filterCheckboxText}>{b}</Text><Text style={styles.filterCountBadge}>{contacts.filter(c => c.bereich === b).length}</Text></TouchableOpacity>))}</ScrollView>
                  <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowBereichDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </View>
              )}
            </View>
            <View style={[styles.dropdownContainer, { zIndex: 30 }]}>
              <TouchableOpacity style={[styles.filterButton, selectedPositions.length > 0 && styles.filterButtonActive]} onPress={(e) => { e.stopPropagation(); setShowPositionDropdown(!showPositionDropdown); setShowLeagueDropdown(false); setShowBereichDropdown(false); }}>
                <Text style={[styles.filterButtonText, selectedPositions.length > 0 && styles.filterButtonTextActive]}>{selectedPositions.length === 0 ? 'Position' : selectedPositions.length === 1 ? selectedPositions[0] : `${selectedPositions.length} Positionen`} ▼</Text>
              </TouchableOpacity>
              {showPositionDropdown && (
                <View style={styles.filterDropdownMulti}>
                  <View style={styles.filterDropdownHeader}><Text style={styles.filterDropdownTitle}>Position wählen</Text>{selectedPositions.length > 0 && <TouchableOpacity onPress={() => setSelectedPositions([])}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}</View>
                  <ScrollView style={{ maxHeight: 250 }}>{ALL_POSITIONS.map(p => (<TouchableOpacity key={p} style={styles.filterCheckboxItem} onPress={() => togglePosition(p)}><View style={[styles.checkbox, selectedPositions.includes(p) && styles.checkboxSelected]}>{selectedPositions.includes(p) && <Text style={styles.checkmark}>✓</Text>}</View><Text style={styles.filterCheckboxText}>{p}</Text><Text style={styles.filterCountBadge}>{contacts.filter(c => c.position === p).length}</Text></TouchableOpacity>))}</ScrollView>
                  <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowPositionDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </View>
              )}
            </View>
            <View style={[styles.dropdownContainer, { zIndex: 20 }]}>
              <TouchableOpacity style={[styles.filterButton, selectedLeagues.length > 0 && styles.filterButtonActive]} onPress={(e) => { e.stopPropagation(); setShowLeagueDropdown(!showLeagueDropdown); setShowPositionDropdown(false); setShowBereichDropdown(false); }}>
                <Text style={[styles.filterButtonText, selectedLeagues.length > 0 && styles.filterButtonTextActive]}>{selectedLeagues.length === 0 ? 'Liga' : selectedLeagues.length === 1 ? selectedLeagues[0] : `${selectedLeagues.length} Ligen`} ▼</Text>
              </TouchableOpacity>
              {showLeagueDropdown && (
                <View style={styles.filterDropdownMulti}>
                  <View style={styles.filterDropdownHeader}><Text style={styles.filterDropdownTitle}>Liga wählen</Text>{selectedLeagues.length > 0 && <TouchableOpacity onPress={() => setSelectedLeagues([])}><Text style={styles.filterClearText}>Alle löschen</Text></TouchableOpacity>}</View>
                  <ScrollView style={{ maxHeight: 250 }}>{LEAGUES.map(l => (<TouchableOpacity key={l} style={styles.filterCheckboxItem} onPress={() => toggleLeague(l)}><View style={[styles.checkbox, selectedLeagues.includes(l) && styles.checkboxSelected]}>{selectedLeagues.includes(l) && <Text style={styles.checkmark}>✓</Text>}</View><Text style={styles.filterCheckboxText}>{l}</Text><Text style={styles.filterCountBadge}>{contacts.filter(c => c.liga === l).length}</Text></TouchableOpacity>))}</ScrollView>
                  <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowLeagueDropdown(false)}><Text style={styles.filterDoneText}>Fertig</Text></TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}><Text style={styles.addButtonText}>+ neuen Kontakt anlegen</Text></TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Verein</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Name</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Bereich</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8, marginRight: -8 }]}>Position</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Mannschaft</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Telefon</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>E-Mail</Text>
            </View>
            <ScrollView>
              {filteredContacts.length === 0 ? (
                <View style={styles.emptyState}><Text style={styles.emptyStateText}>{contacts.length === 0 ? 'Noch keine Kontakte vorhanden' : 'Keine Kontakte gefunden'}</Text></View>
              ) : (
                filteredContacts.map(contact => (
                  <TouchableOpacity key={contact.id} style={styles.tableRow} onPress={() => { setSelectedContact(contact); setShowDesktopDetailModal(true); }}>
                    <View style={[styles.tableCellView, { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }]}>
                      {getClubLogo(contact.verein) && <Image source={{ uri: getClubLogo(contact.verein)! }} style={styles.tableClubLogo} />}
                      <Text style={[styles.tableCell, styles.tableCellBold]} numberOfLines={1}>{contact.verein || '-'}</Text>
                    </View>
                    <Text style={[styles.tableCell, styles.tableCellBold, { flex: 1.2 }]}>{formatName(contact)}</Text>
                    <View style={[styles.tableCellView, { flex: 0.7 }]}>
                      {contact.bereich ? <View style={[styles.bereichBadge, contact.bereich === 'Nachwuchs' && styles.bereichBadgeNachwuchs]}><Text style={[styles.bereichText, contact.bereich === 'Nachwuchs' && styles.bereichTextNachwuchs]}>{contact.bereich}</Text></View> : <Text style={styles.tableCell}>-</Text>}
                    </View>
                    <View style={[styles.tableCellView, { flex: 0.8, marginRight: -8 }]}>
                      {contact.position ? <View style={styles.positionBadge}><Text style={styles.positionText}>{contact.position}</Text></View> : <Text style={styles.tableCell}>-</Text>}
                    </View>
                    <Text style={[styles.tableCell, { flex: 0.7 }]}>{contact.mannschaft || '-'}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{formatPhone(contact)}</Text>
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
          <Pressable style={styles.detailModalContent} onPress={(e) => e.stopPropagation()}>
            {selectedContact && (
              <>
                <View style={styles.detailModalHeader}>
                  <View style={styles.detailModalNameRow}>
                    {getClubLogo(selectedContact.verein) && (
                      <Image source={{ uri: getClubLogo(selectedContact.verein)! }} style={styles.detailModalLogo} />
                    )}
                    <View>
                      <Text style={styles.detailModalName}>{formatName(selectedContact)}</Text>
                      <Text style={styles.detailModalClub}>{selectedContact.verein || '-'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowDesktopDetailModal(false)}>
                    <Text style={styles.detailModalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailModalBody}>
                  {/* Bereich, Position, Mannschaft - grouped */}
                  <View style={styles.detailModalBox}>
                    <View style={styles.detailModalRow}>
                      <View style={styles.detailModalField}>
                        <Text style={styles.detailModalLabel}>Bereich</Text>
                        {selectedContact.bereich ? (
                          <View style={[styles.bereichBadge, selectedContact.bereich === 'Nachwuchs' && styles.bereichBadgeNachwuchs, { alignSelf: 'flex-start' }]}>
                            <Text style={[styles.bereichText, selectedContact.bereich === 'Nachwuchs' && styles.bereichTextNachwuchs]}>{selectedContact.bereich}</Text>
                          </View>
                        ) : <Text style={styles.detailModalValue}>-</Text>}
                      </View>
                      <View style={styles.detailModalField}>
                        <Text style={styles.detailModalLabel}>Position</Text>
                        {selectedContact.position ? (
                          <View style={[styles.positionBadge, { alignSelf: 'flex-start' }]}>
                            <Text style={styles.positionText}>{selectedContact.position}</Text>
                          </View>
                        ) : <Text style={styles.detailModalValue}>-</Text>}
                      </View>
                      <View style={styles.detailModalField}>
                        <Text style={styles.detailModalLabel}>Mannschaft</Text>
                        <Text style={styles.detailModalValue}>{selectedContact.mannschaft || '-'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Telefon, E-Mail - grouped */}
                  <View style={styles.detailModalBox}>
                    <View style={styles.detailModalRow}>
                      <View style={styles.detailModalField}>
                        <Text style={styles.detailModalLabel}>Telefon</Text>
                        <Text style={styles.detailModalValue}>{formatPhone(selectedContact)}</Text>
                      </View>
                      <View style={styles.detailModalField}>
                        <Text style={styles.detailModalLabel}>E-Mail</Text>
                        <Text style={[styles.detailModalValue, selectedContact.email && { color: '#3b82f6' }]}>{selectedContact.email || '-'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Liga - separate at bottom */}
                  <View style={styles.detailModalBox}>
                    <Text style={styles.detailModalLabel}>Liga (Zugehörigkeit 1. Mannschaft)</Text>
                    <Text style={styles.detailModalValue}>{selectedContact.liga || '-'}</Text>
                  </View>

                  {selectedContact.notes && (
                    <View style={styles.detailModalBox}>
                      <Text style={styles.detailModalLabel}>Weitere Informationen</Text>
                      <Text style={styles.detailModalValue}>{selectedContact.notes}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailModalFooter}>
                  <TouchableOpacity style={styles.editButton} onPress={() => { setShowDesktopDetailModal(false); openEditModal(selectedContact); }}>
                    <Text style={styles.editButtonText}>Bearbeiten</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showAddModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => setActiveDropdown(null)}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingContact ? 'Kontakt bearbeiten' : 'Neuen Kontakt anlegen'}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}><Text style={styles.closeButtonText}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.formField}><Text style={styles.formLabel}>Vorname</Text><TextInput style={styles.formInput} value={newContact.vorname} onChangeText={(t) => setNewContact({...newContact, vorname: t})} placeholder="Vorname" placeholderTextColor="#9ca3af" onFocus={() => setActiveDropdown(null)} /></View>
              <View style={styles.formField}><Text style={styles.formLabel}>Nachname *</Text><TextInput style={styles.formInput} value={newContact.nachname} onChangeText={(t) => setNewContact({...newContact, nachname: t})} placeholder="Nachname" placeholderTextColor="#9ca3af" onFocus={() => setActiveDropdown(null)} /></View>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Verein</Text>
                <TouchableOpacity style={styles.formSelect} onPress={() => setActiveDropdown(activeDropdown === 'verein' ? null : 'verein')}>
                  <Text style={newContact.verein ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.verein || 'Verein auswählen...'}</Text>
                  <Text style={styles.formSelectArrow}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'verein' && (
                  <View style={styles.dropdownList}>
                    <TextInput style={styles.dropdownSearch} value={vereinSearch} onChangeText={setVereinSearch} placeholder="Verein suchen..." placeholderTextColor="#9ca3af" autoFocus />
                    <ScrollView style={styles.dropdownScroll}>
                      {filteredClubs.map(club => (
                        <TouchableOpacity key={club} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, verein: club}); setVereinSearch(''); setActiveDropdown(null); }}>
                          <View style={styles.clubItemRow}>{getClubLogo(club) && <Image source={{ uri: getClubLogo(club)! }} style={styles.clubLogo} />}<Text style={styles.dropdownItemText}>{club}</Text></View>
                        </TouchableOpacity>
                      ))}
                      {vereinSearch.trim() && !clubs.includes(vereinSearch) && (
                        <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemNew]} onPress={() => { setNewContact({...newContact, verein: vereinSearch}); setVereinSearch(''); setActiveDropdown(null); }}>
                          <Text style={styles.dropdownItemText}>+ "{vereinSearch}" hinzufügen</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Bereich</Text>
                <TouchableOpacity style={styles.formSelect} onPress={() => setActiveDropdown(activeDropdown === 'bereich' ? null : 'bereich')}>
                  <Text style={newContact.bereich ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.bereich || 'Bereich auswählen...'}</Text>
                  <Text style={styles.formSelectArrow}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'bereich' && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll}>
                      {BEREICHE.map(b => (<TouchableOpacity key={b} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, bereich: b, position: '', mannschaft: ''}); setActiveDropdown(null); }}><Text style={styles.dropdownItemText}>{b}</Text></TouchableOpacity>))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Position</Text>
                <TouchableOpacity style={[styles.formSelect, !newContact.bereich && styles.formSelectDisabled]} onPress={() => newContact.bereich && setActiveDropdown(activeDropdown === 'position' ? null : 'position')}>
                  <Text style={newContact.position ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.position || (newContact.bereich ? 'Position auswählen...' : 'Erst Bereich wählen')}</Text>
                  <Text style={styles.formSelectArrow}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'position' && newContact.bereich && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll}>
                      {getAvailablePositions().map(p => (<TouchableOpacity key={p} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, position: p}); setActiveDropdown(null); }}><Text style={styles.dropdownItemText}>{p}</Text></TouchableOpacity>))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Mannschaft</Text>
                <TouchableOpacity style={[styles.formSelect, !newContact.bereich && styles.formSelectDisabled]} onPress={() => newContact.bereich && setActiveDropdown(activeDropdown === 'mannschaft' ? null : 'mannschaft')}>
                  <Text style={newContact.mannschaft ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.mannschaft || (newContact.bereich ? 'Mannschaft auswählen...' : 'Erst Bereich wählen')}</Text>
                  <Text style={styles.formSelectArrow}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'mannschaft' && newContact.bereich && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll}>
                      {getAvailableMannschaften().map(m => (<TouchableOpacity key={m} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, mannschaft: m}); setActiveDropdown(null); }}><Text style={styles.dropdownItemText}>{m}</Text></TouchableOpacity>))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Liga (Zugehörigkeit 1. Mannschaft)</Text>
                <TouchableOpacity style={styles.formSelect} onPress={() => setActiveDropdown(activeDropdown === 'liga' ? null : 'liga')}>
                  <Text style={newContact.liga ? styles.formSelectText : styles.formSelectPlaceholder}>{newContact.liga || 'Liga auswählen...'}</Text>
                  <Text style={styles.formSelectArrow}>▼</Text>
                </TouchableOpacity>
                {activeDropdown === 'liga' && (
                  <View style={styles.dropdownList}>
                    <TextInput style={styles.dropdownSearch} value={ligaSearch} onChangeText={setLigaSearch} placeholder="Liga suchen..." placeholderTextColor="#9ca3af" autoFocus />
                    <ScrollView style={styles.dropdownScroll}>
                      {filteredLeagues.map(league => (
                        <TouchableOpacity key={league} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, liga: league}); setLigaSearch(''); setActiveDropdown(null); }}>
                          <Text style={styles.dropdownItemText}>{league}</Text>
                        </TouchableOpacity>
                      ))}
                      {ligaSearch.trim() && !LEAGUES.includes(ligaSearch) && (
                        <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemNew]} onPress={() => { setNewContact({...newContact, liga: ligaSearch}); setLigaSearch(''); setActiveDropdown(null); }}>
                          <Text style={styles.dropdownItemText}>+ "{ligaSearch}" hinzufügen</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Telefon</Text>
                <View style={styles.phoneRow}>
                  <TouchableOpacity style={styles.countryCodeButton} onPress={() => setActiveDropdown(activeDropdown === 'country' ? null : 'country')}>
                    <Text style={styles.countryCodeText}>{newContact.telefon_code}</Text><Text style={styles.countryCodeArrow}>▼</Text>
                  </TouchableOpacity>
                  <TextInput style={[styles.formInput, styles.phoneInput]} value={newContact.telefon} onChangeText={(t) => setNewContact({...newContact, telefon: t})} placeholder="123 456789" placeholderTextColor="#9ca3af" keyboardType="phone-pad" onFocus={() => setActiveDropdown(null)} />
                </View>
                {activeDropdown === 'country' && (
                  <View style={[styles.dropdownList, { width: 200 }]}>
                    <ScrollView style={styles.dropdownScroll}>
                      {COUNTRY_CODES.map(cc => (<TouchableOpacity key={cc.code} style={styles.dropdownItem} onPress={() => { setNewContact({...newContact, telefon_code: cc.code}); setActiveDropdown(null); }}><Text style={styles.dropdownItemText}>{cc.code} {cc.country}</Text></TouchableOpacity>))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formField}><Text style={styles.formLabel}>E-Mail</Text><TextInput style={styles.formInput} value={newContact.email} onChangeText={(t) => setNewContact({...newContact, email: t})} placeholder="email@beispiel.de" placeholderTextColor="#9ca3af" keyboardType="email-address" onFocus={() => setActiveDropdown(null)} /></View>
              <View style={styles.formField}><Text style={styles.formLabel}>Weitere Informationen</Text><TextInput style={[styles.formInput, styles.textArea]} value={newContact.notes} onChangeText={(t) => setNewContact({...newContact, notes: t})} placeholder="Zusätzliche Informationen..." placeholderTextColor="#9ca3af" multiline numberOfLines={3} onFocus={() => setActiveDropdown(null)} /></View>
            </ScrollView>
            <View style={styles.modalButtonsSpaced}>
              {editingContact && (
                <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
                  <Text style={styles.deleteButtonText}>Löschen</Text>
                </TouchableOpacity>
              )}
              <View style={styles.modalButtonsRight}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeModal}><Text style={styles.cancelButtonText}>Abbrechen</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={editingContact ? updateContact : addContact}><Text style={styles.saveButtonText}>{editingContact ? 'Speichern' : 'Hinzufügen'}</Text></TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteConfirm(false)}>
          <View style={styles.deleteConfirmModal}>
            <Text style={styles.deleteConfirmTitle}>Kontakt löschen</Text>
            <Text style={styles.deleteConfirmText}>Möchten Sie {editingContact ? `${editingContact.vorname} ${editingContact.nachname}`.trim() : 'diesen Kontakt'} wirklich löschen?</Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity style={styles.deleteConfirmCancelBtn} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.deleteConfirmCancelText}>Abbrechen</Text>
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
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 100 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  filterContainer: { flexDirection: 'row', gap: 8 },
  dropdownContainer: { position: 'relative' },
  filterButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  filterButtonActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  filterButtonText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  filterButtonTextActive: { color: '#fff' },
  addButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#1a1a1a' },
  addButtonText: { fontSize: 14, color: '#fff', fontWeight: '500' },
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
