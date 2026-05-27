/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Legal document renderer (dynamic route)

   Eén route handelt alle 5 legal/safety-docs af via slug-param:
     /legal/terms      → Terms of Service
     /legal/privacy    → Privacy Policy
     /legal/refund     → Refund Policy
     /legal/cookies    → Cookie Policy
     /legal/health     → Health & Safety

   Visueel: VIBEZCORE-stijl (MERK_ANKER): dark bg, Inter, accent-blauwe
   eyebrow, ruime typografie hierarchy. Highlight-boxes in blauwe tint,
   danger-boxes in rood (voor crisis-info op Health). Onderaan een
   "Contact Support"-card (link naar webapp support form, blijft
   extern bestaan) + legal-nav-row om tussen de 5 docs te springen
   zonder terug-naar-Account.

   Inline markup support:
     **bold**          → bold text
     [text](url)       → tappable link, opens via WebBrowser (Custom Tab
                         iOS Safari View Controller, fallback Linking)
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import {
  LEGAL_DOCS,
  LEGAL_ORDER,
  LegalBlock,
  LegalSlug,
  SUPPORT_URL,
} from '@/data/legal-content';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Fragment } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* External URL opener — same patroon als rest van de app. Custom Tab /
   SFSafariViewController eerst, Linking als fallback. */
async function openExternal(url: string): Promise<void> {
  try {
    const r = await WebBrowser.openBrowserAsync(url);
    if (r.type === 'cancel' || r.type === 'dismiss') {
      await Linking.openURL(url);
    }
  } catch {
    await Linking.openURL(url);
  }
}

/* ── Inline markup parser ───────────────────────────────────────────
   Parseert **bold** en [link](url) uit een tekst-string. Returnt array
   van runs voor renderen. Geen genest gebruik (bold-binnen-link of
   omgekeerd) — keep it simple. */
type Run =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'link'; value: string; url: string };

function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  const regex = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      runs.push({ type: 'text', value: text.slice(lastIdx, m.index) });
    }
    if (m[1] !== undefined) {
      runs.push({ type: 'bold', value: m[1] });
    } else if (m[2] !== undefined && m[3] !== undefined) {
      runs.push({ type: 'link', value: m[2], url: m[3] });
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    runs.push({ type: 'text', value: text.slice(lastIdx) });
  }
  return runs;
}

function InlineText({
  text,
  style,
  boldStyle,
}: {
  text: string;
  style: object;
  boldStyle?: object;
}) {
  const runs = parseInline(text);
  return (
    <Text style={style}>
      {runs.map((r, i) => {
        if (r.type === 'text') return <Text key={i}>{r.value}</Text>;
        if (r.type === 'bold') {
          return (
            <Text key={i} style={[s.bold, boldStyle]}>
              {r.value}
            </Text>
          );
        }
        return (
          <Text
            key={i}
            style={s.link}
            onPress={() => openExternal(r.url)}
          >
            {r.value}
          </Text>
        );
      })}
    </Text>
  );
}

/* ── Block renderer ─────────────────────────────────────────────────── */
function BlockRenderer({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case 'h2':
      return <Text style={s.h2}>{block.text}</Text>;
    case 'p':
      return <InlineText text={block.text} style={s.p} />;
    case 'ul':
      return (
        <View style={s.ul}>
          {block.items.map((item, i) => (
            <View key={i} style={s.li}>
              <Text style={s.liBullet}>•</Text>
              <InlineText text={item} style={s.liText} />
            </View>
          ))}
        </View>
      );
    case 'highlight':
      return (
        <View style={s.highlightBox}>
          {block.title && (
            <Text style={s.highlightTitle}>{block.title}</Text>
          )}
          <InlineText text={block.text} style={s.highlightText} />
        </View>
      );
    case 'danger':
      return (
        <View style={s.dangerBox}>
          {block.title && (
            <Text style={s.dangerTitle}>{block.title}</Text>
          )}
          <InlineText text={block.text} style={s.dangerText} />
        </View>
      );
  }
}

