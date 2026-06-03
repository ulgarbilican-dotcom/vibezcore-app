/* VIBEZCORE — Audio bibliotheek data. Exact uit index_2_correct.html, niets verzonnen.
   83 sessies, 12 series. Soundscapes heeft 4 subcategorieën
   (SUBCAT_INFO) met EIGEN foto's — sessies daarin via session.subseries.

   Iter 9dq v59 (2026-06-03, operator-besluit): nieuw access-tier-model.
   Naast `free` (legacy) bestaat nu `accessTier` (optioneel) met drie waarden:
     - 'public'  : iedereen, geen account vereist
     - 'account' : ingelogd account vereist, geen sub
     - 'pro'     : actieve audio-PRO subscription vereist
   Wanneer `accessTier` ontbreekt valt utils/access-tier.ts terug op regels
   gebaseerd op `free` + `series` (zie getEffectiveTier). Bestaande data
   blijft werken zonder per-rij wijziging.

   Bij content-update vult de operator `accessTier` per nieuwe sessie in. */

export type AccessTier = 'public' | 'account' | 'pro';
export type Session = {
  title: string;
  series: string;
  subseries: string;
  free: boolean;
  desc: string;
  num: string;
  url: string;
  added: string;
  /** Operator-besluit voor toegangsniveau. Wanneer afwezig, val terug op de
   *  fallback in utils/access-tier.ts (op basis van `free` + `series`). */
  accessTier?: AccessTier;
};
export type Series = { name:string; sessions:Session[] };

export const SERIES_ORDER: string[] = ['Master Mental Clarity', 'Beast Mode', 'The Inner Blueprint', 'Daily Affirmations Power', 'Meaning Over Comfort', 'Journey to Success', 'Life After Betrayal', 'Identity & Wealth', 'The Freedom Formula', 'The Stoic Fortress', 'End Fight-Or-Flight', 'Soundscapes'];

