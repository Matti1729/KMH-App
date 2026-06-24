import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Linking,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { supabase } from '../../config/supabase';
import * as ImagePicker from 'expo-image-picker';

const BACKGROUND_IMAGE = require('../../../assets/stadion-bg.jpeg');
const TransfermarktIcon = require('../../../assets/transfermarkt-logo.png');
const InstagramIcon = require('../../../assets/instagram.png.webp');
const LinkedInIcon = require('../../../assets/linkedin.png');
const TikTokIcon = require('../../../assets/tiktok.png');

function buildSocialUrl(platform: 'instagram' | 'tiktok' | 'linkedin', handle: string): string {
  const h = handle.trim();
  if (!h) return '';
  if (/^https?:\/\//i.test(h)) return h;
  const clean = h.replace(/^@/, '');
  if (platform === 'instagram') return `https://instagram.com/${clean}`;
  if (platform === 'tiktok') return `https://tiktok.com/@${clean}`;
  return `https://linkedin.com/in/${clean}`;
}

const CLUB_UMLAUT_MAP: Array<[RegExp, string]> = [
  [/saarbrucken/gi, 'Saarbrücken'],
  [/munchen/gi, 'München'],
  [/nurnberg/gi, 'Nürnberg'],
  [/dusseldorf/gi, 'Düsseldorf'],
  [/monchengladbach/gi, 'Mönchengladbach'],
  [/furth/gi, 'Fürth'],
  [/koln\b/gi, 'Köln'],
  [/wurzburg/gi, 'Würzburg'],
  [/hombug/gi, 'Homburg'],
  [/osnabruck/gi, 'Osnabrück'],
];

function normalizeGermanClubName(club: string): string {
  if (!club) return club;
  let out = club;
  for (const [regex, replacement] of CLUB_UMLAUT_MAP) out = out.replace(regex, replacement);
  return out;
}

function resolveClubLogo(clubName: string, clubLogos: Record<string, string>): string | null {
  if (!clubName) return null;
  if (clubLogos[clubName]) return clubLogos[clubName];
  const variations = [
    clubName, clubName.replace('FC ', '').replace(' FC', ''),
    clubName.replace('1. ', ''), clubName.replace('SV ', '').replace(' SV', ''),
    clubName.replace('VfB ', '').replace(' VfB', ''), clubName.replace('VfL ', '').replace(' VfL', ''),
    clubName.replace('TSG ', '').replace(' TSG', ''), clubName.replace('SC ', '').replace(' SC', ''),
  ];
  for (const v of variations) if (clubLogos[v]) return clubLogos[v];
  for (const [logoClub, logoUrl] of Object.entries(clubLogos)) {
    if (clubName.toLowerCase().includes(logoClub.toLowerCase()) || logoClub.toLowerCase().includes(clubName.toLowerCase())) return logoUrl;
  }
  return null;
}

interface PlayerDetails {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string;
  phone_country_code: string;
  email: string;
  street: string;
  postal_code: string;
  city: string;
  education: string;
  training: string;
  interests: string;
  father_name: string;
  father_phone: string;
  father_phone_country_code: string;
  father_job: string;
  mother_name: string;
  mother_phone: string;
  mother_phone_country_code: string;
  mother_job: string;
  siblings: string;
  other_notes: string;
  job: string;
  instagram: string;
  tiktok: string;
  linkedin: string;
}

// Spieler-View liest:
//   - Berater-only Read-fields (Name, Position, Club, Vertrag, Foto, TM-URL) als unsuffixed Spalten
//   - Persönlich-bezogene Felder NUR als `_player`-Suffix (sieht keine Berater-Eintragungen)
//   - Stamm-Daten (birth_date, nationality) als _player UND _advisor: Spieler sieht den Berater-Wert
//     (kommt typisch über TM), kann ihn aber überschreiben mit eigenem _player-Wert
//   - Neue Spalte `additional_info_player` für "Weitere Informationen"
const PLAYER_FIELDS = 'id, first_name, last_name, position, contract_end, club, photo_url, transfermarkt_url, ' +
  // Stamm-Daten: alle drei Spalten lesen — TM-Pull schreibt typisch in unsuffixed,
  // Migration kopiert nach _advisor; Spieler-Wert hat Vorrang.
  'birth_date, birth_date_player, birth_date_advisor, nationality, nationality_player, nationality_advisor, ' +
  // Persönliche Felder als _player-Spalten
  'phone_player, phone_country_code_player, email_player, ' +
  'street_player, postal_code_player, city_player, ' +
  'education_player, training_player, job_player, ' +
  'father_name_player, father_phone_player, father_phone_country_code_player, father_job_player, ' +
  'mother_name_player, mother_phone_player, mother_phone_country_code_player, mother_job_player, siblings_player, ' +
  'instagram_player, tiktok_player, linkedin_player, ' +
  'injuries_player, internat_player, ' +
  'additional_info_player';

const COUNTRY_TO_ISO: Record<string, string> = {
  'Deutschland': 'DE', 'Österreich': 'AT', 'Schweiz': 'CH', 'Frankreich': 'FR',
  'Italien': 'IT', 'Spanien': 'ES', 'Portugal': 'PT', 'Niederlande': 'NL',
  'Belgien': 'BE', 'England': 'GB', 'Polen': 'PL', 'Kroatien': 'HR',
  'Serbien': 'RS', 'Türkei': 'TR', 'Brasilien': 'BR', 'Argentinien': 'AR',
  'USA': 'US', 'Kanada': 'CA', 'Dänemark': 'DK', 'Schweden': 'SE', 'Norwegen': 'NO',
  'Finnland': 'FI', 'Island': 'IS', 'Irland': 'IE', 'Schottland': 'GB',
  'Wales': 'GB', 'Griechenland': 'GR', 'Tschechien': 'CZ', 'Slowakei': 'SK',
  'Ungarn': 'HU', 'Rumänien': 'RO', 'Bulgarien': 'BG', 'Slowenien': 'SI',
  'Bosnien und Herzegowina': 'BA', 'Bosnien-Herzegowina': 'BA', 'Montenegro': 'ME',
  'Nordmazedonien': 'MK', 'Albanien': 'AL', 'Kosovo': 'XK', 'Ukraine': 'UA',
  'Russland': 'RU', 'Japan': 'JP', 'Südkorea': 'KR', 'China': 'CN',
  'Australien': 'AU', 'Mexiko': 'MX', 'Kolumbien': 'CO', 'Chile': 'CL',
  'Peru': 'PE', 'Uruguay': 'UY', 'Paraguay': 'PY', 'Ecuador': 'EC',
  'Ghana': 'GH', 'Nigeria': 'NG', 'Kamerun': 'CM', 'Senegal': 'SN',
  'Elfenbeinküste': 'CI', 'Marokko': 'MA', 'Tunesien': 'TN', 'Ägypten': 'EG',
  'Südafrika': 'ZA', 'Israel': 'IL', 'Iran': 'IR', 'Irak': 'IQ',
  'Saudi-Arabien': 'SA', 'Vereinigte Arabische Emirate': 'AE', 'Indien': 'IN',
  'Luxemburg': 'LU', 'Litauen': 'LT', 'Lettland': 'LV', 'Estland': 'EE',
  'Georgien': 'GE', 'Armenien': 'AM', 'Aserbaidschan': 'AZ',
  'Syrien': 'SY', 'Libanon': 'LB', 'Jordanien': 'JO', 'Afghanistan': 'AF',
  'Pakistan': 'PK', 'Kongo': 'CD', 'Eritrea': 'ER', 'Somalia': 'SO',
  'Äthiopien': 'ET', 'Guinea': 'GN', 'Mali': 'ML', 'Gambia': 'GM',
  'Sierra Leone': 'SL', 'Togo': 'TG', 'Benin': 'BJ', 'Burkina Faso': 'BF',
};

function countryToFlag(country: string): string {
  const iso = COUNTRY_TO_ISO[country];
  if (iso && iso.length === 2) {
    const cp1 = 0x1F1E6 + iso.charCodeAt(0) - 65;
    const cp2 = 0x1F1E6 + iso.charCodeAt(1) - 65;
    return String.fromCodePoint(cp1, cp2);
  }
  return '🏳️';
}

const COUNTRY_FLAGS: Record<string, string> = {};
for (const [name] of Object.entries(COUNTRY_TO_ISO)) {
  COUNTRY_FLAGS[name] = countryToFlag(name);
}

const POSITION_MAP: Record<string, string> = {
  'TW': 'Torwart', 'IV': 'Innenverteidiger', 'LV': 'Linker Verteidiger',
  'RV': 'Rechter Verteidiger', 'DM': 'Defensives Mittelfeld', 'ZM': 'Zentrales Mittelfeld',
  'OM': 'Offensives Mittelfeld', 'LA': 'Linke Außenbahn', 'RA': 'Rechte Außenbahn', 'ST': 'Stürmer',
};

function formatGermanDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try { const d = new Date(iso); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; } catch { return iso; }
}

