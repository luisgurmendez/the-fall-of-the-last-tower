type PixelArtValue = bigint;

export type PixelArt = [PixelArtValue, number, number, number, (number | undefined)[]]

class PixelArtBuilder {
    static buildCanvas = (pixelart: PixelArt, scale: number = 1): HTMLCanvasElement => {
        const canvas = document.createElement("canvas");
        const [value, width, height, cardinality, palette] = pixelart;
        let _value = value;
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d");
        const _cardinality = BigInt(cardinality);
        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
                ctx!.fillStyle = `#${palette[Number(_value % _cardinality)]?.toString(16).padStart(6, '0') ?? '0000'}`
                ctx!.fillRect(x * scale, y * scale, scale, scale);
                _value /= _cardinality;
            };
        }
        return canvas;
    }
}

export default PixelArtBuilder;
