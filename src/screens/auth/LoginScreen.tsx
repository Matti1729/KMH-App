import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';
import { useDialog } from '../../components/DialogProvider';

export function LoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const { alert: alertDialog } = useDialog();
  const showAlert = (title: string, message: string, onOk?: () => void) => {
    alertDialog({ title, message }).then(() => { if (onOk) onOk(); });
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [advisorCode, setAdvisorCode] = useState('');
  const [advisorCodeLoading, setAdvisorCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showPlayerCodeModal, setShowPlayerCodeModal] = useState(false);
  const [playerCode, setPlayerCode] = useState('');
  const [playerCodeError, setPlayerCodeError] = useState<string | null>(null);
  const [playerCodeLoading, setPlayerCodeLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Fehler', 'Bitte alle Felder ausfüllen');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) showAlert('Fehler', error.message);
  };

  const handleAdvisorCode = async () => {
    setCodeError(null);

    if (!advisorCode.trim()) {
      setCodeError('Bitte gib einen Einladungscode ein.');
      return;
    }

    setAdvisorCodeLoading(true);
    const { data, error } = await supabase.rpc('verify_advisor_invitation_code', { p_code: advisorCode.trim() });
    setAdvisorCodeLoading(false);

    if (error) {
      setCodeError('Code konnte nicht geprüft werden. Bitte versuche es später erneut.');
      return;
    }

    if (data === true) {
      setShowAdvisorModal(false);
      setAdvisorCode('');
      setCodeError(null);
      showAlert(
        'Code bestätigt',
        'Du wirst jetzt zur Registrierung weitergeleitet.',
        () => navigation.navigate('RegisterAdvisor')
      );
    } else {
      setCodeError('Der eingegebene Einladungscode ist ungültig.');
    }
  };

  const handlePlayerCode = async () => {
    setPlayerCodeError(null);

    if (!playerCode.trim()) {
      setPlayerCodeError('Bitte gib einen Einladungscode ein.');
      return;
    }

    setPlayerCodeLoading(true);

    try {
      const { data, error } = await supabase
        .rpc('verify_player_invitation_code', { p_code: playerCode.trim() });

      if (error || !data) {
        setPlayerCodeError('Ungültiger Code');
        setPlayerCodeLoading(false);
        return;
      }

      if (data.already_linked) {
        setPlayerCodeError('Code wurde bereits verwendet.');
        setPlayerCodeLoading(false);
        return;
      }

      setShowPlayerCodeModal(false);
      setPlayerCode('');
      setPlayerCodeError(null);
      setPlayerCodeLoading(false);
      showAlert(
        'Code bestätigt',
        `Willkommen ${data.first_name} ${data.last_name}! Du wirst jetzt zur Registrierung weitergeleitet.`,
        () => navigation.navigate('Register', { playerDetailsId: data.id, playerFirstName: data.first_name, playerLastName: data.last_name })
      );
    } catch (e) {
      setPlayerCodeError('Fehler bei der Code-Überprüfung. Bitte versuche es erneut.');
      setPlayerCodeLoading(false);
    }
  };

  // Einheitliches Code-Zugang-Modal (Design-System: Skyline-BG, Josefin-Titel,
  // plain ✕-Close, Pill-Input, grüner Footer-Button).
  const renderCodeModal = (opts: {
    visible: boolean;
    onClose: () => void;
    title: string;
    value: string;
    onChange: (text: string) => void;
    error: string | null;
    loading: boolean;
    onSubmit: () => void;
  }) => (
    <Modal visible={opts.visible} transparent animationType="fade" onRequestClose={opts.onClose}>
      <View style={styles.modalOverlay}>
        {/* Backdrop — schließt bei Klick daneben */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={opts.onClose} />
        <View style={styles.modalContent}>
          {/* Skyline-Hintergrund */}
          <View style={styles.modalBgWrap} pointerEvents="none">
            <Image
              source={require('../../../assets/scouting-header-bg.jpg')}
              style={styles.modalBgImage}
              resizeMode="cover"
            />
            <View style={styles.modalBgOverlay} />
          </View>

          <View style={styles.modalInner}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>{opts.title}</Text>
              <TouchableOpacity onPress={opts.onClose} style={styles.modalClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Bitte Einladungscode eingeben</Text>

            <TextInput
              style={[styles.modalInput, opts.error ? styles.modalInputError : null]}
              placeholder=""
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={opts.value}
              onChangeText={opts.onChange}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={opts.onSubmit}
            />

            {opts.error ? <Text style={styles.errorText}>{opts.error}</Text> : null}

            <TouchableOpacity
              style={[styles.modalButton, opts.loading && { opacity: 0.6 }]}
              onPress={opts.onSubmit}
              disabled={opts.loading}
            >
              <Text style={styles.modalButtonText}>{opts.loading ? 'Prüfen…' : 'Weiter'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Karl M. Herzog</Text>
        <Text style={[styles.titleSecond, { color: colors.text }]}>Sportmanagement</Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="E-Mail" placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="Passwort" placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleLogin} disabled={loading}>
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>{loading ? 'Laden...' : 'Anmelden'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setShowPlayerCodeModal(true); setPlayerCodeError(null); setPlayerCode(''); }} style={[styles.registerButton, { backgroundColor: '#16a34a' }]}>
          <Text style={styles.registerButtonText}>Als Spieler registrieren</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setShowAdvisorModal(true); setCodeError(null); setAdvisorCode(''); }} style={styles.advisorLink}>
          <Text style={[styles.advisorText, { color: colors.textMuted }]}>Als Berater registrieren</Text>
        </TouchableOpacity>
      </View>

      {/* Berater-Zugang Modal */}
      {renderCodeModal({
        visible: showAdvisorModal,
        onClose: () => setShowAdvisorModal(false),
        title: 'Berater-Zugang',
        value: advisorCode,
        onChange: (text) => { setAdvisorCode(text); setCodeError(null); },
        error: codeError,
        loading: advisorCodeLoading,
        onSubmit: handleAdvisorCode,
      })}

      {/* Spieler-Zugang Modal */}
      {renderCodeModal({
        visible: showPlayerCodeModal,
        onClose: () => setShowPlayerCodeModal(false),
        title: 'Spieler-Zugang',
        value: playerCode,
        onChange: (text) => { setPlayerCode(text); setPlayerCodeError(null); },
        error: playerCodeError,
        loading: playerCodeLoading,
        onSubmit: handlePlayerCode,
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 0 },
  titleSecond: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  button: { backgroundColor: '#000', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#000', textAlign: 'center', marginTop: 8 },
  registerButton: { padding: 14, borderRadius: 12, alignItems: 'center' as const, marginTop: 16 },
  registerButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' as const },
  advisorLink: { marginTop: 16 },
  advisorText: { color: '#666', textAlign: 'center' as const, fontSize: 14 },
  
  // Modal Styles — Design-System (Skyline-BG, dunkel, Josefin-Titel, Pill-Input)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  modalBgWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalBgImage: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.85,
    ...(Platform.OS === 'web'
      ? ({ objectFit: 'cover', objectPosition: 'center', backgroundSize: 'cover', backgroundPosition: 'center' } as any)
      : {}),
  },
  modalBgOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalInner: {
    padding: 24,
    zIndex: 1,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  modalTitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  modalClose: {
    position: 'absolute',
    right: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { fontSize: 20, color: 'rgba(255,255,255,0.7)' },
  modalSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    letterSpacing: 2,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalInputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  modalButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
