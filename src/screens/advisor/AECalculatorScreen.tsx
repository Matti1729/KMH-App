import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, TextInput, Modal, Image } from 'react-native';
import { Sidebar } from '../../components/Sidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { MobileSidebar } from '../../components/MobileSidebar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';
import {
  Altersklasse, Liga, LZKategorie, AEInput, AEResult,
  LIGA_LABELS, berechneAE, formatEUR,
} from '../../utils/ausbildungsentschaedigung';

// --- Types ---

interface KMHPlayer {
  id: string;
  first_name: string;
  last_name: string;
  club: string;
}

interface AEBerechnung {
  id: string;
  advisor_id: string;
  spieler_name: string;
  aktueller_verein: string;
  altersklasse: Altersklasse;
  verweildauer_jahre: number;
  war_in_u11_u12: boolean;
  entfernung_aufnehmend: number;
  entfernung_abgebend: number;
  liga_abgebend: Liga;
  lz_kategorie: LZKategorie;
  vertragsangebot: boolean;
  unterbringung_jahre: number;
  ae_bl: number;
  ae_2bl: number;
  ae_3liga: number;
  ae_rl: number;
  gesamt_bl: number;
  gesamt_2bl: number;
  gesamt_3liga: number;
  gesamt_rl: number;
  created_at: string;
  updated_at: string;
}

type Step =
  | 'spielerInfo'
  | 'altersklasse'
  | 'u11u12'
  | 'verweildauer'
  | 'entfernung'
  | 'liga'
  | 'lzKategorie'
  | 'vertragsangebot'
  | 'unterbringung'
  | 'ergebnis';

const ALTERSKLASSEN: Altersklasse[] = ['U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U20', 'U21'];
const LIGEN: { value: Liga; label: string }[] = [
  { value: 'BL', label: 'Bundesliga' },
  { value: '2BL', label: '2. Bundesliga' },
  { value: '3Liga', label: '3. Liga' },
  { value: 'RL', label: 'Regionalliga' },
];

function isU13bisU15(ak: Altersklasse): boolean {
  return ak === 'U13' || ak === 'U14' || ak === 'U15';
}

function getAkNum(ak: Altersklasse): number {
  return parseInt(ak.replace('U', ''), 10);
}

const TOOLTIP_DATA: Record<string, { text: string; ziffer?: string; zifferText?: string }> = {
  'Altersklasse': {
    text: 'Entscheidend ist die Altersklasse, in die der Spieler beim aufnehmenden Club wechselt (ab 01.07.) \u2014 nicht die aktuelle AK beim abgebenden Verein.\nU13 = 1,75 \u00b7 U14 = 1,5 \u00b7 U15 = 1,25 \u00b7 U16\u2013U21 = 1,0',
    ziffer: 'Ziffer 1.7 / 3.4',
    zifferText: '\u201eAltersklasse\u201c bezeichnet die Altersklasse, in die ein Spieler wechselt und der der Spieler nach seinem Wechsel zum aufnehmenden Club angeh\u00f6rt (und nicht die Altersklasse, aus der der Spieler heraus wechselt). Abh\u00e4ngig von der Altersklasse wird der Grundbetrag mit einem Faktor zwischen 1,0 und 1,75 multipliziert: U13 = 1,75 \u00b7 U14 = 1,5 \u00b7 U15 = 1,25 \u00b7 U16\u2013U21 = 1,0.',
  },
  'U11 & U12 im NLZ': {
    text: 'Sonderregelung: Bei Wechsel in die U13 \u2014 wenn der Spieler sowohl in der U11 als auch U12 ununterbrochen beim abgebenden Club war, wird der Verweildauer-Faktor auf 1,0 gesetzt.',
    ziffer: 'Ziffer 3.5',
    zifferText: 'Bei einem Wechsel in die U13 wird der Grundbetrag abweichend mit dem Faktor 1,0 multipliziert, wenn der Spieler sowohl in der U11 als auch in der U12 ohne Unterbrechung f\u00fcr den abgebenden Club spielberechtigt gewesen ist.',
  },
  'Verweildauer im NLZ': {
    text: 'Gez\u00e4hlt werden nur Spielzeiten ab der U12. Die beendete Saison z\u00e4hlt voll.\n\nFaktoren: 1 J. = 2,0 \u00b7 2 J. = 1,5 \u00b7 3 J. = 2,25 \u00b7 4 J. = 3,0 \u00b7 5 J. = 3,75 \u00b7 6 J. = 4,5 \u00b7 7+ J. = 5,25',
    ziffer: 'Ziffer 3.5',
    zifferText: 'Abh\u00e4ngig von der Verweildauer, w\u00e4hrend derer der Spieler bis zum Vereinswechsel ohne Unterbrechung f\u00fcr den abgebenden Club spielberechtigt gewesen ist, wird der Grundbetrag mit einem Faktor zwischen 1,5 und 5,25 multipliziert. Bei der Berechnung wird nur die Zugeh\u00f6rigkeit ab der U12 ber\u00fccksichtigt.',
  },
  'Entfernung aufnehmend': {
    text: 'Gilt nur f\u00fcr U13\u2013U15. Entfernung zwischen Erstwohnsitz und aufnehmendem LZ.\n< 100 km = 1,0 \u00b7 \u2265 100 km = 1,5 \u00b7 \u2265 150 km = 2,5\nFaktor 1,0 wenn aufnehmender Club n\u00e4her liegt als abgebender.',
    ziffer: 'Ziffer 3.6',
    zifferText: 'Abh\u00e4ngig von der zwischen dem Erstwohnsitz des Spielers und dem Sitz des Leistungszentrums des aufnehmenden Clubs bestehenden Entfernung wird der Grundbetrag mit einem Faktor zwischen 1,0 und 2,5 multipliziert (nur U13\u2013U15). Faktor 1,0, wenn der aufnehmende Club n\u00e4her am Erstwohnsitz liegt als der abgebende.',
  },
  'Entfernung abgebend': {
    text: 'Wird mit der Entfernung zum aufnehmenden Club verglichen. Liegt der aufnehmende Club n\u00e4her, wird der Entfernungs-Faktor auf 1,0 gesetzt.',
    ziffer: 'Ziffer 3.6',
  },
  'Liga abgebender Verein': {
    text: 'Spielklasse der 1. Herren-Mannschaft zum Ende der Wechselperiode. Bei Auf-/Abstieg z\u00e4hlt die neue Liga. Bei gleicher Spielklasse +25% f\u00fcr Wechsel bis U15.',
    ziffer: 'Ziffer 1.12 / 3.7',
    zifferText: 'Die Spielklassenzugeh\u00f6rigkeit bestimmt sich nach der Spielklasse der Lizenzmannschaft bzw. der 1. Herren-Mannschaft zum Ende der Wechselperiode, in der der Vereinswechsel stattgefunden hat. Bei einem Vereinswechsel zwischen Leistungszentren derselben Spielklasse erh\u00f6ht sich der Faktor um 25%, wenn der Wechsel in die U15 oder j\u00fcnger erfolgt.',
  },
  'LZ-Kategorie': {
    text: 'Erwartbare Anforderungen (Kat. I bei BL / Kat. II unterhalb BL) = 1,0 \u00b7 Mindestanforderungen = 0,5',
    ziffer: 'Ziffer 3.8',
    zifferText: 'Abh\u00e4ngig davon, ob das Leistungszentrum des abgebenden Clubs die Mindestanforderungen (Faktor 0,5) oder die erwartbaren Anforderungen (Faktor 1,0) erf\u00fcllt, wird der Grundbetrag entsprechend multipliziert.',
  },
  'Vertragsangebot unterbreitet': {
    text: 'Gilt ab U16. Bindendes Angebot muss bis 30. April (Sommer-WP) bzw. 30. November (Winter-WP) zugestellt sein. Ja = 1,0 \u00b7 Nein = 0,75',
    ziffer: 'Ziffer 2.7 / 3.9',
    zifferText: 'Voraussetzung ist, dass der abgebende Club dem Spieler (ab U16) bis zum 30. April (Wechselperiode I) bzw. 30. November (Wechselperiode II) ein bindendes, unterzeichnetes Angebot zum Abschluss eines Vertrags gemacht hat. Die angebotene Verg\u00fctung darf 60% der bisherigen Verg\u00fctung nicht unterschreiten.',
  },
  'Unterbringung': {
    text: '15.000 \u20ac pro Jahr. F\u00fcr Unterbringung im Internat, bei Gasteltern oder \u00e4hnlichen Einrichtungen ab U16.',
    ziffer: 'Ziffer 4.2',
    zifferText: 'Bei Vereinswechseln in die U16 bis U20 zahlt der aufnehmende Club \u00fcber die Ausbildungsentsch\u00e4digung hinaus eine zus\u00e4tzliche Entsch\u00e4digung von EUR 15.000 f\u00fcr jedes Jahr, das der Spieler ab der U15 auf Kosten des abgebenden Clubs untergebracht war.',
  },
};

