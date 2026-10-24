"""Automatische controle van A tot Z (docs/KWALITEITSPROTOCOL.md). Eén commando, vier lagen, één eindoordeel.

  python scripts/qa-all.py <adb-serial> [--static-only]

  Laag 1  STATISCH   (geen toestel)  typecontrole, foutpatronen, icoon, verboden woorden
  Laag 2  ROUTES     (toestel, QA-build, Free én Premium)  elke route: geen crash, geen wit scherm, uitweg aanwezig én werkend
  Laag 3  CRASHVEILIGHEID  Firebase Test Lab op 5 toestellen (scripts/testlab.sh) — apart gestart, uitslag hier gelezen
  Laag 4  EINDOORDEEL  alleen "KLAAR" als elke laag PASS is; elke uitzondering staat zichtbaar met reden in het rapport.

Rapport: scratchpad/qa-report.md. Exitcode 0 = KLAAR, 1 = NIET KLAAR.
"""
import glob, json, os, re, subprocess, sys, time
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from PIL import Image
import io

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADB = os.environ.get('ADB', r'C:\Users\ulgar\AppData\Local\Android\Sdk\platform-tools\adb.exe')
SER = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else None
STATIC_ONLY = '--static-only' in sys.argv
TIERS = tuple(a.split('=', 1)[1].split(',') for a in sys.argv if a.startswith('--tier='))[0] if any(a.startswith('--tier=') for a in sys.argv) else ('free', 'premium')
PKG = 'com.ubili.vibezcoreapp'
REPORT = os.path.join(ROOT, 'scratchpad', 'qa-report.md')
rows = []          # (laag, controle, uitkomst PASS/FAIL/SKIP, detail)


def add(layer, name, ok, detail='', skip=False):
    r = 'SKIP' if skip else ('PASS' if ok else 'FAIL')
    rows.append((layer, name, r, detail))
    print(f'{r:4}  [{layer}] {name}  {detail}'[:230])


