import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib';
const AuthContext = createContext<{ session: Session | null; ready: boolean }>({ session: null, ready: false });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, value) => { if (active) { setSession(value); setReady(true); } });
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } }).catch(() => { if (active) setReady(true); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ session, ready }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
