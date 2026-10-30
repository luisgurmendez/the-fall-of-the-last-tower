/**
 * FullscreenButton - The fullscreen toggle under the top-right stats panel.
 *
 * It shows on every screen (menu, champion select and the game). The F key
 * toggles fullscreen too (InputManager).
 */

import { InputManager } from "@/core/input/InputManager";

/**
 * Wire the #btn-fullscreen button in index.html.
 */
export function setupFullscreenButton(): void {
  const button = document.getElementById("btn-fullscreen");
  if (!button) return;

  button.addEventListener("click", () => {
    InputManager.getInstance().toggleFullscreen();
    // Don't keep focus: Space or Enter would toggle it again
    button.blur();
  });

  const showState = () => {
    const isFullscreen = document.fullscreenElement !== null;
    button.classList.toggle("is-fullscreen", isFullscreen);
    button.title = isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)";
  };
  document.addEventListener("fullscreenchange", showState);
  showState();
}
