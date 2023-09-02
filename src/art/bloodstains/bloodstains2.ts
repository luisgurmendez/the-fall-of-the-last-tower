/** This file is part of Super Siege of Baghdad.
 * https://github.com/mvasilkov/super2023
 * @license GPLv3 | Copyright (c) 2023 Mark Vasilkov
 */
'use strict'
import { PixelArt } from "@/sprites/PixelArtBuilder"

const value = 0x3862d0763e46d566465dd45f39ba4603eb55143b86e271f6d2ed69c73a5eb87d5213551d07a6de464c0ed7a94dddaffa8229cea1461647a779e3ad8c85ce9ee6dbfb3405b9a2212302c4230000000n
const width = 16
const height = 16
const cardinality = 6
const palette = [
  ,
  0x000000,
  0x414143,
  0x7e7979,
  0xa10000,
  0xffffff,
]

const bloodstains2: PixelArt = [
  value,
  width,
  height,
  cardinality,
  palette,
]

export default bloodstains2

