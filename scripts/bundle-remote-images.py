"""VIBEZCORE — alle foto's van de CDN in de app zelf (20 okt 2026, operator:
"alle fotos komen van het internet, kan je dat voor alles doen?").

Zoekt elke afbeeldings-URL in src/ (ook `${CDN}/…`), downloadt ze, zet ze om
naar WebP (max 1080 px breed, doorzichtigheid blijft) in assets/images/cdn/
en schrijft src/constants/bundled-images.ts (URL → require). Opnieuw draaien
na nieuwe foto's: python scripts/bundle-remote-images.py
"""
import io, os, re, hashlib, urllib.request, urllib.parse
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'assets', 'images', 'cdn')
MAP = os.path.join(SRC, 'constants', 'bundled-images.ts')
CDN = 'https://vibezcore-audio.b-cdn.net/images'
URL_RE = re.compile(r"https://vibezcore-audio\.b-cdn\.net/[^'\"`\s)]+?\.(?:png|jpe?g|webp)", re.I)
TPL_RE = re.compile(r"\$\{CDN\}/([^'\"`\s)]+?\.(?:png|jpe?g|webp))", re.I)

urls = set()
for d, _, files in os.walk(SRC):
    for f in files:
        if not f.endswith(('.ts', '.tsx')) or f == 'bundled-images.ts':
            continue
        t = open(os.path.join(d, f), encoding='utf-8').read()
        urls.update(URL_RE.findall(t))
        if "const CDN = 'https://vibezcore-audio.b-cdn.net/images'" in t:
            urls.update(f'{CDN}/{p}' for p in TPL_RE.findall(t))

os.makedirs(OUT, exist_ok=True)
entries, total = [], 0
for u in sorted(urls):
    name = urllib.parse.unquote(u.rsplit('/', 1)[1])
    slug = re.sub(r'[^a-z0-9]+', '-', os.path.splitext(name)[0].lower()).strip('-')
    slug = f"{slug}-{hashlib.sha1(u.encode()).hexdigest()[:6]}"
    path = os.path.join(OUT, slug + '.webp')
    if not os.path.exists(path):
        try:
            data = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'vibezcore-bundler'}), timeout=60).read()
        except Exception as e:
            print('SKIP', u, e); continue
        im = Image.open(io.BytesIO(data))
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        if im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] == 255:
            im = im.convert('RGB')
        if im.width > 1080:
            im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
        im.save(path, 'WEBP', quality=82, method=6)
    total += os.path.getsize(path)
    entries.append((u, slug))

with open(MAP, 'w', encoding='utf-8', newline='\n') as f:
    f.write('/* GEGENEREERD door scripts/bundle-remote-images.py — niet met de hand\n'
            '   bewerken. Elke CDN-foto zit ook in de app (assets/images/cdn), zodat\n'
            '   schermen meteen tonen, ook offline en bij de allereerste start\n'
            '   (operator, 20 okt 2026). */\n\n'
            '/* eslint-disable @typescript-eslint/no-require-imports */\n'
            'export const BUNDLED_IMAGES: Record<string, number> = {\n')
    for u, slug in entries:
        f.write(f"  '{u}': require('../../assets/images/cdn/{slug}.webp'),\n")
    f.write('};\n')
print(len(entries), 'foto\'s,', round(total / 1024 / 1024, 1), 'MB')
