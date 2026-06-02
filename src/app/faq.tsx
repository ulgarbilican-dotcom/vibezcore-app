/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — FAQ screen

   Mirror van vibezcore.com/faq, native mobile UX:
   - Header met "Frequently Asked Questions" + intro
   - Search box (filtert op question + answer)
   - Horizontale category-tabs (All + 7 categorieën)
   - Lijst van uitklap-items per categorie
   - "No results" empty-state als search niets vindt
   - "Still need help?" CTA naar /support onderaan

   Content komt uit src/data/faq-content.ts. Bold-tekst in antwoorden
   wordt via een mini renderer (renderRichText) als bold weergegeven.
   ─────────────────────────────────────────────────────────────────── */

import {
  FAQ_CATEGORY_LABELS,
  FAQ_CATEGORY_ORDER,
  FAQ_ITEMS,
  type FaqCategory,
  type FaqItem,
} from '@/data/faq-content';
import { Brand, BrandFonts } from '@/constants/theme';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Wordmark als eyebrow (huisstijl, geen platte tekst). */
const WORDMARK = require('../../assets/vibezcore_wordmark.png');

/* Enable LayoutAnimation on Android (default off). Geeft een soepele
   uitklap-animatie zonder native dependency. */
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CatFilter = 'all' | FaqCategory;

