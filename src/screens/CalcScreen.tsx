import { useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useShallow } from 'zustand/react/shallow';
import { Header } from '../components/Header';
import { Bouncy } from '../components/Bouncy';
import { useTourTarget } from '../components/tour';
import { useTheme } from '../theme/useTheme';
import { font, radius, stroke, type } from '../theme/tokens';
import { useCalc } from '../store/calc';
import { useNotes } from '../store/notes';
import { useUI } from '../store/ui';
import { displayValue, pendingExpr, type CalcAction, type Op } from '../lib/calc';

type Key = { label: string; action: CalcAction; kind?: 'op' | 'eq' | 'fn'; a11y?: string };

const keys: Key[] = [
  { label: 'AC', action: { type: 'clear' }, kind: 'fn', a11y: 'All clear' },
  { label: '±', action: { type: 'negate' }, kind: 'fn', a11y: 'Plus minus' },
  { label: '%', action: { type: 'percent' }, kind: 'fn', a11y: 'Percent' },
  { label: '÷', action: { type: 'op', op: '÷' }, kind: 'op', a11y: 'Divide' },
  ...['7', '8', '9'].map((d) => ({ label: d, action: { type: 'digit', digit: d } as CalcAction })),
  { label: '×', action: { type: 'op', op: '×' }, kind: 'op', a11y: 'Multiply' },
  ...['4', '5', '6'].map((d) => ({ label: d, action: { type: 'digit', digit: d } as CalcAction })),
  { label: '−', action: { type: 'op', op: '−' }, kind: 'op', a11y: 'Minus' },
  ...['1', '2', '3'].map((d) => ({ label: d, action: { type: 'digit', digit: d } as CalcAction })),
  { label: '+', action: { type: 'op', op: '+' }, kind: 'op', a11y: 'Plus' },
  { label: '0', action: { type: 'digit', digit: '0' } },
  { label: '.', action: { type: 'decimal' }, a11y: 'Decimal point' },
  { label: '⌫', action: { type: 'backspace' }, a11y: 'Delete' },
  { label: '=', action: { type: 'equals' }, kind: 'eq', a11y: 'Equals' },
];

const keyMap: Record<string, CalcAction> = {
  '+': { type: 'op', op: '+' }, '-': { type: 'op', op: '−' }, '*': { type: 'op', op: '×' }, x: { type: 'op', op: '×' }, '/': { type: 'op', op: '÷' },
  Enter: { type: 'equals' }, '=': { type: 'equals' }, '.': { type: 'decimal' }, ',': { type: 'decimal' }, '%': { type: 'percent' },
  Backspace: { type: 'backspace' }, Escape: { type: 'clear' }, Delete: { type: 'clear' },
};

