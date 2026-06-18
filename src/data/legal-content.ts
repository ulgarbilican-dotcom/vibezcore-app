/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Legal & Safety content

   Volledige inhoud van de 5 legal/safety-documenten in TypeScript-vorm
   (Terms / Privacy / Refund / Cookies / Health). Bron: webapp HTML's
   ontvangen op 2026-05-27. Tekst is 1:1 overgenomen — niets gewijzigd
   of geherformuleerd zonder operator-akkoord.

   Inline markup ondersteund door de renderer:
     **bold**          → vet
     [text](https://…)  → tappable link (opent extern via WebBrowser)

   Toevoegen van nieuwe sectie: voeg blocks toe aan `blocks`-array in
   chronologische volgorde. H2 start een nieuwe sectie visueel.
   ─────────────────────────────────────────────────────────────────── */

export type LegalSlug =
  | 'terms'
  | 'privacy'
  | 'accessibility'
  | 'shipping'
  | 'refund'
  | 'cookies'
  | 'health'
  | 'audio-sessions';

/* Block types — renderer in src/app/legal/[doc].tsx kent al deze kinds.
   Toegevoegd 2026-05-30 (sync met website): h3, tags, cards.

   - h2          → genummerde sectie-header ("01 Information We Collect")
                   Renderer telt automatisch h2's en zet section-number
                   als eyebrow erboven. Eerste h2 = 01, etc.
   - h3          → sub-header binnen een h2-sectie (compacter)
   - p           → paragraaf met inline **bold** en [link](url)
   - ul          → opsommingslijst (bullet of checkmark — beslist
                   renderer obv `style` prop, default bullet)
   - tags        → horizontale chips (Name, Email, Phone, etc.)
   - cards       → 2-kolom grid van label+description cards
                   (Essential / Analytics / Functional / etc.)
   - highlight   → blauwe accent-box met optionele title
   - danger      → rode accent-box (crisis-info op Health doc) */
export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'ul'; items: string[]; style?: 'bullet' | 'check' }
  | { kind: 'tags'; items: string[] }
  | { kind: 'cards'; items: Array<{ title: string; text: string }> }
  | { kind: 'highlight'; title?: string; text: string }
  | { kind: 'danger'; title?: string; text: string };

export type LegalDoc = {
  slug: LegalSlug;
  eyebrow: string;
  title: string;
  /** Optionele hero-tagline onder de titel (bv. "We believe privacy is
   *  a fundamental human right..."). Komt 1-op-1 van vibezcore.com. */
  subtitle?: string;
  lastUpdated: string;
  /** Korte tagline voor de Legal-navigatie onderaan elk doc + lijst
   *  op de Account-tab. */
  short: string;
  blocks: LegalBlock[];
};

/* Support-URL — gedeeld door alle docs in de "Contact support"-CTA en
   inline-mentions. Externe link, blijft op vibezcore.com zelfs nadat de
   webapp uitgefaseerd is (operator-besluit 2026-05-27). */
export const SUPPORT_URL = 'https://www.vibezcore.com/support';

/* ── 1. Terms and Conditions ────────────────────────────────────────
   Synced 1-op-1 met vibezcore.com/terms (2026-05-30). 17 secties.
   Sectie-nummering wordt automatisch toegevoegd door de renderer. */
export const TERMS: LegalDoc = {
  slug: 'terms',
  eyebrow: 'VIBEZCORE',
  title: 'Terms and Conditions',
  subtitle:
    'Please read these terms carefully before using the VIBEZCORE platform, services, or products.',
  lastUpdated: 'March 2026',
  short: 'Terms',
  blocks: [
    /* ── 01. Use of the Platform ── */
    { kind: 'h2', text: 'Use of the Platform' },
    {
      kind: 'p',
      text: 'The VIBEZCORE platform provides educational content, structured audio sessions, and physical tools designed to support personal reflection, awareness, and intentional living.',
    },
    {
      kind: 'p',
      text: 'Users agree to access and use the platform only for lawful purposes and in a manner that does not infringe the rights of others or interfere with the operation of the website.',
    },
    { kind: 'h3', text: 'Users must not:' },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Violate applicable laws or regulations',
        'Attempt unauthorized access to the platform or its systems',
        'Interfere with security or technical infrastructure',
        'Copy, distribute, or commercially exploit platform content without authorization',
        'Use automated scraping or data extraction tools',
      ],
    },
    {
      kind: 'highlight',
      text: 'VIBEZCORE reserves the right to restrict or terminate access to users who violate these Terms.',
    },

    /* ── 02. Eligibility ── */
    { kind: 'h2', text: 'Eligibility' },
    {
      kind: 'p',
      text: 'By using the VIBEZCORE website or services, you confirm that you are at least 16 years old or meet the minimum age requirement under the laws applicable in your jurisdiction.',
    },
    {
      kind: 'p',
      text: 'If you are under this age, use of the platform is permitted only with the consent of a parent or legal guardian.',
    },

    /* ── 03. Intellectual Property ── */
    { kind: 'h2', text: 'Intellectual Property' },
    {
      kind: 'p',
      text: 'All content and materials available on the VIBEZCORE platform are the intellectual property of VIBEZCORE or its licensors, protected under applicable copyright, trademark, and intellectual property laws.',
    },
    {
      kind: 'tags',
      items: [
        'Text',
        'Audio',
        'Graphics',
        'Logos',
        'Design elements',
        'Software',
        'Educational materials',
        'Digital products',
      ],
    },
    {
      kind: 'p',
      text: 'Users may not reproduce, distribute, modify, publish, transmit, or commercially exploit any VIBEZCORE content without prior written permission.',
    },

    /* ── 04. Educational & Wellness Framework ── */
    { kind: 'h2', text: 'Educational & Wellness Framework' },
    {
      kind: 'p',
      text: 'VIBEZCORE is built on the science of awareness and the understanding that meaningful personal change can emerge through both cognitive insight and bottom-up processes.',
    },
    {
      kind: 'p',
      text: 'The platform provides structured audio sessions, educational materials, and supportive physical tools designed to help individuals cultivate awareness, recognize behavioral patterns, and develop intentional responses in daily life.',
    },
    {
      kind: 'p',
      text: 'Physical products — including bracelets and related accessories — are designed as supportive tools that may help reinforce focus, awareness, and intentional state shifts during everyday activities.',
    },

    /* ── 05. Personal Responsibility ── */
    { kind: 'h2', text: 'Personal Responsibility' },
    {
      kind: 'p',
      text: 'Users remain fully responsible for how they interpret and apply any information, tools, or materials provided through the VIBEZCORE platform.',
    },
    {
      kind: 'p',
      text: 'Use of VIBEZCORE services and products is voluntary and based on personal responsibility.',
    },

    /* ── 06. Medical & Therapeutic Disclaimer ── */
    { kind: 'h2', text: 'Medical & Therapeutic Disclaimer' },
    {
      kind: 'highlight',
      text: 'VIBEZCORE does not provide medical, psychological, psychiatric, or therapeutic services. Nothing on this platform should be interpreted as medical advice.',
    },
    {
      kind: 'p',
      text: 'The platform — including audio sessions, educational materials, and physical products — is intended for educational, personal development, and general wellness purposes only. It is not intended to diagnose, treat, cure, or prevent any medical or mental health condition.',
    },
    {
      kind: 'p',
      text: 'Individuals experiencing medical or mental health concerns should seek guidance from licensed healthcare professionals.',
    },

    /* ── 07. Products ── */
    { kind: 'h2', text: 'Products' },
    {
      kind: 'p',
      text: 'VIBEZCORE may offer physical products such as bracelets and accessories designed to support awareness and intentional routines. These products are lifestyle and awareness-support tools and are not classified as medical devices.',
    },
    {
      kind: 'p',
      text: 'They should not be used as a replacement for medical care, therapy, or professional treatment.',
    },

    /* ── 08. Payments & Purchases ── */
    { kind: 'h2', text: 'Payments & Purchases' },
    {
      kind: 'p',
      text: 'For paid digital services, memberships, or products:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Prices and payment conditions are clearly presented before purchase',
        'Payment must be completed through approved payment providers',
        'Access to digital content may be granted after successful payment',
      ],
    },
    {
      kind: 'p',
      text: 'Additional refund conditions are described in the [Shipping & Refund Policy](https://www.vibezcore.com/shipping-policy).',
    },

    /* ── 09. Right of Withdrawal (EU Consumers) ── */
    { kind: 'h2', text: 'Right of Withdrawal (EU Consumers)' },
    {
      kind: 'p',
      text: 'If you are a consumer residing in the European Union, you generally have the right to withdraw from a purchase within 14 days without giving any reason.',
    },
    {
      kind: 'highlight',
      text: 'For digital content not supplied on a tangible medium — such as downloads, streaming, or digital courses — the right of withdrawal is lost once the performance has begun. By clicking "Purchase" or "Access", you expressly consent to this and acknowledge that you waive your statutory right of withdrawal.',
    },

    /* ── 10. Third-Party Services ── */
    { kind: 'h2', text: 'Third-Party Services' },
    {
      kind: 'p',
      text: 'The VIBEZCORE website may contain links to external websites or services operated by third parties. VIBEZCORE does not control and is not responsible for the content, policies, or practices of third-party services.',
    },
    {
      kind: 'p',
      text: 'Users access such services at their own risk.',
    },

    /* ── 11. Platform Availability ── */
    { kind: 'h2', text: 'Platform Availability' },
    {
      kind: 'p',
      text: 'While VIBEZCORE aims to maintain continuous availability of the platform, we do not guarantee uninterrupted access. The website or services may occasionally be unavailable due to maintenance, technical issues, or external circumstances.',
    },
    {
      kind: 'p',
      text: 'VIBEZCORE reserves the right to modify, suspend, or discontinue services at any time.',
    },

    /* ── 12. Disclaimer of Warranties ── */
    { kind: 'h2', text: 'Disclaimer of Warranties' },
    {
      kind: 'p',
      text: 'The VIBEZCORE platform and its content are provided **"as is"** and **"as available"**. To the maximum extent permitted by law, VIBEZCORE disclaims all warranties, including but not limited to:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Accuracy or completeness of information',
        'Uninterrupted or error-free operation',
        'Fitness for a particular purpose',
      ],
    },

    /* ── 13. Limitation of Liability ── */
    { kind: 'h2', text: 'Limitation of Liability' },
    {
      kind: 'p',
      text: 'To the maximum extent permitted by applicable law, VIBEZCORE shall not be liable for any direct, indirect, incidental, or consequential damages arising from:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'The use or inability to use the platform',
        'Reliance on content provided through the platform',
        'Technical interruptions or errors',
        'Actions of third-party services',
      ],
    },

    /* ── 14. Governing Law & Jurisdiction ── */
    { kind: 'h2', text: 'Governing Law & Jurisdiction' },
    {
      kind: 'p',
      text: 'These Terms and Conditions shall be governed by and interpreted in accordance with the laws of **Belgium**. Any disputes arising out of or relating to the use of the VIBEZCORE platform shall be subject to the exclusive jurisdiction of the competent courts of **Antwerp, Belgium**.',
    },
    {
      kind: 'p',
      text: "Nothing in these Terms limits mandatory consumer protection rights applicable under the laws of the user's country of residence.",
    },

    /* ── 15. Changes to These Terms ── */
    { kind: 'h2', text: 'Changes to These Terms' },
    {
      kind: 'p',
      text: 'VIBEZCORE may update these Terms periodically. Any updates will be published on this page with an updated "Last updated" date.',
    },
    {
      kind: 'p',
      text: 'Continued use of the VIBEZCORE platform after such updates constitutes acceptance of the revised Terms.',
    },

    /* ── 16. Severability ── */
    { kind: 'h2', text: 'Severability' },
    {
      kind: 'p',
      text: 'If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.',
    },

    /* ── 17. Contact ── */
    { kind: 'h2', text: 'Contact' },
    {
      kind: 'p',
      text: 'Questions about these terms, your order, or the VIBEZCORE platform? Our support team is here to help.',
    },
  ],
};

