import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

const ADVISOR_CODE = 'KMH_Berater2026';

export function LoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [advisorCode, setAdvisorCode] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Fehler', 'Bitte alle Felder ausfüllen');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) Alert.alert('Fehler', error.message);
  };

  const handleAdvisorCode = () => {
    if (advisorCode === ADVISOR_CODE) {
      setShowAdvisorModal(false);
      setAdvisorCode('');
      navigation.navigate('RegisterAdvisor');
    } else {
      Alert.alert('Fehler', 'Ungültiger Code');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>KMH Sports</Text>
        <Text style={styles.subtitle}>Willkommen zurück</Text>

        <TextInput
          style={styles.input}
          placeholder="E-Mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Laden...' : 'Anmelden'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>Noch kein Konto? Registrieren</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowAdvisorModal(true)} style={styles.advisorLink}>
          <Text style={styles.advisorText}>Als Berater registrieren</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showAdvisorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Berater-Zugang</Text>
            <Text style={styles.modalSubtitle}>Bitte Einladungscode eingeben</Text>
            <TextInput
              style={styles.input}
              placeholder="Einladungscode"
              value={advisorCode}
              onChangeText={setAdvisorCode}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.button} onPress={handleAdvisorCode}>
              <Text style={styles.buttonText}>Weiter</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAdvisorModal(false)}>
              <Text style={styles.link}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  button: { backgroundColor: '#000', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#000', textAlign: 'center', marginTop: 8 },
  advisorLink: { marginTop: 32 },
  advisorText: { color: '#666', textAlign: 'center', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
});
