/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Account tab

   Optional. NOT a wall (gast-first §1). Guests use the whole app without an
   account; an account is only needed for full audio or (later) bracelet
   activation. Hooks the EXISTING proven auth.ts (unchanged backend).
   Login + signup both present (bracelet will require an account — §1/§2).
   ─────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    clearSession,
    getToken,
    getUserEmail,
    login,
    signup,
} from '../../services/auth';

const C = {
  bg: '#0a0a0a',
  card: '#0d0d0d',
  border: '#1a1a1a',
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.5)',
  faint: 'rgba(255,255,255,0.32)',
  accent: '#3a8fff',
  bad: '#FF453A',
};

type Mode = 'login' | 'signup';

export default function AccountScreen() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('login');
  const [emailInput, setEmailInput] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) setEmail((await getUserEmail()) || 'Signed in');
      setLoading(false);
    })();
  }, []);

  const onSubmit = async () => {
    setMsg(null);
    if (!emailInput.trim() || !pwInput) {
      setMsg('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const fn = mode === 'login' ? login : signup;
      const r = await fn(emailInput.trim(), pwInput);
      if (r.ok) {
        setEmail(r.email || 'Signed in');
        setPwInput('');
      } else {
        setMsg(r.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    await clearSession();
    setEmail(null);
    setEmailInput('');
    setPwInput('');
  };

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  /* Signed-in view */
  if (email) {
    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.title}>Account</Text>
          <View style={s.card}>
            <Text style={s.label}>Signed in as</Text>
            <Text style={s.email}>{email}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.label}>Subscription</Text>
            <Text style={s.dimText}>
              Status syncs from your existing VIBEZCORE account. Entitlements
              (audio / bracelet) appear here once the access model backend is
              in place.
            </Text>
          </View>
          <View style={s.card}>
            <Text style={s.label}>Bracelet</Text>
            <Text style={s.dimText}>
              Bracelet activation (enter your code) opens after the
              Kickstarter launch on 1 August 2026.
            </Text>
          </View>
          <Pressable style={s.signOut} onPress={onSignOut}>
            <Text style={s.signOutText}>Sign out</Text>
          </Pressable>
          <Text style={s.legal}>
            [OPERATOR] Legal / disclaimer text from the web app to be placed
            here before launch.
          </Text>
        </ScrollView>
      </View>
    );
  }

  /* Signed-out view — optional auth, not a wall */
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>VIBEZCORE</Text>
        <Text style={s.subtitle}>
          {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
        </Text>
        <Text style={s.optional}>
          You don’t need an account to explore. Sign in for the full audio
          library or to activate a bracelet.
        </Text>

        <View style={s.toggleRow}>
          <Pressable
            style={[s.toggle, mode === 'login' && s.toggleActive]}
            onPress={() => {
              setMode('login');
              setMsg(null);
            }}
          >
            <Text
              style={[
                s.toggleText,
                mode === 'login' && s.toggleTextActive,
              ]}
            >
              Sign in
            </Text>
          </Pressable>
          <Pressable
            style={[s.toggle, mode === 'signup' && s.toggleActive]}
            onPress={() => {
              setMode('signup');
              setMsg(null);
            }}
          >
            <Text
              style={[
                s.toggleText,
                mode === 'signup' && s.toggleTextActive,
              ]}
            >
              Create account
            </Text>
          </Pressable>
        </View>

        <Text style={s.inputLabel}>Email</Text>
        <TextInput
          style={s.input}
          value={emailInput}
          onChangeText={setEmailInput}
          placeholder="you@example.com"
          placeholderTextColor={C.faint}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />

        <Text style={s.inputLabel}>Password</Text>
        <View style={s.pwWrap}>
          <TextInput
            style={[s.input, s.pwInput]}
            value={pwInput}
            onChangeText={setPwInput}
            placeholder="••••••••"
            placeholderTextColor={C.faint}
            secureTextEntry={!showPw}
            autoCapitalize="none"
          />
          <Pressable
            style={s.pwToggle}
            onPress={() => setShowPw((v: boolean) => !v)}
          >
            <Text style={s.pwToggleText}>{showPw ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        {msg && <Text style={s.msg}>{msg}</Text>}

        <Pressable
          style={[s.primaryBtn, busy && s.btnDisabled]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryBtnText}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Text style={s.legal}>
          [OPERATOR] Terms / Privacy text from the web app to be placed here
          before launch.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },
  title: {
    color: C.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
  },
  subtitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  optional: { color: C.dim, fontSize: 13, marginTop: 8, lineHeight: 20 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    marginTop: 22,
    marginBottom: 22,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 7,
  },
  toggleActive: { backgroundColor: 'rgba(255,255,255,0.07)' },
  toggleText: { color: C.dim, fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: C.text },
  inputLabel: {
    color: C.dim,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.text,
    fontSize: 15,
  },
  pwWrap: { position: 'relative', justifyContent: 'center' },
  pwInput: { paddingRight: 64 },
  pwToggle: { position: 'absolute', right: 12, padding: 6 },
  pwToggleText: { color: C.accent, fontSize: 13, fontWeight: '600' },
  msg: { color: C.bad, fontSize: 13, marginTop: 14 },
  primaryBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginTop: 14,
  },
  label: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  email: { color: C.text, fontSize: 16, fontWeight: '700' },
  dimText: { color: C.dim, fontSize: 13, lineHeight: 21 },
  signOut: {
    borderColor: 'rgba(255,69,58,0.4)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  signOutText: { color: C.bad, fontSize: 14, fontWeight: '700' },
  legal: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});