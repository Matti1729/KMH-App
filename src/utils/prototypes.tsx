import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';

// ============================================================================
// Interface + Konstanten
// ============================================================================

export const POSITION_SHORTS = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'];
export const POSITION_MAP: Record<string, string> = {
  'TW': 'Torwart', 'IV': 'Innenverteidiger', 'LV': 'Linker Verteidiger',
  'RV': 'Rechter Verteidiger', 'DM': 'Defensives Mittelfeld', 'ZM': 'Zentrales Mittelfeld',
  'OM': 'Offensives Mittelfeld', 'LA': 'Linke Außenbahn', 'RA': 'Rechte Außenbahn', 'ST': 'Stürmer',
};

export const ATTRIBUTE_KEYS = ['tempo', 'technik', 'koerper', 'kopfball', 'schuss'] as const;
export const ATTRIBUTE_LABELS: Record<string, string> = {
  tempo: 'Tempo', technik: 'Technik', koerper: 'Körper', kopfball: 'Kopfball', schuss: 'Schuss',
};

export interface Prototype {
  id: string;
  name: string;
  position_code: string;
  position_codes: string[];
  description: string;
  requirements: string[];
  attributes: Record<string, number>;
  image_path: string | null;
  role_models: string[];
  role_model_images: string[];
  created_at?: string;
}

export function protoPositions(p: Prototype): string[] {
  if (Array.isArray(p.position_codes) && p.position_codes.length > 0) return p.position_codes;
  return p.position_code ? [p.position_code] : [];
}

export function positionLabel(codes: string[]): string {
  if (codes.length === 0) return '-';
  return codes.map(c => `${c}`).join(' / ');
}

export const POSITION_UMBRELLA: Record<string, string> = {
  'LV+RV': 'Außenverteidiger',
  'RV+LV': 'Außenverteidiger',
  'LA+RA': 'Außenbahnspieler',
  'RA+LA': 'Außenbahnspieler',
};

export function positionFullLabel(codes: string[]): string {
  if (codes.length === 0) return '-';
  if (codes.length === 1) return codes[0];
  return codes.join(' / ');
}

// ============================================================================
// Display-Name: ersetzt ausgeschriebene Positions-Namen durch Kürzel
// ============================================================================

export const NAME_POSITION_SHORT: Record<string, string> = {
  'Innenverteidiger': 'IV',
  'Außenverteidiger': 'LV/RV',
  'Außenbahn': 'LA/RA',
  'Offensives Mittelfeld': 'OM',
  'Stürmer': 'ST',
};

export function displayPrototypeName(name: string): string {
  for (const long of Object.keys(NAME_POSITION_SHORT)) {
    if (name.startsWith(long + ' ')) return NAME_POSITION_SHORT[long] + name.substring(long.length);
  }
  return name;
}

// ============================================================================
// Weapons-Icon-Renderer — Outline-Stil, monochrom off-white
// ============================================================================

