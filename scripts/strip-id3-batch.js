/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Batch ID3 strip + retag voor alle Bunny-CDN mp3's

   Doel: PodcastleAI / fre:ac / long-filename ID3-tags weghalen en
   vervangen door drie schone tags die overeenkomen met onze app-data:
     title  = session.title (uit audio-library-data.ts)
     album  = session.series
     artist = "VIBEZCORE"

   Lock-screen / notification-shade op Android (en lock-screen op iOS)
   toont dan onze waarden ipv de oude ingebakken filename/PodcastleAI.

   Werkwijze per track:
     1. Skip-check: bestaat /backup-2026-05-23/<filename> al op Bunny
        Storage? → ja: skip (resumability — vorige run heeft 'm gedaan).
     2. Download via Bunny Storage API (AccessKey-header — geen
        Token-Auth nodig zoals bij de pull zone).
     3. ffmpeg -map_metadata -1 + 3 nieuwe -metadata flags + -c:a copy.
        Audio-stream wordt niet aangeraakt (zelfde bytes, alleen
        container-metadata vervangen).
     4. Upload origineel naar /backup-2026-05-23/<filename> (safety net).
     5. Upload stripped over de originele path (overschrijft).
     6. Cache-purge de CDN-URL via api.bunny.net (async=false).
        Bij purge-failure: WARN maar geen track-failure — Storage is
        bijgewerkt, cache TTL doet de rest.
     7. Tmp-files opruimen.

   Foutafhandeling:
     - Iedere fout in stap 2/3/4/5 → track FAILED, ga door met volgende.
     - Stap 5 (stripped-upload) faalt na succesvolle backup → rollback:
       delete de zojuist geüploade backup zodat een re-run deze track
       opnieuw probeert (anders zou skip-check 'm valselijk overslaan).
     - Stap 6 (purge) faalt → WARN, niet FAIL (file zit al in Storage).

   Rate-limit: sleep 1s tussen tracks (Bunny API friendly).

   Logging:
     - Console-output realtime.
     - Parallel append naar /tmp/strip-log.txt.
     - Eindrapport: SUCCEEDED / SKIPPED / FAILED counts + lijst van
       failures.

   Resumability:
     - Backup-bestaat-check is de bron-van-waarheid voor "deze track
       is al gedaan". Door de rollback-on-failure-step blijft die
       binair betrouwbaar.
     - Veilig om opnieuw te draaien zodra het script eerder is
       afgebroken / gecrasht.
   ─────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ── Configuratie ────────────────────────────────────────────────────────
const FFMPEG = 'C:/Users/ulgar/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe';
const CDN_BASE = 'https://vibezcore-audio.b-cdn.net';
const WORKDIR = '/tmp/id3-batch';
const LOG_FILE = '/tmp/strip-log.txt';
const BACKUP_PREFIX = 'backup-2026-05-23/';
const TMP_IN = path.join(WORKDIR, 'in.mp3');
const TMP_OUT = path.join(WORKDIR, 'out.mp3');
/* Discard-target voor curl response-bodies die we niet bewaren.
   `/dev/null` werkt NIET op Windows wanneer curl.exe direct via
   Node's execFileSync wordt aangeroepen — bash-shells mappen het
   naar NUL, maar de directe spawn ziet de letterlijke string en
   faalt. Bug-fix 2026-05-23. */
const TMP_DISCARD = path.join(WORKDIR, '_discard.tmp');
const CURL_MAX_TIME = 300; // 5 min per HTTP call
const SLEEP_BETWEEN_TRACKS_MS = 1000; // rate limit

// ── .env.bunny lader ────────────────────────────────────────────────────
function loadEnv() {
  const envContent = fs.readFileSync('.env.bunny', 'utf8');
  const env = {};
  envContent.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  });
  const required = [
    'BUNNY_STORAGE_ZONE',
    'BUNNY_STORAGE_PASSWORD',
    'BUNNY_STORAGE_HOSTNAME',
    'BUNNY_API_KEY',
  ];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error('Missing required env keys: ' + missing.join(', '));
  }
  return env;
}

