/**
 * How far into its recall a champion is. The server sends recallProgress
 * only with the change of isRecalling (when the recall starts), so from
 * then on it's counted here on the client's clock.
 */

/** When each recalling champion's recall started, in the renderers' seconds */
const started = new Map<string, number>();

/**
 * Seconds into the champion's recall (0 when it isn't recalling). `reported`
 * is the progress the server last sent; `now` the renderers' clock.
 */
export function recallElapsed(entityId: string, isRecalling: boolean | undefined, reported: number | undefined, now: number): number {
  if (!isRecalling) {
    started.delete(entityId);
    return 0;
  }
  let start = started.get(entityId);
  if (start === undefined) {
    start = now - (reported ?? 0);
    started.set(entityId, start);
  }
  return now - start;
}
