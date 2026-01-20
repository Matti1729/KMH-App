import React, { createContext, useContext, useEffect, useState } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Session-Recovery Funktion
  const recoverSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('getSession error:', error);
      }
      
      if (session) {
        setSession(session);
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email);
      } else {
        // Versuche Session zu refreshen
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('refreshSession error:', refreshError);
        }
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          await fetchProfile(data.session.user.id, data.session.user.email);
        }
      }
    } catch (e) {
      console.warn('recoverSession exception:', e);
    }
  };

  useEffect(() => {
    // Initial Session laden
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id, session.user.email);
      setLoading(false);
    });

    // Auth State Changes listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await fetchProfile(session.user.id, session.user.email);
      else setProfile(null);
      setLoading(false);
    });

    // === FIX: Session-Recovery bei Tab-Wechsel (Web) ===
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab wieder aktiv - Session wird geprüft...');
        supabase.auth.startAutoRefresh();
        await recoverSession();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    const handleFocus = async () => {
      console.log('Fenster hat Fokus - Session wird geprüft...');
      supabase.auth.startAutoRefresh();
      await recoverSession();
    };

    // Event Listeners hinzufügen (nur im Browser)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      
      // Auto-Refresh initial starten
      supabase.auth.startAutoRefresh();
    }

    // Cleanup
    return () => {
      subscription.unsubscribe();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
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
        email: email
      });
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
