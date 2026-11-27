import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ZoomIn, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Bouncy } from './Bouncy';
import { Close, Collapse, Expand, Floppy, Palette, Trash } from './Icons';
import { font, palette } from '../theme/tokens';
import { HERO_CUSTOM_MAX, HERO_DEFAULT, useUI, type HeroDir } from '../store/ui';
import { usePersistentState } from '../store/drafts';

/* Hero color panel: a compact button on the landing that slides open a panel for the hero gradient.
   Presets cover the looks already made plus a few new ones; "Build your own" edits up to four stops. */

const INK = palette.ink;
const PAPER = '#FFFDF6';
const ease = Easing.bezier(0.22, 1, 0.36, 1);

export const PRESETS: { name: string; fill: string[] }[] = [
  { name: 'Oat', fill: HERO_DEFAULT },
  { name: 'Orchid', fill: ['#F25AA6', '#D650C4', '#A14FE2', '#6B47F5'] },
  { name: 'Electric', fill: ['#E8308C', '#B02CC9', '#4B2BFF'] },
  { name: 'Blush', fill: ['#FDE3EF', '#F6C6E3', '#DDB8F2', '#BFB3FF'] },
  { name: 'Afterglow', fill: ['#FF8A5B', '#FF5E57', '#C93C9C', '#4B2BFF'] },
  { name: 'Lagoon', fill: ['#7FD6FF', '#4E8CFF', '#4B2BFF'] },
  { name: 'Citrus', fill: ['#D8F55B', '#8FE3C8', '#5AA8FF', '#4B2BFF'] },
  { name: 'Sunbeam', fill: ['#FFF1A6', '#FFD24D', '#FF9F5A', '#FF6B8B'] },
  { name: 'Midnight', fill: ['#1B1440', '#3B2A9E', '#8A2BB8'] },
  // softer neutrals and fall / winter contrasts
  { name: 'Bordeaux Sea', fill: ['#6D1A36', '#A23E5C', '#7FC8B4', '#C9F0E1'] },
  { name: 'Wine and Lime', fill: ['#5A1230', '#8E2449', '#C9E265'] },
  { name: 'Linen', fill: ['#FBF7F0', '#EFE4D6', '#D9CBBE', '#BFB3C9'] },
  { name: 'Juniper', fill: ['#1F3B3A', '#3E6E68', '#A9C9C1', '#E8F0EE'] },
  { name: 'Ember', fill: ['#7A2E1E', '#C1572E', '#E8A15A', '#F4D8A8'] },
];

const SWATCHES = [
  '#E8308C', '#F25AA6', '#FFB3D1', '#FDE3EF', '#B02CC9', '#DDB8F2',
  '#8A75FF', '#4B2BFF', '#2E3BFF', '#4E8CFF', '#7FD6FF', '#8FE3C8',
  '#D8F55B', '#FFF1A6', '#FFD24D', '#FF9F5A', '#FF5E57', '#1B1440',
  '#6D1A36', '#A23E5C', '#7FC8B4', '#F4ECDD', '#C9B49A', '#C1572E',
];

const DIRS: { key: HeroDir; label: string; arrow: string }[] = [
  { key: 'down', label: 'Down', arrow: '↓' },
  { key: 'diag', label: 'Diagonal', arrow: '↘' },
  { key: 'across', label: 'Across', arrow: '→' },
];

/** Gradient start/end points for each direction. */
export function heroPoints(dir: HeroDir) {
  if (dir === 'down') return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
  if (dir === 'across') return { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
  return { start: { x: 0.2, y: 0 }, end: { x: 0.8, y: 1 } };
}

/** Relative luminance (WCAG) of a #rrggbb color. */
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** True when ink text reads better than white. Judged on the first two stops, which sit behind the title in every direction. */
export function isLightFill(fill: string[]) {
  return (lum(fill[0]) + lum(fill[1])) / 2 > 0.4;
}

const sameFill = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());
const asStops = (f: string[]) => f as unknown as readonly [string, string, ...string[]];

