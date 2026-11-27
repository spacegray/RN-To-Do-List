/*
 * Supabase client. The URL and publishable key are public by design (Row Level Security protects the data), so
 * they ship in the app; a secret or service-role key must never go here.
 * Until both env values are set, `supabase` is null and the app keeps working local-only.
 */
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, {
      auth: {
        storage: AsyncStorage, // localStorage on web
        autoRefreshToken: true,
        persistSession: true,
        // web reads the session from the URL after a Google/GitHub sign-in redirect; phones have no URL to read
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

export const isSupabaseConfigured = supabase !== null;

// phones: refresh the session only while the app is in the foreground
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
