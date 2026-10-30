# Map, Terrain and Pathfinding

Config: `packages/shared/src/config/MOBAConfig.ts` (lanes, river, towers, camps, bushes, decorations, walls).
Wall layout: `packages/shared/src/config/siegeMap.ts`, built with the helpers in `mapLayout.ts`.
Server: `packages/server/src/navigation/` (`Terrain`, `PathFollower`, `ServerNavGrid`, `LanePath`).

## Layout

Coordinates run from -1800 to 1800 on both axes, with +y pointing down. A 192-unit water border surrounds the playable area. Blue's base is in the bottom-left corner (nexus at (-1300, 1300)) and red's is in the top-right (1300, -1300). The map is point-symmetric: any blue position (x, y) has a red counterpart at (-x, -y).

- **Lanes:** top runs along the left and top edges (x or y = ±1330), mid follows the diagonal, and bot runs along the bottom and right edges.
- **River:** the other diagonal, from top-left to bottom-right. It's walkable. The dragon pit is in the bot river at (720, 720), and a matching empty pit sits in the top river.
- **Jungle:** each team has two quadrants. The top-side jungle has the blue buff, gromp and wolves. The bot-side jungle has the red buff, spiders and a second gromp.
- **Fountain:** within `FOUNTAIN.RADIUS` (300) of its spawn point, an allied champion regains 12% of its max health and resource per second (`ServerGameContext.applyFountainRegen`). It's also the only place to buy and sell items when `GameConfig.ECONOMY.SHOP_ONLY_AT_BASE` is on, which is the default. The server checks this in `canShop` in `InputHandler`; away from base the client shop greys out its buttons and shows "AT BASE ONLY".
- **Towers:** two per lane per side. The outer tower is listed first and is tier 1. Tower range is 600. Positions are chosen so the outer towers' ranges don't reach the point where waves meet, in every lane.
- **Tower targeting** (`ServerTower`): a champion that damaged an allied champion under the tower comes first, then minions, then other champions, closest first within a priority. A tower keeps its target until it dies or leaves range, and only switches early to something of higher priority. It doesn't jump to whichever minion is closest.
- **Structure order** (`systems/StructureRules.ts`): an inner tower takes no damage while its lane's outer tower stands, and the nexus takes no damage until one of its lanes has lost both towers. This stops champions from walking through the jungle to the nexus.

## Walls

Walls are designed as polygons for blue's top-side jungle (`stroke`, `blob`, `arc`). They are reflected across mid for blue's bot-side jungle (`reflectAcrossMid`), and `buildWalls()` then mirrors everything through the map center for red. Finally `buildWalls()` rasterizes them to 64-unit tiles and merges the tiles into rectangles. Every column of wall is made at least two tiles tall, so it can show a plateau above a cliff face. The result is `MOBAConfig.WALLS`: rectangles centered on `position`.

The client draws walls per 64-unit cell from the union of all rectangles (`MOBABackground.drawInteriorWalls`), so neighboring rectangles form one mass. In each column, the lowest wall cell is the rock cliff face. The cells above it are grass plateau, and each plateau tile is picked from its neighbors: edges where the plateau ends, interior elsewhere, plus one-wide and one-tall variants. Diagonal walls therefore render as stepped cliffs rather than stacked slabs. The minimap draws the rectangles.

To change the layout:
1. Edit the polygons in `siegeMap.ts`.
2. Run `bun run sim map-overview --px 900` in `packages/server` and look at `sim-output/map-overview/final.png`.
3. Run `bun test Terrain`. It checks that every camp, tower and lane waypoint is reachable from both spawns and that none of them is inside a wall.

## Terrain on the server

`ServerGameContext.terrain` is a `Terrain` built from the map config.

- **Collision.** Each tick, after unit collisions, champions, minions and jungle creatures are pushed out of walls and the water (`resolveCircle`). Dashes and knockbacks therefore stop at walls. Projectiles and skillshots fly over walls.
- **Pathfinding.** A `MOVE` input calls `context.moveChampion()`. If the straight line is clear the champion walks straight. Otherwise A* runs on `ServerNavGrid` (25-unit cells, walls and the two nexus footprints inflated by 30 units so paths don't hug cliffs, binary-heap open set; a cross-map path takes a few ms), and the path is smoothed by line of sight. A destination inside a wall is replaced by the nearest walkable point.
- **Following.** `PathFollower` hands the champion one waypoint at a time as a normal move target. A stop, attack, dash or new command (anything that changes the move target) ends the path. Recalling stops the champion.
- **Minions** follow their lane paths, which stay clear of walls, and slide along walls when chasing.
- **Jungle creatures** also slide along walls; they walk home when leashed.

- **Vision:** walls block sight for every vision source (champions, minions, towers, wards), on the server (`FogOfWarServer`) and in the client fog. Both use `WallGrid` from `@siege/shared`: 32-unit cells, with sight lines sampled every 16 units. See [networking.md](networking.md#fog-of-war-filtering).
