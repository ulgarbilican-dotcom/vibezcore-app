/* "How State Control works" (31 okt 2026, operator) — Settings → How State Control works. Uitleg met beeld; de
   onboarding (state-onboarding) blijft voor nieuwe gebruikers en is hier niet aangeraakt. Teksten: About sectie 02
   waar die er al is, de lijn per toestand uit de onboarding (FEEL_LINE), de rest nieuw (ter goedkeuring van de
   operator, zie WERKSTATUS). Zie components/HowItWorks.tsx. */
import HowItWorks, { type HowStep } from '@/components/HowItWorks';

const STEPS: HowStep[] = [
  {
    key: 'what',
    eyebrow: 'STATE CONTROL',
    /* 31 okt 2026 (operator): kop, zin en kenmerken van vibezcore.com (duur 5–50 min volgens de huidige modustabel,
       de website zegt nog 8–50). */
    title: 'Shift your state',
    sub: 'Research-based haptic pulses help guide you toward calm, focus, energy or sleep.',
    chips: ['5–50 min', 'Phone', 'Smartwatch'],
    note: 'Smart Bead Bracelet · Launching Early 2027',
    scene: { kind: 'photo', uri: 'https://vibezcore-audio.b-cdn.net/images/Pic%20hero%20state%20control%20app%20.png', accent: '#B478FF' },
  },
  {
    key: 'feel',
    eyebrow: 'HOW IT WORKS',
    title: 'Body first.\nMind follows',
    sub: 'A steady heartbeat rhythm you feel, not follow.',
    /* 31 okt: wat je doet en voelt (zonder het hartslagverhaal te herhalen — dat staat op de volgende pagina). */
    body: 'Pick a state and a duration, press start. Your phone or smartwatch does the rest.',
    scene: { kind: 'duo', mode: 'state', accent: '#F5A524' },
  },
  {
    /* 31 okt 2026 (operator: "ik mis het heartrateverhaal"): eigen pagina. Woorden uit Science A tot Z §3.4 en de
       hartslag-keuzes van de onboarding (Measure now / Enter it yourself / Use an average, bpm-pil vóór een sessie). */
    key: 'heart',
    eyebrow: 'YOUR HEART RATE',
    title: 'Tuned to\nyour own heart',
    /* Feitelijk (bracelet-haptics: 10 s op de rusthartslag, dan rampSec geleidelijk naar het eindtempo). Operator 31 okt:
       nooit "tempo of your state" (dubbelzinnig: gevoel ≠ gekozen toestand) en nooit "je hartslag daalt naar X bpm". */
    sub: 'The rhythm starts at your own measured heart rate, then shifts to the tempo of the state you picked.',
    /* operator 31 okt: "hoe measuren?" + smartwatch-lezen niet meer van toepassing → enkel camera (PulseMeter) of zelf invullen */
    body: 'Fingertip on the back camera for 20 seconds. Best in the morning, before you get up. Stressed? Measure right before a session.',
    chips: ['Measure · 20 s', 'Enter it yourself'],
    scene: { kind: 'heart' },
  },
  {
    key: 'states',
    eyebrow: 'FIVE STATES',
    title: 'Five states,\nfive tempos',
    sub: 'From Sleep, the slowest, to Boost, the fastest.',
    body: 'Tap a state to feel its rhythm.',
    scene: { kind: 'states', mode: 'state' },
  },
  {
    key: 'yourway',
    eyebrow: 'YOUR WAY',
    title: 'Phone, smartwatch\nor both',
    sub: 'Feel it on your phone or hand it to your smartwatch. Heartbeat sound optional.',
    body: 'Plan your day. Get a reminder when it is time.',
    scene: { kind: 'day', mode: 'state' },
  },
];

export default function HowStateControlScreen() {
  return <HowItWorks steps={STEPS} a11yName="How State Control works" />;
}
