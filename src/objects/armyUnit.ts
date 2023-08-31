// enum ArmyUnitType{
//     Catapult,
//     Archer,
//     Knight,
//     Spearman,
//     Swordsman,
// }

enum ArmyUnitSide {
    Player,
    Enemy,
}

interface ArmyUnit {
    // 0 player, 1 enemy
    side: 0 | 1;
}
