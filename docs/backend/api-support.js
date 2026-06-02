/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Support form endpoint
   Iter 9dp (2026-06-02)

   DEPLOY: kopieer naar `netlify/functions/support.js` in de backend repo
   en deploy.
   ROUTE in netlify.toml of redirects:
     /api/support -> /.netlify/functions/support

   PROTOCOL
   ────────
   POST /api/support
   Headers:
     Content-Type: application/json
   Body:
     {
       "category":  "Audio Library" | "Smart Bead Bracelet" | ...,
       "subject":   "<user-typed subject>",
       "message":   "<user-typed message>",
       "fromEmail": "<reply-to address>",
       "platform":  "ios" | "android" | "web"
     }
   Response (success):
     { "ok": true }
   Response (error):
     { "error": "..." } with appropriate 4xx/5xx status

   AUTH
   ────
   Geen JWT-vereiste — anonieme gasten moeten ook support kunnen mailen
   (bv. user kan niet inloggen → heeft hulp nodig). Bescherming komt van
   Zoho's SMTP-throughput-limiet + basis-validatie op input-size.

   EMAIL DELIVERY
   ──────────────
   Stuurt via Zoho SMTP (smtp.zoho.eu, SSL/465) namens info@vibezcore.com,
   met Reply-To gezet op de user's eigen email. Operator kan in Zoho gewoon
   op Reply klikken en de mail gaat naar de juiste persoon.

   DEPS (in package.json van backend repo):
     nodemailer
   ENV VARS (in Netlify):
     ZOHO_EMAIL          (bv. info@vibezcore.com)
     ZOHO_APP_PASSWORD   (Zoho App-Specific Password, NIET je login-pw)
     ZOHO_SMTP_HOST      (default: smtp.zoho.eu — pas aan voor andere regio's)
     SUPPORT_INBOX       (optional, default = ZOHO_EMAIL)
   ───────────────────────────────────────────────────────────────────── */

const nodemailer = require('nodemailer');

const ZOHO_EMAIL = process.env.ZOHO_EMAIL;
const ZOHO_APP_PASSWORD = process.env.ZOHO_APP_PASSWORD;
const ZOHO_SMTP_HOST = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.eu';
const SUPPORT_INBOX = process.env.SUPPORT_INBOX || ZOHO_EMAIL;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/* Input-size limieten — voorkomen abuse via gigantische payloads.
   Subject/message ruim genoeg voor echte support-cases. */
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;
const MAX_CATEGORY = 100;

exports.handler = async (event) => {
  /* CORS preflight. */
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  /* Config-check — als env vars niet zijn gezet, gefaald deployment. */
  if (!ZOHO_EMAIL || !ZOHO_APP_PASSWORD) {
    return json(500, {
      error: 'Server email config missing (ZOHO_EMAIL / ZOHO_APP_PASSWORD).',
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const fromEmail = typeof body.fromEmail === 'string' ? body.fromEmail.trim() : '';
  const platform = typeof body.platform === 'string' ? body.platform.trim() : 'unknown';

  /* Validatie. */
  if (!subject) return json(400, { error: 'Subject is required.' });
  if (subject.length > MAX_SUBJECT)
    return json(400, { error: `Subject too long (max ${MAX_SUBJECT}).` });
  if (!message) return json(400, { error: 'Message is required.' });
  if (message.length > MAX_MESSAGE)
    return json(400, { error: `Message too long (max ${MAX_MESSAGE}).` });
  if (!fromEmail || !/\S+@\S+\.\S+/.test(fromEmail))
    return json(400, { error: 'Valid email is required.' });
  if (category.length > MAX_CATEGORY)
    return json(400, { error: 'Category invalid.' });

  /* Bouw email-content. Category als prefix op subject voor inbox-triage. */
  const categoryTag = category ? `[${category}] ` : '';
  const emailSubject = `${categoryTag}${subject}`;

  const ipHeader = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const userAgent = event.headers['user-agent'] || 'unknown';

  const plainBody = [
    `Category:  ${category || 'Not specified'}`,
    `From:      ${fromEmail}`,
    `Platform:  ${platform}`,
    `IP:        ${ipHeader}`,
    `UA:        ${userAgent}`,
    '',
    '─── Message ──────────────────────────',
    '',
    message,
    '',
    '─────────────────────────────────────',
    '— sent from VIBEZCORE App support form',
  ].join('\n');

  /* HTML-versie voor mailclients die HTML prefereren (Gmail/Outlook). */
  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#1a1a1a;max-width:640px;">
      <h2 style="color:#3a8fff;margin:0 0 16px 0;font-size:18px;">VIBEZCORE Support Request</h2>
      <table style="border-collapse:collapse;font-size:13px;margin-bottom:20px;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Category:</td><td style="padding:4px 0;"><strong>${escapeHtml(category || 'Not specified')}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">From:</td><td style="padding:4px 0;"><a href="mailto:${escapeHtml(fromEmail)}">${escapeHtml(fromEmail)}</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Platform:</td><td style="padding:4px 0;">${escapeHtml(platform)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">IP:</td><td style="padding:4px 0;font-family:monospace;">${escapeHtml(ipHeader)}</td></tr>
      </table>
      <div style="border-left:3px solid #3a8fff;padding-left:14px;margin:16px 0;white-space:pre-wrap;font-size:14px;line-height:1.5;">${escapeHtml(message)}</div>
      <p style="color:#888;font-size:11px;margin-top:24px;">— sent from VIBEZCORE App support form</p>
    </div>
  `;

  /* Zoho SMTP transporter — SSL/465. */
  const transporter = nodemailer.createTransport({
    host: ZOHO_SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: ZOHO_EMAIL,
      pass: ZOHO_APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `"VIBEZCORE Support" <${ZOHO_EMAIL}>`,
      to: SUPPORT_INBOX,
      replyTo: fromEmail,
      subject: emailSubject,
      text: plainBody,
      html: htmlBody,
    });
    return json(200, { ok: true });
  } catch (err) {
    /* SMTP-fail (auth issue, host onbereikbaar, etc.) — log voor debugging
       maar return generieke error naar client (geen credentials lekken). */
    console.error('SMTP error:', err.message);
    return json(502, { error: 'Email service unavailable. Try again later.' });
  }
};

function json(status, body) {
  return {
    statusCode: status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
