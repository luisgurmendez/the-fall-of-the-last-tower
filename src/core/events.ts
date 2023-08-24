
type Subscription = (...args: any) => void;

interface EventSubscription {
  [event: string]: Subscription[]
}

/**
 * @deprecated
 */
class GameEvents {

  private static instance: GameEvents
  private eventSubscriptions: EventSubscription;

  private constructor() {
    this.eventSubscriptions = {};
  }

  public static getInstance(): GameEvents {
    if (!GameEvents.instance) {
      GameEvents.instance = new GameEvents();
    }

    return GameEvents.instance;
  }
  on(event: string, cb: Subscription) {
    this.eventSubscriptions[event] = this.eventSubscriptions[event] || [];
    this.eventSubscriptions[event].push(cb);
  }

  off(event: string, cb: Subscription) {
    this.eventSubscriptions[event] = (this.eventSubscriptions[event] || []).filter(fn => fn != cb);
  }

  emit(event: string, ...args: any) {
    (this.eventSubscriptions[event] || []).map(fn => fn(...args));
  }
}

export default GameEvents;
