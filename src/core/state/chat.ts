/**
 * The match's chat (CHAT events): every line with who said it (an ally or
 * an enemy, the local player or not) and whether it was to all. ChatBox
 * (src/ui/ChatBox.ts) shows it: while the chat is closed, the last few
 * recent lines, fading after CHAT_FADE_MS; open, the last CHAT_SHOWN_OPEN.
 *
 * Also the draft's /all and /team commands, and whether a key was typed
 * into a text field (then it isn't the game's: InputManager and the other
 * key listeners skip it).
 */

import type { ChatScope } from '@siege/shared';

export interface ChatMessage {
  text: string;
  scope: ChatScope;
  /** Who said it */
  entityId: string;
  championId: string;
  /** On the local player's team */
  isAlly: boolean;
  /** The local player said it */
  isLocal: boolean;
  /** When it arrived (Date.now, ms) */
  time: number;
}

/** How long a line shows while the chat is closed (ms) */
export const CHAT_FADE_MS = 10_000;
/** Most lines shown while the chat is closed */
export const CHAT_SHOWN_CLOSED = 6;
/** Most lines shown while it's open */
export const CHAT_SHOWN_OPEN = 30;
/** Most lines kept */
export const CHAT_KEPT = 100;

export class ChatLog {
  private messages: ChatMessage[] = [];
  private listeners: (() => void)[] = [];

  add(message: ChatMessage): void {
    this.messages.push(message);
    if (this.messages.length > CHAT_KEPT) this.messages.splice(0, this.messages.length - CHAT_KEPT);
    for (const listener of this.listeners) listener();
  }

  /** The lines to show now: open, the last many; closed, the last few still recent */
  lines(now: number, open: boolean): ChatMessage[] {
    if (open) return this.messages.slice(-CHAT_SHOWN_OPEN);
    return this.messages.slice(-CHAT_SHOWN_CLOSED).filter(message => now - message.time < CHAT_FADE_MS);
  }

  size(): number {
    return this.messages.length;
  }

  /** Hear about every new line */
  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }
}

const COMMANDS: Record<string, ChatScope> = { all: 'all', a: 'all', team: 'team', t: 'team' };

/**
 * What a draft sends: /all (or /a) at its start sends it to everyone,
 * /team (or /t) to the team; otherwise it goes where the chat was opened
 * for.
 */
export function parseChatDraft(draft: string, scope: ChatScope): { scope: ChatScope; text: string } {
  const text = draft.trim();
  const command = /^\/(\w+)(?:\s+|$)/.exec(text);
  const commandScope = command ? COMMANDS[command[1].toLowerCase()] : undefined;
  if (command && commandScope) return { scope: commandScope, text: text.slice(command[0].length).trim() };
  return { scope, text };
}

/** Inputs that take no typing */
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);

/** Whether a key event's target is somewhere text is typed (the chat, a name field) */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as { tagName?: string; type?: string; isContentEditable?: boolean } | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (element.tagName === 'TEXTAREA') return true;
  return element.tagName === 'INPUT' && !NON_TEXT_INPUTS.has(element.type ?? 'text');
}
