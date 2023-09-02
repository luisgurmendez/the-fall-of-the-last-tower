import Vector from "@/physics/vector";
import BaseObject from "../baseObject";
import RenderElement from "@/render/renderElement";
import RenderUtils from "@/render/utils";
import { Circle, Rectangle, Square } from "../shapes";

const castleBrickSize = 50;

class Castle extends BaseObject {
    size: Rectangle = new Rectangle(1000, 1000);
    constructor() {
        super(new Vector(-2500, 0), 'castle');
    }

    render() {
        return new RenderElement((ctx) => {

            ctx.canvasRenderingContext.strokeStyle = "transparent";

            ctx.canvasRenderingContext.fillStyle = "#ddd";
            RenderUtils.renderRectangle(ctx.canvasRenderingContext, this.position, this.size,);
            ctx.canvasRenderingContext.fill();

            ctx.canvasRenderingContext.fillStyle = "#555";
            RenderUtils.renderRectangle(ctx.canvasRenderingContext, this.position, new Rectangle(this.size.w - castleBrickSize, this.size.h - castleBrickSize),);
            ctx.canvasRenderingContext.fill();

            // draw a grid that represent the lines on the briks
            const brickLines = Math.round(this.size.w / castleBrickSize) - 1;

            ctx.canvasRenderingContext.save();
            ctx.canvasRenderingContext.strokeStyle = "#555";
            ctx.canvasRenderingContext.lineWidth = 2;
            ctx.canvasRenderingContext.beginPath();
            ctx.canvasRenderingContext.translate(this.position.x, this.position.y);
            ctx.canvasRenderingContext.translate(-this.size.w / 2, -this.size.h / 2);

            ctx.canvasRenderingContext.moveTo(0, 0);
            for (let i = 0; i < brickLines; i++) {
                ctx.canvasRenderingContext.lineTo(castleBrickSize * i, this.size.h);
                ctx.canvasRenderingContext.moveTo(0, castleBrickSize * (i + 1));
                ctx.canvasRenderingContext.lineTo(this.size.w, castleBrickSize * (i + 1),);
                ctx.canvasRenderingContext.moveTo(castleBrickSize * (i + 1), 0);
            }
            ctx.canvasRenderingContext.stroke();
            ctx.canvasRenderingContext.restore();


            // draw the 2 towers on the corners
            this.drawTower(ctx.canvasRenderingContext, this.position.clone().add(new Vector(this.size.w / 2, this.size.h / 2)))
            this.drawTower(ctx.canvasRenderingContext, this.position.clone().add(new Vector(this.size.w / 2, -this.size.h / 2)))

            // draw the brick lines
        }, true);
    }

    drawTower(ctx: CanvasRenderingContext2D, position: Vector) {
        const towerRadius = 100;
        ctx.strokeStyle = "transparent";

        ctx.fillStyle = "#ddd";
        RenderUtils.renderCircle(ctx, position, new Circle(towerRadius));
        ctx.fill();

        ctx.fillStyle = "#555";
        RenderUtils.renderCircle(ctx, position, new Circle(towerRadius - castleBrickSize / 2));
        ctx.fill();


        // draw brick lines
        const brickLines = Math.round(this.size.w / castleBrickSize) - 1;
        ctx.save();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.translate(position.x, position.y);
        ctx.moveTo(0, 0);
        for (let i = 0; i < brickLines; i++) {
            const angle = (i * 360 / brickLines) * (Math.PI / 180);
            const x = 100 * Math.cos(angle);
            const y = 100 * Math.sin(angle);
            ctx.moveTo(0, 0);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
    }
}

export default Castle;
