import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(title + '\n\n' + message);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

export function RegisterAdvisorScreen({ navigation }: any) {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      showAlert('Fehler', 'Bitte alle Felder ausfüllen');
      return;
    }
    
    if (password.length < 6) {
      showAlert('Fehler', 'Das Passwort muss mindestens 6 Zeichen haben');
      return;
    }
    
    if (password !== confirmPassword) {
      showAlert('Fehler', 'Die Passwörter stimmen nicht überein');
      return;
    }
    
    setLoading(true);
    const { error } = await signUp(email, password, firstName, lastName, 'advisor');
    setLoading(false);
    
    if (error) {
      showAlert('Fehler', error.message);
    } else {
      showAlert(
        'Registrierung erfolgreich!', 
        'Dein Konto wurde erstellt. Du kannst dich jetzt anmelden.',
        () => navigation.navigate('Login')
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Zurück</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Berater-Registrierung</Text>
        <Text style={styles.subtitle}>Erstellen Sie Ihr Berater-Konto</Text>

        <TextInput
          style={styles.input}
          placeholder="Vorname" placeholderTextColor="#999"
          value={firstName}
          onChangeText={setFirstName}
        />

        <TextInput
          style={styles.input}
          placeholder="Nachname" placeholderTextColor="#999"
          value={lastName}
          onChangeText={setLastName}
        />

        <TextInput
          style={styles.input}
          placeholder="E-Mail" placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Passwort (min. 6 Zeichen)" placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity 
            style={styles.showButton} 
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.showButtonText}>
              {showPassword ? 'Verbergen' : 'Anzeigen'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Passwort wiederholen" placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Laden...' : 'Konto erstellen'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 24, maxWidth: 400, width: '100%', alignSelf: 'center' },
  back: { fontSize: 16, color: '#666', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 16, 
    marginBottom: 16 
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  showButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  showButtonText: {
    color: '#666',
    fontSize: 14,
  },
  button: { 
    backgroundColor: '#000', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 8 
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
