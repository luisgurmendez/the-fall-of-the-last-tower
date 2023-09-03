
class Cooldown {
    cooldown: number;
    elapsed: number;
    constructor(cooldown: number) {
        this.cooldown = cooldown;
        this.elapsed = cooldown;
    }

    update(dt: number,) {
        this.elapsed += dt;
    }

    isCooling() {
        return this.elapsed < this.cooldown;
    }

    start() {
        this.elapsed = 0;
    }
}


export default Cooldown