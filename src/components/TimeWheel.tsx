/* Tijdwiel (snap-scroller) — gedeeld door het Breathwork-instelscherm en de State Control-planner,
   zodat elke tijdkiezer in de app dezelfde stijl en hetzelfde gedrag heeft (22 okt 2026, operator).
   Uit breath-setup.tsx gehaald; de toelichting daar over het Android-gedrag staat in de code hieronder. */
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandFonts } from '@/constants/theme';
import { hapticTap } from '@/utils/haptics';

export const WHEEL_ITEM_H = 44;
export const WHEEL_VISIBLE = 3;
export const WHEEL_H = WHEEL_ITEM_H * WHEEL_VISIBLE;

export default function TimeWheel({
  options,
  value,
  onChange,
  accent,
  trackColor,
  blocked = [],
}: {
  options: number[];
  value: number;
  onChange: (mins: number) => void;
  accent: string;
  trackColor: string;
  /** Reeds bezette tijdsblokken (van andere sessies) — die opties tonen
   *  zich als "Taken" i.p.v. een gewone tijd. Zie call-site. */
  blocked?: { reminderAt: number; minutes: number }[];
}) {
  const listRef = useRef<ScrollView>(null);
  const settledIndex = Math.max(0, options.indexOf(value));

  /* Bij het openen meteen (zonder animatie) naar de huidige waarde
     springen. */
  useEffect(() => {
    listRef.current?.scrollTo({ y: settledIndex * WHEEL_ITEM_H, animated: false });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  /* Operator, 18 september 2026 ("check ook tijd scrollen want blijft
     regelmatig hangen"): gevonden — de sync hieronder vuurde OOK af na de
     wiel se EIGEN commit (`commit()` verderop roept `onChange` aan, wat
     `value` bijwerkt, wat deze `useEffect` opnieuw triggert), en stuurde
     dan een TWEEDE, overbodige `scrollTo` naar exact dezelfde positie
     terwijl Android's eigen fling-animatie nog aan het uitlopen was — die
     botsing tussen twee gelijktijdige scroll-animaties voelde aan als
     "hangen"/haperen. `internalChange` onderscheidt "dit kwam van mezelf"
     (negeren, `commit()` scrollde daar al naartoe) van "dit kwam van
     BUITEN" (digitale invoer/AM-PM-knoppen — die moeten wél syncen). */
  const internalChange = useRef(false);
  const skipFirstValueSync = useRef(true);
  /* Traag loslaten zonder vaart (iPhone, 18 okt 2026): geen momentum-einde,
     dus geen commit — pas vastleggen als er na het loslaten geen uitloop
     start (NIET meteen bij loslaten: dat doodde op Android de uitloop). */
  const dragEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (dragEndTimer.current) clearTimeout(dragEndTimer.current);
  }, []);
  useEffect(() => {
    if (skipFirstValueSync.current) {
      skipFirstValueSync.current = false;
      return;
    }
    if (internalChange.current) {
      internalChange.current = false;
      return;
    }
    listRef.current?.scrollTo({ y: settledIndex * WHEEL_ITEM_H, animated: true });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [value]);

  const commit = (offsetY: number) => {
    const idx = Math.min(options.length - 1, Math.max(0, Math.round(offsetY / WHEEL_ITEM_H)));
    listRef.current?.scrollTo({ y: idx * WHEEL_ITEM_H, animated: true });
    if (options[idx] !== value) {
      hapticTap();
      internalChange.current = true;
      onChange(options[idx]);
    }
  };
  /* Operator, 18 september 2026 ("scroll voor tijd blokkeert"): de echte
     oorzaak was niet de ontbrekende hoogte hierboven (die klopte al) —
     `onScrollEndDrag` vuurt af op het MOMENT dat de vinger loslaat, VÓÓR
     Android's eigen traagheids-scroll ("momentum") ook maar begonnen is.
     Op dat moment stond de offset nog bijna exact waar 'm al was, dus
     `commit()` rondde af naar diezelfde index en `scrollTo` sprong meteen
     terug — dat KILDE de eigenlijke momentum-scroll voor hij kon
     doorlopen, wat aanvoelde als "blokkeert/scrollt niet". Enkel
     `onMomentumScrollEnd` (ná de traagheids-scroll, met de ECHTE
     eindpositie) hoort dit te bevestigen. */

  return (
    <View style={[ws.wheelWrap, { height: WHEEL_H }]}>
      <View style={[ws.wheelWindow, { borderColor: `${accent}55` }]} pointerEvents="none" />
      <ScrollView
        ref={listRef}
        /* Operator, 18 september 2026 ("time scrollt niet"): zonder een
           EIGEN `style`-hoogte op de ScrollView zelf krijgt hij op Android
           geen begrensde viewport mee (het `height` op `wheelWrap` hierboven
           is de OUDER, niet de ScrollView) — hij groeide dus gewoon mee met
           alle opties (geen clip, dus ook niets om IN te scrollen). Expliciet
           dezelfde `WHEEL_H` als viewport-hoogte. */
        style={{ height: WHEEL_H }}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H }}
        onScrollEndDrag={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          if (dragEndTimer.current) clearTimeout(dragEndTimer.current);
          dragEndTimer.current = setTimeout(() => {
            dragEndTimer.current = null;
            commit(y);
          }, 150);
        }}
        onMomentumScrollBegin={() => {
          if (dragEndTimer.current) clearTimeout(dragEndTimer.current);
          dragEndTimer.current = null;
        }}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
      >
        {options.map((mins) => {
          const d = new Date();
          d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
          const label = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const on = mins === value;
          /* Operator, 18 september 2026 ("blokkeren gekozen tijd ook
             ineens bouwen"): deze optie valt binnen een BESTAANDE
             sessie's [start, start+duur) — toon 'm als "Taken" i.p.v.
             een gewone selecteerbare tijd, zodat je het al op het wiel
             zelf ziet i.p.v. pas achteraf via de overlap-melding. */
          const isBlocked = blocked.some(
            (b) => mins >= b.reminderAt && mins < b.reminderAt + b.minutes,
          );
          return (
            <View key={mins} style={[ws.wheelRow, { height: WHEEL_ITEM_H }]}>
              <Text
                style={[
                  ws.wheelTxt,
                  { color: on ? accent : trackColor },
                  on && ws.wheelTxtOn,
                  isBlocked && ws.wheelTxtBlocked,
                ]}
              >
                {label}
                {isBlocked ? ' · Taken' : ''}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const ws = StyleSheet.create({
  wheelWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  wheelWindow: {
    position: 'absolute',
    left: 40,
    right: 40,
    top: WHEEL_ITEM_H,
    height: WHEEL_ITEM_H,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRadius: 10,
  },
  wheelRow: { alignItems: 'center', justifyContent: 'center' },
  wheelTxt: { fontFamily: BrandFonts.semibold, fontSize: 16 },
  wheelTxtOn: { fontFamily: BrandFonts.extrabold, fontSize: 20 },
  wheelTxtBlocked: { fontStyle: 'italic', textDecorationLine: 'line-through', opacity: 0.55 },
});