# ───────────────────────── Laag 1: statisch ─────────────────────────
def layer1():
    L = '1 statisch'
    r = subprocess.run('npx tsc --noEmit', shell=True, cwd=ROOT, capture_output=True, text=True)
    add(L, 'TypeScript compileert zonder fouten', r.returncode == 0, (r.stdout.strip().splitlines() or [''])[0][:120])

    files = glob.glob(os.path.join(ROOT, 'src', '**', '*.tsx'), recursive=True)
    # 1a. Reanimated-stijl op een RN-Animated.View (de fout die de dots onzichtbaar hield)
    bad = []
    for f in files:
        t = open(f, encoding='utf-8').read()
        if not re.search(r'import\s+(Reanimated\w*)\b[^;]*from \'react-native-reanimated\'', t):
            continue
        names = {n for n in re.findall(r'const (\w+) = useAnimatedStyle\(', t) if n != 'style'}
        for m in re.finditer(r'<Animated\.(View|Text|Image)\b[^>]*?>', t, re.S):
            if any(re.search(r'\b' + n + r'\b', m.group(0)) for n in names):
                bad.append(os.path.relpath(f, ROOT) + ':' + str(t[:m.start()].count('\n') + 1))
    add(L, 'Geen Reanimated-stijl op RN-Animated (alias-fout)', not bad, ', '.join(bad[:5]))

    # 1b. Alle uitwegen (Back/Close/Cancel/Done/…) lopen via een meetbare knop
    unmeasurable = []
    exit_re = re.compile(r'accessibilityLabel=(?:"|\{`)(Back|Close|Cancel|Done|Not now|Maybe later|Minimize|Skip|Got it)')
    for f in files:
        t = open(f, encoding='utf-8').read()
        for m in exit_re.finditer(t):
            s = t.rfind('<', 0, m.start())
            while s != -1 and not re.match(r'<[A-Z]', t[s:s + 3]):
                s = t.rfind('<', 0, s)
            tag = re.match(r'<([A-Za-z.]+)', t[s:]).group(1) if s != -1 else '?'
            if tag in ('Pressable', 'TouchableOpacity', 'TouchableHighlight'):
                unmeasurable.append(f'{os.path.relpath(f, ROOT)}:{t[:m.start()].count(chr(10)) + 1}<{tag}>')
    add(L, 'Elke uitweg is meetbaar (Tap / PressScale / QaPressable)', not unmeasurable, ', '.join(unmeasurable[:5]))

    # 1c. Icoon: effen zwart, witte V, redelijke V-grootte (Android-laag ≈ 38% van de laag)
    try:
        ic = Image.open(os.path.join(ROOT, 'assets/icon/app_icon_1024.png')).convert('RGB')
        corner = ic.getpixel((8, 8)); mid = ic.getpixel((120, 512))
        add(L, 'Icoon: achtergrond effen zwart', max(corner) < 20 and max(mid) < 20, f'hoek={corner} midden-links={mid}')
        fg = Image.open(os.path.join(ROOT, 'assets/icon/android_icon_1024.png')).convert('RGBA')
        bb = fg.split()[3].point(lambda v: 255 if v > 200 else 0).getbbox()
        w = bb[2] - bb[0]
        add(L, 'Android-icoon: V-breedte binnen 33–43% van de laag', 0.33 * 1024 <= w <= 0.43 * 1024, f'{w}px = {w / 10.24:.0f}%')
    except Exception as e:                                                      # noqa
        add(L, 'Icoon-controle', False, str(e))

    # 1c2. Ontwikkel-/prototype-schermen zijn buiten __DEV__ onbereikbaar (devOnly) - route kopt zelf melden wat het is
    unguarded = []
    for f in glob.glob(os.path.join(ROOT, 'src', 'app', '*.tsx')):
        head = ''.join(open(f, encoding='utf-8').readlines()[:25])
        if re.search(r'PROTOTYPE|__DEV__ only|dev only|tijdelijk testscherm', head, re.I):
            body = open(f, encoding='utf-8').read()
            if 'devOnly(' not in body and '<Redirect' not in body:
                unguarded.append(os.path.relpath(f, ROOT))
    add(L, 'Prototype-/dev-schermen zijn niet bereikbaar in een winkelbuild', not unguarded, ', '.join(unguarded))

    # 1d. Merkregels: geen verboden termen in app-tekst (commentaar eerst weggehaald, regelnummers blijven kloppen)
    def strip_comments(src):
        def blank(m):
            return re.sub(r'[^\n]', ' ', m.group(0))
        src = re.sub(r'/\*.*?\*/', blank, src, flags=re.S)
        return re.sub(r'(?<![:"\'])//[^\n]*', blank, src)
    forb = []
    for f in files:
        t = strip_comments(open(f, encoding='utf-8').read())
        for term in ('hersengolven', 'brainwave', 'klinisch bewezen', 'synchroniseert'):
            for m in re.finditer(term, t, re.I):
                forb.append(f'{os.path.relpath(f, ROOT)}:{t[:m.start()].count(chr(10)) + 1}')
    add(L, 'Geen verboden claim-woorden in app-teksten', not forb, ', '.join(forb[:4]))
    low = []
    for f in files:
        for i, line in enumerate(open(f, encoding='utf-8').read().splitlines(), 1):
            s = line.strip()
            if re.search(r">\s*[^<>{}]*\bVibezcore\b[^<>{}]*<", s) or re.search(r"(title|label|text)[=:]\s*['\"][^'\"]*\bVibezcore\b", s):
                low.append(f'{os.path.relpath(f, ROOT)}:{i}')
    add(L, 'VIBEZCORE overal in hoofdletters (zichtbare tekst)', not low, ', '.join(low[:4]))


# ───────────────────────── Laag 2: routes ─────────────────────────
def sh(*a):
    return subprocess.run([ADB, '-s', SER, *a], capture_output=True)


def qa_state():
    out = sh('logcat', '-d', '-s', 'ReactNativeJS:V').stdout.decode('utf-8', 'ignore')
    last = None
    for line in out.splitlines():
        m = re.search(r'\[QA\] (\{.*\})', line)
        if m:
            try:
                last = json.loads(m.group(1))
            except ValueError:
                pass
    return last


def crashed():
    out = sh('logcat', '-d', '-b', 'crash').stdout.decode('utf-8', 'ignore')
    return 'FATAL EXCEPTION' in out or PKG + ' crashed' in out


