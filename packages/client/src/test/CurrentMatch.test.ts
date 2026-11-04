/**
 * Going back to a live match from the menu (src/ui/matchmaking/currentMatch.ts):
 * the browser keeps its last match (player id and session token) in
 * localStorage, so a new tab finds it; the server says whether there's a
 * match to go back to, for the account or that last match; the menu's
 * CONTINUE line reads the champion and the match's clock.
 */
import { describe, it, expect } from 'bun:test';
import {
  LAST_MATCH_KEY,
  continueLabel,
  fetchCurrentMatch,
  forgetLastMatch,
  readLastMatch,
  rememberLastMatch,
} from '@/ui/matchmaking/currentMatch';

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => { data[key] = value; },
    removeItem: (key: string) => { delete data[key]; },
  };
}

const MATCH = { playerId: 'p1', sessionToken: 's1', championId: 'nocthar', gameTime: 754, practice: false };

describe('the last match kept by the browser', () => {
  it('is remembered and read back', () => {
    const storage = memoryStorage();
    rememberLastMatch(storage, { playerId: 'p1', sessionToken: 's1' });
    expect(readLastMatch(storage)).toEqual({ playerId: 'p1', sessionToken: 's1' });
  });

  it('is forgotten (only if it is that match, when one is named)', () => {
    const storage = memoryStorage();
    rememberLastMatch(storage, { playerId: 'p1', sessionToken: 's1' });
    forgetLastMatch(storage, 'p2');
    expect(readLastMatch(storage)).not.toBeNull();
    forgetLastMatch(storage, 'p1');
    expect(readLastMatch(storage)).toBeNull();
    rememberLastMatch(storage, { playerId: 'p1', sessionToken: 's1' });
    forgetLastMatch(storage);
    expect(readLastMatch(storage)).toBeNull();
  });

  it('a broken or foreign value reads as none', () => {
    expect(readLastMatch(memoryStorage({ [LAST_MATCH_KEY]: '{oops' }))).toBeNull();
    expect(readLastMatch(memoryStorage({ [LAST_MATCH_KEY]: '{"playerId":5}' }))).toBeNull();
    expect(readLastMatch(memoryStorage({ [LAST_MATCH_KEY]: '{"playerId":"p","sessionToken":""}' }))).toBeNull();
    expect(readLastMatch(memoryStorage())).toBeNull();
  });

  it('no storage allowed: nothing kept, nothing read, no error', () => {
    rememberLastMatch(null, { playerId: 'p1', sessionToken: 's1' });
    expect(readLastMatch(null)).toBeNull();
    forgetLastMatch(null);
  });
});

describe('fetchCurrentMatch', () => {
  function recorder(answer: () => Promise<Response>) {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetchFn = (url: string, init?: RequestInit) => {
      calls.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
      return answer();
    };
    return { calls, fetchFn };
  }

  it("asks with the account's token and the last match, and answers the match", async () => {
    const { calls, fetchFn } = recorder(async () => new Response(JSON.stringify({ match: MATCH })));
    const match = await fetchCurrentMatch('http://localhost:8080', 'tok', { playerId: 'g1', sessionToken: 'gs' }, fetchFn);
    expect(match).toEqual(MATCH);
    expect(calls[0].url).toBe('http://localhost:8080/api/current-match');
    expect(calls[0].headers).toEqual({ Authorization: 'Bearer tok', 'X-Siege-Player': 'g1', 'X-Siege-Session': 'gs' });
  });

  it('sends only what it has (the tokens never in the address)', async () => {
    const { calls, fetchFn } = recorder(async () => new Response(JSON.stringify({ match: null })));
    expect(await fetchCurrentMatch('http://x', undefined, null, fetchFn)).toBeNull();
    expect(calls[0].headers).toEqual({});
    expect(calls[0].url).not.toContain('?');
  });

  it("can't reach the server, or a strange answer: no match (the menu stays as it is)", async () => {
    const down = recorder(async () => { throw new Error('offline'); });
    expect(await fetchCurrentMatch('http://x', 'tok', null, down.fetchFn)).toBeNull();
    const broken = recorder(async () => new Response('not json'));
    expect(await fetchCurrentMatch('http://x', 'tok', null, broken.fetchFn)).toBeNull();
    const failed = recorder(async () => new Response(JSON.stringify({ match: MATCH }), { status: 500 }));
    expect(await fetchCurrentMatch('http://x', 'tok', null, failed.fetchFn)).toBeNull();
    const partial = recorder(async () => new Response(JSON.stringify({ match: { playerId: 'p1' } })));
    expect(await fetchCurrentMatch('http://x', 'tok', null, partial.fetchFn)).toBeNull();
  });
});

describe('continueLabel', () => {
  it("reads the champion's name and the match's clock", () => {
    expect(continueLabel(MATCH, id => (id === 'nocthar' ? 'Nocthar' : id))).toBe('Nocthar · 12:34');
  });

  it('says when it is practice', () => {
    expect(continueLabel({ ...MATCH, practice: true, gameTime: 65 }, () => 'Vex')).toBe('Practice · Vex · 1:05');
  });

  it('a match just starting reads 0:00', () => {
    expect(continueLabel({ ...MATCH, gameTime: 0 }, () => 'Vex')).toBe('Vex · 0:00');
    expect(continueLabel({ ...MATCH, gameTime: -3 }, () => 'Vex')).toBe('Vex · 0:00');
  });
});
