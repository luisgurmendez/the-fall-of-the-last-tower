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
| `src/audio/abilitySounds.ts` | When and where each ability sounds: its cues, timed like its VFX |
| `src/audio/ambience.ts` | River and jungle loops, faded by where the camera looks |
| `src/debug/soundLab.ts` | `/sound-lab.html`: every sound with its variants and prompt (each champion's abilities under its name), and a view to hear one placed around the camera |

## Hearing the world

- **The listener is the camera** (`Camera.step` calls `setListener` with its middle and the width it shows). A sound placed in the world plays at full volume within 0.45 of the view's width from the middle and fades out by 0.95 (past the screen's edge), so it follows the zoom; it pans left or right with where it is (up to 0.6).
- **The fog hides sounds too**: they're played from what the client has, and units out of sight aren't in its state.
- **Voices**: each sound plays at most `maxVoices` at once (default 3), doesn't start again within 0.05 s, and at most 24 play in all, so a wave fighting is a few hits, not a roar.
- **The mix**: what champions do is in front (abilities, their attacks and hits, given and taken); the lane is in the background: attacks and hits between units that aren't champions play at 0.3 (`LANE_VOLUME` in `gameSounds.ts`), minion deaths and cannons are quiet in the catalog, and the river and jungle loops sit low under everything.
- **Variety**: a sound with several variants picks one at random, and every start nudges the pitch by up to 4% (not a `steadyPitch` one, timed to something: the recall channel lasts exactly the recall).
- **Timing**: `play` can start a sound a delay from now, so an ability's impact sounds when it lands. A `rise` sound starts at that share of its volume and swells to full by its end.
- **Buses**: `sfx` (in the world), `ui` (not placed: level up, gold, the shop, announcements), `ambience` and `music` (see [Music](#music)), under a master volume. The in-match menu (Escape) and the main menu's Settings have sliders for master, effects, ambience and music and a mute; `AudioManager` keeps them in localStorage (`siege-audio`).
- Browsers keep audio suspended until a click or key press; the first one starts it and loads the sounds. Until a sound has loaded, playing it does nothing.

## What plays when

| Moment | Sound | From |
|---|---|---|
| Basic attack starts | a champion's own `<championId>_attack` if the catalog has one (Oitboil's puff of flame), else `attack_swing` (melee champions) or `attack_bow` (ranged champions, caster minions), `tower_shot`, `cannon_shot`, `monster_<creature type>` (a bite, a spit, a fist...) | `BASIC_ATTACK` |
| A jungle monster's special attack | `<abilityId>_windup` as it winds up, then `<abilityId>` as it lands (cut short if the monster dies first) | `ABILITY_CAST` (`ABILITY_CUES`) |
| An enemy tower starts aiming at our champion | `tower_alert` | the tower's `targetEntityId` |
| Our champion under 30% health | `low_health`, a heartbeat loop louder the lower it gets (with the red vignette, `LowHealthVignette`) | every frame |
| An ability cast (and recast: `<abilityId>_recast`; Vile's traps springing and bursting) | its cues in `ABILITY_CUES`, or else the sound with its id, at the caster | `ABILITY_CAST` |
| A leap landing, Lume's orb arriving | `warrior_ultimate_strike`, `uruk_r`, `lume_q_arrive` at the target (cues `<abilityId>_land`, `lume_q_arrive`) | `ABILITY_CAST` sent when it happens |
| A projectile bursting where it hit (not one that ran its range out: `projectileHit`) | `<abilityId>_impact`, if there's one (Magnus' fireball) | the projectile removed from state |
| Damage taken | `hit_physical` or `hit_magic` | `DAMAGE` |
| Summoner spell | `summoner_<id>` | `SUMMONER_CAST` |
| Gold (ours), level up and a learned ability (ours) | `gold`, `level_up`, `ability_level_up` | `GOLD_EARNED`, the champion's `level` and `skillPoints` |
| An ability pressed that can't be cast | `cant_cast` | `ChampionHUD` |
| A purchase | `item_buy` | `ShopUI.updateOnlineState` (gold down and inventory or control wards up) |
| Deaths | `minion_death`, `champion_death`, `monster_death`, `tower_destroyed` (towers and the nexus), `inhibitor_destroyed` | the unit removed from state |
| Kills, structures, the dragon, inhibitors rebuilding | `stinger_good` / `stinger_bad` (for our side or against it) | the announcement events |
| A champion picks a healing blossom (The Narrows) | `blossom_heal` | `ABILITY_CAST` `blossom_heal` |
| A champion crawls through a jungle tunnel | `jungle_tunnel` at the mouth it goes in by, then at the other as it comes out | `ABILITY_CAST` `jungle_tunnel` (`ABILITY_CUES`) |
| A jungle monster gives up the fight (it resets and walks home) | `monster_reset` | the creature's `isReturning` |
| Ward placed | `ward_place` | a ward added with `age` under 0.6 s |
| A teammate's (or our) ping, an emote | `ping_<type>` (`ui`: heard wherever the camera is), `emote_pop` at the champion | `PING`, `EMOTE` ([signals.md](signals.md)) |
| Recall | `recall_channel` building up over the 8 s (stopped if cancelled), then `recall_depart` (the beam up, the "jiiiuuu") where it was and `recall_arrive` in the base | the champion's `isRecalling` |
| Ambience | `amb_river` (full within 250 of the river's middle line, gone by 800), `amb_jungle` (in either jungle) | `updateAmbience` |

## Ability sounds

Each champion ability has a sound keyed by its id in the catalog (`warrior_slash`); one with parts adds `_<part>` (`warrior_ultimate_leap`, `warrior_ultimate_strike`). By default the sound with the ability's id plays at the caster as it's cast. `ABILITY_CUES` (`src/audio/abilitySounds.ts`) lists the rest: a delay (an area that lands after its `aoeDelay`, as on the server and in its VFX; a projectile leaving the hand) and where (the caster, or where it's aimed or the unit it's cast on). An ability is heard only if its caster is in sight (or, for a trap springing, the unit it caught). A test (`abilitySounds.test.ts`) checks that every champion ability has a sound.

A long cast can sound from its start: an `ABILITY_WINDUP` plays the cues of `<abilityId>_windup` (Nocthar's rumble through his ultimate's 1.5 s cast, his wail from the breath before it). A summon's sounds come from it: his Hollows' claws and colossus's fists (their basic attacks), their crumbling (their deaths), the colossus's throw and charge. A cue can name another champion's sound: Kip's Target Practice, the takeoff of his Grand Entrance and each volley of Show Them All reuse Elora's bow shot and roll (`elora_attack`, `elora_e`); his own are his W's whistle, his landing (`kip_e_land`), his ultimate's flurry and the thunk of a mark popping (`kip_pop_auto_impact`, where the arrow hits).

Ability sounds are leveled in the catalog to about -19 LUFS (ultimates and big impacts -16, secondary parts like a meteor's whistle -21.5), measured with ffmpeg's `ebur128`, so no champion's kit is louder than another's.

## Making sounds

```bash
bun scripts/generate-sounds.ts                        # every sound missing a file
bun scripts/generate-sounds.ts --only hit_magic,gold  # remake these
```

```bash
bun scripts/generate-sounds.ts --reprocess --only gold --raw <dir>  # clean up the raw takes kept in <dir> again (no credits)
```

Add a sound to `SOUNDS` with a prompt (short and concrete; one-shots end with "video game sound effect, dry, no music, no voice"; a roar or a choir leaves out "no voice") and a length, generate it, then play it from `gameSounds.ts` (an ability's: `abilitySounds.ts`). One-shots lose their leading silence, peak at -1 dB (one still quieter than -17 LUFS, a boom with a short spike, is lifted toward it with a limiter, by up to 8 dB), fade out at the end and are saved as mono mp3; loops are asked for as seamless loops and saved as wav (an mp3's padding would leave a gap at the seam). Judge them in `/sound-lab.html` and tune `volume` in the catalog (above 1 lifts a quiet file: loops aren't lifted when made).

ElevenLabs' music generation (`POST /v1/music`) needs a paid plan: on the free plan it answers 402.

## Music

The music is chiptune written for the game and played live by a small sound chip in Web Audio,
not files (`src/audio/music/`):

| File | Role |
|---|---|
| `notation.ts` | How a song is written: each voice a line of `note:steps` tokens (`D5:4`, `r:2`, drums `k` `s` `h`), bars split by `|`, a step a sixteenth. Every bar must add up to a whole bar (`parseVoice` throws), so voices can't drift |
| `songs.ts` | The songs. **title**: the menu's theme, D minor with a chorus in F major at 112 BPM (music-box intro, an 8-note motif, the chorus, a bridge, then back to the motif: about 85 s a loop), soft (0.5 of the music volume). Matches have no music |
| `ChiptunePlayer.ts` | Plays them: a 25% pulse lead with vibrato on long notes, a thin 12.5% pulse for arpeggios, a triangle bass, noise snare and hi-hat and a falling-sine kick. Notes are scheduled on the audio clock a section ahead; a new song fades the old one out. It also plays the menus' blips (`blip`) |

- **When:** `MatchmakingUI.show()` plays `title`, and `hide()` (into a match) stops it
  (`AudioManager.playMusic`).
- **Before audio is allowed:** asked before the first click, the song starts with it.
- **Volume:** it has its own bus, `music` (0.6 by default), and a slider in the in-match menu and
  in the main menu's Settings (`src/ui/soundControls.ts`).
- **Tests:** `src/audio/music/notation.test.ts` checks the songs' bars and notes.

## Menu sounds

The menus' clicks are chip blips like the music's (`src/audio/uiSounds.ts`, on the `ui` bus; no
files). `attachUiSounds(document.body)` in `src/index.ts` plays them for every click and hover:

| Sound | On |
|---|---|
| `hover` | a faint tick on a new button, link or card under the pointer |
| `click` | any other button or menu link |
| `confirm` | PLAY, START, making or joining a room, choosing a mode, signing in (a rising arpeggio) |
| `back` | back and cancel (falling) |
| `select` | a champion, a summoner spell, a profile tab, a match in the history |
| `error` | an error screen (`MatchmakingUI.showError`) |

- **Its own sound:** an element can name one with `data-sound`, or `"none"` for silence.
- **Disabled buttons and sliders:** silent.
- **The shop:** left alone, since buying has its own sound.

Tests: `src/audio/uiSounds.test.ts`.

The account is on ElevenLabs' free plan (10,000 credits a month; the script prints what's left, a little behind). A sound costs about 10 credits a second: the 38 ability sounds cost about 400.