/** Sizes for the two panel modes: full (desktop, or expanded on a phone) and slim (a phone's first view). */
function sizes(panelW: number, slim: boolean) {
  const pad = slim ? 8 : 16;
  const inner = panelW - 4 - pad * 2;
  const gap = slim ? 6 : 8;
  const tileW = (inner - gap) / 2;
  const cols = slim ? 4 : 6;
  const swGap = slim ? 5 : 8;
  const sw = (inner - (cols - 1) * swGap) / cols;
  return {
    slim, pad, gap, tileW, sw, swGap,
    tilePad: slim ? 2 : 4,
    pillH: slim ? 13 : 26,
    tileH: slim ? 21 : 62,
    dot: slim ? 18 : 30,
    trayH: slim ? 32 : 48,
    btn: slim ? 26 : 36,
  };
}
type Sz = ReturnType<typeof sizes>;
type ScrollRef = React.ComponentRef<typeof ScrollView>;

function Swatch({ fill, dir, w, h }: { fill: string[]; dir: HeroDir; w: number; h: number }) {
  return <LinearGradient colors={asStops(fill)} {...heroPoints(dir)} style={{ width: w, height: h, borderRadius: h / 2 }} />;
}

/**
 * A capped list: shows a few rows and scrolls the rest inside itself, so one long category never pushes the
 * others out of view. A soft fade at the bottom shows there's more.
 */
function ScrollBox({ max, scrollRef, children }: { max: number; scrollRef?: React.Ref<ScrollRef>; children: React.ReactNode }) {
  const [m, setM] = useState({ content: 0, y: 0 });
  const more = m.content > max + 1 && m.y + max < m.content - 2;
  return (
    <View style={{ maxHeight: max }}>
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onContentSizeChange={(_, h) => setM((s) => ({ ...s, content: h }))}
        onScroll={(e) => { const y = e.nativeEvent.contentOffset.y; setM((s) => (Math.abs(s.y - y) > 1 ? { ...s, y } : s)); }}
        style={{ maxHeight: max }}
      >
        {children}
      </ScrollView>
      {more ? <LinearGradient pointerEvents="none" colors={['rgba(255,253,246,0)', PAPER]} style={styles.fade} /> : null}
    </View>
  );
}
const cap = (rows: number, item: number, gap: number) => rows * item + (rows - 1) * gap + item * 0.45 + gap;

/* "Build your own" tray: an oval the color stops sit in. Once it holds two or more they slide together and
   the oval fades to their gradient; saving melts them into it completely (`melt` 0 → 1). */
function TrayDot({ i, n, z, merge, melt, children }: { i: number; n: number; z: Sz; merge: SharedValue<number>; melt: SharedValue<number>; children: React.ReactNode }) {
  const spread = z.dot * 1.2; // spacing before they slide together
  const snug = z.dot * 0.73; // overlapping, once merged
  const left = z.slim ? 5 : 7;
  const style = useAnimatedStyle(() => {
    const step = interpolate(merge.value, [0, 1], [spread, snug]);
    const home = i * step;
    const centre = ((n - 1) * step) / 2;
    return {
      opacity: 1 - melt.value,
      transform: [{ translateX: left + home + (centre - home) * melt.value }, { scale: 1 - 0.35 * melt.value }],
    };
  });
  return <Animated.View style={[styles.trayDot, { top: (z.trayH - 4 - z.dot) / 2, zIndex: 10 - i }, style]}>{children}</Animated.View>;
}

