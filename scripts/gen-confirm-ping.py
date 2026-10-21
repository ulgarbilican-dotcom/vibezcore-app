"""Genereert assets/confirm-ping.wav: twee zachte, stijgende tonen (G4 -> D5), warm en kort, met een lichte echo.
Zelf gegenereerd, geen licentie. Gebruik: python scripts/gen-confirm-ping.py"""
import numpy as np, wave
SR = 44100
def tone(f, dur, tau, amps=(1.0, 0.22, 0.06)):
    t = np.arange(int(SR * dur)) / SR
    x = sum(a * np.sin(2 * np.pi * f * (i + 1) * t) for i, a in enumerate(amps))
    env = np.minimum(t / 0.012, 1.0) * np.exp(-t / tau)   # 12 ms zachte inzet
    return x * env
total = int(SR * 1.5)
y = np.zeros(total)
def add(sig, at):
    i = int(SR * at); y[i:i + len(sig)] += sig[:total - i]
add(tone(392.0, 1.1, 0.26), 0.0)          # G4
add(tone(587.33, 1.2, 0.30) * 0.9, 0.16)  # D5, iets later
# lichte echo voor ruimte
echo = np.zeros(total); d = int(SR * 0.19); echo[d:] = y[:-d] * 0.28
y = y + echo
y[-int(SR * 0.05):] *= np.linspace(1, 0, int(SR * 0.05))   # uitloop tegen kraakje
y = y / np.max(np.abs(y)) * 10 ** (-9 / 20)                # piek -9 dBFS
with wave.open('assets/confirm-ping.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype(np.int16).tobytes())
print('ok', total / SR, 's')
