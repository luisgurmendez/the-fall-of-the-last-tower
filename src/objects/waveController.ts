import GameContext from "@/core/gameContext";
import BaseObject from "./baseObject";
import Swordsman from "./army/swordsman/swordsman";
import Vector from "@/physics/vector";
import RandomUtils from "@/utils/random";
import Archer from "./army/archer/archer";
import TimedTextSequence from "./timedTextSequence";
import Cooldown from "./cooldown";
import RenderElement from "@/render/renderElement";
import RenderUtils from "@/render/utils";

const waveRecord = 'lg-siege:wr';

class WaveController extends BaseObject {
    wave = 1;
    hasLostCheck = false;
    cooldown = new Cooldown(40);
    waveRecord = localStorage.getItem(waveRecord);

    step(context: GameContext): void {
        this.cooldown.update(context.dt);
        this.buildWave(context);
        if (context.castle === undefined && !this.hasLostCheck) {
            localStorage.setItem(waveRecord, this.wave.toString());
            context.objects.push(new FreezedTextSequence([`You lost!, reached wave ${this.wave}, Press r to restart`]));
            this.hasLostCheck = true;
        }
    }

    buildWave(context: GameContext) {
        if (!this.cooldown.isCooling() && !this.hasLostCheck) {
            this.cooldown.start();
            const soldiers: BaseObject[] = [];
            for (let i = 0; i < ((this.wave - 1) * 5) + 1; i++) {
                soldiers.push(new Swordsman(new Vector(2000, RandomUtils.getNumberWithVariance(-300, 600),), 1));
            }
            for (let i = 0; i < ((this.wave - 4) * 5); i++) {
                soldiers.push(new Archer(new Vector(2300, RandomUtils.getNumberWithVariance(-300, 600),), 1));
            }
            context.objects.push(...soldiers);
            this.wave++;
            context.objects.push(new TimedTextSequence([`Wave ${this.wave}`]));
        }
    }

    render() {
        const el = new RenderElement((gtx) => {
            const { canvasRenderingContext } = gtx;
            if (this.waveRecord) {
                RenderUtils.renderText(canvasRenderingContext, `Record: Wave ${this.waveRecord}`, new Vector(99, 0))
            }
        });
        el.positionType = 'overlay';
        return el;
    }
}

export default WaveController;



class FreezedTextSequence extends TimedTextSequence {
    step(context: GameContext): void { }
}