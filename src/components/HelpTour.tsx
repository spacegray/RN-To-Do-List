import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Bouncy } from './Bouncy';
import { useTheme } from '../theme/useTheme';
import { font, motion, radius, stroke, type } from '../theme/tokens';
import { useUI } from '../store/ui';
import { measureTarget, stepsFor, type Rect } from './tour';

const PAD = 6;

/**
 * The "?" walkthrough: dims the screen, springs a highlight ring to the control
 * being explained, and shows what it does plus how it works under the hood.
 */
export function HelpTour() {
  const c = useTheme();
  const { tab, tourOpen, tourStep, setTourStep, closeTour } = useUI();
  const { width, height } = useWindowDimensions();
  const steps = stepsFor(tab);
  const step = steps[Math.min(tourStep, steps.length - 1)];
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(220);
  const [showTech, setShowTech] = useState(true);

  const rx = useSharedValue(0), ry = useSharedValue(0), rw = useSharedValue(0), rh = useSharedValue(0), ro = useSharedValue(0);

  useEffect(() => {
    if (!tourOpen) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await measureTarget(step.target);
      if (!alive) return;
      setRect(r);
      if (r) {
        rx.value = withSpring(r.x - PAD, motion.spring); ry.value = withSpring(r.y - PAD, motion.spring);
        rw.value = withSpring(r.width + PAD * 2, motion.spring); rh.value = withSpring(r.height + PAD * 2, motion.spring);
        ro.value = withTiming(1, { duration: motion.base });
      } else ro.value = withTiming(0, { duration: motion.fast });
    }, 40);
    return () => { alive = false; clearTimeout(t); };
  }, [tourOpen, step.target, width, height, rx, ry, rw, rh, ro]);

  const next = () => (tourStep < steps.length - 1 ? setTourStep(tourStep + 1) : closeTour());
  const back = () => tourStep > 0 && setTourStep(tourStep - 1);

  useEffect(() => {
    if (!tourOpen || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTour();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const ring = useAnimatedStyle(() => ({ opacity: ro.value, left: rx.value, top: ry.value, width: rw.value, height: rh.value }));

  if (!tourOpen) return null;

  // place the card below the target when there is room, otherwise above it
  const below = rect ? rect.y + rect.height + PAD + 14 : height * 0.3;
  const top = rect && below + cardH > height - 20 ? Math.max(20, rect.y - PAD - 14 - cardH) : below;
  const cardW = Math.min(width - 32, 440);

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={closeTour} accessibilityRole="button" accessibilityLabel="Close the tour" />
      <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: c.lime }, ring]} />
      <Animated.View
        key={`${tab}-${tourStep}`}
        entering={FadeIn.duration(220)}
        onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
        style={[styles.card, { top, left: (width - cardW) / 2, width: cardW, backgroundColor: c.card, borderColor: c.edge, shadowColor: c.edge }]}
      >
        <Text style={[type.label, { color: c.violet }]}>Step {tourStep + 1} of {steps.length} · {tab}</Text>
        <Text style={[type.title, { color: c.ink, marginTop: 4 }]} accessibilityRole="header">{step.title}</Text>
        <Text style={[styles.body, { color: c.ink }]}>{step.body}</Text>
        <Pressable onPress={() => setShowTech((v) => !v)} accessibilityRole="button" aria-expanded={showTech} hitSlop={6}>
          <Text style={[type.label, { color: c.muted, marginTop: 10 }]}>{showTech ? '▾' : '▸'} How it works</Text>
        </Pressable>
        {showTech ? <Text style={[styles.tech, { color: c.muted, backgroundColor: c.bg, borderColor: c.grid }]}>{step.tech}</Text> : null}
        <View style={styles.nav}>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === tourStep ? c.violet : c.muted, width: i === tourStep ? 18 : 7, opacity: i === tourStep ? 1 : 0.4 }]} />
            ))}
          </View>
          <View style={styles.btns}>
            {tourStep > 0 ? (
              <Bouncy onPress={back} accessibilityRole="button" style={[styles.btn, { borderColor: c.edge }]}>
                <Text style={[styles.btnText, { color: c.ink }]}>Back</Text>
              </Bouncy>
            ) : (
              <Bouncy onPress={closeTour} accessibilityRole="button" style={[styles.btn, { borderColor: c.edge }]}>
                <Text style={[styles.btnText, { color: c.ink }]}>Skip</Text>
              </Bouncy>
            )}
            <Bouncy onPress={next} accessibilityRole="button" style={[styles.btn, { backgroundColor: c.ink, borderColor: c.edge }]}>
              <Text style={[styles.btnText, { color: c.inverseInk }]}>{tourStep < steps.length - 1 ? 'Next →' : 'Done'}</Text>
            </Bouncy>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 3, borderRadius: radius.lg },
  card: { position: 'absolute', borderWidth: stroke, borderRadius: radius.lg, padding: 18, shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 },
  body: { fontFamily: font.medium, fontSize: 15, lineHeight: 21, marginTop: 6 },
  tech: { fontFamily: font.mono, fontSize: 12, lineHeight: 18, marginTop: 6, padding: 10, borderRadius: 12, borderWidth: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center', flexShrink: 1, flexWrap: 'wrap' },
  dot: { height: 7, borderRadius: 4 },
  btns: { flexDirection: 'row', gap: 8 },
  btn: { minHeight: 42, paddingHorizontal: 16, borderWidth: stroke, borderRadius: radius.pill, justifyContent: 'center' },
  btnText: { fontFamily: font.bold, fontSize: 14 },
});
