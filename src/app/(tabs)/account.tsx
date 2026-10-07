/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Account tab

   Optional. NOT a wall (gast-first §1). Guests use the whole app without an
   account; an account is only needed for full audio or (later) bracelet
   activation. Hooks the EXISTING proven auth.ts (unchanged backend).
   Login + signup both present (bracelet will require an account — §1/§2).

   Uiterlijk: MERK_ANKER — Brand-palet, Inter via _layout, wordmark in
   signed-out header (vervangt platte tekst "VIBEZCORE").
   ─────────────────────────────────────────────────────────────────────────── */

import { AudioAccentLight, BrandDark, BrandLight, BrandFonts, TypeScale } from '@/constants/theme';
import Constants from 'expo-constants';
import BraceletIcon from '@/components/BraceletIcon';

/* Operator, 15 september 2026: zelfde light/C-token-toggle als
   index.tsx/bracelet.tsx/activity.tsx — hele pagina naar light mode, één
   boolean om terug te draaien. */
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september) — zelfde hardcoded-schakelaar-patroon, enkel de
   waarde omgezet. */
const light = false;
const C = light ? BrandLight : BrandDark;
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Signal Blue (#3a8fff / rgba(58,143,255,…)) is strikt gereserveerd voor
   haptic-pulsen en "nu actief"-status — nooit voor kaart-tints/borders/
   links/eyebrows. Deze schermen zijn light-mode, dus de vervanging is
   Royal Indigo (#1E2A4A, rgb 30,42,74), gelijk aan BrandLight.accent. */
const ROYAL_INDIGO_RGB = '30,42,74';
import {
  refreshSubscription,
  setSignedOutStatus,
  setSigningInStatus,
  useSubscription,
} from '@/hooks/useSubscription';
import { refreshUserBucket as refreshBraceletBucket } from '@/utils/bracelet-history';
import { refreshUserBucket as refreshAudioBucket } from '@/utils/user-bucket';

/* Iter 9dq v44 (2026-06-03): bij elke sign-in/out moeten ZOWEL de
   bracelet-bucket als de audio-bucket (history, favorites, positions)
   her-evalueren naar de nieuwe user. Beide gebruiken dezelfde bucket-
   resolutie (override of JWT sub) en triggeren cache-reload bij
   bucket-switch.

   Iter 9dq v55 (2026-06-03, audit-finding C5+C6): functie maakt nu
   ECHT async en wordt voor navigatie geawait. Voorheen fire-and-forget
   → race-window waarin user na sign-in al naar Audio Library was
   genavigeerd terwijl de bucket nog 'anon' was → een toggle in dat
   window schreef naar 'vzf_anon_v1' (visible voor de volgende anon
   user op het device). Door te awaiten weten we dat de bucket switch
   compleet is voor de UI verder gaat. */
async function refreshUserBucket(): Promise<void> {
  await Promise.all([refreshBraceletBucket(), refreshAudioBucket()]);
}
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
  setDevBraceletActivated,
  setDevUserOverride,
  useBraceletOwner,
  useDevBraceletActivated,
  useDevUserOverride,
} from '@/utils/dev-user-override';
import {
  storeSubscriptionsUrl,
} from '@/services/subscription-actions';
import { restorePurchases, silentRestoreAfterLogin } from '@/services/restore-purchases';
import { clearSignedUrlCache } from '@/utils/audio-url';
import { clearLastPlayed } from '@/utils/last-played';
import { validateEmail, emailHintText } from '@/utils/validate-email';
import {
  consumeScrollIntent,
  requestScrollTo,
  subscribeScrollIntent,
} from '@/utils/scroll-intent';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Children, useEffect, useRef, useState, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Pressable,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  ChevronRight,
  CircleUserRound,
  Crown,
  KeyRound,
  LogOut,
  Repeat,
  RotateCcw,
  Trash2,
  Eye,
  EyeOff,
  Headphones,
  MessageCircle,
  HelpCircle,
  Info,
  Lock,
  Mail,
  Package,
  Settings as SettingsIcon,
  Share2,
  UserPlus,
} from 'lucide-react-native';

/* Iter v244 (2026-07-20, operator-feedback): pitch herschreven — noemt
   nu expliciet de denkers/insights ipv generieke "grounded in Science,
   Philosophy & Psychology", en link is de universele vibezcore.com/app
   (werkt voor Android + iOS-status) ipv de directe Play Store-link.
   Single source of truth binnen dit bestand — bij wijziging hoeven we
   maar 1 plek aan te passen. KS-launch: Fall 2026 (operator 2026-07-14
   — sep-datum weg, geen concrete datum meer). */
const APP_LINK_URL = 'https://www.vibezcore.com/app';
/* Breathwork voorop, bracelet als "komt eraan", audio library als
   inbegrepen extra (operator, 11 augustus 2026: bracelet is het
   toekomstige hoofdproduct — uniek, maar nog niet beschikbaar; breathwork
   is NU verkoopbaar; audio library verkoopt moeilijk als eigen product en
   hoort er daarom bij als bonus, niet als kop). Vervangt de eerdere versie
   (9 augustus 2026) die de bibliotheek helemaal wegliet — die redenering
   klopte nog steeds (geen aparte titel), maar één regel "inclusief"
   ontbrak. Toestand-taal, geen claims; de gratis kennismakingssessie is
   wat een genodigde werkelijk krijgt. */
const BRAND_PITCH =
  'Control Your Body. Direct Your Mind. Become The Architect Of Your Life.\n\n' +
  'VIBEZCORE combines guided breathwork, premium audio sessions, and the upcoming Smart Bead Bracelet (Fall 2026) to help you feel calmer, think clearer, perform better, and grow with intention.';
const INVITE_MESSAGE = `${BRAND_PITCH}\n\nStart your 7-day free trial:\n${APP_LINK_URL}`;

async function shareInvite(): Promise<void> {
  try {
    await Share.share({
      title: 'VIBEZCORE',
      message: INVITE_MESSAGE,
      url: APP_LINK_URL,
    });
  } catch {}
}
import { showVibezAlert } from '@/components/VibezAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path as SvgPath } from 'react-native-svg';
import {
    clearSession,
    deleteAccount,
    getLastLoginEmail,
    getToken,
    getUserEmail,
    login,
    signup,
    VZ_BACKEND_URL,
} from '../../services/auth';
import {
    isAppleSignInAvailable,
    isGoogleSignInAvailable,
    signInWithApple,
    signInWithGoogle,
} from '@/services/social-auth';

type Mode = 'login' | 'signup';

/* Press-scale feedback — same recipe as StartCard in breath-welcome.tsx
   (critically-damped spring on release, no bounce on press-in). Used
   throughout this file's tappable cards/rows/CTAs so every one of them
   gets the same tactile feedback without repeating the hook boilerplate
   at every call-site (this file has ~30 such elements). Purely additive:
   forwards every prop unchanged, only swaps Pressable->AnimatedPressable
   and appends the scale transform to the style array. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/* Operator ("kijk alle CTA's na, daar ook niet overal toegepast"): audit
   vond dat deze gedeelde wrapper (~30 call-sites in dit bestand) enkel
   scale animeerde — huisstijl §5 vraagt scale(.97 à .95)+opacity(.85)
   sámen, plus een lichte haptic-tik op het moment van indrukken
   (onPressIn, niet onPress/dieper in de handler — dat was de andere
   terugkerende fout in de rest van de app). Beide nu hier toegevoegd,
   op de gedeelde plek zodat elke call-site het automatisch meekrijgt. */
