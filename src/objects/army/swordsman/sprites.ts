import swordsmanWalk1 from "./swordsman-walk-sprites/swordsmanWalk1";
import swordsmanWalk2 from "./swordsman-walk-sprites/swordsmanWalk2";
import swordsmanWalk3 from "./swordsman-walk-sprites/swordsmanWalk3";
import swordsmanAttack1 from "./swordsman-attack-sprites/swordsmanAttack1";
import swordsmanAttack2 from "./swordsman-attack-sprites/swordsmanAttack2";
import swordsmanAttack3 from "./swordsman-attack-sprites/swordsmanAttack3";
import swordsmanAttack4 from "./swordsman-attack-sprites/swordsmanAttack4";
import swordsmanAttack5 from "./swordsman-attack-sprites/swordsmanAttack5";
import swordsmanAttack6 from "./swordsman-attack-sprites/swordsmanAttack6";
import swordsmanAttack7 from "./swordsman-attack-sprites/swordsmanAttack7";
import { PixelArt } from "@/sprites/PixelArtBuilder";

export function buildSwordsManSprites(side: 0 | 1) {
    return [
        swordsmanWalk1,
        swordsmanWalk2,
        swordsmanWalk3,
        swordsmanAttack1,
        swordsmanAttack2,
        swordsmanAttack3,
        swordsmanAttack4,
        swordsmanAttack5,
        swordsmanAttack6,
        swordsmanAttack7,].map(s => {
            const [v, w, h, c, palette] = s;
            return [v, w, h, c, palette.map(p => p === 0x213ded ? (side === 1 ? p : 0xED2121) : p)]
        }) as PixelArt[]
}
