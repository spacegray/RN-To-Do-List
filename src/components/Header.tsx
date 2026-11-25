import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View, type HostInstance } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { Bouncy } from './Bouncy';
import { useTheme } from '../theme/useTheme';
import { font, minTap, motion, stroke, type } from '../theme/tokens';
import { useUI } from '../store/ui';
import { useReveal } from './ThemeReveal';
import { useTourTarget } from './tour';

/** Sun and moon drawn with plain views so the icon can morph between them. */
function SunMoon({ dark }: { dark: boolean }) {
  const c = useTheme();
  const p = useSharedValue(dark ? 1 : 0);
  useEffect(() => { p.value = withSpring(dark ? 1 : 0, motion.spring); }, [dark, p]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 180}deg` }] }));
  const rays = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ scale: 1 - 0.5 * p.value }] }));
  const bite = useAnimatedStyle(() => ({ transform: [{ translateX: 10 - 5 * p.value }, { translateY: -10 + 5 * p.value }] }));
  return (
    <Animated.View style={[styles.icon, spin]}>
      <Animated.View style={[StyleSheet.absoluteFill, rays]}>
        {Array.from({ length: 8 }, (_, i) => (
          <View key={i} style={[styles.ray, { backgroundColor: c.ink, transform: [{ rotate: `${i * 45}deg` }, { translateY: -9 }] }]} />
        ))}
      </Animated.View>
      <View style={[styles.core, { backgroundColor: c.ink }]}>
        <Animated.View style={[styles.bite, { backgroundColor: c.card }, bite]} />
      </View>
    </Animated.View>
  );
}

export function IconButton({ label, onPress, children, refCb }: { label: string; onPress: () => void; children: ReactNode; refCb?: (n: HostInstance | null) => void }) {
  const c = useTheme();
  return (
    <Bouncy
      ref={refCb}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={[styles.btn, { borderColor: c.edge, backgroundColor: c.card }]}
    >
      {children}
    </Bouncy>
  );
}

export function Header({ label, title, accent }: { label: string; title?: string; accent?: string }) {
  const c = useTheme();
  const openTour = useUI((s) => s.openTour);
  const startReveal = useReveal((s) => s.start);
  const setTheme = useUI((s) => s.setTheme);
  const reduce = useReducedMotion();
  const toggleRef = useRef<HostInstance | null>(null);
  const themeTarget = useTourTarget('theme');
  const isDark = c.mode === 'dark';

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    if (reduce || !toggleRef.current) return setTheme(next);
    toggleRef.current.measureInWindow((x, y, w, h) => startReveal({ x: x + w / 2, y: y + h / 2 }, next));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[type.label, { color: c.muted }]} accessibilityRole="text">{label}</Text>
        <View style={styles.icons}>
          <IconButton label="How this works" onPress={openTour}>
            <Text style={[styles.q, { color: c.ink }]}>?</Text>
          </IconButton>
          <IconButton
            label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={toggle}
            refCb={(n) => { toggleRef.current = n; themeTarget(n); }}
          >
            <SunMoon dark={isDark} />
          </IconButton>
        </View>
      </View>
      {title ? (
        <Text style={[type.hero, { color: c.ink, marginTop: 14 }]} accessibilityRole="header">
          {title}
          {accent ? <Text style={{ color: c.violet }}>{'\n'}{accent}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icons: { flexDirection: 'row', gap: 8 },
  btn: { width: minTap, height: minTap, borderRadius: minTap / 2, borderWidth: stroke, alignItems: 'center', justifyContent: 'center' },
  q: { fontFamily: font.black, fontSize: 19, lineHeight: 22 },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', left: 11, top: 10, width: 2, height: 4, borderRadius: 1 },
  core: { width: 13, height: 13, borderRadius: 7, overflow: 'hidden' },
  bite: { position: 'absolute', width: 13, height: 13, borderRadius: 7 },
});
