import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { getRelevantTermine, convertToDbFormat, getLastUpdateDisplay, getDFBTermineCount, getHallenTermineCount } from '../../services/dfbTermine';
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

type ViewMode = 'dashboard' | 'spiele' | 'termine' | 'kalender';
type SortField = 'datum' | 'art' | 'titel' | 'jahrgang' | 'ort' | 'uebernahme';
type SortDirection = 'asc' | 'desc';

// Nur diese 3 Optionen beim Anlegen
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

  useEffect(() => { fetchProfile(); fetchAdvisors(); fetchTermine(); }, []);

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
    const oneDayAgo = new Date(); oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const { data, error } = await supabase.from('termine').select('*').gte('datum', oneDayAgo.toISOString()).order('datum', { ascending: true });
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

  const handleDeleteTermin = async () => {
    if (!selectedTermin) return;
    const { error } = await supabase.from('termine').delete().eq('id', selectedTermin.id);
    if (error) { alert('Fehler: ' + error.message); } 
    else { setShowEditModal(false); setSelectedTermin(null); fetchTermine(); }
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

  // Prüfen ob Nationalmannschaft oder Hallenturnier - muss vor getSortedTermine sein
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
          // Alphabetisch nach angezeigtem Art-Namen
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

  // Datum formatieren mit kurzem Jahr (26 statt 2026)
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
      // Wenn gleicher Monat, nur Tag anzeigen
      if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
        return `${startDay}.-${formatShort(endDate)}`;
      }
      return `${startDay}.${startMonth}.-${formatShort(endDate)}`;
    }
    return formatShort(startDate);
  };

  // Zeit nur anzeigen wenn echte Zeit vorhanden (nicht 00:00, 01:00, 02:00 etc.)
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    // Wenn Stunde 0, 1 oder 2 und Minuten 0 ist, dann keine echte Zeit
    if ((hours === 0 || hours === 1 || hours === 2) && minutes === 0) return '';
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const isTerminPast = (dateString: string): boolean => new Date(dateString) < new Date();
  
  // Prüfen ob Termin heute ist
  const isTerminToday = (termin: Termin): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startDate = new Date(termin.datum);
    const endDate = termin.datum_ende ? new Date(termin.datum_ende) : startDate;
    
    // Termin ist heute wenn: Start <= heute < morgen ODER heute liegt zwischen Start und Ende
    return (startDate >= today && startDate < tomorrow) || 
           (startDate <= today && endDate >= today);
  };
  
  const getUpcomingTermineCount = (): number => termine.filter(t => new Date(t.datum) >= new Date()).length;
  const getUrgentTermineCount = (): number => { 
    const now = new Date(); 
    const in7Days = new Date(now.getTime() + 7*24*60*60*1000); 
    return termine.filter(t => { const d = new Date(t.datum); return d >= now && d <= in7Days; }).length; 
  };

  // Art-Anzeige: DFB-Maßnahme, DFB-Spiel etc. → "Nationalmannschaft"
  const getDisplayArt = (art: string): string => {
    if (art === 'DFB-Maßnahme' || art === 'DFB-Spiel' || art === 'DFB' || art === 'Nationalmannschaft') {
      return 'Nationalmannschaft';
    }
    return art;
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
      <Text style={styles.tableHeaderText}>{label} {getSortIndicator(field)}</Text>
    </TouchableOpacity>
  );

  const renderDashboard = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.gridContainer}>
        <View style={styles.row}>
          <DashboardCard id="spiele" style={styles.mainCard} onPress={() => setViewMode('spiele')} hoverStyle={styles.mainCardHovered}>
            <View style={styles.mainCardContent}>
              <View style={styles.mainCardLeft}>
                <View style={styles.comingSoonBadge}><Text style={styles.comingSoonBadgeText}>COMING SOON</Text></View>
                <Text style={styles.mainCardTitle}>Spiele unserer Spieler</Text>
                <Text style={styles.mainCardSubtitle}>Alle Partien deiner Mandanten{'\n'}automatisch von fußball.de</Text>
                <View style={styles.mainCardFooter}><Text style={styles.mainCardLink}>Zur Übersicht</Text><Text style={styles.mainCardArrow}>→</Text></View>
              </View>
              <View style={styles.mainCardRight}><Text style={styles.mainCardIcon}>⚽</Text></View>
            </View>
          </DashboardCard>
          <View style={styles.rightColumn}>
            <DashboardCard id="termine" style={styles.termineCard} onPress={() => setViewMode('termine')} hoverStyle={styles.lightCardHovered}>
              <View style={styles.termineHeader}>
                <View style={styles.termineIcon}><Text style={styles.termineIconText}>📋</Text></View>
                <Text style={styles.termineCount}>{getUpcomingTermineCount()}</Text>
              </View>
              <View style={styles.termineFooter}>
                <Text style={styles.termineTitle}>Weitere Termine</Text>
                <Text style={styles.termineSubtitle}>Meetings & Lehrgänge</Text>
              </View>
            </DashboardCard>
            <DashboardCard id="kalender" style={styles.kalenderCard} onPress={() => setViewMode('kalender')} hoverStyle={styles.darkCardHovered}>
              {getUrgentTermineCount() > 0 && <View style={styles.urgentBadge}><Text style={styles.urgentBadgeText}>{getUrgentTermineCount()} diese Woche</Text></View>}
              <View style={styles.kalenderIcon}><Text style={styles.kalenderIconText}>📅</Text></View>
              <View style={styles.kalenderFooter}>
                <Text style={styles.kalenderTitle}>Kalender</Text>
                <Text style={styles.kalenderSubtitle}>Übersicht & Export</Text>
              </View>
            </DashboardCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderWeitereTermine = () => {
    const sortedTermine = getSortedTermine();
    const dfbCount = getDFBTermineCount();
    const hallenCount = getHallenTermineCount();
    
    return (
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <TouchableOpacity onPress={() => setViewMode('dashboard')} style={styles.backButton}>
            <View style={styles.backButtonInner}>
              <Ionicons name="chevron-back" size={18} color="#333" />
            </View>
          </TouchableOpacity>
          <Text style={styles.listTitle}>Weitere Termine</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={() => setShowSyncModal(true)} style={styles.syncButton}>
              <Text style={styles.syncButtonText}>🔄 Aktualisieren</Text>
              <Text style={styles.syncButtonSubtext}>Stand: {getLastUpdateDisplay()}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openAddModal} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Neuer Termin</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Info Banner - grau */}
        <View style={styles.dfbBanner}>
          <Text style={styles.dfbBannerText}>🇩🇪 {dfbCount} DFB-Nationalmannschaftstermine & {hallenCount} Hallenturniere</Text>
        </View>
        
        {/* Table Header - schwarzer Hintergrund */}
        <View style={styles.tableHeader}>
          <SortableHeader field="datum" label="Datum" style={styles.colDatum} />
          <View style={styles.colZeit}><Text style={styles.tableHeaderText}>Zeit</Text></View>
          <SortableHeader field="art" label="Art" style={styles.colArt} />
          <SortableHeader field="titel" label="Beschreibung" style={styles.colTitel} />
          <SortableHeader field="jahrgang" label="Jahrgang" style={styles.colJahrgang} />
          <SortableHeader field="ort" label="Ort" style={styles.colOrt} />
          <SortableHeader field="uebernahme" label="Übernahme" style={styles.colUebernahme} />
        </View>
        
        <ScrollView style={styles.tableBody}>
          {loading ? (
            <Text style={styles.loadingText}>Laden...</Text>
          ) : sortedTermine.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Keine Termine vorhanden</Text>
              <TouchableOpacity onPress={() => setShowSyncModal(true)} style={styles.emptyDfbButton}>
                <Text style={styles.emptyDfbButtonText}>🇩🇪 DFB & Hallen-Termine laden</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sortedTermine.map((termin) => {
              const isPast = isTerminPast(termin.datum);
              const isToday = isTerminToday(termin);
              const isNM = isNationalmannschaft(termin);
              const isHT = isHallenturnier(termin);
              const time = formatTime(termin.datum);
              
              return (
                <TouchableOpacity 
                  key={termin.id} 
                  style={[
                    styles.tableRow, 
                    isPast && styles.tableRowPast,
                    isToday && !isPast && styles.tableRowToday
                  ]} 
                  onPress={() => openEditModal(termin)}
                >
                  <Text style={[styles.tableCell, styles.colDatum, isPast && styles.cellPast]}>{formatDate(termin)}</Text>
                  <Text style={[styles.tableCell, styles.colZeit, isPast && styles.cellPast]}>{time || '-'}</Text>
                  <View style={styles.colArt}>
                    <View style={[
                      styles.artBadge, 
                      isNM ? styles.artNationalmannschaft : isHT ? styles.artHallenturnier : styles.artSonstige,
                      isPast && styles.artBadgePast
                    ]}>
                      <Text style={[
                        styles.artBadgeText, 
                        isNM ? styles.artNationalmannschaftText : isHT ? styles.artHallenturnierText : null
                      ]}>
                        {isNM ? 'Nationalmannschaft' : isHT ? 'Hallenturnier' : getDisplayArt(termin.art)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.tableCell, styles.colTitel, isPast && styles.cellPast]} numberOfLines={1}>{termin.titel}</Text>
                  <Text style={[styles.tableCell, styles.colJahrgang, isPast && styles.cellPast]}>{termin.jahrgang || '-'}</Text>
                  <Text style={[styles.tableCell, styles.colOrt, isPast && styles.cellPast]} numberOfLines={1}>{termin.ort || '-'}</Text>
                  <Text style={[styles.tableCell, styles.colUebernahme, isPast && styles.cellPast]}>{getAdvisorName(termin.uebernahme_advisor_id)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  const renderSpielePlaceholder = () => (
    <View style={styles.placeholderContainer}>
      <TouchableOpacity onPress={() => setViewMode('dashboard')} style={styles.backButtonTop}>
        <Ionicons name="arrow-back" size={20} color="#666" />
      </TouchableOpacity>
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderIcon}>⚽</Text>
        <Text style={styles.placeholderTitle}>Spiele unserer Spieler</Text>
        <Text style={styles.placeholderText}>Alle Partien deiner Mandanten werden hier{'\n'}automatisch von fußball.de angezeigt.</Text>
        <View style={styles.comingSoonLarge}><Text style={styles.comingSoonLargeText}>COMING SOON</Text></View>
      </View>
    </View>
  );

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
    return (
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</Text>
              <View style={styles.formRow}>
                <View style={styles.formThird}>
                  <Text style={styles.formLabel}>Datum *</Text>
                  <TextInput style={styles.formInput} value={formDatum} onChangeText={setFormDatum} placeholder="YYYY-MM-DD" />
                </View>
                <View style={styles.formThird}>
                  <Text style={styles.formLabel}>Datum bis</Text>
                  <TextInput style={styles.formInput} value={formDatumEnde} onChangeText={setFormDatumEnde} placeholder="YYYY-MM-DD" />
                </View>
                <View style={styles.formThird}>
                  <Text style={styles.formLabel}>Zeit</Text>
                  <TextInput style={styles.formInput} value={formZeit} onChangeText={setFormZeit} placeholder="HH:MM" />
                </View>
              </View>
              <Text style={styles.formLabel}>Art *</Text>
              <View style={styles.artSelector}>
                {TERMIN_ARTEN.map((art) => (
                  <TouchableOpacity key={art} style={[styles.artOption, formArt === art && styles.artOptionSelected]} onPress={() => setFormArt(art)}>
                    <Text style={[styles.artOptionText, formArt === art && styles.artOptionTextSelected]}>{art}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Beschreibung *</Text>
              <TextInput style={styles.formInput} value={formTitel} onChangeText={setFormTitel} placeholder="z.B. Lehrgang, Meeting, ..." />
              <Text style={styles.formLabel}>Jahrgang</Text>
              <View style={styles.selectWrapper}>
                <select
                  style={styles.selectInput as any}
                  value={formJahrgang}
                  onChange={(e: any) => setFormJahrgang(e.target.value)}
                >
                  <option value="">- Kein Jahrgang -</option>
                  {JAHRGAENGE.map((jg) => (
                    <option key={jg} value={jg}>{jg}</option>
                  ))}
                </select>
              </View>
              <Text style={styles.formLabel}>Ort</Text>
              <TextInput style={styles.formInput} value={formOrt} onChangeText={setFormOrt} placeholder="z.B. Frankfurt, DFB-Campus..." />
              <Text style={styles.formLabel}>Übernahme durch</Text>
              <View style={styles.selectWrapper}>
                <select
                  style={styles.selectInput as any}
                  value={formUebernahme}
                  onChange={(e: any) => setFormUebernahme(e.target.value)}
                >
                  <option value="">- Keine Auswahl -</option>
                  {advisors.map((adv) => (
                    <option key={adv.id} value={adv.id}>{adv.first_name} {adv.last_name}</option>
                  ))}
                </select>
              </View>
              <View style={styles.modalButtons}>
                {isEdit && (
                  <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTermin}>
                    <Text style={styles.deleteButtonText}>Löschen</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.cancelButton} onPress={() => { isEdit ? setShowEditModal(false) : setShowAddModal(false); resetForm(); }}>
                  <Text style={styles.cancelButtonText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={isEdit ? handleUpdateTermin : handleSaveTermin}>
                  <Text style={styles.saveButtonText}>Speichern</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
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

  const renderContent = () => {
    switch (viewMode) {
      case 'spiele': return renderSpielePlaceholder();
      case 'termine': return renderWeitereTermine();
      case 'kalender': return renderKalenderPlaceholder();
      default: return renderDashboard();
    }
  };

  return (
    <View style={styles.container}>
      <Sidebar navigation={navigation} activeScreen="termine" profile={profile} />
      <View style={styles.mainContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Termine</Text>
            <Text style={styles.headerSubtitle}>
              {viewMode === 'dashboard' ? 'Übersicht aller Termine' : ''}
            </Text>
          </View>
        </View>
        {renderContent()}
      </View>
      {renderAddEditModal(false)}
      {renderAddEditModal(true)}
      {renderSyncModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f5f5' },
  mainContent: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#888', marginTop: 2 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  gridContainer: { maxWidth: 1000, width: '100%' },
  row: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  card: { borderRadius: 20, overflow: 'hidden', cursor: 'pointer' as any },
  cardHovered: { transform: [{ scale: 1.02 }], shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
  lightCardHovered: { backgroundColor: '#f0f0f0', transform: [{ scale: 1.01 }] },
  darkCardHovered: { backgroundColor: '#2a2a2a', transform: [{ scale: 1.02 }] },
  mainCardHovered: { backgroundColor: '#fafafa', transform: [{ scale: 1.005 }] },
  mainCard: { flex: 2, backgroundColor: '#fff', padding: 28, minHeight: 280, borderWidth: 1, borderColor: '#eee' },
  mainCardContent: { flex: 1, flexDirection: 'row' },
  mainCardLeft: { flex: 1, justifyContent: 'space-between' },
  mainCardRight: { width: 120, alignItems: 'center', justifyContent: 'center' },
  mainCardIcon: { fontSize: 80, opacity: 0.15 },
  comingSoonBadge: { backgroundColor: '#fff3cd', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
  comingSoonBadgeText: { fontSize: 11, fontWeight: '600', color: '#856404', letterSpacing: 0.5 },
  mainCardTitle: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  mainCardSubtitle: { fontSize: 14, color: '#888', lineHeight: 22 },
  mainCardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto' as any, paddingTop: 20 },
  mainCardLink: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  mainCardArrow: { fontSize: 16, marginLeft: 8, color: '#1a1a1a' },
  rightColumn: { flex: 1, gap: 16 },
  termineCard: { flex: 1, backgroundColor: '#fff', padding: 20, borderWidth: 1, borderColor: '#eee', justifyContent: 'space-between' },
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
  listContainer: { flex: 1 },
  listHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { marginRight: 12 },
  backButtonInner: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: '#f5f5f5', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  backButtonTop: { position: 'absolute', top: 20, left: 20 },
  listTitle: { fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  headerButtons: { flexDirection: 'row', gap: 12 },
  syncButton: { backgroundColor: '#000', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center' },
  syncButtonText: { color: '#fff', fontWeight: '500', fontSize: 13 },
  syncButtonSubtext: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  addButton: { backgroundColor: '#000', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '500', fontSize: 13 },
  
  // Info Banner - grau
  dfbBanner: { backgroundColor: '#e9ecef', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#dee2e6' },
  dfbBannerText: { fontSize: 13, color: '#495057', fontWeight: '500', textAlign: 'center' },

  // Table styles - schwarzer Header
  tableHeader: { flexDirection: 'row', backgroundColor: '#333', paddingVertical: 12, paddingHorizontal: 16 },
  tableHeaderText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  sortableHeader: { cursor: 'pointer' as any },
  tableBody: { flex: 1, backgroundColor: '#fff' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  tableRowPast: { backgroundColor: '#fafafa' },
  tableRowToday: { backgroundColor: '#e9ecef' },
  tableCell: { fontSize: 14, color: '#333' },
  cellPast: { color: '#999' },
  colDatum: { flex: 1, minWidth: 90 },
  colZeit: { flex: 0.6, minWidth: 50 },
  colArt: { flex: 1.3, minWidth: 120 },
  colTitel: { flex: 2, minWidth: 150, marginLeft: 8 },
  colJahrgang: { flex: 0.6, minWidth: 55 },
  colOrt: { flex: 1.1, minWidth: 90 },
  colUebernahme: { flex: 1.1, minWidth: 90 },
  
  // Art Badges
  artBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  artBadgePast: { opacity: 0.6 },
  artBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  
  // Nationalmannschaft - hellrot
  artNationalmannschaft: { backgroundColor: '#f8d7da' },
  artNationalmannschaftText: { color: '#721c24' },
  
  // Hallenturnier - hellblau
  artHallenturnier: { backgroundColor: '#d1ecf1' },
  artHallenturnierText: { color: '#0c5460' },
  
  // Sonstige
  artSonstige: { backgroundColor: '#6c757d' },
  
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#666', fontSize: 16, marginBottom: 16 },
  emptyDfbButton: { backgroundColor: '#e9ecef', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  emptyDfbButtonText: { color: '#495057', fontWeight: '600', fontSize: 14 },
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
  syncDescription: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 12 },
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
  artSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  artOption: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  artOptionSelected: { backgroundColor: '#000', borderColor: '#000' },
  artOptionText: { fontSize: 13, color: '#333' },
  artOptionTextSelected: { color: '#fff' },
  modalButtons: { flexDirection: 'row', marginTop: 24, gap: 8 },
  deleteButton: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#ff4444', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  deleteButtonText: { color: '#ff4444', fontWeight: '600' },
  cancelButton: { backgroundColor: '#eee', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  cancelButtonText: { color: '#666', fontWeight: '600' },
  saveButton: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  saveButtonText: { color: '#fff', fontWeight: '600' },
});
