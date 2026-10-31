# Summoner Spells

Two spells each player picks before the match, apart from their champion's
abilities, cast with **D** and **F** on long cooldowns. The set is our own and
covers the classic roles; distances follow the map's scale (0.4 of the classic
MOBA's, see [map.md](map.md)).

| Spell | Cast on | Effect | Cooldown |
|---|---|---|---|
| Blink | the cursor | Reappear up to 160 toward it; into a wall, the farthest open spot short of it (so it crosses a thin wall when there's room past it). Not while rooted or grounded. | 180s |
| Haste | self | +35% movement speed for 8s | 150s |
| Mend | self | Heal self and the most wounded allied champion within 340 for 80 + 15/level; both +30% movement speed for 1s | 150s |
| Aegis | self | Shield of 100 + 20/level for 2.5s | 150s |
| Scorch | enemy champion within 240 | 50 + 20/level true damage over 5s; its healing cut by 40% meanwhile | 150s |
| Hinder | enemy champion within 260 | 30% slow and 35% less attack damage and ability power for 2.5s | 150s |
| Purge | self | Remove every cleansable debuff (stuns, roots, slows...) | 150s |
| Reap | jungle monster or enemy minion within 200 | 450 + 25/level true damage | 60s |

## Where it lives

| File | Role |
|---|---|
| `packages/shared/src/summoners.ts` | Definitions (`SUMMONER_SPELLS`: name, description, cooldown, target, range, color), defaults (Blink + Haste) and `parseSummonerSpells` for untrusted picks |
| `packages/server/src/simulation/champion/ChampionSummoners.ts` | The champion's two spells: cooldowns and casting |
| `packages/server/src/data/effects.ts` | Their effects: `summoner_haste`, `summoner_mend_speed`, `summoner_scorch` (true damage over time, 1 per tick per stack), `summoner_hinder_*` |
| `src/ui/matchmaking/summonerPicker.ts` | Champion select: two slots, a list to pick from (picking the other slot's spell swaps them), kept in localStorage |
| `src/ui/hud/summoners.ts` | HUD column beside the abilities (D over F): icon, cooldown, key, tooltip |
| `src/vfx/summoners.ts` | VFX `summoner_<id>`, spawned from `SUMMONER_CAST` events |
| `src/ui/summonerIcons.ts` | Icons (`public/assets/summoners/<id>.png`, made with `scripts/generate-props.ts`) |

## Flow

1. Champion select sends the pick with READY (`summonerSpells`). The server
   takes it through `parseSummonerSpells` (two different known spells, else the
   defaults), carries it on the queue entry and `PlayerInfo`, and `GameRoom`
   gives the champion its spells when it spawns. Practice bots get Blink + Mend
   (they don't cast them yet).
2. `GAME_START` lists each player's spells (and whether it's a bot) for the
   loading screen's cards.
3. D / F send `InputType.SUMMONER_SPELL` with the slot, the cursor's position
   and the hovered enemy unit. A spell cast on a unit takes the hovered one if
   it's valid and in range, else the valid one in range closest to the cursor;
   with none, the cast is refused and the spell stays ready. Every cast is
   refused while dead or stunned. A cast cancels a recall.
4. Champion snapshots carry `summoners` (id, cooldown left, full cooldown),
   sent with the `ABILITIES` delta.
5. The server emits `SUMMONER_CAST` (`entityId`, `spellId`, where it was cast,
   and where it landed or its target) for the VFX.

F used to toggle fullscreen; that's the button (or the browser's F11) now.