/* ── 2. Privacy Policy ──────────────────────────────────────────────── */
/* Privacy Policy — synced 1-op-1 met vibezcore.com/privacy (2026-05-30).
   Sectie-nummering wordt automatisch toegevoegd door de renderer (h2 →
   "01", "02", ...) zodat we titles zonder prefix kunnen schrijven. */
export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  eyebrow: 'VIBEZCORE',
  title: 'Privacy Policy',
  subtitle:
    "We believe privacy is a fundamental human right. Here's exactly how we handle your data.",
  lastUpdated: 'March 2026',
  short: 'Privacy',
  blocks: [
    /* ── 01. Information We Collect ── */
    { kind: 'h2', text: 'Information We Collect' },

    { kind: 'h3', text: 'Personal Information' },
    {
      kind: 'p',
      text: 'Data that can identify you directly or indirectly when you interact with VIBEZCORE.',
    },
    {
      kind: 'tags',
      items: [
        'Name',
        'Email address',
        'Phone number',
        'Login credentials',
        'Billing information',
        'Form submissions',
      ],
    },

    { kind: 'h3', text: 'Usage & Technical Data' },
    {
      kind: 'p',
      text: 'Automatically collected when you visit our website to help improve functionality and performance.',
    },
    {
      kind: 'tags',
      items: [
        'IP address',
        'Browser type',
        'Device & OS',
        'Pages visited',
        'Date & time',
        'Referring URLs',
        'Navigation patterns',
      ],
    },

    { kind: 'h3', text: 'Cookies & Tracking' },
    {
      kind: 'p',
      text: 'We use cookies to enhance user experience, analyze usage, and improve our services. You may control or disable cookies through your browser settings.',
    },
    {
      kind: 'cards',
      items: [
        { title: 'Essential',  text: 'Required for basic website functionality' },
        { title: 'Analytics',  text: 'Help us understand how you use our platform' },
        { title: 'Functional', text: 'Remember your preferences and settings' },
        { title: 'Security',   text: 'Protect against fraud and abuse' },
      ],
    },

    /* ── 02. How We Collect Information ── */
    { kind: 'h2', text: 'How We Collect Information' },
    {
      kind: 'p',
      text: 'Information may be collected through several methods when you interact with VIBEZCORE.',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Directly from you when you register, contact us, or subscribe',
        'Automatically through website usage and analytics tools',
        'Through cookies and tracking technologies',
        'Through interactions with our content or services',
      ],
    },

    /* ── 03. How We Use Your Information ── */
    { kind: 'h2', text: 'How We Use Your Information' },
    {
      kind: 'p',
      text: 'We use your information only where it genuinely helps us serve you better.',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Providing, maintaining, and improving our services',
        'Processing transactions and managing accounts',
        'Responding to inquiries and support requests',
        'Communicating updates and service-related messages',
        'Sending newsletters when you have opted in',
        'Monitoring platform performance and usage patterns',
        'Preventing fraud, abuse, or security threats',
        'Complying with legal and regulatory obligations',
      ],
    },

    /* ── 04. Legal Basis for Processing ── */
    { kind: 'h2', text: 'Legal Basis for Processing' },
    {
      kind: 'p',
      text: 'For users located within the European Economic Area (EEA), we process personal data based on one or more of the following legal grounds:',
    },
    {
      kind: 'cards',
      items: [
        { title: 'Consent',              text: 'You have given us explicit permission' },
        { title: 'Contract',             text: 'Necessary to perform our services for you' },
        { title: 'Legal obligation',     text: 'Required to comply with the law' },
        { title: 'Legitimate interests', text: "Where they don't override your rights" },
      ],
    },

    /* ── 05. Sharing of Information ── */
    { kind: 'h2', text: 'Sharing of Information' },
    {
      kind: 'highlight',
      text: 'VIBEZCORE does not sell your personal data — ever.',
    },
    {
      kind: 'p',
      text: 'We may share information with trusted third parties only when necessary to operate our services:',
    },
    {
      kind: 'tags',
      items: [
        'Hosting providers',
        'Payment processors',
        'Analytics providers',
        'Technical partners',
        'Legal authorities (when required)',
      ],
    },
    {
      kind: 'p',
      text: 'All parties are contractually required to protect personal information and process it only for authorized purposes.',
    },

    /* ── 06. International Data Transfers ── */
    { kind: 'h2', text: 'International Data Transfers' },
    {
      kind: 'p',
      text: 'Because VIBEZCORE operates globally, personal information may be transferred to and processed in countries outside your country of residence.',
    },
    {
      kind: 'p',
      text: 'Where required by law, we implement appropriate safeguards — such as **Standard Contractual Clauses** — to ensure international data transfers comply with applicable data protection regulations.',
    },

    /* ── 07. Data Retention ── */
    { kind: 'h2', text: 'Data Retention' },
    {
      kind: 'p',
      text: 'We keep your personal data only for as long as genuinely necessary.',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'To provide services and fulfill contractual obligations',
        'To comply with legal or regulatory requirements',
        'To resolve disputes and enforce agreements',
      ],
    },
    {
      kind: 'p',
      text: 'When data is no longer required, it is securely deleted or anonymized.',
    },

    /* ── 08. Data Security ── */
    { kind: 'h2', text: 'Data Security' },
    {
      kind: 'p',
      text: 'VIBEZCORE implements appropriate technical and organizational measures to protect personal information from unauthorized access, alteration, disclosure, or destruction.',
    },
    {
      kind: 'highlight',
      text: 'No internet transmission or storage system can be guaranteed to be completely secure. We continuously work to improve our safeguards.',
    },

    /* ── 09. Your Privacy Rights ── */
    { kind: 'h2', text: 'Your Privacy Rights' },
    {
      kind: 'p',
      text: 'Depending on your location, you may have the following rights regarding your personal data:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Access your personal data',
        'Correct inaccurate information',
        'Request deletion of personal data',
        'Restrict or object to processing',
        'Data portability',
        'Withdraw consent at any time',
      ],
    },
    {
      kind: 'p',
      text: 'To exercise any of these rights, please use the contact information provided below.',
    },

    /* ── 10. California Privacy Rights ── */
    { kind: 'h2', text: 'California Privacy Rights' },
    {
      kind: 'p',
      text: 'If you are a California resident, the CCPA/CPRA grants you specific additional rights:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Know what personal information is collected about you',
        'Request deletion of personal information',
        'Correct inaccurate personal information',
        'Opt out of the sale or sharing of personal information',
      ],
    },
    {
      kind: 'highlight',
      text: 'VIBEZCORE does not sell personal data.',
    },

    /* ── 11. Children's Privacy ── */
    { kind: 'h2', text: "Children's Privacy" },
    {
      kind: 'p',
      text: 'The VIBEZCORE platform is not directed to individuals under the age of 13. We do not knowingly collect personal data from children.',
    },
    {
      kind: 'p',
      text: 'If we become aware that personal information from a child has been collected without parental consent, we will promptly take steps to delete such information.',
    },

    /* ── 12. Third-Party Links ── */
    { kind: 'h2', text: 'Third-Party Links' },
    {
      kind: 'p',
      text: 'Our website may contain links to external websites or services not operated by VIBEZCORE. We are not responsible for the privacy practices or policies of third-party websites.',
    },
    {
      kind: 'p',
      text: 'We encourage you to review the privacy policies of any third-party sites you visit.',
    },

    /* ── 13. Updates to This Policy ── */
    { kind: 'h2', text: 'Updates to This Policy' },
    {
      kind: 'p',
      text: 'We may update this Privacy Policy periodically to reflect changes in legal requirements, technology, or business practices.',
    },
    {
      kind: 'p',
      text: 'Any updates will be posted on this page with a revised "Last updated" date. We encourage you to review this policy occasionally.',
    },

    /* ── 14. Contact ── */
    { kind: 'h2', text: 'Contact' },
    {
      kind: 'p',
      text: 'Questions about this policy, your order, or the VIBEZCORE platform? Our support team is here to help.',
    },
  ],
};

