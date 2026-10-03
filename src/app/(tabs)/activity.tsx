/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Activity

   Eigen tabblad (operator, 6 augustus 2026). Wat je gedaan hebt hoorde niet
   weggestopt te zitten achter een icoontje op de Breath-tab: het is de plek
   waar je terugkomt om te zien of het iets oplevert, en dat is de helft van
   waarom iemand een gewoonte volhoudt.

   ── Waarom ademsessies en bracelet gescheiden blijven ─────────────────
   Ze staan onder elkaar, niet door elkaar. Een ademsessie is iets wat je
   DOET — die telt mee als oefening en laat groei zien. Bracelet-gebruik is
   iets wat je KRIJGT; dat is gebruik, geen vooruitgang. Zet je die twee in
   dezelfde grafiek, dan suggereer je groei waar alleen consumptie is.

   Het bracelet-blok verschijnt alleen voor wie er een heeft. Wie er geen
   heeft ziet zijn ademhaling, en verder niets dat hem herinnert aan iets dat
   hij niet bezit.
   ───────────────────────────────────────────────────────────────────────── */

import { BrandDark, BrandLight, BrandFonts, TypeScale } from '@/constants/theme';
import {
  useBraceletStats,
} from '@/utils/bracelet-history';
import { useBreathHistory } from '@/utils/breath-history';
import { useSetting } from '@/utils/settings';
import { router } from 'expo-router';
import { goalsByKeys } from '@/data/goals';
import { useActivePlan } from '@/utils/plan-store';
import { useActiveBraceletPlan, dayKey } from '@/utils/bracelet-plan-store';
import { useProtocolLocked, PROTOCOL_LOCKED_SUB } from '@/utils/protocol-gate';
import {
  Activity as ActivityIcon,
  CalendarDays,
  ChevronRight,
  Info,
  Lock,
  Target,
  Watch,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Operator, 15 september 2026: zelfde light/C-token-toggle als
   index.tsx/bracelet.tsx — hele pagina naar light mode, één boolean om
   terug te draaien. */
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september) — zelfde hardcoded-schakelaar-patroon, enkel de
   waarde omgezet. */
const light = false;
const C = light ? BrandLight : BrandDark;
/* Operator, 29 september 2026 ("activity tekst is niet zichtbaar... heel
   de pagina is nu dark mode maar denk dat veel tekst zwarte staat"): dit
   bestand was gebouwd tóen `light` nog true was, en gebruikte overal een
   hardcoded `rgba(10,10,12,X)` ("zwart op X% dekking") voor tekst/iconen/
   randen/achtergronden — dat bleef letterlijk zwart staan toen `light` op
   26 september naar false omschakelde, dus onleesbaar zwart-op-zwart.
   Zelfde `ink()`-patroon als elders na een licht→donker omschakeling:
   zelfde dekkingswaarde, alleen de basiskleur wisselt met het thema. */
const ink = (a: number) => (light ? `rgba(10,10,12,${a})` : `rgba(255,255,255,${a})`);

const DAY = 864e5;

