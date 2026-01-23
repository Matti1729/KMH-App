import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface MobileHeaderProps {
  title: string;
  onMenuPress: () => void;
  onProfilePress?: () => void;
  profileInitials?: string;
}

export function MobileHeader({ title, onMenuPress, onProfilePress, profileInitials }: MobileHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <TouchableOpacity style={[styles.menuButton, { backgroundColor: colors.surfaceSecondary }]} onPress={onMenuPress}>
        <Ionicons name="menu" size={24} color={colors.text} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

      <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.primary }]} onPress={onProfilePress}>
        <Text style={[styles.profileInitials, { color: colors.primaryText }]}>{profileInitials || '?'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
