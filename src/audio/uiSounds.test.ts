import { describe, expect, it, beforeEach } from 'vitest';
import { attachUiSounds, uiSoundFor, UI_SOUNDS, type UiSound } from './uiSounds';
import { noteFrequency } from './music/notation';

function html(markup: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = markup;
  document.body.append(root);
  return root;
}

describe('uiSoundFor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('PLAY, START, making a room and choosing a mode confirm', () => {
    const root = html(`
      <button id="btn-play">▶ PLAY</button><button id="btn-lock-in">START</button>
      <button id="btn-lobby-create">CREATE ROOM</button><button class="mode-card-button">CHOOSE</button>`);
    for (const button of root.querySelectorAll('button')) expect(uiSoundFor(button)).toBe('confirm');
  });

  it('back and cancel go back', () => {
    const root = html(`<button class="mode-back">BACK</button><button id="btn-back-menu">BACK</button><button class="cancel-button">Cancel</button>`);
    for (const button of root.querySelectorAll('button')) expect(uiSoundFor(button)).toBe('back');
  });

  it('a champion, a summoner spell or a tab is picked', () => {
    const root = html(`<div class="champion-card"><span class="champion-card-name">Vex</span></div><button class="summoner-spell"></button><button class="profile-tab">PROFILE</button>`);
    expect(uiSoundFor(root.querySelector('.champion-card-name')!)).toBe('select');
    expect(uiSoundFor(root.querySelector('.summoner-spell')!)).toBe('select');
    expect(uiSoundFor(root.querySelector('.profile-tab')!)).toBe('select');
  });

  it('any other button or menu link clicks', () => {
    const root = html(`<button class="pixel-button">Controls</button><span class="menu-link">Settings</span>`);
    expect(uiSoundFor(root.querySelector('button')!)).toBe('click');
    expect(uiSoundFor(root.querySelector('.menu-link')!)).toBe('click');
  });

  it('an element can say its own sound, or none', () => {
    const root = html(`<button data-sound="confirm">Resume</button><button data-sound="none">Buy</button>`);
    const [resume, buy] = root.querySelectorAll('button');
    expect(uiSoundFor(resume)).toBe('confirm');
    expect(uiSoundFor(buy)).toBeNull();
  });

  it('plain text, sliders, disabled buttons and the shop (it has its own sounds) are silent', () => {
    const root = html(`
      <p>text</p><input type="range"><button disabled>Off</button>
      <div id="shop-overlay"><button>BUY</button></div>`);
    expect(uiSoundFor(root.querySelector('p')!)).toBeNull();
    expect(uiSoundFor(root.querySelector('input')!)).toBeNull();
    expect(uiSoundFor(root.querySelector('button[disabled]')!)).toBeNull();
    expect(uiSoundFor(root.querySelector('#shop-overlay button')!)).toBeNull();
  });
});

describe('attachUiSounds', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('a click plays its sound; hovering a new clickable thing ticks, once', () => {
    const played: UiSound[] = [];
    const root = html(`<button id="btn-play">PLAY</button><button class="pixel-button">Other</button><p>text</p>`);
    attachUiSounds(root, sound => played.push(sound));
    const [play, other] = root.querySelectorAll('button');
    play.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    play.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    play.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    other.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    root.querySelector('p')!.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(played).toEqual(['confirm', 'hover', 'hover']);
  });
});

describe('UI_SOUNDS', () => {
  it('each is a few short, playable notes', () => {
    for (const [name, sound] of Object.entries(UI_SOUNDS)) {
      expect(sound.notes.length, name).toBeGreaterThan(0);
      const length = sound.notes.reduce((total, [, seconds]) => total + seconds, 0);
      expect(length, name).toBeLessThanOrEqual(0.35);
      for (const [note] of sound.notes) expect(noteFrequency(note)).toBeGreaterThan(20);
      expect(sound.gain).toBeLessThanOrEqual(0.15);
    }
  });

  it('hovering is the quietest', () => {
    for (const [name, sound] of Object.entries(UI_SOUNDS)) {
      if (name !== 'hover') expect(sound.gain).toBeGreaterThan(UI_SOUNDS.hover.gain);
    }
  });
});
