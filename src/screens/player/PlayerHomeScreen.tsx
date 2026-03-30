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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';

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
}

const PLAYER_FIELDS = 'id, first_name, last_name, birth_date, phone, phone_country_code, email, street, postal_code, city, education, training, interests, father_name, father_phone, father_phone_country_code, father_job, mother_name, mother_phone, mother_phone_country_code, mother_job, siblings, other_notes';

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

export function PlayerHomeScreen() {
  const { session, profile, signOut, viewAsPlayer, setViewAsPlayer } = useAuth();
  const { colors } = useTheme();

  const [player, setPlayer] = useState<PlayerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit states
  const [editingPrivat, setEditingPrivat] = useState(false);
  const [editingFamilie, setEditingFamilie] = useState(false);
  const [saving, setSaving] = useState(false);

  // Privat edit form
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneCountryCode, setEditPhoneCountryCode] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editEducation, setEditEducation] = useState('');
  const [editTraining, setEditTraining] = useState('');
  const [editInterests, setEditInterests] = useState('');

  // Familie edit form
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

  const populatePrivatForm = (p: PlayerDetails) => {
    setEditBirthDate(p.birth_date || '');
    setEditPhone(p.phone || '');
    setEditPhoneCountryCode(p.phone_country_code || '');
    setEditEmail(p.email || '');
    setEditStreet(p.street || '');
    setEditPostalCode(p.postal_code || '');
    setEditCity(p.city || '');
    setEditEducation(p.education || '');
    setEditTraining(p.training || '');
    setEditInterests(p.interests || '');
  };

  const populateFamilieForm = (p: PlayerDetails) => {
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
  };

  const fetchPlayerDetails = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Check if profile has a player_details_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('player_details_id')
        .eq('id', session.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('Profile fetch error:', profileError);
      }

      let playerDetailsId = profileData?.player_details_id;

      if (!playerDetailsId && profile?.first_name && profile?.last_name) {
        // Try matching by name as fallback
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

      // If still no match, create a new player_details row
      if (!playerDetailsId) {
        const { data: newRow, error: createError } = await supabase
          .from('player_details')
          .insert({
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
          })
          .select('id')
          .single();

        if (createError) {
          console.warn('Create player_details error:', createError);
          setPlayer(null);
          return;
        }

        playerDetailsId = newRow.id;

        // Save back to profile for future lookups
        await supabase
          .from('profiles')
          .update({ player_details_id: playerDetailsId })
          .eq('id', session.user.id);
      }

      const { data: playerData, error: playerError } = await supabase
        .from('player_details')
        .select(PLAYER_FIELDS)
        .eq('id', playerDetailsId)
        .single();

      if (playerError) {
        console.warn('Player details fetch error:', playerError);
        setPlayer(null);
        return;
      }

      setPlayer(playerData);
      populatePrivatForm(playerData);
      populateFamilieForm(playerData);
    } catch (error) {
      console.warn('fetchPlayerDetails exception:', error);
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

  const savePrivat = async () => {
    if (!player) return;
    setSaving(true);
    try {
      const updateData: any = {
        birth_date: editBirthDate || null,
        phone: editPhone,
        phone_country_code: editPhoneCountryCode,
        email: editEmail,
        street: editStreet,
        postal_code: editPostalCode,
        city: editCity,
        education: editEducation,
        training: editTraining,
        interests: editInterests,
      };

      const { error } = await supabase
        .from('player_details')
        .update(updateData)
        .eq('id', player.id);

      if (error) {
        Alert.alert('Fehler', 'Daten konnten nicht gespeichert werden.');
        console.warn('Save privat error:', error);
      } else {
        const updated = { ...player, ...updateData };
        setPlayer(updated);
        setEditingPrivat(false);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setSaving(false);
    }
  };

  const saveFamilie = async () => {
    if (!player) return;
    setSaving(true);
    try {
      const updateData: any = {
        father_name: editFatherName,
        father_phone: editFatherPhone,
        father_phone_country_code: editFatherPhoneCC,
        father_job: editFatherJob,
        mother_name: editMotherName,
        mother_phone: editMotherPhone,
        mother_phone_country_code: editMotherPhoneCC,
        mother_job: editMotherJob,
        siblings: editSiblings,
        other_notes: editOtherNotes,
      };

      const { error } = await supabase
        .from('player_details')
        .update(updateData)
        .eq('id', player.id);

      if (error) {
        Alert.alert('Fehler', 'Familiendaten konnten nicht gespeichert werden.');
        console.warn('Save familie error:', error);
      } else {
        const updated = { ...player, ...updateData };
        setPlayer(updated);
        setEditingFamilie(false);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setSaving(false);
    }
  };

  const cancelPrivatEdit = () => {
    if (player) populatePrivatForm(player);
    setEditingPrivat(false);
  };

  const cancelFamilieEdit = () => {
    if (player) populateFamilieForm(player);
    setEditingFamilie(false);
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

  const playerName = player
    ? `${player.first_name || ''} ${player.last_name || ''}`.trim()
    : `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();

  const formatPhone = (phone: string | null | undefined, cc: string | null | undefined) => {
    if (!phone) return '-';
    return `${cc || ''} ${phone}`.trim();
  };

  const formatAddress = (street: string | null | undefined, plz: string | null | undefined, city: string | null | undefined) => {
    const parts = [street, [plz, city].filter(Boolean).join(' ')].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '-';
  };

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
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{'\u2190'} Zur{'\u00FC'}ck zur Berater-Ansicht</Text>
          </TouchableOpacity>
        )}

        {/* Header */}
        <Text style={[styles.screenTitle, { color: colors.text }]}>Mein Profil</Text>
        {playerName ? (
          <Text style={[styles.playerNameHeader, { color: colors.textSecondary }]}>{playerName}</Text>
        ) : null}

        {/* ========== PRIVAT CARD ========== */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Privat</Text>
            {!editingPrivat ? (
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary }]}
                onPress={() => setEditingPrivat(true)}
              >
                <Text style={[styles.editButtonText, { color: colors.primaryText }]}>Bearbeiten</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {editingPrivat ? (
            <View style={styles.editForm}>
              <View style={styles.twoColumns}>
                <View style={styles.column}>
                  <EditField label="Geburtsdatum" value={editBirthDate} onChangeText={setEditBirthDate} colors={colors} placeholder="YYYY-MM-DD" />
                  <EditField label="Ländervorwahl" value={editPhoneCountryCode} onChangeText={setEditPhoneCountryCode} colors={colors} placeholder="+49" keyboardType="phone-pad" />
                  <EditField label="Telefon" value={editPhone} onChangeText={setEditPhone} colors={colors} keyboardType="phone-pad" />
                  <EditField label="E-Mail" value={editEmail} onChangeText={setEditEmail} colors={colors} keyboardType="email-address" />
                  <EditField label="Stra{'\u00DF'}e" value={editStreet} onChangeText={setEditStreet} colors={colors} />
                  <EditField label="PLZ" value={editPostalCode} onChangeText={setEditPostalCode} colors={colors} keyboardType="numeric" />
                  <EditField label="Stadt" value={editCity} onChangeText={setEditCity} colors={colors} />
                </View>
                <View style={styles.column}>
                  <EditField label="Schulabschluss" value={editEducation} onChangeText={setEditEducation} colors={colors} />
                  <EditField label="Ausbildung/Studium" value={editTraining} onChangeText={setEditTraining} colors={colors} />
                  <EditField label="Weitere Interessen" value={editInterests} onChangeText={setEditInterests} colors={colors} />
                </View>
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={cancelPrivatEdit}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={savePrivat}
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
            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <InfoRow label="Geburtsdatum" value={formatDate(player?.birth_date)} colors={colors} />
                <InfoRow label="Telefon" value={formatPhone(player?.phone, player?.phone_country_code)} colors={colors} />
                <InfoRow label="E-Mail" value={player?.email || '-'} colors={colors} />
                <InfoRow label="Adresse" value={formatAddress(player?.street, player?.postal_code, player?.city)} colors={colors} />
              </View>
              <View style={styles.column}>
                <InfoRow label="Schulabschluss" value={player?.education || '-'} colors={colors} />
                <InfoRow label="Ausbildung/Studium" value={player?.training || '-'} colors={colors} />
                <InfoRow label="Weitere Interessen" value={player?.interests || '-'} colors={colors} />
              </View>
            </View>
          )}
        </View>

        {/* ========== FAMILIE CARD ========== */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Familie</Text>
            {!editingFamilie ? (
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary }]}
                onPress={() => setEditingFamilie(true)}
              >
                <Text style={[styles.editButtonText, { color: colors.primaryText }]}>Bearbeiten</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {editingFamilie ? (
            <View style={styles.editForm}>
              <View style={styles.twoColumns}>
                <View style={styles.column}>
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Vater</Text>
                  <EditField label="Name" value={editFatherName} onChangeText={setEditFatherName} colors={colors} />
                  <EditField label="Ländervorwahl" value={editFatherPhoneCC} onChangeText={setEditFatherPhoneCC} colors={colors} placeholder="+49" keyboardType="phone-pad" />
                  <EditField label="Telefon" value={editFatherPhone} onChangeText={setEditFatherPhone} colors={colors} keyboardType="phone-pad" />
                  <EditField label="Job" value={editFatherJob} onChangeText={setEditFatherJob} colors={colors} />

                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>Mutter</Text>
                  <EditField label="Name" value={editMotherName} onChangeText={setEditMotherName} colors={colors} />
                  <EditField label="Ländervorwahl" value={editMotherPhoneCC} onChangeText={setEditMotherPhoneCC} colors={colors} placeholder="+49" keyboardType="phone-pad" />
                  <EditField label="Telefon" value={editMotherPhone} onChangeText={setEditMotherPhone} colors={colors} keyboardType="phone-pad" />
                  <EditField label="Job" value={editMotherJob} onChangeText={setEditMotherJob} colors={colors} />
                </View>
                <View style={styles.column}>
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Geschwister</Text>
                  <EditField label="Name" value={editSiblings} onChangeText={setEditSiblings} colors={colors} />

                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>Sonstiges</Text>
                  <EditField label="Notizen" value={editOtherNotes} onChangeText={setEditOtherNotes} colors={colors} multiline />
                </View>
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={cancelFamilieEdit}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={saveFamilie}
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
            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Vater</Text>
                <InfoRow label="Name" value={player?.father_name || '-'} colors={colors} />
                <InfoRow label="Telefon" value={formatPhone(player?.father_phone, player?.father_phone_country_code)} colors={colors} />
                <InfoRow label="Job" value={player?.father_job || '-'} colors={colors} />

                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>Mutter</Text>
                <InfoRow label="Name" value={player?.mother_name || '-'} colors={colors} />
                <InfoRow label="Telefon" value={formatPhone(player?.mother_phone, player?.mother_phone_country_code)} colors={colors} />
                <InfoRow label="Job" value={player?.mother_job || '-'} colors={colors} />
              </View>
              <View style={styles.column}>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Geschwister</Text>
                <InfoRow label="Name" value={player?.siblings || '-'} colors={colors} />

                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>Sonstiges</Text>
                <Text style={[styles.valueText, { color: colors.text }]}>{player?.other_notes || '-'}</Text>
              </View>
            </View>
          )}
        </View>

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
function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
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
      <Text style={[styles.editFieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[
          styles.editFieldInput,
          multiline ? styles.multilineInput : null,
          { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
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
    marginBottom: 2,
  },
  playerNameHeader: {
    fontSize: 12,
    marginBottom: 16,
  },
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
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 2,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 16,
  },
  column: {
    flex: 1,
  },
  infoRow: {
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 10,
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 11,
    fontWeight: '500',
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
    marginBottom: 8,
  },
  editFieldLabel: {
    fontSize: 10,
    marginBottom: 3,
  },
  editFieldInput: {
    fontSize: 11,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
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
