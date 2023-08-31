import { PixelArt } from "./PixelArtBuilder";
import PixelArtSpriteSheet from "./PixelArtSpriteSheet";

class PixelArtSpriteAnimator {
    private animations: { [key: string]: { frames: number[], duration: number } } = {};
    currentAnimation: string | null = null;
    private currentFrame: number = 0;
    private elapsedTime: number = 0;
    private loop: boolean = false;
    private spriteSheet: PixelArtSpriteSheet;
    private idleFrame: number;
    isPlayingAnimation: boolean = false;

    constructor(spritesheet: PixelArtSpriteSheet, idle: number = 0) {
        this.spriteSheet = spritesheet;
        this.idleFrame = idle;
    }

    // Add a new animation sequence
    addAnimation(name: string, frames: number[], duration: number): void {
        this.animations[name] = { frames, duration };
    }

    playAnimation(name: string, killPrevAnimation: boolean = false): void {
        if (name === this.currentAnimation || (this.isPlayingAnimation && !killPrevAnimation)) return;
        this.currentAnimation = name;
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.loop = false;
        this.isPlayingAnimation = true;
    }

    update(dt: number): void {
        if (!this.currentAnimation) return;

        this.elapsedTime += dt;

        const { frames, duration } = this.animations[this.currentAnimation];
        const totalDuration = frames.length * duration;

        if (this.elapsedTime > totalDuration) {
            this.currentAnimation = null;
            this.isPlayingAnimation = false;
            // if (this.loop) {
            //     this.elapsedTime %= totalDuration;
            // } else {
            //     this.currentAnimation = null;
            //     return;
            // }
        }

        this.currentFrame = Math.floor(this.elapsedTime / duration) % frames.length;
    }

    render(ctx: CanvasRenderingContext2D,): void {
        if (!this.currentAnimation) {
            this.spriteSheet.drawSprite(ctx, this.idleFrame);
            return;
        }
        const frame = this.animations[this.currentAnimation].frames[this.currentFrame];
        this.spriteSheet.drawSprite(ctx, frame);
    }

    // renderExactFrame(ctx: CanvasRenderingContext2D, frame: number) {
    //     this.spriteSheet.drawSprite(ctx, frame);
    // }
}

export default PixelArtSpriteAnimator;
