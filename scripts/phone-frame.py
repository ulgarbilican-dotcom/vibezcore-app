"""Tekent het telefoonframe (PNG met transparant scherm-gat) voor de websiteclips.
Gebruik: python scripts/phone-frame.py <uit.png> [scherm_breedte] [scherm_hoogte]
Standaard: scherm 468x1040 (verhouding 9:20), bezel 14 px -> canvas 508x1080 incl. marge.
Schrijft ook <uit>.txt met 'canvasB canvasH schermX schermY schermB schermH'."""
import sys
from PIL import Image, ImageDraw

out = sys.argv[1]
sw = int(sys.argv[2]) if len(sys.argv) > 2 else 468
sh = int(sys.argv[3]) if len(sys.argv) > 3 else 1040
bez, margin = 14, 6
cw, ch = sw + 2 * (bez + margin), sh + 2 * (bez + margin)
S = 4  # supersampling voor gladde hoeken
img = Image.new("RGBA", (cw * S, ch * S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
r_out, r_in = 62 * S, 48 * S
ox, oy = margin * S, margin * S
d.rounded_rectangle([ox, oy, (cw - margin) * S - 1, (ch - margin) * S - 1], r_out, fill=(18, 18, 20, 255))
# dunne lichte rand (metalen kader)
d.rounded_rectangle([ox, oy, (cw - margin) * S - 1, (ch - margin) * S - 1], r_out, outline=(70, 72, 78, 255), width=2 * S)
ix, iy = (margin + bez) * S, (margin + bez) * S
hole = Image.new("L", img.size, 0)
ImageDraw.Draw(hole).rounded_rectangle([ix, iy, ix + sw * S - 1, iy + sh * S - 1], r_in, fill=255)
a = img.getchannel("A")
a = Image.composite(Image.new("L", img.size, 0), a, hole)
img.putalpha(a)
img = img.resize((cw, ch), Image.LANCZOS)
img.save(out)
open(out + ".txt", "w").write(f"{cw} {ch} {margin + bez} {margin + bez} {sw} {sh}\n")
print(cw, ch)
