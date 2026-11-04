/**
 * Chat text as players send it, cleaned for everyone else's screen: line
 * breaks and tabs become spaces, control characters and the invisible ones
 * that reorder text (direction overrides, zero-width marks) go, the ends
 * are trimmed, and it's cut to CHAT_MAX_LENGTH characters (whole emoji).
 * Markup stays as typed: clients show it as plain text.
 */

import { CHAT_MAX_LENGTH } from '@siege/shared';

/** C0 and C1 controls (but tab and line breaks, which become spaces), and invisible reordering marks */
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function cleanChatText(text: string): string {
  const clean = text.replace(/[\r\n\t]/g, ' ').replace(INVISIBLE, '').trim();
  const characters = Array.from(clean);
  return characters.length > CHAT_MAX_LENGTH ? characters.slice(0, CHAT_MAX_LENGTH).join('').trimEnd() : clean;
}
