import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';

// Fallback falls Datenbank nicht erreichbar
const FALLBACK_CODE = 'KMH_Berater2026';

// Platform-spezifischer Alert
const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

export function LoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [advisorCode, setAdvisorCode] = useState('');
  const [validCode, setValidCode] = useState<string>(FALLBACK_CODE);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitationCode();
  }, []);

  const fetchInvitationCode = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'invitation_code')
        .single();
      
      if (data && data.value) {
        setValidCode(data.value);
      }
    } catch (e) {
      console.log('Could not fetch invitation code, using fallback');
    }
  };

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

  const handleAdvisorCode = () => {
    setCodeError(null);
    
    if (!advisorCode.trim()) {
      setCodeError('Bitte gib einen Einladungscode ein.');
      return;
    }
    
    if (advisorCode.trim() === validCode) {
      setShowAdvisorModal(false);
      setAdvisorCode('');
      setCodeError(null);
      showAlert(
        'Code bestätigt',
        'Du wirst jetzt zur Registrierung weitergeleitet. Nach der Registrierung erhältst du eine E-Mail zur Bestätigung deiner Adresse.',
        () => navigation.navigate('RegisterAdvisor')
      );
    } else {
      setCodeError('Der eingegebene Einladungscode ist ungültig.');
    }
  };

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

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={[styles.link, { color: colors.textMuted }]}>Noch kein Konto? Registrieren</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setShowAdvisorModal(true); setCodeError(null); setAdvisorCode(''); }} style={styles.advisorLink}>
          <Text style={[styles.advisorText, { color: colors.textMuted }]}>Als Berater registrieren</Text>
        </TouchableOpacity>
      </View>

      {/* Berater-Zugang Modal */}
      <Modal visible={showAdvisorModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAdvisorModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity style={[styles.modalClose, { backgroundColor: isDark ? colors.inputBackground : '#f1f5f9' }]} onPress={() => setShowAdvisorModal(false)}>
              <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Berater-Zugang</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Bitte Einladungscode eingeben</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, codeError && styles.modalInputError]}
              placeholder="Einladungscode" placeholderTextColor={colors.textMuted}
              value={advisorCode}
              onChangeText={(text) => { setAdvisorCode(text); setCodeError(null); }}
              autoCapitalize="none"
            />
            {codeError && (
              <Text style={styles.errorText}>{codeError}</Text>
            )}
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleAdvisorCode}>
              <Text style={[styles.modalButtonText, { color: colors.primaryText }]}>Weiter</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  advisorLink: { marginTop: 32 },
  advisorText: { color: '#666', textAlign: 'center', fontSize: 14 },
  
  // Modal Styles - zentriert und kompakt
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  modalContent: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 24,
    width: '90%',
    maxWidth: 340,
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 16, color: '#64748b' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  modalInput: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 16, 
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
    backgroundColor: '#000', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
  },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
