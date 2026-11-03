/**
 * The pings' and emotes' pixel art: small grids of palette letters, drawn
 * once into canvases (drawn scaled with drawPixelArt). Pings are 11 pixels
 * square, emotes 13.
 */

import type { EmoteId, PingType } from '@siege/shared';

const PALETTE: Record<string, string> = {
  k: '#1b1325', // outline
  w: '#ffffff',
  y: '#ffd23f', // yellow
  Y: '#e09a1c',
  r: '#e43b44', // red
  R: '#a52a36',
  b: '#4fa4f4', // blue
  B: '#2a5fa8',
  g: '#3fd16b', // green
  G: '#1f8a43',
  p: '#f77b8e', // pink
  m: '#5a2030', // mouth
  n: '#2b2b3a', // sunglasses
  c: '#7fd3ff', // tears
};

const PING_ART: Record<PingType, string[]> = {
  // An eye: look here
  look: [
    '...........',
    '...kkkkk...',
    '.kkwwwwwkk.',
    'kwwwkkkwwwk',
    'kwwkbbbkwwk',
    'kwwkbkbkwwk',
    'kwwkbbbkwwk',
    'kwwwkkkwwwk',
    '.kkwwwwwkk.',
    '...kkkkk...',
    '...........',
  ],
  // A warning sign
  danger: [
    '.....k.....',
    '....krk....',
    '....krk....',
    '...krrrk...',
    '...krwrk...',
    '..krrwrrk..',
    '..krrwrrk..',
    '.krrrrrrrk.',
    '.krrrwrrrk.',
    'krrrrrrrrrk',
    'kkkkkkkkkkk',
  ],
  // An arrow down onto the spot
  on_my_way: [
    '...kkkkk...',
    '...kgggk...',
    '...kgggk...',
    '...kgGgk...',
    'kkkkgGgkkkk',
    '.kggggGgggk',
    '..kgggGggk.',
    '...kggggk..',
    '....kggk...',
    '.....kk....',
    '...........',
  ],
  // A question mark
  missing: [
    '..kkkkkkk..',
    '.kyyyyyyyk.',
    'kyyykkkyyyk',
    'kyyk...kyyk',
    '.kk...kyyyk',
    '.....kyyyk.',
    '....kyyyk..',
    '....kyyk...',
    '.....kk....',
    '....kyyk...',
    '....kkkk...',
  ],
  // A shield with a cross: help
  assist: [
    '.kkkkkkkkk.',
    'kbbbbbbbbbk',
    'kbbbbwbbbbk',
    'kbbbbwbbbbk',
    'kbbwwwwwbbk',
    'kbbbbwbbbbk',
    'kbbbbwbbbbk',
    '.kbbbbbbbk.',
    '.kBbbbbbBk.',
    '..kBBbBBk..',
    '...kkkkk...',
  ],
};

