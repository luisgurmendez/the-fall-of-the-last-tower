import type GameContext from "@/core/gameContext";

export interface Disposable {
  shouldDispose: boolean;
  dispose?: (g: GameContext) => void | undefined;
}

export function isDisposable(obj: any): obj is Disposable {
  return typeof obj === "object" && obj.shouldDispose !== undefined;
}

export default Disposable;
