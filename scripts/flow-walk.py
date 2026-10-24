"""Vloeiwandeling (docs/KWALITEITSPROTOCOL.md §3). Stuurt de app aan via vaste tikcoördinaten (1080x2340) en leest wat de app
ZELF meldt in testmodus (logcat, regels "[QA] {...}": scherm, tabbalk zichtbaar, aanwezige uitwegen). Geen schermuitlezing
(uiautomator werkt niet met doorlopende animaties).

Controleert per toestand (Free en Premium, DEZELFDE build):
  R2   elk keuzescherm heeft een uitweg (tabbalk of Back/Close/...) en de uitweg werkt;
  R2b  de uitweg landt op een verwacht tabblad, niet ergens anders.
Eén FAIL = niet klaar. Vereist een build met EXPO_PUBLIC_QA=1.

Gebruik: python scripts/flow-walk.py <adb-serial> <free|premium>
"""
import json, os, re, subprocess, sys, time

ADB = os.environ.get('ADB', r'C:\Users\ulgar\AppData\Local\Android\Sdk\platform-tools\adb.exe')
SER, TIER = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else 'free')
PKG = 'com.ubili.vibezcoreapp'
TAB = {'State Control': (108, 2100), 'Breath': (324, 2100), 'Library': (540, 2100), 'Activity': (755, 2100), 'Profile': (971, 2100)}
EXPLORE = (540, 1726)
BACK = {'Breath': (102, 135), 'State Control': (85, 132)}
HOME_PATHS = ('/', '/index', '/(tabs)')
PATH = {'Breath': '/breath', 'State Control': '/bracelet', 'Library': '/'}
results = []


def sh(*a):
    return subprocess.run([ADB, '-s', SER, *a], capture_output=True)


def tap(xy, wait=2.5):
    sh('shell', 'input', 'tap', str(xy[0]), str(xy[1]))
    time.sleep(wait)


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
    return last


DISMISS = re.compile(r'^(Not now|Maybe later|Minimize|Skip|Got it)', re.I)


def tap_exit(pattern, wait=3.0):
    s = state() or {}
    for label, xy in (s.get('xy') or {}).items():
        if re.match(pattern, label, re.I):
            tap(tuple(xy), wait)
            return label
    return None


def dismiss_overlays():
    """Eerste-gebruik-schermen, verkoopkaarten en een lopende sessie wegtikken via hun echte positie (uit de app zelf)."""
    for _ in range(6):
        s = state() or {}
        hit = None
        for label, xy in (s.get('xy') or {}).items():
            if DISMISS.match(label):
                hit = (label, xy); break
        if not hit:
            return
        print('   (overlay gesloten:', hit[0], ')')
        tap(tuple(hit[1]), 3.0)


def check(name, ok, detail):
    results.append((name, ok, detail))
    print(('PASS' if ok else 'FAIL'), '-', name, '|', detail)


def at_tab(s, tab):
    return bool(s) and s.get('path') in ((PATH[tab],) if tab != 'Library' else HOME_PATHS)


def picker_flow(tab):
    """Free: tab -> intro -> Explore -> keuzescherm -> uitweg -> terug op DEZELFDE tab (intro).
       Premium: tab opent direct op het keuzescherm -> uitweg -> verlaat de tab naar het hoofdtabblad (Library)."""
    dismiss_overlays()
    tap(TAB[tab], 3.5)
    dismiss_overlays()
    s = state()
    if TIER == 'free':
        check(f'{tab}: tab opens with the tab bar', bool(s) and s.get('tabbar') is True and at_tab(s, tab), str(s))
        tap(EXPLORE, 4.5)
        dismiss_overlays()
    s = state()
    ok = bool(s) and (s.get('tabbar') is True or len(s.get('exits', [])) > 0) and at_tab(s, tab)
    check(f'{tab} picker: has an exit (tab bar or back)', ok, str(s))
    if not (s and s.get('exits')):
        return
    used = tap_exit(r'^Back', 3.5)
    s = state()
    if not used:
        check(f'{tab} picker: a Back exit exists', False, str(s)); return
    if TIER == 'free':
        check(f'{tab} picker: back lands on the same tab', at_tab(s, tab) and s.get('tabbar') is True, str(s))
    else:
        check(f'{tab} picker (Premium): back leaves the tab to the home tab',
              bool(s) and s.get('path') in HOME_PATHS and s.get('tabbar') is True, str(s))


def main():
    sh('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS')
    sh('shell', 'am', 'force-stop', PKG)
    sh('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', f'vibezcoreapp://qa?tier={TIER}', PKG)
    time.sleep(9)
    sh('shell', 'am', 'force-stop', PKG)
    sh('logcat', '-c')
    sh('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(12)
    tap((540, 1729), 4)            # welcome -> "Control Your State"
    dismiss_overlays()
    s = state()
    check('QA probe is running (build has EXPO_PUBLIC_QA=1)', s is not None, str(s))
    if s is None:
        print('\nGeen [QA]-regels in het log: dit is geen testbuild. Gestopt.')
        sys.exit(2)
    for tab in ('Breath', 'State Control'):
        picker_flow(tab)
    print('\n=== SAMENVATTING (%s) ===' % TIER)
    fails = [r for r in results if not r[1]]
    for n, ok, d in results:
        print('PASS' if ok else 'FAIL', ' ', n)
    print(f'\n{len(results) - len(fails)} PASS, {len(fails)} FAIL')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
