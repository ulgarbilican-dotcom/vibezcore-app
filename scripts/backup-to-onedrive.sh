#!/usr/bin/env bash
# VIBEZCORE — automatische back-up na elke Claude Code-beurt (Stop-hook).
# Operator, 9 okt 2026: "heel belangrijk dat je alle werk onmiddellijk
# updatet en veiligstelt".
#   1. Commits die nog niet op GitHub staan → git push (enkel pushen, nooit
#      zelf committen: half werk wordt niet ongevraagd vastgelegd).
#   2. Wat niet in git hoort → kopie naar OneDrive\Documenten\VIBEZCORE-archief:
#      Claude-geheugen, privé-docs (OPERATOR_HANDOVER e.a.), .env-bestanden.
# Stil en foutbestendig: een mislukte stap blokkeert Claude nooit.

set -u
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIEF="$HOME/OneDrive/Documenten/VIBEZCORE-archief"
SLUG="$(printf '%s' "$PROJECT" | sed -E 's#^/([a-zA-Z])/#\U\1--#; s#/#-#g')"
MEMORY="$HOME/.claude/projects/$SLUG/memory"

cd "$PROJECT" || exit 0

# 1. Push als er lokale commits zijn die nog niet op GitHub staan.
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
  ahead="$(git rev-list --count "origin/$branch..HEAD" 2>/dev/null || echo 1)"
  if [ "${ahead:-0}" != "0" ]; then
    git push -q origin "$branch" >/dev/null 2>&1 || true
  fi
fi

# 2. Kopieën naar OneDrive (enkel als OneDrive er is).
[ -d "$HOME/OneDrive" ] || exit 0
mkdir -p "$ARCHIEF/claude-geheugen" "$ARCHIEF/prive-docs" "$ARCHIEF/env" 2>/dev/null
[ -d "$MEMORY" ] && cp -rf "$MEMORY/." "$ARCHIEF/claude-geheugen/" 2>/dev/null
for f in docs/OPERATOR_HANDOVER.md docs/VIBEZCORE_STRATEGY.html; do
  [ -f "$f" ] && cp -f "$f" "$ARCHIEF/prive-docs/" 2>/dev/null
done
cp -f docs/handover-word/*.docx "$ARCHIEF/prive-docs/" 2>/dev/null
for f in .env.bunny .env.test; do
  [ -f "$f" ] && cp -f "$f" "$ARCHIEF/env/" 2>/dev/null
done
exit 0
