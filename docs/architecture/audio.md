# Audio

Sound effects and ambience, generated with ElevenLabs' sound generation and
played with the Web Audio API, heard from the camera.

## Where it lives

| File | Role |
|---|---|
| `src/audio/soundCatalog.ts` | Every sound: its prompt and length (to generate it), variants, bus, volume and how many may play at once |
| `scripts/generate-sounds.ts` | Generates the catalog's sounds with ElevenLabs (`ELEVENLABS_API_KEY` in `.env.local`) and cleans them up with ffmpeg into `public/assets/sounds/<key>.<n>.mp3` (`.wav` for loops) |
| `src/audio/AudioManager.ts` | The engine: loading, buses, volumes, placing sounds in the world, voice limits |
| `src/audio/gameSounds.ts` | Which moment plays which sound (game events, deaths, state changes, wards) |
| `src/audio/ambience.ts` | River and jungle loops, faded by where the camera looks |
| `src/debug/soundLab.ts` | `/sound-lab.html`: every sound with its variants and prompt, and a view to hear one placed around the camera |

## Hearing the world

- **The listener is the camera** (`Camera.step` calls `setListener` with its middle and the width it shows). A sound placed in the world plays at full volume within 0.45 of the view's width from the middle and fades out by 0.95 (past the screen's edge), so it follows the zoom; it pans left or right with where it is (up to 0.6).
- **The fog hides sounds too**: they're played from what the client has, and units out of sight aren't in its state.
- **Voices**: each sound plays at most `maxVoices` at once (default 3), doesn't start again within 0.05 s, and at most 24 play in all, so a wave fighting is a few hits, not a roar. Hits between units that aren't champions are quieter.
- **Variety**: a sound with several variants picks one at random, and every start nudges the pitch by up to 4%.
- **Buses**: `sfx` (in the world), `ui` (not placed: level up, gold, the shop, announcements) and `ambience`, under a master volume. The in-match menu (Escape) has sliders for master, effects and ambience and a mute; `AudioManager` keeps them in localStorage (`siege-audio`).
- Browsers keep audio suspended until a click or key press; the first one starts it and loads the sounds. Until a sound has loaded, playing it does nothing.

## What plays when

| Moment | Sound | From |
|---|---|---|
| Basic attack starts | `attack_swing` (melee champions), `attack_bow` (ranged champions, caster minions), `tower_shot`, `cannon_shot` | `BASIC_ATTACK` |
| Damage taken | `hit_physical` or `hit_magic` | `DAMAGE` |
| Summoner spell | `summoner_<id>` | `SUMMONER_CAST` |
| Gold (ours), level up and a learned ability (ours) | `gold`, `level_up`, `ability_level_up` | `GOLD_EARNED`, the champion's `level` and `skillPoints` |
| An ability pressed that can't be cast | `cant_cast` | `ChampionHUD` |
| A purchase | `item_buy` | `ShopUI.updateOnlineState` (gold down and inventory or control wards up) |
| Deaths | `minion_death`, `champion_death`, `monster_death`, `tower_destroyed` (towers and the nexus), `inhibitor_destroyed` | the unit removed from state |
| Kills, structures, the dragon, inhibitors rebuilding | `stinger_good` / `stinger_bad` (for our side or against it) | the announcement events |
| Ward placed | `ward_place` | a ward added with `age` under 0.6 s |
| Recall | `recall_channel` (stopped if cancelled), `recall_arrive` | the champion's `isRecalling` |
| Ambience | `amb_river` (full within 250 of the river's middle line, gone by 800), `amb_jungle` (in either jungle) | `updateAmbience` |

## Making sounds

```bash
bun scripts/generate-sounds.ts                        # every sound missing a file
bun scripts/generate-sounds.ts --only hit_magic,gold  # remake these
```

Add a sound to `SOUNDS` with a prompt (short and concrete; one-shots end with "video game sound effect, dry, no music, no voice") and a length, generate it, then play it from `gameSounds.ts`. One-shots lose their leading silence, peak at -1 dB, fade out at the end and are saved as mono mp3; loops are asked for as seamless loops and saved as wav (an mp3's padding would leave a gap at the seam). Judge them in `/sound-lab.html` and tune `volume` in the catalog.

The account is on ElevenLabs' free plan (10,000 credits a month; the script prints what's left). A short one-shot costs a few credits and the 8 s recall about 220.
