/**
 * Chat: a CHAT input becomes a CHAT event for the sender's team ("team") or
 * for everyone ("all"). The text is cleaned (line breaks become spaces,
 * control and direction-override characters go, the ends are trimmed) and
 * cut to CHAT_MAX_LENGTH characters; an empty message is dropped. A player
 * sends at most five messages in five seconds. Dead, stunned or taunted
 * champions still chat.
 */

import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { CHAT_MAX_LENGTH, GameEventType, InputType, type GameEvent } from '@siege/shared';
import { Simulation } from '../sim';
import { reachesSide } from '../network/eventAudience';

function setup(): Simulation {
  const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
  sim.addChampion({ playerId: 'p1', championId: 'warrior', side: 'blue', at: { x: 0, y: 0 } });
  sim.addChampion({ playerId: 'p2', championId: 'magnus', side: 'red', at: { x: 1500, y: 0 } });
  return sim;
}

function chats(sim: Simulation): GameEvent[] {
  return sim.recorder.events.filter(event => event.type === GameEventType.CHAT);
}

/** Send a message and let the server take it (spaced past the per-second rate limit) */
function say(sim: Simulation, text: unknown, scope: unknown = 'team', playerId = 'p1'): void {
  sim.input(playerId, { type: InputType.CHAT, text, scope } as never);
  sim.run(0.4);
}

function lastText(sim: Simulation): unknown {
  return chats(sim).at(-1)?.data.text;
}

describe('Chat messages', () => {
  test('a team message is an event with who said it, for the team', () => {
    const sim = setup();
    say(sim, 'push mid');
    const [message] = chats(sim);
    expect(message.data).toMatchObject({
      text: 'push mid',
      scope: 'team',
      side: 0,
      championId: 'warrior',
      entityId: sim.champion('p1').id,
    });
    sim.dispose();
  });

  test('a message to all says so', () => {
    const sim = setup();
    say(sim, 'gl hf', 'all');
    expect(chats(sim)[0].data).toMatchObject({ text: 'gl hf', scope: 'all', side: 0 });
    sim.dispose();
  });

  test('the red side chats too', () => {
    const sim = setup();
    say(sim, 'hola', 'team', 'p2');
    expect(chats(sim)[0].data).toMatchObject({ side: 1, championId: 'magnus' });
    sim.dispose();
  });

  test('a team message reaches only its side; a message to all reaches both, seen or not', () => {
    const at = (scope: string, side: number): GameEvent => ({ type: GameEventType.CHAT, timestamp: 0, data: { entityId: 'c1', side, scope, text: 'x' } });
    const unseen = () => false;
    expect(reachesSide(at('team', 0), 0, unseen)).toBe(true);
    expect(reachesSide(at('team', 0), 1, unseen)).toBe(false);
    expect(reachesSide(at('team', 1), 0, unseen)).toBe(false);
    expect(reachesSide(at('all', 0), 0, unseen)).toBe(true);
    expect(reachesSide(at('all', 0), 1, unseen)).toBe(true);
  });
});

describe('Cleaning the text', () => {
  test('the ends are trimmed', () => {
    const sim = setup();
    say(sim, '   on my way  ');
    expect(lastText(sim)).toBe('on my way');
    sim.dispose();
  });

  test('spaces inside are kept', () => {
    const sim = setup();
    say(sim, 'a  b   c');
    expect(lastText(sim)).toBe('a  b   c');
    sim.dispose();
  });

  test('an empty or blank message is dropped', () => {
    const sim = setup();
    for (const text of ['', '   ', '\n\t', '\u0000\u0007', '‮​']) say(sim, text);
    sim.run(5);
    expect(chats(sim)).toHaveLength(0);
    sim.dispose();
  });

  test('line breaks and tabs become spaces', () => {
    const sim = setup();
    say(sim, 'one\ntwo\r\nthree\tfour');
    expect(lastText(sim)).toBe('one two  three four');
    sim.dispose();
  });

  test('control characters and direction overrides go', () => {
    const sim = setup();
    say(sim, 'a\u0000b\u0007c\u007fd\u0085e‮f⁦g​h');
    expect(lastText(sim)).toBe('abcdefgh');
    sim.dispose();
  });

  test('a long message is cut to the maximum', () => {
    const sim = setup();
    expect(CHAT_MAX_LENGTH).toBe(150);
    say(sim, 'x'.repeat(400));
    expect(lastText(sim)).toBe('x'.repeat(CHAT_MAX_LENGTH));
    sim.dispose();
  });

  test('a message exactly the maximum is kept whole', () => {
    const sim = setup();
    say(sim, 'y'.repeat(CHAT_MAX_LENGTH));
    expect(lastText(sim)).toBe('y'.repeat(CHAT_MAX_LENGTH));
    sim.dispose();
  });

  test('cutting counts characters, not halves of an emoji', () => {
    const sim = setup();
    say(sim, '🙂'.repeat(200));
    const text = lastText(sim) as string;
    expect(Array.from(text)).toHaveLength(CHAT_MAX_LENGTH);
    expect(text).toBe('🙂'.repeat(CHAT_MAX_LENGTH));
    sim.dispose();
  });

  test('accents, ñ, emoji and markup pass as plain text', () => {
    const sim = setup();
    say(sim, 'buenísimo ñandú 🙂 <b>gg</b> & "x"');
    expect(lastText(sim)).toBe('buenísimo ñandú 🙂 <b>gg</b> & "x"');
    sim.dispose();
  });
});

