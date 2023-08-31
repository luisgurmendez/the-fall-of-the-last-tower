import PixelArtSpriteSheet from "sprites/PixelArtSpriteSheet";
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

const walking1 = {
    value: 0x61e3c70891a1c08n,
    width: 7,
    height: 9,
    cardinality: 2,
    palette: [
        0x000000,
        0xffffff,
    ],
}

const walking2 = {
    value: 0x3cc102044ccfc304n,
    width: 7,
    height: 9,
    cardinality: 2,
    palette: [
        0x000000,
        0xffffff,
    ],
}


const walking3 = {
    value: 0x555641eaa907aaa41eaa907aaa41e9a907a6a41f56905f69405fd4005540n,
    width: 11,
    height: 11,
    cardinality: 4,
    palette: [
        ,
        0x101010,
        0xa9a48d,
        0xdbcfb1,
    ],
}

const walking4 = {
    value: 0x2214083e083c3c1cn,
    width: 8,
    height: 8,
    cardinality: 2,
    palette: [
        ,
        0x000,
    ]
}


const sprites = [
    walking1,
    walking2,
    walking3,
    walking4,
];

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
        swordsmanAttack7,].map(s => ({
            ...s,
            palette: s.palette.map(p => p === 0x213ded ? (side === 1 ? p : 0xED2121) : p)
        }))
}




















export default sprites;