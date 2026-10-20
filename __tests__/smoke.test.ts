import { rhythmFor } from '@/services/bracelet-haptics';
import { BraceletMode } from '@/services/ble-contract';

test('testomgeving draait en laadt app-code', () => {
  const r = rhythmFor(BraceletMode.Delta, 70);
  expect(r.startBpm).toBe(70);
  expect(r.targetBpm).toBeLessThan(70);
});
