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
import { GameObject, hasPosition } from "@/core/GameObject";
import { FogOfWarRenderer } from "@/render/FogOfWarRenderer";
import { TEAM, TeamId } from "@/core/Team";
import { GameConfig } from "@/config";
import type { FogOfWar } from "@/core/FogOfWar";
import { profiler } from "@/debug/PerformanceProfiler";

/**
 * Type guard to check if an object has getTeamId method.
 */
function hasTeamId(obj: unknown): obj is { getTeamId(): TeamId } {
  return obj !== null && typeof obj === 'object' && 'getTeamId' in obj && typeof (obj as any).getTeamId === 'function';
}

// DEBUG: Counter for logging
let fogCheckCount = 0;

/**
 * Check if an object should be rendered based on fog of war visibility.
 * Returns true if:
 * - Fog is disabled
 * - Object doesn't have BOTH position AND team (UI elements, controllers, etc.)
 * - Object is player's unit (always visible)
 * - Object is in a VISIBLE area (not just explored)
 */
function shouldRenderWithFog(
  obj: GameObject,
  fogOfWar: FogOfWar | null,
  localPlayerTeam: number
): boolean {
  // DEBUG: Log for entity-renderer specifically
  if (obj.id === 'entity-renderer') {
    fogCheckCount++;
    if (fogCheckCount % 120 === 1) {
      console.log('[shouldRenderWithFog] entity-renderer check:', {
        fogOfWar: !!fogOfWar,
        fogEnabled: fogOfWar?.isEnabled(),
        hasPos: hasPosition(obj),
        hasTeam: hasTeamId(obj),
        localPlayerTeam,
      });
    }
  }

  // No fog or fog disabled - render everything
  if (!fogOfWar || !fogOfWar.isEnabled()) {
    return true;
  }

  // Only filter objects that have BOTH position AND team
  // UI elements, controllers, etc. without team always render
  if (!hasPosition(obj) || !hasTeamId(obj)) {
    return true;
  }

  const teamId = obj.getTeamId();

  // Player's own units are always visible
  if (teamId === localPlayerTeam) {
    return true;
  }

  // Enemy/neutral units only visible if in VISIBLE area (not just explored)
  return fogOfWar.isVisibleTo(localPlayerTeam, obj.position);
}

function objectRenderingPositionComparator(a: GameObject, b: GameObject) {
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
  // Sort by y position for objects that have position
  const aPos = hasPosition(a) ? a.position.y : 0;
  const bPos = hasPosition(b) ? b.position.y : 0;
  return aPos - bPos;
}

class RenderController {
  private fogRenderer = new FogOfWarRenderer({
    unexploredOpacity: GameConfig.FOG_OF_WAR.UNEXPLORED_OPACITY,
    exploredOpacity: GameConfig.FOG_OF_WAR.EXPLORED_OPACITY,
    unexploredColor: '#000000',
    exploredColor: '#101828',
    smoothEdges: true,
    desaturateExplored: true,
  });

  // DEBUG: Frame counter for periodic logging
  private frameCount = 0;

