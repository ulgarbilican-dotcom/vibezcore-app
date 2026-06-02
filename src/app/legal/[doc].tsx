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
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Wordmark als eyebrow ipv platte tekst — huisstijl is het echte
   logo, niet "VIBEZCORE" in blauwe letters (operator 2026-05-30). */
const WORDMARK = require('../../../assets/vibezcore_wordmark.png');

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

/* Verwijder "1. ", "2. " etc. prefix uit oude h2-titels (Terms, Refund,
   Cookies, Health hebben handmatige nummering). Renderer voegt zelf
   "01" eyebrows toe — dubbele nummering = lelijk. Wordt overbodig
   zodra alle docs gesynced zijn met de nieuwe website-stijl. */
function stripLegacyNumbering(text: string): string {
  return text.replace(/^\d+\.\s+/, '');
}

/* ── Block renderer ─────────────────────────────────────────────────── */
function BlockRenderer({
  block,
  sectionNumber,
}: {
  block: LegalBlock;
  sectionNumber?: string;
}) {
  switch (block.kind) {
    case 'h2':
      return (
        <View style={s.h2Wrap}>
          {sectionNumber && (
            <Text style={s.sectionNumber}>{sectionNumber}</Text>
          )}
          <Text style={s.h2}>{stripLegacyNumbering(block.text)}</Text>
        </View>
      );
    case 'h3':
      return <Text style={s.h3}>{block.text}</Text>;
    case 'p':
      return <InlineText text={block.text} style={s.p} />;
    case 'ul': {
      const isCheck = block.style === 'check';
      return (
        <View style={s.ul}>
          {block.items.map((item, i) => (
            <View key={i} style={s.li}>
              {isCheck ? (
                <View style={s.liCheck}>
                  <Text style={s.liCheckText}>✓</Text>
                </View>
              ) : (
                <Text style={s.liBullet}>•</Text>
              )}
              <InlineText text={item} style={s.liText} />
            </View>
          ))}
        </View>
      );
    }
    case 'tags':
      return (
        <View style={s.tagsWrap}>
          {block.items.map((item, i) => (
            <View key={i} style={s.tag}>
              <Text style={s.tagText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'cards':
      return (
        <View style={s.cardsGrid}>
          {block.items.map((card, i) => (
            <View key={i} style={s.gridCard}>
              <Text style={s.gridCardTitle}>{card.title}</Text>
              <Text style={s.gridCardText}>{card.text}</Text>
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
        {/* Header — wordmark eyebrow + title + optionele subtitle +
            lastUpdated tekst. Date is platte tekst (Apple-stijl,
            geen pill, geen groene status-dot). */}
        <Image
          source={WORDMARK}
          style={s.wordmark}
          resizeMode="contain"
          accessibilityLabel="VIBEZCORE"
        />
        <Text style={s.title}>{doc.title}</Text>
        {doc.subtitle && <Text style={s.subtitle}>{doc.subtitle}</Text>}
        <Text style={s.lastUpdatedText}>
          Last updated: {doc.lastUpdated}
        </Text>

        {/* Body — alle blocks in document order. We tellen h2's vooraf
            zodat sectie-eyebrows ("01", "02") automatisch worden
            geïnjecteerd, exact zoals op vibezcore.com legal pages. */}
        <View style={s.body}>
          {(() => {
            let h2Count = 0;
            return doc.blocks.map((block, i) => {
              let sectionNumber: string | undefined;
              if (block.kind === 'h2') {
                h2Count += 1;
                sectionNumber = String(h2Count).padStart(2, '0');
              }
              return (
                <Fragment key={i}>
                  <BlockRenderer
                    block={block}
                    sectionNumber={sectionNumber}
                  />
                </Fragment>
              );
            });
          })()}
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
            onPress={() => router.navigate('/support' as never)}
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
  /* Wordmark als brand-eyebrow boven de doc-titel. Compacte maat
     (130×22px) zodat de h1-titel het hero-element blijft. */
  wordmark: {
    width: 130,
    height: 22,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  /* `eyebrow` style blijft staan voor backward-compat met sectie-
     subtitles indien die nog eyebrow-stijl nodig hebben (bv. de
     section-number die elders gerenderd wordt). */
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
    fontSize: 32,
    fontFamily: BrandFonts.black,
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 12,
  },
  /* Hero-subtitle — optionele tagline onder de titel (van vibezcore.com
     legal hero-sub). Italic-aanvoelend door de lichte kleur + lijnhoogte. */
  subtitle: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    marginBottom: 18,
    maxWidth: 520,
  },
  /* Last-updated — Apple-stijl plain text. Geen pill, geen groene
     status-dot. Subtle metadata, niet luid. Operator-besluit
     2026-05-30. */
  lastUpdatedText: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    letterSpacing: -0.1,
    marginBottom: 24,
  },
  body: { marginTop: 6 },
  /* Section-number eyebrow boven elke h2 ("01", "02", ...) — auto-
     gegenereerd door de renderer, matched de visuele structuur van
     vibezcore.com legal pages. */
  h2Wrap: {
    marginTop: 36,
    marginBottom: 10,
    paddingTop: 26,
    borderTopColor: Brand.border,
    borderTopWidth: 1,
  },
  sectionNumber: {
    color: Brand.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  /* ── H2 ── */
  h2: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  /* H3 — sub-header binnen een h2-sectie (zoals "Personal Information"
     onder "Information We Collect"). */
  h3: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
    marginTop: 22,
    marginBottom: 8,
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
  /* Check-style li (style: 'check') — accent-blauwe gevulde cirkel met
     checkmark, zoals de "rights-list" op vibezcore.com. */
  liCheck: {
    width: 20,
    height: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(58,143,255,0.18)',
    borderColor: 'rgba(58,143,255,0.45)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  liCheckText: {
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    lineHeight: 13,
  },
  liText: {
    flex: 1,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
  },
  /* ── Tags (chip pills) — voor data-type chips zoals "Name",
     "Email address", etc. Identiek visueel aan website tag-grid. */
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  tag: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tagText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
  },
  /* ── Cards grid — 2-koloms grid van label+description cards
     (Essential / Analytics / Functional / Security). Op smalle screens
     wrappen ze naar 1 kolom via flex-wrap. */
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
    marginBottom: 6,
  },
  gridCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  gridCardTitle: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  gridCardText: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 17,
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
