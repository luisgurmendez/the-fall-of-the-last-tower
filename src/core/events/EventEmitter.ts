/**
 * Type-safe event emitter for game-wide communication.
 * Allows decoupled communication between game systems.
 */

type EventCallback<T = unknown> = (data: T) => void;
type UnsubscribeFunction = () => void;

export class EventEmitter {
  private listeners = new Map<string, Set<EventCallback<unknown>>>();

  /**
   * Subscribe to an event.
   * @param event - The event name to listen for
   * @param callback - Function to call when the event is emitted
   * @returns A function to unsubscribe from the event
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): UnsubscribeFunction {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event for a single emission.
   * @param event - The event name to listen for
   * @param callback - Function to call when the event is emitted
   * @returns A function to unsubscribe from the event
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): UnsubscribeFunction {
    const unsubscribe = this.on<T>(event, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }

  /**
   * Unsubscribe from an event.
   * @param event - The event name
   * @param callback - The callback to remove
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  /**
   * Emit an event to all subscribers.
   * @param event - The event name
   * @param data - Optional data to pass to subscribers
   */
  emit<T = unknown>(event: string, data?: T): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Check if an event has any listeners.
   * @param event - The event name
   */
  hasListeners(event: string): boolean {
    return (this.listeners.get(event)?.size ?? 0) > 0;
  }

  /**
   * Get the number of listeners for an event.
   * @param event - The event name
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Remove all listeners for an event, or all listeners if no event specified.
   * @param event - Optional event name
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Dispose of the event emitter and clear all listeners.
   */
  dispose(): void {
    this.listeners.clear();
  }
}

export default EventEmitter;
