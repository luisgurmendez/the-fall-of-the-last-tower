import { isStepable } from "../behaviors/stepable";
import GameContext from "../core/gameContext";
import { isInitializable } from "../behaviors/initializable";
import { isDisposable } from "../behaviors/disposable";
import { filterInPlaceAndGetRest } from "../utils/fn";

class ObjectLifecycleController {

  initialize(gameContext: GameContext) {
    const { objects } = gameContext;

    objects.forEach(obj => {
      if (isInitializable(obj) && obj.shouldInitialize) {
        obj.init(gameContext);
        obj.shouldInitialize = false;
      }
    })
  }

  step(gameContext: GameContext) {
    const objects = gameContext.objects;
    objects.forEach(obj => {
      if (isStepable(obj)) {
        obj.step(gameContext)
      }
    })
  }

  dispose(gameContext: GameContext) {
    const { objects } = gameContext;

    const objsToDispose = filterInPlaceAndGetRest(objects, obj => {
      return !(isDisposable(obj) && obj.shouldDispose);
    })

    objsToDispose.forEach(obj => {
      (isDisposable(obj) && obj.dispose) && obj.dispose();
    });
  }
}

export default ObjectLifecycleController;