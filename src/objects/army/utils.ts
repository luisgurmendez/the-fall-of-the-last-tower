import BaseObject from "../baseObject"
import { ArmyUnitSide } from "./types"

export const otherSideObjectsFiltering = (side: ArmyUnitSide) => (obj: BaseObject) => (obj as any).side !== undefined && (obj as any).side !== side