export default function ActivityScreen() {
  const history = useBreathHistory();
  const [goals] = useSetting('goals');
  const [profile] = useSetting('profile');
  const { plan } = useActivePlan();
  /* Operator, 17 september 2026 ("weet gebruiker op voorhand dat hij hier
     niets mee is zonder premium?"): elke ingang naar de Protocol-flow
     hoort dat VOORAF te zeggen, niet pas na 3 stappen via de teaser-popup.
     Zie `utils/protocol-gate.ts`. */
  const protocolLocked = useProtocolLocked();
  /* Operator, 29 september 2026 ("in set your goal kaart moeten de 2
     states elk eigen regel krijgen"): was `.join(' · ')` — 2 gekozen
     doelen liepen dan achter elkaar op 1 regel. \n i.p.v. ' · ' laat elk
     doel zijn eigen regel krijgen in de sub-tekst (RN's Text rendert \n
     gewoon als linebreak, geen aparte opmaak nodig). */
  const goalNames = goalsByKeys(goals)
    .map((g) => g.name)
    .join('\n');

  /* Operator, 29 september 2026 ("breathwork activity en bracelet activity
     moeten hier weg, aparte pagina bij aanklikken"): de volledige ring/
     streak-badge/staafdiagram/donut-uitwerking is hier verwijderd — die
     content bestond al, vollediger, op de eigen `/breath-history` en
     `/bracelet-history`-pagina's (hero-stats, per-patroon-uitsplitsing,
     volledige chronologische lijst). Dit scherm is nu enkel nog de
     4-kaarten-hub; alleen de weektotalen voor de kaart-sub-teksten blijven
     nodig, dus geen zware `stats`/`bracelet`-berekening meer — rechtstreeks
     uit de bestaande hooks. */
  const weekBreathSessions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = today.getTime() - 6 * DAY;
    return history.filter((e) => e.ts >= weekAgo).length;
  }, [history]);
  const bStats = useBraceletStats();
  const { plan: braceletPlan } = useActiveBraceletPlan();
  const braceletTodaySessions = braceletPlan?.days[dayKey(new Date())]?.items.length ?? 0;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator, 29 september 2026 ("i.p.v. de foto moet een apple
           stijl grafiek symbool komen"): de foto-hero (RNImage + gradient)
           is weg — vervangen door een compact icoon-badge-kopje, zoals
           Apple's eigen systeemschermen (SF Symbol in een gekleurd
           afgerond vlak naast de titel) i.p.v. een fotografische banner. */}
        <View style={s.headerRow}>
          <View style={s.headerIconBadge}>
            <ActivityIcon size={22} color="#ffffff" strokeWidth={2.4} />
          </View>
          <View>
            <Text style={s.headerEyebrow}>YOUR PROGRESS</Text>
            <Text style={s.headerTitle}>Activity</Text>
          </View>
        </View>

        <View style={s.headerSpacer} />

        {/* Operator, 29 september 2026 ("zeer belangrijke elementen en
           eigenlijk de essentie van breathwork... bovenaan onder de foto
           als eerste blok"): stonden eerder onderaan, ondergeschikt aan de
           cijfers — nu het eerste blok na de hero-foto. Zelfde neutrale
           kaart-stijl (`Row`, geen kleur) en dezelfde press-animatie als
           overal elders in dit bestand — geen nieuw component nodig.
           "Your daily plan" gaat nu ALTIJD naar /agenda (operator: "moet
           ook naar agenda gaan") — dat scherm toont zelf al een lege
           staat + CTA naar build-choice als er nog geen plan is
           (agenda.tsx regel ~570), dus de eigen ternary hier was overbodig. */}
        {/* Operator, 29 september 2026 ("set your goal en daily plan is
           voor breathwork maar niet echt duidelijk nu"): zonder de oude
           "Breathwork"-sectiekop (weggehaald samen met de foto/stats) was
           niet meer zichtbaar waar deze twee kaarten bij horen. Klein
           label terug, enkel boven dit paar. */}
        {/* Operator, 30 september 2026 ("bij activity lange rechthoekige
           kaarten terug maar i blijft en zorg ervoor dat alles mooi op
           scherm past zonder scroll"): de vierkante matglas-tegels van
           dezelfde dag zijn hier weer lange `Row`-kaarten (large-variant,
           zoals vóór de vierkante ronde) — maar de "i"-toggle van
           `SquareCard` blijft bestaan, nu als `Row`'s eigen `info`-prop
           (zie de component hieronder). Alle maten (rowLarge/groupLabel/
           scroll-padding) zijn tegelijk verkleind zodat 2 groepslabels +
           6 kaarten + header zonder scrollen passen. */}
        <Text style={s.groupLabel}>BREATHWORK</Text>
        <View>
          {/* Operator, 3 okt 2026 ("your daily plan breathwork en bracelet
             als eerste telkens"): "Your daily plan" verhuisd naar de
             eerste plek in deze groep (stond voorheen na "Set your
             goal") — zelfde herschikking hieronder bij BRACELET. */}
          <Row
            large
            Icon={CalendarDays}
            title="Your daily plan"
            info={
              plan
                ? 'Your protocol, tracked day by day'
                : protocolLocked
                  ? PROTOCOL_LOCKED_SUB
                  : (profile.preferredSlots ?? []).includes('midday')
                    ? 'Three moments a day'
                    : 'Two moments a day'
            }
            onPress={() => router.push('/agenda' as never)}
          />
          <Row
            large
            Icon={protocolLocked ? Lock : Target}
            title="Set your goal"
            info={protocolLocked ? PROTOCOL_LOCKED_SUB : (goalNames || 'Choose what you are working toward')}
            onPress={() => router.push('/build-choice' as never)}
          />
          {/* Operator, 29 september 2026 ("hoe kan gebruiker in 1 oogopslag
             checken wat hij wil, nu onduidelijk wat breathwork en bracelet
             is"): de eerdere samengevoegde "Activity"-kaart (breathwork +
             bracelet in 1 regel) ging in tegen het uitgangspunt bovenaan
             dit bestand — "ze staan onder elkaar, niet door elkaar... zet
             je die twee samen, dan suggereer je groei waar alleen
             consumptie is." Terug naar 2 losse kaarten, elk met eigen
             icoon en bestemming — dat IS het "in 1 oogopslag"-onderscheid. */}
          <Row
            large
            Icon={Wind}
            title="Breathwork activity"
            sub={
              weekBreathSessions > 0
                ? `${weekBreathSessions} session${weekBreathSessions === 1 ? '' : 's'} this week`
                : 'View your session history'
            }
            onPress={() => router.push('/breath-history')}
          />
        </View>

        <Text style={[s.groupLabel, { marginTop: 16 }]}>BRACELET</Text>
        <View>
          {/* Operator, 29 september 2026 ("uw set your goal (bracelet) is
             eigenlijk niets momenteel, had evengoed go to bracelet kunnen
             heten"): terecht — die kaart zette niets vast, enkel een
             live tijdstip-gok. Vervangen door de ECHTE "Set your plan":
             meerdere sessies/dag, elk een eigen state+tijd+duur, een
             horizon (1 dag/week/2 weken/doorlopend), opgeslagen in
             `bracelet-plan-store.ts` — dezelfde architectuur als
             breathwork's `plan-store.ts`.
             Operator, 30 september 2026 ("bij activity moet bracelet ook
             een your daily plan krijgen"): gesplitst in TWEE kaarten,
             exact het paar dat breathwork hierboven al heeft — "Set your
             plan" (de bouwer) en "Your daily plan" (het overzicht,
             `/bracelet-agenda`, altijd bereikbaar i.p.v. verstopt achter
             een voorwaardelijke route op 1 kaart — "ik zie de pagina
             niet" was precies dat probleem). "Your daily plan" gaat
             ALTIJD naar `/bracelet-agenda`, zelfde reden als breathwork's
             eigen "moet ook naar agenda gaan"-fix: dat scherm toont zelf
             al een lege staat + CTA als er nog geen plan is. */}
          {/* Operator, 3 okt 2026: "Your daily plan" ook hier naar de
             eerste plek, zelfde herschikking als BREATHWORK hierboven. */}
          <Row
            large
            Icon={CalendarDays}
            title="Your daily plan"
            info={braceletPlan ? 'Your bracelet plan, tracked day by day' : 'Nothing planned yet'}
            onPress={() => router.push('/bracelet-agenda' as never)}
          />
          <Row
            large
            Icon={Target}
            title="Set your plan"
            info={
              braceletTodaySessions > 0
                ? `${braceletTodaySessions} session${braceletTodaySessions === 1 ? '' : 's'} planned today`
                : 'Choose your states, times and duration'
            }
            onPress={() => router.push('/bracelet-set-day' as never)}
          />
          <Row
            large
            Icon={Watch}
            title="Bracelet activity"
            sub={
              bStats.weekSessions > 0
                ? `${bStats.weekSessions} session${bStats.weekSessions === 1 ? '' : 's'} this week`
                : 'View your bracelet session history'
            }
            onPress={() => router.push('/bracelet-history')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* Operator, 30 september 2026 ("bij activity lange rechthoekige kaarten
   terug maar i blijft"): terug naar de lange `Row`-kaart, maar de
   "i"-toggle van de vierkante tussenstap (`SquareCard`'s `showInfo`)
   blijft bestaan — nu als optionele `info`-prop hier. Zonder `info` werkt
   Row exact als voorheen (`sub` altijd zichtbaar, geen i-knop) — dat is de
   volle-breedte-geschiedenisrij ("...activity"). Mét `info` (de twee
   actiekaarten per groep) is de content pas zichtbaar na een tik op de
   "i", zelfde interactie als `SquareCard` had. */
function Row({
  Icon,
  title,
  sub,
  info,
  onPress,
  /* Operator, 29 september 2026 ("maak de kaarten groter"): "Set your
     goal"/"Your daily plan" zijn de essentie van breathwork, mogen meer
     gewicht hebben dan de smalle lijstrijen onderaan ("All breathwork
     sessions" e.d.) — die blijven de standaardmaat, hier alleen een
     grotere variant opt-in via `large`. */
  large = false,
}: {
  Icon: LucideIcon;
  title: string;
  sub?: string;
  info?: string;
  onPress: () => void;
  large?: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <AnimatedPressable
      style={[s.row, large && s.rowLarge, pressStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {large ? (
        <View style={s.rowIconBadge}>
          <Icon size={21} color={ink(0.8)} strokeWidth={2.2} />
        </View>
      ) : (
        <Icon size={17} color={ink(0.55)} strokeWidth={2.2} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {info ? (
          showInfo && (
            <Text style={[s.rowSub, large && s.rowSubLarge]} numberOfLines={2}>
              {info}
            </Text>
          )
        ) : (
          sub && <Text style={[s.rowSub, large && s.rowSubLarge]}>{sub}</Text>
        )}
      </View>
      {info && (
        <Pressable hitSlop={10} onPress={() => setShowInfo((v) => !v)} style={s.rowInfoBtn}>
          <Info size={13} color={ink(0.5)} strokeWidth={2.2} />
        </Pressable>
      )}
      <ChevronRight size={large ? 19 : 16} color={ink(0.3)} />
    </AnimatedPressable>
  );
}

/* Uren zodra het er genoeg zijn: "8h 45m" leest sneller dan "525m". */
function fmtMin(m: number): string {
  if (m < 60) return m + 'm';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

const CARD_BG = ink(0.035);
const CARD_BORDER = ink(0.08);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  /* Operator, 29 september 2026 ("apple stijl grafiek symbool i.p.v. de
     foto"): icoon-badge (Bio-Teal, de app-brede accentkleur) + eyebrow/
     titel ernaast — vervangt de fotografische banner. */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  /* Operator, 30 september 2026 ("geef alles wat ademruimte, bovenste
     blok iets lager dan header"): losse spacer tussen de header en het
     eerste groepslabel — puur voor lucht, geen eigen inhoud. */
  headerSpacer: { height: 14 },
  headerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A3A3',
  },
  /* Operator, 29 september 2026 ("kloppen de fonts met ons protocol"):
     was een eigen semibold/11/1.5 — de gedeelde eyebrow-rol is
     `TypeScale.cardEyebrow` (bold/10.5/1.4), zelfde token als index.tsx's
     `heroEyebrow` en bracelet.tsx's `storyRowNum`. */
  headerEyebrow: {
    ...TypeScale.cardEyebrow,
    textTransform: 'uppercase',
    color: ink(0.5),
    marginBottom: 2,
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): de pagina-
     titel-rol op een tab-scherm is overal `TypeScale.tabHeader`. */
  headerTitle: {
    ...TypeScale.tabHeader,
    color: C.text,
  },
  /* Operator, 30 september 2026 ("geef alles wat ademruimte, blokken
     wat verder van elkaar"): iets meer lucht dan de eerdere zonder-
     scroll-compacte versie — een lichte scroll op kleine schermen is nu
     geaccepteerd in ruil voor rustigere spacing. */
  scroll: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    paddingTop: 6,
  },
  /* Operator, 29 september 2026: was letterSpacing 1.2 (eigen verzonnen
     waarde) — geen TypeScale-token bestaat nog voor "label boven een
     kaartgroep", dus uitgelijnd op de dichtstbijzijnde bestaande
     zusterrol: account.tsx's `supportSectionLabel` (bold/11/1.6). */
  groupLabel: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: ink(0.4),
    marginBottom: 11,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    marginBottom: 10,
  },
  /* Operator, 29 september 2026: was eigen semibold/13 — dit IS de
     "compacte, horizontale entry-kaart"-rol die `TypeScale.compactCardTitle`
     expliciet unificeert tussen account.tsx en bracelet.tsx (bv.
     "Activate your bracelet"). `rowSub` erbij op `TypeScale.cardDetail`,
     zelfde koppel als bracelet.tsx's `storyRowTitle`/`storyRowBody`. */
  rowTitle: { ...TypeScale.compactCardTitle, color: C.text },
  rowSub: {
    ...TypeScale.cardDetail,
    marginTop: 1,
    color: ink(0.35),
  },
  rowLarge: {
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 13,
  },
  rowIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink(0.06),
  },
  rowSubLarge: { marginTop: 3, lineHeight: 18 },
  /* De "i"-toggle die `SquareCard` had, nu op de lange `Row`-kaart —
     zelfde plek/maat als `squareInfoBtn` had, enkel niet meer absoluut
     gepositioneerd (de rechthoekige rij heeft al ruimte naast de tekst). */
  rowInfoBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink(0.06),
  },
});
