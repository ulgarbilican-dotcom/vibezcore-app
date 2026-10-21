#!/usr/bin/env bash
# Tweede ronde: tikken, stappen, popups, scrollen. Zelfde combinaties als screen-matrix.sh.
# Elementen worden gezocht via uiautomator (tekst/omschrijving), niet via vaste coördinaten.
A=/c/Users/ulgar/AppData/Local/Android/Sdk/platform-tools/adb.exe
E="$A -s emulator-5554"
PKG=com.ubili.vibezcoreapp
OUT=scratchpad/flows
SIZES="${SIZES:-640x1136:320 720x1280:320 1080x2400:420 1290x2796:460}"
NAVS="${NAVS:-gestural threebutton}"
FONTS="${FONTS:-1.0 1.3}"

tap_text() { # tikt het eerste element waarvan tekst/omschrijving $1 bevat
  $E shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1
  $E exec-out cat /sdcard/u.xml > scratchpad/_u.xml
  python - "$1" <<'PY'
import sys,re,subprocess
q=sys.argv[1].lower()
x=open('scratchpad/_u.xml',encoding='utf-8',errors='ignore').read()
best=None
for m in re.finditer(r'<node[^>]*?(?:text="([^"]*)")[^>]*?content-desc="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',x):
    t,d,x1,y1,x2,y2=m.groups()
    if q in (t or '').lower() or q in (d or '').lower():
        best=((int(x1)+int(x2))//2,(int(y1)+int(y2))//2); break
print(best[0],best[1]) if best else print('')
PY
}
tap() { c=$(tap_text "$1"); if [ -n "$c" ]; then $E shell input tap $c; return 0; else echo "NIET GEVONDEN: $1" >> $OUT/missing.log; return 1; fi; }
shot() { $E exec-out screencap -p > "$D/$1.png"; }
scroll_shots() { # $1 = naam, maakt tot 4 opnames terwijl er gescrold wordt
  for i in 1 2 3 4; do shot "$1_scroll$i"; H=$($E shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | cut -dx -f2); W=$($E shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | cut -dx -f1)
    $E shell input swipe $((W/2)) $((H*70/100)) $((W/2)) $((H*25/100)) 350; sleep 1.5; done
}
open() { $E shell am start -a android.intent.action.VIEW -d "vibezcoreapp:///$1" >/dev/null 2>&1; sleep ${2:-6}; }

mkdir -p $OUT; : > $OUT/missing.log
for NAV in $NAVS; do
  for O in gestural threebutton twobutton; do $E shell cmd overlay disable com.android.internal.systemui.navbar.$O; done
  $E shell cmd overlay enable com.android.internal.systemui.navbar.$NAV
  for F in $FONTS; do
    $E shell settings put system font_scale $F
    for S in $SIZES; do
      SZ=${S%%:*}; DN=${S##*:}
      $E shell wm size $SZ; $E shell wm density $DN
      D=$OUT/${SZ}_${NAV}_font$F; mkdir -p $D
      $E shell pm clear $PKG >/dev/null
      # Breath: welkom, kiezer met 5 toestanden, instelscherm, sessie
      open breath 30; shot breath_intro
      tap "Explore modes"; sleep 5; shot breath_picker_default
      for n in 1 2 3 4 5; do :; done
      tap "Set "; sleep 5; shot breath_setup; scroll_shots breath_setup
      tap "Start"; sleep 8; shot breath_session; $E shell input keyevent KEYCODE_BACK; sleep 2
      # State Control: intro, onboarding, hoofdscherm, preview, pauze
      open bracelet 12; shot sc_intro
      tap "Explore State Control"; sleep 5; shot sc_onb1
      for st in 2 3 4; do tap "Next"; sleep 4; shot sc_onb$st; done
      open bracelet 8; shot sc_main; tap "Start"; sleep 6; shot sc_preview; tap "Pause"; sleep 2; shot sc_preview_paused
      # Lange schermen: scrollen
      for R in settings faq about account activity subscribe agenda history; do open $R 6; scroll_shots $R; done
      # Library
      open "" 8; shot library_intro; tap "Explore Audio Library"; sleep 5; scroll_shots library
      # Paywall als onderblad
      open subscribe 6; shot paywall
    done
  done
done
$E shell settings put system font_scale 1.0; $E shell wm size reset; $E shell wm density reset
for O in gestural threebutton twobutton; do $E shell cmd overlay disable com.android.internal.systemui.navbar.$O; done
$E shell cmd overlay enable com.android.internal.systemui.navbar.gestural
