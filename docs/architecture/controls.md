# Controls: cast modes and key bindings

Each player picks how abilities are cast and which key does what. The settings live in the
browser (`localStorage["siege-controls"]`), so they follow the player between matches but not
between browsers. The server doesn't know about them: it gets the same inputs either way.

| File | What it holds |
|------|---------------|
| `src/core/input/keyBindings.ts` | The bindable actions (`CONTROL_ACTIONS`), their default keys, `rebind` (swaps on a taken key), reserved keys, `keyLabel` |
| `src/core/input/castModes.ts` | The three cast modes, `CastController` (the ability, spell or item being aimed), which abilities/spells/items are aimed |
| `src/core/input/controls.ts` | The player's settings: `getControls()`, load/save, `subscribe` for changes |
| `src/ui/ControlsPanel.ts` | The settings panel: the main menu's **Settings** and the in-match menu's **Controls** |
| `src/ui/matchmaking/howToPlay.ts` | The How to Play screen, written from the player's keys |

## Cast modes

| Mode | Aimed ability, summoner spell or item active |
|------|------------------------------------------------|
| Quick cast (default) | The press casts at the cursor |
| Quick cast with indicator | Holding the key shows its preview; letting go casts it |
| Normal cast | The press shows its preview; a left-click casts it; the key again puts it away |

In every mode:

- What isn't aimed casts on the press: `self`, `no_target`, `aura` and toggle abilities;
  summoner spells with `target: 'self'`; item actives with `targeting: 'self'`. Aimed means a
  `skillshot`, `ground_target`, `target_enemy`, `target_ally` or `target_unit` ability (during a
  recast window, its recast's type: Lume's orb is aimed when thrown, not when called back), a
  summoner spell aimed at a point, an enemy or a monster, and an item used at a point.
- Charged abilities (Vile's arrows) charge while held and fire on the release (`charging.ts`).
- While a preview shows, a left-click in the world casts it (not on the HUD or the minimap), a
  right-click drops it (and still moves), Escape drops it before the menu hears it, and so does
  dying or changing the settings. Pressing another aimed one switches to it.
- In the two aiming modes an aimed ability that isn't ready (not learned, on cooldown, no
  charge left) shows nothing; the HUD flashes its slot. Quick cast sends the press anyway, as
  it always did, and the server says no.

Abilities show the HUD's preview (`rangePreview.ts`: range, band, cone or area) and their slot
lights up; summoner spells and item actives show a ring for their range around the champion
(`OnlineInputHandler.renderAimRange`). Wards keep their own hold-and-release placement in
every mode.

## Key bindings

Every action has a default key, the ones the game always used:

| Actions | Defaults |
|---------|----------|
| Abilities | Q W E R (Ctrl + the key levels it) |
| Summoner spells | D F |
| Items (inventory slots 1-6) | 1 2 3 6 7 8 |
| Ward, control ward | 4, 5 |
| Attack-move, stop, recall | A, S, B |
| Shop, scoreboard, ping, emotes | P, Tab, G (Alt always pings too), T |
| Center camera, lock camera, zoom in, zoom out | Space, Y, `.`, `,` |

- Keys are `KeyboardEvent.key` with letters in lowercase (`normalizeKey`); `InputManager`
  stores them that way, so Shift or Caps Lock don't change what a key does.
- No two actions share a key: binding an action to a taken key gives the other action the old
  key (the panel says so).
- Reserved, never bound: Escape (menu, cancelling), Enter (kept for chat), Control (levels
  abilities), Alt (pings), Shift, Meta, Caps Lock and F1-F12 (F3 debug, F4 profiler, the
  browser's own).
- What was stored is checked part by part (`parseControlSettings`): an unknown cast mode, an
  unknown action, a reserved or non-string key falls back to its default, and the rest is kept.
- Everything that names a key reads the bindings: the input handler, the HUD's labels (ability
  fallback letters, summoner spells, item slots, tooltips), the shop's inventory numbers, the
  tips and the How to Play screen.

While the panel waits for a key it takes key presses before the game does (a capture listener
on `window`), so pressing Q there doesn't cast.

Tests: `packages/client/src/test/KeyBindings.test.ts`, `Controls.test.ts`, `CastModes.test.ts`.
