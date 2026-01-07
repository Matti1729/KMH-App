import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Image, Platform, Pressable } from 'react-native';
import { supabase } from '../../config/supabase';

const TRANSFER_STATUS = [
  { id: 'ideen', label: 'IDEEN', color: '#64748b' },
  { id: 'offen', label: 'OFFEN / INTERESSE', color: '#3b82f6' },
  { id: 'absage', label: 'ABSAGE', color: '#ef4444' },
];

const POSITION_FULL: Record<string, string> = {
  'TW': 'Torwart',
  'IV': 'Innenverteidiger',
  'LV': 'Linker Verteidiger',
  'RV': 'Rechter Verteidiger',
  'DM': 'Defensives Mittelfeld',
  'ZM': 'Zentrales Mittelfeld',
  'OM': 'Offensives Mittelfeld',
  'LA': 'Linksaußen',
  'RA': 'Rechtsaußen',
  'ST': 'Stürmer',
  'Torwart': 'Torwart',
  'Innenverteidiger': 'Innenverteidiger',
  'Linker Verteidiger': 'Linker Verteidiger',
  'Rechter Verteidiger': 'Rechter Verteidiger',
  'Defensives Mittelfeld': 'Defensives Mittelfeld',
  'Zentrales Mittelfeld': 'Zentrales Mittelfeld',
  'Offensives Mittelfeld': 'Offensives Mittelfeld',
  'Linksaußen': 'Linksaußen',
  'Rechtsaußen': 'Rechtsaußen',
  'Stürmer': 'Stürmer',
};

const getFullPosition = (pos: string): string => {
  if (!pos) return '-';
  const positions = pos.split(',').map(p => p.trim());
  return positions.map(p => POSITION_FULL[p] || p).join(', ');
};

const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

interface TransferClub {
  id: string;
  player_id: string;
  club_name: string;
  status: string;
  advisor_name: string;
  last_contact: string;
  notes: string;
  reminder_days: number;
  created_at: string;
  updated_at: string;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  birth_date: string;
  club: string;
  contract_end: string;
  photo_url: string;
  responsibility: string;
}

interface ClubLogo {
  club_name: string;
  logo_url: string;
}

type ViewMode = 'kanban' | 'liste';

