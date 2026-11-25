import { create } from 'zustand';
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { scheduleOnRN } from 'react-native-worklets';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useUI } from '../store/ui';
import { dark, light } from '../theme/tokens';

type Reveal = { origin: { x: number; y: number } | null; to: 'light' | 'dark' | null; start: (o: { x: number; y: number }, to: 'light' | 'dark') => void; end: () => void };

/** Shared state for the circular theme reveal started by ThemeToggle. */
export const useReveal = create<Reveal>((set) => ({
  origin: null, to: null,
  start: (origin, to) => set({ origin, to }),
  end: () => set({ origin: null, to: null }),
}));

/**
 * A circle in the new background color grows from the toggle button until it
 * covers the screen, the palette swaps underneath, then the circle fades out.
 */
export function ThemeReveal() {
  const { origin, to, end } = useReveal();
  const setTheme = useUI((s) => s.setTheme);
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  const r = Math.hypot(width, height);

  useEffect(() => {
    if (!origin || !to) return;
    scale.value = 0; opacity.value = 1;
    scale.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }, (done) => {
      if (!done) return;
      scheduleOnRN(setTheme, to);
      opacity.value = withDelay(60, withTiming(0, { duration: 260 }, (f) => { if (f) scheduleOnRN(end); }));
    });
  }, [origin, to, end, opacity, scale, setTheme]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  if (!origin || !to) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", left: origin.x - r, top: origin.y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: to === 'dark' ? dark.bg : light.bg },
        style,
      ]}
    />
    </View>
  );
}
