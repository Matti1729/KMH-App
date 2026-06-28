import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useDialog } from '../../components/DialogProvider';

export function RegisterScreen({ navigation, route }: any) {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const { alert: alertDialog } = useDialog();
  const playerDetailsId = route?.params?.playerDetailsId;

  // Vor-/Nachname aus dem Spielerprofil übernehmen — bleibt editierbar,
  // falls der Spieler z.B. noch einen zweiten Vornamen ergänzen möchte.
  const [firstName, setFirstName] = useState(route?.params?.playerFirstName || '');
  const [lastName, setLastName] = useState(route?.params?.playerLastName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !passwordConfirm) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    // Die Verknüpfung player_details.linked_user_id übernimmt der DB-Trigger
    // handle_player_account_link anhand der mitgegebenen playerDetailsId.
    const { error: signUpError } = await signUp(email.trim(), password, firstName.trim(), lastName.trim(), 'player', playerDetailsId);
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    setLoading(false);
    // Keine E-Mail-Bestätigung — nach signUp besteht bereits eine Session,
    // der RootNavigator wechselt automatisch in die Spieler-Ansicht und zeigt dort
    // das Willkommens-Modal. Kein separater Alert (würde das Modal überlagern).
  };

  const renderField = (
    label: string,
    value: string,
    onChange: (t: string) => void,
    extra?: object,
  ) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(t) => { onChange(t); setError(null); }}
        placeholderTextColor="rgba(255,255,255,0.3)"
        {...extra}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Skyline-Hintergrund */}
          <View style={styles.bgWrap} pointerEvents="none">
            <Image
              source={require('../../../assets/scouting-header-bg.jpg')}
              style={styles.bgImage}
              resizeMode="cover"
            />
            <View style={styles.bgOverlay} />
          </View>

          <View style={styles.inner}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Registrieren</Text>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>Erstelle deinen persönlichen Zugang</Text>

            {renderField('Vorname', firstName, setFirstName, { autoCapitalize: 'words' })}
            {renderField('Nachname', lastName, setLastName, { autoCapitalize: 'words' })}
            {renderField('E-Mail', email, setEmail, { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
            {renderField('Passwort', password, setPassword, { secureTextEntry: true })}
            {renderField('Passwort bestätigen', passwordConfirm, setPasswordConfirm, { secureTextEntry: true, onSubmitEditing: handleRegister })}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Wird erstellt…' : 'Konto erstellen'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  bgWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bgImage: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.85,
    ...(Platform.OS === 'web'
      ? ({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any)
      : {}),
  },
  bgOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  inner: {
    padding: 28,
    zIndex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  title: {
    fontFamily: 'Josefin Sans',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  close: {
    position: 'absolute',
    right: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 20, color: 'rgba(255,255,255,0.7)' },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 24,
    textAlign: 'center',
  },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#fff',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