def lum():
    png = sh('exec-out', 'screencap', '-p').stdout
    im = Image.open(io.BytesIO(png)).convert('L')
    w, h = im.size
    reg = im.crop((0, int(h * .08), w, int(h * .86))).resize((60, 120))
    return sum(reg.getdata()) / (60 * 120)


def tap(x, y, wait=2.5):
    sh('shell', 'input', 'tap', str(x), str(y)); time.sleep(wait)


def app_routes():
    """Alle routes uit src/app, met voorbeeldparameters voor dynamische. Tabs staan los (zie tabs_sweep)."""
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'src', 'app', '**', '*.tsx'), recursive=True)):
        rel = os.path.relpath(f, os.path.join(ROOT, 'src', 'app')).replace('\\', '/')[:-4]
        if rel.startswith('_layout') or rel.startswith('(tabs)') or rel in ('qa', 'qa-haptics', 'auth-callback', 'test-tier', 'breath-splat', 'breath-pacer-preview'):
            continue
        rel = rel.replace('legal/[doc]', 'legal/privacy-policy').replace('library/pillar/[key]', 'library/pillar/resilience')
        out.append('/' + rel)
    return out


def foreground_is_app():
    out = sh('shell', 'dumpsys', 'window').stdout.decode('utf-8', 'ignore')
    m = re.search(r'mCurrentFocus=.*', out)
    return bool(m) and PKG in m.group(0)


