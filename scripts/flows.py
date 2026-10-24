"""Gebruikersreizen per onderdeel (docs/KWALITEITSPROTOCOL.md §3, laag 2b). Elke flow = vaste stappen met een VERWACHT RESULTAAT per stap,
gelezen uit wat de app zelf meldt (logcat "[QA] {...}": pad, tabbalk, benoemde knoppen + positie, en per onderdeel een vlag zoals
sc = {view, mode, min, paused}). Een flow slaagt alleen als elke stap zijn verwachte resultaat geeft.

Gebruik: python scripts/flows.py <adb-serial> <free|premium> [onderdeel]      (onderdeel: statecontrol)
"""
import json, os, re, subprocess, sys, time

ADB = os.environ.get('ADB', r'C:\Users\ulgar\AppData\Local\Android\Sdk\platform-tools\adb.exe')
SER, TIER = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3] if len(sys.argv) > 3 else None
PKG = 'com.ubili.vibezcoreapp'
results = []


def sh(*a):
    return subprocess.run([ADB, '-s', SER, *a], capture_output=True)


def state():
    out = sh('logcat', '-d', '-s', 'ReactNativeJS:V').stdout.decode('utf-8', 'ignore')
    last = None
    for line in out.splitlines():
        m = re.search(r'\[QA\] (\{.*\})', line)
        if m:
            try:
                last = json.loads(m.group(1))
            except ValueError:
                pass
    return last or {}


def wait(pred, timeout=9.0):
    end = time.time() + timeout
    s = state()
    while time.time() < end:
        s = state()
        try:
            if pred(s):
                return True, s
        except Exception:                                                      # noqa
            pass
        time.sleep(0.7)
    return False, s


def find_target(s, pattern):
    for label, xy in (s.get('xy') or {}).items():
        if re.search(pattern, label, re.I):
            return label, xy
    return None, None


def tap_xy(x, y, wait_s=1.5):
    sh('shell', 'input', 'tap', str(x), str(y)); time.sleep(wait_s)


def tap(pattern, timeout=9.0):
    """Tikt de eerste knop waarvan de naam bij het patroon past (positie komt uit de app zelf)."""
    end = time.time() + timeout
    while time.time() < end:
        s = state()
        label, xy = find_target(s, pattern)
        if xy:
            tap_xy(xy[0], xy[1], 1.6)
            return label
        time.sleep(0.7)
    return None


def step(flow, desc, ok, detail=''):
    results.append((flow, desc, ok, detail))
    print(('PASS' if ok else 'FAIL'), '-', flow, '|', desc, ('| ' + detail) if (detail and not ok) else '')
    return ok


def act_expect(flow, desc, action, pred, timeout=9.0, **kw):
    """Voer één actie uit en eis daarna het verwachte resultaat."""
    what = action() if callable(action) else action
    ok, s = wait(pred, timeout)
    return step(flow, desc + (f' [{what}]' if isinstance(what, str) else ''), ok, json.dumps({k: s.get(k) for k in ('path', 'tabbar', 'sc', 'exits')}, ensure_ascii=False)[:240])


# ───────────────────────── voorbereiding ─────────────────────────
def prepare():
    sh('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS')
    sh('shell', 'am', 'force-stop', PKG)
    sh('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', f'vibezcoreapp://qa?tier={TIER}', PKG); time.sleep(8)
    sh('shell', 'am', 'force-stop', PKG); sh('logcat', '-c')
    sh('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1'); time.sleep(12)
    tap_xy(540, 1729, 4)                                       # welkom -> "Control Your State"
    clear_overlays(); end_any_session()


def clear_overlays():
    for _ in range(6):
        s = state(); label, xy = find_target(s, r'^(Not now|Maybe later|Got it|Skip)')
        if not xy:
            return
        tap_xy(xy[0], xy[1], 2.0)


def end_any_session():
    """Een eerdere (gepauzeerde) sessie opruimen, zodat elke flow schoon begint."""
    for _ in range(3):
        s = state(); label, xy = find_target(s, r'^Return to your .* session')
        if not xy:
            return
        tap_xy(xy[0], xy[1], 2.5)
        if tap(r'^End session', 6):
            time.sleep(1.5); tap(r'^(End session|End|Yes)', 4)
        time.sleep(2)


TABS = {'State Control': (108, 2100), 'Breath': (324, 2100), 'Library': (540, 2100), 'Activity': (755, 2100), 'Profile': (971, 2100)}
MODES = [('Boost', 0, 10), ('Sharp Focus', 1, 15), ('Calm Control', 2, 18), ('Clarity & Relax', 3, 25), ('Sleep', 4, 30)]


