import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export function PlayerHomeScreen() {
  const { profile, signOut } = useAuth();
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.greeting, { color: colors.text }]}>Hallo, {profile?.first_name || 'Spieler'}!</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Willkommen bei KMH Sports</Text>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Dein Profil</Text>
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>Name: {profile?.first_name} {profile?.last_name}</Text>
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>E-Mail: {profile?.email}</Text>
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>Rolle: Spieler</Text>
        </View>

        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.primary }]} onPress={signOut}>
          <Text style={[styles.logoutText, { color: colors.primaryText }]}>Abmelden</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24 },
  greeting: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  cardText: { fontSize: 14, marginBottom: 4 },
  logoutButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 'auto' },
  logoutText: { fontSize: 16, fontWeight: '600' },
});
