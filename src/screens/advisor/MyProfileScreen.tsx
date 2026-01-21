import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';

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

interface PlayerAccess {
  id: string;
  player_id: string;
  access_type: string;
  player_name?: string;
}

export function MyProfileScreen({ navigation }: any) {
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
  const [myPlayers, setMyPlayers] = useState<PlayerAccess[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PlayerAccess[]>([]);
  
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [originalEmail, setOriginalEmail] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchMyPlayers();
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

  const fetchMyPlayers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: accessData } = await supabase
      .from('player_access')
      .select('id, player_id, access_type')
      .eq('advisor_id', user.id);

    if (accessData && accessData.length > 0) {
      const playerIds = accessData.map(a => a.player_id);
      const { data: players } = await supabase
        .from('player_details')
        .select('id, first_name, last_name')
        .in('id', playerIds);

      const enrichedData = accessData.map(access => ({
        ...access,
        player_name: players?.find(p => p.id === access.player_id)
          ? `${players.find(p => p.id === access.player_id)?.first_name} ${players.find(p => p.id === access.player_id)?.last_name}`
          : 'Unbekannt'
      }));

      setMyPlayers(enrichedData.filter(a => a.access_type === 'owner' || a.access_type === 'viewer'));
      setPendingRequests(enrichedData.filter(a => a.access_type === 'requested'));
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    console.log('Saving profile...', { firstName, lastName, birthDate, phone, phoneCode, photoUrl, email });

    // Check if email changed
    const emailChanged = email !== originalEmail;

    if (emailChanged) {
      // Update email in Supabase Auth (requires confirmation)
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
    
    // First verify old password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: oldPassword
    });
    
    if (signInError) {
      Alert.alert('Fehler', 'Aktuelles Passwort ist falsch');
      return;
    }
    
    // Now update password
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Laden...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mein Profil</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>
                {firstName?.[0] || ''}{lastName?.[0] || ''}
              </Text>
            </View>
          )}
          {editing && (
            <input
              type="text"
              style={{ marginTop: 12, padding: 10, fontSize: 14, borderRadius: 8, border: '1px solid #ddd', width: 250, textAlign: 'center' }}
              placeholder="Foto-URL"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          )}
        </View>

        {/* Profile Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Persönliche Daten</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Vorname</Text>
            {editing ? (
              <input
                type="text"
                style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' }}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Vorname"
              />
            ) : (
              <Text style={styles.value}>{firstName || '-'}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Nachname</Text>
            {editing ? (
              <input
                type="text"
                style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' }}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nachname"
              />
            ) : (
              <Text style={styles.value}>{lastName || '-'}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Geburtsdatum</Text>
            {editing ? (
              <input
                type="date"
                style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' }}
                value={convertToInputDate(birthDate)}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            ) : (
              <Text style={styles.value}>{formatDate(birthDate)}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Telefon</Text>
            {editing ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: 110 }}
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} ({c.country})</option>
                  ))}
                </select>
                <input
                  type="tel"
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', flex: 1 }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefonnummer"
                />
              </div>
            ) : (
              <Text style={styles.value}>
                {phone ? `${phoneCode} ${phone}` : '-'}
              </Text>
            )}
          </View>
        </View>

        {/* Account Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Rolle</Text>
            <View style={[styles.roleBadge, getRoleBadgeStyle(profile?.role || 'berater')]}>
              <Text style={styles.roleBadgeText}>{getRoleDisplay(profile?.role || 'berater')}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>E-Mail</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="E-Mail-Adresse"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <Text style={styles.value}>{email}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Passwort</Text>
            {showPasswordChange ? (
              <View>
                <input
                  type="password"
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
                  placeholder="Aktuelles Passwort"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <input
                  type="password"
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
                  placeholder="Neues Passwort"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                  type="password"
                  style={{ padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' }}
                  placeholder="Neues Passwort bestätigen"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <TouchableOpacity onPress={handleForgotPassword} style={{ marginTop: 8 }}>
                  <Text style={{ color: '#5bc0de', fontSize: 14 }}>Passwort vergessen?</Text>
                </TouchableOpacity>
                <View style={styles.passwordButtons}>
                  <TouchableOpacity style={styles.cancelPasswordButton} onPress={() => { setShowPasswordChange(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}>
                    <Text style={styles.cancelPasswordButtonText}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.savePasswordButton} onPress={handlePasswordChange}>
                    <Text style={styles.savePasswordButtonText}>Speichern</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.changePasswordButton} onPress={() => setShowPasswordChange(true)}>
                <Text style={styles.changePasswordButtonText}>Passwort ändern</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Abmelden</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        {editing ? (
          <>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Speichern...' : 'Speichern'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
            <Text style={styles.editButtonText}>Bearbeiten</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  backButtonText: { fontSize: 20, color: '#333' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 16 },
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  photoSection: { alignItems: 'center', marginBottom: 16 },
  photo: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#eee' },
  photoPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#f0f0f0', paddingBottom: 12 },
  subTitle: { fontSize: 15, fontWeight: '600', color: '#666', marginTop: 16, marginBottom: 8 },
  infoRow: { marginBottom: 16 },
  label: { fontSize: 13, color: '#999', marginBottom: 4 },
  value: { fontSize: 16, color: '#333' },
  roleBadge: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, alignSelf: 'flex-start' },
  roleAdmin: { backgroundColor: '#000' },
  roleBerater: { backgroundColor: '#5bc0de' },
  roleScout: { backgroundColor: '#28a745' },
  roleSpieler: { backgroundColor: '#ffc107' },
  roleBadgeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  changePasswordButton: { backgroundColor: '#f0f0f0', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  changePasswordButtonText: { color: '#333', fontSize: 14, fontWeight: '600' },
  passwordButtons: { flexDirection: 'row', marginTop: 12, gap: 8 },
  cancelPasswordButton: { flex: 1, backgroundColor: '#eee', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  cancelPasswordButtonText: { color: '#666', fontWeight: '600' },
  savePasswordButton: { flex: 1, backgroundColor: '#000', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  savePasswordButtonText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: '#999', fontSize: 14, fontStyle: 'italic' },
  playerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  playerName: { fontSize: 15, color: '#333' },
  accessBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  accessOwner: { backgroundColor: '#000' },
  accessViewer: { backgroundColor: '#6c757d' },
  accessBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  accessPending: { backgroundColor: '#ffc107', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  accessPendingText: { color: '#333', fontSize: 12, fontWeight: '600' },
  logoutButton: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#ff4444', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  logoutButtonText: { color: '#ff4444', fontSize: 16, fontWeight: '600' },
  bottomButtons: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', justifyContent: 'flex-end', gap: 8 },
  editButton: { backgroundColor: '#000', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { backgroundColor: '#eee', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10 },
  cancelButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#000', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
  saveButtonDisabled: { backgroundColor: '#666' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
