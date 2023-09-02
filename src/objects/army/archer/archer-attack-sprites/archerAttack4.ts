/** This file is part of Super Siege of Baghdad.
 * https://github.com/mvasilkov/super2023
 * @license GPLv3 | Copyright (c) 2023 Mark Vasilkov
 */
'use strict'
import { PixelArt } from "@/sprites/PixelArtBuilder"

const value = 0x1cb2e68e5d27bb3aea862852bf2f394b3294f760977b1fa1711e0c04773391e08a4f6ba2af64fc2271d3c29e6fecaf79a75b4bbf3ad8491aa06fc4f5898d39306a18238c7fd488656d788e74abcfda378f3923453e6eba3669a2577cecd66d7682c438c0b35e39231b8f9402dae152cc156d3709f9d9e9e36aa6e749f838e49292d9b678619508e17503afc1b44fc100567d98dbf3824453241ba66fc85b74a2feb6364e25e6b248ed0400156cbf7ea2aca63a5b24c8c17d79db748cf8d4b6eb2bfa2170bdb36d24ed4b5903028e7f70f933c724a4dcf7c74c55e4ff53baf3a2351f63d6d8179ed32a49d48ff79b033ec75bb77b285d6e8965aad9a65d59c15a6466d2fe02ce99fce02ed24a93b3048f13f76bc6da39ce46c08822650c82029c2e43e967ff8393eda2d837d0f8e2106e9617388422e63ba0ea6605f4be8559ff99f7b6953ca8349901be7eb56fc4c4a2896e7609468e5048d3f14f3713073606b9cd8n
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

const archerAttack4: PixelArt = [
  value,
  width,
  height,
  cardinality,
  palette,
]

export default archerAttack4

