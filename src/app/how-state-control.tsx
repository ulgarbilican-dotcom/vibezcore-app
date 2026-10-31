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
    body: 'Nothing to follow, nothing to watch: you simply feel it.',
    chips: ['5–50 min', 'Phone', 'Smartwatch'],
    note: 'Smart Bead Bracelet · Launching Early 2027',
    scene: { kind: 'photo', uri: 'https://vibezcore-audio.b-cdn.net/images/Pic%20hero%20state%20control%20app%20.png', accent: '#B478FF' },
  },
  {
    key: 'feel',
    eyebrow: 'HOW IT WORKS',
    title: 'Body first.\nMind follows',
    sub: 'Your body influences your mind, and this rhythm works from the body up.',
    body: 'It starts at your resting heart rate, then glides to the tempo of your state. Built on research, bottom-up by design.',
    scene: { kind: 'duo', mode: 'state', accent: '#F5A524' },
  },
  {
    key: 'states',
    eyebrow: 'FIVE STATES',
    title: 'Five states,\nfive tempos',
    sub: 'Each state has its own tempo, set against your own heart rate.',
    body: 'Tap a state to feel its rhythm.',
    scene: { kind: 'states', mode: 'state' },
  },
  {
    key: 'yourway',
    eyebrow: 'YOUR WAY',
    title: 'Phone, smartwatch\nor both',
    sub: 'Feel it on your phone or let your smartwatch take over. Add the heartbeat sound, or keep it to touch alone.',
    body: 'Plan your day and get a reminder when it is time.',
    note: 'Smart Bead Bracelet · Launching Early 2027',
    scene: { kind: 'day', mode: 'state' },
  },
];

export default function HowStateControlScreen() {
  return <HowItWorks steps={STEPS} a11yName="How State Control works" />;
}
