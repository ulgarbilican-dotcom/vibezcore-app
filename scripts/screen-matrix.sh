#!/usr/bin/env bash
# Legt alle schermen vast op meerdere formaten en navigatiemodi (emulator).
# Gebruik: bash scripts/screen-matrix.sh   -> scratchpad/matrix/<formaat>_<nav>/<route>.png + contact sheets
A=/c/Users/ulgar/AppData/Local/Android/Sdk/platform-tools/adb.exe
E="$A -s emulator-5554"
PKG=com.ubili.vibezcoreapp
OUT=scratchpad/matrix
ROUTES="breath bracelet account activity settings agenda subscribe faq about history heart-rate build-choice routine-intro plan-review plan-success?confirmed=1 feel-now goal intensity plan plan-summary state-onboarding build-your-day bracelet-set-day bracelet-agenda bracelet-history bracelet-protocol activate-bracelet forgot-password change-password"
SIZES="720x1280:320 1080x2400:420 1290x2796:460"
for NAV in gestural threebutton; do
  if [ $NAV = threebutton ]; then
    $E shell cmd overlay enable com.android.internal.systemui.navbar.threebutton; $E shell cmd overlay disable com.android.internal.systemui.navbar.gestural
  else
    $E shell cmd overlay enable com.android.internal.systemui.navbar.gestural; $E shell cmd overlay disable com.android.internal.systemui.navbar.threebutton
  fi
  for S in $SIZES; do
    SZ=${S%%:*}; DN=${S##*:}
    $E shell wm size $SZ; $E shell wm density $DN
    D=$OUT/${SZ}_$NAV; mkdir -p $D
    $E shell am force-stop $PKG
    for R in $ROUTES; do
      $E shell am start -a android.intent.action.VIEW -d "vibezcoreapp:///$R" >/dev/null 2>&1
      sleep 5
      $E exec-out screencap -p > "$D/$(echo $R | tr '/?=&' '____').png"
    done
    python - "$D" <<'PY'
import sys,glob
from PIL import Image
d=sys.argv[1]; fs=sorted(glob.glob(d+'/*.png')); fs=[f for f in fs if 'sheet' not in f]
ims=[Image.open(f).convert('RGB') for f in fs]; w=300; h=int(w*ims[0].size[1]/ims[0].size[0])
cols=9
for part in range(0,len(ims),cols):
    chunk=ims[part:part+cols]; sheet=Image.new('RGB',(w*len(chunk),h))
    for i,im in enumerate(chunk): sheet.paste(im.resize((w,h)),(i*w,0))
    sheet.save(f'{d}/sheet_{part//cols+1}.png')
PY
  done
done
$E shell wm size reset; $E shell wm density reset
$E shell cmd overlay enable com.android.internal.systemui.navbar.gestural; $E shell cmd overlay disable com.android.internal.systemui.navbar.threebutton