/* ── 2b. Accessibility Statement ────────────────────────────────────
   Synced 1-op-1 met vibezcore.com/accessibility (2026-05-30).
   6 secties. Intro-paragraaf vóór de eerste h2 (zoals op de site). */
export const ACCESSIBILITY: LegalDoc = {
  slug: 'accessibility',
  eyebrow: 'VIBEZCORE',
  title: 'Accessibility Statement',
  subtitle:
    'VIBEZCORE is committed to ensuring digital accessibility for everyone, regardless of technology, ability, or circumstances.',
  lastUpdated: 'March 2026',
  short: 'Accessibility',
  blocks: [
    /* Intro vóór sectie 01 — geen h2 dus geen sectie-nummer. */
    {
      kind: 'p',
      text: 'VIBEZCORE continuously works to improve the accessibility, usability, and clarity of our digital platform so that all visitors can engage with the VIBEZCORE experience with ease.',
    },

    /* ── 01. What Web Accessibility Means ── */
    { kind: 'h2', text: 'What Web Accessibility Means' },
    {
      kind: 'p',
      text: 'An accessible website allows visitors with disabilities to navigate, understand, and interact with content with the same or similar ease as other users. Accessibility may be supported through assistive technologies such as:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Screen readers',
        'Keyboard navigation',
        'Voice navigation tools',
        'Alternative input devices',
        'Browser accessibility features',
      ],
    },

    /* ── 02. Accessibility Adjustments on This Site ── */
    { kind: 'h2', text: 'Accessibility Adjustments on This Site' },
    {
      kind: 'p',
      text: 'The VIBEZCORE website aims to follow the Web Content Accessibility Guidelines (WCAG) 2.1 and strives to meet Level AA accessibility standards. The following measures have been implemented:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Clear and structured heading hierarchy across pages',
        'Logical content order to support screen readers',
        'Defined language settings for the website',
        'Alternative text added to images where appropriate',
        'Color combinations designed to meet accessibility contrast standards',
        'Reduced unnecessary motion and animations',
        'Compatibility with keyboard navigation',
        'Support for common screen reader technologies',
        'Efforts to ensure audio, video, and downloadable files are accessible',
      ],
    },
    {
      kind: 'p',
      text: 'Accessibility improvements are reviewed and implemented on an ongoing basis.',
    },

    /* ── 03. Browser & Device Compatibility ── */
    { kind: 'h2', text: 'Browser & Device Compatibility' },
    {
      kind: 'p',
      text: 'The VIBEZCORE website is designed to be compatible with modern web browsers and assistive technologies. Tested on the latest versions of:',
    },
    {
      kind: 'tags',
      items: [
        'Google Chrome',
        'Mozilla Firefox',
        'Apple Safari',
        'Microsoft Edge',
      ],
    },
    {
      kind: 'p',
      text: 'Functionality may vary slightly depending on device configuration or assistive technology.',
    },

    /* ── 04. Third-Party Content ── */
    { kind: 'h2', text: 'Third-Party Content' },
    {
      kind: 'p',
      text: 'Some parts of the VIBEZCORE website may include content or services provided by third-party platforms such as embedded media, external tools, or social media integrations.',
    },
    {
      kind: 'highlight',
      text: 'While we strive to ensure accessibility throughout the website, we cannot fully guarantee the accessibility standards of third-party content.',
    },

    /* ── 05. Continuous Improvement ── */
    { kind: 'h2', text: 'Continuous Improvement' },
    {
      kind: 'p',
      text: 'Accessibility is an ongoing process. VIBEZCORE continuously evaluates and improves the website to enhance accessibility, usability, and clarity for all visitors.',
    },
    {
      kind: 'p',
      text: 'We welcome feedback that helps us improve the experience.',
    },

    /* ── 06. Contact ── */
    { kind: 'h2', text: 'Contact' },
    {
      kind: 'p',
      text: 'Questions about accessibility or the VIBEZCORE platform? Our support team is here to help.',
    },
  ],
};

