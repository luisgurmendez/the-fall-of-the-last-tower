# Practice tools

In a practice match (you against bots: the mode screen's PRACTICE card), the player can bend the
match to try things: level up, get gold, reset cooldowns, refill health and mana, teleport, and turn
on no cooldowns, invulnerability and frozen bots. Any other match ignores them.

## The tools

| Tool | Key | What it does |
|------|-----|--------------|
| Level up | Shift+L | One level, earned like experience: its skill point and its stats. Nothing at 18. |
| Level 18 | Shift+M | Every level up to 18, each with its skill point. |
| +1000 gold | Shift+G | 1000 gold more (`PRACTICE_GOLD`). |
| Reset cooldowns | Shift+C | Ready: abilities (charges full, those swapped out too), summoner spells, item actives and the passive. A recast or a cast under way is left as it is. |
| Refill health and mana | Shift+H | Full health and mana. Dead, the champion respawns at the fountain at once. |
| Teleport | Shift+T | To the cursor (Shift+T) or the next left-click on the map or the minimap (the button; Escape stops waiting). Into a wall, the nearest spot the champion fits. It stands still there: a recall, a cast winding up, a dash or a walk ends. Not while dead. |
| No cooldowns | Shift+N | A toggle: after every tick, abilities, charges, summoner spells and item actives are ready again. Recast windows stay. |
| Invulnerable | Shift+I | A toggle: the champion takes no damage at all, true damage and killing blows included. |
| Freeze bots | Shift+B | A toggle: the bots do nothing (no orders, no shopping, no recalls) and stop where they are. Minions, towers and monsters go on. |

## Server

- **The input:** `InputType.PRACTICE_TOOL` (`PracticeToolInput`: `tool`, and `x`, `y` for a teleport).
  `GameRoom.handleInput` handles it itself, like SURRENDER, only when the room is practice and the
  player isn't a bot. An unknown tool, or a teleport without finite coordinates, does nothing.
- **Where it's done:** `packages/server/src/game/practiceTools.ts`.
  - `PracticeTools.use` applies a tool.
  - `afterTick` keeps cooldowns at zero for the players with no cooldowns on. `GameRoom.onTick` runs
    it after the game updates.
  - `botsFrozen` makes `GameRoom.onTick` skip the `BotDriver`.
  - The toggles are per player; freezing the bots is per room.
- **What the champions provide:**
  - `ServerChampion.resetCooldowns()` (the abilities', summoners' and item actives' own
    `resetCooldowns`).
  - `invulnerableInPractice`, read by `isInvulnerable()`.
- **The player is told:** each use sends a `PRACTICE_TOOLS` event:
  `{ entityId, tool, noCooldowns, invulnerable, freezeBots }`.
  - It's reliable, and goes out again with `tool: null` when the player reconnects.
  - `GAME_START` carries `practice`, on the start and on a reconnect.

Tests: `packages/server/src/test/PracticeTools.test.ts`.

## Client

- **The panel:** `src/ui/PracticePanel.ts`.
  - **Where:** on the right, only in practice (`MatchData.practice`).
  - **Showing and hiding it:** F2 or the Escape menu's "Practice tools" button. It's shown at
    first; the browser remembers it hidden (`localStorage["siege-practice-panel-hidden"]`).
  - **Its buttons:** a button per tool, with its key.
  - **The toggles:** show on or off as the server last said (`OnlineStateManager.getPracticeToggles()`,
    set from `PRACTICE_TOOLS` events in `gameEvents.ts`).
  - **Teleport's button:** it waits for a left-click.
    - The input handler gives the click to the panel first (`OnlineInputHandler.setWorldClickHandler`)
      when it's in the world (not on the HUD) or on the minimap.
    - That click then selects and casts nothing.
- **Sending:** `NetworkClient.sendPracticeTool(tool, x?, y?)`.

### Keys

Shift + a letter, fixed like F3's debug: `PRACTICE_TOOL_INFO` and `practiceToolForKey` in
`src/core/state/practiceTools.ts`.
- **How they're heard:** the panel listens before the game does (a capture listener on `window`).
  A tool's key goes no further, so Shift+Q is still a Q but Shift+L isn't an L.
- **Their letters:** Shift doesn't change what a key does in the game (`normalizeKey`), so the
  letters don't clash with the player's bindings.
- **When they're ignored:** with Ctrl, Alt or Cmd held, in the chat, and a held key's repeats.
- **The panel hidden:** they work hidden too.

Tests: `packages/client/src/test/PracticeTools.test.ts`.
