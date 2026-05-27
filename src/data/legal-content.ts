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

export type LegalSlug = 'terms' | 'privacy' | 'refund' | 'cookies' | 'health';

export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'highlight'; title?: string; text: string }
  | { kind: 'danger'; title?: string; text: string };

export type LegalDoc = {
  slug: LegalSlug;
  eyebrow: string;
  title: string;
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

/* ── 1. Terms of Service ────────────────────────────────────────────── */
export const TERMS: LegalDoc = {
  slug: 'terms',
  eyebrow: 'LEGAL',
  title: 'Terms of Service',
  lastUpdated: 'May 2026',
  short: 'Terms',
  blocks: [
    {
      kind: 'p',
      text: 'Welcome to **VIBEZCORE Audio Library**. By accessing or using our service, you agree to these Terms of Service. Please read them carefully — if you do not agree, do not use the service.',
    },
    { kind: 'h2', text: '1. The Service' },
    {
      kind: 'p',
      text: 'VIBEZCORE Audio Library is a digital subscription service operated by VIBEZCORE. We provide on-demand streaming access to original audio sessions designed for personal development, focusing on four pillars: Strategic Wealth, Psychological Resilience, Social Mastery, and Stoic Fortitude.',
    },
    {
      kind: 'p',
      text: 'All content is original, independently produced, and protected by copyright. References to public figures, researchers, or thought leaders are made for educational and contextual purposes only and do not imply any affiliation, endorsement, or sponsorship.',
    },
    { kind: 'h2', text: '2. Eligibility & Accounts' },
    {
      kind: 'p',
      text: 'Free sessions are available to all visitors. **Paid subscriptions require you to be at least 18 years old** or the age of majority in your jurisdiction.',
    },
    {
      kind: 'p',
      text: 'When you create an account, you agree to provide accurate information and to keep your credentials confidential. You are responsible for all activity under your account. VIBEZCORE may suspend or terminate accounts that violate these Terms, share login credentials, or attempt to bypass payment.',
    },
    { kind: 'h2', text: '3. Subscriptions & Payments' },
    {
      kind: 'p',
      text: 'Subscriptions are billed at the rates shown at checkout — typically **$8.99 per month** or **$79.99 per year** — through our payment processor, **Gumroad**, who acts as the merchant of record. Gumroad handles all transactions, taxes (VAT/sales tax), and receipts on our behalf.',
    },
    {
      kind: 'p',
      text: 'Subscriptions **renew automatically** at the end of each billing period unless cancelled before renewal. You may cancel at any time through your Gumroad account dashboard or by contacting support.',
    },
    {
      kind: 'p',
      text: 'Pricing may change with reasonable advance notice. Existing subscribers will be notified by email before any price increase takes effect.',
    },
    { kind: 'h2', text: '4. Refunds & Right of Withdrawal' },
    {
      kind: 'p',
      text: 'If you are a consumer in the European Union, European Economic Area, or United Kingdom, you have a statutory **14-day right of withdrawal** from the moment of purchase. This right may be lost if you give explicit consent to immediate access of digital content and acknowledge the loss of this right at checkout, as permitted by EU Directive 2011/83/EU.',
    },
    {
      kind: 'p',
      text: 'Outside the withdrawal window, refunds are limited to specific situations (duplicate charges, billing errors, persistent technical failures, etc.). Cancelling your subscription stops future renewals but does not pro-rate the current billing period.',
    },
    {
      kind: 'p',
      text: 'Full details are in our Refund & Withdrawal Policy. Non-waivable consumer rights in your country of residence always prevail over this section.',
    },
    { kind: 'h2', text: '5. Acceptable Use' },
    { kind: 'p', text: 'You agree **not to**:' },
    {
      kind: 'ul',
      items: [
        'Download, copy, redistribute, resell, or publicly broadcast any audio content',
        'Share your account credentials with others',
        'Use scraping, bots, or automation to access the service',
        'Reverse engineer, decompile, or attempt to extract source media files',
        'Use the service for any unlawful purpose or to infringe on third-party rights',
      ],
    },
    {
      kind: 'p',
      text: 'Violation may result in immediate account termination without refund.',
    },
    { kind: 'h2', text: '6. Intellectual Property' },
    {
      kind: 'p',
      text: 'All audio content, written material, code, design, and the VIBEZCORE name and logo are the exclusive property of VIBEZCORE and protected by copyright, trademark, and other intellectual property laws.',
    },
    {
      kind: 'p',
      text: 'Your subscription grants you a **limited, personal, non-transferable, non-exclusive licence** to stream audio content for private, non-commercial use only. No ownership rights are transferred.',
    },
    { kind: 'h2', text: '7. Health & Wellness Disclaimer' },
    {
      kind: 'p',
      text: 'VIBEZCORE Audio Library is intended for personal development and educational purposes only. **It is not medical advice, therapy, or a substitute for professional mental health care.**',
    },
    {
      kind: 'p',
      text: 'If you experience anxiety, depression, trauma, or any mental health condition, please consult a licensed professional. Do not use VIBEZCORE while driving, operating machinery, or performing tasks that require full attention.',
    },
    {
      kind: 'p',
      text: 'For full guidance on safe use, when to seek professional help, and crisis support, please read our Health & Safety page.',
    },
    { kind: 'h2', text: '8. Disclaimers' },
    {
      kind: 'p',
      text: 'The service is provided **"as is" and "as available"**, without warranties of any kind. We do not guarantee that the service will be uninterrupted, error-free, or meet your specific expectations.',
    },
    {
      kind: 'p',
      text: 'Personal development outcomes vary from person to person. We make no promises about specific results.',
    },
    { kind: 'h2', text: '9. Limitation of Liability' },
    {
      kind: 'p',
      text: 'To the maximum extent permitted by law, VIBEZCORE shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the service. Our total liability for any claim shall not exceed the amount you paid in the 12 months preceding the claim.',
    },
    { kind: 'h2', text: '10. Termination' },
    {
      kind: 'p',
      text: 'We may suspend or terminate your access at any time for breach of these Terms. You may cancel your subscription at any time. Upon termination, your right to access the service ends.',
    },
    { kind: 'h2', text: '11. Changes to These Terms' },
    {
      kind: 'p',
      text: 'We may update these Terms from time to time. Material changes will be communicated by email or in-app notification. Continued use of the service after changes constitutes acceptance of the updated Terms.',
    },
    { kind: 'h2', text: '12. Governing Law & Disputes' },
    {
      kind: 'p',
      text: 'These Terms are governed by **Belgian law**, without prejudice to any mandatory consumer protection laws of your country of residence.',
    },
    {
      kind: 'p',
      text: 'Before any formal proceedings, please contact us through the support form — most issues can be resolved directly.',
    },
    {
      kind: 'p',
      text: "EU consumers may also use the European Commission's **Online Dispute Resolution platform** at [ec.europa.eu/consumers/odr](https://ec.europa.eu/consumers/odr), and may bring proceedings before the courts of their country of residence under EU Regulation 1215/2012.",
    },
    {
      kind: 'p',
      text: 'Nothing in these Terms limits any non-waivable consumer rights you may have under the laws of your country of residence.',
    },
    { kind: 'h2', text: '13. Contact' },
    {
      kind: 'p',
      text: 'For questions about these Terms, please use our support form below.',
    },
  ],
};

/* ── 2. Privacy Policy ──────────────────────────────────────────────── */
export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  eyebrow: 'LEGAL',
  title: 'Privacy Policy',
  lastUpdated: 'May 2026',
  short: 'Privacy',
  blocks: [
    {
      kind: 'p',
      text: 'This Privacy Policy explains how **VIBEZCORE Audio Library** collects, uses, and protects your personal data when you use our service. We aim to be transparent and to respect your privacy regardless of where you live.',
    },
    { kind: 'h2', text: '1. Who We Are' },
    {
      kind: 'p',
      text: 'VIBEZCORE operates the VIBEZCORE Audio Library service and is the **data controller** for personal data processed in connection with your use of the service.',
    },
    {
      kind: 'p',
      text: 'For privacy questions or to exercise your rights, please use our support form.',
    },
    { kind: 'h2', text: '2. What We Collect' },
    {
      kind: 'p',
      text: '**Account data:** email address, hashed password, account creation date, and login activity.',
    },
    {
      kind: 'p',
      text: '**Subscription data:** subscription status, plan, renewal date, and transaction IDs provided by our payment processor. We do **not** store your card details — these are handled by the payment processor.',
    },
    {
      kind: 'p',
      text: '**Usage data stored locally on your device:** sessions played, listening progress, favourites. This data is stored on your device and never leaves it unless cross-device sync is enabled.',
    },
    {
      kind: 'p',
      text: '**Technical data:** IP address (briefly, for security and rate-limiting), device type, and app version. We do not currently run third-party analytics, advertising trackers, or fingerprinting.',
    },
    {
      kind: 'p',
      text: '**Support data:** any information you provide when contacting us.',
    },
    { kind: 'h2', text: '3. How We Use Your Data' },
    {
      kind: 'ul',
      items: [
        'To provide and operate the service (login, streaming, progress tracking)',
        'To process payments through our payment provider',
        'To improve the service and develop new features',
        'To communicate important updates, changes, and support replies',
        'To prevent fraud, abuse, and unauthorised account sharing',
        'To comply with legal obligations',
      ],
    },
    {
      kind: 'p',
      text: 'We do **not** sell your personal data to anyone, ever.',
    },
    { kind: 'h2', text: '4. Legal Basis for Processing (GDPR)' },
    {
      kind: 'p',
      text: 'If you are in the European Union, we rely on the following legal bases under the General Data Protection Regulation:',
    },
    {
      kind: 'ul',
      items: [
        '**Performance of a contract** (Art. 6(1)(b)) — to deliver the service you signed up for',
        '**Legitimate interests** (Art. 6(1)(f)) — to secure, improve, and protect the service',
        '**Consent** (Art. 6(1)(a)) — for optional analytics or marketing communications, where applicable',
        '**Legal obligation** (Art. 6(1)(c)) — for tax, accounting, and regulatory requirements',
      ],
    },
    { kind: 'h2', text: '5. Who We Share Data With' },
    {
      kind: 'p',
      text: 'We share data only with the service providers required to operate the service. Each is bound by confidentiality and data protection obligations:',
    },
    {
      kind: 'ul',
      items: [
        '**Gumroad** — payment processing, merchant of record, tax compliance',
        '**Supabase** — authentication, database, and account management',
        '**Bunny CDN** — delivery of audio sessions and static assets',
        '**Netlify** — backend hosting and deployment',
      ],
    },
    {
      kind: 'p',
      text: 'We do not share your data with advertising networks or data brokers.',
    },
    { kind: 'h2', text: '6. International Data Transfers' },
    {
      kind: 'p',
      text: "Some of our service providers process data outside the European Economic Area, including in the United States. Where required, we rely on appropriate safeguards (such as the European Commission's **Standard Contractual Clauses**) and additional measures to ensure your data is protected at a level equivalent to EU law.",
    },
    { kind: 'h2', text: '7. How Long We Keep Your Data' },
    {
      kind: 'ul',
      items: [
        '**Account data:** for as long as your account is active, plus a reasonable retention period after closure',
        '**Transaction data:** retained as required by tax and accounting law (typically up to 7 years in the EU)',
        '**Usage data on our servers:** kept in aggregated or anonymous form for product analytics',
        '**Local-device data:** remains on your device until you clear it via Settings or app reset',
        '**Support correspondence:** kept while reasonably needed for record-keeping',
      ],
    },
    { kind: 'h2', text: '8. Your Rights' },
    {
      kind: 'p',
      text: 'Depending on where you live, you have the right to:',
    },
    {
      kind: 'ul',
      items: [
        '**Access** the personal data we hold about you',
        '**Rectify** inaccurate or incomplete data',
        '**Erase** your account and associated data ("right to be forgotten")',
        '**Restrict** or **object to** certain processing',
        '**Portability** — receive a copy of your data in a structured, commonly used format',
        '**Withdraw consent** at any time, where consent is the legal basis',
      ],
    },
    {
      kind: 'p',
      text: 'To exercise any of these rights, use the support form. We aim to respond within **30 days**, in line with GDPR Article 12.',
    },
    { kind: 'h2', text: '9. Right to Lodge a Complaint' },
    {
      kind: 'p',
      text: 'If you believe we have not handled your personal data correctly, you have the right to lodge a complaint with the data protection authority in the EU country where you live, work, or where the alleged infringement took place.',
    },
    {
      kind: 'p',
      text: 'For users in Belgium, this is the **Gegevensbeschermingsautoriteit / Autorité de protection des données** ([www.gegevensbeschermingsautoriteit.be](https://www.gegevensbeschermingsautoriteit.be)).',
    },
    {
      kind: 'p',
      text: 'We would, however, appreciate the chance to address your concerns first — please contact support before involving a supervisory authority.',
    },
    { kind: 'h2', text: '10. Security' },
    {
      kind: 'p',
      text: 'We use industry-standard technical and organisational measures to protect your data: encryption in transit (HTTPS), hashed passwords, restricted access to systems, and regular security reviews. No system is 100% secure, but we work continuously to reduce risk.',
    },
    { kind: 'h2', text: '11. Children' },
    {
      kind: 'p',
      text: 'Paid subscriptions are not directed at children. We do not knowingly collect personal data from minors below the age of digital consent in their country (16 in many EU member states, 13 elsewhere). If you believe a minor has provided us with data, please contact support and we will delete it.',
    },
    { kind: 'h2', text: '12. Cookies & Local Storage' },
    {
      kind: 'p',
      text: 'VIBEZCORE Audio Library does **not use advertising or third-party tracking cookies**. We use only essential storage required to run the service (your login session and locally-saved listening progress). See our Cookie Policy for full details.',
    },
    { kind: 'h2', text: '13. Automated Decision-Making' },
    {
      kind: 'p',
      text: 'We do not use your personal data for automated decision-making or profiling that produces legal or similarly significant effects on you.',
    },
    { kind: 'h2', text: '14. Changes to This Policy' },
    {
      kind: 'p',
      text: 'We may update this Privacy Policy as the service evolves. Material changes will be communicated by email or in-app notification. The "Last updated" date at the top reflects the most recent version.',
    },
  ],
};

