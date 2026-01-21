/**
 * PerformanceProfiler - Performance monitoring with decorators.
 *
 * Two modes:
 * 1. SILENT MODE (always on in dev): Logs RED warnings when functions exceed thresholds
 * 2. VERBOSE MODE (F3): Shows detailed debug panel with all timings
 *
 * Usage:
 *   @Profile()                    - Profile method, log if > 16ms (1 frame)
 *   @Profile(5)                   - Profile method, log if > 5ms
 *   @ProfileCritical(2)           - RED warning if > 2ms (for critical paths)
 *
 *   profiler.begin('section')     - Manual section start
 *   profiler.end('section')       - Manual section end
 *
 * Controls:
 *   F3 - Toggle verbose debug panel
 *   F4 - Log detailed breakdown to console
 */

import Stats from 'stats.js';

// ============================================================================
// Types
// ============================================================================

interface TimingEntry {
  name: string;
  startTime: number;
  totalTime: number;
  callCount: number;
  maxTime: number;
  minTime: number;
  threshold: number;
  isCritical: boolean;
}

interface ProfileOptions {
  /** Threshold in ms before logging warning (default: 16ms = 1 frame at 60fps) */
  threshold?: number;
  /** Mark as critical path - uses red styling */
  critical?: boolean;
  /** Custom name (default: method name) */
  name?: string;
}

// ============================================================================
// PerformanceProfiler Class
// ============================================================================

class PerformanceProfiler {
  private static instance: PerformanceProfiler;

  // Stats.js for FPS graph
  private stats: Stats;

  // Mode flags
  private enabled: boolean = true;  // Silent mode always on in dev
  private verboseMode: boolean = false;

  // Timing data
  private timings: Map<string, TimingEntry> = new Map();
  private frameTimings: Map<string, number> = new Map();
  private currentFrame: number = 0;
  private activeTimers: Map<string, number> = new Map();

  // Object counts
  private objectCounts: Map<string, number> = new Map();

  // UI elements
  private overlayElement: HTMLDivElement | null = null;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 250; // Update overlay every 250ms

  // Warning tracking (avoid spam)
  private lastWarnings: Map<string, number> = new Map();
  private warningCooldown: number = 1000; // Only warn once per second per section

