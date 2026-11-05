#!/usr/bin/env python3
"""Houdt de privé-repo studio-genone bij: scripts, logo's, intro's en geheugen, nooit bestanden met iets dat op een sleutel lijkt.
Gebruik: sync-studio-repo.py <repo> <geheugen> <scratchpad-map> <OneDrive Studio GenOne>"""
import glob
import os
import re
import shutil
import subprocess
import sys

REPO, MEMORY, SCRATCH, STUDIO = sys.argv[1:5]
SECRET = re.compile(r"sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.|BEGIN [A-Z ]*PRIVATE KEY|"
                    r"(api[_-]?key|password|wachtwoord|secret|token)[\"' ]*[:=][\"' ]*[A-Za-z0-9_\-+/]{8,}", re.I)
SCRIPTS = ("studio_*.py", "studio_*.sh", "logo_*.py", "hero_cut.py", "render_step.sh", "night_chain.sh", "make_colab.py", "intro_head.png", "intro_sub.png")
MAX_BYTES = 50 * 1024 * 1024


def safe(path):
    if path.lower().endswith((".py", ".sh", ".md", ".txt")):
        with open(path, encoding="utf-8", errors="replace") as f:
            return not SECRET.search(f.read())
    return os.path.getsize(path) <= MAX_BYTES


def copy(paths, dest):
    os.makedirs(dest, exist_ok=True)
    for path in paths:
        if os.path.isfile(path) and safe(path):
            shutil.copy2(path, dest)
        elif os.path.isfile(path):
            print("overgeslagen:", os.path.basename(path))


for pattern in SCRIPTS:
    for scratch in glob.glob(SCRATCH):
        copy(glob.glob(os.path.join(scratch, pattern)), os.path.join(REPO, "scripts"))
copy(glob.glob(os.path.join(STUDIO, "Logo", "*")), os.path.join(REPO, "logo"))
copy(glob.glob(os.path.join(STUDIO, "Intro animatie", "*.mp4")), os.path.join(REPO, "intro"))
copy(glob.glob(os.path.join(MEMORY, "*.md")), os.path.join(REPO, "geheugen"))


def git(*args):
    return subprocess.run(["git", "-C", REPO, *args], capture_output=True, text=True)


git("add", "-A")
if git("diff", "--cached", "--quiet").returncode != 0:
    git("commit", "-q", "-m", "Automatic sync\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>")
if git("remote").stdout.strip():
    git("push", "-q", "origin", "main")
