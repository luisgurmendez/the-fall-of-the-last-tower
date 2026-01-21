/**
 * Logger - Structured logging utility for the game server.
 *
 * Log levels:
 * - error: Critical errors that need attention
 * - warn: Warnings about potential issues
 * - info: Important events (connections, game lifecycle, kills, etc.)
 * - debug: Detailed debugging information (disabled by default)
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Set via LOG_LEVEL env var: 'error', 'warn', 'info', 'debug'
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  'error': LogLevel.ERROR,
  'warn': LogLevel.WARN,
  'info': LogLevel.INFO,
  'debug': LogLevel.DEBUG,
};

const currentLevel = LOG_LEVEL_MAP[process.env.LOG_LEVEL?.toLowerCase() ?? 'info'] ?? LogLevel.INFO;

function timestamp(): string {
  return new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
}

function formatMessage(level: string, category: string, message: string): string {
  return `${timestamp()} [${level}] [${category}] ${message}`;
}

export const Logger = {
  error(category: string, message: string, data?: unknown): void {
    if (currentLevel >= LogLevel.ERROR) {
      console.error(formatMessage('ERROR', category, message), data ?? '');
    }
  },

  warn(category: string, message: string, data?: unknown): void {
    if (currentLevel >= LogLevel.WARN) {
      console.warn(formatMessage('WARN', category, message), data ?? '');
    }
  },

  info(category: string, message: string, data?: unknown): void {
    if (currentLevel >= LogLevel.INFO) {
      console.log(formatMessage('INFO', category, message), data ?? '');
    }
  },

  debug(category: string, message: string, data?: unknown): void {
    if (currentLevel >= LogLevel.DEBUG) {
      console.log(formatMessage('DEBUG', category, message), data ?? '');
    }
  },

  // Convenience methods for common categories
  server: {
    info: (msg: string, data?: unknown) => Logger.info('Server', msg, data),
    warn: (msg: string, data?: unknown) => Logger.warn('Server', msg, data),
    error: (msg: string, data?: unknown) => Logger.error('Server', msg, data),
    debug: (msg: string, data?: unknown) => Logger.debug('Server', msg, data),
  },

  game: {
    info: (msg: string, data?: unknown) => Logger.info('Game', msg, data),
    warn: (msg: string, data?: unknown) => Logger.warn('Game', msg, data),
    error: (msg: string, data?: unknown) => Logger.error('Game', msg, data),
    debug: (msg: string, data?: unknown) => Logger.debug('Game', msg, data),
  },

  input: {
    info: (msg: string, data?: unknown) => Logger.info('Input', msg, data),
    warn: (msg: string, data?: unknown) => Logger.warn('Input', msg, data),
    error: (msg: string, data?: unknown) => Logger.error('Input', msg, data),
    debug: (msg: string, data?: unknown) => Logger.debug('Input', msg, data),
  },

  champion: {
    info: (msg: string, data?: unknown) => Logger.info('Champion', msg, data),
    warn: (msg: string, data?: unknown) => Logger.warn('Champion', msg, data),
    error: (msg: string, data?: unknown) => Logger.error('Champion', msg, data),
    debug: (msg: string, data?: unknown) => Logger.debug('Champion', msg, data),
  },

  combat: {
    info: (msg: string, data?: unknown) => Logger.info('Combat', msg, data),
    warn: (msg: string, data?: unknown) => Logger.warn('Combat', msg, data),
    debug: (msg: string, data?: unknown) => Logger.debug('Combat', msg, data),
  },
};

export default Logger;
