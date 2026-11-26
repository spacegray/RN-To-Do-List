import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { Bouncy } from './Bouncy';
import { useTheme } from '../theme/useTheme';
import { font, motion, radius, stroke } from '../theme/tokens';
import { useUI, selectLanding, type Tab } from '../store/ui';
import { useTourTarget } from './tour';

const tabs: { key: Tab; label: string }[] = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'calc', label: 'Calc' },
  { key: 'notes', label: 'Notes' },
];

const PAD = 4;
// long ease-out: the bar glides open and settles without a bounce
const intro = { duration: 1400, easing: Easing.bezier(0.16, 1, 0.3, 1) };

/**
 * Pill tab bar; the dark indicator slides between tabs on a spring.
 * On load it starts as one pill holding the current tab, then widens from the centre while the
 * other tabs slide out to their places (`open` goes 0 → 1). Reduced motion skips straight to 1.
 */
export function TabBar() {
  const c = useTheme();
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const landing = useUI(selectLanding);
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const open = useSharedValue(0);
  const index = tabs.findIndex((t) => t.key === tab);
  const seg = (w - 2 * stroke - 2 * PAD) / tabs.length;

  useEffect(() => { if (w) x.value = withSpring(index * seg, motion.spring); }, [index, seg, w, x]);
  // waits for the landing view to clear, so the glide is seen
  useEffect(() => { if (w && !landing) open.value = withDelay(350, withTiming(1, intro)); }, [w > 0, landing, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // the bordered shell grows from one segment wide to full width, centred
  const shell = useAnimatedStyle(() => ({ width: interpolate(open.value, [0, 1], [seg + 2 * stroke + 2 * PAD, w]) }));
  // the full-width content stays centred inside the growing shell
  const inner = useAnimatedStyle(() => {
    const shellW = interpolate(open.value, [0, 1], [seg + 2 * stroke + 2 * PAD, w]);
    return { left: (shellW - w) / 2 };
  });
  // the indicator starts in the centre slot and springs out to the current tab
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(open.value, [0, 1], [seg, x.value]) }] }));

  return (
    <View ref={useTourTarget('tabs')} accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)} style={styles.track}>
      {w > 0 && (
        <Animated.View style={[styles.bar, { borderColor: c.edge, backgroundColor: c.card }, shell]}>
          <Animated.View style={[styles.inner, { width: w - 2 * stroke }, inner]}>
            <Animated.View style={[styles.pill, { width: seg, backgroundColor: c.ink }, pill]} />
            {tabs.map((t, i) => (
              <TabButton key={t.key} label={t.label} on={t.key === tab} offset={(1 - i) * seg} open={open} onPress={() => setTab(t.key)} />
            ))}
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

/** One tab. During the intro every tab sits in the centre slot (`offset` from its own) and slides out as `open` → 1. */
function TabButton({ label, on, offset, open, onPress }: { label: string; on: boolean; offset: number; open: SharedValue<number>; onPress: () => void }) {
  const c = useTheme();
  // the current tab starts in the centre; the others start stacked behind it, hidden
  const slide = useAnimatedStyle(() => ({
    opacity: on ? 1 : interpolate(open.value, [0.25, 0.9], [0, 1], 'clamp'),
    transform: [{ translateX: offset * (1 - open.value) }],
  }));
  return (
    <Animated.View style={[styles.item, slide]}>
      <Bouncy accessibilityRole="tab" aria-selected={on} accessibilityLabel={label} onPress={onPress} style={styles.hit}>
        <Text style={[styles.text, { color: on ? c.inverseInk : c.ink }]}>{label}</Text>
      </Bouncy>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: { height: 60, alignItems: 'center' },
  bar: { height: 60, borderRadius: radius.pill, borderWidth: stroke, overflow: 'hidden' },
  inner: { position: 'absolute', top: 0, bottom: 0, flexDirection: 'row', padding: PAD },
  pill: { position: 'absolute', left: PAD, top: PAD, bottom: PAD, borderRadius: radius.pill },
  item: { flex: 1 },
  hit: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  text: { fontFamily: font.bold, fontSize: 14 },
});