  private constructor() {
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.style.cssText = 'position:fixed;top:0;left:0;z-index:10000;';

    // Check if we're in development (Vite sets this)
    // @ts-ignore - Vite specific
    this.enabled = typeof import.meta !== 'undefined' && import.meta.env?.DEV !== false;

    this.setupKeyboardShortcuts();
  }

  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        this.toggleVerboseMode();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        this.logDetailedBreakdown();
      }
    });
  }

  // ==========================================================================
  // Public API - Manual profiling
  // ==========================================================================

  /**
   * Start timing a section.
   */
  begin(name: string, options: ProfileOptions = {}): void {
    if (!this.enabled) return;

    const key = options.name || name;
    this.activeTimers.set(key, performance.now());

    // Initialize entry if needed
    if (!this.timings.has(key)) {
      this.timings.set(key, {
        name: key,
        startTime: 0,
        totalTime: 0,
        callCount: 0,
        maxTime: 0,
        minTime: Infinity,
        threshold: options.threshold ?? 16,
        isCritical: options.critical ?? false,
      });
    }
  }

  /**
   * Alias for begin()
   */
  beginSection(name: string, options: ProfileOptions = {}): void {
    this.begin(name, options);
  }

  /**
   * End timing a section.
   */
  end(name: string): void {
    if (!this.enabled) return;

    const startTime = this.activeTimers.get(name);
    if (startTime === undefined) return;

    const elapsed = performance.now() - startTime;
    this.activeTimers.delete(name);

    const entry = this.timings.get(name);
    if (!entry) return;

    // Update stats
    entry.totalTime += elapsed;
    entry.callCount++;
    entry.maxTime = Math.max(entry.maxTime, elapsed);
    entry.minTime = Math.min(entry.minTime, elapsed);

    // Track per-frame timing
    const frameTime = this.frameTimings.get(name) || 0;
    this.frameTimings.set(name, frameTime + elapsed);

    // Check threshold and warn
    if (elapsed > entry.threshold) {
      this.logWarning(entry, elapsed);
    }
  }

  /**
   * Alias for end()
   */
  endSection(name: string): void {
    this.end(name);
  }

  /**
   * Record object count for a category.
   */
  recordObjectCount(category: string, count: number): void {
    if (!this.enabled) return;
    this.objectCounts.set(category, count);
  }

  /**
   * Call at start of frame (for stats.js).
   */
  beginFrame(): void {
    if (!this.enabled) return;
    if (this.verboseMode) {
      this.stats.begin();
    }
    this.currentFrame++;
    this.frameTimings.clear();
  }

  /**
   * Call at end of frame.
   */
  endFrame(): void {
    if (!this.enabled) return;
    if (this.verboseMode) {
      this.stats.end();
      this.updateOverlay();
    }
  }

  // ==========================================================================
  // Warning System
  // ==========================================================================

  private logWarning(entry: TimingEntry, elapsed: number): void {
    const now = Date.now();
    const lastWarn = this.lastWarnings.get(entry.name) || 0;

    // Cooldown to avoid spam
    if (now - lastWarn < this.warningCooldown) return;
    this.lastWarnings.set(entry.name, now);

    const style = entry.isCritical
      ? 'background: #ff0000; color: white; font-weight: bold; padding: 2px 6px;'
      : 'background: #ff6600; color: white; font-weight: bold; padding: 2px 6px;';

    const label = entry.isCritical ? '🔴 CRITICAL' : '🟠 SLOW';

    console.warn(
      `%c${label}%c ${entry.name} took ${elapsed.toFixed(2)}ms (threshold: ${entry.threshold}ms)`,
      style,
      'color: inherit;'
    );
  }

  // ==========================================================================
  // Verbose Mode (Debug Panel)
  // ==========================================================================

  /**
   * Toggle verbose mode with debug panel.
   */
  toggleVerboseMode(): void {
    this.verboseMode = !this.verboseMode;

    if (this.verboseMode) {
      document.body.appendChild(this.stats.dom);
      this.createOverlay();
      console.log('%c📊 Performance Profiler: VERBOSE MODE ON (F3 to toggle, F4 for breakdown)',
        'color: #0f0; font-weight: bold;');
    } else {
      if (this.stats.dom.parentElement) {
        document.body.removeChild(this.stats.dom);
      }
      this.hideOverlay();
      console.log('%c📊 Performance Profiler: VERBOSE MODE OFF', 'color: #888;');
    }
  }

  /**
   * Enable profiler (call at startup).
   */
  enable(): void {
    this.enabled = true;
    // In verbose mode, show stats immediately
    if (this.verboseMode) {
      document.body.appendChild(this.stats.dom);
    }
  }

  private createOverlay(): void {
    if (this.overlayElement) return;

    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'perf-overlay';
    this.overlayElement.style.cssText = `
      position: fixed;
      top: 50px;
      left: 0;
      background: rgba(0, 0, 0, 0.9);
      color: #0f0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      padding: 10px;
      z-index: 10001;
      min-width: 320px;
      max-height: 500px;
      overflow-y: auto;
      border: 1px solid #0f0;
      border-radius: 4px;
    `;
    document.body.appendChild(this.overlayElement);
  }

  private hideOverlay(): void {
    if (this.overlayElement?.parentElement) {
      document.body.removeChild(this.overlayElement);
      this.overlayElement = null;
    }
  }

  private updateOverlay(): void {
    if (!this.verboseMode || !this.overlayElement) return;

    const now = performance.now();
    if (now - this.lastUpdateTime < this.updateInterval) return;
    this.lastUpdateTime = now;

    // Sort by average time descending
    const sorted = Array.from(this.timings.entries())
      .map(([name, entry]) => ({
        name,
        avgTime: entry.callCount > 0 ? entry.totalTime / entry.callCount : 0,
        maxTime: entry.maxTime,
        callCount: entry.callCount,
        frameTime: this.frameTimings.get(name) || 0,
        threshold: entry.threshold,
        isCritical: entry.isCritical,
      }))
      .filter(item => item.callCount > 0)
      .sort((a, b) => b.avgTime - a.avgTime);

    let html = `
      <div style="color:#0ff;margin-bottom:8px;font-weight:bold;font-size:12px;">
        📊 PERFORMANCE PROFILER
      </div>
      <div style="color:#888;margin-bottom:8px;font-size:10px;">
        F3: toggle | F4: console log
      </div>
      <div style="color:#fff;margin-bottom:8px;">Frame: ${this.currentFrame}</div>
    `;

    // Section timings
    html += `<div style="border-top:1px solid #333;padding-top:8px;margin-top:8px;">`;
    html += `<div style="color:#0ff;margin-bottom:6px;font-weight:bold;">⏱ Timings (avg ms):</div>`;

    for (const item of sorted.slice(0, 15)) {
      const color = item.avgTime > item.threshold ? '#ff4444'
                  : item.avgTime > item.threshold * 0.5 ? '#ffaa00'
                  : '#44ff44';
      const icon = item.isCritical ? '🔴' : '';
      html += `
        <div style="color:${color};margin:2px 0;">
          ${icon} ${item.name.substring(0, 25).padEnd(25)}: ${item.avgTime.toFixed(2)}ms
          <span style="color:#666;">(max: ${item.maxTime.toFixed(1)})</span>
        </div>`;
    }
    html += `</div>`;

    // Object counts
    if (this.objectCounts.size > 0) {
      html += `<div style="border-top:1px solid #333;padding-top:8px;margin-top:8px;">`;
      html += `<div style="color:#0ff;margin-bottom:6px;font-weight:bold;">📦 Object Counts:</div>`;

      for (const [category, count] of this.objectCounts.entries()) {
        const color = count > 500 ? '#ff4444' : count > 200 ? '#ffaa00' : '#44ff44';
        html += `<div style="color:${color};margin:2px 0;">${category.padEnd(20)}: ${count}</div>`;
      }
      html += `</div>`;
    }

    this.overlayElement.innerHTML = html;
  }

  /**
   * Log detailed breakdown to console.
   */
  logDetailedBreakdown(): void {
    console.group('%c📊 Performance Breakdown', 'color: #0ff; font-weight: bold; font-size: 14px;');
    console.log(`Total frames profiled: ${this.currentFrame}`);

    const sorted = Array.from(this.timings.entries())
      .map(([name, entry]) => ({
        Section: name,
        'Avg (ms)': entry.callCount > 0 ? (entry.totalTime / entry.callCount).toFixed(3) : '0',
        'Max (ms)': entry.maxTime.toFixed(3),
        'Min (ms)': entry.minTime === Infinity ? '0' : entry.minTime.toFixed(3),
        'Total (ms)': entry.totalTime.toFixed(1),
        Calls: entry.callCount,
        Threshold: entry.threshold,
        Critical: entry.isCritical ? '🔴' : '',
      }))
      .filter(item => item.Calls > 0)
      .sort((a, b) => parseFloat(b['Total (ms)']) - parseFloat(a['Total (ms)']));

    console.table(sorted);

    if (this.objectCounts.size > 0) {
      console.log('%c📦 Object Counts:', 'color: #0ff; font-weight: bold;');
      console.table(Object.fromEntries(this.objectCounts));
    }

    console.groupEnd();
  }

  /**
   * Reset all timing data.
   */
  reset(): void {
    this.timings.clear();
    this.frameTimings.clear();
    this.objectCounts.clear();
    this.currentFrame = 0;
    this.lastWarnings.clear();
  }
}