export const SESSIONS: Session[] = [
  { title:'Neural State Control', series:'Master Mental Clarity', subseries:'', free:true, desc:'Learn how to direct your mind instead of chasing it.', num:'01', url:'https://vibezcore-audio.b-cdn.net/Andrew_Huberman_1._Neural_State_Control_How_to_Direct_Your_Mind_Instead_of_Chasing_It_osg0uy.mp3.mp3', added:'2026-05-06' },
  { title:'Become a Monster', series:'Beast Mode', subseries:'', free:true, desc:"Become the force they can't stop, control or ignore.", num:'02', url:'https://vibezcore-audio.b-cdn.net/Beast_Mode_1._Become_a_Monster_Become_the_Force_They_Can_t_Stop_Control_or_Ignore_ul7m0b.mp3.mp3', added:'2026-05-04' },
  { title:'The Inner Child', series:'The Inner Blueprint', subseries:'', free:true, desc:'The younger self that still influences you today.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_4_THE_INNER_CHILD_xqtgt4.mp3.mp3', added:'' },
  { title:'Building Inner Strength & Discipline', series:'Daily Affirmations Power', subseries:'', free:true, desc:'Daily training for mental toughness and self-control.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_1_INNER_STRENGTH_DISCIPLINE_celg5r.mp3.mp3', added:'' },
  { title:'Responsibility', series:'Meaning Over Comfort', subseries:'', free:true, desc:'Where change begins — with ownership of your life.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_1_Responsibility_Where_Your_Life_Quietly_Begins_Again_xfgrby.mp3.mp3', added:'' },
  { title:'The Silence Before the Start', series:'Journey to Success', subseries:'', free:true, desc:'Escaping delay, overthinking and endless analysis.', num:'06', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_1._The_Silence_Before_the_Start_Procrastination_Overthinking_qg8fzk.mp3.mp3', added:'' },
  { title:'The Break After Betrayal', series:'Life After Betrayal', subseries:'', free:true, desc:'When trust collapses — how to survive the first impact.', num:'07', url:'https://vibezcore-audio.b-cdn.net/Life_After_Betrayal_1._The_break_After_Betrayal_When_Trust_Collapses_tdhzpq.mp3.mp3', added:'' },
  { title:'Identity', series:'Identity & Wealth', subseries:'', free:true, desc:'Becoming the person that success requires you to be.', num:'08', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_1._The_Identity_Becoming_Someone_Who_Can_Handle_Success_q6vpbo.mp3.mp3', added:'' },
  { title:'Rich by Clarity', series:'The Freedom Formula', subseries:'', free:true, desc:'Clarity is the real foundation of wealth and happiness.', num:'09', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_1.Rich_by_Clarity_A_Calm_Mind_Builds_a_Better_Life_y1vjth.mp3.mp3', added:'2026-05-01' },
  { title:'Epictetus — Dichotomy of Control', series:'The Stoic Fortress', subseries:'', free:true, desc:'Control what you can. Release everything else.', num:'10', url:'https://vibezcore-audio.b-cdn.net/The_Stoic_Mind_Series_1._Dichotomy_of_Control_Epictetus_Focus_only_on_what_you_control_n2wsrk.mp3.mp3', added:'' },
  { title:'Emotional Overload', series:'End Fight-Or-Flight', subseries:'', free:true, desc:'When the body responds before the mind catches up.', num:'11', url:'https://vibezcore-audio.b-cdn.net/Walter_Cannon_1.Emotional_Overload_Why_Your_Body_Reacts_Before_You_Understand_mafmnw.mp3.mp3', added:'' },
  { title:'Theta Arabic Ritual', series:'Soundscapes', subseries:'Calm Clarity', free:true, desc:'Focus meditation, Arabic ambience.', num:'12', url:'https://vibezcore-audio.b-cdn.net/07-focus-theta-arabic.mp3.m4a', added:'' },
  { title:'Delta Descent', series:'Soundscapes', subseries:'Rest & Reset', free:true, desc:'Drift into deep, restorative sleep.', num:'13', url:'https://vibezcore-audio.b-cdn.net/08-sleep-delta-descent.mp3.mp3', added:'' },
  { title:'Background Calm', series:'Soundscapes', subseries:'Zen Flow', free:true, desc:'Ambient sound for work and reading.', num:'14', url:'https://vibezcore-audio.b-cdn.net/17-meditation-background.mp3.mp3', added:'' },
  { title:'Dopamine & Drive', series:'Master Mental Clarity', subseries:'', free:false, desc:'Stop blaming your personality. Your motivation is a system.', num:'02', url:'https://vibezcore-audio.b-cdn.net/Andrew_Huberman_2._Dopamine_Drive_Why_Motivation_is_a_System_Not_a_Personality_Trait_ba9rjm.mp3.mp3', added:'' },
  { title:'The Stress-Performance Curve', series:'Master Mental Clarity', subseries:'', free:false, desc:'You don\'t break under pressure. You mismanage it.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Andrew_Huberman_3._The_Stress-Performance_Curve_Why_You_Break_Under_Pressure_and_How_to_Bend_Instead_kdiata.mp3.mp3', added:'' },
  { title:'Sleep & Deep Restoration', series:'Master Mental Clarity', subseries:'', free:false, desc:'No deep cycle, no real recovery.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Andrew_Huberman_4._Sleep_Deep_Restoration_Your_Nervous_System_Can_t_Reset_Without_This_One_Cycle_nj0yjo.mp3.mp3', added:'' },
  { title:'Emotional Regulation Through Physiology', series:'Master Mental Clarity', subseries:'', free:false, desc:'You can\'t think your way out of a state.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Andrew_Huberman_5._Emotional_Regulation_Through_Physiology_You_Can_t_Think_Your_Way_Out_of_a_State_mbtumk.mp3.mp3', added:'' },
  { title:'The Warrior\'s Mind', series:'Beast Mode', subseries:'', free:false, desc:'Discipline is a weapon. Use it or stay weak.', num:'02', url:'https://vibezcore-audio.b-cdn.net/Beast_Mode_2._The_Warrior_s_Mind_Discipline_as_a_Weapon_iwaqkm.mp3.mp3', added:'' },
  { title:'No More Excuses', series:'Beast Mode', subseries:'', free:false, desc:'Stop outsourcing responsibility for your results.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Beast_Mode_3._No_More_Excuses_Radical_Ownership_r3vefx.mp3.mp3', added:'' },
  { title:'It\'s Hard', series:'Beast Mode', subseries:'', free:false, desc:'But staying weak is harder.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Beast_Mode_4._It_s_Hard_But_Staying_Weak_Is_Harder_kju5ij.mp3.mp3', added:'' },
  { title:'Broken', series:'Beast Mode', subseries:'', free:false, desc:'You must break before you are built.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Beast_Mode_5._Broken_-_You_must_break_before_you_are_buil_t8j5ky.mp3.mp3', added:'' },
  { title:'The Rise', series:'Beast Mode', subseries:'', free:false, desc:'Reborn through fire.', num:'06', url:'https://vibezcore-audio.b-cdn.net/Beast_Mode_6._The_Rise_Reborn_Through_Fire_oil9nf.mp3.mp3', added:'' },
  { title:'The Journey to the Self', series:'The Inner Blueprint', subseries:'', free:false, desc:'You can\'t change what you refuse to see.', num:'01', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_1_The_Journey_to_the_Self_satfq8.mp3.mp3', added:'' },
  { title:'The Persona', series:'The Inner Blueprint', subseries:'', free:false, desc:'The mask you wear to meet the world.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_3_The_persona_uvp1k5.mp3.mp3', added:'' },
  { title:'The Shadow', series:'The Inner Blueprint', subseries:'', free:false, desc:'The hidden parts of yourself that shape your life.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_2._The_Shadow_pxbfoh.mp3.mp3', added:'' },
  { title:'Archetypes', series:'The Inner Blueprint', subseries:'', free:false, desc:'The inner patterns shaping your reactions.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_5_ARCHETYPES_-_Why_you_react_the_way_you_do_unconscious_roles_at_work._wjdvef.mp3.mp3', added:'' },
  { title:'The Collective Unconscious', series:'The Inner Blueprint', subseries:'', free:false, desc:'The universal psychic layer shared by all humans.', num:'06', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_6_THE_COLLECTIVE_UNCONSCIOUS_eoi4wg.mp3.mp3', added:'' },
  { title:'Anima & Animus', series:'The Inner Blueprint', subseries:'', free:false, desc:'The inner counterparts influencing how you connect.', num:'07', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_7_ANIMA_ANIMUS_czincw.mp3.mp3', added:'' },
  { title:'Dreams & Symbols', series:'The Inner Blueprint', subseries:'', free:false, desc:'The symbolic language of the unconscious.', num:'08', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_8_Dreams_Symbols_gfnaws.mp3.mp3', added:'' },
  { title:'Individuation', series:'The Inner Blueprint', subseries:'', free:false, desc:'The process of becoming your whole, authentic self.', num:'09', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_9_INDIVIDUATION_hodydp.mp3.mp3', added:'' },
  { title:'The Inner Sage', series:'The Inner Blueprint', subseries:'', free:false, desc:'The deeper knowing that guides your inner direction.', num:'10', url:'https://vibezcore-audio.b-cdn.net/Carl_Jung_10_THE_INNER_SAGE_r7wuat.mp3.mp3', added:'' },
  { title:'Before You Begin', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Understand how affirmations truly work before you start.', num:'01', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_0_Before_You_Begin_How_Affirmations_Truly_Work_dagkcs.mp3.mp3', added:'' },
  { title:'Betrayal, Hurt & Rebuilding', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Reclaiming yourself after being deeply hurt.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_2_BETRAYAL_HURT_REBUILDING_aayygk.mp3.mp3', added:'' },
  { title:'Confidence, Self-Worth & Identity', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Stand firm in who you are regardless of what others think.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_3_CONFIDENCE_SELF-WORTH_IDENTITY_za6bqc.mp3.mp3', added:'' },
  { title:'Success, Motivation & Relentless Drive', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Wire your mind for consistent forward momentum.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_4_SUCCESS_MOTIVATION_RELENTLESS_DRIVE_nr6uaa.mp3.mp3', added:'' },
  { title:'Peace, Presence & Letting Go', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Release tension and return to a grounded state.', num:'06', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_5_PEACE_PRESENCE_LETTING_GO_ymqayc.mp3.mp3', added:'' },
  { title:'The Power of Visualisation', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Use your mind to shape what becomes real.', num:'07', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_6_THE_POWER_OF_VISUALISATION_IN_MANIFESTATION_cgcbm6.mp3.mp3', added:'' },
  { title:'Morning Affirmations', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Start each day with clarity, direction and strength.', num:'08', url:'https://vibezcore-audio.b-cdn.net/Morning_affirmations_hbvf4w.mp3.mp3', added:'' },
  { title:'Evening Affirmations', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Close the day with calm, gratitude and reset.', num:'09', url:'https://vibezcore-audio.b-cdn.net/Evening_affirmations_vgrtnn.mp3.mp3', added:'' },
  { title:'Control Your Mind, Control Your Life', series:'Meaning Over Comfort', subseries:'', free:false, desc:'Mastering emotional instability to stay on track.', num:'02', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_2._Chaos_vs._Order_Standing_at_the_Edge_of_What_You_Can_Handle_nnhcz1.mp3.mp3', added:'' },
  { title:'Truth', series:'Meaning Over Comfort', subseries:'', free:false, desc:'The reality you must face before you can move forward.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_3._Truth_The_One_Realization_You_Can_t_Run_From_n7zsxw.mp3.mp3', added:'' },
  { title:'Meaning Over Comfort', series:'Meaning Over Comfort', subseries:'', free:false, desc:'Why the hard path is the only one worth taking.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_4._Meaning_Over_Comfort_Why_the_Hard_Path_Is_the_Only_One_Worth_Taking_pzbce9.mp3.mp3', added:'' },
  { title:'Identity & Becoming', series:'Meaning Over Comfort', subseries:'', free:false, desc:'Becoming the person you are meant to be.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_5._Identity_Becoming_Build_the_Person_You_Wish_You_Already_Were_rjqsmv.mp3.mp3', added:'' },
  { title:'Control Your Mind, Control Your Life', series:'Journey to Success', subseries:'', free:false, desc:'Mastering emotional instability to stay on track.', num:'02', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_2._Control_Your_Mind_Control_Your_Life_Overwhelmed_by_Your_Emotions_bxsbuh.mp3.mp3', added:'' },
  { title:'Life Without Momentum', series:'Journey to Success', subseries:'', free:false, desc:'Breaking the invisible cycle of stagnation.', num:'03', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_3._Life_Without_Momentum_Chaos_No_Direction_uptngm.mp3.mp3', added:'' },
  { title:'The Battle Within', series:'Journey to Success', subseries:'', free:false, desc:'Confronting self-doubt and self-sabotage head on.', num:'04', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_4._The_Battle_Within_Low_Self-Esteem_Self-Sabotage_Fear_of_Growth_p74z13.mp3.mp3', added:'' },
  { title:'Success Without Fulfillment', series:'Journey to Success', subseries:'', free:false, desc:'When you achieve everything but still feel empty.', num:'05', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_5._Success_Without_Fulfillment_When_Achievements_Feel_Empty_o5xhrq.mp3.mp3', added:'' },
  { title:'The Collapse of Loyalty', series:'Life After Betrayal', subseries:'', free:false, desc:'Processing betrayal by friends, family and colleagues.', num:'02', url:'https://vibezcore-audio.b-cdn.net/Life_After_Betrayal_2._The_Collapse_of_Loyalty_Betrayal_by_Friends_Family_Colleagues_w1opim.mp3.mp3', added:'' },
  { title:'The Wounded Self-Image', series:'Life After Betrayal', subseries:'', free:false, desc:'When your self-worth collapses after betrayal.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Life_After_Betrayal_3._The_Wounded_Self-Image_When_Your_Worth_Feels_Broken_qbwil2.mp3.mp3', added:'' },
  { title:'The Fear of What Comes Next', series:'Life After Betrayal', subseries:'', free:false, desc:'The grip of fear, control and distrust after betrayal.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Life_After_Betrayal_4._The_Fear_of_What_Comes_Next_Hypervigilance_Control_Distrust_udruu2.mp3.mp3', added:'' },
  { title:'Rebuilding the Heart', series:'Life After Betrayal', subseries:'', free:false, desc:'From survival mode to strength and real connection.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Life_After_Betrayal_5._Rebuilding_the_Heart_From_Survival_to_Strength_Connection_cdowbj.mp3.mp3', added:'' },
  { title:'The Subconscious Blueprint', series:'Identity & Wealth', subseries:'', free:false, desc:'Programming your mind for wealth and opportunity.', num:'02', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_2._The_Subconscious_Blueprint_for_Money_and_Opportunity_twrnp6.mp3.mp3', added:'' },
  { title:'Vision Into Reality', series:'Identity & Wealth', subseries:'', free:false, desc:'The inner focus that turns ideas into real results.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_3._Vision_Into_Reality_The_Inner_Focus_That_Turns_Ideas_Into_Results_cgf7lr.mp3.mp3', added:'' },
  { title:'Solitude & Success', series:'Identity & Wealth', subseries:'', free:false, desc:'Where focused thinking builds real wealth.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_4._Solitude_Success_Why_Quiet_Thinking_Creates_Wealth_exztjk.mp3.mp3', added:'' },
  { title:'Breaking Scarcity', series:'Identity & Wealth', subseries:'', free:false, desc:'Building the mindset of expansion and confidence.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_5._Breaking_Scarcity_Thinking_and_Building_Entrepreneurial_Confidence_nd4dsj.mp3.mp3', added:'' },
  { title:'Leverage Over Labor', series:'The Freedom Formula', subseries:'', free:false, desc:'Work smarter. Build systems that multiply your results.', num:'02', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_2._Leverage_Over_Labor_Work_Smarter_Multiply_Results_zmzyld.mp3.mp3', added:'' },
  { title:'The Freedom Formula', series:'The Freedom Formula', subseries:'', free:false, desc:'Turning accumulated wealth into genuine personal freedom.', num:'03', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_3._The_Freedom_Formula_Using_Money_to_Buy_Your_Life_Back_saynwv.mp3.mp3', added:'' },
  { title:'Strategic Simplicity', series:'The Freedom Formula', subseries:'', free:false, desc:'Remove the noise and reveal the clearest path forward.', num:'04', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_4.Strategic_Simplicity_Remove_the_Noise_Reveal_the_Path_lqhbjx.mp3.mp3', added:'' },
  { title:'Solitary Clarity', series:'The Freedom Formula', subseries:'', free:false, desc:'Solitude increases clarity and sharpens long-term thinking.', num:'05', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_5.Solitary_Clarity_Why_Alone_Time_Makes_You_Smarter_and_Richer_nsbxia.mp3.mp3', added:'' },
  { title:'Marcus Aurelius — Strength Within', series:'The Stoic Fortress', subseries:'', free:false, desc:'Building inner strength regardless of circumstance.', num:'02', url:'https://vibezcore-audio.b-cdn.net/The_Stoic_Mind_Series_2._Marcus_Aurelius_The_Inner_Fortress_qdttva.mp3.mp3', added:'' },
  { title:'Marcus Aurelius — Memento Mori', series:'The Stoic Fortress', subseries:'', free:false, desc:'Live with full clarity and urgency before it is too late.', num:'03', url:'https://vibezcore-audio.b-cdn.net/The_Stoic_Mind_Series_3._Marcus_Aurelius_-_Memento_Mori_Live_With_Clarity_Urgency_yfbzdb.mp3.mp3', added:'' },
  { title:'Seneca — When Loyalty Breaks', series:'The Stoic Fortress', subseries:'', free:false, desc:'How to stand firm when those around you fall short.', num:'04', url:'https://vibezcore-audio.b-cdn.net/The_Stoic_Mind_Series_4._Seneca_-_When_Loyalty_Breaks_rw9m8i.mp3.mp3', added:'' },
  { title:'Seneca — The Ultimate Revenge', series:'The Stoic Fortress', subseries:'', free:false, desc:'The most powerful response to those who wronged you.', num:'05', url:'https://vibezcore-audio.b-cdn.net/The_Stoic_Mind_Series_5._Seneca_-The_Ultimate_Revenge_vcep2f.mp3.mp3', added:'' },
  { title:'Homeostasis', series:'End Fight-Or-Flight', subseries:'', free:false, desc:'Why your body reacts before you even understand why.', num:'02', url:'https://vibezcore-audio.b-cdn.net/Walter_Cannon_2.Homeostasis_How_Stability_Gives_You_Your_Life_Back_c38agv.mp3.mp3', added:'' },
  { title:'Chronic Activation', series:'End Fight-Or-Flight', subseries:'', free:false, desc:'When fight-or-flight becomes your identity.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Walter_Cannon_inspired_3.Chronic_Activation_When_Fight-or-Flight_Becomes_Your_Identity_sijefq.mp3.mp3', added:'' },
  { title:'Regaining Autonomy', series:'End Fight-Or-Flight', subseries:'', free:false, desc:'Train your nervous system to trust you again.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Walter_Cannon_inspired_4.Regaining_Autonomy_You_Can_Train_Your_Nervous_System_to_Trust_You_Again_utdzvg.mp3.mp3', added:'' },
  { title:'Theta Forest', series:'Soundscapes', subseries:'Calm Clarity', free:false, desc:'Focus & flow in nature\'s rhythm.', num:'01', url:'https://vibezcore-audio.b-cdn.net/01-focus-theta-forest.mp3.mp3', added:'' },
  { title:'Theta Reverie', series:'Soundscapes', subseries:'Calm Clarity', free:false, desc:'Creative focus with soft piano.', num:'02', url:'https://vibezcore-audio.b-cdn.net/02-focus-theta-reverie.mp3.mp3', added:'' },
  { title:'Theta Rain Ritual', series:'Soundscapes', subseries:'Calm Clarity', free:false, desc:'Deep concentration with rainfall.', num:'03', url:'https://vibezcore-audio.b-cdn.net/03-focus-theta-rain.mp3.mp3', added:'' },
  { title:'Theta Pulse', series:'Soundscapes', subseries:'Calm Clarity', free:false, desc:'Focus locked to a steady beat.', num:'04', url:'https://vibezcore-audio.b-cdn.net/04-focus-theta-pulse.mp3.mp3', added:'' },
  { title:'Theta Heartbeat', series:'Soundscapes', subseries:'Calm Clarity', free:false, desc:'Calm focus, slow and steady.', num:'05', url:'https://vibezcore-audio.b-cdn.net/05-focus-theta-heartbeat.mp3.mp3', added:'' },
  { title:'Theta Cosmos', series:'Soundscapes', subseries:'Calm Clarity', free:false, desc:'Expansive meditation in deep space.', num:'06', url:'https://vibezcore-audio.b-cdn.net/06-focus-theta-cosmos.mp3.mp3', added:'' },
  { title:'Delta Surrender', series:'Soundscapes', subseries:'Rest & Reset', free:false, desc:'Let go and fall into sleep.', num:'02', url:'https://vibezcore-audio.b-cdn.net/09-sleep-delta-surrender.mp3.mp3', added:'' },
  { title:'Delta Drift', series:'Soundscapes', subseries:'Rest & Reset', free:false, desc:'Slow waves for falling asleep.', num:'03', url:'https://vibezcore-audio.b-cdn.net/10-sleep-delta-drift.mp3.mp3', added:'' },
  { title:'Delta Ocean', series:'Soundscapes', subseries:'Rest & Reset', free:false, desc:'Sleep to the rhythm of the sea.', num:'04', url:'https://vibezcore-audio.b-cdn.net/11-sleep-delta-ocean.mp3.mp3', added:'' },
  { title:'Stillpoint', series:'Soundscapes', subseries:'Zen Flow', free:false, desc:'Deep meditation, total stillness.', num:'01', url:'https://vibezcore-audio.b-cdn.net/12-meditation-stillpoint.mp3.mp3', added:'' },
  { title:'Wild Mind', series:'Soundscapes', subseries:'Zen Flow', free:false, desc:'Meditation with natural soundscape.', num:'02', url:'https://vibezcore-audio.b-cdn.net/13-meditation-wild-mind.mp3.mp3', added:'' },
  { title:'Gentle Awakening', series:'Soundscapes', subseries:'Zen Flow', free:false, desc:'Soft meditation to start your day.', num:'03', url:'https://vibezcore-audio.b-cdn.net/14-meditation-gentle.mp3.mp3', added:'' },
  { title:'Stillness Piano', series:'Soundscapes', subseries:'Zen Flow', free:false, desc:'Meditation with calming piano.', num:'04', url:'https://vibezcore-audio.b-cdn.net/15-meditation-piano.mp3.mp3', added:'' },
  { title:'Meditation', series:'Soundscapes', subseries:'Zen Flow', free:false, desc:'A simple meditation session.', num:'05', url:'https://vibezcore-audio.b-cdn.net/16-meditation-general.mp3.mp3', added:'' },
  { title:'Forest Sanctuary', series:'Soundscapes', subseries:'Harmonic', free:false, desc:'Nature ambience for calm and focus.', num:'01', url:'https://vibezcore-audio.b-cdn.net/18-ambient-forest-sanctuary.mp3.m4a', added:'' },
  { title:'Yoga Ritual', series:'Soundscapes', subseries:'Harmonic', free:false, desc:'Soundscape for your yoga practice.', num:'02', url:'https://vibezcore-audio.b-cdn.net/19-ambient-yoga.mp3.mp3', added:'' },
];

export const SERIES_PHOTO: Record<string,string> = {
  'Master Mental Clarity': 'https://vibezcore-audio.b-cdn.net/images/master-mental-clarity.jpg',
  'Beast Mode': 'https://vibezcore-audio.b-cdn.net/images/beast-mode.jpg',
  'The Inner Blueprint': 'https://vibezcore-audio.b-cdn.net/images/the-inner-blueprint.jpg',
  'Daily Affirmations Power': 'https://vibezcore-audio.b-cdn.net/images/daily-affirmations-power.jpg',
  'Meaning Over Comfort': 'https://vibezcore-audio.b-cdn.net/images/meaning-over-comfort.jpg',
  'Journey to Success': 'https://vibezcore-audio.b-cdn.net/images/journey-to-success.jpg',
  'Life After Betrayal': 'https://vibezcore-audio.b-cdn.net/images/life-after-betrayal.jpg',
  'Identity & Wealth': 'https://vibezcore-audio.b-cdn.net/images/identity-and-wealth.jpg',
  'The Freedom Formula': 'https://vibezcore-audio.b-cdn.net/images/the-freedom-formula.jpg',
  'The Stoic Fortress': 'https://vibezcore-audio.b-cdn.net/images/the-stoic-fortress.jpg',
  'End Fight-Or-Flight': 'https://vibezcore-audio.b-cdn.net/images/end-fight-or-flight.jpg',
  'Soundscapes': 'https://vibezcore-audio.b-cdn.net/images/theta-and-alpha-frequency.jpg',
};

export const SERIES_SUBTITLE: Record<string,string> = {
  'Master Mental Clarity': 'ROOTED IN NEUROSCIENCE',
  'Beast Mode': 'ROOTED IN DISCIPLINE SCIENCE',
  'The Inner Blueprint': 'ROOTED IN PSYCHOLOGY',
  'Daily Affirmations Power': 'ROOTED IN NEUROPLASTICITY',
  'Meaning Over Comfort': 'ROOTED IN PHILOSOPHY',
  'Journey to Success': 'ROOTED IN BEHAVIORAL SCIENCE',
  'Life After Betrayal': 'ROOTED IN TRAUMA RESEARCH',
  'Identity & Wealth': 'ROOTED IN WEALTH PSYCHOLOGY',
  'The Freedom Formula': 'ROOTED IN STRATEGIC THINKING',
  'The Stoic Fortress': 'ROOTED IN STOIC PHILOSOPHY',
  'End Fight-Or-Flight': 'ROOTED IN NERVOUS SYSTEM SCIENCE',
  'Soundscapes': 'ROOTED IN FREQUENCY SCIENCE',
};

/* Soundscapes-subcategorieën — EIGEN foto + eyebrow per subcat (SUBCAT_INFO, regel 7182). */
export const SUBCAT_INFO: Record<string,{photo:string;eyebrow:string}> = {
  'Calm Clarity': { photo:'https://vibezcore-audio.b-cdn.net/images/Ambient%20background.jpg', eyebrow:'Theta Waves (4-7 Hz) · Best with headphones' },
  'Rest & Reset': { photo:'https://vibezcore-audio.b-cdn.net/images/Rest%20%26%20Reset%20Delta.jpg', eyebrow:'Delta Waves (0.5-4 Hz) · Best with headphones' },
  'Zen Flow': { photo:'https://vibezcore-audio.b-cdn.net/images/Psychological%20Resilience.png', eyebrow:'Meditation sessions' },
  'Harmonic': { photo:'https://vibezcore-audio.b-cdn.net/images/Calm%20Clarety.jpg', eyebrow:'Background soundscapes' },
};
export const SUBCAT_ORDER: string[] = ['Calm Clarity', 'Rest & Reset', 'Zen Flow', 'Harmonic'];

export const SERIES: Series[] = SERIES_ORDER.map((name)=>({ name, sessions: SESSIONS.filter(s=>s.series===name) }));

/* Serie-subtitel (derde regel op de card) — exact uit bron card-sub. */
export const SERIES_SUB: Record<string,string> = {
  'Master Mental Clarity': 'Your brain is offline. Not broken.',
  'Beast Mode': 'Done With excuses.',
  'The Inner Blueprint': 'What\'s running your life isn\'t you.',
  'Daily Affirmations Power': 'The voice in your head was installed by others.',
  'Meaning Over Comfort': 'Your comfort zone became your prison.',
  'Journey to Success': 'Your future is being shaped by today\'s excuses.',
  'Life After Betrayal': 'Betrayal destroys illusions. Not your future.',
  'Identity & Wealth': 'Wealth starts with identity, not income.',
  'The Freedom Formula': 'Stop drifting. Start directing.',
  'The Stoic Fortress': 'Master your mind. Master your life.',
  'End Fight-Or-Flight': 'Escape survival mode.',
  'Soundscapes': 'Your mind won\'t stop. Learn to guide it.',
};