/* ── 2c. Shipping Policy ────────────────────────────────────────────
   Synced 1-op-1 met vibezcore.com/shipping-policy (2026-05-30).
   10 secties. Intro-paragraaf vóór de eerste h2 (zoals op de site).
   Country-cards in sectie 03 gebruiken vlag-emoji's in de title. */
export const SHIPPING: LegalDoc = {
  slug: 'shipping',
  eyebrow: 'VIBEZCORE',
  title: 'Shipping Policy',
  subtitle:
    'Everything you need to know about how VIBEZCORE processes and delivers your order — wherever you are in the world.',
  lastUpdated: 'March 2026',
  short: 'Shipping',
  blocks: [
    /* Intro vóór sectie 01. */
    {
      kind: 'p',
      text: 'This Shipping Policy applies to all physical product orders placed through the VIBEZCORE website. VIBEZCORE ships worldwide, subject to carrier availability and local regulations.',
    },

    /* ── 01. Order Processing ── */
    { kind: 'h2', text: 'Order Processing' },
    {
      kind: 'p',
      text: 'Orders are typically processed within **1–3 business days** after payment confirmation. Orders placed on weekends or public holidays are processed on the next business day.',
    },
    {
      kind: 'p',
      text: 'During high-demand periods, product launches, or seasonal activity, processing times may be slightly extended. You will receive a confirmation email once your order has been processed and shipped.',
    },

    /* ── 02. Shipping Destinations ── */
    { kind: 'h2', text: 'Shipping Destinations' },
    {
      kind: 'p',
      text: 'VIBEZCORE ships to customers worldwide. Some regions may have limited shipping options due to logistical or regulatory restrictions — this will be indicated at checkout.',
    },

    /* ── 03. Delivery Times ── */
    { kind: 'h2', text: 'Delivery Times' },
    {
      kind: 'p',
      text: 'Estimated delivery times vary by destination. All timeframes are business days from dispatch and are estimates, not guaranteed dates.',
    },
    {
      kind: 'cards',
      items: [
        { title: '🇪🇺 Europe',         text: '3–7 business days' },
        { title: '🇺🇸 United States',  text: '5–10 business days' },
        { title: '🇨🇦 Canada',         text: '7–12 business days' },
        { title: '🌍 Rest of World',   text: '7–15 business days' },
      ],
    },
    {
      kind: 'highlight',
      text: 'Delivery estimates begin from the moment your order is dispatched, not from the date of purchase. Customs processing may add additional time for international orders.',
    },

    /* ── 04. Shipping Costs ── */
    { kind: 'h2', text: 'Shipping Costs' },
    {
      kind: 'p',
      text: 'Shipping costs are calculated at checkout based on your delivery destination, shipping carrier, and package weight. The total shipping cost is clearly displayed before you complete your purchase.',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'All prices are inclusive of Belgian VAT where applicable',
        "Customs duties, import taxes, or local fees are the customer's responsibility",
        'Additional carrier surcharges may apply for remote destinations',
      ],
    },

    /* ── 05. Order Tracking ── */
    { kind: 'h2', text: 'Order Tracking' },
    {
      kind: 'p',
      text: 'Once your order has been dispatched, VIBEZCORE will send a shipping confirmation email including tracking information where available. Tracking availability may vary depending on the carrier and destination country.',
    },

    /* ── 06. Customs & Duties ── */
    { kind: 'h2', text: 'Customs & Duties' },
    {
      kind: 'p',
      text: 'International shipments may be subject to customs inspections, import duties, or taxes imposed by the destination country. These charges are determined by local authorities and are the sole responsibility of the customer.',
    },
    {
      kind: 'highlight',
      text: 'VIBEZCORE has no control over customs charges and cannot predict their amount. Failure to pay required duties may result in delays, returns, or destruction of the shipment — VIBEZCORE cannot be held responsible for such outcomes.',
    },
    { kind: 'h3', text: 'Country-specific notes' },
    {
      kind: 'p',
      text: '**United States:** Import duties typically apply to orders above $800 USD. Most VIBEZCORE orders fall below this threshold.',
    },
    {
      kind: 'p',
      text: '**Canada:** Orders may be subject to GST/HST and provincial taxes upon import. Canada Post or a customs broker will contact you if applicable.',
    },
    {
      kind: 'p',
      text: '**European Union:** VAT is included in the product price for EU customers. No additional import VAT should apply for orders shipped within the EU.',
    },
    {
      kind: 'p',
      text: '**Rest of World:** Import rules vary significantly by country. We recommend checking your local customs authority for guidance before ordering.',
    },

    /* ── 07. Shipping Delays ── */
    { kind: 'h2', text: 'Shipping Delays' },
    {
      kind: 'p',
      text: "Delivery times may be affected by circumstances outside VIBEZCORE's control, including:",
    },
    {
      kind: 'tags',
      items: [
        'Customs processing',
        'Weather conditions',
        'Transportation disruptions',
        'Carrier delays',
        'Global logistics issues',
        'Public holidays',
      ],
    },
    {
      kind: 'p',
      text: 'VIBEZCORE is not responsible for delays caused by shipping carriers, customs authorities, or other third-party logistics providers.',
    },

    /* ── 08. Incorrect Shipping Address ── */
    { kind: 'h2', text: 'Incorrect Shipping Address' },
    {
      kind: 'p',
      text: 'Customers are responsible for providing accurate and complete shipping information at checkout. VIBEZCORE is not responsible for lost or delayed shipments resulting from incorrect or incomplete address details.',
    },
    {
      kind: 'p',
      text: 'If an order is returned due to an incorrect address, additional shipping fees may apply for reshipment. Please double-check your address before confirming your order.',
    },

    /* ── 09. Lost or Damaged Shipments ── */
    { kind: 'h2', text: 'Lost or Damaged Shipments' },
    {
      kind: 'p',
      text: 'If your shipment arrives damaged or appears to be lost in transit, please contact VIBEZCORE as soon as possible through our [Support page](https://www.vibezcore.com/support).',
    },
    {
      kind: 'p',
      text: 'To investigate your case, we may ask you to provide:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Photographs of the damaged package or contents',
        'Your order confirmation number',
        'Shipping details and tracking information',
      ],
    },

    /* ── 10. Contact ── */
    { kind: 'h2', text: 'Contact' },
    {
      kind: 'p',
      text: 'Questions about your order or shipment? Our support team is here to help.',
    },
  ],
};

/* ── 3. Refund & Returns Policy ─────────────────────────────────────
   Synced 1-op-1 met vibezcore.com/refund-policy (2026-05-30).
   10 secties + intro. Title bijgewerkt van "Refund Policy" naar
   "Refund & Returns Policy" (matched website). */
