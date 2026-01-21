import { Collisionable } from "@/mixins/collisionable";
import { Rectangle, Shape } from "../shapes";
import BaseObject from "../baseObject";
import Attackable from "@/behaviors/attackable";
import { TeamId } from "@/core/Team";

/**
 * @deprecated Use TeamId from '@/core/Team' instead.
 * 0 == ally (TEAM.PLAYER), 1 == enemy (TEAM.ENEMY)
 */
export type ArmyUnitSide = TeamId;

export type Target = BaseObject & Collisionable<Shape> & Attackable;