import { memo, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';

const CELL = 28;

/** Graph paper grid plus a slowly drifting mesh gradient in the top corner. */
export const Backdrop = memo(function Backdrop() {
  const c = useTheme();
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, t]);

  const a = useAnimatedStyle(() => ({ transform: [{ translateX: -30 * t.value }, { translateY: 24 * t.value }] }));
  const b = useAnimatedStyle(() => ({ transform: [{ translateX: 26 * t.value }, { translateY: -18 * t.value }] }));
  const d = useAnimatedStyle(() => ({ transform: [{ translateX: 14 * t.value }, { translateY: 30 * t.value }] }));

  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const blob = c.mode === "dark" ? 0.7 : 0.6;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, overflow: "hidden" }]}>
      {Array.from({ length: cols }, (_, i) => (
        <View key={`v${i}`} style={{ position: 'absolute', left: i * CELL, top: 0, bottom: 0, width: 1, backgroundColor: c.grid }} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View key={`h${i}`} style={{ position: 'absolute', top: i * CELL, left: 0, right: 0, height: 1, backgroundColor: c.grid }} />
      ))}
      <View style={styles.mesh}>
        <Animated.View style={[styles.dot, { backgroundColor: c.pink, opacity: blob, top: 10, left: 40 }, a]} />
        <Animated.View style={[styles.dot, { backgroundColor: c.violet, opacity: blob, top: 90, left: 140 }, b]} />
        <Animated.View style={[styles.dot, { backgroundColor: c.coral, opacity: blob * 0.85, top: 170, left: 60, width: 150, height: 150 }, d]} />
        <BlurView intensity={80} tint="default" style={StyleSheet.absoluteFill} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  mesh: { position: 'absolute', top: -120, right: -110, width: 360, height: 360, borderRadius: 180, overflow: 'hidden' },
  dot: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
});