export const REFUND: LegalDoc = {
  slug: 'refund',
  eyebrow: 'VIBEZCORE',
  title: 'Refund & Returns Policy',
  lastUpdated: 'March 2026',
  short: 'Refunds',
  blocks: [
    /* Overview — intro vóór sectie 01 (op de site "Overview" met
       sec-num "—" = ongenummerd). */
    {
      kind: 'p',
      text: 'This policy explains the conditions under which VIBEZCORE accepts returns, cancellations, and refunds for products or services purchased through the VIBEZCORE website. It applies to all customers worldwide and is designed to comply with applicable consumer protection laws, including EU regulations.',
    },
    {
      kind: 'p',
      text: 'Different rules apply depending on the type of purchase:',
    },
    {
      kind: 'ul',
      items: [
        '**Physical Products** — such as the VIBEZCORE Smart Bead Bracelet',
        '**Digital Content or Services** — such as Audio Sessions, Digital Materials, or memberships',
      ],
    },

    /* ── 01. General Policy ── */
    { kind: 'h2', text: 'General Policy' },
    {
      kind: 'p',
      text: 'VIBEZCORE strives to provide high-quality products and services. If you are not satisfied with your purchase, you may be eligible for a return or refund under the conditions outlined in this policy.',
    },

    /* ── 02. Returns for Physical Products ── */
    { kind: 'h2', text: 'Returns for Physical Products' },
    {
      kind: 'p',
      text: 'Customers may exercise their right of withdrawal and return physical products within **14 days of receiving the item**, in accordance with applicable consumer protection laws.',
    },
    {
      kind: 'p',
      text: 'To exercise this right, notify VIBEZCORE in writing before the end of the 14-day period at info@vibezcore.com, including:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Your order number',
        'The product(s) concerned',
        'Your name and contact details',
        'A clear statement of withdrawal',
      ],
    },
    {
      kind: 'p',
      text: 'After submission, the product must be returned within 14 days. To be eligible for a refund, the product must be:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Unused and in its original condition',
        'Returned in original packaging where possible',
        'Accompanied by proof of purchase',
      ],
    },
    {
      kind: 'p',
      text: 'Once received and inspected, VIBEZCORE will notify you whether the refund is approved. Approved refunds are processed using the original payment method.',
    },

    /* ── 03. Return Shipping ── */
    { kind: 'h2', text: 'Return Shipping' },
    {
      kind: 'p',
      text: 'Unless the product is defective, damaged, or incorrect, customers are responsible for the cost of return shipping. We recommend using a trackable shipping method. VIBEZCORE cannot be held responsible for items lost during return transit.',
    },

    /* ── 04. Damaged or Incorrect Products ── */
    { kind: 'h2', text: 'Damaged or Incorrect Products' },
    {
      kind: 'p',
      text: 'If you receive a product that is defective, damaged, or incorrect, notify us within **7 days of receiving the order** at info@vibezcore.com. You may be asked to provide photos to verify the issue.',
    },
    {
      kind: 'p',
      text: 'If the claim is validated, VIBEZCORE may offer:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'A replacement product',
        'A full refund, including reasonable return shipping costs where applicable',
      ],
    },

    /* ── 05. Digital Products and Services ── */
    { kind: 'h2', text: 'Digital Products and Services' },
    {
      kind: 'p',
      text: 'Digital products and services — including Audio Sessions, Digital Materials, Membership Access, and Streaming or Downloadable Content — are **generally non-refundable once access has been granted**.',
    },
    {
      kind: 'p',
      text: 'Due to the nature of digital content, returns cannot be accepted once the content has been accessed, streamed, or downloaded.',
    },

    /* ── 06. Right of Withdrawal — Digital Content ── */
    { kind: 'h2', text: 'Right of Withdrawal — Digital Content' },
    {
      kind: 'p',
      text: 'As an EU consumer, you normally have the right to withdraw from a purchase within 14 days. However, for digital content not supplied on a tangible medium, this right is lost once delivery has begun.',
    },
    {
      kind: 'highlight',
      text: 'By completing your purchase, you expressly consent to the immediate delivery of the digital content and acknowledge that you lose your right of withdrawal once access begins. This is confirmed during checkout.',
    },

    /* ── 07. Refund Processing ── */
    { kind: 'h2', text: 'Refund Processing' },
    {
      kind: 'p',
      text: 'Approved refunds will be processed using the original payment method. Processing times may vary depending on your payment provider or bank. VIBEZCORE is not responsible for delays caused by third-party payment processors.',
    },

    /* ── 08. Non-Refundable Items ── */
    { kind: 'h2', text: 'Non-Refundable Items' },
    {
      kind: 'p',
      text: 'The following are generally not eligible for refunds:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        'Digital content once accessed',
        'Downloadable products once downloaded',
        'Membership services once activated',
        'Products returned in used or damaged condition (unless defective upon receipt)',
      ],
    },

    /* ── 09. Order Cancellations ── */
    { kind: 'h2', text: 'Order Cancellations' },
    {
      kind: 'p',
      text: 'Orders for physical products may be canceled before the order has been processed or shipped. If an order has already been shipped, the standard return procedure applies.',
    },
    {
      kind: 'p',
      text: 'Digital purchases cannot be canceled once access has been granted.',
    },

    /* ── 10. Contact ── */
    { kind: 'h2', text: 'Contact' },
    {
      kind: 'p',
      text: 'If you have any questions regarding this policy, your order, or the VIBEZCORE platform, please submit a request through our Support Center. Our team will review your request and respond as soon as possible.',
    },
  ],
};

/* ── 4. Cookie Policy ───────────────────────────────────────────────
   Created 2026-05-30 — eerste versie van Cookie Policy voor VIBEZCORE
   (was nog niet op de website beschikbaar, we maken 'm samen met de
   website-HTML). 8 secties + short-version highlight bovenaan.
   Sectie-nummering is auto via de renderer. */
