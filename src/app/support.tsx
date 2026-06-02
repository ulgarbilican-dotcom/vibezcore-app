/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — In-app support form
   Iter 9dp (2026-06-02)

   Verstuurt support-berichten direct via de backend: POST /api/support.
   Backend (Netlify function) gebruikt Zoho SMTP en e-mailt het bericht
   naar info@vibezcore.com met Reply-To = de user's eigen e-mail. User
   klikt één keer Send en is klaar — geen externe mail-app nodig.

   Velden:
     - Category (verplicht, picker)
     - Subject (verplicht)
     - Message (verplicht, multiline)
     - From-email (vooringevuld uit getUserEmail() — user kan overschrijven)

   FALLBACK (graceful degradation):
   Als de backend onbereikbaar is (geen netwerk, server down, 5xx-error),
   valt de form terug op een mailto-flow: probeert eerst de native
   email-app, en als die er niet is, biedt Gmail-web als 3e optie aan.
   User loopt nooit echt vast.

   GEEN AUTH VEREIST: anonieme gasten moeten ook support kunnen mailen
   (bv. user die niet kan inloggen heeft juist hulp nodig). Backend
   beschermt zich via input-size limieten en Zoho's SMTP-throughput.
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { getUserEmail, VZ_BACKEND_URL } from '@/services/auth';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SUPPORT_EMAIL = 'info@vibezcore.com';
const SUPPORT_ENDPOINT = `${VZ_BACKEND_URL}/api/support`;

/* Categorie-lijst — geselecteerde label wordt prepended op de email-
   subject als `[Audio Library] user-typed subject`. Operator kan dan
   triagen op label in z'n inbox. Volgorde matters — meest gebruikte
   bovenaan (audio + bracelet zijn de productkernen, account/billing
   daarna voor pragmatische zorgen, feedback/other onderaan).
   Operator-toevoeging 2026-05-30. */
type Category = {
  id: string;
  label: string;
  hint: string; // 1-regel toelichting onder label in de picker
};

const CATEGORIES: Category[] = [
  { id: 'audio',    label: 'Audio Library',                hint: 'Playback, content, downloads' },
  { id: 'bracelet', label: 'Smart Bead Bracelet',          hint: 'Pairing, sessions, hardware' },
  { id: 'bundle',   label: 'Audio + Bracelet bundle',      hint: 'Both products together' },
  { id: 'account',  label: 'Account & Sign-in',            hint: 'Login, password, email' },
  { id: 'billing',  label: 'Subscription & Billing',       hint: 'Payment, refund, plan changes' },
  { id: 'bug',      label: 'Technical issue',              hint: 'Bug, crash, error' },
  { id: 'feedback', label: 'Feedback or feature request',  hint: 'Suggestions, ideas' },
  { id: 'other',    label: 'Something else',               hint: '' },
];

