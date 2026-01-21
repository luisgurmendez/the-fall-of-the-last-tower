/**
 * ActionLogger - Configurable logging system for user input actions.
 *
 * Logs user interactions like:
 * - Input actions (key presses, mouse clicks)
 * - Unit selections
 * - Movement commands
 * - Ability casting
 * - Target selection
 */

export type LogCategory =
  | 'input'
  | 'selection'
  | 'movement'
  | 'ability'
  | 'targeting'
  | 'combat'
  | 'ward'
  | 'camera'
  | 'ui'
  | 'game';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  /** Whether logging is enabled globally */
  enabled: boolean;
  /** Minimum log level to display */
  minLevel: LogLevel;
  /** Which categories to log (empty = all) */
  categories: Set<LogCategory>;
  /** Whether to include timestamps */
  showTimestamp: boolean;
  /** Whether to include category in output */
  showCategory: boolean;
  /** Custom log handler (for testing or external logging) */
  customHandler?: (level: LogLevel, category: LogCategory, message: string, data?: unknown) => void;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color: #888',
  info: 'color: #4a9eff',
  warn: 'color: #ffaa00',
  error: 'color: #ff4444; font-weight: bold',
};

const CATEGORY_EMOJI: Record<LogCategory, string> = {
  input: '🎮',
  selection: '👆',
  movement: '🚶',
  ability: '✨',
  targeting: '🎯',
  combat: '⚔️',
  ward: '👁️',
  camera: '📷',
  ui: '🖥️',
  game: '🎲',
};

class ActionLogger {
  private config: LogConfig = {
    enabled: true,
    minLevel: 'debug',
    categories: new Set(),
    showTimestamp: true,
    showCategory: true,
  };

  private startTime: number = Date.now();

  /**
   * Configure the logger.
   */
  configure(options: Partial<LogConfig>): void {
    this.config = { ...this.config, ...options };
    if (options.categories && Array.isArray(options.categories)) {
      this.config.categories = new Set(options.categories);
    }
  }

  /**
   * Enable logging globally.
   */
  enable(): void {
    this.config.enabled = true;
    this.info('game', 'Action logging enabled');
  }

  /**
   * Disable logging globally.
   */
  disable(): void {
    this.info('game', 'Action logging disabled');
    this.config.enabled = false;
  }

  /**
   * Enable specific categories.
   */
  enableCategories(...categories: LogCategory[]): void {
    categories.forEach(c => this.config.categories.add(c));
  }

  /**
   * Disable specific categories.
   */
  disableCategories(...categories: LogCategory[]): void {
    categories.forEach(c => this.config.categories.delete(c));
  }

  /**
   * Set minimum log level.
   */
  setLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  /**
   * Check if a category should be logged.
   */
  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    if (!this.config.enabled) return false;
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) return false;
    if (this.config.categories.size > 0 && !this.config.categories.has(category)) return false;
    return true;
  }

  /**
   * Format the log message.
   */
  private formatMessage(level: LogLevel, category: LogCategory, message: string): string {
    const parts: string[] = [];

    if (this.config.showTimestamp) {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
      parts.push(`[${elapsed}s]`);
    }

    if (this.config.showCategory) {
      parts.push(`${CATEGORY_EMOJI[category]} [${category.toUpperCase()}]`);
    }

    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Internal log method.
   */
  private log(level: LogLevel, category: LogCategory, message: string, data?: unknown): void {
    if (!this.shouldLog(level, category)) return;

    const formattedMessage = this.formatMessage(level, category, message);

    if (this.config.customHandler) {
      this.config.customHandler(level, category, message, data);
      return;
    }

    const style = LOG_LEVEL_STYLES[level];

    if (data !== undefined) {
      console.log(`%c${formattedMessage}`, style, data);
    } else {
      console.log(`%c${formattedMessage}`, style);
    }
  }

  // ===================
  // Public Log Methods
  // ===================

  debug(category: LogCategory, message: string, data?: unknown): void {
    this.log('debug', category, message, data);
  }

  info(category: LogCategory, message: string, data?: unknown): void {
    this.log('info', category, message, data);
  }

  warn(category: LogCategory, message: string, data?: unknown): void {
    this.log('warn', category, message, data);
  }

  error(category: LogCategory, message: string, data?: unknown): void {
    this.log('error', category, message, data);
  }

  // ===================
  // Convenience Methods
  // ===================

  /**
   * Log a key press event.
   */
  keyPress(key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }): void {
    const mods = [];
    if (modifiers?.ctrl) mods.push('Ctrl');
    if (modifiers?.shift) mods.push('Shift');
    if (modifiers?.alt) mods.push('Alt');
    const modStr = mods.length > 0 ? `[${mods.join('+')}] ` : '';
    this.debug('input', `Key pressed: ${modStr}${key}`);
  }

  /**
   * Log a mouse click event.
   */
  mouseClick(button: 'left' | 'right' | 'middle', x: number, y: number, worldX?: number, worldY?: number): void {
    const pos = worldX !== undefined ? `screen(${x}, ${y}) world(${worldX.toFixed(0)}, ${worldY?.toFixed(0)})` : `(${x}, ${y})`;
    this.debug('input', `Mouse ${button} click at ${pos}`);
  }

  /**
   * Log unit selection.
   */
  unitSelected(unitId: string, unitType: string): void {
    this.info('selection', `Selected ${unitType}: ${unitId}`);
  }

  /**
   * Log unit deselection.
   */
  unitDeselected(unitId: string): void {
    this.debug('selection', `Deselected: ${unitId}`);
  }

  /**
   * Log movement command.
   */
  movementCommand(unitId: string, targetX: number, targetY: number): void {
    this.info('movement', `Move command for ${unitId} to (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`);
  }

  /**
   * Log attack command.
   */
  attackCommand(unitId: string, targetId: string): void {
    this.info('combat', `Attack command: ${unitId} -> ${targetId}`);
  }

  /**
   * Log ability cast start.
   */
  abilityCastStart(championId: string, abilitySlot: string, abilityName: string): void {
    this.info('ability', `Casting ${abilityName} (${abilitySlot}) by ${championId}`);
  }

  /**
   * Log ability cast complete.
   */
  abilityCastComplete(championId: string, abilitySlot: string, targetInfo?: string): void {
    const target = targetInfo ? ` -> ${targetInfo}` : '';
    this.info('ability', `Cast complete: ${abilitySlot}${target}`);
  }

  /**
   * Log ability targeting start.
   */
  abilityTargetingStart(abilitySlot: string, targetingType: string): void {
    this.debug('targeting', `Targeting started for ${abilitySlot} (${targetingType})`);
  }

  /**
   * Log ability targeting cancelled.
   */
  abilityTargetingCancelled(abilitySlot: string): void {
    this.debug('targeting', `Targeting cancelled for ${abilitySlot}`);
  }

  /**
   * Log ward placement.
   */
  wardPlaced(wardType: string, x: number, y: number): void {
    this.info('ward', `Placed ${wardType} ward at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }

  /**
   * Log camera movement.
   */
  cameraMove(x: number, y: number, zoom: number): void {
    this.debug('camera', `Camera at (${x.toFixed(0)}, ${y.toFixed(0)}) zoom: ${zoom.toFixed(2)}`);
  }

  /**
   * Log game state change.
   */
  gameState(state: string, details?: string): void {
    const msg = details ? `${state}: ${details}` : state;
    this.info('game', msg);
  }
}

// Global singleton instance
export const actionLogger = new ActionLogger();

// Expose to window for debugging in console
if (typeof window !== 'undefined') {
  (window as any).actionLogger = actionLogger;
}

export default actionLogger;