export function TransferDetailScreen({ route, navigation }: any) {
  const { playerId } = route.params;
  const [player, setPlayer] = useState<Player | null>(null);
  const [clubs, setClubs] = useState<TransferClub[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [allClubNames, setAllClubNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClub, setSelectedClub] = useState<TransferClub | null>(null);
  
  // Form states
  const [clubSearch, setClubSearch] = useState('');
  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    club_name: '',
    status: 'ideen',
    advisor_name: '',
    last_contact: '',
    notes: '',
    reminder_days: 30,
  });
  
  // Date picker states
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  
  // Date constants
  const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const currentYear = new Date().getFullYear();
  // Jahre von aktuellem Jahr bis 2070, plus 10 Jahre zurück
  const YEARS = [
    ...Array.from({ length: 2070 - currentYear + 1 }, (_, i) => currentYear + i),
    ...Array.from({ length: 10 }, (_, i) => currentYear - i - 1)
  ].sort((a, b) => a - b);
  
  // Drag state for web
  const [draggedClub, setDraggedClub] = useState<TransferClub | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayer();
    fetchClubs();
    fetchClubLogos();
  }, []);

  const fetchPlayer = async () => {
    const { data } = await supabase
      .from('player_details')
      .select('id, first_name, last_name, position, birth_date, club, contract_end, photo_url, responsibility')
      .eq('id', playerId)
      .single();
    if (data) setPlayer(data);
  };

  const fetchClubs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transfer_clubs')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    if (data) setClubs(data);
    setLoading(false);
  };

  const fetchClubLogos = async () => {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const logoMap: Record<string, string> = {};
      const names: string[] = [];
      data.forEach((item: ClubLogo) => {
        logoMap[item.club_name] = item.logo_url;
        names.push(item.club_name);
      });
      setClubLogos(logoMap);
      setAllClubNames(names.sort());
    }
  };

  const getClubLogo = (clubName: string): string | null => {
    if (!clubName) return null;
    if (clubLogos[clubName]) return clubLogos[clubName];
    for (const [logoClub, logoUrl] of Object.entries(clubLogos)) {
      if (clubName.toLowerCase().includes(logoClub.toLowerCase()) || 
          logoClub.toLowerCase().includes(clubName.toLowerCase())) {
        return logoUrl;
      }
    }
    return null;
  };

  const getFilteredClubNames = (search: string): string[] => {
    if (!search || search.length < 2) return [];
    return allClubNames.filter(c => c.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    // Parse YYYY-MM-DD direkt ohne Timezone-Probleme
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[0], 10);
      return `${day}.${month}.${year}`;
    }
    return '-';
  };

  const parseDateToParts = (dateStr: string): { day: number; month: number; year: number } | null => {
    if (!dateStr) return null;
    // Parse YYYY-MM-DD direkt
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-basiert für Konsistenz
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return { day, month, year };
  };

  const buildDateFromParts = (day: number, month: number, year: number): string => {
    // month ist 0-basiert (0=Januar, 11=Dezember)
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const closeAllDropdowns = () => {
    setShowDayPicker(false);
    setShowMonthPicker(false);
    setShowYearPicker(false);
    setShowClubSuggestions(false);
  };

  const addClub = async () => {
    if (!formData.club_name.trim()) return;
    
    const { error } = await supabase.from('transfer_clubs').insert({
      player_id: playerId,
      club_name: formData.club_name,
      status: formData.status,
      advisor_name: formData.advisor_name,
      last_contact: formData.last_contact || null,
      notes: formData.notes,
      reminder_days: formData.reminder_days,
    });
    
    if (!error) {
      setShowAddModal(false);
      resetForm();
      fetchClubs();
    }
  };

  const updateClub = async () => {
    if (!selectedClub) return;
    
    const { error } = await supabase
      .from('transfer_clubs')
      .update({
        club_name: formData.club_name,
        status: formData.status,
        advisor_name: formData.advisor_name,
        last_contact: formData.last_contact || null,
        notes: formData.notes,
        reminder_days: formData.reminder_days,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedClub.id);
    
    if (!error) {
      setShowEditModal(false);
      setSelectedClub(null);
      resetForm();
      fetchClubs();
    }
  };

  const deleteClub = async (clubId: string) => {
    await supabase.from('transfer_clubs').delete().eq('id', clubId);
    fetchClubs();
    setShowEditModal(false);
    setSelectedClub(null);
  };

  const updateClubStatus = async (clubId: string, newStatus: string) => {
    await supabase
      .from('transfer_clubs')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', clubId);
    fetchClubs();
  };

  const resetForm = () => {
    setFormData({
      club_name: '',
      status: 'ideen',
      advisor_name: '',
      last_contact: '',
      notes: '',
      reminder_days: 30,
    });
    setClubSearch('');
    closeAllDropdowns();
  };

  const openEditModal = (club: TransferClub) => {
    setSelectedClub(club);
    setFormData({
      club_name: club.club_name,
      status: club.status,
      advisor_name: club.advisor_name || '',
      last_contact: club.last_contact || '',
      notes: club.notes || '',
      reminder_days: club.reminder_days || 30,
    });
    setClubSearch(club.club_name);
    closeAllDropdowns();
    setShowEditModal(true);
  };

  // Drag & Drop handlers for web
  const handleDragStart = (club: TransferClub) => {
    setDraggedClub(club);
  };

  const handleDragOver = (e: any, statusId: string) => {
    e.preventDefault();
    setDropTarget(statusId);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: any, newStatus: string) => {
    e.preventDefault();
    if (draggedClub && draggedClub.status !== newStatus) {
      updateClubStatus(draggedClub.id, newStatus);
    }
    setDraggedClub(null);
    setDropTarget(null);
  };

  const getClubsByStatus = (statusId: string): TransferClub[] => {
    return clubs.filter(c => c.status === statusId);
  };

  const renderClubCard = (club: TransferClub) => {
    const logo = getClubLogo(club.club_name);
    
    if (Platform.OS === 'web') {
      return (
        <div
          key={club.id}
          draggable
          onDragStart={() => handleDragStart(club)}
          onDragEnd={() => { setDraggedClub(null); setDropTarget(null); }}
          style={{ 
            cursor: 'grab',
            opacity: draggedClub?.id === club.id ? 0.5 : 1,
          }}
        >
          <TouchableOpacity style={styles.clubCard} onPress={() => openEditModal(club)}>
            <View style={styles.clubCardHeader}>
              {logo && (
                <Image source={{ uri: logo }} style={styles.clubLogo} />
              )}
              <Text style={styles.clubName}>{club.club_name}</Text>
            </View>
            {club.advisor_name && (
              <View style={styles.clubCardRow}>
                <Text style={styles.clubCardIcon}>👤</Text>
                <Text style={styles.clubCardText}>{club.advisor_name}</Text>
              </View>
            )}
            {club.last_contact && (
              <View style={styles.clubCardRow}>
                <Text style={styles.clubCardIcon}>🕐</Text>
                <Text style={styles.clubCardText}>Letzter Kontakt: {formatDate(club.last_contact)}</Text>
              </View>
            )}
            {club.notes && (
              <Text style={styles.clubNotes}>"{club.notes}"</Text>
            )}
          </TouchableOpacity>
        </div>
      );
    }

    return (
      <TouchableOpacity key={club.id} style={styles.clubCard} onPress={() => openEditModal(club)}>
        <View style={styles.clubCardHeader}>
          {logo && (
            <Image source={{ uri: logo }} style={styles.clubLogo} />
          )}
          <Text style={styles.clubName}>{club.club_name}</Text>
        </View>
        {club.advisor_name && (
          <View style={styles.clubCardRow}>
            <Text style={styles.clubCardIcon}>👤</Text>
            <Text style={styles.clubCardText}>{club.advisor_name}</Text>
          </View>
        )}
        {club.last_contact && (
          <View style={styles.clubCardRow}>
            <Text style={styles.clubCardIcon}>🕐</Text>
            <Text style={styles.clubCardText}>Letzter Kontakt: {formatDate(club.last_contact)}</Text>
          </View>
        )}
        {club.notes && (
          <Text style={styles.clubNotes}>"{club.notes}"</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderKanbanColumn = (status: typeof TRANSFER_STATUS[0]) => {
    const columnClubs = getClubsByStatus(status.id);
    const isDropTarget = dropTarget === status.id;

    if (Platform.OS === 'web') {
      return (
        <div
          key={status.id}
          onDragOver={(e) => handleDragOver(e, status.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, status.id)}
          style={{
            flex: 1,
            backgroundColor: '#f8fafc',
            borderRadius: 10,
            padding: 10,
            border: isDropTarget ? '2px dashed #3b82f6' : '1px solid #e2e8f0',
            transition: 'background-color 0.2s',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <View style={styles.kanbanHeader}>
            <Text style={styles.kanbanTitle}>{status.label}</Text>
            <View style={[styles.countBadge, { backgroundColor: status.color }]}>
              <Text style={styles.countText}>{columnClubs.length}</Text>
            </View>
          </View>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {columnClubs.length === 0 ? (
              <Text style={styles.emptyColumn}>Leer</Text>
            ) : (
              columnClubs.map(club => renderClubCard(club))
            )}
          </div>
        </div>
      );
    }

    return (
      <View key={status.id} style={[styles.kanbanColumn, isDropTarget && styles.kanbanColumnDropTarget]}>
        <View style={styles.kanbanHeader}>
          <Text style={styles.kanbanTitle}>{status.label}</Text>
          <View style={[styles.countBadge, { backgroundColor: status.color }]}>
            <Text style={styles.countText}>{columnClubs.length}</Text>
          </View>
        </View>
        <ScrollView style={styles.kanbanContent} showsVerticalScrollIndicator={false}>
          {columnClubs.length === 0 ? (
            <Text style={styles.emptyColumn}>Leer</Text>
          ) : (
            columnClubs.map(club => renderClubCard(club))
          )}
        </ScrollView>
      </View>
    );
  };

  const renderListView = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Verein</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Ansprechpartner</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Letzter Kontakt</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Notiz</Text>
      </View>
      <ScrollView>
        {clubs.map(club => (
          <TouchableOpacity key={club.id} style={styles.tableRow} onPress={() => openEditModal(club)}>
            <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
              {getClubLogo(club.club_name) && (
                <Image source={{ uri: getClubLogo(club.club_name)! }} style={styles.tableLogo} />
              )}
              <Text style={styles.tableCellText}>{club.club_name}</Text>
            </View>
            <Text style={[styles.tableCell, { flex: 1.2 }]}>{club.advisor_name || '-'}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{club.last_contact ? formatDate(club.last_contact) : '-'}</Text>
            <View style={[styles.tableCell, { flex: 1 }]}>
              <View style={[styles.statusBadge, { backgroundColor: TRANSFER_STATUS.find(s => s.id === club.status)?.color }]}>
                <Text style={styles.statusBadgeText}>{TRANSFER_STATUS.find(s => s.id === club.status)?.label}</Text>
              </View>
            </View>
            <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{club.notes || '-'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderForm = () => {
    const filteredClubs = getFilteredClubNames(clubSearch);
    
    // Parse existing date direkt aus String
    const dateParts = parseDateToParts(formData.last_contact);
    const displayDay = dateParts?.day ?? null;
    const displayMonth = dateParts?.month ?? null;
    const displayYear = dateParts?.year ?? null;
    
    // For building new dates, use current values or sensible defaults
    const buildDay = displayDay ?? 1;
    const buildMonth = displayMonth ?? new Date().getMonth();
    const buildYear = displayYear ?? currentYear;
    
    const updateDatePart = (part: 'day' | 'month' | 'year', value: number) => {
      let newDay = buildDay;
      let newMonth = buildMonth;
      let newYear = buildYear;
      
      if (part === 'day') newDay = value;
      if (part === 'month') newMonth = value;
      if (part === 'year') newYear = value;
      
      // Ensure day is valid for the month (month ist 0-basiert)
      const maxDays = new Date(newYear, newMonth + 1, 0).getDate();
      if (newDay > maxDays) newDay = maxDays;
      
      setFormData({ ...formData, last_contact: buildDateFromParts(newDay, newMonth, newYear) });
    };
    
    return (
      <Pressable onPress={() => closeAllDropdowns()}>
        <View style={[styles.formRow, { zIndex: 300 }]}>
          <Text style={styles.formLabel}>Verein *</Text>
          <View style={styles.autocompleteContainer}>
            <TouchableOpacity 
              style={styles.clubDropdownButton}
              onPress={() => { closeAllDropdowns(); setShowClubSuggestions(!showClubSuggestions); }}
            >
              <Text style={[styles.clubDropdownText, !formData.club_name && { color: '#999' }]}>
                {formData.club_name || 'Verein auswählen...'}
              </Text>
              <Text style={styles.clubDropdownArrow}>▼</Text>
            </TouchableOpacity>
            {showClubSuggestions && (
              <Pressable style={styles.clubSuggestionsList} onPress={(e) => e.stopPropagation()}>
                <TextInput
                  style={styles.clubSearchInput}
                  value={clubSearch}
                  onChangeText={(text) => {
                    setClubSearch(text);
                  }}
                  placeholder="Suchen oder eigenen Namen eingeben..."
                  placeholderTextColor="#999"
                  autoFocus
                />
                <ScrollView style={styles.clubSuggestionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {/* Option für eigenen Namen wenn Text eingegeben */}
                  {clubSearch.length >= 2 && !allClubNames.some(n => n.toLowerCase() === clubSearch.toLowerCase()) && (
                    <TouchableOpacity
                      style={[styles.clubSuggestionItem, styles.clubSuggestionItemCustom]}
                      onPress={() => {
                        setFormData({ ...formData, club_name: clubSearch });
                        setClubSearch('');
                        setShowClubSuggestions(false);
                      }}
                    >
                      <Text style={styles.clubSuggestionTextCustom}>"{clubSearch}" verwenden</Text>
                    </TouchableOpacity>
                  )}
                  {(clubSearch.length >= 2 ? filteredClubs : allClubNames.slice(0, 15)).map(name => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.clubSuggestionItem, formData.club_name === name && styles.clubSuggestionItemSelected]}
                      onPress={() => {
                        setFormData({ ...formData, club_name: name });
                        setClubSearch('');
                        setShowClubSuggestions(false);
                      }}
                    >
                      <Text style={[styles.clubSuggestionText, formData.club_name === name && styles.clubSuggestionTextSelected]}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.statusSelector}>
            {TRANSFER_STATUS.map(status => (
              <TouchableOpacity
                key={status.id}
                style={[styles.statusOption, formData.status === status.id && { backgroundColor: status.color }]}
                onPress={() => { setFormData({ ...formData, status: status.id }); closeAllDropdowns(); }}
              >
                <Text style={[styles.statusOptionText, formData.status === status.id && { color: '#fff' }]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Ansprechpartner</Text>
          <TextInput
            style={styles.formInput}
            value={formData.advisor_name}
            onChangeText={(text) => setFormData({ ...formData, advisor_name: text })}
            onFocus={() => closeAllDropdowns()}
            placeholder="z.B. Sportdirektor Max Müller"
            placeholderTextColor="#999"
          />
        </View>

        <View style={[styles.formRow, { zIndex: 200 }]}>
          <Text style={styles.formLabel}>Letzter Kontakt</Text>
          <View style={styles.datePickerRow}>
            {/* Day Picker */}
            <View style={[styles.datePickerFieldSmall, { zIndex: showDayPicker ? 210 : 1 }]}>
              <TouchableOpacity 
                style={styles.dateDropdownButton} 
                onPress={() => { closeAllDropdowns(); setShowDayPicker(!showDayPicker); }}
              >
                <Text style={[styles.dateDropdownText, !displayDay && { color: '#999' }]}>{displayDay || 'Tag'}</Text>
                <Text style={styles.dateDropdownArrow}>▼</Text>
              </TouchableOpacity>
              {showDayPicker && (
                <View style={styles.datePickerList}>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {DAYS.map((d) => (
                      <TouchableOpacity 
                        key={d} 
                        style={[styles.datePickerItem, displayDay === d && styles.datePickerItemSelected]} 
                        onPress={() => { 
                          updateDatePart('day', d);
                          setShowDayPicker(false);
                        }}
                      >
                        <Text style={[styles.datePickerItemText, displayDay === d && styles.datePickerItemTextSelected]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Month Picker */}
            <View style={[styles.datePickerFieldMedium, { zIndex: showMonthPicker ? 210 : 1 }]}>
              <TouchableOpacity 
                style={styles.dateDropdownButton} 
                onPress={() => { closeAllDropdowns(); setShowMonthPicker(!showMonthPicker); }}
              >
                <Text style={[styles.dateDropdownText, displayMonth === null && { color: '#999' }]}>{displayMonth !== null ? MONTHS[displayMonth] : 'Monat'}</Text>
                <Text style={styles.dateDropdownArrow}>▼</Text>
              </TouchableOpacity>
              {showMonthPicker && (
                <View style={[styles.datePickerList, { minWidth: 110 }]}>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {MONTHS.map((m, idx) => (
                      <TouchableOpacity 
                        key={m} 
                        style={[styles.datePickerItem, displayMonth === idx && styles.datePickerItemSelected]} 
                        onPress={() => { 
                          updateDatePart('month', idx);
                          setShowMonthPicker(false);
                        }}
                      >
                        <Text style={[styles.datePickerItemText, displayMonth === idx && styles.datePickerItemTextSelected]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Year Picker */}
            <View style={[styles.datePickerFieldSmall, { zIndex: showYearPicker ? 210 : 1 }]}>
              <TouchableOpacity 
                style={styles.dateDropdownButton} 
                onPress={() => { closeAllDropdowns(); setShowYearPicker(!showYearPicker); }}
              >
                <Text style={[styles.dateDropdownText, !displayYear && { color: '#999' }]}>{displayYear || 'Jahr'}</Text>
                <Text style={styles.dateDropdownArrow}>▼</Text>
              </TouchableOpacity>
              {showYearPicker && (
                <View style={styles.datePickerList}>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {YEARS.map((y) => (
                      <TouchableOpacity 
                        key={y} 
                        style={[styles.datePickerItem, displayYear === y && styles.datePickerItemSelected]} 
                        onPress={() => { 
                          updateDatePart('year', y);
                          setShowYearPicker(false);
                        }}
                      >
                        <Text style={[styles.datePickerItemText, displayYear === y && styles.datePickerItemTextSelected]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Erinnerung in (Tagen)</Text>
          <TextInput
            style={styles.reminderInput}
            value={formData.reminder_days.toString()}
            onChangeText={(text) => setFormData({ ...formData, reminder_days: parseInt(text) || 30 })}
            onFocus={() => closeAllDropdowns()}
            keyboardType="numeric"
            placeholder="30"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Notizen</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            onFocus={() => closeAllDropdowns()}
            placeholder="z.B. Interesse hinterlegt beim Sportdirektor"
            placeholderTextColor="#999"
            multiline
          />
        </View>
      </Pressable>
    );
  };

  if (!player) {
    return (
      <View style={styles.modalOverlayContainer}>
        <View style={styles.modalContainer}>
          <Text style={styles.loadingText}>Laden...</Text>
        </View>
      </View>
    );
  }

  const playerClubLogo = getClubLogo(player.club);

  return (
    <View style={styles.modalOverlayContainer}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={() => navigation.goBack()} activeOpacity={1} />
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Interessenten / Vereine</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Player Info - ohne Bild, mit Alter und Position */}
          <View style={styles.topSection}>
            <View style={styles.topLeft}>
              <Text style={styles.playerFirstName}>{player.first_name}</Text>
              <Text style={styles.playerLastName}>{player.last_name}</Text>
              <Text style={styles.playerMeta}>{calculateAge(player.birth_date)} Jahre • {getFullPosition(player.position)}</Text>
            </View>
            
            <View style={styles.topRight}>
              {playerClubLogo ? (
                <Image source={{ uri: playerClubLogo }} style={styles.clubLogoHeader} />
              ) : (
                <Text style={styles.clubNameHeader}>{player.club || '-'}</Text>
              )}
            </View>
          </View>

          {/* Toolbar */}
          <View style={styles.toolbar}>
            <View style={styles.toolbarLeft}>
              <View style={styles.viewToggle}>
                <TouchableOpacity
                  style={[styles.viewButton, viewMode === 'kanban' && styles.viewButtonActive]}
                  onPress={() => setViewMode('kanban')}
                >
                  <Text style={styles.viewButtonText}>▦</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewButton, viewMode === 'liste' && styles.viewButtonActive]}
                  onPress={() => setViewMode('liste')}
                >
                  <Text style={styles.viewButtonText}>☰</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setShowAddModal(true); }}>
              <Text style={styles.addButtonText}>+ Neuen Verein anlegen</Text>
            </TouchableOpacity>
          </View>

          {/* Kanban / List Content */}
          {viewMode === 'kanban' ? (
            <View style={styles.kanbanContainer}>
              {TRANSFER_STATUS.map(status => renderKanbanColumn(status))}
            </View>
          ) : (
            renderListView()
          )}
        </View>

        {/* Add Modal */}
        <Modal visible={showAddModal} transparent animationType="fade">
          <Pressable style={styles.formModalOverlay} onPress={() => setShowAddModal(false)}>
            <Pressable style={styles.formModalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.formModalTitle}>Neuen Verein anlegen</Text>
              {renderForm()}
              <View style={styles.formModalButtons}>
                <TouchableOpacity style={styles.formModalCancelButton} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.formModalCancelText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.formModalSaveButton} onPress={addClub}>
                  <Text style={styles.formModalSaveText}>Hinzufügen</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Edit Modal */}
        <Modal visible={showEditModal} transparent animationType="fade">
          <Pressable style={styles.formModalOverlay} onPress={() => setShowEditModal(false)}>
            <Pressable style={styles.formModalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.formModalTitle}>Verein bearbeiten</Text>
              {renderForm()}
              <View style={styles.formModalButtons}>
                <TouchableOpacity style={styles.formModalDeleteButton} onPress={() => selectedClub && deleteClub(selectedClub.id)}>
                  <Text style={styles.formModalDeleteText}>Löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.formModalCancelButton} onPress={() => setShowEditModal(false)}>
                  <Text style={styles.formModalCancelText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.formModalSaveButton} onPress={updateClub}>
                  <Text style={styles.formModalSaveText}>Speichern</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Modal Container - mit sichtbarem Hintergrund
  modalOverlayContainer: { 
    flex: 1, 
    backgroundColor: 'transparent', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    width: '92%',
    maxWidth: 1100,
    height: '90%',
    maxHeight: 800,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  
  // Header - kompakter
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 12, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0', 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16,
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  closeButton: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  closeButtonText: { color: '#64748b', fontSize: 16 },
  
  content: { flex: 1, padding: 12 },
  
  // Top Section - ohne Bild
  topSection: { 
    flexDirection: 'row', 
    backgroundColor: '#f8fafc', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLeft: { flex: 1 },
  playerFirstName: { fontSize: 16, color: '#666' },
  playerLastName: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  playerMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  topRight: { alignItems: 'center', justifyContent: 'center' },
  clubLogoHeader: { width: 45, height: 45, resizeMode: 'contain' },
  clubNameHeader: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center', maxWidth: 80 },
  
  // Toolbar - kompakter
  toolbar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 6, padding: 3, borderWidth: 1, borderColor: '#e2e8f0' },
  viewButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4 },
  viewButtonActive: { backgroundColor: '#f1f5f9' },
  viewButtonText: { fontSize: 14, color: '#64748b' },
  addButton: { 
    backgroundColor: '#000', 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 6,
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  
  // Kanban - kompakter aber höher
  kanbanContainer: { flexDirection: 'row', gap: 12, flex: 1 },
  kanbanColumn: { 
    flex: 1, 
    backgroundColor: '#f8fafc', 
    borderRadius: 10, 
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kanbanColumnDropTarget: { backgroundColor: '#f0f9ff', borderWidth: 2, borderColor: '#3b82f6', borderStyle: 'dashed' },
  kanbanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  kanbanTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', flex: 1 },
  countBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
  countText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  kanbanContent: { flex: 1 },
  emptyColumn: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', marginTop: 16, fontSize: 12 },
  
  // Club Card - kompakter
  clubCard: { 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    padding: 10, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    shadowColor: '#000', 
    shadowOpacity: 0.03, 
    shadowRadius: 2, 
    shadowOffset: { width: 0, height: 1 },
  },
  clubCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  clubLogo: { width: 24, height: 24, borderRadius: 3, marginRight: 8, resizeMode: 'contain' },
  clubLogoPlaceholder: { width: 24, height: 24, borderRadius: 3, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  clubLogoText: { fontSize: 9, fontWeight: '600', color: '#64748b' },
  clubName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  clubCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  clubCardIcon: { marginRight: 4, fontSize: 10 },
  clubCardText: { fontSize: 11, color: '#64748b' },
  clubNotes: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  
  // Table
  tableContainer: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableHeaderCell: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableCell: { fontSize: 14, color: '#334155' },
  tableCellText: { fontWeight: '500' },
  tableLogo: { width: 24, height: 24, marginRight: 10, resizeMode: 'contain' },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  
  // Form Modal
  formModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  formModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 450, overflow: 'visible' },
  formModalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16, textAlign: 'center' },
  formModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16, zIndex: -1 },
  formModalCancelButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
  formModalCancelText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  formModalSaveButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#10b981' },
  formModalSaveText: { color: '#10b981', fontWeight: '600', fontSize: 14 },
  formModalDeleteButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#fef2f2', marginRight: 'auto' },
  formModalDeleteText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  
  // Form
  formContainer: { gap: 16 },
  formScrollContainer: { maxHeight: 400 },
  formRow: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, backgroundColor: '#fff' },
  formTextArea: { minHeight: 80, textAlignVertical: 'top' },
  autocompleteContainer: { position: 'relative', zIndex: 300 },
  
  // Club Dropdown
  clubDropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fff' },
  clubDropdownText: { fontSize: 15, color: '#333', flex: 1 },
  clubDropdownArrow: { fontSize: 12, color: '#64748b', marginLeft: 8 },
  clubSuggestionsList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, zIndex: 9999, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 20, marginTop: 4 },
  clubSearchInput: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 10, paddingHorizontal: 14, fontSize: 14 },
  clubSuggestionsScroll: { maxHeight: 200 },
  clubSuggestionItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  clubSuggestionItemSelected: { backgroundColor: '#f0f9ff' },
  clubSuggestionItemCustom: { backgroundColor: '#f0fdf4', borderBottomColor: '#bbf7d0' },
  clubSuggestionText: { fontSize: 14, color: '#1a1a1a' },
  clubSuggestionTextSelected: { color: '#3b82f6', fontWeight: '600' },
  clubSuggestionTextCustom: { fontSize: 14, color: '#16a34a', fontWeight: '500' },
  
  statusSelector: { flexDirection: 'row', gap: 8 },
  statusOption: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  statusOptionText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  
  // Date Picker - unterschiedliche Breiten
  datePickerRow: { flexDirection: 'row', gap: 8 },
  datePickerFieldSmall: { position: 'relative', width: 70 },
  datePickerFieldMedium: { position: 'relative', width: 100 },
  dateDropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#fff' },
  dateDropdownText: { fontSize: 13, color: '#333' },
  dateDropdownArrow: { fontSize: 10, color: '#64748b' },
  datePickerList: { position: 'absolute', top: '100%', left: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, maxHeight: 180, zIndex: 9999, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 20, marginTop: 4, minWidth: 70 },
  datePickerScroll: { maxHeight: 180 },
  datePickerItem: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  datePickerItemSelected: { backgroundColor: '#f0f9ff' },
  datePickerItemText: { fontSize: 13, color: '#333' },
  datePickerItemTextSelected: { color: '#3b82f6', fontWeight: '600' },
  
  // Reminder Input - gleiche Größe wie Date Picker
  reminderInput: { width: 70, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, fontSize: 13, backgroundColor: '#fff', textAlign: 'center' },
});
