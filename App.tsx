import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideInRight } from 'react-native-reanimated';
// import each weight from its own path so only the 7 fonts in use are bundled
import { useFonts } from 'expo-font';
import { BricolageGrotesque_400Regular } from '@expo-google-fonts/bricolage-grotesque/400Regular';
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';

import { Backdrop } from './src/components/Backdrop';
import { TabBar } from './src/components/TabBar';
import { Footer, FooterToggle, FOOTER_H } from './src/components/Footer';
import { Landing } from './src/components/Landing';
import { HeroPanel } from './src/components/HeroPanel';
import { Toast } from './src/components/Toast';
import { HelpTour } from './src/components/HelpTour';
import { ThemeReveal } from './src/components/ThemeReveal';
import { ReminderWatcher } from './src/components/ReminderWatcher';
import { NoteEditorHost } from './src/components/NoteEditor';
import { TasksScreen } from './src/screens/TasksScreen';
import { CalcScreen } from './src/screens/CalcScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { useTheme } from './src/theme/useTheme';
import { useUI, selectLanding, type Tab } from './src/store/ui';
import { useTasks } from './src/store/tasks';
import { useNotes } from './src/store/notes';
import { useCalc } from './src/store/calc';
import { useDrafts } from './src/store/drafts';
import { syncAcrossTabs } from './src/store/persist';

SplashScreen.preventAutoHideAsync().catch(() => {});

const order: Tab[] = ['tasks', 'calc', 'notes'];
const stores = [useUI, useTasks, useNotes, useCalc, useDrafts];

function useHydrated() {
  const [ok, setOk] = useState(() => stores.every((s) => s.persist.hasHydrated()));
  useEffect(() => syncAcrossTabs(stores), []);
  useEffect(() => {
    if (ok) return;
    const check = () => stores.every((s) => s.persist.hasHydrated()) && setOk(true);
    const subs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => subs.forEach((u) => u());
  }, [ok]);
  return ok;
}

function Shell() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const tab = useUI((s) => s.tab);
  // slide direction follows tab order (derived during render from the previous tab)
  const [view, setView] = useState({ tab, dir: 1 });
  if (view.tab !== tab) setView({ tab, dir: order.indexOf(tab) >= order.indexOf(view.tab) ? 1 : -1 });
  const dir = view.dir;
  const landing = useUI(selectLanding);

  useEffect(() => {
    // on web, while the landing is up, keep index.html's pre-load hero gradient behind it (setBackgroundColorAsync
    // paints the page body on web, so it waits too); once the landing closes, the theme color replaces it
    const web = Platform.OS === 'web' && typeof document !== 'undefined';
    if (!(web && landing)) SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
    if (web) {
      if (!landing) document.body.style.background = c.bg;
      document.documentElement.style.colorScheme = c.mode;
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'theme-color'); document.head.appendChild(meta); }
      meta.setAttribute('content', c.bg);
    }
  }, [c, landing]);

  const Screen = tab === 'tasks' ? TasksScreen : tab === 'calc' ? CalcScreen : NotesScreen;
  const footerOpen = useUI((s) => s.footerOpen);
  const footerInset = Math.max(insets.bottom, 4);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={c.mode === 'dark' ? 'light' : 'dark'} />
      <Backdrop />
      <View style={[styles.column, { paddingTop: insets.top + 8 }]}>
        <Animated.View
          key={tab}
          entering={(dir > 0 ? SlideInRight : SlideInLeft).springify().damping(22).mass(0.7)}
          exiting={FadeOut.duration(120)}
          style={styles.screen}
        >
          <Screen />
        </Animated.View>
        <View style={styles.tabs}>
          <View style={{ flex: 1 }}><TabBar /></View>
          <FooterToggle />
        </View>
      </View>
      <Footer inset={footerInset} />
      <NoteEditorHost />
      <Toast bottom={60 + 18 + footerInset + (footerOpen ? FOOTER_H : 0) + 12} />
      {/* the color panel, opened from the toolbar's palette button (the landing brings its own) */}
      {landing ? null : (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <HeroPanel ink={c.ink} top={insets.top} launcher={false} />
        </View>
      )}
      {landing ? <Landing /> : null}
      <HelpTour />
      <ThemeReveal />
      <ReminderWatcher />
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, JetBrainsMono_400Regular, JetBrainsMono_600SemiBold,
  });
  const hydrated = useHydrated();
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
          <Shell />
        </Animated.View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  screen: { flex: 1, overflow: 'hidden', marginBottom: 10 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 18 },
});
