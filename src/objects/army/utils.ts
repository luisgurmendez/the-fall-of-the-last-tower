import BaseObject from "../baseObject"
import { ArmyUnitSide } from "./types"

/**
 * @deprecated Use enemyFilter from '@/core/Team' instead.
 * Filter for objects on the opposite side/team.
 */
export const otherSideObjectsFiltering = (side: ArmyUnitSide) => (obj: BaseObject) => (obj as any).side !== undefined && (obj as any).side !== side