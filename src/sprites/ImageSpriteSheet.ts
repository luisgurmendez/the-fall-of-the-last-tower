class ImageSpriteSheet {
    private image: HTMLImageElement | null = null;
    private rows: number;
    private cols: number;
    private spriteWidth: number;
    private spriteHeight: number;

    constructor(rows: number, cols: number, spriteWidth: number, spriteHeight: number) {
        this.rows = rows;
        this.cols = cols;
        this.spriteWidth = spriteWidth;
        this.spriteHeight = spriteHeight;
    }

    // Load the sprite sheet image from a given URL
    load(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = url;
            img.onload = () => {
                this.image = img;
                resolve();
            };
            img.onerror = () => {
                reject(new Error('Failed to load sprite sheet image.'));
            };
        });
    }

    // Draw a specific sprite from the sprite sheet onto a canvas rendering context
    drawSprite(ctx: CanvasRenderingContext2D, row: number, col: number, x: number, y: number): void {
        if (!this.image) {
            console.error('SpriteSheet image not loaded.');
            return;
        }
        const sx = col * this.spriteWidth;
        const sy = row * this.spriteHeight;
        ctx.drawImage(this.image, sx, sy, this.spriteWidth, this.spriteHeight, x, y, this.spriteWidth, this.spriteHeight);
    }
}
