#!/usr/bin/env bash
# Handmatige doorloop: walk.sh <prefix> "<x> <y> <wacht>" ...   (x,y in een 405x900 beeld; wordt omgerekend naar het schermformaat)
A=/c/Users/ulgar/AppData/Local/Android/Sdk/platform-tools/adb.exe; E="$A -s emulator-5554"
P=$1; shift; i=0
SZ=$($E shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); W=${SZ%x*}; H=${SZ#*x}
for st in "$@"; do i=$((i+1)); set -- $st
  if [ "$1" != "-" ]; then $E shell input tap $(( $1 * W / 405 )) $(( $2 * H / 900 )); fi
  sleep ${3:-4}; $E exec-out screencap -p > scratchpad/${P}_$(printf %02d $i).png
done
python - "$P" $i <<'PY'
import sys
from PIL import Image
p=sys.argv[1]; n=int(sys.argv[2])
ims=[Image.open(f'scratchpad/{p}_{k:02d}.png').resize((270,600)) for k in range(1,n+1)]
for part in range(0,n,6):
    ch=ims[part:part+6]; w=Image.new('RGB',(270*len(ch),600))
    for k,im in enumerate(ch): w.paste(im,(k*270,0))
    w.save(f'scratchpad/{p}_sheet{part//6+1}.png')
PY
