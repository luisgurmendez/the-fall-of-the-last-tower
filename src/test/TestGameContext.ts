/**
 * Test utilities for creating minimal GameContext without rendering.
 * Enables testing champions, abilities, and effects in isolation.
 *
 * Uses a mock interface that mimics GameContext without importing
 * modules that require browser APIs.
 */

import SpatiallyHashedObjects from '@/utils/spatiallyHashedObjects';
import { GameObject } from '@/core/GameObject';
import Vector from '@/physics/vector';
import { Rectangle, Square } from '@/objects/shapes';

/**
 * Minimal mock of FogOfWar for testing.
 */
export interface MockFogOfWar {
  isEnabled: () => boolean;
  isVisibleTo: () => boolean;
  isExploredBy: () => boolean;
  update: () => void;
}

/**
 * Minimal mock of NavigationGrid for testing.
 */
export interface MockNavigationGrid {
  isWalkable: (pos: Vector) => boolean;
  findPath: (from: Vector, to: Vector) => Vector[] | null;
}

/**
 * Minimal mock of GameContext for testing.
 * Avoids importing the real GameContext which pulls in browser-dependent modules.
 */
export interface MockGameContext {
  readonly dt: number;
  readonly spatialHashing: SpatiallyHashedObjects;
  readonly objects: GameObject[];
  readonly isPaused: boolean;
  readonly worldDimensions: Rectangle;
  readonly money: number;
  readonly canvasRenderingContext: CanvasRenderingContext2D;
  readonly camera: MockCamera;
  readonly collisions: MockCollisions & { [key: string]: any };
  readonly castle: undefined;
  readonly background: undefined;
  readonly fogOfWar: MockFogOfWar | undefined;
  readonly navigationGrid: MockNavigationGrid | undefined;
  setMoney: (a: number) => void;
  pause: () => void;
  unPause: () => void;
}

/**
 * Minimal mock of Camera.
 */
export interface MockCamera {
  position: Vector;
  zoom: number;
  worldToScreen: (v: Vector) => Vector;
  screenToWorld: (v: Vector) => Vector;
}

/**
 * Minimal mock of Collisions.
 */
export interface MockCollisions {
  register: () => void;
  unregister: () => void;
  checkCollisions: () => [];
}

/**
 * Options for creating a test game context.
 */
export interface TestGameContextOptions {
  /** Delta time in seconds (default: 1/60 = 16.67ms) */
  dt?: number;
  /** Spatial hash cell size (default: 100) */
  cellSize?: number;
  /** World dimensions (default: 2000x2000) */
  worldDimensions?: Rectangle;
  /** Initial objects to include */
  objects?: GameObject[];
  /** Initial money (default: 10000) */
  money?: number;
}

/**
 * Mock canvas context for testing (no-op rendering).
 */
function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    globalAlpha: 1,
    imageSmoothingEnabled: true,

    // Drawing methods (no-op)
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fill: () => {},
    stroke: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    rect: () => {},
    ellipse: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 0 } as TextMetrics),
    drawImage: () => {},

    // Transform methods (no-op)
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    transform: () => {},
    setTransform: () => {},
    resetTransform: () => {},

    // Clipping (no-op)
    clip: () => {},

    // Canvas reference
    canvas: {
      width: 1920,
      height: 1080,
    } as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Mock camera for testing.
 */
function createMockCamera(): MockCamera {
  return {
    position: new Vector(0, 0),
    zoom: 1,
    worldToScreen: (v: Vector) => v.clone(),
    screenToWorld: (v: Vector) => v.clone(),
  };
}

/**
 * Mock collisions for testing.
 */
function createMockCollisions(): MockCollisions {
  return {
    register: () => {},
    unregister: () => {},
    checkCollisions: () => [],
  };
}

/**
 * Mock fog of war for testing.
 */
function createMockFogOfWar(): MockFogOfWar {
  return {
    isEnabled: () => false,
    isVisibleTo: () => true,
    isExploredBy: () => true,
    update: () => {},
  };
}

/**
 * Mock navigation grid for testing.
 */
function createMockNavigationGrid(): MockNavigationGrid {
  return {
    isWalkable: () => true,
    findPath: (from: Vector, to: Vector) => [from.clone(), to.clone()],
  };
}

/**
 * Create a minimal mock GameContext suitable for testing.
 * Does not require canvas or actual rendering.
 *
 * Note: Returns a MockGameContext which is compatible with GameContext
 * for testing purposes, but doesn't import the real GameContext class.
 */
export function createTestGameContext(options: TestGameContextOptions = {}): MockGameContext {
  const {
    dt = 1 / 60,  // 60 FPS
    cellSize = 100,
    worldDimensions = new Square(2000),
    objects = [],
    money = 10000,
  } = options;

  const spatialHashing = new SpatiallyHashedObjects(cellSize);

  // Insert provided objects into spatial hash (cast needed as spatialHashing expects CollisionableObject)
  objects.forEach(obj => spatialHashing.insert(obj as any));

  // State for money
  let currentMoney = money;
  let isPaused = false;

  return {
    dt,
    spatialHashing,
    objects,
    isPaused,
    worldDimensions,
    money: currentMoney,
    canvasRenderingContext: createMockCanvasContext(),
    camera: createMockCamera(),
    collisions: createMockCollisions(),
    castle: undefined,
    background: undefined,
    fogOfWar: createMockFogOfWar(),
    navigationGrid: createMockNavigationGrid(),
    setMoney: (amount: number) => { currentMoney = amount; },
    pause: () => { isPaused = true; },
    unPause: () => { isPaused = false; },
  };
}

/**
 * Test runner that can advance game time.
 */
export class TestRunner {
  private context: MockGameContext;
  private objects: GameObject[];
  private spatialHashing: SpatiallyHashedObjects;
  private elapsedTime: number = 0;

  constructor(options: TestGameContextOptions = {}) {
    this.objects = options.objects || [];
    this.spatialHashing = new SpatiallyHashedObjects(options.cellSize || 100);
    this.objects.forEach(obj => this.spatialHashing.insert(obj as any));
    this.context = createTestGameContext({
      ...options,
      objects: this.objects,
    });
  }

  /**
   * Get the current game context.
   */
  getContext(): MockGameContext {
    return this.context;
  }

  /**
   * Add an object to the test world.
   */
  addObject(obj: GameObject): void {
    this.objects.push(obj);
    this.spatialHashing.insert(obj as any);
  }

  /**
   * Advance time by a specific amount.
   * Calls step() on all objects that have it.
   */
  tick(dt: number = 1/60): void {
    this.elapsedTime += dt;

    // Recreate context with new dt
    this.context = createTestGameContext({
      dt,
      objects: this.objects,
    });

    // Step all objects that have a step method
    for (const obj of this.objects) {
      if ('step' in obj && typeof (obj as any).step === 'function') {
        (obj as any).step(this.context);
      }
    }
  }

  /**
   * Advance multiple frames.
   */
  tickFrames(frames: number, dt: number = 1/60): void {
    for (let i = 0; i < frames; i++) {
      this.tick(dt);
    }
  }

  /**
   * Get total elapsed test time.
   */
  getElapsedTime(): number {
    return this.elapsedTime;
  }
}

export default createTestGameContext;
