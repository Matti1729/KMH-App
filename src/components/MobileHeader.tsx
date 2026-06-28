import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  backgroundImage?: ImageSourcePropType;
  backgroundImageOpacity?: number;
  onMenuPress: () => void;
  onProfilePress?: () => void;
  profileInitials?: string;
  children?: React.ReactNode;
  bottomRow?: React.ReactNode; // volle Breite, unter dem Trennstrich (z.B. Tabs) — gleicher Header-Hintergrund
}

export function MobileHeader({ title, subtitle, backgroundImage, backgroundImageOpacity = 0.45, onMenuPress, onProfilePress, profileInitials, children, bottomRow }: MobileHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      {backgroundImage ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={backgroundImage} style={[StyleSheet.absoluteFill, { opacity: backgroundImageOpacity }]} resizeMode="cover" />
        </View>
      ) : null}

      <View style={styles.topRow}>
        <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
          <Ionicons name="menu" size={14} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.divider} />

      {(children || onProfilePress) ? (
        <View style={styles.toolbar}>
          {children}
          {/* Spacer nur, wenn ein Profil-Button rechts steht — sonst füllt die Suchleiste (flex:1) die ganze Zeile. */}
          {onProfilePress ? (
            <>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.primary }]} onPress={onProfilePress}>
                <Text style={[styles.profileInitials, { color: colors.primaryText }]}>{profileInitials || '?'}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}

      {bottomRow ? <View>{bottomRow}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 44,
  },
  menuButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Josefin Sans',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  subtitle: {
    fontFamily: 'Josefin Sans',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  profileButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: 11,
    fontWeight: '600',
  },
});
