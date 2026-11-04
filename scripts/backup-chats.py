#!/usr/bin/env python3
"""Claude-chats als leesbare tekst naar OneDrive: afbeeldingen eruit, want die maken een chat tot >1 GB.
Gebruik: backup-chats.py <map met .jsonl> <doelmap>. Slaat chats over die de laatste 30 min al gekopieerd zijn."""
import glob
import json
import os
import sys
import time

SRC, DST = sys.argv[1], sys.argv[2]
MIN_AGE = 30 * 60


def strip(node):
    """Vervangt ingesloten afbeeldingen en bestanden door een korte markering."""
    if isinstance(node, dict):
        if node.get("type") == "base64" or (node.get("type") in ("image", "document") and isinstance(node.get("source"), dict)):
            return {"type": "weggelaten", "origineel": node.get("type")}
        return {k: "[weggelaten]" if k in ("base64", "signature") or (k == "data" and isinstance(v, str) and len(v) > 4000) else strip(v) for k, v in node.items()}
    if isinstance(node, list):
        return [strip(v) for v in node]
    return node


os.makedirs(DST, exist_ok=True)
# De hook start dit na elke beurt; een lopende kopie niet nog eens starten. Een slot ouder dan 3 uur is van een afgebroken run.
LOCK = os.path.join(DST, ".bezig")
if os.path.exists(LOCK) and time.time() - os.path.getmtime(LOCK) < 3 * 3600:
    sys.exit(0)
open(LOCK, "w").close()
for path in glob.glob(os.path.join(SRC, "*.jsonl")):
    out = os.path.join(DST, os.path.basename(path))
    if os.path.exists(out):
        newer = os.path.getmtime(out) >= os.path.getmtime(path)
        recent = time.time() - os.path.getmtime(out) < MIN_AGE
        if newer or recent:
            continue
    tmp = out + ".tmp"
    with open(path, encoding="utf-8", errors="replace") as fin, open(tmp, "w", encoding="utf-8", errors="replace") as fout:
        for line in fin:
            try:
                fout.write(json.dumps(strip(json.loads(line)), ensure_ascii=False) + "\n")
            except ValueError:
                continue
    os.replace(tmp, out)
    open(LOCK, "w").close()
os.remove(LOCK)