// ── Track-parser ────────────────────────────────────────────────────────
/* Match per-track object in audio-library-data.ts. Cruciaal: gebruikt
   character-classes die zowel single-quoted ('xxx') als double-quoted
   ("xxx") string-literals voor desc accepteren, en accepteert geescapede
   apostrofs in title/series ('The Warrior\'s Mind'). */
function parseTracks() {
  const src = fs.readFileSync('src/data/audio-library-data.ts', 'utf8');
  // Match title:'...', series:'...', <anything-non-brace>, url:'<bunny-url>'
  const re =
    /title:'((?:[^'\\]|\\.)*)',\s*series:'((?:[^'\\]|\\.)*)',[^{}]*?url:'(https:\/\/vibezcore-audio\.b-cdn\.net\/[^']+)'/g;
  const tracks = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    tracks.push({
      title: m[1].replace(/\\'/g, "'"),
      series: m[2].replace(/\\'/g, "'"),
      url: m[3],
      filename: m[3].replace(CDN_BASE + '/', ''),
    });
  }
  return tracks;
}

// ── Logging (console + file) ────────────────────────────────────────────
let logStream;
function initLog() {
  // Truncate vorige log
  fs.writeFileSync(LOG_FILE, '');
  logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
}
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  if (logStream) logStream.write(line + '\n');
}

// ── Curl helpers ────────────────────────────────────────────────────────
function curlDownload(url, headers, outPath) {
  const args = [
    '-s',
    '--max-time', String(CURL_MAX_TIME),
    '-w', '%{http_code} %{size_download} %{time_total}',
    '-o', outPath,
  ];
  for (const [k, v] of Object.entries(headers || {})) {
    args.push('-H', `${k}: ${v}`);
  }
  args.push(url);
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8' });
    const [code, size, time] = out.trim().split(/\s+/);
    return {
      code: parseInt(code, 10),
      size: parseInt(size, 10),
      time: parseFloat(time),
    };
  } catch (e) {
    return { code: 0, size: 0, time: 0, error: e.message };
  }
}

function curlUpload(url, headers, inPath) {
  const args = [
    '-s',
    '--max-time', String(CURL_MAX_TIME),
    '-w', '%{http_code} %{size_upload} %{time_total}',
    '-X', 'PUT',
  ];
  for (const [k, v] of Object.entries(headers || {})) {
    args.push('-H', `${k}: ${v}`);
  }
  args.push('--data-binary', `@${inPath}`, url);
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8' });
    /* Bunny PUT returnt JSON body + curl plakt format string aan einde
       zonder separator. Eg: {"HttpCode":201,"Message":"File uploaded."}201 14720720 1.234
       Pak het laatste "NNN NNN NN.NN" triple. */
    const match = out.match(/(\d{3})\s+(\d+)\s+([\d.]+)\s*$/);
    if (!match) return { code: 0, size: 0, time: 0 };
    return {
      code: parseInt(match[1], 10),
      size: parseInt(match[2], 10),
      time: parseFloat(match[3]),
    };
  } catch (e) {
    return { code: 0, size: 0, time: 0, error: e.message };
  }
}

function curlPurge(cdnUrl, apiKey) {
  const encoded = encodeURIComponent(cdnUrl);
  const url = `https://api.bunny.net/purge?url=${encoded}&async=false`;
  const args = [
    '-s',
    '--max-time', String(CURL_MAX_TIME),
    '-w', '%{http_code}',
    '-X', 'POST',
    '-H', `AccessKey: ${apiKey}`,
    url,
  ];
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8' });
    const match = out.match(/(\d{3})\s*$/);
    return { code: match ? parseInt(match[1], 10) : 0 };
  } catch (e) {
    return { code: 0, error: e.message };
  }
}

function curlDelete(url, accessKey) {
  const args = [
    '-s',
    '--max-time', '30',
    '-o', TMP_DISCARD,
    '-w', '%{http_code}',
    '-X', 'DELETE',
    '-H', `AccessKey: ${accessKey}`,
    url,
  ];
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8' });
    return parseInt(out.trim(), 10);
  } catch {
    return 0;
  }
}

