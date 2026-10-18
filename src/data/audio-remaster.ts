/* Audio Library v2 (operator, 18 okt 2026: "Library audio luider, moet
   loepzuiver zijn"). Gemeten met EBU R128 en enkel versterkt of verzwakt —
   geen filter, limiter of compressie, piek blijft onder -1 dBTP:
   - 29 gesproken sessies (96 kbps) stonden op ~-24 LUFS, nu gelijk met de
     rest van de bibliotheek (~-20,7 LUFS), hercodeerd op 192 kbps;
   - 10 soundscapes/muziek stonden veel luider (tot -5,9 LUFS), nu -16 LUFS.
   De nieuwe bestanden staan in de Bunny-map "Audio Library v2" met exact
   dezelfde bestandsnaam. De oude bestanden blijven staan.

   De sessie-URL in audio-library-data.ts blijft de identiteit (favorieten,
   luistergeschiedenis, hervatten zijn eraan gekoppeld); enkel bij het
   afspelen wordt naar de nieuwe map gewezen (audio-url.ts). */
const CDN = 'https://vibezcore-audio.b-cdn.net/';
const V2 = CDN + 'Audio%20Library%20v2/';

const REMASTERED = new Set<string>([
  '02-focus-theta-reverie.mp3.mp3',
  '04-focus-theta-pulse.mp3.mp3',
  '05-focus-theta-heartbeat.mp3.mp3',
  '07-focus-theta-arabic.mp3.m4a',
  '08-sleep-delta-descent.mp3.mp3',
  '10-sleep-delta-drift.mp3.mp3',
  '12-meditation-stillpoint.mp3.mp3',
  '15-meditation-piano.mp3.mp3',
  '17-meditation-background.mp3.mp3',
  '19-ambient-yoga.mp3.mp3',
  'Andrew_Huberman_1._Neural_State_Control_How_to_Direct_Your_Mind_Instead_of_Chasing_It_osg0uy.mp3.mp3',
  'Andrew_Huberman_2._Dopamine_Drive_Why_Motivation_is_a_System_Not_a_Personality_Trait_ba9rjm.mp3.mp3',
  'Andrew_Huberman_3._The_Stress-Performance_Curve_Why_You_Break_Under_Pressure_and_How_to_Bend_Instead_kdiata.mp3.mp3',
  'Andrew_Huberman_4._Sleep_Deep_Restoration_Your_Nervous_System_Can_t_Reset_Without_This_One_Cycle_nj0yjo.mp3.mp3',
  'Andrew_Huberman_5._Emotional_Regulation_Through_Physiology_You_Can_t_Think_Your_Way_Out_of_a_State_mbtumk.mp3.mp3',
  'Beast_Mode_1._Become_a_Monster_Become_the_Force_They_Can_t_Stop_Control_or_Ignore_ul7m0b.mp3.mp3',
  'Beast_Mode_6._The_Rise_Reborn_Through_Fire_oil9nf.mp3.mp3',
  'Daily_Affirmations_1_INNER_STRENGTH_DISCIPLINE_celg5r.mp3.mp3',
  'Evening_affirmations_vgrtnn.mp3.mp3',
  'Jordan_Peterson_1_Responsibility_Where_Your_Life_Quietly_Begins_Again_xfgrby.mp3.mp3',
  'Jordan_Peterson_2._Chaos_vs._Order_Standing_at_the_Edge_of_What_You_Can_Handle_nnhcz1.mp3.mp3',
  'Jordan_Peterson_3._Truth_The_One_Realization_You_Can_t_Run_From_n7zsxw.mp3.mp3',
  'Jordan_Peterson_4._Meaning_Over_Comfort_Why_the_Hard_Path_Is_the_Only_One_Worth_Taking_pzbce9.mp3.mp3',
  'Jordan_Peterson_5._Identity_Becoming_Build_the_Person_You_Wish_You_Already_Were_rjqsmv.mp3.mp3',
  'NAVAL_RAVIKANT_1.Rich_by_Clarity_A_Calm_Mind_Builds_a_Better_Life_y1vjth.mp3.mp3',
  'NAVAL_RAVIKANT_2._Leverage_Over_Labor_Work_Smarter_Multiply_Results_zmzyld.mp3.mp3',
  'NAVAL_RAVIKANT_3._The_Freedom_Formula_Using_Money_to_Buy_Your_Life_Back_saynwv.mp3.mp3',
  'NAVAL_RAVIKANT_4.Strategic_Simplicity_Remove_the_Noise_Reveal_the_Path_lqhbjx.mp3.mp3',
  'NAVAL_RAVIKANT_5.Solitary_Clarity_Why_Alone_Time_Makes_You_Smarter_and_Richer_nsbxia.mp3.mp3',
  'Napoleon_Hill_1._The_Identity_Becoming_Someone_Who_Can_Handle_Success_q6vpbo.mp3.mp3',
  'Napoleon_Hill_2._The_Subconscious_Blueprint_for_Money_and_Opportunity_twrnp6.mp3.mp3',
  'Napoleon_Hill_3._Vision_Into_Reality_The_Inner_Focus_That_Turns_Ideas_Into_Results_cgf7lr.mp3.mp3',
  'Napoleon_Hill_4._Solitude_Success_Why_Quiet_Thinking_Creates_Wealth_exztjk.mp3.mp3',
  'Napoleon_Hill_5._Breaking_Scarcity_Thinking_and_Building_Entrepreneurial_Confidence_nd4dsj.mp3.mp3',
  'The_Journey_to_Success_1._The_Silence_Before_the_Start_Procrastination_Overthinking_qg8fzk.mp3.mp3',
  'The_Journey_to_Success_2._Control_Your_Mind_Control_Your_Life_Overwhelmed_by_Your_Emotions_bxsbuh.mp3.mp3',
  'The_Journey_to_Success_3._Life_Without_Momentum_Chaos_No_Direction_uptngm.mp3.mp3',
  'The_Journey_to_Success_4._The_Battle_Within_Low_Self-Esteem_Self-Sabotage_Fear_of_Growth_p74z13.mp3.mp3',
  'The_Journey_to_Success_5._Success_Without_Fulfillment_When_Achievements_Feel_Empty_o5xhrq.mp3.mp3',
]);

/** Afspeel-URL: de luidere v2-versie als die bestaat, anders ongewijzigd. */
export function playbackAudioUrl(url: string): string {
  if (!url.startsWith(CDN)) return url;
  const path = url.slice(CDN.length);
  if (path.includes('/')) return url;
  return REMASTERED.has(decodeURIComponent(path)) ? V2 + path : url;
}
