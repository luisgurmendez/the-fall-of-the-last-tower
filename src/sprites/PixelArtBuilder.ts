type PixelArtValue = bigint;

// export interface PixelArt {
//     value: PixelArtValue;
//     width: number;
//     height: number;
//     // numbers of colors for this pixelart
//     cardinality: number;
//     palette: (number | undefined)[];
// }


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

    // static encodeFromMatrix = (matrix: number[][], cardinality: number): PixelArtValue => {
    //     let binaryString = '';
    //     // Convert the bitmap to a binary string, with 2 bits per pixel
    //     for (const row of matrix) {
    //         for (const pixel of row) {
    //             const pixelBinary = pixel.toString(2).padStart(2, '0');
    //             binaryString += pixelBinary;
    //         }
    //     }

    //     return BigInt(`0b${binaryString}`);
    // }
}

export default PixelArtBuilder;


/// Just for creating the BigInt in hex format used in development
function encodeBitmapBigInt(matrix: number[][], cardinality: number | bigint,): string {
    let value = BigInt(0);
    let base = BigInt(cardinality);
    const width = matrix[0].length;
    const height = matrix.length;

    for (let y = height - 1; y >= 0; --y) {
        for (let x = width - 1; x >= 0; --x) {
            value *= base;
            value += BigInt(matrix[y][x]);
        }
    }

    return `0x${value.toString(16)}n`;
}


// example: 
const palette = [
    0x000000,
    0xffffff,
    0xffffff,
];

const bitmap = [
    [0, 1, 0,],
    [1, 2, 1,],
    [3, 1, 3,],
    [0, 3, 0,],
]

encodeBitmapBigInt(bitmap, palette.length);