/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — FAQ content (synced van website 2026-05-30)

   Gerenderd door src/app/faq.tsx. Bevat alle Q&A van vibezcore.com/faq —
   letterlijk overgenomen zodat website en app exact dezelfde tekst tonen
   (operator-besluit voor brand-consistency).

   Categorieën komen 1-op-1 overeen met de tabs op de website.

   Formaat van `answer`:
   - Paragraaf-scheiding: \n\n
   - Bold: **tekst** (markdown-light, gerenderd in faq.tsx)
   - Geen HTML-tags
   ─────────────────────────────────────────────────────────────────── */

import { Platform } from 'react-native';
import { SESSIONS } from '@/data/audio-library-data';
import { getEffectiveTier } from '@/utils/access-tier';

const FREE_AUDIO_COUNT = SESSIONS.filter((x) => getEffectiveTier(x) === 'public').length;

/* App Review 2.3.10: de iPhone-app noemt geen andere platforms (zelfde
   aanpak als legal-content.ts). Op Android blijft de tekst Android. */
const IOS = Platform.OS === 'ios';
const HEALTH_APP = IOS ? 'Apple Health' : 'Health Connect';

export type FaqCategory =
  | 'overview'
  | 'stateControl'
  | 'breathwork'
  | 'smartwatch'
  | 'bracelet'
  | 'audio'
  | 'design'
  | 'orders'
  | 'membership'
  | 'privacy';

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  /** Enkel tonen op dit platform (17 okt 2026: batterij-optimalisatie bestaat
   *  niet op de iPhone). */
  platform?: 'android' | 'ios';
};

/* Herzien (operator, 11 augustus 2026: "breathwork en audio in faq moet
   ook apart, nu heb je dat samengezet maar gaat niet ver genoeg over
   breathwork"). De vorige "Breathwork & Audio"-tab hernoemde het label
   maar de inhoud eronder ging nog altijd uitsluitend over de Audio
   Library — geen enkele vraag over breathwork zelf. Zelfde principe als
   about.tsx: drie aparte instrumenten, elk zijn eigen plek. 'audio' is nu
   weer zuiver de Audio Library; 'breathwork' is een nieuwe, eigen tab. */
export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  overview:   'Product Overview',
  stateControl: 'State Control',
  breathwork: 'Breathwork',
  smartwatch: 'Smartwatch',
  bracelet:   'Smart Bead Bracelet',
  audio:      'Audio Library',
  design:     'Design & Materials',
  orders:     'Orders & Shipping',
  membership: 'Membership',
  privacy:    'Privacy & Data',
};

/* Volgorde van categorieën in de UI (tabs). Breathwork direct na overview
   — het is het beschikbare instapproduct, hoort vooraan (zelfde principe
   als de productkaart-volgorde in about.tsx). */
export const FAQ_CATEGORY_ORDER: FaqCategory[] = [
  'overview',
  'stateControl',
  'breathwork',
  'smartwatch',
  'audio',
  'bracelet',
  'design',
  'orders',
  'membership',
  'privacy',
];

