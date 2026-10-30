/**
 * Generic trap placement (a `ground_target` with a trap, like Vile's E).
 * Triggering, roots and explosions are handled by ServerTrap.
 */

import type { AbilityDefinition } from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import { ServerTrap } from "../../simulation/ServerTrap";
import { Logger } from "../../utils/Logger";

/**
 * Execute trap placement (like Vile's E).
 */
export function executeTrapPlacement(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number
): void {
  const { champion, targetPosition, context } = params;

  if (!targetPosition || !definition.trap) return;

  // Get R rank for explosion damage scaling
  const rState = champion.abilityStates.R;
  const rRank = Math.max(1, rState.rank); // Default to rank 1 if R not learned
  const explosionDamage = definition.trap.explosionDamage?.[rRank - 1] ?? 0;

  // Create the trap
  const trap = new ServerTrap({
    id: context.generateEntityId(),
    position: targetPosition.clone(),
    side: champion.side,
    ownerId: champion.id,
    triggerRadius: definition.trap.triggerRadius,
    duration: definition.trap.duration,
    isStealthed: definition.trap.isStealthed,
    rootDuration: definition.trap.rootDuration,
    soulStacksOnTrigger: definition.trap.soulStacksOnTrigger ?? 0,
    explosionDamage: explosionDamage,
    explosionRadius: definition.trap.explosionRadius ?? 300,
    explosionRootDuration: definition.trap.explosionRootDuration ?? 1,
  });

  context.addEntity(trap);

  Logger.debug("Ability", `${champion.playerId} placed trap at (${targetPosition.x}, ${targetPosition.y})`);
}
