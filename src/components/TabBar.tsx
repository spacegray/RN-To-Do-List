import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Bouncy } from './Bouncy';
import { useTheme } from '../theme/useTheme';
import { font, motion, radius, stroke } from '../theme/tokens';
import { useUI, type Tab } from '../store/ui';
import { useTourTarget } from './tour';

const tabs: { key: Tab; label: string }[] = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'calc', label: 'Calc' },
  { key: 'notes', label: 'Notes' },
];

/** Pill tab bar; the dark indicator slides between tabs on a spring. */
export function TabBar() {
  const c = useTheme();
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const index = tabs.findIndex((t) => t.key === tab);
  const seg = (w - 12) / tabs.length;

  useEffect(() => { if (w) x.value = withSpring(index * seg, motion.spring); }, [index, seg, w, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      ref={useTourTarget('tabs')}
      accessibilityRole="tablist"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[styles.bar, { borderColor: c.edge, backgroundColor: c.card }]}
    >
      {w > 0 && <Animated.View style={[styles.pill, { width: seg, backgroundColor: c.ink }, pill]} />}
      {tabs.map((t) => {
        const on = t.key === tab;
        return (
          <Bouncy
            key={t.key}
            accessibilityRole="tab"
            aria-selected={on}
            accessibilityLabel={t.label}
            onPress={() => setTab(t.key)}
            style={styles.item}
          >
            <Text style={[styles.text, { color: on ? c.inverseInk : c.ink }]}>{t.label}</Text>
          </Bouncy>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 60, borderRadius: radius.pill, borderWidth: stroke, padding: 4, marginHorizontal: 20 },
  pill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: radius.pill },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  text: { fontFamily: font.bold, fontSize: 14 },
});