/* ── 3. Refund Policy ───────────────────────────────────────────────── */
export const REFUND: LegalDoc = {
  slug: 'refund',
  eyebrow: 'LEGAL',
  title: 'Refund Policy',
  lastUpdated: 'May 2026',
  short: 'Refunds',
  blocks: [
    {
      kind: 'p',
      text: 'This Refund Policy explains your rights and our position on refunds for **VIBEZCORE Audio Library** subscriptions. It applies together with our Terms of Service.',
    },
    {
      kind: 'p',
      text: 'VIBEZCORE Audio Library is a digital content service. Refund rights are determined by the law of your country of residence and by the rules described below.',
    },
    { kind: 'h2', text: '1. EU Right of Withdrawal (14 Days)' },
    {
      kind: 'highlight',
      title: 'For EU consumers',
      text: 'If you live in the European Union, you have a statutory right to withdraw from this contract within **14 days** of purchase, without giving any reason.',
    },
    {
      kind: 'p',
      text: 'To exercise the right of withdrawal, contact us through the support form before the 14-day period expires. You must clearly state that you wish to withdraw from the contract and include the email address used at purchase and the transaction details.',
    },
    {
      kind: 'p',
      text: 'If you withdraw, we will refund all payments received from you without undue delay, and at the latest within 14 days of the day on which we are informed about your decision. The refund will be made using the same payment method as the original transaction, unless agreed otherwise.',
    },
    { kind: 'h2', text: '2. Loss of Withdrawal Right for Digital Content' },
    {
      kind: 'danger',
      title: 'Important — read before subscribing',
      text: 'Under EU Directive 2011/83/EU, the right of withdrawal for digital content supplied without a physical medium is **lost once performance has begun**, provided you have:\n\n(a) given your **express prior consent** for performance to begin during the 14-day withdrawal period, and (b) **acknowledged that you lose your right of withdrawal** once performance has begun.',
    },
    {
      kind: 'p',
      text: 'By starting playback of any paid (PRO) session during the 14-day period, you give that express consent and acknowledge the loss of your withdrawal right for the content you have accessed.',
    },
    {
      kind: 'p',
      text: 'If you have not yet played any paid session, your withdrawal right under section 1 still applies for the full 14 days.',
    },
    { kind: 'h2', text: '3. Free Content Before Subscribing' },
    {
      kind: 'p',
      text: 'VIBEZCORE provides **free sessions** that can be played without payment. You are strongly encouraged to listen to free content before subscribing, so that the decision to purchase is informed.',
    },
    { kind: 'h2', text: '4. Cancellation vs. Refund' },
    {
      kind: 'p',
      text: '**Cancellation** stops future renewals — you keep access until the end of the current paid period. Cancellation is not a refund.',
    },
    {
      kind: 'p',
      text: '**Refund** means money already paid is returned. Refunds are limited to the cases in sections 1 and 5.',
    },
    {
      kind: 'p',
      text: 'You can cancel at any time through your payment provider account or by contacting support.',
    },
    { kind: 'h2', text: '5. Other Cases We Will Refund' },
    {
      kind: 'p',
      text: 'In addition to the EU statutory right above, refunds will be granted in the following cases:',
    },
    {
      kind: 'ul',
      items: [
        '**Duplicate charge** — billed twice for the same period',
        '**Unauthorised charge** — fraudulent use of your payment method (also contact your bank)',
        '**Pricing error** — a clear pricing mistake on our side',
        '**Persistent technical failure** — the service was inaccessible for an extended period and not resolved despite a support request',
      ],
    },
    {
      kind: 'p',
      text: 'Contact support with proof (transaction ID, screenshots, dates) and we will respond as quickly as reasonably possible.',
    },
    { kind: 'h2', text: '6. Annual Subscriptions' },
    {
      kind: 'p',
      text: 'Annual subscriptions are billed in full at the start of the period. Outside of the EU 14-day withdrawal window described in section 1, cancelling an annual subscription mid-period stops auto-renewal but does **not** trigger a pro-rated refund. You retain access until the end of the 12-month period.',
    },
    { kind: 'h2', text: '7. Chargebacks' },
    {
      kind: 'p',
      text: 'Before initiating a chargeback with your bank or card provider, please **contact us first**. Most issues can be resolved quickly. Filing a chargeback without first contacting support may result in immediate account termination.',
    },
    { kind: 'h2', text: '8. Mandatory Consumer Rights' },
    {
      kind: 'p',
      text: 'This policy does not limit any non-waivable consumer rights you may have under the laws of your country of residence. Where local law mandates a refund right that cannot be excluded by contract, that right prevails.',
    },
    { kind: 'h2', text: '9. How to Request a Refund or Withdrawal' },
    { kind: 'p', text: 'Use the support form with:' },
    {
      kind: 'ul',
      items: [
        'The email address used at purchase',
        'The transaction ID from your purchase confirmation email',
        'The date of the charge',
        'A clear description of your request',
      ],
    },
    { kind: 'h2', text: '10. Dispute Resolution (EU consumers)' },
    {
      kind: 'p',
      text: "If we cannot resolve a refund or withdrawal dispute together, EU consumers may use the European Commission's **Online Dispute Resolution (ODR) platform** at [ec.europa.eu/consumers/odr](https://ec.europa.eu/consumers/odr).",
    },
    {
      kind: 'p',
      text: 'Belgian consumers may also contact the **Consumentenombudsdienst / Service de Médiation pour le Consommateur** ([mediationconsommateur.be](https://mediationconsommateur.be)).',
    },
  ],
};

