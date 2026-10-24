"""Vloeiwandeling (docs/KWALITEITSPROTOCOL.md §3): loopt de hoofdroutes van de app af op een aangesloten Android-toestel en
controleert R2 (elk scherm heeft een uitweg) + geen wit scherm. Eén FAIL = niet klaar.

Gebruik: python scripts/flow-walk.py <adb-serial> <free|premium>
Vereist: adb op het PATH (of ADB=pad), Pillow. De app moet geïnstalleerd zijn en op het welkomstscherm of een tab staan.
"""
import os, re, subprocess, sys, time, xml.etree.ElementTree as ET
from PIL import Image
import io

ADB = os.environ.get('ADB', r'C:\Users\ulgar\AppData\Local\Android\Sdk\platform-tools\adb.exe')
SER = sys.argv[1]
MODE = sys.argv[2] if len(sys.argv) > 2 else 'free'
PKG = 'com.ubili.vibezcoreapp'
TABS = ['State Control', 'Breath', 'Library', 'Activity', 'Profile']
EXIT_RE = re.compile(r'^(Back|Close|Cancel|Done|Not now|Not Now|Minimize)\b', re.I)


def adb(*a, out=False):
    r = subprocess.run([ADB, '-s', SER, *a], capture_output=True)
    return r.stdout if out else None


def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/w.xml')
    xml = adb('exec-out', 'cat', '/sdcard/w.xml', out=True).decode('utf-8', 'ignore')
    nodes = []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return nodes
    for n in root.iter('node'):
        b = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', n.get('bounds', ''))
        if not b:
            continue
        x0, y0, x1, y1 = map(int, b.groups())
        nodes.append(dict(text=n.get('text', ''), desc=n.get('content-desc', ''), click=n.get('clickable') == 'true',
                          cx=(x0 + x1) // 2, cy=(y0 + y1) // 2, y0=y0, y1=y1))
    return nodes


def labels(nodes):
    return [x['text'] or x['desc'] for x in nodes]


def find(nodes, pred):
    for n in nodes:
        if pred(n):
            return n


def tap(n):
    adb('shell', 'input', 'tap', str(n['cx']), str(n['cy']))
    time.sleep(2.2)


def shot_mean():
    png = adb('exec-out', 'screencap', '-p', out=True)
    im = Image.open(io.BytesIO(png)).convert('L')
    w, h = im.size
    reg = im.crop((0, int(h * .08), w, int(h * .86))).resize((60, 120))
    return sum(reg.getdata()) / (60 * 120)


def tabbar_visible(nodes):
    L = labels(nodes)
    return all(any(t == l for l in L) for t in TABS)


def exit_node(nodes):
    return find(nodes, lambda n: (n['click'] or n['desc'] or n['text']) and EXIT_RE.match(n['desc'] or n['text'] or ''))


results = []


def check(step, ok, detail=''):
    results.append((step, 'PASS' if ok else 'FAIL', detail))
    print(('PASS' if ok else 'FAIL'), '-', step, detail)


def tab_nodes(nodes):
    # tabbar items (bottom area): texts equal to a tab name, in the lowest third
    return {t: find(nodes, lambda n, t=t: n['text'] == t and n['cy'] > 1900) for t in TABS}


def go_tab(name):
    nodes = dump()
    n = tab_nodes(nodes).get(name)
    if not n:
        return None
    tap(n)
    return dump()


def walk():
    adb('shell', 'am', 'force-stop', PKG)
    adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(12)
    nodes = dump()
    if not tabbar_visible(nodes):  # welcome screen: enter via the first big button
        b = find(nodes, lambda n: n['text'] == 'Control Your State')
        if b:
            tap(b); time.sleep(3); nodes = dump()
    check('app start: tab bar reachable', tabbar_visible(nodes), 'mode=' + MODE)

    for t in TABS:
        nodes = go_tab(t)
        if nodes is None:
            check(f'tab {t}: reachable', False, 'tab bar not found'); continue
        m = shot_mean()
        check(f'tab {t}: no white screen', m < 200, f'mean={m:.0f}')
        # intro/entry buttons that open a picker
        for entry in ('Explore State Control', 'Explore modes', 'Explore Audio Library'):
            n = find(nodes, lambda x, e=entry: x['text'] == e or x['desc'] == e)
            if not n:
                continue
            tap(n); nodes = dump()
            ex = exit_node(nodes)
            check(f'tab {t} -> {entry}: has exit (tab bar or back)', tabbar_visible(nodes) or ex is not None,
                  'tabbar' if tabbar_visible(nodes) else (ex['desc'] or ex['text']) if ex else 'NO EXIT')
            if ex and not tabbar_visible(nodes):
                tap(ex); nodes = dump()
                m2 = shot_mean()
                check(f'tab {t} -> {entry}: exit leaves the screen', tabbar_visible(nodes) or exit_node(nodes) is None,
                      f'tabbar={tabbar_visible(nodes)} mean={m2:.0f}')
            break

    print('\n=== SAMENVATTING (%s) ===' % MODE)
    fails = [r for r in results if r[1] == 'FAIL']
    for s, r, d in results:
        print(f'{r:4}  {s}  {d}')
    print(f'\n{len(results) - len(fails)} PASS, {len(fails)} FAIL')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    walk()
