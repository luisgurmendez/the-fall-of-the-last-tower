// src/math/Vector.ts
class Vector {
  x;
  y;
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  clone() {
    return new Vector(this.x, this.y);
  }
  distanceTo(v) {
    return Math.sqrt(Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2));
  }
  distanceToSq(v) {
    return Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2);
  }
  lengthSq() {
    return Math.pow(this.x, 2) + Math.pow(this.y, 2);
  }
  length() {
    return Math.sqrt(this.lengthSq());
  }
  normalize() {
    const length = this.length();
    if (length === 0) {
      return this;
    }
    this.x /= length;
    this.y /= length;
    return this;
  }
  normalized() {
    return this.clone().normalize();
  }
  scalar(n) {
    this.x *= n;
    this.y *= n;
    return this;
  }
  scaled(n) {
    return this.clone().scalar(n);
  }
  add(v) {
    this.set(this.x + v.x, this.y + v.y);
    return this;
  }
  added(v) {
    return this.clone().add(v);
  }
  sub(v) {
    this.set(this.x - v.x, this.y - v.y);
    return this;
  }
  subtracted(v) {
    return this.clone().sub(v);
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  setFrom(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  angleTo(v) {
    const dot = this.dot(v);
    const det = this.cross(v);
    return Math.atan2(det, dot);
  }
  angle() {
    return Math.atan2(this.y, this.x);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  cross(v) {
    return this.x * v.y - this.y * v.x;
  }
  rotate(angle, inDegree = true) {
    let _angleInRads = angle * (Math.PI / 180);
    if (!inDegree) {
      _angleInRads = angle;
    }
    const cos = Math.round(1000 * Math.cos(_angleInRads)) / 1000;
    const sin = Math.round(1000 * Math.sin(_angleInRads)) / 1000;
    const old = this.clone();
    this.x = old.x * cos - old.y * sin;
    this.y = old.x * sin + old.y * cos;
    return this;
  }
  rotated(angle, inDegree = true) {
    return this.clone().rotate(angle, inDegree);
  }
  lerp(v, t) {
    this.x = this.x + (v.x - this.x) * t;
    this.y = this.y + (v.y - this.y) * t;
    return this;
  }
  lerped(v, t) {
    return this.clone().lerp(v, t);
  }
  equals(v, epsilon = 0.0001) {
    return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon;
  }
  isZero(epsilon = 0.0001) {
    return Math.abs(this.x) < epsilon && Math.abs(this.y) < epsilon;
  }
  toArray() {
    return [this.x, this.y];
  }
  toString() {
    return `Vector(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }
  static fromAngle(angle) {
    return new Vector(Math.cos(angle), Math.sin(angle));
  }
  static direction(from, to) {
    return to.subtracted(from).normalize();
  }
  static lerp(a, b, t) {
    return a.lerped(b, t);
  }
  static distance(a, b) {
    return a.distanceTo(b);
  }
  static zero() {
    return new Vector(0, 0);
  }
  static up() {
    return new Vector(0, -1);
  }
  static down() {
    return new Vector(0, 1);
  }
  static left() {
    return new Vector(-1, 0);
  }
  static right() {
    return new Vector(1, 0);
  }
}
// src/math/shapes.ts
class Rectangle {
  w;
  h;
  constructor(w, h) {
    this.w = w;
    this.h = h;
  }
  get width() {
    return this.w;
  }
  get height() {
    return this.h;
  }
  get maxDistanceToCenter() {
    return Math.max(this.w, this.h) / 2;
  }
  get halfWidth() {
    return this.w / 2;
  }
  get halfHeight() {
    return this.h / 2;
  }
  clone() {
    return new Rectangle(this.w, this.h);
  }
}

class Circle {
  radius;
  constructor(r) {
    this.radius = r;
  }
  get maxDistanceToCenter() {
    return this.radius;
  }
  get perimeter() {
    return 2 * Math.PI * this.radius;
  }
  get area() {
    return Math.PI * this.radius * this.radius;
  }
  clone() {
    return new Circle(this.radius);
  }
}

class Square extends Rectangle {
  constructor(size) {
    super(size, size);
  }
  get size() {
    return this.w;
  }
  clone() {
    return new Square(this.w);
  }
}

class NullShape {
  get maxDistanceToCenter() {
    return 0;
  }
  clone() {
    return new NullShape;
  }
}
// src/types/units.ts
var TEAM_BLUE = 0;
var TEAM_RED = 1;
function isSided(obj) {
  return typeof obj === "object" && obj !== null && "side" in obj;
}
function isTargetable(obj) {
  return typeof obj === "object" && obj !== null && "id" in obj && "position" in obj && "collisionMask" in obj;
}
function isDamageable(obj) {
  return typeof obj === "object" && obj !== null && "health" in obj && "takeDamage" in obj && typeof obj.takeDamage === "function";
}
function oppositeSide(side) {
  return side === 0 ? 1 : 0;
}
// src/types/champions.ts
var LEVEL_EXPERIENCE = [
  0,
  280,
  660,
  1140,
  1720,
  2400,
  3180,
  4060,
  5040,
  6120,
  7300,
  8580,
  9960,
  11440,
  13020,
  14700,
  16480,
  18360
];
function calculateStat(baseStat, growthStat, level) {
  return baseStat + growthStat * (level - 1);
}
function calculateAttackSpeed(baseAttackSpeed, attackSpeedGrowth, level, bonusAttackSpeed = 0) {
  const growthBonus = attackSpeedGrowth * (level - 1) / 100;
  return baseAttackSpeed * (1 + growthBonus + bonusAttackSpeed);
}
function calculateStatsAtLevel(baseStats, growthStats, level) {
  return {
    health: calculateStat(baseStats.health, growthStats.health, level),
    maxHealth: calculateStat(baseStats.health, growthStats.health, level),
    healthRegen: calculateStat(baseStats.healthRegen, growthStats.healthRegen, level),
    resource: calculateStat(baseStats.resource, growthStats.resource, level),
    maxResource: calculateStat(baseStats.resource, growthStats.resource, level),
    resourceRegen: calculateStat(baseStats.resourceRegen, growthStats.resourceRegen, level),
    attackDamage: calculateStat(baseStats.attackDamage, growthStats.attackDamage, level),
    abilityPower: baseStats.abilityPower,
    attackSpeed: calculateAttackSpeed(baseStats.attackSpeed, growthStats.attackSpeed, level),
    attackRange: baseStats.attackRange,
    armor: calculateStat(baseStats.armor, growthStats.armor, level),
    magicResist: calculateStat(baseStats.magicResist, growthStats.magicResist, level),
    movementSpeed: baseStats.movementSpeed,
    critChance: baseStats.critChance,
    critDamage: baseStats.critDamage,
    level
  };
}
// src/types/effects.ts
function computeCCStatus(effects, getDefinition) {
  const status = {
    isStunned: false,
    isSilenced: false,
    isGrounded: false,
    isRooted: false,
    isDisarmed: false,
    canMove: true,
    canAttack: true,
    canCast: true,
    canUseMobilityAbilities: true
  };
  for (const effect of effects) {
    const def = getDefinition(effect.definitionId);
    if (!def || !("ccType" in def))
      continue;
    switch (def.ccType) {
      case "stun":
      case "knockup":
      case "knockback":
      case "suppress":
        status.isStunned = true;
        break;
      case "silence":
        status.isSilenced = true;
        break;
      case "grounded":
        status.isGrounded = true;
        break;
      case "root":
        status.isRooted = true;
        break;
      case "disarm":
      case "blind":
        status.isDisarmed = true;
        break;
    }
  }
  status.canMove = !status.isStunned && !status.isRooted;
  status.canAttack = !status.isStunned && !status.isDisarmed;
  status.canCast = !status.isStunned && !status.isSilenced;
  status.canUseMobilityAbilities = status.canMove && status.canCast && !status.isGrounded;
  return status;
}
function defaultCCStatus() {
  return {
    isStunned: false,
    isSilenced: false,
    isGrounded: false,
    isRooted: false,
    isDisarmed: false,
    canMove: true,
    canAttack: true,
    canCast: true,
    canUseMobilityAbilities: true
  };
}
// src/types/abilities.ts
function getPassiveLevelValue(passive, level) {
  if (!passive.levelScaling) {
    return passive.damage?.scaling.base[0] ?? passive.heal?.scaling.base[0] ?? passive.shield?.scaling.base[0] ?? 0;
  }
  const { levels, values } = passive.levelScaling;
  for (let i = levels.length - 1;i >= 0; i--) {
    if (level >= levels[i]) {
      return values[i];
    }
  }
  return values[0];
}
var AbilityEntityType = {
  CHAMPION: 0,
  MINION: 1,
  TOWER: 2,
  INHIBITOR: 3,
  NEXUS: 4,
  JUNGLE_CAMP: 5,
  WARD: 7
};
function canAbilityAffectEntityType(ability, entityType) {
  if (!ability)
    return false;
  switch (entityType) {
    case AbilityEntityType.CHAMPION:
      return ability.affectsChampions !== false;
    case AbilityEntityType.MINION:
      return ability.affectsMinions !== false;
    case AbilityEntityType.TOWER:
    case AbilityEntityType.INHIBITOR:
    case AbilityEntityType.NEXUS:
      return ability.affectsTowers === true;
    case AbilityEntityType.JUNGLE_CAMP:
      return ability.affectsJungleCamps !== false;
    case AbilityEntityType.WARD:
      return ability.affectsWards === true;
    default:
      return true;
  }
}
function calculateAbilityValue(scaling, rank, stats) {
  if (rank < 1 || rank > scaling.base.length) {
    return 0;
  }
  let value = scaling.base[rank - 1];
  if (scaling.adRatio && stats.attackDamage) {
    value += stats.attackDamage * scaling.adRatio;
  }
  if (scaling.apRatio && stats.abilityPower) {
    value += stats.abilityPower * scaling.apRatio;
  }
  if (scaling.bonusHealthRatio && stats.bonusHealth) {
    value += stats.bonusHealth * scaling.bonusHealthRatio;
  }
  if (scaling.maxHealthRatio && stats.maxHealth) {
    value += stats.maxHealth * scaling.maxHealthRatio;
  }
  if (scaling.missingHealthRatio && stats.missingHealth) {
    value += stats.missingHealth * scaling.missingHealthRatio;
  }
  if (scaling.armorRatio && stats.armor) {
    value += stats.armor * scaling.armorRatio;
  }
  if (scaling.magicResistRatio && stats.magicResist) {
    value += stats.magicResist * scaling.magicResistRatio;
  }
  return value;
}
// src/types/items.ts
function calculateItemStats(items, getDefinition) {
  const totalStats = {};
  for (const item of items) {
    if (!item)
      continue;
    const def = getDefinition(item.definitionId);
    if (!def)
      continue;
    for (const [stat, value] of Object.entries(def.stats)) {
      const key = stat;
      totalStats[key] = (totalStats[key] || 0) + value;
    }
  }
  return totalStats;
}
function findEmptySlot(items) {
  for (let i = 0;i < 6; i++) {
    if (!items[i]) {
      return i;
    }
  }
  return null;
}
function hasItem(items, itemId) {
  return items.some((item) => item?.definitionId === itemId);
}
// src/types/network.ts
var InputType;
((InputType2) => {
  InputType2[InputType2["MOVE"] = 0] = "MOVE";
  InputType2[InputType2["ATTACK_MOVE"] = 1] = "ATTACK_MOVE";
  InputType2[InputType2["TARGET_UNIT"] = 2] = "TARGET_UNIT";
  InputType2[InputType2["STOP"] = 3] = "STOP";
  InputType2[InputType2["ABILITY"] = 4] = "ABILITY";
  InputType2[InputType2["LEVEL_UP"] = 5] = "LEVEL_UP";
  InputType2[InputType2["BUY_ITEM"] = 6] = "BUY_ITEM";
  InputType2[InputType2["SELL_ITEM"] = 7] = "SELL_ITEM";
  InputType2[InputType2["RECALL"] = 8] = "RECALL";
  InputType2[InputType2["PING"] = 9] = "PING";
  InputType2[InputType2["CHAT"] = 10] = "CHAT";
  InputType2[InputType2["PLACE_WARD"] = 11] = "PLACE_WARD";
})(InputType ||= {});
var EntityType;
((EntityType2) => {
  EntityType2[EntityType2["CHAMPION"] = 0] = "CHAMPION";
  EntityType2[EntityType2["MINION"] = 1] = "MINION";
  EntityType2[EntityType2["TOWER"] = 2] = "TOWER";
  EntityType2[EntityType2["INHIBITOR"] = 3] = "INHIBITOR";
  EntityType2[EntityType2["NEXUS"] = 4] = "NEXUS";
  EntityType2[EntityType2["JUNGLE_CAMP"] = 5] = "JUNGLE_CAMP";
  EntityType2[EntityType2["PROJECTILE"] = 6] = "PROJECTILE";
  EntityType2[EntityType2["WARD"] = 7] = "WARD";
  EntityType2[EntityType2["ZONE"] = 8] = "ZONE";
})(EntityType ||= {});
var EntityChangeMask;
((EntityChangeMask2) => {
  EntityChangeMask2[EntityChangeMask2["POSITION"] = 1] = "POSITION";
  EntityChangeMask2[EntityChangeMask2["HEALTH"] = 2] = "HEALTH";
  EntityChangeMask2[EntityChangeMask2["RESOURCE"] = 4] = "RESOURCE";
  EntityChangeMask2[EntityChangeMask2["LEVEL"] = 8] = "LEVEL";
  EntityChangeMask2[EntityChangeMask2["EFFECTS"] = 16] = "EFFECTS";
  EntityChangeMask2[EntityChangeMask2["ABILITIES"] = 32] = "ABILITIES";
  EntityChangeMask2[EntityChangeMask2["ITEMS"] = 64] = "ITEMS";
  EntityChangeMask2[EntityChangeMask2["TARGET"] = 128] = "TARGET";
  EntityChangeMask2[EntityChangeMask2["STATE"] = 256] = "STATE";
  EntityChangeMask2[EntityChangeMask2["TRINKET"] = 512] = "TRINKET";
  EntityChangeMask2[EntityChangeMask2["GOLD"] = 1024] = "GOLD";
  EntityChangeMask2[EntityChangeMask2["SHIELDS"] = 2048] = "SHIELDS";
  EntityChangeMask2[EntityChangeMask2["PASSIVE"] = 4096] = "PASSIVE";
})(EntityChangeMask ||= {});
var GameEventType;
((GameEventType2) => {
  GameEventType2[GameEventType2["CHAMPION_KILL"] = 0] = "CHAMPION_KILL";
  GameEventType2[GameEventType2["TOWER_DESTROYED"] = 1] = "TOWER_DESTROYED";
  GameEventType2[GameEventType2["DRAGON_KILLED"] = 2] = "DRAGON_KILLED";
  GameEventType2[GameEventType2["BARON_KILLED"] = 3] = "BARON_KILLED";
  GameEventType2[GameEventType2["INHIBITOR_DESTROYED"] = 4] = "INHIBITOR_DESTROYED";
  GameEventType2[GameEventType2["INHIBITOR_RESPAWNED"] = 5] = "INHIBITOR_RESPAWNED";
  GameEventType2[GameEventType2["NEXUS_DESTROYED"] = 6] = "NEXUS_DESTROYED";
  GameEventType2[GameEventType2["FIRST_BLOOD"] = 7] = "FIRST_BLOOD";
  GameEventType2[GameEventType2["ACE"] = 8] = "ACE";
  GameEventType2[GameEventType2["MULTI_KILL"] = 9] = "MULTI_KILL";
  GameEventType2[GameEventType2["ABILITY_CAST"] = 10] = "ABILITY_CAST";
  GameEventType2[GameEventType2["ITEM_PURCHASED"] = 11] = "ITEM_PURCHASED";
  GameEventType2[GameEventType2["LEVEL_UP"] = 12] = "LEVEL_UP";
  GameEventType2[GameEventType2["BASIC_ATTACK"] = 13] = "BASIC_ATTACK";
  GameEventType2[GameEventType2["DAMAGE"] = 14] = "DAMAGE";
  GameEventType2[GameEventType2["GOLD_EARNED"] = 15] = "GOLD_EARNED";
  GameEventType2[GameEventType2["XP_EARNED"] = 16] = "XP_EARNED";
})(GameEventType ||= {});
var ServerMessageType;
((ServerMessageType2) => {
  ServerMessageType2[ServerMessageType2["FULL_STATE"] = 0] = "FULL_STATE";
  ServerMessageType2[ServerMessageType2["STATE_UPDATE"] = 1] = "STATE_UPDATE";
  ServerMessageType2[ServerMessageType2["EVENT"] = 2] = "EVENT";
  ServerMessageType2[ServerMessageType2["ERROR"] = 3] = "ERROR";
  ServerMessageType2[ServerMessageType2["PONG"] = 4] = "PONG";
  ServerMessageType2[ServerMessageType2["GAME_START"] = 5] = "GAME_START";
  ServerMessageType2[ServerMessageType2["GAME_END"] = 6] = "GAME_END";
})(ServerMessageType ||= {});
var ClientMessageType;
((ClientMessageType2) => {
  ClientMessageType2[ClientMessageType2["INPUT"] = 0] = "INPUT";
  ClientMessageType2[ClientMessageType2["PING"] = 1] = "PING";
  ClientMessageType2[ClientMessageType2["READY"] = 2] = "READY";
  ClientMessageType2[ClientMessageType2["EVENT_ACK"] = 3] = "EVENT_ACK";
})(ClientMessageType ||= {});
// src/types/minions.ts
var DEFAULT_MINION_STATS = {
  melee: {
    health: 477,
    maxHealth: 477,
    armor: 10,
    magicResist: 10,
    attackDamage: 23,
    attackRange: 50,
    attackCooldown: 2,
    movementSpeed: 100,
    sightRange: 200,
    goldReward: 21,
    experienceReward: 60,
    collision: {
      type: "circle",
      radius: 12,
      offset: { x: 0, y: 0 }
    }
  },
  caster: {
    health: 296,
    maxHealth: 296,
    armor: 5,
    magicResist: 5,
    attackDamage: 12,
    attackRange: 300,
    attackCooldown: 2.4,
    movementSpeed: 100,
    sightRange: 200,
    goldReward: 14,
    experienceReward: 32,
    collision: {
      type: "circle",
      radius: 10,
      offset: { x: 0, y: 0 }
    }
  },
  siege: {
    health: 900,
    maxHealth: 900,
    armor: 30,
    magicResist: 0,
    attackDamage: 50,
    attackRange: 300,
    attackCooldown: 2,
    movementSpeed: 180,
    sightRange: 500,
    goldReward: 60,
    experienceReward: 93,
    collision: {
      type: "circle",
      radius: 18,
      offset: { x: 0, y: 0 }
    }
  },
  super: {
    health: 1500,
    maxHealth: 1500,
    armor: 30,
    magicResist: 0,
    attackDamage: 180,
    attackRange: 100,
    attackCooldown: 0.85,
    movementSpeed: 220,
    sightRange: 500,
    goldReward: 60,
    experienceReward: 97,
    collision: {
      type: "circle",
      radius: 22,
      offset: { x: 0, y: 0 }
    }
  }
};
var DEFAULT_MINION_WAVE_CONFIG = {
  waveInterval: 30,
  firstWaveDelay: 65,
  spawnDelayBetween: 1.4,
  normalWave: {
    melee: 3,
    caster: 3,
    siege: 0
  },
  siegeWave: {
    melee: 3,
    caster: 3,
    siege: 1
  }
};
// src/types/structures.ts
var DEFAULT_TOWER_STATS = {
  1: {
    health: 3000,
    maxHealth: 3000,
    armor: 40,
    magicResist: 40,
    attackDamage: 152,
    attackRange: 750,
    attackCooldown: 0.83,
    warmupDamagePerStack: 40,
    maxWarmupStacks: 5,
    collision: { type: "circle", radius: 50, offset: { x: 0, y: 0 } }
  },
  2: {
    health: 3500,
    maxHealth: 3500,
    armor: 55,
    magicResist: 55,
    attackDamage: 170,
    attackRange: 750,
    attackCooldown: 0.83,
    warmupDamagePerStack: 45,
    maxWarmupStacks: 5,
    collision: { type: "circle", radius: 55, offset: { x: 0, y: 0 } }
  },
  3: {
    health: 4000,
    maxHealth: 4000,
    armor: 70,
    magicResist: 70,
    attackDamage: 190,
    attackRange: 750,
    attackCooldown: 0.83,
    warmupDamagePerStack: 50,
    maxWarmupStacks: 5,
    collision: { type: "circle", radius: 60, offset: { x: 0, y: 0 } }
  }
};
var TowerTargetPriority;
((TowerTargetPriority2) => {
  TowerTargetPriority2[TowerTargetPriority2["NONE"] = 0] = "NONE";
  TowerTargetPriority2[TowerTargetPriority2["MINION"] = 10] = "MINION";
  TowerTargetPriority2[TowerTargetPriority2["CHAMPION"] = 50] = "CHAMPION";
  TowerTargetPriority2[TowerTargetPriority2["CHAMPION_ATTACKING_ALLY"] = 100] = "CHAMPION_ATTACKING_ALLY";
})(TowerTargetPriority ||= {});
var DEFAULT_INHIBITOR_STATS = {
  health: 4000,
  maxHealth: 4000,
  armor: 20,
  magicResist: 20,
  respawnTime: 300,
  collision: { type: "circle", radius: 45, offset: { x: 0, y: 0 } }
};
var DEFAULT_NEXUS_STATS = {
  health: 5500,
  maxHealth: 5500,
  armor: 20,
  magicResist: 20,
  collision: { type: "circle", radius: 75, offset: { x: 0, y: 0 } }
};
var DEFAULT_TOWER_REWARDS = {
  1: {
    localGold: 250,
    globalGold: 150,
    experience: 100
  },
  2: {
    localGold: 300,
    globalGold: 100,
    experience: 150
  },
  3: {
    localGold: 350,
    globalGold: 50,
    experience: 200
  }
};
// src/types/collision.ts
function isCircleCollision(collision) {
  return collision.type === "circle";
}
function isRectangleCollision(collision) {
  return collision.type === "rectangle";
}
function isCapsuleCollision(collision) {
  return collision.type === "capsule";
}
function getCollisionBounds(collision, position) {
  const offsetX = collision.offset?.x ?? 0;
  const offsetY = collision.offset?.y ?? 0;
  const centerX = position.x + offsetX;
  const centerY = position.y + offsetY;
  switch (collision.type) {
    case "circle": {
      const r = collision.radius;
      return {
        minX: centerX - r,
        maxX: centerX + r,
        minY: centerY - r,
        maxY: centerY + r
      };
    }
    case "rectangle": {
      const halfW = collision.width / 2;
      const halfH = collision.height / 2;
      return {
        minX: centerX - halfW,
        maxX: centerX + halfW,
        minY: centerY - halfH,
        maxY: centerY + halfH
      };
    }
    case "capsule": {
      const halfH = collision.height / 2;
      const r = collision.radius;
      return {
        minX: centerX - r,
        maxX: centerX + r,
        minY: centerY - halfH,
        maxY: centerY + halfH
      };
    }
  }
}
function getEffectiveRadius(collision) {
  switch (collision.type) {
    case "circle":
      return collision.radius;
    case "rectangle": {
      const halfW = collision.width / 2;
      const halfH = collision.height / 2;
      return Math.sqrt(halfW * halfW + halfH * halfH);
    }
    case "capsule":
      return collision.height / 2;
  }
}
function getCollisionCenter(collision, position) {
  return {
    x: position.x + (collision.offset?.x ?? 0),
    y: position.y + (collision.offset?.y ?? 0)
  };
}
function collisionShapesOverlap(collisionA, positionA, collisionB, positionB) {
  const centerA = getCollisionCenter(collisionA, positionA);
  const centerB = getCollisionCenter(collisionB, positionB);
  if (isCircleCollision(collisionA) && isCircleCollision(collisionB)) {
    return circleVsCircle(centerA, collisionA.radius, centerB, collisionB.radius);
  }
  if (isCircleCollision(collisionA) && isRectangleCollision(collisionB)) {
    return circleVsRectangle(centerA, collisionA.radius, centerB, collisionB.width, collisionB.height);
  }
  if (isRectangleCollision(collisionA) && isCircleCollision(collisionB)) {
    return circleVsRectangle(centerB, collisionB.radius, centerA, collisionA.width, collisionA.height);
  }
  if (isRectangleCollision(collisionA) && isRectangleCollision(collisionB)) {
    return rectangleVsRectangle(centerA, collisionA.width, collisionA.height, centerB, collisionB.width, collisionB.height);
  }
  if (isCapsuleCollision(collisionA) || isCapsuleCollision(collisionB)) {
    const radiusA = getEffectiveRadius(collisionA);
    const radiusB = getEffectiveRadius(collisionB);
    return circleVsCircle(centerA, radiusA, centerB, radiusB);
  }
  return false;
}
function circleVsCircle(centerA, radiusA, centerB, radiusB) {
  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = radiusA + radiusB;
  return distSq < radiusSum * radiusSum;
}
function circleVsRectangle(circleCenter, circleRadius, rectCenter, rectWidth, rectHeight) {
  const halfW = rectWidth / 2;
  const halfH = rectHeight / 2;
  const closestX = Math.max(rectCenter.x - halfW, Math.min(circleCenter.x, rectCenter.x + halfW));
  const closestY = Math.max(rectCenter.y - halfH, Math.min(circleCenter.y, rectCenter.y + halfH));
  const dx = circleCenter.x - closestX;
  const dy = circleCenter.y - closestY;
  const distSq = dx * dx + dy * dy;
  return distSq < circleRadius * circleRadius;
}
function rectangleVsRectangle(centerA, widthA, heightA, centerB, widthB, heightB) {
  const halfWA = widthA / 2;
  const halfHA = heightA / 2;
  const halfWB = widthB / 2;
  const halfHB = heightB / 2;
  return centerA.x - halfWA < centerB.x + halfWB && centerA.x + halfWA > centerB.x - halfWB && centerA.y - halfHA < centerB.y + halfHB && centerA.y + halfHA > centerB.y - halfHB;
}
function calculateCollisionSeparation(collisionA, positionA, collisionB, positionB) {
  const centerA = getCollisionCenter(collisionA, positionA);
  const centerB = getCollisionCenter(collisionB, positionB);
  const radiusA = getEffectiveRadius(collisionA);
  const radiusB = getEffectiveRadius(collisionB);
  const dx = centerA.x - centerB.x;
  const dy = centerA.y - centerB.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = radiusA + radiusB;
  if (distSq >= radiusSum * radiusSum) {
    return { x: 0, y: 0 };
  }
  const dist = Math.sqrt(distSq);
  const overlap = radiusSum - dist;
  if (dist === 0) {
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(angle) * overlap,
      y: Math.sin(angle) * overlap
    };
  }
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x: nx * overlap,
    y: ny * overlap
  };
}
var DEFAULT_CHAMPION_COLLISION = {
  type: "circle",
  radius: 25
};
var DEFAULT_MINION_COLLISION = {
  type: "circle",
  radius: 15
};
var DEFAULT_TOWER_COLLISION = {
  type: "circle",
  radius: 48
};
// src/types/animation.ts
function isDamageTrigger(trigger) {
  return trigger.type === "damage";
}
function isProjectileTrigger(trigger) {
  return trigger.type === "projectile";
}
function isEffectTrigger(trigger) {
  return trigger.type === "effect";
}
function isSoundTrigger(trigger) {
  return trigger.type === "sound";
}
function isVfxTrigger(trigger) {
  return trigger.type === "vfx";
}
function calculateAnimationPlayback(animation, speedMultiplier = 1) {
  const frameDuration = animation.baseFrameDuration / speedMultiplier;
  const totalDuration = frameDuration * animation.totalFrames;
  const keyframeTimes = new Map;
  for (const keyframe of animation.keyframes) {
    const triggerTime = keyframe.frame * frameDuration;
    keyframeTimes.set(keyframe.frame, triggerTime);
  }
  return {
    animation,
    speedMultiplier,
    totalDuration,
    frameDuration,
    keyframeTimes
  };
}
function getTriggerTime(animation, triggerType, speedMultiplier = 1) {
  const keyframe = animation.keyframes.find((k) => k.trigger.type === triggerType);
  if (!keyframe)
    return null;
  const frameDuration = animation.baseFrameDuration / speedMultiplier;
  return keyframe.frame * frameDuration;
}
function getKeyframeAtTime(animation, playback, time, tolerance = 0.001) {
  const result = [];
  for (const keyframe of animation.keyframes) {
    const keyframeTime = playback.keyframeTimes.get(keyframe.frame);
    if (keyframeTime !== undefined && Math.abs(keyframeTime - time) <= tolerance) {
      result.push(keyframe);
    }
  }
  return result;
}
function getKeyframesInRange(animation, playback, startTime, endTime) {
  const result = [];
  for (const keyframe of animation.keyframes) {
    const keyframeTime = playback.keyframeTimes.get(keyframe.frame);
    if (keyframeTime !== undefined && keyframeTime >= startTime && keyframeTime < endTime) {
      result.push(keyframe);
    }
  }
  return result;
}
function scaleAnimationSpeed(animation, targetDuration, minSpeed = 0.1, maxSpeed = 10) {
  const baseDuration = animation.baseFrameDuration * animation.totalFrames;
  const speed = baseDuration / targetDuration;
  return Math.min(maxSpeed, Math.max(minSpeed, speed));
}
function getFrameAtTime(playback, time) {
  const frame = Math.floor(time / playback.frameDuration);
  if (playback.animation.loop) {
    return frame % playback.animation.totalFrames;
  }
  return Math.min(frame, playback.animation.totalFrames - 1);
}
function isAnimationComplete(playback, time) {
  if (playback.animation.loop) {
    return false;
  }
  return time >= playback.totalDuration;
}
function getAttackAnimationSpeed(attackSpeed, baseAttackDuration = 0.5, minDuration = 0.15) {
  const targetDuration = baseAttackDuration / attackSpeed;
  const clampedDuration = Math.max(targetDuration, minDuration);
  return baseAttackDuration / clampedDuration;
}
function getAttackAnimationDuration(attackSpeed, baseAttackDuration = 0.5, minDuration = 0.15) {
  const targetDuration = baseAttackDuration / attackSpeed;
  return Math.max(targetDuration, minDuration);
}
function createDefaultAttackAnimation(totalFrames = 6, baseFrameDuration = 0.083) {
  const damageFrame = Math.floor(totalFrames / 2);
  return {
    id: "attack",
    totalFrames,
    baseFrameDuration,
    loop: false,
    keyframes: [
      { frame: damageFrame, trigger: { type: "damage" } }
    ]
  };
}
function createDefaultIdleAnimation(totalFrames = 4, baseFrameDuration = 0.2) {
  return {
    id: "idle",
    totalFrames,
    baseFrameDuration,
    loop: true,
    keyframes: []
  };
}
function createDefaultWalkAnimation(totalFrames = 8, baseFrameDuration = 0.1) {
  return {
    id: "walk",
    totalFrames,
    baseFrameDuration,
    loop: true,
    keyframes: []
  };
}
// src/config/MOBAConfig.ts
var MOBAConfig = {
  MAP_SIZE: {
    width: 3600,
    height: 3600
  },
  WATER_BORDER_SIZE: 192,
  NEXUS: {
    BLUE: { x: -1200, y: 1200 },
    RED: { x: 1200, y: -1200 },
    RADIUS: 75,
    HEALTH: 5000,
    collision: { type: "circle", radius: 75, offset: { x: 0, y: 0 } }
  },
  LANES: {
    TOP: {
      id: "top",
      waypoints: [
        new Vector(-1200, 1200),
        new Vector(-1200, -1000),
        new Vector(-1000, -1200),
        new Vector(1200, -1200)
      ],
      width: 100
    },
    MID: {
      id: "mid",
      waypoints: [
        new Vector(-1200, 1200),
        new Vector(-750, 750),
        new Vector(0, 0),
        new Vector(750, -750),
        new Vector(1200, -1200)
      ],
      width: 100
    },
    BOT: {
      id: "bot",
      waypoints: [
        new Vector(-1200, 1200),
        new Vector(1000, 1200),
        new Vector(1200, 1000),
        new Vector(1200, -1200)
      ],
      width: 100
    }
  },
  JUNGLE: {
    CAMPS: [
      { id: "blue_gromp", position: new Vector(-750, -550), creatureType: "gromp", count: 1, respawnTime: 60 },
      { id: "blue_spiders", position: new Vector(-600, -150), creatureType: "spider", count: 3, respawnTime: 45 },
      { id: "blue_gromp_2", position: new Vector(-300, -50), creatureType: "gromp", count: 1, respawnTime: 60 },
      { id: "blue_wolves", position: new Vector(-800, 100), creatureType: "wolf", count: 2, respawnTime: 50 },
      { id: "blue_gromp_3", position: new Vector(-450, 300), creatureType: "gromp", count: 1, respawnTime: 60 },
      { id: "red_gromp", position: new Vector(750, 550), creatureType: "gromp", count: 1, respawnTime: 60 },
      { id: "red_spiders", position: new Vector(600, 150), creatureType: "spider", count: 3, respawnTime: 45 },
      { id: "red_gromp_2", position: new Vector(300, 50), creatureType: "gromp", count: 1, respawnTime: 60 },
      { id: "red_wolves", position: new Vector(800, -100), creatureType: "wolf", count: 2, respawnTime: 50 },
      { id: "red_gromp_3", position: new Vector(450, -300), creatureType: "gromp", count: 1, respawnTime: 60 }
    ],
    CREATURE_STATS: {
      gromp: {
        health: 500,
        damage: 30,
        attackRange: 80,
        attackCooldown: 1.5,
        movementSpeed: 80,
        sightRange: 180,
        leashRange: 300,
        goldReward: 80,
        expReward: 50,
        collision: { type: "circle", radius: 20, offset: { x: 0, y: 0 } }
      },
      wolf: {
        health: 350,
        damage: 25,
        attackRange: 60,
        attackCooldown: 1,
        movementSpeed: 120,
        sightRange: 200,
        leashRange: 300,
        goldReward: 60,
        expReward: 40,
        collision: { type: "circle", radius: 14, offset: { x: 0, y: 0 } }
      },
      raptor: {
        health: 200,
        damage: 20,
        attackRange: 100,
        attackCooldown: 1.2,
        movementSpeed: 100,
        sightRange: 220,
        leashRange: 300,
        goldReward: 40,
        expReward: 30,
        collision: { type: "circle", radius: 10, offset: { x: 0, y: 0 } }
      },
      krug: {
        health: 600,
        damage: 35,
        attackRange: 70,
        attackCooldown: 1.8,
        movementSpeed: 60,
        sightRange: 150,
        leashRange: 300,
        goldReward: 90,
        expReward: 55,
        collision: { type: "circle", radius: 22, offset: { x: 0, y: 0 } }
      },
      blue_buff: {
        health: 1200,
        damage: 50,
        attackRange: 100,
        attackCooldown: 1.4,
        movementSpeed: 80,
        sightRange: 220,
        leashRange: 350,
        goldReward: 120,
        expReward: 100,
        collision: { type: "circle", radius: 28, offset: { x: 0, y: 0 } }
      },
      red_buff: {
        health: 1200,
        damage: 60,
        attackRange: 80,
        attackCooldown: 1.2,
        movementSpeed: 80,
        sightRange: 220,
        leashRange: 350,
        goldReward: 120,
        expReward: 100,
        collision: { type: "circle", radius: 28, offset: { x: 0, y: 0 } }
      },
      dragon: {
        health: 2500,
        damage: 100,
        attackRange: 150,
        attackCooldown: 2,
        movementSpeed: 50,
        sightRange: 250,
        leashRange: 400,
        goldReward: 200,
        expReward: 250,
        collision: { type: "circle", radius: 40, offset: { x: 0, y: 0 } }
      },
      baron: {
        health: 5000,
        damage: 150,
        attackRange: 200,
        attackCooldown: 2.5,
        movementSpeed: 40,
        sightRange: 300,
        leashRange: 450,
        goldReward: 500,
        expReward: 500,
        collision: { type: "circle", radius: 55, offset: { x: 0, y: 0 } }
      },
      spider: {
        health: 300,
        damage: 22,
        attackRange: 70,
        attackCooldown: 0.9,
        movementSpeed: 130,
        sightRange: 180,
        leashRange: 300,
        goldReward: 50,
        expReward: 35,
        collision: { type: "circle", radius: 8, offset: { x: 0, y: 0 } }
      }
    }
  },
  MINION_WAVES: {
    SPAWN_INTERVAL: 30,
    FIRST_WAVE_DELAY: 5,
    SPAWN_DELAY_BETWEEN: 0.3,
    WAVE_COMPOSITION: {
      swordsmen: 3,
      archers: 2
    },
    SPAWN_OFFSET: 100
  },
  CHAMPION_SPAWN: {
    BLUE: new Vector(-1100, 1100),
    RED: new Vector(1100, -1100)
  },
  BUSH_GROUPS: [
    { center: new Vector(-900, -900), bushCount: 4, spread: "horizontal" },
    { center: new Vector(0, -1000), bushCount: 3, spread: "horizontal" },
    { center: new Vector(600, -900), bushCount: 4, spread: "horizontal" },
    { center: new Vector(-500, 500), bushCount: 4, spread: "diagonal" },
    { center: new Vector(500, -500), bushCount: 4, spread: "diagonal" },
    { center: new Vector(-600, 900), bushCount: 4, spread: "horizontal" },
    { center: new Vector(0, 1000), bushCount: 3, spread: "horizontal" },
    { center: new Vector(900, 900), bushCount: 4, spread: "horizontal" },
    { center: new Vector(-950, -550), bushCount: 3, spread: "cluster" },
    { center: new Vector(-650, -400), bushCount: 4, spread: "cluster" },
    { center: new Vector(-500, -50), bushCount: 3, spread: "cluster" },
    { center: new Vector(-850, 200), bushCount: 4, spread: "cluster" },
    { center: new Vector(-500, 400), bushCount: 3, spread: "cluster" },
    { center: new Vector(950, 550), bushCount: 3, spread: "cluster" },
    { center: new Vector(650, 400), bushCount: 4, spread: "cluster" },
    { center: new Vector(500, 50), bushCount: 3, spread: "cluster" },
    { center: new Vector(850, -200), bushCount: 4, spread: "cluster" },
    { center: new Vector(500, -400), bushCount: 3, spread: "cluster" },
    { center: new Vector(-150, -100), bushCount: 4, spread: "cluster" },
    { center: new Vector(150, 100), bushCount: 4, spread: "cluster" }
  ],
  BUSH_SETTINGS: {
    SPACING: 35,
    OFFSET_VARIANCE: 10,
    LARGE_BUSH_WIDTH: 100,
    LARGE_BUSH_HEIGHT: 60,
    SMALL_BUSH_WIDTH: 60,
    SMALL_BUSH_HEIGHT: 40,
    VISIBILITY_PADDING: 30
  },
  WALLS: [],
  TOWERS: {
    STATS: {
      health: 3000,
      attackDamage: 150,
      attackRange: 350,
      attackCooldown: 1,
      armor: 60,
      magicResist: 60,
      collision: { type: "circle", radius: 50, offset: { x: 0, y: 0 } }
    },
    POSITIONS: [
      { side: 0, lane: "top", position: new Vector(-1200, 700) },
      { side: 0, lane: "top", position: new Vector(-1200, 200) },
      { side: 0, lane: "mid", position: new Vector(-650, 650) },
      { side: 0, lane: "mid", position: new Vector(-350, 350) },
      { side: 0, lane: "bot", position: new Vector(-200, 1200) },
      { side: 0, lane: "bot", position: new Vector(400, 1200) },
      { side: 1, lane: "top", position: new Vector(200, -1200) },
      { side: 1, lane: "top", position: new Vector(-400, -1200) },
      { side: 1, lane: "mid", position: new Vector(650, -650) },
      { side: 1, lane: "mid", position: new Vector(350, -350) },
      { side: 1, lane: "bot", position: new Vector(1200, -700) },
      { side: 1, lane: "bot", position: new Vector(1200, -200) }
    ]
  },
  DECORATIONS: [
    { position: new Vector(-850, -600), type: "rock_big", scale: 0.75 },
    { position: new Vector(-650, -500), type: "mushroom_mid", scale: 0.55 },
    { position: new Vector(-700, -250), type: "plant_2", scale: 0.7 },
    { position: new Vector(-500, -200), type: "rock_small", scale: 0.6 },
    { position: new Vector(-900, 50), type: "mushroom_big", scale: 0.55 },
    { position: new Vector(-700, 180), type: "plant_1", scale: 0.6 },
    { position: new Vector(-550, 350), type: "rock_mid", scale: 0.65 },
    { position: new Vector(-350, 250), type: "plant_3", scale: 0.5 },
    { position: new Vector(850, 600), type: "rock_big", scale: 0.75, flipX: true },
    { position: new Vector(650, 500), type: "mushroom_mid", scale: 0.55 },
    { position: new Vector(700, 250), type: "plant_2", scale: 0.7, flipX: true },
    { position: new Vector(500, 200), type: "rock_small", scale: 0.6 },
    { position: new Vector(900, -50), type: "mushroom_big", scale: 0.55 },
    { position: new Vector(700, -180), type: "plant_1", scale: 0.6, flipX: true },
    { position: new Vector(550, -350), type: "rock_mid", scale: 0.65 },
    { position: new Vector(350, -250), type: "plant_3", scale: 0.5, flipX: true },
    { position: new Vector(-500, -1050), type: "plant_3", scale: 0.5 },
    { position: new Vector(300, -1100), type: "rock_small", scale: 0.5 },
    { position: new Vector(500, 1050), type: "plant_3", scale: 0.5, flipX: true },
    { position: new Vector(-300, 1100), type: "rock_small", scale: 0.5 },
    { position: new Vector(-300, -150), type: "rock_small", scale: 0.45 },
    { position: new Vector(300, 150), type: "rock_small", scale: 0.45 },
    { position: new Vector(0, 0), type: "plant_1", scale: 0.5 },
    { position: new Vector(-1050, 1050), type: "scarecrow", scale: 0.5 },
    { position: new Vector(1050, -1050), type: "scarecrow", scale: 0.5, flipX: true }
  ]
};
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = state * 1664525 + 1013904223 >>> 0;
    return state / 4294967295;
  };
}
function calculateIndividualBushPositions(groupIndex) {
  const groupConfig = MOBAConfig.BUSH_GROUPS[groupIndex];
  if (!groupConfig)
    return [];
  const { SPACING, OFFSET_VARIANCE, LARGE_BUSH_WIDTH, LARGE_BUSH_HEIGHT, SMALL_BUSH_WIDTH, SMALL_BUSH_HEIGHT } = MOBAConfig.BUSH_SETTINGS;
  const { center, bushCount, spread } = groupConfig;
  const positions = [];
  const halfCount = (bushCount - 1) / 2;
  const random = seededRandom(groupIndex * 12345 + 67890);
  for (let i = 0;i < bushCount; i++) {
    const offset = (i - halfCount) * SPACING;
    const randX = (random() - 0.5) * OFFSET_VARIANCE * 2;
    const randY = (random() - 0.5) * OFFSET_VARIANCE * 2;
    let x = center.x;
    let y = center.y;
    switch (spread) {
      case "horizontal":
        x += offset + randX;
        y += randY;
        break;
      case "vertical":
        x += randX;
        y += offset + randY;
        break;
      case "diagonal":
        x += offset * 0.7 + randX;
        y += offset * 0.7 + randY;
        break;
      case "cluster":
        const angle = i / bushCount * Math.PI * 2 + random() * 0.5;
        const radius = SPACING * 0.8 + random() * SPACING * 0.4;
        x += Math.cos(angle) * radius + randX;
        y += Math.sin(angle) * radius + randY;
        break;
    }
    const isSmall = i % 3 === 0;
    const width = isSmall ? SMALL_BUSH_WIDTH : LARGE_BUSH_WIDTH;
    const height = isSmall ? SMALL_BUSH_HEIGHT : LARGE_BUSH_HEIGHT;
    positions.push({ x, y, width, height });
  }
  return positions;
}
function isPointInBushGroup(point, groupIndex) {
  const bushes = calculateIndividualBushPositions(groupIndex);
  for (const bush of bushes) {
    const halfW = bush.width / 2;
    const halfH = bush.height / 2;
    if (point.x >= bush.x - halfW && point.x <= bush.x + halfW && point.y >= bush.y - halfH && point.y <= bush.y + halfH) {
      return true;
    }
  }
  return false;
}
function calculateBushGroupBounds(center, bushCount, spread) {
  const { SPACING, OFFSET_VARIANCE, LARGE_BUSH_WIDTH, LARGE_BUSH_HEIGHT, VISIBILITY_PADDING } = MOBAConfig.BUSH_SETTINGS;
  const padding = OFFSET_VARIANCE + VISIBILITY_PADDING;
  switch (spread) {
    case "horizontal": {
      const totalWidth = bushCount * (LARGE_BUSH_WIDTH + SPACING);
      const halfW = totalWidth / 2 + padding;
      const halfH = LARGE_BUSH_HEIGHT / 2 + padding;
      return {
        minX: center.x - halfW,
        maxX: center.x + halfW,
        minY: center.y - halfH,
        maxY: center.y + halfH
      };
    }
    case "vertical": {
      const totalHeight = bushCount * (LARGE_BUSH_HEIGHT + SPACING);
      const halfW = LARGE_BUSH_WIDTH / 2 + padding;
      const halfH = totalHeight / 2 + padding;
      return {
        minX: center.x - halfW,
        maxX: center.x + halfW,
        minY: center.y - halfH,
        maxY: center.y + halfH
      };
    }
    case "diagonal":
    case "cluster":
    default: {
      const radius = Math.max(bushCount * SPACING, LARGE_BUSH_WIDTH) + padding;
      return {
        minX: center.x - radius,
        maxX: center.x + radius,
        minY: center.y - radius,
        maxY: center.y + radius
      };
    }
  }
}
// src/config/GameConfig.ts
var GameConfig = {
  TICK: {
    SERVER_TICK_RATE: 125,
    CLIENT_RENDER_RATE: 60,
    SERVER_TICK_MS: 8,
    INPUT_SEND_RATE: 60
  },
  NETWORK: {
    INTERPOLATION_DELAY: 24,
    MAX_LAG_COMPENSATION: 250,
    SNAP_THRESHOLD: 100,
    CORRECTION_THRESHOLD: 5,
    CORRECTION_LERP: 0.3,
    HISTORY_BUFFER_SIZE: 30
  },
  TIMING: {
    SURRENDER_AVAILABLE_AT: 15 * 60,
    RECONNECT_GRACE_PERIOD: 5 * 60,
    AFK_TIMEOUT: 60,
    RECALL_DURATION: 8
  },
  ECONOMY: {
    STARTING_GOLD: 300,
    PASSIVE_GOLD_PER_SECOND: 1.9,
    MINION_GOLD: {
      melee: 21,
      caster: 14,
      siege: 60,
      super: 45
    },
    CHAMPION_KILL_GOLD_BASE: 300,
    ASSIST_GOLD_PERCENT: 0.5,
    DEATH_GOLD_LOSS: 0,
    TOWER_GOLD: {
      global: 50,
      killer: 150
    }
  },
  EXPERIENCE: {
    XP_RANGE: 1400,
    MINION_XP: {
      melee: 60,
      caster: 29,
      siege: 92,
      super: 97
    },
    CHAMPION_KILL_XP_BASE: 140,
    XP_PER_LEVEL_DIFF: 20
  },
  COMBAT: {
    COMBAT_TIMEOUT: 5,
    OOC_REGEN_MULTIPLIER: 2.5,
    RESIST_CAP: 0.9,
    CRIT_DAMAGE_MULTIPLIER: 2
  },
  VISION: {
    CHAMPION_SIGHT_RANGE: 800,
    WARD_SIGHT_RANGE: 600,
    WARD_DURATION: 180,
    MAX_WARDS: 3,
    BUSH_REVEAL_RANGE: 100
  },
  RESPAWN: {
    BASE_RESPAWN_TIME: 6,
    RESPAWN_TIME_PER_LEVEL: 2,
    MAX_RESPAWN_TIME: 60
  },
  MINIONS: {
    MELEE_HEALTH: 470,
    CASTER_HEALTH: 290,
    SIEGE_HEALTH: 800,
    SUPER_HEALTH: 800,
    MELEE_DAMAGE: 12,
    CASTER_DAMAGE: 23,
    SIEGE_DAMAGE: 40,
    SUPER_DAMAGE: 30,
    MOVEMENT_SPEED: 325
  },
  LIMITS: {
    MAX_LEVEL: 18,
    MAX_ABILITY_RANK: 5,
    MAX_ITEM_SLOTS: 6,
    MAX_GAME_DURATION: 60 * 60
  },
  DEBUG: {
    STARTING_LEVEL: 6,
    STARTING_SKILL_POINTS: 6,
    STARTING_GOLD_OVERRIDE: 0
  }
};
// src/utils/damage.ts
function calculateDamageReduction(resist) {
  if (resist >= 0) {
    const reduction = resist / (100 + resist);
    return Math.max(1 - GameConfig.COMBAT.RESIST_CAP, 1 - reduction);
  } else {
    return 2 - 100 / (100 - resist);
  }
}
function calculateDamage(rawDamage, resist, penetrationFlat = 0, penetrationPercent = 0) {
  let effectiveResist = resist * (1 - penetrationPercent);
  effectiveResist = Math.max(0, effectiveResist - penetrationFlat);
  const multiplier = calculateDamageReduction(effectiveResist);
  return rawDamage * multiplier;
}
function calculatePhysicalDamage(rawDamage, armor, armorPenFlat = 0, armorPenPercent = 0) {
  return calculateDamage(rawDamage, armor, armorPenFlat, armorPenPercent);
}
function calculateMagicDamage(rawDamage, magicResist, magicPenFlat = 0, magicPenPercent = 0) {
  return calculateDamage(rawDamage, magicResist, magicPenFlat, magicPenPercent);
}
function calculateCritDamage(baseDamage, critDamageMultiplier = GameConfig.COMBAT.CRIT_DAMAGE_MULTIPLIER) {
  return baseDamage * critDamageMultiplier;
}
function rollCrit(critChance, random = Math.random) {
  return random() < Math.min(1, Math.max(0, critChance));
}
function calculateLifesteal(damageDealt, lifestealPercent) {
  return damageDealt * lifestealPercent;
}
// src/champions/definitions/warrior.ts
function scaling(base, options) {
  return {
    base,
    ...options
  };
}
var WARRIOR_BASE_STATS = {
  health: 580,
  healthRegen: 8,
  resource: 280,
  resourceRegen: 7,
  attackDamage: 60,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 125,
  armor: 35,
  magicResist: 32,
  movementSpeed: 340,
  critChance: 0,
  critDamage: 2
};
var WARRIOR_GROWTH_STATS = {
  health: 95,
  healthRegen: 0.8,
  resource: 40,
  resourceRegen: 0.5,
  attackDamage: 3.5,
  attackSpeed: 2.5,
  armor: 4,
  magicResist: 1.5
};
var WarriorSlash = {
  id: "warrior_slash",
  name: "Cleaving Strike",
  description: "Slash enemies in a cone, dealing {damage} physical damage.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [40, 45, 50, 55, 60],
  cooldown: [6, 5.5, 5, 4.5, 4],
  range: 300,
  aoeRadius: 200,
  coneAngle: Math.PI / 2,
  shape: "cone",
  damage: {
    type: "physical",
    scaling: scaling([60, 95, 130, 165, 200], { adRatio: 0.8 })
  }
};
var WarriorShield = {
  id: "warrior_shield",
  name: "Iron Will",
  description: "Gain a shield absorbing {shield} damage for 3 seconds.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [14, 13, 12, 11, 10],
  shield: {
    scaling: scaling([80, 120, 160, 200, 240], { bonusHealthRatio: 0.08 }),
    duration: 3
  }
};
var WarriorCharge = {
  id: "warrior_charge",
  name: "Valiant Charge",
  description: "Dash forward, dealing {damage} physical damage to enemies hit and slowing them by 30% for 1.5 seconds.",
  type: "active",
  targetType: "skillshot",
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [12, 11, 10, 9, 8],
  range: 500,
  dash: {
    speed: 1200,
    distance: 500
  },
  aoeRadius: 60,
  damage: {
    type: "physical",
    scaling: scaling([50, 85, 120, 155, 190], { adRatio: 0.6 })
  },
  appliesEffects: ["slow_30"],
  effectDuration: 1.5
};
var WarriorUltimate = {
  id: "warrior_ultimate",
  name: "Heroic Strike",
  description: "Leap to target enemy and slam down, dealing {damage} physical damage and stunning them for 1 second.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  range: 600,
  dash: {
    speed: 1500,
    distance: 600
  },
  damage: {
    type: "physical",
    scaling: scaling([150, 250, 350], { adRatio: 1 })
  },
  appliesEffects: ["stun"],
  effectDuration: 1
};
var WarriorPassive = {
  id: "warrior_passive",
  name: "Undying Resolve",
  description: "When below 30% health, gain a shield absorbing {shield} damage and 20% bonus armor for 5 seconds. 60 second cooldown.",
  trigger: "on_low_health",
  healthThreshold: 0.3,
  internalCooldown: 60,
  shield: {
    scaling: scaling([80, 120, 160, 200], { bonusHealthRatio: 0.1 }),
    duration: 5
  },
  statModifiers: [
    { stat: "armor", percentValue: 0.2 }
  ],
  scalesWithLevel: true,
  levelScaling: {
    levels: [1, 6, 11, 16],
    values: [80, 120, 160, 200]
  }
};
var WARRIOR_COLLISION = {
  type: "circle",
  radius: 20,
  offset: { x: 0, y: 2 }
};
var WARRIOR_ANIMATIONS = {
  idle: {
    id: "idle",
    totalFrames: 4,
    baseFrameDuration: 0.2,
    loop: true,
    keyframes: []
  },
  walk: {
    id: "walk",
    totalFrames: 8,
    baseFrameDuration: 0.1,
    loop: true,
    keyframes: []
  },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.083,
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: "sound", soundId: "sword_swing" } },
      { frame: 3, trigger: { type: "damage" } },
      { frame: 3, trigger: { type: "sound", soundId: "sword_hit" } }
    ]
  },
  death: {
    id: "death",
    totalFrames: 8,
    baseFrameDuration: 0.125,
    loop: false,
    keyframes: []
  },
  abilities: {
    warrior_slash: {
      id: "warrior_slash",
      totalFrames: 8,
      baseFrameDuration: 0.05,
      loop: false,
      keyframes: [
        { frame: 4, trigger: { type: "damage" } },
        { frame: 4, trigger: { type: "vfx", vfxId: "slash_arc" } }
      ]
    },
    warrior_shield: {
      id: "warrior_shield",
      totalFrames: 4,
      baseFrameDuration: 0.075,
      loop: false,
      keyframes: [
        { frame: 1, trigger: { type: "effect", effectId: "shield" } }
      ]
    },
    warrior_charge: {
      id: "warrior_charge",
      totalFrames: 6,
      baseFrameDuration: 0.067,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "charge_start" } },
        { frame: 5, trigger: { type: "damage" } }
      ]
    },
    warrior_ultimate: {
      id: "warrior_ultimate",
      totalFrames: 10,
      baseFrameDuration: 0.06,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "leap_start" } },
        { frame: 7, trigger: { type: "damage" } },
        { frame: 7, trigger: { type: "effect", effectId: "stun" } },
        { frame: 7, trigger: { type: "vfx", vfxId: "slam_impact" } }
      ]
    }
  }
};
var WarriorDefinition = {
  id: "warrior",
  name: "Kael",
  title: "The Iron Vanguard",
  class: "warrior",
  attackType: "melee",
  resourceType: "mana",
  baseStats: WARRIOR_BASE_STATS,
  growthStats: WARRIOR_GROWTH_STATS,
  abilities: {
    Q: "warrior_slash",
    W: "warrior_shield",
    E: "warrior_charge",
    R: "warrior_ultimate"
  },
  passive: "warrior_passive",
  collision: WARRIOR_COLLISION,
  animations: WARRIOR_ANIMATIONS,
  attackAnimationSpeedScale: true
};
var WarriorAbilities = {
  warrior_slash: WarriorSlash,
  warrior_shield: WarriorShield,
  warrior_charge: WarriorCharge,
  warrior_ultimate: WarriorUltimate
};
// src/champions/definitions/magnus.ts
function scaling2(base, options) {
  return {
    base,
    ...options
  };
}
var MAGNUS_BASE_STATS = {
  health: 425,
  healthRegen: 5,
  resource: 375,
  resourceRegen: 12,
  attackDamage: 53,
  abilityPower: 0,
  attackSpeed: 0.625,
  attackRange: 550,
  armor: 20,
  magicResist: 30,
  movementSpeed: 330,
  critChance: 0,
  critDamage: 2
};
var MAGNUS_GROWTH_STATS = {
  health: 85,
  healthRegen: 0.5,
  resource: 40,
  resourceRegen: 0.8,
  attackDamage: 3,
  attackSpeed: 1.5,
  armor: 3.5,
  magicResist: 1.25
};
var MagnusFireball = {
  id: "magnus_fireball",
  name: "Fireball",
  description: "Launch a fireball that deals {damage} magic damage to the first enemy hit.",
  type: "active",
  targetType: "skillshot",
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [8, 7.5, 7, 6.5, 6],
  range: 900,
  projectileSpeed: 1200,
  projectileRadius: 30,
  shape: "line",
  damage: {
    type: "magic",
    scaling: scaling2([80, 120, 160, 200, 240], { apRatio: 0.75 })
  }
};
var MagnusShield = {
  id: "magnus_shield",
  name: "Arcane Barrier",
  description: "Create a magical shield absorbing {shield} damage for 4 seconds.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [80, 90, 100, 110, 120],
  cooldown: [18, 16, 14, 12, 10],
  shield: {
    scaling: scaling2([60, 100, 140, 180, 220], { apRatio: 0.4 }),
    duration: 4
  }
};
var MagnusMudGround = {
  id: "magnus_mud",
  name: "Quagmire",
  description: "Create a pool of mud at target location, slowing enemies inside by 20% for 2 seconds.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [70, 75, 80, 85, 90],
  cooldown: [14, 13, 12, 11, 10],
  range: 600,
  aoeRadius: 200,
  shape: "circle",
  appliesEffects: ["slow_20"],
  effectDuration: 2,
  zoneDuration: 2
};
var MagnusMeteor = {
  id: "magnus_meteor",
  name: "Inferno Zone",
  description: "Create a burning zone at target location that deals {damage} magic damage every second for 5 seconds and slows enemies by 10%.",
  type: "active",
  targetType: "ground_target",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  range: 800,
  aoeRadius: 250,
  shape: "circle",
  damage: {
    type: "magic",
    scaling: scaling2([60, 100, 140], { apRatio: 0.25 })
  },
  appliesEffects: ["slow_10"],
  effectDuration: 1,
  zoneDuration: 5,
  zoneTickRate: 1
};
var MagnusPassive = {
  id: "magnus_passive",
  name: "Arcane Surge",
  description: "After casting 4 abilities, your next ability deals 30% bonus damage.",
  trigger: "on_ability_cast",
  usesStacks: true,
  maxStacks: 4,
  stacksPerTrigger: 1,
  stackDuration: 10,
  requiredStacks: 4,
  consumeStacksOnActivation: true
};
var MAGNUS_COLLISION = {
  type: "circle",
  radius: 18,
  offset: { x: 0, y: 2 }
};
var MAGNUS_ANIMATIONS = {
  idle: {
    id: "idle",
    totalFrames: 4,
    baseFrameDuration: 0.2,
    loop: true,
    keyframes: []
  },
  walk: {
    id: "walk",
    totalFrames: 6,
    baseFrameDuration: 0.1,
    loop: true,
    keyframes: []
  },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.1,
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: "sound", soundId: "staff_charge" } },
      { frame: 3, trigger: { type: "projectile" } },
      { frame: 3, trigger: { type: "sound", soundId: "staff_fire" } }
    ]
  },
  death: {
    id: "death",
    totalFrames: 8,
    baseFrameDuration: 0.125,
    loop: false,
    keyframes: []
  },
  abilities: {
    magnus_fireball: {
      id: "magnus_fireball",
      totalFrames: 8,
      baseFrameDuration: 0.0625,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "fireball_charge" } },
        { frame: 4, trigger: { type: "projectile" } },
        { frame: 4, trigger: { type: "vfx", vfxId: "fireball_cast" } }
      ]
    },
    magnus_shield: {
      id: "magnus_shield",
      totalFrames: 4,
      baseFrameDuration: 0.075,
      loop: false,
      keyframes: [
        { frame: 1, trigger: { type: "effect", effectId: "shield" } },
        { frame: 1, trigger: { type: "vfx", vfxId: "arcane_barrier" } }
      ]
    },
    magnus_mud: {
      id: "magnus_mud",
      totalFrames: 6,
      baseFrameDuration: 0.083,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "mud_cast" } },
        { frame: 3, trigger: { type: "effect", effectId: "zone" } },
        { frame: 3, trigger: { type: "vfx", vfxId: "mud_pool" } }
      ]
    },
    magnus_meteor: {
      id: "magnus_meteor",
      totalFrames: 10,
      baseFrameDuration: 0.08,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "meteor_summon" } },
        { frame: 6, trigger: { type: "effect", effectId: "zone" } },
        { frame: 6, trigger: { type: "vfx", vfxId: "inferno_zone" } }
      ]
    }
  }
};
var MagnusDefinition = {
  id: "magnus",
  name: "Magnus",
  title: "The Battlemage",
  class: "mage",
  attackType: "ranged",
  resourceType: "mana",
  baseStats: MAGNUS_BASE_STATS,
  growthStats: MAGNUS_GROWTH_STATS,
  abilities: {
    Q: "magnus_fireball",
    W: "magnus_shield",
    E: "magnus_mud",
    R: "magnus_meteor"
  },
  passive: "magnus_passive",
  collision: MAGNUS_COLLISION,
  animations: MAGNUS_ANIMATIONS,
  attackAnimationSpeedScale: true
};
var MagnusAbilities = {
  magnus_fireball: MagnusFireball,
  magnus_shield: MagnusShield,
  magnus_mud: MagnusMudGround,
  magnus_meteor: MagnusMeteor
};
// src/champions/definitions/elara.ts
function scaling3(base, options) {
  return {
    base,
    ...options
  };
}
var ELARA_BASE_STATS = {
  health: 480,
  healthRegen: 6,
  resource: 400,
  resourceRegen: 14,
  attackDamage: 48,
  abilityPower: 0,
  attackSpeed: 0.625,
  attackRange: 525,
  armor: 22,
  magicResist: 34,
  movementSpeed: 335,
  critChance: 0,
  critDamage: 2
};
var ELARA_GROWTH_STATS = {
  health: 75,
  healthRegen: 0.6,
  resource: 50,
  resourceRegen: 1,
  attackDamage: 2.5,
  attackSpeed: 1.2,
  armor: 3,
  magicResist: 1
};
var ElaraHeal = {
  id: "elara_heal",
  name: "Radiant Blessing",
  description: "Heal target ally for {heal} health.",
  type: "active",
  targetType: "target_ally",
  maxRank: 5,
  manaCost: [70, 80, 90, 100, 110],
  cooldown: [10, 9, 8, 7, 6],
  range: 700,
  heal: {
    scaling: scaling3([70, 110, 150, 190, 230], { apRatio: 0.5 })
  }
};
var ElaraBarrier = {
  id: "elara_barrier",
  name: "Sacred Shield",
  description: "Grant target ally a shield absorbing {shield} damage for 2.5 seconds.",
  type: "active",
  targetType: "target_ally",
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [12, 11, 10, 9, 8],
  range: 700,
  shield: {
    scaling: scaling3([60, 90, 120, 150, 180], { apRatio: 0.35 }),
    duration: 2.5
  }
};
var ElaraSpeed = {
  id: "elara_speed",
  name: "Swift Grace",
  description: "Grant yourself and nearby allies 30% bonus movement speed for 2 seconds.",
  type: "active",
  targetType: "no_target",
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [15, 14, 13, 12, 11],
  aoeRadius: 400,
  shape: "circle",
  appliesEffects: ["speed_30"],
  effectDuration: 2
};
var ElaraResurrection = {
  id: "elara_resurrection",
  name: "Divine Intervention",
  description: "Heal all allies in range for {heal} health and cleanse all debuffs.",
  type: "active",
  targetType: "no_target",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [140, 120, 100],
  aoeRadius: 600,
  shape: "circle",
  heal: {
    scaling: scaling3([150, 250, 350], { apRatio: 0.6 })
  }
};
var ElaraPassive = {
  id: "elara_passive",
  name: "Blessed Presence",
  description: "Nearby allies within 600 units heal 1% of their max health per second.",
  trigger: "always",
  auraRadius: 600,
  heal: {
    scaling: scaling3([0], { maxHealthRatio: 0.01 })
  },
  intervalSeconds: 1
};
var ELARA_COLLISION = {
  type: "circle",
  radius: 18,
  offset: { x: 0, y: 2 }
};
var ELARA_ANIMATIONS = {
  idle: {
    id: "idle",
    totalFrames: 4,
    baseFrameDuration: 0.2,
    loop: true,
    keyframes: []
  },
  walk: {
    id: "walk",
    totalFrames: 6,
    baseFrameDuration: 0.1,
    loop: true,
    keyframes: []
  },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.1,
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: "sound", soundId: "light_cast" } },
      { frame: 3, trigger: { type: "projectile" } },
      { frame: 3, trigger: { type: "sound", soundId: "light_release" } }
    ]
  },
  death: {
    id: "death",
    totalFrames: 8,
    baseFrameDuration: 0.125,
    loop: false,
    keyframes: []
  },
  abilities: {
    elara_heal: {
      id: "elara_heal",
      totalFrames: 6,
      baseFrameDuration: 0.083,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "heal_charge" } },
        { frame: 3, trigger: { type: "effect", effectId: "heal" } },
        { frame: 3, trigger: { type: "vfx", vfxId: "radiant_blessing" } }
      ]
    },
    elara_barrier: {
      id: "elara_barrier",
      totalFrames: 5,
      baseFrameDuration: 0.08,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "shield_cast" } },
        { frame: 2, trigger: { type: "effect", effectId: "shield" } },
        { frame: 2, trigger: { type: "vfx", vfxId: "sacred_shield" } }
      ]
    },
    elara_speed: {
      id: "elara_speed",
      totalFrames: 4,
      baseFrameDuration: 0.075,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "speed_cast" } },
        { frame: 2, trigger: { type: "effect", effectId: "speed_buff" } },
        { frame: 2, trigger: { type: "vfx", vfxId: "swift_grace" } }
      ]
    },
    elara_resurrection: {
      id: "elara_resurrection",
      totalFrames: 12,
      baseFrameDuration: 0.083,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "divine_charge" } },
        { frame: 8, trigger: { type: "effect", effectId: "heal" } },
        { frame: 8, trigger: { type: "effect", effectId: "cleanse" } },
        { frame: 8, trigger: { type: "vfx", vfxId: "divine_intervention" } }
      ]
    }
  }
};
var ElaraDefinition = {
  id: "elara",
  name: "Elara",
  title: "The Radiant Healer",
  class: "support",
  attackType: "ranged",
  resourceType: "mana",
  baseStats: ELARA_BASE_STATS,
  growthStats: ELARA_GROWTH_STATS,
  abilities: {
    Q: "elara_heal",
    W: "elara_barrier",
    E: "elara_speed",
    R: "elara_resurrection"
  },
  passive: "elara_passive",
  collision: ELARA_COLLISION,
  animations: ELARA_ANIMATIONS,
  attackAnimationSpeedScale: true
};
var ElaraAbilities = {
  elara_heal: ElaraHeal,
  elara_barrier: ElaraBarrier,
  elara_speed: ElaraSpeed,
  elara_resurrection: ElaraResurrection
};
// src/champions/definitions/vex.ts
function scaling4(base, options) {
  return {
    base,
    ...options
  };
}
var VEX_BASE_STATS = {
  health: 520,
  healthRegen: 6,
  resource: 260,
  resourceRegen: 8,
  attackDamage: 65,
  abilityPower: 0,
  attackSpeed: 0.68,
  attackRange: 125,
  armor: 28,
  magicResist: 30,
  movementSpeed: 350,
  critChance: 0,
  critDamage: 2
};
var VEX_GROWTH_STATS = {
  health: 80,
  healthRegen: 0.6,
  resource: 35,
  resourceRegen: 0.6,
  attackDamage: 4,
  attackSpeed: 3,
  armor: 3.5,
  magicResist: 1.25
};
var VexShuriken = {
  id: "vex_shuriken",
  name: "Shadow Shuriken",
  description: "Throw a shuriken that deals {damage} physical damage and marks the target for 4 seconds. Marked enemies take 10% increased damage from Vex.",
  type: "active",
  targetType: "skillshot",
  maxRank: 5,
  manaCost: [30, 30, 30, 30, 30],
  cooldown: [6, 5.5, 5, 4.5, 4],
  range: 700,
  projectileSpeed: 1500,
  projectileRadius: 20,
  shape: "line",
  damage: {
    type: "physical",
    scaling: scaling4([40, 70, 100, 130, 160], { adRatio: 0.7 })
  },
  appliesEffects: ["vex_mark"],
  effectDuration: 4
};
var VexShroud = {
  id: "vex_shroud",
  name: "Shadow Shroud",
  description: "Become invisible for 1.5 seconds and gain 20% bonus movement speed. Attacking or using abilities breaks stealth.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [50, 45, 40, 35, 30],
  cooldown: [18, 16, 14, 12, 10],
  appliesEffects: ["vex_stealth", "speed_20"],
  effectDuration: 1.5
};
var VexDash = {
  id: "vex_dash",
  name: "Shadow Step",
  description: "Dash to target location and empower your next basic attack to deal {damage} bonus physical damage. If an enemy is marked, dash resets its cooldown.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [40, 40, 40, 40, 40],
  cooldown: [14, 12, 10, 8, 6],
  range: 400,
  dash: {
    speed: 1400,
    distance: 400
  },
  damage: {
    type: "physical",
    scaling: scaling4([30, 50, 70, 90, 110], { adRatio: 0.5 })
  },
  appliesEffects: ["vex_empowered"],
  effectDuration: 4
};
var VexExecute = {
  id: "vex_execute",
  name: "Death Mark",
  description: "Mark target enemy champion. After 2 seconds, the mark detonates dealing {damage} physical damage plus 30% of damage dealt during the mark.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 3,
  manaCost: [0, 0, 0],
  cooldown: [100, 80, 60],
  range: 400,
  damage: {
    type: "physical",
    scaling: scaling4([100, 200, 300], { adRatio: 1 })
  },
  appliesEffects: ["vex_death_mark"],
  effectDuration: 2,
  affectsMinions: false,
  affectsJungleCamps: false
};
var VexPassive = {
  id: "vex_passive",
  name: "Assassin's Mark",
  description: "Every 3rd basic attack deals bonus true damage equal to 4% of the target's max health.",
  trigger: "on_hit",
  usesStacks: true,
  maxStacks: 3,
  stacksPerTrigger: 1,
  stackDuration: 5,
  requiredStacks: 3,
  consumeStacksOnActivation: true,
  damage: {
    type: "true",
    scaling: scaling4([0], { maxHealthRatio: 0.04 })
  }
};
var VEX_COLLISION = {
  type: "circle",
  radius: 18,
  offset: { x: 0, y: 2 }
};
var VEX_ANIMATIONS = {
  idle: {
    id: "idle",
    totalFrames: 4,
    baseFrameDuration: 0.175,
    loop: true,
    keyframes: []
  },
  walk: {
    id: "walk",
    totalFrames: 8,
    baseFrameDuration: 0.08,
    loop: true,
    keyframes: []
  },
  attack: {
    id: "attack",
    totalFrames: 5,
    baseFrameDuration: 0.08,
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: "sound", soundId: "blade_slash" } },
      { frame: 2, trigger: { type: "damage" } },
      { frame: 2, trigger: { type: "sound", soundId: "blade_hit" } }
    ]
  },
  death: {
    id: "death",
    totalFrames: 8,
    baseFrameDuration: 0.125,
    loop: false,
    keyframes: []
  },
  abilities: {
    vex_shuriken: {
      id: "vex_shuriken",
      totalFrames: 6,
      baseFrameDuration: 0.05,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "shuriken_throw" } },
        { frame: 2, trigger: { type: "projectile" } },
        { frame: 2, trigger: { type: "vfx", vfxId: "shadow_shuriken" } }
      ]
    },
    vex_shroud: {
      id: "vex_shroud",
      totalFrames: 4,
      baseFrameDuration: 0.075,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "shroud_activate" } },
        { frame: 1, trigger: { type: "effect", effectId: "stealth" } },
        { frame: 1, trigger: { type: "vfx", vfxId: "shadow_shroud" } }
      ]
    },
    vex_dash: {
      id: "vex_dash",
      totalFrames: 5,
      baseFrameDuration: 0.06,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "dash_start" } },
        { frame: 4, trigger: { type: "effect", effectId: "empower" } },
        { frame: 4, trigger: { type: "vfx", vfxId: "shadow_step" } }
      ]
    },
    vex_execute: {
      id: "vex_execute",
      totalFrames: 8,
      baseFrameDuration: 0.0625,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "death_mark_cast" } },
        { frame: 4, trigger: { type: "effect", effectId: "death_mark" } },
        { frame: 4, trigger: { type: "vfx", vfxId: "death_mark" } }
      ]
    }
  }
};
var VexDefinition = {
  id: "vex",
  name: "Vex",
  title: "The Shadow Blade",
  class: "assassin",
  attackType: "melee",
  resourceType: "energy",
  baseStats: VEX_BASE_STATS,
  growthStats: VEX_GROWTH_STATS,
  abilities: {
    Q: "vex_shuriken",
    W: "vex_shroud",
    E: "vex_dash",
    R: "vex_execute"
  },
  passive: "vex_passive",
  collision: VEX_COLLISION,
  animations: VEX_ANIMATIONS,
  attackAnimationSpeedScale: true
};
var VexAbilities = {
  vex_shuriken: VexShuriken,
  vex_shroud: VexShroud,
  vex_dash: VexDash,
  vex_execute: VexExecute
};
// src/champions/definitions/gorath.ts
function scaling5(base, options) {
  return {
    base,
    ...options
  };
}
var GORATH_BASE_STATS = {
  health: 650,
  healthRegen: 9,
  resource: 320,
  resourceRegen: 8,
  attackDamage: 55,
  abilityPower: 0,
  attackSpeed: 0.6,
  attackRange: 150,
  armor: 40,
  magicResist: 35,
  movementSpeed: 330,
  critChance: 0,
  critDamage: 2
};
var GORATH_GROWTH_STATS = {
  health: 110,
  healthRegen: 1,
  resource: 45,
  resourceRegen: 0.6,
  attackDamage: 3,
  attackSpeed: 2,
  armor: 5,
  magicResist: 2
};
var GorathSlam = {
  id: "gorath_slam",
  name: "Ground Slam",
  description: "Slam the ground, dealing {damage} magic damage and slowing enemies by 40% for 1 second.",
  type: "active",
  targetType: "no_target",
  maxRank: 5,
  manaCost: [50, 55, 60, 65, 70],
  cooldown: [8, 7.5, 7, 6.5, 6],
  aoeRadius: 300,
  shape: "circle",
  damage: {
    type: "magic",
    scaling: scaling5([60, 100, 140, 180, 220], { bonusHealthRatio: 0.04 })
  },
  appliesEffects: ["slow_40"],
  effectDuration: 1
};
var GorathFortify = {
  id: "gorath_fortify",
  name: "Stone Skin",
  description: "Increase armor and magic resist by 30% for 4 seconds.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [16, 15, 14, 13, 12],
  appliesEffects: ["gorath_fortify_buff", "gorath_fortify_mr_buff"],
  effectDuration: 4
};
var GorathTaunt = {
  id: "gorath_taunt",
  name: "Defiant Roar",
  description: "Taunt all nearby enemies, forcing them to attack you for 1.5 seconds.",
  type: "active",
  targetType: "no_target",
  maxRank: 5,
  manaCost: [70, 70, 70, 70, 70],
  cooldown: [16, 15, 14, 13, 12],
  aoeRadius: 350,
  shape: "circle",
  appliesEffects: ["taunt"],
  effectDuration: 1.5,
  affectsMinions: false
};
var GorathEarthquake = {
  id: "gorath_earthquake",
  name: "Earthquake",
  description: "Create a massive earthquake dealing {damage} magic damage and knocking up all enemies for 1 second.",
  type: "active",
  targetType: "no_target",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [130, 110, 90],
  aoeRadius: 450,
  aoeDelay: 0.5,
  shape: "circle",
  damage: {
    type: "magic",
    scaling: scaling5([150, 275, 400], { bonusHealthRatio: 0.06 })
  },
  appliesEffects: ["knockup"],
  effectDuration: 1
};
var GorathPassive = {
  id: "gorath_passive",
  name: "Immovable",
  description: "When taking damage, gain 5 armor (max 10 stacks). Stacks decay after 4 seconds out of combat.",
  trigger: "on_take_damage",
  usesStacks: true,
  maxStacks: 10,
  stacksPerTrigger: 1,
  stackDuration: 4,
  internalCooldown: 0.5,
  statModifiers: [
    { stat: "armor", flatValue: 5 }
  ]
};
var GORATH_COLLISION = {
  type: "circle",
  radius: 25,
  offset: { x: 0, y: 3 }
};
var GORATH_ANIMATIONS = {
  idle: {
    id: "idle",
    totalFrames: 4,
    baseFrameDuration: 0.25,
    loop: true,
    keyframes: []
  },
  walk: {
    id: "walk",
    totalFrames: 8,
    baseFrameDuration: 0.125,
    loop: true,
    keyframes: []
  },
  attack: {
    id: "attack",
    totalFrames: 7,
    baseFrameDuration: 0.1,
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: "sound", soundId: "rock_swing" } },
      { frame: 4, trigger: { type: "damage" } },
      { frame: 4, trigger: { type: "sound", soundId: "rock_impact" } }
    ]
  },
  death: {
    id: "death",
    totalFrames: 10,
    baseFrameDuration: 0.125,
    loop: false,
    keyframes: []
  },
  abilities: {
    gorath_slam: {
      id: "gorath_slam",
      totalFrames: 8,
      baseFrameDuration: 0.075,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "slam_windup" } },
        { frame: 5, trigger: { type: "damage" } },
        { frame: 5, trigger: { type: "effect", effectId: "slow" } },
        { frame: 5, trigger: { type: "vfx", vfxId: "ground_slam" } }
      ]
    },
    gorath_fortify: {
      id: "gorath_fortify",
      totalFrames: 5,
      baseFrameDuration: 0.08,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "stone_armor" } },
        { frame: 2, trigger: { type: "effect", effectId: "fortify" } },
        { frame: 2, trigger: { type: "vfx", vfxId: "stone_skin" } }
      ]
    },
    gorath_taunt: {
      id: "gorath_taunt",
      totalFrames: 8,
      baseFrameDuration: 0.0875,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "roar_start" } },
        { frame: 4, trigger: { type: "effect", effectId: "taunt" } },
        { frame: 4, trigger: { type: "vfx", vfxId: "defiant_roar" } }
      ]
    },
    gorath_earthquake: {
      id: "gorath_earthquake",
      totalFrames: 12,
      baseFrameDuration: 0.083,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: "sound", soundId: "earthquake_charge" } },
        { frame: 6, trigger: { type: "vfx", vfxId: "earthquake_warning" } },
        { frame: 9, trigger: { type: "damage" } },
        { frame: 9, trigger: { type: "effect", effectId: "knockup" } },
        { frame: 9, trigger: { type: "vfx", vfxId: "earthquake_impact" } }
      ]
    }
  }
};
var GorathDefinition = {
  id: "gorath",
  name: "Gorath",
  title: "The Stone Guardian",
  class: "tank",
  attackType: "melee",
  resourceType: "mana",
  baseStats: GORATH_BASE_STATS,
  growthStats: GORATH_GROWTH_STATS,
  abilities: {
    Q: "gorath_slam",
    W: "gorath_fortify",
    E: "gorath_taunt",
    R: "gorath_earthquake"
  },
  passive: "gorath_passive",
  collision: GORATH_COLLISION,
  animations: GORATH_ANIMATIONS,
  attackAnimationSpeedScale: true
};
var GorathAbilities = {
  gorath_slam: GorathSlam,
  gorath_fortify: GorathFortify,
  gorath_taunt: GorathTaunt,
  gorath_earthquake: GorathEarthquake
};
// src/champions/ChampionRegistry.ts
var CHAMPION_DEFINITIONS = {
  warrior: WarriorDefinition,
  magnus: MagnusDefinition,
  elara: ElaraDefinition,
  vex: VexDefinition,
  gorath: GorathDefinition
};
function getChampionDefinition(id) {
  return CHAMPION_DEFINITIONS[id];
}
function getAllChampionIds() {
  return Object.keys(CHAMPION_DEFINITIONS);
}
function getAllChampionDefinitions() {
  return Object.values(CHAMPION_DEFINITIONS);
}
// src/abilities/AbilityRegistry.ts
var ABILITY_DEFINITIONS = {
  ...WarriorAbilities,
  ...MagnusAbilities,
  ...ElaraAbilities,
  ...VexAbilities,
  ...GorathAbilities
};
function getAbilityDefinition(id) {
  return ABILITY_DEFINITIONS[id];
}
function getAllAbilityIds() {
  return Object.keys(ABILITY_DEFINITIONS);
}
function getChampionAbilities(championId) {
  const prefix = `${championId}_`;
  return Object.values(ABILITY_DEFINITIONS).filter((ability) => ability.id.startsWith(prefix));
}
// src/abilities/PassiveRegistry.ts
var PASSIVE_DEFINITIONS = {
  warrior_passive: WarriorPassive,
  magnus_passive: MagnusPassive,
  elara_passive: ElaraPassive,
  vex_passive: VexPassive,
  gorath_passive: GorathPassive
};
function getPassiveDefinition(id) {
  return PASSIVE_DEFINITIONS[id];
}
function getAllPassiveIds() {
  return Object.keys(PASSIVE_DEFINITIONS);
}
function getChampionPassive(championId) {
  return PASSIVE_DEFINITIONS[`${championId}_passive`];
}
function createDefaultPassiveState() {
  return {
    isActive: false,
    cooldownRemaining: 0,
    stacks: 0,
    stackTimeRemaining: 0,
    nextIntervalIn: 0
  };
}
export {
  scaleAnimationSpeed,
  rollCrit,
  oppositeSide,
  isVfxTrigger,
  isTargetable,
  isSoundTrigger,
  isSided,
  isRectangleCollision,
  isProjectileTrigger,
  isPointInBushGroup,
  isEffectTrigger,
  isDamageable,
  isDamageTrigger,
  isCircleCollision,
  isCapsuleCollision,
  isAnimationComplete,
  hasItem,
  getTriggerTime,
  getPassiveLevelValue,
  getPassiveDefinition,
  getKeyframesInRange,
  getKeyframeAtTime,
  getFrameAtTime,
  getEffectiveRadius,
  getCollisionCenter,
  getCollisionBounds,
  getChampionPassive,
  getChampionDefinition,
  getChampionAbilities,
  getAttackAnimationSpeed,
  getAttackAnimationDuration,
  getAllPassiveIds,
  getAllChampionIds,
  getAllChampionDefinitions,
  getAllAbilityIds,
  getAbilityDefinition,
  findEmptySlot,
  defaultCCStatus,
  createDefaultWalkAnimation,
  createDefaultPassiveState,
  createDefaultIdleAnimation,
  createDefaultAttackAnimation,
  computeCCStatus,
  collisionShapesOverlap,
  canAbilityAffectEntityType,
  calculateStatsAtLevel,
  calculateStat,
  calculatePhysicalDamage,
  calculateMagicDamage,
  calculateLifesteal,
  calculateItemStats,
  calculateIndividualBushPositions,
  calculateDamageReduction,
  calculateDamage,
  calculateCritDamage,
  calculateCollisionSeparation,
  calculateBushGroupBounds,
  calculateAttackSpeed,
  calculateAnimationPlayback,
  calculateAbilityValue,
  WarriorUltimate,
  WarriorSlash,
  WarriorShield,
  WarriorPassive,
  WarriorDefinition,
  WarriorCharge,
  WarriorAbilities,
  VexShuriken,
  VexShroud,
  VexPassive,
  VexExecute,
  VexDefinition,
  VexDash,
  VexAbilities,
  Vector,
  TowerTargetPriority,
  TEAM_RED,
  TEAM_BLUE,
  Square,
  ServerMessageType,
  Rectangle,
  PASSIVE_DEFINITIONS,
  NullShape,
  MagnusShield,
  MagnusPassive,
  MagnusMudGround,
  MagnusMeteor,
  MagnusFireball,
  MagnusDefinition,
  MagnusAbilities,
  MOBAConfig,
  LEVEL_EXPERIENCE,
  InputType,
  GorathTaunt,
  GorathSlam,
  GorathPassive,
  GorathFortify,
  GorathEarthquake,
  GorathDefinition,
  GorathAbilities,
  GameEventType,
  GameConfig,
  EntityType,
  EntityChangeMask,
  ElaraSpeed,
  ElaraResurrection,
  ElaraPassive,
  ElaraHeal,
  ElaraDefinition,
  ElaraBarrier,
  ElaraAbilities,
  DEFAULT_TOWER_STATS,
  DEFAULT_TOWER_REWARDS,
  DEFAULT_TOWER_COLLISION,
  DEFAULT_NEXUS_STATS,
  DEFAULT_MINION_WAVE_CONFIG,
  DEFAULT_MINION_STATS,
  DEFAULT_MINION_COLLISION,
  DEFAULT_INHIBITOR_STATS,
  DEFAULT_CHAMPION_COLLISION,
  ClientMessageType,
  Circle,
  CHAMPION_DEFINITIONS,
  AbilityEntityType,
  ABILITY_DEFINITIONS
};