/* ── 4. Cookie Policy ───────────────────────────────────────────────── */
export const COOKIES: LegalDoc = {
  slug: 'cookies',
  eyebrow: 'LEGAL',
  title: 'Cookie Policy',
  lastUpdated: 'May 2026',
  short: 'Cookies',
  blocks: [
    {
      kind: 'p',
      text: 'This Cookie Policy explains how **VIBEZCORE Audio Library** uses cookies and similar storage technologies. It complements our Privacy Policy.',
    },
    {
      kind: 'highlight',
      title: 'Short version',
      text: 'We use only essential, functional storage. We do **not** use advertising cookies, cross-site trackers, or third-party analytics that profile you. No consent banner is required because we set no non-essential trackers.',
    },
    { kind: 'h2', text: '1. What Are Cookies and Similar Technologies?' },
    {
      kind: 'p',
      text: '"Cookies" are small text files stored on your device by a website. "Local storage" and "session storage" are similar features that allow apps to save data locally on your device without sending it to a server.',
    },
    {
      kind: 'p',
      text: 'VIBEZCORE Audio Library relies primarily on **local storage** for most functionality.',
    },
    { kind: 'h2', text: '2. What We Actually Store' },
    {
      kind: 'p',
      text: '**Essential — required for the service to work:**',
    },
    {
      kind: 'ul',
      items: [
        '**Session token** — keeps you logged in',
        '**Listening progress** (vzp_v1) — remembers where you stopped in each session',
        '**Play history** (vzh_v1) — your Your Journey stats and streak',
        '**Session status** (vzs_v1) — fully-listened vs. partly-listened flags',
        '**Favourites and follows** — series you have saved or are following',
      ],
    },
    {
      kind: 'p',
      text: 'All of the above are stored locally on your device. They are not transmitted to our servers unless cross-device sync is enabled.',
    },
    { kind: 'p', text: '**Third-party — only at payment:**' },
    {
      kind: 'ul',
      items: [
        "**Gumroad** may set its own cookies during checkout to handle payment securely. These are governed by Gumroad's privacy and cookie policies.",
      ],
    },
    {
      kind: 'p',
      text: 'We do **not** use Google Analytics, Facebook Pixel, advertising networks, or any other cross-site tracking technology.',
    },
    { kind: 'h2', text: '3. Your Choices' },
    {
      kind: 'p',
      text: 'Because we use only essential storage, no consent banner is required under EU law. You can still control all storage through your device settings.',
    },
    {
      kind: 'p',
      text: 'Please note: disabling essential storage will prevent core functionality such as login, listening progress, and subscription access.',
    },
    { kind: 'h2', text: '4. Clearing Your Data' },
    {
      kind: 'p',
      text: 'You can clear all VIBEZCORE local data using the **Clear all local data** option in Settings, or by uninstalling and reinstalling the app.',
    },
    { kind: 'h2', text: '5. Do Not Track' },
    {
      kind: 'p',
      text: 'There is no agreed industry standard for "Do Not Track" signals, and VIBEZCORE does not currently respond to them. However, because we do not use tracking technology in the first place, this has no practical impact on your privacy.',
    },
    { kind: 'h2', text: '6. Changes to This Policy' },
    {
      kind: 'p',
      text: 'We may update this Cookie Policy if our use of storage technologies changes. The "Last updated" date at the top reflects the most recent version. Material changes will be communicated by email or in-app notification.',
    },
  ],
};