// --- Component ---

export function AECalculatorScreen({ navigation }: { navigation: any }) {
  const isMobile = useIsMobile();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // List state
  const [berechnungen, setBerechnungen] = useState<AEBerechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBerechnung, setEditingBerechnung] = useState<AEBerechnung | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');

  // Player & Club lookup
  const [kmhPlayers, setKmhPlayers] = useState<KMHPlayer[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [allClubNames, setAllClubNames] = useState<string[]>([]);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showClubDropdown, setShowClubDropdown] = useState(false);

  // Quiz state
  const [step, setStep] = useState<Step>('spielerInfo');
  const [spielerName, setSpielerName] = useState('');
  const [aktuellerVerein, setAktuellerVerein] = useState('');
  const [altersklasse, setAltersklasse] = useState<Altersklasse | null>(null);
  const [warInU11UndU12, setWarInU11UndU12] = useState(false);
  const [verweildauer, setVerweildauer] = useState<number>(1);
  const [entfernungAufnehmend, setEntfernungAufnehmend] = useState('');
  const [entfernungAbgebend, setEntfernungAbgebend] = useState('');
  const [ligaAbgebend, setLigaAbgebend] = useState<Liga | null>(null);
  const [lzKategorie, setLzKategorie] = useState<LZKategorie | null>(null);
  const [vertragsangebot, setVertragsangebot] = useState(false);
  const [unterbringungJahre, setUnterbringungJahre] = useState<number>(0);
  const [results, setResults] = useState<AEResult[] | null>(null);
  const [expandedLiga, setExpandedLiga] = useState<Liga | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [expandedZiffer, setExpandedZiffer] = useState<string | null>(null);

  // --- Data Fetching ---

  useEffect(() => {
    if (!session) return;
    fetchBerechnungen();
    fetchKMHPlayers();
    fetchClubLogos();
  }, [session]);

  async function fetchKMHPlayers() {
    const { data } = await supabase
      .from('player_details')
      .select('id, first_name, last_name, club')
      .order('last_name', { ascending: true });
    if (data) setKmhPlayers(data);
  }

  async function fetchClubLogos() {
    const { data } = await supabase.from('club_logos').select('club_name, logo_url');
    if (data) {
      const logoMap: Record<string, string> = {};
      const names: string[] = [];
      data.forEach((item: { club_name: string; logo_url: string }) => {
        logoMap[item.club_name] = item.logo_url;
        names.push(item.club_name);
      });
      setClubLogos(logoMap);
      setAllClubNames(names.sort());
    }
  }

  async function fetchBerechnungen() {
    setLoading(true);
    const { data } = await supabase
      .from('ae_berechnungen')
      .select('*');
    if (data) setBerechnungen(data);
    setLoading(false);
  }

  const sortedBerechnungen = [...berechnungen].sort((a, b) => {
    if (sortBy === 'name') return a.spieler_name.localeCompare(b.spieler_name, 'de');
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // --- Quiz Logic ---

  function getNextStep(current: Step): Step {
    if (current === 'spielerInfo') return 'altersklasse';
    if (current === 'altersklasse') {
      return altersklasse === 'U13' ? 'u11u12' : 'verweildauer';
    }
    if (current === 'u11u12') return 'verweildauer';
    if (current === 'verweildauer') {
      return altersklasse && isU13bisU15(altersklasse) ? 'entfernung' : 'liga';
    }
    if (current === 'entfernung') return 'liga';
    if (current === 'liga') return 'lzKategorie';
    if (current === 'lzKategorie') {
      return altersklasse && getAkNum(altersklasse) >= 16 ? 'vertragsangebot' : 'unterbringung';
    }
    if (current === 'vertragsangebot') return 'unterbringung';
    if (current === 'unterbringung') return 'ergebnis';
    return 'ergebnis';
  }

  function getPrevStep(current: Step): Step | null {
    if (current === 'spielerInfo') return null;
    if (current === 'altersklasse') return 'spielerInfo';
    if (current === 'u11u12') return 'altersklasse';
    if (current === 'verweildauer') return altersklasse === 'U13' ? 'u11u12' : 'altersklasse';
    if (current === 'entfernung') return 'verweildauer';
    if (current === 'liga') return altersklasse && isU13bisU15(altersklasse) ? 'entfernung' : 'verweildauer';
    if (current === 'lzKategorie') return 'liga';
    if (current === 'vertragsangebot') return 'lzKategorie';
    if (current === 'unterbringung') {
      return altersklasse && getAkNum(altersklasse) >= 16 ? 'vertragsangebot' : 'lzKategorie';
    }
    if (current === 'ergebnis') return 'unterbringung';
    return null;
  }

  function canProceed(): boolean {
    if (step === 'spielerInfo') return spielerName.trim() !== '';
    if (step === 'altersklasse') return altersklasse !== null;
    if (step === 'u11u12') return true;
    if (step === 'verweildauer') return verweildauer >= 1;
    if (step === 'entfernung') return entfernungAufnehmend !== '' && entfernungAbgebend !== '';
    if (step === 'liga') return ligaAbgebend !== null;
    if (step === 'lzKategorie') return lzKategorie !== null;
    if (step === 'vertragsangebot') return true;
    if (step === 'unterbringung') return true;
    return false;
  }

  function goNext() {
    const next = getNextStep(step);
    if (next === 'ergebnis') {
      calculate();
    }
    setStep(next);
  }

  function goBack() {
    const prev = getPrevStep(step);
    if (prev) setStep(prev);
  }

  function calculate() {
    if (!altersklasse || !ligaAbgebend || !lzKategorie) return;
    const input: AEInput = {
      altersklasse,
      verweildauerJahre: verweildauer,
      warInU11UndU12,
      entfernungAufnehmend: Number(entfernungAufnehmend) || 0,
      entfernungAbgebend: Number(entfernungAbgebend) || 0,
      ligaAbgebend,
      lzKategorie,
      vertragsangebotUnterbreitet: vertragsangebot,
      unterbringungJahre,
    };
    setResults(berechneAE(input));
  }

  function resetQuiz() {
    setStep('spielerInfo');
    setSpielerName('');
    setAktuellerVerein('');
    setAltersklasse(null);
    setWarInU11UndU12(false);
    setVerweildauer(1);
    setEntfernungAufnehmend('');
    setEntfernungAbgebend('');
    setLigaAbgebend(null);
    setLzKategorie(null);
    setVertragsangebot(false);
    setUnterbringungJahre(0);
    setResults(null);
    setExpandedLiga(null);
  }

  // --- Modal Open/Close ---

  function openNewModal() {
    resetQuiz();
    setEditingBerechnung(null);
    setIsEditing(true);
    setShowModal(true);
  }

  function openDetailModal(b: AEBerechnung) {
    setEditingBerechnung(b);
    setSpielerName(b.spieler_name);
    setAktuellerVerein(b.aktueller_verein);
    setAltersklasse(b.altersklasse);
    setVerweildauer(b.verweildauer_jahre);
    setWarInU11UndU12(b.war_in_u11_u12);
    setEntfernungAufnehmend(String(b.entfernung_aufnehmend));
    setEntfernungAbgebend(String(b.entfernung_abgebend));
    setLigaAbgebend(b.liga_abgebend);
    setLzKategorie(b.lz_kategorie);
    setVertragsangebot(b.vertragsangebot);
    setUnterbringungJahre(b.unterbringung_jahre);
    setStep('spielerInfo');
    setResults(null);
    setExpandedLiga(null);
    setIsEditing(false);
    setShowModal(true);
  }

  function startEditing() {
    setIsEditing(true);
    setStep('spielerInfo');
    setResults(null);
    setExpandedLiga(null);
  }

  function closeModal() {
    setShowModal(false);
    setEditingBerechnung(null);
    setIsEditing(false);
  }

  // --- Save / Delete ---

  async function saveBerechnung() {
    if (!results || !altersklasse || !ligaAbgebend || !lzKategorie || !session) return;

    const blResult = results.find(r => r.liga === 'BL')!;
    const zweiteBLResult = results.find(r => r.liga === '2BL')!;
    const dritteLigaResult = results.find(r => r.liga === '3Liga')!;
    const rlResult = results.find(r => r.liga === 'RL')!;

    const record = {
      advisor_id: session.user.id,
      spieler_name: spielerName.trim(),
      aktueller_verein: aktuellerVerein.trim(),
      altersklasse,
      verweildauer_jahre: verweildauer,
      war_in_u11_u12: warInU11UndU12,
      entfernung_aufnehmend: Number(entfernungAufnehmend) || 0,
      entfernung_abgebend: Number(entfernungAbgebend) || 0,
      liga_abgebend: ligaAbgebend,
      lz_kategorie: lzKategorie,
      vertragsangebot,
      unterbringung_jahre: unterbringungJahre,
      ae_bl: blResult.ausbildungsentschaedigung,
      ae_2bl: zweiteBLResult.ausbildungsentschaedigung,
      ae_3liga: dritteLigaResult.ausbildungsentschaedigung,
      ae_rl: rlResult.ausbildungsentschaedigung,
      gesamt_bl: blResult.gesamt,
      gesamt_2bl: zweiteBLResult.gesamt,
      gesamt_3liga: dritteLigaResult.gesamt,
      gesamt_rl: rlResult.gesamt,
      updated_at: new Date().toISOString(),
    };

    if (editingBerechnung) {
      await supabase.from('ae_berechnungen').update(record).eq('id', editingBerechnung.id);
    } else {
      await supabase.from('ae_berechnungen').insert(record);
    }

    fetchBerechnungen();
    closeModal();
  }

  async function deleteBerechnung(id: string) {
    await supabase.from('ae_berechnungen').delete().eq('id', id);
    fetchBerechnungen();
  }

  // --- Step progress ---

  const allSteps: Step[] = ['spielerInfo', 'altersklasse', 'u11u12', 'verweildauer', 'entfernung', 'liga', 'lzKategorie', 'vertragsangebot', 'unterbringung', 'ergebnis'];
  const visibleSteps = allSteps.filter(s => {
    if (s === 'u11u12') return altersklasse === 'U13';
    if (s === 'entfernung') return altersklasse && isU13bisU15(altersklasse);
    if (s === 'vertragsangebot') return altersklasse && getAkNum(altersklasse) >= 16;
    return true;
  });
  const currentIdx = visibleSteps.indexOf(step);
  const totalSteps = visibleSteps.length - 1;

  // --- Option Button ---

  function OptionButton({ label, selected, onPress, subtitle }: { label: string; selected: boolean; onPress: () => void; subtitle?: string }) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.optionBtn,
          { borderColor: selected ? colors.primary : colors.cardBorder, backgroundColor: selected ? colors.primary + '15' : colors.cardBackground },
        ]}
      >
        <Text style={[styles.optionBtnText, { color: selected ? colors.primary : colors.text }]}>{label}</Text>
        {subtitle && <Text style={[styles.optionBtnSubtext, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </Pressable>
    );
  }

  // --- Step Content ---

  function renderStepContent() {
    switch (step) {
      case 'spielerInfo': {
        const filteredPlayers = spielerName.trim().length > 0
          ? kmhPlayers.filter(p => {
              const full = `${p.first_name} ${p.last_name}`.toLowerCase();
              const reverse = `${p.last_name} ${p.first_name}`.toLowerCase();
              const comma = `${p.last_name}, ${p.first_name}`.toLowerCase();
              const q = spielerName.toLowerCase();
              return full.includes(q) || reverse.includes(q) || comma.includes(q);
            })
          : kmhPlayers;

        const filteredClubs = aktuellerVerein.trim().length > 0
          ? allClubNames.filter(c => c.toLowerCase().includes(aktuellerVerein.toLowerCase()))
          : allClubNames;

        const clubLogoUrl = clubLogos[aktuellerVerein] || null;

        return (
          <View>
            <Text style={[styles.questionTitle, { color: colors.text }]}>Spieler-Informationen</Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>Spieler aus KMH-Liste auswählen oder neuen Namen eingeben</Text>

            {/* Spieler Dropdown */}
            <View style={[styles.inputGroup, { zIndex: 1000 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Spielername *</Text>
              <View style={styles.dropdownContainer}>
                <TextInput
                  style={[styles.formInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.cardBackground }]}
                  value={spielerName}
                  onChangeText={(t) => { setSpielerName(t); setShowPlayerDropdown(true); setShowClubDropdown(false); }}
                  onFocus={() => { setShowPlayerDropdown(true); setShowClubDropdown(false); }}
                  placeholder="Spieler suchen oder eingeben..."
                  placeholderTextColor={colors.textMuted}
                />
                {showPlayerDropdown && spielerName.length > 0 && (
                  <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredPlayers.slice(0, 15).map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.dropdownItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
                          onPress={() => {
                            setSpielerName(`${p.last_name}, ${p.first_name}`);
                            setAktuellerVerein(p.club || '');
                            setShowPlayerDropdown(false);
                          }}
                        >
                          {p.club && clubLogos[p.club] ? <Image source={{ uri: clubLogos[p.club] }} style={styles.dropdownLogo} /> : null}
                          <Text style={[styles.dropdownText, { color: colors.text }]}>{p.last_name}, {p.first_name}</Text>
                          {p.club ? <Text style={[styles.dropdownSubtext, { color: colors.textMuted }]}>{p.club}</Text> : null}
                        </TouchableOpacity>
                      ))}
                      {!filteredPlayers.some(p => `${p.last_name}, ${p.first_name}`.toLowerCase() === spielerName.toLowerCase()) && spielerName.trim() !== '' && (
                        <TouchableOpacity
                          style={[styles.dropdownItem, styles.dropdownCustomItem, { borderBottomColor: colors.border }]}
                          onPress={() => setShowPlayerDropdown(false)}
                        >
                          <Text style={styles.dropdownCustomText}>"{spielerName}" verwenden</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* Verein Dropdown */}
            <View style={[styles.inputGroup, { zIndex: 900 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Aktueller Verein</Text>
              <View style={styles.dropdownContainer}>
                <View style={styles.clubInputRow}>
                  {clubLogoUrl && <Image source={{ uri: clubLogoUrl }} style={styles.clubLogoInput} />}
                  <TextInput
                    style={[styles.formInput, { flex: 1, color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.cardBackground }]}
                    value={aktuellerVerein}
                    onChangeText={(t) => { setAktuellerVerein(t); setShowClubDropdown(true); setShowPlayerDropdown(false); }}
                    onFocus={() => { setShowClubDropdown(true); setShowPlayerDropdown(false); }}
                    placeholder="Verein suchen oder eingeben..."
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                {showClubDropdown && aktuellerVerein.length > 0 && (
                  <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredClubs.slice(0, 15).map((club) => (
                        <TouchableOpacity
                          key={club}
                          style={[styles.dropdownItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
                          onPress={() => { setAktuellerVerein(club); setShowClubDropdown(false); }}
                        >
                          {clubLogos[club] && <Image source={{ uri: clubLogos[club] }} style={styles.dropdownLogo} />}
                          <Text style={[styles.dropdownText, { color: colors.text }]}>{club}</Text>
                        </TouchableOpacity>
                      ))}
                      {!filteredClubs.includes(aktuellerVerein) && aktuellerVerein.trim() !== '' && (
                        <TouchableOpacity
                          style={[styles.dropdownItem, styles.dropdownCustomItem, { borderBottomColor: colors.border }]}
                          onPress={() => setShowClubDropdown(false)}
                        >
                          <Text style={styles.dropdownCustomText}>"{aktuellerVerein}" verwenden</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      }

      case 'altersklasse':
        return (
          <View>
            <Text style={[styles.questionTitle, { color: colors.text }]}>Welche Altersklasse hat der Spieler?</Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>Altersklasse, in die der Spieler beim aufnehmenden Club wechselt — nicht die aktuelle AK beim abgebenden Verein (Ziffer 1.7)</Text>
            <View style={styles.optionsGrid}>
              {ALTERSKLASSEN.map(ak => (
                <OptionButton key={ak} label={ak} selected={altersklasse === ak} onPress={() => setAltersklasse(ak)} />
              ))}
            </View>
          </View>
        );

      case 'u11u12':
        return (
          <View>
            <Text style={[styles.questionTitle, { color: colors.text }]}>War der Spieler bereits in U11 und U12 im Leistungszentrum?</Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>Bei U13: Sonderregelung für Verweildauer-Faktor</Text>
            <View style={styles.optionsRow}>
              <OptionButton label="Ja" selected={warInU11UndU12} onPress={() => setWarInU11UndU12(true)} />
              <OptionButton label="Nein" selected={!warInU11UndU12} onPress={() => setWarInU11UndU12(false)} />
            </View>
          </View>
        );

      case 'verweildauer':
        return (
          <View>
            <Text style={[styles.questionTitle, { color: colors.text }]}>Wie viele Jahre war der Spieler im Leistungszentrum?</Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>Verweildauer im abgebenden Leistungszentrum. Es zählt nur die Zeit ab der U12 (Ziffer 3.5).</Text>
            <View style={styles.optionsGrid}>
              {[1, 2, 3, 4, 5, 6, 7].map(j => (
                <OptionButton key={j} label={j === 7 ? '7+' : `${j}`} subtitle={j === 1 ? 'Jahr' : 'Jahre'} selected={verweildauer === j} onPress={() => setVerweildauer(j)} />
              ))}
            </View>
          </View>
        );

      case 'entfernung':
        return (
          <View>
            <Text style={[styles.questionTitle, { color: colors.text }]}>Entfernung der Leistungszentren</Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>Entfernung (km) zum Wohnort des Spielers</Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Aufnehmender Verein (km)</Text>
              <TextInput
                style={[styles.formInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.cardBackground }]}
                value={entfernungAufnehmend}
                onChangeText={setEntfernungAufnehmend}
                keyboardType="numeric"
                placeholder="z.B. 120"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Abgebender Verein (km)</Text>
              <TextInput
                style={[styles.formInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.cardBackground }]}
                value={entfernungAbgebend}
                onChangeText={setEntfernungAbgebend}
                keyboardType="numeric"
                placeholder="z.B. 30"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        );

      case 'liga':
        return (
          <View>
            <Text style={[styles.questionTitle, { color: colors.text }]}>In welcher Liga spielt der abgebende Verein?</Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>Maßgeblich ist die Spielklasse zum Ende der Wechselperiode des Vereinswechsels. Bei Auf- oder Abstieg zählt die neue Liga (Ziffer 1.12).</Text>
            <View style={styles.optionsColumn}>
              {LIGEN.map(l => (
                <OptionButton key={l.value} label={l.label} selected={ligaAbgebend === l.value} onPress={() => setLigaAbgebend(l.value)} />
              ))}
            </View>
          </View>
        );

      case 'lzKategorie':
        return (
          <View>
            <Text style={[styles.questionTitle, { color: colors.text }]}>Welche Kategorie hat das Leistungszentrum?</Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>Kategorie des abgebenden Leistungszentrums</Text>
            <View style={styles.optionsColumn}>
              <OptionButton label="Erwartbare Anforderungen" subtitle="Voller Faktor" selected={lzKategorie === 'erwartbar'} onPress={() => setLzKategorie('erwartbar')} />
              <OptionButton label="Mindestanforderungen" subtitle="Halber Faktor" selected={lzKategorie === 'mindest'} onPress={() => setLzKategorie('mindest')} />
            </View>
          </View>
        );

      case 'vertragsangebot':
        return (
          <View>
            <Text style={[styles.questionTitle, { color: colors.text }]}>Hat der abgebende Verein ein Vertragsangebot unterbreitet?</Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>Ab U16: Faktor 0,75 wenn kein Angebot unterbreitet wurde. Frist: bis 30. April (Sommer) bzw. 30. November (Winter) der Spielzeit vor dem Wechsel (Ziffer 2.7).</Text>
            <View style={styles.optionsRow}>
              <OptionButton label="Ja" selected={vertragsangebot} onPress={() => setVertragsangebot(true)} />
              <OptionButton label="Nein" selected={!vertragsangebot} onPress={() => setVertragsangebot(false)} />
            </View>
          </View>
        );

      case 'unterbringung':
        return (
          <View>
            <Text style={[styles.questionTitle, { color: colors.text }]}>Unterbringung im Internat/Gastfamilie?</Text>
            <Text style={[styles.questionHint, { color: colors.textSecondary }]}>
              {altersklasse && getAkNum(altersklasse) < 16
                ? 'Unterbringungsentschädigung gilt erst ab U16'
                : 'EUR 15.000 pro Jahr Unterbringung (ab U16)'}
            </Text>
            {altersklasse && getAkNum(altersklasse) >= 16 ? (
              <View style={styles.optionsGrid}>
                {[0, 1, 2, 3, 4, 5].map(j => (
                  <OptionButton
                    key={j}
                    label={j === 0 ? 'Keine' : `${j}`}
                    subtitle={j === 0 ? '' : j === 1 ? 'Jahr' : 'Jahre'}
                    selected={unterbringungJahre === j}
                    onPress={() => setUnterbringungJahre(j)}
                  />
                ))}
              </View>
            ) : (
              <View style={[styles.infoBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.cardBorder }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                  Für {altersklasse} entfällt die Unterbringungsentschädigung.
                </Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  }

  // --- Results in Modal ---

  function renderResults() {
    if (!results) return null;
    return (
      <View>
        <Text style={[styles.questionTitle, { color: colors.text }]}>Ergebnis: Ausbildungsentschädigung</Text>
        <Text style={[styles.questionHint, { color: colors.textSecondary }]}>
          {spielerName} · {altersklasse} · {verweildauer} {verweildauer === 1 ? 'Jahr' : 'Jahre'} · Abgebend: {ligaAbgebend && LIGA_LABELS[ligaAbgebend]}
        </Text>

        {results.map(r => {
          const isExpanded = expandedLiga === r.liga;
          return (
            <Pressable
              key={r.liga}
              onPress={() => setExpandedLiga(isExpanded ? null : r.liga)}
              style={[styles.resultCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            >
              <View style={styles.resultHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultLiga, { color: colors.textSecondary }]}>Aufnehmend: {r.ligaLabel}</Text>
                  <Text style={[styles.resultAmount, { color: colors.primary }]}>{formatEUR(r.gesamt)}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>{isExpanded ? '▾' : '›'}</Text>
              </View>

              {isExpanded && (
                <View style={[styles.resultDetails, { borderTopColor: colors.border }]}>
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Ausbildungsentschädigung</Text>
                    <Text style={[styles.resultValue, { color: colors.text }]}>{formatEUR(r.ausbildungsentschaedigung)}</Text>
                  </View>
                  {r.unterbringungsentschaedigung > 0 && (
                    <View style={styles.resultRow}>
                      <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Unterbringungsentschädigung</Text>
                      <Text style={[styles.resultValue, { color: colors.text }]}>{formatEUR(r.unterbringungsentschaedigung)}</Text>
                    </View>
                  )}
                  <View style={[styles.factorSection, { borderTopColor: colors.border }]}>
                    <Text style={[styles.factorTitle, { color: colors.textMuted }]}>Berechnungsfaktoren</Text>
                    {r.faktoren.map(f => (
                      <View key={f.name} style={styles.factorRow}>
                        <Text style={[styles.factorLabel, { color: colors.textSecondary }]}>{f.name}</Text>
                        <Text style={[styles.factorValue, { color: colors.text }]}>
                          {f.name === 'Grundbetrag' ? formatEUR(f.wert) : `×${f.wert}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}

        <View style={styles.resultActions}>
          {editingBerechnung && (
            <TouchableOpacity
              onPress={() => { deleteBerechnung(editingBerechnung.id); closeModal(); }}
              style={[styles.deleteBtn, { borderColor: '#ef4444' }]}
            >
              <Text style={styles.deleteBtnText}>Löschen</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={saveBerechnung}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>Speichern & Schließen</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Summary View (read-only) ---

  function renderSummary() {
    if (!editingBerechnung) return null;
    const b = editingBerechnung;
    const akNum = getAkNum(b.altersklasse);
    const showEntfernung = isU13bisU15(b.altersklasse);
    const showVertragsangebot = akNum >= 16;
    const showUnterbringung = akNum >= 16;

    const summaryRows: { label: string; value: string }[] = [
      { label: 'Altersklasse', value: b.altersklasse },
      ...(b.altersklasse === 'U13' ? [{ label: 'U11 & U12 im NLZ', value: b.war_in_u11_u12 ? 'Ja' : 'Nein' }] : []),
      { label: 'Verweildauer im NLZ', value: `${b.verweildauer_jahre} ${b.verweildauer_jahre === 1 ? 'Jahr' : 'Jahre'}` },
      ...(showEntfernung ? [
        { label: 'Entfernung aufnehmend', value: `${b.entfernung_aufnehmend} km` },
        { label: 'Entfernung abgebend', value: `${b.entfernung_abgebend} km` },
      ] : []),
      { label: 'Liga abgebender Verein', value: LIGA_LABELS[b.liga_abgebend] },
      { label: 'LZ-Kategorie', value: b.lz_kategorie === 'erwartbar' ? 'Erwartbare Anforderungen' : 'Mindestanforderungen' },
      ...(showVertragsangebot ? [{ label: 'Vertragsangebot unterbreitet', value: b.vertragsangebot ? 'Ja' : 'Nein' }] : []),
      ...(showUnterbringung ? [{ label: 'Unterbringung', value: b.unterbringung_jahre > 0 ? `${b.unterbringung_jahre} ${b.unterbringung_jahre === 1 ? 'Jahr' : 'Jahre'}` : 'Keine' }] : []),
    ];

    const resultRows: { label: string; value: string }[] = [
      { label: 'Wechsel in Bundesliga', value: formatEUR(b.gesamt_bl) },
      { label: 'Wechsel in 2. Bundesliga', value: formatEUR(b.gesamt_2bl) },
      { label: 'Wechsel in 3. Liga', value: formatEUR(b.gesamt_3liga) },
      { label: 'Wechsel in Regionalliga', value: formatEUR(b.gesamt_rl) },
    ];

    return (
      <Pressable onPress={() => { setHoveredTooltip(null); setExpandedZiffer(null); }}>
        {summaryRows.map((row, i) => (
          <View
            key={i}
            style={[styles.summaryRow, { borderBottomColor: colors.border, zIndex: hoveredTooltip === row.label ? 100 : 1 }]}
          >
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {row.label}
            </Text>
            {TOOLTIP_DATA[row.label] && (
              <TouchableOpacity
                onPress={() => {
                  if (hoveredTooltip === row.label) {
                    setHoveredTooltip(null);
                    setExpandedZiffer(null);
                  } else {
                    setHoveredTooltip(row.label);
                    setExpandedZiffer(null);
                  }
                }}
                hitSlop={8}
              >
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>{'\u24d8'}</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.summaryValue, { color: colors.text, flex: 1 }]}>{row.value}</Text>
            {hoveredTooltip === row.label && TOOLTIP_DATA[row.label] && (
              <Pressable onPress={() => {}} style={[styles.tooltipBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={[styles.tooltipText, { color: colors.text, flex: 1 }]}>{TOOLTIP_DATA[row.label].text}</Text>
                  <TouchableOpacity onPress={() => { setHoveredTooltip(null); setExpandedZiffer(null); }} hitSlop={8} style={{ marginLeft: 8 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 16 }}>{'\u2715'}</Text>
                  </TouchableOpacity>
                </View>
                {TOOLTIP_DATA[row.label].ziffer && (
                  <TouchableOpacity
                    onPress={() => setExpandedZiffer(expandedZiffer === row.label ? null : row.label)}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '600' }}>
                      {TOOLTIP_DATA[row.label].ziffer} {expandedZiffer === row.label ? '\u25be' : '\u203a'}
                    </Text>
                  </TouchableOpacity>
                )}
                {expandedZiffer === row.label && TOOLTIP_DATA[row.label].zifferText && (
                  <View style={{ marginTop: 8, padding: 10, backgroundColor: '#22c55e15', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#22c55e' }}>
                    <Text style={{ color: colors.text, fontSize: 12, lineHeight: 17, fontStyle: 'italic' }}>
                      {TOOLTIP_DATA[row.label].zifferText}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>
        ))}

        <Text style={[styles.summaryResultTitle, { color: colors.text }]}>Ergebnis</Text>
        {resultRows.map((row, i) => (
          <View key={i} style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{row.label}</Text>
            <Text style={[styles.summaryValue, { color: colors.primary, fontWeight: '700' }]}>{row.value}</Text>
          </View>
        ))}
      </Pressable>
    );
  }

  // --- Progress Bar ---

  function renderProgress() {
    if (step === 'ergebnis') return null;
    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((currentIdx) / totalSteps) * 100}%` }]} />
        </View>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>Schritt {currentIdx + 1} von {totalSteps}</Text>
      </View>
    );
  }

  // --- Quiz Navigation Buttons ---

  function renderNavButtons() {
    if (step === 'ergebnis') return null;
    return (
      <View style={styles.quizNavButtons}>
        {getPrevStep(step) ? (
          <TouchableOpacity onPress={goBack} style={[styles.quizNavBtn, styles.quizNavBtnBack, { borderColor: colors.cardBorder }]}>
            <Text style={[styles.quizNavBtnText, { color: colors.text }]}>Zurück</Text>
          </TouchableOpacity>
        ) : <View />}
        <TouchableOpacity
          onPress={goNext}
          disabled={!canProceed()}
          style={[styles.quizNavBtn, styles.quizNavBtnNext, { backgroundColor: canProceed() ? colors.primary : colors.surfaceSecondary }]}
        >
          <Text style={[styles.quizNavBtnText, { color: canProceed() ? colors.primaryText : colors.textMuted }]}>
            {getNextStep(step) === 'ergebnis' ? 'Berechnen' : 'Weiter'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Quiz Modal ---

  function renderQuizModal() {
    return (
      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {!editingBerechnung ? 'Neue AE-Berechnung' : isEditing ? 'Berechnung bearbeiten' : editingBerechnung.spieler_name}
                </Text>
                {editingBerechnung && !isEditing && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    {editingBerechnung.aktueller_verein && clubLogos[editingBerechnung.aktueller_verein] && (
                      <Image source={{ uri: clubLogos[editingBerechnung.aktueller_verein] }} style={{ width: 18, height: 18, resizeMode: 'contain' as const, marginRight: 6 }} />
                    )}
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                      {editingBerechnung.aktueller_verein || '-'}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={closeModal} style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              {editingBerechnung && !isEditing ? (
                renderSummary()
              ) : (
                <>
                  {renderProgress()}
                  {step === 'ergebnis' ? renderResults() : renderStepContent()}
                  {renderNavButtons()}
                </>
              )}
            </ScrollView>

            {editingBerechnung && !isEditing && (
              <View style={[styles.summaryActions, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }]}>
                <TouchableOpacity
                  onPress={() => { deleteBerechnung(editingBerechnung.id); closeModal(); }}
                  style={[styles.deleteBtn, { borderColor: '#ef4444' }]}
                >
                  <Text style={styles.deleteBtnText}>Löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={startEditing}
                  style={[styles.editBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.editBtnText, { color: colors.primaryText }]}>Bearbeiten</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // --- Desktop Table ---

  function renderDesktopTable() {
    return (
      <View style={[styles.tableWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={[styles.tableHeader, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
          <Pressable style={styles.colSpielerName} onPress={() => setSortBy(sortBy === 'name' ? 'date' : 'name')}>
            <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>
              Spielername {sortBy === 'name' ? '▾' : ''}
            </Text>
          </Pressable>
          <Text style={[styles.tableHeaderText, styles.colVerein, { color: colors.textSecondary }]}>Aktueller Verein</Text>
          <Text style={[styles.tableHeaderText, styles.colLiga, { color: colors.textSecondary }]}>Wechsel in 1. BL</Text>
          <Text style={[styles.tableHeaderText, styles.colLiga, { color: colors.textSecondary }]}>Wechsel in 2. BL</Text>
        </View>

        <ScrollView style={styles.tableBody}>
          {loading ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Laden...</Text>
          ) : sortedBerechnungen.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Noch keine Berechnungen vorhanden</Text>
          ) : (
            sortedBerechnungen.map(b => (
              <TouchableOpacity
                key={b.id}
                style={[styles.tableRow, { borderBottomColor: colors.border }]}
                onPress={() => openDetailModal(b)}
              >
                <Text style={[styles.tableCell, styles.colSpielerName, { color: colors.text, fontWeight: '500' }]} numberOfLines={1}>
                  {b.spieler_name}
                </Text>
                <View style={[styles.colVerein, styles.clubCell]}>
                  {b.aktueller_verein && clubLogos[b.aktueller_verein] ? <Image source={{ uri: clubLogos[b.aktueller_verein] }} style={styles.tableClubLogo} /> : null}
                  <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>
                    {b.aktueller_verein || '-'}
                  </Text>
                </View>
                <Text style={[styles.tableCell, styles.colLiga, { color: colors.primary, fontWeight: '600' }]}>
                  {formatEUR(b.gesamt_bl)}
                </Text>
                <Text style={[styles.tableCell, styles.colLiga, { color: colors.primary, fontWeight: '600' }]}>
                  {formatEUR(b.gesamt_2bl)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // --- Mobile Card ---

  function renderMobileCard(b: AEBerechnung) {
    return (
      <TouchableOpacity
        key={b.id}
        style={[styles.aeCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
        onPress={() => openDetailModal(b)}
      >
        <Text style={[styles.aeCardName, { color: colors.text }]} numberOfLines={1}>{b.spieler_name}</Text>
        <View style={styles.aeCardClubRow}>
          {b.aktueller_verein && clubLogos[b.aktueller_verein] ? <Image source={{ uri: clubLogos[b.aktueller_verein] }} style={styles.mobileClubLogo} /> : null}
          <Text style={[styles.aeCardVerein, { color: colors.textSecondary }]} numberOfLines={1}>{b.aktueller_verein || '-'}</Text>
        </View>
        <View style={styles.aeCardResults}>
          <View style={styles.aeCardResultRow}>
            <Text style={[styles.aeCardLiga, { color: colors.textMuted }]}>Wechsel in 1. BL</Text>
            <Text style={[styles.aeCardAmount, { color: colors.primary }]}>{formatEUR(b.gesamt_bl)}</Text>
          </View>
          <View style={styles.aeCardResultRow}>
            <Text style={[styles.aeCardLiga, { color: colors.textMuted }]}>Wechsel in 2. BL</Text>
            <Text style={[styles.aeCardAmount, { color: colors.primary }]}>{formatEUR(b.gesamt_2bl)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // --- Mobile View ---

  if (isMobile) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: colors.background }]}>
        <MobileHeader title="AE-Rechner" onMenuPress={() => setShowMobileSidebar(true)} navigation={navigation} />
        <MobileSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} navigation={navigation} activeScreen="wissenswertes" />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          <TouchableOpacity
            style={[styles.addButtonMobile, { backgroundColor: colors.primary }]}
            onPress={openNewModal}
          >
            <Text style={[styles.addButtonText, { color: colors.primaryText }]}>+ Neuen Spieler anlegen</Text>
          </TouchableOpacity>

          {loading ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Laden...</Text>
          ) : sortedBerechnungen.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Noch keine Berechnungen vorhanden</Text>
          ) : (
            sortedBerechnungen.map(b => renderMobileCard(b))
          )}
        </ScrollView>

        {renderQuizModal()}
      </View>
    );
  }

  // --- Desktop View ---

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Sidebar navigation={navigation} activeScreen="wissenswertes" profile={profile} />

      <View style={styles.mainContent}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>← Zurück</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text, flex: 1 }]}>Ausbildungsentschädigungsrechner</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={openNewModal}
          >
            <Text style={[styles.addButtonText, { color: colors.primaryText }]}>+ Neuen Spieler anlegen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {renderDesktopTable()}
        </View>

        {renderQuizModal()}
      </View>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  // Layout
  container: { flex: 1, flexDirection: 'row' },
  containerMobile: { flex: 1 },
  mainContent: { flex: 1 },
  header: { padding: 24, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  content: { flex: 1, padding: 24 },

  // Add Button
  addButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1 },
  addButtonMobile: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  addButtonText: { fontSize: 14, fontWeight: '600' },

  // Table (Desktop)
  tableWrapper: { flex: 1, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  tableHeaderText: { fontWeight: '600', fontSize: 13 },
  tableBody: { flex: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, alignItems: 'center' },
  tableCell: { fontSize: 14 },
  colSpielerName: { flex: 2, minWidth: 150 },
  colVerein: { flex: 2, minWidth: 150 },
  clubCell: { flexDirection: 'row', alignItems: 'center' },
  tableClubLogo: { width: 22, height: 22, resizeMode: 'contain' as const, marginRight: 8 },
  colLiga: { flex: 1, minWidth: 100 },
  emptyText: { padding: 20, textAlign: 'center' },

  // Mobile Cards
  aeCard: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  aeCardName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  aeCardClubRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mobileClubLogo: { width: 18, height: 18, resizeMode: 'contain' as const, marginRight: 6 },
  aeCardVerein: { fontSize: 13 },
  aeCardResults: { gap: 4 },
  aeCardResultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aeCardLiga: { fontSize: 12, fontWeight: '500' },
  aeCardAmount: { fontSize: 13, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: 16, padding: 24, width: '90%', maxWidth: 600, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { fontSize: 18 },

  // Quiz - Progress
  progressContainer: { marginBottom: 24 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, textAlign: 'right' },

  // Quiz - Questions
  questionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  questionHint: { fontSize: 14, marginBottom: 20 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionsRow: { flexDirection: 'row', gap: 10 },
  optionsColumn: { gap: 10 },
  optionBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, borderWidth: 2, minWidth: 80, alignItems: 'center' },
  optionBtnText: { fontSize: 16, fontWeight: '600' },
  optionBtnSubtext: { fontSize: 12, marginTop: 2 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  formInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14 },
  infoBox: { padding: 16, borderRadius: 10, borderWidth: 1 },

  // Dropdowns (identical to TransfersScreen club selector)
  dropdownContainer: { position: 'relative' as const, zIndex: 100, maxWidth: 400 },
  dropdown: { position: 'absolute' as const, top: '100%' as const, left: 0, right: 0, borderRadius: 8, borderWidth: 1, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, zIndex: 9999, elevation: 9999 },
  dropdownScroll: { maxHeight: 200 },
  dropdownItem: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  dropdownText: { fontSize: 14, flex: 1 },
  dropdownSubtext: { fontSize: 12, marginLeft: 8 },
  dropdownLogo: { width: 24, height: 24, resizeMode: 'contain' as const, marginRight: 10 },
  dropdownCustomItem: { backgroundColor: '#f0fdf4' },
  dropdownCustomText: { fontSize: 14, color: '#16a34a', fontWeight: '500' as const },
  clubInputRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  clubLogoInput: { width: 28, height: 28, resizeMode: 'contain' as const },

  // Quiz - Navigation
  quizNavButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  quizNavBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10 },
  quizNavBtnBack: { borderWidth: 1 },
  quizNavBtnNext: {},
  quizNavBtnText: { fontSize: 16, fontWeight: '600' },

  // Results
  resultCard: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  resultLiga: { fontSize: 13, marginBottom: 4 },
  resultAmount: { fontSize: 22, fontWeight: '700' },
  resultDetails: { padding: 16, paddingTop: 12, borderTopWidth: 1 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resultLabel: { fontSize: 14 },
  resultValue: { fontSize: 14, fontWeight: '600' },
  factorSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  factorTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  factorLabel: { fontSize: 13 },
  factorValue: { fontSize: 13, fontWeight: '500' },
  resultActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  deleteBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444' },
  deleteBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center' },
  saveBtnText: { fontWeight: '600', fontSize: 16 },

  // Summary (detail view)
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, position: 'relative' as const, gap: 8 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  summaryResultTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  summaryActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  editBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  editBtnText: { fontWeight: '600', fontSize: 14 },
  tooltipBubble: { position: 'absolute' as const, left: 0, right: 0, top: '100%' as const, padding: 12, borderRadius: 8, borderWidth: 1, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10, zIndex: 9999 },
  tooltipText: { fontSize: 13, lineHeight: 18 },
});