/* HEAD werkt niet op Bunny Storage (401 in onze test). Gebruik
   GET met Range bytes=0-0 — Bunny Storage supports range, returnt
   206 (Partial Content) bij bestaande file, 404 bij ontbrekende. */
function backupExists(storageBase, accessKey, filename) {
  const url = `${storageBase}/${BACKUP_PREFIX}${filename}`;
  const args = [
    '-s',
    '--max-time', '30',
    '-o', TMP_DISCARD,
    '-w', '%{http_code}',
    '-H', `AccessKey: ${accessKey}`,
    '-r', '0-0',
    url,
  ];
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8' });
    const code = parseInt(out.trim(), 10);
    return code === 200 || code === 206;
  } catch {
    return false;
  }
}

// ── Per-track flow ──────────────────────────────────────────────────────
function processTrack(track, idx, total, env) {
  const progress = `[${(idx + 1).toString().padStart(2)}/${total}]`;
  const storageBase = `https://${env.BUNNY_STORAGE_HOSTNAME}/${env.BUNNY_STORAGE_ZONE}`;
  const filename = track.filename;
  const t0 = Date.now();

  log(`${progress} START "${track.title}" (${track.series})`);
  log(`${progress}        ${filename}`);

  // 1. Skip-check
  if (backupExists(storageBase, env.BUNNY_STORAGE_PASSWORD, filename)) {
    log(`${progress} SKIP — backup already exists`);
    return 'SKIPPED';
  }

  // 2. Download original
  const dl = curlDownload(
    `${storageBase}/${filename}`,
    { AccessKey: env.BUNNY_STORAGE_PASSWORD },
    TMP_IN
  );
  if (dl.code !== 200) {
    log(`${progress} FAIL — download HTTP ${dl.code}${dl.error ? ' (' + dl.error + ')' : ''}`);
    return 'FAILED';
  }
  log(`${progress}   download: HTTP 200, ${dl.size} bytes, ${dl.time.toFixed(1)}s`);

  // 3. ffmpeg strip + retag
  try {
    execFileSync(
      FFMPEG,
      [
        '-y',
        '-loglevel', 'error',
        '-i', TMP_IN,
        '-map_metadata', '-1',
        '-metadata', `title=${track.title}`,
        '-metadata', `album=${track.series}`,
        '-metadata', `artist=VIBEZCORE`,
        '-c:a', 'copy',
        TMP_OUT,
      ],
      { stdio: 'pipe' }
    );
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString().slice(0, 200) : e.message;
    log(`${progress} FAIL — ffmpeg: ${stderr}`);
    return 'FAILED';
  }
  const strippedSize = fs.statSync(TMP_OUT).size;
  log(`${progress}   ffmpeg: OK, ${strippedSize} bytes (${dl.size - strippedSize} bytes id3 verwijderd)`);

  // 4. Upload backup
  const bup = curlUpload(
    `${storageBase}/${BACKUP_PREFIX}${filename}`,
    {
      AccessKey: env.BUNNY_STORAGE_PASSWORD,
      'Content-Type': 'application/octet-stream',
    },
    TMP_IN
  );
  if (bup.code !== 201) {
    log(`${progress} FAIL — backup upload HTTP ${bup.code}${bup.error ? ' (' + bup.error + ')' : ''}`);
    return 'FAILED';
  }
  log(`${progress}   backup: HTTP 201, ${bup.size} bytes, ${bup.time.toFixed(1)}s`);

  // 5. Upload stripped over original
  const up = curlUpload(
    `${storageBase}/${filename}`,
    {
      AccessKey: env.BUNNY_STORAGE_PASSWORD,
      'Content-Type': 'application/octet-stream',
    },
    TMP_OUT
  );
  if (up.code !== 201) {
    log(`${progress} FAIL — stripped upload HTTP ${up.code}${up.error ? ' (' + up.error + ')' : ''}`);
    // Rollback: delete backup so re-run picks up
    const delCode = curlDelete(
      `${storageBase}/${BACKUP_PREFIX}${filename}`,
      env.BUNNY_STORAGE_PASSWORD
    );
    log(`${progress}   rollback: backup deleted (HTTP ${delCode})`);
    return 'FAILED';
  }
  log(`${progress}   stripped: HTTP 201, ${up.size} bytes, ${up.time.toFixed(1)}s`);

  // 6. Cache-purge (non-fatal)
  const pg = curlPurge(`${CDN_BASE}/${filename}`, env.BUNNY_API_KEY);
  if (pg.code !== 200) {
    log(`${progress}   purge: WARN HTTP ${pg.code} — file is in Storage, cache zal binnen TTL verversen`);
  } else {
    log(`${progress}   purge: HTTP 200`);
  }

  // 7. Cleanup tmp
  try { fs.unlinkSync(TMP_IN); } catch {}
  try { fs.unlinkSync(TMP_OUT); } catch {}

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log(`${progress} OK (${elapsed}s)`);
  return 'SUCCEEDED';
}