/* ── 5. Health & Safety ─────────────────────────────────────────────── */
export const HEALTH: LegalDoc = {
  slug: 'health',
  eyebrow: 'SAFETY',
  title: 'Health & Safety',
  lastUpdated: 'May 2026',
  short: 'Health',
  blocks: [
    {
      kind: 'danger',
      title: 'In Crisis Right Now?',
      text: 'If you are experiencing a mental health emergency or thoughts of self-harm, please reach out to a trained professional in your country immediately.\n\n**[findahelpline.com](https://findahelpline.com)** lists free, confidential crisis support lines worldwide. If you are in immediate danger, contact your local emergency services.',
    },
    { kind: 'h2', text: '1. Important Disclaimer' },
    {
      kind: 'p',
      text: '**VIBEZCORE Audio Library is a personal development tool, not medical care.** The audio sessions are designed to support self-reflection, focus, and resilience — they are **not** therapy, counselling, diagnosis, or treatment for any mental or physical health condition.',
    },
    {
      kind: 'p',
      text: 'If you are experiencing significant emotional distress, mental illness, trauma, or any medical condition, please consult a licensed professional. Our service is intended to complement, not replace, professional care.',
    },
    { kind: 'h2', text: '2. Safe Use' },
    { kind: 'p', text: 'For your safety:' },
    {
      kind: 'ul',
      items: [
        '**Never** listen while driving, cycling, operating machinery, or performing any task that requires full attention',
        'Use headphones at a moderate volume — protect your hearing',
        'Listen in a place where you feel safe and undisturbed',
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
    { kind: 'h2', text: '4. Not Suitable If…' },
    {
      kind: 'p',
      text: 'Please use caution or consult a professional before using VIBEZCORE Audio Library if you:',
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
    { kind: 'h2', text: '5. Children & Teenagers' },
    {
      kind: 'p',
      text: 'Paid subscriptions are intended for adults. Some content discusses topics such as identity, betrayal, discipline, and resilience that may not be appropriate for younger audiences. Parents and guardians are responsible for deciding what is suitable for minors in their care.',
    },
    { kind: 'h2', text: '6. Professional Help' },
    {
      kind: 'p',
      text: 'VIBEZCORE Audio Library is no replacement for therapy. If you would benefit from speaking to someone, please consider:',
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
    { kind: 'h2', text: '7. Results Vary' },
    {
      kind: 'p',
      text: 'Personal development is highly individual. The benefits of the service depend on consistent practice, your circumstances, and many factors outside our control. We make no promises about specific outcomes.',
    },
    { kind: 'h2', text: '8. Reporting Concerns' },
    {
      kind: 'p',
      text: 'If a session feels harmful, misleading, or inappropriate, please let us know through the support form. Your feedback helps us keep the library safe and high-quality.',
    },
  ],
};

/* ── Lookup map + ordered list voor navigatie ───────────────────────── */
export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  refund: REFUND,
  cookies: COOKIES,
  health: HEALTH,
};

export const LEGAL_ORDER: LegalSlug[] = [
  'terms',
  'privacy',
  'refund',
  'cookies',
  'health',
];