export function renderWeaponIcon(requirement: string, size: number) {
  const color = 'rgba(255,255,255,0.9)';
  const lower = requirement.toLowerCase();
  if (lower.includes('intelligen') || lower.includes('spielverst') || lower.includes('bewusst')) {
    return <MaterialCommunityIcons name="head-cog-outline" size={size} color={color} />;
  }
  if (lower.includes('strateg')) {
    return <Ionicons name="compass-outline" size={size} color={color} />;
  }
  if (lower.includes('kreativ')) {
    return <Ionicons name="color-palette-outline" size={size} color={color} />;
  }
  if (lower.includes('technisch') || lower.includes('technik')) {
    return <Ionicons name="football-outline" size={size} color={color} />;
  }
  if (lower.includes('keine fehler') || lower.includes('fehler')) {
    return <Ionicons name="checkmark-done-outline" size={size} color={color} />;
  }
  if (lower.includes('athletik') || lower.includes('tempo') || lower.includes('sprint')) {
    return <Ionicons name="speedometer-outline" size={size} color={color} />;
  }
  if (lower.includes('1v1') || lower.includes('torgefahr') || lower.includes('torgefähr')) {
    return <Ionicons name="locate-outline" size={size} color={color} />;
  }
  if (lower.includes('flank')) {
    return <Ionicons name="return-up-forward-outline" size={size} color={color} />;
  }
  if (lower.includes('wand') || lower.includes('klatsch')) {
    return <Ionicons name="return-down-back-outline" size={size} color={color} />;
  }
  if (lower.includes('spielauf') || lower.includes('pass')) {
    return <Ionicons name="git-branch-outline" size={size} color={color} />;
  }
  if (lower.includes('defens') || lower.includes('verteid')) {
    return <Ionicons name="shield-outline" size={size} color={color} />;
  }
  if (lower.includes('kopf')) {
    return <Ionicons name="person-outline" size={size} color={color} />;
  }
  if (lower.includes('kraft') || lower.includes('körper') || lower.includes('physisch')) {
    return <Ionicons name="barbell-outline" size={size} color={color} />;
  }
  return <Ionicons name="sparkles-outline" size={size} color={color} />;
}

// ============================================================================
// Storage & Hero-Image-Map
// ============================================================================

export const PROTOTYPE_BUCKET = 'player-prototypes';

