/** This file is part of Super Siege of Baghdad.
 * https://github.com/mvasilkov/super2023
 * @license GPLv3 | Copyright (c) 2023 Mark Vasilkov
 */
'use strict'
import { PixelArt } from "@/sprites/PixelArtBuilder"

const value = 0x1133e041f9552a70050dd6da28e7893c76dff23dd65786a6136086957cd9eb4a509e8ee62cb82d97116806a4b4a2eb24f3aaafa6aa51341d4db669cf077daf1c0cea813e51958357f74104f27f254d82ade66db780d7c0e9aa742dcb551f7884e4e7338f93d970ccafc11c03ab412b81ff556b40e7469d9c27ea54306237be2a6666f881a5b5bbb26eb911934ba59418f4970fe84a99166e0cf7396c2f45505dedcfd00d3fbdc3abb5f096568bb965f3ff7511051fa5df52fdbf26ff80b73410f18510bc68d912342580731a888e75fe88121f0fb66e725ce1fac44878aefef597fc2a9ea8dcc87cc746fda2a1dd9db6db61b7eb1df092a8536dcd54c0a6f3a98a3d74f5a9cfdc4111df60389ce00187922be70cab7a884d4e4738f1da528f957d62e2c40acd4dbeffb3b5ac4ca35472cf4f80290000000000000000000n
const width = 32
const height = 32
const cardinality = 6
const palette = [
  ,
  0x000000,
  0x213ded,
  0x414143,
  0x7e7979,
  0xffffff,
]

const swordsmanWalk3: PixelArt = [
  value,
  width,
  height,
  cardinality,
  palette,
]

export default swordsmanWalk3

