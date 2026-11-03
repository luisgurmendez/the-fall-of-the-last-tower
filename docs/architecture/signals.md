# Pings and Emotes

Players signal their team with pings (marks on the map) and show emotes over their champion.

## Controls

| Input | Does |
|-------|------|
| Alt (or G) + left-click, on the map or the minimap | Pings the spot: **Look** (an eye) |
| Alt (or G) + left-press, drag, let go | A wheel comes up around the press (after 160 ms, or as soon as it's dragged): letting go toward an option pings it at the spot pressed: **Danger** (up), **On my way** (right), **Help** (down), **Missing** (left); in the middle, Look |
| Hold T, let go over an emote | The emote wheel around the cursor (8 emotes: Haha, Cool, Grr, Sad, Whoa, Love, Nice, GG); letting go in the middle cancels |

`src/ui/SignalWheel.ts` handles both and draws the wheels. With the ping key held, a left-click
doesn't select a unit, attack-move or move the camera on the minimap (`isPingModifierDown`).
`InputManager` takes Alt from mouse events too (`altKey`), so it's right even if Alt went up
outside the window, and stops the browser from acting on a lone Alt (its menu bar).

## Server

`PING` (`PingInput { pingType, x, y }`, `PING_TYPES`) and `EMOTE` (`EmoteInput { emote }`, `EMOTES`)
inputs (`packages/shared/src/types/network.ts`). `InputHandler` checks the type, then:

- **Ping**: at most 5 in 6 seconds per player (`PING_BURST`, beyond the per-second rate limit);
  the point is kept on the map. It emits `GameEventType.PING { entityId, side, championId,
  pingType, x, y }`. A dead champion pings too (`DEAD_CHAMPION_INPUTS`).
- **Emote**: one every 2 seconds (`EMOTE_COOLDOWN`), alive only. It emits
  `GameEventType.EMOTE { entityId, side, emote }`.

Both are unreliable events. `GameRoom.broadcastState` sends each player only the events that reach
its side (`network/eventAudience.ts`, `reachesSide`): a ping to its team only (the enemy mustn't
learn where it points), an emote to its team and to a side that sees the champion.

## Client

- `src/core/state/signals.ts` (`Signals`, in the state manager: `getSignals()`): the pings up
  (3.5 s) and each champion's emote (2.5 s; a new one replaces it), from the events
  (`gameEvents.ts`).
- `src/render/overlays/signals.ts` (`renderSignals`, last in `EntityRenderer`, over everything):
  a ping's icon drops onto the spot with a bounce over a shadow, rings in its color spreading on
  the ground; an emote pops up (overshooting, then settling) in a speech bubble over its
  champion's health bar (`EntityRenderContext.championHeads`, set by the champion renderer).
- `OnlineMinimap.renderPings`: the ping's icon with rings.
- `src/ui/signalIcons.ts`: the pixel art, grids of palette letters painted once into canvases
  (pings 11 pixels square, emotes 13), with each ping's color and name and each emote's name.
- Sounds (`src/audio/gameSounds.ts`): `ping_<type>` on the `ui` bus (heard by the team wherever
  the camera is), `emote_pop` in the world at the champion.
