import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';

export function AdvisorHomeScreen() {
  const { profile, signOut } = useAuth();
  const [playerCount, setPlayerCount] = useState(0);
  const [scoutingCount, setScoutingCount] = useState(0);

  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    const { count: players } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'player');
    setPlayerCount(players || 0);
  };

  const openTransfermarkt = () => {
    Linking.openURL('https://www.transfermarkt.de/karl-m-herzog-sportmanagement/beraterfirma/berater/76');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hallo, {profile?.first_name || 'Berater'}!</Text>
            <Text style={styles.subtitle}>Berater-Dashboard</Text>
          </View>
          <TouchableOpacity onPress={openTransfermarkt} style={styles.tmButton}>
            <Text style={styles.tmText}>TM</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>KMH - Spieler - Übersicht</Text>
          <Text style={styles.cardText}>Hier siehst du alle unsere Spieler</Text>
          <Text style={styles.countText}>{playerCount} Spieler registriert</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>Scouting</Text>
          <Text style={styles.cardText}>Unsere Scouting-Liste</Text>
          <Text style={styles.countText}>{scoutingCount} Spieler im Scouting</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>Das sind Wir</Text>
          <Text style={styles.cardText}>Unser Team</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  content: { 
    flex: 1, 
    padding: 24,
    alignItems: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 24,
  },
  greeting: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 4 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666',
  },
  tmButton: {
    backgroundColor: '#00a1e4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12,
    width: 280,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 6,
  },
  cardText: { 
    fontSize: 13, 
    color: '#666', 
    marginBottom: 8,
  },
  countText: { 
    fontSize: 13, 
    color: '#999',
  },
  logoutButton: { 
    backgroundColor: '#000', 
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12, 
    marginTop: 16,
    width: 280,
    alignItems: 'center',
  },
  logoutText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
});
