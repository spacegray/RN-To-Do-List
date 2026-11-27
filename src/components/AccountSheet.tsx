import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouncy } from './Bouncy';
import { Close, LogOut, Mail, Pencil } from './Icons';
import { useTheme } from '../theme/useTheme';
import { font, radius, stroke, type } from '../theme/tokens';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { cleanCode, initials, isEmail } from '../lib/authText';

const CODE = 6;
const RESEND_AFTER = 60_000;
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/** Initials in a lime circle: the toolbar's account button when signed in, and the account sheet's header. */
export function Avatar({ size = 40 }: { size?: number }) {
  const c = useTheme();
  const profile = useAuth((s) => s.profile);
  const email = useAuth((s) => s.session?.user.email);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: c.edge, backgroundColor: c.lime }]}>
      <Text style={[styles.avatarText, { color: c.onAccent, fontSize: size * 0.36 }]}>{initials(profile?.display_name, email)}</Text>
    </View>
  );
}

function SignIn() {
  const c = useTheme();
  const { sendCode, busy, error, closeSheet } = useAuth();
  const [email, setEmail] = useState(useAuth.getState().email);
  const [touched, setTouched] = useState(false);
  const valid = isEmail(email);
  const submit = () => { setTouched(true); if (valid && !busy) void sendCode(email); };

  return (
    <>
      <Text style={[type.title, { color: c.ink }]} accessibilityRole="header">Take your lists anywhere</Text>
      <Text style={[styles.sub, { color: c.muted }]}>Sign in to save your tasks, notes and colours. No password needed.</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={submit}
        placeholder="you@example.com"
        placeholderTextColor={c.muted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        accessibilityLabel="Email address"
        autoFocus
        style={[styles.field, { color: c.ink, borderColor: c.edge, backgroundColor: c.card }, noOutline]}
      />
      {touched && !valid ? <Text style={[styles.msg, { color: c.danger }]} accessibilityLiveRegion="polite">Enter an email address like you@example.com.</Text> : null}
      {error ? <Text style={[styles.msg, { color: c.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Bouncy accessibilityRole="button" aria-disabled={busy} onPress={submit} style={[styles.primary, { borderColor: c.edge, backgroundColor: c.lime }]}>
        <Mail size={18} color={c.onAccent} />
        <Text style={[styles.primaryText, { color: c.onAccent }]}>{busy ? 'Sending…' : 'Email me a sign-in link'}</Text>
      </Bouncy>
      <Bouncy accessibilityRole="button" onPress={closeSheet} hitSlop={8} style={styles.link}>
        <Text style={[styles.linkText, { color: c.ink }]}>Keep using without an account</Text>
      </Bouncy>
    </>
  );
}

function CodeStep() {
  const c = useTheme();
  const { email, sentAt, busy, error, verifyCode, sendCode, backToEmail } = useAuth();
  const [code, setCode] = useState('');
  const [now, setNow] = useState(sentAt ?? 0); // ticks every second below
  const input = useRef<TextInputInstance>(null);
  const wait = Math.max(0, RESEND_AFTER - (now - (sentAt ?? 0)));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const change = (text: string) => {
    const next = cleanCode(text, CODE);
    setCode(next);
    if (next.length === CODE && !busy) void verifyCode(next).then((ok) => { if (!ok) setCode(''); });
  };
  const submit = () => { if (code.length === CODE && !busy) void verifyCode(code).then((ok) => { if (!ok) setCode(''); }); };

  return (
    <>
      <Text style={[type.title, { color: c.ink }]} accessibilityRole="header">Check your email</Text>
      <Text style={[styles.sub, { color: c.muted }]}>
        We sent a link and a code to <Text style={{ color: c.ink, fontFamily: font.bold }}>{email}</Text>. Open the link here, or type the code.
      </Text>
      <Pressable onPress={() => input.current?.focus()} accessible={false} style={styles.codeRow}>
        {Array.from({ length: CODE }, (_, i) => {
          const active = i === Math.min(code.length, CODE - 1);
          return (
            <View key={i} style={[styles.codeBox, { borderColor: c.edge, backgroundColor: c.card }, active && { borderColor: c.violet, borderWidth: 3 }]}>
              <Text style={[styles.codeDigit, { color: c.ink }]}>{code[i] ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          ref={input}
          value={code}
          onChangeText={change}
          onSubmitEditing={submit}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE + 4}
          autoFocus
          caretHidden
          accessibilityLabel={`Sign-in code, ${CODE} digits`}
          style={[StyleSheet.absoluteFill, styles.codeInput, noOutline]}
        />
      </Pressable>
      {error ? <Text style={[styles.msg, { color: c.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Bouncy accessibilityRole="button" aria-disabled={busy || code.length < CODE} onPress={submit}
        style={[styles.primary, { borderColor: c.edge, backgroundColor: c.lime, opacity: code.length < CODE ? 0.6 : 1 }]}>
        <Text style={[styles.primaryText, { color: c.onAccent }]}>{busy ? 'Checking…' : 'Sign in'}</Text>
      </Bouncy>
      <View style={styles.row}>
        {wait > 0 ? (
          <Text style={[styles.small, { color: c.muted }]}>Resend in 0:{String(Math.ceil(wait / 1000)).padStart(2, '0')}</Text>
        ) : (
          <Bouncy accessibilityRole="button" hitSlop={8} onPress={() => { setCode(''); void sendCode(email); }}>
            <Text style={[styles.small, styles.underline, { color: c.ink }]}>Send a new code</Text>
          </Bouncy>
        )}
        <Bouncy accessibilityRole="button" hitSlop={8} onPress={backToEmail}>
          <Text style={[styles.small, styles.underline, { color: c.ink }]}>Use a different email</Text>
        </Bouncy>
      </View>
    </>
  );
}

function Account() {
  const c = useTheme();
  const { profile, session, rename, signOut, busy, error } = useAuth();
  const showToast = useUI((s) => s.showToast);
  const saved = profile?.display_name ?? '';
  const [name, setName] = useState(saved);
  // the profile arrives (or changes) after the sheet opens: follow it
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) { setSeen(saved); setName(saved); }
  const nameRef = useRef<TextInputInstance>(null);
  const save = () => { if ((profile?.display_name ?? '') !== name.trim()) void rename(name); };

  return (
    <>
      <View style={styles.who}>
        <Avatar size={48} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <TextInput
              ref={nameRef}
              value={name}
              onChangeText={setName}
              onBlur={save}
              onSubmitEditing={save}
              placeholder="Add your name"
              placeholderTextColor={c.muted}
              maxLength={80}
              returnKeyType="done"
              accessibilityLabel="Your name"
              style={[styles.name, { color: c.ink }, noOutline]}
            />
            <Bouncy accessibilityRole="button" accessibilityLabel="Edit your name" hitSlop={10} onPress={() => nameRef.current?.focus()}>
              <Pencil size={15} color={c.muted} />
            </Bouncy>
          </View>
          <Text style={[styles.small, { color: c.muted }]} numberOfLines={1}>{session?.user.email}</Text>
        </View>
      </View>
      {error ? <Text style={[styles.msg, { color: c.danger }]}>{error}</Text> : null}
      <View style={[styles.note, { borderColor: c.muted }]}>
        <Text style={[styles.small, { color: c.muted }]}>Saving your tasks and notes to your account starts with the next update.</Text>
      </View>
      <Bouncy accessibilityRole="button" aria-disabled={busy}
        onPress={() => { void signOut().then(() => showToast({ message: 'Signed out. Everything is still on this device.' })); }}
        style={[styles.primary, { borderColor: c.edge, backgroundColor: c.card }]}>
        <LogOut size={18} color={c.ink} />
        <Text style={[styles.primaryText, { color: c.ink }]}>Sign out</Text>
      </Bouncy>
      <Text style={[styles.small, { color: c.muted, marginTop: 10 }]}>Signing out keeps everything on this device.</Text>
    </>
  );
}

function Sheet() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = useAuth((s) => s.sheet);
  const close = useAuth((s) => s.closeSheet);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(220)}
          style={[styles.sheet, { backgroundColor: c.card, borderColor: c.edge, paddingBottom: Math.max(insets.bottom, 20) }]}
        >
          <View style={[styles.grabber, { backgroundColor: c.muted }]} />
          <Bouncy accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={close} style={[styles.close, { borderColor: c.edge }]}>
            <Close size={16} color={c.ink} />
          </Bouncy>
          {sheet === 'signin' ? <SignIn /> : sheet === 'code' ? <CodeStep /> : <Account />}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Rendered once at the app root, above the tab bar. */
export function AccountSheetHost() {
  const sheet = useAuth((s) => s.sheet);
  return sheet === 'closed' ? null : <Sheet />;
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', borderWidth: stroke, borderBottomWidth: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, opacity: 0.5, marginBottom: 14 },
  close: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, borderWidth: stroke, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  sub: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 16, paddingRight: 30 },
  field: { height: 50, borderWidth: stroke, borderRadius: radius.pill, paddingHorizontal: 18, fontFamily: font.medium, fontSize: 16 },
  msg: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, marginTop: 8 },
  primary: { minHeight: 50, marginTop: 12, borderWidth: stroke, borderRadius: radius.pill, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { fontFamily: font.bold, fontSize: 15 },
  link: { alignSelf: 'center', marginTop: 14, paddingVertical: 4 },
  linkText: { fontFamily: font.bold, fontSize: 14, textDecorationLine: 'underline' },
  codeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 4 },
  codeBox: { width: 44, height: 54, borderWidth: stroke, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  codeDigit: { fontFamily: font.black, fontSize: 24 },
  codeInput: { opacity: 0.02, color: 'transparent', fontSize: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  small: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  underline: { textDecorationLine: 'underline', fontFamily: font.bold },
  who: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingRight: 40 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: font.black, fontSize: 18, paddingVertical: 2 },
  note: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 12, marginTop: 16, marginBottom: 2 },
  avatar: { borderWidth: stroke, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.black },
});