const ALL_FAQ_ITEMS: FaqItem[] = [
  /* ── PRODUCT OVERVIEW ─────────────────────────────────────────── */
  {
    id: 'overview-what-is-vibezcore',
    category: 'overview',
    question: 'What is VIBEZCORE?',
    /* Herschreven (operator, 11 augustus 2026, finale Engelse essentie-
       tekst, letterlijk aangehouden): "VibeZCore is a platform for state
       control and personal growth." Bracelet = Instant State Control,
       Breathwork = Active State Training, Audio Library = Long-Term
       Growth. */
    answer:
      "VIBEZCORE is a platform for state control and personal growth. It combines three instruments, on your phone and your smartwatch:\n\n" +
      "**State Control — shift your state in the moment.** A heartbeat rhythm, felt as gentle taps, that starts at your own resting heart rate and settles toward the state you choose: energy, focus, calm, clarity or sleep. Nothing to follow, nothing to watch.\n\n" +
      "**Guided Breathwork — active state training.** 15 techniques across five states, with voice, visuals and haptics guiding every breath.\n\n" +
      "**Audio Library — long-term growth.** Sessions that develop new mental models, habits and behavioural patterns that compound over time.\n\n" +
      "From Early 2027, the Smart Bead Bracelet adds State Control and breathwork guidance on your wrist, in a piece of jewellery.\n\n" +
      "VIBEZCORE helps people not only feel better, but also perform better and continue developing over time.",
  },
  {
    /* Nieuw (operator, 11 augustus 2026, finale essentie-tekst, letterlijk
       aangehouden): "wat is het resultaat voor de gebruiker" — sluit af
       met de exacte tagline "Control Your State. Build Your Future." */
    id: 'overview-what-results',
    category: 'overview',
    question: 'What results can I expect from VIBEZCORE?',
    answer:
      "Greater control over how you feel, think, and perform.\n\n" +
      "**Short term:** more calm, better focus, higher energy, improved sleep.\n\n" +
      "**Long term:** better habits, greater self-awareness, stronger mental resilience, more intentional living.\n\n" +
      "In one sentence: VIBEZCORE helps you consciously direct your state and systematically develop yourself over time. Or even shorter — Control Your State. Build Your Future.",
  },
  {
    /* Herschreven (operator, 11 augustus 2026: drie aparte pijlers, niet
       twee — Breathwork en Audio Library zijn apart, niet samengevoegd.
       Labels definitief (operator, essentie-tekst): Bracelet = Instant
       State Control (passief), Breathwork = Active State Training,
       Audio Library = Long-Term Growth. */
    id: 'overview-components',
    category: 'overview',
    question: 'What components are part of the VIBEZCORE system?',
    answer:
      "VIBEZCORE consists of three instruments — each addressing a different dimension of how you operate. All three work on your phone; State Control and Breathwork also run on your smartwatch.\n\n" +
      "**1. State Control — in the moment**\nFive states: energy, focus, calm, clarity and sleep. A heartbeat rhythm starts at your own resting heart rate and moves toward the state you choose. Bottom-up by design: you simply feel it.\n\n" +
      "**2. Guided Breathwork — active state training**\n15 techniques across the same five states, with voice, visuals and haptics carrying every breath.\n\n" +
      "**3. Audio Library — long-term growth**\nA structured library built on psychology, philosophy and research: not motivation, understanding. Each session expands the frameworks through which you understand yourself, sharpens self-awareness, and strengthens reflective thinking. Over time the ideas compound.\n\n" +
      "**Coming Early 2027 — Smart Bead Bracelet**\nThe premium upgrade: the same State Control rhythm and breathwork guidance on your wrist, without your phone. Stainless steel with real gemstone beads and interchangeable bead sets — nature meets tech.\n\n" +
      "Body first. Mind follows.",
  },
  {
    id: 'overview-separate-purchase',
    category: 'overview',
    question: "Can I buy the bracelet and the app separately?",
    answer:
      "Yes. The app and the bracelet are independent.\n\n" +
      "**VIBEZCORE Premium (available now)** — State Control, Guided Breathwork and the full Audio Library, on your phone and your smartwatch. No bracelet needed.\n\n" +
      "**Smart Bead Bracelet (launching Early 2027 on Kickstarter)** — State Control on your wrist, without your phone. It works with the free VIBEZCORE app; a membership isn't required for it.\n\n" +
      "**Both** — they complement each other: the bracelet carries the same rhythms and breathwork guidance you use in the app.",
  },
  {
    /* Herschreven (operator, finale Engelse essentie-tekst, letterlijk
       aangehouden). */
    id: 'overview-who-for',
    category: 'overview',
    question: 'Who is VIBEZCORE designed for?',
    answer:
      "For anyone who wants more control over how they feel, think and live — whether you're a parent with a full day ahead, a student before an exam, working shifts or behind a desk, or building something of your own as an entrepreneur, leader or creative.\n\n" +
      "You don't need to be a high-performer to start. You only need to want more from your days.\n\n" +
      "In short: for everyone who refuses to live on autopilot.",
  },
  {
    id: 'overview-what-makes-different',
    category: 'overview',
    question: 'What makes VIBEZCORE different from other self-improvement platforms?',
    answer:
      "Most personal development gives you inspiration that fades by evening. VIBEZCORE gives you a system that works on three levels at once — instant, active, and long-term.\n\n" +
      "**State Control** — in the moment: a rhythm you feel, on your phone or smartwatch, that starts at your own heart rate and guides you toward calm, focus, energy, clarity or sleep. No technique to learn and no conscious effort required.\n\n" +
      "**Guided Breathwork** — active practice: 15 techniques across five states, with voice, visuals and haptics carrying every breath.\n\n" +
      "**Audio Library** — long-term growth through ideas drawn from psychology, philosophy and behavioural science, building frameworks, self-awareness and reflective thinking that compound session after session.\n\n" +
      "Three instruments. One direction: growth, success, and freedom.",
  },

  /* ── STATE CONTROL (14 okt 2026 — nieuw, de kern op telefoon en horloge) ── */
  {
    id: 'state-what-is',
    category: 'stateControl',
    question: "What is State Control?",
    answer:
      "State Control guides your state with a rhythm you feel rather than follow. Choose one of five states — Boost, Sharp Focus, Calm Control, Clarity & Relax or Sleep — and gentle taps in a heartbeat rhythm start at your own resting heart rate and settle toward that state.\n\n" +
      "Nothing to follow, nothing to watch: you simply feel it, on your phone or your smartwatch.",
  },
  {
    id: 'state-session-length',
    category: 'stateControl',
    question: "How long is a State Control session?",
    answer:
      "Each state has a recommended length, and you can choose any whole minute in its range: Boost 5–20 minutes, Sharp Focus 5–30, Calm Control 5–30, Clarity & Relax 10–45 and Sleep 10–50.\n\n" +
      "For a quick reset, Quick Chill and Quick Boost run for 5 minutes and start right away.",
  },
  {
    id: 'state-resting-heart-rate',
    category: 'stateControl',
    question: "Why does State Control use my resting heart rate?",
    answer:
      `Your rhythm starts where your body is. VIBEZCORE uses your resting heart rate as the starting tempo — measured in the app, entered by you, or read from ${HEALTH_APP} if you turn that on — and then slowly moves toward the tempo of the state you chose.`,
  },
  {
    id: 'state-sound',
    category: 'stateControl',
    question: "Can I hear the rhythm as well?",
    answer:
      "Yes. In Audio & Haptics you can choose haptics only, or haptics with a soft heartbeat sound. When your smartwatch takes over the vibration, the sound keeps playing on your phone or headphones.",
  },

  /* ── BREATHWORK ────────────────────────────────────────────────
     Nieuw (operator, 11 augustus 2026: "breathwork en audio in faq moet
     ook apart, gaat niet ver genoeg over breathwork"). Voorheen stond
     hier geen enkele breathwork-specifieke vraag — de tab heette wel
     "Breathwork & Audio" maar de inhoud ging alleen over de Audio
     Library. Deze sectie behandelt breathwork als eigen instrument
     (Active State Training), los van de Audio Library (Long-Term
     Growth) en de bracelet (Instant State Control). */
  {
    id: 'breathwork-what-is',
    category: 'breathwork',
    question: 'What is guided breathwork on VIBEZCORE?',
    answer:
      "Five guided breathing states — Boost, Sharp Focus, Calm Control, Clarity & Relax and Sleep — with 15 techniques between them, each built around a specific breathing rhythm. Voice, visuals and haptics carry you through every breath in real time, on your phone or your smartwatch, so you always know exactly when to inhale, hold and exhale.\n\n" +
      "This is active practice: something you consciously do, not something you passively receive.",
  },
  {
    id: 'breathwork-session-length',
    category: 'breathwork',
    question: 'How long are breathwork sessions?',
    answer:
      "Each state offers several session lengths, from short resets to longer, deeper sessions. Every length has a name and a reason — tap your choice to select it, tap it again to see why that length exists. There's no single \"correct\" duration; pick what fits the moment.",
  },
  {
    id: 'breathwork-voice-haptics-silent',
    category: 'breathwork',
    question: 'Can I practice breathwork without sound?',
    answer:
      "Yes. During a session you can switch between Voice (spoken guidance), Haptics (vibration cues) and Silent (visuals only) — whatever fits where you are. With a smartwatch, the vibration guides you on your wrist, so you can put your phone away.\n\n" +
      "From Early 2027, the Smart Bead Bracelet will do the same on your wrist, no screen or sound needed.",
  },
  {
    /* Nieuw (operator, 15 augustus 2026: "extra info als aparte support
       toevoegen voor het gebruik van de batterij tijdens lock... als users
       de popup wegklikken moeten ze toch ergens de info vinden"). Zelfde
       uitleg als de blijvende banner + Settings-rij in breath-session.tsx/
       settings.tsx, maar dan vindbaar via FAQ voor wie de banner al eens
       wegklikte en later opnieuw tegen het probleem aanloopt. */
    id: 'breathwork-lock-screen-battery',
    category: 'breathwork',
    platform: 'android',
    question: 'Why does VIBEZCORE ask to run in the background / ignore battery optimization?',
    answer:
      "On Android, your phone can pause apps running in the background to save battery. If that happens partway through a breathwork session, the voice guidance and vibration can stop as soon as you lock your screen — even though the timer is still running.\n\n" +
      "Allowing VIBEZCORE to run unrestricted in the background (a standard Android permission, the same one apps like Spotify or WhatsApp use for calls and playback) prevents that: your session keeps going with the same voice, visuals and haptic timing whether your screen is on or locked.\n\n" +
      "It only affects battery while a session is actually running, and it's entirely optional — without it, sessions still work, but may pause if you lock your screen partway through. You can grant it the first time a session prompts you for it, by tapping Keep sessions running when locked during a breathwork session, or in your phone's settings for VIBEZCORE (Battery → Unrestricted).",
  },
  {
    id: 'breathwork-need-bracelet',
    category: 'breathwork',
    question: 'Do I need the Smart Bead Bracelet to practice breathwork?',
    answer:
      "No. Every breathwork session runs fully on your phone today — and on your smartwatch — with voice, visuals and haptics.\n\n" +
      "From Early 2027, the bracelet adds another way: the same guided states as gentle pulses on your wrist, worn like jewellery, no screen needed.",
  },
  {
    /* Herschreven (operator, 11 augustus 2026, derde correctie: "de bead
       bracelet heeft de pod met de haptic core, en de bedoeling is om de
       bracelet als unique selling point te gebruiken ook voor
       breathwork." Twee fixes: (1) technisch — haptiek zit in de
       HapticCore-pod, niet "in de beads"; gemstones zijn het sieraad
       eromheen. (2) breathwork-guidance is een volwaardig, eigen selling
       point, niet een bijzaak "on top of" de standalone regulatie. */
    id: 'breathwork-bracelet-difference',
    category: 'breathwork',
    question: 'What makes the Smart Bead Bracelet different from other wearables?',
    answer:
      "It's designed as jewellery first, technology second: one compact HapticCore in a bracelet of stainless steel and real gemstone beads, with interchangeable bead sets — no screen, nothing that looks like a gadget.\n\n" +
      "For breathwork and State Control, that means the same guided sessions from the app carried through gentle pulses on your wrist. Subtle enough to use anywhere — in a meeting or on a train — without anyone noticing. Launching Early 2027.",
  },
  {
    id: 'breathwork-membership',
    category: 'breathwork',
    question: 'Do I need a membership to practice breathwork?',
    answer:
      "You can try each of the five states with a free 30-second preview, and after the intro your first full session is free. The full breathwork experience — every technique and duration — is part of VIBEZCORE Premium, together with State Control and the complete Audio Library: one membership unlocks all three. Not ready for a membership? A Day Pass opens everything for 24 hours.",
  },
  {
    id: 'breathwork-professional-help',
    category: 'breathwork',
    question: 'Is guided breathwork a substitute for professional help?',
    answer:
      "No. VIBEZCORE breathwork sessions are for educational and personal development purposes only. They are not a replacement for professional medical, psychological, or therapeutic advice, diagnosis, or treatment. If you have a cardiovascular or respiratory condition, are pregnant, or have any health concern, consult a qualified professional before practicing breathwork exercises.",
  },

  /* ── SMARTWATCH (14 okt 2026 — nieuw) ── */
  {
    id: 'watch-supported',
    category: 'smartwatch',
    question: "Does VIBEZCORE work on my smartwatch?",
    answer:
      (IOS
        ? "Yes. VIBEZCORE works with Apple Watch.\n\n"
        : "Yes. VIBEZCORE works with Wear OS watches (Wear OS 3 or later, such as Samsung Galaxy Watch4 and newer).\n\n") +
      "Breathwork and State Control sessions guide you on your wrist with gentle vibration — also when the watch screen is off. Start a session on your watch or on your phone, and pause or end it right from your watch.",
  },
  {
    id: 'watch-without-phone',
    category: 'smartwatch',
    question: "Can I use VIBEZCORE on my watch without my phone?",
    answer:
      "Yes. Open VIBEZCORE on your watch, choose State Control or Breathwork, pick your state, technique and duration, and start — the session runs entirely on your watch.\n\n" +
      "Open the app on your phone once to set up your watch. Sessions you do on the watch appear in your history on your phone the next time you open the app.",
  },
  {
    id: 'watch-install',
    category: 'smartwatch',
    question: "How do I install VIBEZCORE on my watch?",
    answer:
      IOS
        ? "Open the Watch app on your iPhone and install VIBEZCORE under Available Apps. During a session on your phone, Audio & Haptics shows whether your watch is ready."
        : "On Wear OS, VIBEZCORE installs from the Play Store on your watch. During a session on your phone, open Audio & Haptics: if your watch is connected but doesn't have the app yet, tap Install.",
  },
  {
    id: 'watch-membership',
    category: 'smartwatch',
    question: "Do I need a separate membership for my watch?",
    answer:
      "No. Your watch uses the same membership as your phone: what's unlocked on your phone is unlocked on your watch. After you subscribe, open VIBEZCORE on your phone once so your watch is updated.",
  },
  {
    id: 'watch-heart-rate',
    category: 'smartwatch',
    question: "Does VIBEZCORE use my watch's heart rate?",
    answer:
      `Not live during a session. If you turn on ${HEALTH_APP} in Settings, VIBEZCORE uses the resting heart rate your watch has saved there to set the starting rhythm of State Control. You can also measure or enter your resting heart rate in the app.`,
  },

  /* ── SMART BRACELET & TECHNOLOGY ──────────────────────────────── */
  {
    id: 'bracelet-how-works',
    category: 'bracelet',
    question: 'How does the Smart Bead Bracelet work?',
    answer:
      "From Early 2027, the Smart Bead Bracelet will carry State Control on your wrist: gentle haptic pulses in a heartbeat rhythm that starts at your own resting heart rate and settles toward the state you choose. Choose your state in the app and the bracelet runs the session on its own — no screen needed.\n\n" +
      "Until then, you can use State Control today on your phone or smartwatch.",
  },
  {
    id: 'bracelet-why-wrist',
    category: 'bracelet',
    question: 'Why the wrist for haptic feedback?',
    answer:
      "The wrist is where you can feel a gentle rhythm without looking or listening — discreet, always within reach, and easy to notice without distraction. It's also where many people already wear a watch or bracelet all day.",
  },
  {
    /* Herschreven (operator, 11 augustus 2026: "echt alles nakijken, want
       niets klopt momenteel nergens"). De oude tekst beloofde een
       intensity-instelling die niet bestaat — de app toont bewust GEEN
       technische parameters (CLAUDE.md §5: "App toont NOOIT PPS, burst_ms,
       amplitude, RTP"), er is geen intensity-slider in bracelet-control.tsx. */
    id: 'bracelet-noticeable-vibrations',
    category: 'bracelet',
    question: 'How noticeable are the vibrations?',
    answer:
      "The vibrations are designed to be subtle and non-intrusive — noticeable to you, invisible to others. In most social and professional settings, the haptic signal goes completely undetected by those around you.",
  },
  {
    id: 'bracelet-multiple-times-day',
    category: 'bracelet',
    question: 'Can VIBEZCORE be used multiple times per day?',
    answer:
      "Yes. State Control and breathwork can be used as often as you like — today on your phone or smartwatch, and from Early 2027 on the bracelet, which is designed to be worn all day.\n\n" +
      "For audio sessions, listen at whatever pace fits your life. Some users do one session per day, others several. Returning to the same session multiple times also has value — repetition deepens integration as the ideas compound over time.",
  },
  {
    id: 'bracelet-tracks-data',
    category: 'bracelet',
    question: 'Does the Smart Bead Bracelet track personal data?',
    answer:
      "No. The Smart Bead Bracelet is designed without health sensors: it won't monitor heart rate, sleep or other health metrics. Its only job is to deliver the rhythm.\n\n" +
      `If you choose, the VIBEZCORE app can read your resting heart rate from ${HEALTH_APP} to personalise State Control — only with your permission.`,
  },
  {
    id: 'bracelet-needs-smartphone',
    category: 'bracelet',
    question: 'Does VIBEZCORE require a smartphone?',
    answer:
      "Yes. The bracelet will be set up and controlled with the VIBEZCORE app on your phone, where you choose your state and session. Once a session starts, the bracelet runs it on its own — your phone doesn't need to stay nearby.",
  },
  {
    id: 'bracelet-medical-device',
    category: 'bracelet',
    question: 'Is the bracelet a medical device?',
    answer:
      "No. The Smart Bead Bracelet is a personal wellbeing product, not a medical device. It has not been submitted for medical device classification and is not approved or certified for any medical, diagnostic, or therapeutic purpose by any regulatory authority.\n\n" +
      "It should not be used as a substitute for medical treatment or professional health monitoring.",
  },

  /* ── AUDIO SESSIONS & CONTENT ─────────────────────────────────── */
  {
    id: 'audio-unique',
    category: 'audio',
    question: 'What makes the VIBEZCORE Audio Library unique?',
    answer:
      "Most growth content is either motivational without substance, or academic without application. VIBEZCORE audio sessions are built at the intersection of both — grounded in real behavioural science and designed for immediate practical use.\n\n" +
      "Each session targets a specific cognitive or emotional pattern, delivers structured insight, and ends with a concrete application point you can use the same day. The goal is not to inspire you — it is to change how you operate.",
  },
  {
    id: 'audio-who-creates',
    category: 'audio',
    question: 'Who creates the audio sessions?',
    answer:
      "All VIBEZCORE audio sessions are independently developed by the VIBEZCORE team, drawing on widely available research, behavioural science, and real-world experience. Every session is carefully composed around genuine challenges people face in daily life.\n\n" +
      "Our sessions may reference publicly available findings, research, or the work of thought leaders and public figures in the fields of neuroscience, psychology, and philosophy. **None of these individuals or institutions are affiliated with, employed by, partnered with, or endorsing VIBEZCORE in any capacity.** All references are for educational and contextual purposes only, based exclusively on information in the public domain.",
  },
  {
    id: 'audio-topics',
    category: 'audio',
    question: 'What topics do the audio sessions cover?',
    answer:
      "The VIBEZCORE Audio Library covers four core pillars:\n\n" +
      "**Psychological Resilience** — Build what cannot break.\n\n" +
      "**Inner Sovereignty** — Master what is yours.\n\n" +
      "**Social Mastery** — Command without force.\n\n" +
      "**Strategic Execution & Wealth** — Engineer your autonomy.",
  },
  {
    id: 'audio-beginners',
    category: 'audio',
    question: 'Are the audio sessions suitable for beginners?',
    answer:
      "Yes. The library is structured for all levels. Whether you are new to personal development or deeply experienced, sessions are designed to be immediately applicable regardless of your starting point. Foundational sessions introduce core concepts, while advanced sessions build on established frameworks for those ready to go deeper.",
  },
  {
    id: 'audio-offline',
    category: 'audio',
    question: 'Can I share or download audio sessions?',
    answer:
      "Free sessions can be shared with others directly from the player — they are designed as an open entry point into VIBEZCORE.\n\n" +
      "The full Audio Library (subscription content) is streaming-only and cannot be shared, which protects the integrity of the membership for paying subscribers.\n\n" +
      "Offline download is on the roadmap for a future update.",
  },
  {
    id: 'audio-professional-help',
    category: 'audio',
    question: 'Are the audio sessions a substitute for professional help?',
    answer:
      "No. VIBEZCORE audio sessions are for educational and personal development purposes only. They are not a replacement for professional medical, psychological, or therapeutic advice, diagnosis, or treatment. If you are experiencing serious mental health challenges, please consult a qualified professional.",
  },

  /* ── DESIGN & MATERIALS ───────────────────────────────────────── */
  {
    id: 'design-materials',
    category: 'design',
    question: 'What materials are used in the bracelet?',
    answer:
      "The Smart Bead Bracelet is designed around a compact smart pod, threaded on a strong, flexible metal core string, with beads of real gemstones and a stainless steel locking system. Bead sets will be interchangeable, so you can change its look.\n\n" +
      "Final specifications will be published on the product page before launch.",
  },
  {
    id: 'design-waterproof',
    category: 'design',
    question: 'Is the bracelet waterproof?',
    answer:
      "No. The Smart Bead Bracelet is not designed to be waterproof. It's made for everyday wear and light, incidental moisture — remove it before swimming, showering or other prolonged water contact. Final water-resistance details will be published on the product page before launch.",
  },
  {
    /* Herschreven (operator, 11 augustus 2026: "echt alles nakijken"). De
       oude tekst noemde een "magnetic charging cable" — dat klopt niet met
       het echte ontwerp: 2 POGO-pin landings in de ONDERKANT van de
       behuizing, bracelet wordt op een dock gelegd (dock ligt eronder,
       pins wijzen omhoog). Geen kabel die je aansluit. */
    id: 'design-charging',
    category: 'design',
    question: 'How is the bracelet charged?',
    answer:
      "The Smart Bead Bracelet is designed to charge by resting on its charging dock — POGO-pin contacts connect automatically, no cable to plug in. Battery life and charging time will be confirmed on the product page before launch.",
  },
  {
    id: 'design-sizes',
    category: 'design',
    question: 'Does the bracelet come in different sizes or styles?',
    answer:
      "Multiple sizes and interchangeable bead sets are planned. The final options will be shown on the product page at launch.",
  },

  /* ── ORDERS & SHIPPING ────────────────────────────────────────── */
  {
    id: 'orders-shipping-time',
    category: 'orders',
    question: 'How long does shipping take?',
    answer:
      "Estimated delivery times from dispatch:\n\n" +
      "**Europe** — 3–7 business days\n\n" +
      "**United States** — 5–10 business days\n\n" +
      "**Canada** — 7–12 business days\n\n" +
      "**Rest of World** — 7–15 business days\n\n" +
      "For full details, see our Shipping Policy.",
  },
  {
    id: 'orders-return',
    category: 'orders',
    question: 'Can I return my order?',
    answer:
      "Physical products can be returned within 14 days of receiving your order, provided the item is unused and in its original condition. Digital content is non-refundable once accessed.\n\n" +
      "For the full return procedure, see our Refund & Returns Policy.",
  },
  {
    id: 'orders-customs',
    category: 'orders',
    question: 'Will I have to pay customs or import duties?',
    answer:
      "International orders may be subject to customs duties or import taxes imposed by your country. These charges are determined by local authorities and are the responsibility of the customer.\n\n" +
      "**EU customers** — VAT is included in the product price. No additional import VAT applies for orders shipped within the EU.\n\n" +
      "**US customers** — import duties and fees may apply to all US orders, regardless of value.\n\n" +
      "**Canadian customers** — GST/HST may apply. You will be contacted by Canada Post or a customs broker if relevant.",
  },
  {
    id: 'orders-not-arrived',
    category: 'orders',
    question: "My order hasn't arrived — what should I do?",
    answer:
      "First, check your tracking information from your shipping confirmation email. If your order appears stuck or significantly delayed beyond the estimated timeframe, contact our support team via the Support Center with your order number and shipping details ready.",
  },

  /* ── MEMBERSHIP & ACCOUNT ─────────────────────────────────────── */
  {
    /* Herschreven (operator, 11 augustus 2026: "membership nakijken, echt
       alles nakijken, want jij zegt in orde maar niets klopt momenteel
       nergens"). De oude tekst verzon "membership tiers" en een
       "Membership page" die niet bestaan — er is één plan (Breathwork
       Premium: volledige Audio Library + alle vijf ademtoestanden),
       geen tiers. Prijs staat gewoon in de paywall, niet op een aparte
       pagina. */
    id: 'membership-includes',
    category: 'membership',
    question: 'What does a VIBEZCORE membership include?',
    answer:
      "VIBEZCORE Premium gives you full access to State Control, all guided breathwork and the complete Audio Library — including every new session release — on your phone and your smartwatch.\n\n" +
      "Choose Monthly or Yearly, or try everything for 24 hours with a one-time Day Pass. Pricing and terms are shown in full before you buy.",
  },
  {
    /* 17 okt 2026 (eigen nazicht na de trial-afschaffing): nergens stond nog
       wat je gratis kan doen. Aantal gratis audio telt mee met de lijst. */
    id: 'membership-free',
    category: 'membership',
    question: 'What can I try for free?',
    answer:
      `**Audio Library** — ${FREE_AUDIO_COUNT} sessions are free to listen to, anytime. Every other session plays a short preview.\n\n` +
      "**State Control and Breathwork** — every state has a free 30-second preview, and after the intro you get one full session free.\n\n" +
      "Everything else is part of VIBEZCORE Premium: Monthly, Yearly or a 24-hour Day Pass.",
  },
  {
    /* Operator, 16 okt 2026: de 7-dagen-trial vervalt, de dagpas komt in
       de plaats (losse aankoop, verlengt niet, geen downloads). */
    id: 'membership-day-pass',
    category: 'membership',
    question: 'What is a Day Pass?',
    answer:
      "A Day Pass is a one-time purchase that opens all of VIBEZCORE Premium — State Control, every breathwork session and the complete Audio Library — for 24 hours from the moment you buy it.\n\n" +
      "It is not a subscription: nothing renews and there is nothing to cancel. Audio streams during your pass.\n\n" +
      "You can buy a new Day Pass whenever you like, or switch to Monthly or Yearly at any time.",
  },
  {
    /* Cancel gaat via het OS-eigen abonnementsscherm (Apple/Google-policy
       verbiedt dat een app IAP zelf cancelt) — direct bereikbaar vanuit de
       Account-tab, niet via "account settings" in algemene zin. Zie
       src/services/subscription-actions.ts. */
    id: 'membership-cancel',
    category: 'membership',
    question: 'How do I cancel my membership?',
    answer:
      (IOS
        ? "Open the Profile tab and, under Your plan, tap Manage subscription — this takes you straight to your Apple ID's Subscriptions page, since Apple requires cancellations of in-app purchases to go through its own system. Deleting the app or your VIBEZCORE account does not cancel a subscription.\n\n"
        : "Open the Profile tab and, under Your plan, tap Manage subscription — this takes you straight to the Play Store's Subscriptions page, since Google requires cancellations of in-app purchases to go through its own system. Deleting the app or your VIBEZCORE account does not cancel a subscription.\n\n") +
      "Cancellation takes effect at the end of your current billing period — you keep full access until then. Need help finding it? Contact us via the Support Center.",
  },
  {
    /* Pause bestaat echt en is bewust belangrijk: Google Play's native
       pause behoudt de intro-prijs, cancel niet (operator-memory
       project-intro-pause-strategy-2026-06-19.md). Apple biedt geen
       native pause, alleen cancel/resubscribe. De oude tekst ("contact
       support to discuss options") verzweeg dit reële verschil. */
    id: 'membership-pause',
    category: 'membership',
    question: 'Can I pause my membership instead of canceling?',
    answer:
      IOS
        ? "Apple doesn't offer a native pause option. You can cancel and resubscribe later — you keep full access until the end of your current billing period."
        : "Yes. Open your Play Store subscription settings (Profile tab → Your plan → Manage subscription) and choose Pause instead of Cancel. Your plan picks up again when the pause ends.",
  },
  {
    id: 'membership-cant-login',
    category: 'membership',
    question: "I can't log into my account — what should I do?",
    answer:
      "Tap **Forgot password?** on the sign-in screen to reset it. If the issue persists, contact our support team through the Support Center with your account email address and a description of the issue.",
  },

  /* ── PRIVACY & DATA ───────────────────────────────────────────── */
  {
    id: 'privacy-sell-data',
    category: 'privacy',
    question: 'Does VIBEZCORE sell my personal data?',
    answer:
      "No. VIBEZCORE does not sell personal data — ever. Your data is used solely to provide and improve our services, process transactions, and communicate with you. For full details, see our Privacy Policy.",
  },
  {
    id: 'privacy-data-collected',
    category: 'privacy',
    question: 'What data does VIBEZCORE collect?',
    answer:
      "VIBEZCORE collects only what is necessary to provide our services — including account information, purchase details, and usage data to improve the platform. No health or biometric data reaches our servers.\n\n" +
      `If you turn on ${HEALTH_APP}, VIBEZCORE reads your resting heart rate and saves your sessions as mindful minutes — only on your device and in the health app. Your session history and progress are stored on your device only; sessions you do on your smartwatch sync to your phone's history over your own connection. Full details are in our Privacy Policy.`,
  },
  {
    id: 'privacy-deletion',
    category: 'privacy',
    question: 'How do I request deletion of my data?',
    answer:
      `If you have a VIBEZCORE account, you can delete it yourself at any time in the Profile tab with **Delete account**. This permanently removes your account and its data and cannot be undone. It does not cancel a subscription — cancel that separately in your ${IOS ? 'Apple ID' : 'Google Play'} settings.\n\n` +
      "Data stored only on your device can be removed with Settings → Clear all local data, or by uninstalling the app.\n\n" +
      "You can also request full deletion of your personal data through the Support Center; our team will process it in accordance with applicable data protection law (GDPR and CCPA where applicable) within 30 days.",
  },
];

export const FAQ_ITEMS: FaqItem[] = ALL_FAQ_ITEMS.filter((x) => !x.platform || x.platform === Platform.OS);
