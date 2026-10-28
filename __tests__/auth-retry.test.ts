/* Inloggen bij een trage (koude) backend: login mag één keer opnieuw, aanmaken van een account NIET
   (een time-out betekent niet dat het niet gelukt is — een tweede poging zou "bestaat al" geven). */
jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => (k in store ? store[k] : null),
      setItem: async (k: string, v: string) => { store[k] = v; },
      removeItem: async (k: string) => { delete store[k]; },
      multiRemove: async (ks: string[]) => { ks.forEach((k) => delete store[k]); },
      multiSet: async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => (store[k] = v)); },
      getAllKeys: async () => Object.keys(store),
    },
  };
});

const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
const okSession = { access_token: 'a.b.c', refresh_token: 'r', expires_in: 3600, user: { id: 'u1', email: 'x@y.z' } };

describe('auth-proxy time-outs', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.useRealTimers(); });

  it('login: first request hangs, second succeeds', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: any) => {
      calls.push(String(url));
      if (calls.length === 1) throw abortError();
      return { ok: true, status: 200, text: async () => JSON.stringify(okSession) } as any;
    }) as any;
    const { login } = require('@/services/auth');
    const r = await login('x@y.z', 'password1');
    expect(calls.length).toBe(2);
    expect(r.ok).toBe(true);
  });

  it('login: both attempts time out -> clear message', async () => {
    global.fetch = jest.fn(async () => { throw abortError(); }) as any;
    const { login } = require('@/services/auth');
    const r = await login('x@y.z', 'password1');
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timed out/i);
  });

  it('signup: one attempt only', async () => {
    global.fetch = jest.fn(async () => { throw abortError(); }) as any;
    const { signup } = require('@/services/auth');
    const r = await signup('x@y.z', 'password1');
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
    expect(r.ok).toBe(false);
  });
});
