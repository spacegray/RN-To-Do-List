import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOutDown, SlideInDown } from 'react-native-reanimated';
import { Bouncy } from './Bouncy';
import { useTheme } from '../theme/useTheme';
import { font, radius, stroke } from '../theme/tokens';
import { useUI } from "../store/ui";
import { useNotes } from "../store/notes";

/** One toast at a time, above the tab bar. Undo toasts stay a little longer. */
export function Toast({ bottom }: { bottom: number }) {
  const c = useTheme();
  const tab = useUI((s) => s.tab);
  const editing = useNotes((s) => s.editingId);
  const toast = useUI((s) => s.toast);
  const hide = useUI((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => hide(toast.id), toast.action ? 6000 : toast.tone === 'reminder' ? 8000 : 2800);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  const reminder = toast.tone === 'reminder';
  return (
    <Animated.View
      key={toast.id}
      entering={SlideInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(180)}
      style={[styles.wrap, editing ? { top: 56 } : { bottom: tab === "tasks" ? bottom + 66 : bottom }]}
      pointerEvents="box-none"
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: reminder ? c.lime : c.ink, borderColor: c.edge }]}
      >
        <Text style={[styles.text, { color: reminder ? c.onAccent : c.inverseInk }]}>{toast.message}</Text>
        {toast.action ? (
          <Bouncy onPress={() => { toast.action!.run(); hide(toast.id); }} accessibilityRole="button" hitSlop={8} style={[styles.btn, { backgroundColor: c.coral }]}>
            <Text style={[styles.btnText, { color: c.onAccent }]}>{toast.action.label}</Text>
          </Bouncy>
        ) : (
          <Bouncy onPress={() => hide(toast.id)} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} style={styles.x}>
            <Text style={[styles.btnText, { color: reminder ? c.onAccent : c.inverseInk }]}>✕</Text>
          </Bouncy>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: stroke, borderRadius: radius.pill, paddingLeft: 18, paddingRight: 6, minHeight: 50, maxWidth: 480, width: '100%' },
  text: { flex: 1, fontFamily: font.semibold, fontSize: 14, paddingVertical: 10 },
  btn: { borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' },
  btnText: { fontFamily: font.black, fontSize: 13 },
  x: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
