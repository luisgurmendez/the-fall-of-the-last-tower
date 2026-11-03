/**
 * The title screen: the animated valley behind the menu (titleScene.ts),
 * the champions marching through it (titleParade.ts) and the logo
 * (pixelLogo.ts).
 *
 * TitleScreen is the coordinator: it puts the canvases in the matchmaking
 * overlay, runs the animation while it's active (MatchmakingUI turns it on
 * for the menu and the screens around it, off for champion select, the
 * loading screen and the match) and fits everything to the window. With
 * reduced motion it draws one still frame.
 */

import { GAME_NAME } from "@/config/brand";
import { PixelLogo } from "./pixelLogo";
import { TitleParade } from "./titleParade";
import { TitleScene } from "./titleScene";

/** The logo is drawn at most this wide (CSS pixels), its pixels a whole number of them */
const LOGO_MAX_WIDTH = 760;
/** ...and at most this share of the window's width */
const LOGO_MAX_SHARE = 0.86;
/** A still frame, for reduced motion: this many seconds in */
const STILL_TIME = 6;

export class TitleScreen {
  private readonly overlay: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scene = new TitleScene();
  private readonly parade = new TitleParade();
  private readonly logo: PixelLogo;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private active = false;
  private frameId: number | null = null;
  private startedAt = 0;
  private lastFrame = 0;
  private introduced = false;

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;
    document.title = GAME_NAME;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "title-scene";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d")!;
    const vignette = document.createElement("div");
    vignette.className = "title-vignette";
    overlay.prepend(this.canvas, vignette);

    // The logo replaces the plain title, which stays for screen readers
    this.logo = new PixelLogo(GAME_NAME);
    this.logo.canvas.className = "title-logo";
    this.logo.canvas.setAttribute("role", "img");
    this.logo.canvas.setAttribute("aria-label", GAME_NAME);
    const heading = overlay.querySelector(".game-logo");
    heading?.append(this.logo.canvas);
    heading?.classList.add("has-logo");
    // The logo's emblem is the tab's icon
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = this.logo.iconURL();
    document.head.append(icon);

    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  /** Show and animate the title screen, or hide and stop it */
  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.overlay.classList.toggle("title-scene-on", active);
    if (active && !this.introduced) {
      // The logo drops in the first time
      this.introduced = true;
      this.overlay.classList.add("title-intro");
    }
    if (!active) {
      if (this.frameId !== null) cancelAnimationFrame(this.frameId);
      this.frameId = null;
      return;
    }
    if (this.reducedMotion.matches) {
      this.drawFrame(STILL_TIME, 0);
      return;
    }
    this.startedAt = performance.now() - this.lastFrame * 1000;
    this.frameId = requestAnimationFrame(now => this.loop(now));
  }

  private loop(now: number): void {
    if (!this.active) return;
    const time = (now - this.startedAt) / 1000;
    // A long gap (the tab was hidden) doesn't throw everyone across the screen
    const dt = Math.min(0.1, Math.max(0, time - this.lastFrame));
    this.lastFrame = time;
    this.drawFrame(time, dt);
    this.frameId = requestAnimationFrame(next => this.loop(next));
  }

  private drawFrame(time: number, dt: number): void {
    const { ctx, scene } = this;
    scene.render(time);
    this.parade.update(scene, time, dt);
    const width = scene.width * scene.pixel;
    const height = scene.height * scene.pixel;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scene.back, 0, 0, width, height);
    this.parade.draw(ctx, scene, time);
    ctx.drawImage(scene.front, 0, 0, width, height);
    this.logo.draw(time);
  }

  /** Fit the scene to the window at the screen's resolution, and the logo to a whole-pixel size */
  private resize(): void {
    const ratio = window.devicePixelRatio || 1;
    this.scene.resize(window.innerWidth * ratio, window.innerHeight * ratio);
    this.canvas.width = this.scene.width * this.scene.pixel;
    this.canvas.height = this.scene.height * this.scene.pixel;
    this.canvas.style.width = `${this.canvas.width / ratio}px`;
    this.canvas.style.height = `${this.canvas.height / ratio}px`;

    // Full size on the menu, half on the screens around it (title.css picks)
    const available = Math.min(LOGO_MAX_WIDTH, window.innerWidth * LOGO_MAX_SHARE);
    const full = Math.max(2, Math.floor(available / this.logo.width));
    const compact = Math.max(1, Math.floor(full / 2));
    const { style } = this.logo.canvas;
    style.setProperty("--logo-width", `${this.logo.width * full}px`);
    style.setProperty("--logo-height", `${this.logo.height * full}px`);
    style.setProperty("--logo-compact-width", `${this.logo.width * compact}px`);
    style.setProperty("--logo-compact-height", `${this.logo.height * compact}px`);

    if (this.active && this.reducedMotion.matches) this.drawFrame(STILL_TIME, 0);
  }
}