export const COOKIES: LegalDoc = {
  slug: 'cookies',
  eyebrow: 'VIBEZCORE',
  title: 'Cookie Policy',
  subtitle:
    'How VIBEZCORE uses cookies and similar storage technologies — and what choices you have.',
  lastUpdated: 'March 2026',
  short: 'Cookies',
  blocks: [
    /* Intro vóór sectie 01. */
    {
      kind: 'p',
      text: 'This Cookie Policy explains how **VIBEZCORE** uses cookies and similar storage technologies across both the website and the mobile app. It applies to all VIBEZCORE products — Audio Library and Smart Bead Bracelet — and complements our Privacy Policy.',
    },
    {
      kind: 'highlight',
      title: 'Short version',
      text: 'We use only essential, functional storage. We do **not** use advertising cookies, cross-site trackers, or third-party analytics that profile you. No consent banner is required because we set no non-essential trackers.',
    },

    /* ── 01. What Cookies & Similar Technologies Are ── */
    { kind: 'h2', text: 'What Cookies & Similar Technologies Are' },
    {
      kind: 'p',
      text: '"Cookies" are small text files stored on your device by a website. "Local storage" and "session storage" are similar features that allow apps to save data locally on your device without sending it to a server.',
    },
    {
      kind: 'p',
      text: 'VIBEZCORE relies primarily on **local storage** for most functionality across both products. Bracelet session history is stored entirely on your device.',
    },

    /* ── 02. What We Store ── */
    { kind: 'h2', text: 'What We Actually Store' },
    { kind: 'h3', text: 'Essential — required for the service to work' },
    {
      kind: 'ul',
      style: 'check',
      items: [
        '**Session token** — keeps you logged in',
        '**Listening progress** — remembers where you stopped in each session',
        '**Play history** — your Your Journey stats and streak',
        '**Session status** — fully-listened vs. partly-listened flags',
        '**Favourites and follows** — series you have saved or are following',
      ],
    },
    {
      kind: 'p',
      text: 'All of the above are stored locally on your device. They are not transmitted to our servers unless cross-device sync is enabled.',
    },
    { kind: 'h3', text: 'Third-party — only at payment' },
    {
      kind: 'p',
      text: "**Apple App Store** and **Google Play** handle all in-app subscription payments. Receipt verification and renewal are managed by their systems and follow their privacy policies — out of our control.",
    },
    {
      kind: 'highlight',
      text: 'We do **not** use Google Analytics, Facebook Pixel, advertising networks, or any other cross-site tracking technology.',
    },

    /* ── 03. Cookie Consent ── */
    { kind: 'h2', text: 'Cookie Consent' },
    {
      kind: 'p',
      text: 'Because we use only essential storage required to provide the service, **no cookie consent banner is required** under EU law (GDPR/ePrivacy). You will not see persistent cookie pop-ups on VIBEZCORE properties.',
    },
    {
      kind: 'p',
      text: 'If we ever introduce non-essential storage (we currently have no plans to), we will request your explicit consent first.',
    },

    /* ── 04. Managing Your Choices ── */
    { kind: 'h2', text: 'Managing Your Choices' },
    {
      kind: 'p',
      text: 'You can control all storage through your device or browser settings:',
    },
    {
      kind: 'ul',
      style: 'check',
      items: [
        '**Web browser** — clear cookies and local storage from your browser settings (usually under "Privacy" or "Site data")',
        '**Mobile app** — clear all VIBEZCORE local data via the in-app **Settings → Clear all local data** option',
        '**Reinstall** — uninstalling and reinstalling the app removes all local data',
      ],
    },
    {
      kind: 'p',
      text: 'Please note: disabling essential storage will prevent core functionality such as login, listening progress, and subscription access.',
    },

    /* ── 05. Local Storage & the Mobile App ── */
    { kind: 'h2', text: 'Local Storage & the Mobile App' },
    {
      kind: 'p',
      text: 'The VIBEZCORE mobile app uses **device-local storage** (AsyncStorage on iOS/Android) — not cookies. This data lives only on your device and is not transmitted to our servers unless required for the service to function (e.g. authentication tokens to verify your subscription).',
    },
    {
      kind: 'p',
      text: 'Smart Bead Bracelet session history is stored **entirely locally** and never leaves your device.',
    },

    /* ── 06. Do Not Track ── */
    { kind: 'h2', text: 'Do Not Track Signals' },
    {
      kind: 'p',
      text: 'There is no agreed industry standard for "Do Not Track" signals, and VIBEZCORE does not currently respond to them. However, because we do not use tracking technology in the first place, this has no practical impact on your privacy.',
    },

    /* ── 07. Changes to This Policy ── */
    { kind: 'h2', text: 'Changes to This Policy' },
    {
      kind: 'p',
      text: 'We may update this Cookie Policy periodically — for instance, if we introduce a new tool or change how we store data. Any updates will be posted on this page with a revised "Last updated" date.',
    },
    {
      kind: 'p',
      text: 'Material changes will also be communicated by email or in-app notification.',
    },

    /* ── 08. Contact ── */
    { kind: 'h2', text: 'Contact' },
    {
      kind: 'p',
      text: 'Questions about this policy or about how we handle data? Our support team is here to help.',
    },
  ],
};

/* ── 5. Consumer Health Notice ──────────────────────────────────────
   Synced 2026-05-30 met vibezcore.com/consumer-health-notice + behoud
   van de uitgebreide app-only content (crisis block, bracelet 5.1-5.7
   safety details, professional help resources). Title bijgewerkt naar
   "Consumer Health Notice" om matching te zijn met website. */
