/**
 * Queue screen: time spent in queue, queue position and queue size.
 */

/**
 * Queue elements and the queue timer.
 */
export class QueueScreen {
  // Queue elements
  private queueTimer: HTMLElement;
  private queuePosition: HTMLElement;
  private queueSize: HTMLElement;

  // State
  private queueStartTime: number = 0;
  private queueTimerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(getEl: (id: string) => HTMLElement) {
    this.queueTimer = getEl("queue-timer");
    this.queuePosition = getEl("queue-position");
    this.queueSize = getEl("queue-size");
  }

  /**
   * Start the queue timer.
   */
  startTimer(): void {
    this.stopTimer();
    this.queueStartTime = Date.now();
    this.queueTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.queueStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      if (this.queueTimer) {
        this.queueTimer.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      }
    }, 1000);
  }

  /**
   * Stop the queue timer.
   */
  stopTimer(): void {
    if (this.queueTimerInterval) {
      clearInterval(this.queueTimerInterval);
      this.queueTimerInterval = null;
    }
  }

  /**
   * Update queue info display.
   */
  updateInfo(position: number, size: number): void {
    if (this.queuePosition)
      this.queuePosition.textContent = position.toString();
    if (this.queueSize) this.queueSize.textContent = size.toString();
  }
}
