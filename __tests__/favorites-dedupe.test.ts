/* 29 okt 2026 (operator: "favorieten staan dubbel, verwijderen werkt niet"): dezelfde sessie met twee adresvormen (%20 en spatie) is EEN
   favoriet. */
jest.mock('@/utils/user-bucket', () => ({
  resolveActiveBucket: async () => 'u-test',
  ensureBucketLoaded: async () => 'u-test',
  getCurrentBucket: () => 'u-test',
  subscribeUserBucket: () => () => {},
}));

const ENC = 'https://vibezcore-audio.b-cdn.net/audio-new/1.%20CARL%20JUNG%2001.%20The%20Inner%20Child%20New.mp3';
const DEC = decodeURI(ENC);

describe('favorites keep one key per session', () => {
  it('two address forms of the same session become one favorite (newest wins)', async () => {
    const fav = require('../src/hooks/useFavorites');
    await fav.applyFavoritesSync([
      { url: ENC, title: 'The Inner Child', series: 'Carl Jung', ts: 1 },
      { url: DEC, title: 'The Inner Child', series: 'Carl Jung', ts: 2 },
    ]);
    const snap = await fav.getFavoritesSyncSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0].url).toBe(ENC);
    expect(snap[0].ts).toBe(2);
  });
});
