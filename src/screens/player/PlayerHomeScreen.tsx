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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';

const POSITION_MAP: Record<string, string> = {
  'TW': 'Torwart',
  'IV': 'Innenverteidiger',
  'LV': 'Linker Verteidiger',
  'RV': 'Rechter Verteidiger',
  'DM': 'Defensives Mittelfeld',
  'ZM': 'Zentrales Mittelfeld',
  'OM': 'Offensives Mittelfeld',
  'LA': 'Linke Außenbahn',
  'RA': 'Rechte Außenbahn',
  'ST': 'Stürmer',
};

interface PlayerDetails {
  id: string;
  first_name: string;
  last_name: string;
  nationality: string;
  birth_date: string;
  club: string;
  league: string;
  position: string;
  secondary_position: string;
  contract_end: string;
  photo_url: string;
  strong_foot: string;
  height: number;
  phone: string;
  phone_country_code: string;
  email: string;
  instagram: string;
  linkedin: string;
  tiktok: string;
  street: string;
  postal_code: string;
  city: string;
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

function calculateAge(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try {
    const birth = new Date(dateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
}

function getPositionShort(position: string): string {
  for (const [short, long] of Object.entries(POSITION_MAP)) {
    if (long === position) return short;
  }
  return position;
}

export function PlayerHomeScreen() {
  const { session, profile, signOut, viewAsPlayer, setViewAsPlayer } = useAuth();
  const { colors, isDark } = useTheme();

  const [player, setPlayer] = useState<PlayerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notLinked, setNotLinked] = useState(false);

  // Editable section states
  const [editingContact, setEditingContact] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form values
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editLinkedin, setEditLinkedin] = useState('');
  const [editTiktok, setEditTiktok] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editCity, setEditCity] = useState('');

  const fetchPlayerDetails = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // First check if profile has a player_details_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('player_details_id')
        .eq('id', session.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('Profile fetch error:', profileError);
      }

      let playerDetailsId = profileData?.player_details_id;

      if (!playerDetailsId) {
        // Try matching by name as fallback
        if (profile?.first_name && profile?.last_name) {
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
      }

      if (!playerDetailsId) {
        setNotLinked(true);
        setPlayer(null);
        return;
      }

      const { data: playerData, error: playerError } = await supabase
        .from('player_details')
        .select('id, first_name, last_name, nationality, birth_date, club, league, position, secondary_position, contract_end, photo_url, strong_foot, height, phone, phone_country_code, email, instagram, linkedin, tiktok, street, postal_code, city')
        .eq('id', playerDetailsId)
        .single();

      if (playerError) {
        console.warn('Player details fetch error:', playerError);
        setNotLinked(true);
        setPlayer(null);
        return;
      }

      setPlayer(playerData);
      setNotLinked(false);

      // Populate edit forms
      setEditPhone(playerData.phone || '');
      setEditEmail(playerData.email || '');
      setEditInstagram(playerData.instagram || '');
      setEditLinkedin(playerData.linkedin || '');
      setEditTiktok(playerData.tiktok || '');
      setEditStreet(playerData.street || '');
      setEditPostalCode(playerData.postal_code || '');
      setEditCity(playerData.city || '');
    } catch (error) {
      console.warn('fetchPlayerDetails exception:', error);
      setNotLinked(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, profile?.first_name, profile?.last_name]);

