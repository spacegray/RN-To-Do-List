import { useColorScheme } from 'react-native';
import { useUI } from '../store/ui';
import { dark, light, type ThemeColors } from './tokens';

/** Resolves the saved preference ("system", "light" or "dark") to a palette. */
export function useTheme(): ThemeColors {
  const pref = useUI((s) => s.theme);
  const system = useColorScheme();
  const mode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return mode === 'dark' ? dark : light;
}
