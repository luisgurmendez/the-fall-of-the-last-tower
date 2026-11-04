/**
 * Chat on the client (src/core/state/chat.ts): CHAT events go into the
 * state manager's chat log with who said it (an ally or an enemy, you or
 * not) and whether it was to all. While the chat is closed only the last
 * few recent lines show, fading after a while; open, the last many show.
 * A draft starting with /all (or /a) goes to everyone, /team (or /t) to the
 * team. Keys typed into a text field aren't the game's.
 */
import { describe, it, expect } from 'bun:test';
import { GameEventType } from '@siege/shared';
import { OnlineStateManager } from '@/core/OnlineStateManager';
import {
  CHAT_FADE_MS,
  CHAT_KEPT,
  CHAT_SHOWN_CLOSED,
  CHAT_SHOWN_OPEN,
  ChatLog,
  isTypingTarget,
  parseChatDraft,
  type ChatMessage,
} from '@/core/state/chat';

function manager(): OnlineStateManager {
  return new OnlineStateManager({
    gameId: 'game',
    yourSide: 0,
    yourPlayerId: 'player-local',
    players: [{ playerId: 'player-local', championId: 'warrior', side: 0, entityId: 'champ-local' }],
  });
}

const chatEvent = (data: Record<string, unknown>) => ({ type: GameEventType.CHAT, timestamp: 1, data });

function message(text: string, time: number, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { text, time, scope: 'team', championId: 'warrior', entityId: 'a', isAlly: true, isLocal: false, ...extra };
}