export default function FaqScreen() {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<CatFilter>('all');
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  /* Filter items obv categorie + search. Search-match is op question
     én answer (lowercase contains) — zoals de website doet. Categorie
     wordt genegeerd zodra user iets typt, anders gedraagt search zich
     verrassend voor de user. */
  const filteredItems = useMemo<FaqItem[]>(() => {
    const q = query.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      if (q) {
        const haystack = (item.question + ' ' + item.answer).toLowerCase();
        if (!haystack.includes(q)) return false;
        return true; // search override category
      }
      if (activeCat === 'all') return true;
      return item.category === activeCat;
    });
  }, [query, activeCat]);

  /* Groepeer gefilterde items per categorie voor de section-headers. */
  const grouped = useMemo<Array<{ cat: FaqCategory; items: FaqItem[] }>>(() => {
    const map = new Map<FaqCategory, FaqItem[]>();
    for (const item of filteredItems) {
      const existing = map.get(item.category) ?? [];
      existing.push(item);
      map.set(item.category, existing);
    }
    /* Volgorde uit FAQ_CATEGORY_ORDER aanhouden zodat de UI altijd
       dezelfde sectie-volgorde heeft, ongeacht filter. */
    return FAQ_CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ cat, items: map.get(cat)! }));
  }, [filteredItems]);

  const toggleItem = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen
        options={{ title: 'FAQ', headerBackTitle: 'Back' }}
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Hero — wordmark als brand-eyebrow ipv platte tekst */}
        <Image
          source={WORDMARK}
          style={s.wordmark}
          resizeMode="contain"
          accessibilityLabel="VIBEZCORE"
        />
        <Text style={s.title}>
          Frequently Asked{'\n'}Questions
        </Text>
        <Text style={s.sub}>
          Everything you need to know about VIBEZCORE — the platform, the
          bracelet, the science, and your order.
        </Text>

        {/* Search */}
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search questions…"
            placeholderTextColor="rgba(255,255,255,0.30)"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <Pressable
              style={s.searchClear}
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityLabel="Clear search"
            >
              <Text style={s.searchClearText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Category tabs — horizontale scroll, "All" links */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catTabs}
        >
          <CatTab
            label="All"
            active={activeCat === 'all' && query.length === 0}
            onPress={() => {
              setQuery('');
              setActiveCat('all');
            }}
          />
          {FAQ_CATEGORY_ORDER.map((cat) => (
            <CatTab
              key={cat}
              label={FAQ_CATEGORY_LABELS[cat]}
              active={activeCat === cat && query.length === 0}
              onPress={() => {
                setQuery('');
                setActiveCat(cat);
              }}
            />
          ))}
        </ScrollView>

        {/* No results */}
        {filteredItems.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>⌕</Text>
            <Text style={s.emptyTitle}>No questions found</Text>
            <Text style={s.emptySub}>
              Try a different search term, or contact us via the Support
              Center.
            </Text>
            <Pressable
              style={s.emptyBtn}
              onPress={() => router.push('/support' as never)}
            >
              <Text style={s.emptyBtnText}>Contact support</Text>
            </Pressable>
          </View>
        )}

        {/* Items grouped per categorie */}
        {grouped.map(({ cat, items }) => (
          <View key={cat} style={s.section}>
            <Text style={s.sectionTitle}>{FAQ_CATEGORY_LABELS[cat]}</Text>
            {items.map((item) => (
              <FaqRow
                key={item.id}
                item={item}
                open={openIds.has(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
          </View>
        ))}

        {/* Footer CTA — als user niets vond na het scrollen */}
        {filteredItems.length > 0 && (
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>Still need help?</Text>
            <Text style={s.helpSub}>
              Our support team responds within 24 hours on weekdays.
            </Text>
            <Pressable
              style={s.helpBtn}
              onPress={() => router.push('/support' as never)}
              accessibilityLabel="Contact support"
            >
              <Text style={s.helpBtnText}>Contact support  →</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Sub-componenten ──────────────────────────────────────────── */

function CatTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.catTab, active && s.catTabActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[s.catTabText, active && s.catTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FaqRow({
  item,
  open,
  onToggle,
}: {
  item: FaqItem;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={s.faqRow}>
      <Pressable
        onPress={onToggle}
        style={s.faqQuestionRow}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={item.question}
      >
        <Text style={[s.faqQuestion, open && s.faqQuestionOpen]}>
          {item.question}
        </Text>
        <Text style={[s.faqChevron, open && s.faqChevronOpen]}>
          {open ? '–' : '+'}
        </Text>
      </Pressable>
      {open && (
        <View style={s.faqAnswerWrap}>{renderRichText(item.answer)}</View>
      )}
    </View>
  );
}

/* Mini markdown-light renderer:
   - Splits op \n\n → paragrafen
   - Splits elke paragraaf op **...** → bold-segmenten
   - Geen volledige markdown parser (overkill voor onze use-case) */
function renderRichText(text: string) {
  const paragraphs = text.split('\n\n');
  return paragraphs.map((para, pi) => {
    /* Binnen een paragraaf kunnen \n staan voor regelovergangen (bv.
       header + body op aparte regels). Behandel als zacht-breekpunt. */
    const lines = para.split('\n');
    return (
      <Text key={pi} style={s.faqAnswerPara}>
        {lines.map((line, li) => (
          <Text key={li}>
            {li > 0 ? '\n' : ''}
            {renderInline(line)}
          </Text>
        ))}
      </Text>
    );
  });
}

function renderInline(text: string) {
  /* Split op **bold** markers. Even-index segmenten = plain, odd = bold. */
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <Text key={i} style={s.faqAnswerBold}>
          {part}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

/* ── Styles ───────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingBottom: 60 },

  /* Hero */
  /* Wordmark als brand-eyebrow ipv platte tekst. */
  wordmark: {
    width: 130,
    height: 22,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  /* `eyebrow`-style behouden voor backward-compat. */
  eyebrow: {
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    color: Brand.text,
    fontSize: 32,
    fontFamily: BrandFonts.black,
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 12,
  },
  sub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    marginBottom: 22,
  },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  searchIcon: {
    color: Brand.textDim,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    paddingVertical: 12,
  },
  searchClear: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  searchClearText: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
  },

  /* Category tabs */
  catTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 6,
    marginBottom: 18,
  },
  catTab: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  catTabActive: {
    backgroundColor: Brand.accent,
    borderColor: Brand.accent,
  },
  catTabText: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  catTabTextActive: {
    color: '#ffffff',
  },

  /* Sections */
  section: {
    marginTop: 22,
    marginBottom: 4,
  },
  sectionTitle: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  /* FAQ row */
  faqRow: {
    borderBottomColor: Brand.border,
    borderBottomWidth: 1,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 18,
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  faqQuestionOpen: {
    color: Brand.accent,
  },
  faqChevron: {
    color: Brand.textDim,
    fontSize: 22,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    width: 18,
    textAlign: 'center',
  },
  faqChevronOpen: {
    color: Brand.accent,
    fontFamily: BrandFonts.bold,
  },
  faqAnswerWrap: {
    paddingBottom: 18,
    paddingRight: 30,
  },
  faqAnswerPara: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
    marginBottom: 10,
  },
  faqAnswerBold: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
  },

  /* No results */
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    color: Brand.textDim,
    fontSize: 32,
    fontFamily: BrandFonts.regular,
    marginBottom: 12,
  },
  emptyTitle: {
    color: Brand.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    marginBottom: 6,
  },
  emptySub: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 320,
  },
  emptyBtn: {
    backgroundColor: Brand.accent,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.4,
  },

  /* Help card onderaan */
  helpCard: {
    marginTop: 36,
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 22,
    alignItems: 'flex-start',
  },
  helpTitle: {
    color: Brand.text,
    fontSize: 17,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  helpSub: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    marginBottom: 14,
  },
  helpBtn: {
    backgroundColor: Brand.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  helpBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.4,
  },
});