const EMOTE_ART: Record<EmoteId, string[]> = {
  laugh: [
    '....kkkkk....',
    '..kkyyyyykk..',
    '.kyyyyyyyyyk.',
    '.kyyyyyyyyyk.',
    'kyykyyyyykyyk',
    'kykykyyykykyk',
    'kyyyyyyyyyyyk',
    'kyykkkkkkkyyk',
    'kyykmmmmmkyyk',
    '.kyykpppkyyk.',
    '.kYyykkkyyYk.',
    '..kkYYYYYkk..',
    '....kkkkk....',
  ],
  cool: [
    '....kkkkk....',
    '..kkyyyyykk..',
    '.kyyyyyyyyyk.',
    '.kyyyyyyyyyk.',
    'kknnnnnnnnnkk',
    'kynnwnynnwnyk',
    'kyynnnynnnyyk',
    'kyyyyyyyyyyyk',
    'kyyyyyyyykyyk',
    '.kyykkkkkyyk.',
    '.kYyyyyyyyYk.',
    '..kkYYYYYkk..',
    '....kkkkk....',
  ],
  angry: [
    '....kkkkk....',
    '..kkrrrrrkk..',
    '.krrrrrrrrrk.',
    '.krkkrrrkkrk.',
    'krrrkkrkkrrrk',
    'krrwkrrrkwrrk',
    'krrrrrrrrrrrk',
    'krrrrrrrrrrrk',
    'krrrkkkkkrrrk',
    '.krkrrrrrkrk.',
    '.kRrrrrrrrRk.',
    '..kkRRRRRkk..',
    '....kkkkk....',
  ],
  cry: [
    '....kkkkk....',
    '..kkyyyyykk..',
    '.kyyyyyyyyyk.',
    '.kyyyyyyyyyk.',
    'kyykkyyykkyyk',
    'kyyckyyyckyyk',
    'kyycyyyyycyyk',
    'kyycykkkycyyk',
    'kyycky.kycyyk',
    '.kycyyyyycyk.',
    '.kYcyyyyycYk.',
    '..kkYYYYYkk..',
    '....kkkkk....',
  ],
  shock: [
    '....kkkkk....',
    '..kkyyyyykk..',
    '.kyykyyykyyk.',
    '.kyyyyyyyyyk.',
    'kyykkyyykkyyk',
    'kykwwkykwwkyk',
    'kyykkyyykkyyk',
    'kyyyykkkyyyyk',
    'kyyykmmmkyyyk',
    '.kyykmmmkyyk.',
    '.kYyykkkyyYk.',
    '..kkYYYYYkk..',
    '....kkkkk....',
  ],
  heart: [
    '.............',
    '..kkk...kkk..',
    '.krrrk.krrrk.',
    'krwrrrkrrrrrk',
    'krwrrrrrrrrrk',
    'krrrrrrrrrrrk',
    'krrrrrrrrrrRk',
    '.krrrrrrrrRk.',
    '..krrrrrrRk..',
    '...krrrrRk...',
    '....krrRk....',
    '.....kRk.....',
    '......k......',
  ],
  thumbs_up: [
    '.....kk......',
    '....kyyk.....',
    '....kyyk.....',
    '...kyyyk.....',
    '..kyyyykkkkk.',
    'kkkyyyyyyyyYk',
    'kbkyyyyykkkk.',
    'kbkyyyyyyyyYk',
    'kbkyyyyykkkk.',
    'kbkyyyyyyyYk.',
    'kbkyyyyykkk..',
    'kbkYYYYYYk...',
    'kkkkkkkkk....',
  ],
  gg: [
    '.............',
    'kkkkkkkkkkkkk',
    'kBBBBBBBBBBBk',
    'kBkkkkBkkkkBk',
    'kkwwwkkwwwkBk',
    'kwkkkkwkkkkBk',
    'kwkwwkwkwwkBk',
    'kwkkwkwkkwkBk',
    'kkwwwkkwwwkBk',
    'kBkkkkBkkkkBk',
    'kBBBBBBBBBBBk',
    'kkkkkkkkkkkkk',
    '.............',
  ],
};

function paint(art: string[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = art[0].length;
  canvas.height = art.length;
  const ctx = canvas.getContext('2d')!;
  art.forEach((row, y) => {
    [...row].forEach((letter, x) => {
      const color = PALETTE[letter];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

const pingCanvases = new Map<PingType, HTMLCanvasElement>();
const emoteCanvases = new Map<EmoteId, HTMLCanvasElement>();

export function pingIcon(type: PingType): HTMLCanvasElement {
  let canvas = pingCanvases.get(type);
  if (!canvas) pingCanvases.set(type, canvas = paint(PING_ART[type]));
  return canvas;
}

export function emoteIcon(emote: EmoteId): HTMLCanvasElement {
  let canvas = emoteCanvases.get(emote);
  if (!canvas) emoteCanvases.set(emote, canvas = paint(EMOTE_ART[emote]));
  return canvas;
}

/** Each ping's color (its marker's rings) and name (the ping wheel) */
export const PING_STYLE: Record<PingType, { color: string; label: string }> = {
  look: { color: '#7fd3ff', label: 'Look' },
  danger: { color: '#e43b44', label: 'Danger' },
  on_my_way: { color: '#3fd16b', label: 'On my way' },
  missing: { color: '#ffd23f', label: 'Missing' },
  assist: { color: '#4fa4f4', label: 'Help' },
};

/** Each emote's name (the emote wheel) */
export const EMOTE_LABELS: Record<EmoteId, string> = {
  laugh: 'Haha',
  cool: 'Cool',
  angry: 'Grr',
  cry: 'Sad',
  shock: 'Whoa',
  heart: 'Love',
  thumbs_up: 'Nice',
  gg: 'GG',
};

/** For tests: every grid is a square of its size */
export const ART_FOR_TESTS = { PING_ART, EMOTE_ART };
