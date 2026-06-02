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

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  overview:   'Product Overview',
  bracelet:   'Smart Bracelet',
  audio:      'Audio Sessions',
  design:     'Design & Materials',
  orders:     'Orders & Shipping',
  membership: 'Membership',
  privacy:    'Privacy & Data',
};

/* Volgorde van categorieën in de UI (tabs). */
export const FAQ_CATEGORY_ORDER: FaqCategory[] = [
  'overview',
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
    answer:
      "Self-control is the foundation of everything. Without it, there is no confidence. Without confidence, there is no real growth, no success, no freedom.\n\n" +
      "Most people never fully understand themselves. They move through life reacting — to situations, to people, to emotions they can't name. They sense their potential, but can't access it. VIBEZCORE was built to change that.\n\n" +
      "VIBEZCORE is a two-part system designed for both immediate control and long-term transformation — for anyone who wants to operate at a higher level. Whether you are building confidence from the ground up, or you already have it and want to sharpen your edge, deepen your self-awareness, and compound your growth over time.\n\n" +
      "**1. Instant State Control — Smart Bead Bracelet**\nIn high-pressure moments, your internal state determines everything. The VIBEZCORE Smart Bead Bracelet uses precisely calibrated haptic signals that interact with your nervous system, guiding your body out of a reactive state and back into control — instantly. No effort. No screens. Just results.\n\n" +
      "**2. Long-Term Growth — Audio Library**\nReal change comes from understanding the patterns behind your thoughts, behavior, and decisions. The VIBEZCORE Audio Library is built for deep, structured development — helping you recognize behavioral patterns, build discipline, clarity, and self-respect over time. You don't just react differently. You become different.\n\n" +
      "This is not motivation. This is not a quick fix. This is a system — structured, compounding, and real.",
  },
  {
    id: 'overview-components',
    category: 'overview',
    question: 'What components are part of the VIBEZCORE system?',
    answer:
      "The VIBEZCORE system consists of two core instruments:\n\n" +
      "**1. Instant State Control — Smart Bead Bracelet**\nA precision-engineered neuroscience instrument that delivers calibrated haptic pulses through the wrist, triggering instant bottom-up state regulation. Body resets first. Mind follows.\n\n" +
      "The bracelet features an interchangeable bead system — one HapticCore module, 15 editions of natural gemstones sourced from across the globe. Origin, Signature and Reserve series. Each stone is unique in character, origin, and energy.\n\n" +
      "**2. Long-Term Growth — Audio Library**\nA structured psychological transformation program — four pillars, grounded in ancient wisdom and modern science. Not motivation. Real, compounding change over time.\n\n" +
      "Each instrument works independently. Together, they form a complete system for both immediate control and lasting growth.",
  },
  {
    id: 'overview-separate-purchase',
    category: 'overview',
    question: 'Can I purchase the bracelet and audio library separately?',
    answer:
      "Yes. VIBEZCORE can be used in three ways:\n\n" +
      "**Bracelet only** — as a standalone state regulation instrument for daily use.\n\n" +
      "**Audio Library only** — access the session library independently through a membership.\n\n" +
      "**Full system** — the recommended approach. Both instruments are designed to work in tandem for maximum and lasting impact.",
  },
  {
    id: 'overview-who-for',
    category: 'overview',
    question: 'Who is VIBEZCORE designed for?',
    answer:
      "VIBEZCORE is built for anyone who takes their performance, mindset, and daily state seriously.\n\n" +
      "That includes people who are building self-confidence and self-respect from the ground up — those who feel held back, overlooked, or stuck in patterns they can't break. But it equally includes high-performers, leaders, and entrepreneurs who already have confidence and results — and want to sharpen their edge, deepen their self-control, and compound their growth.\n\n" +
      "The common thread is simple: a commitment to operating at a higher level — mentally, emotionally, and in daily life.",
  },
  {
    id: 'overview-what-makes-different',
    category: 'overview',
    question: 'What makes VIBEZCORE different from other self-improvement platforms?',
    answer:
      "Most personal development gives you inspiration that fades by evening. VIBEZCORE gives you a system that works on two levels simultaneously.\n\n" +
      "**Instant State Control** — the Smart Bead Bracelet regulates your state in real time. In the moments that count — under pressure, in high-stakes situations, when clarity drops — your body is guided back to control automatically. No meditation required. No conscious effort. Just immediate, repeatable results.\n\n" +
      "**Long-Term Growth** — the Audio Library rewires how you think, feel, and respond over time. Building self-understanding, discipline, and self-respect that compounds — session after session.\n\n" +
      "Two instruments. One direction: growth, success, and freedom.",
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
    id: 'bracelet-noticeable-vibrations',
    category: 'bracelet',
    question: 'How noticeable are the vibrations?',
    answer:
      "The vibrations are designed to be subtle and non-intrusive — noticeable to you, invisible to others. In most social and professional settings, the haptic signal goes completely undetected by those around you. You can adjust the intensity to suit your preference and context.",
  },
  {
    id: 'bracelet-multiple-times-day',
    category: 'bracelet',
    question: 'Can VIBEZCORE be used multiple times per day?',
    answer:
      "Yes. The Smart Bead Bracelet can be worn throughout the entire day and used as often as you choose. Many users wear it from morning to evening as a constant awareness anchor.\n\n" +
      "For audio sessions, we recommend one focused session per day for optimal integration — though this depends on personal preference and capacity.",
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
      "The VIBEZCORE Audio Library covers four core domains:\n\n" +
      "**Mindset** — cognitive reframing, belief systems, identity, and mental flexibility.\n\n" +
      "**Resilience** — stress regulation, emotional recovery, adversity response, and nervous system awareness.\n\n" +
      "**Social Mastery** — communication, influence, presence, reading social dynamics, and connection.\n\n" +
      "**Personal Growth** — habit formation, self-discipline, purpose, focus, and intentional living.",
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
    question: 'Can I access the audio sessions offline?',
    answer:
      "Offline access depends on your membership tier. Certain plans include the ability to download sessions for offline listening. Please refer to the membership details on the VIBEZCORE platform for the most current information.",
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
    id: 'design-charging',
    category: 'design',
    question: 'How is the bracelet charged?',
    answer:
      "The Smart Bead Bracelet charges via the included magnetic charging cable. A full charge provides several days of regular use. Exact charging time and battery life are listed on the product page.",
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
    id: 'membership-includes',
    category: 'membership',
    question: 'What does a VIBEZCORE membership include?',
    answer:
      "A VIBEZCORE membership grants access to the full Audio Library, new session releases, and member-exclusive content. Specific inclusions vary by membership tier — full details are available on the Membership page.",
  },
  {
    id: 'membership-cancel',
    category: 'membership',
    question: 'How do I cancel my membership?',
    answer:
      "You can cancel your membership at any time through your account settings. Cancellation takes effect at the end of your current billing period — you retain full access until then. If you need assistance, contact us via the Support Center.",
  },
  {
    id: 'membership-pause',
    category: 'membership',
    question: 'Can I pause my membership instead of canceling?',
    answer:
      "Membership pause options depend on your current plan. Please contact our support team via the Support Center to discuss what options are available for your account.",
  },
  {
    id: 'membership-cant-login',
    category: 'membership',
    question: "I can't log into my account — what should I do?",
    answer:
      "Try resetting your password via the login screen. If the issue persists, contact our support team through the Support Center with your account email address and a description of the issue.",
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
