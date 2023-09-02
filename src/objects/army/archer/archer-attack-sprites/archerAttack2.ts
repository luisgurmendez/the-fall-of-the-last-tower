/** This file is part of Super Siege of Baghdad.
 * https://github.com/mvasilkov/super2023
 * @license GPLv3 | Copyright (c) 2023 Mark Vasilkov
 */
'use strict'

const value = 0x1cb2e68e5d27bb3aea8836fa5b40535d154a7867f26027a37b2dbf3883c727af739c20b58a53c2740722e5e55dc04290981c3af68d26d9f890441307c0be7552552fdf726fc40c8afb2196e48cbc2c2919924852203bf55028a77361b1e6d34c717be1d14cf028243573232118434c8c17e63f34b378217e61cb3558748c73022b808d7134ba766f609527ab4b01a8b1ca41363dd7333b7feb70e7bb87c771f6f1251e0d21036690ac1930a2a701e368ff7607957af1c0ec702bb3422a48cddf0b484cb879cd369dbb911ceddf44f686189b049216dbfe791f5d59aa2d3350b9edc1ef2bf8abc1450a5cf4438d7e19d6294a0cab553226c04ff96845d9922e8ecd81d9d21f7730bdb4eb879384b1f2a2673c69fe678dd4d4f675a933a1fd9516f8d9ab19390add1326bc1945f855d9353687cd00f906c0916a31241cabe66c93465afd0a6dcc723f5d8fbc23e33a5bcb57ffacc53c2adeca2190c1aad43e5655505cbn
const width = 32
const height = 32
const cardinality = 7
const palette = [
  ,
  0x000000,
  0x213ded,
  0x793700,
  0x7e7979,
  0xedc59a,
  0xffffff,
]

const archerAttack2 =  {
    value,
    width,
    height,
    cardinality,
    palette,
}

export default archerAttack2

