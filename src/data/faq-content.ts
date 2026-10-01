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

export type FaqCategory =
  | 'overview'
  | 'breathwork'
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
  breathwork: 'Breathwork',
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
  'breathwork',
  'bracelet',
  'audio',
  'design',
  'orders',
  'membership',
  'privacy',
];

export const FAQ_ITEMS: FaqItem[] = [
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
      "VIBEZCORE is a platform for state control and personal growth. It combines three instruments:\n\n" +
      "**Smart Bead Bracelet — Instant State Control.** Precision haptics at the wrist change your physiological state within minutes — calm, focus, energy or sleep, on demand. Coming Fall 2026 on Kickstarter.\n\n" +
      "**Guided Breathwork — Active State Training.** Learn to consciously steer your state through your breath — regulating stress, raising focus, activating energy, or creating relaxation. Available now.\n\n" +
      "**Audio Library — Long-Term Growth.** Develop new mental models, habits and behavioural patterns that compound over time. Included with Breathwork.\n\n" +
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
      "VIBEZCORE consists of three distinct instruments — each addressing a different dimension of how you operate.\n\n" +
      "**1. Instant State Control — Smart Bead Bracelet** (Kickstarter, launching Fall 2026)\nOne HapticCore, built into a bracelet of premium natural gemstone beads — jewelry first, technology second. A standalone instrument for passive, bottom-up state regulation: precision pulses at the wrist shift you into calm, focus, energy or sleep on demand, no screen or effort needed. For breathwork, that's a selling point on its own: a pre-set, structured session is carried entirely through the HapticCore's haptic pulses on your wrist, private and undetectable, anywhere you are.\n\n" +
      "**2. Active State Training — Guided Breathwork**\nFive guided breathing states meet you in the moment — energy, focus, calm, clarity, rest — with voice, visuals and haptics carrying every breath. Available now, with the full Audio Library included.\n\n" +
      "**3. Long-Term Growth — Audio Library**\nA structured library built on neuroscience, psychology and philosophy: not motivation, understanding. Each session expands the frameworks through which you understand yourself, sharpens self-awareness, and strengthens reflective thinking. Over time the ideas compound — improving emotional regulation, sharpening decisions, and giving you the clarity to guide your own evolution.\n\n" +
      "The body influences the mind: signals from your nervous system shape attention, emotion and decisions before cognition engages. The bracelet works with that biology — a direct route to inner state, bottom-up by design.\n\n" +
      "The bracelet features an interchangeable bead system — one HapticCore module, 15 editions of natural gemstones sourced from across the globe. Origin, Signature and Reserve series. Each stone is unique in character, origin, and energy.\n\n" +
      "Body first. Mind follows.\n\n" +
      "Each instrument is fully independent. Use any of them, or all three — entirely as fits your life.",
  },
  {
    id: 'overview-separate-purchase',
    category: 'overview',
    question: 'Can I purchase the bracelet and breathwork/audio separately?',
    answer:
      "Yes. The bracelet and the Breathwork + Audio Library subscription are independent instruments — each with its own purpose. Neither requires the other to work.\n\n" +
      "**Bracelet only** — a standalone instant state control instrument for daily use. Calm, focus, energy or sleep on demand, without needing breathwork or audio. Reserve it now on Kickstarter, launching Fall 2026.\n\n" +
      "**Breathwork + Audio Library only** — active state training through guided breathing sessions, plus the full session library for long-term growth, through a single membership available today. No bracelet needed.\n\n" +
      "**Both** — they were designed as separate tools, but they complement each other naturally, and Fall 2026 they'll pair directly: on top of its own standalone regulation, the bracelet will also carry your breathwork guidance onto your wrist. Use them however fits you.",
  },
  {
    /* Herschreven (operator, finale Engelse essentie-tekst, letterlijk
       aangehouden). */
    id: 'overview-who-for',
    category: 'overview',
    question: 'Who is VIBEZCORE designed for?',
    answer:
      "For people who want greater control over themselves:\n\n" +
      "Entrepreneurs, professionals, leaders, creatives, high-performers under pressure, and anyone committed to personal growth.\n\n" +
      "In short: for people who refuse to live on autopilot.",
  },
  {
    id: 'overview-what-makes-different',
    category: 'overview',
    question: 'What makes VIBEZCORE different from other self-improvement platforms?',
    answer:
      "Most personal development gives you inspiration that fades by evening. VIBEZCORE gives you a system that works on three levels at once — instant, active, and long-term.\n\n" +
      "**Instant State Control** — the Smart Bead Bracelet (Kickstarter, launching Fall 2026), the first of its kind: one HapticCore built into a bracelet of premium natural gemstone beads, jewelry first, technology second. A standalone instrument that regulates your state in real time through bottom-up neural pathways — under pressure, in high-stakes situations, when clarity drops, your body is guided back to control automatically, no meditation or conscious effort required. For breathwork, it's a selling point on its own: a pre-set session carried through the HapticCore's haptic pulses on your wrist, private and unnoticed, wherever you are.\n\n" +
      "**Active State Training** — guided breathwork meets you in the moment, all 35 sessions across five states for whatever you're facing, right now, with voice, visuals and haptics carrying every breath.\n\n" +
      "**Long-Term Growth** — the Audio Library reshapes how you think, feel, and respond over time through ideas drawn from psychology, philosophy and behavioural science. Building cognitive frameworks, self-awareness, and reflective thinking that compounds — session after session.\n\n" +
      "Three instruments. One direction: growth, success, and freedom.",
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
      "Five guided breathing states — Boost, Focus, Calm Control, Clarity & Relax, and Sleep — each built around a specific breathing rhythm. Voice, visuals and haptics carry you through every breath in real time, so you always know exactly when to inhale, hold, and exhale.\n\n" +
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
      "Yes. During a session you can switch between Voice (spoken guidance), Haptics (phone vibration cues), and Silent (visuals only) — whatever fits where you are. Coming Fall 2026: the Smart Bead Bracelet will let you keep the haptic guidance going with your phone away entirely, no screen or sound needed.",
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
    question: 'Why does VIBEZCORE ask to run in the background / ignore battery optimization?',
    answer:
      "On Android, your phone can pause apps running in the background to save battery. If that happens partway through a breathwork session, the voice guidance and vibration can stop as soon as you lock your screen — even though the timer is still running.\n\n" +
      "Allowing VIBEZCORE to run unrestricted in the background (a standard Android permission, the same one apps like Spotify or WhatsApp use for calls and playback) prevents that: your session keeps going with the same voice, visuals and haptic timing whether your screen is on or locked.\n\n" +
      "It only affects battery while a session is actually running, and it's entirely optional — without it, sessions still work, but may pause if you lock your screen partway through. You can grant it any time from Settings → Keep sessions running when locked, or the first time a session prompts you for it.",
  },
  {
    id: 'breathwork-need-bracelet',
    category: 'breathwork',
    question: 'Do I need the Smart Bead Bracelet to practice breathwork?',
    answer:
      "No. Every guided breathwork session runs fully on your phone today, with voice, visuals and phone haptics — the bracelet isn't required. Coming Fall 2026, the bracelet adds an exclusive way to stay with your breath: a pre-set, structured session — the same guided states from the app — carried entirely through haptic pulses on your wrist, worn like jewelry, no screen needed.",
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
      "It's the first of its kind: one HapticCore — the precision engine at its center — built into a bracelet of premium natural gemstone beads. Jewelry first, technology second: no screen, no interface, nothing that looks like a gadget.\n\n" +
      "For breathwork, that's a selling point on its own: a pre-set, structured session — the same guided states from the app — carried entirely through the HapticCore's haptic pulses on your wrist. Private and subtle enough to use anywhere: in a meeting, a hard conversation, on a train — and nobody around you would know.",
  },
  {
    id: 'breathwork-membership',
    category: 'breathwork',
    question: 'Do I need a membership to practice breathwork?',
    answer:
      "You can try any of the five states with a short free preview before you subscribe. All 35 full sessions are part of VIBEZCORE Breathwork Premium, which also includes the complete Audio Library — one membership unlocks both.",
  },
  {
    id: 'breathwork-professional-help',
    category: 'breathwork',
    question: 'Is guided breathwork a substitute for professional help?',
    answer:
      "No. VIBEZCORE breathwork sessions are for educational and personal development purposes only. They are not a replacement for professional medical, psychological, or therapeutic advice, diagnosis, or treatment. If you have a cardiovascular or respiratory condition, are pregnant, or have any health concern, consult a qualified professional before practicing breathwork exercises.",
  },

  /* ── SMART BRACELET & TECHNOLOGY ──────────────────────────────── */
  {
    id: 'bracelet-how-works',
    category: 'bracelet',
    question: 'How does the Smart Bead Bracelet work?',
    answer:
      "The VIBEZCORE Smart Bead Bracelet delivers precisely calibrated haptic pulses to the wrist at specific intervals and intensities. This stimulates the body's nervous system directly — triggering a physiological response before the mind can interfere.\n\n" +
      "Select your desired state in the app. Body shifts. Mind follows. Most users notice a meaningful shift toward calm, focus, or presence within 15–30 minutes. No screens. No effort. Just results.",
  },
  {
    id: 'bracelet-why-wrist',
    category: 'bracelet',
    question: 'Why the wrist for haptic feedback?',
    answer:
      "The wrist provides direct access to nerve pathways that influence the autonomic nervous system. Haptic stimulation at this location produces faster, more reliable physiological responses. The signals bypass visual distraction and cognitive filtering — reaching you directly, in the moment, without requiring you to look at a screen.",
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
      "Yes. The Smart Bead Bracelet can be worn throughout the entire day and used as often as you choose. Many users wear it from morning to evening as a constant awareness anchor.\n\n" +
      "For audio sessions, listen at whatever pace fits your life. Some users do one session per day, others several. Returning to the same session multiple times also has value — repetition deepens integration as the ideas compound over time.",
  },
  {
    id: 'bracelet-tracks-data',
    category: 'bracelet',
    question: 'Does the Smart Bead Bracelet track personal data?',
    answer:
      "No. The VIBEZCORE Smart Bead Bracelet does not monitor biometrics, heart rate, sleep, or any other personal health metrics. It is a precision delivery instrument for haptic signals — its purpose is state regulation, not data collection.",
  },
  {
    id: 'bracelet-needs-smartphone',
    category: 'bracelet',
    question: 'Does VIBEZCORE require a smartphone?',
    answer:
      "Yes. The VIBEZCORE Smart Bead Bracelet is operated via the VIBEZCORE app, available for iOS and Android. The app is used to configure haptic schedules, select your state, and access the audio library. Once configured, the bracelet operates independently without needing your phone nearby.",
  },
  {
    id: 'bracelet-medical-device',
    category: 'bracelet',
    question: 'Is the bracelet a medical device?',
    answer:
      "No. The VIBEZCORE Smart Bead Bracelet is a precision-engineered personal performance instrument. It has not been submitted for medical device classification and is not approved or certified for any medical, diagnostic, or therapeutic purpose by any regulatory authority.\n\n" +
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
      "The VIBEZCORE Smart Bead Bracelet is centered around its advanced smart pod, built using high-end composite materials for a lightweight, durable, and refined experience designed for continuous daily use.\n\n" +
      "The bracelet is constructed around a precision-engineered metal core string that runs through each bead, creating a strong yet flexible structure that maintains its shape over time.\n\n" +
      "The beads are crafted from carefully selected premium gemstones, giving the bracelet its distinctive character and elevated aesthetic.\n\n" +
      "The locking system is made from high-quality stainless steel, engineered for secure closure, strength, and long-term wear resistance.\n\n" +
      "Every component is designed for structural integrity, comfort, and performance. Full specifications are available on the product page.",
  },
  {
    id: 'design-waterproof',
    category: 'design',
    question: 'Is the bracelet waterproof?',
    answer:
      "**No. The VIBEZCORE Smart Bead Bracelet is not waterproof.** It is designed for everyday wear and can handle light, incidental moisture — but prolonged submersion, swimming, and high-pressure water contact must be avoided to preserve the precision components and finish.\n\n" +
      "Specific water resistance ratings are listed on the product page. When in doubt, remove the bracelet before water exposure.",
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
      "The Smart Bead Bracelet charges by resting on its included charging dock — precision POGO-pin contacts on the dock connect to the bracelet automatically, no cable to plug in. A full charge provides several days of regular use. Exact charging time and battery life are listed on the product page.",
  },
  {
    id: 'design-sizes',
    category: 'design',
    question: 'Does the bracelet come in different sizes or styles?',
    answer:
      "Yes. The VIBEZCORE Smart Bead Bracelet is available in multiple sizes and finishes. Available options are shown on the product page.",
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
      "**US customers** — import duties typically only apply to orders above $800 USD. Most VIBEZCORE orders fall below this threshold.\n\n" +
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
      "VIBEZCORE Breathwork Premium grants full access to all five guided breathwork states and the complete Audio Library, including every new session release. There is a single membership plan — pricing and terms are shown in full before you subscribe.",
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
      "Open the Account tab and tap Manage Subscription — this takes you straight to your device's subscription settings (Apple ID → Subscriptions on iOS, or the Play Store's Subscriptions page on Android), since Apple and Google require cancellations to go through their own systems for in-app purchases.\n\n" +
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
      "**On Android** — yes. Open your Play Store subscription settings (reachable from the Account tab) and choose Pause instead of Cancel. This is the better option if you're on an intro-priced plan: pausing keeps that rate when you resume, while canceling loses it.\n\n" +
      "**On iOS** — Apple doesn't offer a native pause option. You can cancel and resubscribe later, though this may mean losing any intro pricing.",
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
      "VIBEZCORE collects only what is necessary to provide our services — including account information, purchase details, and usage data to improve the platform. We do not collect sensitive health or biometric data through the bracelet. Full details are in our Privacy Policy.",
  },
  {
    id: 'privacy-deletion',
    category: 'privacy',
    question: 'How do I request deletion of my data?',
    answer:
      "You have the right to request full deletion of your personal data at any time. Submit your request through the Support Center and our team will process it in accordance with applicable data protection law (GDPR and CCPA where applicable) within 30 days.",
  },
];
