# Map, Terrain and Pathfinding

Config: `packages/shared/src/config/MOBAConfig.ts` (lanes, river, towers, camps, bushes, decorations, walls).
Wall layout: `packages/shared/src/config/siegeMap.ts`, built with the helpers in `mapLayout.ts`.
Server: `packages/server/src/navigation/` (`Terrain`, `PathFollower`, `ServerNavGrid`, `LanePath`).

## Scale

Everything is sized like the classic MOBA map and its units at 0.4 of their size: 1 Siege unit = 2.5 of those. The champions' art fixes that scale (a champion is 25 units in radius), and the rest follows: champions walk about 130 units a second and minions 125, melee champions hit from 55-60 and ranged ones from 180-220, towers shoot 300, champions see 560, experience is shared within 560, ability ranges are 170-440 and their areas 60-220 in radius. Walking from base to the far nexus takes about 50 seconds, like the classic map. Keep new distances, ranges and speeds on this scale.

## Layout

Coordinates run from -2880 to 2880 on both axes, with +y pointing down. A 192-unit water border surrounds the playable area. Blue's base is in the bottom-left corner (nexus at (-2200, 2200)) and red's is in the top-right (2200, -2200). The map is point-symmetric: any blue position (x, y) has a red counterpart at (-x, -y).

