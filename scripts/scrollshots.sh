#!/usr/bin/env bash
# scrollshots.sh <prefix> <n>: n schermafbeeldingen terwijl er telkens een scherm omlaag gescrold wordt
A=/c/Users/ulgar/AppData/Local/Android/Sdk/platform-tools/adb.exe; E="$A -s emulator-5554"
P=$1; N=${2:-4}
SZ=$($E shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); W=${SZ%x*}; H=${SZ#*x}
for i in $(seq 1 $N); do $E exec-out screencap -p > scratchpad/${P}_$(printf %02d $i).png; $E shell input swipe $((W/2)) $((H*72/100)) $((W/2)) $((H*28/100)) 400; sleep 2; done
python - "$P" $N <<'PY'
import sys
from PIL import Image
p=sys.argv[1]; n=int(sys.argv[2])
ims=[Image.open(f'scratchpad/{p}_{k:02d}.png').resize((270,600)) for k in range(1,n+1)]
for part in range(0,n,6):
    ch=ims[part:part+6]; w=Image.new('RGB',(270*len(ch),600))
    for k,im in enumerate(ch): w.paste(im,(k*270,0))
    w.save(f'scratchpad/{p}_sheet{part//6+1}.png')
PY
