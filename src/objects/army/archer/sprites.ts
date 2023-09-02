import { PixelArt } from "@/sprites/PixelArtBuilder";
import archerAttack0 from "./archer-attack-sprites/archerAttack0";
import archerAttack1 from "./archer-attack-sprites/archerAttack1";
import archerAttack2 from "./archer-attack-sprites/archerAttack2";
import archerAttack3 from "./archer-attack-sprites/archerAttack3";
import archerAttack4 from "./archer-attack-sprites/archerAttack4";
import archerWalk0 from "./archer-walk-sprites/archerWalk0";
import archerWalk1 from "./archer-walk-sprites/archerWalk1";
import archerWalk2 from "./archer-walk-sprites/archerWalk2";

/// TODO(): reuse with swordsman
export function buildArcherSprites(side: 0 | 1) {
    return [
        archerWalk0,
        archerWalk1,
        archerWalk2,
        archerAttack0,
        archerAttack1,
        archerAttack2,
        archerAttack3,
        archerAttack4,
    ].map(s => {
        const [v, w, h, c, palette] = s;
        return [v, w, h, c, palette.map(p => p === 0x213ded ? (side === 1 ? p : 0xED2121) : p)]
    }) as PixelArt[]
}