- **Lanes:** 280 wide. Top runs along the left and top edges (x or y = ±2420), mid follows the diagonal, and bot runs along the bottom and right edges.
- **River:** 360 wide, along the other diagonal (y = x) from the top lane's corner to the bot lane's. It's walkable, and mid crosses it at the center. The dragon's pit is cut into blue's bank of the bot river (`DRAGON_PIT` in `siegeMap.ts`, centered 330 off the river's centerline), and a matching empty pit is cut into red's bank of the top river. The pits open toward the river and their walls only go round the far side, so walking along the river is never blocked.
- **Jungle:** each team has two quadrants. Each is about ten islands of forest, 300-600 across, with paths about 180-250 wide between them and the camps in the pockets they leave, so about half of it is walkable, like the classic map. Each quadrant opens onto its outer lane three times (by the river corner, to the thornspitter, near the base), onto the river by its buff and at the crossroads where the river meets mid, and onto mid by the wolves (spiders) and at that crossroads. The top-side jungle has the blue buff, a thornspitter and wolves. The bot-side jungle has the red buff, spiders and a second thornspitter; its river side has the dragon's pit.
- **Bushes:** 42 groups (`BUSH_GROUPS`): at the outer lanes' jungle entrances, river corner and outer side, at mid's jungle entrances, in the river by the buffs, at the river-mid crossroads and by the dragon pit, behind the pit, and on the jungle's paths. A unit inside one is hidden from enemies outside it (`ServerBushManager`; `BushHiding.test.ts` checks every bush); the hitboxes are each bush's rectangle (`calculateIndividualBushPositions`), and the GPU ground draws the brush over exactly those (on a muddy islet in the river). Our champions standing in one are drawn see-through (`src/vision/brush.ts`).
- **Fountain:** within `FOUNTAIN.RADIUS` (360) of its spawn point, an allied champion regains 12% of its max health and resource per second (`ServerGameContext.applyFountainRegen`). It's also the only place to buy and sell items when `GameConfig.ECONOMY.SHOP_ONLY_AT_BASE` is on, which is the default. The server checks this in `canShop` in `InputHandler`; away from base the client shop greys out its buttons and shows "AT BASE ONLY".
- **Towers:** two per lane per side. The outer tower is listed first and is tier 1. Towers shoot 300 from their edge (attack range is edge to edge, see [champions.md](champions.md#attack-range)) and see 440. Positions are chosen so the outer towers' ranges don't reach the point where waves meet, in every lane.
- **Tower targeting** (`ServerTower`): a champion that damaged an allied champion under the tower comes first, then minions, then other champions, closest first within a priority. A tower keeps its target until it dies or leaves range, and only switches early to something of higher priority. It doesn't jump to whichever minion is closest.
- **Structure order** (`systems/StructureRules.ts`): an inner tower takes no damage while its lane's outer tower stands, and the nexus takes no damage until one of its lanes has lost both towers. This stops champions from walking through the jungle to the nexus.

## Walls

(The GPU ground draws walls as forest canopy or boulders over a rock face; see Ground art. What follows is the 2D fallback tilemap.)

The jungle's islands are polygons designed for blue's top-side jungle (drawn small, then grown around their centers, `grow`) and reflected across mid for its bot-side jungle, except at the river, where the bot side has the dragon's pit (an `arc`). `isJungleWall` in `siegeMap.ts` clips them: a point on blue's half is forest when it's in an island and clear of the lanes (200 from their centerlines), the river (240) and the base (950 from the nexus), so an island can never block a lane or the river. `buildWalls()` mirrors everything through the map center for red (walls can also be given as polygons directly, made with `stroke`, `blob` and `arc`), rasterizes it to 64-unit tiles and merges the tiles into rectangles. Every column of wall is made at least two tiles tall, so it can show a plateau above a cliff face. The result is `MOBAConfig.WALLS`: rectangles centered on `position`.

The client draws walls per 64-unit cell from the union of all rectangles (`MOBABackground.drawInteriorWalls`), so neighboring rectangles form one mass. In each column, the lowest wall cell is the rock cliff face. The cells above it are grass plateau, and each plateau tile is picked from its neighbors: edges where the plateau ends, interior elsewhere, plus one-wide and one-tall variants. Diagonal walls therefore render as stepped cliffs rather than stacked slabs. The minimap draws the rectangles.

To change the layout:
1. Edit the islands in `siegeMap.ts` (lanes, river and nexus are there too).
2. Run `bun run sim map-overview --px 900` in `packages/server` and look at `sim-output/map-overview/final.png`.
3. Run `bun test Terrain`. It checks that every camp, tower and lane waypoint is reachable from both spawns and that none of them is inside a wall.

## Ground art

The ground is drawn by the GPU every frame (`src/gpu/ground/`): one full-screen triangle runs a fragment shader that paints each pixel from the terrain, so the art follows the exact walls, lanes and river and can move.

- **Terrain field** (`terrainField.ts`): built once at load, one texel per 8 world units over the map. Each channel is a signed distance in world units, negative inside: water (the border and the river), paths (the lanes), rock (the walls) and brush (the bushes' hitboxes). Water and paths are measured from their polylines. Rock comes from the wall rectangles through a Euclidean distance transform, then a blur, so the 64-unit steps of diagonal walls round off. Read with linear filtering, the edges stay smooth at any zoom. The collision is unchanged: it's still the rectangles.
- **Shader** (`groundShader.ts`): every screen pixel finds its art pixel (1.5 world units, fixed to the world so nothing swims as the camera moves) and colors it from small color ramps with 4x4 ordered dithering, like pixel art. The palette is muted, closer to the classic MOBA's than to bright cartoon colors, so units and effects stand out. Grass gets tufts that sway, flower patches, a wind sheen and darker jungle; lanes are paved with worn flagstones (the cells of a jittered grid, beveled toward the light) down the middle, thinning out toward the edges to bare earth with moss in the joints, and a shaded lip where the grass ends; water goes deep to shallow, with flowing ripples, foam lapping at the shore, a few glints and a muddy bank, and where lanes ford the river their paving runs on under the water. Jungle walls are a forest canopy (one shaded crown per tree, the lowest crown in front); walls near the bases and the river pits are mossy boulders. Both stand on a rock face along their south side and cast a shadow down and to the right. Each base has a round plaza of paving stones that breaks up at its edge, with a ring of rune stones in the team's color. Bushes are tall brush: small leafy clumps packed over exactly their hitboxes, nodding in the wind, with a shadow under them (the 2D bush sprites are only drawn without the GPU). Cloud shadows drift over everything. Animated parts step at 8 frames per second.
- **Layer** (`src/gpu/GPURenderer.ts`): the shader renders into an offscreen WebGL2 canvas the size of the screen, copied into the 2D canvas where the background goes (`MOBABackground.render`). Its view comes from the 2D context's transform, so it matches the camera, zoom and screen shake.

Without WebGL2, `MOBABackground` pre-renders the ground into a canvas from three generated Wang tilesets (`scripts/generate-tilesets.ts`, ids in `scripts/tilesets.json`, art in `public/assets/tiles/`; drawn by `src/map/terrainTiles.ts`), or from the older tilemap below if those are missing.

## Terrain on the server

`ServerGameContext.terrain` is a `Terrain` built from the map config.

- **Collision.** Each tick, after unit collisions, champions, minions and jungle creatures are pushed out of walls and the water (`resolveCircle`). Dashes and knockbacks therefore stop at walls. Projectiles and skillshots fly over walls.
- **Pathfinding.** A `MOVE` input calls `context.moveChampion()`. If the straight line is clear the champion walks straight. Otherwise A* runs on `ServerNavGrid` (25-unit cells, walls and the two nexus footprints inflated by 30 units so paths don't hug cliffs, binary-heap open set; a cross-map path takes a few ms), and the path is smoothed by line of sight. A destination inside a wall is replaced by the nearest walkable point. If the champion is already there, the order just stops it (`findPath` returns `[]`); it doesn't push into the wall.
- **Following.** `PathFollower` hands the champion one waypoint at a time as a normal move target. A stop, attack, dash or new command (anything that changes the move target) ends the path. Recalling stops the champion.
- **Minions** follow their lane paths, which stay clear of walls, and slide along walls when chasing.
- **Jungle creatures** also slide along walls; they walk home when leashed.

- **Vision:** walls block sight for every vision source (champions, minions, towers, wards), on the server (`FogOfWarServer`) and in the client fog. Both use `WallGrid` from `@siege/shared`: 32-unit cells, with sight lines sampled every 16 units. See [networking.md](networking.md#fog-of-war-filtering).
