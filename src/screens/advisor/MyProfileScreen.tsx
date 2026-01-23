import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import { useTheme } from '../../contexts/ThemeContext';

const COUNTRY_CODES = [
  { code: '+49', country: 'DE' }, { code: '+43', country: 'AT' }, { code: '+41', country: 'CH' },
  { code: '+33', country: 'FR' }, { code: '+31', country: 'NL' }, { code: '+32', country: 'BE' },
  { code: '+39', country: 'IT' }, { code: '+34', country: 'ES' }, { code: '+44', country: 'UK' },
  { code: '+48', country: 'PL' }, { code: '+420', country: 'CZ' }, { code: '+45', country: 'DK' },
  { code: '+46', country: 'SE' }, { code: '+47', country: 'NO' }, { code: '+90', country: 'TR' },
  { code: '+385', country: 'HR' }, { code: '+381', country: 'RS' }, { code: '+30', country: 'GR' },
  { code: '+351', country: 'PT' }, { code: '+1', country: 'US' },
];

interface AdvisorProfile {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string;
  phone_country_code: string;
  photo_url: string;
  role: string;
}

export function MyProfileScreen({ navigation }: any) {
  const { theme, colors, setTheme, isDark } = useTheme();

  const [profile, setProfile] = useState<AdvisorProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('+49');
  const [photoUrl, setPhotoUrl] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [originalEmail, setOriginalEmail] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Fehler', 'Nicht eingeloggt');
      navigation.goBack();
      return;
    }

    setEmail(user.email || '');
    setOriginalEmail(user.email || '');

    const { data, error } = await supabase
      .from('advisors')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.log('Error fetching profile:', error);
      if (error.code === 'PGRST116') {
        const { data: newProfile } = await supabase
          .from('advisors')
          .insert([{ id: user.id, first_name: '', last_name: '' }])
          .select()
          .single();

        if (newProfile) {
          setProfile(newProfile);
          setFirstName(newProfile.first_name || '');
          setLastName(newProfile.last_name || '');
          setBirthDate(newProfile.birth_date || '');
          setPhone(newProfile.phone || '');
          setPhoneCode(newProfile.phone_country_code || '+49');
          setPhotoUrl(newProfile.photo_url || '');
        }
      }
    } else {
      setProfile(data);
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setBirthDate(data.birth_date || '');
      setPhone(data.phone || '');
      setPhoneCode(data.phone_country_code || '+49');
      setPhotoUrl(data.photo_url || '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!email || !email.includes('@')) {
      Alert.alert('Fehler', 'Bitte gib eine gültige E-Mail-Adresse ein');
      return;
    }

    setSaving(true);

    const emailChanged = email !== originalEmail;

    if (emailChanged) {
      const { error: authError } = await supabase.auth.updateUser({ email: email });
      if (authError) {
        setSaving(false);
        Alert.alert('Fehler', authError.message);
        return;
      }
    }

    const { data, error } = await supabase
      .from('advisors')
      .update({
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate || null,
        phone: phone || null,
        phone_country_code: phoneCode,
        photo_url: photoUrl || null,
        email: email,
      })
      .eq('id', profile.id)
      .select();

    setSaving(false);

    if (error) {
      console.log('Save error:', error);
      Alert.alert('Fehler', error.message);
    } else {
      console.log('Save success:', data);
      if (emailChanged) {
        Alert.alert('Erfolg', 'Profil gespeichert. Bitte bestätige die neue E-Mail-Adresse über den Link in der Bestätigungsmail.');
      } else {
        Alert.alert('Erfolg', 'Profil wurde gespeichert');
      }
      setEditing(false);
      fetchProfile();
    }
  };

  const handleCancel = () => {
    setEditing(false);
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setBirthDate(profile.birth_date || '');
      setPhone(profile.phone || '');
      setPhoneCode(profile.phone_country_code || '+49');
      setPhotoUrl(profile.photo_url || '');
    }
    setEmail(originalEmail);
  };

  const handlePasswordChange = async () => {
    if (!oldPassword) {
      Alert.alert('Fehler', 'Bitte geben Sie Ihr aktuelles Passwort ein');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Fehler', 'Neues Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Fehler', 'Passwörter stimmen nicht überein');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: oldPassword
    });

    if (signInError) {
      Alert.alert('Fehler', 'Aktuelles Passwort ist falsch');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      Alert.alert('Fehler', error.message);
    } else {
      Alert.alert('Erfolg', 'Passwort wurde geändert');
      setShowPasswordChange(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleForgotPassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      Alert.alert('Fehler', error.message);
    } else {
      Alert.alert('Erfolg', 'Eine E-Mail zum Zurücksetzen des Passworts wurde gesendet');
      setShowPasswordChange(false);
    }
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

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'berater': return 'Berater';
      case 'scout': return 'Scout';
      case 'spieler': return 'Spieler';
      default: return 'Berater';
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin': return styles.roleAdmin;
      case 'scout': return styles.roleScout;
      case 'spieler': return styles.roleSpieler;
      default: return styles.roleBerater;
    }
  };

  const toggleDarkMode = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Laden...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mein Profil</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={[styles.photoPlaceholderText, { color: colors.primaryText }]}>
                {firstName?.[0] || ''}{lastName?.[0] || ''}
              </Text>
            </View>
          )}
          {editing && (
            <input
              type="text"
              style={{ marginTop: 12, padding: 10, fontSize: 14, borderRadius: 8, border: `1px solid ${colors.border}`, width: 250, textAlign: 'center', backgroundColor: colors.inputBackground, color: colors.text }}
              placeholder="Foto-URL"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          )}
        </View>

        {/* Dark Mode Card */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Erscheinungsbild</Text>

          <View style={styles.darkModeRow}>
            <Text style={[styles.darkModeLabel, { color: colors.text }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleDarkMode}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isDark ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Profile Card */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Persönliche Daten</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Vorname</Text>
            {editing ? (
              <input
                type="text"
                style={{ padding: 12, fontSize: 15, borderRadius: 8, border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', backgroundColor: colors.inputBackground, color: colors.text }}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Vorname"
              />
            ) : (
              <Text style={[styles.value, { color: colors.text }]}>{firstName || '-'}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Nachname</Text>
            {editing ? (
              <input
                type="text"
                style={{ padding: 12, fontSize: 15, borderRadius: 8, border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', backgroundColor: colors.inputBackground, color: colors.text }}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nachname"
              />
            ) : (
              <Text style={[styles.value, { color: colors.text }]}>{lastName || '-'}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Geburtsdatum</Text>
            {editing ? (
              <input
                type="date"
                style={{ padding: 12, fontSize: 15, borderRadius: 8, border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', backgroundColor: colors.inputBackground, color: colors.text }}
                value={convertToInputDate(birthDate)}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            ) : (
              <Text style={[styles.value, { color: colors.text }]}>{formatDate(birthDate)}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Telefon</Text>
            {editing ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: `1px solid ${colors.border}`, width: 110, backgroundColor: colors.inputBackground, color: colors.text }}
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} ({c.country})</option>
                  ))}
                </select>
                <input
                  type="tel"
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: `1px solid ${colors.border}`, flex: 1, backgroundColor: colors.inputBackground, color: colors.text }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefonnummer"
                />
              </div>
            ) : (
              <Text style={[styles.value, { color: colors.text }]}>
                {phone ? `${phoneCode} ${phone}` : '-'}
              </Text>
            )}
          </View>
        </View>

        {/* Account Card */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Account</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Rolle</Text>
            <View style={[styles.roleBadge, getRoleBadgeStyle(profile?.role || 'berater')]}>
              <Text style={styles.roleBadgeText}>{getRoleDisplay(profile?.role || 'berater')}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textMuted }]}>E-Mail</Text>
            {editing ? (
              <input
                type="email"
                style={{ padding: 12, fontSize: 15, borderRadius: 8, border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', backgroundColor: colors.inputBackground, color: colors.text } as any}
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                placeholder="E-Mail-Adresse"
              />
            ) : (
              <Text style={[styles.value, { color: colors.text }]}>{email}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Passwort</Text>
            {showPasswordChange ? (
              <View>
                <input
                  type="password"
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', marginBottom: 8, backgroundColor: colors.inputBackground, color: colors.text }}
                  placeholder="Aktuelles Passwort"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <input
                  type="password"
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', marginBottom: 8, backgroundColor: colors.inputBackground, color: colors.text }}
                  placeholder="Neues Passwort"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                  type="password"
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', backgroundColor: colors.inputBackground, color: colors.text }}
                  placeholder="Neues Passwort bestätigen"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <TouchableOpacity onPress={handleForgotPassword} style={{ marginTop: 8 }}>
                  <Text style={{ color: '#5bc0de', fontSize: 14 }}>Passwort vergessen?</Text>
                </TouchableOpacity>
                <View style={styles.passwordButtons}>
                  <TouchableOpacity style={[styles.cancelPasswordButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { setShowPasswordChange(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}>
                    <Text style={[styles.cancelPasswordButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.savePasswordButton, { backgroundColor: colors.primary }]} onPress={handlePasswordChange}>
                    <Text style={[styles.savePasswordButtonText, { color: colors.primaryText }]}>Speichern</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={[styles.changePasswordButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setShowPasswordChange(true)}>
                <Text style={[styles.changePasswordButtonText, { color: colors.text }]}>Passwort ändern</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </ScrollView>

      {/* Bottom Buttons */}
      <View style={[styles.bottomButtons, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {editing ? (
          <>
            <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]} onPress={handleCancel}>
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>{saving ? 'Speichern...' : 'Speichern'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.primary }]} onPress={() => setEditing(true)}>
            <Text style={[styles.editButtonText, { color: colors.primaryText }]}>Bearbeiten</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backButtonText: { fontSize: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 16 },
  loadingText: { padding: 20, textAlign: 'center' },
  photoSection: { alignItems: 'center', marginBottom: 16 },
  photo: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#eee' },
  photoPlaceholder: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderText: { fontSize: 36, fontWeight: 'bold' },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, borderBottomWidth: 2, borderBottomColor: 'rgba(128,128,128,0.2)', paddingBottom: 12 },
  darkModeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  darkModeLabel: { fontSize: 16, fontWeight: '500' },
  infoRow: { marginBottom: 16 },
  label: { fontSize: 13, marginBottom: 4 },
  value: { fontSize: 16 },
  roleBadge: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, alignSelf: 'flex-start' },
  roleAdmin: { backgroundColor: '#000' },
  roleBerater: { backgroundColor: '#5bc0de' },
  roleScout: { backgroundColor: '#28a745' },
  roleSpieler: { backgroundColor: '#ffc107' },
  roleBadgeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  changePasswordButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  changePasswordButtonText: { fontSize: 14, fontWeight: '600' },
  passwordButtons: { flexDirection: 'row', marginTop: 12, gap: 8 },
  cancelPasswordButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  cancelPasswordButtonText: { fontWeight: '600' },
  savePasswordButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  savePasswordButtonText: { fontWeight: '600' },
  bottomButtons: { flexDirection: 'row', padding: 16, borderTopWidth: 1, justifyContent: 'flex-end', gap: 8 },
  editButton: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
  editButtonText: { fontSize: 16, fontWeight: '600' },
  cancelButton: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10 },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  saveButton: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: '600' },
});
