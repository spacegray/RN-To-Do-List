import { useEffect, useRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, type TextInputInstance } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Bouncy } from './Bouncy';
import { useTheme } from '../theme/useTheme';
import { font, radius, stroke, type } from '../theme/tokens';
import { useNotes } from '../store/notes';
import { useUI } from '../store/ui';
import { tapeToText } from '../lib/calc';
import { formatDue } from '../lib/parseTask';

function presets(now = new Date()) {
  const hour = new Date(now.getTime() + 3600000); hour.setSeconds(0, 0);
  const tonight = new Date(now); tonight.setHours(20, 0, 0, 0);
  if (tonight <= now) tonight.setDate(tonight.getDate() + 1);
  const morning = new Date(now); morning.setDate(morning.getDate() + 1); morning.setHours(9, 0, 0, 0);
  return [
    { label: 'In 1 hour', at: hour.getTime() },
    { label: tonight.getDate() === now.getDate() ? 'Tonight 8 pm' : 'Tomorrow 8 pm', at: tonight.getTime() },
    { label: 'Tomorrow 9 am', at: morning.getTime() },
  ];
}

/** Bottom sheet for writing a note, under a saved calculation if there is one. */
export function NoteEditor({ id }: { id: string }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const note = useNotes((s) => s.notes.find((n) => n.id === id));
  const { update, open, togglePin, setReminder, remove, undoRemove, pruneEmpty } = useNotes.getState();
  const showToast = useUI((s) => s.showToast);
  const titleRef = useRef<TextInputInstance>(null);
  const bodyRef = useRef<TextInputInstance>(null);

  // focus after the sheet has slid in (autoFocus during the animation is unreliable on the web)
  useEffect(() => {
    const t = setTimeout(() => {
      const n = useNotes.getState().notes.find((x) => x.id === id);
      if (!n) return;
      if (n.calc) bodyRef.current?.focus();
      else if (!n.title) titleRef.current?.focus();
    }, 380);
    return () => clearTimeout(t);
  }, [id]);

  const close = () => { pruneEmpty(id); open(null); };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!note) return null;
  const web = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close note" accessibilityRole="button" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(220)}
          style={[styles.sheet, { backgroundColor: c.card, borderColor: c.edge, paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={[styles.grabber, { backgroundColor: c.muted }]} />
          <View style={styles.top}>
            <Bouncy onPress={() => togglePin(id)} accessibilityRole="button" aria-pressed={note.pinned} style={[styles.small, { borderColor: c.edge, backgroundColor: note.pinned ? c.ink : c.card }]}>
              <Text style={[styles.smallText, { color: note.pinned ? c.inverseInk : c.ink }]}>{note.pinned ? 'Pinned' : 'Pin'}</Text>
            </Bouncy>
            <Bouncy onPress={() => { remove(id); showToast({ message: 'Note deleted', action: { label: 'Undo', run: undoRemove } }); }}
              accessibilityRole="button" style={[styles.small, { borderColor: c.edge }]}>
              <Text style={[styles.smallText, { color: c.danger }]}>Delete</Text>
            </Bouncy>
            <Bouncy onPress={close} accessibilityRole="button" accessibilityLabel="Done" style={[styles.small, { borderColor: c.edge, backgroundColor: c.lime, marginLeft: 'auto' }]}>
              <Text style={[styles.smallText, { color: c.onAccent }]}>Done</Text>
            </Bouncy>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
            <TextInput
              value={note.title}
              onChangeText={(title) => update(id, { title })}
              placeholder="Title"
              placeholderTextColor={c.muted}
              accessibilityLabel="Note title"
              ref={titleRef}
              style={[type.title, styles.title, { color: c.ink }, web]}
            />
            {note.calc ? (
              <View style={[styles.calc, { borderColor: c.edge, backgroundColor: c.bg }]}>
                <View style={styles.calcHead}>
                  <Text style={[type.label, { color: c.muted }]}>Saved from Calc</Text>
                  <Bouncy hitSlop={10} onPress={async () => { await Clipboard.setStringAsync(tapeToText(note.calc!)); showToast({ message: 'Calculation copied' }); }}
                    accessibilityRole="button" accessibilityLabel="Copy calculation">
                    <Text style={[type.label, { color: c.violet }]}>Copy</Text>
                  </Bouncy>
                </View>
                {note.calc.map((l, i) => (
                  <Text key={i} style={[styles.calcLine, { color: c.ink }]} selectable>{l.expr} = <Text style={{ fontFamily: font.monoBold }}>{l.result}</Text></Text>
                ))}
              </View>
            ) : null}
            <TextInput
              value={note.body}
              onChangeText={(body) => update(id, { body })}
              placeholder={note.calc ? 'Write a note under it…' : 'Write anything…'}
              placeholderTextColor={c.muted}
              multiline
              ref={bodyRef}
              accessibilityLabel="Note text"
              textAlignVertical="top"
              style={[styles.body, { color: c.ink }, web]}
            />

            <Text style={[type.label, { color: c.muted, marginTop: 8, marginBottom: 8 }]}>Reminder{note.reminder ? ` · ${formatDue(note.reminder)}` : ''}</Text>
            <View style={styles.chips}>
              {presets().map((p) => {
                const on = note.reminder === p.at;
                return (
                  <Bouncy key={p.label} onPress={() => { setReminder(id, p.at); showToast({ message: `Reminder set for ${formatDue(p.at)}`, tone: 'reminder' }); }}
                    accessibilityRole="button" aria-pressed={on}
                    style={[styles.chip, { borderColor: c.edge, backgroundColor: on ? c.lime : c.card }]}>
                    <Text style={[styles.smallText, { color: on ? c.onAccent : c.ink }]}>{p.label}</Text>
                  </Bouncy>
                );
              })}
              {note.reminder ? (
                <Bouncy onPress={() => setReminder(id, null)} accessibilityRole="button" style={[styles.chip, { borderColor: c.edge }]}>
                  <Text style={[styles.smallText, { color: c.danger }]}>Clear</Text>
                </Bouncy>
              ) : null}
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', borderWidth: stroke, borderBottomWidth: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, opacity: 0.5, marginBottom: 12 },
  top: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  small: { minHeight: 40, paddingHorizontal: 14, borderWidth: stroke, borderRadius: radius.pill, justifyContent: 'center' },
  smallText: { fontFamily: font.bold, fontSize: 13 },
  title: { paddingVertical: 8 },
  calc: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 12, marginVertical: 6 },
  calcHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calcLine: { fontFamily: font.mono, fontSize: 14, lineHeight: 22 },
  body: { fontFamily: font.medium, fontSize: 16, lineHeight: 23, minHeight: 130, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderWidth: stroke, borderRadius: radius.pill, justifyContent: 'center' },
});

/** Rendered once at the app root so the sheet and its scrim cover the tab bar. */
export function NoteEditorHost() {
  const id = useNotes((s) => s.editingId);
  return id ? <NoteEditor key={id} id={id} /> : null;
}
