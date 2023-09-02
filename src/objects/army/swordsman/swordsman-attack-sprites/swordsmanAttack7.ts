/** This file is part of Super Siege of Baghdad.
 * https://github.com/mvasilkov/super2023
 * @license GPLv3 | Copyright (c) 2023 Mark Vasilkov
 */
'use strict'
import { PixelArt } from "@/sprites/PixelArtBuilder"

const value = 0x4406ab721995ecd905dd2768564abc6a9102d27fde1b75e1209bc0ed6c41595dfb67cd69040c299ca745b7f2281b8caf05c04f9e5fb8da4543c169ea5163d9c067463195aeb78b472a8c2ab7dcb3e4a915a0a403e181a8e2e7c098225b0729ec3e9d68ca5374075c8c3709a9549f5cad2b713275df9afa8b8ddf9b271a5a706c61ca91dbcaa5995ecf66b05c57f91cdf3ef3461bf69e993c8eada58f6457e4555487fcd7b6bc3d6e0f097ca3bd905c4acdd1a70a089f626c48ab954cb627669131640e59164422dc0014296931d3797825fb88d15db4550de7840f302c9014be97276d7a073e75a0cfd915fcb909fdb38df37f03868cb996d4f5dd9aefac402043b95515811548115912ebf3a98a3d74f5a9cfdc4111df60389ce00187922be70cab7a884d4e4738f1da528f957d62e2c40acd4dbeffb3b5ac4ca35472cf4f80290000000000000000000n
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

const swordsmanAttack7: PixelArt = [
  value,
  width,
  height,
  cardinality,
  palette,
]

export default swordsmanAttack7

