import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '../../config/supabase';
import { Sidebar } from '../../components/Sidebar';
import { getRelevantTermine, convertToDbFormat, getLastUpdateDisplay } from '../../services/dfbTermine';

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
type SortField = 'datum' | 'zeit' | 'art' | 'titel' | 'jahrgang' | 'ort' | 'uebernahme';
type SortDirection = 'asc' | 'desc';

const TERMIN_ARTEN = ['Spiel', 'Lehrgang', 'Meeting', 'Vertragsverhandlung', 'Scouting', 'Sonstiges'];
const JAHRGAENGE = ['U15', 'U16', 'U17', 'U18', 'U19', 'U20', 'U21', 'U23', 'Herren', 'Sonstige'];

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
  const [formArt, setFormArt] = useState('Meeting');
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
    setFormArt('Meeting'); setFormTitel(''); setFormJahrgang(''); 
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
    if (!formDatum || !formTitel || !formArt) { alert('Bitte Datum, Art und Titel ausfüllen'); return; }
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
    if (!selectedTermin || !formDatum || !formTitel || !formArt) { alert('Bitte Datum, Art und Titel ausfüllen'); return; }
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
      const { data: existingTermine } = await supabase.from('termine').select('datum, jahrgang, titel').eq('quelle', 'DFB');
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

  const getSortedTermine = (): Termin[] => {
    return [...termine].sort((a, b) => {
      let valueA: any, valueB: any;
      switch (sortField) {
        case 'datum':
          valueA = new Date(a.datum).getTime();
          valueB = new Date(b.datum).getTime();
          break;
        case 'zeit':
          const timeA = new Date(a.datum);
          const timeB = new Date(b.datum);
          valueA = timeA.getHours() * 60 + timeA.getMinutes();
          valueB = timeB.getHours() * 60 + timeB.getMinutes();
          break;
        case 'art':
          valueA = a.art?.toLowerCase() || '';
          valueB = b.art?.toLowerCase() || '';
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

  const formatDate = (termin: Termin): string => {
    const startDate = new Date(termin.datum);
    if (termin.datum_ende) {
      const endDate = new Date(termin.datum_ende);
      const startStr = startDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      const endStr = endDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    return startDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const hours = date.getHours(), minutes = date.getMinutes();
    if (hours === 0 && minutes === 0) return '-';
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const isTerminPast = (dateString: string): boolean => new Date(dateString) < new Date();
  const getUpcomingTermineCount = (): number => termine.filter(t => new Date(t.datum) >= new Date()).length;
  const getUrgentTermineCount = (): number => { 
    const now = new Date(); 
    const in7Days = new Date(now.getTime() + 7*24*60*60*1000); 
    return termine.filter(t => { const d = new Date(t.datum); return d >= now && d <= in7Days; }).length; 
  };
  const getDFBTermineCount = (): number => termine.filter(t => t.quelle === 'DFB' || t.art === 'DFB-Maßnahme').length;
  const isDFBTermin = (termin: Termin): boolean => termin.quelle === 'DFB' || termin.art === 'DFB-Maßnahme';

  const getArtStyle = (art: string) => {
    switch (art) {
      case 'Spiel': return styles.artSpiel;
      case 'Lehrgang': return styles.artLehrgang;
      case 'Meeting': return styles.artMeeting;
      case 'Vertragsverhandlung': return styles.artVertrag;
      case 'Scouting': return styles.artScouting;
      default: return styles.artSonstige;
    }
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
    return (
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <TouchableOpacity onPress={() => setViewMode('dashboard')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Zurück</Text>
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
        {getDFBTermineCount() > 0 && (
          <View style={styles.dfbBanner}>
            <Text style={styles.dfbBannerText}>🇩🇪 {getDFBTermineCount()} DFB-Nationalmannschaftstermine (U15-U21)</Text>
          </View>
        )}
        <View style={styles.tableHeader}>
          <SortableHeader field="datum" label="Datum" style={styles.colDatum} />
          <SortableHeader field="zeit" label="Zeit" style={styles.colZeit} />
          <SortableHeader field="art" label="Art" style={styles.colArt} />
          <SortableHeader field="titel" label="Titel" style={styles.colTitel} />
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
                <Text style={styles.emptyDfbButtonText}>🇩🇪 DFB-Termine laden</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sortedTermine.map((termin) => {
              const isPast = isTerminPast(termin.datum);
              const isDFB = isDFBTermin(termin);
              const time = formatTime(termin.datum);
              return (
                <TouchableOpacity 
                  key={termin.id} 
                  style={[styles.tableRow, isPast && styles.tableRowPast]} 
                  onPress={() => openEditModal(termin)}
                >
                  <Text style={[styles.tableCell, styles.colDatum, isPast && styles.cellPast]}>{formatDate(termin)}</Text>
                  <Text style={[styles.tableCell, styles.colZeit, isPast && styles.cellPast]}>{time}</Text>
                  <View style={styles.colArt}>
                    <View style={[styles.artBadge, isDFB ? styles.artDFB : getArtStyle(termin.art), isPast && styles.artBadgePast]}>
                      <Text style={[styles.artBadgeText, isDFB && styles.artDFBText]}>{isDFB ? 'DFB' : termin.art}</Text>
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
        <Text style={styles.backButtonText}>← Zurück</Text>
      </TouchableOpacity>
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderIcon}>⚽</Text>
        <Text style={styles.placeholderTitle}>Spiele unserer Spieler</Text>
        <Text style={styles.placeholderText}>
          Diese Funktion wird bald verfügbar sein.{'\n\n'}
          Hier werden automatisch alle Spiele deiner Spieler{'\n'}von fußball.de angezeigt.
        </Text>
        <View style={styles.comingSoonLarge}><Text style={styles.comingSoonLargeText}>Coming Soon</Text></View>
      </View>
    </View>
  );

  const renderKalenderPlaceholder = () => (
    <View style={styles.placeholderContainer}>
      <TouchableOpacity onPress={() => setViewMode('dashboard')} style={styles.backButtonTop}>
        <Text style={styles.backButtonText}>← Zurück</Text>
      </TouchableOpacity>
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderIcon}>📅</Text>
        <Text style={styles.placeholderTitle}>Kalender</Text>
        <Text style={styles.placeholderText}>
          Kalenderansicht und Export-Funktion{'\n'}werden bald verfügbar sein.
        </Text>
        <View style={styles.comingSoonLarge}><Text style={styles.comingSoonLargeText}>Coming Soon</Text></View>
      </View>
    </View>
  );

  const renderAddEditModal = (isEdit: boolean) => (
    <Modal visible={isEdit ? showEditModal : showAddModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</Text>
          <View style={styles.formRow}>
            <View style={styles.formThird}>
              <Text style={styles.formLabel}>Datum *</Text>
              <input type="date" style={styles.dateInput as any} value={formDatum} onChange={(e) => setFormDatum(e.target.value)} />
            </View>
            <View style={styles.formThird}>
              <Text style={styles.formLabel}>Enddatum (optional)</Text>
              <input type="date" style={styles.dateInput as any} value={formDatumEnde} onChange={(e) => setFormDatumEnde(e.target.value)} />
            </View>
            <View style={styles.formThird}>
              <Text style={styles.formLabel}>Uhrzeit (optional)</Text>
              <input type="time" style={styles.dateInput as any} value={formZeit} onChange={(e) => setFormZeit(e.target.value)} />
            </View>
          </View>
          <Text style={styles.formLabel}>Art *</Text>
          <View style={styles.artSelector}>
            {TERMIN_ARTEN.map((art) => (
              <TouchableOpacity 
                key={art} 
                style={[styles.artOption, formArt === art && styles.artOptionSelected]} 
                onPress={() => setFormArt(art)}
              >
                <Text style={[styles.artOptionText, formArt === art && styles.artOptionTextSelected]}>{art}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.formLabel}>Titel / Beschreibung *</Text>
          <TextInput style={styles.formInput} value={formTitel} onChangeText={setFormTitel} placeholder="z.B. Besprechung mit Familie Müller" />
          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <Text style={styles.formLabel}>Jahrgang</Text>
              <View style={styles.selectWrapper}>
                <select style={styles.selectInput as any} value={formJahrgang} onChange={(e) => setFormJahrgang(e.target.value)}>
                  <option value="">-- Auswählen --</option>
                  {JAHRGAENGE.map((jg) => (<option key={jg} value={jg}>{jg}</option>))}
                </select>
              </View>
            </View>
            <View style={styles.formHalf}>
              <Text style={styles.formLabel}>Übernahme</Text>
              <View style={styles.selectWrapper}>
                <select style={styles.selectInput as any} value={formUebernahme} onChange={(e) => setFormUebernahme(e.target.value)}>
                  <option value="">-- Auswählen --</option>
                  {advisors.map((a) => (<option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>))}
                </select>
              </View>
            </View>
          </View>
          <Text style={styles.formLabel}>Ort</Text>
          <TextInput style={styles.formInput} value={formOrt} onChangeText={setFormOrt} placeholder="z.B. Geschäftsstelle Leipzig" />
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
      </View>
    </Modal>
  );

  const renderSyncModal = () => (
    <Modal visible={showSyncModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.syncModalContent}>
          <Text style={styles.modalTitle}>🇩🇪 DFB-Termine synchronisieren</Text>
          <Text style={styles.syncDescription}>
            Lädt alle Nationalmannschafts-Termine (U15-U21) für 2026.{'\n'}
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
  backButton: { marginRight: 16 },
  backButtonText: { fontSize: 14, color: '#666', fontWeight: '500' },
  backButtonTop: { position: 'absolute', top: 20, left: 20 },
  listTitle: { fontSize: 18, fontWeight: '600', flex: 1 },
  headerButtons: { flexDirection: 'row', gap: 12 },
  syncButton: { backgroundColor: '#000', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  syncButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  syncButtonSubtext: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  addButton: { backgroundColor: '#000', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  dfbBanner: { backgroundColor: '#f8d7da', paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f5c6cb' },
  dfbBannerText: { fontSize: 13, color: '#721c24', fontWeight: '500' },

  // Table styles
  tableHeader: { flexDirection: 'row', backgroundColor: '#333', paddingVertical: 12, paddingHorizontal: 16 },
  tableHeaderText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  sortableHeader: { cursor: 'pointer' as any },
  tableBody: { flex: 1, backgroundColor: '#fff' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  tableRowPast: { backgroundColor: '#fafafa' },
  tableCell: { fontSize: 14, color: '#333' },
  cellPast: { color: '#999' },
  colDatum: { flex: 1.4, minWidth: 130 },
  colZeit: { flex: 0.6, minWidth: 60 },
  colArt: { flex: 0.8, minWidth: 80 },
  colTitel: { flex: 2, minWidth: 150 },
  colJahrgang: { flex: 0.7, minWidth: 60 },
  colOrt: { flex: 1.2, minWidth: 100 },
  colUebernahme: { flex: 1.2, minWidth: 100 },
  artBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  artBadgePast: { opacity: 0.6 },
  artBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  artSpiel: { backgroundColor: '#28a745' },
  artLehrgang: { backgroundColor: '#17a2b8' },
  artMeeting: { backgroundColor: '#6c757d' },
  artVertrag: { backgroundColor: '#dc3545' },
  artScouting: { backgroundColor: '#fd7e14' },
  artSonstige: { backgroundColor: '#6f42c1' },
  // DFB Art Badge - hellrot wie Vertragsende
  artDFB: { backgroundColor: '#f8d7da' },
  artDFBText: { color: '#721c24' },
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#666', fontSize: 16, marginBottom: 16 },
  emptyDfbButton: { backgroundColor: '#f8d7da', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  emptyDfbButtonText: { color: '#721c24', fontWeight: '600', fontSize: 14 },
  placeholderContainer: { flex: 1, position: 'relative' },
  placeholderContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  placeholderIcon: { fontSize: 80, marginBottom: 20 },
  placeholderTitle: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  placeholderText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  comingSoonLarge: { backgroundColor: '#fff3cd', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, marginTop: 30 },
  comingSoonLargeText: { fontSize: 16, fontWeight: '600', color: '#856404' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 600, maxHeight: '90%' },
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
  dateInput: { padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' },
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
