import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, {
  Easing, FadeIn, FadeInDown, FadeInLeft, FadeInRight, FadeInUp, LinearTransition,
  interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Bouncy } from './Bouncy';
import { Bell, Calc, ListCheck, Pencil } from './Icons';
import { font, palette } from '../theme/tokens';
import { useUI } from '../store/ui';
import { HeroPanel, heroPoints, isLightFill } from './HeroPanel';

/* Landing view: an ombre (Oat by default, picked in the color panel) full of the app's orbs, a giant "Day / pad." title, a small
   cluster of the app's tools and two ways in. Leaving it, the text lifts away, the orbs part like
   clouds (one cluster drifts into the top-right corner where the app's own orbs live) and the fill
   fades to the grid underneath. Colors here are fixed: it is art, so it looks the same in both themes. */

const FILL = ['#F25AA6', '#D650C4', '#A14FE2', '#6B47F5'] as const;
const INK = palette.ink;
const PAPER = '#FFFDF6';
const ease = Easing.bezier(0.22, 1, 0.36, 1); // ease-out-quint: long, soft landings

/** Entrance choreography in ms ([delay, duration]); the whole scene settles in about 5 s. */
const T = {
  orb: (i: number) => [i * 220, 2600] as const,
  kicker: [700, 1600] as const,
  letter: (i: number) => [1000 + i * 260, 1800] as const,
  pad: [1800, 1800] as const,
  card: (k: number) => [2200 + k * 260, 1700] as const,
  point: (i: number) => [3000 + i * 280, 1500] as const,
  actions: [3700, 1500] as const,
  exit: 2600,
};

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

