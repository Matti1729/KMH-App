import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

type UserRole = 'player' | 'advisor' | 'admin';

interface Profile {
  id: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_country_code: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName: string, lastName: string, role?: UserRole) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session Watchdog Intervall (3 Minuten)
const SESSION_CHECK_INTERVAL = 3 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  const fetchProfile = async (userId: string, userEmail: string | undefined) => {
    try {
      // Zuerst in advisors Tabelle schauen
      const { data: advisorData, error: advisorError } = await supabase
        .from('advisors')
        .select('id, first_name, last_name, role, phone, phone_country_code')
        .eq('id', userId)
        .single();

      if (advisorError && advisorError.code !== 'PGRST116') {
        console.warn('Advisor fetch error:', advisorError);
      }

      if (advisorData && (advisorData.role === 'advisor' || advisorData.role === 'admin' || advisorData.role === 'berater')) {
        const normalizedRole = advisorData.role === 'berater' ? 'advisor' : advisorData.role;
        setProfile({
          id: advisorData.id,
          first_name: advisorData.first_name,
          last_name: advisorData.last_name,
          role: normalizedRole as UserRole,
          email: userEmail || null,
          phone: advisorData.phone || null,
          phone_country_code: advisorData.phone_country_code || null
        });
        return;
      }

      // Sonst in profiles Tabelle schauen
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('Profile fetch error:', profileError);
      }

      if (profileData) {
        setProfile({
          ...profileData,
          phone: profileData.phone || null,
          phone_country_code: profileData.phone_country_code || null
        });
      } else {
        setProfile({
          id: userId,
          first_name: null,
          last_name: null,
          role: 'player',
          email: userEmail || null,
          phone: null,
          phone_country_code: null
        });
      }
    } catch (error) {
      console.warn('fetchProfile exception:', error);
      setProfile({
        id: userId,
        first_name: null,
        last_name: null,
        role: 'player',
        email: userEmail || null,
        phone: null,
        phone_country_code: null
      });
    }
  };

  // Session Watchdog - prüft periodisch die Session-Gesundheit
  // NIEMALS Auto-Logout - nur stille Recovery-Versuche
  const sessionWatchdog = async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('Session watchdog - getSession error (wird ignoriert):', error);
        // Fehler ignorieren - Session bleibt wie sie ist
        return;
      }

      if (!currentSession && session) {
        // Wir hatten eine Session, aber jetzt nicht mehr - versuche Recovery
        console.log('Session watchdog - Session verloren, versuche Refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) {
          // Refresh fehlgeschlagen - KEIN Logout, einfach weiter versuchen
          console.warn('Session watchdog - Refresh fehlgeschlagen (nächster Versuch in 3 Min):', refreshError);
          return;
        }

        if (refreshData.session) {
          console.log('Session watchdog - Session erfolgreich wiederhergestellt');
          setSession(refreshData.session);
          setUser(refreshData.session.user);
        }
      }
    } catch (e) {
      // Bei Exceptions: ignorieren und weiter versuchen
      console.warn('Session watchdog exception (wird ignoriert):', e);
    }
  };

  // Starte/Stoppe den Watchdog
  const startWatchdog = () => {
    if (watchdogRef.current) return; // Bereits gestartet
    watchdogRef.current = setInterval(sessionWatchdog, SESSION_CHECK_INTERVAL);
  };

  const stopWatchdog = () => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  };

  useEffect(() => {
    // Verhindere doppelte Initialisierung
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Initial Session laden
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Initial getSession error:', error);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email);
        }
      } catch (e) {
        console.warn('initSession exception:', e);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Auth State Changes listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event);

      // Bei TOKEN_REFRESHED nur Session aktualisieren, kein Profile-Fetch nötig
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        return;
      }

      // Bei SIGNED_OUT alles clearen
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchProfile(newSession.user.id, newSession.user.email);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    // Visibility Change Handler - nur bei Browser
    const handleVisibilityChange = async () => {
      if (typeof document === 'undefined') return;

      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh();
        startWatchdog();
        // Einmaliger Check bei Rückkehr
        await sessionWatchdog();
      } else {
        supabase.auth.stopAutoRefresh();
        stopWatchdog();
      }
    };

    // Event Listeners hinzufügen (nur im Browser)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      supabase.auth.startAutoRefresh();
      startWatchdog();
    }

    // Cleanup
    return () => {
      subscription.unsubscribe();
      stopWatchdog();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        supabase.auth.stopAutoRefresh();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, role: UserRole = 'player') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, role }
      }
    });

    if (error) return { error };

    if (role === 'advisor' && data.user) {
      const { error: advisorError } = await supabase
        .from('advisors')
        .insert({
          id: data.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
          role: 'advisor',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (advisorError) {
        console.log('Advisor insert error:', advisorError);
        return { error: advisorError };
      }

      setProfile({
        id: data.user.id,
        first_name: firstName,
        last_name: lastName,
        role: 'advisor',
        email: email,
        phone: null,
        phone_country_code: null
      });
    }

    return { error: null };
  };

  const signOut = async () => {
    stopWatchdog();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