function PressScale({
  style,
  children,
  scaleTo = 0.95,
  ...rest
}: ComponentProps<typeof Pressable> & { scaleTo?: number }) {
  const pressScale = useSharedValue(1);
  const onPressIn: NonNullable<ComponentProps<typeof Pressable>['onPressIn']> = (e) => {
    pressScale.value = withTiming(scaleTo, { duration: 80 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rest.onPressIn?.(e);
  };
  const onPressOut: NonNullable<ComponentProps<typeof Pressable>['onPressOut']> = (e) => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
    rest.onPressOut?.(e);
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: 1 - (1 - pressScale.value) * 3,
  }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, pressStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/* Externe URL voor bracelet-purchase (operator-keuze 2026-05-26).
   Webapp shop covered ook Kickstarter-reservering pre-launch en
   reguliere purchase post-launch — één URL voor beide stadia. */
const BRACELET_SHOP_URL = 'https://www.vibezcore.com/shop';

/* Support-form op de webapp (Wix). Geen native endpoint nodig — link out. */
const SUPPORT_URL = 'https://www.vibezcore.com/support';

/* Forgot-password-flow draait volledig op de webapp (auth-flow met
   email-link → reset-password.html → webapp login). De native app
   linkt door zodat user 'm daar afhandelt en daarna terugkomt naar
   de Account-tab om in te loggen. */
const FORGOT_PASSWORD_URL = 'https://app.vibezcore.com/forgot-password.html';

/* Audio-library scrolt naar pricing-block via scroll-intent (`pricing`).
   Bestaand patroon — gebruikt al voor "library-settings"-link. */

/* External link helper — primair via WebBrowser (Custom Tab op Android,
   SFSafariViewController op iOS), fallback naar Linking wanneer
   WebBrowser cancelled wordt. Zelfde patroon als (tabs)/bracelet.tsx
   en (tabs)/index.tsx — bewust gedupliceerd ipv shared util omdat
   log-paden subtiel anders zijn per call-site. */
async function openExternal(url: string): Promise<void> {
  if (__DEV__) console.log('[VIBEZCORE] account openExternal →', url);
  try {
    const result = await WebBrowser.openBrowserAsync(url);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      if (__DEV__) console.log('[VIBEZCORE] WebBrowser cancelled — fallback Linking');
      await Linking.openURL(url);
    }
  } catch (e) {
    if (__DEV__) console.log('[VIBEZCORE] WebBrowser threw — fallback Linking:', e);
    await Linking.openURL(url);
  }
}

/* Het officiële Google "G"-logo (Google Identity brand-asset, 18×18
   viewBox, de vier merkkleuren) — geen platte letter (operator, 11
   augustus 2026: "moet een officiële google logo zijn de cta continue
   with google"). */
function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <SvgPath
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <SvgPath
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <SvgPath
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
      />
      <SvgPath
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </Svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Profile — opbouw zoals Apple (operator, 7 okt 2026: "profile tab volledig
   updaten, hoe zou Apple het doen").

   Eén grote titel, daaronder gegroepeerde lijsten (zoals Instellingen /
   het App Store-account): donkere afgeronde blokken, dunne scheidingslijnen,
   een pijltje rechts. Iconen wit, kleur enkel voor status (Bio-Teal), geen
   Signal Blue (enkel haptics), geen verkoopkaarten of stickers — wat je
   hebt, en één regel naar wat je nog kan krijgen.
   ───────────────────────────────────────────────────────────────────────── */

const STATUS = AudioAccentLight;
const ROW_ICON = 'rgba(255,255,255,0.82)';
const DESTRUCTIVE = '#ff6b6b';

type RowIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  const items = Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return (
    <View style={g.group}>
      {title ? <Text style={g.groupTitle}>{title}</Text> : null}
      <View style={g.groupBox}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={g.sep} /> : null}
            {child}
          </View>
        ))}
      </View>
      {footer ? <Text style={g.groupFooter}>{footer}</Text> : null}
    </View>
  );
}