  useEffect(() => {
    fetchPlayerDetails();
  }, [fetchPlayerDetails]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlayerDetails();
  }, [fetchPlayerDetails]);

  const saveContact = async () => {
    if (!player) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('player_details')
        .update({
          phone: editPhone,
          email: editEmail,
          instagram: editInstagram,
          linkedin: editLinkedin,
          tiktok: editTiktok,
        })
        .eq('id', player.id);

      if (error) {
        Alert.alert('Fehler', 'Kontaktdaten konnten nicht gespeichert werden.');
        console.warn('Save contact error:', error);
      } else {
        setPlayer({ ...player, phone: editPhone, email: editEmail, instagram: editInstagram, linkedin: editLinkedin, tiktok: editTiktok });
        setEditingContact(false);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setSaving(false);
    }
  };

  const saveAddress = async () => {
    if (!player) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('player_details')
        .update({
          street: editStreet,
          postal_code: editPostalCode,
          city: editCity,
        })
        .eq('id', player.id);

      if (error) {
        Alert.alert('Fehler', 'Adresse konnte nicht gespeichert werden.');
        console.warn('Save address error:', error);
      } else {
        setPlayer({ ...player, street: editStreet, postal_code: editPostalCode, city: editCity });
        setEditingAddress(false);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setSaving(false);
    }
  };

  const cancelContactEdit = () => {
    setEditPhone(player?.phone || '');
    setEditEmail(player?.email || '');
    setEditInstagram(player?.instagram || '');
    setEditLinkedin(player?.linkedin || '');
    setEditTiktok(player?.tiktok || '');
    setEditingContact(false);
  };

  const cancelAddressEdit = () => {
    setEditStreet(player?.street || '');
    setEditPostalCode(player?.postal_code || '');
    setEditCity(player?.city || '');
    setEditingAddress(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Profil wird geladen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const age = player ? calculateAge(player.birth_date) : null;
  const posShort = player ? getPositionShort(player.position) : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Zurück zur Berater-Ansicht */}
        {viewAsPlayer && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f6', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, marginBottom: 16, alignSelf: 'flex-start' }}
            onPress={() => setViewAsPlayer(false)}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>← Zurück zur Berater-Ansicht</Text>
          </TouchableOpacity>
        )}

        {/* Header */}
        <Text style={[styles.screenTitle, { color: colors.text }]}>KMH Spielerprofil</Text>

        {notLinked || !player ? (
          /* Not Linked State */
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Text style={[styles.notLinkedTitle, { color: colors.text }]}>Profil nicht verkn{'\u00FC'}pft</Text>
            <Text style={[styles.notLinkedText, { color: colors.textSecondary }]}>
              Dein Profil wurde noch nicht verkn{'\u00FC'}pft. Bitte wende dich an deinen Berater.
            </Text>
          </View>
        ) : (
          <>
            {/* Profile Header Card */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
              <View style={styles.profileHeader}>
                {player.photo_url ? (
                  <Image source={{ uri: player.photo_url }} style={styles.profilePhoto} />
                ) : (
                  <View style={[styles.profilePhotoPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.profilePhotoInitials, { color: colors.textMuted }]}>
                      {(player.first_name?.[0] || '')}{(player.last_name?.[0] || '')}
                    </Text>
                  </View>
                )}
                <View style={styles.profileHeaderInfo}>
                  <Text style={[styles.playerName, { color: colors.text }]}>
                    {player.first_name} {player.last_name}
                  </Text>
                  <Text style={[styles.playerMeta, { color: colors.textSecondary }]}>
                    {posShort}{player.club ? ` \u00B7 ${player.club}` : ''}{player.league ? ` \u00B7 ${player.league}` : ''}
                  </Text>
                  {player.birth_date ? (
                    <Text style={[styles.playerMeta, { color: colors.textSecondary }]}>
                      {formatDate(player.birth_date)}{age !== null ? ` (${age})` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Vertrag Card */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>VERTRAG</Text>
              <InfoRow label="Verein" value={player.club} colors={colors} />
              <InfoRow label="Liga" value={player.league} colors={colors} />
              <InfoRow label="Position" value={player.position || posShort} colors={colors} />
              {player.secondary_position ? (
                <InfoRow label="Nebenposition" value={player.secondary_position} colors={colors} />
              ) : null}
              <InfoRow label="Vertragsende" value={formatDate(player.contract_end)} colors={colors} />
            </View>

            {/* Allgemein Card */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>ALLGEMEIN</Text>
              <InfoRow label="Nationalit{'\u00E4'}t" value={player.nationality} colors={colors} />
              <InfoRow label="Gr{'\u00F6'}{'\u00DF'}e" value={player.height ? `${player.height} cm` : '-'} colors={colors} />
              <InfoRow label="Starker Fu{'\u00DF'}" value={player.strong_foot} colors={colors} />
            </View>

            {/* Kontaktdaten Card */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>KONTAKTDATEN</Text>
                {!editingContact ? (
                  <TouchableOpacity
                    style={[styles.editButton, { backgroundColor: colors.primary }]}
                    onPress={() => setEditingContact(true)}
                  >
                    <Text style={[styles.editButtonText, { color: colors.primaryText }]}>Bearbeiten</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {editingContact ? (
                <View style={styles.editForm}>
                  <EditField label="Telefon" value={editPhone} onChangeText={setEditPhone} colors={colors} keyboardType="phone-pad" />
                  <EditField label="E-Mail" value={editEmail} onChangeText={setEditEmail} colors={colors} keyboardType="email-address" />
                  <EditField label="Instagram" value={editInstagram} onChangeText={setEditInstagram} colors={colors} placeholder="@benutzername" />
                  <EditField label="LinkedIn" value={editLinkedin} onChangeText={setEditLinkedin} colors={colors} placeholder="Profil-URL" />
                  <EditField label="TikTok" value={editTiktok} onChangeText={setEditTiktok} colors={colors} placeholder="@benutzername" />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.cancelButton, { borderColor: colors.border }]}
                      onPress={cancelContactEdit}
                    >
                      <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveButton, { backgroundColor: colors.primary }]}
                      onPress={saveContact}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={colors.primaryText} />
                      ) : (
                        <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>Speichern</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <InfoRow label="Telefon" value={player.phone ? `${player.phone_country_code || ''} ${player.phone}`.trim() : '-'} colors={colors} />
                  <InfoRow label="E-Mail" value={player.email} colors={colors} />
                  <InfoRow label="Instagram" value={player.instagram} colors={colors} />
                  <InfoRow label="LinkedIn" value={player.linkedin} colors={colors} />
                  <InfoRow label="TikTok" value={player.tiktok} colors={colors} />
                </View>
              )}
            </View>

            {/* Adresse Card */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>ADRESSE</Text>
                {!editingAddress ? (
                  <TouchableOpacity
                    style={[styles.editButton, { backgroundColor: colors.primary }]}
                    onPress={() => setEditingAddress(true)}
                  >
                    <Text style={[styles.editButtonText, { color: colors.primaryText }]}>Bearbeiten</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {editingAddress ? (
                <View style={styles.editForm}>
                  <EditField label="Stra{'\u00DF'}e" value={editStreet} onChangeText={setEditStreet} colors={colors} />
                  <EditField label="PLZ" value={editPostalCode} onChangeText={setEditPostalCode} colors={colors} keyboardType="numeric" />
                  <EditField label="Stadt" value={editCity} onChangeText={setEditCity} colors={colors} />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.cancelButton, { borderColor: colors.border }]}
                      onPress={cancelAddressEdit}
                    >
                      <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveButton, { backgroundColor: colors.primary }]}
                      onPress={saveAddress}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={colors.primaryText} />
                      ) : (
                        <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>Speichern</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <InfoRow label="Stra{'\u00DF'}e" value={player.street} colors={colors} />
                  <InfoRow label="PLZ" value={player.postal_code} colors={colors} />
                  <InfoRow label="Stadt" value={player.city} colors={colors} />
                </View>
              )}
            </View>
          </>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.primary }]}
          onPress={signOut}
        >
          <Text style={[styles.logoutText, { color: colors.primaryText }]}>Abmelden</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* Info Row Component */
function InfoRow({ label, value, colors }: { label: string; value: string | null | undefined; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value || '-'}</Text>
    </View>
  );
}

/* Edit Field Component */
function EditField({
  label,
  value,
  onChangeText,
  colors,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  colors: any;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}) {
  return (
    <View style={styles.editFieldContainer}>
      <Text style={[styles.editFieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.editFieldInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 11,
    marginTop: 12,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  notLinkedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  notLinkedText: {
    fontSize: 11,
    lineHeight: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 14,
  },
  profilePhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhotoInitials: {
    fontSize: 20,
    fontWeight: '600',
  },
  profileHeaderInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  playerMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 11,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  editForm: {
    marginTop: 4,
  },
  editFieldContainer: {
    marginBottom: 10,
  },
  editFieldLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  editFieldInput: {
    fontSize: 11,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 32,
  },
});
