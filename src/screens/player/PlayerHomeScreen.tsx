import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

export function PlayerHomeScreen() {
  const { profile, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.greeting}>Hallo, {profile?.first_name || 'Spieler'}!</Text>
        <Text style={styles.subtitle}>Willkommen bei KMH Sports</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dein Profil</Text>
          <Text style={styles.cardText}>Name: {profile?.first_name} {profile?.last_name}</Text>
          <Text style={styles.cardText}>E-Mail: {profile?.email}</Text>
          <Text style={styles.cardText}>Rolle: Spieler</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, padding: 24 },
  greeting: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  cardText: { fontSize: 14, color: '#666', marginBottom: 4 },
  logoutButton: { backgroundColor: '#000', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 'auto' },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