function Row({
  icon: Icon,
  title,
  subtitle,
  value,
  valueTone,
  onPress,
  destructive,
  busy,
  open,
  accessibilityLabel,
}: {
  open?: boolean;
  icon?: RowIcon;
  title: string;
  subtitle?: string;
  value?: string;
  valueTone?: 'status' | 'warn';
  onPress?: () => void;
  destructive?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {Icon ? (
        <View style={g.rowIcon}>
          <Icon size={19} color={destructive ? DESTRUCTIVE : ROW_ICON} strokeWidth={2} />
        </View>
      ) : null}
      <View style={g.rowText}>
        <Text style={[g.rowTitle, destructive && { color: DESTRUCTIVE }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={g.rowSub}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text
          style={[
            g.rowValue,
            valueTone === 'status' && { color: STATUS },
            valueTone === 'warn' && { color: '#f5b54a' },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {busy ? (
        <ActivityIndicator color="rgba(255,255,255,0.5)" size="small" />
      ) : onPress && !destructive ? (
        <View style={open ? { transform: [{ rotate: '90deg' }] } : undefined}>
          <ChevronRight size={17} color="rgba(255,255,255,0.3)" strokeWidth={2.2} />
        </View>
      ) : null}
    </>
  );
  if (!onPress) return <View style={g.row}>{content}</View>;
  return (
    <PressScale
      style={g.row}
      onPress={onPress}
      scaleTo={0.98}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {content}
    </PressScale>
  );
}

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Korte status voor de kop en de Membership-rij. */
function useMembershipStatus() {
  const { isPro, tier, validUntil, willRenew, isLoading, braceletModel } = useSubscription();
  const isBraceletOwner = useBraceletOwner();
  const tierLabel = braceletModel === 'bundle' ? 'Full Bundle' : tier === 'yearly' ? 'Yearly' : tier === 'monthly' ? 'Monthly' : null;
  const date = fmtDate(validUntil);
  const renewLine = date ? (willRenew ? `Renews on ${date}` : `Active until ${date}`) : null;
  let label: string;
  if (isLoading) label = 'Checking…';
  else if (isPro) label = tierLabel ? `Premium · ${tierLabel}` : 'Premium';
  else if (isBraceletOwner) label = 'Bracelet';
  else label = 'Free';
  return { isPro, tier, isLoading, braceletModel, isBraceletOwner, label, renewLine };
}

/** Kop voor ingelogde gebruikers: initialen, e-mail, status. */
function ProfileHeader({ email }: { email: string }) {
  const { label, isPro } = useMembershipStatus();
  const initial = (email.trim()[0] || 'V').toUpperCase();
  return (
    <View style={g.header}>
      <View style={g.avatar}>
        <Text style={g.avatarTxt}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={g.headerEmail} numberOfLines={1}>
          {email}
        </Text>
        <Text style={[g.headerStatus, isPro && { color: STATUS }]}>{label}</Text>
      </View>
    </View>
  );
}

function MembershipGroup({ onRestore, restoring }: { onRestore: () => void; restoring: boolean }) {
  const { isPro, tier, isLoading, braceletModel, isBraceletOwner, renewLine } = useMembershipStatus();
  return (
    <Group title="Membership">
      {isPro ? (
        <Row
          icon={Crown}
          title="VIBEZCORE Premium"
          subtitle={renewLine ?? 'Breathwork, State Control and the Audio Library'}
          value="Manage"
          onPress={() => openExternal(storeSubscriptionsUrl(tier))}
          accessibilityLabel="Manage your subscription in the App Store or Google Play"
        />
      ) : (
        <Row
          icon={Crown}
          title="VIBEZCORE Premium"
          subtitle={
            isBraceletOwner
              ? 'Add Breathwork, State Control and the Audio Library'
              : 'Breathwork, State Control and the Audio Library'
          }
          onPress={() => router.navigate('/subscribe' as never)}
          accessibilityLabel="Go Premium — unlock Breathwork, State Control and the Audio Library"
        />
      )}
      {!isLoading && isPro && tier === 'monthly' && braceletModel !== 'bundle' ? (
        <Row
          icon={Repeat}
          title="Switch to Yearly"
          subtitle="Change your plan in the Play Store"
          onPress={() => openExternal(storeSubscriptionsUrl('yearly'))}
        />
      ) : null}
      <Row
        icon={RotateCcw}
        title={restoring ? 'Restoring…' : 'Restore Purchases'}
        onPress={onRestore}
        busy={restoring}
        accessibilityLabel="Restore previous purchases"
      />
    </Group>
  );
}

function ProductsGroup() {
  const isBraceletOwner = useBraceletOwner();
  const isActivated = useDevBraceletActivated();
  if (isBraceletOwner && !isActivated) {
    return (
      <Group title="Products">
        <Row
          icon={Package}
          title="Activate your bracelet"
          subtitle="Enter your 12-character activation code"
          value="Required"
          valueTone="warn"
          onPress={() => router.navigate('/activate-bracelet' as never)}
        />
      </Group>
    );
  }
  if (isBraceletOwner) {
    return (
      <Group title="Products">
        <Row
          icon={BraceletIcon}
          title="Session Control"
          subtitle="Your bracelet is activated"
          onPress={() => router.navigate('/bracelet' as never)}
          accessibilityLabel="Open Session Control"
        />
        <Row icon={Package} title="Order new beadband" onPress={() => openExternal(BRACELET_SHOP_URL)} />
      </Group>
    );
  }
  return (
    <Group title="Products">
      <Row
        icon={Package}
        title="Activate your product"
        subtitle="Bracelet or Full Bundle code"
        onPress={() => router.navigate('/activate-bracelet' as never)}
        accessibilityLabel="Activate your Bracelet or Full Bundle code"
      />
      <Row
        icon={BraceletIcon}
        title="Smart Bead Bracelet"
        subtitle="Launching Fall 2026"
        onPress={() => router.navigate('/smart-bead-bracelet' as never)}
      />
    </Group>
  );
}

function SupportGroup() {
  return (
    <Group title="Settings & support">
      <Row icon={SettingsIcon} title="Settings" onPress={() => router.navigate('/settings' as never)} accessibilityLabel="Open settings" />
      <Row icon={UserPlus} title="Invite a friend" onPress={() => void shareInvite()} accessibilityLabel="Invite a friend to VIBEZCORE" />
      <Row icon={HelpCircle} title="FAQ" onPress={() => router.navigate('/faq' as never)} accessibilityLabel="Browse frequently asked questions" />
      <Row icon={MessageCircle} title="Contact support" onPress={() => router.navigate('/support' as never)} accessibilityLabel="Contact VIBEZCORE support" />
    </Group>
  );
}

const LEGAL_DOCS: { doc: string; title: string }[] = [
  { doc: 'terms', title: 'Terms of Use' },
  { doc: 'privacy', title: 'Privacy Policy' },
  { doc: 'shipping', title: 'Shipping Policy' },
  { doc: 'refund', title: 'Refund & Returns' },
  { doc: 'health', title: 'Consumer Health Notice' },
  { doc: 'audio-sessions', title: 'Audio Sessions' },
  { doc: 'cookies', title: 'Cookie Policy' },
  { doc: 'accessibility', title: 'Accessibility Statement' },
];

function AboutLegalGroups() {
  return (
    <>
      <Group title="About">
        <Row icon={Info} title="About VIBEZCORE" onPress={() => router.navigate('/about' as never)} accessibilityLabel="Learn about VIBEZCORE" />
      </Group>
      <Group title="Legal">
        {LEGAL_DOCS.map((d) => (
          <Row
            key={d.doc}
            title={d.title}
            onPress={() =>
              router.navigate({ pathname: '/legal/[doc]' as never, params: { doc: d.doc } as never })
            }
          />
        ))}
      </Group>
      <Text style={g.version}>
        {`VIBEZCORE ${Constants.expoConfig?.version ?? ''}`.trim()}
      </Text>
    </>
  );
}

const g = StyleSheet.create({
  title: {
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 34,
    letterSpacing: -0.6,
    marginTop: 12,
    marginBottom: 18,
  },
  group: { marginBottom: 26 },
  groupTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginLeft: 16,
    marginBottom: 8,
  },
  groupBox: { backgroundColor: '#1C1C1E', borderRadius: 14, overflow: 'hidden' },
  groupFooter: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    marginHorizontal: 16,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 11, paddingHorizontal: 16 },
  rowIcon: { width: 24, alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { color: '#ffffff', fontFamily: BrandFonts.medium, fontSize: 16 },
  rowSub: { color: 'rgba(255,255,255,0.5)', fontFamily: BrandFonts.regular, fontSize: 13, lineHeight: 17, marginTop: 2 },
  rowValue: { color: 'rgba(255,255,255,0.5)', fontFamily: BrandFonts.medium, fontSize: 15, maxWidth: 140 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 26,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,163,163,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 22 },
  headerEmail: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 17 },
  headerStatus: { color: 'rgba(255,255,255,0.55)', fontFamily: BrandFonts.medium, fontSize: 14, marginTop: 3 },
  version: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
});

export default function AccountScreen() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  /* Iter 9dq v17 (2026-06-02): dynamic safe-area inset. Voorheen had de
     ScrollView hardcoded paddingBottom: 48 wat op iOS 15+ devices met
     groot home-indicator (tot 34px) onvoldoende kon zijn. Met tab-bar
     (64px) eronder was 't praktisch ok, maar 't was niet future-proof.
     Nu dynamisch zodat content altijd boven safe-zone blijft. */
  const safeInsets = useSafeAreaInsets();

  /* Iter 9dq v110 (2026-06-04): scroll-ref voor signed-out KeyboardAware-
     ScrollView. Listent op scroll-intent 'account-top' (gefired vanuit
     Audio Library bottom "Sign in"-link) en scrollt naar top zodat de
     guest meteen de SIGN IN-card ziet i.p.v. een preserved scroll-
     positie van een vorige bezoek. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedOutScrollRef = useRef<any>(null);
  useEffect(() => {
    const scrollToTop = () => {
      requestAnimationFrame(() => {
        signedOutScrollRef.current?.scrollToPosition?.(0, 0, false);
      });
    };
    /* Cold-start: intent kan al gezet zijn voordat deze listener leeft. */
    if (consumeScrollIntent() === 'account-top') {
      setAuthOpen(true);
      scrollToTop();
    }
    const unsub = subscribeScrollIntent((target) => {
      if (target === 'account-top') {
        setAuthOpen(true);
        scrollToTop();
      }
    });
    return unsub;
  }, []);

  const [mode, setMode] = useState<Mode>('login');
  /* Uitgelogd: het inlogformulier klapt open onder de "Sign in"-rij (7 okt 2026). */
  const [authOpen, setAuthOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [showPw, setShowPw] = useState(false);
  /* Iter 9dq v86 (2026-06-03): restore-purchases state. Apple/Google
     verplichten zo'n knop voor IAP-apps zodat users hun sub kunnen
     herstellen na reinstall of op een nieuw toestel. */
  const [restoring, setRestoring] = useState(false);

  /* Iter v149 (2026-06-25): social sign-in op de Account-tab login,
     mirror van subscribe.tsx. Eerder was social-auth alleen via
     /subscribe → inconsistent voor users die via Account willen inloggen
     zonder eerst een pricing-card te tikken. */
  const googleAvailable = isGoogleSignInAvailable();
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const a = await isAppleSignInAvailable();
      if (!cancelled) setAppleAvailable(a);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Iter v227 (2026-07-07, audit A5): post-signin routing per user-type.
     Voorheen: Google/Apple altijd naar `/` → bracelet-only user landde op
     Audio ipv Bracelet-tab. Nu: zelfde entitlement-check als email/password
     flow. Delegeert naar routeByEntitlement() na state-updates. */
  const routeByEntitlement = async () => {
    let isBraceletPro = false;
    let isAudioPro = false;
    try {
      const token = await getToken();
      if (token) {
        const res = await fetch(`${VZ_BACKEND_URL}/api/subscription-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const status = await res.json().catch(() => ({}));
          isAudioPro = status?.active === true;
          isBraceletPro = status?.has_bracelet_activated === true;
        }
      }
    } catch { /* network hiccup — val terug op override */ }
    if (!isAudioPro && !isBraceletPro) {
      await awaitDevUserOverrideLoaded();
      const override = getDevUserOverride();
      isBraceletPro = override === 'bracelet' || override === 'pro';
      if (override === 'pro') isAudioPro = true;
    }
    if (isBraceletPro && !isAudioPro) {
      setTimeout(() => router.replace('/bracelet' as never), 50);
    } else {
      /* Zelfde correctie als bij het inloggen: `/` is de verborgen
         audiotab, de Breath-tab is waar iemand zonder bracelet hoort te
         landen. */
      setTimeout(() => router.replace('/breath' as never), 50);
    }
  };

  const onGoogleSignIn = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const r = await signInWithGoogle();
      if (!r.ok) {
        if (r.reason === 'cancelled') return;
        setMsg(r.error);
        return;
      }
      setEmail(r.email || 'Signed in');
      setPwInput('');
      /* Iter v229 (2026-07-08): expliciet cache-clear vóór refresh om
         free-environment flash te voorkomen bij login met bestaand PRO. */
      setSigningInStatus();
      await refreshSubscription();
      /* Iter v232 (2026-07-09): silent auto-restore. Na herinstall / verse
         install met bestaand account was handmatige "Restore purchases"-tap
         nodig om Play Store sub op te pikken — geen enkele user weet dat.
         Nu: fire-and-forget na login → RC customerInfo sync + backend
         refresh → PRO-state komt automatisch binnen. */
      /* v237c ROLLBACK v232: silent auto-restore uit login verwijderd.
         Reden: op device met actieve Play Store sub van andere VIBEZCORE-
         user (multi-user, refurbished, test-omgeving) trok silent restore
         die sub AUTOMATISCH naar de nieuwe VIBEZCORE-account. Ronde 21B
         + vC 76 verse +audio93 test bewees het lek — zelfs met v236
         already_owned error was er een tweede attributie-pad via RC's
         auto-TRANSFER bij logIn.
         Nu: user moet expliciet Restore Purchases tikken via Account tab
         als hij zijn bestaande sub wil hertrekken. Trade-off: post-
         reinstall UX minder soepel (extra tap), maar security lek dicht. */
      // silentRestoreAfterLogin();  // <-- disabled voor launch
      await refreshUserBucket();
      await clearLastPlayed();
      clearSignedUrlCache();
      /* Iter v227: entitlement-based routing (was: altijd '/') */
      await routeByEntitlement();
    } finally {
      setBusy(false);
    }
  };

  const onAppleSignIn = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const r = await signInWithApple();
      if (!r.ok) {
        if (r.reason === 'cancelled') return;
        setMsg(r.error);
        return;
      }
      setEmail(r.email || 'Signed in');
      setPwInput('');
      /* Iter v229 (2026-07-08): expliciet cache-clear vóór refresh om
         free-environment flash te voorkomen bij login met bestaand PRO. */
      setSigningInStatus();
      await refreshSubscription();
      /* Iter v232 (2026-07-09): silent auto-restore — zie Google-pad. */
      /* v237c ROLLBACK v232: silent auto-restore uit login verwijderd.
         Reden: op device met actieve Play Store sub van andere VIBEZCORE-
         user (multi-user, refurbished, test-omgeving) trok silent restore
         die sub AUTOMATISCH naar de nieuwe VIBEZCORE-account. Ronde 21B
         + vC 76 verse +audio93 test bewees het lek — zelfs met v236
         already_owned error was er een tweede attributie-pad via RC's
         auto-TRANSFER bij logIn.
         Nu: user moet expliciet Restore Purchases tikken via Account tab
         als hij zijn bestaande sub wil hertrekken. Trade-off: post-
         reinstall UX minder soepel (extra tap), maar security lek dicht. */
      // silentRestoreAfterLogin();  // <-- disabled voor launch
      await refreshUserBucket();
      await clearLastPlayed();
      clearSignedUrlCache();
      /* Iter v227: entitlement-based routing (was: altijd '/') */
      await routeByEntitlement();
    } finally {
      setBusy(false);
    }
  };

  const onRestorePurchases = async () => {
    if (restoring) return;
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.ok) {
      if (result.restoredCount > 0) {
        void showVibezAlert({
          title: 'Subscription restored',
          message: `${result.restoredCount} active subscription${result.restoredCount === 1 ? '' : 's'} restored to your account.`,
        });
      } else if (result.accountMismatch) {
        /* Iter v168 (2026-06-28): vermijd tegenstrijdige UI 'Audio PRO Monthly'
           + 'Nothing to restore'. Mismatch = Play Store/Apple ID op device ≠
           VIBEZCORE account dat de aankoop deed. */
        void showVibezAlert({
          title: 'Active on your account, not on this device',
          message:
            "Your VIBEZCORE subscription is active, but the Google Play (or Apple ID) account on this device doesn't show the purchase. Switch to the account you used to subscribe, then tap Restore purchases again.",
        });
      } else {
        void showVibezAlert({
          title: 'Nothing to restore',
          message:
            'No active subscriptions were found for this Apple ID or Google account. If you believe this is wrong, contact support.',
        });
      }
    } else {
      void showVibezAlert({ title: 'Could not restore', message: result.error });
    }
  };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /* Iter 9dq v150 (operator 2026-06-17): gumroadSubscriberId weg —
     IAP-only, geen cancel-button meer in-app (Apple/Google handelen
     cancellation via storeSubscriptionsUrl). isProForActions blijft
     bestaan want andere code-paden checken hier nog op. */
  const { isPro: isProForActions } = useSubscription();

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) {
        setEmail((await getUserEmail()) || 'Signed in');
      } else {
        /* Niet ingelogd → pre-fill het email-veld met de laatst-gebruikte
           login-email als die bekend is. Overleeft explicit sign-out
           (vz_last_login_email persistent key). User hoeft alleen nog
           het wachtwoord te typen voor re-login. */
        const lastEmail = await getLastLoginEmail();
        if (lastEmail) setEmailInput(lastEmail);
      }
      setLoading(false);
    })();
  }, []);

  const onSubmit = async () => {
    setMsg(null);
    if (!emailInput.trim() || !pwInput) {
      setMsg('Enter your email and password.');
      return;
    }
    /* Iter v144 (2026-06-24): strikte email-validatie. Voorkomt incident
       waarbij typo-emails (`@gmail.comn`) een Supabase-account aanmaken
       dat de user nooit meer kan verifieren. Zelfde util als subscribe.tsx. */
    const v = validateEmail(emailInput);
    if (v.ok === false) {
      setMsg(
        v.reason === 'format'
          ? "That email address doesn't look right — check the spelling."
          : 'Enter your email address.',
      );
      return;
    }
    if (v.ok === 'maybe') {
      setMsg(`Did you mean ${v.suggestion}? Check spelling and try again.`);
      return;
    }
    setBusy(true);
    try {
      const fn = mode === 'login' ? login : signup;
      const r = await fn(emailInput.trim(), pwInput);
      if (r.ok) {
        setEmail(r.email || 'Signed in');
        setPwInput('');
        /* Iter v177 (2026-07-02): AWAIT refreshSubscription vóór verdere state.
           Vermijdt race conditie waarbij user snel doorklikt naar Subscribe of
           Audio Library terwijl subscription-cache nog stale is.
           Iter v229 (2026-07-08): eerst cache-clear om free-flash te
           voorkomen bij PRO-account login. */
        setSigningInStatus();
        await refreshSubscription();
        /* Iter v232 (2026-07-09): silent auto-restore na login (email/pwd
           pad). Symmetrisch met Google/Apple paden — dekt post-reinstall
           UX zonder handmatige Restore-tap. */
        if (mode === 'login') {
          /* v237c ROLLBACK v232: silent auto-restore uit login verwijderd.
         Reden: op device met actieve Play Store sub van andere VIBEZCORE-
         user (multi-user, refurbished, test-omgeving) trok silent restore
         die sub AUTOMATISCH naar de nieuwe VIBEZCORE-account. Ronde 21B
         + vC 76 verse +audio93 test bewees het lek — zelfs met v236
         already_owned error was er een tweede attributie-pad via RC's
         auto-TRANSFER bij logIn.
         Nu: user moet expliciet Restore Purchases tikken via Account tab
         als hij zijn bestaande sub wil hertrekken. Trade-off: post-
         reinstall UX minder soepel (extra tap), maar security lek dicht. */
      // silentRestoreAfterLogin();  // <-- disabled voor launch
        }
        /* Iter 9dn (2026-05-31): history-bucket re-evalueren — nieuwe
           token = potentieel nieuwe user = andere local-storage key.
           Iter 9dq v55 (2026-06-03, audit C5+C6): AWAIT zodat bucket
           switch echt klaar is voordat user op de Audio Library kan
           interacten. Anders schreef een snelle toggle nog naar de
           anon-bucket en lekte data tussen sessies. */
        await refreshUserBucket();
        /* Iter 9dq v158 (operator-fix 2026-06-18): last-played wissen bij
           login zodat de Continue-listening popup nooit een sessie van
           de vorige user op dit toestel toont aan de nieuwe user. Vorige
           pad (sign-out) deed dit al, maar account-switch zonder
           tussentijdse sign-out (gebruiker A blijft ingelogd → gebruiker
           B logt in met andere creds) miste de cleanup. */
        await clearLastPlayed();

        /* ── Post-login routing ────────────────────────────────────────
           Iter 9dq v96 (2026-06-03): differentiated routing per user-type.
           Operator-spec:
             - SIGN-UP (eerste keer)        → blijf op /account
                 → user ziet meteen "Activation required" + activate-CTA
             - LOGIN + Bracelet PRO         → /bracelet
                 → returning bracelet-owner landt direct bij z'n bracelet
             - LOGIN + Audio PRO            → /         (Audio Library)
             - LOGIN + Full PRO             → /bracelet (bracelet is premium)
             - LOGIN + Free                 → /         (Audio Library)

           Bracelet-ownership-detectie in dev:
             - Synchroon via getDevUserOverride() (cache is geladen door
               loadOnce() bij module-import; awaitDevUserOverrideLoaded
               is een safety-net voor cold-start race).

           Productie-pad (na backend-endpoint):
             - useSubscription cache lezen na refreshSubscription:
               const hasBracelet = cachedStatus?.has_bracelet_activated;
             - cachedStatus is module-level in useSubscription.ts;
               getter exporteren wanneer endpoint live is.

           setTimeout 50ms zodat React eerst de state-updates van
           setEmail/setPwInput commit; voorkomt edge-cases waar de
           component-rerender met de oude (login-form) view nog draait
           wanneer de nav fired. router.replace ipv navigate: clear de
           account-tab-stack zodat back-knop niet terug naar het login-
           formulier gaat. */
        /* Iter v153 (2026-06-25): productie-pad entitlement check via
           backend ipv dev-override. Operator-feedback: 'na ingelogd zijn
           moet bezoeker naar juiste pagina, audio owner audio bracelet
           owner bracelet'. Dev-override blijft beschikbaar als fallback
           voor testing. */
        let isBraceletPro = false;
        let isAudioPro = false;
        try {
          const token = await getToken();
          if (token) {
            const res = await fetch(`${VZ_BACKEND_URL}/api/subscription-status`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const status = await res.json().catch(() => ({}));
              isAudioPro = status?.active === true;
              isBraceletPro = status?.has_bracelet_activated === true;
            }
          }
        } catch {
          /* network hiccup — val terug op dev-override hieronder */
        }
        if (!isAudioPro && !isBraceletPro) {
          await awaitDevUserOverrideLoaded();
          const override = getDevUserOverride();
          isBraceletPro = override === 'bracelet' || override === 'pro';
          if (override === 'pro') isAudioPro = true;
        }

        if (mode === 'signup') {
          /* Sign-up: blijf op /account. User ziet nu de signed-in view
             met BraceletCard (Activation required) of subscription-card,
             en kan vandaaruit de juiste eerstvolgende stap nemen
             (bracelet activeren / audio upgraden). */
          /* no redirect — gewoon de huidige view re-renderen */
        } else if (isBraceletPro && !isAudioPro) {
          /* Bracelet-only owner → direct naar Bracelet tab. */
          setTimeout(() => router.replace('/bracelet' as never), 50);
        } else {
          /* Iedereen zonder bracelet → de Breath-tab. Route `/` is de
             VERBORGEN audiobibliotheek; die stuurt zelf wel door, maar dan
             flitst er eerst een leeg scherm — rechtstreeks is gewoon
             juist. */
          setTimeout(() => router.replace('/breath' as never), 50);
        }
      } else {
        setMsg(r.error);
      }
    } finally {
      setBusy(false);
    }
  };

  /* Sign Out met confirmation-dialog. Voorkomt accidentele 1-tap sign-
     outs (operator-feedback 2026-05-25: "lastig om telkens opnieuw in
     te moeten loggen"). Default-knop is Cancel zodat onbedoelde tap geen
     consequenties heeft. "Sign out" is destructive-style op iOS → rood
     gerendered ter visuele waarschuwing. */
  const onSignOut = () => {
    void showVibezAlert({
      title: 'Sign out?',
      message:
        'You will stay signed in on this device unless you sign out. After signing out, you will need to enter your password again next time.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            /* Iter v227 (2026-07-07, audit A6): stop actieve audio + bracelet
               VOORDAT session gewist wordt. Voorheen: playback bleef doorlopen
               na sign-out met dode tokens; bracelet-mode bleef actief zodat
               een volgende user op dit toestel de vorige sessie zag. Beide
               calls swallow errors — mogen sign-out nooit blokkeren. */
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { unload } = require('@/services/audio-player');
              await unload({ skipSave: true }).catch(() => {});
            } catch { /* non-fatal */ }
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { getBracelet } = require('@/services/bracelet');
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { BleCommand } = require('@/services/ble-contract');
              await getBracelet()
                .sendCommand({ mode: 0, duration: 0, command: BleCommand.Stop })
                .catch(() => {});
            } catch { /* non-fatal */ }

            await clearSession();
            /* Iter 9dq v99 (2026-06-04): bij sign-out óók dev-overrides
               wissen. Anders bleef de override (bv 'bracelet') hangen
               terwijl Account 'uitgelogd' toonde — andere tabs (Bracelet,
               Audio) toonden nog steeds de PRO-omgeving = inconsistent.
               Productie kent dit probleem niet (overrides bestaan daar
               niet); puur dev-hygiene zodat sign-out altijd in een
               schone 'echte gast'-staat eindigt. Re-test als PRO?
               Settings → Override opnieuw zetten. */
            if (__DEV__) {
              await setDevUserOverride(null);
              await setDevBraceletActivated(false);
            }
            setEmail(null);
            setEmailInput('');
            setPwInput('');
            /* Iter v170 (2026-06-28): synchroon notify {active:false} ipv
               refreshSubscription() dat een async fetchStatus afwacht.
               Voorheen: na sign-out bleef Audio Library de PRO-rendering
               vasthouden (geen Free Picks tile) totdat fetchStatus voltooide
               of, bij RC SDK cache stale, tot app-restart. Operator zag dit
               direct: "Free Picks card komt pas terug na app afsluiten". */
            setSignedOutStatus();
            /* Iter 9dn (2026-05-31): history-bucket re-evalueren — geen
               token meer → schakelt naar 'anon' bucket, voormalige user's
               history blijft staan onder hun eigen key (niet gewist).
               Iter 9dq v55 (2026-06-03, audit C5+C6): AWAIT zodat de
               bucket-switch klaar is voordat we de in-memory cleanups
               (clearSignedUrlCache, clearLastPlayed) firen — zonder
               await kon een vroege re-render nog op de oude bucket
               schrijven. */
            await refreshUserBucket();
            /* Wis ook de in-memory signed-URL cache zodat een volgende user
               op dit toestel geen leftover-URLs van vorige sessie krijgt. */
            clearSignedUrlCache();
            /* Continue-card op de library mag geen sessie van de vorige
               user tonen aan de volgende user op dit toestel. */
            clearLastPlayed();
            /* Email-veld pre-fillen met laatst-gebruikte email zodat
               re-login alleen wachtwoord vergt (LAST_EMAIL_KEY overleeft
               clearSession). */
            const lastEmail = await getLastLoginEmail();
            if (lastEmail) setEmailInput(lastEmail);
            /* Iter v199 (2026-07-04): na sign-out expliciet naar welkomst-
               scherm. Anders bleef user in Account-tab uitgelogde variant
               (Subscribe + Reserve + Invite) — operator vond dit
               onprofessioneel want de app "onthield" niet dat de user
               net was afgemeld. Welkomstscherm geeft duidelijk pad terug
               naar sign-in of nieuwe onboarding. */
            router.replace('/welcome' as never);
          },
        },
      ],
    });
  };

  /* ── Cancel Subscription verwijderd ──
     Iter 9dq v150 (operator 2026-06-17): Apple/Google policy verbiedt
     in-app subscription cancellation voor IAP-content. Cancellation
     gaat via Settings → Apple ID → Subscriptions (iOS) of Play Store →
     Subscriptions (Android). De "Manage subscription"-knop bovenaan
     deze tab opent dat OS-scherm via storeSubscriptionsUrl(). */

  /* ── Change Password ──
     Routeert door naar de webapp forgot-password flow (Supabase recovery
     email → reset-password.html → opnieuw in app inloggen met nieuw
     password). Webapp handelt het volledige proces af; native app is
     alleen de launcher. */
  /* Change password — directe in-app flow voor ingelogde users die
     hun bekende password willen wijzigen (anders dan /forgot-password
     wat een email-reset is voor vergeten passwords). Operator-keuze
     2026-05-30: voorheen ging deze route via een alert naar de forgot
     flow — overdreven voor users die gewoon hun password willen
     veranderen. */
  const onChangePassword = () => {
    router.navigate('/change-password' as never);
  };

  /* ── Delete Account ──
     Iter v145 (2026-06-25): self-service delete, Apple/Google policy.
     Vervangt de oude "open support form"-flow die NIET aan Apple
     Guideline 5.1.1(v) voldeed. Twee-staps confirm zodat een accident-
     tap niet alles wist. Backend doet de echte Supabase admin delete,
     daarna clearSession + replace('/') zodat user landt in de gast-app. */
  const onDeleteAccount = () => {
    void showVibezAlert({
      title: 'Delete account?',
      message:
        "This will permanently remove your VIBEZCORE account, listening history, favorites, and saved settings.\n\nIf you have an active subscription, this does NOT cancel it — you must cancel via Google Play (or App Store) Subscriptions separately.\n\nThis cannot be undone.",
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            /* Tweede confirm voor zekerheid — destructive action waar
               we niet van terug kunnen. */
            void showVibezAlert({
              title: 'Are you sure?',
              message:
                'Last chance to cancel. Once deleted, your account cannot be recovered.',
              buttons: [
                { text: 'Keep my account', style: 'cancel' },
                {
                  text: 'Yes, delete',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(true);
                    const r = await deleteAccount();
                    setBusy(false);
                    if (r.ok) {
                      /* App-state cleanup mirror van sign-out — bracelet
                         override, last-played, etc. */
                      if (__DEV__) {
                        await setDevUserOverride(null);
                        await setDevBraceletActivated(false);
                      }
                      setEmail(null);
                      setEmailInput('');
                      setPwInput('');
                      await clearLastPlayed();
                      await clearSignedUrlCache();
                      /* Iter v170: synchroon FREE-marker, identiek aan
                         sign-out flow — voorkomt UI dat PRO-rendering
                         vasthoudt na delete. */
                      setSignedOutStatus();
                      void showVibezAlert({
                        title: 'Account deleted',
                        message: 'Your account has been permanently deleted.',
                        buttons: [
                          {
                            text: 'OK',
                            onPress: () => router.replace('/'),
                          },
                        ],
                      });
                    } else {
                      void showVibezAlert({
                        title: 'Could not delete account',
                        message: r.error,
                      });
                    }
                  },
                },
              ],
            });
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, s.center]}>
        <ActivityIndicator color={C.text} />
      </SafeAreaView>
    );
  }

  /* Signed-in view. KeyboardAwareScrollView ipv KeyboardAvoidingView —
     laatstgenoemde gaf op Android + expo-router bottom tabs een race-
     condition tussen tab-bar-resize en keyboard-animation (operator-
     bevestigd 2026-05-20: "trillen + zwart scherm"). Pure-JS package,
     geen native rebuild nodig. Future-proof voor activatiecode-input. */
  if (email) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
        <KeyboardAwareScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: Math.max(safeInsets.bottom + 24, 72) }]}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={20}
          enableAutomaticScroll={true}
        >
          {/* Operator, 15 september 2026: GradientText (wit→blauw verloop,
              gebouwd voor een donkere achtergrond — zie GradientText.tsx)
              vervangen door platte tekst, anders onzichtbaar op de nieuwe
              lichte pagina. Sentence case i.p.v. ALL CAPS, per het Apple-
              font-framework (14 september 2026) dat elders in de app al
              is doorgevoerd. `screenTitle` blijft ongewijzigd: die haalt
              al `TypeScale.tabHeader` op, de ene bron voor de pagina-
              titel-rol op alle 4 tabs (operator, 11 september 2026). */}
          <Text style={g.title}>Profile</Text>
          <ProfileHeader email={email} />
          <MembershipGroup onRestore={() => void onRestorePurchases()} restoring={restoring} />
          <ProductsGroup />
          <Group title="Account">
            <Row icon={Mail} title="Email" value={email} />
            <Row icon={KeyRound} title="Change password" onPress={onChangePassword} accessibilityLabel="Change your password" />
          </Group>
          <SupportGroup />
          <AboutLegalGroups />
          {/* Afmelden en verwijderen onderaan, apart — zoals in Instellingen. */}
          <Group footer="Deleting your account is permanent. It does not cancel an active subscription — do that in your Google Play or Apple ID settings.">
            <Row icon={LogOut} title="Sign out" onPress={onSignOut} />
            <Row icon={Trash2} title="Delete account" destructive onPress={onDeleteAccount} accessibilityLabel="Delete your account" />
          </Group>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  /* Signed-out view — optional auth, not a wall. KeyboardAwareScrollView
     scrollt automatisch naar het gefocuste TextInput zodat het niet
     onder het soft-keyboard valt. enableOnAndroid=true is essentieel:
     de library skipt anders Android (ios-only default).
     extraScrollHeight=20 geeft een buffer onder het veld zodat het
     niet pal tegen het keyboard plakt. */
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
      <KeyboardAwareScrollView
        ref={signedOutScrollRef}
        contentContainerStyle={[s.scroll, { paddingBottom: 48 + safeInsets.bottom }]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
        enableAutomaticScroll={true}
      >
        <Text style={g.title}>Profile</Text>
        <Group>
          <Row
            icon={CircleUserRound}
            title={mode === 'login' ? 'Sign in' : 'Create account'}
            subtitle="Sync your progress and unlock what you own"
            onPress={() => setAuthOpen((o) => !o)}
            open={authOpen}
            accessibilityLabel="Sign in to VIBEZCORE"
          />
        </Group>
        {authOpen ? (
        <View style={s.authCard}>
          {/* Geen eigen kop meer: de "Sign in"-rij erboven zegt het al (7 okt 2026). */}

          {/* Icoon in het veld, geen los "Email"-label erboven (operator-
              mockup, 11 augustus 2026: "exact wat je ziet" — de mockup
              heeft geen labels boven de velden, de envelop/hangslot-
              iconen IN het veld dragen die rol). */}
          <View style={s.inputIconWrap}>
            <Mail size={17} color={C.textDim} strokeWidth={2} />
            <TextInput
              style={s.inputWithIcon}
              value={emailInput}
              onChangeText={(v) => {
                setEmailInput(v);
                if (msg) setMsg(null);
              }}
              placeholder="Email address"
              placeholderTextColor={C.textDim}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>

          {/* Iter v144: live email-feedback. Toont niets bij leeg veld;
              warn bij typo (met tap-to-fix); success bij valid format. */}
          {(() => {
            if (!emailInput.trim()) return null;
            const v = validateEmail(emailInput);
            const hint = emailHintText(v);
            if (!hint.text) return null;
            const toneStyle =
              hint.tone === 'success'
                ? { color: C.success }
                : hint.tone === 'warn'
                  ? { color: '#ffb450' }
                  : hint.tone === 'error'
                    ? { color: C.error }
                    : { color: C.textDim };
            if (v.ok === 'maybe' && v.reason === 'typo') {
              return (
                <PressScale
                  onPress={() => {
                    setEmailInput(v.suggestion);
                    if (msg) setMsg(null);
                  }}
                  style={{
                    marginTop: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,180,80,0.10)',
                    borderColor: 'rgba(255,180,80,0.35)',
                    borderWidth: 1,
                    alignSelf: 'flex-start',
                  }}
                  accessibilityLabel={`Use suggested email ${v.suggestion}`}
                >
                  <Text style={[{ fontSize: 12, fontFamily: BrandFonts.medium }, toneStyle]}>
                    {hint.text}
                  </Text>
                  <Text style={{
                    fontSize: 11,
                    fontFamily: BrandFonts.bold,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: '#ffb450',
                    marginTop: 2,
                  }}>
                    Tap to use it
                  </Text>
                </PressScale>
              );
            }
            return (
              <Text style={[{ fontSize: 12, fontFamily: BrandFonts.medium, marginTop: 8 }, toneStyle]}>
                {hint.text}
              </Text>
            );
          })()}

          <View style={[s.inputIconWrap, { marginTop: 12 }]}>
            <Lock size={17} color={C.textDim} strokeWidth={2} />
            <TextInput
              style={s.inputWithIcon}
              value={pwInput}
              onChangeText={setPwInput}
              placeholder="Password"
              placeholderTextColor={C.textDim}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
            {/* Oog-icoon i.p.v. "Show"/"Hide"-tekst (operator-mockup). */}
            <PressScale
              onPress={() => setShowPw((v: boolean) => !v)}
              hitSlop={10}
              scaleTo={0.92}
            >
              {showPw ? (
                <EyeOff size={17} color={C.textDim} strokeWidth={2} />
              ) : (
                <Eye size={17} color={C.textDim} strokeWidth={2} />
              )}
            </PressScale>
          </View>

          {msg && <Text style={s.msg}>{msg}</Text>}

          {/* Forgot password VOOR de Sign In-knop, niet erna (operator-
              mockup, 11 augustus 2026: "forgot password staat klein
              rechtsboven de sign in"). */}
          <PressScale
            style={s.forgotLink}
            onPress={() => router.navigate('/forgot-password' as never)}
            accessibilityLabel="Reset your password"
          >
            <Text style={s.forgotLinkText}>Forgot password?</Text>
          </PressScale>

          <PressScale
            style={[s.primaryBtn, busy && s.btnDisabled]}
            onPress={onSubmit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#1D1D1F" />
            ) : (
              <>
                {/* Operator, 9 september 2026: "endowment effect (...) niet
                   sign up maar continue zoals duolingo" — 'Sign Up' framet
                   dit als een nieuwe, extra stap; 'Continue' framet het als
                   verdergaan met wat de user al aan het doen was (minder
                   drempel, geen nieuw "commitment" gevoel). */}
                <Text style={s.primaryBtnText}>
                  {mode === 'login' ? 'Sign In' : 'Continue'}
                </Text>
              </>
            )}
          </PressScale>

          {/* Social sign-in NA de velden (operator-mockup, 11 augustus
              2026) — was ervoor. Apple + Google naast elkaar i.p.v.
              gestapeld, zoals de mockup toont. */}
          {(googleAvailable || appleAvailable) && (
            <View style={{ marginTop: 6 }}>
              <View style={s.orDividerRow}>
                <View style={s.orDividerLine} />
                <Text style={s.orDividerText}>or</Text>
                <View style={s.orDividerLine} />
              </View>
              <View style={s.socialRow}>
                {appleAvailable && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={12}
                    style={{ flex: 1, height: 48 }}
                    onPress={() => void onAppleSignIn()}
                  />
                )}
                {googleAvailable && (
                  <PressScale
                    style={s.googleBtn}
                    onPress={() => void onGoogleSignIn()}
                  >
                    {/* Officieel Google "G"-logo, niet een platte letter
                        (operator, 11 augustus 2026: "moet een officiële
                        google logo zijn"). */}
                    <GoogleGlyph size={16} />
                    <Text style={s.googleBtnText}>Continue with Google</Text>
                  </PressScale>
                )}
              </View>
            </View>
          )}

          <Text style={s.staySignedIn}>
            You'll stay signed in on this device
          </Text>

          {/* "Don't have an account? Sign Up" ontbrak (operator, 11
              augustus 2026: "google sign in apple sign in sign up...").
              `mode` bestond al (login/signup, stuurt onSubmit naar login()
              of signup()) maar had nog geen zichtbare toggle — dit is 'm. */}
          <PressScale
            onPress={() => {
              setMode((m) => (m === 'login' ? 'signup' : 'login'));
              setMsg(null);
            }}
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: 14 }}
          >
            <Text style={s.staySignedIn}>
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <Text style={{ color: '#ffffff', fontFamily: BrandFonts.semibold }}>
                    Sign Up
                  </Text>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Text style={{ color: '#ffffff', fontFamily: BrandFonts.semibold }}>
                    Sign In
                  </Text>
                </>
              )}
            </Text>
          </PressScale>

        </View>
        ) : null}
        <MembershipGroup onRestore={() => void onRestorePurchases()} restoring={restoring} />
        <ProductsGroup />
        <SupportGroup />
        <AboutLegalGroups />

        {__DEV__ && (
          <PressScale
            onPress={() => router.navigate('/settings' as never)}
            hitSlop={12}
            style={s.devSettingsLink}
            accessibilityLabel="Open developer settings"
          >
            <Text style={s.devSettingsLinkText}>
              🔧 Developer settings (dev only)
            </Text>
          </PressScale>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },
  /* ── Iter 9iii → 9mmm: signed-out hero ──
     Brand-style hero block met "WELCOME TO" eyebrow + wordmark image
     + accent bar + sub. Conform welcome.tsx voor consistente brand-
     presence tussen Welcome screen en Account guest-view. */
  heroBlock: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
    marginBottom: 20,
  },
  heroWordmark: {
    width: 190,
    height: 30,
    marginBottom: 22,
    /* Subtle shadow voor brand-presence — matched welcome.tsx style. */
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  /* "Welcome to VIBEZCORE" als echte kop i.p.v. de oude losse
     label+wordmark+streepje-opbouw (operator-mockup, 11 augustus 2026). */
  heroGreeting: {
    /* extrabold → regular (operator, 11 augustus 2026: "wat heb ik gezegd
       over de font?" — koppen zijn de hele avond al regular-gewicht op
       Breath/Bracelet/Audio Library, deze bleef nog op het oude zware
       gewicht staan). */
    color: C.text,
    fontSize: 26,
    fontFamily: BrandFonts.regular,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSub: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  /* Card-frame voor zowel sign-in als product-sectie. Subtle bg-tint
     + hairline border = visueel één geheel per sectie. */
  /* Blauw getint i.p.v. neutraal grijs (operator-mockup, 11 augustus
     2026, close-up: "kijk hier" — de kaart draagt duidelijk een blauwe
     achtergrond + rand, niet C.panel-grijs). */
  /* Zelfde vlak als de lijsten (7 okt 2026), sluit aan onder de Sign in-rij. */
  authCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: -14,
    marginBottom: 26,
  },
  /* Iter v149 v2 (2026-06-25): bracelet-code activate als eigen prominent
     card — gelijkwaardig aan SIGN IN card. Accent border + glow zodat
     bracelet-owners het meteen vinden. Operator-feedback: bracelet wordt
     main product, niet verstoppen onder dim link. */
  activateBraceletCard: {
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB},0.10)`,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: `rgba(${ROYAL_INDIGO_RGB},0.55)`,
    marginBottom: 18,
    shadowColor: '#1E2A4A',
    shadowOpacity: 0.20,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  activateBraceletCardInner: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activateBraceletCardTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  activateBraceletCardEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): zelfde rol
     als `activateBraceletEntryLabel` op bracelet.tsx (was daar 18px, hier
     17px) — nu allebei uit `TypeScale.compactCardTitle`. */
  activateBraceletCardLabel: {
    color: C.text,
    ...TypeScale.compactCardTitle,
    marginBottom: 4,
    lineHeight: 21,
  },
  activateBraceletCardSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  activateBraceletCardArrow: {
    color: C.accent,
    fontSize: 26,
    fontFamily: BrandFonts.regular,
    lineHeight: 26,
  },
  /* Iter v187 (2026-07-02): "Don't have a Smart Bead Bracelet yet? Learn
     more at vibezcore.com →" — externe link naar marketing site voor
     niet-eigenaars. Subtiel: dim tekst, accent op link-gedeelte. */
  learnMoreLink: {
    marginTop: 4,
    marginBottom: 18,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  learnMoreLinkText: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  learnMoreLinkAccent: {
    color: C.accent,
    fontFamily: BrandFonts.semibold,
  },
  authCardLabel: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  authCardIntro: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 19,
    marginBottom: 14,
  },
  /* Intro-blok boven de velden (operator-mockup, 11 augustus 2026). */
  authCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  authCardIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB},0.14)`,
  },
  authCardTitle: {
    color: C.text,
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 12,
  },
  orDividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  orDividerText: {
    marginHorizontal: 12,
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  /* Apple + Google naast elkaar, niet gestapeld (operator-mockup). */
  socialRow: { flexDirection: 'row', gap: 10 },
  googleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  googleBtnText: {
    color: '#1f1f1f',
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
  },

  /* ── Iter 9dq v10 (2026-06-02): restructured product-cards ──
     Clean layout: eyebrow → title → 1-liner → CTA. Bundle als inline
     order-bump met BEST VALUE stamp. Vervangt de oude druk gestapelde
     2-card layout met 3 CTAs en 3 badges. */
  productCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: 14,
    backgroundColor: C.panel,
    /* Subtiele blauwe omlijning matched de history-page card-style. */
    borderColor: `rgba(${ROYAL_INDIGO_RGB}, 0.28)`,
    borderWidth: 1,
  },
  /* Hele-kaart-tikbaar variant (operator-mockup, 11 augustus 2026) — icoon
     + tekst links, chevron rechts, geen losse knop. */
  productCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderColor: 'rgba(74,222,128,0.35)',
    borderWidth: 1,
  },
  productCardIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74,222,128,0.14)',
  },
  productStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  /* Gedeeld door 3 labels ("ALREADY OWN A PRODUCT?", "AVAILABLE NOW",
     "EARLY BIRD · LAUNCHING FALL 2026") — bewust neutraal/gedimd hier;
     alleen de FALL 2026-regel krijgt zijn eigen goud-override verderop
     (operator, 11 augustus 2026), niet deze gedeelde basisstijl. */
  productStatusLabel: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): 22px was
     al toevallig gelijk aan `TypeScale.cardHeadline`, enkel het gewicht
     (extrabold i.p.v. bold) en letterSpacing (-0.4 i.p.v. -0.3) weken af
     zonder reden — nu uit dezelfde bron. */
  productTitle: {
    color: C.text,
    ...TypeScale.cardHeadline,
    marginBottom: 4,
  },
  productOneLiner: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    marginBottom: 18,
  },
  /* Iter 9dq v12: extra dim regel onder one-liner voor "limited units —
     first reserved, first served". Subtieler dan one-liner zodat het
     als scarcity-microcopy leest, niet als hoofdpunt. */
  productSubOneLiner: {
    color: 'rgba(10,10,12,0.40)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    fontStyle: 'italic',
    marginTop: -12,
    marginBottom: 18,
  },
  /* Primary CTA — solid accent fill voor Audio (direct verkoopbaar). */
  productCtaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
  },
  /* Tekstlink met pijltje i.p.v. volle knop (operator-mockup). */
  productCtaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 2,
  },
  productCtaLinkText: {
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  productCtaPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  productCtaPrimaryArrow: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  /* Secondary CTA — outlined voor Reserve (geen aankoop, lower commitment). */
  productCtaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderColor: C.accent,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
  },
  productCtaSecondaryText: {
    color: C.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  productCtaSecondaryArrow: {
    color: C.accent,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  /* Iter 9dq v11 (2026-06-02): twee reservation-opties met duidelijk
     verschillende klasse.
     Option A (Bracelet alone) — outlined accent border, neutrale bg.
     Option B (Bundle) — subtle blauwe tint bg, stronger border, BEST
     VALUE stamp bovenaan. Visueel duidelijk dat dit dezelfde actie is
     met meer waarde, niet een totaal andere knop. */
  reserveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderColor: `rgba(${ROYAL_INDIGO_RGB}, 0.45)`,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  reserveOptionBundle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB}, 0.10)`,
    borderColor: `rgba(${ROYAL_INDIGO_RGB}, 0.50)`,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 14,
  },
  reserveOptionLeft: {
    flex: 1,
  },
  reserveOptionTitle: {
    color: C.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  reserveOptionSub: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    marginTop: 3,
  },
  /* Iter 9dq v12: extra fine-print onder pakketnaam (alleen bundle).
     Toont wat in de bundle zit zonder de pakketnaam te overschaduwen. */
  reserveOptionSubFine: {
    color: 'rgba(10,10,12,0.35)',
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  reserveOptionArrow: {
    color: C.accent,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    marginLeft: 10,
  },
  /* BEST VALUE pill — gedeeld door bundle inline. */
  bundleInlineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.success,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  bundleInlineBadgeText: {
    color: '#0a0a0a',
    fontSize: 9,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: 0.8,
  },

  /* Iter v159 (2026-06-26): Get Started sectie-header — vervangt de
     'or get started' divider. Operator: 'sign up CTA om aan te kopen
     is zeer onprofessioneel — get started moet duidelijk en prominent
     onmiddellijk volgen na sign in'. */
  /* Iter v238g (2026-07-10): getStartedHeader vervangen door
     newHereDivider — subtiele lijn+label ipv eyebrow+title+subline stack.
     Reduceert visuele ruis boven de product-cards. */
  newHereDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  newHereDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(10,10,12,0.10)',
  },
  newHereDividerText: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.4,
  },
  /* Iter 9lll — Audio btn wrapper voor "AVAILABLE NOW" badge. */
  audioBtnWrap: {
    position: 'relative',
    marginTop: 4,
  },
  availableBadge: {
    position: 'absolute',
    top: -8,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.success,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  availableDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  availableBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.8,
  },
  /* Iter 9lll: outlined variant voor secundaire reservatie-CTAs.
     Accent-border, transparante bg, accent-tekst — lichter visueel
     gewicht dan de solid-filled audio-knop. */
  getProductBtnOutlined: {
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB},0.06)`,
    borderColor: C.accent,
    borderWidth: 1,
  },
  /* Iter 9kkk — Bundle btn wrapper voor BEST VALUE-badge die boven
     de knop uitsteekt (overflow visible nodig). */
  bundleBtnWrap: {
    position: 'relative',
    marginTop: 4,
  },
  bundleBadge: {
    position: 'absolute',
    top: -8,
    right: 14,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bundleBadgeText: {
    color: C.accent,
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1,
  },
  /* Iter 9jjj — Early Bird card (Bracelet + Bundle, Kickstarter pre-order) */
  earlyBirdEyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  earlyBirdLabel: {
    color: C.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
  },
  earlyBirdDate: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  earlyBirdHeadline: {
    color: C.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  earlyBirdSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 17,
    marginBottom: 14,
  },
  /* Disclaimer onder de 3 product-knoppen (samengevoegd uit 2 dubbele) */
  productCardDisclaimer: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 6,
  },
  productCardDisclaimerSub: {
    color: 'rgba(10,10,12,0.40)',
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
    lineHeight: 14,
  },
  /* Legal footer — 5 doc-links als inline link-row, altijd zichtbaar
     (ook voor guests = AVG/compliance + UX-conventie). */
  /* Iter v172 (2026-06-29): inline activate-bracelet link onder
     productcards. Sober, niet visueel zwaar — voor backers die hun
     code zoeken. Operator-feedback: was bovenaan verwarrend. */
  /* Iter v190 (2026-07-02): compacte activate-shortcut voor Account tab
     uitgelogd. Route direct naar /activate-bracelet ipv naar Bracelet tab. */
  activateBraceletShortcut: {
    marginTop: 14,
    marginBottom: 6,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB},0.06)`,
    borderWidth: 1,
    borderColor: `rgba(${ROYAL_INDIGO_RGB},0.22)`,
    alignItems: 'center',
  },
  activateBraceletShortcutText: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    textAlign: 'center',
    lineHeight: 18,
  },
  activateBraceletShortcutAccent: {
    color: C.accent,
    fontFamily: BrandFonts.bold,
  },
  activateBraceletInline: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activateBraceletInlineText: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
  },
  activateBraceletInlineLink: {
    color: C.accent,
    fontFamily: BrandFonts.semibold,
  },
  /* Iter v186 (2026-07-02): duplicate activateBraceletCard styles verwijderd.
     Bestaande v149 styling (regel 1938+) hergebruikt — die was al gedesigned
     als "prominent card gelijkwaardig aan SIGN IN card. Accent border + glow
     zodat bracelet-owners het meteen vinden". Match precies mijn intent. */
  /* Iter v174 (2026-06-30): Invite-friend CTA voor guests — prominent
     boven info-links. Groen accent matched Free Picks branding (free
     sessions = entry-point voor invited users). Share2-icon links van
     label voor visuele balans. */
  /* Voor cardRow met icoon links van label — Share2-glyph naast tekst. */
  cardRowIconText: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  /* SUPPORT-sectie, herbouwd naar de mockup (operator, 11 augustus 2026):
     4 rijen met icoon + titel + onderschrift + chevron. */
  supportSectionLabel: {
    color: 'rgba(10,10,12,0.4)',
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.6,
    marginTop: 26,
    marginBottom: 10,
  },
  supportList: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,10,12,0.08)',
    backgroundColor: 'rgba(10,10,12,0.025)',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  supportRowSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,12,0.08)',
    marginLeft: 46,
  },
  supportRowTitle: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  supportRowSub: {
    marginTop: 1,
    color: 'rgba(10,10,12,0.5)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
  },
  legalFooter: {
    marginTop: 14,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,12,0.06)',
  },
  legalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  legalLink: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  legalLinkSep: {
    color: 'rgba(10,10,12,0.25)',
    fontSize: 12,
  },
  legalCopy: {
    color: 'rgba(10,10,12,0.30)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.6,
  },
  /* Iter 9dq — dev-only Settings-link in signed-out account view.
     Subtiel maar herkenbaar (🔧 prefix + dim accent kleur). */
  devSettingsLink: {
    marginTop: 24,
    paddingVertical: 10,
    alignItems: 'center',
  },
  devSettingsLinkText: {
    color: `rgba(${ROYAL_INDIGO_RGB},0.65)`,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.4,
  },
  /* Iter 9ii — Get-product sectie (vervangt Create-account toggle) */
  getProductSection: {
    marginTop: 28,
    marginBottom: 18,
  },
  getProductHeader: {
    color: C.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  getProductSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    marginBottom: 14,
  },
  getProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  getProductBtnFeatured: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  getProductBtnLeft: {
    flex: 1,
  },
  getProductBtnTitle: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  getProductBtnSub: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    marginTop: 2,
  },
  getProductBtnSubFeatured: {
    color: 'rgba(10,10,12,0.85)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    marginTop: 2,
  },
  getProductBtnArrow: {
    color: C.text,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    marginLeft: 12,
  },
  /* Iter 9jj: disclaimer-tekst onder bracelet + bundle (waitlist-flow).
     "No credit card · No financial data · No purchase obligation" +
     "We only use your email to notify you before launch". */
  getProductDisclaimer: {
    color: 'rgba(10,10,12,0.45)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
    marginTop: -4,
    marginBottom: 1,
    paddingHorizontal: 6,
    lineHeight: 14,
  },
  getProductDisclaimerSub: {
    color: 'rgba(10,10,12,0.35)',
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    marginBottom: 12,
    paddingHorizontal: 6,
    lineHeight: 14,
  },
  /* Top-bar met klein V-logo links — vervangt de oude grote wordmark
     in de signed-out view én de platte 'Account'-koptekst-only in de
     signed-in view. Operator-besluit 2026-05-22: groot wordmark alleen
     op welcome + splash. */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): was
     `extrabold`/letterSpacing 1, los van dezelfde rol elders in de app —
     nu uit `TypeScale.tabHeader` (bold, letterSpacing -0.3). */
  screenTitle: {
    color: C.text,
    ...TypeScale.tabHeader,
    marginTop: 12,
  },
  subtitle: {
    color: C.text,
    fontSize: 20,
    fontFamily: BrandFonts.bold,
    marginTop: 8,
  },
  optional: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 8,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: C.panel,
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
  /* Was een bijna-wit tintje (`rgba(244,244,244,0.07)`) — onzichtbaar op
     het nieuwe lichte `toggleRow`-paneel. Zelfde subtiele donkere
     highlight als de andere "actieve chip"-fixes op deze pagina. */
  toggleActive: { backgroundColor: 'rgba(10,10,12,0.06)' },
  toggleText: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  toggleTextActive: { color: C.text },
  /* Icoon + placeholder IN het veld, geen los label erboven (operator-
     mockup, 11 augustus 2026). */
  inputIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.bg,
    borderColor: 'rgba(10,10,12,0.12)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  inputWithIcon: {
    flex: 1,
    color: C.text,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    paddingVertical: 11,
  },
  msg: {
    color: C.error,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 14,
  },
  /* flexDirection ontbrak — tekst en pijl stonden daardoor onder elkaar
     i.p.v. naast elkaar, en de knop oogde daardoor te dik (operator, 11
     augustus 2026: "cta knop is te dik pijl moet achter sign in niet
     eronder"). */
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  primaryBtnText: {
    color: '#1D1D1F',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
  },
  btnDisabled: { opacity: 0.5 },

  /* "Stay signed in"-reassurance — kleine gedimde regel onder de primary
     Sign-in knop. Komt uit operator-feedback dat user wist of de session
     bewaard blijft. Bovendien mobiele-app-conventie. */
  staySignedIn: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  /* "OR" divider — scheidt email/password-flow van de SSO-knop(pen). */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    marginHorizontal: 12,
  },

  /* SSO-knop — Apple-style: zwarte achtergrond, witte tekst. */
  ssoBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  /* Disabled state — gedimd zodat duidelijk is dat de knop nog niet
     actief is. Combineert met de SOON-badge rechts. */
  ssoBtnDisabled: {
    opacity: 0.55,
  },
  /* Apple-logo glyph (Unicode ). Apple's brand-guidelines toestaan
     deze glyph als logo-vervanger op donker veld. */
  ssoBtnApple: {
    color: '#ffffff',
    fontSize: 18,
    marginRight: 8,
    marginTop: -2,
  },
  ssoBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
  },
  /* SOON-badge — kleine pill rechts naast de knop-tekst. Duidelijk visueel
     signaal dat de knop nog niet werkt zonder gebruiker te frustreren
     met onverklaarde non-respons bij tap. */
  soonBadge: {
    marginLeft: 10,
    /* Zit altijd op de zwarte Apple-SSO-knop (`ssoBtn`, `#000`), niet op
       de pagina-achtergrond — blijft dus wit-tint ongeacht thema. */
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  soonBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginTop: 14,
  },
  label: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  email: {
    color: C.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  /* Subscription-card live data — bigText: PRO-status of "Free account".
     Kleur wordt inline gezet (accent voor PRO, normaal voor Free,
     textDim voor loading). */
  subBig: {
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.2,
  },
  subSmall: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 4,
    lineHeight: 18,
  },
  dimText: {
    color: C.textDim,
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
    color: C.error,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
  },
  legal: {
    color: C.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
    lineHeight: 16,
    opacity: 0.6,
  },

  /* Library-settings link (vervangt oude toggleRow2-styling van de
     in-place auto-play card). Visueel een tap-rij in Account-stijl:
     bg .04 / border .08 / radius 14 — match met de andere cards. */
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  linkTextWrap: { flex: 1 },
  linkTitle: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  linkSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 4,
  },
  linkArrow: {
    color: 'rgba(10,10,12,0.4)',
    fontSize: 28,
    marginLeft: 8,
    lineHeight: 28,
  },
  /* CTA-link binnen een card (Subscription's "Upgrade", Bracelet's
     "Reserve"). Subtiele accent-link onder de card-content, met arrow.
     Hairline-divider boven om visueel te scheiden van de info-tekst. */
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,12,0.10)',
  },
  cardCtaText: {
    color: C.accent,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  cardCtaArrow: {
    color: C.accent,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  /* Iter 9dq v85 (2026-06-03): secondary cardCta — voor extra acties
     in een card (bv. "Order new beadband") die wel actief klikbaar zijn
     maar niet de primary action. Visueel: dim grijze tekst ipv accent,
     géén border-top. Voorheen werd hiervoor de primary cardCta met
     opacity:0.6 hergebruikt → leek disabled. */
  cardCtaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 4,
  },
  cardCtaSecondaryText: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  cardCtaSecondaryArrow: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  /* Forgot Password — kleine subtiele link onder de Sign In knop. */
  forgotLink: {
    alignItems: 'flex-end',
    paddingVertical: 8,
    marginTop: 2,
  },
  forgotLinkText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Account Actions card-rows (Change Password / Contact Support). Lijst-
     style binnen een card, met hairline tussen items. Geen aparte
     "Account"-label nodig — de card-Text "Account" doet 't werk. */
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  cardRowText: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  cardRowArrow: {
    color: 'rgba(10,10,12,0.4)',
    fontSize: 22,
    fontFamily: BrandFonts.medium,
  },
  cardRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,12,0.08)',
  },
  /* My Account-card field rows — andere visuele structuur dan de
     normale cardRow (die heeft alleen tekst + chevron). Hier tonen we
     LABEL boven VALUE — klassieke iOS Settings-stijl voor account-info.
     `accountField` = niet-interactief (column stack), `accountField-
     Interactive` = interactief met CTA + chevron rechts. */
  accountField: {
    paddingVertical: 14,
  },
  accountFieldInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  accountFieldLabel: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  accountFieldValue: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  /* "Change" CTA tekst in password-row — accent-blauw, naast de
     chevron. Geeft direct duidelijk dat dit interactief is. */
  accountFieldCta: {
    color: C.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Cancel Subscription — neutraal-bordered knop (niet rood; cancel is
     reversible binnen huidige periode). Visueel minder dramatisch dan
     Sign Out (rood). */
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.18)',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Danger Zone — Delete Account. Rode border + rode tekst voor
     permanente actie. */
  dangerZone: {
    marginTop: 24,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(239,68,68,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 14,
  },
  dangerLabel: {
    color: C.error,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  dangerText: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 19,
    marginBottom: 14,
  },
  dangerBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: C.error,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
});
