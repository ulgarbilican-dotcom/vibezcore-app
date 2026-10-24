"""Genereert assets/confirm-ping.wav: een korte, heldere "glass ping" van twee stijgende zuivere tonen
(A5 -> E6, een zuivere kwint omhoog), vrijwel zonder boventonen, met een heel lichte, donkere plaat-galm.
24 okt 2026 (operator: "pinggeluid moet een professionele ping zijn"). Zelf gegenereerd, geen licentie.
Ontwerpkeuzes (zoals de systeemgeluiden van betaal-bevestigingen):
  - kort: ~0,9 s, geen echo-herhalingen (de vorige versie had een hoorbare echo van 190 ms);
  - zuivere sinus + één zachte octaaf-boventoon, en een korte "glinster" (inharmonisch deel, 8 ms) alleen in de
    aanslag, zodat het niet dof klinkt maar ook niet schel;
  - aanslag 3 ms (helder, niet klikkerig), uitsterven tau 170 ms;
  - galm: kort (260 ms), donker (laagdoorlaat) en zacht (nat 14%), geen losse echo;
  - piek -10 dBFS, 44,1 kHz mono 16-bit.
Gebruik: python scripts/gen-confirm-ping.py"""
import numpy as np, wave

SR = 44100
rng = np.random.default_rng(7)


def note(f, dur, tau, level=1.0):
    t = np.arange(int(SR * dur)) / SR
    body = np.sin(2 * np.pi * f * t) + 0.12 * np.sin(2 * np.pi * 2 * f * t)
    # korte inharmonische "glinster" in de aanslag
    spark = 0.10 * np.sin(2 * np.pi * f * 2.756 * t) * np.exp(-t / 0.008)
    env = np.minimum(t / 0.003, 1.0) * np.exp(-t / tau)
    return level * (body * env + spark)


total = int(SR * 1.2)
dry = np.zeros(total)


def add(sig, at):
    i = int(SR * at)
    dry[i:i + len(sig)] += sig[: total - i]


add(note(880.00, 0.8, 0.170), 0.00)        # A5
add(note(1318.51, 0.9, 0.190, 0.85), 0.085)  # E6, net daarna

# korte, donkere plaat-galm
n = int(SR * 0.26)
t = np.arange(n) / SR
ir = rng.standard_normal(n) * np.exp(-t / 0.075)
# eenvoudige laagdoorlaat (bewegend gemiddelde) voor een donkere staart
k = 9
ir = np.convolve(ir, np.ones(k) / k, mode="same")
ir[0] = 0
ir /= np.max(np.abs(ir))
wet = np.convolve(dry, ir)[:total]
wet *= (0.14 * np.max(np.abs(dry))) / (np.max(np.abs(wet)) + 1e-9)
y = dry + wet

y[-int(SR * 0.06):] *= np.linspace(1, 0, int(SR * 0.06))  # uitloop tegen kraakje
y = y / np.max(np.abs(y)) * 10 ** (-10 / 20)               # piek -10 dBFS

with wave.open("assets/confirm-ping.wav", "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((y * 32767).astype(np.int16).tobytes())
print("ok", round(total / SR, 2), "s, peak dBFS", round(20 * np.log10(np.max(np.abs(y))), 1))