export function getPrototypeImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(PROTOTYPE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

// Lokale Hero-Bilder (kombinierte Role-Model-Poster) — per Prototyp-Name zugeordnet
const DM_SPIELMACHER_HERO = require('../../assets/prototypes/dm-spielmacher.png');
const IV_SPIELSTARKER_ATHLET_HERO = require('../../assets/prototypes/iv-spielstarker-athlet.png');
const AV_MODERNER_FLUEGEL_HERO = require('../../assets/prototypes/av-moderner-fluegel.png');
const DMZM_B2B_HERO = require('../../assets/prototypes/dmzm-b2b.png');
const OM_KREATIVSPIELER_HERO = require('../../assets/prototypes/om-kreativspieler.png');
const AB_DRIBBLER_HERO = require('../../assets/prototypes/ab-dribbler.png');
const ST_MITSPIELENDE_SPITZE_HERO = require('../../assets/prototypes/st-mitspielende-spitze.png');

export const HERO_IMAGE_MAP: Record<string, any> = {
  'DM – Spielmacher': DM_SPIELMACHER_HERO,
  'Innenverteidiger – Spielstarker Athlet': IV_SPIELSTARKER_ATHLET_HERO,
  'Außenverteidiger – Moderner Flügel': AV_MODERNER_FLUEGEL_HERO,
  'DM/ZM – B2B & Verbindungsspieler': DMZM_B2B_HERO,
  'Offensives Mittelfeld – Kreativspieler': OM_KREATIVSPIELER_HERO,
  'Außenbahn – Dribbler': AB_DRIBBLER_HERO,
  'Stürmer – Mitspielende Spitze': ST_MITSPIELENDE_SPITZE_HERO,
};

export function getHeroImageSource(prototype: Prototype): any | null {
  const local = HERO_IMAGE_MAP[prototype.name];
  if (local) return local;
  const url = getPrototypeImageUrl(prototype.image_path);
  return url ? { uri: url } : null;
}

// ============================================================================
// Spielfeld-Komponente mit Heatmap-Glow + 3D-Perspektive
// ============================================================================

// Landscape-Layout: Angriff rechts, Verteidigung links (TV-Broadcast-Perspektive)
export const POSITION_COORDS_PROTO = {
  TW: { left: '8%',  top: '50%' },
  IV: { left: '25%', top: '50%' },
  LV: { left: '25%', top: '18%' },
  RV: { left: '25%', top: '82%' },
  DM: { left: '41%', top: '50%' },
  ZM: { left: '54%', top: '50%' },
  OM: { left: '67%', top: '50%' },
  LA: { left: '67%', top: '18%' },
  RA: { left: '67%', top: '82%' },
  ST: { left: '82%', top: '50%' },
} as const;

export const ALL_POSITIONS_PROTO = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'];

export function PrototypePositionField({ codes, maxWidth = 160, circleSize = 24 }: { codes: string[]; maxWidth?: number; circleSize?: number }) {
  const half = circleSize / 2;
  const fontSize = Math.max(8, Math.round(circleSize * 0.34));
  const activeSet = new Set(codes);
  const outerSize = Math.round(circleSize * 2.4);
  const middleSize = Math.round(circleSize * 1.55);
  const innerSize = circleSize;
  const inactiveSize = Math.max(14, Math.round(circleSize * 0.72));
  return (
    <View style={{ width: '100%', alignSelf: 'center', maxWidth }}>
      <View style={{ width: '100%', aspectRatio: 3 / 2, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', position: 'relative', overflow: 'visible' }}>
        {/* Mittellinie vertikal */}
        <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        {/* Mittelkreis */}
        <View style={{ position: 'absolute', left: '50%', top: '50%', width: 50, height: 50, marginLeft: -25, marginTop: -25, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
        {/* Strafraum links + rechts */}
        <View style={{ position: 'absolute', top: '15%', height: '70%', width: '16%', left: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderLeftWidth: 0 }} />
        <View style={{ position: 'absolute', top: '15%', height: '70%', width: '16%', right: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRightWidth: 0 }} />
        {/* 5-Meter-Raum links + rechts */}
        <View style={{ position: 'absolute', top: '30%', height: '40%', width: '6%', left: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderLeftWidth: 0 }} />
        <View style={{ position: 'absolute', top: '30%', height: '40%', width: '6%', right: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRightWidth: 0 }} />
        {/* Inaktive Positionen zuerst (werden vom Glow überlagert) */}
        {ALL_POSITIONS_PROTO.filter(pos => !activeSet.has(pos)).map(pos => {
          const coords = POSITION_COORDS_PROTO[pos as keyof typeof POSITION_COORDS_PROTO];
          const inactiveHalf = inactiveSize / 2;
          return (
            <View
              key={pos}
              pointerEvents="none"
              style={{ position: 'absolute', left: coords.left, top: coords.top, transform: [{ translateX: -inactiveHalf }, { translateY: -inactiveHalf }], width: inactiveSize, height: inactiveSize, borderRadius: inactiveHalf, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <Text style={{ fontSize: Math.max(7, Math.round(inactiveSize * 0.36)), fontWeight: '600', color: 'rgba(255,255,255,0.28)' }}>{pos}</Text>
            </View>
          );
        })}
        {/* Aktive Positionen mit Heatmap-Glow */}
        {ALL_POSITIONS_PROTO.filter(pos => activeSet.has(pos)).map(pos => {
          const coords = POSITION_COORDS_PROTO[pos as keyof typeof POSITION_COORDS_PROTO];
          const outerHalf = outerSize / 2;
          const middleHalf = middleSize / 2;
          const webGlow = Platform.OS === 'web'
            ? ({ boxShadow: `0 0 ${Math.round(circleSize * 0.9)}px rgba(34,197,94,0.55), 0 0 ${Math.round(circleSize * 1.8)}px rgba(34,197,94,0.35)` } as any)
            : {};
          return (
            <View
              key={pos}
              pointerEvents="none"
              style={{ position: 'absolute', left: coords.left, top: coords.top, transform: [{ translateX: -outerHalf }, { translateY: -outerHalf }], width: outerSize, height: outerSize, borderRadius: outerHalf, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34,197,94,0.10)' }}
            >
              <View style={{ width: middleSize, height: middleSize, borderRadius: middleHalf, backgroundColor: 'rgba(34,197,94,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                <View style={[{ width: innerSize, height: innerSize, borderRadius: half, backgroundColor: 'rgba(34,197,94,0.9)', alignItems: 'center', justifyContent: 'center' }, webGlow]}>
                  <Text style={{ fontSize, fontWeight: '700', color: '#fff' }}>{pos}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
