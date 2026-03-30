import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';

export function RegisterScreen({ navigation, route }: any) {
  const { signUp } = useAuth();
  const { colors, isDark } = useTheme();
  const playerDetailsId = route?.params?.playerDetailsId;
  const playerName = route?.params?.playerName || '';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert('Fehler', 'Bitte alle Felder ausfüllen');
      return;
    }
    setLoading(true);
    const { data: signUpData, error } = await signUp(email, password, firstName, lastName, 'player');
    if (error) {
      setLoading(false);
      Alert.alert('Fehler', error.message);
      return;
    }

    // Link player_details to the new user
    if (playerDetailsId && signUpData?.user?.id) {
      const userId = signUpData.user.id;

      await supabase
        .from('player_details')
        .update({ linked_user_id: userId })
        .eq('id', playerDetailsId);

      await supabase
        .from('profiles')
        .update({ player_details_id: playerDetailsId })
        .eq('id', userId);
    }

    setLoading(false);
    Alert.alert('Erfolg', 'Bitte bestätige deine E-Mail', [
      { text: 'OK', onPress: () => navigation.navigate('Login') }
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.back, { color: colors.textMuted }]}>← Zurück</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>Registrieren</Text>

        {playerName ? (
          <Text style={[styles.playerName, { color: colors.textSecondary }]}>
            Spielerprofil: {playerName}
          </Text>
        ) : null}

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="Vorname" placeholderTextColor={colors.textSecondary}
          value={firstName}
          onChangeText={setFirstName}
        />

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="Nachname" placeholderTextColor={colors.textSecondary}
          value={lastName}
          onChangeText={setLastName}
        />

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="E-Mail" placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="Passwort" placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleRegister} disabled={loading}>
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>{loading ? 'Laden...' : 'Konto erstellen'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 24, maxWidth: 400, width: '100%', alignSelf: 'center' },
  back: { fontSize: 16, color: '#666', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  playerName: { fontSize: 15, marginBottom: 20, textAlign: 'center' as const, fontWeight: '500' as const },
  button: { backgroundColor: '#000', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
