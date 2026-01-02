import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '../config/supabase';
import { CommonActions } from '@react-navigation/native';

interface SidebarProps {
  navigation: any;
  activeScreen: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    role?: string;
  } | null;
}

export function Sidebar({ navigation, activeScreen, profile }: SidebarProps) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    );
  };

  const handleNavigation = (screen: string, id: string) => {
    if (activeScreen === id) return;
    
    if (id === 'dashboard') {
      // Go back to dashboard - use popToTop or goBack
      navigation.popToTop();
    } else {
      navigation.navigate(screen);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '⊞', screen: 'AdvisorDashboard' },
    { id: 'scouting', label: 'Scouting', icon: '🔍', screen: 'Scouting' },
    { id: 'players', label: 'KMH Spieler', icon: '👤', screen: 'PlayerOverview' },
    { id: 'termine', label: 'Termine', icon: '📅', screen: 'Calendar' },
    { id: 'team', label: 'Team & Partner', icon: '👥', screen: 'Team' },
  ];

  return (
    <View style={styles.sidebar}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>KMH</Text>
        </View>
        <Text style={styles.logoTitle}>Sports Agency</Text>
      </View>

      {/* Navigation */}
      <View style={styles.navContainer}>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.7}
            onPress={() => handleNavigation(item.screen, item.id)}
            style={[
              styles.navItem,
              activeScreen === item.id && styles.navItemActive,
            ]}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={[
              styles.navLabel,
              activeScreen === item.id && styles.navLabelActive
            ]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Admin - only if admin */}
      {profile?.role === 'admin' && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('AdminPanel')}
          style={[
            styles.navItem,
            activeScreen === 'admin' && styles.navItemActive,
          ]}
        >
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={[
            styles.navLabel,
            activeScreen === 'admin' && styles.navLabelActive
          ]}>Administration</Text>
        </TouchableOpacity>
      )}

      {/* Logout */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleLogout}
        style={styles.logoutButton}
      >
        <Text style={styles.logoutIcon}>↪</Text>
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  logoBox: {
    width: 40,
    height: 40,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  logoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  navContainer: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: '#f5f5f5',
  },
  navIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  navLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
    color: '#999',
  },
  logoutText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
});