// ── Sleep ───────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── CLI args ────────────────────────────────────────────────────────────
/* `--only=<filename>` filtert de tracklist tot één enkele track met
   exact-matchende `filename`. Gebruikt voor pre-flight dry-run op de
   Fase-1 sample-track (die heeft een backup → script SKIPs → exercise
   van loadEnv + parseTracks + backupExists + log zonder uploads). */
function parseArgs() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([a-z-]+)(?:=(.+))?$/);
    if (m) args[m[1]] = m[2] ?? true;
  }
  return args;
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(WORKDIR, { recursive: true });
  initLog();

  const cliArgs = parseArgs();
  const env = loadEnv();
  let allTracks = parseTracks();
  log(`Parsed ${allTracks.length} tracks total`);

  if (cliArgs.only) {
    const before = allTracks.length;
    allTracks = allTracks.filter((t) => t.filename === cliArgs.only);
    log(`--only filter: matched ${allTracks.length} / ${before} tracks for "${cliArgs.only}"`);
    if (allTracks.length === 0) {
      log('FATAL: --only filter matched zero tracks. Check the filename.');
      if (logStream) logStream.end();
      process.exit(1);
    }
  }

  log(`Storage: ${env.BUNNY_STORAGE_HOSTNAME}/${env.BUNNY_STORAGE_ZONE}`);
  log(`Backup prefix: ${BACKUP_PREFIX}`);
  log(`Workdir: ${WORKDIR}`);
  log(`Log file: ${LOG_FILE}`);
  log('---');

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const failedTracks = [];

  const tStart = Date.now();

  for (let i = 0; i < allTracks.length; i++) {
    const result = processTrack(allTracks[i], i, allTracks.length, env);
    if (result === 'SUCCEEDED') ok++;
    else if (result === 'SKIPPED') skipped++;
    else {
      failed++;
      failedTracks.push(allTracks[i]);
    }

    if (i < allTracks.length - 1) {
      await sleep(SLEEP_BETWEEN_TRACKS_MS);
    }
  }

  const totalMin = ((Date.now() - tStart) / 60000).toFixed(1);

  log('---');
  log(`SUCCEEDED: ${ok}`);
  log(`SKIPPED:   ${skipped}  (backup bestond al — eerdere run / Fase-1 sample)`);
  log(`FAILED:    ${failed}`);
  if (failedTracks.length > 0) {
    log('Failed tracks (handmatige retry nodig — delete backup eerst):');
    failedTracks.forEach((t) => log(`  - ${t.filename}  ("${t.title}" — ${t.series})`));
  }
  log(`TOTAL TIME: ${totalMin} min`);
  log('');
  log('Note: 1 track al verwerkt in Fase 1 (Beast Mode - Become a Monster).');
  log(`Totale tracks now stripped+retagged op Bunny = SUCCEEDED + SKIPPED van Fase-1-sample.`);
  log(`Bij volle batch zonder eerdere onderbreking: SUCCEEDED=82 + SKIPPED=1 = 83 tracks live.`);
  log('');
  log(`Log: ${LOG_FILE}`);

  if (logStream) logStream.end();

  process.exit(failed > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  if (logStream) logStream.end();
  process.exit(1);
});
