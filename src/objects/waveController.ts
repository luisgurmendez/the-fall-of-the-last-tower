import GameContext from "@/core/gameContext";
import BaseObject from "./baseObject";
import Swordsman from "./army/swordsman/swordsman";
import Vector from "@/physics/vector";
import RandomUtils from "@/utils/random";
import Archer from "./army/archer/archer";
import TimedTextSequence from "./timedTextSequence";

class WaveController extends BaseObject {
    wave = 1;

    step(context: GameContext): void {
        this.buildWave(this.wave, context);
    }

    buildWave(wave: number, context: GameContext) {
        if (wave < 1) {
            const soldiers: BaseObject[] = [];
            for (let i = 0; i < 15; i++) {
                // soldiers.push(new Swordsman(new Vector(context.worldDimensions.w / 2, RandomUtils.getNumberWithVariance(-300, 600),), 1));
            }
            for (let i = 0; i < 10; i++) {
                soldiers.push(new Archer(new Vector(context.worldDimensions.w / 2, RandomUtils.getNumberWithVariance(-300, 600),), 1));
            }
            context.objects.push(...soldiers);
            this.wave++;
            context.objects.push(new TimedTextSequence([`Wave ${this.wave}`]));
        }
    }
}

function buildSwordsmen() {
    const soldiers: BaseObject[] = [];
    for (let i = 0; i < 100; i++) {
        const side = 0;
        soldiers.push(
            new Swordsman(
                new Vector(
                    Math.random() * 400,
                    Math.random() * 600 - 500
                ),
                side
            )
        );
    }
    return soldiers;
}

function buildArchers() {
    const soldiers: BaseObject[] = [];
    for (let i = 0; i < 50; i++) {
        const side = 0;
        soldiers.push(
            new Archer(
                new Vector(
                    100 * side - 300 + Math.random() * 50,
                    Math.random() * 1000 - 500
                ),
                side
            )
        );
    }
    return soldiers;
}


export default WaveController;