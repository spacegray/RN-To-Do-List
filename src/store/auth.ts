import { Platform } from 'react-native';
import { create } from 'zustand';
import type { AuthError, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { authErrorText } from '../lib/authText';
import type { Database } from '../lib/database.types';

/*
 * Sign-in state. Supabase keeps the session itself (in AsyncStorage / localStorage); this store mirrors it for the
 * UI and loads the user's profile. When Supabase isn't configured, everything stays signed out and the account
 * button doesn't appear.
 */

type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'display_name' | 'avatar_url' | 'role'>;
export type AuthSheet = 'closed' | 'signin' | 'code' | 'account';

type AuthState = {
  /** true once the saved session has been read, so the toolbar doesn't flash "signed out" on load */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  sheet: AuthSheet;
  /** the address the code was sent to */
  email: string;
  /** when the last email was sent, for the resend countdown */
  sentAt: number | null;
  busy: boolean;
  error: string;
  openAccount: () => void;
  closeSheet: () => void;
  backToEmail: () => void;
  sendCode: (email: string) => Promise<boolean>;
  verifyCode: (code: string) => Promise<boolean>;
  rename: (name: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const fail = (error: AuthError | { message?: string } | null) => ({ busy: false, error: authErrorText(error as AuthError) });

export const useAuth = create<AuthState>()((set, get) => ({
  ready: !supabase,
  session: null,
  profile: null,
  sheet: 'closed',
  email: '',
  sentAt: null,
  busy: false,
  error: '',

  openAccount: () => set({ sheet: get().session ? 'account' : get().sentAt && get().email ? 'code' : 'signin', error: '' }),
  closeSheet: () => set({ sheet: 'closed', error: '' }),
  backToEmail: () => set({ sheet: 'signin', error: '', sentAt: null }),

  sendCode: async (email) => {
    if (!supabase) return false;
    set({ busy: true, error: '' });
    const redirect = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: redirect },
    });
    if (error) { set(fail(error)); return false; }
    set({ busy: false, email: email.trim(), sentAt: Date.now(), sheet: 'code' });
    return true;
  },

  verifyCode: async (code) => {
    if (!supabase) return false;
    set({ busy: true, error: '' });
    const { error } = await supabase.auth.verifyOtp({ email: get().email, token: code, type: 'email' });
    if (error) { set(fail(error)); return false; }
    set({ busy: false, sheet: 'account', sentAt: null });
    return true;
  },

  rename: async (name) => {
    const id = get().session?.user.id;
    if (!supabase || !id) return false;
    const display_name = name.trim().slice(0, 80) || null;
    const { error } = await supabase.from('profiles').update({ display_name }).eq('id', id);
    if (error) { set({ error: "Couldn't save your name. Try again." }); return false; }
    set((s) => ({ profile: s.profile ? { ...s.profile, display_name } : s.profile, error: '' }));
    return true;
  },

  signOut: async () => {
    if (!supabase) return;
    set({ busy: true });
    // 'local' signs out this device only; a dead connection shouldn't trap anyone signed in
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    set({ busy: false, session: null, profile: null, sheet: 'closed', sentAt: null, email: '' });
  },
}));

async function loadProfile(userId: string) {
  if (!supabase) return;
  const { data } = await supabase.from('profiles').select('id, display_name, avatar_url, role').eq('id', userId).maybeSingle();
  if (useAuth.getState().session?.user.id === userId) useAuth.setState({ profile: data ?? null });
}

// follow Supabase's session: restored on load, signed in by link or code, refreshed, or signed out
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    const prev = useAuth.getState().session;
    useAuth.setState({ session, ready: true });
    if (!session) { useAuth.setState({ profile: null }); return; }
    if (prev?.user.id !== session.user.id || event === 'USER_UPDATED') {
      // outside the callback: Supabase warns against awaiting its own calls inside it
      setTimeout(() => { void loadProfile(session.user.id); }, 0);
    }
    if (event === 'SIGNED_IN' && !prev) {
      useAuth.setState({ sentAt: null, email: '', error: '' });
      if (useAuth.getState().sheet === 'code') useAuth.setState({ sheet: 'account' });
    }
  });
}
