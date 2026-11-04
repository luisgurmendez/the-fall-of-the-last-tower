/**
 * The sound settings: a slider per volume (master, effects, ambience, music)
 * and a mute toggle, kept by AudioManager. In the in-match menu (GameMenu)
 * and the main menu's Settings.
 */

import { getAudio, type VolumeChannel } from "@/audio/AudioManager";

/** The volume sliders, in order */
const VOLUMES: { channel: VolumeChannel; label: string }[] = [
  { channel: "master", label: "Volume" },
  { channel: "sfx", label: "Effects" },
  { channel: "ambience", label: "Ambience" },
  { channel: "music", label: "Music" },
];

/** A slider per volume and a mute toggle */
export function createSoundControls(): HTMLElement {
  const audio = getAudio();
  const section = document.createElement("div");
  section.className = "game-menu-sound";
  for (const { channel, label } of VOLUMES) {
    const row = document.createElement("label");
    row.className = "game-menu-volume";
    const name = document.createElement("span");
    name.textContent = label;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(Math.round(audio.getVolume(channel) * 100));
    slider.addEventListener("input", () => audio.setVolume(channel, Number(slider.value) / 100));
    // Shown again (the other menu may have moved it): the current value
    section.addEventListener("refresh", () => (slider.value = String(Math.round(audio.getVolume(channel) * 100))));
    row.append(name, slider);
    section.append(row);
  }
  const mute = document.createElement("button");
  mute.className = "pixel-button game-menu-mute";
  const label = () => (mute.textContent = audio.isMuted() ? "Sound: off" : "Sound: on");
  label();
  mute.addEventListener("click", () => {
    audio.setMuted(!audio.isMuted());
    label();
  });
  section.addEventListener("refresh", label);
  section.append(mute);
  return section;
}
