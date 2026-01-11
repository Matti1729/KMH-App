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
    // Zuerst in advisors Tabelle schauen
    const { data: advisorData } = await supabase
      .from('advisors')
      .select('id, first_name, last_name, role')
      .eq('id', userId)
      .single();
    
    if (advisorData && (advisorData.role === 'advisor' || advisorData.role === 'admin' || advisorData.role === 'berater')) {
      // Berater gefunden - role normalisieren
      const normalizedRole = advisorData.role === 'berater' ? 'advisor' : advisorData.role;
      setProfile({
        id: advisorData.id,
        first_name: advisorData.first_name,
        last_name: advisorData.last_name,
        role: normalizedRole as UserRole,
        email: userEmail || null
      });
      return;
    }

    // Sonst in profiles Tabelle schauen (für Spieler)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileData) {
      setProfile(profileData);
    } else {
      // Kein Profil gefunden - Standard: Spieler
      setProfile({
        id: userId,
        first_name: null,
        last_name: null,
        role: 'player',
        email: userEmail || null
      });
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id, session.user.email);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await fetchProfile(session.user.id, session.user.email);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, role: UserRole = 'player') => {
    // 1. Supabase Auth User erstellen
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, role }
      }
    });

    if (error) return { error };

    // 2. Wenn Berater, direkt in advisors Tabelle eintragen
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

      // 3. WICHTIG: Profil sofort setzen, nicht auf onAuthStateChange warten
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
