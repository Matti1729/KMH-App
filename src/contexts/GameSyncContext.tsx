// Globaler Sync-State — bleibt erhalten beim Screen-Wechsel.
// Der Sync läuft im Hintergrund weiter, der User kann zurück zum Spieltage-Screen
// und sieht den Progress da wo er aufgehört hat.

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { syncAllPlayerGames, SyncResult } from '../services/fussballDeApi';

interface SyncProgress {
  current: number;
  total: number;
  playerName: string;
}

interface GameSyncContextType {
  syncing: boolean;
  progress: SyncProgress | null;
  result: SyncResult | null;
  startSync: (playerIds?: string[]) => Promise<void>;
  clearResult: () => void;
}

const GameSyncContext = createContext<GameSyncContextType | undefined>(undefined);

export function GameSyncProvider({ children }: { children: React.ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const inflightRef = useRef(false);

  const startSync = useCallback(async (playerIds?: string[]) => {
    if (inflightRef.current) {
      console.log('[GameSync] sync already running, skip');
      return;
    }
    inflightRef.current = true;
    setSyncing(true);
    setResult(null);
    setProgress({ current: 0, total: 0, playerName: '' });

    try {
      const r = await syncAllPlayerGames(
        supabase,
        (current, total, playerName) => setProgress({ current, total, playerName }),
        playerIds,
      );
      setResult(r);
    } catch (e) {
      console.error('[GameSync] error', e);
      setResult({ success: false, added: 0, updated: 0, changed: 0, cancelled: 0, deleted: 0, errors: [String(e)] });
    } finally {
      setSyncing(false);
      setProgress(null);
      inflightRef.current = false;
    }
  }, []);

  const clearResult = useCallback(() => setResult(null), []);

  return (
    <GameSyncContext.Provider value={{ syncing, progress, result, startSync, clearResult }}>
      {children}
    </GameSyncContext.Provider>
  );
}

export function useGameSync() {
  const ctx = useContext(GameSyncContext);
  if (!ctx) throw new Error('useGameSync must be used within GameSyncProvider');
  return ctx;
}