export function CalcScreen() {
  const c = useTheme();
  const state = useCalc(useShallow((s) => ({ tokens: s.tokens, entry: s.entry, tape: s.tape, error: s.error, justEvaluated: s.justEvaluated, past: s.past })));
  const dispatch = useCalc((s) => s.dispatch);
  const createNote = useNotes((s) => s.create);
  const setTab = useUI((s) => s.setTab);
  const showToast = useUI((s) => s.showToast);
  const tourOpen = useUI((s) => s.tourOpen);
  const tapeRef = useRef<ScrollViewInstance>(null);
  const compact = useWindowDimensions().height < 760;

  const value = displayValue({ ...state, past: [] });
  const expr = pendingExpr({ ...state, past: [] });
  const last = state.tape[state.tape.length - 1];

  // physical keyboard on the web
  useEffect(() => {
    if (Platform.OS !== 'web' || tourOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); dispatch({ type: 'undo' }); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a: CalcAction | undefined = /^\d$/.test(e.key) ? { type: 'digit', digit: e.key } : keyMap[e.key];
      if (a) { e.preventDefault(); dispatch(a); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, tourOpen]);

  const save = (all: boolean) => {
    if (!state.tape.length) return showToast({ message: 'Press = first. Saved results come from the tape.' });
    const lines = all ? state.tape : [last];
    createNote({ title: all ? 'Calculation' : `= ${last.result}`, calc: lines });
    setTab('notes');
    showToast({ message: all ? `Saved ${lines.length} ${lines.length === 1 ? 'line' : 'lines'} to a new note` : 'Saved the result to a new note' });
  };

  const copy = async () => {
    await Clipboard.setStringAsync(value.replace(/,/g, ''));
    showToast({ message: `Copied ${value}` });
  };

  const actions = [
    { label: 'Save result', onPress: () => save(false), primary: true, ref: 'calc.save', grow: 1.35 },
    { label: 'Save tape', onPress: () => save(true) },
    { label: 'Undo', onPress: () => dispatch({ type: 'undo' }), disabled: !state.past.length, ref: 'calc.undo' },
    { label: 'Copy', onPress: copy },
  ];

  const saveRef = useTourTarget('calc.save');
  const undoRef = useTourTarget('calc.undo');

  return (
    <View style={{ flex: 1 }}>
      <Header label="Calculator" />
      <View style={styles.pad}>
        <View ref={useTourTarget('calc.display')} style={[styles.display, compact && styles.displayCompact, { backgroundColor: c.card, borderColor: c.edge }]}>
          <ScrollView ref={tapeRef} style={[styles.tape, compact && { maxHeight: 40 }]} contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
            onContentSizeChange={() => tapeRef.current?.scrollToEnd({ animated: true })} accessibilityLabel="Calculation tape">
            {state.tape.length === 0 ? <Text style={[styles.tapeLine, { color: c.muted }]}>Your tape will appear here</Text> : null}
            {state.tape.slice(-20).map((l, i) => (
              <Animated.Text key={`${state.tape.length}-${i}`} entering={FadeInUp.duration(200)} style={[styles.tapeLine, { color: c.muted }]} numberOfLines={1}>
                {l.expr} = <Text style={{ color: c.ink }}>{l.result}</Text>
              </Animated.Text>
            ))}
          </ScrollView>
          <Text style={[styles.expr, { color: c.violet }]} numberOfLines={1}>{expr || ' '}</Text>
          <Animated.Text
            key={value}
            entering={FadeInDown.duration(140)}
            style={[styles.value, { color: state.error ? c.danger : c.ink, fontSize: (value.length > 12 ? 34 : value.length > 9 ? 42 : 52) - (compact ? 8 : 0) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Display ${value}`}
          >
            {value}
          </Animated.Text>
          {state.tape.length > 0 ? (
            <Bouncy onPress={() => dispatch({ type: 'clearTape' })} accessibilityRole="button" accessibilityLabel="Clear tape" style={styles.clearTape} hitSlop={8}>
              <Text style={[type.label, { color: c.muted }]}>Clear tape</Text>
            </Bouncy>
          ) : null}
        </View>

        <View style={styles.actions}>
          {actions.map((a) => (
            <Bouncy
              key={a.label}
              ref={a.ref === 'calc.save' ? saveRef : a.ref === 'calc.undo' ? undoRef : undefined}
              onPress={a.onPress}
              disabled={a.disabled}
              accessibilityRole="button"
              aria-disabled={!!a.disabled}
              style={[styles.action, { flexGrow: (a as { grow?: number }).grow ?? 1 }, { borderColor: c.edge, backgroundColor: a.primary ? c.lime : c.card, opacity: a.disabled ? 0.4 : 1 }]}
            >
              <Text style={[styles.actionText, { color: a.primary ? c.onAccent : c.ink }]} numberOfLines={1} adjustsFontSizeToFit>{a.label}</Text>
            </Bouncy>
          ))}
        </View>

        <Animated.View ref={useTourTarget("calc.keys")} layout={LinearTransition} style={styles.keys}>
          {[0, 1, 2, 3, 4].map((row) => (
          <View key={row} style={styles.keyRow}>
          {keys.slice(row * 4, row * 4 + 4).map((k) => {
            const isOp = k.kind === 'op';
            const active = isOp && state.entry === '' && state.tokens.length > 0 && (state.tokens[state.tokens.length - 1] as { value: Op }).value === (k.action as { op: Op }).op;
            const content = <Text style={[styles.keyText, { color: k.kind === 'eq' ? '#fff' : isOp ? c.onAccent : c.ink }]}>{k.label}</Text>;
            return (
              <Bouncy
                key={k.label}
                accessibilityRole="button"
                accessibilityLabel={k.a11y ?? k.label}
                aria-pressed={active}
                onPress={() => dispatch(k.action)}
                onLongPress={k.label === '⌫' ? () => dispatch({ type: 'clear' }) : undefined}
                scaleTo={0.9}
                style={[styles.key, {
                  borderColor: c.edge,
                  backgroundColor: isOp ? (active ? c.lime : c.pink) : k.kind === 'fn' ? c.cardAlt : c.card,
                }]}
              >
                {k.kind === 'eq' ? (
                  <LinearGradient colors={[c.violet, c.coral]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.eq}>{content}</LinearGradient>
                ) : content}
              </Bouncy>
            );
          })}
          </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingTop: 14, flex: 1, paddingBottom: 16 },
  display: { borderWidth: stroke, borderRadius: radius.lg, padding: 16, paddingTop: 12, minHeight: 170 },
  displayCompact: { minHeight: 0, paddingVertical: 10 },
  tape: { maxHeight: 74 },
  tapeLine: { fontFamily: font.mono, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  expr: { fontFamily: font.monoBold, fontSize: 14, textAlign: 'right', marginTop: 4, minHeight: 18 },
  value: { fontFamily: font.black, textAlign: 'right', letterSpacing: -1.5, marginTop: 2 },
  clearTape: { position: 'absolute', left: 16, top: 12, minHeight: 24, justifyContent: 'center' },
  actions: { flexDirection: "row", gap: 6, marginVertical: 10 },
  action: { flexGrow: 1, flexBasis: 0, minHeight: 44, borderWidth: stroke, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  actionText: { fontFamily: font.bold, fontSize: 12 },
  keys: { flex: 1, gap: 9, maxHeight: 420 },
  keyRow: { flex: 1, flexDirection: "row", gap: 9, maxHeight: 76, minHeight: 46 },
  key: { flex: 1, borderWidth: stroke, borderRadius: radius.md + 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  keyText: { fontFamily: font.bold, fontSize: 22 },
  eq: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
