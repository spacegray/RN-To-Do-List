import { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, {
  Easing, FadeIn, FadeInDown, FadeInLeft, FadeInRight, FadeInUp, ZoomIn,
  interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Bouncy } from './Bouncy';
import { Bell, Calc, Pencil } from './Icons';
import { font, palette } from '../theme/tokens';
import { useUI } from '../store/ui';

/* Landing view: a fuchsia → violet ombre full of the app's orbs, a giant "Day / pad." title, a small
   cluster of the app's tools and two ways in. Leaving it, the text lifts away, the orbs part like
   clouds (one cluster drifts into the top-right corner where the app's own orbs live) and the fill
   fades to the grid underneath. Colors here are fixed: it is art, so it looks the same in both themes. */

const FILL = ['#F25AA6', '#D650C4', '#A14FE2', '#6B47F5'] as const;
const INK = palette.ink;
const PAPER = '#FFFDF6';
const ease = Easing.bezier(0.16, 1, 0.3, 1);

type Orb = { x: number; y: number; r: number; color: string; o: number; home?: [number, number] };
// x/y are fractions of the screen; `home` marks the orbs that settle into the app's corner cluster
const ORBS: Orb[] = [
  { x: 0.05, y: 0.04, r: 190, color: palette.pink, o: 0.95 },
  { x: 0.92, y: 0.12, r: 170, color: palette.violetBright, o: 0.9, home: [-30, -20] },
  { x: 0.78, y: 0.04, r: 140, color: palette.pink, o: 0.85, home: [-50, 30] },
  { x: 0.98, y: 0.3, r: 130, color: palette.coral, o: 0.7, home: [0, 60] },
  { x: 0.02, y: 0.5, r: 160, color: palette.coral, o: 0.6 },
  { x: 0.95, y: 0.68, r: 180, color: palette.pink, o: 0.55 },
  { x: 0.15, y: 0.9, r: 170, color: palette.violetBright, o: 0.6 },
  { x: 0.62, y: 1.0, r: 150, color: palette.coral, o: 0.5 },
];

/** A soft orb: a radial gradient that fades to transparent, so it reads as blurred on every platform. */
const OrbShape = memo(function OrbShape({ r, color, id }: { r: number; color: string; id: string }) {
  return (
    <Svg width={r * 2} height={r * 2}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="0.45" stopColor={color} stopOpacity={0.7} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
    </Svg>
  );
});

function FloatingOrb({ orb, i, out, drift, reduce }: { orb: Orb; i: number; out: SharedValue<number>; drift: SharedValue<number>; reduce: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const cx = orb.x * W;
  const cy = orb.y * H;
  const sign = i % 2 ? 1 : -1;
  const style = useAnimatedStyle(() => {
    const e = interpolate(out.value, [0.1, 1], [0, 1], 'clamp');
    const dx = sign * 26 * (drift.value - 0.5);
    const dy = -sign * 20 * (drift.value - 0.5);
    if (reduce) return { opacity: orb.o * (1 - e), transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    if (orb.home) {
      // drift into the app's corner cluster (centre about 70px in from the right, 60px down) and shrink
      const tx = W - 70 + orb.home[0] - cx;
      const ty = 60 + orb.home[1] - cy;
      return {
        opacity: orb.o * interpolate(e, [0, 0.7, 1], [1, 0.9, 0]),
        transform: [{ translateX: dx * (1 - e) + tx * e }, { translateY: dy * (1 - e) + ty * e }, { scale: interpolate(e, [0, 1], [1, 90 / orb.r]) }],
      };
    }
    // everything else flies outward from the centre, swelling and sinking as it fades
    const vx = cx - W / 2;
    const vy = cy - H / 2;
    const len = Math.max(1, Math.hypot(vx, vy));
    const dist = Math.max(W, H) * 0.8;
    return {
      opacity: orb.o * (1 - e),
      transform: [{ translateX: dx + (vx / len) * dist * e }, { translateY: dy + (vy / len) * dist * e + 180 * e * e }, { scale: 1 + 0.5 * e }],
    };
  });
  return (
    <Animated.View entering={ZoomIn.delay(i * 110).duration(1400).easing(ease)} style={{ position: 'absolute', left: cx - orb.r, top: cy - orb.r }}>
      <Animated.View style={style}>
        <OrbShape r={orb.r} color={orb.color} id={`orb${i}`} />
      </Animated.View>
    </Animated.View>
  );
}

/** Miniature notepad, calculator, sticky note and pencil, leaning on each other like a gift bag. */
function Cluster({ s, drift }: { s: number; drift: SharedValue<number> }) {
  const sway = useAnimatedStyle(() => ({ transform: [{ translateY: -5 * (drift.value - 0.5) }, { rotate: `${2 * (drift.value - 0.5)}deg` }] }));
  const shadow = `${3 * s}px ${3 * s}px 0px ${INK}`;
  const card = { position: 'absolute' as const, borderWidth: 2, borderColor: INK, borderRadius: 12 * s, boxShadow: shadow, overflow: 'hidden' as const };
  return (
    <Animated.View style={[{ width: 236 * s, height: 150 * s }, sway]} aria-hidden>
      {/* notepad */}
      <Animated.View entering={FadeInUp.delay(1050).duration(900).easing(ease)} style={{ position: 'absolute', left: 18 * s, top: 8 * s }}>
        <View style={[card, { position: 'relative', width: 96 * s, height: 120 * s, backgroundColor: PAPER, transform: [{ rotate: '-10deg' }] }]}>
          {Array.from({ length: 9 }, (_, k) => <View key={k} style={{ position: 'absolute', left: 0, right: 0, top: (22 + k * 11) * s, height: 1, backgroundColor: '#DCE6F2' }} />)}
          <View style={{ position: 'absolute', left: 13 * s, top: 0, bottom: 0, width: 2, backgroundColor: palette.pink }} />
          <View style={{ position: 'absolute', top: 6 * s, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 * s }}>
            {[0, 1, 2].map((k) => <View key={k} style={{ width: 7 * s, height: 7 * s, borderRadius: 4 * s, borderWidth: 1.5, borderColor: INK, backgroundColor: FILL[1] }} />)}
          </View>
        </View>
      </Animated.View>
      {/* calculator */}
      <Animated.View entering={FadeInUp.delay(1200).duration(900).easing(ease)} style={{ position: 'absolute', left: 96 * s, top: 0 }}>
        <View style={[card, { position: 'relative', width: 82 * s, height: 110 * s, backgroundColor: palette.night, padding: 7 * s, transform: [{ rotate: '9deg' }] }]}>
          <View style={{ height: 22 * s, borderRadius: 5 * s, borderWidth: 1.5, borderColor: '#F4F1EA', alignItems: 'flex-end', justifyContent: 'center', paddingRight: 5 * s }}>
            <Text style={{ color: '#F4F1EA', fontFamily: font.monoBold, fontSize: 12 * s }}>42</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 * s, marginTop: 6 * s }}>
            {Array.from({ length: 9 }, (_, k) => (
              <View key={k} style={{ width: 18 * s, height: 14 * s, borderRadius: 4 * s, borderWidth: k % 3 === 2 ? 0 : 1.5, borderColor: '#F4F1EA', backgroundColor: k === 8 ? palette.coral : k % 3 === 2 ? palette.pink : 'transparent' }} />
            ))}
          </View>
        </View>
      </Animated.View>
      {/* sticky note */}
      <Animated.View entering={FadeInUp.delay(1350).duration(900).easing(ease)} style={{ position: 'absolute', left: 56 * s, top: 82 * s }}>
        <View style={[card, { position: 'relative', width: 112 * s, height: 62 * s, backgroundColor: palette.lime, padding: 8 * s, transform: [{ rotate: '-4deg' }] }]}>
          <Text style={{ fontFamily: font.black, fontSize: 13 * s, color: INK }}>Water plants</Text>
          <Text style={{ fontFamily: font.mono, fontSize: 11 * s, color: INK, marginTop: 3 * s }}>7:00 pm</Text>
        </View>
      </Animated.View>
      {/* pencil coin */}
      <Animated.View entering={ZoomIn.delay(1500).duration(700).easing(ease)} style={{ position: 'absolute', left: 174 * s, top: 90 * s }}>
        <View style={[card, { position: 'relative', width: 44 * s, height: 44 * s, borderRadius: 22 * s, backgroundColor: palette.coral, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '12deg' }] }]}>
          <Pencil size={20 * s} color={INK} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const points = [
  { text: 'Type "call mom 5pm"', Icon: Pencil, shift: -26, from: FadeInLeft },
  { text: 'A calc that keeps a tape', Icon: Calc, shift: 30, from: FadeInRight },
  { text: 'Notes that remind you', Icon: Bell, shift: -8, from: FadeInLeft },
];

export function Landing() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const close = useUI((s) => s.closeLanding);
  const openTour = useUI((s) => s.openTour);
  const out = useSharedValue(0);
  const drift = useSharedValue(0.5);
  const leaving = useRef(false);

  useEffect(() => {
    if (!reduce) drift.value = withDelay(1200, withRepeat(withTiming(1, { duration: 6500, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduce, drift]);

  const day = Math.min(W * 0.36, H * 0.17, 168);
  const s = Math.max(0.85, Math.min(1.3, Math.min(W / 390, H / 800)));

  const leave = (demo: boolean) => {
    if (leaving.current) return;
    leaving.current = true;
    const done = () => {
      close();
      if (demo) setTimeout(openTour, 2000); // after the tab bar has glided open
    };
    out.value = withTiming(1, { duration: reduce ? 450 : 1700, easing: Easing.inOut(Easing.cubic) }, (f) => { if (f) scheduleOnRN(done); });
  };

  const fill = useAnimatedStyle(() => ({ opacity: interpolate(out.value, [0.2, 0.8], [1, 0], 'clamp') }));
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(out.value, [0, 0.35], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(out.value, [0, 0.35], [0, -40], 'clamp') }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal aria-modal>
      <Animated.View entering={FadeIn.duration(500)} style={[StyleSheet.absoluteFill, fill]}>
        <LinearGradient colors={FILL} locations={[0, 0.35, 0.7, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', pointerEvents: 'none' }]}>
        {ORBS.map((o, i) => <FloatingOrb key={i} orb={o} i={i} out={out} drift={drift} reduce={reduce} />)}
      </View>

      <Animated.View style={[styles.column, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }, content]}>
        <View style={{ flex: 1.35 }} />
        <Animated.Text entering={FadeInDown.delay(350).duration(900).easing(ease)} style={styles.kicker}>Tasks · Calc · Notes</Animated.Text>

        <View accessible accessibilityRole="header" accessibilityLabel="Daypad" style={{ alignItems: 'center', marginTop: 10 }}>
          <View style={{ flexDirection: 'row' }}>
            {'Day'.split('').map((ch, i) => (
              <Animated.Text key={i} entering={FadeInDown.delay(500 + i * 120).duration(1000).easing(ease)} style={[styles.day, { fontSize: day, lineHeight: day * 0.95, letterSpacing: -0.06 * day }]}>{ch}</Animated.Text>
            ))}
          </View>
          <Animated.Text entering={FadeInRight.delay(900).duration(1000).easing(ease)} style={[styles.pad, { fontSize: day * 0.46, lineHeight: day * 0.5, marginTop: -day * 0.08, marginLeft: day * 0.9 }]}>pad.</Animated.Text>
        </View>

        <View style={{ alignItems: 'center', marginTop: 18 * s }}>
          <Cluster s={s} drift={drift} />
        </View>

        <View style={{ alignItems: 'center', marginTop: 16 * s, gap: 8 }}>
          {points.map(({ text, Icon, shift, from }, i) => (
            <Animated.View key={text} entering={from.delay(1450 + i * 150).duration(900).easing(ease)} style={[styles.point, { marginLeft: shift * s, marginRight: -shift * s }]}>
              <View style={styles.pointIcon}><Icon size={13} color="#fff" /></View>
              <Text style={styles.pointText}>{text}</Text>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(1950).duration(900).easing(ease)} style={styles.actions}>
          <Bouncy accessibilityRole="button" accessibilityLabel="Enter Daypad" onPress={() => leave(false)} style={[styles.enter, { boxShadow: `3px 3px 0px ${INK}` }]}>
            <Text style={styles.enterText}>Enter Daypad →</Text>
          </Bouncy>
          <Bouncy accessibilityRole="button" accessibilityLabel="Watch demo: enter Daypad with a guided tour" onPress={() => leave(true)} style={styles.demo}>
            <Text style={styles.demoText}>Watch demo</Text>
          </Bouncy>
        </Animated.View>
        <View style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { ...StyleSheet.absoluteFill, alignItems: 'center', paddingHorizontal: 20 },
  kicker: { fontFamily: font.mono, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)' },
  day: { fontFamily: font.black, color: '#FFFFFF' },
  pad: { fontFamily: font.black, color: palette.lime, letterSpacing: -1.5 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pointText: { fontFamily: font.mono, fontSize: 13, color: '#fff' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 26, flexWrap: 'wrap', justifyContent: 'center' },
  enter: { height: 52, paddingHorizontal: 24, borderRadius: 26, borderWidth: 2, borderColor: INK, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' },
  enterText: { fontFamily: font.black, fontSize: 15, color: INK },
  demo: { height: 52, paddingHorizontal: 20, borderRadius: 26, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  demoText: { fontFamily: font.bold, fontSize: 15, color: '#fff' },
});