function Tray({ fill, slot, z, melt, onPick, onAdd }: { fill: string[]; slot: number; z: Sz; melt: SharedValue<number>; onPick: (i: number) => void; onAdd: () => void }) {
  const merge = useSharedValue(0);
  const n = fill.length;
  // re-run the slide whenever a stop is added or removed
  useEffect(() => {
    merge.value = withSequence(withTiming(0, { duration: 220, easing: ease }), withDelay(250, withTiming(n >= 2 ? 1 : 0, { duration: 900, easing: ease })));
  }, [n, merge]);
  const grad = useAnimatedStyle(() => ({ opacity: Math.max(merge.value * 0.9, melt.value) }));
  const dot = { width: z.dot, height: z.dot, borderRadius: z.dot / 2, borderWidth: z.slim ? 1.5 : 2 };
  const ring = z.slim ? `0px 0px 0px 2px ${PAPER}, 0px 0px 0px 3.5px ${INK}` : `0px 0px 0px 3px ${PAPER}, 0px 0px 0px 5px ${INK}`;
  return (
    <View style={[styles.tray, { height: z.trayH, borderRadius: z.trayH / 2 }, z.slim ? { alignSelf: 'stretch' } : { flex: 1 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, grad]}>
        <LinearGradient colors={asStops(fill)} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {fill.map((c, i) => (
        <TrayDot key={i} i={i} n={n + (n < 4 ? 1 : 0)} z={z} merge={merge} melt={melt}>
          <Bouncy accessibilityRole="button" aria-selected={i === slot} accessibilityLabel={`Color stop ${i + 1}, ${c}`} hitSlop={4} onPress={() => onPick(i)}
            style={[styles.holder, dot, { backgroundColor: c }, i === slot && { boxShadow: ring }]} />
        </TrayDot>
      ))}
      {n < 4 ? (
        <TrayDot i={n} n={n + 1} z={z} merge={merge} melt={melt}>
          <Bouncy accessibilityRole="button" accessibilityLabel="Add a color stop" hitSlop={4} onPress={onAdd} style={[styles.holder, dot, styles.addHolder]}>
            <Text style={[styles.addText, z.slim && { fontSize: 12, lineHeight: 14 }]}>+</Text>
          </Bouncy>
        </TrayDot>
      ) : null}
    </View>
  );
}

const FULL_MSG = 'Your custom presets are full, please delete some (or one) to make room';

/**
 * The hero color panel. On the landing it brings its own launcher (a labelled Colors pill);
 * inside the app it is opened from the toolbar's palette button instead (`launcher={false}`).
 * `fade` is an animated opacity for the launcher (the landing's entrance and exit).
 */
export function HeroPanel({ ink, top, fade, launcher = true }: { ink: string; top: number; fade?: ReturnType<typeof useAnimatedStyle>; launcher?: boolean }) {
  const { width: W } = useWindowDimensions();
  const fill = useUI((s) => s.heroFill);
  const dir = useUI((s) => s.heroDir);
  const setHero = useUI((s) => s.setHero);
  const custom = useUI((s) => s.heroCustom);
  const saveCustom = useUI((s) => s.saveHeroCustom);
  const removeCustom = useUI((s) => s.removeHeroCustom);
  const [msg, setMsg] = useState<string | null>(null);
  const melt = useSharedValue(0);
  const saving = useRef(false);
  const open = useUI((s) => s.heroPanelOpen);
  const setOpen = useUI((s) => s.setHeroPanel);
  const seenTip = useUI((s) => s.seenColorTip);
  const reduce = useReducedMotion();
  const ring = useSharedValue(0);
  // saved between visits: which stop is being edited, and whether a phone last expanded the panel
  const [savedSlot, setSlot] = usePersistentState('hero.slot', 0);
  const slot = Math.min(savedSlot, fill.length - 1);
  const [expanded, setExpanded] = usePersistentState('hero.expanded', false);
  const [draft, setDraft] = useState<string | null>(null); // hex being typed; null shows the stop's color
  const hex = draft ?? fill[slot];
  const [shown, setShown] = useState(open); // panel stays out of the page (and focus order) while closed
  if (open && !shown) setShown(true); // opened from outside (the app toolbar)
  const customRef = useRef<ScrollRef>(null);

  // phones open a slim panel first (about a third of the screen) with an expand button; desktop is always full
  const phone = W < 600;
  const slim = phone && !expanded;
  const panelW = slim ? Math.round(Math.min(170, Math.max(124, W * 0.36))) : Math.min(300, Math.round(W * 0.92));
  const z = sizes(panelW, slim);

  const x = useSharedValue(1);
  const w = useSharedValue(panelW);
  const body = useSharedValue(1);
  const first = useRef(true);

  const toggle = (next: boolean) => {
    if (next) setShown(true);
    setOpen(next);
  };
  useEffect(() => {
    x.value = withTiming(open ? 0 : 1, { duration: 650, easing: ease }, (f) => { if (f && !open) scheduleOnRN(setShown, false); });
  }, [open, x]);
  // switching size: the contents fade out, the panel glides to its new width, the contents fade back in
  const resize = () => { body.value = withTiming(0, { duration: 140 }, (f) => { if (f) scheduleOnRN(setExpanded, !expanded); }); };
  useEffect(() => {
    if (first.current) { first.current = false; w.value = panelW; return; }
    w.value = withTiming(panelW, { duration: 480, easing: ease });
    body.value = withDelay(260, withTiming(1, { duration: 320, easing: ease }));
  }, [panelW, w, body]);
  // first visit: the Colors pill sends out two soft rings (after the landing's entrance), then stays still
  useEffect(() => {
    if (!launcher || seenTip || reduce) return;
    ring.value = withDelay(5400, withRepeat(withSequence(withTiming(1, { duration: 1300, easing: ease }), withTiming(0, { duration: 0 })), 2, false));
  }, [launcher, seenTip, reduce, ring]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value === 0 ? 0 : 0.55 * (1 - ring.value), transform: [{ scaleX: 1 + 0.25 * ring.value }, { scaleY: 1 + 0.6 * ring.value }] }));

  const panel = useAnimatedStyle(() => ({ width: w.value, opacity: 1 - x.value, transform: [{ translateX: x.value * (w.value + 40) }] }));
  const bodyFade = useAnimatedStyle(() => ({ opacity: body.value }));

  // a newly saved preset may land below the visible rows: scroll it into view
  const count = useRef(custom.length);
  useEffect(() => {
    if (custom.length > count.current) setTimeout(() => customRef.current?.scrollToEnd({ animated: true }), 120);
    count.current = custom.length;
  }, [custom.length]);

  const setStop = (c: string) => setHero({ fill: fill.map((v, i) => (i === slot ? c : v)) });
  const commitHex = () => {
    const v = hex.trim().replace(/^#?/, '#');
    if (/^#[0-9a-f]{6}$/i.test(v)) setStop(v.toUpperCase());
    setDraft(null);
  };
  const addStop = () => { if (fill.length < 4) { setHero({ fill: [...fill, fill[fill.length - 1]] }); setSlot(fill.length); } };
  const save = () => {
    if (saving.current) return;
    const dupe = custom.some((c) => c.dir === dir && sameFill(c.fill, fill));
    if (dupe) return setMsg('That mix is already in your custom presets');
    if (custom.length >= HERO_CUSTOM_MAX) return setMsg(FULL_MSG);
    setMsg(null);
    saving.current = true;
    const commit = () => { saveCustom(); saving.current = false; };
    // the stops slide together and melt into the gradient, it's saved, then they come back
    melt.value = withSequence(
      withTiming(1, { duration: 750, easing: ease }, (f) => { if (f) scheduleOnRN(commit); }),
      withDelay(500, withTiming(0, { duration: 650, easing: ease })),
    );
  };
  const removeStop = () => { if (fill.length > 2) { setHero({ fill: fill.filter((_, i) => i !== slot) }); setSlot(Math.max(0, slot - 1)); } };

  const label = [styles.label, slim && styles.labelSlim];
  const tile = { width: z.tileW, height: z.tileH, padding: z.tilePad, borderRadius: slim ? 10 : 14 };
  const pillW = z.tileW - z.tilePad * 2 - 4;
  const iconBtn = [styles.iconBtn, { width: z.btn, height: z.btn, borderRadius: z.btn / 2, borderWidth: slim ? 1.5 : 2 }];
  const trash = (
    <Bouncy accessibilityRole="button" accessibilityLabel="Delete this color stop" disabled={fill.length <= 2} onPress={removeStop}
      style={[iconBtn, fill.length <= 2 && { opacity: 0.35 }]}>
      <Trash size={slim ? 12 : 16} color={INK} />
    </Bouncy>
  );
  const floppy = (
    <Bouncy accessibilityRole="button" accessibilityLabel="Save to custom presets" onPress={save} style={[iconBtn, styles.saveBtn]}>
      <Floppy size={slim ? 13 : 17} color={INK} />
    </Bouncy>
  );

  return (
    <>
      {/* labelled launcher, top right */}
      {launcher ? (
        <Animated.View style={[styles.launchSpot, { top: top + 16 }, fade]}>
          <View>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, { borderColor: ink }, ringStyle]} />
              <Bouncy
              accessibilityRole="button"
              accessibilityLabel={open ? 'Close colors' : 'Colors: pick your hero colors'}
              aria-expanded={open}
              onPress={() => toggle(!open)}
              style={[styles.launch, { borderColor: ink }]}
            >
              <Palette size={18} color={ink} />
              <Text style={[styles.launchText, { color: ink }]}>Colors</Text>
            </Bouncy>
          </View>
        </Animated.View>
      ) : null}

      {/* clear tap-outside layer: no dimming, so the hero shows its true colors while you edit */}
      {open ? <Pressable accessibilityLabel="Close hero colors" onPress={() => toggle(false)} style={StyleSheet.absoluteFill} /> : null}

      {shown ? (
        <Animated.View style={[styles.panel, { top: top + 12, borderRadius: slim ? 16 : 22 }, panel, { pointerEvents: open ? 'auto' : 'none' }]} aria-hidden={!open} accessibilityViewIsModal={open}>
          <Animated.View style={[{ flex: 1, paddingHorizontal: z.pad, paddingTop: slim ? 8 : 14 }, bodyFade]}>
            <View style={[styles.head, { gap: slim ? 4 : 8 }]}>
              <Text style={[styles.title, slim && { fontSize: 13, letterSpacing: 0 }]} accessibilityRole="header" numberOfLines={1}>{slim ? 'Colors' : 'Your colors'}</Text>
              {phone ? (
                <Bouncy accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse color panel' : 'Expand color panel'} aria-expanded={expanded} hitSlop={4} onPress={resize}
                  style={[styles.close, { width: z.btn, height: z.btn, borderRadius: z.btn / 2, borderWidth: slim ? 1.5 : 2 }]}>
                  {expanded ? <Collapse size={16} color={INK} /> : <Expand size={12} color={INK} />}
                </Bouncy>
              ) : null}
              <Bouncy accessibilityRole="button" accessibilityLabel="Close" hitSlop={4} onPress={() => toggle(false)}
                style={[styles.close, { width: z.btn, height: z.btn, borderRadius: z.btn / 2, borderWidth: slim ? 1.5 : 2 }]}>
                <Close size={slim ? 12 : 18} color={INK} />
              </Bouncy>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
              <Text style={label}>Presets · {PRESETS.length}</Text>
              <ScrollBox max={cap(3, z.tileH, z.gap)}>
                <View style={[styles.presets, { gap: z.gap }]}>
                  {PRESETS.map((p) => {
                    const on = sameFill(p.fill, fill);
                    return (
                      <Bouncy key={p.name} accessibilityRole="button" aria-selected={on} accessibilityLabel={`${p.name} preset`} onPress={() => setHero({ fill: p.fill })}
                        style={[styles.preset, tile, on && styles.presetOn]}>
                        <Swatch fill={p.fill} dir={dir} w={pillW} h={z.pillH} />
                        {slim ? null : <Text style={styles.presetName} numberOfLines={1}>{p.name}</Text>}
                      </Bouncy>
                    );
                  })}
                </View>
              </ScrollBox>

              <Text style={label}>{slim ? 'Custom' : 'Custom presets'} · {custom.length}/{HERO_CUSTOM_MAX}</Text>
              {custom.length === 0 ? (
                <Text style={[styles.hint, slim && { fontSize: 10, lineHeight: 14 }]}>{slim ? 'Save a mix with the floppy.' : 'Mix your own below, then tap the floppy to keep it here.'}</Text>
              ) : (
                <ScrollBox max={cap(2, z.tileH, z.gap)} scrollRef={customRef}>
                  <View style={[styles.presets, { gap: z.gap }]}>
                    {custom.map((c, i) => {
                      const on = c.dir === dir && sameFill(c.fill, fill);
                      const del = slim ? 16 : 22;
                      return (
                        <Animated.View key={c.id} entering={ZoomIn.duration(550).easing(ease)} exiting={FadeOut.duration(250)} layout={LinearTransition.duration(400).easing(ease)}>
                          <Bouncy accessibilityRole="button" aria-selected={on} accessibilityLabel={`Custom preset ${i + 1}`} onPress={() => setHero({ fill: c.fill, dir: c.dir })}
                            style={[styles.preset, tile, on && styles.presetOn]}>
                            <Swatch fill={c.fill} dir={c.dir} w={pillW} h={z.pillH} />
                            {slim ? null : <Text style={styles.presetName}>Custom {i + 1}</Text>}
                          </Bouncy>
                          <Bouncy accessibilityRole="button" accessibilityLabel={`Delete custom preset ${i + 1}`} hitSlop={6} onPress={() => { removeCustom(c.id); setMsg(null); }}
                            style={[styles.del, { width: del, height: del, borderRadius: del / 2 }, slim && { top: 2.5, right: 1 }]}>
                            <Trash size={slim ? 9 : 12} color={INK} />
                          </Bouncy>
                        </Animated.View>
                      );
                    })}
                  </View>
                </ScrollBox>
              )}

              <Text style={label}>{slim ? 'Build' : 'Build your own'}</Text>
              {slim ? (
                <>
                  <Tray fill={fill} slot={slot} z={z} melt={melt} onPick={(i) => { setSlot(i); setDraft(null); }} onAdd={addStop} />
                  <View style={[styles.trayRow, { justifyContent: 'flex-end', marginTop: 6 }]}>{trash}{floppy}</View>
                </>
              ) : (
                <View style={styles.trayRow}>
                  <Tray fill={fill} slot={slot} z={z} melt={melt} onPick={(i) => { setSlot(i); setDraft(null); }} onAdd={addStop} />
                  {trash}
                  {floppy}
                </View>
              )}
              {msg ? <Animated.Text entering={FadeIn.duration(300)} accessibilityRole="alert" style={[styles.msg, slim && { fontSize: 11, lineHeight: 15 }]}>{msg}</Animated.Text> : null}

              <Text style={label}>Swatches · {SWATCHES.length}</Text>
              <ScrollBox max={cap(3, z.sw, z.swGap)}>
                <View style={[styles.swatches, { gap: z.swGap }]}>
                  {SWATCHES.map((c) => (
                    <Bouncy key={c} accessibilityRole="button" accessibilityLabel={`Use ${c}`} onPress={() => setStop(c)}
                      style={[styles.swatch, { width: z.sw, height: z.sw, borderRadius: slim ? 6 : 9 }, { backgroundColor: c }, fill[slot]?.toLowerCase() === c.toLowerCase() && styles.swatchOn]} />
                  ))}
                </View>
              </ScrollBox>
              <View style={[styles.hexRow, slim && { height: 30, gap: 5, paddingHorizontal: 4, borderWidth: 1.5 }]}>
                <View style={[styles.hexDot, { backgroundColor: fill[slot] }, slim && { width: 18, height: 18, borderRadius: 9 }]} />
                <TextInput
                  value={hex}
                  onChangeText={setDraft}
                  onSubmitEditing={commitHex}
                  onBlur={commitHex}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={7}
                  accessibilityLabel={`Hex color for stop ${slot + 1}`}
                  style={[styles.hex, slim && { fontSize: 11 }, Platform.OS === 'web' && ({ outlineStyle: 'none', minWidth: 0 } as object)]}
                />
              </View>

              <Text style={label}>Direction</Text>
              <View style={[styles.dirs, slim && { gap: 5 }]}>
                {DIRS.map((d) => {
                  const on = d.key === dir;
                  return (
                    <Bouncy key={d.key} accessibilityRole="button" accessibilityLabel={`${d.label} gradient`} aria-selected={on} onPress={() => setHero({ dir: d.key })}
                      style={[styles.dir, on && styles.dirOn, slim && { width: 28, height: 28, paddingHorizontal: 0, alignItems: 'center', borderWidth: 1.5 }]}>
                      <Text style={[styles.dirText, on && { color: PAPER }, slim && { fontSize: 13 }]}>{slim ? d.arrow : `${d.arrow} ${d.label}`}</Text>
                    </Bouncy>
                  );
                })}
              </View>

              <Bouncy accessibilityRole="button" accessibilityLabel="Reset to Oat" onPress={() => { setHero({ fill: HERO_DEFAULT, dir: 'diag' }); setSlot(0); }} style={[styles.reset, slim && { marginTop: 12 }]}>
                <Text style={[styles.textBtnLabel, slim && { fontSize: 11 }]}>{slim ? 'Reset' : 'Reset to Oat'}</Text>
              </Bouncy>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  launchSpot: { position: 'absolute', right: 16, alignItems: 'flex-end' },
  launch: { height: 40, flexDirection: 'row', gap: 6, paddingLeft: 10, paddingRight: 14, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
  launchText: { fontFamily: font.bold, fontSize: 14 },
  ring: { borderRadius: 20, borderWidth: 2 },
  panel: { position: 'absolute', right: 12, bottom: 12, backgroundColor: PAPER, borderWidth: 2, borderColor: INK, boxShadow: `5px 5px 0px ${INK}`, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { flex: 1, fontFamily: font.black, fontSize: 20, color: INK, letterSpacing: -0.4 },
  close: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  label: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: '#5F5E66', marginTop: 16, marginBottom: 8 },
  labelSlim: { fontSize: 9.5, letterSpacing: 0.8, marginTop: 12, marginBottom: 6 },
  presets: { flexDirection: 'row', flexWrap: 'wrap' },
  preset: { borderWidth: 2, borderColor: 'transparent', justifyContent: 'center' },
  presetOn: { borderColor: INK },
  presetName: { fontFamily: font.bold, fontSize: 12, color: INK, marginTop: 4, marginLeft: 2 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 22 },
  trayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tray: { borderWidth: 2, borderColor: '#8A7F70', borderStyle: 'dashed', backgroundColor: '#F4ECDD', overflow: 'hidden' },
  trayDot: { position: 'absolute', left: 0 },
  iconBtn: { borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  saveBtn: { backgroundColor: palette.lime },
  msg: { fontFamily: font.bold, fontSize: 12, lineHeight: 17, color: '#B3261E', marginTop: 8 },
  hint: { fontFamily: font.mono, fontSize: 11, lineHeight: 16, color: '#5F5E66' },
  del: { position: 'absolute', top: 0, right: 2, borderWidth: 1.5, borderColor: INK, backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center' },
  holder: { borderColor: INK },
  addHolder: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  addText: { fontFamily: font.black, fontSize: 18, color: INK, lineHeight: 20 },
  textBtnLabel: { fontFamily: font.bold, fontSize: 13, color: INK, textDecorationLine: 'underline' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap' },
  swatch: { borderWidth: 1.5, borderColor: 'rgba(17,17,17,0.35)' },
  swatchOn: { borderWidth: 2.5, borderColor: INK },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, borderWidth: 2, borderColor: INK, borderRadius: 999, paddingHorizontal: 6, height: 42, backgroundColor: '#fff' },
  hexDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: INK },
  hex: { flex: 1, fontFamily: font.monoBold, fontSize: 14, color: INK },
  dirs: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dir: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 2, borderColor: INK, justifyContent: 'center' },
  dirOn: { backgroundColor: INK },
  dirText: { fontFamily: font.bold, fontSize: 12, color: INK },
  reset: { marginTop: 18, alignSelf: 'flex-start', height: 32, justifyContent: 'center' },
});
