import Game from "./core/game";
import Assets from "./controllers/AssetLoader";
import catapult from "./assets/catapult.png";

(async function () {
  const assets = Assets.getInstance();
  assets.add({ id: "catapult", url: catapult });
  await assets.loadAll();
  console.log("assets loaded!");
  console.log(assets.images);

  const game = new Game();
  (window as any).g = game;
  game.init();
  const init = game.loop();
  init();
})();
