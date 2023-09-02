/** This file is part of Super Siege of Baghdad.
 * https://github.com/mvasilkov/super2023
 * @license GPLv3 | Copyright (c) 2023 Mark Vasilkov
 */
'use strict'
import { PixelArt } from "@/sprites/PixelArtBuilder"

const value = 0x1cb2e68e5d27bb3aea8836fa5b40535d154a7867f26027a37b2dbf3883c727af739c20b58a53c2740722e5e55dc04290981c3af68d26d9f88e7d1b6397d4feec7e78cdb2727ca13d792e23f1efe5696291d35511c88bc1b506568fdda3f0ad7f0e024650dcd7de4b3231fa20ce61d9de287d2eb87e07552ce421af6383f67b8eee76797ca8ce26a723f5fb05ea1cb1cbce9f1efb6b38f21046d4046e45fd9b7bfdc98e0135c57e282b2bb7fe5d2754367ec1cd4547dd66bd5eeb27c4b1d20291cb416ad895612e8dafef1ee06692ac0a15821ad73d20b3fe0095bf62983d77b5a0b37b61316d71e400ea3b5816f82583e998a6d1507e76b06f350003981b5775ec18060652173301df771e3c2c3e6787bef25b79730d48a2fcb10859971c5c71f856c26df2e4932459a080a03aed40b9eefbf44aa9a0ebb88cde24326d0dc8b53009f3a7fa638cba9e0797579333f1e0fcb19cbe81e7772b6e9808ea9710a2177f780n
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

const archerAttack1: PixelArt = [
  value,
  width,
  height,
  cardinality,
  palette,
]

export default archerAttack1

