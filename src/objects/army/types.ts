import { Collisionable } from "@/mixins/collisionable";
import { Rectangle } from "../shapes";
import BaseObject from "../baseObject";

/// 0 == ally, 1 == enemy
export type ArmyUnitSide = 0 | 1;

export type Target = BaseObject & Collisionable<Rectangle>;