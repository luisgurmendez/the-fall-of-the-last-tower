/**
 * Summoner spell picker on champion select: two slots (D, F) showing the
 * picked spells; clicking one lists every spell to pick from (picking the
 * one in the other slot swaps them). The pick is kept in localStorage for
 * the next match and sent with the ready message.
 */

import {
  DEFAULT_SUMMONER_SPELLS,
  SUMMONER_SPELLS,
  SUMMONER_SPELL_IDS,
  parseSummonerSpells,
  type SummonerSpellId,
} from "@siege/shared";
import { summonerIconUrl } from "@/ui/summonerIcons";

const STORAGE_KEY = "siege-summoner-spells";
const KEYS = ["D", "F"];

export class SummonerPicker {
  private spells: [SummonerSpellId, SummonerSpellId];
  /** Slot whose options are showing, or null */
  private choosing: number | null = null;
  private readonly slots: HTMLElement;
  private readonly options: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    this.spells = this.load();
    this.slots = root.querySelector<HTMLElement>(".summoner-picker-slots")!;
    this.options = root.querySelector<HTMLElement>(".summoner-picker-options")!;
    this.render();
  }

  /** The picked spells (D, F) */
  getSpells(): [SummonerSpellId, SummonerSpellId] {
    return [...this.spells];
  }

  private load(): [SummonerSpellId, SummonerSpellId] {
    try {
      return parseSummonerSpells(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
    } catch {
      return [...DEFAULT_SUMMONER_SPELLS];
    }
  }

  private pick(slot: number, id: SummonerSpellId): void {
    const other = 1 - slot;
    if (this.spells[other] === id) this.spells[other] = this.spells[slot];
    this.spells[slot] = id;
    this.choosing = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.spells));
    } catch {
      // Storage unavailable: the pick lasts until the page reloads
    }
    this.render();
  }

  private render(): void {
    this.slots.replaceChildren(
      ...this.spells.map((id, slot) => {
        const button = this.spellButton(id, KEYS[slot]);
        button.classList.toggle("choosing", this.choosing === slot);
        button.addEventListener("click", () => {
          this.choosing = this.choosing === slot ? null : slot;
          this.render();
        });
        return button;
      }),
    );

    this.options.hidden = this.choosing === null;
    if (this.choosing === null) return;
    const slot = this.choosing;
    this.options.replaceChildren(
      ...SUMMONER_SPELL_IDS.map((id) => {
        const button = this.spellButton(id);
        button.classList.toggle("picked", this.spells.includes(id));
        button.addEventListener("click", () => this.pick(slot, id));
        return button;
      }),
    );
  }

  /** A spell's icon button, with its name and what it does on hover */
  private spellButton(id: SummonerSpellId, key?: string): HTMLButtonElement {
    const spell = SUMMONER_SPELLS[id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "summoner-spell";
    button.dataset.spell = id;
    button.title = `${spell.name}: ${spell.description} (cooldown ${spell.cooldown}s)`;

    const icon = document.createElement("img");
    icon.src = summonerIconUrl(id);
    icon.alt = spell.name;
    button.append(icon);

    const label = document.createElement("span");
    label.className = "summoner-spell-label";
    label.textContent = key ? `${key} ${spell.name}` : spell.name;
    button.append(label);
    return button;
  }
}
