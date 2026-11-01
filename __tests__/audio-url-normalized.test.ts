/* 1 nov 2026 (iOS build 68 #12): de Audio Library speelt genormaliseerde kopieën (-16 LUFS) uit /app-16lufs/. Elke sessie-URL uit de
   bibliotheek moet naar een bestaand pad gaan: de kopie als die er is, anders het origineel — en de sessie-URL zelf (sleutel voor
   favorieten/voortgang) verandert nooit. */
jest.mock('@/utils/api', () => ({ apiCall: jest.fn(), ApiError: class extends Error {} }));

import { getSignedAudioUrl } from '@/utils/audio-url';
import { NORMALIZED_AUDIO_PATHS } from '@/data/normalized-audio';
import { SESSIONS } from '@/data/audio-library-data';

const CDN = 'https://vibezcore-audio.b-cdn.net';

describe('normalized audio mapping', () => {
  it('maps a normalized session to its /app-16lufs/ copy with the same encoded path', async () => {
    const raw = `${CDN}/audio-new/1.%20CARL%20JUNG%2001.%20The%20Inner%20Child%20New.mp3`;
    await expect(getSignedAudioUrl(raw)).resolves.toBe(
      `${CDN}/app-16lufs/audio-new/1.%20CARL%20JUNG%2001.%20The%20Inner%20Child%20New.mp3`,
    );
  });

  it('keeps the original for a session that was already at -16 LUFS', async () => {
    const raw = `${CDN}/01-focus-theta-forest.mp3.mp3`;
    await expect(getSignedAudioUrl(raw)).resolves.toBe(raw);
  });

  it('every library URL resolves to the copy or the original, and nearly all are normalized', async () => {
    const urls = SESSIONS.map((s) => s.url).filter((u) => u.startsWith(CDN));
    let mapped = 0;
    for (const u of urls) {
      const out = await getSignedAudioUrl(u);
      if (out !== u) {
        expect(out).toBe(`${CDN}/app-16lufs${new URL(u).pathname}`);
        mapped++;
      }
    }
    /* 4 blijven op het origineel: 2 stonden al op -16 LUFS, 2 zijn .m4a */
    expect(mapped).toBeGreaterThanOrEqual(urls.length - 4);
    expect(NORMALIZED_AUDIO_PATHS.size).toBeGreaterThanOrEqual(mapped);
  });
});
