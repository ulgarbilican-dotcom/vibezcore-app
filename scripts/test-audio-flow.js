/* ===========================================================================
   VIBEZCORE -- test-audio-flow.js

   Simuleert de RN-app flow IN NODE.js, zonder emulator. Bewijst dat de
   backend correct werkt voor PRO content. Als dit script PASS geeft EN de
   RN-app FAIL geeft -> bug is emulator-network, niet productie.

   Flow exact zoals src/services/auth.ts + src/utils/api.ts + audio-url.ts:
     1. POST  /auth/v1/token?grant_type=password   (manual REST, geen SDK)
     2. Extract access_token uit response
     3. GET   /api/audio-url?path=<PRO_PATH>       (Bearer + Content-Type)
     4. Verifieer 200 + signed URL in body

   Credentials komen uit .env.test (zelfde file als test-pro-auth.ps1).

   Run vanuit project-root:
     node ./scripts/test-audio-flow.js

   Exit code:
     0  = PASS (alle stappen 200)
     2  = FAIL (één of meer stappen niet 200)
     1  = SETUP error (.env.test mist, network down, etc)
   =========================================================================== */

const fs = require('fs');
const path = require('path');

// RN-app praat NIET meer rechtstreeks met Supabase — alle auth via
// backend auth-proxy (2026-05-22). Script doet hetzelfde.
const BACKEND = 'https://app.vibezcore.com';
const FREE_PATH = '/Andrew_Huberman_1._Neural_State_Control_How_to_Direct_Your_Mind_Instead_of_Chasing_It_osg0uy.mp3.mp3';
const LOCKED_PATH = '/Carl_Jung_1_The_Journey_to_the_Self_satfq8.mp3.mp3';

// --- Credentials uit .env.test --------------------------------------------

function readEnvTest() {
  const envFile = path.join(__dirname, '..', '.env.test');
  if (!fs.existsSync(envFile)) {
    console.error('SETUP ERR: .env.test ontbreekt.');
    console.error('Run eerst:  powershell -ExecutionPolicy Bypass -File .\\scripts\\test-pro-auth.ps1');
    console.error('(Die script vraagt credentials + slaat ze op in .env.test).');
    process.exit(1);
  }
  const content = fs.readFileSync(envFile, 'utf8');
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  if (!out.VZ_TEST_EMAIL || !out.VZ_TEST_PASSWORD) {
    console.error('SETUP ERR: VZ_TEST_EMAIL of VZ_TEST_PASSWORD ontbreekt in .env.test');
    process.exit(1);
  }
  return { email: out.VZ_TEST_EMAIL, password: out.VZ_TEST_PASSWORD };
}

// --- Stap 1: Login (= auth.ts login()) -----------------------------------

async function login(email, password) {
  const url = BACKEND + '/api/auth-proxy?action=login';
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    return { ok: false, reason: 'login network error: ' + e.message };
  }
  const body = await res.text();
  if (!res.ok) {
    return { ok: false, reason: 'login ' + res.status + ': ' + body.slice(0, 200) };
  }
  let data;
  try { data = JSON.parse(body); } catch { return { ok: false, reason: 'login JSON parse failed' }; }
  if (!data.access_token) {
    return { ok: false, reason: 'login missing access_token in response' };
  }
  return { ok: true, token: data.access_token, user: data.user };
}

// --- Stap 2: GET /api/audio-url (= audio-url.ts + apiCall) ---------------

async function callAudioUrl(token, pathQuery, label) {
  const url = BACKEND + '/api/audio-url?path=' + encodeURIComponent(pathQuery);
  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  } catch (e) {
    return { ok: false, reason: label + ' network error: ' + e.message };
  }
  const body = await res.text();
  const headers = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  if (res.status !== 200) {
    return {
      ok: false,
      reason: label + ' status ' + res.status + ' body: ' + body.slice(0, 200),
      headers,
    };
  }
  let data;
  try { data = JSON.parse(body); } catch { return { ok: false, reason: label + ' JSON parse failed' }; }
  if (!data.url) {
    return { ok: false, reason: label + ' missing url in response' };
  }
  return { ok: true, signedUrl: data.url, expires: data.expires_at, headers };
}

// --- Stap 3: HEAD op de signed URL (= Bunny accepteert de token) ---------

async function pingSignedUrl(signedUrl, label) {
  let res;
  try {
    res = await fetch(signedUrl, { method: 'HEAD' });
  } catch (e) {
    return { ok: false, reason: label + ' Bunny HEAD network error: ' + e.message };
  }
  if (res.status !== 200) {
    return { ok: false, reason: label + ' Bunny HEAD status ' + res.status };
  }
  return { ok: true };
}

// --- Runner ---------------------------------------------------------------

(async () => {
  const creds = readEnvTest();

  console.log('[1/4] POST /auth/v1/token (Supabase login) as', creds.email);
  const lr = await login(creds.email, creds.password);
  if (!lr.ok) { console.log('FAIL:', lr.reason); process.exit(2); }
  console.log('      OK token len=' + lr.token.length + ' user.id=' + lr.user.id);

  console.log('[2/4] GET /api/audio-url FREE  (control)');
  const r1 = await callAudioUrl(lr.token, FREE_PATH, 'FREE');
  if (!r1.ok) { console.log('FAIL:', r1.reason); process.exit(2); }
  console.log('      OK signed-url len=' + r1.signedUrl.length + ' expires=' + r1.expires);

  console.log('[3/4] GET /api/audio-url PRO   (de bug)');
  const r2 = await callAudioUrl(lr.token, LOCKED_PATH, 'PRO');
  if (!r2.ok) {
    console.log('FAIL:', r2.reason);
    if (r2.headers) {
      console.log('      cache-control:', r2.headers['cache-control']);
      console.log('      vary:', r2.headers['vary']);
      console.log('      age:', r2.headers['age']);
    }
    process.exit(2);
  }
  console.log('      OK signed-url len=' + r2.signedUrl.length + ' expires=' + r2.expires);
  console.log('      cache-control:', r2.headers['cache-control']);
  console.log('      vary:', r2.headers['vary']);

  console.log('[4/4] HEAD signed Bunny URL    (PRO playback path)');
  const r3 = await pingSignedUrl(r2.signedUrl, 'PRO');
  if (!r3.ok) { console.log('FAIL:', r3.reason); process.exit(2); }
  console.log('      OK Bunny returns 200 for signed URL');

  console.log('');
  console.log('PASS');
  console.log('  Backend chain works end-to-end for PRO content from Node.');
  console.log('  If RN-app on emulator fails, bug is emulator-network, not backend.');
  process.exit(0);
})().catch((e) => {
  console.error('SETUP ERR uncaught:', e && e.message ? e.message : String(e));
  process.exit(1);
});
