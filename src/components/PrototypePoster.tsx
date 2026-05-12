import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Prototype,
  protoPositions,
  displayPrototypeName,
  getHeroImageSource,
  renderWeaponIcon,
  PrototypePositionField,
} from '../utils/prototypes';
import { useIsMobile } from '../hooks/useIsMobile';

interface PrototypePosterProps {
  prototype: Prototype;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function PrototypePoster({ prototype, isAdmin, onEdit, onDelete }: PrototypePosterProps) {
  const isMobile = useIsMobile();
  const codes = protoPositions(prototype);
  const descLines = (prototype.description || '').split('\n').map(l => l.trim()).filter(Boolean);
  const roleModels = (prototype.role_models || []).filter(Boolean);
  const requirements = (prototype.requirements || []).filter(Boolean);
  const heroSource = getHeroImageSource(prototype);
  const columnHeight = isMobile ? undefined : 580;
  const imgHeight = isMobile ? 340 : 510;
  const imgWidth = isMobile ? 360 : 640;
  // Feste Höhe: 7 Key Words × 2 Zeilen = (7 × (2×20 lineHeight + 12 marginBottom)) + Title 17 + Accent 25 + Padding 56 = 462 → 480 sicher
  // 3D-Lift: asymmetrische Borders (oben hell, unten dunkel) + starker Shadow + Web-Inset-Highlight — simuliert Licht von oben
  const flankCardStyle = {
    flex: 1,
    minWidth: 240,
    maxWidth: 560,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.28)',
    borderLeftColor: 'rgba(255,255,255,0.16)',
    borderRightColor: 'rgba(255,255,255,0.16)',
    borderBottomColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    padding: 28,
    alignSelf: 'flex-start' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 14,
    ...(Platform.OS === 'web' ? ({
      boxShadow: '0 24px 50px rgba(0,0,0,0.65), 0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.4)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    } as any) : {}),
    ...(isMobile ? {} : { height: 580 }),
  };
  // Weapons-Karte: gleicher Glass-Stil, aber ohne feste Höhe (content-fit, kompakt)
  const weaponsCardStyle = {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.28)',
    borderLeftColor: 'rgba(255,255,255,0.16)',
    borderRightColor: 'rgba(255,255,255,0.16)',
    borderBottomColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 14,
    ...(Platform.OS === 'web' ? ({
      boxShadow: '0 24px 50px rgba(0,0,0,0.65), 0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.4)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    } as any) : {}),
  };
  const renderChevronList = (items: string[]) => (
    items.length === 0 ? (
      <Text style={styles.posterText}>—</Text>
    ) : items.map((line, i) => {
      const clean = line.replace(/^[-•·▸]\s*/, '');
      return (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <Ionicons name="chevron-forward-outline" size={12} color="#22c55e" style={{ marginTop: 4 }} />
          <Text style={[styles.posterText, { flex: 1, lineHeight: 20 }]}>{clean}</Text>
        </View>
      );
    })
  );
  return (
    <View>
      {/* Admin-Leiste oben rechts */}
      {isAdmin && (onEdit || onDelete) && (
        <View style={{ position: 'absolute', top: 0, right: 0, flexDirection: 'row', gap: 8, zIndex: 10 }}>
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
          {onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.iconBtn}>
              <Ionicons name="create-outline" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Header */}
      <View style={{ alignItems: 'center', paddingHorizontal: 60, paddingTop: 8, paddingBottom: 28 }}>
        <Text style={{ fontFamily: 'Josefin Sans', fontSize: isMobile ? 26 : 32, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', color: '#fff', textAlign: 'center', lineHeight: isMobile ? 34 : 40 }}>
          {displayPrototypeName(prototype.name)}
        </Text>
        <View style={{ width: 80, height: 2, backgroundColor: '#22c55e', marginTop: 12 }} />
      </View>

      {/* Haupt-Reihe: (WEAPONS + POSITION) · HERO · KEY WORDS */}
      <View style={{ flexDirection: 'row', gap: 24, alignItems: isMobile ? 'center' : 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* Links: Spalte mit Position oben + WEAPONS darunter (Gesamt-Höhe = KW-Höhe 580) */}
        <View style={{ flex: 1, minWidth: 240, maxWidth: 560, gap: 24, ...(isMobile ? {} : { height: 580 }) }}>
          {/* Position-Karte — Title + Accent + Feld */}
          <View style={[weaponsCardStyle, { flex: 1 }]}>
            <Text style={styles.posterSectionLabel}>Position</Text>
            <View style={{ width: 24, height: 1, backgroundColor: '#22c55e', marginTop: 6, marginBottom: 18 }} />
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <PrototypePositionField
                codes={codes}
                maxWidth={isMobile ? 220 : 280}
                circleSize={isMobile ? 26 : 30}
              />
            </View>
          </View>
          {/* WEAPONS — kompakt, content-fit */}
          <View style={weaponsCardStyle}>
            <Text style={styles.posterSectionLabel}>Weapons</Text>
            <View style={{ width: 24, height: 1, backgroundColor: '#22c55e', marginTop: 6, marginBottom: 18 }} />
            <View>{renderChevronList(requirements)}</View>
            {requirements.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'space-around', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                {requirements.map((r, i) => (
                  <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                    {renderWeaponIcon(r, 30)}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Mitte: Hero-Bild oben + Role Models unten bündig (kleiner Spalt dazwischen) */}
        <View style={{ alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'space-between', ...(columnHeight ? { height: columnHeight } : {}) }}>
          {heroSource ? (
            <Image
              source={heroSource}
              style={{ width: imgWidth, maxWidth: '100%', height: imgHeight }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ width: imgWidth, maxWidth: '100%', height: imgHeight, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="people-outline" size={64} color="rgba(255,255,255,0.2)" />
            </View>
          )}
          {/* Role Models — bündig mit dem Ende der Karten (space-between sorgt für kleinen Spalt) */}
          {roleModels.length > 0 && (
            <View style={{ alignItems: 'center', marginTop: isMobile ? 20 : 0 }}>
              <Text style={styles.posterSectionLabel}>Role Models</Text>
              <View style={{ width: 24, height: 1, backgroundColor: '#22c55e', marginTop: 6, marginBottom: 14 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 }}>
                {roleModels.map((name, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {i > 0 && <Text style={{ color: 'rgba(255,255,255,0.25)', marginHorizontal: 12, fontSize: 14 }}>·</Text>}
                    <Text style={{ fontFamily: 'Josefin Sans', fontSize: 14, fontWeight: '400', letterSpacing: 3, color: '#fff', textTransform: 'uppercase' }}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Rechts: KEY WORDS-Karte */}
        <View style={flankCardStyle}>
          <Text style={styles.posterSectionLabel}>Key Words</Text>
          <View style={{ width: 24, height: 1, backgroundColor: '#22c55e', marginTop: 6, marginBottom: 18 }} />
          <View>{renderChevronList(descLines)}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  posterSectionLabel: { fontFamily: 'Josefin Sans', fontSize: 14, fontWeight: '400', letterSpacing: 4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  posterText: { fontSize: 14, fontWeight: '400', color: '#fff', letterSpacing: 0.3 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
});