describe('What the server refuses', () => {
  test('text that isn\'t a string, or no text', () => {
    const sim = setup();
    say(sim, 42);
    say(sim, null);
    say(sim, { text: 'x' });
    say(sim, ['x']);
    say(sim, undefined);
    expect(chats(sim)).toHaveLength(0);
    sim.dispose();
  });

  test('a scope other than team or all, or none', () => {
    const sim = setup();
    say(sim, 'hi', 'enemy');
    say(sim, 'hi', 1);
    say(sim, 'hi', null);
    // No scope at all
    sim.input('p1', { type: InputType.CHAT, text: 'hi' } as never);
    sim.run(0.4);
    expect(chats(sim)).toHaveLength(0);
    sim.dispose();
  });
});

describe('Spam', () => {
  test('five messages in five seconds, then the rest are dropped until it frees up', () => {
    const sim = setup();
    for (let i = 0; i < 7; i++) say(sim, `m${i}`);
    expect(chats(sim).map(event => event.data.text)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
    sim.run(5);
    say(sim, 'later');
    expect(lastText(sim)).toBe('later');
    sim.dispose();
  });

  test("one player's limit doesn't silence another", () => {
    const sim = setup();
    for (let i = 0; i < 6; i++) say(sim, `p1 ${i}`);
    say(sim, 'p2 here', 'all', 'p2');
    expect(lastText(sim)).toBe('p2 here');
    sim.dispose();
  });

  test('dropped messages (empty, refused) don\'t count toward the limit', () => {
    const sim = setup();
    for (let i = 0; i < 6; i++) say(sim, '   ');
    say(sim, 'real');
    expect(chats(sim).map(event => event.data.text)).toEqual(['real']);
    sim.dispose();
  });
});

describe('Chatting in any state', () => {
  test('a dead champion chats', () => {
    const sim = setup();
    const champion = sim.champion('p1');
    champion.takeDamage(100000, 'true', undefined, sim.context);
    expect(champion.isDead).toBe(true);
    say(sim, 'gg jungle');
    expect(lastText(sim)).toBe('gg jungle');
    sim.dispose();
  });

  test('a stunned champion chats', () => {
    const sim = setup();
    sim.champion('p1').applyEffect('stun', 3, sim.champion('p2').id);
    say(sim, 'help');
    expect(lastText(sim)).toBe('help');
    sim.dispose();
  });

  test('a taunted champion chats', () => {
    const sim = setup();
    sim.champion('p1').applyEffect('taunt', 3, sim.champion('p2').id);
    say(sim, 'taunted');
    expect(lastText(sim)).toBe('taunted');
    sim.dispose();
  });

  test('chatting stops nothing: the champion keeps walking', () => {
    const sim = setup();
    sim.input('p1', { type: InputType.MOVE, targetX: 400, targetY: 0 });
    sim.run(0.2);
    const before = sim.champion('p1').position.x;
    say(sim, 'walking');
    expect(sim.champion('p1').position.x).toBeGreaterThan(before);
    sim.dispose();
  });
});
