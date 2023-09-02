import Vector from "@/physics/vector";
import BaseObject from "../baseObject";
import RenderElement from "@/render/renderElement";

class Castle extends BaseObject {
    constructor() {
        super(new Vector(-2000, 0), 'castle');
    }

    render() {
        return new RenderElement((ctx) => {
            // dark gray
            ctx.canvasRenderingContext.fillStyle = "#333333";
            ctx.canvasRenderingContext.fillRect(
                this.position.x,
                this.position.y,
                300,
                300
            );
        });
    }
}

export default Castle;
