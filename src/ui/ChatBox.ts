/**
 * ChatBox - The match's chat, at the left of the screen above the HUD.
 *
 * Enter opens it for the team, Shift+Enter for everyone (/all and /team at
 * the start of a message choose too, and Tab switches while typing). Enter
 * sends and closes it; Escape closes it without sending. While it's open
 * the keys typed are the chat's, not the game's (InputManager skips them).
 *
 * Closed, it shows the last few lines for a while (they fade); open, the
 * last many over a dark backdrop. Lines are the chat log's
 * (src/core/state/chat.ts), drawn as text: what players type never becomes
 * markup.
 */

import { CHAT_MAX_LENGTH, getChampionDefinition, type ChatScope } from "@siege/shared";
import type { NetworkClient } from "@siege/client";
import { CHAT_FADE_MS, isTypingTarget, parseChatDraft, type ChatLog, type ChatMessage } from "@/core/state/chat";

/** A closed chat's lines fade over their last this many ms */
const FADE_OUT_MS = 2000;

const SCOPE_LABELS: Record<ChatScope, string> = { team: "Team", all: "All" };

export class ChatBox {
  private readonly root: HTMLDivElement;
  private readonly lines: HTMLDivElement;
  private readonly inputRow: HTMLDivElement;
  private readonly scopeLabel: HTMLSpanElement;
  private readonly input: HTMLInputElement;
  private scope: ChatScope = "team";
  private open = false;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(private readonly chat: ChatLog, private readonly networkClient: NetworkClient) {
    this.root = document.createElement("div");
    this.root.className = "chat-box";

    this.lines = document.createElement("div");
    this.lines.className = "chat-lines";

    this.inputRow = document.createElement("div");
    this.inputRow.className = "chat-input-row";
    this.inputRow.hidden = true;
    this.scopeLabel = document.createElement("span");
    this.scopeLabel.className = "chat-input-scope";
    this.input = document.createElement("input");
    this.input.className = "chat-input";
    this.input.maxLength = CHAT_MAX_LENGTH;
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.input.addEventListener("keydown", this.onInputKey);
    // Clicking back into the game closes it
    this.input.addEventListener("blur", () => this.close());
    this.inputRow.append(this.scopeLabel, this.input);

    this.root.append(this.lines, this.inputRow);
    document.body.append(this.root);

    window.addEventListener("keydown", this.onWindowKey);
    chat.onChange(() => this.render());
    // Closed lines fade as time passes
    this.timer = setInterval(() => this.render(), 250);
  }

  isOpen(): boolean {
    return this.open;
  }

  dispose(): void {
    clearInterval(this.timer);
    window.removeEventListener("keydown", this.onWindowKey);
    this.root.remove();
  }

  /** Enter opens it (Shift+Enter for everyone), unless typing somewhere else */
  private readonly onWindowKey = (event: KeyboardEvent) => {
    if (this.open || event.key !== "Enter" || isTypingTarget(event.target)) return;
    event.preventDefault();
    this.openFor(event.shiftKey ? "all" : "team");
  };

  private readonly onInputKey = (event: KeyboardEvent) => {
    // The game's own listeners don't hear what's typed here
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      this.send();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.close();
    } else if (event.key === "Tab") {
      event.preventDefault();
      this.scope = this.scope === "team" ? "all" : "team";
      this.render();
    }
  };

  private openFor(scope: ChatScope): void {
    this.scope = scope;
    this.open = true;
    this.inputRow.hidden = false;
    this.input.value = "";
    this.render();
    this.input.focus();
  }

  private close(): void {
    if (!this.open) return;
    this.open = false;
    this.inputRow.hidden = true;
    this.input.blur();
    this.render();
  }

  private send(): void {
    const { scope, text } = parseChatDraft(this.input.value, this.scope);
    if (text !== "") this.networkClient.sendChatInput(text, scope);
    this.close();
  }

  private render(): void {
    const now = Date.now();
    this.root.classList.toggle("open", this.open);
    this.scopeLabel.textContent = `[${SCOPE_LABELS[this.scope]}]`;
    this.scopeLabel.classList.toggle("all", this.scope === "all");
    const lines = this.chat.lines(now, this.open);
    this.lines.replaceChildren(...lines.map(message => this.line(message, now)));
    if (this.open) this.lines.scrollTop = this.lines.scrollHeight;
  }

  private line(message: ChatMessage, now: number): HTMLDivElement {
    const line = document.createElement("div");
    line.className = "chat-line";
    if (!this.open) {
      const left = CHAT_FADE_MS - (now - message.time);
      line.style.opacity = String(Math.max(0, Math.min(1, left / FADE_OUT_MS)));
    }
    // The game's own lines: no name, in their own color
    if (message.system) {
      line.classList.add("system");
      line.textContent = message.text;
      return line;
    }
    if (message.scope === "all") {
      const scope = document.createElement("span");
      scope.className = "chat-scope";
      scope.textContent = "[All] ";
      line.append(scope);
    }
    const name = document.createElement("span");
    name.className = `chat-name ${message.isLocal ? "local" : message.isAlly ? "ally" : "enemy"}`;
    name.textContent = `${getChampionDefinition(message.championId)?.name ?? message.championId}: `;
    const text = document.createElement("span");
    text.className = "chat-text";
    text.textContent = message.text;
    line.append(name, text);
    return line;
  }
}