export const HEALTH: LegalDoc = {
  slug: 'health',
  eyebrow: 'VIBEZCORE',
  title: 'Consumer Health Notice',
  subtitle:
    'VIBEZCORE is a personal development platform — not a medical service. Please read this notice carefully before using our products or services.',
  lastUpdated: 'March 2026',
  short: 'Health',
  blocks: [
    /* Crisis-block (app-only, niet op website maar te waardevol om te
       verwijderen). Bovenaan voor maximale zichtbaarheid. */
    {
      kind: 'danger',
      title: 'In Crisis Right Now?',
      text: 'If you are experiencing a mental health emergency or thoughts of self-harm, please reach out to a trained professional in your country immediately.\n\n**[findahelpline.com](https://findahelpline.com)** lists free, confidential crisis support lines worldwide. If you are in immediate danger, contact your local emergency services.',
    },

    /* ── 01. Purpose of Our Platform (van website) ──
       Positief framing — wat het platform WEL is. */
    { kind: 'h2', text: 'Purpose of Our Platform' },
    {
      kind: 'p',
      text: 'VIBEZCORE is designed exclusively for personal development, self-improvement, and educational purposes. Our audio sessions, content, and tools are created to help individuals gain insights and apply them in daily life — in the areas of mindset, resilience, social mastery, and personal growth.',
    },
    {
      kind: 'tags',
      items: [
        'Mindset',
        'Resilience',
        'Social mastery',
        'Personal growth',
        'Self-awareness',
        'Intentional living',
      ],
    },
    {
      kind: 'p',
      text: 'VIBEZCORE content and tools are not a substitute for professional care of any kind.',
    },

    { kind: 'h2', text: '1. Important Disclaimer' },
    {
      kind: 'p',
      text: '**VIBEZCORE is a personal development tool, not medical care.** Both the audio sessions and the Smart Bead Bracelet are designed to support self-reflection, focus, and resilience — they are **not** therapy, counselling, diagnosis, or treatment for any mental or physical health condition. The bracelet delivers haptic stimulation through the wrist; it is not a medical device.',
    },
    {
      kind: 'p',
      text: 'If you are experiencing significant emotional distress, mental illness, trauma, or any medical condition, please consult a licensed professional. Our service is intended to complement, not replace, professional care.',
    },
    { kind: 'h2', text: '2. Safe Use' },
    {
      kind: 'p',
      text: 'VIBEZCORE audio sessions are designed for everyday life — at home, at work, during walks, on the commute, while driving or cycling. The point is to fit personal development into your real routine, not to remove you from it.',
    },
    {
      kind: 'p',
      text: 'For your safety, please use common sense:',
    },
    {
      kind: 'ul',
      items: [
        '**Stay aware of your surroundings.** Keep volume at a level where you can still hear traffic, alarms, and people around you',
        '**Choose the right session for the moment.** Energizing, focus, and resilience sessions work well in active settings. **Deep relaxation, sleep, and guided meditation sessions should only be used when stationary and safe** — never while driving, cycling, or operating machinery',
        '**Use headphones responsibly** — protect your hearing with moderate volume; consider one earbud when situational awareness matters (cycling, walking near traffic)',
        '**Follow local laws.** Some regions restrict headphone use while driving or cycling — respect them',
        '**Pause when you need full attention.** Heavy traffic, busy intersections, complex tasks — stop the session and resume later',
        'Stop immediately if you feel dizzy, nauseous, or distressed',
      ],
    },
    { kind: 'h2', text: '3. Possible Reactions' },
    {
      kind: 'p',
      text: 'Some sessions involve self-reflection on emotions, identity, past experiences, or fears. This can occasionally bring up strong feelings — that is a normal part of inner work, but it can be challenging.',
    },
    { kind: 'p', text: 'If a session feels overwhelming:' },
    {
      kind: 'ul',
      items: [
        'Pause or stop the session',
        'Take a few slow breaths and ground yourself in your surroundings',
        'Talk to someone you trust',
        'If feelings persist or intensify, reach out to a mental health professional',
      ],
    },
    { kind: 'h2', text: '4. Audio Sessions — Not Suitable If…' },
    {
      kind: 'p',
      text: 'Please use caution or consult a professional before using the VIBEZCORE audio library if you:',
    },
    {
      kind: 'ul',
      items: [
        'Are currently being treated for a serious mental health condition',
        'Have a history of psychosis, severe trauma, or dissociation',
        'Are in active crisis or recently bereaved',
        'Have a medical condition that may be affected by deep relaxation or focused attention',
      ],
    },
    {
      kind: 'p',
      text: 'When in doubt, talk to your doctor or therapist first.',
    },
    /* Researcher-references disclaimer (van website sectie 02). Hoort
       inhoudelijk bij audio sessions — voor we naar bracelet gaan. */
    {
      kind: 'highlight',
      text: 'Any reference to researchers, thought leaders, or public figures within our sessions is for informational purposes only. These individuals are not affiliated with, endorsed by, or partnered with VIBEZCORE in any way.',
    },
    { kind: 'h2', text: '5. Smart Bead Bracelet — Safety Notice' },
    {
      kind: 'p',
      text: 'The VIBEZCORE Smart Bead Bracelet delivers gentle haptic stimulation (subtle vibration) to the wrist. It is a personal wellness accessory, **not a medical device** and not intended to diagnose, treat, cure, or prevent any condition. Please read the safety notices below before first use.',
    },
    { kind: 'h3', text: '5.1 Consult Your Doctor Before Use If You…' },
    {
      kind: 'p',
      text: 'The bracelet uses small vibration motors against the skin. While the energy levels are low, please consult a licensed physician before wearing it if any of the following applies to you:',
    },
    {
      kind: 'ul',
      items: [
        '**Heart conditions** — including arrhythmia, recent cardiac event, or any diagnosed cardiovascular disease',
        '**Implanted medical devices** — including pacemakers, implantable cardioverter-defibrillators (ICDs), neurostimulators, insulin pumps, or any active electronic implant',
        '**Pregnancy** — especially during the first trimester; introduce no new stimulation without your obstetrician\'s approval',
        '**Epilepsy or seizure disorders** — rhythmic stimulation can in rare cases interact with neurological conditions',
        '**Neurological conditions** — including Parkinson\'s disease, essential tremor, multiple sclerosis, or peripheral neuropathy',
        '**Recent injury or surgery** on the wrist, hand, or arm where the bracelet would be worn',
        '**Skin conditions** — including active eczema, psoriasis, open wounds, or known contact allergies (silicone, nickel, common metals, or specific stone materials)',
        '**Vestibular or balance disorders** — including vertigo or Ménière\'s disease',
        '**Migraine sufferers** — if vibration or rhythmic patterns trigger your migraines',
        'You are taking medication that affects circulation, blood pressure, or the nervous system',
      ],
    },
    {
      kind: 'p',
      text: 'If you are unsure whether the bracelet is right for you, **do not use it before discussing with a qualified healthcare professional**.',
    },
    { kind: 'h3', text: '5.2 Stop Using and Seek Medical Advice If…' },
    {
      kind: 'p',
      text: 'Remove the bracelet immediately and consult a doctor if you experience any of the following during or after use:',
    },
    {
      kind: 'ul',
      items: [
        'Chest pain, palpitations, dizziness, or shortness of breath',
        'Skin irritation, rash, redness, swelling, or burning sensation at the contact area',
        'Headache, nausea, lightheadedness, or visual disturbances',
        'Numbness, tingling, or weakness in the hand or arm',
        'Any unusual or persistent discomfort that does not stop after removing the bracelet',
      ],
    },
    {
      kind: 'danger',
      title: '5.3 Children & Choking Hazard',
      text: 'The Smart Bead Bracelet contains **small beads** that present a serious **choking hazard** for children under 3 years of age. **Keep the bracelet out of reach of infants and young children at all times.** The product is designed and tested for adults only and is not a toy. Do not allow children to handle, wear, or play with the bracelet, charging cable, or any component. If a bead becomes detached or the bracelet is damaged, stop using it and contact support — **never** allow loose beads or small parts near children. If a child swallows a bead, contact poison control or emergency services immediately.',
    },
    { kind: 'h3', text: '5.4 Skin & Allergies' },
    {
      kind: 'p',
      text: 'The bracelet is in continuous contact with your skin. Even hypoallergenic materials can cause reactions in sensitive individuals.',
    },
    {
      kind: 'ul',
      items: [
        'If you have known allergies to silicone, nickel, latex, or any metals or stones used in the product, **review the material specifications before purchase** or contact support',
        'Remove the bracelet immediately at the first sign of redness, itching, or irritation',
        'Keep the bracelet clean and dry — wipe the contact surface regularly with a soft cloth',
        'Do not wear the bracelet too tight — it should rest comfortably without pressure marks',
        'Give your skin daily rest periods — do not wear continuously for more than 12 hours at a time',
      ],
    },
    { kind: 'h3', text: '5.5 Battery & Charging Safety' },
    {
      kind: 'p',
      text: 'The bracelet contains a small rechargeable lithium-ion battery. Lithium batteries can pose a risk if damaged, overheated, or charged improperly.',
    },
    {
      kind: 'ul',
      items: [
        'Use **only the included pogo pin charger** — the magnetic contact pads on the bracelet are designed exclusively for this charger',
        'Do **not** charge while wearing the bracelet',
        'Do **not** expose the battery or device to high temperatures, fire, or direct sunlight for extended periods',
        'Do **not** disassemble, puncture, crush, or attempt to repair the bracelet',
        'If the bracelet feels unusually hot, swells, leaks, or emits an odour, **stop using it immediately** and contact support',
        'Store and charge the bracelet on a hard, non-flammable surface away from textiles, paper, and combustibles',
        'Dispose of the bracelet through proper electronic waste recycling — never in regular household trash or fire',
      ],
    },
    { kind: 'h3', text: '5.6 Water, Environment & General Care' },
    {
      kind: 'ul',
      items: [
        'The bracelet is **splash-resistant**, not waterproof — do not submerge, swim, shower, or bathe with it on',
        'Remove before sauna, steam rooms, or high-humidity environments',
        'Avoid contact with chemicals, perfumes, lotions, or cosmetics on the wrist area',
        'Keep away from strong magnetic fields',
        'Operating temperature: avoid use below 0 °C or above 40 °C',
      ],
    },
    { kind: 'h3', text: '5.7 Use as Intended' },
    {
      kind: 'p',
      text: 'Use the bracelet only as described in the app and product documentation. **Do not use the bracelet to treat or manage any medical, psychological, or sleep condition without professional guidance.** Stop a session at any time if it feels uncomfortable.',
    },
    { kind: 'h2', text: '6. Children & Teenagers' },
    {
      kind: 'p',
      text: 'Both VIBEZCORE products are designed and intended for **adults aged 18 and over**. Some audio content discusses topics such as identity, betrayal, discipline, and resilience that may not be appropriate for younger audiences. The bracelet is not designed or sized for children\'s wrists and contains small parts that pose a choking hazard (see section 5.3). Parents and guardians are responsible for deciding what is suitable for minors in their care.',
    },
    { kind: 'h2', text: '7. Professional Help' },
    {
      kind: 'p',
      text: 'Neither audio sessions nor the bracelet replace therapy. If you would benefit from speaking to someone, please consider:',
    },
    {
      kind: 'ul',
      items: [
        'Your general practitioner or family doctor',
        'A licensed psychologist, psychotherapist, or counsellor',
        'Your local mental health services',
        'A confidential helpline — see [findahelpline.com](https://findahelpline.com) for options in your country',
      ],
    },
    /* Personal Responsibility — toegevoegd van website 2026-05-30.
       Sterkere liability-disclaimer dan onze bestaande "Results Vary".
       Hoort vóór Results Vary zodat ze samen flowen. */
    { kind: 'h2', text: '8. Personal Responsibility' },
    {
      kind: 'p',
      text: 'By accessing VIBEZCORE content or using our products, you acknowledge that you do so at your own discretion and risk. VIBEZCORE accepts no liability for any physical, psychological, or financial outcomes resulting from the use or misuse of our platform, content, or products.',
    },
    {
      kind: 'p',
      text: 'Results vary per individual and are not guaranteed.',
    },
    { kind: 'h2', text: '9. Results Vary' },
    {
      kind: 'p',
      text: 'Personal development is highly individual. The benefits of the service depend on consistent practice, your circumstances, and many factors outside our control. We make no promises about specific outcomes.',
    },
    { kind: 'h2', text: '10. Reporting Concerns' },
    {
      kind: 'p',
      text: 'If a session feels harmful, misleading, or inappropriate, please let us know through the support form. Your feedback helps us keep the library safe and high-quality.',
    },
  ],
};

