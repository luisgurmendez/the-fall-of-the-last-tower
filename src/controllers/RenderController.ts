import GameContext from "@/core/gameContext";
import { isRenderable } from "@/behaviors/renderable";
import RenderElement from "@/render/renderElement";
import Vector from "@/physics/vector";
import RenderUtils from "@/render/utils";
import Color from "@/utils/color";
import { Dimensions } from "@/core/canvas";
import { BACKGROUND_ID } from "@/objects/background";
import { CASTLE_ID } from "@/objects/castle/castle";
import Particle from "@/objects/particle/particle";
import BaseObject from "@/objects/baseObject";

function objectRenderingPositionComparator(a: BaseObject, b: BaseObject) {
  /// Sorts by y value so that when rendering we don't overlap objects that are behind others.
  /// Also positiones the castle in the back, and instance of Particles in the front.
  if (a.id === CASTLE_ID) {
    return -1;
  }
  if (b.id === CASTLE_ID) {
    return 1;
  }
  if (a instanceof Particle) {
    return 1;
  }
  if (b instanceof Particle) {
    return -1;
  }
  return a.position.y - b.position.y;
}

class RenderController {
  render(gameContext: GameContext) {
    const { canvasRenderingContext, camera, objects } = gameContext;
    canvasRenderingContext.font = "25px Comic Sans MS";
    const renderableObjects = objects
      .filter(isRenderable)
      .filter((obj) => obj.id !== BACKGROUND_ID).sort(objectRenderingPositionComparator);

    const background = objects.find((obj) => obj.id === BACKGROUND_ID);

    const renderElements: RenderElement[] = [];
    renderableObjects.forEach((obj) => {
      if (isRenderable(obj)) {
        const renderElement = obj.render();
        const renderElementRecursiveChildrens: RenderElement[] = [];
        extractRenderElementChildren(
          renderElement,
          renderElementRecursiveChildrens
        );
        renderElements.push(renderElement);
        renderElements.push(...renderElementRecursiveChildrens);
      }
    });

    const overlayRenderElements = renderElements.filter(
      (element) => element.positionType === "overlay"
    );
    const normalRenderElements = renderElements.filter(
      (element) => element.positionType === "normal"
    );

    // Rendering
    this.clearCanvas(canvasRenderingContext);

    // render normal elements..
    this.safetlyRender(canvasRenderingContext, () => {
      canvasRenderingContext.translate(Dimensions.w / 2, Dimensions.h / 2);
      canvasRenderingContext.scale(camera.zoom, camera.zoom);
      canvasRenderingContext.translate(-camera.position.x, -camera.position.y);

      if (background) {
        this.safetlyRender(canvasRenderingContext, () => {
          const backgroundRenderElement = background.render();
          backgroundRenderElement.render(gameContext);
        });
      }

      // Make the center of the screen aligned with the camera's position
      normalRenderElements.forEach((element) => {
        if (isRenderable(element)) {
          this._renderElement(element, gameContext);
        }
      });
    });

    // render overlay elements.
    overlayRenderElements.forEach((element) => {
      element.render(gameContext);
    });

    if (gameContext.isPaused) {
      this.renderPause(canvasRenderingContext);
    }
  }

  private clearCanvas(canvasRenderingContext: CanvasRenderingContext2D) {
    const canvas = canvasRenderingContext.canvas;
    canvasRenderingContext.clearRect(
      -1,
      -1,
      canvas.width + 1,
      canvas.height + 1
    );
  }

  private safetlyRender(
    canvasRenderingContext: CanvasRenderingContext2D,
    render: () => void
  ) {
    canvasRenderingContext.save();
    render();
    canvasRenderingContext.restore();
  }

  private _renderElement(element: RenderElement, gctx: GameContext) {
    if (element.saftly) {
      this.safetlyRender(gctx.canvasRenderingContext, () =>
        element.render(gctx)
      );
    } else {
      element.render(gctx);
    }
  }

  public renderPause(canvasRenderingContext: CanvasRenderingContext2D) {
    const canvasDimensions = {
      w: canvasRenderingContext.canvas.width,
      h: canvasRenderingContext.canvas.height,
    };
    canvasRenderingContext.rect(0, 0, canvasDimensions.w, canvasDimensions.h);
    canvasRenderingContext.fillStyle = new Color(0, 0, 0, 0.5).rgba();
    canvasRenderingContext.fill();
    canvasRenderingContext.fillStyle = "#FFF";
    RenderUtils.renderText(
      canvasRenderingContext,
      "Press [p] to unpause",
      new Vector(canvasDimensions.w / 2, 80)
    );
  }
}

export default RenderController;

function extractRenderElementChildren(
  renderElement: RenderElement,
  acc: RenderElement[]
): RenderElement[] {
  if (renderElement.children.length === 0) {
    return acc;
  }

  renderElement.children.forEach((re) => {
    acc.push(re);
    extractRenderElementChildren(re, acc);
  });

  return [];
}
