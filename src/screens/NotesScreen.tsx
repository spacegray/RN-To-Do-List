import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View, type HostInstance } from "react-native";
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { Header } from '../components/Header';
import { Bouncy } from '../components/Bouncy';
import { useTourTarget } from '../components/tour';
import { useTheme } from '../theme/useTheme';
import { font, radius, stroke, type } from '../theme/tokens';
import { sortedNotes, useNotes, type Note } from '../store/notes';
import { formatDue } from '../lib/parseTask';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function NoteCard({ note, onOpen, tourRef }: { note: Note; onOpen: () => void; tourRef?: (n: HostInstance | null) => void }) {
  const c = useTheme();
  const when = new Date(note.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <Animated.View ref={tourRef} entering={FadeInDown.springify().damping(18)} exiting={FadeOutLeft.duration(180)} layout={LinearTransition.springify().damping(20)}>
      <Bouncy onPress={onOpen} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Open note ${note.title || 'Untitled'}`}
        style={[styles.card, { backgroundColor: c.card, borderColor: c.edge }]}>
        <View style={styles.cardTop}>
          <Text style={[type.title, { color: c.ink, fontSize: 18, flex: 1 }]} numberOfLines={1}>{note.title || 'Untitled'}</Text>
          {note.pinned ? <Text style={[type.label, { color: c.violet }]} accessibilityLabel="Pinned">Pinned</Text> : null}
        </View>
        <Text style={[type.label, { color: c.muted, textTransform: 'none', marginBottom: 8 }]}>{note.calc ? 'From Calc · ' : ''}{when}</Text>
        {note.calc ? (
          <View style={[styles.calc, { borderColor: c.edge, backgroundColor: c.bg }]}>
            {note.calc.slice(-3).map((l, i) => (
              <Text key={i} style={[styles.calcLine, { color: c.ink }]} numberOfLines={1}>{l.expr} = <Text style={{ fontFamily: font.monoBold }}>{l.result}</Text></Text>
            ))}
            {note.calc.length > 3 ? <Text style={[styles.calcLine, { color: c.muted }]}>+ {note.calc.length - 3} more</Text> : null}
          </View>
        ) : null}
        {note.body ? <Text style={[type.small, { color: c.ink, fontSize: 14, lineHeight: 20 }]} numberOfLines={3}>{note.body}</Text> : null}
        {note.reminder ? (
          <View style={[styles.rem, { backgroundColor: note.fired ? c.cardAlt : c.lime, borderColor: c.edge }]}>
            <Text style={[styles.remText, { color: note.fired ? c.muted : c.onAccent }]}>⏰ {formatDue(note.reminder)}</Text>
          </View>
        ) : null}
      </Bouncy>
    </Animated.View>
  );
}

export function NotesScreen() {
  const c = useTheme();
  const { notes, create, open } = useNotes(useShallow((s) => ({ notes: s.notes, create: s.create, open: s.open })));
  const [q, setQ] = useState('');
  const firstRef = useTourTarget("notes.first");

  const list = useMemo(() => {
    const sorted = sortedNotes(notes);
    const needle = fold(q.trim());
    if (!needle) return sorted;
    return sorted.filter((n) => fold([n.title, n.body, ...(n.calc ?? []).map((l) => `${l.expr} ${l.result}`)].join(' ')).includes(needle));
  }, [notes, q]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <Header label={`Notes · ${notes.length}`} title="Notes &" accent="reminders." />
        <View style={styles.pad}>
          <View style={styles.toolbar}>
            <TextInput
              ref={useTourTarget('notes.search')}
              value={q}
              onChangeText={setQ}
              placeholder="Search notes"
              placeholderTextColor={c.muted}
              accessibilityLabel="Search notes"
              style={[styles.search, { color: c.ink, borderColor: c.edge, backgroundColor: c.card }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
            />
            <Bouncy ref={useTourTarget('notes.new')} onPress={() => create()} accessibilityRole="button" accessibilityLabel="New note"
              style={[styles.newBtn, { backgroundColor: c.coral, borderColor: c.edge }]}>
              <Text style={[styles.newText, { color: c.onAccent }]}>+ New</Text>
            </Bouncy>
          </View>

          <View ref={useTourTarget('notes.list')} style={{ minHeight: 80 }}>
            {list.map((n, i) => (
              <NoteCard key={n.id} tourRef={i === 0 ? firstRef : undefined} note={n} onOpen={() => open(n.id)} />
            ))}
            {list.length === 0 ? (
              <View style={[styles.empty, { borderColor: c.muted }]}>
                <Text style={[type.title, { color: c.ink, textAlign: 'center' }]}>{q ? 'No matches' : 'No notes yet'}</Text>
                <Text style={[type.small, { color: c.muted, textAlign: 'center', marginTop: 6 }]}>
                  {q ? 'Try another word.' : 'Write one, or save a calculation from Calc.'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingTop: 16 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  search: { flex: 1, height: 48, borderWidth: stroke, borderRadius: radius.pill, paddingHorizontal: 18, fontFamily: font.medium, fontSize: 15 },
  newBtn: { height: 48, paddingHorizontal: 18, borderWidth: stroke, borderRadius: radius.pill, justifyContent: 'center' },
  newText: { fontFamily: font.black, fontSize: 15 },
  card: { borderWidth: stroke, borderRadius: radius.lg, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  calc: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8 },
  calcLine: { fontFamily: font.mono, fontSize: 12.5, lineHeight: 19 },
  rem: { alignSelf: 'flex-start', borderWidth: stroke, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  remText: { fontFamily: font.bold, fontSize: 12 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.lg, padding: 24 },
});
