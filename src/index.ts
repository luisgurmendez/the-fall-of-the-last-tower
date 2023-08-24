import Game from './core/game';

(async function () {
  const game = new Game();
  (window as any).g = game;
  game.init();
  const init = game.loop();
  init();
})();
