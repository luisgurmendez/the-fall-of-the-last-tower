"use strict";

var value = 0x555641eaa907aaa41eaa907aaa41e9a907a6a41f56905f69405fd4005540n
var width = 11
var height = 11
var cardinality = 4
var palette = [
    ,
    0x101010,
    0xa9a48d,
    0xdbcfb1,
]
var SCALE = 22;

// Create canvas and get context
var canvas = document.createElement("canvas");
canvas.width = width * SCALE;
canvas.height = height * SCALE;
var ctx = canvas.getContext("2d");

var readFn = (x, y, value) => {
    ctx.fillStyle = `#${palette[value]?.toString(16).padStart(6, '0') ?? '0000'}`
    ctx.fillRect(SCALE * x, SCALE * y, SCALE, SCALE)
}

// Your decodeBitmapBigInt function
function decodeBitmapBigInt(value, width, height, cardinality) {
    cardinality = BigInt(cardinality);
    for (var y = 0; y < height; ++y) {
        for (var x = 0; x < width; ++x) {
            readFn(x, y, Number(value % cardinality));
            value /= cardinality;
        }
    }
}
// Example usage

decodeBitmapBigInt(value, width, height, cardinality);
// Append the canvas to the document for demonstration purposes
document.body.appendChild(canvas);
