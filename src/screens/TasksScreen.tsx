import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useShallow } from 'zustand/react/shallow';
import { Header } from '../components/Header';
import { Bouncy } from '../components/Bouncy';
import { TaskItem } from '../components/TaskItem';
import { useTourTarget } from '../components/tour';
import { useTheme } from '../theme/useTheme';
import { font, motion, radius, stroke, type } from '../theme/tokens';
import { useTasks, visibleTasks, isToday, type TaskFilter } from '../store/tasks';
import { useUI } from '../store/ui';
import { formatDue, parseTask } from '../lib/parseTask';
import { useNow } from "../lib/useNow";

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Up late.' : h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.';
}

function Progress({ value }: { value: number }) {
  const c = useTheme();
  const v = useSharedValue(0);
  const [w, setW] = useState(0);
  useEffect(() => { v.value = withSpring(value, motion.spring); }, [value, v]);
  const fill = useAnimatedStyle(() => ({ width: Math.max(0, v.value * (w - 4)) }));
  return (
    <View
      ref={useTourTarget('tasks.progress')}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[styles.track, { borderColor: c.edge, backgroundColor: c.card }]}
    >
      <Animated.View style={[styles.fill, fill]}>
        <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

export function TasksScreen() {
  const c = useTheme();
  const { tasks, filter, add, toggle, remove, rename, cyclePriority, setFilter, undoRemove, clearDone } = useTasks(
    useShallow((s) => ({ tasks: s.tasks, filter: s.filter, add: s.add, toggle: s.toggle, remove: s.remove, rename: s.rename, cyclePriority: s.cyclePriority, setFilter: s.setFilter, undoRemove: s.undoRemove, clearDone: s.clearDone })),
  );
  const showToast = useUI((s) => s.showToast);
  const [text, setText] = useState('');
  const firstRef = useTourTarget("tasks.first");
  const now = useNow();

  const list = useMemo(() => visibleTasks(tasks, filter, now), [tasks, filter, now]);
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const todayCount = tasks.filter((t) => !t.done && (isToday(t.due) || (t.due !== null && t.due < now))).length;
  const preview = text.trim() ? parseTask(text) : null;
  const hasExtras = preview && (preview.due || preview.tag || preview.priority === 'high');

  const submit = () => {
    const t = add(text);
    if (!t) return;
    setText('');
    if (filter === 'done') setFilter('all');
  };

  const onDelete = useCallback((id: string) => {
    remove(id);
    showToast({ message: 'Task deleted', action: { label: 'Undo', run: undoRemove } });
  }, [remove, showToast, undoRemove]);

  const filters: { key: TaskFilter; label: string }[] = [
    { key: 'all', label: `All ${total}` },
    { key: 'today', label: `Today ${todayCount}` },
    { key: 'done', label: `Done ${done}` },
  ];

  const headline = total === 0 ? 'A clean slate.' : done === total ? 'All done.' : `${done} of ${total} done.`;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Header label={new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} title={greeting()} accent={headline} />
        <View style={styles.pad}>
          <Progress value={total ? done / total : 0} />
          <View ref={useTourTarget('tasks.filters')} style={styles.chips} accessibilityRole="radiogroup">
            {filters.map((f) => {
              const on = f.key === filter;
              return (
                <Bouncy key={f.key} accessibilityRole="radio" accessibilityLabel={f.label} aria-checked={on} onPress={() => setFilter(f.key)}
                  style={[styles.chip, { borderColor: c.edge, backgroundColor: on ? c.ink : c.card }]}>
                  <Text style={[styles.chipText, { color: on ? c.inverseInk : c.ink }]}>{f.label}</Text>
                </Bouncy>
              );
            })}
            {filter === 'done' && done > 0 ? (
              <Bouncy onPress={() => { const n = clearDone(); showToast({ message: `Cleared ${n} finished ${n === 1 ? 'task' : 'tasks'}` }); }}
                accessibilityRole="button" style={[styles.chip, { borderColor: c.edge, marginLeft: 'auto' }]}>
                <Text style={[styles.chipText, { color: c.danger }]}>Clear</Text>
              </Bouncy>
            ) : null}
          </View>

          <View ref={useTourTarget('tasks.list')} style={{ minHeight: 60 }}>
            {list.map((t, i) => (
              <TaskItem key={t.id} now={now} tourRef={i === 0 ? firstRef : undefined} task={t} onToggle={toggle} onDelete={onDelete} onRename={rename} onPriority={cyclePriority} />
            ))}
            {list.length === 0 ? (
              <Animated.View entering={FadeIn} style={[styles.empty, { borderColor: c.muted }]}>
                <Text style={[type.title, { color: c.ink, textAlign: 'center' }]}>
                  {filter === 'done' ? 'Nothing finished yet' : filter === 'today' ? 'Nothing due today' : 'No tasks yet'}
                </Text>
                <Text style={[type.small, { color: c.muted, textAlign: 'center', marginTop: 6 }]}>
                  {filter === 'done' ? 'Checked-off tasks will land here.' : 'Add one below. Try "Water plants tonight".'}
                </Text>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={styles.composerWrap}>
        {hasExtras ? (
          <Animated.View entering={FadeIn.duration(motion.fast)} exiting={FadeOut.duration(motion.fast)} style={[styles.preview, { backgroundColor: c.lime, borderColor: c.edge }]}>
            <Text style={[styles.previewText, { color: c.onAccent }]} numberOfLines={1} accessibilityLiveRegion="polite">
              {[preview!.due ? `⏰ ${formatDue(preview!.due)}` : null, preview!.tag ? `#${preview!.tag}` : null, preview!.priority === 'high' ? 'High priority' : null].filter(Boolean).join('  ·  ')}
            </Text>
          </Animated.View>
        ) : null}
        <View ref={useTourTarget('tasks.composer')} style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder='Add a task… try "call mom 5pm"'
            placeholderTextColor={c.muted}
            returnKeyType="done"
            submitBehavior="submit"
            accessibilityLabel="New task"
            style={[styles.input, { color: c.ink, borderColor: c.edge, backgroundColor: c.card }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          />
          <Bouncy
            accessibilityRole="button"
            accessibilityLabel="Add task"
            aria-disabled={!text.trim()}
            onPress={submit}
            style={[styles.add, { backgroundColor: text.trim() ? c.coral : c.cardAlt, borderColor: c.edge }]}
          >
            <Text style={[styles.plus, { color: c.onAccent }]}>+</Text>
          </Bouncy>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120 },
  pad: { paddingHorizontal: 20 },
  track: { height: 14, borderWidth: stroke, borderRadius: radius.pill, marginTop: 16, overflow: 'hidden', padding: 0 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill, overflow: 'hidden' },
  chips: { flexDirection: 'row', gap: 8, marginVertical: 16, flexWrap: 'wrap' },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: stroke, justifyContent: 'center' },
  chipText: { fontFamily: font.bold, fontSize: 13 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.lg, padding: 24, marginTop: 4 },
  composerWrap: { position: 'absolute', left: 20, right: 20, bottom: 12 },
  preview: { alignSelf: 'flex-start', borderWidth: stroke, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8, marginLeft: 6 },
  previewText: { fontFamily: font.bold, fontSize: 12 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, height: 54, borderWidth: stroke, borderRadius: radius.pill, paddingHorizontal: 18, fontFamily: font.medium, fontSize: 15 },
  add: { width: 54, height: 54, borderRadius: 27, borderWidth: stroke, alignItems: 'center', justifyContent: 'center' },
  plus: { fontFamily: font.black, fontSize: 28, lineHeight: 30 },
});
