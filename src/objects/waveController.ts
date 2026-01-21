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
import { GameConfig, WaveConfig } from "@/config";

class WaveController extends BaseObject {
    wave = 1;
    hasLostCheck = false;
    cooldown = new Cooldown(WaveConfig.SPAWN_INTERVAL);
    waveRecord = this.getWaveRecord();

    private getWaveRecord(): string | null {
        try {
            return localStorage.getItem(GameConfig.STORAGE.WAVE_RECORD);
        } catch {
            return null;
        }
    }

    private setWaveRecord(wave: number): void {
        try {
            localStorage.setItem(GameConfig.STORAGE.WAVE_RECORD, wave.toString());
        } catch {
            // Silent fail in private browsing mode
        }
    }

    step(context: GameContext): void {
        this.cooldown.update(context.dt);
        this.buildWave(context);
        if (context.castle === undefined && !this.hasLostCheck) {
            this.setWaveRecord(this.wave);
            context.objects.push(new FreezedTextSequence([`You lost!, reached wave ${this.wave}, Press r to restart`]));
            this.hasLostCheck = true;
        }
    }

    buildWave(context: GameContext) {
        if (!this.cooldown.isCooling() && !this.hasLostCheck) {
            this.cooldown.start();
            const soldiers: BaseObject[] = [];

            // Spawn swordsmen
            const swordsmenCount = WaveConfig.SCALING.getSwordsmenCount(this.wave);
            for (let i = 0; i < swordsmenCount; i++) {
                soldiers.push(new Swordsman(
                    new Vector(WaveConfig.SPAWN.SWORDSMAN_X, RandomUtils.getNumberWithVariance(WaveConfig.SPAWN.Y_CENTER, WaveConfig.SPAWN.Y_RANGE)),
                    1
                ));
            }

            // Spawn archers (starting from wave 4)
            const archerCount = WaveConfig.SCALING.getArcherCount(this.wave);
            for (let i = 0; i < archerCount; i++) {
                soldiers.push(new Archer(
                    new Vector(WaveConfig.SPAWN.ARCHER_X, RandomUtils.getNumberWithVariance(WaveConfig.SPAWN.Y_CENTER, WaveConfig.SPAWN.Y_RANGE)),
                    1
                ));
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