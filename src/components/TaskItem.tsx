import { memo, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type HostInstance } from "react-native";
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Bouncy } from './Bouncy';
import { Pencil, Trash } from './Icons';
import { useTheme } from '../theme/useTheme';
import { font, motion, radius, stroke, type } from '../theme/tokens';
import { formatDue } from '../lib/parseTask';
import type { Task } from '../store/tasks';

const SWIPE_DELETE = -110;

type Props = {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPriority: (id: string) => void;
  tourRef?: (n: HostInstance | null) => void;
  now: number;
};

function Check({ done }: { done: boolean }) {
  const c = useTheme();
  const s = useSharedValue(done ? 1 : 0);
  useEffect(() => { s.value = withSpring(done ? 1 : 0, motion.spring); }, [done, s]);
  const fill = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scale: interpolate(s.value, [0, 1], [0.4, 1]) }] }));
  return (
    <View style={[styles.check, { borderColor: c.edge }]}>
      <Animated.View style={[StyleSheet.absoluteFill, fill]} aria-hidden>
        <LinearGradient colors={[c.violet, c.coral]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.checkFill}>
          <Text style={styles.tick}>✓</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

export const TaskItem = memo(function TaskItem({ task, onToggle, onDelete, onRename, onPriority, tourRef, now }: Props) {
  const c = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const x = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .enabled(!editing)
    .onUpdate((e) => { x.value = Math.min(0, e.translationX); })
    .onEnd((e) => {
      if (x.value < SWIPE_DELETE || e.velocityX < -900) {
        x.value = withTiming(-600, { duration: 180 }, (f) => { if (f) scheduleOnRN(onDelete, task.id); });
      } else {
        x.value = withSpring(0, motion.spring);
      }
    });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const under = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, SWIPE_DELETE], [0, 1], 'clamp') }));

  const priColor = task.priority === 'high' ? c.coral : task.priority === 'low' ? c.lime : c.pink;
  const meta = [task.due ? `⏰ ${formatDue(task.due)}` : null, task.tag ? `#${task.tag}` : null].filter(Boolean).join('  ·  ');
  const overdue = !task.done && task.due !== null && task.due < now;

  const commit = () => { setEditing(false); if (draft.trim() && draft.trim() !== task.title) onRename(task.id, draft); else setDraft(task.title); };

  return (
    <Animated.View ref={tourRef} entering={FadeInDown.springify().damping(18)} exiting={FadeOutLeft.duration(200)} layout={LinearTransition.springify().damping(20)} style={styles.outer}>
      <Animated.View style={[styles.under, { backgroundColor: c.danger }, under]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <Text style={styles.underText}>Delete</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, { backgroundColor: c.card, borderColor: c.edge, opacity: task.done ? 0.6 : 1 }, row]}>
          <Bouncy
            accessibilityRole="checkbox"
            aria-checked={task.done}
            accessibilityLabel={task.title}
            accessibilityHint={task.done ? 'Marks the task as not done' : 'Marks the task as done'}
            onPress={() => onToggle(task.id)}
            hitSlop={10}
            scaleTo={0.85}
          >
            <Check done={task.done} />
          </Bouncy>

          <Pressable
            style={styles.body}
            onLongPress={() => { setDraft(task.title); setEditing(true); }}
            accessibilityRole="button"
            accessibilityLabel={`${task.title}${meta ? ", " + meta : ""}`}
            accessibilityHint="Long press to edit the text"
            accessibilityActions={[{ name: 'longpress', label: 'Edit' }, { name: 'delete', label: 'Delete' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'delete') onDelete(task.id);
              else setEditing(true);
            }}
          >
            {editing ? (
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onBlur={commit}
                onSubmitEditing={commit}
                autoFocus
                returnKeyType="done"
                accessibilityLabel="Task name"
                style={[type.body, styles.input, { color: c.ink, borderColor: c.violet }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
              />
            ) : (
              <Text style={[type.body, { color: c.ink, textDecorationLine: task.done ? 'line-through' : 'none' }]} numberOfLines={3}>
                {task.title}
              </Text>
            )}
            {meta ? <Text style={[type.label, { color: overdue ? c.danger : c.muted, textTransform: 'none', marginTop: 3 }]}>{overdue ? 'Overdue · ' : ''}{meta}</Text> : null}
          </Pressable>

          <Bouncy
            accessibilityRole="button"
            accessibilityLabel={`Priority ${task.priority}. Change priority`}
            onPress={() => onPriority(task.id)}
            hitSlop={8}
            style={styles.priHit}
          >
            <View style={[styles.pri, { backgroundColor: priColor, borderColor: c.edge }]} />
          </Bouncy>

          <Bouncy
            accessibilityRole="button"
            accessibilityLabel={`Edit ${task.title}`}
            onPress={() => { setDraft(task.title); setEditing(true); }}
            hitSlop={8}
            style={[styles.tool, { borderColor: c.edge, backgroundColor: c.card }]}
          >
            <Pencil size={13} color={c.ink} />
          </Bouncy>
          <Bouncy
            accessibilityRole="button"
            accessibilityLabel={`Delete ${task.title}`}
            onPress={() => onDelete(task.id)}
            hitSlop={8}
            style={[styles.tool, { borderColor: c.edge, backgroundColor: c.card }]}
          >
            <Trash size={13} color={c.danger} />
          </Bouncy>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  outer: { marginBottom: 10, overflow: 'hidden', borderRadius: radius.md + 2 },
  under: { ...StyleSheet.absoluteFill, borderRadius: radius.md + 2, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 20 },
  underText: { color: '#fff', fontFamily: font.bold, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: stroke, borderRadius: radius.md + 2, paddingVertical: 12, paddingLeft: 12, paddingRight: 10, minHeight: 60 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: stroke, overflow: 'hidden' },
  checkFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 15, fontFamily: font.black, lineHeight: 18 },
  body: { flex: 1, minHeight: 36, justifyContent: 'center' },
  input: { borderBottomWidth: 2, paddingVertical: 2 },
  priHit: { width: 24, height: 44, alignItems: 'center', justifyContent: 'center' },
  tool: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pri: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
});