  render(gameContext: GameContext) {
    const { canvasRenderingContext, camera, objects, fogOfWar, localPlayerTeam } = gameContext;
    canvasRenderingContext.font = "25px Comic Sans MS";

    this.frameCount++;

    profiler.begin('Render: Filter Objects', { threshold: 2 });

    // DEBUG: Log all objects and their renderable status
    if (this.frameCount % 120 === 1) {
      console.log('[RenderController] Total objects:', objects.length);
      console.log('[RenderController] Fog enabled:', fogOfWar?.isEnabled());
      console.log('[RenderController] localPlayerTeam:', localPlayerTeam);
      const entityRenderer = objects.find(o => o.id === 'entity-renderer');
      console.log('[RenderController] EntityRenderer found:', !!entityRenderer);
      if (entityRenderer) {
        console.log('[RenderController] EntityRenderer isRenderable:', isRenderable(entityRenderer));
      }
    }

    const renderableObjects = objects
      .filter(isRenderable)
      .filter((obj) => obj.id !== BACKGROUND_ID)
      .filter((obj) => shouldRenderWithFog(obj, fogOfWar ?? null, localPlayerTeam))
      .sort(objectRenderingPositionComparator);
    profiler.end('Render: Filter Objects');
    profiler.recordObjectCount('Renderable', renderableObjects.length);

    const background = objects.find((obj) => obj.id === BACKGROUND_ID);

    profiler.begin('Render: Build Elements', { threshold: 3 });
    const renderElements: RenderElement[] = [];
    renderableObjects.forEach((obj) => {
      if (isRenderable(obj)) {
        const renderElement = obj.render();
        // Skip null/invalid render elements (some objects don't render anything)
        if (!isValidRenderElement(renderElement)) {
          return;
        }
        const renderElementRecursiveChildrens: RenderElement[] = [];
        extractRenderElementChildren(
          renderElement,
          renderElementRecursiveChildrens
        );
        renderElements.push(renderElement);
        renderElements.push(...renderElementRecursiveChildrens);
      }
    });
    profiler.end('Render: Build Elements');
    profiler.recordObjectCount('Render Elements', renderElements.length);

    const overlayRenderElements = renderElements.filter(
      (element) => element.positionType === "overlay"
    );
    const normalRenderElements = renderElements.filter(
      (element) => element.positionType === "normal"
    );

    // Rendering
    profiler.begin('Render: Clear Canvas', { threshold: 1 });
    this.clearCanvas(canvasRenderingContext);
    profiler.end('Render: Clear Canvas');

    // render normal elements..
    this.safetlyRender(canvasRenderingContext, () => {
      canvasRenderingContext.translate(Dimensions.w / 2, Dimensions.h / 2);
      canvasRenderingContext.scale(camera.zoom, camera.zoom);
      canvasRenderingContext.translate(-camera.position.x, -camera.position.y);

      if (background && isRenderable(background)) {
        profiler.begin('Render: Background', { threshold: 2 });
        this.safetlyRender(canvasRenderingContext, () => {
          const backgroundRenderElement = background.render();
          if (isValidRenderElement(backgroundRenderElement)) {
            backgroundRenderElement.render(gameContext);
          }
        });
        profiler.end('Render: Background');
      }

      // Make the center of the screen aligned with the camera's position
      profiler.begin('Render: World Objects', { threshold: 5, critical: true });
      normalRenderElements.forEach((element) => {
        if (isValidRenderElement(element)) {
          this._renderElement(element, gameContext);
        }
      });
      profiler.end('Render: World Objects');

      // Render fog of war overlay (after all normal elements)
      if (gameContext.fogOfWar) {
        profiler.begin('Render: Fog of War', { threshold: 5, critical: true });
        this.safetlyRender(canvasRenderingContext, () => {
          this.fogRenderer.render(
            canvasRenderingContext,
            gameContext.fogOfWar!,
            localPlayerTeam,
            camera.position,
            camera.zoom,
            Dimensions.w,
            Dimensions.h
          );
        });
        profiler.end('Render: Fog of War');
      }
    });

    // render overlay elements.
    profiler.begin('Render: UI Overlays', { threshold: 3 });
    overlayRenderElements.forEach((element) => {
      if (isValidRenderElement(element)) {
        element.render(gameContext);
      }
    });
    profiler.end('Render: UI Overlays');

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

function isValidRenderElement(element: unknown): element is RenderElement {
  return (
    element !== null &&
    element !== undefined &&
    typeof element === 'object' &&
    typeof (element as RenderElement)._render === 'function'
  );
}

function extractRenderElementChildren(
  renderElement: RenderElement | null | undefined,
  acc: RenderElement[]
): RenderElement[] {
  if (!isValidRenderElement(renderElement) || !renderElement.children || renderElement.children.length === 0) {
    return acc;
  }

  renderElement.children.forEach((re) => {
    if (isValidRenderElement(re)) {
      acc.push(re);
      extractRenderElementChildren(re, acc);
    }
  });

  return acc;
}