/* ── 6. Audio Sessions ──────────────────────────────────────────────
   Synced 1-op-1 met vibezcore.com/audio-sessions (2026-05-30).
   6 secties + warning-notice bovenaan + legal-note onderaan. Legale
   disclaimers over de audio content: no affiliation, IP, etc. */
export const AUDIO_SESSIONS: LegalDoc = {
  slug: 'audio-sessions',
  eyebrow: 'VIBEZCORE',
  title: 'Audio Sessions',
  subtitle:
    'Our sessions are designed to deliver real insights for real-life challenges — built to be applied, not just heard. Please read the following carefully before you begin.',
  lastUpdated: 'March 2026',
  short: 'Audio',
  blocks: [
    /* Top notice — yellow warning op de website, hier als highlight
       (kort, prominent, settle de disclaimer-toon van de pagina). */
    {
      kind: 'highlight',
      text: 'All third-party names, research, and public figures referenced in our sessions are independent of VIBEZCORE. No affiliation, endorsement, or partnership of any kind exists or is implied.',
    },

    /* ── 01. No Affiliation ── */
    {
      kind: 'h2',
      text: 'No Affiliation with Referenced Individuals or Research',
    },
    {
      kind: 'p',
      text: 'Our audio sessions may reference publicly available research, scientific findings, or the work of thought leaders, researchers, academics, and public figures in the fields of neuroscience, psychology, philosophy, and personal development.',
    },
    {
      kind: 'p',
      text: '**None of the individuals, researchers, institutions, or organisations referenced in our sessions are affiliated with, employed by, partnered with, or endorsing VIBEZCORE in any capacity.** Any such reference is made solely for educational and illustrative purposes, based exclusively on information that is publicly available in the open domain.',
    },
    {
      kind: 'p',
      text: 'VIBEZCORE does not claim any association, collaboration, or approval from any referenced party. All referenced names, works, and findings remain the intellectual property of their respective owners.',
    },

    /* ── 02. Independently Developed Content ── */
    { kind: 'h2', text: 'Independently Developed Content' },
    {
      kind: 'p',
      text: 'All VIBEZCORE audio sessions are independently developed by the VIBEZCORE team. Our content is inspired by widely available knowledge, established research, and real-life human experience — not derived from, licensed from, or produced in collaboration with any third party.',
    },
    {
      kind: 'p',
      text: 'Every session is carefully composed around genuine challenges people face in daily life. We invest significant time and rigour into ensuring each session delivers relevant, grounded, and actionable insights — not theoretical concepts.',
    },

    /* ── 03. Purpose — Insight Into Action ── */
    { kind: 'h2', text: 'Purpose — Insight Into Action' },
    {
      kind: 'p',
      text: 'VIBEZCORE audio sessions are created with one objective: to help you gain insights and apply them in real life. We operate on the belief that knowledge only has value when it creates tangible change.',
    },
    {
      kind: 'p',
      text: 'Our sessions are structured to bridge the gap between understanding and doing — from awareness to implementation, from pattern recognition to deliberate action.',
    },

    /* ── 04. Not a Substitute for Professional Help ── */
    {
      kind: 'h2',
      text: 'Not a Substitute for Professional Help',
    },
    {
      kind: 'p',
      text: 'VIBEZCORE audio sessions are provided for **educational and personal development purposes only**. They do not constitute and must not be interpreted as professional medical, psychological, psychiatric, or therapeutic advice, diagnosis, or treatment of any kind.',
    },
    {
      kind: 'p',
      text: 'If you are experiencing serious mental health challenges, psychological distress, or any condition requiring clinical support, please consult a qualified and licensed professional. VIBEZCORE is not a clinical service and makes no representation that its content is suitable as a substitute for professional care.',
    },

    /* ── 05. Personal Responsibility ── */
    { kind: 'h2', text: 'Personal Responsibility' },
    {
      kind: 'p',
      text: 'By accessing VIBEZCORE audio sessions, you acknowledge and agree that you are solely responsible for how you use, interpret, and apply the content provided. Individual results vary and are dependent on personal circumstances, effort, and application.',
    },
    {
      kind: 'p',
      text: '**VIBEZCORE does not guarantee specific outcomes** and expressly disclaims any liability for decisions made, actions taken, or results experienced based on the content of our sessions. Use of our sessions constitutes your acceptance of full personal responsibility for your engagement with the material.',
    },

    /* ── 06. Intellectual Property ── */
    { kind: 'h2', text: 'Intellectual Property' },
    {
      kind: 'p',
      text: 'All audio sessions — including their structure, scripts, recordings, concepts, and presentation — are the exclusive intellectual property of VIBEZCORE and are protected under applicable copyright law.',
    },
    {
      kind: 'p',
      text: '**Reproduction, redistribution, resale, public performance, sharing, or any other unauthorised use of any session — in whole or in part, in any format or medium — is strictly prohibited** without the prior explicit written consent of VIBEZCORE. Violations may result in civil and/or criminal liability under applicable law.',
    },
    {
      kind: 'p',
      text: 'For licensing inquiries, contact [info@vibezcore.com](mailto:info@vibezcore.com).',
    },

    /* Legal note onderaan — kleine grijze disclaimer (nominative fair
       use). Rendered als highlight om visueel te scheiden van content. */
    {
      kind: 'highlight',
      title: 'Legal notice',
      text: 'The use of any third-party name, trademark, or intellectual property in our sessions is solely for descriptive and educational reference under the principles of nominative fair use. VIBEZCORE asserts no ownership over, and claims no association with, any third-party name or brand. All trademarks and intellectual property rights belong to their respective owners. This notice does not constitute legal advice.',
    },
  ],
};

/* ── Lookup map + ordered list voor navigatie ───────────────────────── */
export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  accessibility: ACCESSIBILITY,
  shipping: SHIPPING,
  refund: REFUND,
  cookies: COOKIES,
  health: HEALTH,
  'audio-sessions': AUDIO_SESSIONS,
};

/* Volgorde matched de footer-volgorde op vibezcore.com: Terms,
   Privacy, Accessibility, Shipping, Refund, Cookies, Health,
   Audio Sessions. (Cookies is technisch verwerkt in Privacy op de
   site, maar we houden 'm in de app voor wie 'm direct zoekt. Audio
   Sessions staat op de website onder PLATFORM-footer, in de app
   integreren we 'm bij de Legal & Safety lijst omdat de inhoud
   legal-disclaimer is.) */
export const LEGAL_ORDER: LegalSlug[] = [
  'terms',
  'privacy',
  'accessibility',
  'shipping',
  'refund',
  'cookies',
  'health',
  'audio-sessions',
];