function FloatingOrb({ orb, i, out, drift, px, py, reduce }: { orb: Orb; i: number; out: SharedValue<number>; drift: SharedValue<number>; px: SharedValue<number>; py: SharedValue<number>; reduce: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const cx = orb.x * W;
  const cy = orb.y * H;
  // orbs grow with the screen (up to double) so big displays stay just as cloudy
  const r = orb.r * Math.max(1, Math.min(2, Math.max(W, H) / 900));
  const sign = i % 2 ? 1 : -1;
  const style = useAnimatedStyle(() => {
    const e = interpolate(out.value, [0.1, 1], [0, 1], 'clamp');
    const dx = sign * 26 * (drift.value - 0.5);
    const dy = -sign * 20 * (drift.value - 0.5);
    // each orb answers the cursor or finger on its own: a depth sway (nearer orbs move more), and a
    // gentle push away when the pointer comes close, so the clouds part around it
    const depth = 0.5 + (i % 3) * 0.35;
    const fx = (px.value + 1) * 0.5 * W - cx;
    const fy = (py.value + 1) * 0.5 * H - cy;
    const d = Math.max(1, Math.hypot(fx, fy));
    const push = Math.max(0, 1 - d / (r * 2.2)) * 46;
    const ix = (px.value * 12 * depth - (fx / d) * push) * (1 - out.value);
    const iy = (py.value * 9 * depth - (fy / d) * push) * (1 - out.value);
    if (reduce) return { opacity: orb.o * (1 - e), transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    if (orb.home) {
      // drift into the app's corner cluster (centre about 70px in from the right, 60px down) and shrink
      const tx = W - 70 + orb.home[0] - cx;
      const ty = 60 + orb.home[1] - cy;
      return {
        opacity: orb.o * interpolate(e, [0, 0.7, 1], [1, 0.9, 0]),
        transform: [{ translateX: (dx + ix) * (1 - e) + tx * e }, { translateY: (dy + iy) * (1 - e) + ty * e }, { scale: interpolate(e, [0, 1], [1, 90 / r]) }],
      };
    }
    // everything else flies outward from the centre, swelling and sinking as it fades
    const vx = cx - W / 2;
    const vy = cy - H / 2;
    const len = Math.max(1, Math.hypot(vx, vy));
    const dist = Math.max(W, H) * 0.8;
    return {
      opacity: orb.o * (1 - e),
      transform: [{ translateX: dx + ix + (vx / len) * dist * e }, { translateY: dy + iy + (vy / len) * dist * e + 180 * e * e }, { scale: 1 + 0.5 * e }],
    };
  });
  return (
    <Animated.View entering={FadeIn.delay(T.orb(i)[0]).duration(T.orb(i)[1]).easing(ease)} style={{ position: 'absolute', left: cx - r, top: cy - r }}>
      <Animated.View style={style}>
        <OrbShape r={r} color={orb.color} id={`orb${i}`} />
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
      <Animated.View entering={FadeInUp.delay(T.card(0)[0]).duration(T.card(0)[1]).easing(ease)} style={{ position: 'absolute', left: 18 * s, top: 8 * s }}>
        <View style={[card, { position: 'relative', width: 96 * s, height: 120 * s, backgroundColor: PAPER, transform: [{ rotate: '-10deg' }] }]}>
          {Array.from({ length: 9 }, (_, k) => <View key={k} style={{ position: 'absolute', left: 0, right: 0, top: (22 + k * 11) * s, height: 1, backgroundColor: '#DCE6F2' }} />)}
          <View style={{ position: 'absolute', left: 13 * s, top: 0, bottom: 0, width: 2, backgroundColor: palette.pink }} />
          <View style={{ position: 'absolute', top: 6 * s, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 * s }}>
            {[0, 1, 2].map((k) => <View key={k} style={{ width: 7 * s, height: 7 * s, borderRadius: 4 * s, borderWidth: 1.5, borderColor: INK, backgroundColor: FILL[1] }} />)}
          </View>
        </View>
      </Animated.View>
      {/* calculator */}
      <Animated.View entering={FadeInUp.delay(T.card(1)[0]).duration(T.card(1)[1]).easing(ease)} style={{ position: 'absolute', left: 96 * s, top: 0 }}>
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
      <Animated.View entering={FadeInUp.delay(T.card(2)[0]).duration(T.card(2)[1]).easing(ease)} style={{ position: 'absolute', left: 56 * s, top: 82 * s }}>
        <View style={[card, { position: 'relative', width: 112 * s, height: 62 * s, backgroundColor: palette.lime, padding: 8 * s, transform: [{ rotate: '-4deg' }] }]}>
          <Text style={{ fontFamily: font.black, fontSize: 13 * s, color: INK }}>Water plants</Text>
          <Text style={{ fontFamily: font.mono, fontSize: 11 * s, color: INK, marginTop: 3 * s }}>7:00 pm</Text>
        </View>
      </Animated.View>
      {/* pencil coin */}
      <Animated.View entering={FadeInUp.delay(T.card(3)[0]).duration(T.card(3)[1]).easing(ease)} style={{ position: 'absolute', left: 174 * s, top: 90 * s }}>
        <View style={[card, { position: 'relative', width: 44 * s, height: 44 * s, borderRadius: 22 * s, backgroundColor: palette.coral, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '12deg' }] }]}>
          <Pencil size={20 * s} color={INK} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// On web, `overflow: hidden` still lets the browser scroll the box (focus or a click inside the
// sliding colour panel nudged it sideways, exposing the app at the edge); `clip` can't be scrolled.
const CLIP = (process.env.EXPO_OS === 'web' ? 'clip' : 'hidden') as 'hidden';

const points = [
  { text: 'Smart lists that keep you on track', Icon: ListCheck, shift: -12 },
  { text: "A calc that's always mathing", Icon: Calc, shift: 26 },
  { text: 'Notes that remind you', Icon: Bell, shift: -8 },
];

export function Landing() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const close = useUI((s) => s.closeLanding);
  const openTour = useUI((s) => s.openTour);
  const out = useSharedValue(0);
  const drift = useSharedValue(0.5);
  const appear = useSharedValue(0); // color-panel fade-in
  const leaving = useRef(false);

  // hero colors from the color panel; a change crossfades over the previous gradient
  const heroFill = useUI((st) => st.heroFill);
  const heroDir = useUI((st) => st.heroDir);
  const [layers, setLayers] = useState([{ key: 0, fill: heroFill, dir: heroDir }]);
  const top = layers[layers.length - 1];
  if (top.fill !== heroFill || top.dir !== heroDir) setLayers([top, { key: top.key + 1, fill: heroFill, dir: heroDir }]);
  // text flips to ink on light fills so it keeps its contrast
  const light = isLightFill(heroFill);
  const fg = light ? INK : '#FFFFFF';
  const fgSoft = light ? '#3D3B45' : 'rgba(255,255,255,0.92)';
  const accent = light ? palette.violet : palette.lime;

  // the color-panel launcher's fade-in (with panelFade below, so it also fades out on leaving)
  useEffect(() => {
    appear.value = reduce ? 1 : withDelay(T.actions[0], withTiming(1, { duration: T.actions[1] }));
  }, [reduce, appear]);

  useEffect(() => {
    if (!reduce) drift.value = withDelay(4200, withRepeat(withTiming(1, { duration: 6250, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduce, drift]);

  // Everything scales from one factor set by the tighter of width and height, so the column grows
  // on big screens but always fits; each part has its own cap so nothing spreads past its margins.
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const wide = W >= 860 && W / H >= 1.15; // title moves left of the cluster, list and buttons
  const g = wide ? Math.min(W / 1280, H / 800) : Math.min(W / 390, H / 820);
  const day = wide ? clamp(Math.min(W * 0.17, H * 0.3), 150, 300) : Math.min(W * 0.36, H * 0.19, 250); // title
  const s = wide ? clamp(g * 1.5, 1.15, 2) * 1.15 : clamp(g, 0.85, 1.7) * 1.15; // tool cluster, 15% fuller at rest
  const t = wide ? clamp(g * 1.1, 1, 1.45) : clamp(g, 0.95, 1.3); // body text and buttons
  const gap = clamp(g, 0.85, 1.4); // vertical spacing

  // hover drift (web pointers): the title and cluster lean gently toward the cursor, in opposite directions
  const px = useSharedValue(0);
  const py = useSharedValue(0);
  const onPointerMove = (e: { nativeEvent: { pageX?: number; pageY?: number; clientX?: number; clientY?: number } }) => {
    if (reduce) return;
    const x = e.nativeEvent.pageX ?? e.nativeEvent.clientX ?? W / 2;
    const y = e.nativeEvent.pageY ?? e.nativeEvent.clientY ?? H / 2;
    px.value = withTiming((x / W) * 2 - 1, { duration: 865, easing: ease });
    py.value = withTiming((y / H) * 2 - 1, { duration: 865, easing: ease });
  };
  // after a finger lifts, the orbs drift back to rest (a mouse keeps its last position)
  const settle = (e?: { nativeEvent?: { pointerType?: string } }) => {
    if (reduce || (e?.nativeEvent?.pointerType && e.nativeEvent.pointerType !== 'touch')) return;
    px.value = withTiming(0, { duration: 1800, easing: ease });
    py.value = withTiming(0, { duration: 1800, easing: ease });
  };
  // web gets pointer events for mouse, pen and touch; native gets touches (observed, not claimed, so taps still land)
  const follow = process.env.EXPO_OS === 'web'
    ? { onPointerMove, onPointerDown: onPointerMove, onPointerUp: settle, onPointerCancel: settle }
    : { onTouchStart: onPointerMove, onTouchMove: onPointerMove, onTouchEnd: () => settle(), onTouchCancel: () => settle() };
  const titleLean = useAnimatedStyle(() => ({ transform: [{ translateX: px.value * 10 }, { translateY: py.value * 6 }] }));
  const clusterLean = useAnimatedStyle(() => ({ transform: [{ translateX: -px.value * 14 }, { translateY: -py.value * 8 }, { rotate: `${px.value * 1.5}deg` }] }));
  const orbLean = useAnimatedStyle(() => ({ transform: [{ translateX: px.value * 18 }, { translateY: py.value * 12 }] }));
  const glide = LinearTransition.duration(900).easing(ease);

  const leave = (demo: boolean) => {
    if (leaving.current) return;
    leaving.current = true;
    const done = () => {
      close();
      if (demo) setTimeout(openTour, 2400); // after the tab bar has glided open
    };
    out.value = withTiming(1, { duration: reduce ? 450 : T.exit, easing: Easing.inOut(Easing.cubic) }, (f) => { if (f) scheduleOnRN(done); });
  };

  const fill = useAnimatedStyle(() => ({ opacity: interpolate(out.value, [0.2, 0.8], [1, 0], 'clamp') }));
  const panelFade = useAnimatedStyle(() => ({ opacity: appear.value * interpolate(out.value, [0, 0.2], [1, 0], 'clamp') }));
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(out.value, [0, 0.4], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(out.value, [0, 0.4], [0, -32], 'clamp') }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: CLIP }]} accessibilityViewIsModal aria-modal {...follow}>
      {/* the fill is there from the first frame (no fade-in), so the app underneath never shows through on load */}
      <Animated.View style={[StyleSheet.absoluteFill, fill]}>
        {layers.map((l) => (
          <Animated.View key={l.key} entering={l.key ? FadeIn.duration(700).easing(ease) : undefined} style={StyleSheet.absoluteFill}>
            <LinearGradient colors={l.fill as unknown as readonly [string, string, ...string[]]} {...heroPoints(l.dir)} style={StyleSheet.absoluteFill} />
          </Animated.View>
        ))}
      </Animated.View>
      {/* no clip here: this layer leans with the pointer, so its own edge would slide into view; the root clips instead */}
      <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }, orbLean]}>
        {ORBS.map((o, i) => <FloatingOrb key={i} orb={o} i={i} out={out} drift={drift} px={px} py={py} reduce={reduce} />)}
      </Animated.View>

      <Animated.View style={[styles.column, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }, content]}>
        <View style={{ flex: wide ? 1.15 : 1.35 }} />
        <Animated.View layout={glide} style={wide ? [styles.row, { gap: clamp(W * 0.06, 48, 120) }] : { alignItems: 'center' }}>
          {/* title block: kicker, giant "Day", smaller "pad." */}
          <Animated.View
            layout={glide}
            entering={wide ? FadeInRight.delay(T.kicker[0]).duration(T.pad[1] + 800).easing(ease) : undefined}
            style={{ alignItems: wide ? 'flex-start' : 'center' }}
          >
            <Animated.Text entering={FadeInDown.delay(T.kicker[0]).duration(T.kicker[1]).easing(ease)} style={[styles.kicker, { color: fgSoft, fontSize: 12 * t, letterSpacing: 2 * t, marginLeft: wide ? day * 0.04 : 0 }]}>Tasks · Calc · Notes</Animated.Text>
            <Animated.View accessible accessibilityRole="header" accessibilityLabel="Daypad" style={[{ alignItems: wide ? 'flex-start' : 'center', marginTop: 10 * gap }, titleLean]}>
              <View style={{ flexDirection: 'row' }}>
                {'Day'.split('').map((ch, i) => (
                  <Animated.Text key={i} entering={FadeInDown.delay(T.letter(i)[0]).duration(T.letter(i)[1]).easing(ease)} style={[styles.day, { color: fg, fontSize: day, lineHeight: day * 0.95, letterSpacing: -0.06 * day }]}>{ch}</Animated.Text>
                ))}
              </View>
              <Animated.Text entering={FadeInRight.delay(T.pad[0]).duration(T.pad[1]).easing(ease)} style={[styles.pad, { color: accent, fontSize: day * 0.46, lineHeight: day * 0.5, marginTop: -day * 0.08, marginLeft: day * 0.9, letterSpacing: -0.03 * day }]}>pad.</Animated.Text>
            </Animated.View>
          </Animated.View>

          {/* content block: cluster, feature list, buttons */}
          <Animated.View layout={glide} style={{ alignItems: wide ? 'flex-start' : 'center', marginTop: wide ? 0 : 18 * gap }}>
            <Animated.View style={clusterLean}>
              <Cluster s={s} drift={drift} />
            </Animated.View>

            <View style={{ alignItems: wide ? 'flex-start' : 'center', marginTop: 16 * gap + (wide ? 8 : 0), gap: 10 * t }}>
              {points.map(({ text, Icon, shift }, i) => (
                <Animated.View
                  key={text}
                  entering={(wide || i % 2 === 0 ? FadeInLeft : FadeInRight).delay(T.point(i)[0]).duration(T.point(i)[1]).easing(ease)}
                  style={[styles.point, { gap: 10 * t }, !wide && { marginLeft: shift * t, marginRight: -shift * t }]}
                >
                  <View style={[styles.pointIcon, { borderColor: fg, width: 26 * t, height: 26 * t, borderRadius: 13 * t }]}><Icon size={14 * t} color={fg} /></View>
                  <Text style={[styles.pointText, { color: fg, fontSize: 13 * t }]}>{text}</Text>
                </Animated.View>
              ))}
            </View>

            <Animated.View entering={FadeInDown.delay(T.actions[0]).duration(T.actions[1]).easing(ease)} style={[styles.actions, { marginTop: 26 * gap, gap: 12 * t, justifyContent: wide ? 'flex-start' : 'center' }]}>
              <Bouncy accessibilityRole="button" accessibilityLabel="Enter Daypad" onPress={() => leave(false)} style={[styles.enter, { height: 52 * t, borderRadius: 26 * t, paddingHorizontal: 24 * t, boxShadow: `3px 3px 0px ${INK}` }]}>
                <Text style={[styles.enterText, { fontSize: 15 * t }]}>Enter Daypad →</Text>
              </Bouncy>
              <Bouncy accessibilityRole="button" accessibilityLabel="Watch demo: enter Daypad with a guided tour" onPress={() => leave(true)} style={[styles.demo, { borderColor: fg, height: 52 * t, borderRadius: 26 * t, paddingHorizontal: 20 * t }]}>
                <Text style={[styles.demoText, { color: fg, fontSize: 15 * t }]}>Watch demo</Text>
              </Bouncy>
            </Animated.View>
          </Animated.View>
        </Animated.View>
        <View style={{ flex: 1 }} />
      </Animated.View>

      {/* full-screen layer that must let clicks through to the buttons: react-native-web drops 'box-none' given
          as a style (it then swallows every click), so it is passed as the prop, on a plain View; the fade is on the launcher */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <HeroPanel ink={fg} top={insets.top} fade={panelFade} />
      </View>
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  enter: { height: 52, paddingHorizontal: 24, borderRadius: 26, borderWidth: 2, borderColor: INK, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' },
  enterText: { fontFamily: font.black, fontSize: 15, color: INK },
  demo: { height: 52, paddingHorizontal: 20, borderRadius: 26, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  demoText: { fontFamily: font.bold, fontSize: 15, color: '#fff' },
});