describe('Chat events', () => {
  it("go into the log, with who said it and to whom", () => {
    const state = manager();
    state.processStateUpdate({
      tick: 1, timestamp: Date.now(), gameTime: 1, deltas: [],
      events: [
        chatEvent({ entityId: 'champ-local', side: 0, championId: 'warrior', scope: 'team', text: 'push' }),
        chatEvent({ entityId: 'champ-enemy', side: 1, championId: 'magnus', scope: 'all', text: 'gg' }),
        chatEvent({ entityId: 'champ-ally', side: 0, championId: 'elara', scope: 'all', text: 'gl' }),
      ],
    } as never);
    const lines = state.getChat().lines(Date.now(), true);
    expect(lines.map(line => line.text)).toEqual(['push', 'gg', 'gl']);
    expect(lines[0]).toMatchObject({ isLocal: true, isAlly: true, scope: 'team', championId: 'warrior' });
    expect(lines[1]).toMatchObject({ isLocal: false, isAlly: false, scope: 'all', championId: 'magnus' });
    expect(lines[2]).toMatchObject({ isLocal: false, isAlly: true, scope: 'all', championId: 'elara' });
  });

  it("a player's name, when the match knows it (an account, a room)", () => {
    const state = new OnlineStateManager({
      gameId: 'game',
      yourSide: 0,
      yourPlayerId: 'player-local',
      players: [
        { playerId: 'player-local', championId: 'warrior', side: 0, entityId: 'champ-local', name: 'Luis' },
        { playerId: 'player-guest', championId: 'magnus', side: 1, entityId: 'champ-guest' },
      ],
    } as never);
    state.processStateUpdate({
      tick: 1, timestamp: Date.now(), gameTime: 1, deltas: [],
      events: [
        chatEvent({ entityId: 'champ-local', side: 0, championId: 'warrior', scope: 'team', text: 'a' }),
        chatEvent({ entityId: 'champ-guest', side: 1, championId: 'magnus', scope: 'all', text: 'b' }),
      ],
    } as never);
    const [named, guest] = state.getChat().lines(Date.now(), true);
    expect(named.name).toBe('Luis');
    expect(guest.name).toBeUndefined();
  });

  it('a malformed event (no text) is skipped', () => {
    const state = manager();
    state.processStateUpdate({
      tick: 1, timestamp: Date.now(), gameTime: 1, deltas: [],
      events: [chatEvent({ entityId: 'x', side: 0, championId: 'warrior', scope: 'team' })],
    } as never);
    expect(state.getChat().lines(Date.now(), true)).toHaveLength(0);
  });

  it('a message about markup stays text', () => {
    const state = manager();
    state.processStateUpdate({
      tick: 1, timestamp: Date.now(), gameTime: 1, deltas: [],
      events: [chatEvent({ entityId: 'x', side: 1, championId: 'vex', scope: 'all', text: '<img src=x onerror=alert(1)>' })],
    } as never);
    expect(state.getChat().lines(Date.now(), true)[0].text).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('Players who leave and come back', () => {
  const connection = (data: Record<string, unknown>) => ({ type: GameEventType.PLAYER_CONNECTION, timestamp: 1, data });
  const linesAfter = (...events: unknown[]) => {
    const state = manager();
    state.processStateUpdate({ tick: 1, timestamp: Date.now(), gameTime: 1, deltas: [], events } as never);
    return state.getChat().lines(Date.now(), true);
  };

  it('a bot playing for someone is a line in the chat, from no one', () => {
    const [line] = linesAfter(connection({ entityId: 'champ-ally', side: 0, championId: 'vex', status: 'bot' }));
    expect(line).toMatchObject({ system: true, championId: 'vex', isAlly: true });
    expect(line.text).toBe('Vex lost their connection: a bot plays for them until they are back');
  });

  it('an enemy too', () => {
    const [line] = linesAfter(connection({ entityId: 'champ-enemy', side: 1, championId: 'magnus', status: 'bot' }));
    expect(line).toMatchObject({ system: true, isAlly: false });
    expect(line.text).toBe('Magnus lost their connection: a bot plays for them until they are back');
  });

  it('coming back is a line too', () => {
    const [line] = linesAfter(connection({ entityId: 'champ-enemy', side: 1, championId: 'magnus', status: 'back' }));
    expect(line.text).toBe('Magnus is back');
  });

  it('the local player coming back reads as them', () => {
    const [line] = linesAfter(connection({ entityId: 'champ-local', side: 0, championId: 'warrior', status: 'back' }));
    expect(line).toMatchObject({ system: true, isLocal: true });
    expect(line.text).toBe('You are back: the bot let go of your champion');
  });

  it('an unknown status or champion still reads', () => {
    expect(linesAfter(connection({ entityId: 'x', side: 0, championId: 'warrior', status: 'gone' }))).toHaveLength(0);
    const [line] = linesAfter(connection({ entityId: 'x', side: 1, championId: 'nobody', status: 'bot' }));
    expect(line.text).toBe('nobody lost their connection: a bot plays for them until they are back');
  });
});

describe('ChatLog', () => {
  it('closed: the last few lines, only while recent', () => {
    const log = new ChatLog();
    for (let i = 0; i < CHAT_SHOWN_CLOSED + 3; i++) log.add(message(`m${i}`, 1000 + i));
    const shown = log.lines(1000 + 10, false);
    expect(shown).toHaveLength(CHAT_SHOWN_CLOSED);
    expect(shown.at(-1)?.text).toBe(`m${CHAT_SHOWN_CLOSED + 2}`);
    expect(shown[0].text).toBe('m3');
  });

  it('closed: a line goes when its time is up', () => {
    const log = new ChatLog();
    log.add(message('old', 1000));
    log.add(message('new', 5000));
    expect(log.lines(1000 + CHAT_FADE_MS - 1, false).map(line => line.text)).toEqual(['old', 'new']);
    expect(log.lines(1000 + CHAT_FADE_MS, false).map(line => line.text)).toEqual(['new']);
    expect(log.lines(5000 + CHAT_FADE_MS, false)).toHaveLength(0);
  });

  it('open: the last many, old or not', () => {
    const log = new ChatLog();
    for (let i = 0; i < CHAT_SHOWN_OPEN + 5; i++) log.add(message(`m${i}`, i));
    const shown = log.lines(10_000_000, true);
    expect(shown).toHaveLength(CHAT_SHOWN_OPEN);
    expect(shown.at(-1)?.text).toBe(`m${CHAT_SHOWN_OPEN + 4}`);
  });

  it('keeps a limited history', () => {
    const log = new ChatLog();
    for (let i = 0; i < CHAT_KEPT + 50; i++) log.add(message(`m${i}`, i));
    expect(log.size()).toBe(CHAT_KEPT);
    expect(CHAT_SHOWN_OPEN).toBeLessThanOrEqual(CHAT_KEPT);
  });

  it('an empty log shows nothing, open or closed', () => {
    const log = new ChatLog();
    expect(log.lines(0, false)).toEqual([]);
    expect(log.lines(0, true)).toEqual([]);
  });

  it('tells listeners about new lines', () => {
    const log = new ChatLog();
    let heard = 0;
    log.onChange(() => heard++);
    log.add(message('a', 1));
    log.add(message('b', 2));
    expect(heard).toBe(2);
  });
});

describe('parseChatDraft', () => {
  it('plain text goes where the chat was opened for', () => {
    expect(parseChatDraft('hola', 'team')).toEqual({ scope: 'team', text: 'hola' });
    expect(parseChatDraft('hola', 'all')).toEqual({ scope: 'all', text: 'hola' });
  });

  it('/all and /a send to everyone', () => {
    expect(parseChatDraft('/all gl hf', 'team')).toEqual({ scope: 'all', text: 'gl hf' });
    expect(parseChatDraft('/a gl', 'team')).toEqual({ scope: 'all', text: 'gl' });
    expect(parseChatDraft('/ALL gg', 'team')).toEqual({ scope: 'all', text: 'gg' });
  });

  it('/team and /t send to the team', () => {
    expect(parseChatDraft('/team b', 'all')).toEqual({ scope: 'team', text: 'b' });
    expect(parseChatDraft('/t b', 'all')).toEqual({ scope: 'team', text: 'b' });
  });

  it('a command with nothing after it is an empty message', () => {
    expect(parseChatDraft('/all', 'team')).toEqual({ scope: 'all', text: '' });
    expect(parseChatDraft('/all   ', 'team')).toEqual({ scope: 'all', text: '' });
  });

  it('a slash word that isn\'t a command is just text', () => {
    expect(parseChatDraft('/allin now', 'team')).toEqual({ scope: 'team', text: '/allin now' });
    expect(parseChatDraft('/shrug', 'team')).toEqual({ scope: 'team', text: '/shrug' });
    expect(parseChatDraft('a /all b', 'team')).toEqual({ scope: 'team', text: 'a /all b' });
  });

  it('trims the ends', () => {
    expect(parseChatDraft('   hi  ', 'team')).toEqual({ scope: 'team', text: 'hi' });
  });
});

describe('isTypingTarget', () => {
  it('text fields and editable elements are typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
  });

  it('the page, the canvas, buttons and nothing are not', () => {
    expect(isTypingTarget({ tagName: 'CANVAS' } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: 'BODY', isContentEditable: false } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({} as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('range sliders and checkboxes are inputs that take no typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'range' } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'text' } as unknown as EventTarget)).toBe(true);
  });
});
