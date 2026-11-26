import { useEffect, useRef } from 'react';
import { Linking, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Bouncy } from './Bouncy';
import { ChevronUp, GitHub, LinkedIn, Mail } from './Icons';
import { useTheme } from '../theme/useTheme';
import { font, motion, stroke, type } from '../theme/tokens';
import { useUI } from '../store/ui';

export const FOOTER_H = 88;

const links = [
  { label: 'Code', a11y: 'Daypad code on GitHub', url: 'https://github.com/spacegray/RN-To-Do-List', Icon: GitHub, accent: false },
  { label: 'LinkedIn', a11y: 'Ayla Basha on LinkedIn', url: 'https://www.linkedin.com/in/aylabasha/', Icon: LinkedIn, accent: false },
  { label: 'Contact', a11y: 'Contact Ayla Basha', url: 'https://ayla-basha-portfolio.vercel.app/#contact', Icon: Mail, accent: true },
];

/** 0 → 1 as the footer opens; shared by the panel and the arrow so they move together. */
function useFooterProgress() {
  const open = useUI((s) => s.footerOpen);
  const p = useSharedValue(open ? 1 : 0);
  useEffect(() => { p.value = withSpring(open ? 1 : 0, motion.spring); }, [open, p]);
  return { open, p };
}

/** Citron arrow beside the tab bar. Points up when closed, down when open. */
export function FooterToggle() {
  const c = useTheme();
  const toggle = useUI((s) => s.toggleFooter);
  const { open, p } = useFooterProgress();
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(p.value, [0, 1], [0, 180])}deg` }] }));
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={open ? 'Hide credits' : 'Show credits'}
      aria-expanded={open}
      onPress={toggle}
      style={[styles.toggle, { backgroundColor: c.lime, borderColor: c.edge }]}
    >
      <Animated.View style={spin}><ChevronUp color={c.onAccent} /></Animated.View>
    </Bouncy>
  );
}

/** Credits panel under the tab bar. Its height grows from the safe-area inset, which lifts the tab bar. */
export function Footer({ inset }: { inset: number }) {
  const c = useTheme();
  const { open, p } = useFooterProgress();
  const wrap = useAnimatedStyle(() => ({ height: inset + p.value * FOOTER_H }));
  const panel = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 16 }] }));
  return (
    <Animated.View style={[styles.wrap, wrap]} aria-hidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} accessibilityElementsHidden={!open}>
      <Animated.View style={[styles.panel, { backgroundColor: c.taupe, borderColor: c.edge, height: FOOTER_H + inset, paddingBottom: inset }, panel]}>
        <View style={styles.inner}>
          <View accessibilityRole="text">
            <Text style={[type.label, { color: c.muted }]}>Developed by</Text>
            <Text style={[styles.name, { color: c.ink }]}>Ayla Basha</Text>
          </View>
          <View style={styles.links}>
            {links.map(({ label, a11y, url, Icon, accent }) => (
              <Bouncy
                key={label}
                accessibilityRole="link"
                accessibilityLabel={a11y}
                disabled={!open}
                onPress={() => Linking.openURL(url).catch(() => {})}
                style={[styles.link, { borderColor: c.edge, backgroundColor: accent ? c.lime : c.card }]}
              >
                <Icon color={accent ? c.onAccent : c.ink} size={19} />
              </Bouncy>
            ))}
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Scroll handler for a screen's list: reaching the end opens the footer, scrolling back up closes it
 * (unless the arrow opened it). Only a real upward scroll closes it, so the list shrinking as the
 * footer opens can't close it again.
 */
export function useFooterScroll() {
  const setFromScroll = useUI((s) => s.setFooterFromScroll);
  const last = useRef(0);
  useEffect(() => () => setFromScroll(false), [setFromScroll]);
  return (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const fromEnd = contentSize.height - layoutMeasurement.height - y;
    if (contentSize.height > layoutMeasurement.height + 8 && fromEnd < 24) setFromScroll(true);
    else if (y < last.current - 4 && fromEnd > FOOTER_H + 40) setFromScroll(false);
    last.current = y;
  };
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  panel: { borderTopWidth: stroke, paddingTop: 20 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontFamily: font.black, fontSize: 17, marginTop: 2 },
  links: { flexDirection: 'row', gap: 8 },
  link: { width: 44, height: 44, borderRadius: 22, borderWidth: stroke, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 54, height: 54, borderRadius: 27, borderWidth: stroke, alignItems: 'center', justifyContent: 'center' },
});
