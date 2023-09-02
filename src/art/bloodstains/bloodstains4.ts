/** This file is part of Super Siege of Baghdad.
 * https://github.com/mvasilkov/super2023
 * @license GPLv3 | Copyright (c) 2023 Mark Vasilkov
 */
'use strict'

import { PixelArt } from "@/sprites/PixelArtBuilder"

const value = 0xf8718982a5b10bd3f6f2694cb13b216590b940adb7932fcb9385f9ea3f8a5f0f25ffb3a152ad9f25afd6288a1facc140cf18b92ae8c33ed6b9b3b29d0eb261da7ee5f5f0be5256d367b2dff3a7d1c7a8e66573a49a297fn
const width = 16
const height = 16
const cardinality = 7
const palette = [
  ,
  0x000000,
  0x6d0b0b,
  0x793700,
  0x7e7979,
  0xa10000,
  0x822b2b,
]

const bloodstains4: PixelArt = [
  value,
  width,
  height,
  cardinality,
  palette,
]

export default bloodstains4

