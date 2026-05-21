/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Account tab

   Optional. NOT a wall (gast-first §1). Guests use the whole app without an
   account; an account is only needed for full audio or (later) bracelet
   activation. Hooks the EXISTING proven auth.ts (unchanged backend).
   Login + signup both present (bracelet will require an account — §1/§2).

   Uiterlijk: MERK_ANKER — Brand-palet, Inter via _layout, wordmark in
   signed-out header (vervangt platte tekst "VIBEZCORE").
   ─────────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { useSetting } from '@/utils/settings';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
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

type Mode = 'login' | 'signup';

/* Playback-settings card. Beschikbaar voor zowel signed-in als signed-out
   users — een setting heeft geen account nodig. Vandaag is autoPlayNext
   de enige toggle; nieuwe settings (sleep-default, default-rate) komen
   in dezelfde card. */
function PlaybackSettingsCard() {
  const [autoPlayNext, setAutoPlayNext] = useSetting('autoPlayNext');
  return (
    <View style={s.card}>
      <Text style={s.label}>Playback</Text>
      <View style={s.toggleRow2}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={s.toggleTitle}>Auto-play next session</Text>
          <Text style={s.toggleSub}>
            Automatically play the next session in the series when one ends.
          </Text>
        </View>
        <Switch
          value={autoPlayNext}
          onValueChange={setAutoPlayNext}
          trackColor={{ true: Brand.accent, false: '#2a2a2a' }}
          thumbColor={'#ffffff'}
        />
      </View>
    </View>
  );
}

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
        <ActivityIndicator color={Brand.text} />
      </View>
    );
  }

  /* Signed-in view */
  if (email) {
    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.screenTitle}>Account</Text>
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
          <PlaybackSettingsCard />
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
        <Image
          source={require('../../../assets/vibezcore_wordmark.png')}
          style={s.wordmark}
          resizeMode="contain"
          accessibilityLabel="VIBEZCORE"
        />
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
          placeholderTextColor={Brand.textDim}
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
            placeholderTextColor={Brand.textDim}
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
            <ActivityIndicator color={Brand.text} />
          ) : (
            <Text style={s.primaryBtnText}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <PlaybackSettingsCard />

        <Text style={s.legal}>
          [OPERATOR] Terms / Privacy text from the web app to be placed here
          before launch.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },
  wordmark: {
    width: 200,
    height: 34,
    marginTop: 12,
    marginBottom: 4,
  },
  screenTitle: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: 1,
    marginTop: 12,
  },
  subtitle: {
    color: Brand.text,
    fontSize: 20,
    fontFamily: BrandFonts.bold,
    marginTop: 8,
  },
  optional: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 8,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
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
  toggleActive: { backgroundColor: 'rgba(244,244,244,0.07)' },
  toggleText: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  toggleTextActive: { color: Brand.text },
  inputLabel: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: Brand.text,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
  },
  pwWrap: { position: 'relative', justifyContent: 'center' },
  pwInput: { paddingRight: 64 },
  pwToggle: { position: 'absolute', right: 12, padding: 6 },
  pwToggleText: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
  },
  msg: {
    color: Brand.error,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 14,
  },
  primaryBtn: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  primaryBtnText: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
  },
  btnDisabled: { opacity: 0.5 },
  card: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginTop: 14,
  },
  label: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  email: {
    color: Brand.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  dimText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
  },
  signOut: {
    borderColor: 'rgba(239,68,68,0.4)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  signOutText: {
    color: Brand.error,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
  },
  legal: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
    lineHeight: 16,
    opacity: 0.6,
  },

  /* Playback-card row — naast bestaande s.toggleRow (Sign in/Create
     account) gemikt; vandaar de _2-suffix om confusion te vermijden. */
  toggleRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  toggleTitle: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  toggleSub: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 17,
    marginTop: 4,
  },
});
