# Debug mode

The debug overlay shows what the server thinks about each unit in sight,
drawn over the game. It works in practice matches only (a match against
bots: `startPracticeMatch` creates the room with `allowDebug`).

**Turning it on:** F3 (fn+F3 on a Mac) or the Escape menu's "Debug" button.
The performance profiler's panel moved to F4 (Shift+F4 logs its breakdown).
The practice tools (levels, teleport, no cooldowns...) are F2: see [practice.md](practice.md).

## What it shows

Over each unit the player's side sees (the fog still applies):

| Layer | What |
|-------|------|
| Hitboxes | Its collision circle, in its side's color (blue, red, yellow for monsters) |
| Attack ranges | A dashed ring at its radius plus its attack range: attacks are edge to edge, so a target is in range once its edge crosses the ring |
| Paths | The waypoints it's walking: a champion's path around walls (`PathFollower`), a minion's steering point, a monster's way home; an X where it ends |
| Targets | An orange arrow to what it's attacking or chasing (fainter for minions, thicker for towers) |
| Leashes | A monster's leash ring around its camp, and a line from the camp to it |
| States | A label under it: `walking`, `attacking`, `chasing`, `aggro`, `returning`, `shooting`, `protected`... A bot's champion shows the bot's decision first: `bot: last hit (attacking)` |
| Sight | Its sight ring (a minion's: how far it looks for targets). Off at first |
| Abilities | The selected champion's learned abilities' ranges |

The panel on the left turns the layers on and off and lists the selected
unit's details (left-click a unit, as in the game; with nothing selected, the
local champion): its state, target, health, path length, radius and ranges,
and notes, such as a tower's warmup and which champions have aggro, a
monster's leash, patience, special attack timer, who hit it and what holds
it (stunned, rooted, slowed, taunted), a champion's crowd control and effects.

## How it works

- The client sends `ClientMessageType.DEBUG { enabled }`
  (`NetworkClient.sendDebug`). `GameRoom.setDebug` refuses outside practice
  matches, and the server answers once with a `DEBUG_STATE` with `unavailable`
  set (the panel says so).
- While it's on, `GameRoom.broadcastState` sends that player a
  `ServerMessageType.DEBUG_STATE` (`DebugStateData`) every third broadcast,
  about 10 a second, built by `game/DebugReport.ts` from the entities the
  player's side sees.
- Each unit describes itself: `ServerEntity.debugInfo(context)` returns a
  `DebugUnit` (or null for entities the overlay leaves out). Champions
  (`champion/ChampionDebug.ts`), minions, jungle monsters and towers override
  it. `DebugReport` adds a bot's last decision (`BotController.lastDecision`,
  read through `BotDriver.decisionOf`).
- The client (`src/debug/DebugOverlay.ts`, drawing in `src/debug/debugDraw.ts`)
  keeps the latest state and draws it at the units' interpolated positions,
  after the fog and under the HUD.

To show something new about a unit, add it to its `debugInfo()`: a `note`
for text in the panel, or a field of `DebugUnit` (and its drawing in
`debugDraw.ts`) for something on the map.