// ============================================================================
// Decorators
// ============================================================================

/**
 * Profile a method. Logs warning if execution exceeds threshold.
 *
 * @example
 * class MyClass {
 *   @Profile()  // Default: warn if > 16ms
 *   update() { ... }
 *
 *   @Profile(5)  // Warn if > 5ms
 *   render() { ... }
 *
 *   @Profile({ threshold: 2, critical: true, name: 'AI Update' })
 *   updateAI() { ... }
 * }
 */
export function Profile(options?: number | ProfileOptions): MethodDecorator {
  const opts: ProfileOptions = typeof options === 'number'
    ? { threshold: options }
    : options ?? {};

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const methodName = opts.name || String(propertyKey);

    descriptor.value = function (...args: any[]) {
      const profiler = PerformanceProfiler.getInstance();
      profiler.begin(methodName, opts);

      try {
        const result = originalMethod.apply(this, args);

        // Handle async methods
        if (result instanceof Promise) {
          return result.finally(() => profiler.end(methodName));
        }

        profiler.end(methodName);
        return result;
      } catch (error) {
        profiler.end(methodName);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Profile a critical path. Uses red styling for warnings.
 * Lower default threshold (2ms).
 *
 * @example
 * @ProfileCritical()      // Warn if > 2ms
 * @ProfileCritical(1)     // Warn if > 1ms
 */
export function ProfileCritical(threshold: number = 2): MethodDecorator {
  return Profile({ threshold, critical: true });
}

/**
 * Profile with custom name.
 *
 * @example
 * @ProfileAs('Enemy AI Update')
 * updateEnemies() { ... }
 */
export function ProfileAs(name: string, threshold: number = 16): MethodDecorator {
  return Profile({ name, threshold });
}

// ============================================================================
// Inline profiling helper
// ============================================================================

/**
 * Profile a block of code inline.
 *
 * @example
 * const result = profile('expensive-calc', () => {
 *   return heavyComputation();
 * });
 *
 * // With options
 * profile({ name: 'Critical Path', threshold: 2, critical: true }, () => {
 *   criticalOperation();
 * });
 */
export function profile<T>(
  nameOrOptions: string | ProfileOptions,
  fn: () => T
): T {
  const profiler = PerformanceProfiler.getInstance();
  const opts: ProfileOptions = typeof nameOrOptions === 'string'
    ? { name: nameOrOptions }
    : nameOrOptions;
  const name = opts.name || 'anonymous';

  profiler.begin(name, opts);
  try {
    const result = fn();
    profiler.end(name);
    return result;
  } catch (error) {
    profiler.end(name);
    throw error;
  }
}

// ============================================================================
// Exports
// ============================================================================

export const profiler = PerformanceProfiler.getInstance();
export default PerformanceProfiler;