function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  try {
    const birth = new Date(birthDate);
    const today = new Date();
    let a = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) a--;
    return a;
  } catch { return null; }
}

function formatContractEnd(iso: string | null | undefined): string {
  if (!iso) return '-';
  try { const d = new Date(iso); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; } catch { return iso; }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
}

export function PlayerPersonalDataScreen() {
  const navigation = useNavigation<any>();
  const { session, profile, viewAsPlayerId } = useAuth();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const [player, setPlayer] = useState<PlayerDetails | null>(null);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = editingCard !== null;
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showNatTooltip, setShowNatTooltip] = useState(false);
  const [photoPreviewUri, setPhotoPreviewUri] = useState<string | null>(null);
  const [photoScale, setPhotoScale] = useState(1.0);
  const [photoOffsetY, setPhotoOffsetY] = useState(0);

  const [editBirthDay, setEditBirthDay] = useState('');
  const [editBirthMonth, setEditBirthMonth] = useState('');
  const [editBirthYear, setEditBirthYear] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneCountryCode, setEditPhoneCountryCode] = useState('');
  const editBirthDate = editBirthYear && editBirthMonth && editBirthDay
    ? `${editBirthYear}-${editBirthMonth.padStart(2, '0')}-${editBirthDay.padStart(2, '0')}` : '';
  const [editEmail, setEditEmail] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editEducation, setEditEducation] = useState('');
  const [editJob, setEditJob] = useState('');
  const [editTraining, setEditTraining] = useState('');
  const [editInterests, setEditInterests] = useState('');

  const [editFatherName, setEditFatherName] = useState('');
  const [editFatherPhone, setEditFatherPhone] = useState('');
  const [editFatherPhoneCC, setEditFatherPhoneCC] = useState('');
  const [editFatherJob, setEditFatherJob] = useState('');
  const [editMotherName, setEditMotherName] = useState('');
  const [editMotherPhone, setEditMotherPhone] = useState('');
  const [editMotherPhoneCC, setEditMotherPhoneCC] = useState('');
  const [editMotherJob, setEditMotherJob] = useState('');
  const [editSiblings, setEditSiblings] = useState('');
  const [editOtherNotes, setEditOtherNotes] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editTiktok, setEditTiktok] = useState('');
  const [editLinkedin, setEditLinkedin] = useState('');
  const [editInternat, setEditInternat] = useState(false);
  const [internatOpen, setInternatOpen] = useState(false);

  // Click-Outside schließt das Internat-Dropdown (nur Web).
  useEffect(() => {
    if (!internatOpen || typeof document === 'undefined') return;
    const handler = (e: any) => {
      const t = e.target;
      if (t && t.closest && t.closest('[data-kmhdropdown]')) return;
      setInternatOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [internatOpen]);

  const populateForm = (p: PlayerDetails) => {
    if (p.birth_date) {
      try {
        const d = new Date(p.birth_date);
        setEditBirthDay(String(d.getDate()));
        setEditBirthMonth(String(d.getMonth() + 1));
        setEditBirthYear(String(d.getFullYear()));
      } catch {
        setEditBirthDay(''); setEditBirthMonth(''); setEditBirthYear('');
      }
    } else {
      setEditBirthDay(''); setEditBirthMonth(''); setEditBirthYear('');
    }
    setEditPhone(p.phone || '');
    setEditPhoneCountryCode(p.phone_country_code || '');
    setEditEmail(p.email || '');
    setEditStreet(p.street || '');
    setEditPostalCode(p.postal_code || '');
    setEditCity(p.city || '');
    setEditEducation(p.education || '');
    setEditTraining(p.training || '');
    setEditJob(p.job || '');
    setEditInterests(p.interests || '');
    setEditFatherName(p.father_name || '');
    setEditFatherPhone(p.father_phone || '');
    setEditFatherPhoneCC(p.father_phone_country_code || '');
    setEditFatherJob(p.father_job || '');
    setEditMotherName(p.mother_name || '');
    setEditMotherPhone(p.mother_phone || '');
    setEditMotherPhoneCC(p.mother_phone_country_code || '');
    setEditMotherJob(p.mother_job || '');
    setEditSiblings(p.siblings || '');
    setEditOtherNotes(p.other_notes || '');
    setEditInstagram(p.instagram || '');
    setEditTiktok(p.tiktok || '');
    setEditLinkedin(p.linkedin || '');
    setEditInternat((p as any).internat === true);
  };

  const fetchPlayerDetails = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      let playerDetailsId = viewAsPlayerId || null;

      // Kanonische Verknüpfung: player_details.linked_user_id == eingeloggter User.
      if (!playerDetailsId) {
        const { data: linkedRow, error: linkedError } = await supabase
          .from('player_details')
          .select('id')
          .eq('linked_user_id', session.user.id)
          .limit(1)
          .maybeSingle();

        if (linkedError) {
          console.warn('Linked player_details fetch error:', linkedError);
        }

        playerDetailsId = linkedRow?.id || null;
      }

      if (!playerDetailsId && profile?.first_name && profile?.last_name) {
        const { data: matchData, error: matchError } = await supabase
          .from('player_details')
          .select('id')
          .eq('first_name', profile.first_name)
          .eq('last_name', profile.last_name)
          .limit(1)
          .single();

        if (!matchError && matchData) {
          playerDetailsId = matchData.id;
        }
      }

      if (!playerDetailsId) {
        // Letzter Fallback: noch kein verknüpfter Datensatz → neuen anlegen und
        // direkt über linked_user_id mit dem User verbinden.
        const { data: newRow, error: createError } = await supabase
          .from('player_details')
          .insert({
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            linked_user_id: session.user.id,
          })
          .select('id')
          .single();

        if (createError) {
          console.warn('Create player_details error:', createError);
          setPlayer(null);
          return;
        }

        playerDetailsId = newRow.id;
      }

      const { data: rawData, error: playerError } = await supabase
        .from('player_details')
        .select(PLAYER_FIELDS)
        .eq('id', playerDetailsId)
        .single();

      if (playerError) {
        console.warn('Player details fetch error:', playerError);
        setPlayer(null);
        return;
      }

      // Mapper: _player-Spalten auf die alten Property-Namen mappen, sodass
      // das bestehende UI-Code (player.phone, player.email, etc.) unverändert
      // weiter funktioniert. Spieler sieht ausschließlich seine eigenen
      // Eintragungen — niemals Berater-Werte.
      const r: any = rawData;
      const playerData: any = r ? {
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        position: r.position,
        contract_end: r.contract_end,
        club: r.club,
        photo_url: r.photo_url,
        transfermarkt_url: r.transfermarkt_url,
        // Stamm-Daten sind shared: Geburtsdatum + Nationalität kommen typisch
        // initial von Transfermarkt/Berater. Spieler sieht den vorhandenen Wert
        // und kann ihn korrigieren. Spieler-Wert hat Vorrang sobald gesetzt.
        // Fallback-Kette: _player → _advisor → unsuffixed (TM-Pull schreibt dort).
        birth_date: r.birth_date_player || r.birth_date_advisor || r.birth_date || '',
        nationality: r.nationality_player || r.nationality_advisor || r.nationality || '',
        phone: r.phone_player || '',
        phone_country_code: r.phone_country_code_player || '',
        email: r.email_player || '',
        street: r.street_player || '',
        postal_code: r.postal_code_player || '',
        city: r.city_player || '',
        education: r.education_player || '',
        training: r.training_player || '',
        job: r.job_player || '',
        father_name: r.father_name_player || '',
        father_phone: r.father_phone_player || '',
        father_phone_country_code: r.father_phone_country_code_player || '',
        father_job: r.father_job_player || '',
        mother_name: r.mother_name_player || '',
        mother_phone: r.mother_phone_player || '',
        mother_phone_country_code: r.mother_phone_country_code_player || '',
        mother_job: r.mother_job_player || '',
        siblings: r.siblings_player || '',
        instagram: r.instagram_player || '',
        tiktok: r.tiktok_player || '',
        linkedin: r.linkedin_player || '',
        injuries: r.injuries_player || '',
        internat: r.internat_player ?? false,
        // Spieler hat ein zusammengefasstes "Weitere Informationen"-Feld;
        // der UI-Code liest weiterhin `interests` + `other_notes` getrennt,
        // wir mappen die zusammengefasste Quelle auf `interests` und lassen
        // `other_notes` leer (das UI-Feld wird unten umgebaut).
        interests: r.additional_info_player || '',
        other_notes: '',
      } : null;

      setPlayer(playerData);
      if (playerData) populateForm(playerData);
    } catch (error) {
      console.warn('fetchPlayerDetails exception:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, profile?.first_name, profile?.last_name, viewAsPlayerId]);

  useEffect(() => {
    fetchPlayerDetails();
    (async () => {
      const { data } = await supabase.from('club_logos').select('club_name, logo_url');
      if (data) {
        const map: Record<string, string> = {};
        for (const row of data) map[row.club_name] = row.logo_url;
        setClubLogos(map);
      }
    })();
  }, [fetchPlayerDetails]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlayerDetails();
  }, [fetchPlayerDetails]);

  const pickPhoto = async () => {
    if (!player?.id) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return;
    setPhotoPreviewUri(result.assets[0].uri);
    setPhotoScale(1.0);
    setPhotoOffsetY(0);
    setShowPhotoEditor(true);
  };

  const uploadPhoto = async () => {
    if (!player?.id || !photoPreviewUri) return;
    setShowPhotoEditor(false);
    setUploadingPhoto(true);
    try {
      const previewW = isMobile ? 110 : 150;
      const previewH = isMobile ? 140 : 190;
      const scale = 2;
      const targetW = previewW * scale;
      const targetH = previewH * scale;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d')!;
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = photoPreviewUri;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });
        const imgAspect = img.width / img.height;
        const previewAspect = previewW / previewH;
        let fitW: number, fitH: number;
        if (imgAspect > previewAspect) { fitW = previewW; fitH = previewW / imgAspect; }
        else { fitH = previewH; fitW = previewH * imgAspect; }
        const drawW = fitW * scale * photoScale;
        const drawH = fitH * scale * photoScale;
        const drawX = (targetW - drawW) / 2;
        const drawY = (targetH - drawH) / 2 + photoOffsetY * scale;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
        const fileName = `${player.id}/photo.png`;
        await supabase.storage.from('player-photos').remove([fileName]);
        await supabase.storage.from('player-photos').upload(fileName, blob, { contentType: 'image/png', upsert: true });
        const { data: urlData } = supabase.storage.from('player-photos').getPublicUrl(fileName);
        const photoUrl = urlData.publicUrl + '?t=' + Date.now();
        await supabase.from('player_details').update({ photo_url: photoUrl }).eq('id', player.id);
        setPlayer(prev => prev ? { ...prev, photo_url: photoUrl } as any : prev);
      } else {
        const response = await fetch(photoPreviewUri);
        const blob = await response.blob();
        const fileName = `${player.id}/photo.png`;
        await supabase.storage.from('player-photos').remove([fileName]);
        await supabase.storage.from('player-photos').upload(fileName, blob, { contentType: 'image/png', upsert: true });
        const { data: urlData } = supabase.storage.from('player-photos').getPublicUrl(fileName);
        const photoUrl = urlData.publicUrl + '?t=' + Date.now();
        await supabase.from('player_details').update({ photo_url: photoUrl }).eq('id', player.id);
        setPlayer(prev => prev ? { ...prev, photo_url: photoUrl } as any : prev);
      }
    } catch (err) {
      console.warn('Photo upload error:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Die Spieler-E-Mail wird automatisch auf die Registrierungs-E-Mail gesetzt
  // (= Login-E-Mail des Accounts). Im "Als Spieler ansehen"-Modus (Berater)
  // ist session.user.email der Berater — dann den gespeicherten Wert behalten.
  const getRegistrationEmail = (): string =>
    (!viewAsPlayerId && session?.user?.email) ? session.user.email : (player?.email || '');

  const saveAll = async () => {
    if (!player) return;
    setSaving(true);
    try {
      // Spieler-View schreibt ausschließlich in `_player`-Spalten + `additional_info_player`.
      // Berater-Werte (`_advisor`-Spalten) werden nie überschrieben.
      // editInterests + editOtherNotes werden zusammengefasst (siehe UI-Umbau Sonstiges).
      const additionalInfo = [editInterests, editOtherNotes].filter(s => s && s.trim()).join('\n').trim();
      const updateData: any = {
        birth_date_player: editBirthDate || null,
        phone_player: editPhone || null,
        phone_country_code_player: editPhoneCountryCode || null,
        email_player: getRegistrationEmail() || null,
        street_player: editStreet || null,
        postal_code_player: editPostalCode || null,
        city_player: editCity || null,
        education_player: editEducation || null,
        training_player: editTraining || null,
        job_player: editJob || null,
        father_name_player: editFatherName || null,
        father_phone_player: editFatherPhone || null,
        father_phone_country_code_player: editFatherPhoneCC || null,
        father_job_player: editFatherJob || null,
        mother_name_player: editMotherName || null,
        mother_phone_player: editMotherPhone || null,
        mother_phone_country_code_player: editMotherPhoneCC || null,
        mother_job_player: editMotherJob || null,
        siblings_player: editSiblings || null,
        instagram_player: editInstagram || null,
        tiktok_player: editTiktok || null,
        linkedin_player: editLinkedin || null,
        internat_player: editInternat,
        additional_info_player: additionalInfo || null,
      };

      const { error } = await supabase
        .from('player_details')
        .update(updateData)
        .eq('id', player.id);

      if (error) {
        Alert.alert('Fehler', 'Daten konnten nicht gespeichert werden.');
        console.warn('Save error:', error);
      } else {
        // Lokales Player-Objekt mit den UI-Property-Namen aktualisieren
        const updated: any = {
          ...player,
          birth_date: editBirthDate,
          phone: editPhone,
          phone_country_code: editPhoneCountryCode,
          email: getRegistrationEmail(),
          street: editStreet,
          postal_code: editPostalCode,
          city: editCity,
          education: editEducation,
          training: editTraining,
          job: editJob,
          father_name: editFatherName,
          father_phone: editFatherPhone,
          father_phone_country_code: editFatherPhoneCC,
          father_job: editFatherJob,
          mother_name: editMotherName,
          mother_phone: editMotherPhone,
          mother_phone_country_code: editMotherPhoneCC,
          mother_job: editMotherJob,
          siblings: editSiblings,
          instagram: editInstagram,
          tiktok: editTiktok,
          linkedin: editLinkedin,
          internat: editInternat,
          interests: additionalInfo,
          other_notes: '',
        };
        setPlayer(updated);
        setEditingCard(null);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (player) populateForm(player);
    setEditingCard(null);
  };

  const formatPhone = (phone: string | null | undefined, cc: string | null | undefined) => {
    if (!phone) return '-';
    return `${cc || ''} ${phone}`.trim();
  };

  const formatAddress = (street: string | null | undefined, plz: string | null | undefined, city: string | null | undefined) => {
    const parts = [street, [plz, city].filter(Boolean).join(' ')].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  const Inner = loading ? (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Daten werden geladen...</Text>
    </View>
  ) : (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {(() => {
        const firstName = ((player as any)?.first_name || profile?.first_name || '').toUpperCase();
        const lastName = ((player as any)?.last_name || profile?.last_name || '').toUpperCase();
        const clubLogo = (player as any)?.club ? resolveClubLogo((player as any).club, clubLogos) : null;
        const photoW = isMobile ? 90 : 150;
        const photoH = isMobile ? 120 : 190;
        const nameSize = isMobile ? 34 : 72;
        const nameLH = isMobile ? 38 : 76;
        return (
          <View style={[styles.headerCard, { borderColor: colors.cardBorder }, isMobile && { paddingHorizontal: 16, paddingTop: 16 }]}>
            <View style={[styles.headerTopRow, isMobile && { gap: 12 }]}>
              {/* Foto wird ausschließlich vom Berater verwaltet — Spieler sieht es nur read-only. */}
              <TouchableOpacity onPress={undefined} disabled activeOpacity={1} style={{ position: 'relative' }}>
                <View style={{ width: photoW, height: photoH, borderRadius: 8, overflow: 'hidden' }}>
                  {showPhotoEditor && photoPreviewUri ? (
                    <Image
                      source={{ uri: photoPreviewUri }}
                      style={{ width: photoW, height: photoH, transform: [{ scale: photoScale }, { translateY: photoOffsetY }] }}
                      resizeMode="contain"
                    />
                  ) : (player as any)?.photo_url ? (
                    <Image source={{ uri: (player as any).photo_url }} style={{ width: photoW, height: photoH }} resizeMode="contain" />
                  ) : (
                    <View style={[styles.headerPhotoPlaceholder, { width: photoW, height: photoH, backgroundColor: colors.primary }]}>
                      <Text style={[styles.headerInitials, isMobile && { fontSize: 30 }, { color: colors.primaryText }]}>{firstName[0] || ''}{lastName[0] || ''}</Text>
                    </View>
                  )}
                </View>
                {uploadingPhoto && (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
                {/* Foto-Bearbeitung-Indicator entfernt — Foto wird ausschließlich vom Berater verwaltet. */}
              </TouchableOpacity>
              <View style={[styles.headerNameWrap, { minHeight: photoH }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {firstName ? <Text numberOfLines={1} style={[styles.headerName, { fontSize: nameSize, lineHeight: nameLH }]}>{firstName}</Text> : null}
                    {lastName ? <Text numberOfLines={1} style={[styles.headerName, { fontSize: nameSize, lineHeight: nameLH }]}>{lastName}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 12 }}>
                    {!isMobile && <Text style={styles.headerScreenLabel}>Persönliche Daten</Text>}
                    {editing ? (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={styles.cardCancelBtn} onPress={cancelEdit}><Text style={styles.cardCancelText}>Abbrechen</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.cardSaveBtn} onPress={saveAll} disabled={saving}>
                          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.cardSaveText}>Speichern</Text>}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.cardEditBtn} onPress={() => setEditingCard('all')}><Text style={styles.cardEditText}>Bearbeiten</Text></TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={[styles.headerClubRow, { flex: 1, minWidth: 0 }, isMobile && { gap: 8 }]}>
                    {clubLogo ? <Image source={{ uri: clubLogo }} style={[styles.headerClubLogo, isMobile && { width: 32, height: 32 }]} /> : null}
                    <Text style={[styles.headerClubName, { flexShrink: 1 }, isMobile && { fontSize: 15, lineHeight: 20, marginTop: 0 }]} numberOfLines={1}>{normalizeGermanClubName((player as any)?.club || 'VEREINSLOS').toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.headerDivider} />

            <View style={styles.statsRow}>
              <Pressable style={styles.statCol} onHoverIn={() => setShowNatTooltip(true)} onHoverOut={() => setShowNatTooltip(false)}>
                <Text style={styles.statLabel}>NATIONALITÄT</Text>
                <Text style={[styles.statValue, { fontSize: 18, lineHeight: 20 }]}>
                  {(player as any)?.nationality ? (player as any).nationality.split(/[,\/]+/).map((n: string) => n.trim()).filter(Boolean).map((n: string) => COUNTRY_FLAGS[n] || countryToFlag(n)).join(' ') : '-'}
                </Text>
                {showNatTooltip && (player as any)?.nationality ? (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipText}>{(player as any).nationality}</Text>
                  </View>
                ) : null}
              </Pressable>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>GEBURTSDATUM</Text>
                <Text style={styles.statValue}>
                  {formatGermanDate((player as any)?.birth_date)}{(() => { const a = calculateAge((player as any)?.birth_date); return a !== null ? `  (${a})` : ''; })()}
                </Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>POSITION</Text>
                <Text style={styles.statValue}>{(player as any)?.position ? (POSITION_MAP[(player as any).position] || (player as any).position) : '-'}</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>VERTRAGSENDE</Text>
                <Text style={styles.statValue}>{formatContractEnd((player as any)?.contract_end)}</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>TRANSFERMARKT-PROFIL</Text>
                {(player as any)?.transfermarkt_url ? (
                  <TouchableOpacity onPress={() => Linking.openURL((player as any).transfermarkt_url)}>
                    <Ionicons name="link" size={16} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.statValue}>-</Text>
                )}
              </View>
            </View>
          </View>
        );
      })()}

      {/* PhotoEditor entfernt — Foto-Bearbeitung erfolgt ausschließlich im Berater-View. */}

        <View style={styles.dataGrid}>
          {/* Karte: Allgemeine Angaben */}
          <View style={styles.dataGridCard}>
            <Text style={[styles.cardSectionLabel, { marginBottom: 12 }]}>Kontaktdaten</Text>
            <View style={{ flex: 1 }}>
              {editing ? (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Telefon</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    <View style={{ width: 70 }}>
                      <TextInput style={styles.editInput} value={editPhoneCountryCode} onChangeText={setEditPhoneCountryCode} placeholder="+49" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput style={styles.editInput} value={editPhone} onChangeText={setEditPhone} placeholder="1701234567" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
                    </View>
                  </View>
                  <View style={styles.editFieldContainer}>
                    <Text style={styles.editFieldLabel}>E-Mail</Text>
                    <Text style={{ fontSize: 13, color: '#fff', paddingVertical: 4 }}>{getRegistrationEmail() || '-'}</Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>Automatisch aus deiner Registrierung</Text>
                  </View>
                  <EditField label="Straße" value={editStreet} onChangeText={setEditStreet} colors={colors} placeholder="Musterstraße 12" />
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>PLZ / Ort</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    <View style={{ width: 80 }}>
                      <TextInput style={styles.editInput} value={editPostalCode} onChangeText={setEditPostalCode} placeholder="12345" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput style={styles.editInput} value={editCity} onChangeText={setEditCity} placeholder="Musterstadt" placeholderTextColor={colors.textMuted} />
                    </View>
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Internat</Text>
                  <View style={{ marginBottom: 10 }} {...({ dataSet: { kmhdropdown: 'true' } } as any)}>
                    <TouchableOpacity
                      style={[styles.editInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => setInternatOpen(o => !o)}
                    >
                      <Text style={{ color: '#fff', fontSize: 13 }}>{editInternat ? 'Ja' : 'Nein'}</Text>
                      <Ionicons name={internatOpen ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                    {internatOpen && (
                      <View style={{ marginTop: 4, backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden' }}>
                        {[{ label: 'Ja', val: true }, { label: 'Nein', val: false }].map((opt, i) => (
                          <TouchableOpacity
                            key={opt.label}
                            style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: i === 0 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.08)' }}
                            onPress={() => { setEditInternat(opt.val); setInternatOpen(false); }}
                          >
                            <Ionicons name={editInternat === opt.val ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={editInternat === opt.val ? '#22c55e' : 'rgba(255,255,255,0.4)'} />
                            <Text style={{ color: '#fff', fontSize: 13 }}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <>

                  <InfoRow label="Telefon" value={formatPhone(player?.phone, player?.phone_country_code)} colors={colors} />
                  <InfoRow label="E-Mail" value={getRegistrationEmail() || '-'} colors={colors} />
                  <InfoRow label="Adresse" value={formatAddress(player?.street, player?.postal_code, player?.city)} colors={colors} />
                  <InfoRow label="Internat" value={(player as any)?.internat ? 'Ja' : 'Nein'} colors={colors} />
                </>
              )}
            </View>
          </View>

          {/* Karte: Familie */}
          <View style={styles.dataGridCard}>
            <Text style={[styles.cardSectionLabel, { marginBottom: 12 }]}>Familie</Text>
            <View style={{ flex: 1 }}>
              {editing ? (
                <View style={styles.threeColumns}>
                  <View style={styles.column}>
                    <EditField label="Papa" value={editFatherName} onChangeText={setEditFatherName} colors={colors} placeholder="Thomas Mustermann" />
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Telefon</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      <View style={{ width: 60 }}>
                        <TextInput style={styles.editInput} value={editFatherPhoneCC} onChangeText={setEditFatherPhoneCC} placeholder="+49" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput style={styles.editInput} value={editFatherPhone} onChangeText={setEditFatherPhone} placeholder="1701234567" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
                      </View>
                    </View>
                    <EditField label="Job" value={editFatherJob} onChangeText={setEditFatherJob} colors={colors} placeholder="Ingenieur" />
                  </View>
                  <View style={styles.column}>
                    <EditField label="Mama" value={editMotherName} onChangeText={setEditMotherName} colors={colors} placeholder="Anna Mustermann" />
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Telefon</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      <View style={{ width: 60 }}>
                        <TextInput style={styles.editInput} value={editMotherPhoneCC} onChangeText={setEditMotherPhoneCC} placeholder="+49" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput style={styles.editInput} value={editMotherPhone} onChangeText={setEditMotherPhone} placeholder="1709876543" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
                      </View>
                    </View>
                    <EditField label="Job" value={editMotherJob} onChangeText={setEditMotherJob} colors={colors} placeholder="Lehrerin" />
                  </View>
                  <View style={styles.column}>
                    <EditField label="Geschwister" value={editSiblings} onChangeText={setEditSiblings} colors={colors} placeholder="Lisa, Tim" />
                  </View>
                </View>
              ) : (
                <View style={styles.threeColumns}>
                  <View style={styles.column}>
                    <InfoRow label="Papa" value={player?.father_name || '-'} colors={colors} />
                    <InfoRow label="Telefon" value={formatPhone(player?.father_phone, player?.father_phone_country_code)} colors={colors} />
                    <InfoRow label="Job" value={player?.father_job || '-'} colors={colors} />
                  </View>
                  <View style={styles.column}>
                    <InfoRow label="Mama" value={player?.mother_name || '-'} colors={colors} />
                    <InfoRow label="Telefon" value={formatPhone(player?.mother_phone, player?.mother_phone_country_code)} colors={colors} />
                    <InfoRow label="Job" value={player?.mother_job || '-'} colors={colors} />
                  </View>
                  <View style={styles.column}>
                    <InfoRow label="Geschwister" value={player?.siblings || '-'} colors={colors} />
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Karte: Ausbildung */}
          <View style={styles.dataGridCard}>
            <Text style={[styles.cardSectionLabel, { marginBottom: 12 }]}>Ausbildung</Text>
            <View style={{ flex: 1 }}>
              {editing ? (
                <View style={styles.threeColumns}>
                  <View style={styles.column}>
                    <EditField label="Schulabschluss" value={editEducation} onChangeText={setEditEducation} colors={colors} placeholder="Abitur 2027" />
                  </View>
                  <View style={styles.column}>
                    <EditField label="Ausbildung/Studium" value={editTraining} onChangeText={setEditTraining} colors={colors} placeholder="Wirtschaftsinformatik (Bachelor)" />
                  </View>
                  <View style={styles.column}>
                    <EditField label="Job" value={editJob} onChangeText={setEditJob} colors={colors} placeholder="Nebenjob im Sportverein" />
                  </View>
                </View>
              ) : (
                <View style={styles.threeColumns}>
                  <View style={styles.column}>
                    <InfoRow label="Schulabschluss" value={player?.education || '-'} colors={colors} />
                  </View>
                  <View style={styles.column}>
                    <InfoRow label="Ausbildung/Studium" value={player?.training || '-'} colors={colors} />
                  </View>
                  <View style={styles.column}>
                    <InfoRow label="Job" value={(player as any)?.job || '-'} colors={colors} />
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Karte: Sonstiges */}
          <View style={styles.dataGridCard}>
            <Text style={[styles.cardSectionLabel, { marginBottom: 12 }]}>Sonstiges</Text>
            <View style={{ flex: 1 }}>
              {editing ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ flex: 1 }}>
                      <EditField label="Instagram" value={editInstagram} onChangeText={setEditInstagram} colors={colors} placeholder="https://instagram.com/max.mustermann" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <EditField label="TikTok" value={editTiktok} onChangeText={setEditTiktok} colors={colors} placeholder="https://tiktok.com/@maxmuster" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <EditField label="LinkedIn" value={editLinkedin} onChangeText={setEditLinkedin} colors={colors} placeholder="https://linkedin.com/in/max-mustermann" />
                    </View>
                  </View>
                  <EditField label="Weitere Informationen" value={editInterests} onChangeText={setEditInterests} colors={colors} multiline placeholder="Hobbies, Familie, Ziele, etc." />
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ flex: 1 }}>
                      <SocialLinkRow label="Instagram" handle={player?.instagram || ''} icon={InstagramIcon} platform="instagram" colors={colors} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <SocialLinkRow label="TikTok" handle={player?.tiktok || ''} icon={TikTokIcon} platform="tiktok" colors={colors} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <SocialLinkRow label="LinkedIn" handle={player?.linkedin || ''} icon={LinkedInIcon} platform="linkedin" colors={colors} />
                    </View>
                  </View>
                  <InfoRow label="Weitere Informationen" value={player?.interests || '-'} colors={colors} />
                </>
              )}
            </View>
          </View>
        </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );

  if (isMobile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="personalData"
          profile={profile as any}
          playerMode
        />
        <MobileHeader title="Persönliche Daten" onMenuPress={() => setShowMobileSidebar(true)} />
        <View style={{ flex: 1, position: 'relative' }}>
          <Image source={BACKGROUND_IMAGE} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectPosition: 'center 75%' } as any} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
          {Inner}
        </View>

      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.containerDesktop, { backgroundColor: colors.background }]}>
      <Sidebar navigation={navigation} activeScreen="personalData" profile={profile as any} playerMode />
      <View style={[styles.mainContent, { position: 'relative' }]}>
        <Image source={BACKGROUND_IMAGE} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectPosition: 'center 75%' } as any} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
        {Inner}
      </View>
    </View>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function SocialLinkRow({
  label,
  handle,
  icon,
  platform,
  colors,
}: {
  label: string;
  handle: string;
  icon: any;
  platform: 'instagram' | 'tiktok' | 'linkedin';
  colors: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      {handle ? (
        <TouchableOpacity
          onPress={() => Linking.openURL(buildSocialUrl(platform, handle))}
          style={{ alignSelf: 'flex-start', width: 22, height: 22, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}
        >
          <Image
            source={icon}
            style={platform === 'tiktok' ? { width: 40, height: 40 } : { width: 22, height: 22, borderRadius: 5 }}
          />
        </TouchableOpacity>
      ) : (
        <Text style={[styles.infoValue, { color: colors.text }]}>-</Text>
      )}
    </View>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  colors,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  colors: any;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={styles.editFieldContainer}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.editFieldInput,
          multiline ? styles.multilineInput : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDesktop: { flex: 1, flexDirection: 'row' },
  mainContent: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 11, marginTop: 12 },
  screenTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  // Player Header
  headerCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 0,
    marginBottom: 16,
    overflow: 'hidden',
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  headerPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  headerInitials: { fontSize: 42, fontWeight: '700' },
  headerName: { fontFamily: 'Josefin Sans', fontWeight: '400', letterSpacing: 2, textTransform: 'uppercase', color: '#fff' },
  headerNameWrap: { flex: 1, justifyContent: 'space-between', paddingBottom: 8 },
  headerClubRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerClubLogo: { width: 44, height: 44, resizeMode: 'contain' },
  headerClubName: { fontFamily: 'Josefin Sans', fontSize: 30, lineHeight: 38, fontWeight: '300', letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  headerScreenLabel: { fontFamily: 'Josefin Sans', fontSize: 26, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' },
  cardSectionLabel: { fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' },
  headerTmButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.92)' },
  headerTmText: { fontSize: 12, fontWeight: '600', color: '#111' },
  headerDivider: { height: 1, marginTop: 20, marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.3)' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 16, justifyContent: 'center', paddingHorizontal: 40 },
  statCol: { minWidth: 110, gap: 4, flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  statValue: { fontSize: 13, fontWeight: '500', color: '#fff', textAlign: 'center' },
  tooltip: { position: 'absolute', bottom: '100%', marginBottom: 4, backgroundColor: 'rgba(0,0,0,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, zIndex: 10 },
  tooltipText: { fontSize: 11, color: '#fff' },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 2,
  },
  twoColumns: { flexDirection: 'row', gap: 16 },
  threeColumns: { flexDirection: 'row', gap: 16 },
  column: { flex: 1 },
  infoRow: { marginBottom: 14 },
  infoLabel: { fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  infoValue: { fontSize: 13, fontWeight: '500' },
  valueText: { fontSize: 11, fontWeight: '500' },
  editButton: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  editButtonText: { fontSize: 11, fontWeight: '600' },
  editForm: { marginTop: 4 },
  editFieldContainer: { marginBottom: 14 },
  editFieldLabel: { fontSize: 10, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8, color: 'rgba(255,255,255,0.5)' },
  editFieldInput: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 4,
    fontSize: 13,
    color: '#fff',
  },
  multilineInput: { minHeight: 60, paddingVertical: 8, textAlignVertical: 'top' },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelButtonText: { fontSize: 11, fontWeight: '500' },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: { fontSize: 11, fontWeight: '600' },
  bottomSpacer: { height: 32 },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dataGridCard: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 280,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
  },
  cardEditRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  cardEditBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' },
  cardEditText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  cardCancelBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' },
  cardCancelText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  cardSaveBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#22c55e', backgroundColor: '#22c55e' },
  cardSaveText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  fieldLabel: { fontSize: 10, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  editInput: { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, fontSize: 13, color: '#fff' },
});
