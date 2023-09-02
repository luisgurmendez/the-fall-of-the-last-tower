/** This file is part of Super Siege of Baghdad.
 * https://github.com/mvasilkov/super2023
 * @license GPLv3 | Copyright (c) 2023 Mark Vasilkov
 */
'use strict'

const value = 0x1cb2e68e5d27bb3aea8836fa5b40535d154a7867f26027a37b2dbf3883c727af739c20b58a53c2740722e5e55dc04290981c3af68d26d9f88e7d1b6397d4feec7e78cdb2727ca13d792e23f1efe5696291d35511c88bc1b506568fdda3f0ad7f0e024650dcd7de4b3231fa20ce61d9de287d2eb87e07552ce421af6382c9d6cbcb6d65799b7d8faf5ab68dd4f956c6e2b161b59ede181410844966173a80ea7f92ea97ad88166f63c318d69273a6328b4be0b39e78af0ce0e764ad160add7b0a1a4fba3bf259c8864f8ced172a72e8a6a028e0d842f8092214fd0d97b9d5b5d596e3680f67e1908f95ec6b0e944817e30b80104c4fc8c630b6416f332cd5f018b5c0ddb27787423f11f8a4fee45edddefc909d9113c2d4d29595e434cbd50af175af0aa614a220f2e62ebfbe3a6ca912e88d2d02817ba864152b29d762825ed4230e2e369b683106968b1fa3b5bd3fe2e534c1abdc264780e89f081338f3f4193b996n
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
