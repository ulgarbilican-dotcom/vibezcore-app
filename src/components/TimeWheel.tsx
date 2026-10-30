/* Tijdwiel — gedeeld door elke tijdkiezer in de app (Breathwork-instelscherm, plan opbouwen, agenda's, State
   Control-planner).

   30 okt 2026 (operator: "2 verschillende scrollwielen?"): het tijdwiel had een eigen look (twee lijntjes, gekleurde
   tekst) naast het duurwiel (gevulde pil, rijen die naar de rand vervagen en kleiner worden, zoals Apple's
   UIPickerView). Nu IS het tijdwiel dat duurwiel, met tijden als labels — één wiel, één gevoel, overal. De oudere
   toelichtingen over het Android-scrollgedrag staan nu in components/DurationWheel.tsx, dat die fixes al had
   (startpositie bij het monteren, vastleggen na de uitloop, het blad dat de beweging niet mag afpakken). */
import { useMemo } from 'react';
import GestureWheel, { GESTURE_WHEEL_ITEM_H } from '@/components/GestureWheel';

export const WHEEL_ITEM_H = GESTURE_WHEEL_ITEM_H;
export const WHEEL_VISIBLE = 3;
export const WHEEL_H = WHEEL_ITEM_H * WHEEL_VISIBLE;

const timeLabel = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function TimeWheel({
  options,
  value,
  onChange,
  accent,
  trackColor: _trackColor,
  blocked = [],
  rows = WHEEL_VISIBLE,
  small = false,
}: {
  options: number[];
  value: number;
  onChange: (mins: number) => void;
  accent: string;
  trackColor: string;
  /** Reeds bezette tijdsblokken (van andere sessies) — die opties tonen zich als "Taken". */
  blocked?: { reminderAt: number; minutes: number }[];
  /** Hoeveel tijden tegelijk zichtbaar (oneven): 3 standaard, 5 in het hoge tijd-blad van de agenda's. */
  rows?: number;
  /** Iets kleinere cijfers. */
  small?: boolean;
}) {
  const items = useMemo(
    () =>
      options.map((mins) => {
        const taken = blocked.some((b) => mins >= b.reminderAt && mins < b.reminderAt + b.minutes);
        return { value: mins, label: taken ? `${timeLabel(mins)} · Taken` : timeLabel(mins) };
      }),
    [options, blocked],
  );
  return (
    /* 30 okt 2026: eigen Gesture Handler-wiel (components/GestureWheel.tsx) — het ScrollView-wiel bevroor in bladen
       bij een rustige vinger. */
    <GestureWheel
      options={items}
      value={value}
      onChange={onChange}
      accent={accent}
      rows={rows}
      fontSize={blocked.length > 0 ? 17 : small ? 22 : 24}
      /* Hele dag (00:00–23:55) = rondlopend; een dagdeel stopt aan zijn grenzen. */
      loop={options.length > 0 && options[0] === 0 && options[options.length - 1] >= 1435}
    />
  );
}
