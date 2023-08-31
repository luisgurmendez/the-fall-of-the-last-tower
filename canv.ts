type ReadFunction = (x: number, y: number, value: number) => void;

// Define your palette
const palette = [
    "rgb(0, 0, 0)",  // Black
    "rgb(255, 255, 255)"  // White
];

// Create canvas and get context
const canvas = document.createElement("canvas");
canvas.width = 100;
canvas.height = 100;
const ctx = canvas.getContext("2d");

// Define your readFunction to draw on the canvas
const readFunction: ReadFunction = (x, y, value) => {
    ctx!.fillStyle = palette[value];
    ctx!.fillRect(x, y, 1, 1);
};

// Your decodeBitmapBigInt function
function decodeBitmapBigInt(value: bigint, width: number, height: number, cardinality: number | bigint, readFunction: ReadFunction) {
    cardinality = BigInt(cardinality);
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            readFunction(x, y, Number(value % cardinality));
            value /= cardinality;
        }
    }
}

// Example usage
export const value = 0x61e3c70891a1c08n;
export const width = 7;
export const height = 9;
export const cardinality = 2;

decodeBitmapBigInt(value, width, height, cardinality, readFunction);

// Append the canvas to the document for demonstration purposes
document.body.appendChild(canvas);