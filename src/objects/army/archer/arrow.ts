import GameContext from "@/core/gameContext";
import Disposable from "@/behaviors/disposable";
import Vector from "@/physics/vector";
import { PhysicableMixin } from "@/mixins/physics";
import { CollisionableMixin } from "@/mixins/collisionable";
import RenderElement from "@/render/renderElement";
import { isAttackable } from "@/behaviors/attackable";
import Background, { BACKGROUND_ID } from "@/objects/background";
import BaseObject from "@/objects/baseObject";
import { Rectangle } from "@/objects/shapes";
import { otherSideObjectsFiltering } from "../utils";
import RenderUtils from "@/render/utils";

const ArrowMixin = PhysicableMixin(CollisionableMixin<Rectangle>()(BaseObject));
const ARROW_LENGTH = 14;

class Arrow extends ArrowMixin implements Disposable {
    shouldDispose: boolean;
    side: 0 | 1;
    ttl: number;

    constructor(position: Vector, direction: Vector, side: 0 | 1) {
        super(position);
        this.direction = direction;
        this.collisionMask = new Rectangle(ARROW_LENGTH, 2);
        this.velocity = direction.scalar(500);
        this.acceleration = direction.scalar(1);
        this.shouldDispose = false;
        this.side = side;
        this.friction = 0;
        this.ttl = 2;
    }

    step = (gameContext: GameContext) => {
        const { collisions } = gameContext;
        if (collisions[this.id] && collisions[this.id].length > 0) {
            // find collision with enemy
            const enemy = collisions[this.id].find(otherSideObjectsFiltering(this.side));
            if (enemy) {
                if (isAttackable(enemy)) {
                    enemy.applyDamage(15);
                }
                this.shouldDispose = true;
            }
        }
        this.ttl -= gameContext.dt;

        if (this.ttl <= 0) {
            this.shouldDispose = true;
            gameContext.background.drawArrow(this.position.clone(), this.direction.clone());
        }

        this.position = this.calculatePosition(gameContext.dt);
    }

    render() {
        return new RenderElement((gtx) => {
            const { canvasRenderingContext } = gtx;
            canvasRenderingContext.strokeStyle = 'black';
            canvasRenderingContext.translate(this.position.x, this.position.y);
            canvasRenderingContext.rotate(new Vector(1, 0).angleTo(this.direction));

            // draws the pointing tip
            canvasRenderingContext.beginPath();
            canvasRenderingContext.moveTo(0, 0);
            canvasRenderingContext.lineTo(ARROW_LENGTH, 0);
            canvasRenderingContext.moveTo(ARROW_LENGTH - 2, 1.5);
            canvasRenderingContext.lineTo(ARROW_LENGTH - 2, -1.5);
            canvasRenderingContext.stroke();
        }, true);
    }
}

export default Arrow;