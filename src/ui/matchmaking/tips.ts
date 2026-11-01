/**
 * Gameplay tips shown at the bottom of the matchmaking overlay, changed
 * every 10 seconds.
 */

/**
 * Tips to display randomly.
 */
const TIPS = [
  "Tip: Use QWER for abilities, right-click to move",
  "Tip: Press P to open the shop",
  "Tip: Last hitting minions gives bonus gold",
  "Tip: Stay behind your minions to avoid tower damage",
  "Tip: Press TAB to see the scoreboard",
  "Tip: Wards reveal invisible enemies",
  "Tip: Killing dragon gives team-wide buffs",
  "Tip: The Rootwyrm wakes in the top river at 4:00; slaying it toughens your whole team",
];

/**
 * Start tip rotation.
 */
export function startTipRotation(tipText: HTMLElement): void {
  setInterval(() => {
    showRandomTip(tipText);
  }, 10000);
}

/**
 * Show a random tip.
 */
export function showRandomTip(tipText: HTMLElement): void {
  if (!tipText) return;
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  tipText.textContent = tip;
}
