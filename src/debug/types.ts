/**
 * Debug system type definitions.
 * Used for entity inspection in online mode.
 */

import type { EntitySnapshot, EntityType } from '@siege/shared';
import type Vector from '@/physics/vector';

/**
 * Configuration for the debug inspector.
 */
export interface DebugInspectorConfig {
  /** Enable/disable the debug inspector */
  enabled: boolean;
  /** Panel position */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Panel width */
  panelWidth: number;
  /** Max height before scrolling */
  maxPanelHeight: number;
  /** Opacity of the panel */
  opacity: number;
  /** Whether to show internal IDs */
  showInternalIds: boolean;
  /** Font size for panel text */
  fontSize: number;
}

/**
 * Default debug inspector configuration.
 */
export const DEFAULT_DEBUG_CONFIG: DebugInspectorConfig = {
  enabled: false,
  position: 'top-left',
  panelWidth: 320,
  maxPanelHeight: 500,
  opacity: 0.9,
  showInternalIds: true,
  fontSize: 12,
};

/**
 * Information about an inspected entity.
 */
export interface InspectedEntity {
  /** Entity ID */
  entityId: string;
  /** Entity type */
  entityType: EntityType;
  /** Entity type name (human readable) */
  entityTypeName: string;
  /** World position */
  position: Vector;
  /** Full entity snapshot data */
  snapshot: EntitySnapshot;
  /** When the entity was selected for inspection */
  inspectedAt: number;
}

/**
 * Debug panel section for grouping properties.
 */
export interface DebugPanelSection {
  /** Section title */
  title: string;
  /** Properties in this section */
  properties: DebugProperty[];
  /** Whether section is collapsed */
  collapsed: boolean;
}

/**
 * A single property to display in the debug panel.
 */
export interface DebugProperty {
  /** Property name */
  name: string;
  /** Property value (stringified for display) */
  value: string;
  /** Raw value for copying */
  rawValue: unknown;
  /** Whether this property changed recently */
  changed?: boolean;
}

/**
 * Entity type names for display.
 */
export const ENTITY_TYPE_NAMES: Record<number, string> = {
  0: 'Champion',
  1: 'Minion',
  2: 'Tower',
  3: 'Inhibitor',
  4: 'Nexus',
  5: 'Jungle Camp',
  6: 'Projectile',
  7: 'Ward',
};

/**
 * Get human readable name for an entity type.
 */
export function getEntityTypeName(entityType: number): string {
  return ENTITY_TYPE_NAMES[entityType] ?? `Unknown (${entityType})`;
}
