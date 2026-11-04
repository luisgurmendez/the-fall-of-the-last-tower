/**
 * Loads every champion's ability VFX definitions. Each module registers its
 * definitions when imported; VFXRegistry.ts imports this module, so anything
 * that reads the registry through VFXRegistry sees all of them.
 *
 * To add a champion's VFX, create ./<championId>.ts and import it here.
 */

import './warrior';
import './magnus';
import './elara';
import './gorath';
import './vex';
import './lume';
import './vile';
import './uruk';
import './oitboil';
import './elora';
import './caelum';
import './fenris';
import './calamitus';
import './protobot';
import './hop';
import './zhakrul';
import './kip';
import './nocthar';
