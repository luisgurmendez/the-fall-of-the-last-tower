/**
 * Sound lab (/sound-lab.html): every sound in soundCatalog.ts with a play
 * button per variant and its prompt, and a view to click to hear the picked
 * sound placed in the world, through AudioManager (distance fade and pan as
 * in a match). Use it to judge the generated sounds and their mix without a
 * match; regenerate one with scripts/generate-sounds.ts --only <key>.
 */

import { getChampionDefinition } from "@siege/shared";
import { SOUNDS, soundFiles, type SoundDef, type SoundKey } from "@/audio/soundCatalog";
import { getAudio } from "@/audio/AudioManager";

/** World units across the pad, like the camera all the way out */
const VIEW_WIDTH = 900;
/** The pad shows this much more than the screen, to hear sounds fade past its edge */
const PAD_ZOOM_OUT = 2;

const audio = getAudio();
audio.setListener(0, 0, VIEW_WIDTH);
let selected: SoundKey = "hit_physical";

// Variants are played straight, at the catalog's volume
let context: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
function playFile(file: string, volume: number): void {
  context ??= new AudioContext();
  const ctx = context;
  if (!buffers.has(file)) buffers.set(file, fetch(file).then(r => r.arrayBuffer()).then(data => ctx.decodeAudioData(data)));
  void buffers.get(file)!.then(buffer => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
  }).catch(() => console.warn(`[soundLab] can't play ${file}`));
}

/** A champion's abilities under its name (their keys start with its id), the rest by bus */
function groupOf(key: SoundKey): string {
  const champion = getChampionDefinition(key.split("_")[0]);
  return champion ? `${champion.name}'s abilities` : (SOUNDS[key] as SoundDef).bus ?? "sfx";
}

function renderList(): void {
  const list = document.getElementById("sounds")!;
  const groups = new Map<string, SoundKey[]>();
  for (const key of Object.keys(SOUNDS) as SoundKey[]) {
    const group = groupOf(key);
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }
  for (const [group, keys] of groups) {
    const heading = document.createElement("h2");
    heading.textContent = group;
    list.append(heading);
    for (const key of keys) {
      const def: SoundDef = SOUNDS[key];
      const row = document.createElement("div");
      row.className = "sound";
      row.dataset.key = key;
      const name = document.createElement("span");
      name.className = "key";
      name.textContent = `${key}${def.loop ? " (loop)" : ""}`;
      row.append(name);
      soundFiles(key).forEach((file, n) => {
        const play = document.createElement("button");
        play.textContent = `▶ ${n + 1}`;
        play.addEventListener("click", (event) => {
          event.stopPropagation();
          playFile(file, def.volume ?? 1);
        });
        row.append(play);
      });
      const prompt = document.createElement("span");
      prompt.className = "prompt";
      prompt.textContent = `${def.duration}s: ${def.prompt}`;
      row.append(prompt);
      row.addEventListener("click", () => select(key));
      list.append(row);
    }
  }
  select(selected);
}

function select(key: SoundKey): void {
  selected = key;
  for (const row of document.querySelectorAll<HTMLElement>(".sound")) {
    row.classList.toggle("selected", row.dataset.key === key);
  }
  drawPad();
}

function drawPad(at?: { x: number; y: number }): void {
  const pad = document.getElementById("pad") as HTMLCanvasElement;
  const ctx = pad.getContext("2d")!;
  const scale = pad.width / (VIEW_WIDTH * PAD_ZOOM_OUT);
  ctx.clearRect(0, 0, pad.width, pad.height);
  // The screen, and the camera in its middle
  const screenW = VIEW_WIDTH * scale;
  const screenH = screenW * 0.53;
  ctx.strokeStyle = "#3d5585";
  ctx.strokeRect(pad.width / 2 - screenW / 2, pad.height / 2 - screenH / 2, screenW, screenH);
  ctx.fillStyle = "#f1c40f";
  ctx.fillRect(pad.width / 2 - 3, pad.height / 2 - 3, 6, 6);
  if (at) {
    ctx.fillStyle = "#ff5fa2";
    ctx.beginPath();
    ctx.arc(pad.width / 2 + at.x * scale, pad.height / 2 + at.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  document.getElementById("pad-info")!.textContent = at
    ? `${selected} at ${Math.round(at.x)}, ${Math.round(at.y)} (${Math.round(Math.hypot(at.x, at.y))} from the camera)`
    : `${selected}: click the view to play it there (the box is the screen)`;
}

function setUpPad(): void {
  const pad = document.getElementById("pad") as HTMLCanvasElement;
  pad.addEventListener("pointerdown", (event) => {
    const rect = pad.getBoundingClientRect();
    const scale = pad.width / (VIEW_WIDTH * PAD_ZOOM_OUT);
    const at = { x: (event.clientX - rect.left - pad.width / 2) / scale, y: (event.clientY - rect.top - pad.height / 2) / scale };
    drawPad(at);
    // The first click starts the audio (and starts loading the sounds)
    void audio.resume().then(() => {
      const handle = audio.play(selected, at);
      // A loop plays a few seconds
      if ((SOUNDS[selected] as SoundDef).loop) setTimeout(() => handle?.stop(0.5), 4000);
    });
  });
}

renderList();
setUpPad();
