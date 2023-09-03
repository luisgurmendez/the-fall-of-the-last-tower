import { PixelArt } from "@/sprites/PixelArtBuilder";


export function buildArmySpritesWithSideColor(sprites: PixelArt[], side: 0 | 1) {
    return sprites.map(s => {
        const [v, w, h, c, palette] = s;
        return [v, w, h, c, palette.map(p => p === 0x213ded ? (side === 1 ? 0xED2121 : p) : p)]
    }) as PixelArt[]
}
