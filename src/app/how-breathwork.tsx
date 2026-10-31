/* "How Breathwork works" (31 okt 2026, operator) — Settings → How Breathwork works. Uitleg met beeld; de onboarding
   (breath-welcome) blijft voor nieuwe gebruikers en is hier niet aangeraakt. Teksten: About sectie 02 waar die er al
   is, de rest nieuw (ter goedkeuring van de operator, zie WERKSTATUS). Zie components/HowItWorks.tsx. */
import HowItWorks, { type HowStep } from '@/components/HowItWorks';

const STEPS: HowStep[] = [
  {
    key: 'what',
    eyebrow: 'GUIDED BREATHWORK',
    /* 31 okt 2026 (operator: "breath is voor inner balance — kijk de website"): kop, zin en kenmerken van vibezcore.com. */
    title: 'Find your balance',
    sub: 'Spoken guidance and haptic cues help you use your breath to find calm, focus, energy or prepare for sleep.',
    chips: ['15 techniques', '5 states', 'Phone', 'Smartwatch'],
    note: 'Smart Bead Bracelet · Launching Early 2027',
    scene: { kind: 'photo', uri: 'https://vibezcore-audio.b-cdn.net/images/pic%20hero%20breathwork%20welcome%203.png', accent: '#FFFFFF' },
  },
  {
    key: 'session',
    eyebrow: 'DURING A SESSION',
    title: 'Follow one breath\nat a time',
    sub: 'The figure grows as you breathe in and settles as you breathe out.',
    /* 31 okt (operator: "geven we alle info door?"): de vijf manieren van begeleiden, zoals op de website. */
    body: 'Choose how you are guided:',
    chips: ['Voice', 'Smartphone Haptics', 'Voice + Haptics', 'Silent Mode', 'Smartwatch'],
    scene: { kind: 'duo', mode: 'breath', accent: '#00A3A3' },
  },
  {
    key: 'states',
    eyebrow: 'FIVE STATES',
    title: 'Choose where\nyou want to go',
    sub: 'Each state has its own techniques and rhythm.',
    /* breath-level.ts: duur + ritme per techniek × ervaring, stijgt met afgewerkte sessies */
    body: 'Length and pace match your experience, and grow as you practise.',
    scene: { kind: 'states', mode: 'breath' },
  },
  {
    key: 'routine',
    eyebrow: 'YOUR ROUTINE',
    title: 'Make it part\nof your day',
    /* 31 okt (operator): zelf een plan maken of door VIBEZCORE laten maken (build-choice.tsx). */
    sub: 'Build your own plan or let VIBEZCORE build it. A reminder tells you when it is time.',
    chips: ['Build it yourself', 'Let VIBEZCORE build it'],
    scene: { kind: 'day', mode: 'breath' },
  },
];

export default function HowBreathworkScreen() {
  return <HowItWorks steps={STEPS} a11yName="How Breathwork works" />;
}
