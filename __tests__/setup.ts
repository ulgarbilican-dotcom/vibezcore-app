/* Gedeelde testopzet (20 okt 2026): opslag van het toestel in het geheugen,
   zodat logica-tests geen echt toestel nodig hebben. */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* Geluid: geen echte speler in een logica-test. */
jest.mock('expo-audio', () => {
  const player = () => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(async () => {}),
    replace: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    volume: 1,
    playing: false,
    currentTime: 0,
    duration: 0,
    isLoaded: true,
  });
  return {
    createAudioPlayer: jest.fn(player),
    setAudioModeAsync: jest.fn(async () => {}),
    setIsAudioActiveAsync: jest.fn(async () => {}),
    useAudioPlayer: jest.fn(player),
    useAudioPlayerStatus: jest.fn(() => ({ playing: false, currentTime: 0, duration: 0 })),
    AudioModule: {},
  };
});
