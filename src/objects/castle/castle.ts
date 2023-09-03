import Vector from "@/physics/vector";
import BaseObject from "../baseObject";
import RenderElement from "@/render/renderElement";
import RenderUtils from "@/render/utils";
import { Circle, Rectangle, Shape, Square } from "../shapes";
import { CollisionableMixin } from "@/mixins/collisionable";
import Attackable from "@/behaviors/attackable";
import RandomUtils from "@/utils/random";
import GameContext from "@/core/gameContext";
import Particle from "../particle/particle";
import Color from "@/utils/color";

const castleBrickSize = 50;

class Castle extends CollisionableMixin<Rectangle>()(BaseObject) implements Attackable {
    size: Rectangle = new Rectangle(1000, 1000);
    health = 1000;
    maxHealth = 1000;
    constructor() {
        super(new Vector(-2500, 0), 'castle');
        this.collisionMask = this.size;
    }
    applyDamage(damage: number): void {
        console.log(damage);
        this.health -= damage;
    }

    render() {
        return new RenderElement((ctx) => {

            ctx.canvasRenderingContext.strokeStyle = "transparent";

            ctx.canvasRenderingContext.fillStyle = "#ddd";
            RenderUtils.renderRectangle(ctx.canvasRenderingContext, this.position, this.size.w, this.size.h);
            ctx.canvasRenderingContext.fill();

            ctx.canvasRenderingContext.fillStyle = "#555";
            RenderUtils.renderRectangle(ctx.canvasRenderingContext, this.position, this.size.w - castleBrickSize, this.size.h - castleBrickSize,);
            ctx.canvasRenderingContext.fill();

            // draw a grid that represent the lines on the briks
            const brickLines = Math.round(this.size.w / castleBrickSize) - 1;

            ctx.canvasRenderingContext.save();
            ctx.canvasRenderingContext.strokeStyle = "#555";
            ctx.canvasRenderingContext.lineWidth = 4;
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

            this.drawSmoke(ctx);

            // draw the brick lines
        }, true);
    }

    drawTower(ctx: CanvasRenderingContext2D, position: Vector) {
        const towerRadius = 100;
        ctx.strokeStyle = "transparent";

        ctx.fillStyle = "#ddd";
        RenderUtils.renderCircle(ctx, position, towerRadius);
        ctx.fill();

        ctx.fillStyle = "#555";
        RenderUtils.renderCircle(ctx, position, towerRadius - castleBrickSize / 2);
        ctx.fill();


        // draw brick lines
        const brickLines = Math.round(this.size.w / castleBrickSize) - 1;
        ctx.save();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 4;
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


    drawSmoke(gctx: GameContext) {

        const healthPercentage = this.health / this.maxHealth;
        if (Math.random() < 0.1) {
            const ttl = RandomUtils.getValueInRange(0.1, 2.5);
            const particle = new Particle(ttl);
            particle.position = this.position.clone().add(new Vector(50 + RandomUtils.getNumberWithVariance(0, 20), RandomUtils.getNumberWithVariance(0, 20)));
            // show more dark and red (like fire) smoke if the castle is more damaged, else light gray smoke
            particle.color = new Color(255 * healthPercentage, 255 * healthPercentage, 255 * healthPercentage, 0.5);
            particle.fade = true;
            particle.velocity = new Vector(RandomUtils.getValueInRange(0.5, 1), -100)
                .scalar(RandomUtils.getNumberWithVariance(10, 20));
            particle.direction = particle.velocity.clone().normalize();
            particle.size = RandomUtils.getValueInRange(10, 40);

            gctx.objects.push(particle);
        }
    }
}

export default Castle;






























// import Vector from "@/physics/vector";
// import BaseObject from "../baseObject";
// import RenderElement from "@/render/renderElement";
// import RenderUtils from "@/render/utils";
// import { Rectangle } from "../shapes";
// import { CollisionableMixin } from "@/mixins/collisionable";
// import Attackable from "@/behaviors/attackable";

// const castleBrickSize = 50;

// class Castle extends CollisionableMixin<Rectangle>()(BaseObject) implements Attackable {
//     size: Rectangle = new Rectangle(1000, 1000);
//     health = 1000;
//     castleCanvas: HTMLCanvasElement;

//     constructor() {
//         super(new Vector(-2500, 0), 'castle');
//         this.collisionMask = this.size;
//         this.castleCanvas = document.createElement('canvas');
//         this.castleCanvas.width = this.size.w;
//         this.castleCanvas.height = this.size.h;
//         drawCastle(this.castleCanvas, this.size, this.position);
//     }

//     applyDamage(damage: number): void {
//         this.health -= damage;
//     }

//     render() {
//         return new RenderElement((ctx) => {
//             ctx.canvasRenderingContext.drawImage(this.castleCanvas, 0, 0);
//         }, true);
//     }
// }

// export default Castle;



// const drawCastle = (canvas: HTMLCanvasElement, size: Rectangle, position: Vector) => {
//     const ctx = canvas.getContext('2d')!;

//     ctx.strokeStyle = "transparent";

//     ctx.fillStyle = "#ddd";
//     RenderUtils.renderRectangle(ctx, position, size.w, size.h);
//     ctx.fill();

//     ctx.fillStyle = "#555";
//     RenderUtils.renderRectangle(ctx, position, size.w - castleBrickSize, size.h - castleBrickSize,);
//     ctx.fill();

//     // draw a grid that represent the lines on the briks
//     const brickLines = Math.round(size.w / castleBrickSize) - 1;

//     ctx.save();
//     ctx.strokeStyle = "#555";
//     ctx.lineWidth = 4;
//     ctx.beginPath();
//     ctx.translate(position.x, position.y);
//     ctx.translate(-size.w / 2, -size.h / 2);

//     ctx.moveTo(0, 0);
//     for (let i = 0; i < brickLines; i++) {
//         ctx.lineTo(castleBrickSize * i, size.h);
//         ctx.moveTo(0, castleBrickSize * (i + 1));
//         ctx.lineTo(size.w, castleBrickSize * (i + 1),);
//         ctx.moveTo(castleBrickSize * (i + 1), 0);
//     }
//     ctx.stroke();
//     ctx.restore();


//     // draw the 2 towers on the corners
//     drawTower(ctx, position.clone().add(new Vector(size.w / 2, size.h / 2)), size);
//     drawTower(ctx, position.clone().add(new Vector(size.w / 2, -size.h / 2)), size);
// }

// const drawTower = (ctx: CanvasRenderingContext2D, position: Vector, size: Rectangle) => {
//     const towerRadius = 100;
//     ctx.strokeStyle = "transparent";

//     ctx.fillStyle = "#ddd";
//     RenderUtils.renderCircle(ctx, position, towerRadius);
//     ctx.fill();

//     ctx.fillStyle = "#555";
//     RenderUtils.renderCircle(ctx, position, towerRadius - castleBrickSize / 2);
//     ctx.fill();


//     // draw brick lines
//     const brickLines = Math.round(size.w / castleBrickSize) - 1;
//     ctx.save();
//     ctx.strokeStyle = "#555";
//     ctx.lineWidth = 4;
//     ctx.beginPath();
//     ctx.translate(position.x, position.y);
//     ctx.moveTo(0, 0);
//     for (let i = 0; i < brickLines; i++) {
//         const angle = (i * 360 / brickLines) * (Math.PI / 180);
//         const x = 100 * Math.cos(angle);
//         const y = 100 * Math.sin(angle);
//         ctx.moveTo(0, 0);
//         ctx.lineTo(x, y);
//     }
//     ctx.stroke();
//     ctx.restore();
// }