def modes_flow(flow):
    for name, idx, mins in MODES:
        act_expect(flow, f'toestand {name}: gekozen + standaardduur {mins} min',
                   lambda n=name: tap(rf'^Select {re.escape(n)} mode'),
                   lambda s, i=idx, m=mins: (s.get('sc') or {}).get('mode') == i and (s.get('sc') or {}).get('min') == m)


# ───────────────────────── State Control ─────────────────────────
def statecontrol_free():
    F = 'SC/free'
    act_expect(F, 'tab opent met tabbalk (intro)', lambda: tap_xy(*TABS['State Control'], 3.5), lambda s: s.get('path') == '/bracelet' and s.get('tabbar') is True)
    act_expect(F, 'Explore -> keuzescherm zonder tabbalk, met Back', lambda: tap_xy(540, 1726, 4.5),
               lambda s: (s.get('sc') or {}).get('view') == 'picker' and s.get('tabbar') is False and any(e.startswith('Back') for e in s.get('exits', [])))
    modes_flow(F)
    act_expect(F, 'preview-knop opent het voorproef-blad (niet meteen een sessie)', lambda: tap(r'^Start a 30-second preview'),
               lambda s: any(re.match(r'^(Cancel|Close|Done|Not now)', e) for e in s.get('exits', [])) or (s.get('sc') or {}).get('view') == 'preview')
    clear_overlays()
    act_expect(F, 'voorproef-blad sluiten -> terug op het keuzescherm', lambda: tap(r'^(Cancel|Close|Done|Not now)'),
               lambda s: (s.get('sc') or {}).get('view') == 'picker' and not (s.get('sc') or {}).get('running'))
    act_expect(F, 'Back -> terug op het intro van de tab (tabbalk zichtbaar)', lambda: tap(r'^Back'),
               lambda s: s.get('path') == '/bracelet' and s.get('tabbar') is True)


def statecontrol_premium():
    F = 'SC/premium'
    act_expect(F, 'tab opent direct op het keuzescherm (geen intro), met Back', lambda: tap_xy(*TABS['State Control'], 4.5),
               lambda s: (s.get('sc') or {}).get('view') == 'picker' and any(e.startswith('Back') for e in s.get('exits', [])))
    modes_flow(F)
    act_expect(F, 'sessie starten -> sessiescherm (loopt)', lambda: tap(r'^Start .* session$'),
               lambda s: (s.get('sc') or {}).get('view') == 'session' and (s.get('sc') or {}).get('paused') is False, timeout=14)
    act_expect(F, 'pauzeren -> gepauzeerd', lambda: tap(r'^Pause session'), lambda s: (s.get('sc') or {}).get('paused') is True)
    act_expect(F, 'hervatten -> loopt weer', lambda: tap(r'^Resume session'), lambda s: (s.get('sc') or {}).get('paused') is False)
    act_expect(F, 'minimaliseren -> keuzescherm met sessie-pil', lambda: tap(r'^Minimize'),
               lambda s: (s.get('sc') or {}).get('view') == 'picker' and find_target(s, r'^Return to your .* session')[1] is not None)
    act_expect(F, 'pil aantikken -> sessie weer open', lambda: tap(r'^Return to your .* session'),
               lambda s: (s.get('sc') or {}).get('view') in ('session', 'session-open'))
    act_expect(F, 'sessie stoppen -> geen pil meer, keuzescherm', lambda: (tap(r'^End session'), time.sleep(1.5), tap(r'^(End session|End|Yes)', 5))[0] or 'end',
               lambda s: (s.get('sc') or {}).get('view') == 'picker' and find_target(s, r'^Return to your .* session')[1] is None, timeout=12)
    act_expect(F, 'Back -> verlaat de tab naar het hoofdtabblad met tabbalk', lambda: tap(r'^Back'),
               lambda s: s.get('path') in ('/', '/index') and s.get('tabbar') is True)


FLOWS = {'statecontrol': {'free': statecontrol_free, 'premium': statecontrol_premium}}


def main():
    prepare()
    for name, per in FLOWS.items():
        if ONLY and ONLY != name:
            continue
        per[TIER]()
    fails = [r for r in results if not r[2]]
    print(f'\n=== FLOWS ({TIER}): {len(results) - len(fails)} PASS, {len(fails)} FAIL ===')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
