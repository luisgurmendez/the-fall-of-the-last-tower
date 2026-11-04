/**
 * The menus' little sounds: chip blips like the music's (played by
 * ChiptunePlayer.blip on the ui bus, so they cost no files):
 * - hover: a faint tick on a new button, link or card under the pointer;
 * - click: any other button or menu link;
 * - confirm: PLAY, START, making or joining a room, choosing a mode (a rising arpeggio);
 * - back: back and cancel (falling);
 * - select: a champion, a summoner spell, a tab, a match in the history;
 * - error: an error shown (MatchmakingUI.showError).
 *
 * An element can name its own with data-sound (or "none"). The shop is left
 * alone: buying has its own sound.
 */

export type UiSound = "hover" | "click" | "confirm" | "back" | "select" | "error";

export interface UiSoundDef {
  /** Notes in order, each with its length in seconds */
  notes: [string, number][];
  wave: "pulse25" | "pulse12" | "square";
  gain: number;
}

export const UI_SOUNDS: Record<UiSound, UiSoundDef> = {
  hover: { notes: [["E6", 0.025]], wave: "pulse12", gain: 0.035 },
  click: { notes: [["C6", 0.03], ["G6", 0.04]], wave: "pulse25", gain: 0.07 },
  select: { notes: [["A5", 0.035], ["E6", 0.05]], wave: "pulse25", gain: 0.07 },
  confirm: { notes: [["C5", 0.05], ["E5", 0.05], ["G5", 0.05], ["C6", 0.12]], wave: "pulse25", gain: 0.08 },
  back: { notes: [["G5", 0.04], ["C5", 0.07]], wave: "pulse25", gain: 0.07 },
  error: { notes: [["E3", 0.08], ["C3", 0.14]], wave: "square", gain: 0.07 },
};

const CONFIRM = "#btn-play, #btn-lock-in, #btn-lobby-create, #btn-lobby-join, #btn-account-login, #btn-account-register, .mode-card-button, .play-button";
const BACK = ".mode-back, #btn-back-menu, .cancel-button";
const SELECT = ".champion-card, .summoner-spell, .profile-tab, .profile-match-row";
const CLICKABLE = "button, .menu-link, .profile-link, [role=button], [data-sound]";
/** Left alone (it has its own sounds) */
const SILENT = "#shop-overlay";

/** The sound a click on an element makes (null: none) */
export function uiSoundFor(target: Element): UiSound | null {
  if (target.closest(SILENT)) return null;
  const own = target.closest<HTMLElement>("[data-sound]")?.dataset.sound;
  if (own) return own === "none" ? null : (own as UiSound);
  const element = target.closest<HTMLElement>(`${SELECT}, ${CLICKABLE}`);
  if (!element || (element as HTMLButtonElement).disabled) return null;
  if (element.matches(CONFIRM)) return "confirm";
  if (element.matches(BACK)) return "back";
  if (element.matches(SELECT)) return "select";
  return "click";
}

/** Play the menus' sounds for clicks and hovers inside `root` */
export function attachUiSounds(root: HTMLElement, play: (sound: UiSound) => void): void {
  let hovered: Element | null = null;
  root.addEventListener("click", (event) => {
    const sound = event.target instanceof Element ? uiSoundFor(event.target) : null;
    if (sound) play(sound);
  });
  root.addEventListener("pointerover", (event) => {
    if (!(event.target instanceof Element)) return;
    const element = uiSoundFor(event.target) ? event.target.closest(`${SELECT}, ${CLICKABLE}`) : null;
    if (element === hovered) return;
    hovered = element;
    if (element) play("hover");
  });
}
