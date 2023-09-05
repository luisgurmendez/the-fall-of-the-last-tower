class PixelArtDrawUtils {
    ctx: CanvasRenderingContext2D;
    color: string;
    size: number;
    constructor(ctx: CanvasRenderingContext2D, color: string, size: number = 1) {
        this.ctx = ctx;
        this.color = color
        this.size = size;
    }

    private drawPixel(x: number, y: number,) {
        const prevStyle = this.ctx.fillStyle;
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(x, y, this.size, this.size);
        this.ctx.fillStyle = prevStyle;
    }

    drawPixelatedCircleFill(xCenter: number, yCenter: number, radius: number) {
        this.drawPixelatedEllipseFill(xCenter, yCenter, radius, radius,)
    }

    drawPixelatedCircle(xCenter: number, yCenter: number, radius: number) {
        this.drawPixelatedEllipse(xCenter, yCenter, radius, radius);
    }

    drawPixelatedEllipse(centerX: number, centerY: number, rx: number, ry: number) {
        let x = 0, y = ry;
        let rxSq = rx * rx;
        let rySq = ry * ry;
        let twoRxSq = 2 * rxSq;
        let twoRySq = 2 * rySq;
        let p;
        let px = 0, py = twoRxSq * y;

        // Initial points
        this.drawPixel(centerX, centerY + ry);
        this.drawPixel(centerX, centerY - ry);

        // Initial decision parameter and initial point
        p = Math.round(rySq - (rxSq * ry) + (0.25 * rxSq));
        while (px < py) {
            x++;
            px = px + twoRySq;
            if (p < 0) {
                p = p + rySq + px;
            } else {
                y--;
                py = py - twoRxSq;
                p = p + rySq + px - py;
            }
            this.drawPixel(centerX + x, centerY + y);
            this.drawPixel(centerX - x, centerY + y);
            this.drawPixel(centerX + x, centerY - y);
            this.drawPixel(centerX - x, centerY - y);
        }

        // For region 2
        p = Math.round(rySq * (x + 0.5) * (x + 0.5) + rxSq * (y - 1) * (y - 1) - rxSq * rySq);
        while (y > 0) {
            y--;
            py = py - twoRxSq;
            if (p > 0) {
                p = p + rxSq - py;
            } else {
                x++;
                px = px + twoRySq;
                p = p + rxSq - py + px;
            }
            this.drawPixel(centerX + x, centerY + y);
            this.drawPixel(centerX - x, centerY + y);
            this.drawPixel(centerX + x, centerY - y);
            this.drawPixel(centerX - x, centerY - y);
        }
    }


    drawPixelatedEllipseFill(centerX: number, centerY: number, rx: number, ry: number) {
        for (let y = centerY - ry; y <= centerY + ry; y += this.size) {
            for (let x = centerX - rx; x <= centerX + rx; x += this.size) {
                if (this.isPointInEllipse(x + this.size / 2, y + this.size / 2, centerX, centerY, rx, ry)) {
                    this.drawPixel(x, y);
                }
            }
        }
    }

    private isPointInEllipse(x: number, y: number, centerX: number, centerY: number, rx: number, ry: number) {
        const lhs = ((x - centerX) * (x - centerX)) / (rx * rx) + ((y - centerY) * (y - centerY)) / (ry * ry);
        return lhs <= 1;
    }

}

export default PixelArtDrawUtils;