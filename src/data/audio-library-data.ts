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

export const SERIES_ORDER: string[] = ['Master Mental Clarity', 'Beast Mode', 'The Inner Blueprint', 'Daily Affirmations Power', 'Meaning Over Comfort', 'Journey to Success', 'Life After Betrayal', 'Identity & Wealth', 'The Freedom Formula', 'The Stoic Mind', 'Fight Or Flight', 'Soundscapes', 'The Father Wound', 'The Mother Wound', 'Time, Death & Legacy', 'Become Who You Are', 'Meaning Through Suffering', 'The Way Of Wu Wei', 'Power & Human Nature', 'Attachment', 'Dignity', 'Daily Discipline', 'Wealth Psychology', 'Iron Discipline', 'Purpose & Mission'];

export const SESSIONS: Session[] = [
  { title:'Neural State Control', series:'Master Mental Clarity', subseries:'', free:true, desc:'Learn how to direct your mind instead of chasing it.', num:'01', url:'https://vibezcore-audio.b-cdn.net/Andrew_Huberman_1._Neural_State_Control_How_to_Direct_Your_Mind_Instead_of_Chasing_It_osg0uy.mp3.mp3', added:'2026-05-06' },
  { title:'Become a Monster', series:'Beast Mode', subseries:'', free:true, desc:"Become the force they can't stop, control or ignore.", num:'02', url:'https://vibezcore-audio.b-cdn.net/Beast_Mode_1._Become_a_Monster_Become_the_Force_They_Can_t_Stop_Control_or_Ignore_ul7m0b.mp3.mp3', added:'2026-05-04' },
  { title:'The Inner Child', series:'The Inner Blueprint', subseries:'', free:true, desc:"It isn't your nature. It's an old survival strategy.", num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/1.%20CARL%20%20JUNG%2001.%20The%20Inner%20Child%20(1).mp3', added:'' },
  { title:'Building Inner Strength & Discipline', series:'Daily Affirmations Power', subseries:'', free:true, desc:'Daily training for mental toughness and self-control.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_1_INNER_STRENGTH_DISCIPLINE_celg5r.mp3.mp3', added:'' },
  { title:'Responsibility', series:'Meaning Over Comfort', subseries:'', free:true, desc:'Where change begins — with ownership of your life.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_1_Responsibility_Where_Your_Life_Quietly_Begins_Again_xfgrby.mp3.mp3', added:'' },
  { title:'The Silence Before the Start', series:'Journey to Success', subseries:'', free:true, desc:'Escaping delay, overthinking and endless analysis.', num:'06', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_1._The_Silence_Before_the_Start_Procrastination_Overthinking_qg8fzk.mp3.mp3', added:'' },
  { title:'The Break After Betrayal', series:'Life After Betrayal', subseries:'', free:true, desc:"It isn't the end. It's the moment everything you thought you knew gets rewritten.", num:'07', url:'https://vibezcore-audio.b-cdn.net/audio-new/13.%20Life%20After%20Betrayal%2001.%20The%20Break%20After%20Betrayal.mp3', added:'2026-06-14' },
  { title:'Identity', series:'Identity & Wealth', subseries:'', free:true, desc:'Becoming the person that success requires you to be.', num:'08', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_1._The_Identity_Becoming_Someone_Who_Can_Handle_Success_q6vpbo.mp3.mp3', added:'' },
  { title:'Rich by Clarity', series:'The Freedom Formula', subseries:'', free:true, desc:'Clarity is the real foundation of wealth and happiness.', num:'09', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_1.Rich_by_Clarity_A_Calm_Mind_Builds_a_Better_Life_y1vjth.mp3.mp3', added:'2026-05-01' },
  { title:'What Is In Your Control', series:'The Stoic Mind', subseries:'', free:true, desc:'See the line. Find freedom.', num:'10', url:'https://vibezcore-audio.b-cdn.net/audio-new/8.%20THE%20STOICS%2001.%20What%20Is%20In%20Your%20Control.mp3', added:'2026-06-14' },
  { title:'Your Body Is Still Reacting To Yesterday', series:'Fight Or Flight', subseries:'', free:true, desc:"It isn't anxiety. It's an alarm your body has not been told to switch off.", num:'11', url:'https://vibezcore-audio.b-cdn.net/audio-new/7.%20CANNON%2001.%20Your%20Body%20Is%20Still%20Reacting%20To%20Yesterday.mp3', added:'2026-06-14' },
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
  { title:'The Mask You Have Been Wearing', series:'The Inner Blueprint', subseries:'', free:false, desc:"It isn't who you are. It's who you learned to be.", num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/1.%20CARL%20%20JUNG%2002.%20The%20Mask%20You%20Have%20Been%20Wearing%20(1).mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Part Of You You Keep Hiding', series:'The Inner Blueprint', subseries:'', free:false, desc:"It isn't gone. It's running you from the dark.", num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/1.%20CARL%20JUNG%2003.%20The%20Part%20Of%20You%20You%20Keep%20Hiding%20(1).mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'What You Hate In Others Is In You', series:'The Inner Blueprint', subseries:'', free:false, desc:"It isn't them. It's the mirror.", num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/1.%20CARL%20JUNG%2004.%20What%20You%20Hate%20In%20Others%20Is%20In%20You.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Journey To The Self', series:'The Inner Blueprint', subseries:'', free:false, desc:"It isn't a destination. It's a return.", num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/1.CARL%20JUNG%2005.%20The%20Journey%20To%20The%20Self.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'Before You Begin', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Understand how affirmations truly work before you start.', num:'01', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_0_Before_You_Begin_How_Affirmations_Truly_Work_dagkcs.mp3.mp3', added:'' },
  { title:'Betrayal, Hurt & Rebuilding', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Reclaiming yourself after being deeply hurt.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_2_BETRAYAL_HURT_REBUILDING_aayygk.mp3.mp3', added:'' },
  { title:'Confidence, Self-Worth & Identity', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Stand firm in who you are regardless of what others think.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_3_CONFIDENCE_SELF-WORTH_IDENTITY_za6bqc.mp3.mp3', added:'' },
  { title:'Success, Motivation & Relentless Drive', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Wire your mind for consistent forward momentum.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_4_SUCCESS_MOTIVATION_RELENTLESS_DRIVE_nr6uaa.mp3.mp3', added:'' },
  { title:'Peace, Presence & Letting Go', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Release tension and return to a grounded state.', num:'06', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_5_PEACE_PRESENCE_LETTING_GO_ymqayc.mp3.mp3', added:'' },
  { title:'The Power of Visualisation', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Use your mind to shape what becomes real.', num:'07', url:'https://vibezcore-audio.b-cdn.net/Daily_Affirmations_6_THE_POWER_OF_VISUALISATION_IN_MANIFESTATION_cgcbm6.mp3.mp3', added:'' },
  { title:'Morning Affirmations', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Start each day with clarity, direction and strength.', num:'08', url:'https://vibezcore-audio.b-cdn.net/Morning_affirmations_hbvf4w.mp3.mp3', added:'' },
  { title:'Evening Affirmations', series:'Daily Affirmations Power', subseries:'', free:false, desc:'Close the day with calm, gratitude and reset.', num:'09', url:'https://vibezcore-audio.b-cdn.net/Evening_affirmations_vgrtnn.mp3.mp3', added:'' },
  { title:'Slay The Dragon Within', series:'Meaning Over Comfort', subseries:'', free:false, desc:'Mastering emotional instability to stay on track.', num:'02', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_2._Chaos_vs._Order_Standing_at_the_Edge_of_What_You_Can_Handle_nnhcz1.mp3.mp3', added:'' },
  { title:'Truth', series:'Meaning Over Comfort', subseries:'', free:false, desc:'The reality you must face before you can move forward.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_3._Truth_The_One_Realization_You_Can_t_Run_From_n7zsxw.mp3.mp3', added:'' },
  { title:'Meaning Over Comfort', series:'Meaning Over Comfort', subseries:'', free:false, desc:'Why the hard path is the only one worth taking.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_4._Meaning_Over_Comfort_Why_the_Hard_Path_Is_the_Only_One_Worth_Taking_pzbce9.mp3.mp3', added:'' },
  { title:'Identity & Becoming', series:'Meaning Over Comfort', subseries:'', free:false, desc:'Becoming the person you are meant to be.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Jordan_Peterson_5._Identity_Becoming_Build_the_Person_You_Wish_You_Already_Were_rjqsmv.mp3.mp3', added:'' },
  { title:'Control Your Mind, Control Your Life', series:'Journey to Success', subseries:'', free:false, desc:'Mastering emotional instability to stay on track.', num:'02', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_2._Control_Your_Mind_Control_Your_Life_Overwhelmed_by_Your_Emotions_bxsbuh.mp3.mp3', added:'' },
  { title:'Life Without Momentum', series:'Journey to Success', subseries:'', free:false, desc:'Breaking the invisible cycle of stagnation.', num:'03', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_3._Life_Without_Momentum_Chaos_No_Direction_uptngm.mp3.mp3', added:'' },
  { title:'The Battle Within', series:'Journey to Success', subseries:'', free:false, desc:'Confronting self-doubt and self-sabotage head on.', num:'04', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_4._The_Battle_Within_Low_Self-Esteem_Self-Sabotage_Fear_of_Growth_p74z13.mp3.mp3', added:'' },
  { title:'Success Without Fulfillment', series:'Journey to Success', subseries:'', free:false, desc:'When you achieve everything but still feel empty.', num:'05', url:'https://vibezcore-audio.b-cdn.net/The_Journey_to_Success_5._Success_Without_Fulfillment_When_Achievements_Feel_Empty_o5xhrq.mp3.mp3', added:'' },
  { title:'When Loyalty Collapses', series:'Life After Betrayal', subseries:'', free:false, desc:"It isn't them. It's the illusion you protected for too long.", num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/13.Life%20After%20Betrayal%2002.%20When%20Loyalty%20Collapses.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Damage To Your Self-Worth', series:'Life After Betrayal', subseries:'', free:false, desc:"It isn't proof. It's their choice — not your value.", num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/13.Life%20After%20Betrayal%2003.%20The%20Damage%20To%20Your%20Self-Worth.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Fear Of What Comes Next', series:'Life After Betrayal', subseries:'', free:false, desc:"It isn't the future. It's the loss of the future you'd already built in your head.", num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/13.Life%20After%20Betrayal%2004.%20The%20Fear%20Of%20What%20Comes%20Next.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'Rebuilding Trust In Yourself', series:'Life After Betrayal', subseries:'', free:false, desc:"It isn't trusting them again. It's trusting yourself first.", num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/13.Life%20After%20Betrayal%2005.%20Rebuilding%20Trust%20In%20Yourself.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Subconscious Blueprint', series:'Identity & Wealth', subseries:'', free:false, desc:'Programming your mind for wealth and opportunity.', num:'02', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_2._The_Subconscious_Blueprint_for_Money_and_Opportunity_twrnp6.mp3.mp3', added:'' },
  { title:'Vision Into Reality', series:'Identity & Wealth', subseries:'', free:false, desc:'The inner focus that turns ideas into real results.', num:'03', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_3._Vision_Into_Reality_The_Inner_Focus_That_Turns_Ideas_Into_Results_cgf7lr.mp3.mp3', added:'' },
  { title:'Solitude & Success', series:'Identity & Wealth', subseries:'', free:false, desc:'Where focused thinking builds real wealth.', num:'04', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_4._Solitude_Success_Why_Quiet_Thinking_Creates_Wealth_exztjk.mp3.mp3', added:'' },
  { title:'Breaking Scarcity', series:'Identity & Wealth', subseries:'', free:false, desc:'Building the mindset of expansion and confidence.', num:'05', url:'https://vibezcore-audio.b-cdn.net/Napoleon_Hill_5._Breaking_Scarcity_Thinking_and_Building_Entrepreneurial_Confidence_nd4dsj.mp3.mp3', added:'' },
  { title:'Leverage Over Labor', series:'The Freedom Formula', subseries:'', free:false, desc:'Work smarter. Build systems that multiply your results.', num:'02', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_2._Leverage_Over_Labor_Work_Smarter_Multiply_Results_zmzyld.mp3.mp3', added:'' },
  { title:'The Freedom Formula', series:'The Freedom Formula', subseries:'', free:false, desc:'Turning accumulated wealth into genuine personal freedom.', num:'03', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_3._The_Freedom_Formula_Using_Money_to_Buy_Your_Life_Back_saynwv.mp3.mp3', added:'' },
  { title:'Strategic Simplicity', series:'The Freedom Formula', subseries:'', free:false, desc:'Remove the noise and reveal the clearest path forward.', num:'04', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_4.Strategic_Simplicity_Remove_the_Noise_Reveal_the_Path_lqhbjx.mp3.mp3', added:'' },
  { title:'Solitary Clarity', series:'The Freedom Formula', subseries:'', free:false, desc:'Solitude increases clarity and sharpens long-term thinking.', num:'05', url:'https://vibezcore-audio.b-cdn.net/NAVAL_RAVIKANT_5.Solitary_Clarity_Why_Alone_Time_Makes_You_Smarter_and_Richer_nsbxia.mp3.mp3', added:'' },
  { title:'The Event And The Story', series:'The Stoic Mind', subseries:'', free:false, desc:'Change the story. Change the experience.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/8.%20THE%20STOICS%2002.%20The%20Event%20And%20The%20Story.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Weakness Of Comfort', series:'The Stoic Mind', subseries:'', free:false, desc:'Choose hardship. Build resilience.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/8.%20THE%20STOICS%2003.%20The%20Weakness%20Of%20Comfort.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The View From Above', series:'The Stoic Mind', subseries:'', free:false, desc:'Step back. See clearly.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/8.%20THE%20STOICS%2004.%20The%20View%20From%20Above.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Obstacle Is The Way', series:'The Stoic Mind', subseries:'', free:false, desc:'Use what stands in your way.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/8.%20THE%20STOICS%2005.%20The%20Obstacle%20Is%20The%20Way.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Fight You Carry Into Every Room', series:'Fight Or Flight', subseries:'', free:false, desc:"It isn't strength. It's combat readiness running in rooms that aren't battlefields.", num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/7.%20CANNON%2002.%20The%20Fight%20You%20Carry%20Into%20Every%20Room.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'Why You Keep Running', series:'Fight Or Flight', subseries:'', free:false, desc:"It isn't ambition. It's flight from something that stopped chasing you years ago.", num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/7.%20CANNON%2003.%20Why%20You%20Keep%20Running.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Freeze You Mistook For Calm', series:'Fight Or Flight', subseries:'', free:false, desc:"It isn't composure. It's the freeze you mistook for calm.", num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/7.%20CANNON%2004.%20The%20Freeze%20You%20Mistook%20For%20Calm.mp3', added:'2026-06-14', accessTier:'pro' },
  { title:'The Body That Knows It Is Safe Now', series:'Fight Or Flight', subseries:'', free:false, desc:"It isn't transformation. It's teaching your body — in its own language — that today is safe.", num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/7.%20CANNON%2005.%20The%20Body%20That%20Knows%20It%20Is%20Safe%20Now.mp3', added:'2026-06-14', accessTier:'pro' },
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
  /* Iter 9dq v67 (2026-06-03): teruggezet naar free:false. Backend-DB
     heeft Forest Sanctuary niet als gratis geregistreerd → /api/audio-url
     gaf 401 LOGIN_REQUIRED voor gasten. Visueel toonde de client wel
     "FREE" maar tap-to-play faalde → "Log in to listen"-popup.
     Operator-TODO (zie docs/OPERATOR_HANDOVER.md §15 / Open beslissingen):
     wanneer backend de free-flag flipt, mag deze regel terug naar
     free:true zodat Harmonic-subcat een free sample heeft als de andere
     drie Soundscape-subcats. Tot dan blijft Harmonic zonder publiek
     sample (operator-besluit: kleine asymmetrie acceptabel boven
     gebroken UX). */
  { title:'Forest Sanctuary', series:'Soundscapes', subseries:'Harmonic', free:false, desc:'Nature ambience for calm and focus.', num:'01', url:'https://vibezcore-audio.b-cdn.net/18-ambient-forest-sanctuary.mp3.m4a', added:'' },
  { title:'Yoga Ritual', series:'Soundscapes', subseries:'Harmonic', free:false, desc:'Soundscape for your yoga practice.', num:'02', url:'https://vibezcore-audio.b-cdn.net/19-ambient-yoga.mp3.mp3', added:'' },

  /* ════════════════════════════════════════════════════════════════════════
     Iter 9dq v128 (2026-06-13): 13 nieuwe reeksen toegevoegd om de app-
     bibliotheek te syncen met de web widget. Pijler-mapping in SERIES_PILLAR
     onderaan dit bestand. Sessie 1 van elke nieuwe reeks = free in app
     (accessTier:'public'), sessies 2-5 = pro. URLs uit /audio-new/ folder.
     ════════════════════════════════════════════════════════════════════════ */

  /* ── Pijler 1: Robert Bly — The Father Wound ── */
  { title:'The Father You Tried To Outdo', series:'The Father Wound', subseries:'', free:true,  desc:"It isn't ambition. It's the boy still trying to be seen.", num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/4.%20ROBERT%20BLY%2001.%20The%20Father%20You%20Tried%20To%20Outdo.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'His Voice In Your Head', series:'The Father Wound', subseries:'', free:false, desc:"It isn't your voice. It's his — still talking.", num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/4.%20ROBERT%20BLY%2002.%20His%20Voice%20In%20Your%20Head.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Approval He Never Gave', series:'The Father Wound', subseries:'', free:false, desc:"It isn't approval you need. It's permission to stop waiting.", num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/4.%20ROBERT%20BLY%2003.%20The%20Approval%20He%20Never%20Gave.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Anger You Inherited', series:'The Father Wound', subseries:'', free:false, desc:"It isn't your anger. It's the one he never released.", num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/4.%20ROBERT%20BLY%2004.%20The%20Anger%20You%20Inherited.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Becoming Your Own Father', series:'The Father Wound', subseries:'', free:false, desc:"It isn't who he was. It's who you choose to be.", num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/4.%20ROBERT%20BLY%2005.%20Becoming%20Your%20Own%20Father.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 1: Alice Miller — The Mother Wound ── */
  { title:'The Love That Came With Conditions', series:'The Mother Wound', subseries:'', free:true, desc:"It isn't love. It's a contract you never signed.", num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/5.%20ALICE%20MILLER%2001.%20The%20Love%20That%20Came%20With%20Conditions.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'The Guilt That Was Never Yours', series:'The Mother Wound', subseries:'', free:false, desc:"It isn't your guilt. It's hers — placed on your shoulders.", num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/5.%20ALICE%20MILLER%2002.%20The%20Guilt%20That%20Was%20Never%20Yours.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Why You Take Care Of Everyone Else', series:'The Mother Wound', subseries:'', free:false, desc:"It isn't generosity. It's the role she trained you for.", num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/5.%20ALICE%20MILLER%2003.%20Why%20You%20Take%20Care%20Of%20Everyone%20Else.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Approval You Are Still Chasing', series:'The Mother Wound', subseries:'', free:false, desc:"It isn't her approval. It's the absence of it that still drives you.", num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/5.%20ALICE%20MILLER%2004.%20The%20Approval%20You%20Are%20Still%20Chasing.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Growing Beyond Her', series:'The Mother Wound', subseries:'', free:false, desc:"It isn't betrayal. It's the only way out.", num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/5.%20ALICE%20MILLER%2005.%20Growing%20Beyond%20Her.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 2: Marcus Aurelius — Time, Death & Legacy ── */
  { title:'The Time You Have Left', series:'Time, Death & Legacy', subseries:'', free:true, desc:'Stop counting backward. Start counting forward.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/15.%20AURELIUS%2001.%20The%20Time%20You%20Have%20Left.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'Memento Mori', series:'Time, Death & Legacy', subseries:'', free:false, desc:'Remember death. Live what matters.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/15.%20AURELIUS%2002.%20Memento%20Mori.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Duty Of The Hour', series:'Time, Death & Legacy', subseries:'', free:false, desc:'This hour. This task. Now.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/15.%20AURELIUS%2003.%20The%20Duty%20Of%20The%20Hour.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Everything Flows', series:'Time, Death & Legacy', subseries:'', free:false, desc:'Nothing stays. Stop trying to hold it.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/15.%20AURELIUS%2004.%20Everything%20Flows.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'What Remains Of You', series:'Time, Death & Legacy', subseries:'', free:false, desc:'Reputation fades. Character holds.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/15.%20AURELIUS%2005.%20What%20Remains%20Of%20You.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 2: Friedrich Nietzsche — Become Who You Are ── */
  { title:'The Herd You Have Been Hiding In', series:'Become Who You Are', subseries:'', free:true, desc:'Stop fitting in. Start becoming.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/3.%20NIETZSCHE%2001.%20The%20Herd%20You%20Have%20Been%20Hiding%20In.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'The Values You Never Chose', series:'Become Who You Are', subseries:'', free:false, desc:'Question everything. Choose your own.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/3.%20NIETZSCHE%2002.%20The%20Values%20You%20Never%20Chose.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Amor Fati', series:'Become Who You Are', subseries:'', free:false, desc:'Stop resisting. Start using.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/3.%20NIETZSCHE%2003.%20Amor%20Fati.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Become Who You Are', series:'Become Who You Are', subseries:'', free:false, desc:'Stop shrinking. Expand fully.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/3.%20NIETZSCHE%2004.%20Become%20Who%20You%20Are.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Power You Keep Giving Away', series:'Become Who You Are', subseries:'', free:false, desc:'Reclaim what is yours.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/3.%20NIETZSCHE%2005.%20The%20Power%20You%20Keep%20Giving%20Away.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 2: Viktor Frankl — Meaning Through Suffering ── */
  { title:'Why Some Survive Anything', series:'Meaning Through Suffering', subseries:'', free:true, desc:'Meaning carries what strength cannot.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/14.%20VIKTOR%20FRANKL%2001.%20Why%20Some%20Survive%20Anything.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'The Why That Carries Every How', series:'Meaning Through Suffering', subseries:'', free:false, desc:'Find your why. Endure more.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/14.%20VIKTOR%20FRANKL%2002.%20The%20Why%20That%20Carries%20Every%20How.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Your Last Freedom', series:'Meaning Through Suffering', subseries:'', free:false, desc:'Choose your response. Reclaim control.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/14.%20VIKTOR%20FRANKL%2003.%20Your%20Last%20Freedom.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'When Pain Has A Purpose', series:'Meaning Through Suffering', subseries:'', free:false, desc:'Use the suffering. Build through it.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/14.%20VIKTOR%20FRANKL%2004.%20When%20Pain%20Has%20A%20Purpose.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Task Only You Can Do', series:'Meaning Through Suffering', subseries:'', free:false, desc:'Life is asking. Answer it.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/14.%20VIKTOR%20FRANKL%2005.%20The%20Task%20Only%20You%20Can%20Do.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 2: Lao Tzu — The Way Of Wu Wei ── */
  { title:'Why Forcing It Never Works', series:'The Way Of Wu Wei', subseries:'', free:true, desc:'Stop pushing. Start flowing.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/9.%20LAO%20TZU%2001.%20Why%20Forcing%20It%20Never%20Works.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'Less Is The Source Of More', series:'The Way Of Wu Wei', subseries:'', free:false, desc:'Stop accumulating. Start simplifying.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/9.%20LAO%20TZU%2002.%20Less%20Is%20The%20Source%20Of%20More.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'When To Move And When To Wait', series:'The Way Of Wu Wei', subseries:'', free:false, desc:'Read the season. Act accordingly.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/9.%20LAO%20TZU%2003.%20When%20To%20Move%20And%20When%20To%20Wait%20(1).mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Empty Cup', series:'The Way Of Wu Wei', subseries:'', free:false, desc:'Empty first. Then receive.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/9.%20LAO%20TZU%2004.%20The%20Empty%20Cup.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Power Of Not Knowing', series:'The Way Of Wu Wei', subseries:'', free:false, desc:'Drop certainty. Find clarity.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/9.%20LAO%20TZU%2005.%20The%20Power%20Of%20Not%20Knowing.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 3: Niccolò Machiavelli — Power & Human Nature ── */
  { title:'The Naive Eye That Costs You Everything', series:'Power & Human Nature', subseries:'', free:true, desc:'Stop assuming goodwill. Start observing.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/10.MACHIAVELLI%2001.%20The%20Naive%20Eye%20That%20Costs%20You%20Everything.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'The Hidden Motive Behind Every Action', series:'Power & Human Nature', subseries:'', free:false, desc:'People want something. Find what.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/10.MACHIAVELLI%2002.%20The%20Hidden%20Motive%20Behind%20Every%20Action.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Status Game You Refuse To See', series:'Power & Human Nature', subseries:'', free:false, desc:'Everyone is playing. Stop pretending you are not.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/10.MACHIAVELLI%2003.%20The%20Status%20Game%20You%20Refuse%20To%20See.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'When The Door Opens', series:'Power & Human Nature', subseries:'', free:false, desc:'Fortune does not wait. Learn to recognize the moment.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/10.MACHIAVELLI%2004.%20When%20The%20Door%20Opens.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Power Without Apology', series:'Power & Human Nature', subseries:'', free:false, desc:'Stop shrinking. Hold your ground.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/10.MACHIAVELLI%2005.%20Power%20Without%20Apology.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 3: John Bowlby — Attachment ── */
  { title:'The Same Person In Different Faces', series:'Attachment', subseries:'', free:true, desc:'See the pattern. Break it.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/6.%20JOHN%20BOWLBY%2001.%20The%20Same%20Person%20In%20Different%20Faces.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'The Fear Of Being Left', series:'Attachment', subseries:'', free:false, desc:'Old fear. New choices.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/6.%20JOHN%20BOWLBY%2002.%20The%20Fear%20Of%20Being%20Left.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Why Distance Feels Safe', series:'Attachment', subseries:'', free:false, desc:'Closeness feels dangerous. Stay anyway.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/6.%20JOHN%20BOWLBY%2003.%20Why%20Distance%20Feels%20Safe.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Love You Chase Never Stays', series:'Attachment', subseries:'', free:false, desc:'Stop chasing. Start receiving.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/6.%20JOHN%20BOWLBY%2004.%20The%20Love%20You%20Chase%20Never%20Stays.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Learning To Stay', series:'Attachment', subseries:'', free:false, desc:'Stability is a skill. Build it.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/6.%20JOHN%20BOWLBY%2005.%20Learning%20To%20Stay.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 3: Immanuel Kant — Dignity ── */
  { title:'The Worth You Were Born With', series:'Dignity', subseries:'', free:true, desc:'Stop earning. Remember it was always yours.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/19.%20KANT%20INSPIRED%2001.%20The%20Worth%20You%20Were%20Born%20With.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'Used Without Knowing', series:'Dignity', subseries:'', free:false, desc:'Stop being used by yourself.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/19.%20KANT%20INSPIRED%2002.%20Used%20Without%20Knowing.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Line You Will Not Cross', series:'Dignity', subseries:'', free:false, desc:'Hold what you set. Or it disappears.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/19.%20KANT%20INSPIRED%2003.%20The%20Line%20You%20Will%20Not%20Cross.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'What You Owe Yourself', series:'Dignity', subseries:'', free:false, desc:'The debt no one else can pay.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/19.%20KANT%20INSPIRED%2004.%20What%20You%20Owe%20Yourself.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Person You Refuse To Betray', series:'Dignity', subseries:'', free:false, desc:'Keep faith with yourself first.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/19.%20KANT%20INSPIRED%2005.%20The%20Person%20You%20Refuse%20to%20Betray.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 3: Jim Rohn — Daily Discipline ── */
  { title:'The Few Disciplines That Change Everything', series:'Daily Discipline', subseries:'', free:true, desc:'Small choices. Massive consequences.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/12.%20JIM%20ROHN%2001.%20The%20Few%20Disciplines%20That%20Change%20Everything.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'You Are The Average Of Your Five', series:'Daily Discipline', subseries:'', free:false, desc:'Change the circle. Change the direction.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/12.%20JIM%20ROHN%2002.%20You%20Are%20The%20Average%20Of%20Your%20Five.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Easy To Do. Easy Not To Do.', series:'Daily Discipline', subseries:'', free:false, desc:'Pick the harder one. Daily.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/12.%20JIM%20ROHN%2003.%20Easy%20To%20Do%20Easy%20Not%20To%20Do.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'Work Harder On Yourself', series:'Daily Discipline', subseries:'', free:false, desc:'Grow yourself. Grow everything.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/12.%20JIM%20ROHN%2004.%20Work%20Harder%20On%20Yourself.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Cost Of Standing Still', series:'Daily Discipline', subseries:'', free:false, desc:'Comfort is expensive. Move anyway.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/12.%20JIM%20ROHN%2005.%20The%20Cost%20Of%20Standing%20Still.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 4: Alfred Adler — Wealth Psychology ── */
  { title:'The Money Lie You Inherited', series:'Wealth Psychology', subseries:'', free:true, desc:'Stop repeating what never worked.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/11.%20ADLER%2001.%20The%20Money%20Lie%20You%20Inherited.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'You Sabotage Yourself Near Success', series:'Wealth Psychology', subseries:'', free:false, desc:'Success is close. Stop stepping back.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/11.%20ADLER%2002.%20You%20Sabotage%20Yourself%20Near%20Success.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Price You Never Raised', series:'Wealth Psychology', subseries:'', free:false, desc:'Your value is waiting. Claim it.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/11.%20ADLER%2003.%20The%20Price%20You%20Never%20Raised.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Lifestyle Trap', series:'Wealth Psychology', subseries:'', free:false, desc:'More income. Less freedom. Reverse it.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/11.%20ADLER%2004.%20The%20Lifestyle%20Trap.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Wealthy Identity', series:'Wealth Psychology', subseries:'', free:false, desc:'Become it before you build it.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/11.%20ADLER%2005.%20The%20Wealthy%20Identity.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 4: VIBEZCORE Original — Iron Discipline ── */
  { title:'The Standard You Refuse To Drop', series:'Iron Discipline', subseries:'', free:true, desc:'The floor does not move. You hold it.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/17.%20%20Iron%20Discipline%2001.%20The%20Standard%20You%20Refuse%20To%20Drop.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'Voluntary Hardness', series:'Iron Discipline', subseries:'', free:false, desc:'Choose the hard thing. Before life chooses for you.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/17.%20%20Iron%20Discipline%2002.%20Voluntary%20Hardness.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Body That Carries Everything', series:'Iron Discipline', subseries:'', free:false, desc:'The body is substrate. Train the carrier.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/17.%20%20Iron%20Discipline%2003.%20The%20Body%20That%20Carries%20Everything.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Hard Year You Have Not Yet Met', series:'Iron Discipline', subseries:'', free:false, desc:'Build reserves before the year arrives.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/17.%20%20Iron%20Discipline%2004.%20The%20Hard%20Year%20You%20Have%20Not%20Yet%20Met.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Hardness That Protects What You Love', series:'Iron Discipline', subseries:'', free:false, desc:'Strength for them. Made operational through you.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/17.%20%20Iron%20Discipline%2005.%20The%20Hardness%20That%20Protects%20What%20You%20Love.mp3', added:'2026-06-13', accessTier:'pro' },

  /* ── Pijler 4: VIBEZCORE Original — Purpose & Mission ── */
  { title:'The Quiet Stagnation', series:'Purpose & Mission', subseries:'', free:true, desc:'Life stopped moving. Restart it.', num:'01', url:'https://vibezcore-audio.b-cdn.net/audio-new/2.%20Purpose%20%26%20Mission%2001.%20The%20Quiet%20Stagnation.mp3', added:'2026-06-13', accessTier:'public' },
  { title:'Drive Without Direction', series:'Purpose & Mission', subseries:'', free:false, desc:'Stop drifting. Start aiming.', num:'02', url:'https://vibezcore-audio.b-cdn.net/audio-new/2.%20Purpose%20%26%20Mission%2002.%20Drive%20Without%20Direction.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Goals That Are Not Yours', series:'Purpose & Mission', subseries:'', free:false, desc:'Borrowed goals. Empty victories.', num:'03', url:'https://vibezcore-audio.b-cdn.net/audio-new/2.%20Purpose%20%26%20Mission%2003.%20The%20Goals%20That%20Are%20Not%20Yours.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'The Compass Inside You', series:'Purpose & Mission', subseries:'', free:false, desc:'The signal is there. Follow it.', num:'04', url:'https://vibezcore-audio.b-cdn.net/audio-new/2.%20Purpose%20%26%20Mission%2004.%20The%20Compass%20Inside%20You.mp3', added:'2026-06-13', accessTier:'pro' },
  { title:'From Goal To Mission', series:'Purpose & Mission', subseries:'', free:false, desc:'Goals end. Missions continue.', num:'05', url:'https://vibezcore-audio.b-cdn.net/audio-new/2.%20Purpose%20%26%20Mission%2005.%20From%20Goal%20To%20Mission.mp3', added:'2026-06-13', accessTier:'pro' },
];

export const SERIES_PHOTO: Record<string,string> = {
  'Master Mental Clarity': 'https://vibezcore-audio.b-cdn.net/images/confident-man-with-beard-mustache-smiling-generated-by-ai.jpg',
  'Beast Mode': 'https://vibezcore-audio.b-cdn.net/images/beast-mode.jpg',
  'The Inner Blueprint': 'https://vibezcore-audio.b-cdn.net/images/the-inner-blueprint.jpg',
  'Daily Affirmations Power': 'https://vibezcore-audio.b-cdn.net/images/daily-affirmations-power.jpg',
  'Meaning Over Comfort': 'https://vibezcore-audio.b-cdn.net/images/meaning-over-comfort.jpg',
  'Journey to Success': 'https://vibezcore-audio.b-cdn.net/images/journey-to-success.jpg',
  'Life After Betrayal': 'https://vibezcore-audio.b-cdn.net/images/life-after-betrayal.jpg',
  'Identity & Wealth': 'https://vibezcore-audio.b-cdn.net/images/identity-and-wealth.jpg',
  'The Freedom Formula': 'https://vibezcore-audio.b-cdn.net/images/the-freedom-formula.jpg',
  'The Stoic Mind': 'https://vibezcore-audio.b-cdn.net/images/the-stoic-fortress.jpg',
  'Fight Or Flight': 'https://vibezcore-audio.b-cdn.net/images/end-fight-or-flight.jpg',
  'Soundscapes': 'https://vibezcore-audio.b-cdn.net/images/theta-and-alpha-frequency.jpg',
  /* iter 9dq v137 (operator 2026-06-15): 13 nieuwe series-photos (Bunny CDN)
     aangeleverd door operator. Gegroepeerd per pijler voor leesbaarheid.
     Iron Discipline toegevoegd in v144 (2026-06-15).
     ⚠ Purpose & Mission URL bevat operator-typo "puprose" (filename op CDN)
     — bewust niet gecorrigeerd, anders 404. */
  /* — Pillar: Psychological Resilience — */
  'The Father Wound':          'https://vibezcore-audio.b-cdn.net/images/father%20wound.jpg',
  'The Mother Wound':          'https://vibezcore-audio.b-cdn.net/images/mother%20wound.jpg',
  /* — Pillar: Inner Sovereignty — */
  'Time, Death & Legacy':      'https://vibezcore-audio.b-cdn.net/images/time%20en%20death.jpg',
  'Become Who You Are':        'https://vibezcore-audio.b-cdn.net/images/become%20who%20you%20are.jpg',
  'Meaning Through Suffering': 'https://vibezcore-audio.b-cdn.net/images/meaning%20through%20suffering.jpg',
  'The Way Of Wu Wei':         'https://vibezcore-audio.b-cdn.net/images/wu%20wei.jpg',
  /* — Pillar: Social Mastery — */
  'Power & Human Nature':      'https://vibezcore-audio.b-cdn.net/images/machiavelli.jpg',
  'Attachment':                'https://vibezcore-audio.b-cdn.net/images/attachment.jpg',
  'Dignity':                   'https://vibezcore-audio.b-cdn.net/images/Dignity.jpg',
  'Daily Discipline':          'https://vibezcore-audio.b-cdn.net/images/daily%20discipline.jpg',
  /* — Pillar: Strategic Execution & Wealth — */
  'Wealth Psychology':         'https://vibezcore-audio.b-cdn.net/images/wealth%20psychology.jpg',
  'Iron Discipline':           'https://vibezcore-audio.b-cdn.net/images/Iron%20discipline.jpg',
  'Purpose & Mission':         'https://vibezcore-audio.b-cdn.net/images/puprose%20and%20mission.jpg',
};

/* iter 9dq v137 (operator 2026-06-15): focal-point shift per serie voor
   library-cards (libCard 200px hoog). React Native heeft geen object-
   position prop, dus we gebruiken transform [scale + translateY] in
   combinatie met de parent's overflow:hidden:
   - scale > 1 maakt de Image groter dan de card (krijgt extra "ruimte")
   - positieve translateY schuift het zichtbare deel naar BOVEN in de foto
     (we zien meer van de top → gezichten die hoog in beeld staan komen
     binnen het zichtbare frame)
   - negatieve translateY zou tegenovergesteld werken (zelden nodig)
   Per serie alleen ingesteld als nodig — anders default centered cover. */
export const SERIES_FOCAL: Record<string, { scale: number; translateY: number }> = {
  /* iter 9dq v138 (2026-06-15): waarden bumped naar duidelijk-zichtbaar
     niveau zodat operator visueel kan bevestigen dat het werkt. Na visuele
     bevestiging dialen we terug naar subtiele waarden indien gewenst. */
  'Wealth Psychology':    { scale: 1.40, translateY: 35 }, // "beetje zakken"
  'Power & Human Nature': { scale: 1.40, translateY: 50 }, // "zakken"
  'Meaning Over Comfort': { scale: 1.40, translateY: 35 }, // "beetje zakken"
  'The Mother Wound':     { scale: 1.40, translateY: 50 }, // "zakken" — kind + moeder in beeld
};

/* Eyebrow tekst EXACT zoals website widget (2026-06-14). Vibe: "X Inspired
   Series" voor inspirator-reeksen, "VIBEZCORE Original Series" voor eigen,
   "Rooted in Y" voor de Tools-pijler. */
export const SERIES_SUBTITLE: Record<string,string> = {
  'Master Mental Clarity':       'ANDREW HUBERMAN INSPIRED SERIES',
  'Beast Mode':                  'VIBEZCORE ORIGINAL SERIES',
  'The Inner Blueprint':         'CARL JUNG INSPIRED SERIES',
  'Daily Affirmations Power':    'ROOTED IN NEUROPLASTICITY',
  'Meaning Over Comfort':        'JORDAN PETERSON INSPIRED SERIES',
  'Journey to Success':          'VIBEZCORE ORIGINAL SERIES',
  'Life After Betrayal':         'VIBEZCORE ORIGINAL SERIES',
  'Identity & Wealth':           'NAPOLEON HILL INSPIRED SERIES',
  'The Freedom Formula':         'NAVAL RAVIKANT INSPIRED SERIES',
  'The Stoic Mind':              'THE STOICS INSPIRED SERIES',
  'Fight Or Flight':             'WALTER CANNON INSPIRED SERIES',
  'Soundscapes':                 'ROOTED IN FREQUENCY SCIENCE',
  /* 13 nieuwe reeksen — exact match met website widget eyebrows */
  'The Father Wound':            'ROBERT BLY INSPIRED SERIES',
  'The Mother Wound':            'ALICE MILLER INSPIRED SERIES',
  'Time, Death & Legacy':        'MARCUS AURELIUS INSPIRED SERIES',
  'Become Who You Are':          'FRIEDRICH NIETZSCHE INSPIRED SERIES',
  'Meaning Through Suffering':   'VIKTOR FRANKL INSPIRED SERIES',
  'The Way Of Wu Wei':           'LAO TZU INSPIRED SERIES',
  'Power & Human Nature':        'NICCOLÒ MACHIAVELLI INSPIRED SERIES',
  'Attachment':                  'JOHN BOWLBY INSPIRED SERIES',
  'Dignity':                     'IMMANUEL KANT INSPIRED SERIES',
  'Daily Discipline':            'JIM ROHN INSPIRED SERIES',
  'Wealth Psychology':           'ALFRED ADLER INSPIRED SERIES',
  'Iron Discipline':             'VIBEZCORE ORIGINAL SERIES',
  'Purpose & Mission':           'VIBEZCORE ORIGINAL SERIES',
};

/* Soundscapes-subcategorieën — EIGEN foto + eyebrow per subcat (SUBCAT_INFO, regel 7182). */
export const SUBCAT_INFO: Record<string,{photo:string;eyebrow:string}> = {
  'Calm Clarity': { photo:'https://vibezcore-audio.b-cdn.net/images/Ambient%20background.jpg', eyebrow:'Theta Waves (4-7 Hz) · Best with headphones' },
  'Rest & Reset': { photo:'https://vibezcore-audio.b-cdn.net/images/Rest%20%26%20Reset%20Delta.jpg', eyebrow:'Delta Waves (0.5-4 Hz) · Best with headphones' },
  'Zen Flow': { photo:'https://vibezcore-audio.b-cdn.net/images/zen%20flow%20correct.png', eyebrow:'Meditation sessions' },
  'Harmonic': { photo:'https://vibezcore-audio.b-cdn.net/images/Calm%20Clarety.jpg', eyebrow:'Background soundscapes' },
};
export const SUBCAT_ORDER: string[] = ['Calm Clarity', 'Rest & Reset', 'Zen Flow', 'Harmonic'];

export const SERIES: Series[] = SERIES_ORDER.map((name)=>({ name, sessions: SESSIONS.filter(s=>s.series===name) }));

/* ════════════════════════════════════════════════════════════════════════════
   PIJLER-STRUCTUUR (Iter 9dq v128, 2026-06-13)

   Doortrek van de web widget-strategie naar de app. Vier inhoudelijke pijlers
   conform CLAUDE.md §4 + MASTER v12.5, plus een vijfde 'tools' bucket voor
   Daily Affirmations en Soundscapes (cross-pillar use).

   Library-UI groepeert series per pijler via SERIES_PILLAR. Volgorde binnen
   een pijler komt uit PILLAR_SERIES_ORDER (= bewuste curatie). Series die
   niet in PILLAR_SERIES_ORDER staan vallen NIET buiten de bibliotheek — ze
   verschijnen onderaan de pijler in alfabetische volgorde.

   Bestaande sessies houden hun structuur (geen pillar-veld per sessie). De
   pillar wordt afgeleid uit de seriesnaam. Geen breaking change voor
   history, favorites of de bestaande UI.
   ════════════════════════════════════════════════════════════════════════════ */

export type Pillar = 'resilience' | 'sovereignty' | 'social' | 'drive' | 'tools';

export const PILLAR_ORDER: Pillar[] = ['resilience', 'sovereignty', 'social', 'drive', 'tools'];

export const PILLAR_META: Record<Pillar, { num: string; name: string; tagline: string; img?: string }> = {
  resilience:  { num: '01', name: 'Psychological Resilience',     tagline: 'Build what cannot break.',  img: 'https://vibezcore-audio.b-cdn.net/images/psychological%20resilience%202.png' },
  sovereignty: { num: '02', name: 'Inner Sovereignty',            tagline: 'Master what is yours.',     img: 'https://vibezcore-audio.b-cdn.net/images/Stoic%20mastery.jpg' },
  social:      { num: '03', name: 'Social Mastery',               tagline: 'Command without force.',    img: 'https://vibezcore-audio.b-cdn.net/images/master-mental-clarity.jpg' },
  drive:       { num: '04', name: 'Strategic Execution & Wealth', tagline: 'Engineer your autonomy.',   img: 'https://vibezcore-audio.b-cdn.net/images/Strategic%20wealth.jpg' },
  tools:       { num: '05', name: 'Tools & Practices',            tagline: 'Layered over everything.', img: 'https://vibezcore-audio.b-cdn.net/images/Workout%20on%20Beach_edited.jpg' },
};

/* Welke pijler hoort een serie bij? Bestaande 12 series gemapped per
   CLAUDE.md §4 thema-indeling. Nieuwe series (Bly, Miller, Aurelius, etc.)
   worden toegevoegd in Fase 2. */
export const SERIES_PILLAR: Record<string, Pillar> = {
  'Master Mental Clarity':    'resilience',
  'The Inner Blueprint':      'resilience',
  'The Father Wound':         'resilience',
  'The Mother Wound':         'resilience',
  'Fight Or Flight':      'resilience',
  'Meaning Over Comfort':     'sovereignty',
  'The Stoic Mind':       'sovereignty',
  'The Freedom Formula':      'sovereignty',
  'Time, Death & Legacy':     'sovereignty',
  'Become Who You Are':       'sovereignty',
  'Meaning Through Suffering':'sovereignty',
  /* iter 9dq v137 (operator 2026-06-15): Wu Wei ↔ Life After Betrayal
     gewisseld van pijler. Wu Wei past beter bij Social Mastery (effortless
     action in relations), Life After Betrayal past beter bij Inner
     Sovereignty (rebuilding self after trust-breach). */
  'The Way Of Wu Wei':        'social',
  'Life After Betrayal':      'sovereignty',
  'Power & Human Nature':     'social',
  'Attachment':               'social',
  'Dignity':                  'social',
  'Daily Discipline':         'social',
  'Identity & Wealth':        'drive',
  'Journey to Success':       'drive',
  'Beast Mode':               'drive',
  'Wealth Psychology':        'drive',
  'Iron Discipline':          'drive',
  'Purpose & Mission':        'drive',
  'Daily Affirmations Power': 'tools',
  'Soundscapes':              'tools',
};

/* Volgorde van series binnen elke pijler. Gecureerd, niet alfabetisch. */
/* Volgorde EXACT zoals op vibezcore.com audio-library widget (2026-06-14). */
export const PILLAR_SERIES_ORDER: Record<Pillar, string[]> = {
  resilience:  ['The Father Wound', 'The Mother Wound', 'Master Mental Clarity', 'The Inner Blueprint', 'Fight Or Flight'],
  /* iter 9dq v137 (operator 2026-06-15): zie SERIES_PILLAR-comment.
     Wu Wei + Life After Betrayal van pijler gewisseld. Volgorde binnen
     elke pijler: nieuwe binnenkomer aan het eind, rest ongewijzigd. */
  sovereignty: ['Meaning Over Comfort', 'The Stoic Mind', 'The Freedom Formula', 'Time, Death & Legacy', 'Become Who You Are', 'Meaning Through Suffering', 'Life After Betrayal'],
  social:      ['Power & Human Nature', 'Attachment', 'Dignity', 'Daily Discipline', 'The Way Of Wu Wei'],
  drive:       ['Identity & Wealth', 'Journey to Success', 'Beast Mode', 'Wealth Psychology', 'Iron Discipline', 'Purpose & Mission'],
  tools:       ['Daily Affirmations Power', 'Soundscapes'],
};

/* Helper: alle series voor een pijler in correcte volgorde. Series die niet
   in PILLAR_SERIES_ORDER staan komen onderaan alfabetisch. */
export function seriesForPillar(p: Pillar): string[] {
  const curated = PILLAR_SERIES_ORDER[p] || [];
  const all = Object.entries(SERIES_PILLAR)
    .filter(([, pill]) => pill === p)
    .map(([name]) => name);
  const extras = all.filter((name) => !curated.includes(name)).sort();
  return [...curated, ...extras];
}

/* Serie-subtitel (derde regel op de card) — exact uit bron card-sub. */
export const SERIES_SUB: Record<string,string> = {
  'Master Mental Clarity': 'Your brain is offline. Not broken.',
  'Beast Mode': 'Done With excuses.',
  'The Inner Blueprint': 'Understand yourself. Understand life.',
  'Daily Affirmations Power': 'The voice in your head was installed by others.',
  'Meaning Over Comfort': 'Your comfort zone became your prison.',
  'Journey to Success': 'Your future is being shaped by today\'s excuses.',
  'Life After Betrayal': 'Rise higher than the wound.',
  'Identity & Wealth': 'Wealth starts with identity, not income.',
  'The Freedom Formula': 'Stop drifting. Start directing.',
  'The Stoic Mind': 'The fortress of a free mind.',
  'Fight Or Flight': 'The alarm that never switched off.',
  'Soundscapes': 'Your mind won\'t stop. Learn to guide it.',
  /* ── Iter 9dq v128: 13 nieuwe reeksen ── */
  'The Father Wound':            'The man who shaped the man.',
  'The Mother Wound':            'The first relationship never leaves.',
  'Time, Death & Legacy':        'The question beneath every question.',
  'Become Who You Are':          'Live larger than the herd.',
  'Meaning Through Suffering':   'Meaning sustains what strength cannot.',
  'The Way Of Wu Wei':           'Strength through softness. Power through letting go.',
  'Power & Human Nature':        'See people clearly. Move accordingly.',
  'Attachment':                  'Why you love the way you do.',
  'Dignity':                     'The worth that does not require earning.',
  'Daily Discipline':            'Small actions. Compound results.',
  'Wealth Psychology':           'Why some build it. Why you have not.',
  'Iron Discipline':             'The hardness that protects what you love.',
  'Purpose & Mission':           'The direction you have been missing.',
};