export default function LegalDoc() {
  const params = useLocalSearchParams<{ doc?: string }>();
  const slug = (params.doc ?? '') as LegalSlug;
  const doc = LEGAL_DOCS[slug];

  /* Onbekende slug → 404-style fallback. Geen crash. */
  if (!doc) {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen
          options={{ title: 'Legal', headerBackTitle: 'Back' }}
        />
        <View style={s.center}>
          <Text style={s.h2}>Page not found</Text>
          <Text style={s.p}>
            The legal document you're looking for doesn't exist.
          </Text>
          <Pressable
            style={s.btn}
            onPress={() => router.replace('/account')}
          >
            <Text style={s.btnText}>Back to Account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen
        options={{ title: doc.title, headerBackTitle: 'Back' }}
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — eyebrow + title + lastUpdated */}
        <Text style={s.eyebrow}>{doc.eyebrow}</Text>
        <Text style={s.title}>{doc.title}</Text>
        <Text style={s.lastUpdated}>Last updated: {doc.lastUpdated}</Text>

        {/* Body — alle blocks in document order */}
        <View style={s.body}>
          {doc.blocks.map((block, i) => (
            <Fragment key={i}>
              <BlockRenderer block={block} />
            </Fragment>
          ))}
        </View>

        {/* Contact-support card aan de bodem */}
        <View style={s.contactCard}>
          <Text style={s.contactLabel}>QUESTIONS?</Text>
          <Text style={s.contactBody}>
            If anything is unclear or to exercise your rights, please reach
            out via the support form.
          </Text>
          <Pressable
            style={s.contactBtn}
            onPress={() => openExternal(SUPPORT_URL)}
            accessibilityLabel="Contact VIBEZCORE support"
          >
            <Text style={s.contactBtnText}>Contact Support  →</Text>
          </Pressable>
        </View>

        {/* Legal-nav — chips om tussen docs te springen. Active doc
            krijgt accent-fill, anderen subtle outline. */}
        <View style={s.legalNav}>
          {LEGAL_ORDER.map((s2) => {
            const d = LEGAL_DOCS[s2];
            const active = d.slug === doc.slug;
            return (
              <Pressable
                key={s2}
                style={[s.legalNavChip, active && s.legalNavChipActive]}
                onPress={() =>
                  active
                    ? null
                    : router.replace({
                        pathname: '/legal/[doc]' as never,
                        params: { doc: s2 } as never,
                      })
                }
                disabled={active}
              >
                <Text
                  style={[
                    s.legalNavText,
                    active && s.legalNavTextActive,
                  ]}
                >
                  {d.short}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingBottom: 48 },
  center: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* ── Header ── */
  eyebrow: {
    color: Brand.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: Brand.text,
    fontSize: 30,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
    lineHeight: 34,
    marginBottom: 8,
  },
  lastUpdated: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    marginBottom: 8,
  },
  body: { marginTop: 14 },
  /* ── H2 ── */
  h2: {
    color: Brand.text,
    fontSize: 17,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.2,
    marginTop: 26,
    marginBottom: 10,
  },
  /* ── Paragraph ── */
  p: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
    marginBottom: 10,
  },
  bold: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
  },
  link: {
    color: Brand.accent,
    fontFamily: BrandFonts.semibold,
    textDecorationLine: 'underline',
  },
  /* ── List ── */
  ul: { marginBottom: 12, marginTop: 4 },
  li: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 4,
  },
  liBullet: {
    color: Brand.accent,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    marginRight: 10,
    lineHeight: 22,
  },
  liText: {
    flex: 1,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
  },
  /* ── Highlight box (blue tint) ── */
  highlightBox: {
    backgroundColor: 'rgba(58,143,255,0.08)',
    borderColor: 'rgba(58,143,255,0.35)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginVertical: 14,
  },
  highlightTitle: {
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  highlightText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
  },
  /* ── Danger box (red tint, for crisis info) ── */
  dangerBox: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.40)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginVertical: 14,
  },
  dangerTitle: {
    color: Brand.error,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  dangerText: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
  },
  /* ── Contact card ── */
  contactCard: {
    marginTop: 36,
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  contactLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    marginBottom: 8,
  },
  contactBody: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    marginBottom: 14,
  },
  contactBtn: {
    backgroundColor: Brand.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  contactBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1,
  },
  /* ── Legal nav (chip-row tussen docs) ── */
  legalNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
    paddingHorizontal: 8,
  },
  legalNavChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  legalNavChipActive: {
    backgroundColor: 'rgba(58,143,255,0.10)',
  },
  legalNavText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
  },
  legalNavTextActive: {
    color: Brand.accent,
  },
  /* ── Fallback (unknown slug) ── */
  btn: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: BrandFonts.bold,
  },
});