def ensure_ready():
    """App koud starten en voorbij het welkomstscherm brengen, zodat deep links echt op hun route landen."""
    sh('shell', 'am', 'force-stop', PKG)
    sh('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(12)
    tap(540, 1729, 4)


def open_route(path):
    sh('logcat', '-b', 'crash', '-c')
    sh('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'vibezcoreapp://' + path.lstrip('/'), PKG)
    time.sleep(5.5)


def layer2(tier):
    L = f'2 routes/{tier}'
    sh('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS')
    sh('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', f'vibezcoreapp://qa?tier={tier}', PKG)
    time.sleep(8)
    ensure_ready()
    for n, path in enumerate(app_routes()):
        if n and n % 12 == 0:
            ensure_ready()                      # af en toe vers beginnen, zodat de stapel niet ontspoort
        open_route(path)
        st = qa_state()
        if crashed():
            add(L, f'{path}: geen crash', False, 'FATAL EXCEPTION'); ensure_ready(); continue
        if not foreground_is_app():
            add(L, f'{path}: route getest', False, 'opent een andere app (extern) - niet te meten', skip=True); ensure_ready(); continue
        if st is None:
            add(L, f'{path}: scherm meldt zich', False, 'geen [QA]-regel'); continue
        if st.get('path') == '/welcome' and path != '/welcome':
            ensure_ready(); open_route(path); st = qa_state() or st
            if st.get('path') == '/welcome':
                add(L, f'{path}: route bereikt', False, 'landt op /welcome (poort) - ONBEKEND, niet getest', skip=True); continue
        for _try in range(4):                  # wacht tot de positie van de uitweg bekend en plausibel is
            ex_now = [e for e in st.get('exits', []) if re.match(r'^(Back|Close|Cancel|Done|Not now|Maybe later|Minimize|Skip|Got it)', e, re.I)]
            good = [e for e in ex_now if (st.get('xy') or {}).get(e) and (st['xy'][e][1] > 100 or st['xy'][e][0] > 100)]
            if not ex_now or good:
                break
            time.sleep(1.8); st = qa_state() or st
        m = lum()
        exits = [e for e in st.get('exits', []) if re.match(r'^(Back|Close|Cancel|Done|Not now|Maybe later|Minimize|Skip|Got it)', e, re.I)]
        add(L, f'{path}: geen wit scherm', m < 200, f'luminantie={m:.0f}')
        has_exit = bool(exits) or st.get('tabbar') is True
        add(L, f'{path}: heeft een uitweg', has_exit, f'pad={st.get("path")} tabbar={st.get("tabbar")} uitwegen={exits}')
        if exits:
            label = exits[0]; xy = (st.get('xy') or {}).get(label)
            if xy:
                before = st.get('path')
                tap(xy[0], xy[1], 3.0)
                st2 = qa_state() or {}
                changed = (st2.get('path') != before) or (label not in st2.get('exits', []))
                add(L, f'{path}: uitweg "{label}" werkt', changed and not crashed(), f'{before} -> {st2.get("path")}')
            else:
                add(L, f'{path}: uitweg "{label}" werkt', False, 'positie onbekend', skip=True)


def tabs_sweep(tier):
    L = f'2 tabs/{tier}'
    TAB = {'State Control': 108, 'Breath': 324, 'Library': 540, 'Activity': 755, 'Profile': 971}
    sh('shell', 'am', 'force-stop', PKG)
    sh('logcat', '-c'); sh('logcat', '-b', 'crash', '-c')
    sh('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1'); time.sleep(12)
    tap(540, 1729, 4)
    for _ in range(2):
        for name, x in TAB.items():
            s = qa_state() or {}
            for label, xy in (s.get('xy') or {}).items():
                if re.match(r'^(Not now|Maybe later|Minimize|Skip|Got it)', label, re.I):
                    tap(xy[0], xy[1], 2.5)
            if (qa_state() or {}).get('tabbar') is False:   # keuzescherm zonder tabbalk: eerst via zijn uitweg
                s = qa_state() or {}
                for label, xy in (s.get('xy') or {}).items():
                    if re.match(r'^Back', label, re.I):
                        tap(xy[0], xy[1], 3.0); break
            tap(x, 2100, 3.0)
            st = qa_state() or {}
            add(L, f'tab {name}: bereikbaar, geen crash, geen wit scherm', not crashed() and lum() < 200, f'pad={st.get("path")} tabbar={st.get("tabbar")}')


def layer3():
    L = '3 crashveiligheid'
    res = sorted(glob.glob(os.path.join(ROOT, 'scratchpad', 'testlab-run*.log')), key=os.path.getmtime)
    apk = os.path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
    if not res or (os.path.exists(apk) and os.path.getmtime(res[-1]) < os.path.getmtime(apk)):
        add(L, 'Firebase Test Lab (5 toestellen) op DEZE build', False, 'geen run nieuwer dan de build: bash scripts/testlab.sh', skip=True); return
    t = open(res[-1], encoding='utf-8', errors='ignore').read()
    passed = len(re.findall(r'Passed', t)); failed = len(re.findall(r'(Failed|Crashed|Inconclusive)', t))
    add(L, f'Firebase ({os.path.basename(res[-1])})', failed == 0 and passed > 0, f'passed={passed} failed/crashed={failed}')


def report(verdict):
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    with open(REPORT, 'w', encoding='utf-8') as f:
        f.write(f'# QA-rapport {time.strftime("%Y-%m-%d %H:%M")}\n\n**Eindoordeel: {verdict}**\n\n| Laag | Controle | Uitkomst | Detail |\n|---|---|---|---|\n')
        for l, n, r, d in rows:
            f.write(f'| {l} | {n} | {r} | {d.replace("|", "/")} |\n')
    print('\nRapport:', REPORT)


def main():
    layer1()
    if not STATIC_ONLY:
        if not SER:
            print('Geef een adb-serial voor laag 2 (of --static-only).'); sys.exit(2)
        st = None
        sh('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'vibezcoreapp://qa?tier=free', PKG); time.sleep(8)
        st = qa_state()
        if st is None:
            add('2 routes', 'Dit is een QA-build (EXPO_PUBLIC_QA=1)', False, 'geen [QA]-regels in het log')
        else:
            for tier in TIERS:
                tabs_sweep(tier); layer2(tier)
        layer3()
    fails = [r for r in rows if r[2] == 'FAIL']; skips = [r for r in rows if r[2] == 'SKIP']
    verdict = 'KLAAR' if not fails and not skips else 'NIET KLAAR'
    if STATIC_ONLY and not fails:
        verdict = 'LAAG 1 OK - NIET VOLLEDIG GETEST (laag 2-3 niet gedraaid)'
    print(f'\n=== {len(rows) - len(fails) - len(skips)} PASS, {len(fails)} FAIL, {len(skips)} SKIP  ->  {verdict} ===')
    report(verdict)
    sys.exit(0 if verdict == 'KLAAR' else 1)


if __name__ == '__main__':
    main()
