/**
 * Team System - Defines teams, alliances, and hostility relationships.
 *
 * Replaces the fragmented `Side`, `UnitSide`, `ArmyUnitSide` types with a unified system.
 *
 * Key concepts:
 * - Team: A group of units that work together
 * - TeamId: Numeric identifier (0, 1, 2, etc.)
 * - TeamRelationship: How teams relate (allied, hostile, neutral)
 */

/**
 * Unique identifier for a team.
 * Using number for backwards compatibility with existing 0 | 1 system.
 */
export type TeamId = number;

/**
 * Predefined team IDs for common use cases.
 */
export const TEAM = {
  /** Player's team (blue team) */
  PLAYER: 0 as TeamId,
  /** Enemy team (red team) */
  ENEMY: 1 as TeamId,
  /** Neutral entities (monsters, objectives) */
  NEUTRAL: 2 as TeamId,
} as const;

/**
 * Relationship between two teams.
 */
export type TeamRelationship = 'allied' | 'hostile' | 'neutral';

/**
 * Team definition with metadata.
 */
export interface Team {
  /** Unique team identifier */
  id: TeamId;
  /** Display name */
  name: string;
  /** Team color for rendering */
  color: string;
  /** Spawn position X coordinate */
  spawnX: number;
  /** Default facing direction (1 = right, -1 = left) */
  facingDirection: 1 | -1;
}

/**
 * Default team definitions.
 */
export const DEFAULT_TEAMS: Record<TeamId, Team> = {
  [TEAM.PLAYER]: {
    id: TEAM.PLAYER,
    name: 'Blue Team',
    color: '#4488ff',
    spawnX: -1500,
    facingDirection: 1,
  },
  [TEAM.ENEMY]: {
    id: TEAM.ENEMY,
    name: 'Red Team',
    color: '#ff4444',
    spawnX: 1500,
    facingDirection: -1,
  },
  [TEAM.NEUTRAL]: {
    id: TEAM.NEUTRAL,
    name: 'Neutral',
    color: '#888888',
    spawnX: 0,
    facingDirection: 1,
  },
};

/**
 * Manages teams and their relationships.
 */
export class TeamManager {
  private teams: Map<TeamId, Team> = new Map();
  private relationships: Map<string, TeamRelationship> = new Map();

  constructor() {
    // Initialize with default teams
    Object.values(DEFAULT_TEAMS).forEach(team => {
      this.teams.set(team.id, team);
    });

    // Default relationships: Player and Enemy are hostile
    this.setRelationship(TEAM.PLAYER, TEAM.ENEMY, 'hostile');
    // Neutral is neutral to everyone by default
    this.setRelationship(TEAM.PLAYER, TEAM.NEUTRAL, 'neutral');
    this.setRelationship(TEAM.ENEMY, TEAM.NEUTRAL, 'neutral');
  }

  /**
   * Get team by ID.
   */
  getTeam(id: TeamId): Team | undefined {
    return this.teams.get(id);
  }

  /**
   * Register a new team.
   */
  registerTeam(team: Team): void {
    this.teams.set(team.id, team);
  }

  /**
   * Set relationship between two teams.
   */
  setRelationship(teamA: TeamId, teamB: TeamId, relationship: TeamRelationship): void {
    const key = this.getRelationshipKey(teamA, teamB);
    this.relationships.set(key, relationship);
  }

  /**
   * Get relationship between two teams.
   */
  getRelationship(teamA: TeamId, teamB: TeamId): TeamRelationship {
    if (teamA === teamB) return 'allied';
    const key = this.getRelationshipKey(teamA, teamB);
    return this.relationships.get(key) ?? 'neutral';
  }

  /**
   * Check if two teams are hostile.
   */
  areHostile(teamA: TeamId, teamB: TeamId): boolean {
    return this.getRelationship(teamA, teamB) === 'hostile';
  }

  /**
   * Check if two teams are allied (same team or allied relationship).
   */
  areAllied(teamA: TeamId, teamB: TeamId): boolean {
    return teamA === teamB || this.getRelationship(teamA, teamB) === 'allied';
  }

  /**
   * Get all teams hostile to a given team.
   */
  getHostileTeams(teamId: TeamId): TeamId[] {
    const hostile: TeamId[] = [];
    for (const [id] of this.teams) {
      if (id !== teamId && this.areHostile(teamId, id)) {
        hostile.push(id);
      }
    }
    return hostile;
  }

  /**
   * Get all teams allied with a given team.
   */
  getAlliedTeams(teamId: TeamId): TeamId[] {
    const allied: TeamId[] = [teamId]; // Always allied with self
    for (const [id] of this.teams) {
      if (id !== teamId && this.areAllied(teamId, id)) {
        allied.push(id);
      }
    }
    return allied;
  }

  private getRelationshipKey(teamA: TeamId, teamB: TeamId): string {
    // Ensure consistent key regardless of order
    const [a, b] = teamA < teamB ? [teamA, teamB] : [teamB, teamA];
    return `${a}-${b}`;
  }
}

// ===================
// Utility Functions
// ===================

/**
 * Check if a unit can be targeted as enemy.
 * Replaces `otherSideObjectsFiltering`.
 */
export function isEnemy(
  sourceTeam: TeamId,
  target: { getTeamId(): TeamId },
  teamManager: TeamManager = defaultTeamManager
): boolean {
  return teamManager.areHostile(sourceTeam, target.getTeamId());
}

/**
 * Check if a unit is on the same team or allied.
 */
export function isAlly(
  sourceTeam: TeamId,
  target: { getTeamId(): TeamId },
  teamManager: TeamManager = defaultTeamManager
): boolean {
  return teamManager.areAllied(sourceTeam, target.getTeamId());
}

/**
 * Filter function to get enemies of a team.
 * Drop-in replacement for `otherSideObjectsFiltering`.
 */
export function enemyFilter<T extends { getTeamId(): TeamId }>(
  sourceTeam: TeamId,
  teamManager: TeamManager = defaultTeamManager
): (obj: T) => boolean {
  return (obj: T) => teamManager.areHostile(sourceTeam, obj.getTeamId());
}

/**
 * Filter function to get allies of a team.
 */
export function allyFilter<T extends { getTeamId(): TeamId }>(
  sourceTeam: TeamId,
  teamManager: TeamManager = defaultTeamManager
): (obj: T) => boolean {
  return (obj: T) => teamManager.areAllied(sourceTeam, obj.getTeamId());
}

// ===================
// Backwards Compatibility
// ===================

/**
 * @deprecated Use TeamId instead. Alias for backwards compatibility.
 */
export type UnitSide = TeamId;

/**
 * @deprecated Use TeamId instead. Alias for backwards compatibility.
 */
export type ArmyUnitSide = TeamId;

/**
 * @deprecated Use TeamId instead. Alias for backwards compatibility.
 */
export type Side = TeamId;

// Global default team manager
export const defaultTeamManager = new TeamManager();

export default TeamManager;