export default function SupportScreen() {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  /* Voor-invul email vanuit auth-state (als ingelogd) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const e = await getUserEmail();
        if (!cancelled && e) setEmail(e);
      } catch {
        /* niet ingelogd — laat veld leeg */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit =
    category !== null &&
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email.trim());

  const onSubmit = async () => {
    if (!canSubmit) {
      Alert.alert(
        'Missing information',
        'Please pick a category and fill in subject, message, and a valid email.',
      );
      return;
    }
    setSending(true);

    /* Direct via backend versturen — geen externe mail-app nodig.
       Backend (/api/support) gebruikt Zoho SMTP en stuurt naar
       info@vibezcore.com met Reply-To = user's email. */
    try {
      const resp = await fetch(SUPPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category?.label || '',
          subject: subject.trim(),
          message: message.trim(),
          fromEmail: email.trim(),
          platform: Platform.OS,
        }),
      });

      if (resp.ok) {
        Alert.alert(
          'Message sent ✓',
          "Thanks — we'll reply within 24 hours on weekdays.",
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }

      /* Server gaf een error-status. Probeer het detail uit te lezen
         voor een nuttiger melding. */
      let detail = '';
      try {
        const data = await resp.json();
        if (data?.error) detail = data.error;
      } catch {
        /* response niet JSON — laat detail leeg */
      }

      /* 4xx = validation issue (gebruik laten weten wat er fout is).
         5xx = server-side fail → val terug op mailto. */
      if (resp.status >= 400 && resp.status < 500) {
        Alert.alert(
          'Could not send message',
          detail || 'Please check your input and try again.',
        );
        return;
      }

      /* Server-fail → mailto-fallback zodat user niet vastloopt. */
      await fallbackToMailto();
    } catch {
      /* Netwerk-fout (geen internet, DNS, timeout, etc.) → mailto-fallback. */
      await fallbackToMailto();
    } finally {
      setSending(false);
    }
  };

  /* Fallback wanneer backend onbereikbaar is: probeer native mail-app,
     anders Gmail-web. Zorgt dat user nooit echt vastloopt zonder optie
     om contact te leggen. */
  const fallbackToMailto = async () => {
    const subjectWithTag = category
      ? `[${category.label}] ${subject.trim()}`
      : subject.trim();
    const platformInfo = `\n\n— sent from VIBEZCORE App (${Platform.OS})`;
    const categoryLine = category ? `Category: ${category.label}\n` : '';
    const body = `${categoryLine}From: ${email.trim()}\n\n${message.trim()}${platformInfo}`;
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subjectWithTag,
    )}&body=${encodeURIComponent(body)}`;
    const gmailWeb =
      `https://mail.google.com/mail/?view=cm&fs=1` +
      `&to=${encodeURIComponent(SUPPORT_EMAIL)}` +
      `&su=${encodeURIComponent(subjectWithTag)}` +
      `&body=${encodeURIComponent(body)}`;

    try {
      const supported = await Linking.canOpenURL(mailto);
      if (supported) {
        Alert.alert(
          'Connection issue',
          "We couldn't reach our server. Open your email app to send manually?",
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open mail',
              onPress: async () => {
                try {
                  await Linking.openURL(mailto);
                  setTimeout(() => router.back(), 600);
                } catch {
                  /* swallow */
                }
              },
            },
          ],
        );
        return;
      }
      /* Geen native mail-app → bied Gmail-web aan. */
      Alert.alert(
        'Connection issue',
        `We couldn't reach our server, and no email app was found. Open Gmail in your browser, or email us directly at ${SUPPORT_EMAIL}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Gmail',
            onPress: async () => {
              try {
                await Linking.openURL(gmailWeb);
                setTimeout(() => router.back(), 600);
              } catch {
                /* swallow */
              }
            },
          },
        ],
      );
    } catch {
      Alert.alert(
        'Could not send',
        `Please email us directly at ${SUPPORT_EMAIL}`,
      );
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen
        options={{ title: 'Support', headerBackTitle: 'Back' }}
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.intro}>
          Tell us what's on your mind. We read every message and respond
          within 24 hours on weekdays.
        </Text>

        {/* FAQ-link bovenaan — verlaagt het aantal support-emails voor
            common vragen. User die hier z'n antwoord vindt hoeft niets
            te typen. Spec: prominente plek, niet opdringerig. */}
        <Pressable
          style={s.faqCard}
          onPress={() => router.push('/faq' as never)}
          accessibilityLabel="Browse frequently asked questions"
        >
          <View style={{ flex: 1 }}>
            <Text style={s.faqCardTitle}>Browse our FAQ first</Text>
            <Text style={s.faqCardSub}>
              Quick answers for the most common questions — chances are
              yours is in there.
            </Text>
          </View>
          <Text style={s.faqCardArrow}>→</Text>
        </Pressable>

        {/* Categorie-picker — Modal-based zodat 'ie er identiek
            uitziet op iOS + Android (native Picker is verschillend
            per platform). Geselecteerde label wordt als prefix op de
            email-subject gezet voor snelle triage. */}
        <Text style={s.label}>Category</Text>
        <Pressable
          style={s.pickerBtn}
          onPress={() => setCategoryOpen(true)}
          accessibilityLabel="Pick a support category"
        >
          <View style={{ flex: 1 }}>
            <Text
              style={category ? s.pickerValue : s.pickerPlaceholder}
              numberOfLines={1}
            >
              {category ? category.label : 'Select a category…'}
            </Text>
            {category?.hint ? (
              <Text style={s.pickerHint} numberOfLines={1}>
                {category.hint}
              </Text>
            ) : null}
          </View>
          <Text style={s.pickerChevron}>▾</Text>
        </Pressable>

        <Text style={s.label}>Subject</Text>
        <TextInput
          style={s.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="What is this about?"
          placeholderTextColor="rgba(255,255,255,0.30)"
          maxLength={120}
          returnKeyType="next"
        />

        <Text style={s.label}>Message</Text>
        <TextInput
          style={[s.input, s.inputMulti]}
          value={message}
          onChangeText={setMessage}
          placeholder="Describe the issue or feedback…"
          placeholderTextColor="rgba(255,255,255,0.30)"
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />

        <Text style={s.label}>Your email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="rgba(255,255,255,0.30)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Text style={s.hint}>
          We need this to reply to you. Goes to {SUPPORT_EMAIL}.
        </Text>

        <Pressable
          style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit || sending}
          accessibilityLabel="Send message to support"
        >
          <Text
            style={[
              s.submitBtnText,
              !canSubmit && s.submitBtnTextDisabled,
            ]}
          >
            {sending ? 'Opening email…' : 'Send message →'}
          </Text>
        </Pressable>

        <Text style={s.footer}>
          You can also email us directly at {SUPPORT_EMAIL}
        </Text>
      </ScrollView>

      {/* Category picker modal — opens als user op de picker-knop tikt.
          Tap buiten de card sluit 'm (zonder selectie). Tap op een
          optie selecteert + sluit. */}
      <Modal
        visible={categoryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryOpen(false)}
      >
        <Pressable
          style={s.modalBackdrop}
          onPress={() => setCategoryOpen(false)}
        >
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Pick a category</Text>
            <Text style={s.modalSub}>
              Helps us route your message to the right person.
            </Text>
            <ScrollView style={s.modalList} bounces={false}>
              {CATEGORIES.map((c) => {
                const selected = category?.id === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[s.modalRow, selected && s.modalRowSelected]}
                    onPress={() => {
                      setCategory(c);
                      setCategoryOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.modalRowLabel,
                          selected && s.modalRowLabelSelected,
                        ]}
                      >
                        {c.label}
                      </Text>
                      {c.hint ? (
                        <Text style={s.modalRowHint}>{c.hint}</Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <Text style={s.modalRowCheck}>✓</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={s.modalClose}
              onPress={() => setCategoryOpen(false)}
              accessibilityLabel="Close category picker"
            >
              <Text style={s.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  intro: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    marginBottom: 22,
  },
  label: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
  },
  inputMulti: {
    minHeight: 140,
    paddingTop: 12,
    paddingBottom: 12,
  },
  hint: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    marginTop: 6,
  },
  submitBtn: {
    marginTop: 24,
    backgroundColor: Brand.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: 'rgba(58,143,255,0.20)',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.3,
  },
  submitBtnTextDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },
  footer: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 22,
  },
  /* ── FAQ-card bovenaan (CTA naar /faq) ── */
  faqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderColor: 'rgba(58,143,255,0.32)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 22,
  },
  faqCardTitle: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  faqCardSub: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
  },
  faqCardArrow: {
    color: Brand.accent,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
  },
  /* ── Category picker (dropdown button) ── */
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pickerPlaceholder: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
  },
  pickerValue: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  pickerHint: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  pickerChevron: {
    color: Brand.accent,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    marginLeft: 10,
  },
  /* ── Modal (categorie-keuzelijst) ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
  },
  modalTitle: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  modalSub: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginBottom: 16,
  },
  modalList: {
    maxHeight: 420,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalRowSelected: {
    backgroundColor: 'rgba(58,143,255,0.12)',
    borderColor: 'rgba(58,143,255,0.35)',
    borderWidth: 1,
  },
  modalRowLabel: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  modalRowLabelSelected: {
    color: Brand.accent,
  },
  modalRowHint: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  modalRowCheck: {
    color: Brand.accent,
    fontSize: 18,
    fontFamily: BrandFonts.extrabold,
    marginLeft: 10,
  },
  modalClose: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.3,
  },
});
