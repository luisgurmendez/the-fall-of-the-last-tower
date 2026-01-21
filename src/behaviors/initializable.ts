import type GameContext from "@/core/gameContext";

export interface Initializable {
  shouldInitialize: boolean;
  init: (gameContext: GameContext) => void;
}

export function isInitializable(obj: any): obj is Initializable {
  return typeof obj === "object" && obj.init !== undefined;
}

export default Initializable;
