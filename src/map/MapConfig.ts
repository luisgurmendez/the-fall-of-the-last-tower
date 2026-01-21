/**
 * Configuration for map generation.
 */

export const MapConfig = {
  /** Total map size (width and height) */
  SIZE: 6000,

  /** Base (spawn area) configuration */
  BASE: {
    /** Radius of each team's base clearing */
    RADIUS: 500,
    /** How far from the edge the base center is placed */
    EDGE_OFFSET: 600,
    /** Random variance in Y position for base placement */
    Y_VARIANCE: 200,
  },

  /** Lane configuration */
  LANES: {
    /** Number of lanes connecting the bases */
    COUNT: 3,
    /** Width of each lane (tree-free path) */
    WIDTH: 400,
    /** How much lanes can curve (bezier control point variance) */
    CURVE_VARIANCE: 300,
  },

  /** Tree configuration */
  TREES: {
    /** Target number of trees to place */
    COUNT: 8000,
    /** Minimum distance between trees */
    MIN_SPACING: 50,
    /** Tree collision radius */
    COLLISION_RADIUS: 20,
    /** Tree size variation */
    SIZE_VARIANCE: 0.3,
  },

  /** Grass/decoration configuration */
  DECORATIONS: {
    /** Number of grass patches */
    GRASS_COUNT: 8000,
  },
} as const;
